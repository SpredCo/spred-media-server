const Chat = require('./chat');
const _ = require('lodash');

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

	// Chat linked to the user
	this.chat = null;

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
	if (this.spredCast) {
		if (this.spredCast.presenter.id === this.id) {
			this.spredCast.presenter = null;
		} else {
			_.remove(this.spredCast.viewers, (viewer) => viewer.id === this.id);
		}
	}
	console.info(`Session[${this.id}] with user[${this.user ? this.user.pseudo : 'anonymous'}] now close.`);
}

Session.prototype.enableChat = function() {
	if (!this.chat) {
		this.chat = new Chat(this);
	}
}

Session.prototype.disableChat = function() {
	if (this.chat) {
		this.chat = null;
	}
}

module.exports = Session;
