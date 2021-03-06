/* global DetailsUI, DetailsController, LazyLoader, ContactsService,
          ParamUtils */
'use strict';

/*
 * This class is the one in charge of loading the minimum set of
 * resources needed for the view to load. Any other JS/CSS/Element
 * not needed in the critical path *must* be lazy loaded when needed.
 *
 * Once localization and all the basic JS/CSS/Elements are loaded,
 * we will initialize UI and Controller. Both JS classes *must* be
 * independent and will communicate through events.
 */
window.addEventListener('DOMContentLoaded', function() {
  LazyLoader.load(['/shared/js/l10n.js']).then(function() {
    LazyLoader.load([
      document.getElementById('view-contact-details')
    ]).then(function() {
      // TODO Add if needed
    });
  });
});

window.onload = function() {
  var dependencies = [
    '/js/param_utils.js',
    '/services/contacts.js',
    '/shared/js/l10n_date.js',
    '/shared/js/contact_photo_helper.js',
    '/shared/js/contacts/contacts_buttons.js',
    '/shared/js/text_normalizer.js',
    '/shared/js/contacts/utilities/dom.js',
    '/shared/js/contacts/utilities/templates.js',
    '/shared/js/contacts/import/utilities/misc.js',
    '/views/details/js/details_ui.js',
    '/views/details/js/details_controller.js',
    '/shared/pages/import/js/curtain.js'
  ];

  LazyLoader.load(dependencies).then(function() {
    DetailsUI.init();
    DetailsController.init();

    window.addEventListener('renderdone', function fn() {
      window.removeEventListener('renderdone', fn);
      document.body.classList.remove('hidden');
    });

    function getContactInfo(id) {
      return new Promise(function(resolve, reject) {
        ContactsService.get(id, function onSuccess(savedContact) {
          ContactsService.getCount(function(count) {
            resolve(
              {
                contact: savedContact,
                count: count
              }
            );
          });
        }, function onError() {
          console.error('Error retrieving contact');
          reject();
        });
      });
    }

    function checkIfUpdate(params) {
      var changesStringified = sessionStorage.getItem('contactChanges');
      if (!changesStringified ||
          changesStringified === 'null') {
        return;
      }
      var changes = JSON.parse(changesStringified);
      if (!changes || !changes[0] || !changes[0].reason) {
        return;
      }

      if (changes[0].reason === 'update') {
        getContactInfo(params.contact).then(function(info) {
          DetailsUI.render(info.contact, info.count, false);
        });
      }
    }

    // Get action from URL (new or update)
    var params = ParamUtils.get();
    if (params && params.contact) {
      getContactInfo(params.contact).then(function(info) {
        DetailsController.setContact(params.contact);
        DetailsUI.render(info.contact, info.count, false);
        window.addEventListener(
          'pageshow',
          function onPageshow() {
            // XXX: We need to get back the theme color
            // due to the bug with back&forward cache
            // https://bugzilla.mozilla.org/show_bug.cgi?id=1184953
            var meta = document.querySelector('meta[name="theme-color"]');
            document.head.removeChild(meta);
            meta = document.createElement('meta');
            meta.content = 'var(--header-background)';
            meta.name = 'theme-color';
            document.head.appendChild(meta);

            checkIfUpdate(params);
          }

        );
      });
    }

    navigator.mozSetMessageHandler('activity', activity => {
      DetailsController.setActivity(activity);
      var id = activity.source.data.params.id;

      // TODO: Implement handler for open Vcards

      ContactsService.get(id, function onSuccess(savedContact) {
        ContactsService.getCount(count => {
          DetailsUI.render(savedContact, count, true);
        });
      }, function onError() {
        console.error('Error retrieving contact');
      });
    });

  });
};
