export class ImageSafetyError extends Error {}

export function imageLimits(config = {}) {
  const limits = {
    max_image_height: config.max_image_height ?? 20000,
    max_image_pixels: config.max_image_pixels ?? 25000000,
  };
  for (const [key, value] of Object.entries(limits)) {
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new ImageSafetyError(`${key} must be a positive integer`);
    }
  }
  if (config.max_capture_height !== undefined &&
      (!Number.isSafeInteger(config.max_capture_height) || config.max_capture_height <= 0)) {
    throw new ImageSafetyError('max_capture_height must be a positive integer');
  }
  return limits;
}

export function assertImageSize(width, height, config, context) {
  const limits = imageLimits(config);
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width <= 0 || height <= 0) {
    throw new ImageSafetyError(`${context}: invalid image dimensions ${width}x${height}`);
  }
  if (height > limits.max_image_height || width * height > limits.max_image_pixels) {
    throw new ImageSafetyError(
      `${context}: refusing oversized image ${width}x${height} (${width * height} pixels). ` +
      `Limits: max_image_height=${limits.max_image_height}, max_image_pixels=${limits.max_image_pixels}. ` +
      'Check for runaway page layout, or explicitly raise the limits for intentionally large pages.'
    );
  }
}

export async function screenshotOptions(page, config, context) {
  imageLimits(config);
  const size = await page.evaluate(() => ({
    width: Math.max(window.innerWidth, document.documentElement.scrollWidth, document.body?.scrollWidth ?? 0),
    height: Math.max(window.innerHeight, document.documentElement.scrollHeight, document.body?.scrollHeight ?? 0),
    scale: window.devicePixelRatio,
  }));
  const height = Math.min(size.height, config.max_capture_height ?? 10000);
  assertImageSize(Math.ceil(size.width * size.scale), Math.ceil(height * size.scale), config, context);
  if (height < size.height) {
    console.warn(`${context}: cropping page height from ${size.height} to ${height} CSS pixels`);
  }
  // Explicit bounds prevent a dynamically growing page from escaping the cap.
  return { clip: { x: 0, y: 0, width: size.width, height }, captureBeyondViewport: true };
}
