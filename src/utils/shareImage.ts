/**
 * Sharing and saving a picture made in the app (a recipe or a shopping list).
 * Returns what happened, so the view can close and say so.
 */
export type ImageResult = 'shared' | 'saved' | 'cancelled';

/** Opens the phone's share menu with the picture. Without one (a computer) it is saved instead. */
export async function shareImageFile(image: File, title?: string): Promise<ImageResult> {
  if (navigator.canShare?.({ files: [image] })) {
    try {
      await navigator.share({ files: [image], title });
      return 'shared';
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled';
    }
  }
  return saveImageFile(image);
}

/**
 * On iPhone the share menu is the way to save to Bilder, so it opens there. Elsewhere the
 * picture is downloaded and ends up among the phone's downloads and in the photo gallery.
 */
export async function saveImageFile(image: File): Promise<ImageResult> {
  if (/iPhone|iPad|iPod/.test(navigator.userAgent) && navigator.canShare?.({ files: [image] })) {
    try {
      await navigator.share({ files: [image] });
      return 'shared';
    } catch {
      return 'cancelled';
    }
  }
  const url = URL.createObjectURL(image);
  const a = document.createElement('a');
  a.href = url;
  a.download = image.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'saved';
}

/** A file name like "inkopslista-stugan.png": letters and digits only */
export function imageFileName(text: string, fallback: string): string {
  const slug = text
    .toLowerCase()
    .replace(/[åä]/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `${slug || fallback}.png`;
}
