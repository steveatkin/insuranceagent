var express = require('express');
var router = express.Router();
var optional = require('optional');
var appEnv = require('cfenv').getAppEnv();
var cfEnvUtil = require('./cfenv-credsbylabel');
var Ibc1 = require('ibm-blockchain-js');
var ibc = new Ibc1();
var request = require('request');
var chaincode = null;

router.init = function() {
    var serviceRegex = /("ibm-blockchain-5-prod).*/;

    var options = optional('./chain-credentials.json') || {appEnv: appEnv};

    // parse vcap using cfenv if available
    if(options.appEnv && !options.credentials) {
        options.credentials = cfEnvUtil.getServiceCredsByLabel(options.appEnv, serviceRegex);
    }
    // try again with name
    else if(options.appEnv && !options.credentials) {
        options.credentials = options.appEnv.getServiceCreds(serviceRegex);
    }

    console.log(options);

    var peers = options.credentials.peers;
    var users = options.credentials.users;

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

    ibc.load(options, function(err, cc){
        if(err != null){
		    console.log('! looks like an error loading the chaincode or network, app will fail\n', err);
	    }
        else {
            chaincode = cc;
            if(cc.details.deployed_name === ""){            
                cc.deploy('init', ['99'],null, cb_deployed);
            }
            
            else{
                console.log('chaincode summary file indicates chaincode has been previously deployed');
            }
        }
    });
};


router.post('/', function(req, res) {
    var claim = req.body.claim;
    chaincode.invoke.init_claim_payment([claim.id, claim.value, claim.vehicle, claim.owner], 
        function(err, data) {
            console.log('claim response:', data, err);
    });
});

router.get('/', function(req, res, next) {
    var customer = req.query.customer;

    chaincode.query.read([customer], function(err, data) {
        if(!err) {
            var claim = JSON.parse(data);
            res.json(claim);
        }
    });
    
});

function cb_deployed(err){
    console.log('sdk has deployed code and waited');
    chaincode.query.read(['abc']);
}


module.exports = router;