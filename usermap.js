if (Meteor.isClient) {
  Meteor.subscribe('users');
  Meteor.subscribe('locations');

  // Randomize markers around the city center
  var locRnd = function() {
    return (Math.random() - 0.5) / 100;
  }

  var userQueues = {};
  var userMarkers = {};
  var addUserToMap = function(user) {
    // skip users with no location
    if (!user.profile || !user.profile.location)
      return;

    var location = locations.get(user.profile.location);
    if (location) {

      var marker = user.profile.pic ? new RichMarker({
          // if there's a picture, use a RichMarker
          position: new google.maps.LatLng(location.lat + locRnd(), location.lng + locRnd()),
          content: '<img class="faceMarker" src="' + user.profile.pic + '" />',
          anchor: new google.maps.Size(-16, 0)
      }) : new google.maps.Marker({
          // otherwise just use a regular marker
         position: new google.maps.LatLng(location.lat + locRnd(), location.lng + locRnd()),
      });

      // keep track of all markers and who they belong to
      marker._user = user;
      userMarkers[user._id] = marker;

      google.maps.event.addListener(marker, 'click', markerInfo);
      markerCluster.addMarker(marker);

    } else {

      if (!userQueues[user.profile.location])
        userQueues[user.profile.location] = [];
      userQueues[user.profile.location].push(user);

    }
  }

  var markerInfo = function() {
      var node = $('<div style="width: 200px; height: 150px;" class="infowindow">'
        + '<p><b>' + this._user.profile.name + '</b></p>'
        + '<p>' + this._user.profile.location + '</p>'
        + '<p><img src="' + this._user.profile.pic + '" /></p>'
        + '</div>')[0];
      infowindow.setContent(node);
      infowindow.open(map, this);
  }

  GoogleMaps.init(
      {
          'sensor': true //optional
      }, 
      function(){

          var mapOptions = {
              zoom: 2,
              mapTypeId: google.maps.MapTypeId.ROADMAP,
              mapTypeControlOptions: {
                style: google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
                position: google.maps.ControlPosition.BOTTOM_CENTER
              },
          };
          map = new google.maps.Map(document.getElementById("map-canvas"), mapOptions); 
          map.setCenter(new google.maps.LatLng( 30, 0 ));

          window.markerCluster = new MarkerClusterer(map);
          window.infowindow = new google.maps.InfoWindow();

          jQuery.getScript("http://google-maps-utility-library-v3.googlecode.com/svn/trunk/richmarker/src/richmarker-compiled.js",
            function() {

              Meteor.users.find().observe({

                'added': function(user) {
                  addUserToMap(user);
                },

                'changed': function(user) {
                  if (userMarkers[user._id]) {
                    markerCluster.removeMarker(userMarkers[user._id]);
                    delete(userMarkers[user._id]);
                  }
                  _.defer(function() {
                    // Can't do method calls inside observes??
                    Meteor.call('checkLocation', user.profile.location);
                  });
                  addUserToMap(user);
                },

                'removed': function(user) {
                  if (userMarkers[user._id]) {
                    markerCluster.removeMarker(userMarkers[user._id]);
                    delete(userMarkers[user._id]);
                  }
                }

              }); /* observe */

            }); /* richmarker init */
      }
  );

  Accounts.ui.config({
    requestPermissions: {
      facebook: ['user_location'],
      github: ['user'],
      google: ['profile']
    }
  });

  Template.box.username = function() {
    return Meteor.user().profile.name;
  }
  Template.box.location = function() {
    return Meteor.user().profile.location;
  }

  Session.setDefault('showOptions', false);
  Template.box.height = function() {
    if (!Meteor.user())
      return 100;
    return Session.get('showOptions') ? 100 : 40;
  }
  Template.box.showOptions = function() {
    return Session.get('showOptions');
  }
  Template.box.events({
    'click #showOptions': function(event, tpl) {
      event.preventDefault();
      Session.set('showOptions', event.target.getAttribute('data-value') == 'true');
    },
    'click #save': function(event, tpl) {
      event.preventDefault();
      var user = Meteor.user(),
        name = $('#inputName').val(),
        location = $('#inputLocation').val(),
        set = { };

      if (user.profile.name != name)
        set['profile.name'] = name;
      if (user.profile.location != location)
        set['profile.location'] = location;

      if (set['profile.name'] || set['profile.location'])
        Meteor.users.update(user._id, {$set: set});

      Session.set('showOptions', false);
    }
  });

}

Locations = new Meteor.Collection('locations');
locations = {
  list: {},
  get: function(name) {
    return this.list[name];
  }
};

Locations.find().observe({ 
  'added': function(doc) {
    locations.list[doc.reqName] = {
      formatted_address: doc.formatted_address,
      lat: doc.geometry.location.lat,
      lng: doc.geometry.location.lng
    };

    // if location was added after user [was queued], dequeue
    if (Meteor.isClient) {
      if (userQueues[doc.reqName]) {
        _.each(userQueues[doc.reqName], function(user) {
          addUserToMap(user);
        });
        delete(userQueues[doc.ReqName]);
      }
    }
  }
});


if (Meteor.isServer) {

  // if the location doesn't exist, add it  
  locations.check = function(name) {
    if (!this.get(name)) {
      var res = gm.geocode(name);
      var data = res.results[0];
      data.reqName = name;
      Locations.insert(data);
    } 
  };

  // TODO, only publish needed Location data to client

  // fix for old logins
  _.each(Meteor.users.find({profile: {$exists: false}}).fetch(), function(user) {
    Meteor.users.update(user._id, {$set: {profile: {}}});
  });
  _.each(Meteor.users.find({'profile.name': {$exists: false}}).fetch(), function(user) {
    Meteor.users.update(user._id, {$set: {'profile.name': 'Anonymous'}});
  });
  _.each(Meteor.users.find({'profile.pic': {$exists: false}}).fetch(), function(user) {
    Meteor.users.update(user._id, {$set: {'profile.pic': '/avatar-empty.png'}});
  });

  Meteor.startup(function () {
    // code to run on server at startup
  });

  var loginServiceConf = {};
  Accounts.loginServiceConfiguration.find().observe({
    'added': function(doc) {
      loginServiceConf[doc.service] = doc
    }
  });

  // facebook: appId, secret
  // github: clientId, secret
  // google: clientId, secret

  var Github = Meteor.require('github');
  var github = new Github({version: "3.0.0"});
  github.user = Async.wrap(github.user, ['get']);

  var googleapis = Meteor.require('googleapis'),
    OAuth2Client = googleapis.OAuth2Client;
  if (loginServiceConf.google)
  var oauth2Client = new OAuth2Client(
    loginServiceConf.google.clientId, loginServiceConf.google.secret, process.env.ROOT_URL);

  var gclient;
  googleapis
    .discover('plus', 'v1')
    .execute(function(err, client) {
      gclient = client;
  });

  var gm = Meteor.require('googlemaps');
  gm.geocode = Async.wrap(gm.geocode);

  var fbgraph = Meteor.require('fbgraph');
  fbgraph.get = Async.wrap(fbgraph.get);

  Accounts.onCreateUser(function(options, user) {
    if (!user.services)
      return;

    if (user.services.github) {

      github.authenticate({
          type: "oauth",
          token: user.services.github.accessToken
      });

      var res = github.user.get({
          user: "gadicohen"
      });

      options.profile.pic = res.avatar_url;
      options.profile.location = res.location;

    } else if (user.services.google) {

      oauth2Client.credentials = {
        access_token: user.services.google.accessToken
      };

      var wrap = Meteor.sync(function(done) {
          gclient
          .plus.people.get({ userId: 'me' })
          .withAuthClient(oauth2Client)
          .execute(done)
      });

      options.profile.location = wrap.result.placesLived[0].value;
      options.profile.pic = user.services.google.picture;

    } else if (user.services.facebook) {

      var res = fbgraph.get('me?fields=location&access_token='
        + user.services.facebook.accessToken);

      options.profile.location = res.location.name;
      options.profile.pic = '//graph.facebook.com/'+user.services.facebook.id+'/picture';

    } else {

      console.log(options);
      console.log(user);

    }

    if (!options.profile)
      options.profile = {};

    if (options.profile.location)
      locations.check(options.profile.location);

    if (!options.profile.pic)
      options.pic = '/avatar-empty.png';

    if (!options.profile.name)
      options.pic = 'Anonymous';

    user.profile = options.profile;

    return user;
  });

  Meteor.methods({
    'checkLocation': function(location) {
      if (this.userId) {
        locations.check(location);
      }
    }
  });

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
}
