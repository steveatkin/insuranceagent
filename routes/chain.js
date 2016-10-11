/*	
 * Copyright IBM Corp. 2016
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
 * @author Steven Atkin
 */


var express = require('express');
var router = express.Router();
var optional = require('optional');
var Ibc1 = require('ibm-blockchain-js');
var winston = require('winston');
var logger = new(winston.Logger)({
	transports: [
		new(winston.transports.Console)()
	]
});
var ibc = new Ibc1(logger);
var request = require('request');
var chaincode = null;
var peers = null;
var users = null;

var options = optional('./chain-credentials.json');

function ensureAuthenticated(req, res, next) {
  if (!req.isAuthenticated()) {
    req.session.originalUrl = req.originalUrl;
    res.redirect('/login');
  } else {
    return next();
  }
}


if (process.env.VCAP_SERVICES) {
	var servicesObject = JSON.parse(process.env.VCAP_SERVICES);
	for (var i in servicesObject) {
		if (i.indexOf('ibm-blockchain') >= 0) {
			if (servicesObject[i][0].credentials.error) {
				console.log('!\n!\n! Error from Bluemix: \n', servicesObject[i][0].credentials.error, '!\n!\n');
				peers = null;
				users = null;
			}
			if (servicesObject[i][0].credentials && servicesObject[i][0].credentials.peers) {
				console.log('overwritting peers, loading from a vcap service: ', i);
				peers = servicesObject[i][0].credentials.peers;
				if (servicesObject[i][0].credentials.users) {
					console.log('overwritting users, loading from a vcap service: ', i);
					users = servicesObject[i][0].credentials.users;
				} else {
					users = null;
				}
				break;
			}
		}
	}
} else if (options.credentials) {
	peers = options.credentials.peers;
	users = options.credentials.users;
}

var options = {
	network: {
		peers: peers,
		users: users,
		options: {
			quiet: true,
			tls: true,
			maxRetry: 1
		}
	},
	chaincode: {
		zip_url: process.env.CHAIN_ZIP_URL,
		unzip_dir: process.env.CHAIN_UNZIP_DIR,
		git_url: process.env.CHAIN_GIT_URL,
		deployed_name: process.env.CHAIN_NAME
	}
};

ibc.load(options, function (err, cc) {
	if (err != null) {
		console.log('! looks like an error loading the chaincode or network, app will fail\n', err);
	} else {
		chaincode = cc;
		if (!cc.details.deployed_name || cc.details.deployed_name === "") {
			cc.deploy('init', ['99'], {
				delay_ms: 50000
			}, function (e) {
				check_if_deployed(e, 1);
			});
		} else {
			console.log('chaincode summary file indicates chaincode has been previously deployed');
			check_if_deployed(null, 1);
		}
	}
});


// Create a new block for this claim payment
router.post('/', ensureAuthenticated, function (req, res) {
	var claim = req.body;

	chaincode.invoke.init_claim_payment([claim.id, claim.value, claim.vehicle, claim.owner, claim.role, claim.state],
		function (err, data) {
			if (err) {
				console.log("BLOCKCHAIN ERROR: " + JSON.stringify(err));
				res.status(500).send({
					status: 500,
					message: 'BlockChain error creating block'
				});
			} else {
				console.log("TRANSACTION INFO: " + JSON.stringify(data));
				res.json({
					status: 200,
					message: 'ok'
				});
			}
		});

});


// Delete this claim payment
router.delete('/:customer', ensureAuthenticated, function (req, res) {
	var customer = req.params.customer;

	chaincode.invoke.delete([customer],
		function (err, data) {
			if (err) {
				console.log("BLOCKCHAIN ERROR: " + JSON.stringify(err));
				res.status(500).send({
					status: 500,
					message: 'BlockChain error deleting block'
				});
			} else {
				console.log("TRANSACTION INFO: " + JSON.stringify(data));
				res.json({
					status: 200,
					message: 'ok'
				});
			}
		});
});

// Delete the chain code for this block chain
router.delete('/', ensureAuthenticated, function (req, res) {
	ibc.clear(function (err, data) {
		if (err) {
			console.log("BLOCKCHAIN ERROR: " + JSON.stringify(err));
			res.status(500).send({
				status: 500,
				message: 'BlockChain error deleting chain code'
			});
		} else {
			console.log("TRANSACTION INFO: " + JSON.stringify(data));
			res.json({
				status: 200,
				message: 'ok'
			});
		}
	});
});


// Update the owner of the claim payment in the block e.g., policy holder, bank, or repair facility
router.post('/:customer', ensureAuthenticated, function (req, res, next) {
	var owner = req.body.owner;
	var role = req.body.role;
	var state = req.body.state;
	var customer = req.params.customer;

	chaincode.invoke.set_owner([customer, owner, role, state],
		function (err, data) {
			if (err) {
				console.log("BLOCKCHAIN ERROR: " + JSON.stringify(err));
				res.status(500).send({
					status: 500,
					message: 'BlockChain error setting block owner'
				});
			} else {
				console.log("TRANSACTION INFO: " + JSON.stringify(data));
				res.json({
					status: 200,
					message: 'ok'
				});
			}
		}
	);
});


// Get the block for the claim payment
router.get('/:customer', ensureAuthenticated, function (req, res, next) {
	var customer = req.params.customer;

	chaincode.query.read([customer], function (err, data) {
		if (!err && data) {
			var claim = JSON.parse(data);
			res.json({
				status: 200,
				message: 'ok',
				claim: claim
			});
		}
		// Block for claim payment not found
		else {
			res.json({});
		}
	});
});


function check_if_deployed(e, attempt) {
	if (e) {
		cb_deployed(e); //looks like an error pass it along
	} else if (attempt >= 15) { //tried many times, lets give up and pass an err msg
		console.log('[preflight check]', attempt, ': failed too many times, giving up');
		var msg = 'chaincode is taking an unusually long time to start. this sounds like a network error, check peer logs';
		if (!process.error) process.error = {
			type: 'deploy',
			msg: msg
		};
		cb_deployed(msg);
	} else {
		console.log('[preflight check]', attempt, ': testing if chaincode is ready');
		chaincode.query.read(['_claimindex'], function (err, resp) {
			var cc_deployed = false;
			try {
				if (err == null) { //no errors is good, but can't trust that alone
					if (!resp || resp === 'null') {
						cc_deployed = true; //looks alright, brand new, no claims yet
					} else {
						var json = JSON.parse(resp);
						if (json.constructor === Array) cc_deployed = true; //looks alright, we have claims
					}
				}
			} catch (e) {} //anything nasty goes here

			// ---- Are We Ready? ---- //
			if (!cc_deployed) {
				console.log('[preflight check]', attempt, ': failed, trying again');
				setTimeout(function () {
					check_if_deployed(null, ++attempt); //no, try again later
				}, 10000);
			} else {
				console.log('[preflight check]', attempt, ': success');
				cb_deployed(null); //yes, lets go!
			}
		});
	}
}



function cb_deployed(e) {
	if (e != null) {
		console.log('! looks like a deploy error, holding off on the starting the socket\n', e);
		if (!process.error) process.error = {
			type: 'deploy',
			msg: e.details
		};
	} else {

		// ========================================================
		// Monitor the height of the blockchain
		// ========================================================
		ibc.monitor_blockheight(function (chain_stats) { //there is a new block, lets refresh everything that has a state
			if (chain_stats && chain_stats.height) {
				console.log('hey new block, lets refresh and broadcast to all', chain_stats.height - 1);
				ibc.block_stats(chain_stats.height - 1, cb_blockstats);
				console.log('CHAIN: ' + 'reset');
				chaincode.query.read(['_claimindex'], cb_got_index);
			}

			//got the block's stats, lets send the statistics
			function cb_blockstats(e, stats) {
				if (e != null) console.log('blockstats error:', e);
				else {
					chain_stats.height = chain_stats.height - 1; //its 1 higher than actual height
					stats.height = chain_stats.height; //copy
					console.log('CHAIN STATS: ' + JSON.stringify(chain_stats));
					console.log('BLOCK STATS: ' + JSON.stringify(stats));
				}
			}

			//got the claims index, lets get each claim
			function cb_got_index(e, index) {
				if (e != null) console.log('claims index error:', e);
				else {
					try {
						var json = JSON.parse(index);
						for (var i in json) {
							console.log('!', i, json[i]);
							chaincode.query.read([json[i]], cb_got_claim); //iter over each, read their values
						}
					} catch (e) {
						console.log('claims index msg error:', e);
					}
				}
			}

			//call back for getting a claim, lets send a message
			function cb_got_claim(e, claim) {
				if (e != null) console.log('claims error:', e);
				else {
					try {
						console.log('CLAIM: ' + JSON.stringify(claim));
					} catch (e) {
						console.log('claim msg error', e);
					}
				}
			}
		});
	}
}


module.exports = router;