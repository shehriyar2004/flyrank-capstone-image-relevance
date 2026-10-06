import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';

const valid = { subject: 'red fox', category: 'animal', attributes: ['orange fur'], caption: 'A red fox standing in a green forest.', confidence: 0.94 };
test('vision_schema_rejects_untrusted_shape_and_confidence', async () => {
  const { parseVision, parseIntent } = await import('../src/ai/schemas.mjs');
  assert.deepEqual(parseVision(JSON.stringify(valid)), valid);
  for (const value of ['not json', JSON.stringify({ ...valid, secret: true }), JSON.stringify({ ...valid, confidence: 2 }), JSON.stringify({ ...valid, attributes: [] }), JSON.stringify({ ...valid, confidence: null })]) assert.throws(() => parseVision(value));
  assert.throws(() => parseVision({ ...valid, confidence: NaN }));
  assert.throws(() => parseIntent(JSON.stringify({ subject: 'fox', category: 'animal', confidence: 1 })));
});

test('embedding_validation_rejects_nonfinite_empty_and_zero_vectors', async () => {
  const { validateVector } = await import('../src/ai/schemas.mjs');
  assert.deepEqual(validateVector([1, 0]), [1, 0]);
  for (const vector of [[], [0, 0], [NaN, 1], [Infinity, 1]]) assert.throws(() => validateVector(vector));
});

test('model_identity_tracks_immutable_digest_when_a_tag_changes',async()=>{
  const {resolveModelIdentity}=await import('../src/ai/ollama.mjs');
  let digest='a'.repeat(64);
  const server=createServer((_req,res)=>res.end(JSON.stringify({models:[{name:'fixture',digest}]})));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try {
    const url=`http://127.0.0.1:${server.address().port}`;
    assert.equal(await resolveModelIdentity(url,'fixture'),`fixture@${'a'.repeat(64)}`);
    digest='b'.repeat(64);
    assert.equal(await resolveModelIdentity(url,'fixture'),`fixture@${'b'.repeat(64)}`);
  }finally{await new Promise(resolve=>server.close(resolve));}
});

test('scientific_text_normalization_respects_full_names_and_word_boundaries',async()=>{
  const {normalizeScientificText}=await import('../src/ai/nomenclature.mjs');
  assert.equal(normalizeScientificText('Vulpes vulpes in woodland'),'red fox in woodland');
  assert.equal(normalizeScientificText('Canis lupus familiaris'),'domestic dog');
  assert.equal(normalizeScientificText('Vulpes vulpesensis'),'Vulpes vulpesensis');
});
