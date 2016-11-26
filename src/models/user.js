const User = function(id, pseudo) {
	this.id = id || 'anonymous';
	this.pseudo = pseudo;

	return this;
}

module.exports = User;
