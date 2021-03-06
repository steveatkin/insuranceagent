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


// The Api module is designed to handle all interactions with the server

var Resources = (function() {
  var resources;
  var resourceData;

  // Publicly accessible methods defined
  return {
    getResources: getResources,

    getResourcesData: function () {
      return resourceData;
    },

    setResourcesData: function (data) {
      resourceData = data;
    }
  };

  function getResources(name, language) {
    $.ajax({
      type: "GET",
      url: "/resources",
      data: {
        "resource": name,
        "language": language
      },
      success: function (data) {
        //Resources.setResources(data);
        Resources.setResourcesData(data);
      },
      error: function (xhr, message) {
        alert(message);
      }
    });
  }

}());
