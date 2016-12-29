const fs = require('fs');
const async = require('async');
const https = require('https');
const url = require('url');
const io = require('socket.io');
const _ = require('lodash');
const kurento = require('kurento-client');
const mongo = require('../mongo');
const common = require('spred-common');

const KurentoUtils = require('../helpers/kurento-utils');
const Spredcast = require('./spredcast');
const Session = require('./session');
const User = require('./user');

var Server = function(options) {
	const PORT = process.env.PORT || 8443;
	this.conf = {
		as_uri: options && options.as_uri ? options.as_uri : `https://0.0.0.0:${PORT}`,
		kms_uri: options && options.kms_uri ? options.kms_uri : 'ws://ec2-52-212-178-211.eu-west-1.compute.amazonaws.com:8888/kurento'
	};

	this.options = {
		key: fs.readFileSync('keys/spred.key'),
		cert: fs.readFileSync('keys/spred.crt'),
		requestCert: true,
		rejectUnauthorized: false
	};

	console.log("Connecting server to Kurento Media Server...");
	kurento(this.conf.kms_uri, function(error, _kurentoClient) {
		if (error) {
			console.error("Could not find media server at address" + this.conf.kms_uri + ". Exiting with error : " + error);
			return null;
		}

		console.log("Connection to Kurento Media Server : OK");
		this.kurentoClient = _kurentoClient;
	}.bind(this));

	return this;
};

Server.prototype.start = function() {
	var asUrl = url.parse(this.conf.as_uri);
	var port = asUrl.port;
	var httpsServer = https.createServer(this.options);
	var wss = new io(httpsServer);

	wss.set('origins', ['web-app.herokuapp.com']);
	// TODO: SPREDCASTS IN THE SERVER -> Need to get them from DB with Spred is ready
	const spredcasts = [];

	httpsServer.listen(port, function() {
		console.log(`Open ${url.format(asUrl)} with a WebRTC capable browser`);
	});

	wss.on('error', function(err) {
		console.error(`Got error on socket.io init : `, err);
	});
	wss.on('connection', function(socket) {
		console.log('connection received');
		const session = new Session(socket);
		const kurentoClient = this.kurentoClient;

		requestIdentity(session);

		session.socket.on('disconnect', function() {
			endSession(session);
		});

		session.socket.on('ice_candidate', function(ice_candidate) {
			KurentoUtils.processIceCandidate(session, ice_candidate);
		});

		session.socket.on('auth_answer', function(auth_answer) {
			onAuthAnswer(kurentoClient, session, spredcasts, auth_answer);
		});
	}.bind(this));
};

function requestIdentity(session) {
	console.log(`Connection received with sessionId ${session.id}`);
	session.socket.emit('auth_request', {});
}

function endSession(session) {
	if (session && session.id) {
		console.info(`Connection with ${session.id} lost.`);
		if (session.spredCast) {
			async.parallel([
				(next) => common.spredCastModel.updateUserCount(session.spredCast.id, (session.spredCast.viewers.length + !!session.spredCast.presenter) - 1, (err) => {
					if (err) {
						return next(err);
					}
					console.info(`Leaving cast ${session.spredCast.id}. ${session.spredCast.viewers.length - 1} viewer(s) remaining.`);
					return next();
				}),
				(next) => {
					if (!session.spredCast || !session.spredCast.presenter || session.spredCast.presenter.id !== session.id) return next();
					common.spredCastModel.updateState(session.spredCast.id, 0, (err) => {
						if (err) {
							return next(err);
						}
						console.log(`Presenter(${session.id}) has left the spredCast(${session.spredCast.id}).`);
						return next();
					});
				}
			], (err) => {
				if (err) {
					console.error(`Got error while disconnecting for ID(${session.id}) : `, err);
				}
				session.close();
				session = null;
			});
		}
	} else {
		console.log(`Anonymous connection closed`);
	}
}

function onAuthAnswer(kurentoClient, session, spredcasts, auth_answer) {
	async.waterfall([
		(next) => common.castTokenModel.getByToken(auth_answer.token, next),
		(fToken, next) => {
			if (fToken === null) {
				console.error(`${session.id} trying to access a spredcast without permissions`);
				return next({
					message: "You don't have permissions to access this spredcast"
				});
			}
			session.user = new User(fToken.user, fToken.pseudo);
			session.user.picture = fToken.user ? fToken.user.pictureUrl : "/img/profile.jpg";
			session.sdpOffer = auth_answer.sdpOffer;

			session.castToken = fToken;
			console.info(`${session.id} now identified as ${fToken.pseudo}`);
			session.spredCast = _.find(spredcasts, function(spredcast) {
				return spredcast.id === session.castToken.cast.id
			});
			if (!session.spredCast) {
				console.info(`${session.castToken.pseudo} is joining in his spredcast(${session.castToken.cast.id}) as first.`);
				session.spredCast = new Spredcast(session.castToken.cast.id);
				spredcasts.push(session.spredCast);
			} else {
				console.info(`${session.castToken.pseudo} is joining the spredcast(${session.castToken.cast.id}) with already ${session.spredCast.viewers.length} viewer(s)`);
			}
			session.enableChat();
			session.socket.join(session.castToken.cast.id);
			if (fToken.presenter) {
				console.log(`Joining as a Presenter(${session.spredCast.id}) => ${session.id}`);
				return initializePresenter(kurentoClient, session, next);
			} else {
				if (session.spredCast.isLive) {
					return initializeViewer(session, next);
				} else {
					session.spredCast.addToPendingQueue(session);
					return next(null, "Presenter is not live yet.");
				}
			}
		}
	], function(err, res) {
		if (err) {
			console.error(`Got error when trying to get Spredcast for ${session.id} : `, err);
			session.socket.emit('auth_answer', {
				status: 'rejected',
				message: err
			});
		} else {
			console.log(`Sending auth_answer for ${session.user.pseudo}`);
			var payload = {
				status: 'accepted',
				sdpAnswer: session.sdpAnswer,
				user: session.user.pseudo
			};
			if (res) payload.message = res;
			session.socket.emit('auth_answer', payload);
		}
	});
}

function initializePresenter(kurentoClient, session, next) {
	async.waterfall([
		(next) => KurentoUtils.createPresenter(kurentoClient, session, next),
		(next) => {
			session.spredCast.removeFromPendingQueue(session);
			session.spredCast.presenter = session;
			// Mettre à jour le state du cast (1 quand le presenter à join, 2 quand c'est terminé)
			common.spredCastModel.updateState(session.spredCast.id, 1, function(err) {
				if (err) {
					console.log(`Error while trying to update spredCast status : `, err);
				} else {
					console.log(`spredCast(${session.spredCast.id}) has now a presenter live`);
					session.spredCast.isLive = true;
					async.eachLimit(session.spredCast.session_pending, 100, (session, next) => initializeViewer(session, function(err) {
						if (err) {
							console.error(`Got error when trying to get Spredcast for ${session.id} : `, err);
							session.socket.emit('auth_answer', {
								status: 'rejected',
								message: err
							});
						} else {
							console.log(`Sending auth_answer for ${session.user.pseudo}`);
							session.socket.emit('auth_answer', {
								status: 'accepted',
								sdpAnswer: session.sdpAnswer,
								user: session.user.pseudo
							});
						}
					}));
					common.spredCastModel.updateUserCount(session.spredCast.id, 1);
					console.info(`User ${session.user.pseudo} added as presenter in spredcast ${session.spredCast.id}`);
					console.info(`${session.spredCast.session_pending.length} viewer(s) were waiting in the room.`);
					return next(null, session.sdpAnswer);
				}
			});

		}
	], next);
}

function initializeViewer(session, next) {
	async.waterfall([
		(next) => KurentoUtils.createViewer(session, next),
		(next) => {
			session.spredCast.removeFromPendingQueue(session);
			session.spredCast.addViewer(session);
			common.spredCastModel.updateUserCount(session.spredCast.id, (session.spredCast.viewers + !!session.spredCast.presenter));
			console.info(`User ${session.user.pseudo} added as viewer in room ${session.spredCast.id}`);
			console.info(`${session.spredCast.viewers.length - 1} viewer(s) were already in the room.`);
			return next();
		}
	], next);
}

module.exports = new Server();
