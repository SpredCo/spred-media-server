var Session = function(socket) {
	this.id = socket.id;
	this.socket = socket;

	// User id used in the database
	this.user = null;

	// Spredcast stored in the database
	this.spredCast = null;
	this.castToken = null;

	// We store every iceCandidate for later use
	this.savedIceCandidate = [];

	this.pipeline = null;
	this.webRtcEndpoint = null;
	this.sdpAnswer = null;
	this.sdpOffer = null;

	return this;
}

Session.prototype.addIceCandidateToQueue = function(iceCandidate) {
	if (iceCandidate) {
		this.savedIceCandidate.push(iceCandidate);
	}
};

Session.prototype.close = function() {
	if (this.pipeline) {
		this.pipeline.release();
	} else if (this.webRtcEndpoint) {
		this.webRtcEndpoint.release();
	}
	console.info(`Session[${this.id}] with user[${this.user.pseudo}] now close.`);
}

module.exports = Session;
