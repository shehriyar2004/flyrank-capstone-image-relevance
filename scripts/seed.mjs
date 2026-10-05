import { readFile,mkdir,writeFile } from 'node:fs/promises';
import { hash } from '../src/data/repository.mjs';
import { auditCorpus,downloadCorpus } from './download-corpus.mjs';
import { createClient } from './api-client.mjs';
import {pipelineRevision} from '../src/services/catalog.mjs';
import {PROMPT_VERSION} from '../src/ai/ollama.mjs';
import {EMBEDDING_PROFILE} from '../src/ai/embedding-input.mjs';

const manifest=JSON.parse(await readFile('data/corpus.json','utf8'));
console.log(JSON.stringify(auditCorpus(manifest)));
console.log(JSON.stringify(await downloadCorpus(manifest,'data/images')));
const api=await createClient();
let localModels={};
try {localModels=Object.fromEntries((await readFile('.env','utf8')).split(/\r?\n/).filter(line=>/^(VISION_MODEL|EMBEDDING_MODEL)=/.test(line)).map(line=>{const at=line.indexOf('=');return [line.slice(0,at),line.slice(at+1)];}));}catch(error){if(error.code!=='ENOENT')throw error;}
const revision=pipelineRevision({visionModel:process.env.VISION_MODEL??localModels.VISION_MODEL??'qwen3-vl:2b-instruct',embeddingModel:process.env.EMBEDDING_MODEL??localModels.EMBEDDING_MODEL??'embeddinggemma:300m'});
const corpusHash=hash(JSON.stringify(manifest.map(v=>({id:v.id,sha256:v.sha256}))));
const batch=await api('/images/batches',{method:'POST',idempotency:`corpus-${hash(corpusHash+revision)}`,body:{imageIds:manifest.map(v=>v.id)}});
const posts={};
for(const split of ['calibration','evaluation']) {
  const dataset=JSON.parse(await readFile(`data/${split}.json`,'utf8'));
  for(const sample of [...dataset.positives,...dataset.negatives]) {
    const payload={title:sample.title,content:sample.content};
    posts[`${split}:${sample.id}`]=await api('/posts',{method:'POST',body:payload,idempotency:`seed-${split}-${sample.id}-${hash(JSON.stringify(payload))}`});
  }
}
for(const sample of JSON.parse(await readFile('data/demo-posts.json','utf8'))) {
  const payload={title:sample.title,content:sample.content};
  posts[`demo:${sample.id}`]=await api('/posts',{method:'POST',body:payload,idempotency:`seed-demo-${sample.id}-${hash(JSON.stringify(payload))}`});
}
for(const [id,result] of Object.entries(posts))if(result.pipelineRevision!==revision)posts[id]=await api(`/posts/${result.postId}/process`,{method:'POST',body:{},idempotency:`process-${hash(result.postId+revision)}`});
await mkdir('.local',{recursive:true});
await writeFile('.local/seed.json',JSON.stringify({corpusHash,images:batch.jobs,posts},null,2)+'\n');
console.log(JSON.stringify({queuedImages:batch.jobs.length,queuedPosts:Object.keys(posts).length,promptVersion:PROMPT_VERSION,embeddingProfile:EMBEDDING_PROFILE,progress:'GET /jobs/:id; results become available as the local worker processes them'}));
