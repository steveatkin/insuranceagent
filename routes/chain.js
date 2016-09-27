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
    var peers = null;
    var users = null;

    var options = optional('./chain-credentials.json');


    if(process.env.VCAP_SERVICES){  																	
	    var servicesObject = JSON.parse(process.env.VCAP_SERVICES);
	    for(var i in servicesObject){   
		    if(i.indexOf('ibm-blockchain') >= 0){													
			    if(servicesObject[i][0].credentials.error){
				    console.log('!\n!\n! Error from Bluemix: \n', servicesObject[i][0].credentials.error, '!\n!\n');
				    peers = null;
				    users = null;
			    }   
			    if(servicesObject[i][0].credentials && servicesObject[i][0].credentials.peers){		
				    console.log('overwritting peers, loading from a vcap service: ', i);
				    peers = servicesObject[i][0].credentials.peers;
				    if(servicesObject[i][0].credentials.users){										
					    console.log('overwritting users, loading from a vcap service: ', i);
					    users = servicesObject[i][0].credentials.users;
				    } 
				    else {
                        users = null;
                    }																
			        break;
			    }   
		    }
	    }
    }

    else if(options.credentials) {
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