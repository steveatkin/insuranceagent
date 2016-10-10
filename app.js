var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
require('dotenv').config();

var routes = require('./routes/index');
var assessor = require('./routes/assessor');
var policy = require('./routes/policy');
var resources = require('./routes/resources');
var conversation = require('./routes/conversation');
var alerts = require('./routes/alerts');
var details = require('./routes/details');
var translate = require('./routes/translate');
var chain = require('./routes/chain');
var data = require('./routes/dataservices');
var twilio = require('./routes/twilio');

// Initialize the blockchain service and start our chaincode
chain.init();

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: false
}));
app.use(cookieParser());
app.use(express.static(__dirname + '/public'));

app.use('/', routes);
app.use('/assessor', assessor);
app.use('/policy', policy);
app.use('/resources', resources);
app.use('/conversation', conversation);
app.use('/alerts', alerts);
app.use('/details', details);
app.use('/translate', translate);
app.use('/chain', chain);
app.use('/dataservices', data);
app.use('/twilio', twilio);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

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