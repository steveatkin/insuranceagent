var express = require('express');
var router = express.Router();
var Client = require('node-rest-client').Client;

router.get('/', function(req, res, next) {
  var client = new Client();

  var args = {
    parameters: { customer: req.query.customer,
                  language: req.query.language,
                  client_id: process.env.API_KEY
    },
    requestConfig: { timeout: 2000},
    responseConfig: { timeout: 2000}
  };

  var api = client.get(process.env.POLICY_API, args,
    function (data, response) {
        if(response.statusCode == 200) {
          res.json(data);
        }
        else {
          res.status(response.statusCode).send(response.statusMessage);
        }
  });

  api.on('error', function (err) {
    res.send(err);
  });

  api.on('requestTimeout', function (req) {
    res.status(404).send("Policy or language code incorrect");
  });

  api.on('responseTimeout', function (res) {
    res.status(500).send("response has expired")
  });

});

module.exports = router;
