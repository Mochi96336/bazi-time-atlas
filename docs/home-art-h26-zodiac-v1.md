# H2.6 V1 — native Zodiac substrate visibility study

**Experiment-only draft; does not edit production CSS, shaders, ring semantics or color tokens.**
Tracks [H2.6 issue #492](https://github.com/Mochi96336/bazi-time-atlas/issues/492). B2 production background comes from the reviewed but separately gated [PR #489](https://github.com/Mochi96336/bazi-time-atlas/pull/489); this study branches from its merged-in-Research head `53128d67…` and must be retargeted after any later production release. Never merge the experiment's test iframe or alternate CSS into the live theme.

## Why another shader hue edit is excluded

The failed tint-only [PR #488](https://github.com/Mochi96336/bazi-time-atlas/pull/488) moved **max one RGB8 channel** in the Zodiac ring; the rest of the material mask did not move. A visually detectable material intervention must act on the real substrate at normal scale, not add another sub-pixel highlight color.

## V0 versus V1

- **V0:** original `--zodiac: #424b59`, original `#m2-zodiac-hard-surface` stop opacities `.25 / .19 / .18` (light/mid/dark), original WebGL overlay; **no CSS injected**.
- **V1:** *the same original Zodiac hue*, same gradient position and world-space light, same WebGL renderer; change only the existing SVG substrate stop opacities to `.32 / .18 / .15` using a temporary style in the screenshot iframe. This amplifies the gradient's light/dark structure instead of increasing all points evenly. It is not a new blur, edge stroke, nebula, metal speckle, texture or semantic active style.

Neither hypothesis changes Solar, graphite, cursor, body background, Classification categories, time calculation, ring geometry or the mobile selected-label caption. No additional controls or runtime switch are included in the shipping app.

## Evidence gates and rejection conditions

Run actual Chromium on the same exact branch at 390px and 1440px across three renderer conditions (SVG, true WebGL roughness, forced SVG fallback), plus true 320px and 2047px roughness, and a different selected instant at 390px. Each real screenshot's viewport width is native inside a >=600px wrapper on phone sizes; inspect only the leftmost native-width area at 100% rather than a zoomed or reduced montage.

The screenshot process embeds its own SVG CTM with `materialProbe=none`. Use it for exact canonical Zodiac and non-Zodiac material masks. Independently repeat the V0/1440 roughness capture to establish raster variability, and compare Classification's computed categorical Zodiac fill in V0/V1. DOM validation must prove the chosen WebGL/SVG/fallback mode and the exact selected instant, but must **not** be substituted for the screenshot-process CTM.

**V1 is rejected** if the change remains imperceptible at true 390px, if the brighter side looks like a blue stripe/glow rather than a physically coherent surface, if its radial falloff conflicts with the same fixed light shared by Solar/graphite, or if it reduces the primacy of the ivory Selected Instant. A green CI only means the data is complete. If V1 is helpful, a separate tiny production material PR must still demonstrate native screenshots and be reviewed on an exact new `main`.

Next work only if V1 is convincingly visible: a small fixed-world directional satin response trial, *without* changing its hue or overdriving microscopic WebGL tint. No unconditional V2 or global active brightening.
