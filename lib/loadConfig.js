'use strict';

const yaml = require('js-yaml');
const fs   = require('fs');

module.exports = {
  load(defaultsFile, configFile) {
    const defaults = yaml.safeLoad(fs.readFileSync(defaultsFile, 'utf8'));
    const testdoc = yaml.safeLoad(fs.readFileSync(configFile, 'utf8'));
    const config = {
      ...defaults,
      ...testdoc,
    };
    return config;
  }
}