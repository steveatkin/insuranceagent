var BlockChain = (function() {

  var responsePayload;

  // Publicly accessible methods defined
  return {
    getPolicy: getPolicy,

    setPolicy: setPolicy,

    getResponsePayload: function() {
      return responsePayload;
    },

    setResponsePayload: function(newPayloadStr) {
      responsePayload = newPayloadStr;
    }
  };


  function getPolicy(policy) {
    $.ajax({
      type: "GET",
      url: "/chain",
      data: {
        "customer":  policy
      },
      success: function(data) {
        BlockChain.setResponsePayload(data);
      },
      error: function(xhr, message) {
          alert(message);
      }
    });
  }

  function setPolicy(claim) {
    $.ajax({
      type: "POST",
      url: "/chain",
      data: {
        "id": claim.customer,
        "value": claim.amount,
        "vehicle": claim.vehicle,
        "owner": claim.owner
      },
      success: function(data) {
        console.log("Added to BlockChain: " + JSON.stringify(data));
      },
      error: function(xhr, message) {
          alert(message);
      }
    });

  }

}());
