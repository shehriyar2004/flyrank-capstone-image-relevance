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
