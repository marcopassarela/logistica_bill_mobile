'use strict';
/**
 * Servidor LOCAL para testar no seu PC (na Vercel não é usado: lá os arquivos de /api viram funções).
 * Roda o mesmo código de api/login.js e api/sync.js, e serve index.html, css/, js/ e assets/.
 *
 *   npm install     (uma vez)
 *   npm start       → http://localhost:3000
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

function loadEnv(file) {
  let txt;
  try { txt = fs.readFileSync(file, 'utf8'); } catch (e) { return; }
  txt.split(/\r?\n/).forEach(line => {
    if (/^\s*#/.test(line)) return;
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m) return;
    let v = m[2];
    if ((v[0] === '"' && v[v.length - 1] === '"') || (v[0] === "'" && v[v.length - 1] === "'")) v = v.slice(1, -1);
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  });
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff',
  '.map': 'application/json'
};
const PUBLIC_DIRS = ['css', 'js', 'assets'];

function createServer(rootDir) {
  rootDir = rootDir || __dirname;
  const handlers = {
    '/api/login': require('./api/login'),
    '/api/sync': require('./api/sync')
  };

  function readBody(req) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      let size = 0;
      req.on('data', c => {
        size += c.length;
        if (size > 30 * 1024 * 1024) { reject(new Error('too large')); req.destroy(); return; }
        chunks.push(c);
      });
      req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      req.on('error', reject);
    });
  }

  function sendFile(res, file) {
    fs.readFile(file, (err, buf) => {
      if (err) { res.statusCode = 404; res.end('Not found'); return; }
      res.setHeader('Content-Type', MIME[path.extname(file).toLowerCase()] || 'application/octet-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.end(buf);
    });
  }

  return http.createServer(async (req, res) => {
    // mesmo "jeitão" do req/res da Vercel
    res.status = function (c) { this.statusCode = c; return this; };
    res.json = function (obj) {
      this.setHeader('Content-Type', 'application/json; charset=utf-8');
      this.end(JSON.stringify(obj));
    };
    try {
      const url = new URL(req.url, 'http://localhost');
      const pathname = decodeURIComponent(url.pathname);

      if (pathname === '/health') return res.json({ status: 'ok' });

      if (handlers[pathname]) {
        req.query = Object.fromEntries(url.searchParams);
        if (req.method === 'POST') {
          const text = await readBody(req);
          try { req.body = text ? JSON.parse(text) : {}; } catch (e) { return res.status(400).json({ error: 'JSON inválido.' }); }
        }
        return await handlers[pathname](req, res);
      }

      if (pathname === '/' || pathname === '/index.html') return sendFile(res, path.join(rootDir, 'index.html'));

      const top = pathname.split('/')[1];
      if (PUBLIC_DIRS.includes(top)) {
        const file = path.normalize(path.join(rootDir, pathname));
        if (file.startsWith(path.join(rootDir, top) + path.sep)) return sendFile(res, file);
      }
      res.statusCode = 404;
      res.end('Not found');
    } catch (e) {
      console.error(e);
      res.statusCode = 500;
      res.end('Erro no servidor');
    }
  });
}

module.exports = { createServer, loadEnv };

if (require.main === module) {
  loadEnv(path.join(__dirname, '.env'));
  const port = Number(process.env.PORT) || 3000;
  createServer(__dirname).listen(port, () => {
    console.log('Logísticas Bill (local) em http://localhost:' + port);
    if (!process.env.DATABASE_URL) console.warn('Aviso: falta DATABASE_URL no .env');
    if (!process.env.SESSION_SECRET) console.warn('Aviso: falta SESSION_SECRET no .env');
  });
}
