import test from 'node:test';
import assert from 'node:assert/strict';

const intent = { subject: 'red fox', category: 'animal', confidence: 0.95, ambiguous: false };
const wolf = { subject: 'gray wolf', category: 'animal', attributes: ['gray fur'], caption: 'A gray wolf in the forest', confidence: 0.96 };
test('guard_refuses_wolf_for_fox_even_with_high_similarity', async () => {
  const { guard } = await import('../src/matching/guard.mjs');
  const result = guard({ intent, metadata: wolf, similarity: 0.99, threshold: 0.5, eligible: true });
  assert.equal(result.accepted, false);
  assert.ok(result.reasons.includes('Animal category mismatch: expected fox, detected wolf'));
});
test('guard_requires_confident_subjects_similarity_and_available_metadata', async () => {
  const { guard } = await import('../src/matching/guard.mjs');
  const fox = { ...wolf, subject: 'red fox' };
  assert.equal(guard({ intent, metadata: fox, similarity: 0.8, threshold: 0.5, eligible: true }).accepted, true);
  for (const change of [{ metadata: { ...fox, confidence: 0.74 } }, { metadata: { ...fox, confidence: 0.75 } }, { intent: { ...intent, ambiguous: true } }, { intent: { ...intent, subject: 'unknown' } }, { similarity: 0.2 }, { eligible: false }, { metadata: null }]) {
    const result = guard({ intent, metadata: fox, similarity: 0.8, threshold: 0.5, eligible: true, ...change });
    assert.equal(result.accepted, false); assert.ok(result.reasons.length);
  }
});
test('semantic_aliases_and_cosine_ranking_do_not_depend_on_filenames', async () => {
  const { canonicalSubject } = await import('../src/matching/taxonomy.mjs');
  const { cosine, rankCandidates } = await import('../src/matching/rank.mjs');
  assert.equal(canonicalSubject('Vulpes vulpes'), 'fox');
  assert.equal(canonicalSubject('red fox'), 'fox');
  assert.equal(canonicalSubject('Canis lupus'), 'wolf');
  assert.equal(canonicalSubject('Sunlight through woodland'),'forest');
  assert.equal(canonicalSubject('Zamioculcas leaves'),'zz plant');
  assert.equal(canonicalSubject('fox wolf portrait'),'unknown');
  assert.equal(cosine([1,0],[0,1]), 0);
  for (const pair of [[[0,0],[1,0]],[[NaN,1],[1,0]],[[1],[1,0]]]) assert.throws(() => cosine(...pair));
  const vector = { values: [1,0], model: 'test', dimensions: 2 };
  const candidates = [{ id: 'wolf', vector: { ...vector, values: [0,1] }, filePath: 'fox.jpg' }, { id: 'fox', vector, filePath: 'wolf.jpg' }];
  assert.deepEqual(rankCandidates(vector,candidates).map(c=>c.id), ['fox','wolf']);
  assert.equal(rankCandidates(vector,[{ id: 'other', vector: { ...vector, model: 'other' } }]).length, 0);
});

test('ambiguous_species_cannot_become_a_confident_fox_recommendation',async()=>{
  const {guard}=await import('../src/matching/guard.mjs');
  const {flagged}=await import('../src/ai/schemas.mjs');
  const metadata={...wolf,subject:'fox or wolf',confidence:0.95};
  assert.equal(flagged(metadata),true);
  assert.equal(guard({intent,metadata,similarity:0.99,threshold:0.5,eligible:true}).accepted,false);
});
