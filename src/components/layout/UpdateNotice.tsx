import React, { useEffect, useState } from 'react';
import { Toast } from './Toast';

/** The address of the app's main script in a page, e.g. /assets/index-AbC123.js. */
function mainScript(html: string): string | null {
  return html.match(/<script[^>]+type="module"[^>]+src="([^"]+)"/)?.[1] ?? null;
}

/**
 * An app left open in the background keeps running the old version. When it is opened again,
 * this checks whether a newer version has been published and offers to load it. It never
 * reloads by itself, so a minimized recipe or a running timer is not lost while cooking.
 */
export const UpdateNotice: React.FC = () => {
  const [newVersion, setNewVersion] = useState(false);

  useEffect(() => {
    if (import.meta.env.DEV) return;
    const current = document.querySelector<HTMLScriptElement>('script[type="module"][src]')?.getAttribute('src');
    if (!current) return;
    let lastCheck = 0;

    const check = async () => {
      if (document.visibilityState !== 'visible' || Date.now() - lastCheck < 60_000) return;
      lastCheck = Date.now();
      try {
        const res = await fetch(`/?versionskontroll=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const latest = mainScript(await res.text());
        if (latest && latest !== current) setNewVersion(true);
      } catch {
        // Offline: try again next time
      }
    };

    check();
    document.addEventListener('visibilitychange', check);
    window.addEventListener('focus', check);
    const timer = window.setInterval(check, 15 * 60_000);
    return () => {
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('focus', check);
      window.clearInterval(timer);
    };
  }, []);

  if (!newVersion) return null;
  return (
    <Toast
      message="Det finns en ny version"
      actions={[
        { label: 'Ladda om', onClick: () => window.location.reload() },
        { label: 'Senare', onClick: () => setNewVersion(false) },
      ]}
    />
  );
};
