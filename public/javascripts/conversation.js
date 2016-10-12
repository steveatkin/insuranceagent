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

var Conversation = (function() {
  var requestPayload;
  var conversationData;
  var messageEndpoint = '/conversation';

  // Publicly accessible methods defined
  return {
    sendRequest: sendRequest,

    getConversationData: function() {
      return conversationData;
    },
    setConversationData: function(data) {
      conversationData = JSON.parse(data);
    }
  };

  // Send a message request to the server
  function sendRequest(text, context, language) {

    // Build request payload
    var payloadToWatson = {};
    if (text) {
      payloadToWatson.input = {
        text: text
      };
    }
    if (context) {
      payloadToWatson.context = context;
    }
    if(language) {
      payloadToWatson.language = language;
    }

    // Built http request
    var http = new XMLHttpRequest();
    http.open('POST', messageEndpoint, true);
    http.setRequestHeader('Content-type', 'application/json');
    http.onreadystatechange = function() {
      if (http.readyState === 4 && http.status === 200 && http.responseText) {
        Conversation.setConversationData(http.responseText);
      }
    };

    var params = JSON.stringify(payloadToWatson);
  
    // Send request
    http.send(params);
  }
}());
