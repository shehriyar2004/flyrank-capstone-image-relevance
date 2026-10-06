# One-page design: image relevance engine

**Problem.** Match article meaning to an image library while refusing unsafe recommendations. A red-fox post should surface a red fox and reject a wolf. Uncertainty must remain visible rather than turn into invented metadata.

**Scope.** Fifty licensed images from at least four broad categories, including confusing animal species; one local vision model (`qwen3-vl:2b-instruct`), one local embedding model (`embeddinggemma:300m`), and at least ten independently labeled posts in each of separate calibration/evaluation sets. A full frontend is an explicit non-goal.

**Layers and flow.** Express validates and authenticates tenant requests, services apply business rules, and repositories use PostgreSQL. HTTP creation endpoints enqueue persistent jobs and return `202`. A separate worker interprets actual image bytes, validates strict JSON tags/captions/confidence, extracts post subject intent, and creates genuine embeddings. Stored vectors meet at cosine ranking, followed by the guard and an approval/rejection API.

```text
image bytes -> vision -> validated metadata -> embedding --+
                                                         +-> cosine -> guard -> review
post text -> intent + embedding --------------------------+
             PostgreSQL queue, retries, progress, call accounting
```

**Data model.** Tenant-scoped images, tags, posts, embeddings, jobs, suggestions, reviews, inference calls, alerts, and idempotency records. Composite tenant foreign keys prevent cross-tenant references; indexes support job claiming, status queries, and ownership lookups. Secrets come from ignored local environment files and are never logged. Tenant keys are hashed in storage.

**Guard.** Reject invalid/unavailable metadata, confidence at or below `0.75`, ambiguous subject intent, incompatible subjects, and cosine similarity below the calibrated threshold. Scientific/common-name normalization supports `Vulpes vulpes`/red fox without determining vector scores. A forced wolf candidate must explain `Animal category mismatch: expected fox, detected wolf`. No passing image returns `no confident match` with reasons. Approval rechecks eligibility against current metadata.

**API surface.** Health; image batch intake/list/detail; post creation and ranked image lookup; forced-candidate checking; suggestion reviews; job progress; cost records; failure alerts. Mutations are idempotent. Slow inference never blocks the request path. Invalid input produces clean `4xx` responses.

**Reliability and measurement.** Workers claim with locking, renewable leases and fencing, retry at most three attempts, reuse completed stages, and persist exhaustion alerts. Every real inference attempt is attributed, including failures. Local monetary cost is zero; an atomic 1,000-call tenant budget prevents runaway work. Calibrate without evaluation labels, freeze the threshold, then report held-out top-1 precision and coverage honestly. Model confidence is self-reported, not calibrated probability.

**Delivery.** Reproducible Docker startup/seed commands; real corpus attribution and hashes; migrations; `capstone.yaml`, `EVIDENCE.md`, `.env.example`, README architecture/limitations, and honest AI-assisted `BUILDLOG.md`. The repository is public from day one. Submit its URL only after implementation and proofs are reviewable; certification depends on FlyRank's acceptance.

