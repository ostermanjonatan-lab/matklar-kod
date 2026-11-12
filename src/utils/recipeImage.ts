import { hasCoverImage } from './coverImage';
import type { Recipe } from '../types/recipe';
import { DIFFICULTY_LABELS } from './recipeDifficulty';
import {
  scaleIngredientAmount,
  formatAmount,
  formatUnit,
  formatIngredientName,
  capitalizeFirst,
  formatCookingTime,
  formatRecipeTitle,
} from './formatters';

/**
 * Draws a recipe as one picture the shape of a standing A4 page, so it prints well, to send in a
 * chat or save on the phone: the photo, the name, time and portions, and below that the ingredients to the left
 * and the steps to the right. Long recipes get smaller text, then a lower photo, then no photo,
 * so everything fits. Drawn straight on a canvas with the app's own fonts.
 */

// Laid out on 1080 × 1527 (A4 is 210 × 297 mm), drawn at twice that: 2160 × 3054 px, about
// 260 dots per inch on paper
const WIDTH = 1080;
const HEIGHT = Math.round((WIDTH * 297) / 210);
const RESOLUTION = 2;
const PAD = 64;
const COLORS = {
  background: '#FCFAF5',
  text: '#1C1917',
  muted: '#78716C',
  faint: '#A8A29E',
  line: '#E7E2D9',
  green: '#284235',
};
const SERIF = '"Fraunces Variable", Georgia, serif';
const SANS = '"Plus Jakarta Sans Variable", system-ui, -apple-system, sans-serif';

/** Splits text into lines that fit the width. Very long words are cut. */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width <= maxWidth) {
      line = test;
      continue;
    }
    if (line) lines.push(line);
    // A single word wider than the column
    let rest = word;
    while (ctx.measureText(rest).width > maxWidth && rest.length > 1) {
      let cut = rest.length - 1;
      while (cut > 1 && ctx.measureText(rest.slice(0, cut)).width > maxWidth) cut--;
      lines.push(rest.slice(0, cut));
      rest = rest.slice(cut);
    }
    line = rest;
  }
  if (line) lines.push(line);
  return lines.length > 0 ? lines : [''];
}

/**
 * The photo, or null if it cannot be drawn (another site that does not allow it).
 * Tried a second time with a changed address, since a copy the app already showed may be
 * kept in a form that cannot be drawn on a canvas.
 */
async function loadPhoto(url: string): Promise<HTMLImageElement | null> {
  const first = await loadPhotoOnce(url);
  if (first || !url || url.startsWith('data:')) return first;
  return loadPhotoOnce(`${url}${url.includes('?') ? '&' : '?'}bild=1`);
}

function loadPhotoOnce(url: string): Promise<HTMLImageElement | null> {
  if (!url) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    if (!url.startsWith('data:')) img.crossOrigin = 'anonymous';
    const timer = setTimeout(() => resolve(null), 6000);
    img.onload = () => {
      clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(timer);
      resolve(null);
    };
    img.src = url;
  });
}

interface Layout {
  /** Where the content ends. It fits when this is above the footer. */
  bottom: number;
  draw: (ctx: CanvasRenderingContext2D) => void;
}

/** Works out where everything goes for one text size (scale) and photo height. */
function layout(
  ctx: CanvasRenderingContext2D,
  recipe: Recipe,
  servings: number,
  photo: HTMLImageElement | null,
  scale: number,
  photoHeight: number
): Layout {
  const ops: ((c: CanvasRenderingContext2D) => void)[] = [];
  const inner = WIDTH - PAD * 2;
  const px = (n: number) => Math.round(n * scale);
  const text = (font: string, color: string, value: string, x: number, y: number, align: CanvasTextAlign = 'left') =>
    ops.push((c) => {
      c.font = font;
      c.fillStyle = color;
      c.textAlign = align;
      c.fillText(value, x, y);
      c.textAlign = 'left';
    });
  const rule = (x: number, y: number, w: number) =>
    ops.push((c) => {
      c.fillStyle = COLORS.line;
      c.fillRect(x, y, w, 2);
    });

  let y: number;
  if (photo && photoHeight > 0) {
    const s = Math.max(WIDTH / photo.naturalWidth, photoHeight / photo.naturalHeight);
    const w = photo.naturalWidth * s;
    const h = photo.naturalHeight * s;
    ops.push((c) => {
      c.save();
      c.beginPath();
      c.rect(0, 0, WIDTH, photoHeight);
      c.clip();
      c.drawImage(photo, (WIDTH - w) / 2, (photoHeight - h) / 2, w, h);
      c.restore();
    });
    y = photoHeight + px(36);
  } else {
    y = PAD;
  }

  // Name
  const titleFont = `700 ${px(60)}px ${SERIF}`;
  ctx.font = titleFont;
  for (const line of wrap(ctx, formatRecipeTitle(recipe.title), inner)) {
    y += px(62);
    text(titleFont, COLORS.text, line, PAD, y);
  }

  // Time, portions and difficulty
  const meta = [
    formatCookingTime(recipe.prepTimeMinutes, recipe.cookTimeMinutes),
    `${servings} portioner`,
    recipe.difficulty ? DIFFICULTY_LABELS[recipe.difficulty] : '',
  ]
    .filter(Boolean)
    .join('  ·  ');
  y += px(44);
  text(`500 ${px(28)}px ${SANS}`, COLORS.muted, meta, PAD, y);

  // Two columns: ingredients to the left, steps to the right
  const gap = px(44);
  const leftW = Math.round((inner - gap) * 0.4);
  const rightX = PAD + leftW + gap;
  const rightW = WIDTH - PAD - rightX;
  const columnTop = y + px(40);
  const headingFont = `700 ${px(36)}px ${SERIF}`;
  const bodySize = px(25);
  const lineHeight = Math.round(bodySize * 1.42);
  const bodyFont = `400 ${bodySize}px ${SANS}`;
  const boldFont = `700 ${bodySize}px ${SANS}`;

  // Ingredients: "400 g Spaghetti" with the amount in green
  let ly = columnTop + px(36);
  text(headingFont, COLORS.text, 'Ingredienser', PAD, ly);
  ly += px(20);
  rule(PAD, ly, leftW);
  for (const ing of recipe.ingredients) {
    const scaled = scaleIngredientAmount(ing.amount, recipe.servings, servings);
    const amount = scaled !== null ? `${formatAmount(scaled)} ${formatUnit(ing.unit, scaled)}`.trim() : ing.unit || '';
    const name = capitalizeFirst(formatIngredientName(ing.name, scaled, ing.unit));
    ctx.font = boldFont;
    const amountW = amount ? ctx.measureText(amount + ' ').width : 0;
    ctx.font = bodyFont;
    // The first line starts after the amount, the next lines use the whole column
    const firstLines = wrap(ctx, name, leftW - amountW);
    const lines = firstLines.length > 1 ? [firstLines[0], ...wrap(ctx, firstLines.slice(1).join(' '), leftW)] : firstLines;
    let row = ly + px(14) + bodySize;
    if (amount) text(boldFont, COLORS.green, amount, PAD, row);
    lines.forEach((line, i) => {
      text(bodyFont, COLORS.text, line, PAD + (i === 0 ? amountW : 0), row);
      if (i < lines.length - 1) row += lineHeight;
    });
    ly = row + px(16);
    rule(PAD, ly, leftW);
  }

  // Steps, numbered
  let ry = columnTop + px(36);
  text(headingFont, COLORS.text, 'Gör så här', rightX, ry);
  ry += px(20);
  rule(rightX, ry, rightW);
  const numberW = px(40);
  for (const [i, step] of recipe.instructions.entries()) {
    ctx.font = bodyFont;
    const lines = wrap(ctx, step.text, rightW - numberW);
    let row = ry + px(14) + bodySize;
    text(`700 ${px(28)}px ${SERIF}`, COLORS.faint, String(i + 1), rightX, row);
    lines.forEach((line, li) => {
      text(bodyFont, COLORS.text, line, rightX + numberW, row);
      if (li < lines.length - 1) row += lineHeight;
    });
    ry = row + px(16);
    rule(rightX, ry, rightW);
  }

  text(`500 24px ${SANS}`, COLORS.faint, 'Från MatKlar', PAD, HEIGHT - 40);

  return {
    bottom: Math.max(ly, ry),
    draw: (c) => ops.forEach((op) => op(c)),
  };
}

/** The largest text and photo that make the recipe fit. Last resort: the smallest text, cut off. */
function fitLayout(ctx: CanvasRenderingContext2D, recipe: Recipe, servings: number, photo: HTMLImageElement | null): Layout {
  const limit = HEIGHT - 80;
  const tries: [number, number][] = [];
  if (photo) {
    for (let s = 1; s >= 0.75; s -= 0.05) tries.push([s, 560]);
    for (let s = 0.9; s >= 0.6; s -= 0.05) tries.push([s, 400]);
  }
  for (let s = 1; s >= 0.5; s -= 0.05) tries.push([s, 0]);
  let last: Layout | null = null;
  for (const [s, ph] of tries) {
    last = layout(ctx, recipe, servings, photo, s, ph);
    if (last.bottom <= limit) return last;
  }
  return last!;
}

/** Makes the picture of the recipe, with the amounts for the given number of portions. */
export async function createRecipeImage(recipe: Recipe, servings: number): Promise<Blob> {
  // The fonts must be loaded before anything is measured
  try {
    await Promise.all([
      document.fonts.load(`700 68px "Fraunces Variable"`),
      document.fonts.load(`400 32px "Plus Jakarta Sans Variable"`),
      document.fonts.load(`700 32px "Plus Jakarta Sans Variable"`),
      document.fonts.load(`500 32px "Plus Jakarta Sans Variable"`),
    ]);
  } catch {
    // Fall back to the system fonts
  }
  const photo = hasCoverImage(recipe.coverImageUrl) ? await loadPhoto(recipe.coverImageUrl) : null;

  const canvas = document.createElement('canvas');
  canvas.width = WIDTH * RESOLUTION;
  canvas.height = HEIGHT * RESOLUTION;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(RESOLUTION, RESOLUTION);
  ctx.imageSmoothingQuality = 'high';
  const { draw } = fitLayout(ctx, recipe, servings, photo);

  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.textBaseline = 'alphabetic';
  draw(ctx);

  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Bilden gick inte att skapa'))), 'image/png');
    } catch (err) {
      // A photo from a site that does not allow it makes the canvas unreadable
      reject(err);
    }
  });
}

/** A file name like "klassisk-kramig-pasta-carbonara.png". */
export function recipeImageFileName(recipe: Recipe): string {
  const slug = recipe.title
    .toLowerCase()
    .replace(/[åä]/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `${slug || 'recept'}.png`;
}
