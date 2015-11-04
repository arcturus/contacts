'use strict';
/* global LazyLoader, MatchingUI */

window.addEventListener('DOMContentLoaded', function() {
  LazyLoader.load(['/contacts/shared/js/l10n.js']).then(function() {
      // TODO Add if needed
  });
});

window.onload = function() {
  var dependencies = [
    '/contacts/shared/js/contact_photo_helper.js',
    '/contacts/shared/js/sanitizer.js',
    '/contacts/shared/js/contacts/import/utilities/misc.js',
    '/contacts/views/matching/js/matching_ui.js'
  ];

  window.screen.mozLockOrientation('portrait-primary');

  LazyLoader.load(dependencies).then(function() {
      MatchingUI.init();
  });
};
