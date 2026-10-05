# Capstone evidence

Status: deterministic/backend checks verified; real full-corpus batch and held-out acceptance results still processing. Pending items below are not claimed as passed.

## Verified component checks

```text
npm test
tests 12; pass 12; fail 0

docker compose --profile testing run --rm --no-deps test-runner npm run test:integration
tests 11; pass 11; fail 0

npm run seed (replayed)
{"images":50,"categories":["animal","plant","landscape","architecture"]}
{"downloaded":0,"cached":50}
{"queuedImages":50,"queuedPosts":22}
```

1. **Structured vision and invalid-output rejection:** `vision_schema_rejects_untrusted_shape_and_confidence`, `invalid_vision_output_retries_without_trusted_tags`, and `real_provider_boundary_accounts_for_invalid_output_and_failed_transport` passed. A real local response plus a real 768-dimensional embedding are recorded in `evidence/model-smoke.json`. Invalid original thinking-model smoke responses were rejected and their failed calls remain attributed.
2. **Low-confidence flag:** actual instruction-model metadata returned confidence 0.7 and image status `flagged`, not `ready`; see `evidence/model-smoke.json`. `staged_retry_reuses_valid_tags_and_keeps_low_confidence_flagged` also passes with an explicitly labeled 0.74 test fixture.
3. **Background batch and retries:** `queue_deduplicates_jobs_and_recovers_expired_leases_with_fencing` and `three_failed_attempts_create_one_failure_alert_and_no_fourth_attempt` pass against PostgreSQL. HTTP intake returns 202 without inference. Actual full 50-image completion remains pending.
4. **Per-call costs:** actual vision/embedding records in `evidence/model-smoke.json` show attributed tenant/job/entity, usage, duration and `cost_usd: 0.000000`. Final all-call export remains pending batch completion.
5. **Stored embeddings/ranked suggestions:** real 768-dimensional image embedding is stored; `semantic_aliases_and_cosine_ranking_do_not_depend_on_filenames` and review integration pass. Actual corpus ranked results pending.
6. **Semantic equivalence:** `Vulpes vulpes`/red fox guard alias tests pass; held-out real semantic ranking probe pending.
7. **Wolf-on-fox mismatch:** `guard_refuses_wolf_for_fox_even_with_high_similarity` passes with similarity 0.99 and reason `Animal category mismatch: expected fox, detected wolf`. Actual forced-wolf API transcript pending post/corpus processing.
8. **Human-readable rejection:** guard tests verify nonempty reasons for mismatch, uncertainty, low confidence, unavailable embeddings and low similarity. Actual refusal transcript pending.
9. **No confident match:** implemented response and processing distinction; absent-octopus real probe pending.
10. **Database models/indexes:** migrations define all required entities, owner indexes and tenant foreign keys. `tenant_reads_and_foreign_keys_prevent_cross_tenant_references` and `migrations_are_repeatable_without_losing_rows` pass.
11. **Boundary validation and review:** `API_validates_boundaries_and_enqueues_without_inference` and `review_rechecks_metadata_and_is_terminal_and_idempotent` pass; validation gives clean 400/401/404/409/413 responses, and a newly flagged candidate cannot be approved. Real review transcript pending processed suggestions.
12. **Labeled measured evaluation:** 10 calibration and 10 held-out positive posts are independently visually labeled in `data/`; `precision_counts_refusals_as_misses_and_keeps_negatives_separate` passes. Actual precision pending.
13. **Architecture and pack:** README diagram/run/seed steps, design, manifest, build log, safe environment example and MIT license are present. Final pack/secret-history check pending.

## Shared requirements

| Requirement | Current proof |
|---|---|
| Layered architecture | Separate HTTP, services, repositories, worker and AI/matching modules; README diagram |
| Boundary 4xx | API integration above passes malformed JSON, UUID, content, size and cross-tenant cases |
| Background retries/failure alert | Three failed attempts create one persistent alert; no fourth attempt; PostgreSQL queue tests pass |
| Persistence/migrations/indexes/isolation | Schema tests pass; real restart transcript: `Persistent probe written` then `Persisted rows after DB restart: 1` |
| Idempotency | Eight concurrent retries create one durable post; conflicting payload gives 409; repeated seed reuses IDs |
| Secrets | Generated ignored `.env`; hashed tenant keys; localhost-only API; no published database/model ports; final tracked/history scan pending |
| Cost and budget guard | Local costs above; `concurrent_budget_reservations_allow_two_calls_and_preserve_attribution` passes 20 competing reservations under budget 2, with one exhaustion alert |

Fixtures/failure injection are used only for deterministic component tests and explicitly described here. They are not presented as live model evidence. Final acceptance transcripts will replace the pending annotations after the actual batch finishes.
