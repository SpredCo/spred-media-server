var Presenter = function(id) {
	this.id = id;
	this.pipeline = null;
	this.webRtcEndpoint = null;
	this.sdpAnswer = null;
	this.sdpOffer = null;

	return this;
}

Presenter.prototype.stop = function() {
	if (this.pipeline) {
		this.pipeline.release();
	}
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
