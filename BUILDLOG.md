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

## Independent review and corrections

- One fresh reviewer found four Important bugs: transaction/pool starvation during concurrent approval; failed posts retaining vectors could still match; an explicitly ambiguous `fox or wolf` subject was silently treated as fox; and embedding changes reused suggestion identities with inconsistent stored evidence.
- Regression tests reproduced each failure before the code changes. Fixed shared transaction propagation (including forced-candidate checks), required ready posts, flagged ambiguous subject expressions with an optional explicit model ambiguity field, and made suggestion evidence depend on both embedding revisions. Existing suggestion evidence is preserved, and stale versions cannot approve.
- The reviewer also flagged early calibration caching and mutable model tags. These were treated as important correctness issues: calibration now requires completed jobs and fresh per-run idempotency keys, refuses empty candidate matrices, and freezes model identities. Runtime inference persists immutable model digests and refuses incompatible calibrated versions. A controlled backfill linked already generated demo records to independently recorded unchanged digests; outcomes/confidence were not rewritten.
- The saturated-pool regression exposed the same issue in the forced-candidate endpoint: ten concurrent checks returned 500 before passing the held transaction through that handler. It was fixed in the same review pass.
- After the fixes, 14 unit tests and 15 PostgreSQL/API integration tests passed. An early real calibration attempt explicitly refused while batch jobs were unfinished rather than producing a false metric. Final actual evaluation remains pending.

## Clean startup and seed reproduction

- Archived tracked source into an independent directory with no `.env`, dependencies, downloaded corpus or prior database. The documented `node scripts/run.mjs` installed CLI dependencies, generated fresh local secrets, built the app and migrated a fresh PostgreSQL volume; health returned 200 on a separate localhost port.
- To avoid duplicating the expensive ongoing model run, this bounded reproduction used a temporary Compose override disabling the model services/worker. Actual default model provisioning is already verified in the primary fresh project; final full-corpus/evaluation evidence comes from that actual run, not the disabled reproduction.
- Cold seed downloaded and verified all 50 JPEGs; repeated seed used 50 cached files and retained 50 images, 24 posts and 74 jobs. The reproduction containers were stopped without touching the primary project.
- Fresh startup exposed a Windows Node shell-argument deprecation warning. Replaced that installer launch with a fixed `cmd.exe /d /s /c npm ci` invocation, without interpolated arguments; the real dependency install completed with exit 0 and no deprecation warning.
- Bundled exactly the 50 hash-verified licensed corpus JPEGs (1.62 MB) as well as the reproducible downloader, reducing evaluator dependence on image-host availability. Other local images remain ignored; the debug sample is not part of the published corpus.

## 2026-10-06 — live matching correction before held-out evaluation

- Resumed Docker and found all original 50 image jobs and 24 post jobs had completed. Initial calibration selected 0.75, but common/scientific-name fox probes refused relevant images. Wolf rejection and absent-subject refusal worked. These initial results are preserved rather than hidden.
- Found another implementation mistake: Ollama's EmbeddingGemma template was bare `{{ .Prompt }}`, while Google's official documentation recommends `task: sentence similarity | query: ` for semantic similarity. Added the same task prefix to both image captions and post text, and included formatted text in the stored input hashes. No filenames, label IDs, or guard taxonomy enter vector generation.
- Added a tenant-scoped idempotent reprocessing endpoint and seed pipeline revisions, so existing posts/images can be refreshed without duplicate entities. Background jobs regenerate incompatible embeddings and refresh genuinely stale classification prompts. All changes were regression-tested; held-out labels remain unchanged and evaluation has not yet run.
- Live calibration also exposed aliases embedded in modifiers (`Sunlight through woodland`, `Zamioculcas leaves`) being refused even though their exact synonyms were recognized. Expanded existing alias matching to phrases, suppressing overlapping shorter names and refusing competing subjects. This changes guard compatibility, not vector scores.
- Corrected an overstrict demo-probe assumption: equivalent common/scientific-name requests must return confident fox images, but the brief does not require the identical photograph among multiple foxes. The probe reports whether the selected photos agree without making that a pass condition. Strict single-image ground truth remains unchanged for held-out precision.

- STS input fixed ordinary fox ranking, but the pure scientific-name demo still fell below the calibration cutoff. Stronger common-English instructions did not reliably change the model's Latin subject output. Preserved raw intent and added a declared scientific-name dictionary to normalize known biological meaning in encoder input, retaining raw stored text. This is explicit domain enrichment, not a claim that the small model learned the names independently; real embedding calls still determine every score.
- Added regression coverage for raw-intent preservation, full-name/word-boundary normalization, and inspecting flagged-post similarity without allowing recommendations. This lets calibration include safety refusals as misses instead of treating flagged intent as missing embeddings. Held-out labels were never changed or used to adjust parameters.
- Final calibration selected similarity 0.83 before held-out evaluation. All live probes passed: 50 schema-valid images, uncertainty flag, common/scientific fox retrieval, lower wolf/dog scores, forced-wolf rejection, absent-subject refusal, and attributed $0 calls.
- Held-out top-1 precision was 7/10 = 70.0%; coverage 70.0%. Seven accepted pairings were correct, and three positives were refused. After seeing the held-out result, no tuning was performed to improve it. The confidence-floor boundary was made explicitly inclusive (0.75 is flagged), with a failing regression test; this preserved all evaluation/probe outcomes.
- Verified actual approve, reject, inspect, and identical idempotent replay on two separate demo-only posts. These are automated API acceptance actions, not claimed human/user approvals. New model calls remain attributed.
