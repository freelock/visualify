# Visualify - Another visual regression tester

It's fall of 2018. PhantomJS is dead. We're using CSS Grid all over the place. And we cannot seem to get our visual regression testing tool, [Wraith](https://github.com/BBC-News/wraith), to work with headless chrome inside a Docker container.

We're not a Ruby shop. Looking around at the tools available, we found none that worked the way we want them to and were current in any way -- it looks like development on Wraith has greatly slowed down. Meanwhile, it uses Selenium Webdriver to run screenshots in headless chrome, while [Puppeteer](https://github.com/GoogleChrome/puppeteer) has since arrived on the scene and seems far easier to work with. After stumbling across a [great post describing how to visual regression testing](https://meowni.ca/posts/2017-puppeteer-tests/) using Puppeteer and [Pixelmatch](https://github.com/mapbox/pixelmatch), we rolled up our sleeves and created Visualify as a drop-in replacement for Wraith in our CI system.

## Enter Visualify

Visualify is a brand new visual regression testing tool, heavily inspired by Wraith, and supporting existing Wraith configuration files.

## Status

Visualify is up and running in production in our CI systems. It supports our basic needs to compare a list of paths on two copies of a site at multiple screen widths. We plan to expand this to work with historical snapshots taken by other tools, providing the image diff and gallery functionalities for other use cases. We also plan to add support for using CSS selectors to grab particular page elements, and possibly script support to hide elements using CSS selectors (so things like ads don't constantly break).

As it is, it improves upon Wraith by using headless chrome via Puppeteer, and it runs inside Docker (see example Dockerfile).

## Installation

You must have a recent version of Node.js installed, with npm.

1. Clone this repository: `git clone ...`
2. cd into the repository: `cd visualify`
3. `npm install` to install puppeteer, sharp, and the other dependencies.
4. `sudo npm link` to make visualify available in your $PATH.

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

This command is meant to run all 4 steps in sequence -- but it is not currently working.