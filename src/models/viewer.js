var Viewer = function(id) {
	this.id = id;
	this.webRtcEndpoint = null;
	this.sdpAnswer = null;
	this.sdpOffer = null;

	return this;
}

Viewer.prototype.stop = function() {
	if (this.webRtcEndpoint) {
		this.webRtcEndpoint.release();
	}
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
