'use strict';
/**
 * Utilidades compartilhadas das funções /api (o "_" no nome impede a Vercel de expor como rota).
 * A DATABASE_URL e o SESSION_SECRET ficam só nas variáveis de ambiente — nunca no navegador.
 */
const crypto = require('crypto');

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

let pool = null;
let ready = null;

function getPool() {
  if (pool) return pool;
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error('DATABASE_URL não definida nas variáveis de ambiente');
  // O SSL é configurado abaixo; tira o "sslmode" da URL para não haver duas regras diferentes.
  const url = raw.replace(/([?&])sslmode=[^&]*&?/, '$1').replace(/[?&]$/, '');
  const { Pool } = require('pg');
  pool = new Pool({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    max: 3,
    keepAlive: true,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 20000 // banco gratuito pode "acordar" devagar
  });
  pool.on('error', e => console.error('Conexão ociosa com o banco caiu (será refeita):', e.message));
  return pool;
}

/** Só para testes. */
function setPool(p) { pool = p; ready = null; }

async function initDb() {
  const p = getPool();
  await p.query(`
    CREATE TABLE IF NOT EXISTS records (
      collection text NOT NULL,
      id         text NOT NULL,
      data       jsonb,
      deleted    boolean NOT NULL DEFAULT false,
      rev        bigint NOT NULL,
      PRIMARY KEY (collection, id)
    )`);
  await p.query('CREATE INDEX IF NOT EXISTS records_rev_idx ON records (rev)');
  const cfg = await p.query("SELECT 1 FROM records WHERE collection = 'config' AND id = 'main'");
  if (!cfg.rows.length) {
    const pass = process.env.ADMIN_PASS;
    if (!pass) throw new Error('Banco novo: defina ADMIN_PASS (e opcionalmente ADMIN_USER) nas variáveis de ambiente.');
    const config = { usuario: process.env.ADMIN_USER || 'Admin', senha: pass, diariaPadrao: 350 };
    await p.query(UPSERT, ['config', 'main', JSON.stringify(config), false, Date.now()]);
    console.log('Acesso inicial criado para o usuário "' + config.usuario + '".');
  }
}

/** Cria a tabela e o acesso inicial uma vez por instância. */
function ensureDb() {
  if (!ready) ready = initDb().catch(e => { ready = null; throw e; });
  return ready;
}

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error('Defina SESSION_SECRET nas variáveis de ambiente.');
  return s;
}

function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  return body + '.' + sig;
}

function verify(token) {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const expected = crypto.createHmac('sha256', secret()).update(parts[0]).digest('base64url');
  const a = Buffer.from(parts[1]);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
    return p && p.exp > Date.now() ? p : null;
  } catch (e) { return null; }
}

function authUser(req) {
  const h = (req.headers && req.headers.authorization) || '';
  return h.startsWith('Bearer ') ? verify(h.slice(7)) : null;
}

function safeEq(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function jsonBody(req) {
  const b = req.body;
  if (typeof b === 'string') { try { return JSON.parse(b || '{}'); } catch (e) { return {}; } }
  return b || {};
}

module.exports = {
  COLLECTIONS, TOKEN_HOURS, UPSERT,
  getPool, setPool, ensureDb, sign, verify, authUser, safeEq, jsonBody
};
