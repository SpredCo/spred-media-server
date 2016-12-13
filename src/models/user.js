const User = function(id, pseudo) {
	this.id = id || 'anonymous';
	this.pseudo = pseudo;
	this.picture = null;

	return this;
}

module.exports = User;
