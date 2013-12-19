// Publish profile (name, location, pic) of all users
Meteor.publish('users', function() {
  return Meteor.users.find({}, { fields: { profile: 1 }} );
});

// Publish required data for each location
Meteor.publish('locations', function() {
  return Locations.find({}, { fields: {
    reqName: 1, formatted_address: 1,
    'geometry.location.lat': 1, 'geometry.location.lng': 1
  } });
});