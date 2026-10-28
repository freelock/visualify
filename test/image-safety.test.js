import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import { assertImageSize, screenshotOptions, imageLimits, ImageSafetyError } from '../lib/imageSafety.js';

const root = fileURLToPath(new URL('../', import.meta.url));

describe('image size protection', () => {
  it('allows normal images and the exact limits', () => {
    expect(() => assertImageSize(1280, 800, {}, 'normal')).not.toThrow();
    expect(() => assertImageSize(1250, 20000, {}, 'boundary')).not.toThrow();
  });

  it('rejects excessive height and pixel count independently', () => {
    expect(() => assertImageSize(1, 20001, {}, 'tall.png')).toThrow(/tall.png.*1x20001/);
    expect(() => assertImageSize(2000, 15000, {}, 'wide.png')).toThrow(/max_image_pixels=25000000/);
    expect(() => assertImageSize(1280, 104153, {}, 'incident')).toThrow(ImageSafetyError);
  });

  it('supports explicit overrides, but never invalid or disabled limits', () => {
    expect(() => assertImageSize(1280, 104153, {
      max_image_height: 110000, max_image_pixels: 140000000,
    }, 'large')).not.toThrow();
    for (const value of [0, -1, NaN, Infinity, 1.5, '20000']) {
      expect(() => imageLimits({ max_image_height: value })).toThrow(/positive integer/);
    }
  });

  it('checks page dimensions including device scaling before capture', async () => {
    const page = { evaluate: vi.fn().mockResolvedValue({ width: 1280, height: 104153, scale: 1 }) };
    await expect(screenshotOptions(page, {}, 'https://example.test/tall')).rejects.toThrow(/example.test/);
    page.evaluate.mockResolvedValue({ width: 1280, height: 10000, scale: 2 });
    await expect(screenshotOptions(page, {}, 'retina')).rejects.toThrow(/51200000 pixels/);
    page.evaluate.mockResolvedValue({ width: 1280, height: 800, scale: 1 });
    await expect(screenshotOptions(page, {}, 'normal')).resolves.toEqual({ fullPage: true });
  });

  it('clips oversized pages only when a capture height is explicitly set', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const page = { evaluate: vi.fn().mockResolvedValue({ width: 1280, height: 104153, scale: 1 }) };
      await expect(screenshotOptions(page, { max_capture_height: 10000 }, 'tall')).resolves.toEqual({
        clip: { x: 0, y: 0, width: 1280, height: 10000 }, captureBeyondViewport: true,
      });
      expect(warning).toHaveBeenCalledWith(expect.stringContaining('cropping page height from 104153 to 10000'));
      warning.mockClear();
      page.evaluate.mockResolvedValue({ width: 1280, height: 800, scale: 1 });
      const options = await screenshotOptions(page, { max_capture_height: 10000 }, 'short');
      expect(options.clip.height).toBe(800);
      expect(warning).not.toHaveBeenCalled();
    } finally {
      warning.mockRestore();
    }
  });

  it('validates capture caps and still enforces safety limits after cropping', async () => {
    for (const value of [0, -1, null, 1.5, '10000']) {
      expect(() => imageLimits({ max_capture_height: value })).toThrow(/max_capture_height/);
    }
    const page = { evaluate: vi.fn().mockResolvedValue({ width: 1280, height: 104153, scale: 2 }) };
    await expect(screenshotOptions(page, { max_capture_height: 10000 }, 'retina')).rejects.toThrow(/51200000 pixels/);
  });
});

describe('comparison safety CLI', () => {
  let dir;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'visualify-safety-'));
    fs.mkdirSync(path.join(dir, 'golden'));
    fs.mkdirSync(path.join(dir, 'current'));
    fs.mkdirSync(path.join(dir, 'shots', 'page'), { recursive: true });
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  async function image(file, width, height) {
    await sharp({ create: { width, height, channels: 4, background: 'white' } }).png().toFile(file);
  }

  function run(script, args) {
    return spawnSync(process.execPath, [path.join(root, script), ...args], { encoding: 'utf8', timeout: 10000 });
  }

  it('rejects oversized existing screenshots without writing a diff or modifying inputs', async () => {
    const first = path.join(dir, 'shots/page/1_chrome_stage.png');
    const second = path.join(dir, 'shots/page/1_chrome_prod.png');
    await image(first, 1, 20001);
    await image(second, 1, 10);
    const original = fs.readFileSync(second);
    const config = path.join(dir, 'config.json');
    fs.writeFileSync(config, JSON.stringify({ paths: { page: '/' }, screen_widths: [1] }));
    const result = run('visualify-compare.js', ['-c', config, '-o', path.join(dir, 'shots'), 'stage', 'https://a.test', 'prod', 'https://b.test']);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('refusing oversized image 1x20001');
    expect(fs.existsSync(path.join(dir, 'shots/page/1_chrome_diff.png'))).toBe(false);
    expect(fs.readFileSync(second)).toEqual(original);
  });

  it('rejects oversized directory comparisons even with a 100% difference threshold', async () => {
    await image(path.join(dir, 'golden/test.png'), 1, 20001);
    await image(path.join(dir, 'current/test.png'), 1, 10);
    const result = run('visualify-compare-dirs.js', ['-t', '100', '-o', path.join(dir, 'out'), path.join(dir, 'golden'), path.join(dir, 'current')]);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('refusing oversized image');
    expect(fs.existsSync(path.join(dir, 'out/test_diff.png'))).toBe(false);
  });

  it('checks combined dimensions before padding individually safe images', async () => {
    await image(path.join(dir, 'golden/test.png'), 10, 2);
    await image(path.join(dir, 'current/test.png'), 2, 10);
    const result = run('visualify-compare-dirs.js', ['--max-image-pixels', '50', '-o', path.join(dir, 'out'), path.join(dir, 'golden'), path.join(dir, 'current')]);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('refusing oversized image 10x10');
    expect(fs.existsSync(path.join(dir, 'out/test_diff.png'))).toBe(false);
  });
});
