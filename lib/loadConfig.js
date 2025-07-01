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
    
    // Helper function to resolve paths relative to original working directory
    const resolvePath = (filePath) => {
      if (!filePath) return filePath;
      if (path.isAbsolute(filePath)) return filePath;
      const originalCwd = process.env.VISUALIFY_ORIGINAL_CWD;
      return originalCwd ? path.resolve(originalCwd, filePath) : filePath;
    };
    
    const resolvedDefaultsFile = resolvePath(defaultsFile);
    const resolvedConfigFile = resolvePath(configFile);
    
    if (resolvedDefaultsFile && fs.existsSync(resolvedDefaultsFile)) {
      defaults = yaml.load(fs.readFileSync(resolvedDefaultsFile, 'utf8'));
    } else {
      defaults = yaml.load(fs.readFileSync(`${__dirname}/../configs/capture.yaml`, 'utf8'));
    }
    if (resolvedConfigFile && fs.existsSync(resolvedConfigFile)) {
      testdoc = yaml.load(fs.readFileSync(resolvedConfigFile, 'utf8'));
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
