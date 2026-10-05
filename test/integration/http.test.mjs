import test from 'node:test';
import assert from 'node:assert/strict';
import { apiFixture } from './api-fixture.mjs';

test('API_validates_boundaries_and_enqueues_without_inference',async()=>{
  const f=await apiFixture();
  try {
    assert.equal((await f.api('/images',{key:''})).status,401);
    assert.equal((await f.api('/posts/not-a-uuid/images')).status,400);
    assert.equal((await f.api('/images?limit=-1')).status,400);
    assert.equal((await f.api(`/images/${f.image.id}`,{key:'test-key-b'})).status,404);
    assert.equal((await f.api('/posts',{method:'POST',body:{title:'',content:'x'}})).status,400);
    assert.equal((await f.api('/posts',{method:'POST',raw:'{bad-json'})).status,400);
    assert.equal((await f.api('/posts',{method:'POST',raw:'x'.repeat(70000)})).status,413);
    const first=await f.api('/posts',{method:'POST',body:{title:'New',content:'About red foxes.'}});
    assert.equal(first.status,202); const created=await first.json(); assert.ok(created.jobId);
    assert.equal((await f.api(`/posts/${created.postId}/images`)).status,200);
    assert.equal((await (await f.api(`/posts/${created.postId}/images`)).json()).status,'processing');
    const second=await f.api('/posts',{method:'POST',body:{title:'New',content:'About red foxes.'}});
    assert.deepEqual(await second.json(),created);
    assert.equal((await f.api('/posts',{method:'POST',body:{title:'Changed',content:'Different'}})).status,409);
    const batch=await f.api('/images/batches',{method:'POST',body:{imageIds:['sample-a']}});
    assert.equal(batch.status,202);
    assert.equal((await f.api(`/posts/${f.post.id}/images/check`,{method:'POST',key:'test-key-b',body:{imageId:f.image.id}})).status,404);
    assert.equal((await f.api(`/posts/${f.post.id}/process`,{method:'POST',key:'test-key-b',body:{}})).status,404);
    const processing=await f.api(`/posts/${f.post.id}/process`,{method:'POST',body:{}});
    assert.equal(processing.status,202);
    const repeated=await f.api(`/posts/${f.post.id}/process`,{method:'POST',body:{}});
    assert.deepEqual(await repeated.json(),await processing.json());
  } finally {await f.close();}
});
