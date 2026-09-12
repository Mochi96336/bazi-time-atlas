# BaZi Time Atlas

A data-driven visual atlas for understanding BaZi as a set of overlapping time, calendar, and symbolic structures rather than as one opaque fortune-telling table.

The project deliberately separates **astronomical/calendar geometry**, **deterministic structural rules**, and later **interpretation**. Geometry and rule-based relationships are implemented first; subjective layers stay explicit and optional.

## Current views

### Annual Atlas

One shared solar-longitude coordinate system:

- solar longitude λ = 0°–360°
- 24 solar terms at 15° intervals
- 12 BaZi month branches bounded by the 12 **jie** terms
- traditional seasons beginning at Li Chun / Li Xia / Li Qiu / Li Dong
- Earthly Branch primary Five-Phase classification
- 12 tropical zodiac signs at 30° intervals
- Western element and modality metadata kept separate from Chinese Five Phases
- exact Birth projection back onto the annual wheel
- Five Tigers month-stem derivation and collapsible hidden stems

The interface shows geometric overlap without claiming symbolic equivalence. For example, Mao month (345°–15°) overlaps the last 15° of Pisces and first 15° of Aries; it is **not** labelled as equivalent to either sign.

### Birth view

A single birth instant is resolved through four separate rules instead of a fake year→month→day→hour dependency chain:

- year pillar changes at the exact Li Chun instant
- month pillar changes at the exact 12 **jie** boundaries
- day pillar follows the continuous sexagenary day sequence
- hour branch follows the local clock while hour stem derives from the effective day stem
- 23:00 Zi-initial vs 00:00 civil-midnight day boundaries are explicit conventions
- UTC offset locates the real instant; longitude / true-solar-time correction is not yet applied
- visible stems and hidden stems can be classified relative to the Day Master through the Ten Gods
- Ten Gods remain structural labels only: no strength, weighting, auspiciousness, personality, or event prediction
- the four visible pillars are scanned pairwise for Heavenly-Stem Five Combinations and Earthly-Branch Six Harmonies / Six Clashes / Six Harms
- complete visible three-branch sets are scanned separately for 三合 and 三會; two-member "half" patterns are intentionally excluded from V1
- pair relations and complete three-branch relations use different visual grammar so a triad is not misrepresented as three independent pairs
- Birth inputs can be deep-linked with `date=YYYY-MM-DD`, `time=HH:MM`, and `utc=<offset>` for reproducible examples

### Sexagenary reference

The 60 Jiazi are generated from synchronized 10-stem and 12-branch phases. The 60-cycle is its own reference system and is **not** drawn as 60 slices of the solar year.

## Principles

- Geometry is generated from data, not manually positioned.
- BaZi month boundaries use the 12 **jie** solar terms.
- Tropical zodiac signs are a separate 30° system and are not modern astronomical constellation boundaries.
- Chinese Five Phases and Western four elements remain distinct systems.
- Ambiguous conventions are exposed instead of silently chosen.
- Hidden stems are branch internals, not another permanent annual ring.
- Ten Gods are derived from Five-Phase direction + yin-yang parity relative to the Day Master.
- Pairwise stem/branch relations are symmetric registry facts first; transformation and interpretive conditions remain separate.
- 六害 uses the six explicit pairs in 《三命通會》〈論六害〉: 子未、丑午、寅巳、卯辰、申亥、酉戌. The atlas records pair membership only and does not turn the word "害" into a real-world prediction.
- Complete 三合 / 三會 require all three canonical visible branches in V1; no automatic half-combination, transit completion, strength, or transformation inference.
- 六破 is deliberately **not** in the deterministic core yet. The modern common table is widespread, but its adoption and weighting are school-dependent and the classical Zi Ping source boundary is weaker; if added later it must carry an explicit convention/source label.
- Interpretive claims must not be smuggled into deterministic calendar or relationship layers.

## Development

No build step is required.

```bash
python -m http.server 8000
# open http://localhost:8000
```

Run all rule/data invariants with:

```bash
npm test
```

### Lightweight PNG visual self-check

The `Visual PNG self-check` workflow calls the system Chromium/Chrome directly in headless mode, with no Playwright or Puppeteer dependency.

The baseline set covers desktop/mobile first viewports for:

- Annual Atlas
- Annual Atlas with an exact Birth projection
- Birth view
- Sexagenary reference

Extra bounded review frames expose below-fold details such as expanded hidden stems, Ten-God structure, visible-pillar pair relations, reproducible complete 三合 / 三會 examples, and a real-chart 六害 example. Artifacts are written to `tmp/visual-check/` and uploaded as `visual-png-selfcheck` for seven days. This remains a smoke/evidence check rather than a pixel-diff regression gate while layout is still evolving.

Local use:

```bash
python -m http.server 4173
# in another terminal; requires chromium/chrome on PATH
npm run visual:check
```

## Roadmap

1. **Time skeleton — complete:** annual geometry, Birth derivation, 60 Jiazi reference.
2. **Deterministic BaZi structure — active:** Five Tigers, hidden stems, Day Master → Ten Gods, and the visible derivation map from Five-Phase direction + polarity.
3. **Stem / branch interactions — active:** visible-stem 五合; visible-branch 六合 / 六沖 / 六害; complete visible 三合 / 三會. Next, model 刑 separately because it includes directed chains and self-punishment. 六破 remains deferred behind an explicit school/convention boundary instead of being flattened into the core table.
4. **Seasonal support / strength:** only with explicit convention and weighting boundaries; no universal percentage model.
5. **Interpretive layer:** optional, clearly separated from the calculation engine, and labelled by source/tradition rather than presented as objective fact.

## Deployment

`.github/workflows/pages.yml` tests the rule/data invariants and deploys the repository root to GitHub Pages on pushes to `main`.
