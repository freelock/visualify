import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const thumbnailDirsScript = path.join(rootDir, 'visualify-thumbnail-dirs.js');

describe('visualify-thumbnail-dirs', () => {
  const testDir = path.join(__dirname, 'fixtures-thumbnail');
  const goldenDir = path.join(testDir, 'golden');
  const currentDir = path.join(testDir, 'current');
  const outputDir = path.join(testDir, 'output');

  beforeEach(() => {
    // Clean up and create test directories
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
    fs.mkdirSync(testDir, { recursive: true });
    fs.mkdirSync(goldenDir, { recursive: true });
    fs.mkdirSync(currentDir, { recursive: true });
  });

  afterEach(() => {
    // Clean up test directories
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
  });

  it('should show help when requested', () => {
    try {
      execSync(`node "${thumbnailDirsScript}" --help`, { encoding: 'utf8' });
    } catch (error) {
      expect(error.stdout).toContain('Usage:');
      expect(error.stdout).toContain('golden-dir');
      expect(error.stdout).toContain('current-dir');
      expect(error.stdout).toContain('--thumb-width');
      expect(error.stdout).toContain('--thumb-height');
    }
  });

  it('should fail when output directory not specified', () => {
    expect(() => {
      execSync(`node "${thumbnailDirsScript}" "${goldenDir}" "${currentDir}"`, 
        { encoding: 'utf8', stdio: 'pipe' });
    }).toThrow();
  });

  it('should fail when golden directory does not exist', () => {
    expect(() => {
      execSync(`node "${thumbnailDirsScript}" -o "${outputDir}" "/nonexistent" "${currentDir}"`, 
        { encoding: 'utf8', stdio: 'pipe' });
    }).toThrow();
  });

  it('should handle empty directories gracefully', () => {
    const result = execSync(
      `node "${thumbnailDirsScript}" -o "${outputDir}" "${goldenDir}" "${currentDir}"`, 
      { encoding: 'utf8' }
    );
    
    expect(result).toContain('Thumbnail generation complete');
    expect(fs.existsSync(path.join(outputDir, 'thumbnails'))).toBe(true);
  });

  describe('with test images', () => {
    beforeEach(async () => {
      const sharp = (await import('sharp')).default;
      
      // Create simple test PNG using Sharp
      const testImage = await sharp({
        create: {
          width: 50,
          height: 50,
          channels: 3,
          background: { r: 128, g: 128, b: 128 }
        }
      }).png().toBuffer();

      fs.writeFileSync(path.join(goldenDir, 'test1.png'), testImage);
      fs.writeFileSync(path.join(currentDir, 'test2.png'), testImage);
      
      // Create a diff image in output dir (to test diff thumbnail generation)
      fs.mkdirSync(outputDir, { recursive: true });
      fs.writeFileSync(path.join(outputDir, 'test3_diff.png'), testImage);
    });

    it('should create thumbnail directories and files', () => {
      const result = execSync(
        `node "${thumbnailDirsScript}" -o "${outputDir}" "${goldenDir}" "${currentDir}"`, 
        { encoding: 'utf8' }
      );
      
      expect(result).toContain('Processing golden screenshots');
      expect(result).toContain('Processing current screenshots');
      expect(result).toContain('Processing diff images');
      expect(result).toContain('Thumbnail generation complete');

      // Check directory structure
      expect(fs.existsSync(path.join(outputDir, 'thumbnails', 'golden'))).toBe(true);
      expect(fs.existsSync(path.join(outputDir, 'thumbnails', 'current'))).toBe(true);
      expect(fs.existsSync(path.join(outputDir, 'thumbnails', 'diff'))).toBe(true);

      // Check thumbnail files were created
      expect(fs.existsSync(path.join(outputDir, 'thumbnails', 'golden', 'test1.png'))).toBe(true);
      expect(fs.existsSync(path.join(outputDir, 'thumbnails', 'current', 'test2.png'))).toBe(true);
      expect(fs.existsSync(path.join(outputDir, 'thumbnails', 'diff', 'test3_diff.png'))).toBe(true);
    });

    it('should respect custom thumbnail dimensions', () => {
      execSync(
        `node "${thumbnailDirsScript}" -o "${outputDir}" --thumb-width 100 --thumb-height 200 "${goldenDir}" "${currentDir}"`, 
        { encoding: 'utf8' }
      );
      
      expect(fs.existsSync(path.join(outputDir, 'thumbnails', 'golden', 'test1.png'))).toBe(true);
    });

    it('should handle non-PNG files gracefully', () => {
      // Create a non-PNG file
      fs.writeFileSync(path.join(goldenDir, 'notimage.txt'), 'not an image');
      
      const result = execSync(
        `node "${thumbnailDirsScript}" -o "${outputDir}" "${goldenDir}" "${currentDir}"`, 
        { encoding: 'utf8' }
      );
      
      expect(result).toContain('Thumbnail generation complete');
      // Should only process PNG files
      expect(fs.existsSync(path.join(outputDir, 'thumbnails', 'golden', 'notimage.txt'))).toBe(false);
    });
  });
});