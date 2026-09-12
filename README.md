# BaZi Time Atlas

A data-driven visual atlas for exploring how one solar cycle is partitioned by the 24 solar terms, BaZi month branches, the Five Phases, traditional seasons, and the tropical zodiac.

The project deliberately separates **astronomical/calendar geometry** from later symbolic interpretation. The first milestone is the annual 0°–360° solar-longitude atlas; sexagenary-cycle and birth-chart views come later.

## V0.1 — Annual Atlas

The first view shares one coordinate system:

- solar longitude λ = 0°–360°
- 24 solar terms at 15° intervals
- 12 BaZi month branches bounded by the 12 **jie** terms
- traditional seasons beginning at Li Chun / Li Xia / Li Qiu / Li Dong
- Earthly Branch primary Five-Phase classification
- 12 tropical zodiac signs at 30° intervals
- Western element and modality metadata

The interface intentionally shows geometric overlap without claiming symbolic equivalence. For example, Mao month (345°–15°) overlaps the last 15° of Pisces and first 15° of Aries; it is **not** labelled as equivalent to either sign.

## Principles

- Geometry is generated from data, not manually positioned.
- BaZi month boundaries use the 12 **jie** solar terms.
- Tropical zodiac signs are a separate 30° system and are not modern astronomical constellation boundaries.
- Chinese Five Phases and Western four elements remain distinct systems.
- The 60 Jiazi cycle is **not** represented as 60 slices of the solar year.
- Ambiguous BaZi conventions (day boundary, civil vs solar time) will be explicit when the Birth view is implemented.

## Development

No build step is required.

```bash
python -m http.server 8000
# open http://localhost:8000
```

Run geometry/data invariants with:

```bash
npm test
```

### Visual PNG self-check

The `Visual PNG self-check` workflow opens the real page in headless Chromium and captures both full-page and wheel-focused PNG evidence at three fixed viewports:

- desktop — 1440×1100
- tablet — 834×1112
- iPhone-like mobile — 428×926 at 2× device scale

It also fails on basic rendering regressions such as a missing wheel or horizontal page overflow. Every run uploads a `visual-png-selfcheck` artifact containing six PNGs plus `diagnostics.json` for seven days.

For local capture:

```bash
npm install
npx playwright install chromium
python -m http.server 4173
# in another terminal
npm run visual:capture
```

The current visual check is deliberately evidence-first rather than pixel-diff gating. A stable screenshot baseline can be added after the annual layout settles.

## Roadmap

1. Annual Atlas — current milestone
2. Birth view — year/month/day/hour derivation shown as separate time rules
3. Sexagenary reference — dedicated 60 Jiazi explorer
4. Hidden stems and deeper BaZi structure, only after the time model is stable

## Deployment

`.github/workflows/pages.yml` tests the geometry invariants and deploys the repository root to GitHub Pages on pushes to `main`.
