import { readFile,mkdir,writeFile } from 'node:fs/promises';
import { hash } from '../src/data/repository.mjs';
import { auditCorpus,downloadCorpus } from './download-corpus.mjs';
import { createClient } from './api-client.mjs';

const manifest=JSON.parse(await readFile('data/corpus.json','utf8'));
console.log(JSON.stringify(auditCorpus(manifest)));
console.log(JSON.stringify(await downloadCorpus(manifest,'data/images')));
const api=await createClient();
const corpusHash=hash(JSON.stringify(manifest.map(v=>({id:v.id,sha256:v.sha256}))));
const batch=await api('/images/batches',{method:'POST',idempotency:`corpus-${corpusHash}`,body:{imageIds:manifest.map(v=>v.id)}});
const posts={};
for(const split of ['calibration','evaluation']) {
  const dataset=JSON.parse(await readFile(`data/${split}.json`,'utf8'));
  for(const sample of [...dataset.positives,...dataset.negatives]) {
    const payload={title:sample.title,content:sample.content};
    posts[`${split}:${sample.id}`]=await api('/posts',{method:'POST',body:payload,idempotency:`seed-${split}-${sample.id}-${hash(JSON.stringify(payload))}`});
  }
}
await mkdir('.local',{recursive:true});
await writeFile('.local/seed.json',JSON.stringify({corpusHash,images:batch.jobs,posts},null,2)+'\n');
console.log(JSON.stringify({queuedImages:batch.jobs.length,queuedPosts:Object.keys(posts).length,progress:'GET /jobs/:id; results become available as the local worker processes them'}));
