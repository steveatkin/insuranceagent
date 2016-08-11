var express = require('express');
var router = express.Router();
var watson = require('watson-developer-cloud');


router.post('/', function(req, res){

  var conversation = watson.conversation({
    username: process.env.SERVICE_NAME_USERNAME,
    password: process.env.SERVICE_NAME_PASSWORD,
    version: 'v1',
    version_date: '2016-07-01'
  });

  var workspace = process.env.WORKSPACE_ENGLISH;

  if(req.body.language == 'fr') {
    workspace = process.env.WORKSPACE_FRENCH;
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
