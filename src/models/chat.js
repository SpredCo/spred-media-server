const _ = require('lodash');

const Message = require('./message');
const Question = require('./question');

var Chat = function(session) {
	this.session = session;

	this.session.socket.on('messages', function(data) {
		var message = new Message(this.session.spredCast.messages.length + 1);
		message.text = data.text;
		this.session.spredCast.messages.push(message);
		console.info(`Got a message(${message.id}) from ${this.session.user.pseudo} with content : ${message.text}`)
		this.sendMessage(message);
	}.bind(this));

	this.session.socket.on('questions', function(data) {
		var question = new Question(this.session.spredCast.questions.length + 1);
		question.text = data.text;
		this.session.spredCast.questions.push(question);
		console.info(`Got a question(${question.id}) from ${this.session.user.pseudo} with content : ${question.text}`)
		this.sendQuestion(question);
	}.bind(this));

	this.session.socket.on('down_question', function(question) {
		const q = _.find(this.session.spredCast.questions, (q) => question.id === q.id);
		if (q) {
			q.nbVote -= 1;
			this.session.socket.to(this.session.spredCast.id).emit('down_question', q);
			this.session.socket.emit('down_question', q);
		} else {
			this.session.socket.emit('down_question', {
				err: `Question with id ${question.id} does not exist`,
				status: 'rejected'
			});
		}
	}.bind(this));

	this.session.socket.on('up_question', function(question) {
		const q = _.find(this.session.spredCast.questions, (q) => question.id === q.id);
		if (q) {
			q.nbVote += 1;
			this.session.socket.to(this.session.spredCast.id).emit('up_question', q);
			this.session.socket.emit('up_question', q);
		} else {
			this.session.socket.emit('up_question', {
				err: `Question with id ${question.id} does not exist`,
				status: 'rejected'
			});
		}
	}.bind(this));

	sendSpredCastHistory(session);

	return this;
}

Chat.prototype.generateMessage = function(content) {
	const message = new Message(this.session.spredCast.messages.length + 1);
	message.text = content;
	this.session.spredCast.messages.push(message);
	return message;
}

Chat.prototype.sendQuestion = function(question) {
	question.sender = this.session.user.pseudo;
	question.user_picture = this.session.user.picture;
	console.log(`sending question to ${this.session.spredCast.id} with content : ${question.text}`)
	this.session.socket.to(this.session.spredCast.id).emit('questions', question);
	this.session.socket.emit('questions', question);
}

Chat.prototype.sendMessage = function(message) {
	message.sender = this.session.user.pseudo;
	message.user_picture = this.session.user.picture;
	console.log(`sending message to ${this.session.spredCast.id} with content : ${message.text}`)
	this.session.socket.to(this.session.spredCast.id).emit('messages', message);
	this.session.socket.emit('messages', message);
}

function sendSpredCastHistory(session) {
	_.forEach(session.spredCast.messages, (message) => {
		session.socket.emit('messages', message);
	});
	_.forEach(session.spredCast.questions, (question) => {
		session.socket.emit('questions', question);
	});
}

module.exports = Chat;
