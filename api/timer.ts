/**
 * The kitchen timer's notice when the app is not open. When a timer starts, the app sends the time
 * it ends and the phone's push address here. Upstash QStash keeps the message until that time and
 * then calls /api/timer-fire, which sends the notice to the phone. Pausing or stopping the timer
 * cancels the message.
 *
 * GET  /api/timer                         -> { publicKey } for the phone's push address, or 503
 * POST /api/timer { action: 'start', subscription, endsAt, label, recipeTitle? } -> { id }
 * POST /api/timer { action: 'cancel', id }
 *
 * Settings in Vercel: QSTASH_TOKEN (and QSTASH_URL if the Upstash console gives one),
 * QSTASH_CURRENT_SIGNING_KEY, QSTASH_NEXT_SIGNING_KEY, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY.
 */
import { Client } from '@upstash/qstash';

const APP_URL = process.env.APP_URL || 'https://matklar.vercel.app';
const MAX_MS = 24 * 60 * 60 * 1000;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

const configured = () =>
  Boolean(process.env.QSTASH_TOKEN && process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

const client = () =>
  new Client({ token: process.env.QSTASH_TOKEN as string, ...(process.env.QSTASH_URL ? { baseUrl: process.env.QSTASH_URL } : {}) });

/** Only the app itself, not other sites, may start timers here */
function fromThisSite(request: Request): boolean {
  const site = request.headers.get('sec-fetch-site');
  if (site && site !== 'same-origin' && site !== 'none') return false;
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
  const from = request.headers.get('origin') || request.headers.get('referer');
  if (from && host) {
    try {
      return new URL(from).host === host;
    } catch {
      return false;
    }
  }
  return true;
}

export async function GET() {
  if (!configured()) return json({ error: 'Notiser är inte inställda' }, 503);
  return json({ publicKey: process.env.VAPID_PUBLIC_KEY });
}

export async function POST(request: Request) {
  if (!configured()) return json({ error: 'Notiser är inte inställda' }, 503);
  if (!fromThisSite(request)) return json({ error: 'Bara MatKlar kan starta timers här' }, 403);
  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Fel format' }, 400);
  }

  if (body?.action === 'cancel') {
    if (typeof body.id !== 'string' || !body.id) return json({ error: 'Saknar id' }, 400);
    try {
      await client().messages.cancel(body.id);
    } catch {
      // Already sent or already cancelled
    }
    return json({ ok: true });
  }

  if (body?.action === 'start') {
    const { subscription, endsAt } = body;
    const now = Date.now();
    if (!subscription?.endpoint || !/^https:\/\//.test(subscription.endpoint) || !subscription.keys?.p256dh || !subscription.keys?.auth) {
      return json({ error: 'Saknar telefonens pushadress' }, 400);
    }
    if (typeof endsAt !== 'number' || endsAt < now - 5000 || endsAt > now + MAX_MS) {
      return json({ error: 'Tiden går inte att använda' }, 400);
    }
    const label = String(body.label || 'Timer').slice(0, 80);
    const recipeTitle = body.recipeTitle ? String(body.recipeTitle).slice(0, 120) : undefined;
    try {
      const res = await client().publishJSON({
        url: `${APP_URL}/api/timer-fire`,
        body: { subscription, label, recipeTitle },
        notBefore: Math.ceil(endsAt / 1000),
        retries: 2,
      });
      return json({ id: (res as { messageId: string }).messageId });
    } catch (err: any) {
      return json({ error: err?.message || 'Kunde inte ställa in notisen' }, 502);
    }
  }

  return json({ error: 'Okänd åtgärd' }, 400);
}
