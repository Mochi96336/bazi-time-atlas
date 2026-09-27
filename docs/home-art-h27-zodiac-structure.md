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

This is an **optical concept test** rather than a new shader. The script imports the repository's `WHEEL_CENTER` and `RADII` and clones the **actual material-bed path d attribute** from the initialized authentic wheel. The variants use no independent planet, calendar, Zodiac/solar-angle computation or rotation. A world-space, nonrepeating gradient is intentionally not a moving visual element; its intensity is not driven by the selected zodiac sign. No white or glowing rim, clouds, stars, random scratches or broad page color change. Underlying color tokens, Solar brass, all graphite rings, Selected Instant, classification pigments, material shader, cursor, and the mobile Zodiac readout remain unchanged.

C2 is exploratory: even if C1 looks wrong, showing C2 beside it can explain why, but C2 is NOT authorized as production unless its shared recessed base is first judged conceptually sound.

## Real, falsifiable acceptance gate

Capture C0/C1/C2 at exact **native width** 390 and 1440 across real Chromium `material=svg`, live `roughness`, and forced fallback. Also cover 320 and 2047 roughness extremes, a second actual selected instant on phone, and normal Classification's computed category colors. These 27 screenshots are real iframe captures of the original home page; the overlay lives in the **test iframe only**, never as an extra live CSS toggle.

For material-only numerical diagnostics, each **screenshot process** stamps the post-font/layout SVG CTM in its own first 96×4 pixels. Use that exact stamp with the canonical geometry to isolate Zodiac versus Solar/graphite masks; fail if a modified candidate leaks outside Zodiac beyond actual baseline replay noise. A passing mask check proves only locality.

Review at 100% real pixels: the recessed sleeve should read as the same instrument-family *material* at 390px, not a bright third stripe alongside warm Solar; selected ivory datum and active labels must remain legible. C2 must not resemble artificial glare, an independently lit clock, a visible brush texture, or a white halo. If no meaningful normal-size visual identity survives, close the trial rather than building a production renderer or tweaking opacity indefinitely. Any accepted concept requires a fresh **separate minimal production PR**, exact-head QA/Visual/native screenshots and explicit semantic isolation; no test harness should be merged from this artboard PR.
