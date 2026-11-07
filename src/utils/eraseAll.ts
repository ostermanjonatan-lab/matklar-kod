/**
 * Radera allt: removes everything MatKlar keeps in this browser and starts the app again from
 * the beginning. What is in the database is removed before this, by leaving or deleting the
 * household.
 */
let erasing = false;

/** True while everything is being erased, so nothing is saved again on the way out. */
export function isErasing(): boolean {
  return erasing;
}

export async function eraseThisDevice(): Promise<void> {
  erasing = true;
  try {
    localStorage.clear();
    sessionStorage.clear();
  } catch {
    // Storage turned off: nothing to clear
  }
  try {
    // Saved copies of the app and of recipe photos
    if ('caches' in window) {
      const names = await caches.keys();
      await Promise.all(names.map((n) => caches.delete(n)));
    }
  } catch {
    // ignore
  }
  // Once more, in case something (a running timer) saved while the copies were removed
  try {
    localStorage.clear();
  } catch {
    // ignore
  }
  window.location.replace('/');
}
