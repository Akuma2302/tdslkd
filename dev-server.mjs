// Local stand-in for Netlify: serves frontend/ (with its _redirects) and runs backend/program/*.mjs
// at /.netlify/functions/<name>, so the Program form can be tried end to end.
//
//   node dev-server.mjs --dry-run   build + check the Telegram message, send nothing (safe for testing)
//   node dev-server.mjs             really sends; needs TELEGRAM_BOT_TOKEN etc. in .env (never committed)
//
// PORT defaults to 4321 (python http.server for the plain pages uses 4320).

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SITE = join(HERE, 'frontend');
const PORT = Number(process.env.PORT) || 4321;

const envFile = join(HERE, '.env');
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
}
if (process.argv.includes('--dry-run')) process.env.DRY_RUN = '1';

const REDIRECTS = existsSync(join(SITE, '_redirects'))
  ? readFileSync(join(SITE, '_redirects'), 'utf8').split(/\r?\n/)
      .map((line) => line.replace(/#.*/, '').trim().split(/\s+/)).filter((p) => p.length >= 3)
      .map(([from, to, status]) => ({ from, to, status: parseInt(status, 10) }))
  : [];

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json',
};

createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  const fn = url.pathname.match(/^\/\.netlify\/functions\/([\w-]+)$/);
  if (fn) {
    const file = join(HERE, 'backend', 'program', `${fn[1]}.mjs`);
    if (!existsSync(file)) { res.writeHead(404).end('No such function'); return; }
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const mod = await import(pathToFileURL(file).href + '?t=' + Date.now());   // edits apply without restart
    const request = new Request(url, {
      method: req.method, headers: req.headers,
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks),
    });
    try {
      const response = await mod.default(request, {});
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch (e) {
      console.error(e);
      res.writeHead(500).end(String(e));
    }
    return;
  }

  // frontend/_redirects, like Netlify: 200 = serve that file instead, 301 = send the browser there.
  const rule = REDIRECTS.find((r) => r.from === (url.pathname.replace(/\/+$/, '') || '/'));
  if (rule && rule.status === 301) { res.writeHead(301, { Location: rule.to + url.search }).end(); return; }
  const target = rule ? rule.to : url.pathname;

  // Same pretty URLs as Netlify: /alumni → alumni.html, /legality/database → legality/database.html
  let path = normalize(decodeURIComponent(target)).replace(/^([\\/])+/, '');
  if (path === '' || path.endsWith('/') || path.endsWith('\\')) path += 'index.html';
  if (!extname(path) && existsSync(join(SITE, path + '.html'))) path += '.html';
  const file = join(SITE, path);
  if (!file.startsWith(SITE) || !existsSync(file)) { res.writeHead(404).end('Not found'); return; }
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  res.end(await readFile(file));
}).listen(PORT, () => console.log(`http://localhost:${PORT}  (DRY_RUN=${process.env.DRY_RUN || '0'})`));
