import { Pool } from 'pg';

// Direct Postgres connection for server-side operations
const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://postgres.pdgtdcabbfvhomkpoajw:zecoejaldWbc@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres';

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
});

export async function query(text: string, params?: unknown[]) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  return res;
}

export default pool;
