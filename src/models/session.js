var Session = function(socket) {
	this.id = socket.id;
	this.socket = socket;
	this.user = null;
	this.spredCast = null;

	return this;
}

module.exports = Session;
