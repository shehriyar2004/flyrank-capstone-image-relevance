import test from 'node:test';
import assert from 'node:assert/strict';
import {apiFixture} from './api-fixture.mjs';
import {hash} from '../../src/data/repository.mjs';

async function readyFixture() {
  const f=await apiFixture();
  const metadata={subject:'fox',category:'animal',confidence:0.95,attributes:['orange fur'],caption:'A fox in woodland.'};
  await f.pool.query("UPDATE images SET metadata_version='i',status='ready' WHERE id=$1",[f.image.id]);
  await f.pool.query("INSERT INTO image_tags(tenant_id,image_id,version,model,metadata,raw_response) VALUES($1,$2,'i','fixture',$3,$4)",[f.a,f.image.id,JSON.stringify(metadata),JSON.stringify(metadata)]);
  await f.pool.query("UPDATE posts SET status='ready',intent_version='p',intent=$2 WHERE id=$1",[f.post.id,JSON.stringify({subject:'fox',category:'animal',confidence:0.95,ambiguous:false})]);
  for(const owner of ['image','post'])await f.pool.query('INSERT INTO embeddings(tenant_id,image_id,post_id,model,dimensions,vector,input_hash) VALUES($1,$2,$3,\'fixture\',2,\'{1,0}\',$4)',[f.a,owner==='image'?f.image.id:null,owner==='post'?f.post.id:null,hash(owner==='image'?metadata.caption:`${f.post.title}\n${f.post.content}`)]);
  return f;
}
test('failed_post_never_matches_or_passes_approval_even_with_old_vectors',async()=>{
  const f=await readyFixture();
  try {
    const suggestion=(await f.catalog.recommend(f.a,f.post.id)).suggestions[0];
    await f.pool.query("UPDATE posts SET status='failed' WHERE id=$1",[f.post.id]);
    assert.equal((await f.catalog.recommend(f.a,f.post.id)).status,'no confident match');
    assert.equal((await f.catalog.check(f.a,f.post.id,f.image.id)).accepted,false);
    assert.equal((await f.api(`/suggestions/${suggestion.suggestionId}/reviews`,{method:'POST',body:{action:'approve'}})).status,409);
  } finally {await f.close();}
});
test('approval_survives_a_saturated_pool_by_using_its_held_transaction',async()=>{
  const f=await readyFixture();
  try {
    const {createReviews}=await import('../../src/services/reviews.mjs');
    const suggestion=(await f.catalog.recommend(f.a,f.post.id)).suggestions[0];
    // Hold every pool connection, then exercise the production review with a supplied transaction.
    const clients=await Promise.all(Array.from({length:10},()=>f.pool.connect()));
    let race,outcome;
    try {
      await clients[0].query('BEGIN');
      const reviews=createReviews({pool:f.pool,repo:f.repo,catalog:f.catalog,matching:{threshold:0.5,version:'fixture'}});
      outcome=reviews.reviewSuggestion(f.a,suggestion.suggestionId,{action:'approve'},clients[0]);
      race=await Promise.race([outcome,new Promise(resolve=>setTimeout(()=>resolve('starved'),500))]);
    } finally {
      for(const client of clients.slice(1))client.release();
      try {await outcome;}finally{await clients[0].query('ROLLBACK');clients[0].release();}
    }
    assert.notEqual(race,'starved');
  } finally {await f.close();}
});

test('embedding_changes_create_distinct_suggestions_and_block_old_approval',async()=>{
  const f=await readyFixture();
  try {
    const old=(await f.catalog.recommend(f.a,f.post.id)).suggestions[0];
    await f.pool.query("UPDATE embeddings SET vector='{0.8,0.6}' WHERE image_id=$1",[f.image.id]);
    const fresh=(await f.catalog.recommend(f.a,f.post.id)).suggestions[0];
    assert.notEqual(fresh.suggestionId,old.suggestionId);
    assert.equal((await f.api(`/suggestions/${old.suggestionId}/reviews`,{method:'POST',body:{action:'approve'}})).status,409);
    const oldSnapshot=(await f.pool.query('SELECT snapshot,score FROM suggestions WHERE id=$1',[old.suggestionId])).rows[0];
    assert.equal(oldSnapshot.snapshot.score,oldSnapshot.score);
    assert.equal(oldSnapshot.score,1);
  }finally{await f.close();}
});

test('concurrent_forced_checks_do_not_acquire_extra_pool_connections',async()=>{
  const f=await readyFixture();
  try {
    f.pool.options.connectionTimeoutMillis=250;
    const original=f.repo.idempotent;let entered=0,release;
    const gate=new Promise(resolve=>{release=resolve;});
    f.repo.idempotent=(tenant,operation,key,payload,action)=>original(tenant,operation,key,payload,async client=>{
      if(++entered===10)release();await gate;return action(client);
    });
    const responses=await Promise.all(Array.from({length:10},(_,index)=>f.api(`/posts/${f.post.id}/images/check`,{method:'POST',body:{imageId:f.image.id},idempotency:`concurrent-check-${index}`})));
    assert.deepEqual(responses.map(response=>response.status),Array(10).fill(200));
  }finally{await f.close();}
});
