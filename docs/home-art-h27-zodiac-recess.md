# H2.7 — restrained Zodiac inset: production evidence and limits

**One bounded material adjustment, not a new time coordinate or a full rough-metal redesign.** H2.5 B2 remains the approved page/background authority. The existing Zodiac band still derives from the Solar annual longitude.

## Important correction: retired nested-artboard WebGL proof

The original nested experiment [#494](https://github.com/Mochi96336/bazi-time-atlas/pull/494) placed the WebGL canvas in an iframe that could initialize at a stale default width. Even the later, correctly measured SVG screenshot CTM could not repair an already misprojected GPU surface. Its original WebGL-specific masked statistics (including **4.50170 RGB8/channel**, **88,120** apparent Zodiac pixels and **0** non-Zodiac pixels) **must not be cited as proof of real production renderer parity**. A corrected independent Solar-warmth check caught the discrepancy. That artboard is archived without merging.

We instead compared independent **genuine-page** screenshots from the repository's ordinary Material Visual workflow, using matching viewport, mode and Selected Instant. The baseline `6c594e37…` and later Research-integrated `6b7953fa…` have identical home material sources:

- [Unmodified B2 production Visual](https://github.com/Mochi96336/bazi-time-atlas/actions/runs/36344954544), artifact **10939783954**.
- [C3 exact-head production-style Visual](https://github.com/Mochi96336/bazi-time-atlas/actions/runs/36349373114), artifact **10941757669**.
- [H2.8 C4 alternative direct-page Visual](https://github.com/Mochi96336/bazi-time-atlas/actions/runs/36354657188), artifact **10943965612**, [experimental PR #496](https://github.com/Mochi96336/bazi-time-atlas/pull/496) closed unmerged.

All three are independent real-site capture outputs; the 1440 WebGL views are direct full-page browser captures, while the normal project's standard mobile Visual procedure supplies native 390px screenshots.

### Native review — why C3, not C1/C2 or the later C4 joint

The full-resolution original-sized **390 SVG/WebGL/fallback, 1440 SVG/WebGL and 2047 WebGL** views were compared. C1 is an obvious independent blue belt; C2 produces an oversized silvery satin band and competes with Solar. The true production C3 appears as a **moderate, diffuse cool recess** that keeps the original warm Solar and ivory Selected Instant legible, without C2's glare.

The deliberately different H2.8 C4 attempted to add only tiny engraved joints at *both* sides of the existing Zodiac strip, leaving its center untouched. Real-phone and desktop native screenshots showed its **two dark outlines made the strip look more independently bounded**, contrary to the shared-annual-material goal. Therefore C4 was rejected without another opacity sweep.

Whole-frame direct capture **descriptive** differences for C3 relative to real B2:
- Native **390px cropped WebGL**: mean absolute encoded RGB8/channel **0.22177**, **4.593%** pixels with maximum channel delta at least 3; strongest changed pixels x=8–381/y=365–437.
- Native **390px cropped SVG**: **0.22808**, **4.633%**, changes y=365–440.
- **1440×900 direct WebGL**: **0.34172**, **6.386%**; changes x=0–1439/y=411–877.
- **1440×900 direct SVG**: **0.33510**, **6.415%**; changes y=411–879.

These are *whole-frame comparisons with no artboard-derived material mask*. The changed-pixel bounds coincide with the visible Zodiac annulus, and the independent real visual comparison shows no incidental layout, Solar, graphite or cursor change. Percentages and RGB magnitudes describe image extent, **not** a visual-quality score or a substitute for native review. Classification's existing categorical appearances were inspected independently and remained visually consistent; static regression tests lock the color authorities.

## Precisely bounded implementation

The original canonical `#m2-zodiac-hard-surface` and `#m2-zodiac-hard-response` remain unchanged. `index.html` adds just one fixed-world radial gradient (center `600,1360`, radius `900`), six broad stops along canonical radii `840–900`. The renderer places exactly one extra **presentation-only** path with the *same existing Zodiac bed `d`*, immediately after that bed in its original material layer. `radial-hierarchy.css` draws the new recess at **0.54** compositing opacity.

No new clock/phase, longitude calculation, layout, independent ring geometry, Zodiac base pigment, Solar material, shader, cursor, active sector, categorical palette, texture frequency or typography change.

## Release gate and residual work

Merge only after current-head Quality plus the full Visual are green, final genuine native screenshots agree with the direct-source images above, PR is conflict-free on current main, and the post-merge Pages deployment is verified. Do **not** merge either exploratory #494 or #496. This change establishes modest visibly readable material recession; it does not establish scratched-metal microtexture, optical renderer pixel equality, or solve the mobile wheel's small physically projected text. Do not reintroduce hue-only shader trials or blanket opacity changes to address those unrelated problems.
