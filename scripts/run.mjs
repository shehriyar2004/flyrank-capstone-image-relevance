import { randomBytes } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';

export async function ensureLocalEnv(path) {
  const secret = () => randomBytes(32).toString('hex');
  const content = `POSTGRES_PASSWORD=${secret()}\nTENANT_A_KEY=${secret()}\nTENANT_B_KEY=${secret()}\nAPP_PORT=3100\nCALL_BUDGET=1000\nVISION_MODEL=qwen3-vl:2b\nEMBEDDING_MODEL=embeddinggemma:300m\n`;
  try { await writeFile(path, content, { flag: 'wx', mode: 0o600 }); }
  catch (error) { if (error.code !== 'EEXIST') throw error; }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  await ensureLocalEnv(resolve(root, '.env'));
  const child = spawn('docker', ['compose', 'up', '--build'], { cwd: root, stdio: 'inherit' });
  child.on('error', () => { console.error('Docker Compose could not start. Start Docker Desktop and retry.'); process.exitCode = 1; });
  child.on('exit', code => { process.exitCode = code ?? 1; });
}
