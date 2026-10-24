'use strict';
const { ensureDb, getPool, authUser, jsonBody, COLLECTIONS, UPSERT } = require('./_db');

// A Vercel limita a resposta/pedido a ~4,5 MB; a lista é entregue em páginas menores que isso.
const maxRecords = () => Number(process.env.SYNC_MAX_RECORDS) || 500;
const maxBytes = () => Number(process.env.SYNC_MAX_BYTES) || 3500000;

module.exports = async function handler(req, res) {
  try {
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (!authUser(req)) return res.status(401).json({ error: 'Sessão inválida ou expirada.' });
    await ensureDb();
    if (req.method === 'GET') return await pull(req, res);
    if (req.method === 'POST') return await push(req, res);
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error('[api/sync]', e.message);
    return res.status(500).json({ error: 'Erro no servidor: ' + e.message });
  }
};

// Baixa o que mudou depois de "since" (inclui excluídos, com deleted=true)
async function pull(req, res) {
  const since = Math.max(0, Number(req.query && req.query.since) || 0);
  const max = maxRecords();
  const { rows } = await getPool().query(
    'SELECT collection, id, data, deleted, rev FROM records WHERE rev > $1 ORDER BY rev ASC LIMIT $2',
    [since, max + 1]);
  const out = [];
  let bytes = 0;
  let more = false;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rec = { collection: r.collection, id: r.id, data: r.data, deleted: !!r.deleted, rev: Number(r.rev) };
    const size = JSON.stringify(rec).length;
    if (i >= max || (out.length && bytes + size > maxBytes())) { more = true; break; }
    out.push(rec);
    bytes += size;
  }
  const lastRev = out.length ? out[out.length - 1].rev : since;
  return res.status(200).json({ rev: more ? lastRev : Date.now(), more, records: out });
}

// Envia alterações: { ops: [ { c: "caminhoes", i: "id", d: {...} | null } ] }   (null = excluir)

// Mantém a tabela operacional produtos sincronizada com records.
// Exclusões são marcadas como excluido para preservar o histórico.
async function syncProductTable(client, op) {
  if (op.c !== 'produtos') return;

  if (op.d === null) {
    await client.query(
      "UPDATE produtos SET status = 'excluido' WHERE id = $1",
      [op.i]
    );
    return;
  }

  const d = op.d;
  const numero = (valor, campo) => {
    if (valor === null || valor === undefined || valor === '') return null;
    const n = Number(valor);
    if (!Number.isFinite(n)) throw new Error('Valor numerico invalido em produtos.' + campo);
    return n;
  };

  await client.query(`
    INSERT INTO produtos
      (id, codigo, nome, comprimento, diametro, peso, preco, status, created_at)
    VALUES
      ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9::timestamptz, NOW()))
    ON CONFLICT (id) DO UPDATE SET
      codigo = EXCLUDED.codigo,
      nome = EXCLUDED.nome,
      comprimento = EXCLUDED.comprimento,
      diametro = EXCLUDED.diametro,
      peso = EXCLUDED.peso,
      preco = EXCLUDED.preco,
      status = EXCLUDED.status
  `, [
    op.i,
    d.codigo == null ? '' : String(d.codigo),
    d.nome == null ? '' : String(d.nome),
    numero(d.comprimento, 'comprimento'),
    numero(d.diametro, 'diametro'),
    numero(d.peso, 'peso'),
    numero(d.preco, 'preco'),
    d.status == null ? 'disponivel' : String(d.status),
    d.created_at || d.createdAt || null
  ]);
}
async function push(req, res) {
  const ops = jsonBody(req).ops;
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
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const base = Date.now();
    for (let i = 0; i < ops.length; i++) {
      const op = ops[i];
      const del = op.d === null;
      await client.query(UPSERT, [op.c, op.i, del ? null : JSON.stringify(op.d), del, base + i]);
      await syncProductTable(client, op);
    }
    await client.query('COMMIT');
    return res.status(200).json({ ok: true, rev: Date.now() });
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch (e2) { /* ignora */ }
    throw e;
  } finally {
    client.release();
  }
}
