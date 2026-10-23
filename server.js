'use strict';
/**
 * Logísticas Bill — Servidor
 *
 * - Serve o sistema (index.html, css/, js/, assets/)
 * - Guarda os dados no banco PostgreSQL do Layerbase (tabela "records")
 * - A chave/senha do banco fica SOMENTE aqui (arquivo .env), nunca no navegador
 *
 * Rodar:  npm install  →  copiar .env.example para .env e preencher  →  npm start
 */
const path = require('path');
const crypto = require('crypto');
const express = require('express');

const COLLECTIONS = [
  'config', 'caminhoes', 'funcionarios', 'cargos',
  'produtos', 'diarias', 'faltas', 'carregamentos', 'rotas'
];
const TOKEN_HOURS = 24;

const UPSERT = `
  INSERT INTO records (collection, id, data, deleted, rev)
  VALUES ($1, $2, $3, $4, $5)
  ON CONFLICT (collection, id)
  DO UPDATE SET data = EXCLUDED.data, deleted = EXCLUDED.deleted, rev = EXCLUDED.rev`;

function safeEq(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

/** Cria a tabela (se não existir) e o acesso inicial. Retorna a maior "rev" já gravada. */
async function initDb(pool, env) {
  env = env || process.env;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS records (
      collection text NOT NULL,
      id         text NOT NULL,
      data       jsonb,
      deleted    boolean NOT NULL DEFAULT false,
      rev        bigint NOT NULL,
      PRIMARY KEY (collection, id)
    )`);
  await pool.query('CREATE INDEX IF NOT EXISTS records_rev_idx ON records (rev)');

  const cfg = await pool.query("SELECT 1 FROM records WHERE collection = 'config' AND id = 'main'");
  if (!cfg.rows.length) {
    if (!env.ADMIN_PASS) {
      throw new Error('Banco novo: defina ADMIN_PASS (e opcionalmente ADMIN_USER) no arquivo .env para criar o primeiro acesso.');
    }
    const config = { usuario: env.ADMIN_USER || 'Admin', senha: env.ADMIN_PASS, diariaPadrao: 350 };
    await pool.query(UPSERT, ['config', 'main', JSON.stringify(config), false, Date.now()]);
    console.log('Acesso inicial criado para o usuário "' + config.usuario + '".');
  }
  const m = await pool.query('SELECT COALESCE(MAX(rev), 0) AS m FROM records');
  return Number(m.rows[0].m) || 0;
}

function createApp(pool, options) {
  options = options || {};
  const secret = options.secret || crypto.randomBytes(32).toString('hex');
  const rootDir = options.rootDir || __dirname;
  let lastRev = Math.max(Date.now(), options.startRev || 0);
  const nextRev = () => (lastRev = Math.max(Date.now(), lastRev + 1));

  function sign(payload) {
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = crypto.createHmac('sha256', secret).update(body).digest('base64url');
    return body + '.' + sig;
  }
  function verify(token) {
    if (typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const expected = crypto.createHmac('sha256', secret).update(parts[0]).digest('base64url');
    const a = Buffer.from(parts[1]);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    try {
      const p = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
      return p && p.exp > Date.now() ? p : null;
    } catch (e) { return null; }
  }
  function auth(req, res, next) {
    const h = req.headers.authorization || '';
    const p = h.startsWith('Bearer ') ? verify(h.slice(7)) : null;
    if (!p) return res.status(401).json({ error: 'Sessão inválida ou expirada.' });
    req.user = p.u;
    next();
  }

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '30mb' }));
  app.use((req, res, next) => { res.setHeader('X-Content-Type-Options', 'nosniff'); next(); });

  app.get('/health', (req, res) => res.json({ status: 'ok' }));

  // ---------- Login (com limite de tentativas por IP) ----------
  const attempts = new Map();
  app.post('/api/login', async (req, res) => {
    const now = Date.now();
    const a = attempts.get(req.ip) || { n: 0, until: 0 };
    if (a.until > now) return res.status(429).json({ error: 'Muitas tentativas. Aguarde alguns minutos.' });
    try {
      const { rows } = await pool.query(
        "SELECT data FROM records WHERE collection = 'config' AND id = 'main' AND deleted = false");
      const cfg = rows[0] && rows[0].data;
      const body = req.body || {};
      const user = String(body.user || '');
      const pass = String(body.pass || '');
      if (cfg && safeEq(user, cfg.usuario) && safeEq(pass, cfg.senha)) {
        attempts.delete(req.ip);
        return res.json({ token: sign({ u: user, exp: now + TOKEN_HOURS * 3600 * 1000 }), user });
      }
      a.n += 1;
      if (a.n >= 8) { a.until = now + 15 * 60 * 1000; a.n = 0; }
      attempts.set(req.ip, a);
      res.status(401).json({ error: 'Usuário ou senha incorretos.' });
    } catch (e) {
      console.error('login:', e.message);
      res.status(500).json({ error: 'Erro no servidor.' });
    }
  });

  // ---------- Sincronização ----------
  // Baixa tudo que mudou depois de "since" (inclui itens excluídos, marcados deleted=true)
  app.get('/api/sync', auth, async (req, res) => {
    try {
      const since = Math.max(0, Number(req.query.since) || 0);
      const { rows } = await pool.query(
        'SELECT collection, id, data, deleted, rev FROM records WHERE rev > $1 ORDER BY rev ASC', [since]);
      res.json({
        rev: lastRev,
        records: rows.map(r => ({
          collection: r.collection, id: r.id, data: r.data, deleted: !!r.deleted, rev: Number(r.rev)
        }))
      });
    } catch (e) {
      console.error('sync GET:', e.message);
      res.status(500).json({ error: 'Erro ao ler o banco.' });
    }
  });

  // Envia alterações: { ops: [ { c: "caminhoes", i: "id", d: {...} | null } ] }  (null = excluir)
  app.post('/api/sync', auth, async (req, res) => {
    const ops = req.body && req.body.ops;
    if (!Array.isArray(ops) || ops.length > 2000) return res.status(400).json({ error: 'Pedido inválido.' });
    for (const op of ops) {
      const okShape = op && typeof op.c === 'string' && COLLECTIONS.includes(op.c) &&
        typeof op.i === 'string' && op.i.length > 0 && op.i.length <= 100;
      if (!okShape) return res.status(400).json({ error: 'Operação inválida.' });
      if (op.c === 'config') {
        if (op.i !== 'main' || !op.d || typeof op.d !== 'object' || Array.isArray(op.d)) {
          return res.status(400).json({ error: 'Configuração inválida.' });
        }
      } else if (op.d !== null) {
        if (typeof op.d !== 'object' || Array.isArray(op.d) || String(op.d.id) !== op.i) {
          return res.status(400).json({ error: 'Registro inválido.' });
        }
      }
    }
    let client;
    try {
      client = await pool.connect();
      await client.query('BEGIN');
      for (const op of ops) {
        const del = op.d === null;
        await client.query(UPSERT, [op.c, op.i, del ? null : JSON.stringify(op.d), del, nextRev()]);
      }
      await client.query('COMMIT');
      res.json({ ok: true, rev: lastRev });
    } catch (e) {
      if (client) { try { await client.query('ROLLBACK'); } catch (e2) { /* ignora */ } }
      console.error('sync POST:', e.message);
      res.status(500).json({ error: 'Erro ao gravar no banco.' });
    } finally {
      if (client) client.release();
    }
  });

  // ---------- Arquivos do sistema (só as pastas públicas; .env e server.js ficam de fora) ----------
  const staticOpts = { setHeaders: res => res.setHeader('Cache-Control', 'no-cache') };
  ['css', 'js', 'assets'].forEach(dir => {
    app.use('/' + dir, express.static(path.join(rootDir, dir), staticOpts));
  });
  const sendIndex = (req, res) =>
    res.sendFile(path.join(rootDir, 'index.html'), { headers: { 'Cache-Control': 'no-cache' } });
  app.get('/', sendIndex);
  app.get('/index.html', sendIndex);

  app.use((err, req, res, next) => {
    if (err && err.type === 'entity.too.large') return res.status(413).json({ error: 'Arquivo grande demais.' });
    if (err && err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON inválido.' });
    console.error(err);
    res.status(500).json({ error: 'Erro no servidor.' });
  });

  return app;
}

async function start() {
  require('dotenv').config();
  const { Pool } = require('pg');
  if (!process.env.DATABASE_URL) {
    console.error('Falta DATABASE_URL no arquivo .env (copie do "Quick Connect" do Layerbase).');
    process.exit(1);
  }
  let secret = process.env.SESSION_SECRET;
  if (!secret) {
    secret = crypto.randomBytes(32).toString('hex');
    console.warn('Aviso: SESSION_SECRET não definido. Todos serão deslogados a cada reinício do servidor.');
  }
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    keepAlive: true,
    connectionTimeoutMillis: 20000, // banco no plano gratuito pode "acordar" devagar
    idleTimeoutMillis: 30000
  });
  pool.on('error', e => console.error('Conexão ociosa com o banco caiu (será refeita):', e.message));

  let startRev;
  try {
    startRev = await initDb(pool, process.env);
  } catch (e) {
    console.error('Não foi possível preparar o banco:', e.message);
    process.exit(1);
  }
  const port = Number(process.env.PORT) || 3000;
  createApp(pool, { secret, startRev }).listen(port, '0.0.0.0', () => {
    console.log('Logísticas Bill rodando em http://localhost:' + port);
  });
}

module.exports = { createApp, initDb, COLLECTIONS };

if (require.main === module) start();
