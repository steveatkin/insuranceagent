var express = require('express');
var router = express.Router();
var optional = require('optional');
var appEnv = require('cfenv').getAppEnv();
var cfEnvUtil = require('./cfenv-credsbylabel');
var ConversationV1 = require('watson-developer-cloud/conversation/v1');

router.post('/', function(req, res){

    var serviceRegex = /(conversation).*/;

    var options = optional('./conversation-credentials.json') || {appEnv: appEnv};

    // parse vcap using cfenv if available
    if(options.appEnv && !options.credentials) {
        options.credentials = cfEnvUtil.getServiceCredsByLabel(options.appEnv, serviceRegex);
    }
    // try again with name
    else if(options.appEnv && !options.credentials) {
        options.credentials = options.appEnv.getServiceCreds(serviceRegex);
    }

  var conversation = new ConversationV1({
    username: options.credentials.username,
    password: options.credentials.password,
    version_date: '2016-07-01'
  });

  var workspace = process.env.WORKSPACE_ENGLISH;

  if(req.body.language == 'fr') {
    workspace = process.env.WORKSPACE_FRENCH;
  }
  else if(req.body.language == 'es') {
    workspace = process.env.WORKSPACE_SPANISH;
  }

  conversation.message({
    input: req.body.input,
    context: req.body.context,
    workspace_id: workspace
  }, function(err, response) {
      if (err) {
        res.send(err);
      } else {
        res.json(response);
      }
  });

});

module.exports = router;
