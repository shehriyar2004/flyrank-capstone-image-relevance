import { z } from 'zod';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { hash } from '../src/data/repository.mjs';

const urlAllowed = (value, hosts) => { const url = new URL(value); return url.protocol === 'https:' && hosts.includes(url.hostname) && !url.username && !url.password; };
const entrySchema = z.object({ id: z.string().regex(/^[A-Za-z0-9_-]{1,80}$/), sourceUrl: z.string().url().refine(v => urlAllowed(v, ['unsplash.com','www.pexels.com'])), photographer: z.string().trim().min(1), licenseUrl: z.enum(['https://unsplash.com/license','https://www.pexels.com/license/']), category: z.enum(['animal','plant','landscape','architecture']), downloadUrl: z.string().url().refine(v => urlAllowed(v, ['images.unsplash.com','images.pexels.com'])), sha256: z.string().regex(/^[a-f0-9]{64}$/), transformation: z.string().min(1), description: z.string().optional() });
export function verifyManifest(entries) {
  const manifest = z.array(entrySchema).min(1).parse(entries);
  for (const field of ['id','sourceUrl','sha256']) if (new Set(manifest.map(v => v[field])).size !== manifest.length) throw new Error(`Duplicate corpus ${field}`);
  return manifest;
}
export function auditCorpus(entries) {
  const manifest = verifyManifest(entries);
  if (manifest.length !== 50 || new Set(manifest.map(v => v.category)).size < 4) throw new Error('Corpus must contain 50 distinct images and four broad categories');
  return { images: manifest.length, categories: [...new Set(manifest.map(v => v.category))] };
}
export async function downloadCorpus(entries, directory, { fetchImpl = fetch } = {}) {
  const manifest = verifyManifest(entries);
  await mkdir(directory, { recursive: true });
  let downloaded = 0, cached = 0;
  for (const entry of manifest) {
    const path = join(directory, `${entry.id}.jpg`);
    try { const existing = await readFile(path); if (hash(existing) === entry.sha256) { cached++; continue; } }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    let url = entry.downloadUrl, response;
    const signal = AbortSignal.timeout(30000);
    for (let redirect = 0; redirect <= 3; redirect++) {
      if (!urlAllowed(url, ['images.unsplash.com','images.pexels.com'])) throw new Error('Unsafe corpus image URL');
      response = await fetchImpl(url, { redirect: 'manual', signal });
      if (![301,302,303,307,308].includes(response.status)) break;
      if (redirect === 3 || !response.headers.get('location')) throw new Error('Too many image redirects');
      url = new URL(response.headers.get('location'), url).href;
    }
    if (!response.ok || !response.headers.get('content-type')?.startsWith('image/') || Number(response.headers.get('content-length')) > 5*1024*1024) throw new Error('Invalid corpus image response');
    const chunks = []; let size = 0;
    for await (const chunk of response.body) { size += chunk.length; if (size > 5*1024*1024) throw new Error('Corpus image too large'); chunks.push(chunk); }
    const bytes = Buffer.concat(chunks);
    if (bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff || hash(bytes) !== entry.sha256) throw new Error('Corpus image integrity mismatch');
    await writeFile(`${path}.tmp`, bytes); await rename(`${path}.tmp`, path); downloaded++;
  }
  return { downloaded, cached };
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const manifest = JSON.parse(await readFile('data/corpus.json', 'utf8'));
  console.log(JSON.stringify(auditCorpus(manifest)));
  console.log(JSON.stringify(await downloadCorpus(manifest, 'data/images')));
}
