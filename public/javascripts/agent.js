/*	
 * Copyright IBM Corp. 2016
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @author Steven Atkin
 * @contributor Harpreet Kaur Chawla
 */


// Google maps setup
function initMap() {
  // Try HTML5 geolocation.
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(function (position) {
      var pos = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      };

      var map = new google.maps.Map(document.getElementById('map'), {
        center: {
          lat: pos.lat,
          lng: pos.lng
        },
        zoom: 6
      });
      var infoWindow = new google.maps.InfoWindow({
        map: map
      });

      infoWindow.setContent('Location found.');
      map.setCenter(pos);
    }, function () {
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

function createHistoryTable() {
  $.extend($.fn.bootstrapTable.defaults, {
    formatNoMatches: function () {
      return Resources.getResourcesData().noHistory;
    }
  });

  $("#history-table").bootstrapTable({
    columns: [{
      field: "role",
      title: Resources.getResourcesData().role
    }, {
      field: "owner",
      title: Resources.getResourcesData().owner
    }, {
      field: "date",
      title: Resources.getResourcesData().date
    }]
  });

  $("#history-table").bootstrapTable('load', []);
}

function populateHistoryTable(policy) {
  var userLocale = navigator.language || navigator.userLanguage;
  var target = document.getElementById('accordion');
  var spinner = new Spinner().spin(target);

  $.ajax({
    type: "GET",
    url: "/dataservices/claim-history/" + policy,
    success: function (data) {
      // reset the history table
      $("#history-table").bootstrapTable('load', []);

      if (data.claim.state) {
        // Use the translations for each state
        if (data.claim.state === "In Process") {
          data.claim.state = Resources.getResourcesData().inProcess;
        } else if (data.claim.state === "Paid") {
          data.claim.state = Resources.getResourcesData().paid;
        }

        $("#current-state").val(data.claim.state);
      } else {
        $("#current-state").val(Resources.getResourcesData().received);
      }

      if (data.claim.history) {
        data.claim.history.forEach(function (value) {
          // Use the translations for each role
          if (value.role === "Claim Recipient") {
            value.role = Resources.getResourcesData().claimRecipient;
          } else if (value.role === "Policy Holder") {
            value.role = Resources.getResourcesData().policyHolder;
          } else if (value.role === "Repair Facility") {
            value.role = Resources.getResourcesData().repair;
          } else if (value.role === "Financial Institution") {
            value.role = Resources.getResourcesData().financial;
          } else if (value.role === "Adjustor") {
            value.role = Resources.getResourcesData().adjustor;
          }

          // Localize the date
          var dateOptions = {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
            second: 'numeric',
            timeZone: 'UTC',
            timeZoneName: 'short'
          };

          var dateStamp = (new Date(value.date)).toLocaleDateString(userLocale, dateOptions);

          $("#history-table").bootstrapTable('append', [{
            role: value.role,
            owner: value.owner,
            date: dateStamp
          }]);
        });
      }

      spinner.stop();
    },
    error: function (xhr, message) {
      alert(message);
    }
  });
}

$(document).ready(function () {
  var policyInformation = null;
  var userLang = (navigator.language ||
    navigator.userLanguage).substring(0, 2).toLowerCase();
  var userLocale = navigator.language || navigator.userLanguage;
  var speechModel = '';
  var enableSpeaker = false;
  var enableMicrophone = false;

  // Check to see if speech to text is supported for this locale or language
  if (userLang === 'ja') {
    speechModel = 'ja-JP_BroadbandModel';
    enableMicrophone = true;
  } else if (userLang === 'ar') {
    speechModel = 'ar-AR_BroadbandModel';
    enableMicrophone = true;
  } else if (userLang === 'fr') {
    speechModel = 'fr-FR_BroadbandModel';
    enableMicrophone = true;
  } else if (userLang === 'es') {
    speechModel = 'es-ES_BroadbandModel';
    enableMicrophone = true;
  } else if (userLocale === 'en-UK') {
    speechModel = 'en-UK_BroadbandModel';
    enableMicrophone = true;
  } else if (userLang === 'en') {
    speechModel = 'en-US_BroadbandModel';
    enableMicrophone = true;
  } else if (userLocale === 'zh-CN') {
    speechModel = 'zh-CN_BroadbandModel';
    enableMicrophone = true;
  } else if (userLocale === 'pt-BR') {
    speechModel = 'pt-BR_BroadbandModel';
    enableMicrophone = true;
  }

  // Check to see if text to speech is supported for this locale or language
  if (userLocale === 'en-UK') {
    enableSpeaker = true;
  } else if (userLang === "en") {
    enableSpeaker = true;
  } else if (userLang === 'fr') {
    enableSpeaker = true;
  } else if (userLang === 'de') {
    enableSpeaker = true;
  } else if (userLocale === 'es-US') {
    enableSpeaker = true;
  } else if (userLang === 'es') {
    enableSpeaker = true;
  } else if (userLang === 'it') {
    enableSpeaker = true;
  } else if (userLang === 'ja') {
    enableSpeaker = true;
  } else if (userLocale === 'pt-BR') {
    enableSpeaker = true;
  }

  // Only enable the microphone for supported locales
  if (enableMicrophone) {
    $('#speech-query-button').prop('disabled', false);
    $('#speech-query-button').data('speechModel', speechModel);
  } else {
    $('#speech-query-button').prop('disabled', true);
  }

  // Only enable the speaker for supported locales
  if (enableSpeaker) {
    $('#speaker-button').prop('disabled', false);
  } else {
    $('#speaker-button').prop('disabled', true);
  }

  // Register the enter key to the go button
  $("input").bind("keydown", function (event) {
    var keycode = (event.keyCode ? event.keyCode : (event.which ? event.which : event.charCode));
    if (keycode == 13) { // keycode for enter key
      // force the 'Enter Key' to implicitly click the Update button
      $('#insurance-query-button').click();
      return false;
    } else {
      return true;
    }
  });

  // Listen for accordion events
  $('#accordion').on('show.bs.collapse', function (e) {
    if (e.target.id === 'claims' && policyInformation) {
      // We need to grab the one that is defined, some of our databases used customer while some used customerID
      var custID = policyInformation.customer || policyInformation.customerID
      populateHistoryTable(custID);
    }
  });

  // listen for the click of the microphone button
  $('#speech-query-button').click(function () {
    fetch('/speech/token', {
        credentials: 'include'
      })
      .then(function (response) {
        return response.text();
      }).then(function (token) {

        // Get the speech model from the speechModel attribute on the button
        var model = $('#speech-query-button').data('speechModel');

        var stream = WatsonSpeech.SpeechToText.recognizeMicrophone({
          token: token,
          model: model,
          continuous: false,
          keepMicrophone: true,
          outputElement: '#insurance-query'
        });

        stream.on('error', function (err) {
          console.log(err);
        });

      }).catch(function (error) {
        console.log(error);
      });
  });

  // listen for the clik of the speaker button to play audio
  // This will play the response from Watson conversation
  $('#speaker-button').click(function () {
    $('#audio').attr('src', '/text/speak?text=' + $("#agent-response").text());
  });

  // listen for the click of the ask question button
  $('#insurance-query-button').click(function () {
    var context = {};
    if (use_bot === 'WCS') {
      var latestResponse = Conversation.getConversationData();
      if (latestResponse) {
        context = latestResponse.context;
      }

      // If we are using Simplified or Traditional Chinese then send the full locale
      if (userLang === "zh") {
        Conversation.sendRequest($("#insurance-query").val(), context, userLocale);
      } else {
        Conversation.sendRequest($("#insurance-query").val(), context, userLang);
      }
      // erase the text in the entry field
      $("#insurance-query").val('');

      // Collapse the panels
      $('.collapse').collapse("hide");

      // reset policy information
      policyInformation = null;
    }

    if (use_bot === 'WVA') {
      var latestResponse = wva.getConversationData();
      if (latestResponse) {
        context = latestResponse.message.context;
      }

      // If we are using Simplified or Traditional Chinese then send the full locale
      if (userLang === "zh") {
        wva.sendRequest($("#insurance-query").val(), context, userLocale);
      } else {
        wva.sendRequest($("#insurance-query").val(), context, userLang);
      }
      // erase the text in the entry field
      $("#insurance-query").val('');

      // Collapse the panels
      $('.collapse').collapse("hide");

      // reset policy information
      policyInformation = null;
    }
  });

  // Start with the accordion in the eclapsed state
  $("#policy.collapse").collapse();
  $("#claims.collapse").collapse();
  $("#offers.collapse").collapse();

  // Get all the UI strings
  // Setup the callback that is invoked when the resources are found.
  var resourcesDataSetter = Resources.setResourcesData;

  Resources.setResourcesData = function (data) {
    resourcesDataSetter.call(Resources, data);

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
    $("#claim-state").text(data.currentState);

    // Create the history table after we know our resources are loaded
    createHistoryTable();
  };

  // If we have Simplified or Traditional Chinese then use the full locale
  if (userLang === "zh") {
    Resources.getResources("agent", userLocale);
  } else {
    Resources.getResources("agent", userLang);
  }

  // Setup the callback that is invoked when a policy is found.
  var policyDataSetter = Policy.setPolicyData;

  Policy.setPolicyData = function (data) {
    policyDataSetter.call(Policy, data);

    policyInformation = data;

    // Clear the weather alerts boxes
    $("#forecast").val('');
    $("#recommendation").val('');

    $("#policy-type").val(data.policyType);
    $("#months-since-claim").val(data.monthsSinceLastClaim);
    $("#number-of-policies").val(data.numberOfPolicies);
    $("#coverage").val(data.coverage);
    $("#effective").val(data.effectiveToDate);
    $("#policy-months").val(data.monthsSincePolicyInception);
    $("#reason").val(data.claimReason);

    // Localize the display of the currencies
    if (typeof Intl != "undefined") {
      var claim = new Number(data.totalClaimAmount);
      var premium = new Number(data.monthlyPremiumAuto);
      data.totalClaimAmount = new Intl.NumberFormat('default', {
        style: 'currency',
        currency: 'USD'
      }).format(claim);
      data.monthlyPremiumAuto = new Intl.NumberFormat('default', {
        style: 'currency',
        currency: 'USD'
      }).format(premium);
    }

    $("#monthly-premium").val(data.monthlyPremiumAuto);
    $("#amount").val(data.totalClaimAmount);
    $("#vehicle").val(data.vehicle);
    $("#city").val(data.city);
    $("#state").val(data.state);
    $("#family").val(data.surname);
    $("#given").val(data.givenName);


    // Translate the offers text
    if (userLang != 'en') {
      $.ajax({
        type: "GET",
        url: "/translate",
        data: {
          "text": data.message,
          "source": 'en',
          "target": userLang
        },
        success: function (data) {
          $("#special-offers").val(data);
        },
        error: function (xhr, message) {
          // If we get an error then just use English
          $("#special-offers").val(data.message);
        }
      });
    } else {
      $("#special-offers").val(data.message);
    }

    // setup the callback to respond to the weather alerts
    var weatherDataSetter = Weather.setWeatherData;

    Weather.setWeatherData = function (newPayloadStr) {
      weatherDataSetter.call(Weather, newPayloadStr);
      if (newPayloadStr) {
        $("#forecast").val($("#forecast").val() + newPayloadStr.description);
        if (newPayloadStr.instruction) {
          $("#recommendations").val($("#recommendations").val() + newPayloadStr.instruction);
        }
      }
      // No weather alerts, display no alerts message
      else {
        $("#forecast").val(Resources.getResourcesData().noAlerts);
      }
    };

    // Request the weather alerts
    Weather.getWeather(data.latitude, data.longitude, userLang);

    // Show the policy holder's location on the map
    var geo = {
      lat: parseFloat(data.latitude),
      lng: parseFloat(data.longitude)
    };
    var mapDiv = document.getElementById('map');
    var map = new google.maps.Map(mapDiv, {
      center: {
        lat: geo.lat,
        lng: geo.lng
      },
      zoom: 8
    });

  };

if (use_bot === 'WCS') {
  // Setup the conversation callback that gets invoked when a response is received.
  var conversationDataSetter = Conversation.setConversationData;

  Conversation.setConversationData = function (newPayloadStr) {
    conversationDataSetter.call(Conversation, newPayloadStr);
    var data = JSON.parse(newPayloadStr);
    $("#agent-response").text(data.output.text);

    if (data.context.policy && data.context.verified === true) {
      // If we are using Simplified or Traditional Chinese then send the full locale
      if (userLang === "zh") {
        Policy.getPolicy(data.context.policy, userLocale);
      } else {
        Policy.getPolicy(data.context.policy, userLang);
      }
      $("#policy.collapse").collapse('show');
    }
  };

  // start the interactive dialog
  // If we are using Simplified or Traditional Chinese then we need to send the full locale
  if (userLang === "zh") {
    Conversation.sendRequest('', null, userLocale);
  } else {
    Conversation.sendRequest('', null, userLang);
  }
}

if (use_bot === 'WVA') {
    // Setup the conversation callback that gets invoked when a response is received.
    var conversationDataSetter = wva.setConversationData;

    wva.setConversationData = function (newPayloadStr) {
      conversationDataSetter.call(wva, newPayloadStr);
      var data = JSON.parse(newPayloadStr);

      console.log(JSON.stringify(data));
      $("#agent-response").text(data.message.text);

      if (data.message.context.policy && data.message.context.verified === true) {
        // If we are using Simplified or Traditional Chinese then send the full locale
        if (userLang === "zh") {
          Policy.getPolicy(data.message.context.policy, userLocale);
        } else {
          Policy.getPolicy(data.message.context.policy, userLang);
        }
        $("#policy.collapse").collapse('show');
      }
    };

    // start the interactive dialog
    // If we are using Simplified or Traditional Chinese then we need to send the full locale
    if (userLang === "zh") {
      wva.sendRequest('', null, userLocale);
    } else {
      wva.sendRequest('', null, userLang);
    }
  }

});