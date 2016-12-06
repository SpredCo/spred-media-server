var Question = function(text) {
	this.text = text;
	this.sender = null;
	this.upVote = 0;
	this.downVote = 0;

	return this;
}

Question.prototype.up = function() {
	this.upVote += 1;
	return this.upVote;
}

Question.prototype.down = function() {
	this.downVote += 1;
	return this.downVote;
}

module.exports = Question;
