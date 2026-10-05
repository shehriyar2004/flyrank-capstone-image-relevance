import { testDatabase, demoEntities } from './helpers.mjs';

export async function apiFixture() {
  const db=await testDatabase();
  const entities=await demoEntities(db.pool);
  const {createQueue}=await import('../../src/jobs/queue.mjs');
  const {createCatalog}=await import('../../src/services/catalog.mjs');
  const {createReviews}=await import('../../src/services/reviews.mjs');
  const {createRoutes}=await import('../../src/http/routes.mjs');
  const {createApp}=await import('../../src/http/app.mjs');
  const queue=createQueue(db.pool), matching={threshold:0.5,version:'fixture'};
  const manifest=[{id:'sample-a',sha256:'a'.repeat(64)}];
  const catalog=createCatalog({pool:db.pool,repo:entities.repo,queue,config:{embeddingModel:'fixture',visionModel:'fixture'},manifest,matching});
  const reviews=createReviews({pool:db.pool,repo:entities.repo,catalog,matching});
  const app=createApp({routes:createRoutes({pool:db.pool,repo:entities.repo,catalog,reviews})});
  const server=app.listen(0,'127.0.0.1'); await new Promise(r=>server.once('listening',r));
  const api=async(path,{key='test-key-a',method='GET',body,idempotency='example-key',raw}={})=>fetch(`http://127.0.0.1:${server.address().port}${path}`,{method,headers:{'X-Tenant-Key':key,'Content-Type':'application/json','Idempotency-Key':idempotency},body:raw??(body?JSON.stringify(body):undefined)});
  return {...db,...entities,api,catalog,close:async()=>{await new Promise(r=>server.close(r));await db.close();}};
}
