#!/usr/bin/env node
'use strict'

import { program } from 'commander';

import fs from 'fs';
import chalk from 'chalk';
import sharp from 'sharp';
import path from 'path';
import loadConfig from './lib/loadConfig.js';

program
  .option('-c, --config-file <config-file>', 'Configuration file')
  .option('-d, --defaults-file <defaults-file>', 'Default configuration')
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

try{
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

  const thumb_width = config.gallery.thumb_width || 200;
  const thumb_height = config.gallery.thumb_height || 400;

  createThumbs(config, thumb_width, thumb_height)
    .then(() => console.log(chalk.green('Thumbnails Generated!')));
} catch (e) {
  if (debug) {
    console.error(e);
  }
  program.error(e.message);
}

async function createThumbs(config, thumb_width, thumb_height) {
  // Ensure thumbnails directory exists
  const thumbnailsDir = `${config.directory}/thumbnails`;
  if (!fs.existsSync(thumbnailsDir)) {
    fs.mkdirSync(thumbnailsDir, { recursive: true });
  }
  
  for (const path in config.paths) {
    const origPath = `${config.directory}/${path}`;
    const thumbPath = `${config.directory}/thumbnails/${path}`;
    
    // Ensure the specific thumbnail path exists
    if (!fs.existsSync(thumbPath)) {
      fs.mkdirSync(thumbPath, { recursive: true });
    }
    
    const originals = fs.readdirSync(origPath);
    for (const file of originals) {
      if (file.indexOf('.png') > 0) {
        const origFile = `${origPath}/${file}`;
        const thumbFile = `${thumbPath}/${file}`;
        console.log(`Resize ${origFile}`);
        await sharp(origFile)
          .resize(thumb_width, thumb_height, {
            position: 'top',
          })
          .toFile(thumbFile);
      }
    }
  }

}

