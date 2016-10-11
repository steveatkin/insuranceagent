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
var ConversationV1 = require('watson-developer-cloud/conversation/v1');

var serviceRegex = /(conversation).*/;

var options = optional('./conversation-credentials.json') || {
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

var conversation = new ConversationV1({
  username: options.credentials.username,
  password: options.credentials.password,
  version_date: '2016-07-01'
});

function ensureAuthenticated(req, res, next) {
  if (!req.isAuthenticated() && process.env.NODE_ENV == 'production') {
    req.session.originalUrl = req.originalUrl;
    res.redirect('/login');
  } else {
    return next();
  }
}

router.post('/', ensureAuthenticated, function (req, res) {

  var workspace = process.env.WORKSPACE_ENGLISH;

  if (req.body.language == 'fr') {
    workspace = process.env.WORKSPACE_FRENCH;
  } else if (req.body.language == 'es') {
    workspace = process.env.WORKSPACE_SPANISH;
  }

  conversation.message({
    input: req.body.input,
    context: req.body.context,
    workspace_id: workspace
  }, function (err, response) {
    if (err) {
      res.send(err);
    } else {
      res.json(response);
    }
  });

});

module.exports = router;