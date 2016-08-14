var Weather = (function() {

  var responsePayload;
  var language = 'en';

  // Publicly accessible methods defined
  return {
    getWeather: getWeather,

    getResponsePayload: function() {
      return responsePayload;
    },

    setResponsePayload: function(newPayloadStr) {
      responsePayload = newPayloadStr;
    }
  };

  function getDetails(incident) {
    $.ajax({
      type: "GET",
      url: "/details",
      data: {
        "key": incident.key,
        "language": language
      },
      success: function(data) {

        var items = data.alertDetail.texts || [];
        
        items.forEach(
          function getText(value) {
            // Trigger the callback when the alert text is extracted
            Weather.setResponsePayload({
                language: value.language_cd,
                description: value.description,
                instruction: value.instruction
            });
          }
        );

      },
      error: function(xhr, message) {
          alert(message);
      }
    });
  }

  function getWeather(lat, lon, lang) {
    language = lang;

    $.ajax({
      type: "GET",
      url: "/alerts",
      data: {
        "lat": lat,
        "lon": lon,
        "language": language
      },
      success: function(data) {
        var alerts = data.alerts || [];

        // for each alert key go and extract the details of the alert
        if(alerts.length > 0){        
          alerts.forEach(getDetails);
        }
        // there are no alerts, so invoke callback with null
        else {
          Weather.setResponsePayload(null);
        }
        
        },
        error: function(xhr, message) {
          alert(message);
        }
      });
    }

}());
