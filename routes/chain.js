const FabricClient = require('fabric-client');
const User = require('fabric-client/lib/User.js');
const CaService = require('fabric-ca-client/lib/FabricCAClientImpl.js');
const Orderer = require('fabric-client/lib/Orderer.js');
const Peer = require('fabric-client/lib/Peer.js');
const utils = require('fabric-client/lib/utils.js');
const fs = require('fs');
const path = require("path");
const async = require('async');
const https = require('https');
const optional = require('optional');
const express = require('express');
const router = express.Router();
var options = optional('./chain-credentials.json');
var admin_config_filename = 'privateKey.pem';
var signed_config_filename = 'cert.pem';
var path2cert = path.join(__dirname, '../' + admin_config_filename);
var admin_cert = fs.readFileSync(path2cert, 'utf8') + '\r\n'; 
var path2sign = path.join(__dirname, '../' + signed_config_filename);
var signed_cert = fs.readFileSync(path2sign, 'utf8') + '\r\n'; 

const winston = require('winston');
const logger = new (winston.Logger)({
	transports: [
		new (winston.transports.Console)()
	]
});
const deploy_cc = require('./deploy_cc.js')(logger);
const helper = require('./helper.js')(logger);

//Array to store Orderers, CAS and Peers Discovery URL's
var casUrl = [];
var peerUrl = [];
var eventUrl = [];
var ordererUrl = [];

//Holder for Fabric Client and Channel
var client;
var channel;

//Variables for Blockchain Network
var network_id;
var orderers;
var cas;
var peers;
var channel_id;
var chaincode_id;
var chaincode_version;
var block_delay;
var tls_cert;
var enrollId;
var enroll_secret;
var msp_id;
var uuid;
var use_orderer;
var use_peer;
var use_ca;

var admin_cert;
var signed_cert;
var ca_name;
var peer_name;
var orderer_name;
var cas_name;

process.env.GOPATH = path.join(__dirname, '../');

// Start the chaincode
init();


function ensureAuthenticated(req, res, next) {
	if (!req.isAuthenticated() && process.env.NODE_ENV == 'production') {
		req.session.originalUrl = req.originalUrl;
		res.redirect('/login');
	} else {
		return next();
	}
}

function init() {
	if (options) {
		//Fetch Environment Variables 
		channel_id = process.env.CHANNEL_ID;
		chaincode_id = process.env.CHAINCODE_ID;
		chaincode_version = process.env.CHAINCODE_VERSION;
		block_delay = process.env.BLOCK_DELAY;
		use_orderer = process.env.USE_ORDERER;
		use_peer = process.env.USE_PEER;
		use_ca = process.env.USE_CA;

		//Fetch from Blockchain Credentials File
		msp_id = helper.getMSPid(options);
		network_id = options["x-networkId"];
		
		//Get Peer, Orderer and CA Name
		peer_name = helper.getPeername(options, channel_id, use_peer);
		cas_name = helper.getCAname(options, msp_id, use_ca);
		orderer_name = helper.getOrderername(options, channel_id, use_orderer);

		//Get Peer, Orderer and CA object
		cas = helper.getCA(options, cas_name);
		peers = helper.getPeer(options, peer_name);
		orderers = helper.getOrderer(options, orderer_name);

		//Get Enrollment User and Secret
		enrollId = cas.registrar[0].enrollId
		enroll_secret = cas.registrar[0].enrollSecret;

		//Get TLS certificate
		tls_cert = options.orderers[orderer_name].tlsCACerts;
		ca_name = options.certificateAuthorities[cas_name].caName;
	}
	else {
		console.log('Missing Blockchain Credentials File');
		process.exit();
	}

	// Create Fabric client and link it to the Blockchain Channel
	try {
		client = new FabricClient();
		channel = client.newChannel(channel_id);
	}
	catch (e) {
		//it might error about 1 chain per network, but that's not a problem just continue
	}

	//set up the network & URL's
	setup();

	//Print network details
	printNetworkDetails();

	//Check if admin is enrolled or not. If not, enroll the admin
	enrollAdmin().then(function (next) {

		//Check if chaincode is already instantiated on the channel or not
		check_if_already_instantiated(client, options, function (resp, err) {

			if (err != undefined) {
				console.log('');
				console.log('Chaincode was not detected');

				//Install and instantiate chaincode
				console.log('First we enroll');
				enrollWithAdminCert(options, function (enrollErr, enrollResp) {
					if (enrollErr != null) {
						logger.error('error enrolling', enrollErr, enrollResp);
					} else {
						console.log('First verify if chaincode is installed on peer');
						//if it's installed then don't install it otherwise install it   
						client.setUserContext(enrollResp.submitter);
						query_installed_cc(client, options, function (err, resp) {
							var flag = false;
							if (err != null) {
								console.log('error: ', err);
							}
							if (resp != null) {
								for (var i = 0; i < resp.chaincodes.length; i++) {
									if (resp.chaincodes[i].name === chaincode_id) {
										//chaincode is already installed on the peer
										//don't install it...proceed further
										console.log('Chaincode is already installed on peer');
										flag = true;
									}
								}
								//Chaincode is not installed, install it on the peer.
								if (flag === false) {
									//Install chaincode on peer
									var opts = {
										peer_urls: peerUrl,
										path_2_chaincode: 'chaincode1',
										chaincode_id: chaincode_id,
										chaincode_version: chaincode_version,
										peer_tls_opts: tls_cert.pem
									};
									deploy_cc.install_chaincode(client, opts, function (err, resp) {
										console.log('Install done. Errors:', (!err) ? 'nope' : err);
									});
								}

								console.log('Instantiate chaincode on the channel');
								var opts = {
									peer_urls: peerUrl,
									path_2_chaincode: 'chaincode1',
									channel_id: channel_id,
									chaincode_id: chaincode_id,
									chaincode_version: chaincode_version,
									cc_args: ['99'],
									peer_tls_opts: tls_cert.pem
								};
								deploy_cc.instantiate_chaincode(client, opts, function (err, resp) {
									console.log('Instantiation done. Errors:', (!err) ? 'nope' : err);
								});
							}
						});
					}
				});


			} else {
				console.log('Chaincode found on channel ' + channel_id);
				//Nothing else to do..... Just wait for user to take some action on UI
				//Based upon action, route will be called
				return;
			}
		});
	});

}


function setup() {

	//uuid for key store
	uuid = network_id.substring(0, 8);
	peerUrl = peers.url;
	eventUrl = peers.eventUrl;
	ordererUrl = orderers.url;
	casUrl = cas.url;

}

function printNetworkDetails() {
	console.log("\n------------- Orderer, ca-server, peers and event URL:PORT information: -------------");
	console.log("");
	console.log("Orderer Url : %s", ordererUrl);
	console.log("");
	console.log("CAS Url : %s", casUrl);
	console.log("");
	console.log("Discovery Url on Peer : %s", peerUrl);
	console.log("");
	console.log("Event Url on Peer : %s", eventUrl);
	console.log("");
	console.log('-----------------------------------------------------------\n');

}

function enrollAdmin() {
	//Configure the KeyValStore which is used to store sensitive keys.
	// This data needs to be located or accessible any time the users enrollmentID
	// perform any functions on the blockchain.  The users are not usable without
	// This data.
	return FabricClient.newDefaultKeyValueStore({
		path: path.join(__dirname, '../', 'keyValStore-' + uuid)
	}).then(function (store) {
		client.setStateStore(store);
		//check if enrollId is enrolled or not
		return getSubmitter(client, options);
	}).then(function (submitter) {

		channel.addOrderer(new Orderer(ordererUrl, {
			pem: tls_cert.pem,
			'ssl-target-name-override': null
		}));
		console.log('added orderer', ordererUrl);

		channel.addPeer(new Peer(peerUrl, {
			pem: tls_cert.pem,
			'ssl-target-name-override': null
		}));
		console.log('added peer', peerUrl);

		// --- Success --- //
		console.log('Successfully got enrollment ' + uuid);

	}).catch(function (err) {

		// --- Failure --- //
		console.log('Failed to get enrollment ' + uuid, err.stack ? err.stack : err);
		var formatted = format_error_msg(err);

		return;
	});
}

function query_installed_cc(client, options, cb) {
	console.log('Querying Installed Chaincodes\n');

	// send proposal to peer
	client.queryInstalledChaincodes(new Peer(peerUrl, {
		pem: tls_cert.pem,
		'ssl-target-name-override': null
	})).then(function (resp) {
		if (cb) return cb(null, resp);
	}).catch(function (err) {
		logger.error(' Error in query installed chaincode', typeof err, err);
		var formatted = format_error_msg(err);

		if (cb) return cb(formatted, null);
		else return;
	});
}

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
		logger.error('could not format error');
	}
	temp.parsed = 'Blockchain network error - ' + temp.parsed;
	return temp;
};


function enrollWithAdminCert(options, cb) {
	var client = new FabricClient();
	var channel = client.newChannel(channel_id);

	FabricClient.newDefaultKeyValueStore({
		path: path.join(__dirname, '../', 'keyValStore-' + uuid)
	}).then(function (store) {
		client.setStateStore(store);
		return getSubmitterWithAdminCert(client, options);							//admin cert is different
	}).then(function (submitter) {
		channel.addOrderer(new Orderer(ordererUrl, {
			pem: tls_cert.pem,
			'ssl-target-name-override': null
		}));
		console.log('added Orderer', ordererUrl);

		channel.addPeer(new Peer(peerUrl, {
			pem: tls_cert.pem,
			'ssl-target-name-override': null
		}));
		console.log('added peer', peerUrl);

		// --- Success --- //
		console.log('Successfully got enrollment ' + uuid);
		if (cb) cb(null, { client: client, channel: channel, submitter: submitter });
		return;

	}).catch(function (err) {
		// --- Failure --- //
		console.log('Failed to get enrollment ' + uuid, err.stack ? err.stack : err);

		var formatted = format_error_msg(err);

		if (cb) cb(formatted);
		return;

	});

}

function getSubmitterWithAdminCert(client, options) {
	return Promise.resolve(client.createUser({
		username: msp_id,
		mspid: msp_id,
		cryptoContent: {
			privateKeyPEM: admin_cert,
			signedCertPEM: signed_cert
		}
	}));
}

function getSubmitter(client, options) {
	var member;
	return client.getUserContext(enrollId, true).then((user) => {
		if (user && user.isEnrolled()) {
			console.log('Successfully loaded enrollment from persistence');
			return user;
		} else {

			// Need to enroll it with the CA
			var tlsOptions = {
				trustedRoots: [tls_cert.pem],                                    //pem cert required
				verify: false
			};
			var caName = ca_name

			var ca_client = new CaService(casUrl, tlsOptions, caName);     //ca_name is important for the bluemix service
			member = new User(enrollId);

			console.log('enroll id: "' + enrollId + '" secret: "' + enroll_secret + '"');
			console.log('msp_id: ', msp_id, 'ca_name:', ca_name);

			// --- Lets Do It --- //
			return ca_client.enroll({
				enrollmentID: enrollId,
				enrollmentSecret: enroll_secret,

			}).then((enrollment) => {

				// Store Certs
				console.log(' Successfully enrolled user \'' + enrollId + '\'');
				return member.setEnrollment(enrollment.key, enrollment.certificate, msp_id);
			}).then(() => {
				// Save Submitter Enrollment
				return client.setUserContext(member);
			}).then(() => {

				// Return Submitter Enrollment
				return member;
			}).catch((err) => {

				// Send Errors
				console.log('Failed to enroll and persist user. Error: ' + err.stack ? err.stack : err);
				throw new Error('Failed to obtain an enrolled user');
			});
		}
	});
}
function check_if_already_instantiated(client, options, cb) {

	var opts = {
		channel_id: channel_id,
		chaincode_id: chaincode_id,
		chaincode_version: chaincode_version,
		fcn: 'read',
		args: ['test']
	};

	query_chaincode(client, opts, function (err, resp) {
		if (err != null) {
			if (cb) return cb(err, resp);
		}
		else {
			if (resp.parsed == null || isNaN(resp.parsed)) {	 //if nothing is here, no chaincode
				if (cb) return cb({ error: 'chaincode not found' }, resp);
			}
			else {
				if (cb) return cb((null, resp));
			}
		}
	});

}

function query_chaincode(client, options, cb) {
	console.log(' Querying Chaincode: ' + options.fcn + '()');
	var channel = client.getChannel(helper.getChannelId());
	// send proposal to peer
	var request = {
		chainId: options.channel_id,
		chaincodeId: options.chaincode_id,
		fcn: options.fcn,
		args: options.args,
		txId: null
	};

	channel.queryByChaincode(request).then(
		function (response_payloads) {
			var formatted = format_query_resp(response_payloads);
			// --- response looks bad -- //
			if (formatted.parsed == null) {
				console.log('Query response is empty', formatted.raw);
			}

			// --- response looks good --- //
			else {
				console.log('Successful query transaction.');
			}
			if (cb) return cb(null, formatted);
		}).catch(
		function (err) {
			console.log(' Error in query catch block', typeof err, err);

			if (cb) return cb(err, null);
			else return;
		});
}

function format_query_resp(peer_responses) {
	var ret = {
		parsed: null,
		peers_agree: true,
		raw_peer_payloads: [],
	};
	var last = null;

	// -- iter on each peer's response -- //
	for (var i in peer_responses) {
		var as_string = peer_responses[i].toString('utf8');
		var as_obj = {};

		//logger.debug('[fcw] Peer ' + i, 'payload as str:', as_string, 'len', as_string.length);
		logger.debug(' Peer ' + i, 'len', as_string.length);
		ret.raw_peer_payloads.push(as_string);

		// -- compare peer responses -- //
		if (last != null) {								//check if all peers agree
			if (last !== as_string) {
				logger.warn('warning - some peers do not agree on query', last, as_string);
				ret.peers_agree = false;
			}
			last = as_string;
		}

		try {
			if (as_string === '') {							//if its empty, thats okay... well its not great 
				as_obj = '';
			} else {
				as_obj = JSON.parse(as_string);				//if we can parse it, its great
			}
			logger.debug('Peer ' + i, 'type', typeof as_obj);
			if (ret.parsed === null) ret.parsed = as_obj;	//store the first one here
		}
		catch (e) {
			if (as_string.indexOf('Error: failed to obtain') >= 0) {
				logger.error(' query resp looks like an error', typeof as_string, as_string);
				ret.parsed = null;
			} else {
				logger.warn(' warning - query resp is not json, might be okay.', typeof as_string, as_string);
				ret.parsed = as_string;
			}
		}
	}
	return ret;
}

function check_res(results) {
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

// Create a new block for this claim payment
router.post('/', ensureAuthenticated, function (req, res) {
	var claim = req.body;
	var eventhub;
	var channel_id = helper.getChannelId();
	var chaincode_id = helper.getChaincodeId();
	var startTime = Date.now();

	// send proposal to endorser
	var request = {
		chainId: channel_id,
		chaincodeId: chaincode_id,
		fcn: "init_claim_payment",
		args: [claim.id, claim.value, claim.vehicle, claim.owner, claim.role, claim.state],
		txId: client.newTransactionID(),
	};

	// Setup EventHub
	if (eventUrl) {

		console.log('listening to event url', eventUrl);
		eventhub = client.newEventHub();
		eventhub.setPeerAddr(eventUrl, {
			pem: tls_cert.pem,
			'ssl-target-name-override': null,		//can be null if cert matches hostname
			'grpc.http2.keepalive_time': 15
		});
		eventhub.connect();

	} else {
		console.log(' will not use tx event');
	}

	// Send Proposal
	channel.sendTransactionProposal(request).then(function (results) {

		// Check Response
		var request = check_res(results);
		return channel.sendTransaction(request);
	}).then(function (response) {
		// All good
		console.log(response);
		if (response.status === 'SUCCESS') {
			console.log(' Successfully endorsed.');

			setTimeout(function () {
				res.json({
					status: 200,
					message: 'ok'
				});
				eventhub.disconnect();
			}, 500);
		}

		// No good
		else {
			console.log('Failed to order.');
			res.status(500).send({
				status: 500,
				message: 'BlockChain error updating block'
			});
			throw response;
		}
	}).catch(
		function (err) {
			console.log(' Error in instantiate catch block', typeof err, err);
			var formatted = format_error_msg(err);

			res.status(500).send({
				status: 500,
				message: 'instantiate Error'
			});
		});

});

// Update the owner of the claim payment in the block e.g., policy holder, bank, or repair facility
router.post('/:customer', ensureAuthenticated, function (req, res, next) {
	var owner = req.body.owner;
	var role = req.body.role;
	var state = req.body.state;
	var customer = req.params.customer;

	var channel_id = helper.getChannelId();
	var chaincode_id = helper.getChaincodeId();
	var startTime = Date.now();

	// send proposal to endorser
	var request = {
		chainId: channel_id,
		chaincodeId: chaincode_id,
		fcn: "set_owner",
		args: [customer, owner, role, state],
		txId: client.newTransactionID(),
	};
	// Setup EventHub
	if (eventUrl) {

		logger.debug('listening to event url', eventUrl);
		eventhub = client.newEventHub();
		eventhub.setPeerAddr(eventUrl, {
			pem: tls_cert.pem,
			'ssl-target-name-override': null,		//can be null if cert matches hostname
			'grpc.http2.keepalive_time': 15
		});
		eventhub.connect();
	} else {
		logger.debug(' will not use tx event');
	}

	// Send Proposal
	channel.sendTransactionProposal(request).then(function (results) {

		// Check Response
		var request = check_res(results);
		return channel.sendTransaction(request);
	}).then(function (response) {
		// All good
		if (response.status === 'SUCCESS') {
			console.log(' Successfully endorsed.');

			setTimeout(function () {
				res.json({
					status: 200,
					message: 'ok'
				});
				eventhub.disconnect();
			}, 500);
		}

		// No good
		else {
			console.log('Failed to order.');
			res.status(500).send({
				status: 500,
				message: 'BlockChain error updating block'
			});
			throw response;
		}
	}).catch(
		function (err) {
			console.log(' Error in instantiate catch block', typeof err, err);
			var formatted = format_error_msg(err);

			res.status(500).send({
				status: 500,
				message: 'instantiate Error'
			});
		});
});


// Get the block for the claim payment
router.get('/:customer', ensureAuthenticated, function (req, res, next) {
	var customer = req.params.customer;
	var channel = client.getChannel(helper.getChannelId());

	// send proposal to peer
	var request = {
		chainId: channel_id,
		chaincodeId: chaincode_id,
		fcn: "read",
		args: [customer],
		txId: null,
	};

	channel.queryByChaincode(request
		//nothing
	).then(
		function (response_payloads) {
			var formatted = format_query_resp(response_payloads);

			// --- response looks bad -- //
			if (formatted.parsed == null) {
				logger.debug('Query response is empty', formatted.raw);
				res.json({});
			}

			// --- response looks good --- //
			else {
				logger.debug('Successful query transaction.'); //, formatted.parsed);
				res.json({
					status: 200,
					message: 'ok',
					claim: formatted.parsed
				});
			}

		}
		).catch(
		function (err) {
			logger.error('Error in query catch block', typeof err, err);
			res.json({});
		}
		);

});

// Delete this claim payment
router.delete('/:customer', ensureAuthenticated, function (req, res) {
	var customer = req.params.customer;
	var eventhub;
	var channel_id = helper.getChannelId();
	var chaincode_id = helper.getChaincodeId();
	var startTime = Date.now();

	// send proposal to endorser
	var request = {
		chainId: channel_id,
		chaincodeId: chaincode_id,
		fcn: "delete",
		args: [customer],
		txId: client.newTransactionID(),
	};

	// Setup EventHub
	if (eventUrl) {

		console.log('listening to event url', eventUrl);
		eventhub = client.newEventHub();
		eventhub.setPeerAddr(eventUrl, {
			pem: tls_cert.pem,
			'ssl-target-name-override': null,		//can be null if cert matches hostname
			'grpc.http2.keepalive_time': 15
		});
		eventhub.connect();

	} else {
		console.log(' will not use tx event');
	}

	// Send Proposal
	channel.sendTransactionProposal(request).then(function (results) {

		// Check Response
		var request = check_res(results);
		return channel.sendTransaction(request);
	}).then(function (response) {
		// All good
		console.log(response);
		if (response.status === 'SUCCESS') {
			console.log(' Successfully endorsed.');

			setTimeout(function () {
				res.json({
					status: 200,
					message: 'ok'
				});
				eventhub.disconnect();
			}, 500);
		}

		// No good
		else {
			console.log('Failed to order.');
			res.status(500).send({
				status: 500,
				message: 'BlockChain error updating block'
			});
			throw response;
		}
	}).catch(
		function (err) {
			console.log(' Error in instantiate catch block', typeof err, err);
			var formatted = format_error_msg(err);

			res.status(500).send({
				status: 500,
				message: 'instantiate Error'
			});
		});



});

module.exports = router;