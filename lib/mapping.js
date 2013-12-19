/* Common code loaded first on client and server */

Locations = new Meteor.Collection('locations');

locations = {
  list: {},
  get: function(name) {
    return this.list[name];
  },
  addedCallbacks: [],
  added: function(callback) {
    this.addedCallbacks.push(callback);
  }
};

Locations.find().observe({ 
  'added': function(doc) {
    locations.list[doc.reqName] = {
      formatted_address: doc.formatted_address,
      lat: doc.geometry.location.lat,
      lng: doc.geometry.location.lng
    };

    for (var i=0; i < locations.addedCallbacks.length; i++)
      locations.addedCallbacks[i](doc);
  }
});
