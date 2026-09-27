# Home Art H2.5 — restrained B2 reference-field production trial

**Status:** separate, narrow production candidate; not an automatic visual acceptance.
Baseline: H2.4 main `d40f2c1ee05f9269b384a8d0a7bcf9c9dfdc443c`.
Evidence: [H2.5 A/B experiment PR #486](https://github.com/Mochi96336/bazi-time-atlas/pull/486), [A/B capture run 36340041285](https://github.com/Mochi96336/bazi-time-atlas/actions/runs/36340041285).

## Why B2, rather than indiscriminately adding blue

The earlier A1 candidate visibly colored the whole field. B1's ambient-only modification was harder to distinguish at normal size. B2 is the restrained, intermediate trial; it keeps the wheel's graphite, warm Solar and ivory cursor untouched. It is not a claim that the homepage's entire visual hierarchy problem is solved.

For reference, unscaled 1440×900 WebGL A0-relative whole-frame mean absolute RGB8/channel changes measured from the SAME code/instant/renderer are: A1 4.7548, B1 0.7804, B2 2.0700. Negative-space x420–620/y38–90 changes were 6.3194, 1.8111 and 2.5929 respectively. These merely describe how much of the image changed, **not** a perceptual quality score. A0 screenshot replay may differ at tiny antialiasing pixels.

## Exact production change

Only one canonical source in `kinetic-atlas.css`:
- `--field: #0a0d13` (was `#090b0f`)
- `--field-raised: #0e121a` (was `#0e1116`)
- page radial ambient `rgba(121,145,173,.044)` terminating by 30rem
- body top `#0e141d` and bottom `#080a10` with existing field anchor at 68%.

Only existing H0 and temporal grammar tests are updated to match the single field authority. The H2.4 test fixture's *outer unused screenshot gutter* is updated to the same field, so 320/390 browser PNG wrappers do not invent an inconsistent neighboring black.

No changes to Zodiac, Solar, four graphite pigments, active-sector percentages, Selected Instant, shaders, SVG material beds, classification categories, rotation, typography or spatial geometry. The failed three-GLSL-tint study [#488](https://github.com/Mochi96336/bazi-time-atlas/pull/488) is closed unmerged; its native CTM mask showed max one RGB-channel level inside Zodiac and none outside, so no shader experiment is included here.

## Acceptance / rejection before merge

Run Quality, full Visual, and native manual image review on the **exact PR head**. Check the real 320 and 390 CSS-pixel left crop, full 1440 and 2047 desktops, two different real Selected Instants, SVG/roughness/forced fallback, normal/Analysis/Classification. Avoid zoom-only or difference-image acceptance. Confirm the navy is ambient atmosphere rather than a blue wall and that the warm Solar and cursor remain visually distinct. If B2 feels too cold or is indistinguishable at phone size, reject the trial and leave main unchanged; B1 is an independent conservative alternative, not a fallback that should be silently applied.

Do not merge this small trial together with the temporary evidence harness PR #486; their separate purposes must remain clear. If the B2 field is accepted, future Zodiac surface-identity work must be a new, independently verified design step and cannot reintroduce the failed opt-in tint branch.
