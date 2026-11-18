import type React from 'react';
import type { CoverFocus } from '../types/recipe';

/**
 * Where a recipe's picture is placed in its boxes: the point (x, y in per cent of the picture)
 * that is kept in view, and how far it is zoomed in (1 = the whole picture fills the box).
 * Kept as a hidden tag ("__bild:50,30,1.2") so that it is saved without a new column.
 */
const TAG_PREFIX = '__bild:';
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 3;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const round = (n: number, step: number) => Math.round(n / step) * step;

export function normalizeCoverFocus(value: unknown): CoverFocus | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const { x, y, zoom } = value as Record<string, unknown>;
  if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) return undefined;
  const z = typeof zoom === 'number' && Number.isFinite(zoom) ? zoom : 1;
  const focus = { x: round(clamp(x, 0, 100), 0.5), y: round(clamp(y, 0, 100), 0.5), zoom: round(clamp(z, MIN_ZOOM, MAX_ZOOM), 0.01) };
  // The middle without zoom is how pictures are shown anyway
  return isDefaultFocus(focus) ? undefined : focus;
}

export function isDefaultFocus(f: CoverFocus | undefined): boolean {
  return !f || (f.x === 50 && f.y === 50 && f.zoom === 1);
}

/** Reads the picture tag and returns the other tags without it. */
export function splitCoverFocusTag(tags: unknown): { coverFocus?: CoverFocus; tags: string[] } {
  const list = Array.isArray(tags) ? tags.filter((t): t is string => typeof t === 'string') : [];
  let coverFocus: CoverFocus | undefined;
  const rest = list.filter((t) => {
    if (!t.startsWith(TAG_PREFIX)) return true;
    const [x, y, zoom] = t.slice(TAG_PREFIX.length).split(',').map(Number);
    coverFocus = normalizeCoverFocus({ x, y, zoom });
    return false;
  });
  return { coverFocus, tags: rest };
}

/** The tags to save: the recipe's own tags plus the picture tag, if the picture is moved. */
export function withCoverFocusTag(tags: string[] | undefined, focus: CoverFocus | undefined): string[] {
  const rest = splitCoverFocusTag(tags).tags;
  const f = normalizeCoverFocus(focus);
  return f ? [...rest, `${TAG_PREFIX}${f.x},${f.y},${f.zoom}`] : rest;
}

/** The style for an object-cover picture so that it shows the chosen part. */
export function coverFocusStyle(focus: CoverFocus | undefined): React.CSSProperties | undefined {
  if (isDefaultFocus(focus)) return undefined;
  const { x, y, zoom } = focus!;
  return {
    objectPosition: `${x}% ${y}%`,
    ...(zoom > 1 ? { transform: `scale(${zoom})`, transformOrigin: `${x}% ${y}%` } : {}),
  };
}
