//-------------------------------------------------------------------
// Install + Instantiate + Upgrade Chaincode
//-------------------------------------------------------------------
const path = require('path');
const winston = require('winston');
const logger = new (winston.Logger)({
	transports: [
		new (winston.transports.Console)()
	]
});
const helper = require('./helper.js')(logger);
var use_peer = process.env.USE_PEER;

module.exports = function (logger) {
	var deploy_cc = {};

	deploy_cc.install_chaincode = function (obj, options, cb) {
		console.log(' Installing Chaincode');

		// fix GOPATH - does not need to be real!
		process.env.GOPATH = path.join(__dirname, '../');

		// send proposal to endorser
		var request = {
			targets: [obj.newPeer(options.peer_urls, {
				pem: options.peer_tls_opts,
				'ssl-target-name-override': null
			})],
			chaincodePath: options.path_2_chaincode,
			chaincodeId: options.chaincode_id,
			chaincodeVersion: options.chaincode_version,
		};
		console.log('Sending install req');

		obj.installChaincode(request).then(function (results) {

			// --- Check Install Response --- //
			check_proposal_res(results);
			if (cb) return cb(null, results);

		}).catch(function (err) {

			// --- Errors --- //
			console.log('Error in install catch block', typeof err, err);
			var formatted = format_error_msg(err);
			if (cb) return cb(formatted, null);
			else return;
		});
	};

	function format_error_msg(error_message) {
		var temp = {
			parsed: 'could not format error',
			raw: error_message
		};
		var pos;
		try {
			if (typeof error_message === 'object') {
				temp.parsed = error_message[0].toString();
			} else {
				temp.parsed = error_message.toString();
			}
			pos = temp.parsed.lastIndexOf(':');
			if (pos >= 0) temp.parsed = temp.parsed.substring(pos + 2);
		}
		catch (e) {
			console.log(' could not format error');
		}
		temp.parsed = 'Blockchain network error - ' + temp.parsed;
		return temp;
	};

	function check_proposal_res(results) {
		var proposalResponses = results[0];
		var proposal = results[1];
		var header = results[2];

		var all_good = true;
		for (var i in proposalResponses) {
			let one_good = false;
			if (proposalResponses && proposalResponses[0].response &&
				proposalResponses[0].response.status === 200) {
				one_good = true;
				console.log('install proposal was good');
			} else {
				console.log('install proposal was bad');
			}
			all_good = all_good & one_good;
		}
		if (all_good) {
			console.log(
				'Successfully sent install Proposal and received ProposalResponse: Status - %s',
				proposalResponses[0].response.status);
			console.log('\nSuccessfully Installed chaincode');
			var request = {
				proposalResponses: proposalResponses,
				proposal: proposal,
				header: header
			};
			return request;
		} else {
			console.log(
				'Failed to send install Proposal or receive valid response. Response null or status is not 200. exiting...'
			);
			throw proposalResponses;
		}
	};

	deploy_cc.instantiate_chaincode = function (obj, options, cb) {
		console.log('Instantiating Chaincode');

		var channel = obj.getChannel(helper.getChannelId());
		var eventhub = null;

		// fix GOPATH - does not need to be real!
		process.env.GOPATH = path.join(__dirname, '../');

		// send proposal to endorser
		var request = {
			targets: [obj.newPeer(options.peer_urls, {
				pem: options.peer_tls_opts,
				'ssl-target-name-override': null	//can be null if cert matches hostname
			})],
			//chaincodePath: options.path_2_chaincode,
			chaincodeId: options.chaincode_id,
			chaincodeVersion: options.chaincode_version,
			fcn: 'init',
			args: options.cc_args,
			txId: obj.newTransactionID()
		};

		console.log('Sending instantiate req');

		//send instantiate proposal
		channel.initialize().then(() => {
			channel.sendInstantiateProposal(request
				//nothing
			).then(
				function (results) {

					//check response
					var request = check_proposal_res(results);

					return channel.sendTransaction(request);

				})
				.then(
				function (response) {

					// All good
					if (response.status === 'SUCCESS') {
						console.log(' Successfully ordered instantiate endorsement.');

						// Call optional order hook
						//	if (options.ordered_hook) options.ordered_hook(null, request.txId.toString());

						setTimeout(function () {
							if (cb) return cb(null, response);
							else return;
						}, 130000);
					}

					// No good
					else {
						console.log('Failed to order the instantiate endorsement.');
						throw response;
					}
				}
				).catch(
				function (err) {
					console.log(' Error in instantiate catch block', typeof err, err);
					var formatted = format_error_msg(err);

					if (cb) return cb(formatted, null);
					else return;
				});

		});

	};
	return deploy_cc;
};

