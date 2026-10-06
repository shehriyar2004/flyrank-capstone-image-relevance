# Capstone evidence

Core implementation and real acceptance checks completed on 2026-10-06 (Asia/Karachi). This document distinguishes real model/API evidence from explicitly labeled deterministic fixtures. Certification remains FlyRank's decision.

## Real acceptance transcript

```text
npm run probe
{"corpus":{"pass":true},"fox":{"pass":true},"semantic":{"pass":true},"forcedWolf":{"pass":true},"absent":{"pass":true},"costs":{"pass":true}}

npm run evaluate
correct: 7/10; top-1 precision: 70.0%; coverage: 70.0%
Absent-octopus negative refused: true
```

## Core requirements — one proof per item

1. **Schema-valid structured vision; invalid responses never trusted.** All 50 current image metadata objects passed the production vision schema and have current 768-dimensional embeddings. Example actual metadata: `{"caption":"A joyful beagle with its mouth open and tongue out, sitting outdoors on a dirt path with green grass in the background.","subject":"beagle","category":"animal","attributes":["happy","open mouth","pink tongue","black collar","brown and white fur"],"confidence":0.95}`. See [complete corpus results](evidence/corpus-results.json). Deterministic tests `vision_schema_rejects_untrusted_shape_and_confidence` and `invalid_vision_output_retries_without_trusted_tags` pass; initial real truncated model outputs were rejected and remain attributed in the call log.

2. **Low confidence flagged.** Actual batch: image `qLW70Aoo8BE`, subject `unknown`, confidence `0.75`, persisted status `flagged`. Confidence at or below 0.75, unknown subjects and ambiguity are refused. No confidence values were rewritten. The threshold-boundary regression failed before its fix; see `guard_requires_confident_subjects_similarity_and_available_metadata`.

3. **Background batch, retries and progress.** All 50 current image jobs and 24 current seeded-post jobs completed successfully. `queue_deduplicates_jobs_and_recovers_expired_leases_with_fencing` and `three_failed_attempts_create_one_failure_alert_and_no_fourth_attempt` pass against actual PostgreSQL with explicit failure injection. The third failure creates one alert, and a fourth attempt never runs. HTTP intake returns 202 without invoking inference. Current job IDs/statuses are in [acceptance results](evidence/acceptance.json).

4. **Every AI attempt has attributed cost.** [Full call log](evidence/calls.json) contains 302 actual attempt records, 296 completed successfully, including earlier failed/unfinished development attempts. All are attributed to a tenant/entity and a job when applicable; monetary API cost totals $0. Unknown usage remains null. Example current call: `{"id":"0d0fb88d-812d-4e4c-acf1-a4ff89f1bef3","tenant_id":"11111111-1111-4111-8111-111111111111","job_id":"40d0687e-1ea8-4b15-9212-98dac86ad93b","entity_id":"6e4f2a74-ee26-44b8-852e-b0fbfa0d1b8c","operation":"embedding","model":"embeddinggemma:300m@85462619ee721b466c5927d109d4cb765861907d5417b9109caebc4e614679f1","attempt":1,"status":"succeeded","input_tokens":47,"output_tokens":null,"duration_ms":2209.674711000058,"cost_usd":"0.000000","error_code":null,"created_at":"2026-10-06T00:50:58.012Z"}`.

5. **Stored embeddings and ranked suggestions.** All 50 image captions have real current vectors. Actual fox article first result: `Powgsxla7Es`, cosine `0.8326852791949109`, subject `fox`. Wolf/dog confuser scores are lower, proven by the live fox probe. Source: [acceptance results](evidence/acceptance.json).

6. **Semantic equivalent concepts.** Actual `Vulpes vulpes` article selects `Powgsxla7Es` with cosine `0.8309416129802725` and subject `fox`. The system explicitly normalizes declared scientific-name meanings in encoder input while preserving raw intent/text; all similarity scores come from actual embeddings. It does not claim the small model reliably translated Latin unaided. No expected image IDs enter runtime matching.

7. **Wolf-on-fox provably rejected.** Actual forced candidate: `{"imageId":"c1b1c3d4-c7e0-4235-b1ee-0e064d8784e7","score":0.6512737202419182,"embeddingRevision":"b672f1cc2a7b7d3ab35ca25592141e94e5900f6cbab90350989a619e98c9b4a2","embeddingProfile":"sentence-similarity-nomenclature-v4","embeddingModelIdentity":"embeddinggemma:300m@85462619ee721b466c5927d109d4cb765861907d5417b9109caebc4e614679f1","visionModelIdentity":"qwen3-vl:2b-instruct@ea422f1e73652a95479954d8572d3c8c6022f628ce2d38a1a04aae1b7f2d5300","subjectAccepted":false,"accepted":false,"reasons":["Animal category mismatch: expected fox, detected wolf","Similarity below threshold or compatible embedding unavailable"]}`. In addition, `guard_refuses_wolf_for_fox_even_with_high_similarity` rejects a deterministic 0.99 similarity fixture, proving that high similarity cannot override the subject boundary.

8. **Human-readable rejection reasons.** Actual reason: `Animal category mismatch: expected fox, detected wolf`; missing/uncertain metadata, low confidence and low similarity have separate explanations. See actual forced-candidate and absent-subject transcripts in [acceptance results](evidence/acceptance.json).

9. **No confident match when nothing clears the bar.** Actual absent-octopus response: status `no confident match`, with 11 distinct reasons; example `Animal category mismatch: expected octopus, detected bear`. The negative is reported separately and cannot inflate positive precision.

10. **Required database models and indexes.** Three migrations define tenants, images, tags, posts, vectors, jobs, suggestions, reviews, calls, alerts and idempotency records; composite tenant foreign keys and owner/job/status indexes are present. Tests `tenant_reads_and_foreign_keys_prevent_cross_tenant_references` and `migrations_are_repeatable_without_losing_rows` pass.

11. **Validated APIs and approve/reject/inspect workflow.** Real separate demo-only posts exercised inspect, approve, reject and identical idempotent replay: `[{"action":"approve","reviewId":"62af9ff0-3e7c-4fc6-997c-2044dc63369e","replayIdentical":true},{"action":"reject","reviewId":"c1fc29b9-9666-405a-89f6-84e79c211d7f","replayIdentical":true}]`. These are automated acceptance actions, not claimed human approvals. See [review transcript](evidence/reviews.json). Boundary tests verify clean 400/401/404/409/413 responses; stale or flagged candidates cannot approve.

12. **Labeled held-out evaluation.** Frozen calibration similarity cutoff is `0.83`. Actual top-1 precision is **70.0% (7/10)**, including refusals as misses; coverage **70.0%**. Seven accepted images were correct; the other three positives were refused. AI-assisted visual labels were created before ranking. See [evaluation](evidence/evaluation.json), [calibration](evidence/calibration.json), and unchanged labeled data. No tuning was performed to improve the held-out result after reading it.

13. **Architecture and required submission files.** README contains architecture, exact run/seed commands, measured precision, model/protocol limits and image licensing. `DESIGN.md`, `capstone.yaml`, `BUILDLOG.md`, `.env.example`, license, migrations, tests and this evidence document are present. The dedicated repository was public before product implementation and retains meaningful phase commits. Final pack verification output is recorded below.

## Shared requirements

| Requirement | Pasted proof |
|---|---|
| Separate data/logic/HTTP layers | `src/data`, `src/services`, `src/http`, `src/jobs`, `src/ai`, `src/matching`; README architecture diagram |
| Bad input gives clean 4xx | `API_validates_boundaries_and_enqueues_without_inference` passed malformed JSON, IDs, content, size, auth and cross-tenant cases |
| Background retries and failure alert | `three_failed_attempts_create_one_failure_alert_and_no_fourth_attempt` passed; one persisted alert after three injected failures |
| Persistence, migrations, indexes, tenant isolation | Real DB restart: `Persistent probe written` -> `Persisted rows after DB restart: 1`; tenant reads/FKs reject cross-tenant access |
| Idempotency | Eight simultaneous requests created one durable post; changed payload gives 409; actual review replays returned identical data |
| Secrets | Local secrets are generated in ignored `.env`; tenant keys are hashed in storage; no published DB/Ollama ports; tracked files and Git history scanned for actual local secrets |
| Cost and budget guard | Actual call log above is $0; 20 concurrent reservations under a budget of 2 allowed only two and persisted one exhaustion alert |

## Focused verification

```text
npm test: 15 tests, 15 passed, 0 failed
docker compose --profile testing run --rm --no-deps test-runner npm run test:integration:
18 tests, 18 passed, 0 failed
```

Independent review findings were reproduced with failing tests before fixes: pool starvation, failed-post matching, competing species, stale embedding evidence, and the corresponding concurrent forced-check path. Calibration refuses unfinished/incompatible processing and uses fresh check keys. Immutable model digests and encoder input hashes are captured. Initial unsuccessful attempts remain in BUILDLOG and the archived evidence; they are not presented as passing results.

## Clean startup/seed reproduction

An independent tracked-source archive started with no secrets, dependencies, corpus or previous database. `node scripts/run.mjs` installed dependencies, generated fresh secrets, migrated a fresh PostgreSQL volume and exposed healthy HTTP on a separate localhost port. A temporary override disabled duplicate expensive model processing; actual default model provisioning and full inference are proved in the primary project above.

```text
Cold seed: images 50; categories animal/plant/landscape/architecture; downloaded 50; cached 0
Repeated seed: downloaded 0; cached 50
Fresh database after both seeds: images 50; posts 24; jobs 74; migrations 3
```

The 50 licensed JPEGs (about 1.62 MB) are now bundled as well as downloadable. Model caches/database volumes and seed state survive restarts. A clean rerun takes substantial CPU time, and generative outputs are not a guarantee of identical behavior on every platform; frozen model/input identities and honest limitations are documented.

## Final pack check

```text
npm run check:pack
{"images":50,"categories":["animal","plant","landscape","architecture"]}
Submission pack structure and measured README precision verified.
```
