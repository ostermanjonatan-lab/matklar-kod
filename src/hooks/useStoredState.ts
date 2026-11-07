import { useEffect, useState } from 'react';

/**
 * Like useState, but the value is kept on this phone and comes back when the app is opened
 * again: sorting, filters and the chosen views. A stored value that is not valid any more
 * (checked by `isValid`) is replaced by the starting value.
 */
export function useStoredState<T>(key: string, initial: T, isValid?: (value: unknown) => boolean) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return initial;
      const parsed = JSON.parse(raw);
      if (isValid && !isValid(parsed)) return initial;
      if (!isValid && typeof parsed !== typeof initial) return initial;
      return parsed as T;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Storage full or turned off: the choice lasts until the app is closed
    }
  }, [key, value]);

  return [value, setValue] as const;
}
