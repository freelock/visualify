#!/usr/bin/env node

const program = require('commander');

const fs   = require('fs');
const isDocker = require('is-docker');
const chalk = require('chalk');
const puppeteer = require('puppeteer');
const loadConfig = require('./lib/loadConfig.js');

const browserOptions = {};

// in a docker container, need no sandbox
if (isDocker()) {
  browserOptions.args = ['--no-sandbox', '--disable-setuid-sandbox'];
}

// Set a 1 minute timeout, instead of defualt 30 seconds
const requestOpts = {
  timeout: 60000,
};

program
  .option('-c, --config-file <config-file>', 'Configuration file')
  .option('-d, --defaults-file <defaults-file>', 'Default configuration')
  .option('--debug', 'Show browser while doing snaps')
  .option('-o, --output-directory [shots-dir]', 'Output directory for tests, directory in config file')
  .parse(process.argv);

let domains = program.args;
const config = loadConfig.load(program.defaultsFile, program.configFile, domains);

const shotsDir = program.outputDirectory ? program.outputDirectory : config.directory;
config.directory = shotsDir;

// Set up directories
if (!fs.existsSync(shotsDir)) fs.mkdirSync(shotsDir);
if (!fs.existsSync(`${shotsDir}/thumbnails`)) fs.mkdirSync(`${shotsDir}/thumbnails`);
Object.keys(config.paths).map((name) => {
  if (!fs.existsSync(`${shotsDir}/${name}`)) fs.mkdirSync(`${shotsDir}/${name}`);
  if (!fs.existsSync(`${shotsDir}/thumbnails/${name}`)) fs.mkdirSync(`${shotsDir}/thumbnails/${name}`);
});

try {
  capture(config, program)
    .then(() => console.log(chalk.green('Screenshots done!')));
} catch (e) {
  console.error(e);
  process.exit(1);
}

async function capture(config, program) {
  let browser, path
  try {
    if (program.debug) {
      browserOptions.headless = false;
    }
    browser = await puppeteer.launch(browserOptions);
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
    const url = config.domains[domain] + config.paths[path];
    // Cycle through each resolution
    const filenames = config.screen_widths.map(function(width) {
      return {
        width: viewport(width),
        filepath: `${config.directory}/${path}/${width}_chrome_${domain}.png`,
      };
    });
    await page.goto(url, requestOpts);
    for (item in filenames) {
      await page.setViewport(filenames[item].width);
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
