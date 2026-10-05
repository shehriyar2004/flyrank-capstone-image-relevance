import { transaction } from '../data/db.mjs';

export function createAccounting(pool) {
  return {
    async reserveCall(context, model) {
      const call = await transaction(pool, async client => {
        const tenant = await client.query('UPDATE tenants SET reserved_calls=reserved_calls+1 WHERE id=$1 AND reserved_calls<call_budget RETURNING id', [context.tenantId]);
        if (!tenant.rowCount) {
          await client.query("INSERT INTO alerts(tenant_id,job_id,kind,message) VALUES($1,NULL,'budget_exhausted','Local inference call budget exhausted; no additional call was made.') ON CONFLICT DO NOTHING", [context.tenantId]);
          return null;
        }
        return (await client.query('INSERT INTO ai_calls(tenant_id,job_id,entity_id,operation,model,attempt) VALUES($1,$2,$3,$4,$5,$6) RETURNING id', [context.tenantId, context.jobId, context.entityId, context.operation, model, context.attempt])).rows[0].id;
      });
      if (!call) throw Object.assign(new Error('Local inference call budget exhausted'), { code: 'BUDGET_EXHAUSTED' });
      return call;
    },
    async completeCall(id, { status, inputTokens = null, outputTokens = null, durationMs, errorCode = null, responseJson = null }) {
      await pool.query("UPDATE ai_calls SET status=$2,input_tokens=$3,output_tokens=$4,duration_ms=$5,error_code=$6,response_json=$7,finished_at=now() WHERE id=$1 AND status='reserved'", [id, status, inputTokens, outputTokens, durationMs, errorCode, responseJson === null ? null : JSON.stringify(responseJson)]);
    },
  };
}
