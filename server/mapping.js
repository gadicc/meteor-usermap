/* Mapping related server-side code */

// google maps
var gm = Meteor.require('googlemaps');
gm.geocode = Async.wrap(gm.geocode);

// if the location doesn't exist, add it
locations.check = function(name) {
	if (!this.get(name)) {
	  var res = gm.geocode(name);
	  var data = res.results[0];
	  data.reqName = name;
	  Locations.insert(data);
	}
}

Meteor.methods({

	// force a locations.check() call from the client
  'checkLocation': function(location) {
    if (this.userId) {
      locations.check(location);
    }
  }

});
