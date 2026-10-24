'use strict';
const { ensureDb, getPool, sign, safeEq, jsonBody, TOKEN_HOURS } = require('./_db');

// Limite de tentativas por IP (por instância da função — protege contra tentativa em massa simples)
const attempts = new Map();

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ip = String((req.headers && req.headers['x-forwarded-for']) || '').split(',')[0].trim() ||
    (req.socket && req.socket.remoteAddress) || 'x';
  const now = Date.now();
  const a = attempts.get(ip) || { n: 0, until: 0 };
  if (a.until > now) return res.status(429).json({ error: 'Muitas tentativas. Aguarde alguns minutos.' });

  try {
    await ensureDb();
    const body = jsonBody(req);
    const user = String(body.user || '');
    const pass = String(body.pass || '');
    const { rows } = await getPool().query(
      "SELECT data FROM records WHERE collection = 'config' AND id = 'main' AND deleted = false");
    const cfg = rows[0] && rows[0].data;
    if (cfg && safeEq(user, cfg.usuario) && safeEq(pass, cfg.senha)) {
      attempts.delete(ip);
      return res.status(200).json({ token: sign({ u: user, exp: now + TOKEN_HOURS * 3600 * 1000 }), user });
    }
    a.n += 1;
    if (a.n >= 8) { a.until = now + 15 * 60 * 1000; a.n = 0; }
    attempts.set(ip, a);
    return res.status(401).json({ error: 'Usuário ou senha incorretos.' });
  } catch (e) {
    console.error('[api/login]', e.message);
    return res.status(500).json({ error: 'Erro no servidor: ' + e.message });
  }
};
