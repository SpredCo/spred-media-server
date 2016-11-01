var Room = function(id) {
	this.id = id;
	this.presenter = null;
	this.users_pending = [];
	this.viewers = [];

	return this;
}

Room.prototype.addToQueue = function(user) {
	if (user) {
		this.users_pending.push(user);
	}
};

Room.prototype.addViewer = function(viewer) {
	if (viewer) {
		this.viewers.push(viewer);
	}
};

Room.prototype.setPresenter = function(presenter) {
	if (presenter) {
		this.presenter = presenter;
	}
};

module.exports = Room;
