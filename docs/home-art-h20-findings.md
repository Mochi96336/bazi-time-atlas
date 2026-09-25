# Home Art H2.0 — exact-head material ablation findings

Source: [PR #474](https://github.com/Mochi96336/bazi-time-atlas/pull/474), visual run [36158542602](https://github.com/Mochi96336/bazi-time-atlas/actions/runs/36158542602), archived artifact `visual-png-selfcheck` (GitHub artifact ID 10875012386, 7-day retention). Pinned H1 reference: `25c4929160c6228ab41c92f592e2dcc23d01386a`. Time: 2026-09-13T23:43:42.000Z, 1440x900.

These are **descriptive image differences, not perceptual scores**. Record them so later material PRs can test whether a proposed response fixes a real weak point rather than simply making the whole surface brighter.

## Source geometry and baseline validity

The first green capture was **rejected** after an independent audit caught a ~100px y-origin difference between separately launched Chromium `--dump-dom` and `--screenshot`. The final run embeds its own screenshot-process screen CTM in diagnostic screenshot pixels: `[0.996428, 0, 0, 0.996428, 122.143252, -47.649937]`. The separate DOM CTM is recorded only as a warning; it is not used for masks.

The corrected canonical-radii masks contain 133,302 Solar, 88,120 Zodiac and 671,226 graphite pixels. All six ablations produced **zero** non-target ROI pixel differences. The explicit no-ablation capture and independent repeated capture are identical in the actual wheel material masks.

Independent image comparison against the earlier merged H1 artifact found exact pixel identity for default roughness at 1440, roughness at 390, roughness at 2047, and desktop SVG at 1440. The earlier-vs-final SVG mobile screenshot changed 157 pixels (maximum channel delta 9) around x10–80/y56–217; a separate browser run also produced slight SVG-vs-forced-fallback differences near top-left mobile text. Do not claim the entire mobile SVG frame is byte-for-byte deterministic.

## Native 1440 material ablation measurements

Mean absolute RGB is per 0–255 *encoded* channel inside only the listed geometric material ROI. The changed fraction counts pixels whose **largest channel delta is at least 3**. Baseline replay noise within all material ROIs was zero in this run.

| Disabled layer | Mean absolute RGB delta | Changed fraction ≥3 | Maximum channel delta | Native-view observation |
| --- | ---: | ---: | ---: | --- |
| Solar oxidation | 0.15126 | 1.5641% | 6 | Scattered muted patch changes; hardly contributes to a recognizably oxidized body at ordinary zoom. |
| Solar scratch pigment | 0.05591 | 0% | 2 | Fine signal is visible only in amplified difference imagery; normal-view scratches are effectively imperceptible. |
| Solar fixed-world satin catch | 1.30758 | 25.9659% | 7 | Localized part-arc lighting is the observable Solar material cue; removing it looks flatter, not necessarily worse/better. |
| Zodiac cloud patina | 0.03047 | 0.1566% | 4 | Almost no useful mid-distance differentiation in native screenshot. |
| Zodiac specular/micro-normal response | 0.48349 | 0.1430% | 3 | Mostly low-amplitude 1–2-level shifts distributed through the band; identity remains understated. |
| Four graphite shader overlays | 1.34195 | 17.8856% | 6 | Detectable distributed tonal modulation; stronger evidence of a visible global contribution than for individual scratch/patina overlays. |

The six ablation contact sheets magnify channel differences drastically. They MUST NOT be used as examples of the intended final texture or proof that those effects are visible at actual display scale.

## Consequences for H2.1 / H2.2 (design hypotheses, not implemented conclusions)

1. H2.1 Solar: **do not** simply increase scratch-pigment alpha or oxidation patch scale. The screenshot says those layers are under the visible threshold, while a constrained fixed-world catch is already observable. Prototype a local tangential/radial micro-normal response **coupled to the existing deterministic scratch geometry** with local texture rotating with the ring and a fixed external light. Isolate scratch-color vs scratch-normal contributions in later ablation probes. Inspect at true 390 and 1440 before keeping.
2. H2.2 Zodiac: test patina fully disabled against directional hard-surface micro-reflection; do not compensate by boosting blue pigment or a broad nebular cloud. Native screenshots must show identifiable material difference without visible stars, noise, glossy plastic or wallpaper.
3. H2.3 Graphite: avoid blindly boosting the existing overlay, which already has measurable distributed response. Check resting ring hierarchy and the Selected Instant before changing surface amplitude.
4. Keep SVG and forced fallback intentionally readable as equivalent *material families*, not identical GPU pixel output. Confirm native mobile labels/selected line whenever a shader experiment runs.
5. Add small, bounded performance comparisons only after rendering experiments exist; wall-clock headless Chromium launch time does not isolate WebGL fragment shader cost.

**H2.0 remains evidence-only.** The next surface implementation requires a different PR with before/after screenshot review and a rollback-able single-material change.
