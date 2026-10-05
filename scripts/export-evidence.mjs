import {mkdir,writeFile} from 'node:fs/promises';
import {readConfig} from '../src/config.mjs';
import {createPool} from '../src/data/db.mjs';
import {embeddingText} from '../src/ai/embedding-input.mjs';
import {hash} from '../src/data/repository.mjs';

const config=readConfig(process.env),pool=createPool(config.databaseUrl),tenant='11111111-1111-4111-8111-111111111111';
const images=(await pool.query('SELECT i.manifest_id,i.id,i.status,t.metadata,t.raw_response,t.version,t.model FROM images i JOIN image_tags t ON t.tenant_id=i.tenant_id AND t.image_id=i.id AND t.version=i.metadata_version WHERE i.tenant_id=$1 ORDER BY i.created_at,i.id',[tenant])).rows;
const calls=(await pool.query('SELECT id,tenant_id,job_id,entity_id,operation,model,attempt,status,input_tokens,output_tokens,duration_ms,cost_usd,error_code,created_at FROM ai_calls WHERE tenant_id=$1 ORDER BY created_at',[tenant])).rows;
const models=(await(await fetch(`${config.ollamaUrl}/api/tags`)).json()).models.map(v=>({name:v.name,digest:v.digest,size:v.size}));
const embeddingIdentity=`${config.embeddingModel}@${models.find(model=>model.name===config.embeddingModel).digest}`;
const vectors=(await pool.query('SELECT image_id,dimensions,model,input_hash FROM embeddings WHERE tenant_id=$1 AND image_id IS NOT NULL AND model=$2',[tenant,embeddingIdentity])).rows;
for(const image of images){const vector=vectors.find(vector=>vector.image_id===image.id&&vector.input_hash.trim()===hash(embeddingText(image.metadata.caption)));Object.assign(image,{dimensions:vector?.dimensions??null,embedding_model:vector?.model??null,input_hash:vector?.input_hash??null});}
await mkdir('evidence',{recursive:true});
await writeFile('evidence/model-smoke.json',JSON.stringify({images:images.slice(0,1),models,calls:calls.filter(c=>c.entity_id===images[0]?.id)},null,2)+'\n');
await writeFile('evidence/corpus-results.json',JSON.stringify({count:images.length,images},null,2)+'\n');
await writeFile('evidence/calls.json',JSON.stringify({provider:'local Ollama; actual inference attempts, including initial smoke failures',costUsd:0,models,calls},null,2)+'\n');
console.log(JSON.stringify({tagged:images.length,calls:calls.length,completedCalls:calls.filter(c=>c.status==='succeeded').length,flagged:images.filter(i=>i.status==='flagged').length,models:models.map(m=>m.name)}));
await pool.end();
