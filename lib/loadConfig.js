'use strict';

const yaml = require('js-yaml');
const fs   = require('fs');

module.exports = {
  load(defaultsFile, configFile, domain) {
    let defaults, testdoc = {};
    if (fs.existsSync(defaultsFile)) {
      defaults = yaml.safeLoad(fs.readFileSync(defaultsFile, 'utf8'));
    } else {
      defaults = yaml.safeLoad(fs.readFileSync(`${__dirname}/../capture.yaml`, 'utf8'));
    }
    if (fs.existsSync(configFile)) {
      testdoc = yaml.safeLoad(fs.readFileSync(configFile, 'utf8'));
    }

    const config = {
      ...defaults,
      ...testdoc,
    };
    if (domain.length) {
      config.domains = {}
      config.domains[domain[0]] = domain[1];
      config.domains[domain[2]] = domain[3];
    }
    if (!config.domains) {
      throw new Error('You must provide domains to test, either in a config file or as arguments.')
    }
    if (!config.paths) {
      throw new Error('You must provide paths to test in a config file or defaults file.')
    }
    return config;
  }
}