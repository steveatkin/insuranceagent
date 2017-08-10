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
		//return getBlockchainField('chaincode_id');
		return process.env.CHAINCODE_ID;
	};

	// get the channel id on network
	helper.getChannelId = function () {
		//return getBlockchainField('channel_id');
		return process.env.CHANNEL_ID;
	};

	// get the chaincode version on network
	helper.getChaincodeVersion = function () {
		//return getBlockchainField('chaincode_version');
		return process.env.CHAINCODE_VERSION;
	};

	// get the chaincode id on network
	helper.getBlockDelay = function () {
		//var ret = getBlockchainField('block_delay');
		var ret = process.env.BLOCK_DELAY;
		if (!ret || isNaN(ret)) ret = 10000;
		return ret;
	};

	//retreive blockchain app fields
	function getBlockchainField(field) {
		try {
			if (creds.credentials.app[field]) {
				return creds.credentials.app[field];
			}
			else {
				console.log('"' + field + '" not found in creds json: ');
				return null;
			}
		}
		catch (e) {
			console.log('"' + field + '" not found in creds json: ');
			return null;
		}
	}

	return helper;
};

