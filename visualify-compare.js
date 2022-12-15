#!/usr/bin/env node
'use strict'

import { program } from 'commander';

import fs from 'fs';
import chalk from 'chalk';
import sharp from 'sharp';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import loadConfig from './lib/loadConfig.js';

program
  .option('-c, --config-file <config-file>', 'Configuration file')
  .option('-d, --defaults-file <defaults-file>', 'Default configuration')
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
  } = program.opts();
  const config = loadConfig.load(defaultsFile, configFile, domains);
  const shotsDir = outputDirectory ? outputDirectory : config.directory;
  config.directory = shotsDir;

  compareShots(config)
    .then(() => console.log(chalk.blue('Comparisons done!')));
} catch(e) {
  if (debug) {
    console.error(e);
  }
  program.error(e.message);
}

async function compareShots(config) {
  const paths = Object.keys(config.paths).reduce((acc,path) => {
    const widths = config.screen_widths.map((width) => {
      const domains = Object.keys(config.domains).reduce((out, domain) => {
        out[domain] = `${config.directory}/${path}/${width}_chrome_${domain}.png`;
        return out;
      }, {});
      domains.diff = `${config.directory}/${path}/${width}_chrome_diff.png`;
      domains.log = `${config.directory}/${path}/${width}_chrome_data.txt`;
      domains.width = width;
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
  let image1 = sharp(items[domainKeys[0]]);
  let image2 = sharp(items[domainKeys[1]]);

  //const promise1 = image1.toBuffer();
  //const promise2 = image2.toBuffer();
  //let [ img1, img2 ] = await Promise.all([promise1, promise2]);
  //img1 = PNG.sync.read(img1);
  //img2 = PNG.sync.read(img2);

  let meta1 = await image1.metadata();
  let meta2 = await image2.metadata();
  let width = Math.max(meta1.width, meta2.width);
  if (width > items.width) {
    console.log(`Updating width ${width} to ${items.width}`);
    width = items.width;
  }
    if (meta1.width < width) {
      console.log(chalk.yellow(`img1 narrower. Changing ${meta1.width} to ${width}.`));
      image1
        .resize({width: width, position:"left", withoutEnlargement: true})
        .extend({top: 0, bottom: 0, left: 0, right: (width - meta1.width), background: {r: 255, g:255, b:0, alpha:1}});
//        .toBuffer();
//      img2 = PNG.sync.read(img2);
      img1changed = true;
    } else if (meta1.width > width) {
      console.log(chalk.yellow(`img1 wider. Changing ${meta1.width} to ${width}.`));
      image1
        .extract({width: width, top: 0, left: 0, height: meta1.height });
      img1changed = true;
    }
    if (meta2.width < width) {
      console.log(chalk.yellow(`img2 narrower. Changing ${meta2.width} to ${width}.`));
      //img1 = await sharp1
      image2
        .resize({width: width, position:"left", withoutEnlargement: true})
        .extend({top: 0, bottom: 0, left: 0, right: (width - meta2.width), background: {r: 255, g:255, b:0, alpha:1}});
       // .toBuffer();
     // img1 = PNG.sync.read(img1);
      img2changed = true;
    } else if (meta2.width > width) {
      console.log(chalk.yellow(`img2 wider. Changing ${meta2.width} to ${width}.`));
      image2
        .extract({width: width, top: 0, left: 0, height: meta2.height });
      img2changed = true;
    }

  const height = Math.max(meta1.height, meta2.height);
  if (meta1.height != meta2.height){
    // Adjust the smaller to match
    if (meta1.height > meta2.height) {
      console.log(chalk.yellow(`img2 shorter. Changing ${meta2.height} to ${height}.`));
      image2
        .resize({height: height, position: 'top', withoutEnlargement: true})
        .extend({top: 0, bottom: (height - meta2.height), left: 0, right: 0, background: {r:255, g:255, b:0, alpha:1}});
      //img2.height = height;
      img2changed = true;
    } else if (meta1.height < meta2.height) {
      // Not sure why there's any doubt, but we are seeing lots of images resized to the same height
      console.log(chalk.yellow(`img1 shorter. Changing ${meta1.height} to ${height}.`));
      //img1.height = height;
      image1
        .resize({height: height, position: 'top', withoutEnlargement: true})
        .extend({top: 0, bottom: (height - meta1.height), left: 0, right: 0, background: {r:255, g:255, b:0, alpha:1}});
      img1changed = true;
    }
  }
  const diff = new PNG({width, height});
  const promise1 = image1.toBuffer();
  const promise2 = image2.toBuffer();
  let [ img1, img2 ] = await Promise.all([promise1, promise2]);
  img1 = PNG.sync.read(img1);
  img2 = PNG.sync.read(img2);
              if (img1changed){
                //image1.toFile(items[domainKeys[0]]);
                fs.writeFileSync(items[domainKeys[0]], PNG.sync.write(img1));
              }
              if (img2changed) {
                //image2.toFile(items[domainKeys[0]]);
                fs.writeFileSync(items[domainKeys[1]], PNG.sync.write(img2));
              }
  try {
    const numDiffPixels = pixelmatch(img1.data, img2.data, diff.data, width, height, {
      threshold: 0.06,
    });
    diff.pack().pipe(fs.createWriteStream(items.diff));
    const percent = numDiffPixels * 100 / (width * height);
    fs.writeFileSync(items.log, percent.toFixed(2));
    console.log(chalk.green(`Diff for ${items.diff}: ${percent}%`));
  }
  catch (e) {
    console.log(chalk.red(`Error running pixelmatch. ${e.name} ${e.message}`));
  }

}
