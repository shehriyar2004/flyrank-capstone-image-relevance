import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createClient } from './api-client.mjs';
import { hash } from '../src/data/repository.mjs';
import {randomUUID} from 'node:crypto';
import {EMBEDDING_PROFILE} from '../src/ai/embedding-input.mjs';

export function selectThreshold(positives,negatives) {
  if(!positives.length||[...positives,...negatives].some(sample=>!sample.candidates.length))throw new Error('Calibration needs completed compatible embeddings for every sample');
  let best=-1,threshold=1;
  for(let step=0;step<=100;step++) {
    const bar=step/100;
    const pick=sample=>sample.candidates.filter(c=>c.subjectPass && c.score>=bar).sort((a,b)=>b.score-a.score)[0];
    if(negatives.some(sample=>pick(sample)))continue;
    const correct=positives.filter(sample=>pick(sample)?.id===sample.expected).length;
    if(correct>=best){best=correct;threshold=bar;}
  }
  return threshold;
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url) {
  try {
  const raw=await readFile('data/calibration.json','utf8'),dataset=JSON.parse(raw);
  const seed=JSON.parse(await readFile('.local/seed.json','utf8')),api=await createClient();
  const runId=randomUUID(),embeddingModels=new Set(),visionModels=new Set();
  for(const item of [...seed.images,...Object.entries(seed.posts).filter(([name])=>name.startsWith('calibration:')).map(([,item])=>item)])if((await api(`/jobs/${item.jobId}`)).status!=='succeeded')throw new Error('Finish corpus/calibration jobs before calibrating');
  const collect=async sample=>{
    const postId=seed.posts[`calibration:${sample.id}`].postId;
    const candidates=[];
    for(const image of seed.images) {
      const check=await api(`/posts/${postId}/images/check`,{method:'POST',body:{imageId:image.imageId},idempotency:`cal-${runId}-${postId}-${image.imageId}`});
      if(check.embeddingModelIdentity)embeddingModels.add(check.embeddingModelIdentity);
      if(check.visionModelIdentity)visionModels.add(check.visionModelIdentity);
      const subjectPass=check.subjectAccepted;
      if(Number.isFinite(check.score))candidates.push({id:image.manifestId,score:check.score,subjectPass});
    }
    return {expected:sample.expectedImageId,candidates};
  };
  // The API check applies the current similarity bar, but calibration ignores only that reason.
  const positives=[];for(const sample of dataset.positives)positives.push(await collect(sample));
  const negatives=[];for(const sample of dataset.negatives)negatives.push(await collect(sample));
  const threshold=selectThreshold(positives,negatives);
  if(embeddingModels.size!==1||visionModels.size!==1)throw new Error('Calibration model provenance is incomplete or mixed');
  const models={embedding:[...embeddingModels][0],vision:[...visionModels][0]};
  const config={threshold,models,inputProfile:EMBEDDING_PROFILE,version:hash(raw+JSON.stringify({threshold,models,profile:EMBEDDING_PROFILE})),calibrated:true,calibrationHash:hash(raw),selection:'Maximize correct calibration top-1 with no accepted negatives; higher threshold wins ties',frozenAt:new Date().toISOString()};
  await writeFile('config/matching.json',JSON.stringify(config,null,2)+'\n');
  await mkdir('evidence',{recursive:true});await writeFile('evidence/calibration.json',JSON.stringify({config,positives,negatives},null,2)+'\n');
  console.log(JSON.stringify(config));console.log('Rebuild/restart the API to load the frozen threshold, then run evaluation.');
  } catch(error) { console.error(error.message);process.exitCode=1; }
}
