import test from 'node:test';
import assert from 'node:assert/strict';

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
