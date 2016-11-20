const fs = require('fs');
const async = require('async');
const https = require('https');
const express = require('express');
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
	this.conf = {
		as_uri: options && options.as_uri ? options.as_uri : 'https://localhost:8443/',
		kms_uri: options && options.kms_uri ? options.kms_uri : 'ws://ec2-52-212-178-211.eu-west-1.compute.amazonaws.com:8888/kurento'
	};

	this.options = {
		key: fs.readFileSync('keys/server.key'),
		cert: fs.readFileSync('keys/server.crt')
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
	var app = express();
	var asUrl = url.parse(this.conf.as_uri);
	var port = asUrl.port;
	var httpsServer = https.createServer(this.options, app);
	var wss = new io(httpsServer);

	// TODO: SPREDCASTS IN THE SERVER -> Need to get them from DB with Spred is ready
	const spredcasts = [];

	httpsServer.listen(port, function() {
		console.log('Kurento Tutorial started');
		console.log(`Open ${url.format(asUrl)} with a WebRTC capable browser`);
	});

	wss.on('connection', function(socket) {
		const session = new Session(socket);

		requestIdentity(session);

		session.socket.on('disconnect', function() {
			endSession(session);
		});

		session.socket.on('ice_candidate', function(ice_candidate) {
			KurentoUtils.processIceCandidate(session, ice_candidate, next);
		});

		session.socket.on('auth_answer', function(auth_answer) {
			onAuthAnswer(session, spredcasts, auth_answer);
		});
	}.bind(this));
};

function requestIdentity(session) {
	console.log(`Connection received with sessionId ${session.id}`);
	session.socket.emit('auth_request', {});
}

function endSession(session) {
	if (session && session.id) {
		console.info(`Connection with ${session.id} lost.`)
		session.close();
	} else {
		console.log(`Anonymous connection closed`);
	}
	session = null;
}

function onAuthAnswer(session, spredcasts, auth_answer) {
	async.waterfall([
		(next) => common.castTokenModel.getByToken(auth_answer.token, next),
		(fToken, next) => {
			if (fToken === null) {
				console.error(`${session.id} trying to access a spredcast without permissions`);
				return next({
					message: "You don't have permissions to access this sprecast"
				});
			}
			session.user = new User(fToken.user, fToken.pseudo);
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
			session.socket.join(session.castToken.cast.id);
			if (fToken.presenter) {
				initializePresenter(session, next);
			} else {
				if (session.spredcast.isLive) {
					initializeViewer(session, next);
				} else {
					session.spredCast.addToPendingQueue(session);
				}
				return next();
			}
		}
	], function(err) {
		if (err) {
			console.error(`Got error when trying to get Spredcast for ${session.id} : ${err}`);
			session.socket.emit('auth_answer', {
				status: 'rejected',
				message: err
			});
		} else {
			session.socket.emit('auth_answer', {
				status: 'accepted',
				sdpAnswer: session.sdpAnswer
			});
		}
	});
}

function initializePresenter(session, next) {
	async.waterfall([
		(next) => KurentoUtils.createPresenter(this.kurentoClient, session, next),
		(next) => {
			session.spredcast.removeFromPendingQueue(session);
			session.spredcast.presenter = session;
			session.spredcast.isLive = true;
			async.eachLimit(session.spredcast.session_pending, 100, (session, next) => initializeViewer(session, next));
			console.info(`User ${session.user.pseudo} added as presenter in spredcast ${session.spredcast.id}`);
			console.info(`${session.spredcast.user_pending.length} viewer(s) were waiting in the room.`);
			return next(null, session.sdpAnswer);
		}
	], next);
}

function initializeViewer(session, next) {
	async.waterfall([
		(next) => KurentoUtils.createViewer(session, next),
		(next) => {
			session.room.removeFromQueue(session);
			session.room.addViewer(session);
			console.info(`User ${session.user.pseudo} added as viewer in room ${session.spredcast.id}`);
			console.info(`${session.spredcast.viewers.length - 1} viewer(s) were already in the room.`);
		}
	], next);
}

module.exports = new Server();
