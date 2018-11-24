#!/usr/bin/env node
'use strict'

const program = require('commander');

const fs   = require('fs');
const chalk = require('chalk');
const PNG = require('pngjs').PNG;
const pixelmatch = require('pixelmatch');
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

try {
  compareShots(config, program)
    .then(() => console.log(chalk.blue('Comparisons done!')));
} catch(e) {
  console.error(e);
  process.exit(1);
}

async function compareShots(config, program) {
  const paths = Object.keys(config.paths).reduce((acc,path) => {
    const widths = config.screen_widths.map((width) => {
      const domains = Object.keys(config.domains).reduce((out, domain) => {
        out[domain] = `${config.directory}/${path}/${width}_chrome_${domain}.png`;
        return out;
      }, {});
      domains.diff = `${config.directory}/${path}/${width}_chrome_diff.png`;
      domains.log = `${config.directory}/${path}/${width}_chrome_data.txt`;
      return domains;
    });
    acc = [
      ...acc,
      ...widths,
    ];
    return acc;
  }, []);
  // paths is now a flat array of objects
  for (const screenpath of paths) {
    console.log(chalk.blue(`diffing ${screenpath.diff}`));
    await imageDiff(screenpath, config);
  }
}

async function imageDiff(items, config) {
  const domainKeys = Object.keys(config.domains);
  return new Promise((resolve, reject) => {
    const img1 = fs.createReadStream(items[domainKeys[0]]).pipe(new PNG()).on('parsed', doneReading);
    const img2 = fs.createReadStream(items[domainKeys[1]]).pipe(new PNG()).on('parsed', doneReading);

    let filesRead = 0;
    function doneReading() {
      if (++filesRead < 2) {
        return;
      }
      const width = Math.max(img1.width, img2.width);
      if (img1.width != img2.width) {
        if (img1.width > img2.width) {
          console.log(chalk.yellow(`img2 width difference ${img2.width} should be ${width}. Adjusting...`));
          img2.width = width;
          img2.pack().pipe(fs.createWriteStream(items[domainKeys[1]]));
        } else {
          console.log(chalk.yellow(`img1 width difference ${img1.width} should be ${width}. Adjusting...`));
          img1.width = width;
          img1.pack().pipe(fs.createWriteStream(items[domainKeys[0]]));

        }
      }
      const height = Math.max(img1.height, img2.height);
      if (img1.height != img2.height){
        // Adjust the smaller to match
        if (img1.height > img2.height) {
          console.log(chalk.yellow(`img2 height difference ${img2.height} should be ${height}. Adjusting...`));
          img2.height = height;
          img2.pack().pipe(fs.createWriteStream(items[domainKeys[1]]));
        } else {
          console.log(chalk.yellow(`img1 height difference ${img1.height} should be ${height}. Adjusting...`));
          img1.height = height;
          img1.pack().pipe(fs.createWriteStream(items[domainKeys[0]]));

        }
      }
      const diff = new PNG({width, height});
      const numDiffPixels = pixelmatch(img1.data, img2.data, diff.data, width, height, {
        threshold: 0.06,
      });
      diff.pack().pipe(fs.createWriteStream(items.diff));
      const percent = numDiffPixels * 100 / (width * height);
      fs.writeFileSync(items.log, percent.toFixed(2));

      console.log(chalk.green(`Diff for ${items.diff}: ${percent}%`));
      resolve();
    }
  });
}