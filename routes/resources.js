var optional = require('optional');
var appEnv = require('cfenv').getAppEnv();
var gpClient = require('g11n-pipeline').getClient(
  optional('./local-credentials.json')   // if it exists, use local-credentials.json
    || {appEnv: appEnv}                  // otherwise, the appEnv
);
var express = require('express');
var router = express.Router();

router.get('/', function(req, res, next) {
  var myResources = gpClient.bundle(req.query.resource);

  myResources.getStrings({ languageId: req.query.language}, function (err, result) {
        if (err) {
            res.send(err);
        } else {
            var myStrings = result.resourceStrings;
            res.json(myStrings);
        }
    });
});

module.exports = router;
