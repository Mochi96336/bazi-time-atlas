# BaZi Time Atlas — current implementation checkpoint

Updated through the current production wheel, deterministic visual evidence, typed Day/Hour proof chain, bounded DE441 seasonal-event runtime work, and the Atlas temporal-context state/control migration on main.

This document is the **normative current-state checkpoint**. `docs/kinetic-atlas-plan.md` is historical design rationale and must not override behavior locked by current tests. Cross-cutting invariants that should survive future feature work are consolidated in `docs/architecture-contracts.md`. Research-specific presentation work must also follow `docs/research-visual-constitution.md`, which defines the Research visual hierarchy, diagram grammar, typography/spacing/color foundations and design-QA process without overriding semantic contracts.

## Product state

The landing page is a kinetic time instrument rather than a dashboard. One **Selected Instant** drives every time layer, while each layer keeps its own motion law and exact boundary semantics.

Radial position and radial thickness both carry temporal meaning: short / fast cycles live inside and are thinner; long / slow cycles live outside and are wider. The primary stack runs inner → outer as:

1. **Hour pillar** — 60-state wheel with double-hour boundaries under the Atlas fixed-offset temporal context; the production default is UTC+08:00.
2. **Day pillar** — 60-state wheel using the configured day-boundary convention; the production default is Zi-initial 23:00.
3. **Solar annual band** — one continuous apparent-solar-longitude cycle per year. It contains the 24 solar-term structure and the derived tropical-zodiac classification sub-band.
4. **Month pillar** — 60-state wheel changing only at exact **jie** boundaries.
5. **Year pillar** — 60-state wheel changing at exact Li Chun.

Tropical Zodiac is **not** a sixth independent time ring. It is a derived classification overlay inside the Solar annual coordinate and has no independent primary drag target, time law, visibility ownership or reference frame.

The visual thesis remains: **one instant, multiple coordinate systems, no fake universal mechanical period.**

## Navigation contract

Primary product navigation is deliberately reduced to the two actual product-level destinations:

`時間圖譜 → 研究`

`出生` and `六十甲子` remain reachable at their existing URLs as compatibility/support surfaces while their useful capabilities are absorbed into the Atlas. They are **not** top-level product views and must not reappear in `.site-nav`. Existing Birth → Sexagenary deep links and `?ganzhi=` reference links remain valid during the migration so navigation cleanup does not delete functionality.

The recurrence/deep-time lab remains the visually secondary final **Research** destination. Cross-view browser checks lock the two-item order, labels, href and secondary treatment across the Atlas, Research and retained compatibility surfaces on desktop/mobile fixtures.

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
- optional classification overlay keeping BaZi Five-Phase and tropical-zodiac element/modality systems visually and semantically separate;
- one authoritative temporal context shared by desktop/mobile exact-time entry, wheel resolution, linked solar scrubbing, boundary readouts and canonical URLs;
- a low-density temporal-context popover that reuses the existing time-basis readout instead of adding a permanent settings row or toolbar control.

Scale presets change reading priority, not geometry:

- **48 小時** — Hour / Day remain full contrast. Solar stays legible context while the much larger Month / Year shells progressively recede by opacity plus saturation/luminance. Hovered or actively dragged rings immediately recover full contrast.
- **一年** — Solar / Zodiac / Month become the primary comparison, with Year and fast clocks retained as secondary context.
- **60 年** — Year becomes the primary reading while Month, Solar, Day and Hour remain visible as phase context.

The Visual PNG self-check now captures all three scale states at desktop `1440×900` and true mobile `390×844`. It also captures the originally reported Selected Instant regression at `2026-09-14 07:43:42 UTC+08`, so presentation fixes are reviewable against a deterministic real case rather than only the current clock.