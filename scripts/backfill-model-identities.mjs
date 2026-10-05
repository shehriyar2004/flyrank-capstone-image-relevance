// One-time migration of this demo's pre-review records. Never infer an unknown revision.
import {readFile} from 'node:fs/promises';
import {readConfig} from '../src/config.mjs';
import {createPool,transaction} from '../src/data/db.mjs';
import {resolveModelIdentity} from '../src/ai/ollama.mjs';
import {migrate} from '../src/data/migrate.mjs';

const config=readConfig(process.env),pool=createPool(config.databaseUrl),tenant='11111111-1111-4111-8111-111111111111';
await migrate(pool);
const recorded=JSON.parse(await readFile('evidence/model-smoke.json','utf8')).models;
for(const model of recorded) {
  if(!/^[a-f0-9]{64}$/.test(model.digest))throw new Error('Recorded digest missing');
  const identity=await resolveModelIdentity(config.ollamaUrl,model.name);
  if(identity!==`${model.name}@${model.digest}`)throw new Error('Recorded/current model digests differ; no backfill is safe');
  await transaction(pool,async client=>{
    await client.query('UPDATE image_tags SET model=$3 WHERE tenant_id=$1 AND model=$2',[tenant,model.name,identity]);
    await client.query('UPDATE ai_calls SET model=$3 WHERE tenant_id=$1 AND model=$2',[tenant,model.name,identity]);
    await client.query('UPDATE embeddings e SET model=$3 WHERE tenant_id=$1 AND model=$2 AND NOT EXISTS(SELECT 1 FROM embeddings newer WHERE newer.tenant_id=e.tenant_id AND newer.image_id IS NOT DISTINCT FROM e.image_id AND newer.post_id IS NOT DISTINCT FROM e.post_id AND newer.model=$3 AND newer.input_hash=e.input_hash)',[tenant,model.name,identity]);
  });
}
console.log('Demo pre-review records linked to their independently recorded, unchanged model digests.');
await pool.end();
