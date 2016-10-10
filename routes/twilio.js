var express = require('express');
var router = express.Router();
var optional = require('optional');
var appEnv = require('cfenv').getAppEnv();
var cfEnvUtil = require('./cfenv-credsbylabel');
var twilio = require('twilio');
var gpClient = require('g11n-pipeline').getClient(
    optional('./g11n-credentials.json') ||
    {
        appEnv: appEnv
    }
);

router.post('/:customer', function (req, res) {
    var owner = req.body.owner;
    var role = req.body.role;
    var state = req.body.state;
    var phone = req.body.phone;
    var customer = req.params.customer;

    var serviceRegex = /(user-provided).*/;

    var options = optional('./twilio-credentials.json') || {
        appEnv: appEnv
    };

    // parse vcap using cfenv if available
    if (options.appEnv && !options.credentials) {
        options.credentials = cfEnvUtil.getServiceCredsByLabel(options.appEnv, serviceRegex);
    }
    // try again with name
    else if (options.appEnv && !options.credentials) {
        options.credentials = options.appEnv.getServiceCreds(serviceRegex);
    }

    var client = new twilio.RestClient(options.credentials.accountSID, options.credentials.authToken);


    var myResources = gpClient.bundle('agent');

    myResources.getStrings({
        languageId: req.body.language
    }, function (err, result) {
        var textMessage = null;

        if (err) {
            // Use a hardcoded message if we cannot get the bundle
            textMessage = 'Claim: ' + customer + ' State: ' + state;
        } else {
            var myStrings = result.resourceStrings;
            textMessage = myStrings.twilio.replace('{}', state);
        }
        // send the SMS message

        client.messages.create({
            body: textMessage,
            to: phone, // Text this number
            from: '+13057833210' // From a valid Twilio number
        }, function (err, message) {
            if (err) {
                res.status(500).send({
                    status: 500,
                    message: 'SMS was not able to be sent'
                });
            } else {
                console.log(message.sid);
                res.json({
                    status: 200,
                    message: message.sid
                });
            }
        });
    });


});



module.exports = router;