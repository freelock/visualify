#!/usr/bin/env node
'use strict'

const program = require('commander');

const fs   = require('fs');
const sharp = require('sharp');
const chalk = require('chalk');
const loadConfig = require('./lib/loadConfig.js');

program
  .option('-c, --config-file <config-file>', 'Configuration file')
  .option('-d, --defaults-file <defaults-file>', 'Default configuration')
  .option('--debug', 'Show browser while doing snaps')
  .option('-o, --output-directory [shots-dir]', 'Output directory for tests, directory in config file')
  .parse(process.argv);

const config = loadConfig.load(program.defaultsFile, program.configFile);
const shotsDir = program.outputDirectory ? program.outputDirectory : config.directory;
config.directory = shotsDir;

const thumb_width = config.gallery.thumb_width || 200;
const thumb_height = config.gallery.thumb_height || 400;

try{
  createThumbs(config, thumb_width, thumb_height)
    .then(() => console.log(chalk.green('Thumbnails Generated!')));
} catch (e) {
  console.error(e);
  process.exit(1);
}

async function createThumbs(config, thumb_width, thumb_height) {
  for (const path in config.paths) {
    const origPath = `${config.directory}/${path}`;
    const thumbPath = `${config.directory}/thumbnails/${path}`;
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

