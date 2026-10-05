# FlyRank image relevance capstone

Local image understanding, semantic image-to-post matching, and explained mismatch rejection.

Status: approved design; implementation in progress. This public repository was created before product code. Acceptance results and precision have not been measured yet.

See [DESIGN.md](DESIGN.md), the [approved specification](docs/superpowers/specs/2026-10-05-image-relevance-design.md), and the [implementation plan](docs/superpowers/plans/2026-10-05-image-relevance.md).

The stack is Node.js 24, Express, PostgreSQL 17, and local Ollama models. No paid cloud API is needed.

Current foundation run command (Node.js 24 and Docker Desktop required):

```sh
npm ci
node scripts/run.mjs
```

Startup creates an ignored `.env` with random local demo secrets if missing. The API exposes `GET http://localhost:3100/health`. Docker downloads local model files in the background; only the API publishes a port, bound to localhost. Seed, matching and evaluation are still under implementation.

```sh
npm test
```
