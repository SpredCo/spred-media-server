const fs = require('fs');
const async = require('async');
const https = require('https');
const express = require('express');
const url = require('url');
const io = require('socket.io');
const _ = require('lodash');
const kurento = require('kurento-client');
const KurentoUtils = require('../helpers/kurento-utils');
const Room = require('./room');
const Session = require('./session');
const mongoose = require('mongoose');
const common = require('spred-common');

mongoose.connection.on('error', function() {
	console.error('Error');
});

mongoose.connection.on('open', function() {
	console.info('MongoDB: connection success');
});

const connectionStr = 'mongodb://sharemyscreen.fr:27017/spred';
mongoose.connect(connectionStr);

const events = {
	'connection': [onConnect],
	'disconnect': [onDisconnect],
	'auth_request': [onAuthRequest],
	'auth_answer': [onAuthAnswer],
	'presenter_request': [onPresenterRequest],
	'presenter_answer': [onPresenterAnswer],
	'viewer_request': [onViewerRequest],
	'viewer_answer': [onViewerAnswer],
	'ice_candidate': [KurentoUtils.processIceCandidate]
}

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

	// TODO: ROOMS IN THE SERVER -> Need to get them from DB with Spred is ready
	const rooms = [];

	httpsServer.listen(port, function() {
		console.log('Kurento Tutorial started');
		console.log(`Open ${url.format(asUrl)} with a WebRTC capable browser`);
	});

	wss.on('connection', function(socket) {
		const session = new Session(socket);

		async.each(events['connection'], (fn, next) => fn(session, next), function(err) {
			if (err) {
				console.error(`Got an error from ${socket.id} : ${err}`);
			} else {
				session.socket.on('disconnect', function() {
					async.each(events['disconnect'], (fn, next) => fn(session, next));
				});
			}
		});

		session.socket.on('presenter_request', function(presenter_request) {
			async.each(events['presenter_request'], (fn, next) => fn(session, presenter_request, next));
		});

		session.socket.on('viewer_request', function(viewer_request) {
			async.each(events['viewer_request'], (fn, next) => fn(session, viewer_request, next));
		});

		session.socket.on('ice_candidate', function(ice_candidate) {
			async.each(events['ice_candidate'], (fn, next) => fn(session, ice_candidate, next));
		});

		session.socket.on('auth_answer', function(auth_answer) {
			async.each(events['auth_answer'], (fn, next) => fn(session, rooms, auth_answer, next));
		}.bind(this));
	}.bind(this));
};

function onConnect(session, next) {
	console.log(`Connection received with sessionId ${session.id}`);
	async.each(events['auth_request'], (fn, next) => fn(session, next));
	return next();
}

function onDisconnect(session, next) {
	if (session && session.id) {
		console.log(`Connection ${session.id} closed`);
	} else {
		console.log(`Anonymous connection closed`);
	}
	if (session && session.user) {
		session.user.stop();
	}
	session = null;
	return next();
}

function onAuthRequest(session, next) {
	session.socket.emit('auth_request', {});
	return next();
}

function onAuthAnswer(session, rooms, auth_answer, next) {
	var currentRoom = null;
	console.log(`Got token ${auth_answer.token} from ${session.id}`);
	common.castTokenModel.getByToken(auth_answer.token, function(err, fToken) {
		if (err) {
			console.error(`Got error when trying to get Spredcast for ${session.id} : ${err}`);
		} else if (fToken === null) {
			console.error(`${session.id} trying to access a spredcast without permissions`);
		} else {
			// const user = fToken.user;
			// const client = fToken.client;
			// const pseudo = fToken.pseudo;

			console.info(`${session.id} now identified as ${fToken.pseudo}`);
			session.room = _.find(rooms, function(room) {
				return room.id === fToken.cast.id
			});
			if (!session.room) {
				console.info(`${fToken.pseudo} is joining in his room(${fToken.cast.id}) as first.`);
				session.room = new Room(fToken.cast.id);
				rooms.push(session.room);
			} else {
				console.info(`${fToken.pseudo} is joining the room(${fToken.cast.id}) with already ${session.room.viewers.length} viewer(s)`);
			}
			session.room.addToQueue(session.id);
			session.socket.join(fToken.cast.id);
		}
		return next();
	});
}

function onPresenterRequest(session, presenter_request, next) {
	session.sdpOffer = presenter_request.sdpOffer;
	async.waterfall([
		(next) => KurentoUtils.createPresenter(this.kurentoClient, session, next),
		(next) => {
			async.each(events['presenter_answer'], (fn, next) => fn.bind(this)({
				response: 'accepted',
				sdpAnswer: session.user.sdpAnswer
			}, next), next);
		},
		(next) => {
			session.room.removeFromQueue(session.id);
			session.room.presenter = session.user;
			console.info(`User ${session.id} added as presenter in room ${session.room.id}`);
			console.info(`${session.room.viewers.length} viewer(s) were waiting in the room.`);
		}
	], function(err) {
		if (err) {
			async.each(events['presenter_answer'], (fn, next) => fn.bind(this)({
				response: 'rejected',
				message: err
			}, next), next);
		} else {
			return next();
		}
	});
}

function onViewerRequest(session, viewer_request, next) {
	session.sdpOffer = viewer_request.sdpOffer;
	async.waterfall([
		(next) => KurentoUtils.createViewer(session, next),
		(next) => {
			async.each(events['viewer_answer'], (fn, next) => fn.bind(this)({
				response: 'accepted',
				sdpAnswer: session.user.sdpAnswer
			}, next), next);
		},
		(next) => {
			session.room.removeFromQueue(session.id);
			session.room.addViewer(session.user);
			console.info(`User ${session.id} added as viewer in room ${session.room.id}`);
			console.info(`${session.room.viewers.length - 1} viewer(s) were already in the room.`);
		}
	], function(err) {
		if (err) {
			async.each(events['viewer_answer'], (fn, next) => fn.bind(this)({
				response: 'rejected',
				message: err
			}, next), next);
		}
		return next();
	});
}

function onPresenterAnswer(session, presenter_answer, next) {
	console.info(`Presenter answer replied to ${session.id}`);
	session.socket.emit('presenter_answer', presenter_answer);
	return next();
}

function onViewerAnswer(session, viewer_answer, next) {
	console.info(`Viewer answer replied to ${session.id}`);
	session.socket.emit('viewer_answer', viewer_answer);
	return next();
}

module.exports = new Server();
