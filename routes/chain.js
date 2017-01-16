var hfc = require('hfc');
var util = require('util');
var fs = require('fs');
var path = require("path");
var async = require('async');
const https = require('https');
var optional = require('optional');
var express = require('express');
var router = express.Router();


var chain;
var network;
var certPath;
var peers;
var users;
var ca;
var networkCertPath;
var userObj;
var newUserName;
var chaincodeID;
var certFile = 'us.blockchain.ibm.com.cert';
var options = optional('./chain-credentials.json');

var winston = require('winston');
var logger = new(winston.Logger)({
    transports: [
        new(winston.transports.Console)()
    ]
});

var caUrl;
var peerUrls = [];
var EventUrls = [];

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

function fileExists(filePath) {
    try {
        return fs.statSync(filePath).isFile();
    } catch (err) {
        return false;
    }
}

function init() {
    if (process.env.VCAP_SERVICES) {
        var servicesObject = JSON.parse(process.env.VCAP_SERVICES);
        for (var i in servicesObject) {
            if (i.indexOf('ibm-blockchain') >= 0) {
                if (servicesObject[i][0].credentials.error) {
                    console.log('!\n!\n! Error from Bluemix: \n', servicesObject[i][0].credentials.error, '!\n!\n');
                    peers = null;
                    users = null;
                    ca = null;
                    networkCertPath = null;
                }
                if (servicesObject[i][0].credentials && servicesObject[i][0].credentials.peers) {
                    console.log('overwritting peers, loading from a vcap service: ', i);
                    peers = servicesObject[i][0].credentials.peers;

                    if (servicesObject[i][0].credentials.users) {
                        console.log('overwritting users, loading from a vcap service: ', i);
                        users = servicesObject[i][0].credentials.users;

                        if (servicesObject[i][0].credentials.ca) {
                            console.log('overwritting ca, loading from a vcap service: ', i);
                            ca = servicesObject[i][0].credentials.ca;

                            console.log('overwritting network cert path, loading from a vcap service: ', i);
                            if (servicesObject[i][0].credentials.cert_path) {
                                networkCertPath = servicesObject[i][0].credentials.cert_path;
                            }
                        }
                    }
                    break;
                }
            }
        }
    } else if (options.credentials) {
        peers = options.credentials.peers;
        users = options.credentials.users;
        ca = options.credentials.ca;
        networkCertPath = options.credentials.cert_path;
    }

    // Create a client blockchin.
    chain = hfc.newChain('insurance');

    chain.setInvokeWaitTime("30");

    //path to copy the certificate
    certPath = path.join(__dirname, '../src/chaincode', 'certificate.pem');

    setup();

    printNetworkDetails();
    //Check if chaincode is already deployed
    //TODO: Deploy failures aswell returns chaincodeID, How to address such issue?
    if (process.env.CHAIN_NAME) {
        chaincodeID = process.env.CHAIN_NAME;
        chain.getUser(newUserName, function (err, user) {
            if (err) throw Error(" Failed to register and enroll " + newUserName + ": " + err);
            userObj = user;
        });
    } else {
        enrollAndRegisterUsers();
    }

    // print out the stats of the chaincode
    if (process.env.NODE_ENV == 'development') {
        //chainStats();
    }
}

function setup() {
    // Determining if we are running on a startup or HSBN network based on the url
    // of the discovery host name.  The HSBN will contain the string zone.
    var isHSBN = peers[0].discovery_host.indexOf('secure') >= 0 ? true : false;
    var network_id = Object.keys(ca);
    caUrl = "grpcs://" + ca[network_id].discovery_host + ":" + ca[network_id].discovery_port;

    // Configure the KeyValStore which is used to store sensitive keys.
    // This data needs to be located or accessible any time the users enrollmentID
    // perform any functions on the blockchain.  The users are not usable without
    // This data.
    var uuid = network_id[0].substring(0, 8);

    chain.setKeyValStore(hfc.newFileKeyValStore(path.join(__dirname, '../', 'keyValStore-' + uuid)));

    if (isHSBN) {
        certFile = '0.secure.blockchain.ibm.com.cert';
    }
    fs.createReadStream(certFile).pipe(fs.createWriteStream(certPath));
    var cert = fs.readFileSync(certFile);

    chain.setMemberServicesUrl(caUrl, {
        pem: cert
    });

    peerUrls = [];
    eventUrls = [];
    // Adding all the peers to blockchain
    // this adds high availability for the client
    for (var i = 0; i < peers.length; i++) {
        // Peers on Bluemix require secured connections, hence 'grpcs://'
        peerUrls.push("grpcs://" + peers[i].discovery_host + ":" + peers[i].discovery_port);
        chain.addPeer(peerUrls[i], {
            pem: cert
        });
        eventUrls.push("grpcs://" + peers[i].event_host + ":" + peers[i].event_port);
        chain.eventHubConnect(eventUrls[0], {
            pem: cert
        });
    }
    newUserName = "InsuranceAdmin";
    // Make sure disconnect the eventhub on exit
    process.on('exit', function () {
        chain.eventHubDisconnect();
    });
}

function printNetworkDetails() {
    console.log("\n------------- ca-server, peers and event URL:PORT information: -------------");
    console.log("\nCA server Url : %s\n", caUrl);
    for (var i = 0; i < peerUrls.length; i++) {
        console.log("Validating Peer%d : %s", i, peerUrls[i]);
    }
    console.log("");
    for (var i = 0; i < eventUrls.length; i++) {
        console.log("Event Url on Peer%d : %s", i, eventUrls[i]);
    }
    console.log("");
    console.log('-----------------------------------------------------------\n');
}

function enrollAndRegisterUsers() {

    // Enroll a 'admin' who is already registered because it is
    // listed in fabric/membersrvc/membersrvc.yaml with it's one time password.
    chain.enroll(users[0].enrollId, users[0].enrollSecret, function (err, admin) {
        if (err) throw Error("\nERROR: failed to enroll admin : " + err);

        console.log("\nEnrolled admin sucecssfully");

        // Set this user as the chain's registrar which is authorized to register other users.
        chain.setRegistrar(admin);

        //creating a new user
        var registrationRequest = {
            enrollmentID: newUserName,
            affiliation: "group1"
        };
        chain.registerAndEnroll(registrationRequest, function (err, user) {
            if (err) throw Error(" Failed to register and enroll " + newUserName + ": " + err);

            console.log("\nEnrolled and registered " + newUserName + " successfully");
            userObj = user;
            //setting timers for fabric waits
            chain.setDeployWaitTime("120");
            console.log("\nDeploying chaincode ...");
            deployChaincode();
        });
    });
}

function deployChaincode() {

    // Construct the deploy request
    var deployRequest = {
        // Function to trigger
        fcn: "init",
        // Arguments to the initializing function
        args: ["99"],
        chaincodePath: "chaincode",
        // the location where the startup and HSBN store the certificates
        certificatePath: networkCertPath
    };

    // Trigger the deploy transaction
    var deployTx = userObj.deploy(deployRequest);

    // Print the deploy results
    deployTx.on('complete', function (results) {
        // Deploy request completed successfully
        chaincodeID = results.chaincodeID;
        console.log("\nChaincode ID : " + chaincodeID);
        console.log(util.format("\nSuccessfully deployed chaincode: request=%j, response=%j", deployRequest, results));
    });

    deployTx.on('error', function (err) {
        // Deploy request failed
        console.log(util.format("\nFailed to deploy chaincode: request=%j, error=%j", deployRequest, err));
        process.exit(1);
    });
}


function chainStats() {
    var options = {
        host: peers[0].api_host,
        port: peers[0].api_port,
        path: '/chain',
        method: 'GET'
    };

    console.log('Requesting chain stats from:', options.host + ':' + options.port);

    var request = https.request(options, function (resp) {
        var str = '',
            chunks = 0;

        resp.setEncoding('utf8');
        resp.on('data', function (chunk) { //merge chunks of request
            str += chunk;
            chunks++;
        });

        resp.on('end', function () { //wait for end before decision
            if (resp.statusCode == 204 || resp.statusCode >= 200 && resp.statusCode <= 399) {
                str = JSON.parse(str);
                console.log('Chainstats API returned:', str);
                cb_chainstats(null, str);
            } else {
                console.error('status code: ' + resp.statusCode, ', headers:', resp.headers, ', message:', str);
            }
        });
    });

    request.on('error', function (e) { //handle error event
        console.error('status code: ', 500, ', message:', e);
    });

    request.setTimeout(20000);
    request.on('timeout', function () { //handle time out event
        console.error('status code: ', 408, ', message: Request timed out');
    });

    request.end();
}

//call back for getting the blockchain stats, lets get the block height now
function cb_chainstats(e, stats) {
    var chain_stats = stats;
    if (stats && stats.height) {
        var list = [];
        for (var i = stats.height - 1; i >= 1; i--) { //create a list of heights we need
            list.push(i);
            if (list.length >= 8) break;
        }

        list.reverse();
        async.eachLimit(list, 1, function (key, cb) { //iter through each one, and send it
            //get chainstats through REST API
            var options = {
                host: peers[0].api_host,
                port: peers[0].api_port,
                path: '/chain/blocks/' + key,
                method: 'GET'
            };

            function success(statusCode, headers, stats) {
                stats = JSON.parse(stats);
                stats.height = key;
                console.log({
                    msg: 'chainstats',
                    e: e,
                    chainstats: JSON.stringify(chain_stats),
                    blockstats: JSON.stringify(stats)
                });
                cb(null);
            }

            function failure(statusCode, headers, msg) {
                console.log('chainstats block ' + key);
                console.log('status code: ' + statusCode);
                console.log('headers: ' + headers);
                console.log('message: ' + msg);
                cb(null);
            }

            var request = https.request(options, function (resp) {
                var str = '',
                    chunks = 0;
                resp.setEncoding('utf8');
                resp.on('data', function (chunk) { //merge chunks of request
                    str += chunk;
                    chunks++;
                });
                resp.on('end', function () {
                    if (resp.statusCode == 204 || resp.statusCode >= 200 && resp.statusCode <= 399) {
                        success(resp.statusCode, resp.headers, str);
                    } else {
                        failure(resp.statusCode, resp.headers, str);
                    }
                });
            });

            request.on('error', function (e) { //handle error event
                failure(500, null, e);
            });

            request.setTimeout(20000);
            request.on('timeout', function () { //handle time out event
                failure(408, null, 'Request timed out');
            });

            request.end();
        }, function () {});
    }
}



// Create a new block for this claim payment
router.post('/', ensureAuthenticated, function (req, res) {
    var claim = req.body;

    // Construct the invoke request
    var invokeRequest = {
        // Name (hash) required for query
        chaincodeID: chaincodeID,
        // Function to trigger
        fcn: "init_claim_payment",
        // Existing state variables to write
        args: [claim.id, claim.value, claim.vehicle, claim.owner, claim.role, claim.state]
    };
    try {
        // Trigger the invocation transaction
        var invokeTx = userObj.invoke(invokeRequest);

        // Print the invoke results
        invokeTx.on('submitted', function (results) {
            // Invoke transaction submitted successfully
            console.log(util.format("\nSuccessfully submitted chaincode invoke transaction: request=%j, response=%j", invokeRequest, results));
        });
        // Print the invoke results
        invokeTx.on('complete', function (results) {
            // Invoke completed successfully
            console.log(util.format("\nSuccessfully completed chaincode invoke transaction: request=%j, response=%j", invokeRequest, results));
            res.json({
                status: 200,
                message: 'ok'
            });
        });
        invokeTx.on('error', function (err) {
            // Invoke failed
            console.log(util.format("\nFailed to submit chaincode invoke transaction: request=%j, error=%j", invokeRequest, err));
            res.status(500).send({
                status: 500,
                message: 'BlockChain error creating block'
            });
        });
    } catch (err) {
        console.log(err);
        res.status(500).send({
            status: 500,
            message: 'BlockChain error creating block'
        });
    }
});

// Update the owner of the claim payment in the block e.g., policy holder, bank, or repair facility
router.post('/:customer', ensureAuthenticated, function (req, res, next) {
    var owner = req.body.owner;
    var role = req.body.role;
    var state = req.body.state;
    var customer = req.params.customer;

    // Construct the invoke request
    var invokeRequest = {
        // Name (hash) required for query
        chaincodeID: chaincodeID,
        // Function to trigger
        fcn: "set_owner",
        // Existing state variables to write
        args: [customer, owner, role, state]
    };

    try {
        // Trigger the invoke transaction
        var invokeTx = userObj.invoke(invokeRequest);

        invokeTx.on('submitted', function (results) {
            // Invoke transaction submitted successfully
            console.log(util.format("\nSuccessfully submitted chaincode invoke transaction: request=%j, response=%j", invokeRequest, results));
        });
        // Print the query results
        invokeTx.on('complete', function (results) {
            // Invoke completed successfully
            console.log(util.format("\nSuccessfully completed chaincode invoke transaction: request=%j, response=%j", invokeRequest, results));
            res.json({
                status: 200,
                message: 'ok'
            });
        });
        invokeTx.on('error', function (err) {
            // Invoke failed
            console.log(util.format("\nFailed to submit chaincode invoke transaction: request=%j, error=%j", invokeRequest, err));
            res.status(500).send({
                status: 500,
                message: 'BlockChain error updating block'
            });
        });
    } catch (err) {
        console.log(err);
        res.status(500).send({
            status: 500,
            message: 'BlockChain error updating block'
        });
    }
});

// Get the block for the claim payment
router.get('/:customer', ensureAuthenticated, function (req, res, next) {
    var customer = req.params.customer;

    // Construct the query request
    var queryRequest = {
        // Name (hash) required for query
        chaincodeID: chaincodeID,
        // Function to trigger
        fcn: "read",
        // Existing state variable to retrieve
        args: [customer]
    };

    // Trigger the query transaction
    var queryTx = userObj.query(queryRequest);

    // Print the query results
    queryTx.on('complete', function (results) {
        // Query completed successfully
        console.log(util.format("\nSuccessfully queried chaincode function: request=%j, value=%s", queryRequest, results.result.toString()));

        if (results.result.toString() !== "") {
            var claim = JSON.parse(results.result.toString());
            res.json({
                status: 200,
                message: 'ok',
                claim: claim
            });
        } else {
            res.json({});
        }
    });
    queryTx.on('error', function (err) {
        // Query failed
        console.log(util.format("\nFailed to query chaincode, function: request=%j, error=%j", queryRequest, err));
        res.json({});
    });
});


// Delete this claim payment
router.delete('/:customer', ensureAuthenticated, function (req, res) {
    var customer = req.params.customer;

    // Construct the invoke request
    var invokeRequest = {
        // Name (hash) required for query
        chaincodeID: chaincodeID,
        // Function to trigger
        fcn: "delete",
        // Existing state variable to delete
        args: [customer]
    };

    // Trigger the invoke transaction
    var invokeTx = userObj.invoke(invokeRequest);

    invokeTx.on('submitted', function (results) {
        // Invoke transaction submitted successfully
        console.log(util.format("\nSuccessfully submitted chaincode invoke transaction: request=%j, response=%j", invokeRequest, results));
    });
    // Print the invoke results
    invokeTx.on('complete', function (results) {
        // Invoke completed successfully
        console.log(util.format("\nSuccessfully completed chaincode invoke transaction: request=%j, response=%j", invokeRequest, results));
        res.json({
            status: 200,
            message: 'ok'
        });
    });
    invokeTx.on('error', function (err) {
        // Invoke failed
        console.log(util.format("\nFailed to submit chaincode invoke transaction: request=%j, error=%j", invokeRequest, err));
        res.status(500).send({
            status: 500,
            message: 'BlockChain error creating block'
        });
    });
});


module.exports = router;