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
        var premium = new Number(data.monthlyPremiumAuto);
        var claim = new Number(data.totalClaimAmount);

        // localize dates and currency
        if(typeof Intl != "undefined") {
          data.effectiveToDate = new Intl.DateTimeFormat().format(effectiveToDate);
          data.monthlyPremiumAuto = new Intl.NumberFormat('default',
            { style: 'currency', currency: 'USD' }).format(premium);
          data.totalClaimAmount = new Intl.NumberFormat('default',
            { style: 'currency', currency: 'USD' }).format(claim);
        }
        else {
          data.effectiveToDate = effectiveToDate.toString();
          data.monthlyPremiumAuto = premium.toString();
          data.totalClaimAmount = claim.toString();
        }

        Policy.setResponsePayload(data);
        },
        error: function(xhr, message) {
          alert(message);
        }
      });
    }

}());
