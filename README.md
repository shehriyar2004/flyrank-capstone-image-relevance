# FlyRank image relevance capstone

Local image understanding, semantic image-to-post matching, and explained mismatch rejection.

Status: backend implemented; actual CPU batch processing and acceptance evaluation in progress. This public repository was created before product code. Held-out precision has not been measured yet.

See [DESIGN.md](DESIGN.md), the [approved specification](docs/superpowers/specs/2026-10-05-image-relevance-design.md), and the [implementation plan](docs/superpowers/plans/2026-10-05-image-relevance.md).

The stack is Node.js 24, Express, PostgreSQL 17, and local Ollama models. No paid cloud API is needed.

Run command (Node.js 24 and Docker Desktop required):

```sh
node scripts/run.mjs
```

Startup creates an ignored `.env` with random local demo secrets if missing, installs host CLI dependencies if absent, builds the containers, and downloads the two local models. The API exposes `GET http://localhost:3100/health`. Only the API publishes a port, bound to localhost; database and model services remain internal. Leave the run command open and use a second terminal for seed and inspection.

```sh
npm run seed
```

Seed verifies/downloads 50 licensed images and enqueues their vision/embedding work plus 24 posts (10 calibration, 10 held-out positive evaluation, an absent-subject negative in each split, and two common/scientific-name demo posts). Rerunning seed replays the same idempotent actions. Actual inference can take more than an hour on CPU; watch job IDs in `.local/seed.json` through `GET /jobs/:id`. Downloads and processing need no cloud credentials, credit card, or paid API.

To start without attached logs after the first setup: `docker compose up -d --build`. To pause processing: `docker compose stop worker`; resume: `docker compose up -d worker`. These preserve database/model volumes. Do not use `down -v` if you want to retain results.

## Architecture and safety

```text
HTTP validation + tenant key -> services -> PostgreSQL repositories
                                      |
                             durable job queue
                                      |
                               separate worker
                       /                           \
             image -> vision -> tags         post -> intent
                        |                          |
                    embedding                  embedding
                       \                          /
                      stored vectors -> cosine ranking
                                             |
                            subject/confidence/similarity guard
                                             |
                                  suggestions -> approve/reject
```

Vision JSON is schema-validated; failed/invalid calls never become trusted tags. Confidence below 0.75 is flagged. A fox/wolf subject mismatch rejects a candidate even at high cosine similarity. No passing image returns `no confident match` with reasons. Scientific/common-name aliases help the guard, while genuine embeddings determine ranking. Model-generated captions/intent can be wrong, so human approval remains useful and rechecks current metadata.

Jobs use three attempts, exponential retry delays, renewable 60-second leases, stale-worker fencing, persistent progress, and exhaustion alerts. Every local inference attempt is attributed to tenant/job/entity with token usage when available and explicit monetary cost $0. The default atomic budget permits 1,000 attempts per tenant; it is a lifetime demo budget, not an automatically resetting daily quota.

All persistence access is tenant-scoped, with composite tenant foreign keys preventing cross-tenant references. `X-Tenant-Key` selects the authenticated tenant; arbitrary client tenant IDs confer no access. Demo A/B keys are generated locally in ignored `.env` and hashed in database storage. API responses and logs do not disclose keys.

## API

Use `X-Tenant-Key` from `.env` for all endpoints except health. Every POST also requires a unique `Idempotency-Key`; identical retries return their original response, and reuse with different data returns `409`.

| Method/path | Body or purpose |
|---|---|
| GET `/health` | Public health |
| POST `/images/batches` | `{ "imageIds": ["u5RZZJKM05E"] }`; manifest IDs only, returns 202 |
| GET `/images`, `/images/:id` | Inspect tags, flags, provenance ID |
| POST `/posts` | `{ "title": "Red fox behavior", "content": "An article about red foxes in woodland." }`; returns 202 |
| GET `/posts/:id/images` | Ranked guarded suggestions, rejections, or processing/no-match status |
| POST `/posts/:id/images/check` | `{ "imageId": "UUID" }`; force a candidate through the guard |
| GET `/suggestions/:id` | Inspect stored explanation snapshot |
| POST `/suggestions/:id/reviews` | `{ "action": "approve" }` or `{ "action": "reject", "explanation": "Wrong scene" }` |
| GET `/jobs/:id` | Progress, attempts, safe failure code |
| GET `/costs`, `/alerts` | Attributed calls, remaining call budget, failures |

Lists support `limit=1..100` and `offset`; missing credentials give 401, other-tenant IDs give 404, and bad boundary data gives clean 4xx responses. Image URLs/file paths are not accepted from callers.

## Evaluation and verification

Labels were created by AI-assisted visual inspection before model rankings, with a single justified image per positive post. Expected image IDs never enter runtime ranking or provider prompts. Calibration and held-out evaluation use separate positive posts. Refusals count as misses in positive top-1 precision; negative refusal is reported separately. The current threshold is explicitly uncalibrated until the actual batch is complete.

Once jobs finish:

```sh
npm run calibrate
docker compose up -d --build app
npm run evaluate
npm run probe
```

Calibration searches cutoffs using calibration data only and freezes the selected configuration. Evaluation cannot modify that configuration. Actual top-1 precision and coverage will be reported here after the batch completes, including misses.

```sh
npm test
docker compose --profile testing run --rm --no-deps test-runner npm run test:integration
```

Deterministic provider fixtures are explicitly confined to tests; live evidence comes from actual Ollama calls. See `EVIDENCE.md` for verified transcripts and honest pending items, and `BUILDLOG.md` for AI assistance, mistakes, and corrections.

## Limitations

- This is a local capstone demo, with a small visually labeled corpus and a controlled subject taxonomy. It is not a production authentication service or an unrestricted image ingestion platform.
- Small-model confidence is self-reported, not a calibrated probability. Classification errors and unsupported subject aliases can cause false refusals.
- CPU vision inference is slow, and downloading Docker/model files needs several GB of disk and network transfer. Invalid output is retried rather than filled with invented facts.
- API keys are required even though the HTTP port is local. Database/Ollama services are not publicly exposed. Paid providers are rejected by configuration.
- Source photographs retain the [Unsplash license](https://unsplash.com/license); MIT applies to application code, not the corpus. See [attribution](data/ATTRIBUTION.md).
- FlyRank decides acceptance asynchronously. A completed or submitted repository does not itself guarantee a certificate.
