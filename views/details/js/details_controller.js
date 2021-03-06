'use strict';

/* global ContactsService */
/* global ContactToVcardBlob */
/* global LazyLoader */
/* global MatchService */
/* global MozActivity */
/* global NFC */
/* global ParamUtils */
/* global utils */
/* global VcardFilename */

/* exported Details */

/*
 * Once the details view is loaded, we will listen for events dispatched
 * from the UI. These events will come with the info needed in order
 * to execute actions related with the UI (back, toggle favorite, share...).
 *
 * Controller will *not* contain any code related with the DOM/UI,
 * and will rely on the info provided by the events.
 */
(function(exports) {

  var _activity = null;
  var _contactID;

  function setActivity(activity) {
    _activity = activity;
  }

  function saveChanges(event) {
    var eventsStringified = sessionStorage.getItem('contactChanges');
    var events = [];
    if (eventsStringified && eventsStringified !== 'null') {
      var candidates = JSON.parse(eventsStringified);
      // Remove old events related with the same action on
      // the contact (i.e. marking as 'favourite')
      events = candidates.filter(function(a) {
        return a.reason !== event.reason;
      });
    }
    events.push({
      contactID: event.contactID,
      reason: event.reason
    });
    sessionStorage.setItem('contactChanges', JSON.stringify(events));
  }

  function findDuplicates(evt) {
    if (!evt.detail || !evt.detail.contactId) {
      console.error('Missing parameters in CustomEvent');
      return;
    }

    var contactId = evt.detail.contactId;
    var dependencies = [
      '/js/match_service.js'
    ];

    function onContactMerged(event) {
      // Save in session storage
      saveChanges(event);
      // Close the window
      window.postMessage({
        type: 'window_close'
      }, location.origin);
      // Go back in history until reaching the list
      window.history.back();
    }

    LazyLoader.load(
      dependencies,
      function onLoaded() {
        window.addEventListener('message', function handler(e) {
          // Filter by origin
          if (e.origin !== location.origin) {
            return;
          }

          switch(e.data.type) {
            case 'ready':
              ContactsService.addListener(
                'contactchange',
                onContactMerged
              );
              break;
            case 'window_close':
              window.removeEventListener('message', handler);
              ContactsService.removeListener(
                'contactchange',
                onContactMerged
              );
              break;
          }
        });
        MatchService.match(contactId);
      }
    );
  }

  function listenContactChanges() {
    return new Promise(function(resolve, reject) {
      ContactsService.addListener('contactchange',
        function oncontactchange(event) {
          ContactsService.removeListener('contactchange', oncontactchange);
          saveChanges(event);
          resolve();
        }
      );
    });
  }

  function toggleFavorite(evt){
    if (!evt.detail || typeof evt.detail.contact === 'undefined' ||
      typeof evt.detail.isFavorite === 'undefined') {
      console.error('Missing parameters in CustomEvent');
      return;
    }

    var contact = evt.detail.contact;
    var isFavorite = evt.detail.isFavorite;
    var favorite = !isFavorite;
    if (favorite) {
      contact.category = contact.category || [];
      contact.category.push('favorite');
    } else {
      if (!contact.category) {
        return;
      }
      var pos = contact.category.indexOf('favorite');
      if (pos > -1) {
        contact.category.splice(pos, 1);
      }
    }

    function onError(e) {
      console.error('Error saving favorite');
      // We must restore contact in order to update the UX accordingly
      if (favorite) {
        var pos = contact.category.indexOf('favorite');
        if (pos > -1) {
          contact.category.splice(pos, 1);
        }
      } else {
        contact.category = contact.category || [];
        contact.category.push('favorite');
      }

      dispatchEvent('toggleFavoriteDone', {contact: contact});
    }

    // Listening to oncontactchange event, we can save the evt
    // and send it via sessionStorage to the main list in order to
    // update it accordingly with the changes made by the user in this view.

    listenContactChanges().then(function() {
      ContactsService.get(contact.id, function(savedContact) {
        dispatchEvent('toggleFavoriteDone', {contact: savedContact});
      }, onError);
    });

    // Save contact with 'favorite' param updated properly
    ContactsService.save(
      utils.misc.toMozContact(contact),
      function(e) {
        if (typeof e !== 'undefined') {
          onError(e);
          return;
        }
      }
    );
  }

  function init() {
    window.addEventListener('backAction', handleBackAction);
    window.addEventListener('editAction', handleEditAction);
    window.addEventListener('toggleFavoriteAction', toggleFavorite);
    window.addEventListener('shareAction', shareContact);
    window.addEventListener('findDuplicatesAction', findDuplicates);
  }

  function shareContact(evt) {
    const VCARD_DEPS = [
      '/shared/js/text_normalizer.js',
      '/shared/js/contact2vcard.js',
      '/shared/js/setImmediate.js'
    ];

    if (!evt.detail || typeof evt.detail.contact === 'undefined') {
      console.error('Missing parameters in CustomEvent');
      return;
    }

    var contact = evt.detail.contact;

    LazyLoader.load(VCARD_DEPS,function vcardLoaded() {
      ContactToVcardBlob([contact], function blobReady(vcardBlob) {
        VcardFilename(contact).then(filename => {
           /* jshint nonew: false */
          new MozActivity({
            name: 'share',
            data: {
              type: 'text/vcard',
              number: 1,
              blobs: [new window.File([vcardBlob], filename, {
                type: 'text/x-vcard'
              })],
              filenames: [filename]
            }
          });
        });
        // The MIME of the blob should be this for some MMS gateways
      }, { type: 'text/x-vcard'} );
    });
  }

  function handleBackAction(evt) {
    if (_activity) {
      _activity.postResult({});
    } else {
      window.history.back();
    }
  }

  function setContact(contactID) {
    _contactID = contactID;
    LazyLoader.load('/js/nfc.js', () => {
      ContactsService.get(contactID, contact => {
        NFC.startListening(contact);
      }, error => {
        console.error('Could not get contact from ID %s. ' +
                      'Unable to initialize NFC. %s', contactID, error);
      });
    });
  }

  function handleEditAction(evt) {
    window.location.href = ParamUtils.generateUrl(
      'form',
      {
        'action': 'update',
        'contact': _contactID
      }
    );
  }

  function dispatchEvent(name, data) {
    window.dispatchEvent(new CustomEvent(name, {detail: data}));
  }

  exports.DetailsController = {
    'init': init,
    'setActivity': setActivity,
    'setContact': setContact
  };
})(window);
