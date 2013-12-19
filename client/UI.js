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
