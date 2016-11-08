var Session = function(socket) {
	this.id = socket.id;
	this.socket = socket;
	this.user = null;
	this.spredCast = null;
	this.savedIceCandidate = [];

	return this;
}

Session.prototype.addIceCandidateToQueue = function(iceCandidate) {
	if (iceCandidate) {
		this.savedIceCandidate.push(iceCandidate);
	}
};

module.exports = Session;
