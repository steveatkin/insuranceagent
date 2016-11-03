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
var LanguageTranslatorV2 = require('watson-developer-cloud/language-translator/v2');

var serviceRegex = /(language_translator).*/;

var options = optional('./translation-credentials.json') || {
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

var language_translator = new LanguageTranslatorV2({
  username: options.credentials.username,
  password: options.credentials.password
});

function ensureAuthenticated(req, res, next) {
  if (!req.isAuthenticated() && process.env.NODE_ENV == 'production') {
    req.session.originalUrl = req.originalUrl;
    res.redirect('/login');
  } else {
    return next();
  }
}

router.get('/', ensureAuthenticated, function (req, res) {

  language_translator.translate({
      text: req.query.text,
      source: 'en',
      target: req.query.language
    },
    function (err, data) {
      if (err) {
        res.send(err);
      } else {
        res.send(data.translations[0].translation);
      }
    });

});

module.exports = router;