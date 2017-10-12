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
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
require('dotenv').config();
var linesdk = require('@line/bot-sdk');

var routes = require('./routes/index');
var assessor = require('./routes/assessor');
//var policy = require('./routes/policy');
var resources = require('./routes/resources');
//var conversation = require('./routes/conversation');
//var alerts = require('./routes/alerts');
//var details = require('./routes/details');
//var translate = require('./routes/translate');
//var chain = require('./routes/chain');
//var data = require('./routes/dataservices');
//var twilio = require('./routes/twilio');
//var speech = require('./routes/speech-text');
//var text = require('./routes/text-speech');
var line = require('./routes/line');

var app = express();

// We need to catch all execptions. This is not ideal
// We are forced to do this because the HFC SDK for Blockchain is not properly handling exceptions
// The exceptions are due to Bluemix reseting connections that cause failures in GRPC that are
// not handled in the HFC SDK so we are forced to catch all execptions to preevent crashing
process.on('uncaughtException', function (err) {
  console.log(err);
})

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));

app.enable('trust proxy');

app.use(function (req, res, next) {
  // running in devlopment mode
  if(process.env.NODE_ENV == 'development') {
    next();
  }
  // default to production mode
  else {
    if (req.headers['x-forwarded-proto'] && req.headers['x-forwarded-proto'] === "https") {
      // request was via https, so do no special handling
      next();
    } else {
      // request was via http, so redirect to https
      res.redirect('https://' + req.headers.host + req.url);
    }
  }
});

app.use(logger('dev'));
app.use(linesdk.middleware({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: false
}));
app.use(cookieParser());
app.use(express.static(__dirname + '/public'));

app.use('/', routes);
app.use('/assessor', assessor);
//app.use('/policy', policy);
app.use('/resources', resources);
//app.use('/conversation', conversation);
//app.use('/alerts', alerts);
//app.use('/details', details);
//app.use('/translate', translate);
//app.use('/chain', chain);
//app.use('/dataservices', data);
//app.use('/twilio', twilio);
//app.use('/speech', speech);
//app.use('/text', text);
app.use('/webhook', line);


// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function (err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function (err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
});

module.exports = app;