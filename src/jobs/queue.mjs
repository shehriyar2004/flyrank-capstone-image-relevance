import { transaction } from '../data/db.mjs';

export function createQueue(pool) {
  async function alertFailed(client, row) {
    await client.query("INSERT INTO alerts(tenant_id,job_id,kind,message) VALUES($1,$2,'job_failed','Processing failed after three attempts; inspect job error code.') ON CONFLICT DO NOTHING", [row.tenant_id, row.id]);
    const table = row.kind === 'image' ? 'images' : 'posts';
    await client.query(`UPDATE ${table} SET status='failed' WHERE tenant_id=$1 AND id=$2`, [row.tenant_id, row.entity_id]);
  }
  return {
    async enqueue(tenantId, kind, entityId, version, client = pool) {
      if (!['image', 'post'].includes(kind)) throw new Error('Unsupported job kind');
      const row = (await client.query('INSERT INTO jobs(tenant_id,kind,image_id,post_id,version) VALUES($1,$2,$3,$4,$5) ON CONFLICT(tenant_id,kind,entity_id,version) DO UPDATE SET version=excluded.version RETURNING *', [tenantId, kind, kind === 'image' ? entityId : null, kind === 'post' ? entityId : null, version])).rows[0];
      return row;
    },
    async claim(workerId) {
      return transaction(pool, async client => {
        const exhausted = await client.query("UPDATE jobs SET status='failed',error_code='LEASE_EXHAUSTED',lease_token=NULL,lease_until=NULL,updated_at=now() WHERE status='running' AND lease_until<now() AND attempts>=3 RETURNING *");
        for (const row of exhausted.rows) await alertFailed(client, row);
        await client.query("UPDATE jobs SET status='pending',lease_token=NULL,lease_until=NULL,available_at=now(),updated_at=now() WHERE status='running' AND lease_until<now() AND attempts<3");
        return (await client.query("WITH picked AS (SELECT id FROM jobs WHERE status='pending' AND available_at<=now() AND attempts<3 ORDER BY created_at,id FOR UPDATE SKIP LOCKED LIMIT 1) UPDATE jobs j SET status='running',attempts=attempts+1,worker_id=$1,lease_token=gen_random_uuid(),lease_until=now()+interval '60 seconds',updated_at=now() FROM picked WHERE j.id=picked.id RETURNING j.*", [workerId])).rows[0] ?? null;
      });
    },
    async heartbeat(jobId, leaseToken) { return (await pool.query("UPDATE jobs SET lease_until=now()+interval '60 seconds',updated_at=now() WHERE id=$1 AND lease_token=$2 AND status='running' AND lease_until>now()", [jobId, leaseToken])).rowCount === 1; },
    async withLease(job, action) {
      return transaction(pool, async client => {
        const row = await client.query("SELECT id FROM jobs WHERE tenant_id=$1 AND id=$2 AND lease_token=$3 AND status='running' AND lease_until>now() FOR UPDATE", [job.tenant_id, job.id, job.lease_token]);
        if (!row.rowCount) throw Object.assign(new Error('Worker lease lost'), { code: 'LEASE_LOST' });
        return action(client);
      });
    },
    async finish(job, result) { return (await pool.query("UPDATE jobs SET status='succeeded',progress=100,result=$4,lease_token=NULL,lease_until=NULL,updated_at=now() WHERE tenant_id=$1 AND id=$2 AND lease_token=$3 AND status='running' AND lease_until>now()", [job.tenant_id, job.id, job.lease_token, JSON.stringify(result)])).rowCount === 1; },
    async fail(job, error) {
      return transaction(pool, async client => {
        const code = ['INVALID_MODEL_OUTPUT','PROVIDER_TIMEOUT','PROVIDER_UNAVAILABLE','BUDGET_EXHAUSTED','LEASE_LOST','INVALID_IMAGE','LEASE_EXHAUSTED'].includes(error.code) ? error.code : 'INFERENCE_FAILED';
        const row = (await client.query("UPDATE jobs SET status=CASE WHEN attempts>=3 THEN 'failed' ELSE 'pending' END,available_at=now()+make_interval(secs=>power(2,attempts)::int),error_code=$4,lease_token=NULL,lease_until=NULL,updated_at=now() WHERE tenant_id=$1 AND id=$2 AND lease_token=$3 AND status='running' AND lease_until>now() RETURNING *", [job.tenant_id, job.id, job.lease_token, code])).rows[0];
        if (row?.status === 'failed') await alertFailed(client, row);
        return Boolean(row);
      });
    },
  };
}
