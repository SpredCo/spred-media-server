/*
 * (C) Copyright 2014-2015 Kurento (http://kurento.org/)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

var path = require('path');
var url = require('url');
var minimist = require('minimist');
var ws = require('ws');
var kurento = require('kurento-client');
var fs = require('fs');
var https = require('https');
var express = require('express');
var io = require("socket.io");

var argv = minimist(process.argv.slice(2), {
	default: {
		as_uri: 'https://localhost:8443/',
		ws_uri: 'ws://localhost:8888/kurento'
	}
});

var options = {
	key: fs.readFileSync('keys/server.key'),
	cert: fs.readFileSync('keys/server.crt')
};

var app = express();

/*
 * Definition of global variables.
 */
var idCounter = 0;
var candidatesQueue = {};
var kurentoClient = null;
var presenter = null;
var viewers = [];
var noPresenterMessage = 'No active presenter. Try again later...';

/*
 * Server startup
 */
var asUrl = url.parse(argv.as_uri);
var port = asUrl.port;
var server = https.createServer(options, app);
var wss = io(server);

server.listen(port, function() {
	console.log('Kurento Tutorial started');
	console.log('Open ' + url.format(asUrl) + ' with a WebRTC capable browser');
});

/*
 * Management of WebSocket messages
 */
wss.on('connection', function(socket) {

	var sessionId = socket.id;
	console.log('Connection received with sessionId ' + sessionId);

	// wss.on('error', function(error) {
	// 	console.log('Connection ' + sessionId + ' error');
	// 	stop(sessionId);
	// });

	socket.on('disconnect', function(socket) {
		console.log('Connection ' + sessionId + ' closed');
		stop(sessionId);
	});

	socket.on('join_request', function(join_request) {
		socket.join(join_request.roomId);
		console.log(sessionId + " joined the room with id : " + join_request.roomId);
	});

	socket.on('presenter_request', function(presenter_request) {
		startPresenter(socket, ws, presenter_request.sdpOffer, function(error, sdpAnswer) {
			if (error) {
				return socket.emit('presenter_answer', {
					response: 'rejected',
					message: error
				});
			}
			socket.emit('presenter_answer', {
				response: 'accepted',
				sdpAnswer: sdpAnswer
			});
		});
	});

	socket.on('viewer_request', function(viewer_request) {
		startViewer(socket, wss, viewer_request.sdpOffer, function(error, sdpAnswer) {
			if (error) {
				return socket.emit('viewer_answer', {
					response: 'rejected',
					message: error
				});
			}

			socket.emit('viewer_answer', {
				response: 'accepted',
				sdpAnswer: sdpAnswer
			});
		});
	});

	socket.on('ice_candidate', function(ice_candidate) {
		onIceCandidate(sessionId, ice_candidate.candidate);
	});


});

/*
 * Definition of functions
 */

// Recover kurentoClient for the first time.
function getKurentoClient(callback) {
	if (kurentoClient !== null) {
		return callback(null, kurentoClient);
	}

	kurento(argv.ws_uri, function(error, _kurentoClient) {
		console.log("here");
		if (error) {
			console.log("Could not find media server at address " + argv.ws_uri);
			return callback("Could not find media server at address" + argv.ws_uri +
				". Exiting with error " + error);
		}
		kurentoClient = _kurentoClient;
		callback(null, kurentoClient);
	});
}

function startPresenter(session, ws, sdpOffer, callback) {
	clearCandidatesQueue(session.id);

	if (presenter !== null) {
		stop(session.id);
		return callback("Another user is currently acting as presenter. Try again later ...");
	}

	presenter = {
		id: session.id,
		pipeline: null,
		webRtcEndpoint: null
	}

	getKurentoClient(function(error, kurentoClient) {
		console.log("THEREEEE");
		if (error) {
			stop(session.id);
			return callback(error);
		}

		if (presenter === null) {
			stop(session.id);
			return callback(noPresenterMessage);
		}

		kurentoClient.create('MediaPipeline', function(error, pipeline) {
			if (error) {
				stop(session.id);
				return callback(error);
			}

			if (presenter === null) {
				stop(session.id);
				return callback(noPresenterMessage);
			}

			presenter.pipeline = pipeline;
			pipeline.create('WebRtcEndpoint', function(error, webRtcEndpoint) {
				if (error) {
					stop(session.id);
					return callback(error);
				}

				if (presenter === null) {
					stop(session.id);
					return callback(noPresenterMessage);
				}

				presenter.webRtcEndpoint = webRtcEndpoint;

				if (candidatesQueue[session.id]) {
					while (candidatesQueue[session.id].length) {
						var candidate = candidatesQueue[session.id].shift();
						webRtcEndpoint.addIceCandidate(candidate);
					}
				}

				webRtcEndpoint.on('OnIceCandidate', function(event) {
					var candidate = kurento.getComplexType('IceCandidate')(event.candidate);
					session.emit('iceCandidate', {
						candidate: candidate
					});
				});

				webRtcEndpoint.processOffer(sdpOffer, function(error, sdpAnswer) {
					if (error) {
						stop(session.id);
						return callback(error);
					}

					if (presenter === null) {
						stop(session.id);
						return callback(noPresenterMessage);
					}

					callback(null, sdpAnswer);
				});

				webRtcEndpoint.gatherCandidates(function(error) {
					if (error) {
						stop(session.id);
						return callback(error);
					}
				});
			});
		});
	});
}

function startViewer(session, ws, sdpOffer, callback) {
	clearCandidatesQueue(session.id);

	if (presenter === null) {
		stop(session.id);
		return callback(noPresenterMessage);
	}

	presenter.pipeline.create('WebRtcEndpoint', function(error, webRtcEndpoint) {
		if (error) {
			stop(session.id);
			return callback(error);
		}
		viewers[session.id] = {
			"webRtcEndpoint": webRtcEndpoint,
			"ws": session
		}

		if (presenter === null) {
			stop(session.id);
			return callback(noPresenterMessage);
		}

		if (candidatesQueue[session.id]) {
			while (candidatesQueue[session.id].length) {
				var candidate = candidatesQueue[session.id].shift();
				webRtcEndpoint.addIceCandidate(candidate);
			}
		}

		webRtcEndpoint.on('OnIceCandidate', function(event) {
			var candidate = kurento.getComplexType('IceCandidate')(event.candidate);
			session.emit('iceCandidate', {
				candidate: candidate
			});
		});

		webRtcEndpoint.processOffer(sdpOffer, function(error, sdpAnswer) {
			if (error) {
				stop(session.id);
				return callback(error);
			}
			if (presenter === null) {
				stop(session.id);
				return callback(noPresenterMessage);
			}

			presenter.webRtcEndpoint.connect(webRtcEndpoint, function(error) {
				if (error) {
					stop(session.id);
					return callback(error);
				}
				if (presenter === null) {
					stop(session.id);
					return callback(noPresenterMessage);
				}
				callback(null, sdpAnswer);
				webRtcEndpoint.gatherCandidates(function(error) {
					if (error) {
						stop(session.id);
						return callback(error);
					}
				});
			});
		});
	});
}

function clearCandidatesQueue(sessionId) {
	if (candidatesQueue[sessionId]) {
		delete candidatesQueue[sessionId];
	}
}

function stop(sessionId) {
	if (presenter !== null && presenter.id == sessionId) {
		for (var i in viewers) {
			var viewer = viewers[i];
			if (viewer.ws) {
				viewer.ws.send(JSON.stringify({
					id: 'stopCommunication'
				}));
			}
		}
		presenter.pipeline.release();
		presenter = null;
		viewers = [];

	} else if (viewers[sessionId]) {
		viewers[sessionId].webRtcEndpoint.release();
		delete viewers[sessionId];
	}

	clearCandidatesQueue(sessionId);
}

function onIceCandidate(sessionId, _candidate) {
	var candidate = kurento.getComplexType('IceCandidate')(_candidate);

	if (presenter && presenter.id === sessionId && presenter.webRtcEndpoint) {
		console.info('Sending presenter candidate');
		presenter.webRtcEndpoint.addIceCandidate(candidate);
	} else if (viewers[sessionId] && viewers[sessionId].webRtcEndpoint) {
		console.info('Sending viewer candidate');
		viewers[sessionId].webRtcEndpoint.addIceCandidate(candidate);
	} else {
		console.info('Queueing candidate');
		if (!candidatesQueue[sessionId]) {
			candidatesQueue[sessionId] = [];
		}
		candidatesQueue[sessionId].push(candidate);
	}
}

app.use(express.static(path.join(__dirname, 'static')));
