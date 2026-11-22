/**
 * Pictures in the size they are shown at. On Vercel a picture on the web is fetched through
 * Vercel's image service (/_vercel/image), which makes it smaller, turns it into WebP and keeps it
 * on Vercel's servers. As it then comes from the app's own address, the app can also keep it on
 * the phone (public/sw.js). The widths must be among `images.sizes` in vercel.json.
 */
const WIDTHS = {
  /** Small squares: rows in lists, the month calendar */
  thumb: 160,
  /** Tiles three to a row */
  tile: 400,
  /** Cards and the day's dinner */
  card: 828,
  /** The opened recipe */
  full: 1600,
} as const;

export type ImageSize = keyof typeof WIDTHS;

// Only on Vercel: when testing the app locally there is no image service
const imageServiceAvailable =
  typeof window !== 'undefined' &&
  !import.meta.env.DEV &&
  !/^(localhost|127\.|192\.168\.|10\.|\[?::1)/.test(window.location.hostname);

export function sizedImage(url: string | undefined | null, size: ImageSize): string {
  if (!url) return '';
  if (!imageServiceAvailable || !/^https?:\/\//i.test(url)) return url;
  return `/_vercel/image?url=${encodeURIComponent(url)}&w=${WIDTHS[size]}&q=75`;
}

/** True if the picture was asked for through the image service, so the original can be tried. */
export const isSizedImage = (src: string) => src.includes('/_vercel/image?');
