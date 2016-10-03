var Policy = (function() {

  var responsePayload;

  // Publicly accessible methods defined
  return {
    getPolicy: getPolicy,

    getResponsePayload: function() {
      return responsePayload;
    },

    setResponsePayload: function(newPayloadStr) {
      responsePayload = newPayloadStr;
    }
  };


  function getPolicy(policy, language) {
    
    $.ajax({
      type: "GET",
      url: "/policy",
      data: {
        "customer":  policy,
        "language":  language
      },
      success: function(data) {
        // If there is no Intl object then use non localized forms
        var effectiveToDate = new Date(data.effectiveToDate);

        // localize date
        if(typeof Intl != "undefined") {
          data.effectiveToDate = new Intl.DateTimeFormat().format(effectiveToDate);
        }
        else {
          data.effectiveToDate = effectiveToDate.toString();
        }

        Policy.setResponsePayload(data);
        },
        error: function(xhr, message) {
          alert(message);
        }
      });
    }

}());
