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
