#!/usr/bin/env node

const program = require('commander');

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
  .command("capture [domain1name] [domain1url] [domain2name] [domain2url]", "Capture screenshots of sites")
  .command('compare [domain1name] [domain1url] [domain2name] [domain2url]', 'Compare captured shots')
  .command('thumbnail [domain1name] [domain1url] [domain2name] [domain2url]', 'Generate thumbnails')
  .command('gallery [domain1name] [domain1url] [domain2name] [domain2url]', 'Call wraith to generate a gallery')
  .command('all','Run all steps');
  
program.parse(process.argv);
