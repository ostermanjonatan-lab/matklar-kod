import { getSupabase } from '../services/supabaseClient';

/**
 * Compresses an image file (e.g. from camera or photo library) using HTML Canvas.
 * Downscales to max width/height (1200px) and outputs optimized JPEG/WebP.
 */
export async function compressImageFile(
  file: File | Blob,
  maxDimension = 1200,
  quality = 0.82
): Promise<{ dataUrl: string; blob: Blob }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;

        // Calculate new dimensions maintaining aspect ratio
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context could not be created'));
          return;
        }

        // Draw image onto canvas
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to dataUrl (JPEG)
        const dataUrl = canvas.toDataURL('image/jpeg', quality);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve({ dataUrl, blob });
            } else {
              resolve({ dataUrl, blob: file as Blob });
            }
          },
          'image/jpeg',
          quality
        );
      };

      img.onerror = () => {
        reject(new Error('Kunde inte läsa in bildfilen'));
      };

      img.src = e.target?.result as string;
    };

    reader.onerror = () => {
      reject(new Error('Kunde inte läsa filen'));
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Uploads a JPEG to the 'recipe-media' bucket and returns its public address, or null if it could
 * not be uploaded. The bucket only takes new files named like covers/recipe_… and documents/doc_…
 * (supabase_schema.sql), so a file is never written over.
 */
async function uploadJpeg(blob: Blob, kind: 'cover' | 'document'): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const id = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const filePath = kind === 'cover' ? `covers/recipe_${id}.jpg` : `documents/doc_${id}.jpg`;
  const options = {
    contentType: 'image/jpeg',
    upsert: false,
    // A file never changes, so phones may keep it for a year
    cacheControl: '31536000',
  };
  try {
    const { error } = await supabase.storage.from('recipe-media').upload(filePath, blob, options);
    if (!error) return supabase.storage.from('recipe-media').getPublicUrl(filePath).data?.publicUrl || null;
    // Households set up before the bucket was renamed have 'recipe-images'
    if (kind === 'cover') {
      const legacy = await supabase.storage.from('recipe-images').upload(filePath, blob, options);
      if (!legacy.error) return supabase.storage.from('recipe-images').getPublicUrl(filePath).data?.publicUrl || null;
    }
    console.warn('Supabase storage upload failed:', error.message);
  } catch (e) {
    console.warn('Supabase storage exception:', e);
  }
  return null;
}

/**
 * Uploads a recipe cover photo:
 * 1. Compresses image client-side to ~100-200 KB.
 * 2. If Supabase is connected, uploads to 'recipe-media' bucket (with fallback to 'recipe-images').
 * 3. Fallback: Returns the optimized compressed Base64 Data URL (permanent, works offline & across refreshes).
 */
export async function uploadRecipePhoto(file: File | Blob): Promise<string> {
  const { dataUrl, blob } = await compressImageFile(file, 1200, 0.82);
  return (await uploadJpeg(blob, 'cover')) ?? dataUrl;
}

/** True for a picture saved inside the recipe itself (data:image/…) instead of as a file */
export const isInlineImage = (url?: string | null): url is string => Boolean(url && /^data:image\//i.test(url));

/**
 * Uploads a picture saved inside a recipe (because the upload failed when it was added) and
 * returns its address, or null if it still cannot be uploaded.
 */
export async function moveInlineImage(dataUrl: string, kind: 'cover' | 'document'): Promise<string | null> {
  try {
    const source = await (await fetch(dataUrl)).blob();
    const { blob } = await compressImageFile(source, kind === 'cover' ? 1200 : 1600, kind === 'cover' ? 0.82 : 0.85);
    return await uploadJpeg(blob, kind);
  } catch (e) {
    console.warn('Could not move a picture saved in a recipe:', e);
    return null;
  }
}

/**
 * Persists a recipe document (e.g. photo of cookbook page or scanned recipe):
 * Ensures it does NOT use temporary blob: URLs which vanish on page reload.
 */
export async function persistRecipeDocument(file: File | Blob): Promise<string> {
  // If it's an image, compress and persist
  if (file.type && file.type.startsWith('image/')) {
    const { dataUrl, blob } = await compressImageFile(file, 1600, 0.85);

    return (await uploadJpeg(blob, 'document')) ?? dataUrl;
  }

  // Fallback for other files (e.g. PDF)
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
