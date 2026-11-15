import type React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { WIDTH, HEIGHT, RESOLUTION, PAD, COLORS, SERIF, SANS, wrap, loadImageFonts, loadPhoto } from './recipeImage';
import { imageFileName } from './shareImage';
import { hasCoverImage } from './coverImage';
import { customMealIcon } from '../components/mealplan/CustomMealImage';

/**
 * Draws a week of the plan as one JPEG picture the shape of a standing A4 page, like the recipe
 * picture, to save on the phone, send or put on the fridge: the week and its dates at the top, then
 * one row per day with the dinner's photo, the day, the dinner and the lunch.
 */

export interface WeekImageDay {
  /** "Måndag 16 nov" */
  label: string;
  /** The dinner's name, or empty */
  dinner: string;
  /** The recipe's photo, or empty for a meal written in words */
  photoUrl?: string;
  /** "Lunch: Rester" or empty */
  lunch: string;
}

const ICON_COLOR = COLORS.faint;

/** The icon for a meal written in words (Rester, Hämtmat), as a picture for the canvas */
async function loadMealIcon(name: string): Promise<HTMLImageElement | null> {
  // Both the lucide icons and the app's own take the usual SVG attributes
  const Icon = customMealIcon(name) as unknown as React.FC<React.SVGProps<SVGSVGElement>>;
  const holder = document.createElement('div');
  const root = createRoot(holder);
  flushSync(() => root.render(<Icon width={48} height={48} strokeWidth={1.5} className="" aria-hidden="true" />));
  const svg = holder.innerHTML.replace(/currentColor/g, ICON_COLOR);
  root.unmount();
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}

function draw(
  ctx: CanvasRenderingContext2D,
  title: string,
  subtitle: string,
  days: WeekImageDay[],
  photos: (HTMLImageElement | null)[],
  icons: (HTMLImageElement | null)[]
) {
  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.textBaseline = 'alphabetic';
  ctx.imageSmoothingQuality = 'high';

  let y = PAD + 60;
  ctx.font = `700 60px ${SERIF}`;
  ctx.fillStyle = COLORS.text;
  ctx.fillText(title, PAD, y);
  y += 44;
  ctx.font = `500 28px ${SANS}`;
  ctx.fillStyle = COLORS.muted;
  ctx.fillText(subtitle, PAD, y);

  const top = y + 40;
  const bottom = HEIGHT - 90;
  const rowH = Math.floor((bottom - top) / days.length);
  const thumb = Math.min(132, rowH - 36);
  const textX = PAD + thumb + 32;
  const textW = WIDTH - PAD - textX;

  days.forEach((day, i) => {
    const rowTop = top + i * rowH;
    if (i > 0) {
      ctx.fillStyle = COLORS.line;
      ctx.fillRect(PAD, rowTop, WIDTH - 2 * PAD, 2);
    }

    // The photo, or a grey square with an icon for a meal written in words
    const tx = PAD;
    const ty = rowTop + (rowH - thumb) / 2;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(tx, ty, thumb, thumb, 18);
    ctx.clip();
    const photo = photos[i];
    if (photo) {
      const s = Math.max(thumb / photo.naturalWidth, thumb / photo.naturalHeight);
      const w = photo.naturalWidth * s;
      const h = photo.naturalHeight * s;
      ctx.drawImage(photo, tx + (thumb - w) / 2, ty + (thumb - h) / 2, w, h);
    } else {
      ctx.fillStyle = '#F5F5F4';
      ctx.fillRect(tx, ty, thumb, thumb);
      const icon = icons[i];
      if (icon) {
        const size = Math.round(thumb * 0.4);
        ctx.drawImage(icon, tx + (thumb - size) / 2, ty + (thumb - size) / 2, size, size);
      }
    }
    ctx.restore();

    // The day, the dinner (at most two lines) and the lunch, centred in the row as a block
    const dinnerFont = `700 34px ${SERIF}`;
    ctx.font = dinnerFont;
    let dinnerLines = day.dinner ? wrap(ctx, day.dinner, textW) : [];
    if (dinnerLines.length > 2) {
      let second = dinnerLines.slice(1).join(' ');
      while (second.length > 1 && ctx.measureText(`${second}…`).width > textW) second = second.slice(0, -1);
      dinnerLines = [dinnerLines[0], `${second.trimEnd()}…`];
    }
    ctx.font = `400 24px ${SANS}`;
    let lunch = day.lunch;
    if (lunch && ctx.measureText(lunch).width > textW) {
      while (lunch.length > 1 && ctx.measureText(`${lunch}…`).width > textW) lunch = lunch.slice(0, -1);
      lunch = `${lunch.trimEnd()}…`;
    }

    const blockH = 24 + 14 + Math.max(dinnerLines.length, 1) * 40 + (lunch ? 36 : 0);
    let ly = rowTop + (rowH - blockH) / 2 + 22;
    ctx.font = `600 24px ${SANS}`;
    ctx.fillStyle = COLORS.muted;
    ctx.fillText(day.label, textX, ly);
    ly += 14;
    if (dinnerLines.length) {
      ctx.font = dinnerFont;
      ctx.fillStyle = COLORS.text;
      dinnerLines.forEach((line) => {
        ly += 40;
        ctx.fillText(line, textX, ly);
      });
    } else {
      ly += 40;
      ctx.font = `400 28px ${SANS}`;
      ctx.fillStyle = COLORS.faint;
      ctx.fillText('Inget planerat', textX, ly);
    }
    if (lunch) {
      ly += 36;
      ctx.font = `400 24px ${SANS}`;
      ctx.fillStyle = COLORS.muted;
      ctx.fillText(lunch, textX, ly);
    }
  });

  ctx.font = `500 24px ${SANS}`;
  ctx.fillStyle = COLORS.faint;
  ctx.textAlign = 'right';
  ctx.fillText('Från MatKlar', WIDTH - PAD, HEIGHT - 40);
  ctx.textAlign = 'left';
}

function toJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Bilden gick inte att skapa'))), 'image/jpeg', 0.92);
    } catch (err) {
      reject(err);
    }
  });
}

/** Makes the picture of the week as a JPEG */
export async function createWeekPlanImage(title: string, subtitle: string, days: WeekImageDay[]): Promise<Blob> {
  await loadImageFonts();
  const [photos, icons] = await Promise.all([
    Promise.all(days.map((d) => (hasCoverImage(d.photoUrl) ? loadPhoto(d.photoUrl) : Promise.resolve(null)))),
    Promise.all(days.map((d) => (d.dinner && !hasCoverImage(d.photoUrl) ? loadMealIcon(d.dinner) : Promise.resolve(null)))),
  ]);

  const canvas = document.createElement('canvas');
  canvas.width = WIDTH * RESOLUTION;
  canvas.height = HEIGHT * RESOLUTION;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(RESOLUTION, RESOLUTION);
  draw(ctx, title, subtitle, days, photos, icons);
  try {
    return await toJpeg(canvas);
  } catch {
    // A photo from a site that does not allow it makes the canvas unreadable: draw without photos
    const plain = document.createElement('canvas');
    plain.width = canvas.width;
    plain.height = canvas.height;
    const c = plain.getContext('2d')!;
    c.scale(RESOLUTION, RESOLUTION);
    draw(c, title, subtitle, days, days.map(() => null), icons);
    return toJpeg(plain);
  }
}

/** A file name like "vecka-47.jpg" */
export function weekPlanImageFileName(title: string): string {
  return imageFileName(title, 'veckoplan', 'jpg');
}
