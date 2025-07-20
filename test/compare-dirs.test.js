import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const compareDirsScript = path.join(rootDir, 'visualify-compare-dirs.js');

describe('visualify-compare-dirs', () => {
  const testDir = path.join(__dirname, 'fixtures');
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

  it('should show help when no arguments provided', () => {
    try {
      execSync(`node "${compareDirsScript}" --help`, { encoding: 'utf8' });
    } catch (error) {
      // execSync throws on non-zero exit codes, but help should work
      expect(error.stdout).toContain('Usage:');
      expect(error.stdout).toContain('golden-dir');
      expect(error.stdout).toContain('current-dir');
    }
  });

  it('should fail when golden directory does not exist', () => {
    expect(() => {
      execSync(`node "${compareDirsScript}" -o "${outputDir}" "/nonexistent" "${currentDir}"`, 
        { encoding: 'utf8', stdio: 'pipe' });
    }).toThrow();
  });

  it('should fail when current directory does not exist', () => {
    expect(() => {
      execSync(`node "${compareDirsScript}" -o "${outputDir}" "${goldenDir}" "/nonexistent"`, 
        { encoding: 'utf8', stdio: 'pipe' });
    }).toThrow();
  });

  it('should fail when output directory not specified', () => {
    expect(() => {
      execSync(`node "${compareDirsScript}" "${goldenDir}" "${currentDir}"`, 
        { encoding: 'utf8', stdio: 'pipe' });
    }).toThrow();
  });

  it('should handle empty directories gracefully', () => {
    const result = execSync(
      `node "${compareDirsScript}" -o "${outputDir}" "${goldenDir}" "${currentDir}"`, 
      { encoding: 'utf8' }
    );
    
    expect(result).toContain('No matching PNG files found');
  });

  describe('with test images', () => {
    beforeEach(() => {
      // Create simple test PNGs (1x1 pixel images)
      const redPixel = Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
        0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xDE, 0x00, 0x00, 0x00,
        0x0C, 0x49, 0x44, 0x41, 0x54, 0x08, 0x57, 0x63, 0xF8, 0x00, 0x00, 0x00,
        0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x37, 0x6E, 0xF9, 0x24, 0x00, 0x00,
        0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
      ]);
      
      const bluePixel = Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
        0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xDE, 0x00, 0x00, 0x00,
        0x0C, 0x49, 0x44, 0x41, 0x54, 0x08, 0x57, 0x63, 0x00, 0x00, 0xF8, 0x00,
        0x00, 0x00, 0x01, 0x00, 0x01, 0x37, 0x6E, 0xF9, 0x24, 0x00, 0x00, 0x00,
        0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
      ]);

      // Create identical images (should pass)
      fs.writeFileSync(path.join(goldenDir, 'identical.png'), redPixel);
      fs.writeFileSync(path.join(currentDir, 'identical.png'), redPixel);

      // Create different images (should fail)
      fs.writeFileSync(path.join(goldenDir, 'different.png'), redPixel);
      fs.writeFileSync(path.join(currentDir, 'different.png'), bluePixel);
    });

    it('should pass with identical images under threshold', () => {
      // Remove the different images to test with only identical ones
      fs.unlinkSync(path.join(goldenDir, 'different.png'));
      fs.unlinkSync(path.join(currentDir, 'different.png'));

      const result = execSync(
        `node "${compareDirsScript}" -o "${outputDir}" -t 6 "${goldenDir}" "${currentDir}"`, 
        { encoding: 'utf8' }
      );
      
      expect(result).toContain('PASS: identical.png');
      expect(result).toContain('All comparisons passed threshold');
    });

    it('should fail with different images over threshold', () => {
      // Remove the identical images to test with only different ones
      fs.unlinkSync(path.join(goldenDir, 'identical.png'));
      fs.unlinkSync(path.join(currentDir, 'identical.png'));

      try {
        execSync(
          `node "${compareDirsScript}" -o "${outputDir}" -t 6 "${goldenDir}" "${currentDir}"`, 
          { encoding: 'utf8', stdio: 'pipe' }
        );
      } catch (error) {
        expect(error.status).toBe(1);
        expect(error.stdout).toContain('FAIL: different.png');
        expect(error.stdout).toContain('comparisons exceeded threshold');
      }
    });

    it('should create output files', () => {
      execSync(
        `node "${compareDirsScript}" -o "${outputDir}" -t 6 "${goldenDir}" "${currentDir}"`, 
        { encoding: 'utf8' }
      );

      // Check that output files were created
      expect(fs.existsSync(path.join(outputDir, 'identical_diff.png'))).toBe(true);
      expect(fs.existsSync(path.join(outputDir, 'identical_data.txt'))).toBe(true);
      expect(fs.existsSync(path.join(outputDir, 'different_diff.png'))).toBe(true);
      expect(fs.existsSync(path.join(outputDir, 'different_data.txt'))).toBe(true);
      expect(fs.existsSync(path.join(outputDir, 'comparison_summary.json'))).toBe(true);

      // Check summary content
      const summary = JSON.parse(fs.readFileSync(path.join(outputDir, 'comparison_summary.json'), 'utf8'));
      expect(summary.threshold).toBe(6);
      expect(summary.totalComparisons).toBe(2);
      expect(summary.results).toHaveLength(2);
    });
  });
});