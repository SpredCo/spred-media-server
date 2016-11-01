describe("Kurento Helpers", function() {
	var Kurento = require('../../../src/helpers/kurento-helpers');

	it("it should create a kurento client", function() {
		var client = Kurento.client("test uri");
	});
});
