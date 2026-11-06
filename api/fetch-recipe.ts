/**
 * Universal Serverless API Route for fetching recipe HTML / JSON from external websites.
 * Works natively on Vercel (/api/fetch-recipe), Netlify, and standard Node.js servers.
 */

export default async function handler(req: any, res: any) {
  // Support both query param formats
  const targetUrl = req?.query?.url || (req?.url ? new URL(req.url, 'http://localhost').searchParams.get('url') : null);

  if (!targetUrl) {
    if (res?.status) {
      return res.status(400).json({ error: 'Missing url parameter' });
    }
    return new Response(JSON.stringify({ error: 'Missing url parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Only ordinary web pages. Addresses inside a network (localhost, 10.x, 192.168.x and the like)
  // are refused, so the function cannot be used to reach the server's own surroundings.
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(targetUrl);
  } catch {
    return sendError(res, 400, 'Ogiltig adress');
  }
  const host = parsedUrl.hostname.toLowerCase();
  const isPrivateHost =
    host === 'localhost' ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host === '::1' ||
    host === '[::1]' ||
    /^(127|10|0)\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host);
  if (!/^https?:$/.test(parsedUrl.protocol) || isPrivateHost) {
    return sendError(res, 400, 'Adressen går inte att hämta');
  }

  try {
    // Check if target requires crawler/prerender user agent (e.g. Coop.se SPA dynamic rendering)
    const isPrerenderTarget = targetUrl.toLowerCase().includes('coop.se');
    const userAgent = isPrerenderTarget
      ? 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
      : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

    const response = await fetch(targetUrl, {
      redirect: 'follow',
      // The app gives up after 8 seconds, so there is no point waiting longer here
      signal: AbortSignal.timeout(7000),
      headers: {
        'User-Agent': userAgent,
        'Accept':
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'sv-SE,sv;q=0.9,en-US;q=0.8,en;q=0.7',
        'Sec-Ch-Ua': '"Chromium";v="128", "Not;A=Brand";v="24", "Google Chrome";v="128"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
        'Cache-Control': 'no-cache',
        'Referer': 'https://www.google.com/',
      },
    });

    if (!response.ok) {
      const errorMsg = `Källservern svarade med HTTP ${response.status}`;
      if (res?.status) {
        return res.status(response.status).json({ error: errorMsg });
      }
      return new Response(JSON.stringify({ error: errorMsg }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let html = await response.text();

    // If an unrendered SPA shell was returned, retry with crawler User-Agent to trigger SSR prerender
    if (
      !isPrerenderTarget &&
      (html.includes('isPrerenderCrawler') || ((html.includes('id="__next"') || html.includes('id="root"')) && !html.includes('recipeIngredient') && !html.includes('schema.org')))
    ) {
      try {
        const crawlerRes = await fetch(targetUrl, {
          redirect: 'follow',
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Referer': 'https://www.google.com/',
          },
        });
        if (crawlerRes.ok) {
          const crawlerHtml = await crawlerRes.text();
          if (crawlerHtml.length > html.length && (crawlerHtml.includes('recipeIngredient') || crawlerHtml.includes('Recipe'))) {
            html = crawlerHtml;
          }
        }
      } catch {}
    }

    // Check for common anti-bot blocking splash screens (Loopia, Cloudflare, Wordfence)
    const lowerHtml = html.toLowerCase();
    const isBotBlocked =
      lowerHtml.includes("you've reached a blocked page") ||
      lowerHtml.includes('hoppsan, här var det stopp') ||
      lowerHtml.includes('attention required! | cloudflare') ||
      (lowerHtml.includes('just a moment...') && lowerHtml.includes('cloudflare')) ||
      lowerHtml.includes('access denied | www.');

    if (isBotBlocked) {
      const errorMsg = 'Sidan blockerades av webbhotellets bot-skydd (faller vidare till Jina AI Reader)';
      if (res?.status) {
        return res.status(403).json({ error: errorMsg });
      }
      return new Response(JSON.stringify({ error: errorMsg }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (res?.setHeader) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
      return res.status(200).send(html);
    }

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 's-maxage=3600, stale-while-revalidate',
      },
    });
  } catch (err: any) {
    const errorMsg = err?.message || 'Kunde inte hämta sidan via serverproxy';
    if (res?.status) {
      return res.status(500).json({ error: errorMsg });
    }
    return new Response(JSON.stringify({ error: errorMsg }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

function sendError(res: any, status: number, message: string) {
  if (res?.status) {
    return res.status(status).json({ error: message });
  }
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
