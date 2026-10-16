# Visual architecture reset

## Status

This document defines the visual-redesign boundary for the kinetic atlas. It deliberately separates **semantic correctness** from the current **presentation geometry**.

The Research destination applies the same semantic/presentation separation through `docs/research-visual-constitution.md`. That document extends this reset with Research-specific narrative hierarchy, diagram grammar, typography/spacing/color foundations and a prototype-first design-QA workflow.

The existing production screenshots remain useful regression evidence for the state of the product before this reset, but they are **not aesthetic golden masters**. During the reset, a screenshot is allowed to change when the PR explicitly owns the corresponding visual layer and all semantic gates remain green.

## Product goal

The primary view should read first as one coherent radial time instrument:

1. one shared radial origin / concentric mechanism;
2. temporal scale increases from inner to outer layers;
3. one Selected Instant datum crosses every time layer;
4. different layers move at their own temporal rates;
5. analysis controls and classifications remain available without competing with the resting instrument.

The reset is not a redesign of calendar or astronomy semantics. It is a redesign of how already-correct state is composed and rendered.

## Semantic contracts: immutable during the reset

The following are correctness contracts and must remain protected by tests:

- Selected Instant ownership and exact instant propagation;
- pillar identities and their boundary rules;
- continuous temporal phase and wrap continuity;
- solar longitude and solar-term classification;
- zodiac as a derived classification of the shared annual solar coordinate, not an independent clock;
- primary radial order: `hour -> day -> solar -> month -> year`;
- one contiguous primary-ring envelope with no gaps or overlaps;
- radial hit testing maps only to primary time rings;
- drag, snap, linked/detached and Free Compare semantics;
- reference-frame mathematics;
- layer visibility state and recovery;
- exact boundary/read-head alignment at the Selected Instant.

A visual PR must not weaken these contracts in order to make a screenshot pass.

## Presentation contracts: intentionally mutable

The following values are presentation parameters and must not be treated as semantic golden values:

- `WHEEL_CENTER` screen/world placement;
- fan aperture start/end angles;
- exact inner/outer radii;
- ring thicknesses;
- whether ring thickness increases monotonically with temporal scale;
- viewBox x/y/width/height;
- desktop/compact/mobile camera zoom and framing strategy;
- label cadence and label placement;
- minor tick / sector-boundary density;
- resting surface opacity and color;
- legend placement or existence;
- readout/HUD composition;
- mobile crop and viewport composition.

### Important encoding rule

**Radial position encodes temporal scale. Ring thickness does not.**

Thickness is free to represent information capacity and visual balance. In particular, the outer Year ring is not required to be thicker than Month, and Month is not required to be thicker than Solar. This removes the previous redundant encoding that amplified outer-ring visual area simply because the cycle was slower.

### Camera / inner-radius composition invariant

The first camera-only experiment established a useful geometric constraint. Along the Selected-Instant centerline, let:

- `G` be the distance from the viewport bottom to the mathematical wheel origin;
- `B` be the visible empty inner-disk distance from the viewport bottom to the inner ring;
- `Rin` be the wheel's inner radius.

Then, while the inner ring remains above the lower frame:

`G + B = Rin`

With the old `Rin = 686`, moving the origin closer necessarily created almost the same amount of new dead interior. Camera framing alone therefore cannot simultaneously improve radial curvature and eliminate the empty lower field. The reset treats **radial depth and camera framing as one composition layer**: reduce the oversized inner void, balance primary ring thickness, then frame that deeper ring stack. Camera review must monitor both origin proximity and exposed inner blank; minimizing either metric alone is not the goal.

The horizontal camera dimension should follow the actual rendered SVG aspect ratio. Camera code owns radial framing, not page layout.

## Rendering hierarchy