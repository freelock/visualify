#!/usr/bin/env node
'use strict'

import { program } from 'commander';
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import Mustache from 'mustache';
import { fileURLToPath } from 'url';

program
  .option('-o, --output-directory <output-dir>', 'Output directory for gallery')
  .option('-t, --threshold <threshold>', 'Percentage threshold for highlighting failures', parseFloat, 6)
  .option('--template <template>', 'Template name (without .mustache extension)', 'slideshow_template')
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function generateGallery() {
  console.log(chalk.blue('Generating HTML gallery...'));
  
  // Load comparison summary if it exists
  const summaryPath = path.join(opts.outputDirectory, 'comparison_summary.json');
  let summary = null;
  
  if (fs.existsSync(summaryPath)) {
    summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
  }
  
  // Build gallery data
  const galleryData = await buildGalleryData();
  
  // Render gallery template
  const templatePath = path.join(__dirname, 'configs', `${opts.template}.mustache`);
  
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Template not found: ${templatePath}`);
  }
  
  const template = fs.readFileSync(templatePath, 'utf8');
  const rendered = Mustache.render(template, galleryData);
  
  // Save gallery
  const galleryPath = path.join(opts.outputDirectory, 'gallery.html');
  fs.writeFileSync(galleryPath, rendered);
  
  console.log(chalk.green(`Gallery generated: ${galleryPath}`));
}

async function buildGalleryData() {
  // Find matching PNG files
  const goldenFiles = fs.readdirSync(goldenDir).filter(f => f.endsWith('.png'));
  const currentFiles = fs.readdirSync(currentDir).filter(f => f.endsWith('.png'));
  const matchingFiles = goldenFiles.filter(f => currentFiles.includes(f));
  
  if (matchingFiles.length === 0) {
    throw new Error('No matching PNG files found between directories');
  }
  
  // Build paths data compatible with existing template
  const paths = [];
  
  for (const filename of matchingFiles) {
    const baseName = filename.replace('.png', '');
    const diffFileName = `${baseName}_diff.png`;
    const dataFileName = `${baseName}_data.txt`;
    
    // Get diff percentage if available
    let diff = 'Not detected';
    let threshold = '';
    const dataPath = path.join(opts.outputDirectory, dataFileName);
    
    if (fs.existsSync(dataPath)) {
      diff = fs.readFileSync(dataPath, 'utf8').trim();
      if (parseFloat(diff) > opts.threshold) {
        threshold = 'threshold';
      }
    }
    
    // Build path object compatible with existing template structure
    const pathData = {
      alias: baseName,
      domain1name: 'golden',
      domain2name: 'current', 
      domain1url: `Golden: ${filename}`,
      domain2url: `Current: ${filename}`,
      diffname: 'diff',
      maxDiff: parseFloat(diff) || 0,
      widths: [{
        width: 'comparison', // Single comparison view
        diff,
        threshold,
        img1url: path.join('..', path.relative(opts.outputDirectory, path.join(goldenDir, filename))),
        img2url: path.join('..', path.relative(opts.outputDirectory, path.join(currentDir, filename))),
        imgdiffurl: diffFileName,
        thumb1url: `thumbnails/golden/${filename}`,
        thumb2url: `thumbnails/current/${filename}`,
        thumbdiffurl: `thumbnails/diff/${diffFileName}`
      }]
    };
    
    paths.push(pathData);
  }
  
  // Sort by difference percentage (highest first)
  paths.sort((a, b) => b.maxDiff - a.maxDiff);
  
  return {
    gallery_generated: new Date(),
    paths: paths
  };
}

// Run gallery generation
generateGallery()
  .then(() => {
    console.log(chalk.green('Gallery generation complete!'));
    process.exit(0);
  })
  .catch((error) => {
    console.error(chalk.red(`Error generating gallery: ${error.message}`));
    process.exit(1);
  });