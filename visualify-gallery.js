#!/usr/bin/env node
'use strict'

const program = require('commander');

const fs   = require('fs');
const chalk = require('chalk');
const Mustache = require('mustache');
const loadConfig = require('./lib/loadConfig.js');

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
try {
  loadPaths(config)
    .then((paths) => {
      variables.paths = paths;
      variables.gallery_generated = new Date(); 
      saveGallery(config, variables)
        .then(() => console.log(chalk.green('Gallery generated.')));
    });
} catch (e) {
  console.error(e);
  process.exit(1);
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
      const logFilePath = `${basePath}/${width}_chrome_data.txt`;
      const diff = fs.readFileSync(logFilePath,'utf8');
      if ((diff * 1) > maxDiff) {
        maxDiff = diff * 1;
      }
      if ((diff * 1) > config.threshold) {
        threshold = 'threshold';
        addLog(`WARN: ${path} failed at a resolution of ${width} (${diff}% diff)`);
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
  sortpaths.sort((a, b) => (a.maxDiff * 100) < (b.maxDiff * 100))
  return sortpaths;
}

async function saveGallery(config, variables) {
  const template = fs.readFileSync(`${__dirname}/configs/${config.gallery.template}.mustache`, 'utf8');
  const rendered = Mustache.render(template, variables);
  fs.writeFileSync(`${config.directory}/gallery.html`, rendered);
}

function addLog(msg) {
  console.log(msg);
}