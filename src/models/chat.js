const Message = require('./message');
const Question = require('./question');

var Chat = function(session) {
	this.session = session;

	this.session.socket.on('messages', function(message) {
		console.info(`Got a message from ${message.sender} with content : ${message.text}`)
		this.sendMessage(message.text);
	}.bind(this));

	this.session.socket.on('questions', function(question) {
		console.info(`Got a question from ${question.sender} with content : ${question.text}`)
		this.sendQuestion(question.text);
	}.bind(this));

	this.session.socket.on('down_question', function(question) {
		this.session.socket.to(session.spredCast.id).emit('down_question', question);
	}.bind(this));

	this.session.socket.on('up_question', function(question) {
		this.session.socket.to(session.spredCast.id).emit('up_question', question);
	}.bind(this));

	return this;
}

Chat.prototype.sendQuestion = function(text) {
	var question = new Question(text);
	question.sender = this.session.user.pseudo;
	console.log(`sending question to ${this.session.spredCast.id} with content : ${text}`)
	this.session.socket.to(this.session.spredCast.id).emit('questions', question);
}

Chat.prototype.sendMessage = function(text) {
	var message = new Message(text);
	message.sender = this.session.user.pseudo;
	console.log(`sending message to ${this.session.spredCast.id} with content : ${text}`)
	this.session.socket.to(this.session.spredCast.id).emit('messages', message);
}

module.exports = Chat;
