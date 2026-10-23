const { query } = require('./_db');

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
    const sql = body.query || body.sql;
    const params = body.params || [];
    if (!sql || typeof sql !== 'string') {
      res.status(400).json({ error: 'Campo query obrigatório' });
      return;
    }
    // Bloqueia alguns comandos perigosos acidentais
    const bad = /^\s*(drop\s+database|drop\s+schema|truncate\s+pg_)/i;
    if (bad.test(sql)) {
      res.status(400).json({ error: 'Comando não permitido' });
      return;
    }
    const result = await query(sql, params);
    res.status(200).json({
      rows: result.rows,
      rowCount: result.rowCount,
      fields: (result.fields || []).map(f => f.name)
    });
  } catch (err) {
    console.error('[api/query]', err);
    res.status(500).json({ error: err.message || 'Erro na query' });
  }
};
