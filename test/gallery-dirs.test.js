import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const galleryDirsScript = path.join(rootDir, 'visualify-gallery-dirs.js');

describe('visualify-gallery-dirs', () => {
  const testDir = path.join(__dirname, 'fixtures-gallery');
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
    fs.mkdirSync(outputDir, { recursive: true });
  });

  afterEach(() => {
    // Clean up test directories
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
  });

  it('should show help when requested', () => {
    try {
      execSync(`node "${galleryDirsScript}" --help`, { encoding: 'utf8' });
    } catch (error) {
      expect(error.stdout).toContain('Usage:');
      expect(error.stdout).toContain('golden-dir');
      expect(error.stdout).toContain('current-dir');
      expect(error.stdout).toContain('--template');
      expect(error.stdout).toContain('--threshold');
    }
  });

  it('should fail when output directory not specified', () => {
    expect(() => {
      execSync(`node "${galleryDirsScript}" "${goldenDir}" "${currentDir}"`, 
        { encoding: 'utf8', stdio: 'pipe' });
    }).toThrow();
  });

  it('should fail when no matching PNG files found', () => {
    expect(() => {
      execSync(`node "${galleryDirsScript}" -o "${outputDir}" "${goldenDir}" "${currentDir}"`, 
        { encoding: 'utf8', stdio: 'pipe' });
    }).toThrow(/No matching PNG files found/);
  });

  describe('with test files', () => {
    beforeEach(async () => {
      const sharp = (await import('sharp')).default;
      
      // Create simple test PNG using Sharp
      const testImage = await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 3,
          background: { r: 200, g: 200, b: 200 }
        }
      }).png().toBuffer();

      // Create matching images
      fs.writeFileSync(path.join(goldenDir, 'page1.png'), testImage);
      fs.writeFileSync(path.join(currentDir, 'page1.png'), testImage);
      fs.writeFileSync(path.join(goldenDir, 'page2.png'), testImage);
      fs.writeFileSync(path.join(currentDir, 'page2.png'), testImage);

      // Create comparison data files
      fs.writeFileSync(path.join(outputDir, 'page1_data.txt'), '0.5');
      fs.writeFileSync(path.join(outputDir, 'page2_data.txt'), '12.3');
      
      // Create comparison summary
      const summary = {
        threshold: 6,
        totalComparisons: 2,
        failedComparisons: 1,
        results: [
          { filename: 'page1.png', percentage: 0.5 },
          { filename: 'page2.png', percentage: 12.3 }
        ]
      };
      fs.writeFileSync(path.join(outputDir, 'comparison_summary.json'), JSON.stringify(summary));
    });

    it('should generate gallery.html', () => {
      const result = execSync(
        `node "${galleryDirsScript}" -o "${outputDir}" "${goldenDir}" "${currentDir}"`, 
        { encoding: 'utf8' }
      );
      
      expect(result).toContain('Gallery generated');
      expect(fs.existsSync(path.join(outputDir, 'gallery.html'))).toBe(true);

      const galleryContent = fs.readFileSync(path.join(outputDir, 'gallery.html'), 'utf8');
      expect(galleryContent).toContain('page1.png');
      expect(galleryContent).toContain('page2.png');
    });

    it('should respect custom threshold', () => {
      const result = execSync(
        `node "${galleryDirsScript}" -o "${outputDir}" -t 10 "${goldenDir}" "${currentDir}"`, 
        { encoding: 'utf8' }
      );
      
      expect(result).toContain('Gallery generated');
      expect(fs.existsSync(path.join(outputDir, 'gallery.html'))).toBe(true);
    });

    it('should handle missing template gracefully', () => {
      expect(() => {
        execSync(
          `node "${galleryDirsScript}" -o "${outputDir}" --template nonexistent "${goldenDir}" "${currentDir}"`, 
          { encoding: 'utf8', stdio: 'pipe' }
        );
      }).toThrow(/Template not found/);
    });

    it('should work without comparison summary', () => {
      // Remove the comparison summary to test fallback behavior
      fs.unlinkSync(path.join(outputDir, 'comparison_summary.json'));
      
      const result = execSync(
        `node "${galleryDirsScript}" -o "${outputDir}" "${goldenDir}" "${currentDir}"`, 
        { encoding: 'utf8' }
      );
      
      expect(result).toContain('Gallery generated');
      expect(fs.existsSync(path.join(outputDir, 'gallery.html'))).toBe(true);
    });
  });
});