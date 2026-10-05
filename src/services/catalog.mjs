import { hash, httpError } from '../data/repository.mjs';
import { rankCandidates } from '../matching/rank.mjs';
import { guard } from '../matching/guard.mjs';
import { PROMPT_VERSION } from '../ai/ollama.mjs';

export function createCatalog({ pool, repo, queue, config, manifest, matching }) {
  const allowed = new Map(manifest.map(entry=>[entry.id,entry]));
  const version = PROMPT_VERSION;
  async function loadCandidates(tenantId, postId) {
    const post = await repo.getPost(tenantId,postId);
    if (!post) throw httpError(404,'Post not found');
    if (post.status === 'pending') return { post, ranked: [], processing: true };
    const postVector = (await pool.query('SELECT vector AS values,model,dimensions FROM embeddings WHERE tenant_id=$1 AND post_id=$2 AND model=$3 AND input_hash=$4', [tenantId,postId,config.embeddingModel,hash(`${post.title}\n${post.content}`)])).rows[0];
    if (!postVector) return { post, ranked: [] };
    const images = await repo.listImages(tenantId,100,0);
    const vectors = (await pool.query('SELECT image_id,input_hash,vector AS values,model,dimensions FROM embeddings WHERE tenant_id=$1 AND image_id IS NOT NULL AND model=$2', [tenantId,config.embeddingModel])).rows;
    const candidates = images.flatMap(image=> {
      const vector = vectors.find(v=>v.image_id===image.id && image.metadata && v.input_hash.trim()===hash(image.metadata.caption));
      return vector ? [{...image, vector}] : [];
    });
    return { post, ranked: rankCandidates(postVector,candidates) };
  }
  return {
    async batch(tenantId, ids, client) {
      const jobs = [];
      for (const id of ids) {
        const source = allowed.get(id); if (!source) throw httpError(400,'Unknown corpus image ID');
        const image = await repo.createImage(tenantId,{ manifestId:id, sha256:source.sha256, filePath:`${id}.jpg` },client);
        const job = await queue.enqueue(tenantId,'image',image.id,`${version}:${config.visionModel}:${config.embeddingModel}`,client);
        jobs.push({ imageId:image.id, jobId:job.id, manifestId:id });
      }
      return { status:202, body:{ jobs } };
    },
    async createPost(tenantId, payload, client) {
      const post = await repo.createPost(tenantId,payload,client);
      const job = await queue.enqueue(tenantId,'post',post.id,`${version}:${config.visionModel}:${config.embeddingModel}`,client);
      return { status:202, body:{ postId:post.id,jobId:job.id } };
    },
    loadCandidates,
    async recommend(tenantId,postId,limit=5) {
      const {post,ranked,processing} = await loadCandidates(tenantId,postId);
      if (processing) return { status:'processing', suggestions:[], rejections:[] };
      const suggestions=[],rejections=[];
      for (const candidate of ranked) {
        const decision=guard({ intent:post.intent,metadata:candidate.metadata,similarity:candidate.similarity,threshold:matching.threshold,eligible:candidate.status==='ready' });
        if (!decision.accepted) { rejections.push({ imageId:candidate.id,manifestId:candidate.manifest_id,score:candidate.similarity,reasons:decision.reasons });continue; }
        const snapshot={ intent:post.intent,metadata:candidate.metadata,decision,threshold:matching.threshold,embeddingModel:config.embeddingModel,score:candidate.similarity };
        const row=(await pool.query('INSERT INTO suggestions(tenant_id,post_id,image_id,score,snapshot,post_version,image_version,threshold_version) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(tenant_id,post_id,image_id,post_version,image_version,threshold_version) DO UPDATE SET score=excluded.score RETURNING id,status', [tenantId,postId,candidate.id,candidate.similarity,JSON.stringify(snapshot),post.intent_version,candidate.metadata_version,matching.version])).rows[0];
        if (row.status !== 'rejected') suggestions.push({ suggestionId:row.id,status:row.status,imageId:candidate.id,manifestId:candidate.manifest_id,score:candidate.similarity,subject:candidate.metadata.subject,caption:candidate.metadata.caption,reasons:decision.reasons });
      }
      return {status:suggestions.length?'matched':'no confident match',suggestions:suggestions.slice(0,limit),rejections,reasons:suggestions.length?[]:rejections.length?[...new Set(rejections.flatMap(r=>r.reasons))]:['No compatible image embeddings available']};
    },
    async check(tenantId,postId,imageId) {
      const image=await repo.getImage(tenantId,imageId); if(!image)throw httpError(404,'Image not found');
      const {post,ranked}=await loadCandidates(tenantId,postId);
      const score=ranked.find(r=>r.id===imageId)?.similarity ?? null;
      const input={intent:post.intent,metadata:image.metadata,similarity:score,threshold:matching.threshold,eligible:image.status==='ready'};
      return { imageId, score, subjectAccepted:guard({...input,similarity:1,threshold:0}).accepted, ...guard(input) };
    },
  };
}
