if (Meteor.isClient) {

  markerInfo = function(marker) {
    console.log(marker);
    console.log(infowindow);
    infowindow.setContent('moo');
    infowindow.open(map, marker);
  }

  var userQueues = {};
  var addUserToMap = function(user) {
    var location = locations.get(user.profile.location);
    if (location) {
      var marker = new google.maps.Marker({
              position: new google.maps.LatLng(location.lat, location.lng),
              //map: map
      });

      google.maps.event.addListener(marker, 'click', function() {
        var node = $('<div style="width: 200px; height: 150px;" class="infowindow">'
          + '<p><b>' + user.profile.name + '</b></p>'
          + '<p>' + user.profile.location + '</p>'
          + '<p><img src="' + user.profile.pic + '" /></p>'
          + '</div>')[0];
        infowindow.setContent(node);
        infowindow.setOptions({maxWidth: 500});
        infowindow.open(map, marker);                
      });

      markerCluster.addMarker(marker);

    } else {
      if (!userQueues[user.profile.location])
        userQueues[user.profile.location] = [];
      userQueues[user.profile.location].push(user);
      console.log('no location for ' + user.profile.location);
    }
  }

  GoogleMaps.init(
      {
          'sensor': true, //optional
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

          Meteor.users.find().observe({
            'added': function(user) {
              addUserToMap(user);
            }
          });

          return;

          var marker, i, markers = [];
          var locations = ['Herzliya, Israel'];
          return;

          for (i = 0; i < locations.length; i++) {  
            marker = new google.maps.Marker({
              position: locations[i] //new google.maps.LatLng(locations[i][1], locations[i][2]),
              //map: map
            });

            google.maps.event.addListener(marker, 'click', (function(marker, i) {
              return function() {
                infowindow.setContent(locations[i][0]);
                infowindow.open(map, marker);
              }
            })(marker, i));

            markers.push(marker);
          }

          var markerCluster = new MarkerClusterer(map, markers);  

      }
  );

  Accounts.ui.config({
    requestPermissions: {
      facebook: ['user_location'],
      github: ['user'],
      google: ['profile']
    }
  });

  fbInit = function() {
    // don't init until FB API available
    Deps.autorun(function() {
      var user = Meteor.user();
      if (!user)
        return;

      // TODO, rather do this server side
      if (!user.profile.location) {
        if (user.services.facebook) {
          FB.api('/me?fields=location',
            { access_token: user.services.facebook.accessToken },
            function(response) {
              Meteor.users.update(user._id, { $set: {
                'profile.location': response.location.name
              }});
              Meteor.call('checkLocation', response.location.name);
              addUserToMap(Meteor.user());
            });
        }
      }
    });
 
  }

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

    // now we have the location data, dequeue
    if (Meteor.isClient) {
      if (userQueues[doc.reqName]) {
        _.each(userQueues[doc.reqName], function(user) {
          console.log('dequeue');
          addUserToMap(user);
        });
        delete(userQueues[doc.ReqName]);
      }
    }
  }
});


if (Meteor.isServer) {
  locations.check = function(name) {
    if (!this.get(name)) {
      var res = gm.geocode(name);
      var data = res.results[0];
      data.reqName = name;
      Locations.insert(data);
    } 
  };

  // TODO, only publish needed Location data to client

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

      options.profile.pic = '//graph.facebook.com/'+user.services.facebook.id+'/picture';

    } else {

      console.log(options);
      console.log(user);

    }

    if (options.profile.location)
      locations.check(options.profile.location);

    if (options.profile)
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
}
