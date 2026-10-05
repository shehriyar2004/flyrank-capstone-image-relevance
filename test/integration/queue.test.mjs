import test from 'node:test';
import assert from 'node:assert/strict';
import { testDatabase, demoEntities } from './helpers.mjs';

test('queue_deduplicates_jobs_and_recovers_expired_leases_with_fencing', async () => {
  const db = await testDatabase();
  try {
    const { createQueue } = await import('../../src/jobs/queue.mjs');
    const queue = createQueue(db.pool);
    const { a, image } = await demoEntities(db.pool);
    const jobs = await Promise.all(Array.from({ length: 6 }, () => queue.enqueue(a, 'image', image.id, 'v1')));
    assert.equal(new Set(jobs.map(j => j.id)).size, 1);
    const first = await queue.claim('worker-1');
    assert.equal(first.attempts, 1);
    assert.equal(await queue.claim('worker-2'), null);
    assert.equal(await queue.heartbeat(first.id, first.lease_token), true);
    await db.pool.query("UPDATE jobs SET lease_until=now()-interval '1 second' WHERE id=$1", [first.id]);
    const recovered = await queue.claim('worker-2');
    assert.equal(recovered.id, first.id);
    assert.equal(recovered.attempts, 2);
    assert.notEqual(recovered.lease_token, first.lease_token);
    assert.equal(await queue.finish(first, {}), false);
    assert.equal(await queue.finish(recovered, { processed: 1 }), true);
  } finally { await db.close(); }
});

test('three_failed_attempts_create_one_failure_alert_and_no_fourth_attempt', async () => {
  const db = await testDatabase();
  try {
    const { createQueue } = await import('../../src/jobs/queue.mjs');
    const queue = createQueue(db.pool);
    const { a, image } = await demoEntities(db.pool);
    const job = await queue.enqueue(a, 'image', image.id, 'v1');
    for (let attempt = 1; attempt <= 3; attempt++) {
      const claimed = await queue.claim('worker');
      assert.equal(claimed.attempts, attempt);
      await queue.fail(claimed, { code: 'INVALID_MODEL_OUTPUT' });
      if (attempt < 3) {
        const next = (await db.pool.query('SELECT available_at>now() AS delayed FROM jobs WHERE id=$1', [job.id])).rows[0];
        assert.equal(next.delayed, true);
        await db.pool.query('UPDATE jobs SET available_at=now() WHERE id=$1', [job.id]);
      }
    }
    assert.equal(await queue.claim('worker'), null);
    assert.equal(Number((await db.pool.query('SELECT count(*) FROM alerts WHERE job_id=$1', [job.id])).rows[0].count), 1);
    assert.equal((await db.pool.query('SELECT status FROM images WHERE id=$1', [image.id])).rows[0].status, 'failed');
  } finally { await db.close(); }
});
