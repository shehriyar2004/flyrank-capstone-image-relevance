import { randomUUID } from 'node:crypto';
import pg from 'pg';

export async function testDatabase() {
  const { migrate } = await import('../../src/data/migrate.mjs');
  const schema = `test_${randomUUID().replaceAll('-', '')}`;
  const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  await admin.query(`CREATE SCHEMA "${schema}"`);
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, options: `-c search_path=${schema}` });
  await migrate(pool);
  return { pool, close: async () => { await pool.end(); await admin.query(`DROP SCHEMA "${schema}" CASCADE`); await admin.end(); } };
}

export async function demoEntities(pool) {
  const { createRepository } = await import('../../src/data/repository.mjs');
  const repo = createRepository(pool);
  const a = randomUUID(), b = randomUUID();
  await repo.addTenant({ id: a, name: 'test A', key: 'test-key-a', callBudget: 1000 });
  await repo.addTenant({ id: b, name: 'test B', key: 'test-key-b', callBudget: 1000 });
  const image = await repo.createImage(a, { manifestId: 'sample-a', sha256: 'a'.repeat(64), filePath: 'sample-a.jpg' });
  const post = await repo.createPost(a, { title: 'Fox', content: 'An article about a red fox.' });
  return { repo, a, b, image, post };
}
