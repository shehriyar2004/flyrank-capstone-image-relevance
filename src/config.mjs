import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  TENANT_A_KEY: z.string().min(24),
  TENANT_B_KEY: z.string().min(24),
  PORT: z.coerce.number().int().min(1).max(65535).default(3100),
  HOST: z.enum(['127.0.0.1', '0.0.0.0']).default('127.0.0.1'),
  OLLAMA_URL: z.string().url().default('http://ollama:11434'),
  VISION_MODEL: z.string().min(1).refine(v => !/cloud/i.test(v)).default('qwen3-vl:2b'),
  EMBEDDING_MODEL: z.string().min(1).refine(v => !/cloud/i.test(v)).default('embeddinggemma:300m'),
  CALL_BUDGET: z.coerce.number().int().min(0).max(100000).default(1000),
});

export function readConfig(env) {
  const values = schema.parse(env);
  const url = new URL(values.OLLAMA_URL);
  if (url.protocol !== 'http:' || !['ollama', 'localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.username || url.password) {
    throw new Error('Only local Ollama inference is allowed.');
  }
  if (values.TENANT_A_KEY === values.TENANT_B_KEY) throw new Error('Demo tenant keys must differ.');
  return { databaseUrl: values.DATABASE_URL, tenantAKey: values.TENANT_A_KEY, tenantBKey: values.TENANT_B_KEY,
    port: values.PORT, host: values.HOST, ollamaUrl: url.origin, visionModel: values.VISION_MODEL,
    embeddingModel: values.EMBEDDING_MODEL, callBudget: values.CALL_BUDGET };
}
