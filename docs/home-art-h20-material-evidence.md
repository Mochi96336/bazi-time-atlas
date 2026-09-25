# Home Art H2.0 — deterministic material evidence contract

Status: diagnostic harness only. This stage does **not** change the resting material
palette, phase model, ring geometry, typography, or shader output unless a reviewer
explicitly requests a valid \`materialProbe\` URL.

## Authority and frozen reference

- Production H1 reference: \`25c4929160c6228ab41c92f592e2dcc23d01386a\`.
- Selected UTC instant: \`2026-09-13T23:43:42.000Z\` (UTC+08 2026-09-14 07:43:42).
- Screenshot viewports: \`1440x900\`, \`2047x1038\`, **actual** \`390x844\`.
- The 390px fixture uses a 500px Chrome outer window with a genuine 390px
  iframe viewport; do not compare screenshots as though it were a 500px layout.
- All tests use fixed CSS/device scale and the CI Chromium CJK font environment.

The existing material screenshot script captures the same fixed instant for
\`?material=roughness\`, \`?material=svg\`, and
\`?material=roughness&materialWebgl=off\` (the real forced fallback).
The explicit fallback gets screenshots for all three viewports; DOM checks
independently reject accidental roughness activation in fallback mode.

## Diagnostic ablations, never production defaults

Only an explicitly selected roughness URL can change material layers:
\`?material=roughness&materialProbe=NAME&instant=...\`.

| NAME | One isolated difference from the no-ablation reference |
| --- | --- |
| \`none\` | Explicit zero-ablation baseline |
| \`solar-no-oxidation\` | Remove Solar oxidation |
| \`solar-no-scratches\` | Remove Solar primary/handling scratches |
| \`solar-no-reflection\` | Remove Solar fixed-world satin catch |
| \`zodiac-no-patina\` | Remove Zodiac cloud-patina contribution |
| \`zodiac-no-reflection\` | Remove Zodiac specular/micro-normal overlay, retain patina |
| \`graphite-no-response\` | Remove the four graphite shader overlays only |

Missing or unknown probe names, a probe without \`material=roughness\`, and all
SVG/fallback requests must leave production behavior unchanged. The named
probe and the precise SVG-to-screen matrix are exposed as DOM attributes only
while a valid diagnostic probe is active. The latter gives measurements a
geometry-derived material region; there are no hand-picked pixel rectangles.

## Evidence generation

Run \`npm test && npm run check:syntax\`, serve the repository at
\`http://127.0.0.1:4173/\`, then run \`npm run visual:check\`. On CI,
the Visual PNG self-check uploads the entire \`tmp/visual-check/\` directory.

New evidence:
- \`material-fallback-{2047x1038,1440x900,390x844}.png\` alongside the
  existing roughness/SVG views.
- \`material-probe-{NAME}-1440x900.png\` and one independent \`none-replay\`
  of the same reference probe.
- \`material-probe-evidence.json\`: screenshot SHA256 and byte size, fixed
  instant, exact screen CTM, canonical radius mask pixel counts, and measured
  per-layer RGB/brightness differences.
- Original no-probe \`material-roughness-1440x900.png\` is also compared against
  the explicit \`none\` screenshot to detect any diagnostic-mode baseline drift.

Measurements are intentionally **descriptive**, not aesthetic scores.
\`meanAbsoluteRgb8\` is the mean absolute 0–255 RGB-channel difference inside
the actual Solar/Zodiac/graphite mask. \`changedFraction3\` is the fraction
of mask pixels whose largest channel difference is at least 3 levels.
\`meanDisplayLuma8\` is an approximate encoded sRGB display luma, not a
physical luminance measurement. The same probe also records changes outside
its target mask and a fresh baseline-to-baseline capture-noise measurement.

A feature that looks invisible and measures at or below replay noise is a
**finding for human review**, not an automatic CI failure. This distinction
prevents optimizing to an arbitrary screenshot-difference score.

## Manual review gate (required after CI, before an H2.1 design)

1. Compare production H1, default new-head screenshot, explicit \`none\` and
   \`none-replay\` at native 1440 width. Verify that the diagnostic code has
   not altered default appearance or caused capture non-determinacy.
2. Inspect six ablation screenshots against explicit \`none\`. For each
   Solar/Zodiac/graphite change, identify whether the missing feature is
   **actually visible at normal zoom**, helps material legibility, or merely
   adds nonfunctional noise/bright patches. Open the native PNG, not only
   a compressed contact sheet.
3. Check 2047, 1440 and actual 390 widths for default roughness, native
   SVG and forced fallback. Confirm the same material hierarchy, mobile
   fixed identities, Selected Instant ownership and absence of new edge seams.
4. Review ordinary, Tools, Classification, Find Time and inspector captures
   from the existing Visual suite for cross-view hierarchy and legibility.
5. Examine \`material-probe-evidence.json\` for unexpected non-target changes
   and for baseline variability before interpreting small material deltas.
6. Keep every H2.1 material/style change in a separate PR with its own
   before/after screenshots and the same contract. No palette or roughness
   amplitude change should be smuggled into H2.0.

The test suite verifies data integrity, diagnostic gating, browser activation,
screenshot dimensions and reproducible measurement arithmetic. **Passing CI
does not certify that a rendered surface looks like brass or mineral coating.**
