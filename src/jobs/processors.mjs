import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { hash } from '../data/repository.mjs';
import { parseVision, parseIntent, flagged, validateVector } from '../ai/schemas.mjs';
import { PROMPT_VERSION } from '../ai/ollama.mjs';
import {embeddingText} from '../ai/embedding-input.mjs';

export function createProcessor({ pool, repo, queue, provider, config, readImage }) {
  const loadImage = readImage ?? (async image => {
    const root = resolve('data/images');
    const path = resolve(root, image.file_path);
    if (!path.startsWith(root+sep)) throw Object.assign(new Error('Unsafe image path'), { code: 'INVALID_IMAGE' });
    const bytes = await readFile(path);
    if (bytes.length > 5*1024*1024 || hash(bytes) !== image.sha256.trim()) throw Object.assign(new Error('Image hash mismatch'), { code: 'INVALID_IMAGE' });
    return bytes;
  });
  return {
    async processJob(job) {
      const context = { tenantId: job.tenant_id, jobId: job.id, entityId: job.entity_id, attempt: job.attempts };
      const visionIdentity=await provider.modelIdentity?.(config.visionModel)??config.visionModel;
      const embeddingIdentity=await provider.modelIdentity?.(config.embeddingModel)??config.embeddingModel;
      Object.assign(context,{visionIdentity,embeddingIdentity});
      const imageJob = job.kind === 'image';
      let entity = imageJob ? await repo.getImage(job.tenant_id, job.entity_id) : await repo.getPost(job.tenant_id, job.entity_id);
      const version = hash(`${PROMPT_VERSION}:${visionIdentity}:${imageJob ? entity.sha256 : entity.title+'\n'+entity.content}`);
      let metadata = imageJob ? entity.metadata : entity.intent;
      if ((imageJob ? entity.metadata_version : entity.intent_version) !== version) {
        const output=imageJob ? await provider.classifyImage(await loadImage(entity),context) : await provider.analyzePost(`${entity.title}\n${entity.content}`,context);
        metadata=imageJob?parseVision(output):parseIntent(output);
        await queue.withLease(job, async client => {
          if (imageJob) {
            await client.query('INSERT INTO image_tags(tenant_id,image_id,version,model,metadata,raw_response) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING', [job.tenant_id, entity.id, version, visionIdentity, JSON.stringify(metadata), output.rawResponse??JSON.stringify(metadata)]);
            await client.query("UPDATE images SET metadata_version=$3,status=$4 WHERE tenant_id=$1 AND id=$2", [job.tenant_id, entity.id, version, flagged(metadata) ? 'flagged' : 'pending']);
          } else await client.query('UPDATE posts SET intent=$3,intent_version=$4,status=$5,intent_model=$6 WHERE tenant_id=$1 AND id=$2', [job.tenant_id, entity.id, JSON.stringify(metadata), version, flagged(metadata) ? 'flagged' : 'pending',visionIdentity]);
          await client.query('UPDATE jobs SET progress=50 WHERE id=$1', [job.id]);
        });
      }
      const text = imageJob ? metadata.caption : `${entity.title}\n${entity.content}`;
      const inputHash = hash(embeddingText(text));
      const column = imageJob ? 'image_id' : 'post_id';
      const existing = await pool.query(`SELECT id FROM embeddings WHERE tenant_id=$1 AND ${column}=$2 AND model=$3 AND input_hash=$4`, [job.tenant_id, entity.id, embeddingIdentity, inputHash]);
      if (!existing.rowCount) {
        const vector = await provider.embed(text, context);
        validateVector(vector.values);
        if (vector.model !== embeddingIdentity || vector.dimensions !== vector.values.length || vector.inputHash !== inputHash) throw Object.assign(new Error('Incompatible embedding output'), { code: 'INVALID_MODEL_OUTPUT' });
        await queue.withLease(job, client => client.query('INSERT INTO embeddings(tenant_id,image_id,post_id,model,dimensions,vector,input_hash) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING', [job.tenant_id, imageJob ? entity.id : null, imageJob ? null : entity.id, vector.model, vector.dimensions, vector.values, vector.inputHash]));
      }
      await queue.withLease(job, client => client.query(`UPDATE ${imageJob ? 'images' : 'posts'} SET status=$3 WHERE tenant_id=$1 AND id=$2`, [job.tenant_id, entity.id, flagged(metadata) ? 'flagged' : 'ready']));
      if (!await queue.finish(job, { processed: 1, flagged: flagged(metadata) })) throw Object.assign(new Error('Worker lease lost'), { code: 'LEASE_LOST' });
    },
  };
}
