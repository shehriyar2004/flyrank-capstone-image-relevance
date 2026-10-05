import express from 'express';
import { z } from 'zod';
import { httpError } from '../data/repository.mjs';

const uuid=z.string().uuid();
const post=z.strictObject({title:z.string().trim().min(1).max(200),content:z.string().trim().min(1).max(4000)});
const batch=z.strictObject({imageIds:z.array(z.string().regex(/^[A-Za-z0-9_-]{1,80}$/)).min(1).max(50).refine(ids=>new Set(ids).size===ids.length)});
const review=z.strictObject({action:z.enum(['approve','reject']),explanation:z.string().trim().max(1000).optional()});
const pagination=z.object({limit:z.coerce.number().int().min(1).max(100).default(50),offset:z.coerce.number().int().min(0).max(100000).default(0)});
export function createRoutes({pool,repo,catalog,reviews}) {
  const routes=express.Router();
  routes.use(async(request,_response,next)=>{
    try {const key=request.get('X-Tenant-Key');if(!key||key.length>256)throw httpError(401,'Tenant key required');const tenant=await repo.authenticate(key);if(!tenant)throw httpError(401,'Invalid tenant key');request.tenantId=tenant;next();}catch(error){next(error);}
  });
  const mutation=(operation,schema,handler)=>async(request,response)=>{
    const payload=schema.parse(request.body),key=z.string().min(1).max(128).regex(/^[A-Za-z0-9_.:-]+$/).parse(request.get('Idempotency-Key'));
    const result=await repo.idempotent(request.tenantId,`${operation}:${request.params.id??''}`,key,payload,client=>handler(request,payload,client));
    response.status(result.status).json(result.body);
  };
  routes.post('/images/batches',mutation('batch',batch,(req,payload,client)=>catalog.batch(req.tenantId,payload.imageIds,client)));
  routes.get('/images',async(req,res)=>{const {limit,offset}=pagination.parse(req.query);res.json({images:await repo.listImages(req.tenantId,limit,offset)});});
  routes.get('/images/:id',async(req,res)=>{const image=await repo.getImage(req.tenantId,uuid.parse(req.params.id));if(!image)throw httpError(404,'Image not found');res.json(image);});
  routes.post('/posts',mutation('post',post,(req,payload,client)=>catalog.createPost(req.tenantId,payload,client)));
  routes.post('/posts/:id/process',mutation('post-process',z.strictObject({}),async(req,_payload,client)=>catalog.processPost(req.tenantId,uuid.parse(req.params.id),req.get('Idempotency-Key'),client)));
  routes.get('/posts/:id/images',async(req,res)=>{const id=uuid.parse(req.params.id);const {limit}=pagination.parse(req.query);res.json(await catalog.recommend(req.tenantId,id,limit));});
  routes.post('/posts/:id/images/check',mutation('check',z.strictObject({imageId:uuid}),async(req,payload,client)=>({status:200,body:await catalog.check(req.tenantId,uuid.parse(req.params.id),payload.imageId,client)})));
  routes.post('/suggestions/:id/reviews',mutation('review',review,async(req,payload,client)=>({status:200,body:await reviews.reviewSuggestion(req.tenantId,uuid.parse(req.params.id),payload,client)})));
  routes.get('/suggestions/:id',async(req,res)=>{const row=(await pool.query('SELECT id,post_id,image_id,score,snapshot,status FROM suggestions WHERE tenant_id=$1 AND id=$2',[req.tenantId,uuid.parse(req.params.id)])).rows[0];if(!row)throw httpError(404,'Suggestion not found');res.json(row);});
  routes.get('/jobs/:id',async(req,res)=>{const row=await repo.getJob(req.tenantId,uuid.parse(req.params.id));if(!row)throw httpError(404,'Job not found');res.json(row);});
  routes.get('/costs',async(req,res)=>{const {limit,offset}=pagination.parse(req.query);const rows=(await pool.query('SELECT id,job_id,entity_id,operation,model,provider,attempt,status,input_tokens,output_tokens,duration_ms,cost_usd,error_code,created_at FROM ai_calls WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',[req.tenantId,limit,offset])).rows;const budget=(await pool.query('SELECT call_budget,reserved_calls FROM tenants WHERE id=$1',[req.tenantId])).rows[0];res.json({provider:'local Ollama',monetaryCostUsd:0,budget,calls:rows});});
  routes.get('/alerts',async(req,res)=>{const {limit,offset}=pagination.parse(req.query);res.json({alerts:(await pool.query('SELECT id,job_id,kind,message,created_at FROM alerts WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',[req.tenantId,limit,offset])).rows});});
  return routes;
}
