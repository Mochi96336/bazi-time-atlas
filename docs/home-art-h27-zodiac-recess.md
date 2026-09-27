# H2.7 — one restrained recessed Zodiac inset

**Production candidate only; not a claim that a complete new metal texture has been achieved.** This change ports the single native-tested **C3** material surface from [experiment PR #494](https://github.com/Mochi96336/bazi-time-atlas/pull/494) and [design audit #492](https://github.com/Mochi96336/bazi-time-atlas/issues/492) into the existing canonical Zodiac annulus.

## Why this material and not the other variants

The original C0 Zodiac band was so dark that a separate surface was hard to notice at real phone size. The hue-only GLSL prototype #488 was invisible; a weak three-stop-alpha revision #493 was also inconclusive. H2.7 then generated **36 real SVG/WebGL/fallback capture conditions** at 320, 390, 1440 and 2047px plus a second actual instant.

Full-resolution 390/1440 review:
- **C1:** material structure now visible, but too independent: a wide cold-blue belt.
- **C2:** a large bright satin/gray band; rejected for conflicting with the warm Solar and selected ivory datum.
- **C3:** **same C1 recessed shape/gradient, blended at 0.54 opacity**. Recognizable tonal recession at true 390, less of an autonomous bright band. Moves the overall appearance modestly while preserving the muted graphite/cool-night family.

The real 1440 screenshot-process CTM mask reports **88,120 Zodiac pixels** and **804,528 non-Zodiac material pixels**. Relative to original C0, C3 changes the Zodiac mean absolute encoded RGB8/channel by **4.50170** with 85.9986% changing by max-channel ≥3; the rest of the Solar/graphite material mask has **exactly zero** RGB difference, including no baseline replay drift. Classification's categorical computed fill remained exactly identical for C0/C1/C2/C3. These figures show scope/strength only, *not* artistic quality or a pixel-level renderer-equivalence promise.

## Precisely bounded implementation

The original canonical `#m2-zodiac-hard-surface` and its independent `#m2-zodiac-hard-response` are unchanged. `index.html` introduces one fixed-world radial gradient (center `WHEEL_CENTER = 600,1360`, radius `RADII.solarOuter = 900`) with six broad stops spanning exactly **`RADII.solarTermOuter = 840` through `RADII.solarOuter = 900`**. `src/wheel/kinetic-renderer.js` draws one more inert presentation path with the **identical `d` string as the existing Zodiac substrate**, in the same base layer immediately after the bed, rather than computing a new position/phase. `radial-hierarchy.css` fills that path with the new gradient at exactly **0.54** opacity. The existing material shader and browser fallback are untouched.

No new orbit, independent clock, selection state, CSS pigment token, glow, white rim, pattern, roughness-frequency increase, sound, typography, screen layout or extra panel. Do not bring #494's 36-screenshot harness into the production branch.

## Final acceptance gates

- Run exact-head Quality, complete Visual and inspect its full native 390, 1440 and 2047 PNGs after the latest Research integration; inspect forced fallback/SVG separately from WebGL. Compare ordinary and Classification and another selected instant where captured.
- Confirm there is still ONE real shared Solar longitude coordinate. Inspect normal-scale screenshots for whether the inset remains modest rather than a blue third belt; retain warm Solar and ivory Selected Instant hierarchy. Make no claim of genuine roughness geometry, scratched metal or parallax where the implementation only adds low-frequency optical recession.
- If the production port differs substantially from the approved true-size C3 artboard, close this PR unmerged. Do not increase C3 opacity to compensate for an unrelated screen-space typography problem.
- When the narrow inset has landed, close and archive experimental PR #494 **unmerged**; H2.6 issue #492 should record the residual limits and stop repeating micro-hue/shader trials.
