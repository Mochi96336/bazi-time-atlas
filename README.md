# BaZi Time Atlas

BaZi Time Atlas is a data-driven temporal instrument for comparing several time, calendar, astronomical, and symbolic coordinate systems against one **Selected Instant**. It deliberately separates deterministic calendar/astronomy structure from interpretation and keeps unsupported deep-time claims fail-closed.

The current landing page is not an annual horoscope dashboard. It is a large kinetic fan/wheel whose layers move according to their own real temporal laws.

## Current product

### Time Atlas

The main instrument uses one shared SVG-world center and one Selected Instant. Its five primary time rings are ordered from faster/smaller scale on the inside to slower/larger scale on the outside:

1. **Hour** — 60-state pillar wheel; double-hour boundaries.
2. **Day** — 60-state pillar wheel; default Atlas context uses the Zi-initial 23:00 day-boundary convention.
3. **Solar annual band** — continuous apparent solar longitude; 24 solar terms plus the tropical-zodiac classification sub-band.
4. **Month** — 60-state pillar wheel; changes only at exact **jie** boundaries.
5. **Year** — 60-state pillar wheel; changes at exact Li Chun.

Tropical Zodiac is not an independent sixth clock. It is derived from the same annual solar-longitude coordinate owned by Solar and has no separate primary drag target.

The instrument currently supports:

- continuous linked-time dragging using the actual semantics of each primary ring;
- Free Compare offsets that do not mutate the canonical Selected Instant;
- true intra-state phase for Hour / Day / Month / Year without tweening Ganzhi identities;
- exact next-boundary gates and exact shared-boundary highlighting;
- co-rotating reference frames;
- scale-dependent visual emphasis;
- primary-layer visibility isolation;
- separate BaZi Five-Phase and Western zodiac element/modality classification overlays;
- one explicit fixed-offset/day-boundary temporal context, with UTC+08:00 + Zi-initial 23:00 as the production default and explicit supported overrides persisted canonically in Atlas URLs;
- explicit-longitude civil / local-mean-solar / local-apparent-solar Day-Hour sensitivity analysis that never infers longitude from UTC offset;
- true 390 px mobile composition plus desktop framing;
- reproducible deep links for selected instants, temporal context and legacy annual projections.

### Birth

The Birth view resolves the four pillars through separate rule boundaries rather than a fake year→month→day→hour dependency chain. It also exposes civil, local mean solar, and local apparent solar clock comparisons for Day/Hour sensitivity while keeping Year/Month anchored to the physical instant.

The deterministic structure layer includes Five Tigers, hidden stems, Day Master → Ten Gods, visible stem/branch pair relations, complete 三合 / 三會, and directed / mutual / self 刑. Interpretive strength, auspiciousness, personality, and event prediction are not silently folded into those structural rules.

### Sexagenary reference

The 60 Jiazi are generated from synchronized 10-stem and 12-branch phases. The sexagenary cycle is its own reference system and is not treated as 60 equal slices of the solar year.

### Research

The recurrence/deep-time lab remains available as the secondary **Research** destination. It separates:

- exact discrete recurrence;
- approximate astronomical similarity;
- unresolved or model-bounded absolute-epoch reconstruction.

It contains Gregorian/sexagenary recurrence work, astronomical residuals, near-recurrence ranking, four-pillar determinacy, Day/Hour proof-chain analysis, and seasonal-epoch source audits. Research results are not promoted into product certainty unless the required source and time-scale contracts are satisfied.

## Semantic contracts

The repository treats these as hard boundaries:

- one Selected Instant is authoritative for the kinetic atlas;
- temporal context may reinterpret that same instant but must not silently move it;
- UTC offset is not geographic longitude;
- Year changes at exact Li Chun;
- Month changes at exact **jie**;
- Day follows the configured canonical day-boundary convention;
- Hour follows its double-hour boundary rule under the selected fixed-offset civil context;
- continuous solar phase never fabricates intermediate discrete Ganzhi identities;
- shared-boundary highlighting requires identical resolved timestamps, not visual collinearity;
- Zodiac is a classification over Solar longitude, not an independent time coordinate;
- Chinese Five Phases and Western four-element/modality classifications remain distinct systems;
- deep-time model coverage must not be stretched past the declared source or transformation coverage.

See [`docs/current-status.md`](docs/current-status.md) for the current product/implementation checkpoint and [`docs/architecture-contracts.md`](docs/architecture-contracts.md) for the normative cross-cutting contracts.

## Architecture

The codebase intentionally keeps domain semantics away from page/bootstrap code:

- `src/calendar/` — BaZi/calendar rules and Tyme integration;
- `src/astronomy/` — solar longitude, Equation of Time, long-term/seasonal source contracts and solver components;
- `src/recurrence/` — discrete recurrence, residual, determinacy and proof-chain models;
- `src/wheel/` — wheel geometry, renderer, temporal tracks, ring state, drag contracts and the atlas display model;
- `src/interaction/` — interaction laws such as linked ring scrubbing;
- `src/wheel/atlas-display-model.js` — pure Selected Instant → display/domain state for the main atlas;
- `src/kinetic-atlas.js` — page controller for DOM, renderer coordination, playback, compare controls and interaction wiring.

The static GitHub Pages deployment intentionally has no framework build layer. `tyme4ts` is installed from the lockfile and staged into the browser vendor path before tests/deployment.

## Development

Use Node 22 and install the exact locked dependency graph:

```bash
npm ci
```

Run the repository quality boundary:

```bash
npm run check
```

`npm run check` runs the Node test suite and the automatic JavaScript syntax scan. `npm test` is available when only the rule/data tests are needed.

Serve the static site locally with, for example:

```bash
python -m http.server 4173
```

The lightweight screenshot capture can then be run with system Chromium/Chrome on `PATH`:

```bash
npm run visual:check
```

`npm run visual:check` is only the PNG capture command. The GitHub **Visual PNG self-check** workflow also runs the browser contract suite for deep links, kinetic geometry, mobile composition, temporal motion/boundaries, recurrence, astronomy, determinacy and source-audit behavior.

## CI and deployment

Repository CI uses two main validation layers:

- **Quality Gate** — locked install plus `npm run check`;
- **Visual PNG self-check** — locked install, rule/data tests, syntax scan, browser contracts, PNG evidence and artifact upload.

GitHub Pages does **not** deploy directly from an arbitrary push. The Pages workflow is triggered by completion of `Visual PNG self-check` and deploys only when that workflow succeeded for a `push` to `main`. It checks out the exact `workflow_run.head_sha`, stages the pinned browser dependency, and deploys that verified revision.

Core GitHub-maintained checkout/setup/artifact actions are on their Node-24 action majors while the project runtime remains Node 22.

## Deep-time boundary

The repository contains an app-owned absolute-state seasonal-crossing proof chain and a bounded production seasonal-event data path, but those two authorities remain deliberately distinct.

For catalogue year **4006**, the independently validated DE441/Horizons-backed crossing proof resolves all 24 canonical 15° events inside the declared two-second promotion budget. Production publishes that reviewed target-year result through the direct-event provider `jpl-de441-seasonal-events-v1`, with TT time basis and coverage limited to year 4006.

That bounded runtime slice is **not** a general DE441 state adapter and does not authorize the full DE441 source ephemeris range. Generic on-demand absolute-state runtime coverage remains fail-closed unless a separately reviewed adapter, bundled source data and declared runtime coverage are introduced.

Pinned independent evidence also prevents the direct ShouXing path from being silently widened to year 4006: the research pipeline works, but the target-year error exceeds the promotion budget.

An absolute seasonal epoch alone is still insufficient to prove deep-time Day/Hour pillars; Earth rotation / TT↔UT1 / ΔT, local-zone policy, day-boundary convention, selected clock basis and longitude when required remain separate proof stages.

## Documentation roles

- [`docs/current-status.md`](docs/current-status.md) — current product/implementation checkpoint and release frontier.
- [`docs/architecture-contracts.md`](docs/architecture-contracts.md) — normative cross-cutting architecture and authority contracts.
- [`docs/camera-ownership.md`](docs/camera-ownership.md) — current camera/world ownership contract.
- [`docs/kinetic-atlas-plan.md`](docs/kinetic-atlas-plan.md) — historical redesign plan retained for design rationale; superseded details are not normative.

When documentation and implementation disagree, reconcile the responsible current document with production behavior and regression evidence rather than allowing an older statement to become a competing authority.
