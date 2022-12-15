#!/usr/bin/env node
'use strict'

import { program } from 'commander';

import fs from 'fs';
import chalk from 'chalk';
import Mustache from 'mustache';
import loadConfig from './lib/loadConfig.js';
import path from 'path';
import { fileURLToPath } from 'url';

program
  .option('-c, --config-file <config-file>', 'Configuration file')
  .option('-d, --defaults-file <defaults-file>', 'Default configuration')
  .option('--debug', 'Show browser while doing snaps')
  .option('-o, --output-directory [shots-dir]', 'Output directory for tests, directory in config file')
  .parse(process.argv);

try {
  let domains = program.args;
  const {
    defaultsFile,
    configFile,
    outputDirectory,
    debug,
  } = program.opts();
  const config = loadConfig.load(defaultsFile, configFile, domains);
  const shotsDir = outputDirectory ? outputDirectory : config.directory;
  config.directory = shotsDir;

  /**
   * Template variables:
   *
   * - gallery_generated
   * - paths
   * -   .alias
   * -   .domain1name
   * -   .domain1url
   * -   .domain2name
   * -   .domain2url
   * -   .diffname
   * -   .widths
   * -     .width
   * -     .img1url
   * -     .thumb1url
   * -     .img2url
   * -     .thumb2url
   * -     .imgdiffurl
   * -     .thumbdiffurl
   * -     .diff
   * -     .threshold
   */

  const variables = {};

  // Generate path blocks with numeric keys to allow us to order correctly
  loadPaths(config)
    .then((paths) => {
      variables.paths = paths;
      variables.gallery_generated = new Date();
      saveGallery(config, variables)
        .then(() => console.log(chalk.green('Gallery generated.')));
    });
} catch (e) {
  if (debug) {
    console.error(e);
  }
  program.error(e.message);
}

async function loadPaths(config) {
  const domains = Object.keys(config.domains);
  const sortpaths = await Object.keys(config.paths).reduce((agg, path) => {
    const basePath = `${config.directory}/${path}`;
    const thumbPath = `thumbnails/${path}`;
    const imgPath = `${path}`;

    let maxDiff = 0;
    const widths = config.screen_widths.map((width) => {
      let threshold = '';
      let diff = 'Not detected';
      const logFilePath = `${basePath}/${width}_chrome_data.txt`;
      if (fs.existsSync(logFilePath)) {
        diff = fs.readFileSync(logFilePath,'utf8');
        if ((diff * 1) > maxDiff) {
          maxDiff = diff * 1;
        }
        if ((diff * 1) > config.threshold) {
          threshold = 'threshold';
          addLog(`WARN: ${path} failed at a resolution of ${width} (${diff}% diff)`);
        }
      }
      return {
        width,
        diff,
        threshold,
        img1url: `${imgPath}/${width}_chrome_${domains[0]}.png`,
        thumb1url: `${thumbPath}/${width}_chrome_${domains[0]}.png`,
        img2url: `${imgPath}/${width}_chrome_${domains[1]}.png`,
        thumb2url: `${thumbPath}/${width}_chrome_${domains[1]}.png`,
        imgdiffurl: `${imgPath}/${width}_chrome_diff.png`,
        thumbdiffurl: `${thumbPath}/${width}_chrome_diff.png`,
      };
    });
    agg.push({
      widths: widths,
      maxDiff,
      alias: path,
      domain1url: `${config.domains[domains[0]]}${config.paths[path]}`,
      domain2url: `${config.domains[domains[1]]}${config.paths[path]}`,
      domain1name: domains[0],
      domain2name: domains[1],
      diffname: 'diff',
    });
    return agg;
  }, []);
  // At this point sortpaths is an array of objects, each object has widths
  // (an array of objects) and maxwidth
  const sorted = sortpaths.sort((a, b) => {
    return (b.maxDiff * 100) - (a.maxDiff * 100);
  });
  return sortpaths;
}

async function saveGallery(config, variables) {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const template = fs.readFileSync(`${__dirname}/configs/${config.gallery.template}.mustache`, 'utf8');
  const rendered = Mustache.render(template, variables);
  fs.writeFileSync(`${config.directory}/gallery.html`, rendered);
}

function addLog(msg) {
  console.log(msg);
}
