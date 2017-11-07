/*	
 * Copyright IBM Corp. 2017
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @author Harpreet Kaur Chawla
 */

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

	helper.getMSPid = function (options) {
		if (options.organizations) {
			return options.organizations["PeerOrg1"].mspid;
		} else {
			throw new Error('Org key not found.');
		}
	}
	helper.getCAname = function (options, msp_id, use_ca) {
		//Get CA from Credentials 
		if (options.organizations) {
			const org = options.organizations[msp_id];
			if (org && org.certificateAuthorities) {
				if (org.certificateAuthorities && org.certificateAuthorities[use_ca]) {
					return org.certificateAuthorities[use_ca];
				}
			} else {
				throw new Error('Organizations not found on this channel');
			}
		}
	};

	helper.getPeername = function (options, channel_id, use_peer) {
		//Get Peer name from Credentials 
		if (options.channels) {
			const getChannel = options.channels[channel_id];
			if (getChannel && getChannel.peers) {
				const getPeers = Object.keys(getChannel.peers);
				if (getPeers && getPeers[use_peer]) {
					return getPeers[use_peer];
				}
			} else {
				throw new Error('Peers not found for this channel');
			}
		}
	};

	helper.getOrderername = function (options, channel_id, use_orderer) {
		//Get Orderer from Credentials
		if (options.channels) {
			const getChannel = options.channels[channel_id];
			if (getChannel && getChannel.orderers && getChannel.orderers[use_orderer]) {
				return getChannel.orderers[use_orderer];
			} else {
				throw new Error('Orderer not found for this channel');
			}
		}
	};

	helper.getEnrolleduser = function (options, use_ca) {
		//Get Enrollment user from Credentials
		if (options.certificateAuthorities) {
			const getCas = options.certificateAuthorities[use_ca];
			return getCas.registrar;
		} else {
			throw new Error('Cannot find enroll id');
		}
	};

	// get a ca object
	helper.getCA = function (options, cas_name) {
		if (options.certificateAuthorities) {
			return options.certificateAuthorities[cas_name];
		} else {
			return null;
		}
	};

	// get an orderer object
	helper.getOrderer = function (options, orderers_name) {
		if (options.orderers) {
			return options.orderers[orderers_name];
		} else {
			return null;
		}
	};

	// get a peer object
	helper.getPeer = function (options, peers_name) {
		if (options.peers) {
			return options.peers[peers_name];
		} else {
			return null;
		}
	};
	return helper;
};

