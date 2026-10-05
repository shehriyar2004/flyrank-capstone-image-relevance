import { createHash } from 'node:crypto';
import { transaction } from './db.mjs';

export const hash = value => createHash('sha256').update(value).digest('hex');
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
export const httpError = (status, message) => Object.assign(new Error(message), { status });

export function createRepository(pool) {
  const one = async (sql, values, client = pool) => (await client.query(sql, values)).rows[0] ?? null;
  return {
    async addTenant({ id, name, key, callBudget }) {
      return one('INSERT INTO tenants(id,name,key_hash,call_budget) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO UPDATE SET key_hash=excluded.key_hash,call_budget=excluded.call_budget RETURNING id', [id, name, hash(key), callBudget]);
    },
    async authenticate(key) { return (await one('SELECT id FROM tenants WHERE key_hash=$1', [hash(key)]))?.id ?? null; },
    async createImage(tenantId, image, client = pool) {
      await client.query('INSERT INTO images(tenant_id,manifest_id,sha256,file_path) VALUES($1,$2,$3,$4) ON CONFLICT(tenant_id,manifest_id) DO NOTHING', [tenantId, image.manifestId, image.sha256, image.filePath]);
      const row = await one('SELECT * FROM images WHERE tenant_id=$1 AND manifest_id=$2', [tenantId, image.manifestId], client);
      if (row.sha256.trim() !== image.sha256) throw httpError(409, 'Manifest content changed');
      return row;
    },
    createPost(tenantId, post, client = pool) { return one('INSERT INTO posts(tenant_id,title,content) VALUES($1,$2,$3) RETURNING *', [tenantId, post.title, post.content], client); },
    getImage(tenantId, id, client = pool) { return one('SELECT i.*,t.metadata,t.model FROM images i LEFT JOIN image_tags t ON t.tenant_id=i.tenant_id AND t.image_id=i.id AND t.version=i.metadata_version WHERE i.tenant_id=$1 AND i.id=$2', [tenantId, id], client); },
    getPost(tenantId, id, client = pool) { return one('SELECT * FROM posts WHERE tenant_id=$1 AND id=$2', [tenantId, id], client); },
    getJob(tenantId, id) { return one('SELECT id,kind,entity_id,status,attempts,progress,result,error_code,created_at,updated_at FROM jobs WHERE tenant_id=$1 AND id=$2', [tenantId, id]); },
    async listImages(tenantId, limit = 50, offset = 0) { return (await pool.query('SELECT i.*,t.metadata FROM images i LEFT JOIN image_tags t ON t.tenant_id=i.tenant_id AND t.image_id=i.id AND t.version=i.metadata_version WHERE i.tenant_id=$1 ORDER BY i.created_at,i.id LIMIT $2 OFFSET $3', [tenantId, limit, offset])).rows; },
    async idempotent(tenantId, operation, key, payload, action) {
      return transaction(pool, async client => {
        const payloadHash = hash(JSON.stringify(canonical(payload)));
        await client.query('INSERT INTO idempotency(tenant_id,operation,key,payload_hash) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING', [tenantId, operation, key, payloadHash]);
        const row = await one('SELECT * FROM idempotency WHERE tenant_id=$1 AND operation=$2 AND key=$3 FOR UPDATE', [tenantId, operation, key], client);
        if (row.payload_hash.trim() !== payloadHash) throw httpError(409, 'Idempotency key reused with different payload');
        if (row.response_status !== null) return { status: row.response_status, body: row.response_body };
        const response = await action(client);
        await client.query('UPDATE idempotency SET response_status=$4,response_body=$5 WHERE tenant_id=$1 AND operation=$2 AND key=$3', [tenantId, operation, key, response.status, JSON.stringify(response.body)]);
        return response;
      });
    },
  };
}
