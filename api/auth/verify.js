const { query } = require('../_db');
const { verify } = require('@node-rs/argon2');

/** Verifica senha admin (para edições protegidas) */
module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const pass = body.pass || body.senha || '';
    const r = await query('SELECT senha, senha_hash FROM config WHERE id = 1 LIMIT 1');
    const row = r.rows[0];
    if (!row) {
      res.status(401).json({ ok: false });
      return;
    }
    let ok = false;
    if (row.senha_hash) ok = await verify(row.senha_hash, pass);
    else if (row.senha === pass) ok = true;
    res.status(ok ? 200 : 401).json({ ok });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
