var express = require('express');
var router = express.Router();
var request = require('request');


router.get('/', function(req, res, next) {
  
  var params = {
    url: process.env.POLICY_API,
    qs: { 
      customer: req.query.customer,
      language: req.query.language,
      client_id: process.env.API_KEY
    },
    method: 'GET',
    timeout: 4000
  };


  request(params, function(error, response, body) {
        if(!error && response.statusCode == 200) {
            var result = JSON.parse(body);
            res.json(result);
        } 
        else {
            res.status(response.statusCode).send('Unable to get policy.');
        }
    });

});

module.exports = router;
