// github
var Github = Meteor.require('github');
var github = new Github({version: "3.0.0"});
github.user = Async.wrap(github.user, ['get']);

// google
var googleapis = Meteor.require('googleapis');
var oauth2client; // init on account observe
var gclient; // init below on discover

googleapis
  .discover('plus', 'v1')
  .execute(function(err, client) {
    gclient = client;
});

// facebook
var fbgraph = Meteor.require('fbgraph');
fbgraph.get = Async.wrap(fbgraph.get);

/*
 * facebook: appId, secret
 * github: clientId, secret
 * google: clientId, secret
 */
var loginServiceConf = {};
Accounts.loginServiceConfiguration.find().observe({
  'added': function(doc) {
    loginServiceConf[doc.service] = doc
    if (doc.service == 'google')
      oauth2client = new googleapis.OAuth2Client(
        doc.clientId, doc.secret, process.env.ROOT_URL);
  }
});

Accounts.onCreateUser(function(options, user) {
  if (!user.services)
    return;

  if (user.services.github) {

    github.authenticate({
        type: "oauth",
        token: user.services.github.accessToken
    });

    var res = github.user.get({});
    options.profile.pic = res.avatar_url;
    options.profile.location = res.location;

  } else if (user.services.google) {

    oauth2client.credentials = {
      access_token: user.services.google.accessToken
    };

    var wrap = Meteor.sync(function(done) {
        gclient
        .plus.people.get({ userId: 'me' })
        .withAuthClient(oauth2client)
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
