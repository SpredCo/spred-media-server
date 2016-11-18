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
}

module.exports = Viewer;
