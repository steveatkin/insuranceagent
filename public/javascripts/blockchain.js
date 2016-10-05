var BlockChain = (function() {

  var responsePayload;

  // Publicly accessible methods defined
  return {
    getPolicy: getPolicy,

    setPolicy: setPolicy,

    setOwner: setOwner,

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
      url: "/chain/" + policy,
      success: function(data) {
        BlockChain.setResponsePayload(data.claim);
      },
      error: function(xhr, message) {
          alert(message);
      }
    });
  }


  function setOwner(customer, owner) {
    $.ajax({
      type: "POST",
      url: "/chain/" + customer,
      data: {
        "owner": owner
      },
      success: function(data) {
        console.log("Updated owner BlockChain: " + JSON.stringify(data));
        updateHistory(customer, owner);
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
        updateHistory(claim.customer, claim.owner);
      },
      error: function(xhr, message) {
          alert(message);
      }
    });
  }

  function updateHistory(customer, owner) {
    $.ajax({
      type: "POST",
      url: "/dataservices/claim-history",
      data: {
        "customer": customer,
        "owner": owner
      },
      success: function(data) {
        console.log("Added to history: " + JSON.stringify(data));
      },
      error: function(xhr, message) {
          alert(message);
      }
    });
  }

}());

