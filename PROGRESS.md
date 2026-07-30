# Parallax — build progress

Specification: parallax-spec.md (repo root, authoritative)
Every session: read this whole file before starting, update it before committing.

## Steps

- [x] Step 1 — repo scaffold, config, workflow skeleton
- [ ] Step 2 — GDELT pipeline and episode detection
- [ ] Step 3 — remaining fetchers, confidence, snapshots
- [ ] Step 4 — frontend shell and wireframe map
- [ ] Step 5 — situation detail panel and drill-down
- [ ] Step 6 — context layer and supporting readouts

## Toolchain

Pipeline: TypeScript on Node (see spec §2)
Frontend: Vite + TypeScript (see spec §7)
Package manager: npm 11.x (lockfile version 3)
Node version: 24.x (CI and minimum supported; local verification used 26.5.0)

## Commands

Install:             npm ci
Run pipeline local:  npm run pipeline -- --output-dir generated-data
Run frontend local:  npm run frontend (Step 1 handoff; implementation begins in Step 4)
Build frontend:      npm run build:frontend (Step 1 handoff; implementation begins in Step 4)
Trigger workflow:    gh workflow run refresh.yml

## Repository secrets

| Secret | Needed by | Configured |
|---|---|---|
| FRED_API_KEY | Step 3 | no |
| FIRMS_MAP_KEY | Step 3 | no |
| CLOUDFLARE_API_TOKEN | Step 3 | no |

If a secret is missing when a step needs it, say so plainly and stop rather
than stubbing the source out silently.

## Deployment

GitHub repository: https://github.com/isr431/parallax (public)
GitHub Pages: not configured; Step 4 deploys the Vite site from main
Data branch: exists; `latest/` contains placeholder situations, context, prices,
and status JSON; `snapshots/` contains `.gitkeep` until Step 3

## File map

- `shared/types.ts` — authoritative situation, context, price, evidence, and pipeline-health contracts shared by pipeline and site.
- `pipeline/index.ts` — failure-isolated pipeline runner and placeholder JSON aggregation.
- `pipeline/types.ts` — fetcher, output, and watchlist contracts.
- `pipeline/lib/http.ts` — HTTP fetch helper with timeout, retry, and exponential backoff.
- `pipeline/lib/files.ts` — JSON read/write helpers.
- `pipeline/lib/status.ts` — per-source health recording that preserves the prior `last_success` on failure.
- `pipeline/lib/watchlist.ts` — YAML watchlist loader with structural validation.
- `pipeline/sources/*.ts` — one isolated stub module for each of the five pinned sources.
- `pipeline/index.test.ts` — partial-success regression test.
- `watchlist.yaml` — six real country, pair, and topic examples with observed and priced applicability mappings.
- `.github/workflows/refresh.yml` — three-hour cron/manual pipeline run and commit to the `data` branch.
- `site/README.md` — Step 4 frontend handoff; no frontend implementation exists yet.

## Session log

Append one entry per session. Newest at the bottom.

### Step 1 — 2026-07-31

Completed: yes
Built: public GitHub repository; orphan `data` branch; npm/TypeScript scaffold;
shared model contracts; six-entity watchlist; five isolated source stubs; retry,
file, watchlist, and status helpers; local partial-failure test; scheduled/manual
refresh workflow that carries forward current health before committing outputs.
Decisions: npm with its committed lockfile; Node 24.x in CI; source identifiers
are `gdelt`, `cloudflare`, `usgs-gdacs`, `firms`, and `fred`; local output defaults
to `generated-data/`; `status.json` is `{generated_at, sources}` and each source
record is `{source, last_success, last_error, records}`; data-branch directories
sit at branch root as `latest/` and `snapshots/`.
Deviations from spec: none. Frontend run/build scripts are explicit handoff
placeholders because the Vite frontend is not introduced until Step 4.
API surprises: no source APIs were called in Step 1. GitHub deprecated the
Node 20 runtime used by `actions/checkout@v4` and `actions/setup-node@v4`; the
workflow uses v5 of both actions.
Verification: repo-root spec is byte-identical to the supplied file; `npm run
build` passed; `npm test` passed 1/1; normal local placeholder generation passed;
`PARALLAX_FAIL_SOURCE=firms npm run pipeline -- --output-dir generated-data`
completed and wrote four healthy sources plus the FIRMS error; manual Actions
run 30587521379 established a healthy baseline; manual Actions run 30587552505
then deliberately failed FIRMS yet completed green and committed data branch
commit `c06bbc9`. Its `status.json` preserved FIRMS `last_success` from the prior
run, recorded `Intentional firms stub failure`, and marked the other four
sources successful.
Next session should know: replace only the GDELT stub in Step 2 and extend the
shared contracts rather than redefining them. The latest data commit intentionally
shows FIRMS unhealthy as proof of partial success; the next ordinary refresh
will clear that test condition.
