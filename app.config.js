// Extends app.json. google-services.json (from the Firebase console) is what
// lets Android receive push alerts; it is only wired in once it exists, so the
// app still builds before Firebase has been set up.
const fs = require('fs');
const path = require('path');

module.exports = ({ config }) => {
  if (fs.existsSync(path.join(__dirname, 'google-services.json'))) {
    config.android = { ...config.android, googleServicesFile: './google-services.json' };
  }
  return config;
};
