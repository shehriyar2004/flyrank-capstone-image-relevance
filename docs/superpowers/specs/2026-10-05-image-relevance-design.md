# FlyRank image relevance capstone — design

Status: baseline approved by the user on 2026-10-05; implementation refinements and real outcomes are recorded in BUILDLOG.md.

## Purpose and scope

Build the Backend AI Engineering capstone described in **AI Image Understanding Live Capstone.pdf**: understand licensed images through a real vision model, rank them against posts using real embeddings, and refuse unsafe pairings. Completion means reproducible evidence for every core and shared requirement, followed by FlyRank's acceptance; it does not mean a guaranteed certificate immediately after submission. The portal currently records five Backend assignments submitted.

Use Node.js 24, Express, Zod, PostgreSQL 17, and Docker Compose. Run local Ollama with `qwen3-vl:2b-instruct` for image understanding and post subject extraction, and `embeddinggemma:300m` for embeddings. The official model downloads are approximately 1.9 GB and 622 MB respectively. CPU inference is the portable default; performance and classification quality must be measured on this computer. No cloud key, payment, or credit card is needed. Non-goal: a public image platform or a full frontend.

## Layers and flow

```text
HTTP + boundary validation -> application services -> PostgreSQL repositories
                                      |
                               durable job queue
                                      |
                            separate worker process
                          /                         \
                image bytes -> vision        post -> subject extraction
                       |                              |
              validated tags/caption          validated subject intent
                       |                              |
                   embedding                      embedding
                          \                         /
                         stored vectors -> cosine ranking
                                             |
                              subject/confidence/similarity guard
                                             |
                                  suggestions or safe refusal
                                             |
                                     approve/reject API
```

HTTP requests enqueue slow work and return `202` with job IDs. A separate worker claims jobs with PostgreSQL locking, a renewable lease, and at most three attempts with exponential backoff. Expired leases recover after a crash. Exhausted jobs create a persistent failure alert. Progress, attempts, and safe error descriptions are inspectable. Completed stages are reusable after retries; no duplicated images, vectors, suggestions, or review actions.

## Data, isolation, and boundaries

Migrations define tenants, images, image tags, posts, embeddings, jobs, suggestions, review decisions, AI call records, and alerts. Tenant-scoped unique constraints and composite foreign keys prevent cross-tenant references; indexes cover job claiming, tenant/status filtering, vectors' owners, and review lookups. Every repository operation requires a tenant identity. Tenant API keys come from the ignored environment file, are hashed for verification, and never appear in logs. A second demo tenant proves isolation; arbitrary client-supplied tenant IDs confer no access.

Image intake references only files from the seeded corpus manifest, not arbitrary URLs or filesystem paths. The reproducible downloader accepts approved image hosts and verifies sizes and content hashes. JSON bodies have size limits; IDs, content, batch sizes, pagination, and review actions are validated. Invalid input returns a clean `4xx`; missing credentials return `401`, foreign tenant resources return `404`, and idempotency-key reuse with a different payload returns `409`.

## AI output and matching rules

Vision metadata is a strict object with `subject`, `category`, `attributes`, `caption`, and finite `confidence` between zero and one. Reject malformed JSON and unknown fields; retry invalid output, then flag failure. Preserve provenance, model version, prompt version, and the real response needed for evidence. Do not replace failures with invented tags. Flag confidence at or below `0.75`, unknown subjects, and ambiguous primary subjects. Model confidence is self-reported and not a calibrated probability; disclose that limitation.

Store finite, nonzero embedding vectors with their model and dimension. Compare only compatible vectors with cosine similarity. Ranking uses model-derived captions and post text, never filenames, expected evaluation labels, or hardcoded image IDs. Subject intent comes from the same local vision-language model's text capability. A declared scientific-name dictionary adds known common-name meaning to the post's embedding input when the model preserves a Latin name; original intent and article text are retained. The vector model computes genuine scores from the enriched text and image captions. A separate small taxonomy normalizes subjects for the guard. Neither dictionary selects image IDs or assigns similarity scores.

The standalone guard rejects unavailable/flagged metadata, low confidence, incompatible subjects, and similarity below the calibrated threshold. A fox post paired with a wolf must return `Animal category mismatch: expected fox, detected wolf`. Ambiguous post intent is refused rather than guessed. Apply the guard before suggesting and again before approval. Store the score, thresholds, metadata versions, and human-readable reasons with each decision. No passing candidate returns `no confident match` plus reasons; a post still processing returns a distinct processing status.

## API and operational controls

Expose `GET /health`, `POST /images/batches`, `GET /images`, `GET /images/:id`, `POST /posts`, `GET /posts/:id/images`, `POST /posts/:id/images/check`, `POST /suggestions/:id/reviews`, `GET /jobs/:id`, `GET /costs`, and `GET /alerts`. The check endpoint permits the evaluator to force the wolf candidate without bypassing the guard. Review decisions accept `approve` or `reject` and an optional explanation. Mutating requests require an idempotency key, scoped to tenant and operation, with a payload hash.

Record every vision, post-analysis, and embedding attempt, including invalid output and failed transport calls: tenant, job, entity, provider/model, attempt, duration, token usage when available, status, and cost. Local provider monetary cost is explicitly `$0`; unknown usage remains unknown. Enforce a zero-dollar provider policy plus a configurable per-tenant call budget (initially 1,000 attempts), reserving budget atomically before each call. Exhaustion blocks further inference and raises an alert. Bind the app to localhost port `3100`; database and Ollama remain internal to Compose. Logs exclude credentials and authorization headers.

## Corpus, evaluation, and evidence

Gather 50 distinct free Unsplash/Pexels photographs, including foxes, wolves, dogs, bears/deer and at least four broad categories: animals, plants, landscapes, and architecture. Include a genuinely ambiguous image for the low-confidence probe. Record photographer, source page, download URL, license, SHA-256, and any transformation. Keep images small or provide a reproducible download script; never invent provenance. Independently inspect images to create labels, record AI assistance honestly, and keep labels out of runtime matching.

Use separate labeled calibration and evaluation posts: at least ten in each, with one visually justified correct image per positive post. Include scientific/common-name equivalence, fox/wolf confusion, and an absent-subject refusal case. Select the similarity threshold using calibration positives and negatives, freeze it, then report held-out top-1 precision (`correct first accepted image / all positive evaluation posts`), including refusals as misses. Also report coverage and absent-subject behavior. Publish the measured result, even if imperfect; never manufacture scores or tune on held-out labels.

Verify schema rejection, actual low-confidence flagging, worker retries/recovery, atomic budget limits, idempotency, tenant isolation, review decisions, and all six acceptance probes. Use deterministic provider fixtures only in explicitly labeled tests. Acceptance evidence must show real local vision and embedding calls, actual corpus outputs, and measured evaluation results. If the local model proves unsuitable, pause for a disclosed alternative rather than silently substitute mocked live results.

## Delivery and submission

Use a dedicated public GitHub repository named `flyrank-capstone-image-relevance`, created before product implementation once publication is authorized. Commit this design there first, followed by meaningful commits for pipeline, matching, and production/evaluation phases. Do not place the capstone in either assignment repository.

Provide MIT-licensed application code, image attribution/licensing separately, `.gitignore` before the first commit, `.env.example`, migrations, Compose configuration, run/seed/evaluation commands, `README.md`, `capstone.yaml`, `EVIDENCE.md`, and an honest `BUILDLOG.md`. The documented run entry point creates an ignored local environment with generated demo secrets when needed and starts Compose; seed imports the manifest and queues processing. Model download and CPU inference delays are documented. Keep main runnable and secrets out of all commits. Submit only the finished repository URL through the portal after the project and evidence are reviewable and submission is authorized.

## References

- Supplied brief: `C:\Users\pc\Downloads\AI Image Understanding Live Capstone.pdf`.
- Portal capstone: https://internship.flyrank.ai/intern/assignments/CUSTOM-MQYC2OKX-00A4F545
- Certificate requirements: https://internship.flyrank.ai/intern/completion
- Vision model: https://ollama.com/library/qwen3-vl:2b-instruct
- Embedding model: https://ollama.com/library/embeddinggemma
- Structured output: https://docs.ollama.com/capabilities/structured-outputs
- Image licenses: https://unsplash.com/license and https://www.pexels.com/license/
