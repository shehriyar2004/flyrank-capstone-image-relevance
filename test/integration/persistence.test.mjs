import test from 'node:test';
import assert from 'node:assert/strict';
import { testDatabase, demoEntities } from './helpers.mjs';

test('tenant_reads_and_foreign_keys_prevent_cross_tenant_references', async () => {
  const db = await testDatabase();
  try {
    const { repo, a, b, image } = await demoEntities(db.pool);
    assert.equal(await repo.authenticate('test-key-a'), a);
    assert.equal(await repo.authenticate('wrong-key'), null);
    assert.equal(await repo.getImage(b, image.id), null);
    const otherPost = await repo.createPost(b, { title: 'Other', content: 'Different tenant.' });
    await assert.rejects(db.pool.query('INSERT INTO suggestions(tenant_id,post_id,image_id,score,snapshot,post_version,image_version,threshold_version) VALUES($1,$2,$3,0.9,\'{}\',\'p\',\'i\',\'t\')', [b, otherPost.id, image.id]), error => error.code === '23503');
    const row = (await db.pool.query('SELECT key_hash FROM tenants WHERE id=$1', [a])).rows[0];
    assert.notEqual(row.key_hash, 'test-key-a');
    assert.equal(row.key_hash.length, 64);
  } finally { await db.close(); }
});

test('concurrent_idempotency_creates_one_durable_action_and_payload_conflict', async () => {
  const db = await testDatabase();
  try {
    const { repo, a } = await demoEntities(db.pool);
    const responses = await Promise.all(Array.from({ length: 8 }, () => repo.idempotent(a, 'post-create', 'one-key', { title: 'New' }, async client => {
      const post = await repo.createPost(a, { title: 'New', content: 'Created once.' }, client);
      return { status: 202, body: { id: post.id } };
    })));
    assert.equal(new Set(responses.map(r => r.body.id)).size, 1);
    assert.equal(Number((await db.pool.query("SELECT count(*) FROM posts WHERE tenant_id=$1 AND title='New'", [a])).rows[0].count), 1);
    await assert.rejects(repo.idempotent(a, 'post-create', 'one-key', { title: 'Changed' }, async () => ({ status: 202, body: {} })), error => error.status === 409);
  } finally { await db.close(); }
});

test('migrations_are_repeatable_without_losing_rows', async () => {
  const db = await testDatabase();
  try {
    const { repo, a, image } = await demoEntities(db.pool);
    const { migrate } = await import('../../src/data/migrate.mjs');
    await migrate(db.pool);
    assert.equal((await repo.getImage(a, image.id)).manifest_id, 'sample-a');
    assert.equal(Number((await db.pool.query('SELECT count(*) FROM schema_migrations')).rows[0].count), 1);
  } finally { await db.close(); }
});
