export interface StoreLayout {
  id: string;
  name: string;
  aisleOrder: string[];
}

export const DEFAULT_AISLE_ORDER = [
  'Frukt & Grönt',
  'Mejeri',
  'Kött & Chark',
  'Fisk & Skaldjur',
  'Skafferi',
  'Kryddor & Olja',
  'Bröd & Bageri',
  'Fryst',
  'Drycker',
  'Övrigt',
];

export const STORE_LAYOUTS_STORAGE_KEY = 'receptapp_store_layouts_v1';
export const ACTIVE_STORE_ID_STORAGE_KEY = 'receptapp_active_store_id_v1';
export const COLLAPSED_AISLES_STORAGE_KEY = 'receptapp_collapsed_aisles_v1';

const DEFAULT_STORE_LAYOUTS: StoreLayout[] = [
  {
    id: 'default',
    name: 'Standardbutik',
    aisleOrder: [...DEFAULT_AISLE_ORDER],
  },
];

/**
 * Loads all configured store layouts from localStorage, or initializes defaults.
 */
export function loadStoreLayouts(): StoreLayout[] {
  if (typeof window === 'undefined') return DEFAULT_STORE_LAYOUTS;
  try {
    const raw = localStorage.getItem(STORE_LAYOUTS_STORAGE_KEY);
    if (!raw) return DEFAULT_STORE_LAYOUTS;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      // Ensure all standard aisles exist in each layout
      return parsed.map((layout) => {
        const order = Array.isArray(layout.aisleOrder) ? [...layout.aisleOrder] : [...DEFAULT_AISLE_ORDER];
        DEFAULT_AISLE_ORDER.forEach((aisle) => {
          if (!order.includes(aisle)) {
            if (aisle === 'Övrigt') {
              order.push(aisle);
            } else {
              const ovrigtIdx = order.indexOf('Övrigt');
              if (ovrigtIdx !== -1) {
                order.splice(ovrigtIdx, 0, aisle);
              } else {
                order.push(aisle);
              }
            }
          }
        });
        return {
          ...layout,
          aisleOrder: order,
        };
      });
    }
  } catch (e) {
    console.warn('Failed to load store layouts from localStorage:', e);
  }
  return DEFAULT_STORE_LAYOUTS;
}

/**
 * Saves store layouts to localStorage.
 */
export function saveStoreLayouts(layouts: StoreLayout[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORE_LAYOUTS_STORAGE_KEY, JSON.stringify(layouts));
  } catch (e) {
    console.warn('Failed to save store layouts to localStorage:', e);
  }
}

/**
 * Loads active store ID from localStorage.
 */
export function loadActiveStoreId(): string {
  if (typeof window === 'undefined') return 'default';
  try {
    return localStorage.getItem(ACTIVE_STORE_ID_STORAGE_KEY) || 'default';
  } catch {
    return 'default';
  }
}

/**
 * Saves active store ID to localStorage.
 */
export function saveActiveStoreId(id: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ACTIVE_STORE_ID_STORAGE_KEY, id);
  } catch (e) {
    console.warn('Failed to save active store id:', e);
  }
}

/**
 * Loads collapsed aisle names from localStorage.
 */
export function loadCollapsedAisles(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(COLLAPSED_AISLES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Saves collapsed aisle names to localStorage.
 */
export function saveCollapsedAisles(aisles: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(COLLAPSED_AISLES_STORAGE_KEY, JSON.stringify(aisles));
  } catch (e) {
    console.warn('Failed to save collapsed aisles:', e);
  }
}

/**
 * Reorders an aisle by dragging from one index to another in a full list.
 */
export function reorderAisleByIndex(aisleOrder: string[], fromIndex: number, toIndex: number): string[] {
  if (fromIndex === toIndex) return aisleOrder;
  if (fromIndex < 0 || fromIndex >= aisleOrder.length) return aisleOrder;
  if (toIndex < 0 || toIndex >= aisleOrder.length) return aisleOrder;

  const result = [...aisleOrder];
  const [removed] = result.splice(fromIndex, 1);
  result.splice(toIndex, 0, removed);
  return result;
}
