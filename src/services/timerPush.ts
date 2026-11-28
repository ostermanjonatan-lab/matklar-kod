/**
 * The kitchen timer's notice when the app is not open (see api/timer.ts). The phone gets a push
 * address the first time, and the server is asked to send a notice when the timer ends.
 * Everything here gives up quietly: without notices the timer works as before, in the app.
 */

const NOTICE_KEY = 'matklar_timer_notice';

let publicKey: Promise<string | null> | null = null;
const getPublicKey = () =>
  (publicKey ??= fetch('/api/timer')
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => (typeof d?.publicKey === 'string' ? d.publicKey : null))
    .catch(() => {
      publicKey = null;
      return null;
    }));

const supported = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

/**
 * Asks once whether the app may send notices. Call it straight from the tap that starts a timer:
 * phones only ask when a person has just tapped.
 */
let asking: Promise<NotificationPermission> | null = null;
// Whether the server can send notices, known after checkNotices: until it can, nothing is asked
let serverReady = false;

/** Finds out early whether the server can send notices, so that a tap can ask straight away */
export function checkNotices(): void {
  if (supported()) getPublicKey().then((key) => (serverReady = Boolean(key)));
}

export function askForNotices(): void {
  if (serverReady && supported() && Notification.permission === 'default' && !asking) {
    asking = Notification.requestPermission()
      .catch(() => 'default' as NotificationPermission)
      .finally(() => {
        asking = null;
      });
  }
}

function keyBytes(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

async function pushAddress(): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return null;
  const key = await getPublicKey();
  if (!key) return null;
  const existing = await reg.pushManager.getSubscription();
  if (existing) {
    // An address made with another key (the key was changed in Vercel) does not work
    const used = existing.options.applicationServerKey;
    const same = used && btoa(String.fromCharCode(...new Uint8Array(used))) === btoa(String.fromCharCode(...keyBytes(key)));
    if (same) return existing;
    await existing.unsubscribe().catch(() => {});
  }
  return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) });
}

interface StoredNotice {
  endsAt: number;
  id: string;
}

const readStored = (): StoredNotice | null => {
  try {
    return JSON.parse(localStorage.getItem(NOTICE_KEY) || 'null');
  } catch {
    return null;
  }
};
const writeStored = (n: StoredNotice | null) => {
  try {
    if (n) localStorage.setItem(NOTICE_KEY, JSON.stringify(n));
    else localStorage.removeItem(NOTICE_KEY);
  } catch {
    // Not kept: after a reload a second notice may be set for the same timer
  }
};

/**
 * Makes sure there is a notice for a timer that ends at endsAt, and returns a function that
 * cancels it. A notice already set for the same end (before the app was reloaded) is kept.
 */
export function keepTimerNotice(endsAt: number, label: string, recipeTitle?: string): () => void {
  let cancelled = false;
  let id: string | null = readStored()?.endsAt === endsAt ? readStored()!.id : null;

  if (!id && supported() && Notification.permission !== 'denied') {
    (async () => {
      try {
        // The first time, the phone is still asking whether notices may be sent
        if (asking) await asking;
        if (Notification.permission !== 'granted' || cancelled) return;
        const subscription = await pushAddress();
        if (!subscription || cancelled) return;
        const res = await fetch('/api/timer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'start', subscription: subscription.toJSON(), endsAt, label, recipeTitle }),
        });
        const data = res.ok ? await res.json() : null;
        if (!data?.id) return;
        if (cancelled) {
          cancelNotice(data.id);
          return;
        }
        id = data.id;
        writeStored({ endsAt, id: data.id });
      } catch {
        // No notice: the timer still sounds in the app
      }
    })();
  }

  return () => {
    cancelled = true;
    if (id) {
      cancelNotice(id);
      if (readStored()?.id === id) writeStored(null);
      id = null;
    }
  };
}

function cancelNotice(id: string) {
  fetch('/api/timer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'cancel', id }),
    keepalive: true,
  }).catch(() => {});
}
