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
var appEnv = require('cfenv').getAppEnv();
var cfEnvUtil = require('./cfenv-credsbylabel');
var request = require('request');

var serviceRegex = /(weatherinsights).*/;

var options = optional('./weather-credentials.json') || {
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

function ensureAuthenticated(req, res, next) {
  if (!req.isAuthenticated()) {
    req.session.originalUrl = req.originalUrl;
    res.redirect('/login');
  } else {
    return next();
  }
}

router.get('/', ensureAuthenticated, function (req, res, next) {
    var language = req.query.language || 'en-US';
    var lat = req.query.lat;
    var lon = req.query.lon;

    var url = options.credentials.url + '/api/weather/v1/geocode/' +
        lat + '/' + lon + '/alerts.json?language=' + language;

    var params = {
        url: url
    };

    request(params, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            var result = JSON.parse(body);
            res.json(result);
        } else if (!error && response.statusCode == 400) {
            res.json([]);
        } else {
            res.status(401).send('Unable to get alerts.');
        }
    });

});


module.exports = router;