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
    const current = body.current || body.senhaAtual || '';
    const next = body.next || body.novaSenha || '';
    const usuario = body.usuario;

    if (!current || !next) {
      res.status(400).json({ error: 'Senha atual e nova senha obrigatórias' });
      return;
    }
    if (String(next).length < 4) {
      res.status(400).json({ error: 'Nova senha muito curta' });
      return;
    }

    await query(`ALTER TABLE config ADD COLUMN IF NOT EXISTS senha_hash TEXT`).catch(() => {});

    const r = await query('SELECT usuario, senha, senha_hash FROM config WHERE id = 1 LIMIT 1');
    const row = r.rows[0];
    if (!row) {
      res.status(404).json({ error: 'Config não encontrada' });
      return;
    }

    let ok = false;
    if (row.senha_hash) {
      ok = await verify(row.senha_hash, current);
    } else if (row.senha === current) {
      ok = true;
    }
    if (!ok) {
      res.status(401).json({ error: 'Senha atual incorreta' });
      return;
    }

    const hashed = await hash(next);
    if (usuario) {
      await query(
        'UPDATE config SET usuario = $1, senha_hash = $2, senha = NULL WHERE id = 1',
        [usuario, hashed]
      );
    } else {
      await query(
        'UPDATE config SET senha_hash = $1, senha = NULL WHERE id = 1',
        [hashed]
      );
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[api/auth/password]', err);
    res.status(500).json({ error: err.message || 'Erro ao alterar senha' });
  }
};
