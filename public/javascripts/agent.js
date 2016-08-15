// Google maps setup
function initMap() {
  // Try HTML5 geolocation.
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(function(position) {
      var pos = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      };

      var map = new google.maps.Map(document.getElementById('map'), {
        center: {lat: pos.lat, lng: pos.lng},
        zoom: 6
      });
      var infoWindow = new google.maps.InfoWindow({map: map});

      //infoWindow.setPosition(pos);
      infoWindow.setContent('Location found.');
      map.setCenter(pos);
    }, function() {
      handleLocationError(true, infoWindow, map.getCenter());
    });
  } else {
    // Browser doesn't support Geolocation
    handleLocationError(false, infoWindow, map.getCenter());
  }
}

function handleLocationError(browserHasGeolocation, infoWindow, pos) {
  infoWindow.setPosition(pos);
  infoWindow.setContent(browserHasGeolocation ?
                        'Error: The Geolocation service failed.' :
                        'Error: Your browser doesn\'t support geolocation.');
}

$(document).ready(function () {

  // Register the enter key to the go button
  $("input").bind("keydown", function(event) {
      var keycode = (event.keyCode ? event.keyCode : (event.which ? event.which : event.charCode));
      if (keycode == 13) { // keycode for enter key
         // force the 'Enter Key' to implicitly click the Update button
         $('#insurance-query-button').click();
         return false;
      } 
      else  {
         return true;
      }
   });



  var userLang = (navigator.language ||
                  navigator.userLanguage).substring(0,2).toLowerCase();

  // listen for the click of the ask question button
  $('#insurance-query-button').click(function() {
    var context = {};
    var latestResponse = Conversation.getResponsePayload();
    if (latestResponse) {
      context = latestResponse.context;
    }

    Conversation.sendRequest($("#insurance-query").val(), context, userLang);
    // erase the text in the entry field
    $("#insurance-query").val('');
  });

  // Start with the accordion in the eclapsed state
  $("#policy.collapse").collapse();
  $("#claims.collapse").collapse();
  $("#offers.collapse").collapse();

  // Get all the UI strings
  $.ajax({
    type: "GET",
    url: "/resources",
    data: {
      "resource":  "agent",
      "language":  userLang
    },
    success: function(data) {
      Resources.setResources(data);

      $("#title").text(data.title);
      $("#about").text(data.about);
      $("#policy-type-message").text(data.policyType);
      $("#numbers-message").text(data.numberPolicies);
      $("#monthly-message").text(data.monthlyPremium);
      $("#claim-message").text(data.monthsSinceClaim);
      $("#coverage-message").text(data.coverage);
      $("#effective-message").text(data.effective);
      $("#inception-message").text(data.inception);
      $("#insurance-agent").text(data.insuranceAgent);
      $("#insurance-query-button").text(data.go);
      $("#claim-reason").text(data.reason);
      $("#claim-amount").text(data.amount);
      $("#policy-tab").text(data.policy);
      $("#claims-tab").text(data.claims);
      $("#offer-message").text(data.offerMessage);
      $("#vehicle-message").text(data.vehicleMessage);
      $("#city-message").text(data.cityMessage);
      $("#state-message").text(data.stateMessage);
      $("#family-message").text(data.familyNameMessage);
      $("#given-message").text(data.givenNameMessage);
      $("#weather").text(data.weather);
      $("#actions").text(data.actions);
      $("#offers-tab").text(data.offers);
    },
    error: function(xhr, message) {
        alert(message);
    }
  });


  // Setup the callback that is invoked when a policy is found.
  var policyResponsePayloadSetter = Policy.setResponsePayload;

  Policy.setResponsePayload = function(data) {
    policyResponsePayloadSetter.call(Policy, data);
    // Clear the weather alerts boxes
    $("#forecast").val('');
    $("#recommendation").val('');
    
    $("#policy-type").val(data.policyType);
    $("#months-since-claim").val(data.monthsSinceLastClaim);
    $("#number-of-policies").val(data.numberOfPolicies);
    $("#coverage").val(data.coverage);
    $("#effective").val(data.effectiveToDate);
    $("#monthly-premium").val(data.monthlyPremiumAuto);
    $("#policy-months").val(data.monthsSincePolicyInception);
    $("#reason").val(data.claimReason);
    $("#amount").val(data.totalClaimAmount);
    $("#vehicle").val(data.vehicle);
    $("#city").val(data.city);
    $("#state").val(data.state);
    $("#family").val(data.surname);
    $("#given").val(data.givenName);


    // Translate the offers text

    if(userLang != 'en') {
      $.ajax({
        type: "GET",
        url: "/translate",
        data: {
          "text": data.message,
          "language": userLang
        },
        success: function(data) {
          $("#special-offers").val(data);
        },
        error: function(xhr, message) {
          $("#special-offers").val(data.message);
        }
      });
    }
    else {
      $("#special-offers").val(data.message);
    }

    // setup the callback to respond to the weather alerts
    var weatherResponsePayloadSetter = Weather.setResponsePayload;

    Weather.setResponsePayload = function(newPayloadStr) {
      weatherResponsePayloadSetter.call(Weather, newPayloadStr);
      if(newPayloadStr) {
        $("#forecast").val($("#forecast").val() + newPayloadStr.description);
        if(newPayloadStr.instruction) {
          $("#recommendations").val($("#recommendations").val() + newPayloadStr.instruction);
        }
      }
      // No weather alerts, display no alerts message
      else {
        $("#forecast").val(Resources.getResources().noAlerts);
      }
    };

    // Request the weather alerts
    Weather.getWeather(data.latitude, data.longitude, userLang);

    // Show the policy holder's location on the map
    var geo = {lat: parseFloat(data.latitude), lng: parseFloat(data.longitude)};
    var mapDiv = document.getElementById('map');
    var map = new google.maps.Map(mapDiv, {
      center: {lat: geo.lat, lng: geo.lng},
      zoom: 8
    });

  };

  // Setup the conversation callback that gets invoked when a response is received.
  var conversationResponsePayloadSetter = Conversation.setResponsePayload;

  Conversation.setResponsePayload = function(newPayloadStr) {
    conversationResponsePayloadSetter.call(Conversation, newPayloadStr);
    console.log("Received: " + newPayloadStr);
    var data = JSON.parse(newPayloadStr);
    $("#agent-response").text(data.output.text);

    if(data.context.policy && data.context.verified === true) {
      Policy.getPolicy(data.context.policy, userLang);

      // see which accordion panel we should display
      if(data.context.claims) {
        $("#claims.collapse").collapse('show');
      }
      else if(data.context.offers){
        $("#offers.collapse").collapse('show');
      }
      else {
        $("#policy.collapse").collapse('show');
      }
    }
  };

  // start the interactive dialog
  Conversation.sendRequest('', null, userLang);
});
