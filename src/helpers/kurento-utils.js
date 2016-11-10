const kurento = require('kurento-client');
const Presenter = require('../models/presenter');
const Viewer = require('../models/viewer');
const async = require('async');
const _ = require('lodash');

var KurentoUtils = function() {

}

KurentoUtils.prototype.createPresenter = function(kurentoClient, session, next) {
	session.user = new Presenter(session.id);

	async.waterfall([
		(next) => {
			kurentoClient.create('MediaPipeline', function(error, pipeline) {
				if (error) {
					session.user.stop();
					return next(error);
				}
				console.log(`MediaPipeline for presenter ${session.id} in room ${session.room.id} created`);
				session.user.pipeline = pipeline;
				return next();
			});
		},
		(next) => {
			session.user.pipeline.create('WebRtcEndpoint', function(error, webRtcEndpoint) {
				if (error) {
					session.user.stop();
					return next(error);
				}
				console.log(`WebRtcEndPoint for presenter ${session.id} in room ${session.room.id} created`);
				session.user.webRtcEndpoint = webRtcEndpoint;
				return next();
			});
		},
		(next) => {
			session.user.webRtcEndpoint.on('OnIceCandidate', function(event) {
				var candidate = kurento.getComplexType('IceCandidate')(event.candidate);
				session.socket.emit('iceCandidate', {
					candidate: candidate
				});
			});
			return next();
		},
		(next) => {
			session.user.webRtcEndpoint.processOffer(session.sdpOffer, function(error, sdpAnswer) {
				if (error) {
					session.user.stop();
					return next(error);
				}
				session.user.sdpAnswer = sdpAnswer;
				return next();
			});
		},
		(next) => {
			session.user.webRtcEndpoint.gatherCandidates(function(error) {
				if (error) {
					session.user.stop();
					return next(error);
				}
				return next();
			});
		}
	], function(err) {
		if (err) {
			console.log(`Got an error from user ${this.session.id}: ${error}`);
			return next(error);
		}
		return next();
	});

	// if (candidatesQueue[session.id]) {
	// 	while (candidatesQueue[session.id].length) {
	// 		var candidate = candidatesQueue[session.id].shift();
	// 		webRtcEndpoint.addIceCandidate(candidate);
	// 	}
	// }

};

KurentoUtils.prototype.createViewer = function(session, next) {
	session.user = new Viewer(session.id);

	async.waterfall([
		(next) => {
			session.room.presenter.pipeline.create('WebRtcEndpoint', function(error, webRtcEndpoint) {
				if (error) {
					session.user.stop();
					return next(error);
				}
				console.log(`WebRtcEndPoint for viewer ${session.id} in room ${session.room.id} created`);
				session.user.webRtcEndpoint = webRtcEndpoint;
				return next();
			});
		},
		(next) => {
			session.user.webRtcEndpoint.on('OnIceCandidate', function(event) {
				var candidate = kurento.getComplexType('IceCandidate')(event.candidate);
				session.socket.emit('iceCandidate', {
					candidate: candidate
				});
			});
			return next();
		},
		(next) => {
			session.user.webRtcEndpoint.processOffer(session.sdpOffer, function(error, sdpAnswer) {
				if (error) {
					session.user.stop();
					return next(error);
				}
				session.user.sdpAnswer = sdpAnswer;
				return next();
			});
		},
		(next) => {
			session.room.presenter.webRtcEndpoint.connect(session.user.webRtcEndpoint, function(error) {
				if (error) {
					session.user.stop();
					return next(error);
				}
				return next();
			});
		},
		(next) => {
			session.user.webRtcEndpoint.gatherCandidates(function(error) {
				if (error) {
					session.user.stop();
					return next(error);
				}
				return next();
			});
		}
	], function(err) {
		if (err) {
			console.log(`Got an error from user ${this.session.id}: ${error}`);
			return next(error);
		}
		return next();
	});


	// if (candidatesQueue[session.id]) {
	// 	while (candidatesQueue[session.id].length) {
	// 		var candidate = candidatesQueue[session.id].shift();
	// 		webRtcEndpoint.addIceCandidate(candidate);
	// 	}
	// }
};

KurentoUtils.prototype.runSavedIceCandidate = function(session, next) {
	console.info(`${session.savedIceCandidate.length} candidate(s) will be add to the webRtcEndpoint of user with ID ${session.id}`);
	if (session.savedIceCandidate.length) {
		_.forEach(session.savedIceCandidate, function(savedIceCandidate) {
			session.user.webRtcEndpoint.addIceCandidate(savedIceCandidate);
		});
	}
	return next();
}

KurentoUtils.prototype.processIceCandidate = function(data, next) {
	const iceCandidate = kurento.getComplexType('IceCandidate')(data.candidate);

	if (this.session.user && this.session.user.webRtcEndpoint) {
		console.info(`Sending candidate to ${this.session.user.id}`);
		this.session.user.webRtcEndpoint.addIceCandidate(iceCandidate);
	} else {
		this.session.addIceCandidateToQueue(iceCandidate);
		console.log(`Got an ice candidate to store by ${this.session.id}`);
	}
	return next();
};

module.exports = new KurentoUtils();
