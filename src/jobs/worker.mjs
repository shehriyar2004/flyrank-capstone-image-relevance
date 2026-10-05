import { randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import { readConfig } from '../config.mjs';
import { createPool } from '../data/db.mjs';
import { migrate } from '../data/migrate.mjs';
import { createRepository } from '../data/repository.mjs';
import { createAccounting } from '../ai/accounting.mjs';
import { createOllama } from '../ai/ollama.mjs';
import { createQueue } from './queue.mjs';
import { createProcessor } from './processors.mjs';

const config = readConfig(process.env), pool = createPool(config.databaseUrl);
await migrate(pool);
const repo = createRepository(pool), queue = createQueue(pool);
const processor = createProcessor({ pool, repo, queue, config, provider: createOllama({ config, accounting: createAccounting(pool) }) });
const workerId = randomUUID();
let stopping = false;
process.on('SIGTERM', () => { stopping = true; });
process.on('SIGINT', () => { stopping = true; });
console.log('Local inference worker ready');
while (!stopping) {
  const job = await queue.claim(workerId);
  if (!job) { await sleep(1000); continue; }
  const heartbeat = setInterval(() => queue.heartbeat(job.id, job.lease_token).catch(() => {}), 15000);
  try { await processor.processJob(job); console.log(JSON.stringify({ jobId: job.id, status: 'succeeded' })); }
  catch (error) { await queue.fail(job, error); console.log(JSON.stringify({ jobId: job.id, status: 'attempt_failed', code: error.code ?? 'INFERENCE_FAILED' })); }
  finally { clearInterval(heartbeat); }
}
await pool.end();
