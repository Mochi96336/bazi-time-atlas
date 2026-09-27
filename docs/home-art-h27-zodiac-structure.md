# H2.7 Zodiac structural artboard — real wheel, zero production theme changes

Tracks [#492](https://github.com/Mochi96336/bazi-time-atlas/issues/492). The B2 cool-night background is already deployed on main `6c594e37cb2dbf66027de7c67cdc466a773b1401`; all hypotheses here use exactly that original background, the existing `--zodiac: #424b59`, existing roughness WebGL and all original semantics.

## Correct diagnosis: narrow annual band, not insufficient blue

Zodiac is only the derived strip at canonical annual radii **840–900** inside the same solar-longitude ring. Under native 390px presentation, changing microscopic GLSL hue caused a globally negligible max 1-channel difference (#488). Changing 3 stop opacities (#493) measurably changed the true material ROI by about 1.9 RGB8/channel but still did not read as a materially distinct surface. A successful approach must work at the *scale of the actual visible band*, not by escalating parameters.

## Exactly three nonproduction appearances

| Variant | Hypothesis | Engine and geometry |
|---|---|---|
| **C0** | Unmodified approved B2/production baseline | No injected nodes or styles |
| **C1** | A neutral recessed hard-surface sleeve with a broad, bevel-like radial tonality *within* the band | One cloned canonical Zodiac SVG material path; fixed-world radial gradient with six broad, low-alpha steps |
| **C2** | C1 with a restrained directional satin response, using the same upper-left fixed-world lighting language as the instrument | C1 plus a second cloned canonical path; a single long fixed-world linear gradient over the entire surface |
| **C3** | **Review-derived restraint**: retain exactly C1 material geometry but composite it at 54% strength, avoiding the thick auxiliary blue-belt impression seen at true phone size | One *identical* cloned canonical C1 path, same radial gradient; only the added presentation path receives opacity 0.54 |

This is an **optical concept test** rather than a new shader. The script imports the repository's `WHEEL_CENTER` and `RADII` and clones the **actual material-bed path d attribute** from the initialized authentic wheel. The variants use no independent planet, calendar, Zodiac/solar-angle computation or rotation. A world-space, nonrepeating gradient is intentionally not a moving visual element; its intensity is not driven by the selected zodiac sign. No white or glowing rim, clouds, stars, random scratches or broad page color change. Underlying color tokens, Solar brass, all graphite rings, Selected Instant, classification pigments, material shader, cursor, and the mobile Zodiac readout remain unchanged.

C2 is exploratory: even if C1 looks wrong, showing C2 beside it can explain why, but C2 is NOT authorized as production unless its shared recessed base is first judged conceptually sound.

## Real, falsifiable acceptance gate

Capture C0/C1/C2 at exact **native width** 390 and 1440 across real Chromium `material=svg`, live `roughness`, and forced fallback. Also cover 320 and 2047 roughness extremes, a second actual selected instant on phone, and normal Classification's computed category colors. The initial matrix generated 27 screenshots; C3 expands the follow-up to **36 real captures** (all variants at the same settings), are real iframe captures of the original home page; the overlay lives in the **test iframe only**, never as an extra live CSS toggle.

For material-only numerical diagnostics, each **screenshot process** stamps the post-font/layout SVG CTM in its own first 96×4 pixels. Use that exact stamp with the canonical geometry to isolate Zodiac versus Solar/graphite masks; fail if a modified candidate leaks outside Zodiac beyond actual baseline replay noise. A passing mask check proves only locality.

Review at 100% real pixels: the recessed sleeve should read as the same instrument-family *material* at 390px, not a bright third stripe alongside warm Solar; selected ivory datum and active labels must remain legible. C2 must not resemble artificial glare, an independently lit clock, a visible brush texture, or a white halo. If no meaningful normal-size visual identity survives, close the trial rather than building a production renderer or tweaking opacity indefinitely. Any accepted concept requires a fresh **separate minimal production PR**, exact-head QA/Visual/native screenshots and explicit semantic isolation; no test harness should be merged from this artboard PR.

## Native visual decision after first 27 images

The first actual 390 and 1440 SVG/WebGL matrices resolved the optical uncertainty. C1's full-strength recessed geometry is now clearly visible, but reads as a **separate broad cool-blue belt** rather than a subtle derived strip within the single annual Solar coordinate. C2 adds a striking bright silvery arc and is **rejected** for overpowering the warm Solar and implying an extra autonomous ring; more satin is not the answer. Their pixel masks proved isolation but not aesthetic acceptance: C1 mean encoded RGB8 delta 8.38444/channel inside Zodiac, C2 27.09929; both exactly zero outside. The baseline replay was identical. These measurements are not perceptual scores.

C3 is the bounded, *single* refinement warranted by that native review: reuse exactly C1's canonical annular surface with its radial, broad-scale recession but set the added presentation path to opacity 0.54. All original C0/C1/C2 remain captured so there is no moving-baseline trick. Evaluate C3 at unscaled 390 first. If it still looks like a separate blue clock or becomes imperceptible, explicitly reject it; do not run another unbounded coefficient search. Whether C3 passes or fails, never merge this evidence harness into production.

## Correction before production port: synchronous GPU viewport is mandatory

During #495 production screenshot review, the *old* H2.7 artboard `material=roughness` screen showed Solar brass occupying the wrong visual band: the true Solar-material ROI had mean red–blue **-3.78**, while the unmodified same-page SVG Solar control had **+13.88** and real production WebGL had **+21.41**. This is **not** evidence of a normal artistic difference: the test harness initially navigated the child iframe before assigning its native width, allowing the shader to initialize against the browser's default 300px iframe. Even a subsequently corrected screenshot CTM marker cannot update an already stale GPU projection. The old 36-frame same-fixture mask checks prove *relative* Zodiac-only optical edits but **do not certify an authentic full-wheel roughness view or production-port parity**.

The harness now (1) assigns the full native iframe width/height in the synchronous bootstrap **before** `frame.src`, and (2) fails the browser evidence if unmodified C0's *actual WebGL Solar* does not retain the expected warm material signature relative to the unmodified C0 SVG Solar at identical screenshot-process post-layout CTM. Quality assertions lock both safeguards. **All 36 frames must be recaptured and the C3 normal-size decision repeated** before calling #495 production-port parity verified. Do not weaken this gate merely to preserve the previous visual conclusion; if the new alignment changes C3's hierarchy, revise or reject the production candidate before merge.
