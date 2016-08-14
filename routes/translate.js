var express = require('express');
var router = express.Router();
var optional = require('optional');
var appEnv = require('cfenv').getAppEnv();
var cfEnvUtil = require('./cfenv-credsbylabel');
var LanguageTranslatorV2 = require('watson-developer-cloud/language-translator/v2');

router.get('/', function(req, res){

    var serviceRegex = /(language_translation).*/;

    var options = optional('./translation-credentials.json') || {appEnv: appEnv};

    // parse vcap using cfenv if available
    if(options.appEnv && !options.credentials) {
        options.credentials = cfEnvUtil.getServiceCredsByLabel(options.appEnv, serviceRegex);
    }
    // try again with name
    else if(options.appEnv && !options.credentials) {
        options.credentials = options.appEnv.getServiceCreds(serviceRegex);
    }

  var language_translator = new LanguageTranslatorV2({
    username: options.credentials.username,
    password: options.credentials.password
  });

  
  language_translator.translate({
    text: req.query.text, source : 'en', target: req.query.language },
    function (err, data) {
      if (err) {
        res.send(err);
      }
      else {
        res.send(data.translations[0].translation);
      }
  });

});

module.exports = router;
