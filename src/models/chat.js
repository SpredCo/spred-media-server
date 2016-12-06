const Message = require('./message');

var Chat = function(session) {
	this.session = session;

	this.session.socket.on('messages', function(message) {
		this.sendMessage(message.text);
	}.bind(this));

	return this;
}

Chat.prototype.sendMessage = function(text) {
	var message = new Message(text);
	message.sender = this.session.user.pseudo;
	this.session.socket.to(this.session.spredCast.id).emit('messages', message);
}

module.exports = Chat;
