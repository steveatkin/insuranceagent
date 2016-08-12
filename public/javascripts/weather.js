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
            Weather.setResponsePayload(value.description);
          }
        );

      },
      error: function(xhr) {
          alert(xhr.status);
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
        alerts.forEach(getDetails);
        
        },
        error: function(xhr) {
          alert(xhr.status);
        }
      });
    }

}());
