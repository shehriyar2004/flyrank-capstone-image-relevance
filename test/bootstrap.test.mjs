import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('startup_preserves_existing_env', async () => {
  const { ensureLocalEnv } = await import('../scripts/run.mjs');
  const directory = await mkdtemp(join(tmpdir(), 'image-capstone-'));
  try {
    const file = join(directory, '.env');
    await ensureLocalEnv(file);
    const generated = await readFile(file, 'utf8');
    assert.match(generated, /TENANT_A_KEY=[a-f0-9]{64}/);
    assert.match(generated, /POSTGRES_PASSWORD=[a-f0-9]{64}/);
    await ensureLocalEnv(file);
    assert.equal(await readFile(file, 'utf8'), generated);
    await writeFile(file, 'TENANT_A_KEY=already-configured\n');
    await ensureLocalEnv(file);
    assert.equal(await readFile(file, 'utf8'), 'TENANT_A_KEY=already-configured\n');
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('health_exposes_no_secrets', async () => {
  const { createApp } = await import('../src/http/app.mjs');
  const app = createApp({ config: { tenantAKey: 'private-tenant-key', databaseUrl: 'postgres://private-password' } });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/health`);
    assert.equal(response.status, 200);
    const body = await response.text();
    assert.match(body, /ok/);
    assert.doesNotMatch(body, /private-tenant-key|private-password/);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('configuration_refuses_cloud_inference_and_negative_budgets', async () => {
  const { readConfig } = await import('../src/config.mjs');
  const env = { DATABASE_URL: 'postgres://capstone:test@db/capstone', TENANT_A_KEY: 'a'.repeat(64), TENANT_B_KEY: 'b'.repeat(64) };
  assert.throws(() => readConfig({ ...env, VISION_MODEL: 'qwen3-vl:cloud' }));
  assert.throws(() => readConfig({ ...env, CALL_BUDGET: '-1' }));
  assert.throws(() => readConfig({ ...env, OLLAMA_URL: 'https://cloud.example.com' }));
  assert.equal(readConfig(env).callBudget, 1000);
});
