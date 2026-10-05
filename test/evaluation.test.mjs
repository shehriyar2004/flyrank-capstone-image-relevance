import test from 'node:test';
import assert from 'node:assert/strict';

test('precision_counts_refusals_as_misses_and_keeps_negatives_separate',async()=>{
  const {summarizeEvaluation}=await import('../scripts/evaluate.mjs');
  const summary=summarizeEvaluation([{expected:'a',actual:'a'},{expected:'b',actual:'b'},{expected:'c',actual:'d'},{expected:'e',actual:null}], [{refused:true}]);
  assert.equal(summary.correct,2);assert.equal(summary.total,4);assert.equal(summary.top1Precision,0.5);assert.equal(summary.coverage,0.75);assert.equal(summary.negativeResults[0].refused,true);
});

test('calibration_selects_a_threshold_without_accepting_labeled_negatives',async()=>{
  const {selectThreshold}=await import('../scripts/calibrate.mjs');
  const positives=[{expected:'a',candidates:[{id:'a',score:0.8,subjectPass:true}]},{expected:'b',candidates:[{id:'b',score:0.7,subjectPass:true}]}];
  const negatives=[{candidates:[{id:'bad',score:0.65,subjectPass:true}]}];
  assert.equal(selectThreshold(positives,negatives),0.7);
  assert.throws(()=>selectThreshold([{expected:'a',candidates:[]}],negatives));
});
