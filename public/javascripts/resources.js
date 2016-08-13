// The Api module is designed to handle all interactions with the server

var Resources = (function() {
  var resources;

  // Publicly accessible methods defined
  return {
    getResources: function() {
      return resources;
    },
    setResources: function(newResources) {
      resources = newResources;
    }
  };
}());
