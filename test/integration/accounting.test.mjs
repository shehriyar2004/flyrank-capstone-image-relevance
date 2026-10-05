import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { testDatabase, demoEntities } from './helpers.mjs';

test('concurrent_budget_reservations_allow_two_calls_and_preserve_attribution', async () => {
  const db = await testDatabase();
  try {
    const { createAccounting } = await import('../../src/ai/accounting.mjs');
    const { a, image } = await demoEntities(db.pool);
    await db.pool.query('UPDATE tenants SET call_budget=2 WHERE id=$1', [a]);
    const accounting = createAccounting(db.pool);
    const context = { tenantId: a, jobId: null, entityId: image.id, attempt: 1, operation: 'vision' };
    const results = await Promise.allSettled(Array.from({ length: 20 }, () => accounting.reserveCall(context, 'test-local-model')));
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 2);
    assert.equal(results.filter(r => r.status === 'rejected' && r.reason.code === 'BUDGET_EXHAUSTED').length, 18);
    const rows = (await db.pool.query('SELECT * FROM ai_calls WHERE tenant_id=$1', [a])).rows;
    assert.equal(rows.length, 2);
    assert.equal(rows.every(r => r.status === 'reserved' && r.entity_id === image.id && Number(r.cost_usd) === 0 && r.input_tokens === null), true);
    assert.equal(Number((await db.pool.query("SELECT count(*) FROM alerts WHERE tenant_id=$1 AND kind='budget_exhausted'", [a])).rows[0].count), 1);
  } finally { await db.close(); }
});

test('real_provider_boundary_accounts_for_invalid_output_and_failed_transport', async () => {
  const db = await testDatabase();
  const server = createServer((request, response) => response.end(JSON.stringify(request.url==='/api/tags'?{models:[{name:'fixture-vision',digest:'a'.repeat(64)},{name:'fixture-embed',digest:'b'.repeat(64)}]}:{ model: 'fixture-vision', message: { content: 'invalid output' }, done: true, prompt_eval_count: 11, eval_count: 3 })));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const { createAccounting } = await import('../../src/ai/accounting.mjs');
    const { createOllama } = await import('../../src/ai/ollama.mjs');
    const { a, image } = await demoEntities(db.pool);
    const provider = createOllama({ config: { ollamaUrl: `http://127.0.0.1:${server.address().port}`, visionModel: 'fixture-vision', embeddingModel: 'fixture-embed' }, accounting: createAccounting(db.pool) });
    const context = { tenantId: a, jobId: null, entityId: image.id, attempt: 1 };
    await assert.rejects(provider.classifyImage(Buffer.from('fixture bytes'), context), e => e.code === 'INVALID_MODEL_OUTPUT');
    await new Promise(resolve => server.close(resolve));
    await assert.rejects(provider.embed('example', {...context,embeddingIdentity:`fixture-embed@${'b'.repeat(64)}`}), e => e.code === 'PROVIDER_UNAVAILABLE');
    const rows = (await db.pool.query('SELECT * FROM ai_calls WHERE tenant_id=$1 ORDER BY created_at', [a])).rows;
    assert.deepEqual(rows.map(r => r.status), ['error', 'error']);
    assert.equal(rows[0].input_tokens, 11);
    assert.equal(rows[0].output_tokens, 3);
    assert.equal(rows[0].response_json.message.content, 'invalid output');
    assert.equal(rows[1].input_tokens, null);
    assert.equal(rows.every(r => r.duration_ms >= 0 && Number(r.cost_usd) === 0), true);
  } finally { if (server.listening) await new Promise(resolve => server.close(resolve)); await db.close(); }
});

test('embedding_provider_uses_the_sentence_similarity_task_prompt',async()=>{
  const db=await testDatabase();let received;
  const server=createServer(async(request,response)=>{
    let body='';for await(const chunk of request)body+=chunk;
    if(request.url==='/api/tags')response.end(JSON.stringify({models:[{name:'fixture-embed',digest:'b'.repeat(64)}]}));
    else{received=JSON.parse(body);response.end(JSON.stringify({model:'fixture-embed',embeddings:[[1,0]],prompt_eval_count:9}));}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
    const {createOllama}=await import('../../src/ai/ollama.mjs');
    const {createAccounting}=await import('../../src/ai/accounting.mjs');
    const {a,image}=await demoEntities(db.pool);
    const provider=createOllama({config:{ollamaUrl:`http://127.0.0.1:${server.address().port}`,embeddingModel:'fixture-embed'},accounting:createAccounting(db.pool)});
    const result=await provider.embed('A fox in woodland.',{tenantId:a,jobId:null,entityId:image.id,attempt:1});
    assert.equal(received.input,'task: sentence similarity | query: A fox in woodland.');
    assert.equal(result.inputHash,(await import('../../src/data/repository.mjs')).hash('task: sentence similarity | query: A fox in woodland.'));
  }finally{await new Promise(resolve=>server.close(resolve));await db.close();}
});
