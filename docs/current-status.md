# BaZi Time Atlas — implementation checkpoint

Updated after PR #52.

## Product state

The landing page is now a six-layer kinetic time instrument rather than a dashboard. One Selected Instant drives every layer, while each layer keeps its own motion law and boundary semantics.

Current ring stack:

- Hour pillar — 60-state wheel, two-hour double-hour boundaries under the atlas UTC+08:00 reference clock.
- Year pillar — 60-state wheel, exact Li Chun boundary.
- Month pillar — 60-state wheel, exact 12-jie boundaries.
- Day pillar — 60-state wheel, Zi-initial 23:00 day-boundary convention.
- Solar longitude / solar terms — continuous apparent-solar-longitude phase with 24 fixed term markers.
- Tropical zodiac — fixed 12 × 30° classification sharing the solar-longitude phase.

The visual thesis remains: one instant, multiple coordinate systems, no fake universal mechanical period.

## Kinetic instrument capabilities

Implemented on the main instrument:

- canonical shared SVG-world center, contiguous six-ring geometry and fan clipping;
- responsive SVG camera with a true 390 px mobile first viewport;
- linked ring scrubbing that changes the master Selected Instant using each ring's real semantics;
- Free Compare with independent manual offsets and semantic detents;
- high-speed Hour ring;
- geometry-aware grab/active feedback;
- transient motion traces derived from actual rendered rotation deltas;
- non-destructive layer visibility controls;
- co-rotating reference frames for World / Hour / Year / Month / Day / Solar;
- true intra-state progress for Hour / Day / Month / Year without tweening Ganzhi identities;
- terminal boundary gates for the active discrete teeth;
- exact shared-boundary highlighting only when resolved next-boundary timestamps are identical to the millisecond.

Two important shared-boundary examples are now represented directly:

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

## Current hard limit

The project still does **not** have an arbitrary-millennia birth-calculation engine. In particular, a deep-time Day / Hour proof requires an absolute seasonal epoch and Earth-rotation / civil-time projection chain, not only long-term orbital-shape parameters.

The current source audit distinguishes:

- long-term orbital/insolation geometry coverage;
- absolute Earth/Sun state ephemeris coverage;
- app integration and solar-longitude / seasonal-epoch root solving;
- Earth-rotation and clock-basis requirements for Day / Hour.

A candidate can therefore be an exact discrete recurrence and still remain insufficient to prove all four pillars at a distant epoch.

## Current research frontier

Priority order after the kinetic core:

1. **Absolute seasonal-epoch pipeline inside defensible source coverage.** Integrate an explicit state ephemeris / solver path for epochs where the source actually covers the target, then propagate that epoch through the Day / Hour proof chain.
2. **Deep-time provenance and uncertainty.** Keep source/version/validity ranges visible and refuse unsupported absolute timestamps outside coverage.
3. **Instrument refinement only where it reveals time structure.** Prefer geometry that exposes mismatch, boundary approach, concurrence and non-closure over explanatory cards or decorative rings.
4. **Optional Western sky layer only after the above remains stable.** Planets/aspects require an explicit ephemeris source/version and must remain distinct from BaZi classifications. Chinese Five Phases and Western four elements/modality must not be presented as equivalent systems.

## Regression boundary

Every main-instrument PR should continue to preserve:

- exact boundary tests;
- canonical ring geometry and true-390 px composition;
- linked drag and Free Compare semantics;
- hidden-layer isolation;
- reference-frame invariants;
- discrete intra-state progress;
- exact shared-boundary truth;
- recurrence / astronomical residual / determinacy / proof-chain gates;
- desktop and mobile PNG inspection.

The current direction is therefore no longer “build the recurrence lab”. It is: keep the six-ring instrument truthful while extending only the missing source-backed parts of the deep-time proof chain.
