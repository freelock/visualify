#!/usr/bin/env node

import { program } from 'commander';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

program
  .option('-c, --config-file <config-file>', 'Configuration file')
  .option('-d, --defaults-file <defaults-file>', 'Default configuration')
  .option('-r, --allow-root', 'Pass the --no-sandbox option to Puppeteer to allow root')
  .option('--debug', 'Show browser while doing snaps')
  .option('-o, --output-directory [shots-dir]', 'Output directory for tests, directory in config file')
  .parse(process.argv);

const domains = program.args;
const opts = program.opts();

// Build common arguments
const commonArgs = [];
if (opts.configFile) commonArgs.push('-c', opts.configFile);
if (opts.defaultsFile) commonArgs.push('-d', opts.defaultsFile);
if (opts.outputDirectory) commonArgs.push('-o', opts.outputDirectory);
if (opts.allowRoot) commonArgs.push('-r');
if (opts.debug) commonArgs.push('--debug');

// Add domain arguments
const allArgs = [...commonArgs, ...domains];

async function runCommand(scriptName, args) {
  return new Promise((resolve, reject) => {
    console.log(`Running ${scriptName}...`);
    const scriptPath = path.join(__dirname, scriptName);
    const child = spawn('node', [scriptPath, ...args], {
      stdio: 'inherit',
      env: process.env
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        console.log(`${scriptName} completed successfully`);
        resolve();
      } else {
        reject(new Error(`${scriptName} failed with exit code ${code}`));
      }
    });
    
    child.on('error', reject);
  });
}

async function runAll() {
  try {
    await runCommand('visualify-capture.js', allArgs);
    await runCommand('visualify-compare.js', allArgs);
    await runCommand('visualify-thumbnail.js', allArgs);
    await runCommand('visualify-gallery.js', allArgs);
    console.log('All steps completed successfully!');
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

runAll();
