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
 * Uploads a recipe cover photo:
 * 1. Compresses image client-side to ~100-200 KB.
 * 2. If Supabase is connected, uploads to 'recipe-media' bucket (with fallback to 'recipe-images').
 * 3. Fallback: Returns the optimized compressed Base64 Data URL (permanent, works offline & across refreshes).
 */
export async function uploadRecipePhoto(file: File | Blob): Promise<string> {
  // 1. Compress image first
  const { dataUrl, blob } = await compressImageFile(file, 1200, 0.82);

  // 2. Try Supabase Storage if configured
  const supabase = getSupabase();
  if (supabase) {
    try {
      const fileName = `recipe_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.jpg`;
      const filePath = `covers/${fileName}`;

      // Try recipe-media first
      let uploadResult = await supabase.storage
        .from('recipe-media')
        .upload(filePath, blob, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      let bucketName = 'recipe-media';

      // If recipe-media bucket does not exist, try legacy recipe-images bucket
      if (uploadResult.error) {
        const legacyResult = await supabase.storage
          .from('recipe-images')
          .upload(filePath, blob, {
            contentType: 'image/jpeg',
            upsert: true,
          });

        if (!legacyResult.error) {
          uploadResult = legacyResult;
          bucketName = 'recipe-images';
        }
      }

      if (!uploadResult.error) {
        const { data: publicUrlData } = supabase.storage
          .from(bucketName)
          .getPublicUrl(filePath);

        if (publicUrlData?.publicUrl) {
          return publicUrlData.publicUrl;
        }
      } else {
        console.warn('Supabase storage upload failed, falling back to dataUrl:', uploadResult.error.message);
      }
    } catch (e) {
      console.warn('Supabase storage exception, falling back to dataUrl:', e);
    }
  }

  // Fallback to permanent Data URL
  return dataUrl;
}

/**
 * Persists a recipe document (e.g. photo of cookbook page or scanned recipe):
 * Ensures it does NOT use temporary blob: URLs which vanish on page reload.
 */
export async function persistRecipeDocument(file: File | Blob): Promise<string> {
  // If it's an image, compress and persist
  if (file.type && file.type.startsWith('image/')) {
    const { dataUrl, blob } = await compressImageFile(file, 1600, 0.85);

    const supabase = getSupabase();
    if (supabase) {
      try {
        const fileName = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.jpg`;
        const filePath = `documents/${fileName}`;

        const { error } = await supabase.storage
          .from('recipe-media')
          .upload(filePath, blob, {
            contentType: 'image/jpeg',
            upsert: true,
          });

        if (!error) {
          const { data: publicUrlData } = supabase.storage
            .from('recipe-media')
            .getPublicUrl(filePath);

          if (publicUrlData?.publicUrl) {
            return publicUrlData.publicUrl;
          }
        }
      } catch (err) {
        console.warn('Document upload to Supabase failed, using permanent dataUrl:', err);
      }
    }

    return dataUrl;
  }

  // Fallback for other files (e.g. PDF)
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
