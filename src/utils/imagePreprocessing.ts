/**
 * Advanced Canvas Image Preprocessing for OCR and Document Reading
 * Optimizes phone camera photos, cookbook pages, and magazine cutouts:
 * 1. Resizing to optimal DPI/dimensions (2400px max for dense recipe text)
 * 2. Grayscale conversion
 * 3. Unsharp masking (edge sharpening) for crisper character edges
 * 4. Dynamic contrast stretching & illumination correction
 * 5. Adaptive binarization (Bradley-Roth) for crisp black-on-white text
 */

export interface PreprocessedImageResult {
  dataUrl: string;
  blob: Blob;
  width: number;
  height: number;
}

/**
 * Loads an image from File, Blob, or URL into an HTMLImageElement
 */
export function loadImageElement(source: string | File | Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    let objectUrlToRevoke: string | null = null;

    img.onload = () => {
      if (objectUrlToRevoke) {
        URL.revokeObjectURL(objectUrlToRevoke);
      }
      resolve(img);
    };

    img.onerror = (err) => {
      if (objectUrlToRevoke) {
        URL.revokeObjectURL(objectUrlToRevoke);
      }
      reject(new Error(`Kunde inte läsa in bild: ${err}`));
    };

    if (typeof source === 'string') {
      img.src = source;
    } else {
      objectUrlToRevoke = URL.createObjectURL(source);
      img.src = objectUrlToRevoke;
    }
  });
}

/**
 * Applies a simple 3x3 unsharp mask to a grayscale Uint8Array.
 * This sharpens character edges – especially helpful for slightly blurry
 * camera photos or images distorted by book spine curvature.
 *
 * Unsharp mask: sharpened = original + amount * (original - blurred)
 * We use a fast box-blur approximation for the "blurred" version.
 */
function applyUnsharpMask(gray: Uint8Array, width: number, height: number, amount: number = 0.7): Uint8Array {
  const blurred = new Uint8Array(gray.length);

  // 3×3 box blur
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let count = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            sum += gray[ny * width + nx];
            count++;
          }
        }
      }
      blurred[y * width + x] = Math.round(sum / count);
    }
  }

  const sharpened = new Uint8Array(gray.length);
  for (let i = 0; i < gray.length; i++) {
    const val = gray[i] + amount * (gray[i] - blurred[i]);
    sharpened[i] = Math.max(0, Math.min(255, Math.round(val)));
  }
  return sharpened;
}

/**
 * Preprocesses a recipe photo using Canvas filters to maximize OCR recognition accuracy.
 */
export async function preprocessImageForOcr(
  source: string | File | Blob,
  options: {
    maxDimension?: number;
    binarize?: boolean;
    contrastBoost?: number;
    sharpen?: boolean;
  } = {}
): Promise<PreprocessedImageResult> {
  const {
    maxDimension = 2400,
    binarize = true,
    contrastBoost = 1.25,
    sharpen = true,
  } = options;

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return {
      dataUrl: typeof source === 'string' ? source : '',
      blob: source as Blob,
      width: 1000,
      height: 1000,
    };
  }

  const img = await loadImageElement(source);


  let { width, height } = img;

  // Scale down if image is too large (prevents browser WASM out-of-memory errors on 12MP+ camera photos)
  if (width > maxDimension || height > maxDimension) {
    if (width > height) {
      height = Math.round((height * maxDimension) / width);
      width = maxDimension;
    } else {
      width = Math.round((width * maxDimension) / height);
      height = maxDimension;
    }
  }

  // A small picture, such as a screenshot, is scaled up (at most twice): Tesseract reads small
  // text and signs like ½ far better when the letters are bigger
  const longest = Math.max(width, height);
  if (longest < maxDimension * 0.8) {
    const scale = Math.min(2, maxDimension / longest);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    throw new Error('Canvas 2D-kontext kunde inte skapas');
  }

  // Draw scaled original
  ctx.drawImage(img, 0, 0, width, height);

  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const numPixels = width * height;

  // 1. Convert to Grayscale & compute luminance histogram
  const gray = new Uint8Array(numPixels);
  const histogram = new Uint32Array(256);

  let minLum = 255;
  let maxLum = 0;

  for (let i = 0; i < numPixels; i++) {
    const offset = i * 4;
    // Standard perceptual luminance formula
    const lum = Math.round(
      0.299 * data[offset] + 0.587 * data[offset + 1] + 0.114 * data[offset + 2]
    );

    gray[i] = lum;
    histogram[lum]++;
    if (lum < minLum) minLum = lum;
    if (lum > maxLum) maxLum = lum;
  }

  // 2. Dynamic Contrast Stretching & Normalization
  // Compute 2nd and 98th percentiles to avoid extreme outliers/glare
  let p2 = minLum;
  let p98 = maxLum;
  let count = 0;
  const p2Target = numPixels * 0.02;
  const p98Target = numPixels * 0.98;

  let foundP2 = false;
  for (let t = 0; t < 256; t++) {
    count += histogram[t];
    if (!foundP2 && count >= p2Target) {
      p2 = t;
      foundP2 = true;
    }
    if (count >= p98Target) {
      p98 = t;
      break;
    }
  }

  const pRange = Math.max(1, p98 - p2);

  // Normalize grayscale values using the stretched percentile range
  for (let i = 0; i < numPixels; i++) {
    let norm = Math.round(((gray[i] - p2) / pRange) * 255);
    if (contrastBoost !== 1.0) {
      norm = Math.round(128 + (norm - 128) * contrastBoost);
    }
    gray[i] = Math.max(0, Math.min(255, norm));
  }

  // Light text on a dark page: turned around, since Tesseract reads dark text on light best
  const darkHistogram = new Uint32Array(256);
  for (let i = 0; i < numPixels; i++) darkHistogram[gray[i]]++;
  let below = 0;
  let medianLum = 255;
  for (let t = 0; t < 256; t++) {
    below += darkHistogram[t];
    if (below >= numPixels / 2) {
      medianLum = t;
      break;
    }
  }
  if (medianLum < 100) {
    for (let i = 0; i < numPixels; i++) gray[i] = 255 - gray[i];
  }

  // 3. Apply unsharp mask for crisper character edges (especially for blurry/curved pages)
  const processedGray = sharpen ? applyUnsharpMask(gray, width, height, 0.7) : gray;

  // 4. Apply Bradley-Roth Adaptive Local Thresholding if binarize is enabled
  if (binarize) {
    // Build 2D Integral Image for O(1) local window sum queries
    const intWidth = width + 1;
    const integral = new Uint32Array((width + 1) * (height + 1));

    for (let y = 0; y < height; y++) {
      let rowSum = 0;
      const yOffset = (y + 1) * intWidth;
      const prevYOffset = y * intWidth;
      const grayRowOffset = y * width;

      for (let x = 0; x < width; x++) {
        rowSum += processedGray[grayRowOffset + x];
        integral[yOffset + (x + 1)] = integral[prevYOffset + (x + 1)] + rowSum;
      }
    }

    // Window size s: ~1/16 of width (typically 40-150px at 2400px wide)
    const s = Math.max(15, Math.round(width / 16));
    const s2 = Math.floor(s / 2);
    // Sensitivity T: 15% darker than local mean (was 12% – more aggressive for cookbook pages)
    const tFactor = 0.85;

    for (let y = 0; y < height; y++) {
      const y1 = Math.max(0, y - s2);
      const y2 = Math.min(height - 1, y + s2);
      const rowOffset = y * width;

      for (let x = 0; x < width; x++) {
        const x1 = Math.max(0, x - s2);
        const x2 = Math.min(width - 1, x + s2);
        const windowCount = (x2 - x1 + 1) * (y2 - y1 + 1);

        const sum =
          integral[(y2 + 1) * intWidth + (x2 + 1)] -
          integral[(y2 + 1) * intWidth + x1] -
          integral[y1 * intWidth + (x2 + 1)] +
          integral[y1 * intWidth + x1];

        const localMean = sum / windowCount;
        const pixelVal = processedGray[rowOffset + x];

        const outVal = pixelVal < localMean * tFactor ? 0 : 255;
        const pOffset = (rowOffset + x) * 4;
        data[pOffset] = outVal;
        data[pOffset + 1] = outVal;
        data[pOffset + 2] = outVal;
      }
    }
  } else {
    // High-contrast Grayscale mode with sharpening: ideal for Tesseract's native internal binarization
    for (let i = 0; i < numPixels; i++) {
      const offset = i * 4;
      const val = processedGray[i];
      data[offset] = val;
      data[offset + 1] = val;
      data[offset + 2] = val;
    }
  }

  ctx.putImageData(imageData, 0, 0);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Kunde inte exportera förbehandlad bild'));
          return;
        }
        const dataUrl = canvas.toDataURL('image/jpeg', 0.94);
        resolve({
          dataUrl,
          blob,
          width,
          height,
        });
      },
      'image/jpeg',
      0.94
    );
  });
}
