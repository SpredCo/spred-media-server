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

var kurento = require('kurento-client');
var CharpyServer = require('./charpy-server');

CharpyServer.start();

// /*
//  * Definition of global variables.
//  */
// var idCounter = 0;
// var candidatesQueue = {};
// var kurentoClient = null;
// var presenter = null;
// var viewers = [];
// var noPresenterMessage = 'No active presenter. Try again later...';
//
// function startViewer(session, ws, sdpOffer, callback) {
// 	clearCandidatesQueue(session.id);
//
// 	if (presenter === null) {
// 		stop(session.id);
// 		return callback(noPresenterMessage);
// 	}
//
// 	presenter.pipeline.create('WebRtcEndpoint', function(error, webRtcEndpoint) {
// 		if (error) {
// 			stop(session.id);
// 			return callback(error);
// 		}
// 		viewers[session.id] = {
// 			"webRtcEndpoint": webRtcEndpoint,
// 			"ws": session
// 		}
//
// 		if (presenter === null) {
// 			stop(session.id);
// 			return callback(noPresenterMessage);
// 		}
//
// 		if (candidatesQueue[session.id]) {
// 			while (candidatesQueue[session.id].length) {
// 				var candidate = candidatesQueue[session.id].shift();
// 				webRtcEndpoint.addIceCandidate(candidate);
// 			}
// 		}
//
// 		webRtcEndpoint.on('OnIceCandidate', function(event) {
// 			var candidate = kurento.getComplexType('IceCandidate')(event.candidate);
// 			session.emit('iceCandidate', {
// 				candidate: candidate
// 			});
// 		});
//
// 		webRtcEndpoint.processOffer(sdpOffer, function(error, sdpAnswer) {
// 			if (error) {
// 				stop(session.id);
// 				return callback(error);
// 			}
// 			if (presenter === null) {
// 				stop(session.id);
// 				return callback(noPresenterMessage);
// 			}
//
// 			presenter.webRtcEndpoint.connect(webRtcEndpoint, function(error) {
// 				if (error) {
// 					stop(session.id);
// 					return callback(error);
// 				}
// 				if (presenter === null) {
// 					stop(session.id);
// 					return callback(noPresenterMessage);
// 				}
// 				callback(null, sdpAnswer);
// 				webRtcEndpoint.gatherCandidates(function(error) {
// 					if (error) {
// 						stop(session.id);
// 						return callback(error);
// 					}
// 				});
// 			});
// 		});
// 	});
// }
//
// function clearCandidatesQueue(sessionId) {
// 	if (candidatesQueue[sessionId]) {
// 		delete candidatesQueue[sessionId];
// 	}
// }
//
// function onIceCandidate(sessionId, _candidate) {
// 	var candidate = kurento.getComplexType('IceCandidate')(_candidate);
//
// 	if (presenter && presenter.id === sessionId && presenter.webRtcEndpoint) {
// 		console.info('Sending presenter candidate');
// 		presenter.webRtcEndpoint.addIceCandidate(candidate);
// 	} else if (viewers[sessionId] && viewers[sessionId].webRtcEndpoint) {
// 		console.info('Sending viewer candidate');
// 		viewers[sessionId].webRtcEndpoint.addIceCandidate(candidate);
// 	} else {
// 		console.info('Queueing candidate');
// 		if (!candidatesQueue[sessionId]) {
// 			candidatesQueue[sessionId] = [];
// 		}
// 		candidatesQueue[sessionId].push(candidate);
// 	}
// }
