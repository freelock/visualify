'use strict';

import yaml from 'js-yaml';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

export default {
  load(defaultsFile, configFile, domain) {
    let defaults, testdoc = {};
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    if (fs.existsSync(defaultsFile)) {
      defaults = yaml.load(fs.readFileSync(defaultsFile, 'utf8'));
    } else {
      defaults = yaml.load(fs.readFileSync(`${__dirname}/../configs/capture.yaml`, 'utf8'));
    }
    if (fs.existsSync(configFile)) {
      testdoc = yaml.load(fs.readFileSync(configFile, 'utf8'));
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
