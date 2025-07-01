#!/usr/bin/env node

import { program } from 'commander';

/**
 * Output directory structure:
 * $shotsDir/
 *   ..pathKey/
 *   ....size_browser_domain1.png
 *   ....size_browser_domain2.png
 *   ....size_browser_diff.png
 *   ....size_browser_data.txt - percent diff
 *   ....size2_browser_domain1.png
 *   ......
 *   ..pathKey/
 *   ....size_browser_domain1.png
 *   ......
 *   ..thumbnails/
 *   ....pathKey/
 *   ......size_browser_domain1.png
 *   ......size_browser_domain2.png
 *   ......size_browser_diff.png
 *   ........
 *   ....pathKey/
 *   ......size_browser_domain1.png
 *   ........
 *   ......
 *   ..gallery.html
 */

program
  .version('0.0.1')
  .option('-c, --config-file <config-file>', 'Configuration file')
  .option('-d, --defaults-file <defaults-file>', 'Default configuration')
  .option('-o, --output-directory [shots-dir]', 'Output directory for tests, directory in config file')
  .option('--debug', 'Show browser while doing snaps')
  .hook('preSubcommand', (thisCommand, actionCommand) => {
    // Pass global options via environment variables
    const opts = thisCommand.opts();
    if (opts.configFile) process.env.VISUALIFY_CONFIG_FILE = opts.configFile;
    if (opts.defaultsFile) process.env.VISUALIFY_DEFAULTS_FILE = opts.defaultsFile;
    if (opts.outputDirectory) process.env.VISUALIFY_OUTPUT_DIRECTORY = opts.outputDirectory;
    if (opts.debug) process.env.VISUALIFY_DEBUG = 'true';
  })
  .command("capture [domain1name] [domain1url] [domain2name] [domain2url]", "Capture screenshots of sites", { executableFile: 'visualify-capture.js' })
  .command('compare [domain1name] [domain1url] [domain2name] [domain2url]', 'Compare captured shots', { executableFile: 'visualify-compare.js' })
  .command('thumbnail [domain1name] [domain1url] [domain2name] [domain2url]', 'Generate thumbnails', { executableFile: 'visualify-thumbnail.js' })
  .command('gallery [domain1name] [domain1url] [domain2name] [domain2url]', 'Call wraith to generate a gallery', { executableFile: 'visualify-gallery.js' })
  .command('all','Run all steps', { executableFile: 'visualify-all.js' });

program.parse(process.argv);
