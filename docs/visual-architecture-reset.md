# Visual architecture reset

## Status

This document defines the visual-redesign boundary for the kinetic atlas. It deliberately separates **semantic correctness** from the current **presentation geometry**.

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

The reset should converge on four mark roles rather than one opacity value for a whole SVG group:

1. **surface** — the resting identity of a ring;
2. **structure** — major divisions and reference geometry;
3. **context** — sparse static labels / minor information;
4. **active** — Selected Instant, active identity, next boundary and interaction feedback.

Scale focus (`48h`, `1y`, `60y`) may reduce surface/structure/context weight, but active Selected-Instant information must retain an explicit readability floor. Group-wide opacity should not be the long-term primary emphasis mechanism.

## Planned implementation order

### A. Reset contract

- remove tests that freeze aesthetic numeric geometry as correctness;
- retain semantic topology, hit testing, phase and alignment gates;
- record the old PNGs as pre-reset evidence rather than immutable visual targets.

### B. Radial composition

Change inner radius, primary ring thickness and camera framing together while keeping the outer envelope, fan aperture and all time semantics fixed. The acceptance question is whether the five layers occupy enough radial depth to read as one concentric mechanism **without** creating a large dead inner-disk field.

### C. Fan aperture

Evaluate the fan angle as the instrument's frame after camera and ring geometry are stable.

### D. Rendering density

Reduce resting minor-sector/tick noise while retaining precise active and interactive detail.

### E. Mark-level emphasis

Replace whole-track fading with role-specific emphasis.

### F. Color grammar

Use color semantically: Ganzhi structure, annual solar coordinate, Selected Instant datum, and optional classification overlays should be distinguishable by role rather than by assigning every ring an unrelated muted hue.

### G. Integrated labels

Move layer identity into the instrument so a detached legend is no longer required to understand radial order.

### H. Selected Instant consolidation

Make the radial datum/read-head the primary current-state reading and remove duplicate state presentations where they no longer add information.

### I. HUD hierarchy

Keep direct time controls primary. Move analysis lenses such as classification/reference/compare into secondary disclosure.

### J. Mobile composition

Use the same semantic/world model but give portrait mobile its own camera/composition contract rather than treating it as desktop plus horizontal crop.

### K. Debt cleanup

Only after the new architecture stabilizes, remove obsolete visual overrides and old assumptions.

## Review protocol

Each visual PR should answer exactly one primary visual question. Review must include deterministic screenshots at minimum for:

- 1440x900 and 390x844;
- `48h`, `1y`, and `60y` focus where the owned layer can affect them;
- a fixed Selected Instant for direct before/after comparison.

Review screenshots against the PR's stated visual question, not against pixel identity with the pre-reset baseline.

Existing semantic/browser/unit gates remain mandatory. A prettier screenshot is never sufficient evidence for a semantic change.

## Success criteria

Without reading explanatory copy, a first-time viewer should be able to infer in this order:

1. this is one concentric/radial time mechanism;
2. larger temporal scales live farther out;
3. one common Selected Instant crosses every layer;
4. the layers move at different rates;
5. deeper classifications and comparison tools are optional analysis lenses.

If controls, legends or explanatory text must be read before the radial mechanism is understood, the reset is not complete.
