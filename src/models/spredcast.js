const _ = require('lodash');

var Spredcast = function(id) {
	this.id = id;
	this.presenter = null;
	this.viewers = [];
	this.messages = [];
	this.questions = [];

	return this;
}

Spredcast.prototype.addViewer = function(viewer) {
	if (viewer) {
		this.viewers.push(viewer);
	}
};

Spredcast.prototype.setPresenter = function(presenter) {
	if (presenter) {
		this.presenter = presenter;
	}
};

Spredcast.prototype.end = function() {

}

module.exports = Spredcast;
