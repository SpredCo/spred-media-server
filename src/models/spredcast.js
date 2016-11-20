const _ = require('lodash');

var Spredcast = function(id) {
	this.id = id;
	this.presenter = null;
	this.session_pending = [];
	this.viewers = [];

	return this;
}

Spredcast.prototype.addToPendingQueue = function(session) {
	if (session) {
		this.session_pending.push(session);
	}
};

Spredcast.prototype.removeFromPendingQueue = function(session) {
	if (session) {
		_.pull(this.session_pending, session);
	}
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
