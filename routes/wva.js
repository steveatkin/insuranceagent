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
 * @author Harpreet Kaur Chawla
 */


var express = require('express');
var router = express.Router();
var optional = require('optional');
var appEnv = require('cfenv').getAppEnv();
var cfEnvUtil = require('./cfenv-credsbylabel');
var async = require('async');
var LanguageTranslatorV2 = require('watson-developer-cloud/language-translator/v2');
const SDK = require('@watson-virtual-agent/client-sdk');
var chatID = null;

var serviceRegexConversation = /(wva).*/;
var serviceRegexTranslator = /(language_translator).*/;

var optionsTranslator = optional('./translation-credentials.json') || {
    appEnv: appEnv
};

var optionsWVA = optional('./wva-credentials.json') || {
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
    url: optionsTranslator.credentials.url,
    //headers: { 'X-Watson-Technology-Preview': '2017-07-01' }
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

    language_translator.translate(params, function (err, data) {
        if (err) {
            callback(err, null);
        } else {
            input.text = data.translations[0].translation;
            callback(null, input);
        }
    });
}

function translateOutput(conversationResponse, source, target, model, callback) {

    var params = {
        text: conversationResponse.message.text
    };

    // If a trained model is supplied use it instead of the news or conversation models
    if (model) {
        params.model_id = model
    } else {
        params.source = source;
        params.target = target;
    }

    language_translator.translate(params, function (err, data) {
        if (err) {
            callback(err, null);
        } else {
            conversationResponse.message.text = data.translations[0].translation;
            callback(null, conversationResponse);
        }
    });
}

function getResponse(response) {
    response.message.text.forEach(text => {
        console.log('Agent:', text);
    });
};

router.post('/', ensureAuthenticated, function (req, res) {

    var workspace = process.env.WVA_WORKSPACE_ENGLISH;
    var model_in = null;
    var model_out = null;

    const XIBMClientID = optionsWVA.credentials.XIBMClientID;
    const XIBMClientSecret = optionsWVA.credentials.XIBMClientSecret;
    const baseURL = optionsWVA.credentials.baseURL;


    if (!workspace || !XIBMClientID || !XIBMClientSecret) {
        console.log('Missing Watson Virtual Agent Credentials');
        process.exit();
    }

    // Use a normalized English conversation
    if (process.env.NORMALIZED_CONVERSATION === 'true' && process.env.USE_BOT === 'WVA') {
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
            //workspace = process.env.WORKSPACE_TRADITIONAL_CHINESE;
            workspace = process.env.WVA_WORKSPACE_ENGLISH;
        }
        else if (req.body.language === 'zh-CN' || req.body.language === 'zh-SG') {
            //workspace = process.env.WORKSPACE_SIMPLIFIED_CHINESE;
            workspace = process.env.WVA_WORKSPACE_ENGLISH;
        }
    }
    // Use native language conversations
    else if (process.env.NORMALIZED_CONVERSATION === 'false' && process.env.USE_BOT === 'WVA') {
        if (req.body.language === 'fr') {
            workspace = process.env.WVA_WORKSPACE_FRENCH;
        } else if (req.body.language === 'es') {
            workspace = process.env.WVA_WORKSPACE_SPANISH;
        }
    }

    SDK.configure({
        baseURL: baseURL,
        XIBMClientID: XIBMClientID,
        XIBMClientSecret: XIBMClientSecret
    });

    async.waterfall([

        function (callback) {
            // Translate the user input text into English
            if (process.env.NORMALIZED_CONVERSATION === 'true' && req.body.language != 'en' && process.env.USE_BOT === 'WVA' && model_in != null) {
                translateInput(req.body.input, req.body.language, 'en', model_in, callback);
            }
            // don't translate the user input text
            else {
                callback(null, req.body.input);
            }
        },
        function (inputText, callback) {

            if (inputText != undefined) {
                const message = inputText.text;

                SDK.send(workspace, chatID, message)
                    .then(function (response) {
                        getResponse(response);
                        callback(null, response);
                    })
                    .catch(err => callback(err, null))
            }
            if (inputText === undefined) {
                SDK.start(workspace)
                    .then(response => {
                        chatID = response.chatID;
                        const onRequest = message => {
                            console.log('You:', message);
                        };
                        const onResponse = response => {
                            response.message.text.forEach(text => {
                                console.log('Agent:', text);
                            });
                        };
                        onResponse(response);
                        callback(null, response);
                    })
                //.catch(err => callback(err, null));
            }
        },
        function (response, callback) {
            // Translate the conversation response from English
            if (process.env.NORMALIZED_CONVERSATION === 'true' && req.body.language != 'en' && process.env.USE_BOT === 'WVA' && model_out != null) {
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