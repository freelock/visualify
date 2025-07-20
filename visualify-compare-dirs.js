#!/usr/bin/env node
'use strict'

import { program } from 'commander';
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import sharp from 'sharp';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

program
  .option('-t, --threshold <threshold>', 'Percentage threshold for failures (e.g., 6)', parseFloat, 6)
  .option('-o, --output-directory <output-dir>', 'Output directory for results')
  .argument('<golden-dir>', 'Directory with reference/golden screenshots')
  .argument('<current-dir>', 'Directory with current test screenshots')
  .parse(process.argv);

const opts = program.opts();
const [goldenDir, currentDir] = program.args;

if (!opts.outputDirectory) {
  program.error('Output directory (-o) is required');
}

if (!fs.existsSync(goldenDir)) {
  program.error(`Golden directory does not exist: ${goldenDir}`);
}

if (!fs.existsSync(currentDir)) {
  program.error(`Current directory does not exist: ${currentDir}`);
}

// Ensure output directory exists
if (!fs.existsSync(opts.outputDirectory)) {
  fs.mkdirSync(opts.outputDirectory, { recursive: true });
}

async function compareDirs() {
  const goldenFiles = fs.readdirSync(goldenDir).filter(f => f.endsWith('.png'));
  const currentFiles = fs.readdirSync(currentDir).filter(f => f.endsWith('.png'));
  
  // Find matching files
  const matchingFiles = goldenFiles.filter(f => currentFiles.includes(f));
  
  if (matchingFiles.length === 0) {
    console.log(chalk.yellow('No matching PNG files found between directories'));
    return { totalComparisons: 0, failedComparisons: 0 };
  }

  console.log(chalk.blue(`Found ${matchingFiles.length} matching files to compare`));
  
  let failedComparisons = 0;
  const results = [];
  
  for (const filename of matchingFiles) {
    const goldenPath = path.join(goldenDir, filename);
    const currentPath = path.join(currentDir, filename);
    const diffPath = path.join(opts.outputDirectory, filename.replace('.png', '_diff.png'));
    const dataPath = path.join(opts.outputDirectory, filename.replace('.png', '_data.txt'));
    
    console.log(chalk.blue(`Comparing ${filename}`));
    
    const result = await compareImages(goldenPath, currentPath, diffPath, dataPath);
    results.push({ filename, ...result });
    
    if (result.percentage > opts.threshold) {
      failedComparisons++;
      console.log(chalk.red(`FAIL: ${filename} - ${result.percentage}% (threshold: ${opts.threshold}%)`));
    } else {
      console.log(chalk.green(`PASS: ${filename} - ${result.percentage}%`));
    }
  }
  
  // Write summary
  const summary = {
    threshold: opts.threshold,
    totalComparisons: matchingFiles.length,
    failedComparisons,
    results
  };
  
  fs.writeFileSync(
    path.join(opts.outputDirectory, 'comparison_summary.json'),
    JSON.stringify(summary, null, 2)
  );
  
  console.log(chalk.blue(`\nComparison complete:`));
  console.log(`Total files: ${matchingFiles.length}`);
  console.log(`Failed: ${failedComparisons}`);
  console.log(`Passed: ${matchingFiles.length - failedComparisons}`);
  
  return summary;
}

async function compareImages(goldenPath, currentPath, diffPath, dataPath) {
  try {
    let img1changed = false, img2changed = false;
    let image1 = sharp(goldenPath);
    let image2 = sharp(currentPath);

    // Get metadata for both images
    let meta1 = await image1.metadata();
    let meta2 = await image2.metadata();
    
    // Normalize dimensions (reuse logic from visualify-compare.js)
    let width = Math.max(meta1.width, meta2.width);
    const height = Math.max(meta1.height, meta2.height);
    
    // Width normalization
    if (meta1.width < width) {
      console.log(chalk.yellow(`Golden image narrower. Changing ${meta1.width} to ${width}.`));
      image1 = image1
        .resize({width: width, position:"left", withoutEnlargement: true})
        .extend({top: 0, bottom: 0, left: 0, right: (width - meta1.width), background: {r: 255, g:255, b:0, alpha:1}});
      img1changed = true;
    } else if (meta1.width > width) {
      console.log(chalk.yellow(`Golden image wider. Changing ${meta1.width} to ${width}.`));
      image1 = image1.extract({width: width, top: 0, left: 0, height: meta1.height});
      img1changed = true;
    }
    
    if (meta2.width < width) {
      console.log(chalk.yellow(`Current image narrower. Changing ${meta2.width} to ${width}.`));
      image2 = image2
        .resize({width: width, position:"left", withoutEnlargement: true})
        .extend({top: 0, bottom: 0, left: 0, right: (width - meta2.width), background: {r: 255, g:255, b:0, alpha:1}});
      img2changed = true;
    } else if (meta2.width > width) {
      console.log(chalk.yellow(`Current image wider. Changing ${meta2.width} to ${width}.`));
      image2 = image2.extract({width: width, top: 0, left: 0, height: meta2.height});
      img2changed = true;
    }

    // Height normalization
    if (meta1.height !== meta2.height) {
      if (meta1.height > meta2.height) {
        console.log(chalk.yellow(`Current image shorter. Changing ${meta2.height} to ${height}.`));
        image2 = image2
          .resize({height: height, position: 'top', withoutEnlargement: true})
          .extend({top: 0, bottom: (height - meta2.height), left: 0, right: 0, background: {r:255, g:255, b:0, alpha:1}});
        img2changed = true;
      } else if (meta1.height < meta2.height) {
        console.log(chalk.yellow(`Golden image shorter. Changing ${meta1.height} to ${height}.`));
        image1 = image1
          .resize({height: height, position: 'top', withoutEnlargement: true})
          .extend({top: 0, bottom: (height - meta1.height), left: 0, right: 0, background: {r:255, g:255, b:0, alpha:1}});
        img1changed = true;
      }
    }

    // Convert to PNG buffers for pixelmatch
    const diff = new PNG({width, height});
    const [img1Buffer, img2Buffer] = await Promise.all([
      image1.toBuffer(),
      image2.toBuffer()
    ]);
    
    const img1 = PNG.sync.read(img1Buffer);
    const img2 = PNG.sync.read(img2Buffer);

    // Save normalized images if they were changed
    if (img1changed) {
      fs.writeFileSync(goldenPath, PNG.sync.write(img1));
    }
    if (img2changed) {
      fs.writeFileSync(currentPath, PNG.sync.write(img2));
    }

    // Perform pixel comparison
    const numDiffPixels = pixelmatch(img1.data, img2.data, diff.data, width, height, {
      threshold: 0.06,
    });

    // Save diff image
    diff.pack().pipe(fs.createWriteStream(diffPath));
    
    // Calculate percentage
    const percentage = parseFloat((numDiffPixels * 100 / (width * height)).toFixed(2));
    
    // Save percentage data
    fs.writeFileSync(dataPath, percentage.toString());
    
    return {
      percentage,
      numDiffPixels,
      totalPixels: width * height,
      width,
      height
    };
    
  } catch (error) {
    console.log(chalk.red(`Error comparing images: ${error.message}`));
    return {
      percentage: 100,
      error: error.message
    };
  }
}

// Run comparison and exit with appropriate code
compareDirs()
  .then((summary) => {
    if (summary.failedComparisons > 0) {
      console.log(chalk.red(`Exiting with code 1: ${summary.failedComparisons} comparisons exceeded threshold`));
      process.exit(1);
    } else {
      console.log(chalk.green('All comparisons passed threshold'));
      process.exit(0);
    }
  })
  .catch((error) => {
    console.error(chalk.red(`Fatal error: ${error.message}`));
    process.exit(1);
  });