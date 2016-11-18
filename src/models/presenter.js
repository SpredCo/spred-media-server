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
}

module.exports = Presenter;
