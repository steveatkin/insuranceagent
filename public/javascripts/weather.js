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
 */


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
