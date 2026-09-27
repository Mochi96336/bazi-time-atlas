# Home Art H2.5-0/1 — controlled field × Zodiac color study

**Status: evidence-only experiment, not a production redesign or approved palette.**
Pinned starting main: `d40f2c1ee05f9269b384a8d0a7bcf9c9dfdc443c` (H2.4).
This branch intentionally leaves `kinetic-atlas.css`, `radial-hierarchy.css`,
`src/wheel/material-prototype.js`, semantic phase calculation, ring geometry,
Solar, Hour/Day/Month/Year, active fills, Classification tokens and Selected
Instant untouched.

## Motivation and falsifiable experiment

The proposed `#0B1019` reference field is **lighter and cooler**, not an
attempt to make `#090B0F` even blacker. The Zodiac `#47556C` is a
separate chromatic hypothesis. Do not assume either will look better when
mixed with the existing SVG beds, WebGL hard-coded reflection or the visible
selected datum.

A0 is exact unmodified production (no style injected). A1 changes only the
**page environment group**: field `#0B1019`, raised field `#101824`,
and related radial and top/bottom body gradient. A2 changes only the
root Zodiac base token to `#47556C`. A3 combines A1 and A2.
The visual matrix is the full A0–A3 × SVG / roughness-WebGL / forced-fallback
× native 390/1440, with extra A0 baseline 320/2047 and a second selected
instant on A0/A3 at 390. All runs are pinned to a single code head.

The CSS experiment runs in a **same-origin iframe** inside a screenshot harness.
No production stylesheet is edited. The instrument's canonical selected
instant initializes normally; the fixture then inserts the experiment-only
style at the end of that iframe head for A1–A3. A0 inserts nothing.

**Important renderer limitation:** CSS affects the SVG Zodiac bed, including
the one beneath the WebGL micro-normal overlay, but does **not** automatically
replace the shader's own fixed reflection tints. This matrix measures the
resulting real-world discrepancy. It must **not** be reported as renderer
parity or as a production-ready Zodiac color change. The same is true of
the Solar shader, which this experiment never edits.

## Reproduction

Start a local static server rooted at the repository, e.g.
`python3 -m http.server 4173 --bind 127.0.0.1`. In another shell run:

```sh
npm ci
npm run vendor:prepare
node --test tests/home-h25-color-lab.test.js
BASE_URL=http://127.0.0.1:4173/ node scripts/visual-check-home-h25-color-lab.mjs
```

The isolated H2.5 workflow also executes this on the PR. Result images and
`h25-evidence.json` are uploaded separately under `home-h25-color-lab`
rather than silently mixed with the existing Material H2.0 screenshots.
The script fails closed when the requested WebGL/fallback mode or selected
instant does not initialize, when a CSS override is missing, when one of the
untouched temporal/Solar/Selected colors changes, when Classification's
computed Zodiac categorical fill changes, or when the screenshot itself
still contains the fixture's red NOT READY marker.

Each PNG records its Chromium **outer** dimensions. Mobile cases use an
actual 320/390 CSS px iframe inside a >=600px wrapper; for native review,
look at the **leftmost nativeCropWidth** pixels at original scale, not at
a scaled down whole wrapper. 1440 and 2047 captures are direct-width frames.
Separate DOM-only probes establish semantic/mode state, while a red
screenshot-process marker prevents incorrectly treating a premature
screenshot as valid. A repeated A0 1440/SVG capture detects nondeterminism.
Do not derive material pixel ROI geometry from a separate DOM process.

## Human visual rejection criteria

First inspect A0 vs A1 and A0 vs A2 independently, then A3. At 390 and 1440
ask: does the resting Zodiac become identifiable *without* a glowing blue
stripe; does the backdrop separate rings without becoming blue fog; is the
ivory selected line still the primary datum; do Solar and Year remain
subordinate to that datum; are active Zodiac labels and the existing 12px
mobile rail still legible? Compare native RGB, grayscale and measured lightness
using **screenshot pixels**, never raw CSS color values. Read labels at
original size; an enlarged crop is not acceptance evidence.

The second instant must preserve hierarchy at a genuinely different ring
pose. Check 320/2047 baselines rather than assuming 390/1440 generalize.
Examine roughness vs SVG vs forced-fallback discrepancies: the expected
old-GLSL discrepancy is a *task for the next stage*, not permission to make
the global Zodiac stripe brighter. Classification is categorically separate.

## Explicit next gates

1. Inspect actual A0–A3 images and classify outcomes as **kept / rejected /
   inconclusive** for the two independent factors. No aesthetic winner or
   production claim follows from green CI or nonzero PNG differences alone.
2. Only if Zodiac color helps, implement a narrowly scoped **independent
   GLSL-reflection parity trial** at one chosen reference color, keeping
   microtexture frequency and light direction fixed.
3. Only if field change helps, update the existing reference-field CSS
   authority and its H0 assertions in one production PR. Do not add a second
   set of competing `--field` definitions.
4. Solar `#AF9676` and active Zodiac 14% / 16% are *separate, later* tests.
   Do not combine them into this PR or interpret background changes as a
   reason to brighten Solar.
5. Exact-head Quality, Visual and full native screenshots across
   320/390/1440/2047, multiple selected instants, normal/Classification/
   Analysis and SVG/WebGL/fallback precede any production integration.

## H2.5-B — reducing the field before any production color decision

The first native A0–A3 matrix succeeded on [run 36338388498](https://github.com/Mochi96336/bazi-time-atlas/actions/runs/36338388498). It confirmed A1's cooler environment affects almost the entire composition; A2 Zodiac is subtle at native size, and the hard-coded WebGL reflection tint remains independent. These are descriptive observations, not approval of A3.

Keep the ORIGINAL A0–A3 captures fully reproducible. Add three narrower *diagnostic* conditions; no production CSS or shader is changed:

| Case | CSS reference field | Raised field | Environmental lighting | Zodiac |
| --- | --- | --- | --- | --- |
| A0 baseline | `#090b0f` | `#0e1116` | Original gray | `#424b59` |
| A1 prior comparison | `#0b1019` | `#101824` | Original A1 broad blue | `#424b59` |
| B1 ambient only | `#090b0f` | `#0e1116` | Narrower, weaker cool ambient; subtle gradient | `#424b59` |
| B2 restrained field | `#0a0d13` | `#0e121a` | Narrower, weaker cool ambient | `#424b59` |
| B3 restrained + Zodiac | `#0a0d13` | `#0e121a` | Same as B2 | `#47556c` |

Interpret B1 against A0 and B2 against both A0/A1 **before** inspecting B3; otherwise a cool Zodiac may be credited for a background-only change. B1 deliberately keeps the underlying black authority unchanged. None of B1/B2/B3 may modify ring color, shader tint, camera, cursor, active fill, semantic state or layout.

The A/B capture workflow uses real 390px and 1440px SVG, WebGL, forced fallback, plus A0 and B2 320/2047 extremes and a second selected instant for A0/A3/B2/B3 at 390px. Compare at actual physical pixel dimensions. A0 repeated raster screenshots had a small nonzero difference in the first run, so tiny per-channel differences must be considered against A0 replay noise. Treat a green CI as an evidence-generation result, NOT final visual sign-off.

**Decision gate:** Reject B1/B2 if their cool cast occupies too much negative space, if readable graphite and warmer Solar relationships deteriorate, or if the change is imperceptible at original scale. If one restrained field option helps, pursue a separate production CSS authority update with H0 test changes. The B-series still keeps the original Zodiac shader unchanged; color parity belongs to a separate isolated shader trial, never inferred from this matrix. Leave #486 in Draft until native visual review.
