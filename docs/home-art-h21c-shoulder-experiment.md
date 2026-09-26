# Home Art H2.1C — directional Solar shoulder, diagnostic-only

Reference: production H2.0 baseline. The H2.1B groove-normal experiment was closed **without merge** after the endpoint taper nearly removed its useful visual contribution at native mobile width, while untapered scratches made a regular right-side comb pattern. Its same-shader on/off benchmark did not account for the expensive scratch-normal generation, so no performance claim was made.

This candidate changes the **material-depth cue**, rather than amplifying or adding procedural scratches. The unchanged production default is H2.0. An explicitly requested URL `?material=roughness&materialProbe=solar-shoulder-preview` creates a bounded directional shoulder response for visual A/B review only; no new layout, ring geometry, time semantics, cursor glow, color tokens, grain, oxidation or scratch sampling. The existing SVG and forced-SVG fallback remain untouched.

## Prototype

Within the existing Solar radius, use only shallow, broad shoulders a few SVG units inward from the inner/outer boundaries. Gate the response with the *fixed-world* oblique light vector, so it appears mainly on the appropriately oriented arc rather than as a uniform white concentric ring. Use restrained warm brass response at the existing base color. Smoothstep widths include pixel footprint to avoid thin mobile speckles. There is **no increase** to Solar global brightness or new noise field.

## Exact-head evidence and reject conditions

The existing fixed-time material visual job now captures H2.0 default roughness, SVG and forced fallback plus explicit shoulder preview at **1440x900, 2047x1038 and true 390x844**. Its geometry-calibrated ablation report also compares the preview only within Solar and asserts no off-target material changes. Compare current exact-head PNG against archived H2.0 main PNG at the same fixed instant; default baseline should be identical in the masked regions. No fabricated perceptual scores.

Review all full-native previews (not just magnified crop): if the new response looks like two decorative stripes, white ring, bevel cartoon, new illumination hierarchy, a brighter Solar slab or no visible difference on normal mobile zoom, **reject the experiment rather than raising its amplitude by default**. Also inspect mobile labels and the Selected Instant guide.

If optical review passes, a separate implementation stage may reconcile the SVG fallback with the same low-contrast structural material family. The diagnostic-only PR must stay Draft until this decision. Browser CI can check screenshots and shader activation, but only actual native-image review establishes visual usefulness.


## Native-width independent audit — shoulder trial rejected

Exact-head Quality and Visual succeeded on initial shoulder probe at `1664c2e3` ([Visual run 36256149505](https://github.com/Mochi96336/bazi-time-atlas/actions/runs/36256149505)). The geometry-masked Solar ROI (133,302 pixels at 1440) showed `0.37822` mean absolute 8-bit RGB/channel delta, 7.5153% of Solar pixels crossing a three-channel-level threshold, and maximum channel delta just **4**. Baseline vs explicit `none` and independent baseline replay are exactly equal inside all material masks; other material regions show zero probe-caused drift. Mean Solar encoded display luma changed only from 60.364 to 60.488.

At actual 1440 and 390 widths the proposed shoulders look effectively identical to H2.0 and do **not** establish a perceptible metal-depth improvement. The mobile preview includes the *diagnostic-only* 96×4 CTM stamp at the top edge; it is not part of the normal product or a visual improvement. Do not mistake that debug stamp for material drift. Keep the shoulder as an isolated diagnostic reference, **not a production proposal**.

## Second alternative: concentrated radial satin catch (probe 8)

The independent A/B now includes `?material=roughness&materialProbe=solar-satin-preview` (probe 8). Instead of adding more sharp rim lines or scratch noise, this trial **replaces** the existing broad, world-fixed brass catch *only in the preview* with a narrower angular lobe and a smooth across-band response. The target response is restrained champagne brass, not a white highlight; its broad background contribution is reduced rather than piled on top of the old catch. No extra noise sampling, texture frequency, scratch variation, SVG change or global palette adjustment. The default H2.0 remains untouched.

The fixed-time Visual artifact must now contain both candidate previews at 1440/2047/true 390, alongside default, native SVG and forced fallback. Review `material-probe-evidence.json` for the **Solar-only** inside effect, unchanged non-target ROI and zero capture noise. Critically inspect actual 390 and 1440 images for a bright focal wedge, paint-like patch, overly theatrical spotlight, washed-out brass, disappearing Selected Instant or unconvincing flatness. **Neither numeric pixel difference nor a passing CI qualifies this for adoption**. If it is still not aesthetically useful, reject both H2.1C options and change the material approach rather than automatically increasing contrast.
