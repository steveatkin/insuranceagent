var BlockChain = (function() {

  var responsePayload;

  var responseHistory;

  // Publicly accessible methods defined
  return {
    getClaim: getClaim,

    setClaim: setClaim,

    setOwner: setOwner,

    getHistory: getHistory,

    getResponsePayload: function() {
      return responsePayload;
    },

    setResponsePayload: function(newPayloadStr) {
      responsePayload = newPayloadStr;
    },

    getHistoryPayload: function() {
      return responseHistory;
    },

    setHistoryPayload: function(newPayloadStr) {
      responseHistory = newPayloadStr;
    }

  };


  function getClaim(policy) {
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

  function getHistory(policy) {
    $.ajax({
      type: "GET",
      url: "/dataservices/claim-history/" + policy,
      success: function(data) {
          BlockChain.setHistoryPayload(data.claim.history);
      },
      error: function(xhr, message) {
          alert(message);
      }
    });
  }


  function setOwner(customer, owner, role, state, cb) {
    $.ajax({
      type: "POST",
      url: "/chain/" + customer,
      data: {
        "owner": owner,
        "role": role,
        "state": state
      },
      success: function(data) {
        console.log("Updated owner BlockChain: " + JSON.stringify(data));
        updateHistory(customer, owner, role, state, false);
        cb(null, data);
      },
      error: function(xhr, message) {
        cb(true, message);
      }
    });
  }


  function setClaim(claim) {
    $.ajax({
      type: "POST",
      url: "/chain",
      data: {
        "id": claim.customer,
        "value": claim.amount,
        "vehicle": claim.vehicle,
        "owner": claim.owner,
        "role": claim.role,
        "state": claim.state
      },
      success: function(data) {
        console.log("Added to BlockChain: " + JSON.stringify(data));
        updateHistory(claim.customer, claim.owner, claim.role, claim.state, true);
      },
      error: function(xhr, message) {
          alert(message);
      }
    });
  }

  function updateHistory(customer, owner, role, state, reset) {
    // The reset attribute forces the history to be erased in the event
    // that there is a leftover record sitting in the database
    $.ajax({
      type: "POST",
      url: "/dataservices/claim-history",
      data: {
        "customer": customer,
        "owner": owner,
        "role": role,
        "state": state,
        "reset": reset
      },
      success: function(data) {
        console.log("Added to history: " + JSON.stringify(data));
        // send an SMS message to the customer
        // For demo puproses I have hardcoded the number to my cell
        sendNotification(customer, '+18134104511', owner, role, state);
      },
      error: function(xhr, message) {
          alert(message);
      }
    });
  }


  function sendNotification(customer, phone, owner, role, state) {
    var userLang = (navigator.language ||
                  navigator.userLanguage).substring(0,2).toLowerCase();

    $.ajax({
      type: "POST",
      url: "/twilio/" + customer,
      data: {
        "owner": owner,
        "role": role,
        "state": state,
        "phone": phone,
        "language": userLang
      },
      success: function(data) {
        console.log("Notification sent: " + JSON.stringify(data));
      },
      error: function(xhr, message) {
          alert(message);
      }
    });
  }

}());

