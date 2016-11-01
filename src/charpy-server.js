const fs = require('fs');
const https = require('https');
const express = require('express');
const url = require('url');
const Server = require('socket.io');
const _ = require('lodash');
const kurento = require('kurento-client');
const KurentoUtils = require('./helpers/kurento-utils');
const Room = require('./models/room');
const Session = require('./models/session');

var CharpyServer = function(options) {
	this.conf = {
		as_uri: options && options.as_uri ? options.as_uri : 'https://localhost:8443/',
		kms_uri: options && options.kms_uri ? options.kms_uri : 'ws://localhost:8888/kurento'
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

CharpyServer.prototype.start = function() {
	var app = express();

	var asUrl = url.parse(this.conf.as_uri);
	var port = asUrl.port;
	var httpsServer = https.createServer(this.options, app);
	var wss = new Server(httpsServer);
	var wxx = new Server(httpsServer, {
		path: 'test'
	});


	httpsServer.listen(port, function() {
		console.log('Kurento Tutorial started');
		console.log(`Open ${url.format(asUrl)} with a WebRTC capable browser`);
	}.bind(this));

	wxx.on('connection', function(socket) {
		console.log('lol');
	});

	wss.on('connection', function(socket) {
		this.session = new Session(socket);

		console.log(`Connection received with sessionId ${this.session.id}`);

		socket.on('disconnect', function(socket) {
			console.log(`Connection ${socket.id} closed`);
			KurentoUtils.stopSession(socket.id);
		});

		socket.on('join_request', function(join_request) {
			this.session.room = _.find(this.rooms, function(room) {
				return room.id === join_request.roomId
			});
			if (this.session.room) {
				this.session.room.addToQueue(this.session.id);
			} else {
				this.session.room = new Room(join_request.roomId);
				this.session.room.addToQueue(this.session.id);
				this.rooms.push(this.session.room);
			}
			socket.join(join_request.roomId);
			console.log(`${this.session.id} joined the room with id : ${join_request.roomId}`);
		}.bind(this));

		socket.on('presenter_request', function(presenter_request) {
			KurentoUtils.createPresenter(this.kurentoClient, socket, presenter_request.sdpOffer)
				.then(function(user) {
					this.session.user = user;
					socket.emit('presenter_answer', {
						response: 'accepted',
						sdpAnswer: user.sdpAnswer()
					});
				}).catch(function(error) {
					return socket.emit('presenter_answer', {
						response: 'rejected',
						message: error
					});
				});
		}.bind(this));

		socket.on('viewer_request', function(viewer_request) {
			KurentoUtils.createViewer(this.kurentoClient, socket, viewer_request.sdpOffer)
				.then(function(user) {
					this.session.user = user;
					socket.emit('viewer_answer', {
						response: 'accepted',
						sdpAnswer: user.sdpAnswer()
					});
				}).catch(function(error) {
					return socket.emit('viewer_answer', {
						response: 'rejected',
						message: error
					});
				});
		}.bind(this));

		socket.on('ice_candidate', function(ice_candidate) {
			KurentoUtils.processIceCandidate(this.session.user, ice_candidate.candidate);
		});
	}.bind(this));
};

module.exports = new CharpyServer();
