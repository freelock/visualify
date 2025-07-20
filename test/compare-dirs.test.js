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
    beforeEach(async () => {
      const sharp = (await import('sharp')).default;
      
      // Create simple test PNGs using Sharp
      const redImage = await sharp({
        create: {
          width: 10,
          height: 10,
          channels: 3,
          background: { r: 255, g: 0, b: 0 }
        }
      }).png().toBuffer();
      
      const blueImage = await sharp({
        create: {
          width: 10,
          height: 10,
          channels: 3,
          background: { r: 0, g: 0, b: 255 }
        }
      }).png().toBuffer();

      // Create identical images (should pass)
      fs.writeFileSync(path.join(goldenDir, 'identical.png'), redImage);
      fs.writeFileSync(path.join(currentDir, 'identical.png'), redImage);

      // Create different images (should fail)
      fs.writeFileSync(path.join(goldenDir, 'different.png'), redImage);
      fs.writeFileSync(path.join(currentDir, 'different.png'), blueImage);
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

    it('should process files and exit with correct status', () => {
      // This test should fail because different images exceed threshold
      try {
        const result = execSync(
          `node "${compareDirsScript}" -o "${outputDir}" -t 6 "${goldenDir}" "${currentDir}"`, 
          { encoding: 'utf8', stdio: 'pipe' }
        );
        // Should not reach here - command should fail due to threshold
        expect.fail('Command should have failed due to threshold exceeded');
      } catch (error) {
        // Expected to fail due to threshold exceeded
        expect(error.status).toBe(1);
        expect(error.stdout).toContain('Found 2 matching files to compare');
        expect(error.stdout).toContain('FAIL: different.png');
        expect(error.stdout).toContain('PASS: identical.png');
        expect(error.stdout).toContain('Exiting with code 1');
      }
    });
  });
});