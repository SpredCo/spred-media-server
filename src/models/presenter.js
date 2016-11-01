var Presenter = function(id) {
	this.id = id;

	return this;
}

Presenter.prototype.pipeline = function(pipeline) {
	if (pipeline) {
		this.pipeline = pipeline;
	} else {
		return this.pipeline;
	}
};

Presenter.prototype.webRtcEndpoint = function(webRtcEndpoint) {
	if (webRtcEndpoint) {
		this.webRtcEndpoint = webRtcEndpoint;
	} else {
		return this.webRtcEndpoint;
	}
};

Presenter.prototype.sdpAnswer = function(sdpAnswer) {
	if (sdpAnswer) {
		this.sdpAnswer = sdpAnswer;
	} else {
		return this.sdpAnswer;
	}
};

Presenter.prototype.stop = function() {
	this.pipeline.release();
	// if (user.isPresenter) {
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

module.exports = Presenter;
