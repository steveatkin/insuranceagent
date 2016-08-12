var express = require('express');
var router = express.Router();
var Client = require('node-rest-client').Client;
var optional = require('optional');
var appEnv = require('cfenv').getAppEnv();

router.get('/', function(req, res, next) {
    var client = new Client();
    //var lat = req.query.lat;
    //var lon = req.query.lon;

    var serviceRegex = /(weatherinsights).*/;

    var options = optional('./weather-credentials.json') || {appEnv: appEnv};

    if(options.appEnv && !options.credentials) {
        options.credentials = options.appEnv.getServiceCreds(serviceRegex);
    }

    res.json(options.credentials);
    /*
    var args = {
        parameters: { customer: req.query.lat,
                  language: req.query.language,
                  client_id: process.env.API_KEY
        },
        requestConfig: { timeout: 4000},
        responseConfig: { timeout: 4000}
    };
    */
});


module.exports = router;