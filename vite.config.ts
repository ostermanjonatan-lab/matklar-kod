import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { searchFoods } from './src/services/openFoodFacts.ts';

function recipeFetcherPlugin(): Plugin {
  return {
    name: 'recipe-fetcher-middleware',
    configureServer(server) {
      // Product search for nutrition, as the Vercel function api/food-search.ts does it
      server.middlewares.use('/api/food-search', async (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        try {
          const q = new URL(req.url || '', `http://${req.headers.host}`).searchParams.get('q') || '';
          res.end(JSON.stringify({ hits: await searchFoods(q) }));
        } catch (err) {
          res.statusCode = 502;
          res.end(JSON.stringify({ error: err instanceof Error ? err.message : 'Sökningen gick inte att göra' }));
        }
      });

      server.middlewares.use('/api/fetch-recipe', async (req, res) => {
        try {
          const urlParams = new URL(req.url || '', `http://${req.headers.host}`);
          const targetUrl = urlParams.searchParams.get('url');

          if (!targetUrl) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Missing url parameter' }));
            return;
          }

          // Check if target requires crawler/prerender user agent (e.g. Coop.se SPA dynamic rendering)
          const isPrerenderTarget = targetUrl.toLowerCase().includes('coop.se');
          const userAgent = isPrerenderTarget
            ? 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
            : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

          const response = await fetch(targetUrl, {
            redirect: 'follow',
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
              'Referer': 'https://www.google.com/',
            },
          });

          if (!response.ok) {
            res.statusCode = response.status;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: `Fetch failed with status ${response.status}` }));
            return;
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

          // Detect anti-bot block pages (Loopia, Cloudflare, etc.)
          const lowerHtml = html.toLowerCase();
          const isBotBlocked =
            lowerHtml.includes("you've reached a blocked page") ||
            lowerHtml.includes('hoppsan, här var det stopp') ||
            lowerHtml.includes('attention required! | cloudflare') ||
            (lowerHtml.includes('just a moment...') && lowerHtml.includes('cloudflare')) ||
            lowerHtml.includes('access denied | www.');

          if (isBotBlocked) {
            res.statusCode = 403;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Blocked by target host bot protection' }));
            return;
          }

          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.end(html);
        } catch (err: any) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: err?.message || 'Server error' }));
        }
      });
    },
  };
}

import fs from 'node:fs';
import path from 'node:path';

function supabaseConfigPlugin(): Plugin {
  const configPath = path.resolve(process.cwd(), 'supabase-config.json');

  return {
    name: 'supabase-config-middleware',
    configureServer(server) {
      server.middlewares.use('/api/supabase-config', (req, res) => {
        if (req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', () => {
            try {
              const data = JSON.parse(body || '{}');
              const rawUrl = (data.url || '').trim();
              const url = rawUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
              const anonKey = (data.anonKey || '').trim();

              if (url && anonKey) {
                // If already saved with same content, avoid touching disk
                if (fs.existsSync(configPath)) {
                  try {
                    const current = JSON.parse(fs.readFileSync(configPath, 'utf8') || '{}');
                    if (current.url === url && current.anonKey === anonKey) {
                      res.statusCode = 200;
                      res.setHeader('Content-Type', 'application/json');
                      res.end(JSON.stringify({ success: true, cached: true }));
                      return;
                    }
                  } catch {}
                }
                fs.writeFileSync(configPath, JSON.stringify({ url, anonKey }, null, 2), 'utf8');
              }

              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true }));
            } catch (err: any) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: err?.message || 'Failed to save config' }));
            }
          });
        } else if (req.method === 'GET') {
          try {
            if (fs.existsSync(configPath)) {
              const content = fs.readFileSync(configPath, 'utf8');
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(content);
              return;
            }

            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ url: '', anonKey: '' }));
          } catch (err: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: err?.message || 'Failed to read config' }));
          }
        } else {
          res.statusCode = 405;
          res.end('Method Not Allowed');
        }
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  base: './', // Fungerar både på matklar.vercel.app och under /Matklar/ på GitHub Pages
  plugins: [
    react(),
    tailwindcss(),
    recipeFetcherPlugin(),
    supabaseConfigPlugin(),
  ],
  server: {
    host: true, // Lyssna på alla nätverksgränssnitt (0.0.0.0) för mobilåtkomst
    port: 5173,
    watch: {
      ignored: ['**/supabase-config.json', '**/.env*'],
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('@supabase')) {
              return 'supabase';
            }
            if (id.includes('lucide-react')) {
              return 'lucide-icons';
            }
            if (id.includes('canvas-confetti')) {
              return 'confetti';
            }
            return 'vendor';
          }
        },
      },
    },
  },
});
