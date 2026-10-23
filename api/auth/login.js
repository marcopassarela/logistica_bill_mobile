const { query } = require('../_db');
const { verify, hash } = require('@node-rs/argon2');

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
    const user = (body.user || body.usuario || '').trim();
    const pass = body.pass || body.senha || '';

    if (!user || !pass) {
      res.status(400).json({ error: 'Usuário e senha obrigatórios' });
      return;
    }

    // Garante coluna senha_hash
    await query(`
      ALTER TABLE config ADD COLUMN IF NOT EXISTS senha_hash TEXT
    `).catch(() => {});

    const r = await query(
      'SELECT id, usuario, senha, senha_hash FROM config WHERE id = 1 LIMIT 1'
    );
    const row = r.rows[0];
    if (!row) {
      res.status(401).json({ error: 'Configuração não encontrada. Rode o SQL das tabelas.' });
      return;
    }

    if (row.usuario !== user) {
      res.status(401).json({ error: 'Usuário ou senha inválidos' });
      return;
    }

    let ok = false;

    if (row.senha_hash) {
      ok = await verify(row.senha_hash, pass);
    } else if (row.senha != null && row.senha === pass) {
      // Migração automática: senha em texto → Argon2
      const hashed = await hash(pass);
      await query('UPDATE config SET senha_hash = $1, senha = NULL WHERE id = 1', [hashed]);
      ok = true;
    }

    if (!ok) {
      res.status(401).json({ error: 'Usuário ou senha inválidos' });
      return;
    }

    res.status(200).json({
      ok: true,
      user: row.usuario,
      loginAt: Date.now()
    });
  } catch (err) {
    console.error('[api/auth/login]', err);
    res.status(500).json({ error: err.message || 'Erro no login' });
  }
};
