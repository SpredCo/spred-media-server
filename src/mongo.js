const mongoose = require('mongoose');

mongoose.connection.on('error', function() {
	console.error('Error');
});

mongoose.connection.on('open', function() {
	console.info('MongoDB: connection success');
});

const connectionStr = process.env.MONGO_URI || 'mongodb://sharemyscreen.fr:27017/spred';
mongoose.connect(connectionStr);
