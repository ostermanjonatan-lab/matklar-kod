import { useEffect, useState } from 'react';
import type { ShoppingItem } from '../types/recipe';

/**
 * Items that left the shopping list without being bought, kept for a day on this phone, so
 * nothing disappears unnoticed: removed here (a swipe, the menu, Töm hela listan, Ångra) or on
 * another phone in the household. Each can be put back.
 */
export interface RemovedItem {
  item: ShoppingItem;
  removedAt: number;
  /** Removed on another phone, seen here when the list was updated */
  byOther: boolean;
  /** The notice about it at the top of the list has been closed */
  seen: boolean;
}

const KEY = 'matklar_removed_items_v1';
const CHANGED_EVENT = 'matklar-removed-items-changed';
const KEEP_MS = 24 * 60 * 60 * 1000;

function load(): RemovedItem[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || '[]');
    const cutoff = Date.now() - KEEP_MS;
    return Array.isArray(parsed) ? parsed.filter((r) => r && r.item && r.removedAt > cutoff) : [];
  } catch {
    return [];
  }
}

function save(list: RemovedItem[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, 60)));
  } catch {
    // Kept until the app is closed
  }
  window.dispatchEvent(new Event(CHANGED_EVENT));
}

/** Notes items as removed, newest first. The same item noted twice within a moment counts once. */
export function recordRemoved(entries: { item: ShoppingItem; byOther: boolean }[]) {
  const now = Date.now();
  const list = load();
  const fresh = entries
    .filter((e) => !list.some((r) => r.item.id === e.item.id && now - r.removedAt < 5000))
    .map((e): RemovedItem => ({ item: e.item, removedAt: now, byOther: e.byOther, seen: !e.byOther }));
  if (fresh.length > 0) save([...fresh, ...list]);
}

/** The removed items, kept up to date */
export function useRemovedItems() {
  const [list, setList] = useState<RemovedItem[]>(load);
  useEffect(() => {
    const reload = () => setList(load());
    window.addEventListener(CHANGED_EVENT, reload);
    window.addEventListener('storage', reload);
    // Old ones drop off after a day
    const timer = window.setInterval(reload, 10 * 60 * 1000);
    return () => {
      window.removeEventListener(CHANGED_EVENT, reload);
      window.removeEventListener('storage', reload);
      window.clearInterval(timer);
    };
  }, []);

  const forget = (removedAt: number, id: string) =>
    save(load().filter((r) => !(r.item.id === id && r.removedAt === removedAt)));
  const markSeen = (entries: RemovedItem[]) =>
    save(load().map((r) => (entries.some((e) => e.item.id === r.item.id && e.removedAt === r.removedAt) ? { ...r, seen: true } : r)));

  return { removed: list, forget, markSeen };
}
