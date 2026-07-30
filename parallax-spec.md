# Parallax — build specification

A single-screen, geopolitics-first situational-awareness dashboard for one user. Free-tier only: no paid APIs, no servers, no database service.

This document is the complete and only specification. Where it says "verify against current docs," check the source's live documentation before implementing, because endpoint details drift.

**Framing:** this is a monitor of *where the world's attention is moving, cross-checked against independent evidence* — not a monitor of what is objectively happening. Coverage volume measures journalism, not reality. Every design decision below follows from that distinction.

**The name is the method.** Parallax is depth perception from two viewpoints. The three evidence layers (§3.3) are the viewpoints, and the depth they produce is confidence. Where the viewpoints disagree, that disagreement is the finding — which is why divergence is the most prominent state in the interface rather than an error to suppress.

---

## 0. Working protocol — read this first

The build is divided into six sequential steps, defined in §10. **Each step runs in a fresh session with no memory of any previous session.** You cannot ask a previous session anything. The repository and the files in it are the entire handoff — if something is not written down, it does not exist.

Two consequences shape everything below: state must be recorded in files rather than assumed, and choices that later steps depend on must be pinned rather than left to judgement.

### At the start of every session, before writing any code

1. Read this entire document.
2. Confirm this document exists at the repository root as `parallax-spec.md`. If it does not, commit it there before doing anything else. Later sessions depend on finding it in the repo.
3. Read `PROGRESS.md` at the repository root.
   - If it does not exist, create it from the template in §10 and begin at Step 1.
   - If it does exist, find the lowest-numbered step not marked complete and begin there.
4. Read the whole session log in `PROGRESS.md`, not only the most recent entry. It is the only record of what was actually built and what deviated from this spec.
5. Skim the files the previous steps created before adding to them. Match the existing structure, naming, and style rather than introducing a parallel way of doing things.

### Rules for the session

- **Complete exactly one step, then stop.** Do not begin the next step even if capacity appears to remain. The user starts each session deliberately.
- **Do not refactor, restructure, or "improve" work from completed steps.** The only reason to touch earlier code is a failing verification check in the current step. Cold sessions are prone to rewriting things they simply do not recognise — resist this.
- **Do not add dependencies, sources, or features beyond what the current step names.** §5 and §10 are exhaustive.
- If this document and the existing code genuinely conflict, follow this document and record the conflict in `PROGRESS.md`.

### At the end of every session

1. Run that step's verification checks. A step is not complete until they pass. Fix failures inside the current step rather than deferring them.
2. Mark the step complete in `PROGRESS.md` and fill in a session log entry using the structure in the template.
3. Update the environment and commands sections of `PROGRESS.md` if anything changed.
4. Commit with the message `step N: <short description>`.

A step left half-finished is fine as long as `PROGRESS.md` says so — leave the checkbox unticked and record exactly where you stopped in the log. The next session resumes from that note.

---

## 1. Locked design decisions

Do not revisit these. They were settled deliberately with the user.

| Decision | Choice | Rationale |
|---|---|---|
| Focus | Geopolitics first; infrastructure and markets are supporting layers | User preference |
| Infrastructure | GitHub Actions cron + static frontend on GitHub Pages | Free, zero-maintenance |
| Storage | JSON files committed to a `data` branch of the same repo | Zero infra; git history doubles as a replay archive |
| Ingestion model | **Query-driven, not stream-driven.** Query APIs per watchlist entity; never bulk-ingest global streams | Makes free-tier feasible and removes the clustering problem entirely |
| Scope | Watchlist of 5–10 entities, plus a dim non-interactive global context layer | User preference |
| Sources | Exactly five pipelines (§5) | Every source is a dependency that can fail silently |
| Visual idiom | Command centre: cool grey, hairline rules, monospace, one alarm colour (§8) | Aesthetics are a primary goal, not a finishing step |
| Map rendering | Wireframe country outlines via `d3-geo` and inline SVG; no tiles, no map library | Best-looking option *and* the fewest dependencies |
| Motion | Still, except a pulse on divergence situations only | Motion carries information or it does not exist |
| Build shape | Six sequential steps (§10), one per session | Fits capacity limits; each step ends in a working state |

---

## 2. Architecture

```
GitHub repo (public → free unlimited Actions minutes)
│
├─ .github/workflows/refresh.yml      # cron: every 3h + workflow_dispatch
├─ pipeline/                          # TypeScript on Node, one module per source
├─ site/                              # static frontend (Vite + d3-geo)
├─ watchlist.yaml                     # user config (§4)
├─ parallax-spec.md                   # this document, committed in Step 1
├─ PROGRESS.md                        # build state (§0, §10)
│
└─ branch: data
   ├─ latest/
   │   ├─ situations.json             # current situation objects (§3)
   │   ├─ context.json                # global context layer (§6)
   │   ├─ prices.json                 # FRED series for mapped instruments
   │   └─ status.json                 # per-source pipeline health (§2.1)
   └─ snapshots/YYYY-MM-DD/           # daily copy of latest/
```

**Language is pinned: TypeScript on Node for both pipeline and frontend.** One toolchain, one `package.json`, one set of types shared between the pipeline that writes the JSON and the frontend that reads it. This matters more than usual here, because separate sessions build the pipeline and the frontend and must not diverge on tooling. Define the situation, context, and status shapes as exported types in a shared location, and import them on both sides.

**Flow:** the workflow runs all five fetchers → computes baselines, episodes, and confidence → writes `latest/` and, once per day, a dated snapshot → commits to the `data` branch.

The frontend deploys to GitHub Pages from `main` and reads JSON from `raw.githubusercontent.com/<repo>/data/latest/...`, which is served with permissive CORS. API keys (FIRMS, FRED, Cloudflare) live in Actions secrets. The frontend never touches a key and never calls a third-party API directly.

### 2.1 Pipeline health is a feature, not plumbing

Every fetcher writes `{source, last_success, last_error, records}` into `status.json`. The dashboard's top strip renders one health dot per source plus the last sync time. A silently rotting source must be visible at a glance — this is the "show the work" principle applied to the tool itself.

If a fetch fails, the workflow still commits everything else. Partial success, never all-or-nothing. Panels backed by stale data show a badge with the age of that data rather than presenting it as current.

---

## 3. Core model

### 3.1 The situation object

A situation is a **detected episode of unusual attention on a watchlist entity**. There is no NLP clustering and no entity resolution anywhere in this system.

```json
{
  "id": "2026-07-12-countryX-countryY",
  "watchlist_ref": "countryX-countryY",
  "name": "Elevated coverage: X–Y relations",
  "opened": "2026-07-12",
  "last_active": "2026-07-29",
  "status": "open | decaying | closed",
  "coverage": { "current_ratio": 3.1, "baseline": 0.042, "timeline_90d": [] },
  "layers": {
    "reported": { "state": "strong", "evidence": [] },
    "observed": { "state": "not_applicable | none | present", "evidence": [] },
    "priced":   { "state": "not_applicable | none | moved", "evidence": [] }
  },
  "confidence": { "rating": "solid", "explanation": "" },
  "summary": ""
}
```

`evidence` arrays hold objects carrying at minimum a source name, a URL where one exists, a timestamp, and a short label. Everything rendered in the interface must trace back to one of these entries.

### 3.2 Episode detection

Per watchlist entity, per pipeline run:

1. Fetch the entity's **normalized** coverage-volume timeline for the last 90 days from GDELT. Normalization means share of all global coverage, which GDELT computes server-side. This is the per-entity baseline mechanism, obtained for free — do not compute baselines from raw counts.
2. Baseline = median of the trailing 60 days, excluding the most recent 7.
3. **Open** a situation when the 3-day mean reaches 2.5× baseline or above. The multiplier is configurable per entity.
4. While a situation is open, refresh all evidence layers each run. Mark it **decaying** after 3 consecutive days below 1.5× baseline, and **closed** after 5.
5. Closed situations remain in snapshots but leave `latest/`.
6. A fresh spike on the same entity within 7 days of closure reopens the same situation rather than creating a new one.

Store tone alongside volume. A volume spike with sharply negative tone reads differently from a neutral one, and the detail panel shows both.

### 3.3 Confidence with per-layer applicability

Most geopolitical situations can never produce physical evidence, and not every situation has a sensible market mapping. **A layer that cannot apply must never drag the rating down.**

A layer is `not_applicable` when the watchlist entry defines no observed-source region or no price mapping for that entity, or when the situation has no plausible physical signature.

| Applicable layers agreeing | Rating |
|---|---|
| Reported only, others not applicable | Reported-only |
| Reported only, others applicable but silent | Unconfirmed |
| Reported plus one independent layer | Solid |
| All applicable layers aligned | Strong |
| Reported spike, but the mapped market moved the opposite way or not at all | **Divergence** |
| Observed signal with no corresponding reporting spike | **Divergence** |

Divergence is the most valuable output of this tool, not an error state. It renders most prominently. Every rating expands on click into exactly which layers contributed what, with sources and timestamps.

---

## 4. Watchlist config

`watchlist.yaml` in the repo root. Editing this file and pushing is the entire management interface — there is no in-app editing.

```yaml
entities:
  - id: countryX
    type: country
    gdelt_query: 'sourcecountry:XX OR "Country X"'
    threshold: 2.5
    firms_bbox: [lon1, lat1, lon2, lat2]   # optional → observed layer applicable
    radar_location: XX                     # optional, Cloudflare Radar country code
    fred_series: [DEXUSXX]                 # optional → priced layer applicable
  - id: countryX-countryY
    type: pair
    gdelt_query: '"Country X" "Country Y"'
    fred_series: [DCOILBRENTEU, DEXUSXX]
  - id: strait-shipping
    type: topic
    gdelt_query: '"Strait of Z" (shipping OR tanker OR blockade)'
```

The presence or absence of `firms_bbox` / `radar_location` / `fred_series` is what determines layer applicability in §3.3.

The `fred_series` list **is** the situation-to-instrument mapping, and it is deliberately manual. Automatically inferring which instrument responds to which event is unreliable, and the priced layer is context rather than signal.

---

## 5. Sources — exactly five pipelines

| # | Source | Layer | Access | Notes |
|---|---|---|---|---|
| 1 | **GDELT DOC 2.0 API** (`api.gdeltproject.org/api/v2/doc/doc`) | Reported | No key | Modes: `timelinevol` (normalized volume), `timelinetone`, `artlist` (top articles). One query per watchlist entity per run. The backbone of the whole tool. |
| 2 | **Cloudflare Radar** (annotations / outages) | Observed | Free API token | Internet shutdowns and outages with likely cause — a strong geopolitical signal. Filter to watchlist countries. Verify against current docs. |
| 3 | **USGS + GDACS** (USGS GeoJSON day feed; GDACS RSS) | Observed + context | No key | Earthquakes and multi-hazard disaster alerts. Cheap, reliable, no auth. |
| 4 | **NASA FIRMS** area API | Observed | Free MAP_KEY | Thermal anomalies per watchlist bounding box. Underrated for conflict monitoring, since shelling and burning appear as fire clusters. Rate-limited: query only watchlist boxes and cache aggressively. |
| 5 | **FRED** (`api.stlouisfed.org/fred/series/observations`) | Priced | Free key | Daily FX and commodity series per the `fred_series` mapping. Daily cadence matches the tool's rhythm. |

**Do not add sources.** Deliberately excluded, with reasons: ACLED and UCDP (update too slowly for a live monitor, and ACLED has access friction), OpenSky and AISStream (weak free tiers, high effort for marginal signal), Finnhub (intraday data adds nothing at a 3-hour refresh), NVD and CISA KEV (cyber is not the focus here).

---

## 6. Global context layer

A dim backdrop so the map is not empty outside the watchlist. Three inputs: GDACS active alerts, USGS earthquakes of M5 and above, and the top ~20 global hotspots from the **GDELT GEO 2.0 API** (`api.gdeltproject.org/api/v2/geo/geo`, geojson format).

Context markers are rendered small and dim, expose tooltips only, and are strictly inert: they never open a situation, never contribute to any confidence rating, and never alert. One fetch each per run, written to `context.json`.

---

## 7. Frontend layout

**Stack:** Vite plus vanilla TypeScript. No framework is needed at this size. **No map library and no tile provider.**

The map is inline SVG: `d3-geo` projects a bundled Natural Earth 110m countries file (public domain, from the `world-atlas` package, committed as a static asset) into hairline `<path>` outlines. This means no WebGL, no runtime map dependency, no attribution requirement, and exact control over stroke weights — which is what makes the wireframe aesthetic work. Use `d3-zoom` for pan and zoom, and `geoNaturalEarth1` or `geoEquirectangular` for the projection.

> If deep zoom or thousands of simultaneous points are ever needed, MapLibre or deck.gl becomes the right choice. At 20–30 situations, SVG is both simpler and better-looking.

One screen. No routes, no navigation. Panels float over the edge-to-edge map as translucent glass.

| Region | Contents |
|---|---|
| Top strip | Watchlist search and filter, UTC clock, per-source health dots (§2.1), last sync time |
| Left rail | Layer toggles: situations, observed overlays (fires, outages, quakes), context layer |
| Centre | The map. Situations as dots: **colour encodes confidence**, **size encodes `log(coverage_ratio)`**. Observed evidence renders as small glyphs near its situation |
| Right panel | Selected situation detail |
| Bottom strip | A 30-day coverage-ratio sparkline per watchlist entity; clicking one selects that entity |

**Situation detail panel:** the confidence rating, expandable into its per-layer breakdown; the plain-language summary; evidence per layer with source names, links, and timestamps; a tone-versus-volume mini chart; and 30-day FRED sparklines where the priced layer applies.

**Summaries are template-generated, not model-generated.** For example: "Coverage of X–Y is 3.1× its 60-day norm, tone −4.2, driven by themes: [top GDELT themes]. Observed: internet disruption in X (Cloudflare, 07:40Z)." This keeps the tool free, deterministic, and honest about what it knows.

**Drill-down rule.** Raw articles and records are never the default view, but every number must be clickable through to the evidence beneath it, ending at source links. "No firehose" and "no un-interrogable numbers" coexist through this rule and only through this rule.

**Cross-filtering.** Selecting a situation or entity narrows the map, the bottom strip, and the detail panel together. Selection is global state, not per-panel state.

---

## 8. Visual design specification

**Idiom: command centre.** Cool near-black greys, hairline rules, monospace throughout, and a single alarm colour reserved exclusively for divergence. The goal is an instrument that expects a competent operator: dense, legible, unornamented. The palette is fixed dark; there is no light mode.

### Palette

| Token | Hex | Use |
|---|---|---|
| `--bg-map` | `#0a0d10` | Map canvas, deepest surface |
| `--bg-chrome` | `#0e1216` | Top and bottom strips |
| `--bg-panel` | `rgba(12,15,18,0.82)` | Floating panels, with `backdrop-filter: blur(8px)` |
| `--line` | `#1b2128` | Standard hairline border |
| `--line-inset` | `#1e252d` | Inset controls such as the search field |
| `--map-graticule` | `#1a2028` | Latitude/longitude grid |
| `--map-coast` | `#2b3742` | Country outlines |
| `--map-arc` | `#3a4a57` | Entity-to-entity arcs |
| `--text-1` | `#dbe4ec` | Situation names, primary values |
| `--text-2` | `#9fb1c1` | Secondary values, active labels |
| `--text-3` | `#6f8494` | Data-row labels |
| `--text-4` | `#5b6b7a` | Micro-labels, section headers |
| `--text-5` | `#3f4c58` | Inactive toggles, placeholders |
| `--alarm` | `#c96442` | **Divergence only** |
| `--alarm-bg` / `--alarm-line` | `#1a100c` / `#4a2c20` | Divergence badge fill and border |
| `--ok` / `--warn` | `#4a9d7f` / `#8a6a2e` | Source health dots only |

### Confidence encoding

One blue-grey ramp in which **brightness equals corroboration**, plus one colour outside the ramp for divergence. This is self-explaining: brighter means better supported, and the only non-grey thing on screen is the thing worth looking at.

| Rating | Hex | Dot radius |
|---|---|---|
| Divergence | `#c96442` | base × 1.4, plus pulse |
| Strong | `#7fa8c9` | base × 1.2 |
| Solid | `#6f8494` | base |
| Reported-only | `#55646f` | base × 0.85 |
| Unconfirmed | `#46545f` | base × 0.75 |

Base radius scales with `log(coverage_ratio)`; the multipliers above apply on top of it. Clamp the final radius to between 2px and 10px.

### Typography

Monospace everywhere: `ui-monospace, SFMono-Regular, "JetBrains Mono", Menlo, monospace`. Two weights only, 400 and 500.

- Micro-labels (section headers such as `LAYERS`, `SITUATION`): 11px, uppercase, `letter-spacing: 0.12em`, `--text-4`
- Data rows and values: 11–12px, `line-height: 1.9`, for scannable key/value columns
- Situation names and summaries: 12px, `line-height: 1.45`
- Clock and numeric readouts: 11px with `font-variant-numeric: tabular-nums` so digits do not jitter on update

Uppercase is confined to micro-labels. Prose summaries stay in sentence case.

### Geometry and prohibitions

Borders are `1px`. Corner radius is `0`, or `2px` at most on inset controls. Left rail 200px fixed, right panel 340px fixed, top strip 40px, bottom strip 56px; the map fills the remainder edge to edge beneath the floating panels.

Explicitly forbidden, because each one breaks the idiom: gradients, drop shadows, glows, emoji, rounded cards, coloured backgrounds anywhere other than the divergence badge, a second accent colour, decorative icons, and any use of `--alarm` for anything but divergence.

### Motion rule

**Still, with exactly one exception.** Motion carries information or it does not exist.

- Divergence situations get a slow expanding ring: `scale(0.4)` at `opacity 0.55` to `scale(2.2)` at `opacity 0`, over `3.4s`, `ease-out`, infinite. Nothing else on screen animates.
- Data refresh fades changed values over 150ms. No sliding, no counting-up.
- No sweeps, no blinking sync indicators, no scanline texture, and no pulse on non-divergent situations.
- Wrap the pulse in `@media (prefers-reduced-motion: reduce)` and substitute a static outer ring.

### Map rendering

Hairline country outlines only — no fills, no labels, no place names. Behind them, a graticule at 20° intervals in `--map-graticule`. Situation dots sit above, and divergence dots alone carry a 16%-opacity halo at 2.2× radius. Observed-evidence glyphs (fires, outages, quakes) render as small unfilled marks near their situation in `--text-3`. Context-layer markers render at 1.5px in `--text-5` with tooltips only, dim enough to read as texture rather than content.

---

## 9. Non-goals — binding

- **No predictions.** Report what is happening and how well-supported it is. Never imply that a price move was caused by a news story merely because both appear on screen together.
- **No attribution.** Report disruption, never who caused it. Open-source attribution is guesswork, and guesswork presented through a confident interface is the fastest route to a misleading tool.
- **No alerts.** The cron exists purely to keep data fresh. Nothing pushes, nothing notifies.
- **No completeness.** Cover the watchlist properly. The context layer is ambience, not coverage.
- **No accounts, no auth, no server.** If a feature requires a server, it is out of scope.

---

## 10. Build steps

Follow the working protocol in §0. One step per session. Each step ends in a state that runs.

### `PROGRESS.md` template

Create this at the start of Step 1 if it does not exist. This file is the only memory the build has. Keep it accurate even when that means recording something unflattering.

```markdown
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
```

---

### Step 1 — repo scaffold, config, workflow skeleton

Build the shell that everything else fills in.

- Commit `parallax-spec.md` and `PROGRESS.md` (template in §10) to the repo root as the very first commit. Every later session finds its instructions there.
- Repo structure per §2, including an empty `data` branch containing `latest/` and `snapshots/`.
- Shared TypeScript types for the situation, context, and status shapes (§3.1, §2.1), in a location both `pipeline/` and `site/` import from. Later sessions must extend these types rather than redefining the shapes.
- `watchlist.yaml` with roughly 6 real example entities: at least one country, one country pair, and one topic. At least two must define `fred_series`, and at least two must define `firms_bbox` or `radar_location`, so layer applicability (§3.3) is actually exercised later.
- `.github/workflows/refresh.yml`: cron every 3 hours plus `workflow_dispatch`. It should read secrets, run the pipeline entry point, and commit any changes to the `data` branch.
- Pipeline entry point with a per-source module structure and shared helpers for HTTP fetching with retry, and for writing `status.json` (§2.1).
- A stub fetcher that writes placeholder JSON, purely to prove the commit path works end to end.
- Fill in the toolchain, commands, secrets, deployment, and file map sections of `PROGRESS.md` with real values. Leave a secret marked "no" if it is not yet configured.

**Verify:** the workflow runs green via manual dispatch and commits placeholder JSON to the `data` branch. Failures in one stub do not prevent the others from committing. `PROGRESS.md` contains working commands that a fresh session could run without guessing.

---

### Step 2 — GDELT pipeline and episode detection

This is the core of the product. Everything downstream depends on it being right.

- GDELT DOC 2.0 fetcher: `timelinevol`, `timelinetone`, and `artlist` per watchlist entity.
- Baseline computation and episode detection exactly per §3.2.
- Situation objects written to `latest/situations.json` per the §3.1 schema, with the `reported` layer fully populated and the other two layers left as `not_applicable` for now.
- Template-generated summaries (§7).
- Situation identity must persist across runs: an open situation keeps its `id` and accumulates history rather than being recreated.

**Verify:** two consecutive runs against the same watchlist produce stable `id` values for still-open situations. At least one situation opens from real data. Baselines are computed from normalized values, not raw counts. Hand-check one entity's ratio against the raw GDELT response.

---

### Step 3 — remaining fetchers, confidence, snapshots

- The four remaining fetchers from §5: Cloudflare Radar, USGS/GDACS, NASA FIRMS, FRED. Verify each against current documentation before implementing.
- Populate the `observed` and `priced` layers, respecting applicability rules driven by `watchlist.yaml` (§4).
- Confidence computation per §3.3, including the two divergence conditions and the requirement that `not_applicable` layers never lower a rating.
- `status.json` fully wired for all five sources.
- Daily snapshot: copy `latest/` to `snapshots/YYYY-MM-DD/` once per day.

**Verify:** an entity with no `fred_series` yields `priced: not_applicable` and is still capable of reaching Solid or Strong. Deliberately break one fetcher's credentials and confirm the run still commits the other four and marks that source unhealthy. Confirm a snapshot directory appears and matches `latest/`.

**The data layer is now complete.** Steps 4–6 do not change pipeline logic.

---

### Step 4 — frontend shell and wireframe map

Apply §8 from the first commit of this step. Retrofitting an aesthetic costs far more than starting with one.

- Vite plus TypeScript scaffold in `site/`, deployed to GitHub Pages from `main`.
- CSS custom properties for the entire §8 palette, defined once at the root. No hardcoded colours anywhere else in the stylesheet.
- Layout regions per §7 at the specified fixed dimensions, with panels floating over the map as translucent glass.
- `d3-geo` wireframe map: bundled Natural Earth 110m outlines, 20° graticule, `d3-zoom` for pan and zoom.
- Situation dots with the colour and radius rules from §8, reading `latest/situations.json` from the `data` branch.
- Divergence pulse, including the `prefers-reduced-motion` fallback.
- Top-strip health dots and last-sync time from `status.json`.

**Verify:** the map renders real situations from real pipeline output. No network requests other than the JSON fetches — confirm zero tile requests. Grep the stylesheet: `--alarm` appears only in divergence rules, and there are no gradients, shadows, glows, or radii above 2px.

---

### Step 5 — situation detail panel and drill-down

- Right panel renders the selected situation: name, confidence badge, per-layer breakdown, template summary.
- Confidence rating expands on click to show which layers contributed what, with source names and timestamps.
- Every layer's evidence list is reachable and every item links to its source. Enforce the drill-down rule from §7: raw records are never the default view but are always reachable.
- Left-rail layer toggles, functional.
- Global selection state with cross-filtering across map, panel, and bottom strip (§7).
- Stale-data badges showing data age wherever a panel's source is unhealthy.

**Verify:** starting from any number on screen, a path exists to the source that produced it. A divergence situation renders in the divergence style and its explanation names both conflicting layers.

---

### Step 6 — context layer and supporting readouts

- Global context layer per §6: GDACS alerts, M5+ quakes, top GDELT hotspots. Dim, tooltip-only, inert.
- Observed-evidence glyphs on the map near their situations.
- Bottom strip: 30-day coverage-ratio sparklines per watchlist entity, clickable to select.
- Tone-versus-volume mini chart in the detail panel.
- FRED sparklines where the priced layer applies.
- Final pass against the §12 acceptance checklist.

**Verify:** every item in §12 passes. Context markers cannot be selected and do not appear in any confidence calculation.

---

### Out of scope — do not build

Command palette bound to ⌘K, saved lenses, actor graph view, timeline scrub-replay interface, daily digest delivery, an ACLED or UCDP retrospective check, Finnhub intraday data, AIS or OpenSky ingestion, model-generated summaries, in-app watchlist editing.

Several of these are good ideas. None of them are part of this build. If a step seems to call for one, it does not.

---

## 11. Known limitations — design around these, do not try to fix them

- **GDELT measures media coverage, not reality.** A spike means journalists are writing. Coverage also skews online, English-language, and Western. The framing at the top of this document is the honest posture and should be reflected in how the interface words things.
- **The GDELT API has availability hiccups.** Fetchers must fail gracefully, and the interface must show data age rather than implying freshness.
- **Threshold-based episode detection will miss slow-burn deterioration** and will sometimes merge distinct stories about the same entity. Acceptable at this scale — the top-articles evidence makes any conflation visible to the user.
- **Market correlation is not causation.** The priced layer is context. Never let the interface imply otherwise.
- **Natural Earth 110m outlines are low-resolution by design.** Fine at world and regional zoom, visibly coarse past country level. Accept the ceiling rather than shipping heavier geometry.

---

## 12. Acceptance checklist

- [ ] Public repo; Actions workflow green on both cron and manual dispatch; no paid keys anywhere.
- [ ] All five fetchers run. Disabling any one still produces a valid partial commit and an unhealthy indicator for that source.
- [ ] The example watchlist produces plausible situations with baselines computed from normalized coverage.
- [ ] Situation `id` values persist across runs while a situation stays open.
- [ ] Every confidence rating expands into its layer breakdown; every evidence item links to a source with a timestamp.
- [ ] `not_applicable` layers never lower a rating. A divergence case renders in the divergence style and names both conflicting layers.
- [ ] The map loads in roughly 2 seconds on broadband and works as a fully static site. No tile requests, no map library, no attribution required.
- [ ] `--alarm` (`#c96442`) appears nowhere except divergence indicators.
- [ ] Nothing animates except the divergence pulse, which is replaced by a static ring under `prefers-reduced-motion`.
- [ ] No gradients, shadows, glows, emoji, or border-radius above 2px anywhere in the stylesheet.
- [ ] A daily snapshot appears in `snapshots/` and matches `latest/`.
- [ ] Context-layer markers are inert: not selectable, not counted in any rating.
- [ ] `PROGRESS.md` shows all six steps complete.
