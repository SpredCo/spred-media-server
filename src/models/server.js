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

	this.rooms = [];

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

	httpsServer.listen(port, function() {
		console.log('Kurento Tutorial started');
		console.log(`Open ${url.format(asUrl)} with a WebRTC capable browser`);
	}.bind(this));

	wss.on('connection', function(socket) {
		this.session = new Session(socket);

		async.each(events['connection'], (fn, next) => fn.bind(this)(socket, next), function(err) {
			if (err) {
				console.error(`Got an error from ${socket.id} : ${err}`);
			} else {
				this.session.socket.on('disconnect', function() {
					async.each(events['disconnect'], (fn, next) => fn.bind(this)(next));
				}.bind(this));
			}
		}.bind(this));

		this.session.socket.on('presenter_request', function(presenter_request) {
			async.each(events['presenter_request'], (fn, next) => fn.bind(this)(presenter_request, next));
		}.bind(this));

		this.session.socket.on('viewer_request', function(viewer_request) {
			async.each(events['viewer_request'], (fn, next) => fn.bind(this)(viewer_request, next));
		}.bind(this));

		this.session.socket.on('ice_candidate', function(ice_candidate) {
			async.each(events['ice_candidate'], (fn, next) => fn.bind(this)(ice_candidate, next));
		}.bind(this));

	}.bind(this));
};

function onConnect(socket, next) {
	console.log(`Connection received with sessionId ${this.session.id}`);

	this.session.socket.on('auth_answer', function(auth_answer) {
		async.each(events['auth_answer'], (fn, next) => fn.bind(this)(auth_answer, next));
	}.bind(this));
	async.each(events['auth_request'], (fn, next) => fn.bind(this)(socket, next));
	return next();
}

function onDisconnect(next) {
	if (this.session && this.session.id) {
		console.log(`Connection ${this.session.id} closed`);
	} else {
		console.log(`Anonymous connection closed`);
	}
	if (this.session && this.session.user) {
		this.session.user.stop();
	}
	this.session = null;
	return next();
}

function onAuthRequest(socket, next) {
	this.session.socket.emit('auth_request', {});
	return next();
}

function onAuthAnswer(auth_answer, next) {
	this.session.room = _.find(this.rooms, function(room) {
		return room.id === auth_answer.id
	});
	if (this.session.room) {
		this.session.room.addToQueue(this.session.id);
	} else {
		this.session.room = new Room(auth_answer.id);
		this.session.room.addToQueue(this.session.id);
		this.rooms.push(this.session.room);
	}
	this.session.socket.join(auth_answer.id);
	console.log(`${this.session.id} joined the room with id : ${auth_answer.id}`);
	console.log(`Actual number of rooms : ${this.rooms.length}`);
	return next();
}

function onPresenterRequest(presenter_request, next) {
	const session = this.session;
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
			KurentoUtils.runSavedIceCandidate(session, next);
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

function onViewerRequest(viewer_request, next) {
	const session = this.session;
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
			KurentoUtils.runSavedIceCandidate(session, next);
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

function onPresenterAnswer(presenter_answer, next) {
	console.info(`Presenter answer replied to ${this.session.id}`);
	this.session.socket.emit('presenter_answer', presenter_answer);
	return next();
}

function onViewerAnswer(viewer_answer, next) {
	console.info(`Viewer answer replied to ${this.session.id}`);
	this.session.socket.emit('viewer_answer', viewer_answer);
	return next();
}

module.exports = new Server();
