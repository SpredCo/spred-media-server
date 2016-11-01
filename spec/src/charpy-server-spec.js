describe("CharpyServer", function() {

	it("Charpy server should have good settings", function() {
		var charpy = require('../../src/charpy-server')({
			as_uri: "LOCAL URI TEST",
			kms_uri: "KMS URI TEST"
		});

		expect(charpy.conf.as_uri).toBe("LOCAL URI TEST");
		expect(charpy.conf.kms_uri).toBe("KMS URI TEST");
	});

	it("it should start well", function() {
		var charpy = require('../../src/charpy-server')();

		charpy.start();
	});

});
