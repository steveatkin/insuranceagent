//-------------------------------------------------------------------
// Install + Instantiate + Upgrade Chaincode
//-------------------------------------------------------------------
const path = require('path');
const optional = require('optional');

module.exports = function (logger) {
	var helper = {};
	var creds = optional('./chain-credentials.json');

	// get the chaincode id on network
	helper.getChaincodeId = function () {
		return process.env.CHAINCODE_ID;
	};

	// get the channel id on network
	helper.getChannelId = function () {
		return process.env.CHANNEL_ID;
	};

	// get the chaincode version on network
	helper.getChaincodeVersion = function () {
		return process.env.CHAINCODE_VERSION;
	};

	// get the chaincode id on network
	helper.getBlockDelay = function () {
		var ret = process.env.BLOCK_DELAY;
		if (!ret || isNaN(ret)) ret = 10000;
		return ret;
	};

	return helper;
};

