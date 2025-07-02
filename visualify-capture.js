#!/usr/bin/env node

import { program } from 'commander';

import fs from 'fs';
import chalk from 'chalk';
import loadConfig from './lib/loadConfig.js';
import isDocker from 'is-docker';
import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

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
const opts = program.opts();

// Get options from command line or environment variables (global options passed from parent)
const defaultsFile = opts.defaultsFile || process.env.VISUALIFY_DEFAULTS_FILE;
const configFile = opts.configFile || process.env.VISUALIFY_CONFIG_FILE;
const outputDirectory = opts.outputDirectory || process.env.VISUALIFY_OUTPUT_DIRECTORY;
const debug = opts.debug || process.env.VISUALIFY_DEBUG === 'true';
const allowRoot = opts.allowRoot;

try {
  const config = loadConfig.load(defaultsFile, configFile, domains);

  let shotsDir = outputDirectory ? outputDirectory : config.directory;
  
  // Resolve output directory relative to original working directory
  if (shotsDir && !path.isAbsolute(shotsDir)) {
    const originalCwd = process.env.VISUALIFY_ORIGINAL_CWD;
    if (originalCwd) {
      shotsDir = path.resolve(originalCwd, shotsDir);
    }
  }
  
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
  let path;
  let browser;
  try {
    if (debug) {
      browserOptions.headless = false;
    } else {
      browserOptions.headless = 'new';
    }
    if (allowRoot) {
      browserOptions.args = ['--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage'];
    }
    browserOptions.ignoreHTTPSErrors = true;
    
    // Set browser executable path if not already set
    if (!browserOptions.executablePath && !process.env.PUPPETEER_EXECUTABLE_PATH) {
      // Try to find Chrome or Chromium in common locations
      try {
        // Try to find chrome/chromium using platform-appropriate commands
        let chromePath;
        const isWindows = process.platform === 'win32';
        const isMac = process.platform === 'darwin';
        
        if (isWindows) {
          // Windows browser detection
          const windowsPaths = [
            'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Users\\' + (process.env.USERNAME || process.env.USER || 'Default') + '\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files\\Chromium\\Application\\chromium.exe',
            'C:\\Program Files (x86)\\Chromium\\Application\\chromium.exe'
          ];
          
          for (const browserPath of windowsPaths) {
            if (fs.existsSync(browserPath)) {
              chromePath = browserPath;
              console.log(`Found browser at: ${browserPath}`);
              break;
            }
          }
          
          // Try using where command on Windows
          if (!chromePath) {
            const windowsBrowserNames = ['chrome.exe', 'chromium.exe'];
            for (const browserName of windowsBrowserNames) {
              try {
                chromePath = execSync(`where ${browserName}`, { encoding: 'utf8' }).trim().split('\n')[0];
                if (chromePath && fs.existsSync(chromePath)) {
                  console.log(`Found browser via where command: ${browserName} at ${chromePath}`);
                  break;
                }
              } catch {
                // Continue to next browser
              }
            }
          }
        } else if (isMac) {
          // macOS browser detection
          const macPaths = [
            '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            '/Applications/Chromium.app/Contents/MacOS/Chromium',
            '/usr/local/bin/chrome',
            '/usr/local/bin/chromium'
          ];
          
          for (const browserPath of macPaths) {
            if (fs.existsSync(browserPath)) {
              chromePath = browserPath;
              console.log(`Found browser at: ${browserPath}`);
              break;
            }
          }
          
          // Try using which command on macOS
          if (!chromePath) {
            const macBrowserNames = ['google-chrome', 'chromium', 'chrome'];
            for (const browserName of macBrowserNames) {
              try {
                chromePath = execSync(`which ${browserName}`, { encoding: 'utf8' }).trim();
                if (chromePath && fs.existsSync(chromePath)) {
                  console.log(`Found browser via which: ${browserName} at ${chromePath}`);
                  break;
                }
              } catch {
                // Continue to next browser
              }
            }
          }
        } else {
          // Linux/Unix browser detection
          const browserNames = [
            'google-chrome-stable',
            'google-chrome',
            'google-chrome-unstable',
            'chromium-browser',
            'chromium',
            'chrome'
          ];
          
          for (const browserName of browserNames) {
            try {
              chromePath = execSync(`which ${browserName}`, { encoding: 'utf8' }).trim();
              if (chromePath) {
                // Verify the executable actually exists and is executable
                if (fs.existsSync(chromePath)) {
                  console.log(`Found browser: ${browserName} at ${chromePath}`);
                  break;
                } else {
                  console.log(`Browser ${browserName} found at ${chromePath} but file doesn't exist, trying next...`);
                  chromePath = null;
                }
              }
            } catch {
              // Continue to next browser
            }
          }
          
          // If which command failed, try common static paths including nix store paths
          if (!chromePath) {
            const commonPaths = [
              '/usr/bin/google-chrome-stable',
              '/usr/bin/google-chrome',
              '/usr/bin/google-chrome-unstable',
              '/usr/bin/chromium-browser',
              '/usr/bin/chromium',
              '/usr/local/bin/chromium',
              '/snap/bin/chromium',
              '/bin/google-chrome-stable',
              '/bin/google-chrome',
              '/bin/chromium'
            ];
            
            // Also check for nix store paths by looking at symlinks
            if (fs.existsSync('/bin/google-chrome-stable')) {
              try {
                const realPath = fs.realpathSync('/bin/google-chrome-stable');
                if (fs.existsSync(realPath)) {
                  chromePath = realPath;
                  console.log(`Found browser via symlink resolution: ${realPath}`);
                }
              } catch (e) {
                console.log('Failed to resolve symlink for /bin/google-chrome-stable');
              }
            }
            
            if (!chromePath) {
              for (const browserPath of commonPaths) {
                if (fs.existsSync(browserPath)) {
                  chromePath = browserPath;
                  console.log(`Found browser at static path: ${browserPath}`);
                  break;
                }
              }
            }
          }
        }
        
        if (!chromePath) {
          console.warn('Warning: Could not find Chrome or Chromium. Make sure it is installed and in your PATH.');
        }
        if (chromePath) {
          browserOptions.executablePath = chromePath;
        }
      } catch (e) {
        console.warn('Warning: Error finding browser:', e.message);
      }
    }
    
    browser = await puppeteer.launch(browserOptions);
    // Create snapshots -- can't use Array.map here because it launches too many browsers
    for (path in config.paths) {
      await retry(snapPath, [path, config, browser]);
    }
    return browser.close();
  } catch (e) {
    if (browser) {
      browser.close();
    }
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
