var Question = function(id) {
	this.id = id;
	this.text = null;
	this.sender = null;
	this.nbVote = 0;
	this.date = new Date();

	return this;
}

module.exports = Question;
