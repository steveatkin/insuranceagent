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
var request = require('request');

function ensureAuthenticated(req, res, next) {
  if (!req.isAuthenticated()) {
    req.session.originalUrl = req.originalUrl;
    res.redirect('/login');
  } else {
    return next();
  }
}


router.get('/', ensureAuthenticated, function(req, res, next) {
  
  var params = {
    url: process.env.POLICY_API,
    qs: { 
      customer: req.query.customer,
      language: req.query.language,
      client_id: process.env.API_KEY
    },
    method: 'GET',
    timeout: 4000
  };


  request(params, function(error, response, body) {
        if(!error && response.statusCode == 200) {
            var result = JSON.parse(body);
            res.json(result);
        } 
        else {
            console.log('Unable to get policy: ' + JSON.stringify(error));
            res.status(401).send('Unable to get policy.');
        }
    });

});

module.exports = router;
