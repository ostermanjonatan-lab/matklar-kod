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
 * Draws a recipe as one tall picture (1080 px wide) to send in a chat or save on the phone:
 * the photo, the name, time and portions, the ingredients and the steps. Drawn straight on a
 * canvas with the app's own fonts, so it needs no extra library.
 */

const WIDTH = 1080;
const PAD = 80;
const COLORS = {
  background: '#FCFAF5',
  text: '#1C1917',
  muted: '#78716C',
  faint: '#A8A29E',
  line: '#E7E2D9',
  green: '#284235',
};
const SERIF = 'Fraunces, Georgia, serif';
const SANS = '"Plus Jakarta Sans", system-ui, -apple-system, sans-serif';

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
  height: number;
  draw: (ctx: CanvasRenderingContext2D) => void;
}

/** Works out where everything goes. Run once to get the height, then again to draw. */
function layout(ctx: CanvasRenderingContext2D, recipe: Recipe, servings: number, photo: HTMLImageElement | null): Layout {
  const ops: ((c: CanvasRenderingContext2D) => void)[] = [];
  const inner = WIDTH - PAD * 2;
  let y = 0;

  if (photo) {
    const photoHeight = 760;
    const scale = Math.max(WIDTH / photo.naturalWidth, photoHeight / photo.naturalHeight);
    const w = photo.naturalWidth * scale;
    const h = photo.naturalHeight * scale;
    ops.push((c) => c.drawImage(photo, (WIDTH - w) / 2, (photoHeight - h) / 2, w, h));
    y = photoHeight + 72;
  } else {
    y = 110;
  }

  // Name
  ctx.font = `700 68px ${SERIF}`;
  for (const line of wrap(ctx, formatRecipeTitle(recipe.title), inner)) {
    y += 68;
    const yy = y;
    ops.push((c) => {
      c.font = `700 68px ${SERIF}`;
      c.fillStyle = COLORS.text;
      c.fillText(line, PAD, yy);
    });
    y += 14;
  }

  // Time, portions and difficulty
  const meta = [
    formatCookingTime(recipe.prepTimeMinutes, recipe.cookTimeMinutes),
    `${servings} portioner`,
    recipe.difficulty ? DIFFICULTY_LABELS[recipe.difficulty] : '',
  ]
    .filter(Boolean)
    .join('  ·  ');
  y += 46;
  const metaY = y;
  ops.push((c) => {
    c.font = `500 32px ${SANS}`;
    c.fillStyle = COLORS.muted;
    c.fillText(meta, PAD, metaY);
  });

  const heading = (text: string) => {
    y += 110;
    const yy = y;
    ops.push((c) => {
      c.font = `700 46px ${SERIF}`;
      c.fillStyle = COLORS.text;
      c.fillText(text, PAD, yy);
    });
    y += 30;
  };
  const rule = (yy: number) =>
    ops.push((c) => {
      c.fillStyle = COLORS.line;
      c.fillRect(PAD, yy, inner, 2);
    });

  // Ingredients: name to the left, amount to the right
  if (recipe.ingredients.length > 0) {
    heading('Ingredienser');
    rule(y);
    for (const ing of recipe.ingredients) {
      const scaled = scaleIngredientAmount(ing.amount, recipe.servings, servings);
      const amount = scaled !== null ? `${formatAmount(scaled)} ${formatUnit(ing.unit, scaled)}`.trim() : ing.unit || '';
      const name = capitalizeFirst(formatIngredientName(ing.name, scaled, ing.unit));
      ctx.font = `700 32px ${SANS}`;
      const amountWidth = amount ? ctx.measureText(amount).width + 32 : 0;
      ctx.font = `400 32px ${SANS}`;
      const lines = wrap(ctx, name, inner - amountWidth);
      const top = y;
      lines.forEach((line, i) => {
        const yy = top + 58 + i * 44;
        ops.push((c) => {
          c.font = `400 32px ${SANS}`;
          c.fillStyle = COLORS.text;
          c.fillText(line, PAD, yy);
        });
      });
      if (amount) {
        ops.push((c) => {
          c.font = `700 32px ${SANS}`;
          c.fillStyle = COLORS.green;
          c.textAlign = 'right';
          c.fillText(amount, WIDTH - PAD, top + 58);
          c.textAlign = 'left';
        });
      }
      y = top + 58 + (lines.length - 1) * 44 + 30;
      rule(y);
    }
  }

  // Steps, numbered
  if (recipe.instructions.length > 0) {
    heading('Gör så här');
    rule(y);
    const textX = PAD + 64;
    for (const [i, step] of recipe.instructions.entries()) {
      ctx.font = `400 32px ${SANS}`;
      const lines = wrap(ctx, step.text, WIDTH - PAD - textX);
      const top = y;
      ops.push((c) => {
        c.font = `700 36px ${SERIF}`;
        c.fillStyle = COLORS.faint;
        c.fillText(String(i + 1), PAD, top + 60);
      });
      lines.forEach((line, li) => {
        const yy = top + 60 + li * 48;
        ops.push((c) => {
          c.font = `400 32px ${SANS}`;
          c.fillStyle = COLORS.text;
          c.fillText(line, textX, yy);
        });
      });
      y = top + 60 + (lines.length - 1) * 48 + 34;
      rule(y);
    }
  }

  // Where the picture comes from
  y += 90;
  const footY = y;
  ops.push((c) => {
    c.font = `500 26px ${SANS}`;
    c.fillStyle = COLORS.faint;
    c.fillText('Från MatKlar', PAD, footY);
  });
  y += 70;

  return {
    height: Math.ceil(y),
    draw: (c) => ops.forEach((op) => op(c)),
  };
}

/** Makes the picture of the recipe, with the amounts for the given number of portions. */
export async function createRecipeImage(recipe: Recipe, servings: number): Promise<Blob> {
  // The fonts must be loaded before anything is measured
  try {
    await Promise.all([
      document.fonts.load(`700 68px Fraunces`),
      document.fonts.load(`400 32px "Plus Jakarta Sans"`),
      document.fonts.load(`700 32px "Plus Jakarta Sans"`),
      document.fonts.load(`500 32px "Plus Jakarta Sans"`),
    ]);
  } catch {
    // Fall back to the system fonts
  }
  const photo = await loadPhoto(recipe.coverImageUrl);

  const canvas = document.createElement('canvas');
  const measure = canvas.getContext('2d')!;
  const { height, draw } = layout(measure, recipe, servings, photo);

  canvas.width = WIDTH;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, WIDTH, height);
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
