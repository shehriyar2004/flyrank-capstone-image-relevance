import { readConfig } from '../config.mjs';
import { createApp } from './app.mjs';
import { readFile } from 'node:fs/promises';
import { createPool } from '../data/db.mjs';
import { migrate } from '../data/migrate.mjs';
import { createRepository } from '../data/repository.mjs';
import { createQueue } from '../jobs/queue.mjs';
import { createCatalog } from '../services/catalog.mjs';
import { createReviews } from '../services/reviews.mjs';
import { createRoutes } from './routes.mjs';
import {resolveModelIdentity} from '../ai/ollama.mjs';

try {
  const config = readConfig(process.env);
  const pool=createPool(config.databaseUrl);await migrate(pool);
  const repo=createRepository(pool);
  await repo.addTenant({id:'11111111-1111-4111-8111-111111111111',name:'Demo A',key:config.tenantAKey,callBudget:config.callBudget});
  await repo.addTenant({id:'22222222-2222-4222-8222-222222222222',name:'Demo B',key:config.tenantBKey,callBudget:config.callBudget});
  const manifest=JSON.parse(await readFile('data/corpus.json','utf8')),matching=JSON.parse(await readFile('config/matching.json','utf8'));
  const catalog=createCatalog({pool,repo,queue:createQueue(pool),config,manifest,matching,getEmbeddingIdentity:()=>resolveModelIdentity(config.ollamaUrl,config.embeddingModel)});
  const reviews=createReviews({pool,repo,catalog,matching});
  createApp({ config,routes:createRoutes({pool,repo,catalog,reviews}) }).listen(config.port, config.host, () => console.log(`Image relevance API listening on port ${config.port}`));
} catch {
  console.error('Startup failed: check local configuration and services.');
  process.exitCode = 1;
}
