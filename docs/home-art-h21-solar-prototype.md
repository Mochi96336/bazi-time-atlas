# H2.1 — Solar directional scratch-normal prototype (draft)

Baseline: merged H2.0 `ebbb3232d8ad65af8ee5e2c219f0b8dddc1d5392`. This experiment changes only the Solar WebGL scratch-light response and its diagnostic probe, **not** the color palette, oxidation algorithm, scratch positions/widths/density, ring geometry, Zodiac or graphite.

## Why

H2.0 corrected screenshot-geometry audit found Solar scratch pigment had 0.05591 mean absolute RGB delta and **zero pixels with a channel change ≥3** when disabled, even though the scratch code is relatively elaborate. The fixed-world satin catch did have visible influence. This experiment changes the *response to the already-existing scratch geometry*, rather than drawing more obvious scratch marks or increasing noise.

## Mechanism

- Return the same deterministic scratch mask/polarity (`x`, `y`) plus two shallow profile-slope components (`z`, `w`) from the existing scratch generator. The slope is perpendicular to the randomly oriented, bent scratch segment, with a two-sided smooth bevel profile, so it represents a groove rather than a flat colored line.
- Map arc-length (tangential) and radius coordinates to ring-local Cartesian directions, then transform that local groove slope into world space with `rotation(-ringRotation)`; this follows the same signed pose bridge as graphite material micro-normals.
- Evaluate a restrained signed diffuse/specular difference against a **fixed-world** light vector. Apply it only where real existing scratch masks are present, with existing `fineAttenuation` to avoid turning subpixel marks into mobile speckles.
- Keep the legacy pigment marks, oxidation, broad brass bed, fixed-world satin catch, Zodiac and SVG fallback unchanged for attribution. A novel `solar-no-scratch-light` diagnostic probe (ID 7) removes only the new response; the old `solar-no-scratches` disables both geometry-linked scratch pigment and reflection.
- No new textures, noise octaves, wide gradients or glare. The shader computes the extra per-groove response behind a sparse scratch-mask conditional; the max signed reflectance correction is bounded.

## Required verification

1. Exact-head full Quality/Visual CI, WebGL shader activation and forced SVG fallback checks.
2. Read `material-probe-evidence.json`: compare no-scratch-light vs baseline and no-scratches vs baseline; verify off-target material pixel difference remains exactly zero. H2.0 data are a reference, not a guaranteed target to maximize.
3. Native 1440, 2047 and actual 390 WebGL/SVG/fallback inspection. A good result should read like very fine directional brass finishing at normal zoom, not amplified-noise demos. Reject white lines, sandpaper/carbon fiber, conspicuous uniform texture or any shift away from Selected Instant.
4. Compare before/after H2.0 **same fixed instant** and make a cropped native-pixel Solar closeup. Keep only if the change is perceptually useful at actual size; if not, revert and document why.
5. Assess performance separately from screenshot-diff size: bound frame costs on the same machine/device; do not treat overall Chromium process-launch time as a GPU benchmark.

Status: prototype. CI success or more changed pixels alone does not authorize merging this style PR.


## Independent exact-head visual audit (pre-performance-probe SHA `3e2de396`)

Compared the actual [H2.0 merged-main Visual artifact](https://github.com/Mochi96336/bazi-time-atlas/actions/runs/36168496226) against [H2.1 draft Visual artifact](https://github.com/Mochi96336/bazi-time-atlas/actions/runs/36168967539), using fixed-time raw 1440, 2047 and actual 390 CSS-viewport PNGs. This comparison is descriptive, not approval of the effect.

- Corrected canonical Solar mask contains 133,302 pixels at 1440. H2.1 baseline vs H2.0 changes 8.6623% of Solar pixels by at least three 8-bit RGB channel levels; mean absolute RGB delta is 0.47756, maximum single-channel delta 8. The explicit `solar-no-scratch-light` ablation reproduces **exactly** the old H2.0 material response in that mask. Non-target mask drift is zero within the diagnostic ablation run.
- H2.1 scratch-light ablation (removes the new response only) gives mean RGB delta 0.47756 and 8.6623% changed; `solar-no-scratches` removes both old pigment and the new response, giving mean delta 0.46891 and 8.5400% changed. The original H2.0 scratch-pigment-only measurement was 0.05591 and 0% changed. This isolates the new visible component without inventing a material quality score.
- At full normal 1440 native review, a more noticeable fine groove pattern appears **asymmetrically on the right darker section** of Solar. In the magnified delta it looks somewhat comb-like. It is not a broad bright stripe, but the spatial clustering may read as repeated vertical marks rather than naturally varied metal finishing. Treat this as a visual concern: additional contrast is not automatically better.
- On actual 390 CSS viewport, the before/after is barely discernible at ordinary zoom and no new bright speckles appeared. Only about 0.178% of the full 500px screenshot wrapper changed by ≥3 channel levels. On 2047, the localized groove changes are more visible. No meaningful layout/ring-geometry change or large Solar brightness shift was observed.
- SVG and forced-SVG fallback were unchanged by this WebGL-only experiment. **Do not** claim WebGL and SVG have pixel-identical metal appearances: this PR only verifies that fallback remains available and the same material family is readable.

### Performance verification

The earlier screenshot difference only proves rendering changes, not frame cost. This PR therefore adds an **opt-in**, same-WebGL-context diagnostic (`?material=roughness&materialProbe=none&materialPerf=1`) and records `solar-groove-draw-cost.json` in the visual artifact. It measures ten alternating on/off groove-response pairs after warmups, with `gl.finish()` in both modes and no browser launch in the timed section. It remains a CPU+GPU-inclusive headless-browser estimate, not an actual device benchmark or GPU-only timer. Review measured values and uncertainty before using it to justify a production cost decision.

Current position: **hold Draft pending the exact new-head benchmark, native material review and evidence about the comb-like right arc**. If the additional groove is only visible as repetitive stripes, a separate targeted iteration should improve the spatial variation rather than increasing the material amplitude.
