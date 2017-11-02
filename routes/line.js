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
 * @author Tadayuki Yoshida
 */

var line = require('@line/bot-sdk');

var express = require('express');
var router = express.Router();
var optional = require('optional');
var appEnv = require('cfenv').getAppEnv();
var cfEnvUtil = require('./cfenv-credsbylabel');
var request = require('request');
var async = require('async');
var Cloudant = require('cloudant');

// create LINE SDK config from env variables
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

var serviceRegex = /(cloudantNoSQLDB).*/;

var options = optional('./cloudant-credentials.json') || {
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

function onRejected(data) {
  console.log(data);
}

////////
console.log(options);
var cloudant = Cloudant(process.env.CLOUDANT_URL);
const dbname = 'contextstore';

router.post('/', ensureAuthenticated, function (req, res) {
  Promise
    .all(req.body.events.map(handleEvent))
    .then((result) => res.json(result))
    .catch(onRejected);
});

//router.post('/', line.middleware(config), (req, res) => {
//  Promise
//    .all(req.body.events.map(handleEvent))
//    .then((result) => res.json(result));
//});

const client = new line.Client(config);

var ConversationV1 = require('watson-developer-cloud/conversation/v1');

var conversation = new ConversationV1({
  username: process.env.CONVERSATION_USERNAME,
  password: process.env.CONVERSATION_PASSWORD,
  version_date: ConversationV1.VERSION_DATE_2017_05_26
});

// response handler (from Watcon Conversation)
function handleResponse(err, response, event, resolve, reject, push) {
  console.log("handleResponse push="+push);
  if (err) {
    console.error(err);
    reject(err);
    return;
  } else {
    //console.log('-- event start --');
    //console.log(event);
    //console.log('-- event end --');
    console.log(JSON.stringify(response, null, 2));
    var cdb = cloudant.db.use(dbname);
    //responsemsg = { type: 'text', text: response.output.text.join('\n') };
    if (response.context) {
      cdb.insert({timestamp:event.timestamp, userId:event.source.userId, context:response.context},function(err,body){
        if (err) {
          console.error('Cloudant error saving the last context')
          //res.status(500).send({
          //    status: 500,
          //    message: 'Cloudant error updating claim history'
          //});
        } else {
          console.log('context inserted to '+dbname);
          //res.json({
          //    status: 200
          //});
      }
      });                      
    }
    var responsemsg = {};
    if (response.output.line_push) {
      var timeout = response.output.line_push.delay;
      var messages = response.output.line_push.messages;
      setTimeout(function () {
        var _rr = client.pushMessage(event.source.userId, messages);
        resolve(_rr);
      },
      timeout);
    } else {
      if (response.output.line_template) {
        // inject context into data
        var templatemod = response.output.line_template;
        //templatemod.actions.forEach(function(ac){
        //  ac.data = '{'+ac.data + ',"context":' + JSON.stringify(response.context)+'}';
        //});
        responsemsg = {
          type: 'template',
          altText: 'template alt text',
          template: templatemod
        };
      } else {
        var tmsg = response.output.text.join('\n');
        responsemsg = {
          type: 'text',
          text: tmsg
        };
      }
      console.log(responsemsg);
      var rr = null;
      if (push) {
        console.log("-- push start --");
        console.log(event.source.userId);
        console.log("-- push end --");
        rr = client.pushMessage(event.source.userId, responsemsg);
      } else {
        rr = client.replyMessage(event.replyToken, responsemsg);      
      }
      console.log(rr);
      resolve(rr);
    }
  }
}

// start_conversation
function is_start_conversation(message) {
  var value = false;
  if (message==='リセット') {
    value = true;
  }
  //  else if (message==='こんにちは') {
  //   value = true;
  // } else if (message==='こんにちわ') {
  //   value = true;
  // } else if (message==='もしもし') {
  //   value = true;
  // }

  return value;
}

// event handler
function handleEvent(event) {
  console.log("handleEvent");
  console.log(event);

  // if event.type === 'message' then event.message.type should be 'text'
  // if not (event.type == postback or (event.type == message => message.type == text))
  // if not(event.type == postback) and not(event.type == message => message.type == text)
  // if not(event.type == postback) and not(event.type !== message || message.type == text)
  // if not(event.type == postback) and not(event.type !== message) and not(message.type == text)
  // if (event.type !== postback) and (event.type == message) and (message.type !== text)
  if (event.type === 'message' && event.message.type !== 'text') {
    // ignore non-text-message event
    return Promise.resolve(null);
  }

  var responsemsg = 'default message';
  return new Promise(function(resolve, reject){
    var lastcontext = {};
    var params = {reduce:false,limit:1,descending:true,include_docs:true};
    var cdb = cloudant.db.use(dbname);
    console.log('try to find last context #1');
    cdb.view('docs','lastcontext',params,function(err,body){
      //console.log(err);
      console.log(body);
      if (!err) {
        var lasttimestamp = 0;
        console.log(body.rows.length);
        body.rows.forEach(function (doc){
          console.log(doc.key);
          console.log("VALUE="+doc.value);
          lasttimestamp = doc.value;
        });
        var selector = {timestamp:lasttimestamp};
        var contextdoc = {};
        console.log('try to find last context #2');
        cdb.find({selector:selector},function(err2,result){
          if (err2) {
            throw err2;
          }
          console.log("LENGTH="+result.docs.length);
          if (result.docs.length==1) {
            contextdoc = result.docs[0];
            lastcontext = contextdoc.context;
            console.log('last context found :');
            console.log(lastcontext);  
          }
          if (event.type === 'message') {
            if (is_start_conversation(event.message.text)) {
              lastcontext = {};
            }
            console.log("handle message");
            conversation.message({
              input: { text: event.message.text },
              context: lastcontext,
              workspace_id: process.env.WORKSPACE_JAPANESE
            }, function(err,response) {
              handleResponse(err,response,event,resolve,reject);
            });
          }
          else if (event.type === 'postback') {
            console.log("handle postback");
            var edata = JSON.parse('{'+event.postback.data+'}');
            console.log(edata);
            if (edata.action.startsWith('api-response-')) {
              setTimeout(function () {
                console.log("sending delay message :"+edata.action);
                conversation.message({
                  input: { text: edata.action },
                  context: lastcontext,
                  workspace_id: process.env.WORKSPACE_JAPANESE
                }, function(err,response) {
                  handleResponse(err,response,event,resolve,reject,true);
                })
              },
              7500); // after 7.5sec  
            }
          }
        });
      }     
    });
  });
}

module.exports = router;
