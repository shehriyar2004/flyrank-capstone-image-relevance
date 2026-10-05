import test from 'node:test';
import assert from 'node:assert/strict';
import { testDatabase, demoEntities } from './helpers.mjs';

const metadata = { subject: 'red fox', category: 'animal', attributes: ['orange fur'], caption: 'A red fox standing among trees.', confidence: 0.74 };
test('staged_retry_reuses_valid_tags_and_keeps_low_confidence_flagged', async () => {
  const db = await testDatabase();
  try {
    const { createQueue } = await import('../../src/jobs/queue.mjs');
    const { createProcessor } = await import('../../src/jobs/processors.mjs');
    const { a, image, repo } = await demoEntities(db.pool);
    const queue = createQueue(db.pool);
    await queue.enqueue(a, 'image', image.id, 'vision-v1');
    let embeddingsFail = true;
    const provider = { classifyImage: async () => ({ ...metadata }), embed: async text => {
      if (embeddingsFail) throw Object.assign(new Error('fixture unavailable'), { code: 'PROVIDER_UNAVAILABLE' });
      return { values: [1, 0], model: 'fixture', dimensions: 2, inputHash: (await import('../../src/data/repository.mjs')).hash('task: sentence similarity | query: '+text) };
    } };
    const processor = createProcessor({ pool: db.pool, repo, queue, provider, readImage: async () => Buffer.from('fixture bytes'), config: { embeddingModel: 'fixture', visionModel: 'fixture' } });
    let job = await queue.claim('first');
    await assert.rejects(processor.processJob(job));
    await queue.fail(job, { code: 'PROVIDER_UNAVAILABLE' });
    assert.equal((await repo.getImage(a, image.id)).status, 'flagged');
    embeddingsFail = false;
    provider.classifyImage = async () => { throw new Error('Classification must not repeat'); };
    await db.pool.query('UPDATE jobs SET available_at=now() WHERE id=$1', [job.id]);
    job = await queue.claim('second');
    await processor.processJob(job);
    assert.equal((await repo.getImage(a, image.id)).status, 'flagged');
    assert.equal(Number((await db.pool.query('SELECT count(*) FROM image_tags WHERE image_id=$1', [image.id])).rows[0].count), 1);
    assert.equal(Number((await db.pool.query('SELECT count(*) FROM embeddings WHERE image_id=$1', [image.id])).rows[0].count), 1);
  } finally { await db.close(); }
});

test('invalid_vision_output_retries_without_trusted_tags', async () => {
  const db = await testDatabase();
  try {
    const { createQueue } = await import('../../src/jobs/queue.mjs');
    const { createProcessor } = await import('../../src/jobs/processors.mjs');
    const { a, image, repo } = await demoEntities(db.pool);
    const queue = createQueue(db.pool);
    await queue.enqueue(a, 'image', image.id, 'v1');
    const provider = { classifyImage: async () => ({ invalid: 'never trusted' }) };
    const processor = createProcessor({ pool: db.pool, repo, queue, provider, readImage: async () => Buffer.from('fixture'), config: { visionModel: 'fixture' } });
    for (let i = 0; i < 3; i++) {
      const job = await queue.claim('worker');
      await assert.rejects(processor.processJob(job), e => e.code === 'INVALID_MODEL_OUTPUT');
      await queue.fail(job, { code: 'INVALID_MODEL_OUTPUT' });
      await db.pool.query('UPDATE jobs SET available_at=now() WHERE id=$1', [job.id]);
    }
    assert.equal(Number((await db.pool.query('SELECT count(*) FROM image_tags')).rows[0].count), 0);
    assert.equal((await repo.getImage(a, image.id)).status, 'failed');
  } finally { await db.close(); }
});
