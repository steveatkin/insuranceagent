var request = require('request');

function main(params) {
  var host = "3eebbd56-fe8b-4000-85e8-d292425f4fab-bluemix.cloudant.com";
  var username = "3eebbd56-fe8b-4000-85e8-d292425f4fab-bluemix";
  var password = "57346580bb5f72e657216811823fa5813aac5bbf2b639278ea5e9dd9846f663f";
  var db = "/backup-claims";
  var view = "/_design/claimsPaid/_view/claim-reason?limit=100&reduce=true&group=true";

  var url = "https://" + username + ":" + password + "@" + host + db + view;

   request.get(url, function(error, response, body) {
     var summary = JSON.parse(body);
     whisk.done(summary);
   });

   return whisk.async();
}
