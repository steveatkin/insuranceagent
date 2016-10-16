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
var TextToSpeechV1 = require('watson-developer-cloud/text-to-speech/v1');

var serviceRegex = /(text_to_speech).*/;

var options = optional('./text-to-speech-credentials.json') || {
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
  if (!req.isAuthenticated() && process.env.NODE_ENV == 'production') {
    req.session.originalUrl = req.originalUrl;
    res.redirect('/login');
  } else {
    return next();
  }
}

var textToSpeech = new TextToSpeechV1({
  username: options.credentials.username,
  password: options.credentials.password
});

router.get('/speak', ensureAuthenticated, function(req, res) {
  var userLocale = req.headers["accept-language"];
  var userLang = userLocale.substring(0, 2).toLowerCase();
  var voice = 'en-US_AllisonVoice';

  if(userLocale === 'en-UK') {
    voice = 'en-GB_KateVoice';
  }
  else if(userLang === 'fr') {
    voice = 'fr-FR_ReneeVoice';
  }
  else if(userLang === 'de') {
    voice = 'de-DE_BirgitVoice';
  }
  else if (userLocale === 'es-US') {
    voice = 'es-US_SofiaVoice';
  }
  else if(userLang === 'es') {
    voice = 'es-ES_LauraVoice';
  }
  else if(userLang === 'it') {
    voice = 'it-IT_FrancescaVoice';
  }
  else if(userLang === 'ja') {
    voice = 'ja-JP_EmiVoice';
  }
  else if(userLocale === 'pt-BR') {
    voice = 'pt-BR_IsabelaVoice';
  }

  var params = {
    text: req.query.text,
    voice: voice,
    accept: 'audio/wav'
  };

  var transcript = textToSpeech.synthesize(params).pipe(res);

  transcript.on('error', function(error) {
    next(error);
  });

});


module.exports = router;