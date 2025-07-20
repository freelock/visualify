# Visualify - Another visual regression tester

It's fall of 2018. PhantomJS is dead. We're using CSS Grid all over the place. And we cannot seem to get our visual regression testing tool, [Wraith](https://github.com/BBC-News/wraith), to work with headless chrome inside a Docker container.

We're not a Ruby shop. Looking around at the tools available, we found none that worked the way we want them to and were current in any way -- it looks like development on Wraith has greatly slowed down. Meanwhile, it uses Selenium Webdriver to run screenshots in headless chrome, while [Puppeteer](https://github.com/GoogleChrome/puppeteer) has since arrived on the scene and seems far easier to work with. After stumbling across a [great post describing how to visual regression testing](https://meowni.ca/posts/2017-puppeteer-tests/) using Puppeteer and [Pixelmatch](https://github.com/mapbox/pixelmatch), we rolled up our sleeves and created Visualify as a drop-in replacement for Wraith in our CI system.

## Enter Visualify

Visualify is a brand new visual regression testing tool, heavily inspired by Wraith, and supporting existing Wraith configuration files.

## Status

Visualify is up and running in production in our CI systems. It supports our basic needs to compare a list of paths on two copies of a site at multiple screen widths. We plan to expand this to work with historical snapshots taken by other tools, providing the image diff and gallery functionalities for other use cases. We also plan to add support for using CSS selectors to grab particular page elements, and possibly script support to hide elements using CSS selectors (so things like ads don't constantly break).

As it is, it improves upon Wraith by using headless chrome via Puppeteer, and it runs inside Docker (see example Dockerfile).

## Installation

### Option 1: Using Nix (Recommended)

The easiest way to install and run Visualify is using Nix, which handles all dependencies automatically:

#### Run directly from GitHub:
```bash
nix shell github:freelock/visualify
visualify --help
```

#### Run from local clone:
```bash
git clone https://github.com/freelock/visualify.git
cd visualify
nix shell path:.
visualify --help
```

#### Development environment:
```bash
git clone https://github.com/freelock/visualify.git
cd visualify
nix develop
# This gives you a shell with visualify and all dependencies available
```

The Nix installation automatically:
- Installs Node.js and all npm dependencies
- Configures the Sharp image processing library
- Sets up browser detection for system Chrome/Chromium
- Works on Linux, macOS, and in containers

### Option 2: Traditional Node.js Installation

You must have a recent version of Node.js installed, with npm.

1. Clone this repository: `git clone https://github.com/freelock/visualify.git`
2. cd into the repository: `cd visualify`
3. `npm install` to install puppeteer, sharp, and the other dependencies.
4. `sudo npm link` to make visualify available in your $PATH.

**Note:** You'll also need Chrome or Chromium installed on your system for screenshot capture.

## Usage

Visualify currently provides 4 separate operations, which are meant to run sequentially with the same arguments. Check out the `capture.yaml` file for the base configuration options -- this file comes straight from Wraith, and many options are not yet supported. It will use this file as defaults, unless otherwise specified.

In our CI system, we spread our configs across 2 yaml files -- a base "default" one, and a site-specific `paths.yaml` that contains a Yaml block with a "paths:" key. For example:

```yaml
paths:
  home: /
  about: /about
  contact: /contact
  bogus: /bogus
  sitemap: /sitemap
```

In addition, you also need a "domains" block to list the two sites you want to compare. Alternatively, you can pass these domains as arguments to visualify.

There are 4 phases/commands supported:

### visualify capture

Capture a set of screenshots.

Example:

`visualify capture -c paths.yaml -o shots dev http://devsite.dev prod https://mysite.prod`

This creates a tree of directories in `shots/`, one for each path in the paths yaml key, plus another set under `shots/thumbnails`. Then it uses puppeteer to take a screenshot of each path on each domain at each screen_width.

Screenshots are taken serially to reduce load on our test server.

### visualify compare

Compare two sets of screenshots using Pixelmatch.

Example:

`visualify compare -c paths.yaml -o shots dev http://devsite.dev prod https://mysite.prod`

This loops through all the screenshots specified by the configuration, resizes them to have the same height and width, and generates an image diff and a percent of pixels different.

### visualify thumbnail

Generate thumbnails of all images using [sharp](https://github.com/lovell/sharp).

Example:

`visualify thumbnail -c paths.yaml -o shots dev http://devsite.dev prod https://mysite.prod`

This loops through all screenshots and diffs previously generated, and creates thumbnails at the size specified in the `gallery` config.

### visualify gallery

Generate an HTML gallery of the results.

Example:

`visualify gallery -c paths.yaml -o shots dev http://devsite.dev prod https://mysite.prod`

This gallery is taken straight out of Wraith, turned into a [Mustache](https://github.com/janl/mustache.js/) template.

### visualify all

Run all 4 steps in sequence: capture, compare, thumbnail, and gallery.

Example:

`visualify all -c paths.yaml -o shots --debug dev http://devsite.dev prod https://mysite.prod`

This command executes all phases sequentially, making it perfect for CI/CD pipelines or complete regression testing workflows. Use the `--debug` flag to see the browser during the capture phase.

## Directory-Based Commands

For scenarios where you already have screenshots from other tools (like Behat) and want to compare two directories of images, Visualify provides three directory-based commands that work without requiring URL capture or configuration files.

### visualify compare-dirs

Compare two directories of screenshots pixel-by-pixel with threshold support.

**Usage:**
```bash
visualify compare-dirs [options] <golden-dir> <current-dir>
```

**Arguments:**
- `<golden-dir>` - Directory with reference/golden screenshots
- `<current-dir>` - Directory with current test screenshots

**Options:**
- `-t, --threshold <threshold>` - Percentage threshold for failures (default: 6)
- `-o, --output-directory <output-dir>` - Output directory for results (required)

**Examples:**
```bash
# Compare directories with 6% threshold
visualify compare-dirs -t 6 -o results/ golden_screenshots/ current_screenshots/

# Compare with stricter 2% threshold
visualify compare-dirs -t 2 -o results/ baseline/ latest/
```

**Output:**
- Creates diff images (`*_diff.png`) highlighting pixel differences
- Generates percentage data files (`*_data.txt`) with difference percentages
- Returns exit code 0 if all comparisons pass threshold, 1 if any fail
- Creates `comparison_summary.json` with detailed results

### visualify thumbnail-dirs

Generate thumbnails from directory comparison results.

**Usage:**
```bash
visualify thumbnail-dirs [options] <golden-dir> <current-dir>
```

**Arguments:**
- `<golden-dir>` - Directory with reference/golden screenshots
- `<current-dir>` - Directory with current test screenshots

**Options:**
- `-o, --output-directory <output-dir>` - Output directory for thumbnails (required)
- `--thumb-width <width>` - Thumbnail width in pixels (default: 200)
- `--thumb-height <height>` - Thumbnail height in pixels (default: 400)

**Examples:**
```bash
# Generate thumbnails with default dimensions
visualify thumbnail-dirs -o results/ golden_screenshots/ current_screenshots/

# Generate smaller thumbnails
visualify thumbnail-dirs -o results/ --thumb-width 150 --thumb-height 300 golden/ current/
```

**Output:**
- Creates `thumbnails/golden/` directory with resized golden images
- Creates `thumbnails/current/` directory with resized current images  
- Creates `thumbnails/diff/` directory with resized diff images (if they exist)

### visualify gallery-dirs

Generate an HTML gallery from directory comparison results.

**Usage:**
```bash
visualify gallery-dirs [options] <golden-dir> <current-dir>
```

**Arguments:**
- `<golden-dir>` - Directory with reference/golden screenshots
- `<current-dir>` - Directory with current test screenshots

**Options:**
- `-o, --output-directory <output-dir>` - Output directory for gallery (required)
- `-t, --threshold <threshold>` - Percentage threshold for highlighting failures (default: 6)
- `--template <template>` - Template name without .mustache extension (default: slideshow_template)

**Examples:**
```bash
# Generate gallery with default settings
visualify gallery-dirs -o results/ golden_screenshots/ current_screenshots/

# Generate gallery with custom threshold
visualify gallery-dirs -o results/ -t 10 golden/ current/
```

**Output:**
- Creates `gallery.html` with interactive slideshow interface
- Results sorted by difference percentage (highest first)
- Failed comparisons highlighted based on threshold
- Same gallery format as URL-based workflow for compatibility

## Directory-Based Workflow Example

Here's a complete example of using the directory commands with Behat screenshots:

```bash
# 1. Compare directories and check if any exceed threshold
visualify compare-dirs -t 6 -o results/ baseline_screenshots/ latest_screenshots/

# 2. Generate thumbnails for gallery
visualify thumbnail-dirs -o results/ baseline_screenshots/ latest_screenshots/

# 3. Create HTML gallery for review
visualify gallery-dirs -o results/ baseline_screenshots/ latest_screenshots/

# 4. View results
open results/gallery.html
```

The directory-based commands maintain full compatibility with existing CI/CD integrations and provide the same gallery output format as the URL-based workflow.