# BaZi Time Atlas — current implementation checkpoint

Updated through the current production wheel, deterministic visual-evidence, typed Day/Hour proof-chain and bounded DE441 seasonal-event runtime work on main, including PRs #145–#148.

This document is the **normative current-state checkpoint**. `docs/kinetic-atlas-plan.md` is historical design rationale and must not override behavior locked by current tests. Cross-cutting invariants that should survive future feature work are consolidated in `docs/architecture-contracts.md`.

## Product state

The landing page is a kinetic time instrument rather than a dashboard. One **Selected Instant** drives every time layer, while each layer keeps its own motion law and exact boundary semantics.

Radial position and radial thickness both carry temporal meaning: short / fast cycles live inside and are thinner; long / slow cycles live outside and are wider. The primary stack runs inner → outer as:

1. **Hour pillar** — 60-state wheel with double-hour boundaries under the atlas UTC+08:00 reference clock.
2. **Day pillar** — 60-state wheel using the current Zi-initial 23:00 day-boundary convention.
3. **Solar annual band** — one continuous apparent-solar-longitude cycle per year. It contains the 24 solar-term structure and the derived tropical-zodiac classification sub-band.
4. **Month pillar** — 60-state wheel changing only at exact **jie** boundaries.
5. **Year pillar** — 60-state wheel changing at exact Li Chun.

Tropical Zodiac is **not** a sixth independent time ring. It is a derived classification overlay inside the Solar annual coordinate and has no independent primary drag target, time law, visibility ownership or reference frame.

The visual thesis remains: **one instant, multiple coordinate systems, no fake universal mechanical period.**

## Navigation contract

Primary product navigation remains intentionally focused:

`時間圖譜 → 出生 → 六十甲子 → 研究`

The recurrence/deep-time lab remains available at its existing URL, but it is the visually secondary final **Research** destination rather than a peer primary product surface. Cross-view browser checks lock the order, labels, href and secondary treatment across desktop and mobile fixtures.

## Main-instrument capabilities

Implemented on the current instrument:

- canonical shared SVG-world center and contiguous five-primary-ring temporal hierarchy;
- responsive SVG camera with true 390 px mobile first-viewport framing;
- linked ring scrubbing that changes the master Selected Instant using each primary ring's real semantics;
- Free Compare with independent manual offsets that do not mutate canonical time;
- geometry-aware grab / active feedback with drag lifecycle deferred until the activation threshold is crossed;
- transient motion traces derived from actual rendered rotation deltas;
- non-destructive primary-layer visibility controls, with Solar owning the Zodiac sub-band;
- co-rotating reference frames in radial order: World / Hour / Day / Solar / Month / Year;
- true intra-state progress for Hour / Day / Month / Year without tweening Ganzhi identities;
- terminal boundary gates for active discrete teeth;
- continuous temporal motion across state boundaries rather than centre-snapping each active tooth;
- exact shared-boundary highlighting only when resolved next-boundary timestamps are identical;
- scale-dependent reading emphasis without hiding true layers;
- optional classification overlay keeping BaZi Five-Phase and tropical-zodiac element/modality systems visually and semantically separate.

Scale presets change reading priority, not geometry:

- **48 小時** — Hour / Day remain full contrast. Solar stays legible context while the much larger Month / Year shells progressively recede by opacity plus saturation/luminance. Hovered or actively dragged rings immediately recover full contrast.
- **一年** — Solar / Zodiac / Month become the primary comparison, with Year and fast clocks retained as secondary context.
- **60 年** — Year becomes the primary reading while Month, Solar, Day and Hour remain visible as phase context.

The Visual PNG self-check now captures all three scale states at desktop `1440×900` and true mobile `390×844`. It also captures the originally reported Selected Instant regression at `2026-09-14 07:43:42 UTC+08`, so presentation fixes are reviewable against a deterministic real case rather than only the current clock.

Two important shared-boundary examples are represented directly:

- Hour + Day can share the 23:00 Zi-initial transition.
- Year + Month share the exact Li Chun transition while the active month interval ends at Li Chun.

Visual collinearity alone is never treated as temporal concurrence.

## Architecture ownership

The main page is split so domain/display and interaction semantics do not accumulate indefinitely inside the browser bootstrap.

`src/wheel/atlas-display-model.js` owns the pure Selected Instant → display/domain mapping used by the kinetic atlas, including pinned UTC+08 instant/civil-field conversion, apparent solar longitude lookup, current pillar/discrete-phase resolution and legacy projection interpretation.

`src/kinetic-atlas.js` remains the page/root orchestrator. It owns canonical page state, DOM readout mutation, renderer coordination and component wiring while delegating interaction lifecycles.

Interaction ownership remains explicit:

- `src/wheel/ring-drag-controller.js` — pointer capture, activation threshold and free/linked drag lifecycle dispatch;
- `src/interaction/linked-ring-scrub.js` — linked angular drag → canonical Selected Instant conversion;
- `src/interaction/free-compare-controller.js` — Free Compare mode and manual-offset reset/view state;
- `src/interaction/kinetic-playback.js` — pure scale, slider and playback advance mathematics;
- `src/interaction/kinetic-playback-controller.js` — RAF plus playback start/stop/toggle lifecycle.

Other ownership boundaries remain:

- `src/calendar/` — calendar/BaZi rules and Tyme adapter;
- `src/astronomy/` — solar, Equation-of-Time, long-term, state/observable proof and seasonal solver components;
- `src/recurrence/` — recurrence, residual, determinacy, source-audit, registration and proof-chain models;
- `src/wheel/` — geometry, renderer, ring state, temporal tracks and drag contracts;
- `src/interaction/` — interaction laws/controllers acting on page state without becoming domain authorities.

The normative cross-cutting version of these boundaries is recorded in `docs/architecture-contracts.md`.

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

The repository contains working models/evidence for:

- Gregorian 400-year structure;
- 60-year / 60-day congruence analysis;
- local Year+Day recurrence around 1,980 years for the chosen civil-date phase;
- 24,000-year global Gregorian + Year + Day exact-discrete closure;
- long-term orbital / solar-term-shape residual comparison using explicitly bounded models;
- near-recurrence ranking rather than false exact-period claims;
- month-boundary disagreement-window attribution;
- four-pillar determinacy analysis;
- Day / Hour proof-chain analysis;
- absolute seasonal-epoch source capability, promotion and runtime-registration audits.

The deep-time lab intentionally separates three different claims:

1. **exact discrete recurrence**;
2. **approximate astronomical similarity**;
3. **resolved or unresolved absolute epoch reconstruction with explicit source/model/runtime coverage**.

A discrete closure or similar orbital shape is never promoted into an exact historical/future civil timestamp by implication.

## Seasonal-epoch source boundary

Source role is part of provenance. Provider contracts distinguish:

- **shape parameters** — long-term orbital/insolation geometry that can compare seasonal shape but does not supply an absolute event epoch;
- **absolute-state basis** — Earth/Sun states on a continuous dynamical-time axis, such as DE441, which require an app-owned observable transformation and crossing solve;
- **direct seasonal-event provider** — a bounded data/runtime source that directly supplies target solar-longitude crossing epochs on a declared continuous dynamical-time basis.

State adapters and direct-event providers remain separate integration paths. Passing proof evidence never automatically widens production runtime coverage.

### ShouXing validation boundary

The pinned ShouXing path remains useful as a research/direct-event comparison without becoming authoritative outside validated coverage.

- The modern 2026 control agrees closely with the independent target observable.
- Against independent DE441/Horizons year-4006 truth, the ShouXing maximum target-year error is about 4.5 minutes (mean absolute error about 4.35 minutes) and exceeds the production promotion budget by a wide margin.
- Therefore that evidence is a **validation failure for widening ShouXing coverage**, not permission to extend it.

### DE441 end-to-end reconstruction proof

The repository now contains an app-owned absolute-state seasonal-crossing solver with explicit layers:

- DE441 geometric Earth/Sun barycentric ICRF states on TDB;
- NAIF/SPICE-compatible TT → TDB conversion;
- reception light-time iteration;
- validated Sun-center apparent-direction correction, including stellar aberration and the evidence-bounded Sun-center deflection semantics required by the target observable;
- transformation into Earth mean ecliptic-of-date;
- apparent geocentric solar longitude;
- bounded TT crossing root solve.

For catalogue year **4006**, the complete chain has been validated against independent NASA/JPL Horizons quantity #31 truth for all 24 canonical 15° crossings:

- solved crossings: **24 / 24**;
- maximum epoch error: **0.161 s**;
- mean absolute epoch error: **0.057 s**;
- maximum truth-longitude residual: **0.007 arcsec**;
- production promotion budget: **2 s**;
- production-shaped solver parity: passed.

This evidence qualifies year 4006 for bounded runtime integration. It does **not** imply that every year in the full DE441 ephemeris range has been independently validated.

### Production year-4006 seasonal-event runtime

Production integration deliberately does **not** expose the proof-only DE441 state windows as a general runtime state adapter. Instead, the validated year-4006 result is published as a bounded authoritative direct-event data product:

- provider id: `jpl-de441-seasonal-events-v1`;
- source authority: NASA/JPL Horizons quantity #31 / DE441;
- time scale: TT;
- published coverage: catalogue year **4006 only**;
- payload: exactly **24** apparent geocentric solar-longitude crossing epochs at 15° steps;
- integration mode: `direct-event-runtime-registry`.

Runtime startup re-assesses the data product before registration. The gate verifies source provenance/integrity, manifest coverage, exact runtime payload identity, 24 canonical crossings and the independently reconstructed DE441/Horizons parity inside the two-second budget. A failed assessment throws instead of silently publishing the provider.

This is why `SEASONAL_EPOCH_PIPELINE.absoluteStateAdapterIds` remains empty and the generic state-solver flags remain false while year 4006 can still be resolved through the registered direct-event provider. Those states are not contradictory: the proof-only state adapter is still fail-closed, while the separately reviewed 4006 event slice is production-integrated.

The provider coverage is intentionally **not** widened to DE441's full source ephemeris range (`-13200…17191`) by inference. Every additional published year/range requires its own declared payload and validation boundary.

## Day / Hour deep-time boundary

The project still does **not** have an arbitrary-millennia birth-calculation engine. Resolving a seasonal epoch does not automatically resolve Day or Hour.

The proof chain now uses a typed **local-zone convention** rather than a legacy boolean claim. Supported semantic cases include:

- `civil-timezone` — requires an explicitly resolved civil timezone policy and a non-empty zone id;
- `proleptic-fixed-offset-from-ut1` — a research convention defining a local clock directly from UT1, without claiming future UTC, DST or political timezone history.

A `fixed-zone-from-ut1` target instant may derive the matching proleptic local-zone convention. That can satisfy the local-clock projection stage while still keeping `futureUtcPolicyResolved=false` and `civilTimezonePolicyResolved=false`.

The Day proof also now accepts the canonical typed day-boundary contract used by the Birth engine: `zi-initial-next-day` or `civil-midnight`. The legacy `dayBoundaryBound:true` boolean is not authority and cannot unlock the proof by itself. Current recurrence remains unbound by default and the research page does not silently choose either convention.

For the existing year-4006 research URL with an explicit fixed-zone target and `UT1 +8 h`, the proof now advances through target-instant, Earth-rotation requirement and local-zone convention, then stops at the next hard blocker: **day-boundary**. Day / Hour remain unresolved until an explicit canonical day-boundary convention is bound.

Remaining downstream proof stages still include, as applicable:

- deterministic TT↔UT1 / Earth-rotation treatment for the chosen target basis;
- local-zone convention;
- day-boundary convention;
- sexagenary day arithmetic and resolved Day pillar;
- selected civil / local-mean-solar / local-apparent-solar clock basis;
- longitude when the selected solar-time basis requires it;
- Hour pillar reconstruction.

An event timestamp must therefore never be promoted directly into “all four pillars resolved”.

## Repository health and release boundary

The repository has a reproducible baseline rather than an implicit local-machine workflow:

- `package-lock.json` pins the dependency graph;
- CI and deployment install with `npm ci`;
- `npm run check` runs the test suite plus recursive JavaScript syntax validation;
- runtime remains Node 22;
- **Quality Gate** provides the fast locked-install + repository-check boundary;
- **Visual PNG self-check** provides browser-contract + deterministic PNG evidence;
- scale-window captures cover 48h / one-year / 60-year at desktop and true 390 px mobile;
- the originally reported Selected Instant has dedicated deterministic regression PNGs;
- GitHub Pages deploys only after a successful Visual workflow caused by a push to `main`, checking out that workflow's exact `head_sha`.

One repository-setting gap remains outside source control: `main` should be protected by a GitHub branch/ruleset requiring PR flow and the required Quality/Visual checks while blocking force-push/delete. A solo repository does not need an artificial multi-reviewer requirement.

## Regression boundary

Every main-instrument or deep-time PR should continue to preserve:

- exact calendar/boundary tests;
- canonical radial order `Hour → Day → Solar annual band → Month → Year`;
- increasing radial scale from faster inner cycles to slower outer cycles;
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
- explicit runtime coverage distinct from broad source-ephemeris coverage;
- cross-view navigation hierarchy;
- desktop/mobile PNG inspection when presentation changes.

## Current frontier

1. **Validate and publish additional seasonal-event runtime coverage only where independent target-era evidence exists.** The 4006 direct-event slice is production-integrated; the rest of DE441's theoretical source coverage must not be inherited automatically.
2. **Add a production absolute-state adapter only if a real runtime use case requires on-demand states/crossings.** Proof-only pinned windows must not be rebranded as general runtime coverage; any adapter needs explicit bundled data, source/time/frame semantics and runtime coverage.
3. **Continue the year-4006 Day / Hour proof by explicitly binding a canonical day-boundary convention.** The typed day-boundary contract now exists in core, but the recurrence research UI intentionally leaves it unbound; once one of the two canonical conventions is selected, the proof can advance to the downstream clock-basis stages instead of treating a boolean as sufficient evidence.
4. **Validate target eras independently.** Passing 2026 or 4006 does not authorize another century or millennium by interpolation of confidence.
5. **Keep Research secondary to the product instrument.** New evidence surfaces should not turn the landing page back into a dashboard.
6. **Protect `main` at the repository-settings layer.** Source-controlled CI is strong enough to serve as required checks once a ruleset is enabled.
7. **Optional Western sky only after the above remains stable.** Planets/aspects require explicit ephemeris provenance and remain distinct from BaZi classifications.

The current direction is therefore: keep radial position and motion semantically meaningful, keep classification systems distinct, keep controller/domain ownership narrow, publish only source-backed absolute-time results inside explicit runtime coverage, and never convert broad model/source coverage into unsupported certainty.
