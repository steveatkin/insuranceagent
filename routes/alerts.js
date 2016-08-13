var express = require('express');
var router = express.Router();
var optional = require('optional');
var appEnv = require('cfenv').getAppEnv();
var cfEnvUtil = require('./cfenv-credsbylabel');
var request = require('request');

router.get('/', function(req, res, next) {
    var language = req.query.language || 'en-US';
    var lat = req.query.lat;
    var lon = req.query.lon;

    var serviceRegex = /(weatherinsights).*/;

    var options = optional('./weather-credentials.json') || {appEnv: appEnv};

    // parse vcap using cfenv if available
    if(options.appEnv && !options.credentials) {
        options.credentials = cfEnvUtil.getServiceCredsByLabel(options.appEnv, serviceRegex);
    }
    // try again with name
    else if(options.appEnv && !options.credentials) {
        options.credentials = options.appEnv.getServiceCreds(serviceRegex);
    }

    var url = options.credentials.url + '/api/weather/v1/geocode/'
                +lat+'/'+lon+'/alerts.json?language='+language;

    var params = {
        url: url
    };


    request(params, function(error, response, body) {
        if(!error && response.statusCode == 200) {
            var result = JSON.parse(body);
            res.json(result);
        } 
        else {
            res.status(401).send('Unable to get alerts.');
        }
    });

});


module.exports = router;