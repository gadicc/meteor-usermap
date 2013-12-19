/* When changing document format, query here for the old format to update */

// Users with no profile should get "profile: {}"
_.each(Meteor.users.find({profile: {$exists: false}}).fetch(), function(user) {
  Meteor.users.update(user._id, {$set: {profile: {}}});
});

// Default of { 'profile.name': 'Anonymoous' }
_.each(Meteor.users.find({'profile.name': {$exists: false}}).fetch(), function(user) {
  Meteor.users.update(user._id, {$set: {'profile.name': 'Anonymous'}});
});

// Default of { 'profile.pic': '/avatar-empty.png' }
_.each(Meteor.users.find({'profile.pic': {$exists: false}}).fetch(), function(user) {
  Meteor.users.update(user._id, {$set: {'profile.pic': '/avatar-empty.png'}});
});
