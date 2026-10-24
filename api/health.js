const { query } = require('./_db');

module.exports = async function handler(req, res) {
  try {
    const hasUrl = !!process.env.DATABASE_URL;
    let dbOk = false;
    let dbError = null;
    let productCount = null;
    if (hasUrl) {
      try {
        const r = await query('SELECT COUNT(*)::int AS n FROM produtos');
        dbOk = true;
        productCount = r.rows[0] ? r.rows[0].n : 0;
      } catch (e) {
        dbError = e.message;
      }
    }
    res.status(200).json({
      ok: true,
      databaseUrl: hasUrl,
      dbOk,
      dbError,
      productCount,
      time: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
};
