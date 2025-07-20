#!/usr/bin/env node
'use strict'

import { program } from 'commander';
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import sharp from 'sharp';

program
  .option('-o, --output-directory <output-dir>', 'Output directory for thumbnails')
  .option('--thumb-width <width>', 'Thumbnail width (default: 200)', (val) => parseInt(val, 10), 200)
  .option('--thumb-height <height>', 'Thumbnail height (default: 400)', (val) => parseInt(val, 10), 400)
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
const thumbnailsDir = path.join(opts.outputDirectory, 'thumbnails');
if (!fs.existsSync(thumbnailsDir)) {
  fs.mkdirSync(thumbnailsDir, { recursive: true });
}

async function generateThumbnails() {
  console.log(chalk.blue('Generating thumbnails...'));
  
  // Process golden directory images
  console.log(chalk.blue('Processing golden screenshots...'));
  await processThumbnailDirectory(goldenDir, path.join(thumbnailsDir, 'golden'));
  
  // Process current directory images
  console.log(chalk.blue('Processing current screenshots...'));
  await processThumbnailDirectory(currentDir, path.join(thumbnailsDir, 'current'));
  
  // Process diff images from output directory (if they exist)
  const diffImages = fs.readdirSync(opts.outputDirectory)
    .filter(f => f.endsWith('_diff.png'))
    .map(f => path.join(opts.outputDirectory, f));
  
  if (diffImages.length > 0) {
    console.log(chalk.blue('Processing diff images...'));
    const diffThumbnailDir = path.join(thumbnailsDir, 'diff');
    if (!fs.existsSync(diffThumbnailDir)) {
      fs.mkdirSync(diffThumbnailDir, { recursive: true });
    }
    
    for (const diffImage of diffImages) {
      const filename = path.basename(diffImage);
      const thumbnailPath = path.join(diffThumbnailDir, filename);
      
      console.log(`Creating thumbnail for ${filename}`);
      await sharp(diffImage)
        .resize(opts.thumbWidth, opts.thumbHeight, {
          position: 'top',
        })
        .toFile(thumbnailPath);
    }
  }
  
  console.log(chalk.green('Thumbnails generated successfully!'));
}

async function processThumbnailDirectory(sourceDir, targetDir) {
  // Ensure target directory exists
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  
  const files = fs.readdirSync(sourceDir).filter(f => f.endsWith('.png'));
  
  for (const filename of files) {
    const sourcePath = path.join(sourceDir, filename);
    const targetPath = path.join(targetDir, filename);
    
    console.log(`Creating thumbnail for ${filename}`);
    
    try {
      await sharp(sourcePath)
        .resize(opts.thumbWidth, opts.thumbHeight, {
          position: 'top',
        })
        .toFile(targetPath);
    } catch (error) {
      console.log(chalk.yellow(`Warning: Could not create thumbnail for ${filename}: ${error.message}`));
    }
  }
}

// Run thumbnail generation
generateThumbnails()
  .then(() => {
    console.log(chalk.green('Thumbnail generation complete!'));
    process.exit(0);
  })
  .catch((error) => {
    console.error(chalk.red(`Error generating thumbnails: ${error.message}`));
    process.exit(1);
  });