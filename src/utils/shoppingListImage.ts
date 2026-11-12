import { WIDTH, HEIGHT, RESOLUTION, PAD, LEFT, COLORS, SERIF, SANS, wrap, loadImageFonts } from './recipeImage';
import { imageFileName } from './shareImage';

/**
 * Draws a shopping list as one picture the shape of a standing A4 page, like the recipe picture,
 * to save, send or print: the list's name and the date at the top, then the items in two columns,
 * by aisle, each with a box to tick on paper. The left margin leaves room for a hole punch.
 * A long list gets smaller text so everything fits.
 */

export interface ShoppingImageItem {
  /** "2 l" or empty */
  amount: string;
  name: string;
  comment?: string;
}

export interface ShoppingImageGroup {
  /** The aisle, or empty when the list is shown without them */
  heading: string;
  items: ShoppingImageItem[];
}

interface Placed {
  bottom: number;
  fits: boolean;
  draw: (c: CanvasRenderingContext2D) => void;
}

function layout(ctx: CanvasRenderingContext2D, title: string, subtitle: string, groups: ShoppingImageGroup[], scale: number): Placed {
  const ops: ((c: CanvasRenderingContext2D) => void)[] = [];
  const px = (n: number) => Math.round(n * scale);
  const text = (font: string, color: string, value: string, x: number, y: number) =>
    ops.push((c) => {
      c.font = font;
      c.fillStyle = color;
      c.fillText(value, x, y);
    });
  const rule = (x: number, y: number, w: number) =>
    ops.push((c) => {
      c.fillStyle = COLORS.line;
      c.fillRect(x, y, w, 2);
    });

  // Name of the list and the date. These keep their size.
  let y = PAD;
  const titleFont = `700 60px ${SERIF}`;
  ctx.font = titleFont;
  for (const line of wrap(ctx, title, WIDTH - LEFT - PAD)) {
    y += 64;
    text(titleFont, COLORS.text, line, LEFT, y);
  }
  y += 44;
  text(`500 28px ${SANS}`, COLORS.muted, subtitle, LEFT, y);
  const top = y + 48;
  const bottomLimit = HEIGHT - 80;

  // Two columns, filled top to bottom, the left one first
  const gap = 48;
  const colW = Math.floor((WIDTH - LEFT - PAD - gap) / 2);
  const columns = [LEFT, LEFT + colW + gap];
  let col = 0;
  let cy = top;
  let fits = true;
  let lowest = top;

  const headingFont = `700 ${px(30)}px ${SERIF}`;
  const bodySize = px(26);
  const lineHeight = Math.round(bodySize * 1.35);
  const bodyFont = `400 ${bodySize}px ${SANS}`;
  const boldFont = `700 ${bodySize}px ${SANS}`;
  const noteFont = `400 ${px(21)}px ${SANS}`;
  const box = px(22);
  const textX = box + px(14);

  // Heights are worked out first, so a heading is never left alone at the bottom of a column
  const itemLines = (item: ShoppingImageItem) => {
    ctx.font = boldFont;
    const amountW = item.amount ? ctx.measureText(item.amount + ' ').width : 0;
    ctx.font = bodyFont;
    const width = colW - textX;
    const first = wrap(ctx, item.name, width - amountW);
    const lines = first.length > 1 ? [first[0], ...wrap(ctx, first.slice(1).join(' '), width)] : first;
    ctx.font = noteFont;
    const notes = item.comment ? wrap(ctx, item.comment, width) : [];
    return { amountW, lines, notes };
  };
  const itemHeight = (m: ReturnType<typeof itemLines>) =>
    px(14) + bodySize + (m.lines.length - 1) * lineHeight + m.notes.length * px(28) + px(14);
  const headingHeight = groups.some((g) => g.heading) ? px(56) : 0;

  const nextColumn = () => {
    if (col === 1) {
      fits = false;
      return false;
    }
    col = 1;
    cy = top;
    return true;
  };

  for (const group of groups) {
    if (!fits) break;
    const measured = group.items.map(itemLines);
    if (group.heading) {
      const needed = headingHeight + (measured[0] ? itemHeight(measured[0]) : 0);
      if (cy + needed > bottomLimit && !nextColumn()) break;
      const x = columns[col];
      text(headingFont, COLORS.text, group.heading, x, cy + px(40));
      cy += headingHeight;
      rule(x, cy - 2, colW);
    }
    for (const m of measured) {
      const h = itemHeight(m);
      if (cy + h > bottomLimit) {
        if (!nextColumn()) break;
        // The aisle goes on in the next column: its heading again
        if (group.heading) {
          text(headingFont, COLORS.text, group.heading, columns[col], cy + px(40));
          cy += headingHeight;
          rule(columns[col], cy - 2, colW);
        }
      }
      const x = columns[col];
      const row = cy + px(14) + bodySize;
      const boxTop = row - bodySize * 0.78;
      ops.push((c) => {
        c.strokeStyle = COLORS.faint;
        c.lineWidth = 2;
        c.beginPath();
        c.roundRect(x + 1, boxTop, box, box, px(4));
        c.stroke();
      });
      const item = group.items[measured.indexOf(m)];
      if (item.amount) text(boldFont, COLORS.green, item.amount, x + textX, row);
      let ly = row;
      m.lines.forEach((line, i) => {
        text(bodyFont, COLORS.text, line, x + textX + (i === 0 ? m.amountW : 0), ly);
        if (i < m.lines.length - 1) ly += lineHeight;
      });
      m.notes.forEach((note) => {
        ly += px(28);
        text(noteFont, COLORS.muted, note, x + textX, ly);
      });
      cy += h;
      rule(x, cy, colW);
      lowest = Math.max(lowest, cy);
    }
  }

  text(`500 24px ${SANS}`, COLORS.faint, 'Från MatKlar', LEFT, HEIGHT - 40);
  return { bottom: lowest, fits, draw: (c) => ops.forEach((op) => op(c)) };
}

/** Makes the picture of the shopping list */
export async function createShoppingListImage(title: string, subtitle: string, groups: ShoppingImageGroup[]): Promise<Blob> {
  await loadImageFonts();
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH * RESOLUTION;
  canvas.height = HEIGHT * RESOLUTION;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(RESOLUTION, RESOLUTION);

  // The largest text that makes the whole list fit. Last resort: the smallest, cut off.
  let placed: Placed | null = null;
  for (let s = 1; s >= 0.5; s -= 0.05) {
    placed = layout(ctx, title, subtitle, groups, s);
    if (placed.fits) break;
  }

  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.textBaseline = 'alphabetic';
  placed!.draw(ctx);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Bilden gick inte att skapa'))), 'image/png');
  });
}

/** A file name like "inkopslista.png" or "stugan.png" */
export function shoppingListImageFileName(title: string): string {
  return imageFileName(title, 'inkopslista');
}
