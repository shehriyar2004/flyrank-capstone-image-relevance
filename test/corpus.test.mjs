import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

const bytes = Buffer.from([0xff,0xd8,0xff,0xdb,1,2,3]);
const sha256 = createHash('sha256').update(bytes).digest('hex');
const sample = { id: 'image-a', sourceUrl: 'https://unsplash.com/photos/image-a', photographer: 'Example Photographer', licenseUrl: 'https://unsplash.com/license', category: 'animal', downloadUrl: 'https://images.unsplash.com/photo-example?w=384&q=70&fm=jpg&fit=max', sha256, transformation: 'Proportional resize, no crop' };
test('corpus_manifest_rejects_untrusted_sources_paths_duplicates_and_missing_credit', async () => {
  const { verifyManifest, auditCorpus } = await import('../scripts/download-corpus.mjs');
  assert.equal(verifyManifest([sample]).length, 1);
  for (const value of [{ ...sample, downloadUrl: 'https://evil.example/image.jpg' }, { ...sample, id: '../escape' }, { ...sample, photographer: '' }, { ...sample, sha256: 'wrong' }, { ...sample, sourceUrl: 'https://evil.example/credits' }]) assert.throws(() => verifyManifest([value]));
  assert.throws(() => verifyManifest([sample,sample]));
  assert.throws(() => auditCorpus([sample]));
});

test('downloader_refuses_redirect_escape_hash_mismatch_and_non_image_content', async () => {
  const { downloadCorpus } = await import('../scripts/download-corpus.mjs');
  const directory = await mkdtemp(join(tmpdir(), 'capstone-corpus-'));
  try {
    const redirect = async () => new Response(null, { status: 302, headers: { location: 'http://127.0.0.1/private' } });
    await assert.rejects(downloadCorpus([sample], directory, { fetchImpl: redirect }));
    const wrongHash = async () => new Response(Buffer.from([0xff,0xd8,0xff,1]), { headers: { 'content-type': 'image/jpeg' } });
    await assert.rejects(downloadCorpus([sample], directory, { fetchImpl: wrongHash }));
    const html = async () => new Response('<html>error</html>', { headers: { 'content-type': 'text/html' } });
    await assert.rejects(downloadCorpus([sample], directory, { fetchImpl: html }));
    const large = async () => new Response(null, { headers: { 'content-type': 'image/jpeg', 'content-length': '6000000' } });
    await assert.rejects(downloadCorpus([sample], directory, { fetchImpl: large }));
    const image = async () => new Response(bytes, { headers: { 'content-type': 'image/jpeg' } });
    const result = await downloadCorpus([sample], directory, { fetchImpl: image });
    assert.equal(result.downloaded, 1);
    assert.deepEqual(await readFile(join(directory, 'image-a.jpg')), bytes);
    const cached = await downloadCorpus([sample], directory, { fetchImpl: async () => { throw new Error('Cache should avoid network'); } });
    assert.equal(cached.cached, 1);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
