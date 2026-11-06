/**
 * Light or dark look. "system" follows the phone's setting. The choice is kept on this phone
 * only. index.html applies it before the app starts, so the page does not flash light.
 */
export type ThemeChoice = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'matklar_theme';
const COLORS = { light: '#284235', dark: '#1B1916' };

export function getThemeChoice(): ThemeChoice {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

const systemDark = () => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;

export function applyTheme(choice: ThemeChoice = getThemeChoice()): void {
  const dark = choice === 'dark' || (choice === 'system' && systemDark());
  document.documentElement.classList.toggle('dark', dark);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? COLORS.dark : COLORS.light);
}

export function setThemeChoice(choice: ThemeChoice): void {
  try {
    if (choice === 'system') localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, choice);
  } catch {
    // Not saved: the choice still applies until the app is closed
  }
  applyTheme(choice);
}

/** Follows the phone when it switches between light and dark, while the choice is "system". */
export function watchSystemTheme(): void {
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', () => {
    if (getThemeChoice() === 'system') applyTheme('system');
  });
}
