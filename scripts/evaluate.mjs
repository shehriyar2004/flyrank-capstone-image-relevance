import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createClient } from './api-client.mjs';
import { hash } from '../src/data/repository.mjs';

export function summarizeEvaluation(results,negativeResults) {
  const correct=results.filter(v=>v.expected===v.actual).length,total=results.length;
  return {correct,total,top1Precision:total?correct/total:0,coverage:total?results.filter(v=>v.actual!==null).length/total:0,negativeResults};
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url) {
  try {
  const dataset=JSON.parse(await readFile('data/evaluation.json','utf8'));
  const seed=JSON.parse(await readFile('.local/seed.json','utf8')),api=await createClient();
  const before=await readFile('config/matching.json','utf8'),matching=JSON.parse(before);
  if(!matching.calibrated||!matching.models)throw new Error('Calibrate and freeze thresholds/model identities before evaluation');
  const results=[],negatives=[];
  for(const sample of dataset.positives) {
    const result=await api(`/posts/${seed.posts[`evaluation:${sample.id}`].postId}/images`);
    if(result.status==='processing')throw new Error('Wait for evaluation post processing to finish');
    if(result.embeddingModelIdentity!==matching.models.embedding)throw new Error('Evaluation embedding model differs from frozen calibration');
    if(result.embeddingProfile!==matching.inputProfile)throw new Error('Evaluation input profile differs from frozen calibration');
    results.push({id:sample.id,expected:sample.expectedImageId,actual:result.suggestions[0]?.manifestId??null,status:result.status,first:result.suggestions[0]??null,reasons:result.reasons});
  }
  for(const sample of dataset.negatives) {
    const result=await api(`/posts/${seed.posts[`evaluation:${sample.id}`].postId}/images`);
    if(result.status==='processing')throw new Error('Wait for negative post processing to finish');
    negatives.push({id:sample.id,refused:result.status==='no confident match',reasons:result.reasons});
  }
  if(await readFile('config/matching.json','utf8')!==before)throw new Error('Threshold changed during held-out evaluation');
  const summary=summarizeEvaluation(results,negatives),report={...summary,threshold:matching,results,evaluationHash:hash(JSON.stringify(dataset))};
  await mkdir('evidence',{recursive:true});await writeFile('evidence/evaluation.json',JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({correct:summary.correct,total:summary.total,top1Precision:summary.top1Precision,coverage:summary.coverage,negativeResults:summary.negativeResults}));
  } catch(error) { console.error(error.message);process.exitCode=1; }
}
