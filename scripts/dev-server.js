import { createReadStream, existsSync, readFileSync, statSync } from 'fs';
import { createServer } from 'http';
import { extname, join, resolve } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PORT = Number(process.env.PORT || 3000);
const RAW_BODY_ROUTES = new Set(['upload']);

const MIME = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

function loadEnv(file) {
  const envPath = join(ROOT, file);
  if (!existsSync(envPath)) return;

  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;

    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

function attachVercelApi(res) {
  res.status = function status(code) {
    res.statusCode = code;
    return res;
  };
  res.json = function json(body) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(body));
    return res;
  };
  res.send = function send(body) {
    if (Buffer.isBuffer(body) || typeof body === 'string') {
      res.end(body);
      return res;
    }
    return res.json(body);
  };
  return res;
}

async function handleApi(req, res, pathname, searchParams) {
  const name = pathname.slice('/api/'.length).replace(/\/$/, '');
  if (!name || name.includes('..') || name.startsWith('_')) {
    res.statusCode = 404;
    res.end('Not found');
    return;
  }

  const file = join(ROOT, 'api', `${name}.js`);
  if (!existsSync(file)) {
    res.statusCode = 404;
    res.end('Not found');
    return;
  }

  req.query = Object.fromEntries(searchParams.entries());

  if (!RAW_BODY_ROUTES.has(name) && req.method !== 'GET' && req.method !== 'HEAD') {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const raw = Buffer.concat(chunks).toString('utf8');
    const contentType = req.headers['content-type'] || '';
    if (contentType.includes('application/json')) {
      try {
        req.body = raw ? JSON.parse(raw) : {};
      } catch {
        req.body = {};
      }
    } else {
      req.body = raw;
    }
  }

  const mod = await import(`${pathToFileURL(file).href}?t=${Date.now()}`);
  await mod.default(req, attachVercelApi(res));
}

function serveStatic(req, res, pathname) {
  const relativePath = pathname === '/' ? 'index.html' : decodeURIComponent(pathname.replace(/^\//, ''));
  const file = resolve(ROOT, relativePath);
  if (!file.startsWith(ROOT) || !existsSync(file) || statSync(file).isDirectory()) {
    res.statusCode = 404;
    res.end('Not found');
    return;
  }

  res.setHeader('Content-Type', MIME[extname(file).toLowerCase()] || 'application/octet-stream');
  createReadStream(file).pipe(res);
}

loadEnv('.env.local');
loadEnv('.env');

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    if (url.pathname.startsWith('/api/')) {
      await handleApi(req, res, url.pathname, url.searchParams);
      return;
    }
    serveStatic(req, res, url.pathname);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  }
});

server.listen(PORT, () => {
  console.log(`Local dev server: http://localhost:${PORT}`);
});
