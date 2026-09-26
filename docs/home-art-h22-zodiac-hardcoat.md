# Home Art H2.2 — Zodiac hardcoat material experiment

This is a **diagnostic-only A/B**, not a production material update. Base: H2.0 plus subsequent non-overlapping Research updates, current main at branch creation `44885e4`. Earlier Solar experiments #476 and #479 were closed unmerged because actual native screenshots did not justify their shader complexity.

## Measured motivation from H2.0

A correct, screenshot-process-CTM geometry mask showed the existing Zodiac cloud/patina removal changed only 0.03047 mean encoded RGB/channel, with 0.1566% of Zodiac pixels crossing a three-channel-level difference. Removing the existing Zodiac specular/micro-normal overlay changed mean RGB 0.48349; only 0.143% crossed three levels. These values describe pixel differences, **not perceptual quality**. The current Zodiac often reads as a flat dark band in the native wheel.

## Exact isolated experiment

- Keep the production H2.0 default **byte-equivalent**. Only explicit `?material=roughness&materialProbe=zodiac-hardcoat-preview` activates H2.2.
- Remove the cloud/patina contribution **inside that diagnostic** (existing separate `zodiac-no-patina` remains the controlled removal-only reference).
- Reuse the existing rotating low-frequency surface field, its derivatives and fixed-world light for a restrained, direction-dependent dark hardcoat response. No additional fbm/noise sampling, no bright blue pigment, starfield, glow, surface geometry, new label styling, or new lighting framework.
- In the preview, raise only existing bounded directional specular and signed micro-response envelopes without increasing shader sampling frequency. If the result looks like polished plastic or a brighter blue sticker, reject it.
- Existing CSS/HTML, SVG and forced fallback, root color tokens, Selected Instant, ring phase and Research workflows are untouched; any eventual non-preview style change requires its own fallback-equivalence review.

## Hard review gates

1. Fixed-instant 2047/1440/true-390 native WebGL preview vs same-head H2.0 roughness, native SVG and forced-SVG fallback. Never use contact-sheet upscaling or exaggerated delta as proof of legibility.
2. Corrected screenshot-process-CTM geometry audit: `zodiac-no-patina` vs baseline and `zodiac-hardcoat-preview` vs baseline; baseline/no-probe and independent replay must remain identical in material ROI, and **every non-Zodiac ROI must have zero changed pixels**.
3. Inspect Zodiac at normal screen scale: a hard surface should be distinct from graphite without bright blue paint, decorative uniform rings, stars, carbon-fiber look or distracting luminosity. Check actual 390 contrast near low-value Zodiac text and the ivory Selected Instant.
4. No automatic merge based on test green, mean RGB, changed fraction or file presence. If real visual improvement is absent, close this diagnostic PR unmerged and redirect effort toward genuine layout/typographic readability rather than escalating shader complexity.
5. Any planned production adoption separately compares runtime drawing cost on real devices; screenshot image delta alone cannot prove acceptable GPU cost.


## Final independent optical audit — hardcoat candidate rejected

Current exact-head [Quality 36265967030](https://github.com/Mochi96336/bazi-time-atlas/actions/runs/36265967030) and [Visual 36265966933](https://github.com/Mochi96336/bazi-time-atlas/actions/runs/36265966933) both **success** at `1221883a`; Visual artifact ID `10914416585` includes original WebGL / actual SVG / forced fallback and diagnostic hardcoat at 1440, 2047 and real 390.

Corrected 1440 screenshot-process-CTM masks are stable: Zodiac 88,120 pixels. Default vs explicit baseline and baseline replay have zero pixel changes across all material ROIs; diagnostic hardcoat reports **zero** outside-Zodiac pixel changes. Compared with default, hardcoat changes 10.0601% of Zodiac mask pixels by ≥3 RGB8 levels, mean absolute RGB8/channel 1.01235, max channel delta 4 and mean encoded display luma 27.135→28.104. Removing Zodiac cloud patina alone changes only 0.1566% (mean RGB8 0.03047).

Actual unamplified desktop 1440 and mobile 390 screenshots and 1:1 crops were manually examined next to H2.0 and true SVG: the harder coat **does not read as substantially more tangible** at ordinary viewing size. It adds code and raises distributed low-level brightness without an obvious material-identity benefit. The underlying dark Zodiac ring and tiny low-contrast labels remain the more salient readability problem. A pixel-count result is not a perceptual quality score.

**Decision: reject and archive H2.2; close PR unmerged.** Keep H2.0 production visuals unchanged and pivot to a separately scoped Zodiac reading contrast/semantic hierarchy audit. Do not compensate by increasing blue saturation, adding clouds or raising specular caps again.
