import { validateVector } from '../ai/schemas.mjs';

export function cosine(a,b) {
  validateVector(a); validateVector(b);
  if (a.length !== b.length) throw new Error('Embedding dimensions differ');
  const dot = a.reduce((sum,v,i)=>sum+v*b[i],0);
  const denominator = Math.hypot(...a)*Math.hypot(...b);
  const result = dot/denominator;
  if (!Number.isFinite(result)) throw new Error('Invalid embedding similarity');
  return Math.max(-1,Math.min(1,result));
}
export function rankCandidates(postVector, candidates) {
  return candidates.flatMap(candidate => {
    try {
      if (candidate.vector.model !== postVector.model || candidate.vector.dimensions !== postVector.dimensions) return [];
      return [{ ...candidate, similarity: cosine(postVector.values,candidate.vector.values) }];
    } catch { return []; }
  }).sort((a,b)=>b.similarity-a.similarity||a.id.localeCompare(b.id));
}
