import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createClient } from './api-client.mjs';
import { hash } from '../src/data/repository.mjs';

export function selectThreshold(positives,negatives) {
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
  const raw=await readFile('data/calibration.json','utf8'),dataset=JSON.parse(raw);
  const seed=JSON.parse(await readFile('.local/seed.json','utf8')),api=await createClient();
  const collect=async sample=>{
    const postId=seed.posts[`calibration:${sample.id}`].postId;
    const candidates=[];
    for(const image of seed.images) {
      const check=await api(`/posts/${postId}/images/check`,{method:'POST',body:{imageId:image.imageId},idempotency:`calibration-zero-${postId}-${image.imageId}`});
      const subjectPass=check.subjectAccepted;
      if(Number.isFinite(check.score))candidates.push({id:image.manifestId,score:check.score,subjectPass});
    }
    return {expected:sample.expectedImageId,candidates};
  };
  // The API check applies the current similarity bar, but calibration ignores only that reason.
  const positives=[];for(const sample of dataset.positives)positives.push(await collect(sample));
  const negatives=[];for(const sample of dataset.negatives)negatives.push(await collect(sample));
  const threshold=selectThreshold(positives,negatives);
  const config={threshold,version:hash(raw+JSON.stringify({threshold})),calibrated:true,calibrationHash:hash(raw),selection:'Maximize correct calibration top-1 with no accepted negatives; higher threshold wins ties',frozenAt:new Date().toISOString()};
  await writeFile('config/matching.json',JSON.stringify(config,null,2)+'\n');
  await mkdir('evidence',{recursive:true});await writeFile('evidence/calibration.json',JSON.stringify({config,positives,negatives},null,2)+'\n');
  console.log(JSON.stringify(config));console.log('Rebuild/restart the API to load the frozen threshold, then run evaluation.');
}
