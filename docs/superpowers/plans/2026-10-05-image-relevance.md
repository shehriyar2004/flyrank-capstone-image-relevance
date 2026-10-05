# Image Relevance Capstone Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a reproducible image-matching backend, real local AI evidence, and an honest FlyRank submission pack.

**Architecture:** Express validates requests and calls tenant-scoped services/repositories. PostgreSQL owns persistent jobs, idempotency, vectors, reviews, and call accounting; a separate worker performs Ollama inference. Cosine ranking passes through a standalone guard before suggestions and approval.

**Tech Stack:** Node.js 24, Express, Zod, `pg`, Node's test runner, PostgreSQL 17, Docker Compose, Ollama, `qwen3-vl:2b`, `embeddinggemma:300m`.

**Spec:** [Approved specification](../specs/2026-10-05-image-relevance-design.md). Copy it into the new repository at `docs/superpowers/specs/2026-10-05-image-relevance-design.md` with this plan before product implementation.

## Global Constraints

- "Use Node.js 24, Express, Zod, PostgreSQL 17, and Docker Compose."
- "Run local Ollama with `qwen3-vl:2b` for image understanding and post subject extraction, and `embeddinggemma:300m` for embeddings."
- "HTTP requests enqueue slow work and return `202` with job IDs."
- "A separate worker claims jobs with PostgreSQL locking, a renewable lease, and at most three attempts with exponential backoff."
- "Initially flag confidence below `0.75`, unknown subjects, and ambiguous primary subjects."
- "Ranking uses model-derived captions and post text, never filenames, expected evaluation labels, or hardcoded image IDs."
- "Mutating requests require an idempotency key, scoped to tenant and operation, with a payload hash."
- "Enforce a zero-dollar provider policy plus a configurable per-tenant call budget (initially 1,000 attempts), reserving budget atomically before each call."
- "Bind the app to localhost port `3100`; database and Ollama remain internal to Compose."
- "Gather 50 distinct free Unsplash/Pexels photographs" and "at least four broad categories: animals, plants, landscapes, and architecture."
- "Use separate labeled calibration and evaluation posts: at least ten in each, with one visually justified correct image per positive post."
- "Use deterministic provider fixtures only in explicitly labeled tests."
- "Use a dedicated public GitHub repository named `flyrank-capstone-image-relevance`, created before product implementation once publication is authorized."
- "Submit only the finished repository URL through the portal after the project and evidence are reviewable and submission is authorized."

## Review Focus

1. Concurrent requests or a worker losing its lease must not duplicate durable results or let a stale worker overwrite a newer result; test in Task 2.
2. Budget exhaustion under concurrent inference and a crash after reservation must remain attributable and prevent extra calls; test in Task 3.
3. An image redirect, path escape, duplicate source, or hash mismatch must not import an untrusted file; test in Task 4.
4. Zero/NaN vectors, mixed embedding versions, ambiguous subjects, and unavailable post embeddings must never produce a confident match; test in Task 5.
5. A previously valid suggestion whose metadata changes, or whose image belongs to another tenant, must not be approvable; test in Task 6.

## Location, file map, and common types

The product repository will be `C:\Users\pc\Documents\flyrank-capstone-image-relevance`, independent of the assignment folders. Paths below are relative to that repository. Planning files currently remain under `outputs` until repository creation is authorized.

| Files | Responsibility |
|---|---|
| `package.json`, `Dockerfile`, `compose.yaml`, `.gitignore`, `.env.example`, `LICENSE` | Reproducible runtime and safe source control |
| `scripts/run.mjs`, `scripts/seed.mjs`, `scripts/download-corpus.mjs` | Cross-platform startup, demo seed, licensed image download |
| `src/config.mjs`, `src/http/app.mjs`, `src/http/server.mjs`, `src/http/routes.mjs`, `src/http/errors.mjs` | Configuration and validated HTTP boundary |
| `migrations/001-core.sql`, `src/data/db.mjs`, `src/data/migrate.mjs`, `src/data/repository.mjs` | Tenant-scoped persistence and migrations |
| `src/jobs/queue.mjs`, `src/jobs/worker.mjs`, `src/jobs/processors.mjs` | Durable claiming, leases, retries, staged processing |
| `src/ai/schemas.mjs`, `src/ai/ollama.mjs`, `src/ai/accounting.mjs` | Validated inference and per-call budget/accounting |
| `src/matching/taxonomy.mjs`, `src/matching/guard.mjs`, `src/matching/rank.mjs`, `src/services/catalog.mjs`, `src/services/reviews.mjs` | Image/post operations, matching and review decisions |
| `data/corpus.json`, `data/calibration.json`, `data/evaluation.json`, `data/ATTRIBUTION.md`, `config/matching.json` | Provenance, independent labels, frozen threshold |
| `scripts/calibrate.mjs`, `scripts/evaluate.mjs`, `scripts/probe.mjs`, `scripts/check-pack.mjs` | Actual measured acceptance and submission checks |
| `test/*.test.mjs`, `test/fixtures/`, `evidence/` | Explicitly separated test fixtures and real transcripts |
| `DESIGN.md`, `README.md`, `capstone.yaml`, `EVIDENCE.md`, `BUILDLOG.md`, `docs/superpowers/` | One-page design, evaluator commands, explanations, honest record |

Shared shapes: `TenantId`/entity IDs are UUID strings. `VisionMetadata = {subject, category, attributes: string[], caption, confidence: number}`. `PostIntent = {subject, category, confidence, ambiguous: boolean}`. `Vector = {values: number[], model, dimensions, inputHash}`. `GuardDecision = {accepted: boolean, reasons: string[]}`. `Context = {tenantId, jobId, entityId, attempt}`. All APIs use JSON; credentials use `X-Tenant-Key`; mutations also use `Idempotency-Key`.

---

### Task 1: Dedicated repository and runnable foundation

**Files:** Runtime/source-control files above; `scripts/run.mjs`, `src/config.mjs`, `src/http/app.mjs`, `src/http/server.mjs`, `DESIGN.md`, `BUILDLOG.md`; `test/bootstrap.test.mjs`.

**Interfaces:** Produce `ensureLocalEnv(path) -> Promise<void>`, `readConfig(env) -> Config`, and `createApp(dependencies) -> Express`. Commands: `node scripts/run.mjs` starts Compose; `npm test` runs deterministic tests. Real application/provider credentials never enter the repository.

- [ ] Prepare the initial public-repository content: approved spec/plan, a one-page `DESIGN.md`, MIT license, safe `.gitignore`, and a README that accurately says implementation is pending. After plan approval and explicit publication authorization, create the public repository before adding product code. If GitHub authentication is unavailable, stop at that concrete prerequisite; do not secretly build in a private repository.
- [ ] Write failing tests `startup_preserves_existing_env` and `health_exposes_no_secrets`: assert repeated startup leaves generated secret values unchanged; assert `/health` responds `200` without tenant keys/database credentials.
- [ ] Run `node --test test/bootstrap.test.mjs`; confirm the missing implementation causes failure.
- [ ] Implement the interfaces and Compose services: database, Ollama, model initializer, HTTP app, and a worker definition under an inactive `pipeline` profile until Task 3 supplies its entry point. Generate random demo tenant/database secrets into ignored `.env` only when missing. Publish only `127.0.0.1:3100`. Pin actual Ollama image version/digest compatible with both models (at least `0.12.7`); record resolved model digests. Add lockfile, run/seed/test script entries, and truthful phase status to README/BUILDLOG; do not claim seed/processing is functional before its owning task ships.
- [ ] Run the tests and `node scripts/run.mjs`; require a healthy HTTP response and inspect Compose configuration for internal-only database/Ollama ports. Model initialization may continue while subsequent implementation proceeds.
- [ ] Commit the runnable foundation after the separate initial design commit; push only the explicitly reviewed files.

### Task 2: Tenant persistence, idempotency, and recoverable queue

**Files:** Migration/data files, `src/jobs/queue.mjs`; `test/persistence.test.mjs`, `test/queue.test.mjs`.

**Interfaces:** Produce `migrate(pool) -> Promise<void>`, `authenticate(key) -> Promise<TenantId|null>`, `idempotent(tenantId, operation, key, payload, transactionAction) -> Promise<{status,body}>`, `enqueue(tenantId, kind, entityId, version) -> Promise<Job>`, `claim(workerId) -> Promise<Job|null>`, `heartbeat(jobId, leaseToken) -> Promise<boolean>`, and `finish(job, result)/fail(job, error) -> Promise<void>`. Business repository methods require `tenantId`; use a privileged internal queue interface only for worker claiming.

- [ ] Write failing DB tests: foreign-tenant reads return no row; cross-tenant foreign keys fail; identical concurrent idempotency requests create one record/job; different payload with reused key gives `409`; expired leases recover; stale lease tokens cannot finish; the third failed attempt creates one persistent alert. Apply migrations twice and assert no duplicated schema/data.
- [ ] Run `npm run test:integration -- test/persistence.test.mjs test/queue.test.mjs`; confirm failures before implementation.
- [ ] Implement migrations for every entity in the spec plus idempotency records. Embeddings use nullable image/post owner columns with a constraint requiring exactly one owner and tenant composite foreign keys to both owner tables. Add tenant composite keys/FKs and job/status/owner indexes. Claim with `FOR UPDATE SKIP LOCKED`; use a 60-second lease renewed every 15 seconds, fence all job result publication, and retry at 2 and 4 seconds. Recover expired running jobs within the three-attempt cap. Atomically commit mutation results and idempotency responses. Never promise exactly-once remote inference: durable outputs are idempotent, while any repeated provider call has its own accounting record.
- [ ] Re-run integration tests and restart the DB container without deleting its volume; assert persisted rows remain and only the owning tenant can access them.
- [ ] Commit `feat: add tenant persistence and durable job recovery` with genuine test evidence.

### Task 3: Validated local inference, budgets, and staged worker

**Files:** AI files, `src/jobs/worker.mjs`, `src/jobs/processors.mjs`; modify `compose.yaml` and `scripts/run.mjs` to enable the implemented worker; `test/ai.test.mjs`, `test/accounting.test.mjs`, `test/processors.test.mjs`.

**Interfaces:** Produce `parseVision(raw) -> VisionMetadata`, `parseIntent(raw) -> PostIntent`, `classifyImage(bytes, context) -> Promise<VisionMetadata>`, `analyzePost(text, context) -> Promise<PostIntent>`, `embed(text, context) -> Promise<Vector>`, `reserveCall(context, model) -> Promise<CallId>`, and `processJob(job) -> Promise<void>`. Provider fixtures implement these same inference methods only in tests.

- [ ] Write failing tests: extra JSON fields/malformed JSON/confidence `NaN` or outside `[0,1]` fail validation; valid confidence `0.74` persists as flagged and cannot become eligible; invalid output retries and never persists trusted tags; every failed/successful attempt has an attributed record; 20 concurrent calls with a budget of 2 invoke the provider exactly twice; a crashed reservation remains an unfinished/abandoned attributed attempt. A retry after successful classification reuses that stage and does not duplicate tags.
- [ ] Run `node --test test/ai.test.mjs test/processors.test.mjs` and the accounting integration test; confirm failures first.
- [ ] Implement Ollama `/api/chat` with image bytes and a strict JSON schema, temperature zero, no filename/label hints, bounded context and a 300-second request timeout. Use the same model for validated post intent. Call `/api/embed` without silently truncating input. Reserve call budgets transactionally before network I/O, finalize usage/duration/status afterward, and preserve unknown usage as null. Reject paid/cloud provider configuration; local dollar cost is zero. Persist validated stages before subsequent embedding work, flag low confidence/unknown/ambiguous output, and mark exhausted processing failures separately.
- [ ] Run tests; with the actual models, make one real image call and one real embedding call once a licensed sample is available. Check stored response validity, model/digest, finite vector shape, actual timing, and attributed zero-dollar records. These real checks belong in evidence, not fixture output.
- [ ] Commit `feat: add validated local AI processing and call budgets`.

### Task 4: Licensed corpus and independent evaluation labels

**Files:** Corpus/data files, downloader and seed scripts; `test/corpus.test.mjs`.

**Interfaces:** Produce `verifyManifest(entries) -> ManifestEntry[]`, `downloadCorpus(manifest, directory) -> Promise<DownloadReport>`, and `seedDemo(tenantKey) -> Promise<{batchId,postIds}>`. Each manifest entry contains ID, source page, photographer, license URL, download URL, category for corpus auditing only, SHA-256, and transformation description. Labels are consumed only by calibration/evaluation scripts.

- [ ] Write failing tests for disallowed hosts/redirect destinations, path traversal, oversized/non-image content, hash mismatch, duplicate source page/content, missing attribution, and a labeled image absent from the manifest. Assert manifest audit requires 50 unique sources and four broad categories.
- [ ] Run `node --test test/corpus.test.mjs`; confirm failure before downloader/manifest validation exists.
- [ ] Gather and visually inspect 50 distinct photos: approximately 26 animals including red fox/wolf/dog/bear/deer, 8 plants, 8 landscapes, and 8 architecture images. Choose a genuinely ambiguous photo; do not fabricate its confidence. Download only approved image CDN hosts, validate every redirect, impose a 30-second fetch timeout and 5 MB file cap, and verify hashes on repeat downloads. Include small files if the total remains a few MB; otherwise retain the reproducible manifest/downloader. Record actual author/source/license facts and AI assistance.
- [ ] Create separate calibration/evaluation files with at least ten positive posts each, each labeled with one visually justified correct image, plus absent-subject negatives. Include scientific/common-name cases and distinctive scenes to justify the single-image labels. Keep expected labels and corpus categories out of runtime ranking inputs. Seed through idempotent APIs; rerunning seed must not duplicate entities/jobs.
- [ ] Run corpus tests, manifest audit, repeated seed, and the real batch. Verify all 50 outputs are schema-valid, inspect the genuinely low-confidence flag, and record all calls. If this probe fails, correct the actual pipeline/corpus issue before claiming completion; any material model/design change requires a disclosed revision.
- [ ] Commit `feat: add attributed corpus and reproducible demo seed`.

### Task 5: Semantic ranking and standalone mismatch guard

**Files:** Matching files, `config/matching.json`, calibration script; `test/matching.test.mjs`.

**Interfaces:** Produce `canonicalSubject(subject) -> string`, `cosine(a, b) -> number`, `guard({intent,metadata,similarity,threshold,eligible}) -> GuardDecision`, `rankCandidates(postVector, imageVectors) -> RankedCandidate[]`, and `recommend(tenantId, postId, limit) -> Promise<{status,suggestions,rejections}>`. Status is `processing`, `matched`, or `no confident match`. Sort by descending genuine cosine score with a stable ID tie-break, then apply the guard.

- [ ] Write failing assertions: fox intent plus wolf metadata at similarity `0.99` rejects with `Animal category mismatch: expected fox, detected wolf`; confidence `0.74` rejects; scientific/common-name aliases agree; unknown/ambiguous intent refuses; zero/NaN or dimension/model-mismatched vectors refuse; an unprocessed post returns `processing`; no accepted candidate returns `no confident match` with nonempty reasons. Filename changes must not alter scores.
- [ ] Run `node --test test/matching.test.mjs`; confirm failure first.
- [ ] Implement the interfaces and persist explanation snapshots with metadata/model versions. Implement calibration using only calibration positives/negatives: search thresholds `0.00` through `1.00` by `0.01`, exclude thresholds accepting any labeled negative, maximize correct top-1 positive results, then choose the higher threshold on ties. Persist the threshold, calibration dataset hash and model versions; freeze them before held-out evaluation. Never read expected image IDs in runtime services.
- [ ] Run tests, calibrate against actual stored vectors, then probe the real fox/common-name/scientific-name posts, forced wolf, lower-ranking dog, and absent-subject post. Paste actual scores and reasons; do not assume model quality from unit tests.
- [ ] Commit `feat: add semantic ranking and explained mismatch rejection`.

### Task 6: Validated API and human review workflow

**Files:** HTTP routes/errors and catalog/review services; `test/http.test.mjs`, `test/reviews.test.mjs`.

**Interfaces:** Implement all eleven endpoints in the spec. `POST /images/batches` takes `{imageIds: string[]}`; `POST /posts` takes `{title,content}`; forced-candidate check takes `{imageId}`; review takes `{action: 'approve'|'reject', explanation?: string}`. Produce `reviewSuggestion(tenantId,suggestionId,decision) -> Promise<Review>`; approval rechecks current metadata/vector versions and guard eligibility under a transaction. Inference never runs inside HTTP handlers.

- [ ] Write failing API tests: invalid UUID/action/content/pagination/body size gives `4xx`, missing key gives `401`, cross-tenant resources give `404`, reused key with different payload gives `409`. Batch/post creation gives `202` even while a fixture provider is blocked. An approved suggestion is replay-safe; a now-flagged/reclassified candidate cannot be approved; a foreign-tenant candidate cannot be forced or reviewed; rejecting a suggestion records its explanation.
- [ ] Run `npm run test:integration -- test/http.test.mjs test/reviews.test.mjs`; confirm failures first.
- [ ] Implement validated routes with a 64 KB JSON limit, content length at most 4,000 characters, batches of 1–50 known manifest IDs, and pagination 1–100. Return safe structured errors. Expose job attempts/progress, alerts, and attributed costs without secrets. Reviews are terminal approve/reject decisions; a conflicting later decision gives `409`, while replay of the original key returns its original response. Rejected/flagged images never pass approval.
- [ ] Run API/review tests and exercise real endpoints for inspect, approve, reject, job progress, costs, forced wolf, and no-match explanations.
- [ ] Commit `feat: expose validated matching and review APIs`.

### Task 7: Measured evaluation, clean reproduction, and submission pack

**Files:** Evaluation/probe/check-pack scripts, README, manifest, evidence and build log; `test/evaluation.test.mjs`.

**Interfaces:** `evaluate(dataset, api) -> Promise<{correct,total,top1Precision,coverage,negativeResults}>`; `probeAcceptance(api) -> Promise<ProbeReport>`; `checkPack(directory) -> Promise<PackReport>`. CLI commands are `npm run evaluate`, `npm run probe`, `npm run check:pack`, and `npm run seed`; `capstone.yaml` names the same run/seed/test commands, base URL `http://localhost:3100`, and concrete probe endpoints.

- [ ] Write failing test `precision_counts_refusals_as_misses`: two correct first images, one wrong image and one refusal yield `2/4 = 0.5`; assert negative cases are reported separately and cannot inflate positive precision. Assert evaluation cannot modify the frozen calibration configuration.
- [ ] Run `node --test test/evaluation.test.mjs`; confirm failure first.
- [ ] Implement evaluation/reporting and pack verification. Run all six acceptance probes on real processed data, plus shared-requirement proofs for tenant isolation, retry/failure alert, idempotency, persistence/migrations, clean `4xx`, secret hygiene, and budget enforcement. Label failure-injection/fixture proofs explicitly and keep them distinct from live AI evidence. Generate README's precision from the held-out report and include numerator/denominator, coverage, model versions, and limitations.
- [ ] Capture one real proof for each of the thirteen core requirements and seven shared requirements in `EVIDENCE.md`; record AI help, mistakes, actual fixes and remaining limits in `BUILDLOG.md`. Add architecture/run/seed instructions, safe environment examples, image attribution, and an explanation of the guard that the user can discuss with an evaluator. Never list an unfinished requirement as passing.
- [ ] Run the documented entry point and seed using an independent Compose project and fresh volumes without deleting the working project. Verify model/corpus provisioning, migrations, health, seed and evaluation work. Scan tracked files and Git history for real secrets; confirm no `.env`, dependency folders or oversized dataset entered history. Run the full relevant test suite once; repeat only after changes or failures.
- [ ] Commit `docs: record measured evaluation and reproducible acceptance evidence`; keep earlier phase commits visible. Use the selected execution skill's independent final review, address material findings, and verify affected behavior before reporting readiness. Preserve unfinished status if any acceptance probe or reviewer concern remains unresolved.
- [ ] Show the finished public repository and evidence to the user. After authorization for portal submission, paste only its verified GitHub URL into the capstone form, verify the resulting receipt/status, and report submitted versus accepted accurately. Certificate generation remains dependent on FlyRank's acceptance.

## Plan self-review and execution handoff

The seven tasks cover the approved spec's pipeline, ranking/guard, persistence/isolation, asynchronous recovery, review API, cost/idempotency controls, licensed corpus, real evaluation, and required delivery files. Each Review Focus item has a corresponding failing-test step. No result or precision is preclaimed.

Recommended execution: **Native** — implement the seven tasks in this session, then perform one independent final review. The tasks depend heavily on shared schema and inference interfaces; this avoids a fresh implementation/review context for every task. **Subagent-driven** execution remains an option if the user prefers independent review after each task.

Implementation begins only after the user reviews this plan and chooses the execution method. Public-repository creation and final portal submission retain their explicit authorization requirements.
