const kurento = require('kurento-client');
const async = require('async');
const _ = require('lodash');

var KurentoUtils = function() {

}

KurentoUtils.prototype.createPresenter = function(kurentoClient, session, next) {
	async.waterfall([
		(next) => {
			kurentoClient.create('MediaPipeline', function(error, pipeline) {
				if (error) {
					session.close();
					return next(error);
				}
				console.log(`MediaPipeline for presenter ${session.id} in spredcast ${session.spredcast.id} created`);
				session.pipeline = pipeline;
				return next();
			});
		},
		(next) => {
			session.pipeline.create('WebRtcEndpoint', function(error, webRtcEndpoint) {
				if (error) {
					session.close();
					return next(error);
				}
				console.log(`WebRtcEndPoint for presenter ${session.id} in spredcast ${session.spredcast.id} created`);
				session.webRtcEndpoint = webRtcEndpoint;
				return next();
			});
		},
		(next) => {
			this.runSavedIceCandidate(session);
			session.uwebRtcEndpoint.on('OnIceCandidate', function(event) {
				var candidate = kurento.getComplexType('IceCandidate')(event.candidate);
				console.log(`Sending candidate for presenter ${session.user.pseudo} in spredcast ${session.spredcast.id}`);
				session.socket.emit('ice_candidate', {
					candidate: candidate
				});
			});
			return next();
		},
		(next) => {
			session.webRtcEndpoint.processOffer(session.sdpOffer, function(error, sdpAnswer) {
				if (error) {
					session.close();
					return next(error);
				}
				console.log(`sdpOffer have been process without errors for presenter ${session.user.pseudo} in spredcast ${session.spredcast.id}`);
				session.sdpAnswer = sdpAnswer;
				return next();
			});
		},
		(next) => {
			session.webRtcEndpoint.gatherCandidates(function(error) {
				if (error) {
					session.close();
					return next(error);
				}
				console.log(`Candidates have been gathered for presenter ${session.user.pseudo} in spredcast ${session.spredcast.id}`);
				return next();
			});
		}
	], next);
};

KurentoUtils.prototype.createViewer = function(session, next) {
	async.waterfall([
		(next) => {
			session.spredcast.presenter.pipeline.create('WebRtcEndpoint', function(error, webRtcEndpoint) {
				if (error) {
					session.close();
					return next(error);
				}
				console.log(`WebRtcEndPoint for viewer ${session.user.pseudo} in spredcast ${session.spredcast.id} created`);
				session.webRtcEndpoint = webRtcEndpoint;
				return next();
			});
		},
		(next) => {
			this.runSavedIceCandidate(session);
			session.webRtcEndpoint.on('OnIceCandidate', function(event) {
				var candidate = kurento.getComplexType('IceCandidate')(event.candidate);
				console.log(`Sending candidate for viever ${session.user.pseudo} in spredcast ${session.spredcast.id}`);
				session.socket.emit('ice_candidate', {
					candidate: candidate
				});
			});
			return next();
		},
		(next) => {
			session.webRtcEndpoint.processOffer(session.sdpOffer, function(error, sdpAnswer) {
				if (error) {
					session.close();
					return next(error);
				}
				console.log(`sdpOffer has been process without errors for viewer ${session.user.pseudo} in spredcast ${session.spredcast.id}`);
				session.sdpAnswer = sdpAnswer;
				return next();
			});
		},
		(next) => {
			session.spredcast.presenter.webRtcEndpoint.connect(session.user.webRtcEndpoint, function(error) {
				if (error) {
					session.user.stop();
					return next(error);
				}
				console.log(`Viewer ${session.user.pseudo} in spredcast ${session.spredcast.id} has been connected without errors to presenter ${session.spredcast.presenter.user.pseudo} in spredcast ${session.spredcast.id}`);
				return next();
			});
		},
		(next) => {
			session.user.webRtcEndpoint.gatherCandidates(function(error) {
				if (error) {
					session.user.stop();
					return next(error);
				}
				console.log(`Candidates have been gathered for viewer ${session.user.pseudo} in spredcast ${session.spredcast.id}`);
				return next();
			});
		}
	], next);
};

KurentoUtils.prototype.runSavedIceCandidate = function(session) {
	console.info(`${session.savedIceCandidate.length} candidate(s) will be add to the webRtcEndpoint of user with ID ${session.id}`);
	if (session.savedIceCandidate.length) {
		_.forEach(session.savedIceCandidate, function(savedIceCandidate) {
			session.webRtcEndpoint.addIceCandidate(savedIceCandidate);
		});
	}
}

KurentoUtils.prototype.processIceCandidate = function(session, data) {
	const iceCandidate = kurento.getComplexType('IceCandidate')(data.candidate);

	if (session.user && session.webRtcEndpoint) {
		console.info(`Sending candidate to ${session.user.pseudo}`);
		session.webRtcEndpoint.addIceCandidate(iceCandidate);
	} else {
		session.addIceCandidateToQueue(iceCandidate);
		console.log(`Got an ice candidate to store by ${session.id}`);
	}
};

module.exports = new KurentoUtils();
