# Parallax — build progress

Specification: parallax-spec.md (repo root, authoritative)
Every session: read this whole file before starting, update it before committing.

## Steps

- [ ] Step 1 — repo scaffold, config, workflow skeleton
- [ ] Step 2 — GDELT pipeline and episode detection
- [ ] Step 3 — remaining fetchers, confidence, snapshots
- [ ] Step 4 — frontend shell and wireframe map
- [ ] Step 5 — situation detail panel and drill-down
- [ ] Step 6 — context layer and supporting readouts

## Toolchain

Pipeline: TypeScript on Node (see spec §2)
Frontend: Vite + TypeScript (see spec §7)
Package manager: <record which, once chosen>
Node version: <record>

## Commands

Install:            <command>
Run pipeline local:  <command>
Run frontend local:  <command>
Build frontend:      <command>
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

GitHub Pages: <configured? which branch and path?>
Data branch: <exists? what is in it?>

## File map

Short list of what exists and what each part is responsible for. Keep it to
one line per module. This saves the next session from reading everything.

## Session log

Append one entry per session. Newest at the bottom.

### Step N — <date>

Completed: <yes | partially — exactly where work stopped>
Built: <files and modules created or changed>
Decisions: <choices a later step must follow, e.g. field names, file formats>
Deviations from spec: <anything different, and why>
API surprises: <endpoints, params, or response shapes that differed from docs>
Verification: <which checks ran, and their actual results>
Next session should know: <the one or two things most likely to trip it up>
