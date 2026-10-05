# Build log

## 2026-10-05 — design and repository

- The user selected the supplied AI Image Understanding capstone and approved the proposed design, written specification, and implementation request.
- Codex extracted the brief, checked the portal's certificate requirements, researched official local-model documentation, and drafted the design and plan. The portal showed five Backend assignments submitted and an unsubmitted capstone.
- The public repository was created before product implementation. No private assignment files or credentials were copied into it. Git author email uses GitHub's noreply address.
- Native execution was selected: Codex implements the tasks in this session, followed by one independent final review. No model results, precision scores, or acceptance passes have been claimed at this stage.

## Foundation

- Wrote three tests first; they failed because startup, HTTP app and configuration implementations did not exist. Implemented startup that preserves `.env`, safe health responses, and local-only provider/budget validation. All three tests then passed.
- Built the real Docker app and confirmed `/health` returns `200`. Compose inspection showed port 3100 on localhost only and no published PostgreSQL/Ollama ports.
- The approved plan scheduled some live checks before their dependencies existed: model digests need completed downloads, real vision checks need the corpus, and seed API checks need the later HTTP endpoints. Their integration evidence will be collected when those dependencies become available; no live inference success is claimed prematurely.

## Pipeline and corpus

- Five persistence/queue integration tests passed against real PostgreSQL; a stored row survived a database container restart. Tenant-scoped foreign keys rejected a cross-tenant suggestion. Concurrent idempotency requests created one post.
- Strict vision/vector validation and per-call accounting were implemented test-first. Worker retries reuse completed validated tags; a genuine confidence of 0.74 in an explicitly labeled test fixture remained flagged. Invalid fixture output never became trusted tags. Budget reservations permit only two concurrent calls when set to two.
- A real smoke call exposed a design mistake: the `qwen3-vl:2b` alias selects the thinking variant. It exhausted 300 output tokens before finishing JSON; increasing to 1,000 still produced thinking without valid output. All failed calls were recorded and invalid output was rejected. Exact provider responses were added to private database accounting for diagnosis.
- Selected the same-family, same-size `qwen3-vl:2b-instruct` tag after checking the official model tags. The downloaded model stalled at 98%; restarting only the capstone Ollama/model-initializer services resumed it.
- The instruction model's first actual classification identified a fox with confidence 0.7, so it was genuinely flagged. Its caption was embedded by the real local embedding model. This is not a synthetic low-confidence example.
- Codex collected 50 distinct free Unsplash photographs across four broad categories, excluding premium cards. Downloaded JPEGs total about 1.62 MB at width 384, quality 70, without cropping. Exact photographer/source/license facts and hashes are in the manifest/attribution file. The reproducible downloader rejects unsafe URLs, redirects, oversized/nonimage responses, and wrong hashes.
- Codex visually inspected two contact sheets to create ten calibration and ten held-out positive evaluation labels before looking at model metadata/rankings, with written reasons and an absent-octopus negative. These labels are AI-assisted; the user should review them and understand the code before an evaluator interview.
- While real inference/downloads ran, independent corpus, matching, and API work advanced; the task ledger records their deferred live checks. No held-out precision has been claimed yet.
