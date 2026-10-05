import pg from 'pg';

export function createPool(databaseUrl) { return new pg.Pool({ connectionString: databaseUrl, max: 10 }); }

export async function transaction(pool, action) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await action(client);
    await client.query('COMMIT');
    return result;
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
