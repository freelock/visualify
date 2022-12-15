#!/usr/bin/env node

import { program } from 'commander';

import fs from 'fs';
import chalk from 'chalk';
import loadConfig from './lib/loadConfig.js';
import isDocker from 'is-docker';
import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const browserOptions = {};

// in a docker container, need no sandbox
if (isDocker()) {
  browserOptions.args = ['--no-sandbox', '--disable-setuid-sandbox'];
}

// Set a 1 minute timeout, instead of defualt 30 seconds - bump to 90 seconds
let requestOpts = {
  timeout: 90000,
};

program
  .option('-c, --config-file <config-file>', 'Configuration file')
  .option('-d, --defaults-file <defaults-file>', 'Default configuration')
  .option('-r, --allow-root', 'Pass the --no-sandbox option to Puppeteer to allow root')
  .option('--debug', 'Show browser while doing snaps')
  .option('-o, --output-directory [shots-dir]', 'Output directory for tests, directory in config file')
  .parse(process.argv);

let domains = program.args;
try {
  const {
    defaultsFile,
    configFile,
    outputDirectory,
    debug,
    allowRoot,
  } = program.opts();
  const config = loadConfig.load(defaultsFile, configFile, domains);

  const shotsDir = outputDirectory ? outputDirectory : config.directory;
  config.directory = shotsDir;

  // Set up directories
  if (!fs.existsSync(shotsDir)) fs.mkdirSync(shotsDir);
  if (!fs.existsSync(`${shotsDir}/thumbnails`)) fs.mkdirSync(`${shotsDir}/thumbnails`);
  Object.keys(config.paths).map((name) => {
    if (!fs.existsSync(`${shotsDir}/${name}`)) fs.mkdirSync(`${shotsDir}/${name}`);
    if (!fs.existsSync(`${shotsDir}/thumbnails/${name}`)) fs.mkdirSync(`${shotsDir}/thumbnails/${name}`);
  });

  // Read adblock hosts...
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const hostFile = fs.readFileSync(`${__dirname}/hosts.txt`, 'utf8').split('\n');
  const hosts = hostFile.reduce((agg, line) => {
    const frags = line.split(' ');
    if (frags.length > 1 && frags[0] === '0.0.0.0') {
      agg[frags[1].trim()] = true;
    }
    return agg;
  }, {});

  // Support requestOpts
  if (config.requestOpts) {
    requestOpts = {...requestOpts, ...config.requestOpts};
  }

  capture(config, debug, allowRoot)
    .then(() => console.log(chalk.green('Screenshots done!')))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
} catch (e) {
  if (debug) {
    console.error(e);
  }
  program.error(e.message);
}

async function capture(config, debug, allowRoot) {
  let path
  try {
    if (debug) {
      browserOptions.headless = false;
    }
    if (allowRoot) {
      browserOptions.args = ['--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage'];
    }
    browserOptions.ignoreHTTPSErrors = true;
    const browser = await puppeteer.launch(browserOptions);
    // Create snapshots -- can't use Array.map here because it launches too many browsers
    for (path in config.paths) {
      await retry(snapPath, [path, config, browser]);
    }
    return browser.close();
  } catch (e) {
    browser.close();
    console.error(e);
    process.exit(1);
  }
}

/**
 * Convert a string width or widthXheight
 * into an object with width and height properties
 * @param string width
 */
function viewport(width) {
  if (typeof(width) == 'number') {
    return {
      width,
      height: 800,
    };
  }
  const xpos = width.indexOf('x');
  let vp = {
    width: width,
    height: 800,
  }
  if (xpos > 1) {
    vp.width = width.substring(0, xpos) * 1;
    vp.height = width.substring(xpos+1) * 1;
  }
  return vp;
}

async function snapPath(path, config, browser) {
  for (const domain in config.domains) {
    const page = await browser.newPage();
    if (config.auth) {
      await page.authenticate({'username': config.auth.username, 'password': config.auth.password});
    }
    if (config.blockads) {
      await page.setRequestInterception(true);
      console.log('Blocking ads from ad hosts');
      // Block ad technique lifted from https://stackoverflow.com/questions/53807574/how-to-block-ads-with-puppeteer-headless-chrome
      page.on('request', request => {
        if (config.blockads) {
          let domain = null;
          const frags = request.url().split('/');
          if (frags.length > 2) {
            domain = frags[2];
          }
          if (hosts[domain] === true) {
            request.abort();
            return;
          }
        }
        request.continue();
      });
    }
    const url = config.domains[domain] + config.paths[path];
    // Cycle through each resolution
    const filenames = config.screen_widths.map(function(width) {
      return {
        width: viewport(width),
        filepath: `${config.directory}/${path}/${width}_chrome_${domain}.png`,
      };
    });
    await page.goto(url, requestOpts);
    for (let item in filenames) {
      await page.setViewport(filenames[item].width);
      const height = page.viewport().height;
      await page.screenshot({path: filenames[item].filepath, fullPage: true});
      console.log(chalk.green(`Snapped ${filenames[item].filepath}`));
    }
    await page.close();
  };
}

/**
 * Retries the given function until it succeeds given a number of retries and an interval between them. They are set
 * by default to retry 5 times with 1sec in between. There's also a flag to make the cooldown time exponential
 * @author Daniel Iñigo <danielinigobanos@gmail.com>
 * @param {Function} fn - Returns a promise
 * @param {Array} params - Arguments to pass to fn
 * @param {Number} retriesLeft - Number of retries. If -1 will keep retrying
 * @param {Number} interval - Millis between retries. If exponential set to true will be doubled each retry
 * @param {Boolean} exponential - Flag for exponential back-off mode
 * @return {Promise<*>}
 *
 * original source: https://gitlab.com/snippets/1775781
 */
async function retry(fn, params, retriesLeft = 5, interval = 1000, exponential = false) {
  try {
    const val = await fn(...params);
    return val;
  } catch (error) {
    console.log('Error:', error);
    if (retriesLeft) {
      console.log(`Retrying...${retriesLeft} more times`);
      await new Promise(r => setTimeout(r, interval));
      return retry(fn, params, retriesLeft - 1, exponential ? interval * 2 : interval, exponential);
    } else throw new Error('Max retries reached');
  }
}
