import test from 'node:test';
import assert from 'node:assert/strict';
import {apiFixture} from './api-fixture.mjs';
import {hash} from '../../src/data/repository.mjs';

test('review_rechecks_metadata_and_is_terminal_and_idempotent',async()=>{
  const f=await apiFixture();
  try {
    const metadata={subject:'red fox',category:'animal',confidence:0.95,attributes:['red fur'],caption:'A fox among trees.'};
    await f.pool.query("UPDATE images SET metadata_version='i',status='ready' WHERE id=$1",[f.image.id]);
    await f.pool.query("INSERT INTO image_tags(tenant_id,image_id,version,model,metadata,raw_response) VALUES($1,$2,'i','fixture',$3,$4)",[f.a,f.image.id,JSON.stringify(metadata),JSON.stringify(metadata)]);
    await f.pool.query("UPDATE posts SET status='ready',intent_version='p',intent=$2 WHERE id=$1",[f.post.id,JSON.stringify({subject:'fox',category:'animal',confidence:0.95,ambiguous:false})]);
    for(const owner of ['image','post'])await f.pool.query('INSERT INTO embeddings(tenant_id,image_id,post_id,model,dimensions,vector,input_hash) VALUES($1,$2,$3,\'fixture\',2,\'{1,0}\',$4)',[f.a,owner==='image'?f.image.id:null,owner==='post'?f.post.id:null,hash('task: sentence similarity | query: '+(owner==='image'?metadata.caption:`Subject: fox\n${f.post.title}\n${f.post.content}`))]);
    const result=await f.catalog.recommend(f.a,f.post.id);
    assert.equal(result.status,'matched'); const suggestion=result.suggestions[0].suggestionId;
    assert.equal((await f.catalog.check(f.a,f.post.id,f.image.id)).subjectAccepted,true);
    assert.equal((await f.api(`/suggestions/${suggestion}/reviews`,{method:'POST',key:'test-key-b',body:{action:'approve'}})).status,404);
    await f.pool.query("UPDATE images SET status='flagged' WHERE id=$1",[f.image.id]);
    assert.equal((await f.api(`/suggestions/${suggestion}/reviews`,{method:'POST',body:{action:'approve'}})).status,409);
    await f.pool.query("UPDATE images SET status='ready' WHERE id=$1",[f.image.id]);
    const approved=await f.api(`/suggestions/${suggestion}/reviews`,{method:'POST',body:{action:'approve'}});
    assert.equal(approved.status,200); const decision=await approved.json();
    assert.deepEqual(await (await f.api(`/suggestions/${suggestion}/reviews`,{method:'POST',body:{action:'approve'}})).json(),decision);
    assert.equal((await f.api(`/suggestions/${suggestion}/reviews`,{method:'POST',idempotency:'different-key',body:{action:'reject'}})).status,409);
    assert.equal(Number((await f.pool.query('SELECT count(*) FROM reviews')).rows[0].count),1);
  } finally {await f.close();}
});
