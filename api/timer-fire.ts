/**
 * Called by Upstash QStash when a kitchen timer ends (see api/timer.ts): sends the notice to the
 * phone. Only calls signed by QStash are accepted.
 */
import { Receiver } from '@upstash/qstash';
import { sendNotification, setVapidDetails } from 'web-push';

const APP_URL = process.env.APP_URL || 'https://matklar.vercel.app';

export async function POST(request: Request) {
  const raw = await request.text();
  const signature = request.headers.get('upstash-signature') || '';
  const { QSTASH_CURRENT_SIGNING_KEY, QSTASH_NEXT_SIGNING_KEY, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = process.env;
  if (!QSTASH_CURRENT_SIGNING_KEY || !QSTASH_NEXT_SIGNING_KEY || !VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return new Response('Inte inställt', { status: 503 });
  }

  try {
    const receiver = new Receiver({ currentSigningKey: QSTASH_CURRENT_SIGNING_KEY, nextSigningKey: QSTASH_NEXT_SIGNING_KEY });
    const valid = await receiver.verify({ signature, body: raw, url: `${APP_URL}/api/timer-fire`, clockTolerance: 30 });
    if (!valid) return new Response('Fel signatur', { status: 401 });
  } catch {
    return new Response('Fel signatur', { status: 401 });
  }

  let body: { subscription?: any; label?: string; recipeTitle?: string };
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response('Fel format', { status: 400 });
  }

  setVapidDetails(APP_URL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  const payload = JSON.stringify({
    title: 'Timern är klar',
    body: [body.label, body.recipeTitle].filter(Boolean).join(', '),
  });
  try {
    // Urgent, so that a phone that saves power wakes up for it
    await sendNotification(body.subscription, payload, { TTL: 600, urgency: 'high' });
  } catch (err: any) {
    // The phone has turned notices off or the address is old: trying again does not help
    if (err?.statusCode === 404 || err?.statusCode === 410) return new Response('Adressen finns inte längre', { status: 200 });
    console.error('Timer notice failed:', err?.statusCode, err?.message);
    return new Response('Kunde inte skicka', { status: 502 });
  }
  return new Response('Skickad', { status: 200 });
}
