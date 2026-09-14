# BaZi Time Atlas — implementation checkpoint

Updated after the UI consolidation, scale-emphasis and classification-overlay work through PR #59, plus the seasonal-epoch provider contract work now in progress.

## Product state

The landing page is a kinetic time instrument rather than a dashboard. One Selected Instant drives every time layer, while each layer keeps its own motion law and boundary semantics.

Radial position has an explicit meaning: **short / fast cycles live inside; long / slow cycles live outside.** The primary stack runs inner → outer as:

1. Hour pillar — 60-state wheel, about five days for a full 60-state cycle, with two-hour double-hour boundaries under the atlas UTC+08:00 reference clock.
2. Day pillar — 60-state wheel, sixty days for a full cycle, using the Zi-initial 23:00 day-boundary convention.
3. Annual solar-longitude band — one continuous apparent-solar-longitude cycle per year. The inner sub-band carries the 24 solar terms and the outer sub-band carries the 12 fixed tropical-zodiac 30° classifications.
4. Month pillar — 60-state wheel, roughly five years for a full 60-state sequence, changing only at the exact 12 jie boundaries.
5. Year pillar — 60-state wheel, sixty years for a full cycle, changing at exact Li Chun.

Tropical Zodiac is therefore **not** a sixth independent time ring. It is a derived classification overlay inside the same annual longitude coordinate owned by Solar; it has no independent drag target, motion trace, visibility toggle or reference frame.

The visual thesis remains: one instant, multiple coordinate systems, no fake universal mechanical period.

## Kinetic instrument capabilities

Implemented on the main instrument:

- canonical shared SVG-world center, contiguous five-primary-ring temporal hierarchy, annual sub-band geometry and fixed fan clipping;
- responsive SVG camera with a true 390 px mobile first viewport;
- linked ring scrubbing that changes the master Selected Instant using each primary ring's real semantics;
- Free Compare with independent manual offsets and semantic detents for primary time rings;
- geometry-aware grab/active feedback;
- transient motion traces derived from actual rendered rotation deltas;
- non-destructive primary-layer visibility controls, with Solar owning the Zodiac sub-band;
- co-rotating reference frames in radial order: World / Hour / Day / Solar / Month / Year;
- true intra-state progress for Hour / Day / Month / Year without tweening Ganzhi identities;
- terminal boundary gates for the active discrete teeth;
- exact shared-boundary highlighting only when resolved next-boundary timestamps are identical to the millisecond;
- scale-dependent reading emphasis: 48 hours foregrounds Hour/Day, one year foregrounds Solar/Month, and 60 years foregrounds Year without hiding other true layers;
- an optional classification overlay that keeps BaZi Five-Phase classification and tropical-zodiac element/modality classification visually and semantically separate.

Two important shared-boundary examples are represented directly:

- Hour + Day can share the 23:00 Zi-initial transition.
- Year + Month share the exact Li Chun transition while the current month interval ends at Li Chun.

Visual collinearity alone is never treated as temporal concurrence.

## Boundary truth

The practical atlas keeps calendar rules and presentation separate:

- Year identity changes only at exact Li Chun.
- Month identity changes only at exact jie.
- Day identity follows the configured Zi-initial-next-day rule used by the current atlas.
- Hour identity follows double-hours beginning at odd local clock hours.
- Continuous solar phase is never interpolated into discrete Ganzhi identity.
- Tropical Zodiac is read from the same solar-longitude phase and does not create another clock.
- Legacy annual longitude projection suppresses Month progress/boundary precision when the projected Month is not owned by a complete physical instant.

## Recurrence / deep-time state

Phase 3 is no longer a future placeholder. The repository already contains:

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

The deep-time lab intentionally separates three claims:

1. exact discrete recurrence,
2. approximate astronomical similarity,
3. unresolved / model-bounded absolute epoch reconstruction.

## Seasonal-epoch provider boundary

Absolute seasonal epochs can arrive through more than one legitimate source architecture, so the repo now treats source role as part of provenance rather than reducing everything to “has a year range”. The provider contract distinguishes:

- **shape parameters** — long-term orbital/insolation geometry that can compare seasonal shape but does not supply an absolute epoch;
- **absolute-state basis** — Earth/Sun state vectors on a continuous dynamical-time axis, such as DE441; these still require an app-owned apparent/geocentric solar-longitude-of-date transform and crossing root solve;
- **direct seasonal-event provider** — a source that directly solves the target solar-longitude crossing on a continuous dynamical-time axis. It can supply an absolute seasonal epoch without pretending to be an absolute-state ephemeris.

State adapters and direct-event providers therefore have separate integration registries. A direct-event provider must never be labeled as DE441 merely because it was calibrated or compared against DE441.

No direct-event provider is promoted into the production registry yet. Current observable verdicts therefore stay conservative: the +1,980-year candidate has DE441 state coverage but no integrated seasonal-epoch solver, while the +24,000-year candidate remains outside the registered absolute-state coverage.

## Current hard limit

The project still does **not** have an arbitrary-millennia birth-calculation engine. In particular, a deep-time Day / Hour proof requires an absolute seasonal epoch and Earth-rotation / civil-time projection chain, not only long-term orbital-shape parameters.

Even after an absolute seasonal epoch exists, Day / Hour still require separate proof stages including TT↔UT / ΔT, civil-zone policy, day-boundary convention and the selected clock basis. An event timestamp must therefore not be promoted directly into “all four pillars resolved”.

## Current design frontier

1. **Validate a direct seasonal-event provider inside its own declared range.** Before production integration, compare modern exact solar-term events against the existing Tyme path and record source/version/time-scale/coverage metadata.
2. **Integrate only the validated provider role.** A direct-event source should enter `directEventProviderIds`; a state ephemeris should enter `absoluteStateAdapterIds` and still require the app crossing solver.
3. **Propagate absolute epoch into the Day / Hour proof chain separately.** Add Earth-rotation / ΔT and civil-time conventions without hiding their uncertainty.
4. **Refuse unsupported deep epochs.** A provider bounded to a finite range cannot be stretched to the +24,000-year or deeper recurrence merely because the discrete recurrence arithmetic closes there.
5. **Optional Western sky only after the above remains stable.** Planets/aspects require explicit ephemeris provenance and remain distinct from BaZi classifications.

## Regression boundary

Every main-instrument or deep-time PR should continue to preserve:

- exact boundary tests;
- canonical radial order `Hour → Day → Solar annual band → Month → Year`;
- Zodiac ownership by the Solar annual band rather than an independent time ring;
- canonical fan geometry and true-390 px composition;
- linked drag and Free Compare semantics;
- hidden-layer isolation;
- reference-frame invariants;
- discrete intra-state progress;
- exact shared-boundary truth;
- scale-emphasis and classification-overlay invariants;
- recurrence / astronomical residual / determinacy / proof-chain gates;
- source-role provenance for deep-time claims;
- desktop and mobile PNG inspection where presentation changes.

The current direction is therefore: keep radial position semantically meaningful, keep classification systems distinct, and extend only source-backed portions of the absolute-time proof chain without converting model coverage into unsupported certainty.
