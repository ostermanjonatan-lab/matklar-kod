/**
 * Settings can open the shopping list straight at "Ordna" (stores and the order of the
 * aisles). Settings sets this flag in sessionStorage and switches tab; the shopping list
 * reads it once when it opens and removes it.
 */
export const OPEN_STORE_ORDER_KEY = 'matklar_open_store_order';

export function takeOpenStoreOrderFlag(): boolean {
  try {
    const value = sessionStorage.getItem(OPEN_STORE_ORDER_KEY);
    if (value) sessionStorage.removeItem(OPEN_STORE_ORDER_KEY);
    return value === '1';
  } catch {
    return false;
  }
}
