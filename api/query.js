const { query } = require('./_db');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    if (!process.env.DATABASE_URL) {
      res.status(500).json({ error: 'DATABASE_URL não configurada na Vercel' });
      return;
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const sql = body.query || body.sql;
    const params = body.params || [];
    if (!sql || typeof sql !== 'string') {
      res.status(400).json({ error: 'Campo query obrigatório' });
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
    res.status(500).json({
      error: err.message || 'Erro na query',
      code: err.code || null
    });
  }
};
