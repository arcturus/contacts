'use strict';

var COMMS_APP_ORIGIN = document.location.protocol + '/contacts//' +
  document.location.host;

window.opener.postMessage('closed', COMMS_APP_ORIGIN);
window.close();
