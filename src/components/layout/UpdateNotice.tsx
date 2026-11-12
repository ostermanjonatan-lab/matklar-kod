import React, { useEffect, useRef, useState } from 'react';
import { Toast } from './Toast';

/** The address of the app's main script in a page, e.g. /assets/index-AbC123.js. */
function mainScript(html: string): string | null {
  return html.match(/<script[^>]+type="module"[^>]+src="([^"]+)"/)?.[1] ?? null;
}

const LAST_AUTO_RELOAD_KEY = 'matklar_auto_reload_at';

/** Nothing would be lost by a reload: no open dialog and no text being typed */
function nothingOpen(): boolean {
  // A dialog that is kept in the page while closed is hidden, and does not count
  const openDialog = Array.from(document.querySelectorAll<HTMLElement>('[aria-modal="true"]')).some(
    (el) => el.getClientRects().length > 0 && getComputedStyle(el).opacity !== '0'
  );
  if (openDialog) return false;
  const active = document.activeElement as HTMLElement | null;
  if (active && (active.matches('input, textarea, select') || active.isContentEditable)) return false;
  return true;
}

/** At most one automatic reload every few minutes, in case the old page is still served */
function mayReloadNow(): boolean {
  try {
    const last = Number(sessionStorage.getItem(LAST_AUTO_RELOAD_KEY) || 0);
    if (Date.now() - last < 5 * 60_000) return false;
    sessionStorage.setItem(LAST_AUTO_RELOAD_KEY, String(Date.now()));
  } catch {
    // Without sessionStorage it may still reload
  }
  return true;
}

/**
 * An app left open in the background keeps running the old version. When it is opened again,
 * this checks whether a newer version has been published and loads it by itself, as long as
 * nothing would be lost: no recipe open or minimized (ticked steps and portions), no dialog
 * and no text being typed. The tab and a running timer are kept over a reload. Otherwise it
 * offers to load it, so nothing is lost while cooking.
 */
export const UpdateNotice: React.FC<{ busy: boolean }> = ({ busy }) => {
  const [newVersion, setNewVersion] = useState(false);
  const busyRef = useRef(busy);
  busyRef.current = busy;

  useEffect(() => {
    if (import.meta.env.DEV) return;
    const current = document.querySelector<HTMLScriptElement>('script[type="module"][src]')?.getAttribute('src');
    if (!current) return;
    let lastCheck = 0;
    let found = false;

    const reloadIfSafe = (): boolean => {
      if (busyRef.current || !nothingOpen() || !mayReloadNow()) return false;
      window.location.reload();
      return true;
    };

    // returning: the app was just opened again, before anything has been done in it
    const check = async (returning: boolean) => {
      if (document.visibilityState !== 'visible') return;
      if (found) {
        if (returning) reloadIfSafe();
        return;
      }
      // Opening the app again always checks. Otherwise at most once a minute.
      if (!returning && Date.now() - lastCheck < 60_000) return;
      lastCheck = Date.now();
      try {
        const res = await fetch(`/?versionskontroll=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const latest = mainScript(await res.text());
        if (!latest || latest === current) return;
        found = true;
        if (!(returning && reloadIfSafe())) setNewVersion(true);
      } catch {
        // Offline: try again next time
      }
    };

    const onVisible = () => check(true);
    const onFocus = () => check(false);
    check(true);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onFocus);
    const timer = window.setInterval(() => check(false), 15 * 60_000);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onFocus);
      window.clearInterval(timer);
    };
  }, []);

  if (!newVersion) return null;
  return (
    <Toast
      message="Det finns en ny version"
      onDismiss={() => setNewVersion(false)}
      actions={[
        { label: 'Ladda om', onClick: () => window.location.reload() },
        { label: 'Senare', onClick: () => setNewVersion(false) },
      ]}
    />
  );
};
