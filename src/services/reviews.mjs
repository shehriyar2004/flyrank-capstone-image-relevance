import { transaction } from '../data/db.mjs';
import { httpError } from '../data/repository.mjs';

export function createReviews({ pool, repo, catalog, matching }) {
  return {
    async reviewSuggestion(tenantId,suggestionId,decision,client) {
      const action=async database=>{
        const suggestion=(await database.query('SELECT * FROM suggestions WHERE tenant_id=$1 AND id=$2 FOR UPDATE',[tenantId,suggestionId])).rows[0];
        if(!suggestion)throw httpError(404,'Suggestion not found');
        if(suggestion.status!=='pending')throw httpError(409,'Suggestion already reviewed');
        if(decision.action==='approve') {
          await database.query('SELECT id FROM posts WHERE tenant_id=$1 AND id=$2 FOR UPDATE',[tenantId,suggestion.post_id]);
          await database.query('SELECT id FROM images WHERE tenant_id=$1 AND id=$2 FOR UPDATE',[tenantId,suggestion.image_id]);
          const post=await repo.getPost(tenantId,suggestion.post_id,database), image=await repo.getImage(tenantId,suggestion.image_id,database);
          if(post.intent_version!==suggestion.post_version || image.metadata_version!==suggestion.image_version || matching.version!==suggestion.threshold_version)throw httpError(409,'Suggestion metadata or threshold changed');
          const current=await catalog.check(tenantId,suggestion.post_id,suggestion.image_id);
          if(!current.accepted)throw httpError(409,'Candidate no longer clears the mismatch guard');
        }
        const result=(await database.query('INSERT INTO reviews(tenant_id,suggestion_id,action,explanation) VALUES($1,$2,$3,$4) RETURNING id,action,explanation,created_at',[tenantId,suggestionId,decision.action,decision.explanation??null])).rows[0];
        await database.query('UPDATE suggestions SET status=$3 WHERE tenant_id=$1 AND id=$2',[tenantId,suggestionId,decision.action==='approve'?'approved':'rejected']);
        return result;
      };
      return client?action(client):transaction(pool,action);
    },
  };
}
