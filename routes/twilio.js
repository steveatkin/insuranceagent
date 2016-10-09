var express = require('express');
var router = express.Router();
var optional = require('optional');
var appEnv = require('cfenv').getAppEnv();
var cfEnvUtil = require('./cfenv-credsbylabel');
var twilio = require('twilio');

router.post('/:customer', function(req, res){
    var owner = req.body.owner;
	var role = req.body.role;
	var state = req.body.state;
    var phone = req.state.phone;
	var customer = req.params.customer;

    var serviceRegex = /(user-provided).*/;

    var options = optional('./twilio-credentials.json') || {appEnv: appEnv};

    // parse vcap using cfenv if available
    if(options.appEnv && !options.credentials) {
        options.credentials = cfEnvUtil.getServiceCredsByLabel(options.appEnv, serviceRegex);
    }
    // try again with name
    else if(options.appEnv && !options.credentials) {
        options.credentials = options.appEnv.getServiceCreds(serviceRegex);
    }

    var client = new twilio.RestClient(options.credentials.accountSID, options.credentials.authToken);

    client.messages.create({
        body: 'Claim: ' + customer + ' State: ' + state,
        to: phone,  // Text this number
        from: '+13057833210' // From a valid Twilio number
    }, function(err, message) {
        if(err) {
            res.status(500).send({status:500, message: 'SMS was not able to be sent'});
        }
        else {
            console.log(message.sid);
            res.json({status: 200, message: message.sid});
        }
    });

});



module.exports = router;