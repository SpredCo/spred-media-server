var Question = function(id) {
	this.id = id;
	this.text = null;
	this.sender = null;
	this.upVote = 0;
	this.downVote = 0;
	this.date = new Date();

	return this;
}

module.exports = Question;
