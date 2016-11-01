const kurento = require('kurento-client');
const Presenter = require('../models/presenter');

var KurentoUtils = function() {

}

KurentoUtils.prototype.createPresenter = function(kurentoClient, session, sdpOffer) {
	const user = new Presenter(session.id);

	return new Promise(function(resolve, reject) {
		return new Promise(function(resolve, reject) {
			kurentoClient.create('MediaPipeline', function(error, pipeline) {
				if (error) {
					stopSession(user);
					reject(error);
				}
				resolve(pipeline);
			})
		}).then(function(pipeline) {
			user.pipeline(pipeline);
			return user.pipeline().create('WebRtcEndpoint', function(error, webRtcEndpoint) {
				if (error) {
					stopSession(user);
					return reject(error);
				}
				resolve(webRtcEndpoint);
			});
		}).then(function(webRtcEndpoint) {
			user.webRtcEndpoint(webRtcEndpoint);
			user.webRtcEndpoint().on('OnIceCandidate', function(event) {
				var candidate = kurento.getComplexType('IceCandidate')(event.candidate);
				session.emit('iceCandidate', {
					candidate: candidate
				});
			});
			resolve();
		}).then(function() {
			webRtcEndpoint.processOffer(sdpOffer, function(error, sdpAnswer) {
				if (error) {
					stopSession(user);
					reject(error);
				}
				resolve(sdpAnswer);
			});
		}).then(function(sdpAnswer) {
			webRtcEndpoint.gatherCandidates(function(error) {
				if (error) {
					stopSession(user);
					return reject(error);
				}
				user.sdpAnswer(sdpAnswer);
				resolve(user);
			});
		}).catch(function(error) {
			reject(error);
		});


		// if (candidatesQueue[session.id]) {
		// 	while (candidatesQueue[session.id].length) {
		// 		var candidate = candidatesQueue[session.id].shift();
		// 		webRtcEndpoint.addIceCandidate(candidate);
		// 	}
		// }
	});
};

KurentoUtils.prototype.createViewer = function(kurentoClient, room, session, sdpOffer) {
	const user = new Viewer(session.id);

	return new Promise(function(resolve, reject) {
		return new Promise(function(resolve, reject) {
			return user.pipeline().create('WebRtcEndpoint', function(error, webRtcEndpoint) {
				if (error) {
					stopSession(user);
					return reject(error);
				}
				resolve(webRtcEndpoint);
			});
		}).then(function(webRtcEndpoint) {
			user.webRtcEndpoint(webRtcEndpoint);
			user.webRtcEndpoint().on('OnIceCandidate', function(event) {
				var candidate = kurento.getComplexType('IceCandidate')(event.candidate);
				session.emit('iceCandidate', {
					candidate: candidate
				});
			});
			resolve();
		}).then(function() {
			webRtcEndpoint.processOffer(sdpOffer, function(error, sdpAnswer) {
				if (error) {
					stopSession(user);
					reject(error);
				}
				resolve(sdpAnswer);
			});
		}).then(function(sdpAnswer) {
			webRtcEndpoint.gatherCandidates(function(error) {
				if (error) {
					stopSession(user);
					return reject(error);
				}
				user.sdpAnswer(sdpAnswer);
				resolve(user);
			});
		}).catch(function(error) {
			reject(error);
		});


		// if (candidatesQueue[session.id]) {
		// 	while (candidatesQueue[session.id].length) {
		// 		var candidate = candidatesQueue[session.id].shift();
		// 		webRtcEndpoint.addIceCandidate(candidate);
		// 	}
		// }
	});
};

KurentoUtils.prototype.processIceCandidate = function(user, _candidate) {
	const candidate = kurento.getComplexType('IceCandidate')(_candidate);

	if (user && user.webRtcEndpoint) {
		console.info(`Sending candidate to ${user.id}`);
		user.webRtcEndpoint().addIceCandidate(candidate);
	}
};

module.exports = new KurentoUtils();
