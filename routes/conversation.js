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
var LanguageTranslatorV2 = require('watson-developer-cloud/language-translator/v2');
var googleApiKey = '************************************';
var googleTranslate = require('google-translate')(googleApiKey);
var https = require('https');
var async = require('async');

var serviceRegexConversation = /(conversation).*/;

var optionsConversation = optional('./conversation-credentials.json') || {
  appEnv: appEnv
};

// parse vcap using cfenv if available
if (optionsConversation.appEnv && !optionsConversation.credentials) {
  optionsConversation.credentials = cfEnvUtil.getServiceCredsByLabel(optionsConversation.appEnv, serviceRegexConversation);
}
// try again with name
else if (optionsConversation.appEnv && !optionsConversation.credentials) {
  optionsConversation.credentials = optionsConversation.appEnv.getServiceCreds(serviceRegexConversation);
}

var conversation = new ConversationV1({
  username: optionsConversation.credentials.username,
  password: optionsConversation.credentials.password,
  version_date: '2017-02-03'
});


var serviceRegexTranslator = /(language_translator).*/;

var optionsTranslator = optional('./translation-credentials.json') || {
  appEnv: appEnv
};

// parse vcap using cfenv if available
if (optionsTranslator.appEnv && !optionsTranslator.credentials) {
  optionsTranslator.credentials = cfEnvUtil.getServiceCredsByLabel(optionsTranslator.appEnv, serviceRegexTranslator);
}
// try again with name
else if (optionsTranslator.appEnv && !optionsTranslator.credentials) {
  optionsTranslator.credentials = optionsTranslator.appEnv.getServiceCreds(serviceRegexTranslator);
}

var language_translator = new LanguageTranslatorV2({
  username: optionsTranslator.credentials.username,
  password: optionsTranslator.credentials.password,
  url: optionsTranslator.credentials.url
});




function ensureAuthenticated(req, res, next) {
  if (!req.isAuthenticated() && process.env.NODE_ENV == 'production') {
    req.session.originalUrl = req.originalUrl;
    res.redirect('/login');
  } else {
    return next();
  }
}

function translateInput(input, source, target, model, callback) {

  if (!input) {
    callback(null, input);
    return;
  }

  var params = {
    text: input.text
  };


  // If a trained model is supplied use it instead of the news or conversation models
  if (model) {
    params.model_id = model
  } else {
    params.source = source;
    params.target = target;
  }
  
  if (source === 'he') {
	  googleTranslate.translate(params.text, 'en', function(err, translation) {
		  if (err) {
		      callback(err, null);
		  } else {
			  input.text = translation.translatedText;
			  callback(null, input);
		  }
	  });
  }
  else {
	  language_translator.translate(params, function (err, data) {
	    if (err) {
	      callback(err, null);
	    } else {
	      input.text = data.translations[0].translation;
	      callback(null, input);
	    }
	  });
  }
}

function translateOutput(conversationResponse, source, target, model, callback) {

  var params = {
    text: conversationResponse.output.text
  };

  // If a trained model is supplied use it instead of the news or conversation models
  if (model) {
    params.model_id = model
  } else {
    params.source = source;
    params.target = target;
  }

  if (target === 'he') {
	  //translate Watson response from source language (English) to Hebrew
	  googleTranslate.translate(params.text, 'he', function(err, translation) {
		  if (err) {
			  callback(err, null);
		  } else {
			  conversationResponse.output.text = translation.translatedText;
			  callback(null, conversationResponse);
		  }
	  });
  }
  else {

	  language_translator.translate(params, function (err, data) {
		  if (err) {
			  callback(err, null);
		  } else {
			  conversationResponse.output.text = data.translations[0].translation;
			  callback(null, conversationResponse);
		  }
	  });
  }
}

router.post('/', ensureAuthenticated, function (req, res) {

  var workspace = process.env.WORKSPACE_ENGLISH;
  var model_in = null;
  var model_out = null;

  // Use a normalized English conversation
  if (process.env.NORMALIZED_CONVERSATION === 'true') {
    // see if there are any translation domain models defined that should be used
    if (req.body.language === 'fr' && process.env.MODEL_ENGLISH_TO_FRENCH && process.env.MODEL_FRENCH_TO_ENGLISH) {
      model_in = process.env.MODEL_FRENCH_TO_ENGLISH;
      model_out = process.env.MODEL_ENGLISH_TO_FRENCH;
    }
    else if (req.body.language === 'es' && process.env.MODEL_ENGLISH_TO_SPANISH && process.env.MODEL_SPANISH_TO_ENGLISH) {
      model_in = process.env.MODEL_SPANISH_TO_ENGLISH;
      model_out = process.env.MODEL_ENGLISH_TO_SPANISH;
    }
    else if (req.body.language === 'ja' && process.env.MODEL_ENGLISH_TO_JAPANESE && process.env.MODEL_JAPANESE_TO_ENGLISH) {
      model_in = process.env.MODEL_JAPANESE_TO_ENGLISH;
      model_out = process.env.MODEL_ENGLISH_TO_JAPANESE;
    }
    // We cuurently don't support normalized model for Chinese so use the native bots
    else if (req.body.language === 'zh-TW' || req.body.language === 'zh-HK') {
      workspace = process.env.WORKSPACE_TRADITIONAL_CHINESE;
    }
    else if (req.body.language === 'zh-CN' || req.body.language === 'zh-SG') {
      workspace = process.env.WORKSPACE_SIMPLIFIED_CHINESE;
    }
    else if (req.body.language === 'ar') {
        model_in = process.env.MODEL_ARABIC_TO_ENGLISH;
        model_out = process.env.MODEL_ENGLISH_TO_ARABIC;
    }    
  }
  // Use native language conversations
  else if (process.env.NORMALIZED_CONVERSATION === 'false') {
    if (req.body.language === 'fr') {
      workspace = process.env.WORKSPACE_FRENCH;
    } else if (req.body.language === 'es') {
      workspace = process.env.WORKSPACE_SPANISH;
    } else if (req.body.language === 'ja') {
      workspace = process.env.WORKSPACE_JAPANESE;
    } else if (req.body.language === 'zh-TW' || req.body.language === 'zh-HK') {
      workspace = process.env.WORKSPACE_TRADITIONAL_CHINESE;
    }
      else if (req.body.language === 'zh-CN' || req.body.language === 'zh-SG') {
      workspace = process.env.WORKSPACE_SIMPLIFIED_CHINESE;
    }
      else if (req.body.language === 'ar') {
      workspace = process.env.WORKSPACE_ARABIC;
      }
  }

  async.waterfall([
      function (callback) {
        // Translate the user input text into English
        if (process.env.NORMALIZED_CONVERSATION === 'true' && req.body.language != 'en') {
          translateInput(req.body.input, req.body.language, 'en', model_in, callback);
        }
        // don't translate the user input text
        else {
          callback(null, req.body.input);
        }
      },
      function (inputText, callback) {
        // Call Watson Conversation
        conversation.message({
          input: inputText,
          context: req.body.context,
          workspace_id: workspace
        }, function (err, response) {
          if (err) {
            callback(err, null);
          } else {
            callback(null, response);
          }
        });
      },
      function (response, callback) {
        // Translate the conversation response from English
        if (process.env.NORMALIZED_CONVERSATION === 'true' && req.body.language != 'en') {
          translateOutput(response, 'en', req.body.language, model_out, callback);
        }
        // don't translate the conversation response  
        else {
          callback(null, response);
        }
      }
    ],
    function (error, results) {
      // Return the result
      if (error) {
        res.send(error);
      } else {
        res.json(results);
      }
    }
  ); // end async waterfall
});

module.exports = router;