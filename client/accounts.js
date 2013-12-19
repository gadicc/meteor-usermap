Accounts.ui.config({
  requestPermissions: {
    // https://developers.facebook.com/docs/facebook-login/permissions/
    facebook: ['user_location'],
    // https://developers.google.com/oauthplayground/
    // http://discovery-check.appspot.com/
    google: ['profile']
    /*
     * http://developer.github.com/v3/oauth/#scopes
     * unnecessary write permission.  profile is public by default
     * github: ['user']
     */
  }
});
