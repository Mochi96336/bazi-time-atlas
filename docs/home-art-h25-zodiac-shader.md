# H2.5 Zodiac shader hue-only parity experiment

**Draft and opt-in only.** This branch stacks on H2.5 background laboratory branch `experiment/home-h25-color-baseline-matrix`; it must not be merged into main before the base is settled and native evidence has been independently inspected.

## Precisely controlled comparison

- The production default shader source string is unchanged; `h25ZodiacFragmentSource(false)` returns the original exact GLSL.
- ONLY when the URL explicitly contains both `material=roughness` and `h25ZodiacTint=indigo`, compile the source with three color literals replaced within `renderZodiacMicroResponse`: `reflectionTint` (0.37,0.44,0.51) → (0.34,0.42,0.54); `microLightTint` (0.30,0.37,0.44) → (0.275,0.36,0.47); `nebulaLightTint` (0.18,0.26,0.35) → (0.16,0.25,0.39).
- Do **not** change the Zodiac base CSS color in this PR; the experiment fixture uses the prior A2 `#47556c` or B3 `#47556c` CSS candidate identically for both old and new shader. This isolates *shader color response*, not a second CSS experiment.
- Do not change opacity, roughness, normal strength, reflection intensity, texture frequency, local ring rotation, light direction, Solar or the four graphite rings.
- Forced fallback must **not** claim activation of this WebGL-only probe; Classification's categorical computed fill must not change.

These are bounded hypotheses for directional hue alignment, not guarantees of materially visible improvement or colorimetric pixel parity between SVG and WebGL.

## Real screenshot and isolation proof

The dedicated `scripts/visual-check-home-h25-zodiac-shader.mjs` matrix captures A2 and B3 under the same CSS and instant: old WebGL versus opt-in indigo WebGL, plus SVG and forced fallback controls, at real 390/1440 widths. Additional A2 320/2047 captures and a second real instant at 390 prevent size- and pose-specific visual approval. The child iframe has a screenshot-visible readiness sentinel.

For 1440 screenshots, set `materialProbe=none` so that each **screenshot process itself** embeds the SVG CTM in the first 96×4 pixels. Use the canonical ring model + screenshot CTM to calculate material ROIs, verify equal CTMs, and independently compare Zodiac and **all non-Zodiac material regions**. Do not derive masks from a separately launched `--dump-dom` process.

A repeated legacy capture provides a raster-noise floor; fail if non-Zodiac material differences exceed that floor by more than 0.05 encoded RGB units/channel. Never use overall PNG file size, unmasked pixel differences or amplified diff imagery to declare optical improvement.

## Acceptance decision

Open the unscaled 390/1440 legacy/indigo WebGL images beside the fixed A2/B3 SVG and forced-fallback controls. Keep the variant **only** if a subtle cold-indigo material identity is more coherent at normal viewing size without broad glow, brighter bands, star-like spots, text crowding, or weakening the warm Solar and ivory Selected Instant. If the result is visually indistinguishable, record *inconclusive or no benefit*, not a demand for greater reflection intensity. Reinspect the 320/2047 edge sizes and different selected time.

Run `npm ci && npm run vendor:prepare` before local tests/captures; exact-head Quality, full Visual and dedicated Zodiac isolation CI are required, but green automation alone cannot approve the artwork. The PR must remain Draft; any eventual production change requires a distinct reviewed palette-authority integration with full CSS/SVG/WebGL/fallback verification.
