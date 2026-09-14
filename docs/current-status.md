# BaZi Time Atlas — current implementation checkpoint

Updated through the repository-health, kinetic ownership, navigation, wheel hierarchy, deep-time solver-core and deterministic browser-harness work merged through PR #85.

This document is the **normative current-state checkpoint**. `docs/kinetic-atlas-plan.md` is retained as historical design rationale and must not override the behavior described here or locked by current tests.

## Product state

The landing page is a kinetic time instrument rather than a dashboard. One **Selected Instant** drives every time layer, while each layer keeps its own motion law and exact boundary semantics.

Radial position and radial thickness both carry temporal meaning: short / fast cycles live inside and are thinner; long / slow cycles live outside and are wider. The primary stack runs inner → outer as:

1. **Hour pillar** — 60-state wheel with double-hour boundaries under the atlas UTC+08:00 reference clock.
2. **Day pillar** — 60-state wheel using the current Zi-initial 23:00 day-boundary convention.
3. **Solar annual band** — one continuous apparent-solar-longitude cycle per year. The band contains the 24 solar-term structure and the derived tropical-zodiac classification sub-band.
4. **Month pillar** — 60-state wheel changing only at exact **jie** boundaries.
5. **Year pillar** — 60-state wheel changing at exact Li Chun.

Tropical Zodiac is therefore **not** a sixth independent time ring. It is a derived classification overlay inside the Solar annual coordinate and has no independent primary drag target, time law, visibility ownership or reference frame.

The visual thesis remains: **one instant, multiple coordinate systems, no fake universal mechanical period.**

## Navigation contract

Primary product navigation is intentionally focused:

`時間圖譜 → 出生 → 六十甲子 → 研究`

The recurrence/deep-time lab remains fully available at its existing URL, but it is the visually secondary final **Research** destination rather than a peer primary product surface. Cross-view browser checks lock the order, labels, href and secondary treatment across desktop and mobile fixtures.

## Main-instrument capabilities

Implemented on the current instrument:

- canonical shared SVG-world center and contiguous five-primary-ring temporal hierarchy;
- responsive SVG camera with true 390 px mobile first-viewport framing;
- linked ring scrubbing that changes the master Selected Instant using each primary ring's real semantics;
- Free Compare with independent manual offsets that do not mutate canonical time;
- geometry-aware grab / active feedback;
- transient motion traces derived from actual rendered rotation deltas;
- non-destructive primary-layer visibility controls, with Solar owning the Zodiac sub-band;
- co-rotating reference frames in radial order: World / Hour / Day / Solar / Month / Year;
- true intra-state progress for Hour / Day / Month / Year without tweening Ganzhi identities;
- terminal boundary gates for active discrete teeth;
- continuous temporal motion across state boundaries rather than centre-snapping each active tooth;
- exact shared-boundary highlighting only when resolved next-boundary timestamps are identical;
- scale-dependent reading emphasis without hiding other true layers;
- an optional classification overlay that keeps BaZi Five-Phase and tropical-zodiac element/modality systems visually and semantically separate.

Two important shared-boundary examples are represented directly:

- Hour + Day can share the 23:00 Zi-initial transition.
- Year + Month share the exact Li Chun transition while the active month interval ends at Li Chun.

Visual collinearity alone is never treated as temporal concurrence.

## Architecture ownership

The main page has been split so domain/display semantics do not accumulate indefinitely inside the browser controller.

`src/wheel/atlas-display-model.js` owns the pure Selected Instant → display/domain mapping used by the kinetic atlas, including:

- pinned UTC+08 instant ↔ civil-field conversion;
- datetime input parsing/formatting;
- apparent solar longitude lookup;
- current pillar and discrete-phase resolution;
- BaZi month, solar-term, zodiac and sexagenary display selection;
- legacy `instant` / `lambda` / `month` / `yearStem` projection interpretation.

`src/kinetic-atlas.js` remains the page controller. It owns DOM mutation, renderer coordination, playback, compare controls, drag wiring and page lifecycle, while delegating the above domain/display computation.

Other ownership boundaries remain:

- `src/calendar/` — calendar/BaZi rules and Tyme adapter;
- `src/astronomy/` — solar, Equation-of-Time, long-term and seasonal source/solver components;
- `src/recurrence/` — recurrence, residual, determinacy and proof-chain models;
- `src/wheel/` — geometry, renderer, ring state, temporal tracks and drag contracts;
- `src/interaction/` — interaction laws such as linked-time scrubbing.

## Boundary truth

The practical atlas keeps calendar rules and presentation separate:

- Year identity changes only at exact Li Chun.
- Month identity changes only at exact **jie**.
- Day identity follows the configured Zi-initial-next-day rule used by the current atlas.
- Hour identity follows double-hours beginning at odd local clock hours.
- Continuous solar phase is never interpolated into discrete Ganzhi identity.
- Tropical Zodiac is read from the same solar-longitude phase and does not create another clock.
- Legacy annual longitude projection suppresses Month progress/boundary precision when the projected Month is not owned by a complete physical instant.
- Exact shared-boundary state is a timestamp equality claim, not a drawing coincidence.

## Recurrence / deep-time state

The repository contains working research models for:

- Gregorian 400-year structure;
- 60-year / 60-day congruence analysis;
- local Year+Day recurrence around 1,980 years for the chosen civil-date phase;
- 24,000-year global Gregorian + Year + Day exact-discrete closure;
- long-term orbital / solar-term-shape residual comparison using an explicitly bounded model;
- near-recurrence ranking rather than false exact-period claims;
- month-boundary disagreement-window attribution;
- four-pillar determinacy analysis;
- Day / Hour proof-chain analysis;
- absolute seasonal-epoch source-capability audit.

The deep-time lab intentionally separates three different claims:

1. **exact discrete recurrence**;
2. **approximate astronomical similarity**;
3. **resolved or unresolved absolute epoch reconstruction with explicit source/model coverage**.

A discrete closure or similar orbital shape is never promoted into an exact historical/future civil timestamp by implication.

## Seasonal-epoch source boundary

Source role is part of provenance. The provider contracts distinguish:

- **shape parameters** — long-term orbital/insolation geometry that can compare seasonal shape but does not supply an absolute event epoch;
- **absolute-state basis** — Earth/Sun state vectors on a continuous dynamical-time axis, such as DE441, which still require the app's seasonal-crossing transformation/solve chain;
- **direct seasonal-event provider** — a source that directly supplies target solar-longitude crossing epochs on a declared continuous dynamical-time basis.

State adapters and direct-event providers remain separate integration registries. A direct-event provider must never be relabelled as DE441 merely because DE441 was used for validation.

### Direct-event validation result

The pinned ShouXing research path demonstrates that a direct-event pipeline can work without making it production-authoritative outside its validated coverage.

- The modern 2026 control agrees closely with the independent target observable.
- Independent DE441/Horizons evidence for year 4006 is present, but its approximately 4.5-minute target-year error exceeds the promotion budget by a wide margin.
- Therefore ShouXing coverage remains bounded; the 4006 evidence is a **validation failure**, not permission to widen the provider range.

### Absolute-state solver core

The repository now contains an app-owned seasonal-crossing **solver core** over injected absolute states. Its contract keeps these layers explicit:

- source states: barycentric Earth/Sun state basis in ICRF on TDB;
- TT → ephemeris-time conversion;
- light-time handling;
- apparent-direction correction;
- transformation into Earth mean ecliptic-of-date;
- wrapped/bracket-expanding TT root solve for the requested longitude crossing.

The solver deliberately fails closed before claiming Horizons quantity-31-style semantics unless the apparent-direction model declares the required completeness, including gravitational light deflection and stellar aberration.

This solver core does **not** mean DE441 is production-integrated. The production pipeline still lacks the real DE441 state adapter/data path plus the validated long-term apparent-direction and mean-ecliptic-of-date transformation chain needed to promote target-era seasonal epochs. Production registries therefore remain conservative.

## Day / Hour deep-time boundary

The project still does **not** have an arbitrary-millennia birth-calculation engine.

Even after an absolute seasonal epoch is available, Day / Hour require separate proof stages including:

- TT↔UT / ΔT and Earth rotation;
- civil-zone policy;
- day-boundary convention;
- selected civil / mean-solar / apparent-solar clock basis;
- downstream pillar reconstruction.

An event timestamp must therefore never be promoted directly into “all four pillars resolved”.

## Repository health and release boundary

The repository now has a reproducible baseline rather than an implicit local-machine workflow:

- `package-lock.json` pins the dependency graph;
- CI and deployment install with `npm ci`;
- `npm run check` runs the test suite plus an automatic recursive JavaScript syntax scan, so new JS/MJS files are not silently omitted from syntax validation;
- the project runtime remains Node 22;
- GitHub-maintained checkout/setup/artifact actions use Node-24 action majors;
- **Quality Gate** provides the fast locked-install + repository-check boundary;
- **Visual PNG self-check** provides the browser-contract + PNG-evidence boundary;
- GitHub Pages deploys only after a successful Visual workflow caused by a push to `main`, and checks out that workflow's exact `head_sha` before deployment.

The exact shared-boundary browser fixture no longer relies on opportunistic load timing plus a few fixed-delay snapshots. It advances through bounded, condition-driven states and records the stalled phase/error if it cannot settle, while preserving the existing outer fail-closed time budget.

One repository-setting gap remains outside source control: `main` should be protected by a GitHub branch/ruleset requiring PR flow and the required Quality/Visual checks while blocking force-push/delete. A solo repository does not need an artificial multi-reviewer requirement.

## Regression boundary

Every main-instrument or deep-time PR should continue to preserve:

- exact calendar/boundary tests;
- canonical radial order `Hour → Day → Solar annual band → Month → Year`;
- increasing primary radial scale from faster inner cycles to slower outer cycles;
- Zodiac ownership by the Solar annual band rather than an independent clock;
- canonical fan/world geometry and true-390 px composition;
- linked drag and Free Compare semantics;
- continuous motion through temporal boundaries;
- hidden-layer isolation;
- reference-frame invariants;
- discrete intra-state progress;
- exact shared-boundary truth;
- scale-emphasis and classification-overlay invariants;
- recurrence / astronomical residual / determinacy / proof-chain gates;
- source-role provenance and fail-closed deep-time semantics;
- cross-view navigation hierarchy;
- desktop/mobile PNG inspection when presentation changes.

## Current frontier

1. **Attach a real absolute-state adapter only behind its declared source/time/frame contract.** The solver core exists; the production DE441 data integration does not.
2. **Complete and validate the apparent-direction + mean-ecliptic-of-date chain.** Do not claim Horizons-equivalent seasonal longitude before all required corrections/transforms are explicit and tested.
3. **Validate target eras independently.** A working modern pipeline does not authorize a distant-era coverage extension.
4. **Propagate any resolved absolute epoch into Day / Hour through a separate Earth-rotation/civil-time proof chain.**
5. **Keep Research secondary to the product instrument.** New evidence surfaces should not turn the landing page back into a dashboard.
6. **Protect `main` at the repository-settings layer.** Source-controlled CI is now strong enough to serve as required checks once the ruleset is enabled.
7. **Optional Western sky only after the above remains stable.** Planets/aspects require explicit ephemeris provenance and remain distinct from BaZi classifications.

The current direction is therefore: keep radial position and motion semantically meaningful, keep classification systems distinct, keep controller/domain ownership narrow, and extend only source-backed portions of the absolute-time proof chain without converting model coverage into unsupported certainty.
