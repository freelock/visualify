#!/usr/bin/env node
'use strict'

const program = require('commander');

const fs   = require('fs');
const chalk = require('chalk');
const sharp = require('sharp');
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
  let img1changed = false, img2changed = false;
  const domainKeys = Object.keys(config.domains);
  const sharp1 = sharp(items[domainKeys[0]]);
  const sharp2 = sharp(items[domainKeys[1]]);

  const promise1 = sharp1.toBuffer();
  const promise2 = sharp2.toBuffer();
  let [ img1, img2 ] = await Promise.all([promise1, promise2]);
  img1 = PNG.sync.read(img1);
  img2 = PNG.sync.read(img2);

  const width = Math.max(img1.width, img2.width);
  if (img1.width != img2.width) {
    if (img1.width > img2.width) {
      console.log(chalk.yellow(`img2 narrower. Changing ${img2.width} to ${width}.`));
      img2 = await sharp2
        .resize({width, position:"left"})
        .toBuffer();
      img2 = PNG.sync.read(img2);
      img2changed = true;
    } else {
      console.log(chalk.yellow(`img1 narrower. Changing ${img1.width} to ${width}.`));
      img1 = await sharp1
        .resize({width, position:"left"})
        .toBuffer();
      img1 = PNG.sync.read(img1);
      img1changed = true;
    }
  }
  
  const height = Math.max(img1.height, img2.height);
  if (img1.height != img2.height){
    // Adjust the smaller to match
    if (img1.height > img2.height) {
      console.log(chalk.yellow(`img2 shorter. Changing ${img2.height} to ${height}.`));
      img2.height = height;
      img2changed = true;
    } else if (img1.height < img2.height) {
      // Not sure why there's any doubt, but we are seeing lots of images resized to the same height
      console.log(chalk.yellow(`img1 shorter. Changing ${img2.height} to ${height}.`));
      img1.height = height;
      img1changed = true;
    }
  }
  if (img1changed){
    fs.writeFileSync(items[domainKeys[0]], PNG.sync.write(img1));
  }
  if (img2changed) {
    fs.writeFileSync(items[domainKeys[1]], PNG.sync.write(img2));
  }
  const diff = new PNG({width, height});
  const numDiffPixels = pixelmatch(img1.data, img2.data, diff.data, width, height, {
    threshold: 0.06,
  });
  diff.pack().pipe(fs.createWriteStream(items.diff));
  const percent = numDiffPixels * 100 / (width * height);
  fs.writeFileSync(items.log, percent.toFixed(2));

  console.log(chalk.green(`Diff for ${items.diff}: ${percent}%`));

}
