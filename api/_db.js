const { Pool } = require('pg');

let pool;

function getPool() {
  if (pool) return pool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL não definida nas variáveis de ambiente da Vercel');
  }
  pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 3,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 15000
  });
  return pool;
}

async function query(sql, params = []) {
  const p = getPool();
  const result = await p.query(sql, params);
  return result;
}

module.exports = { getPool, query };
