var Viewer = function(id) {
	this.id = id;

	return this;
}

Viewer.prototype.pipeline = function(pipeline) {
	if (pipeline) {
		this.pipeline = pipeline;
	} else {
		return this.pipeline;
	}
};

Viewer.prototype.webRtcEndpoint = function(webRtcEndpoint) {
	if (webRtcEndpoint) {
		this.webRtcEndpoint = webRtcEndpoint;
	} else {
		return this.webRtcEndpoint;
	}
};

Viewer.prototype.sdpAnswer = function(sdpAnswer) {
	if (sdpAnswer) {
		this.sdpAnswer = sdpAnswer;
	} else {
		return this.sdpAnswer;
	}
};

Viewer.prototype.stop = function() {
	this.webRtcEndpoint.release();
	// if (user.isViewer) {
	// 	// for (var i in viewers) {
	// 	// 	var viewer = viewers[i];
	// 	// 	if (viewer.ws) {
	// 	// 		viewer.ws.send(JSON.stringify({
	// 	// 			id: 'stopCommunication'
	// 	// 		}));
	// 	// 	}
	// 	// }
	// 	/* Viewer has to be released */
	// 	user.pipeline().release();
	// } else {
	// 	user.webRtcEndpoint().release();
	// }
}

module.exports = Viewer;
