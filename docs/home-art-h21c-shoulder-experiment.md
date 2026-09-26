# Home Art H2.1C — directional Solar shoulder, diagnostic-only

Reference: production H2.0 baseline. The H2.1B groove-normal experiment was closed **without merge** after the endpoint taper nearly removed its useful visual contribution at native mobile width, while untapered scratches made a regular right-side comb pattern. Its same-shader on/off benchmark did not account for the expensive scratch-normal generation, so no performance claim was made.

This candidate changes the **material-depth cue**, rather than amplifying or adding procedural scratches. The unchanged production default is H2.0. An explicitly requested URL `?material=roughness&materialProbe=solar-shoulder-preview` creates a bounded directional shoulder response for visual A/B review only; no new layout, ring geometry, time semantics, cursor glow, color tokens, grain, oxidation or scratch sampling. The existing SVG and forced-SVG fallback remain untouched.

## Prototype

Within the existing Solar radius, use only shallow, broad shoulders a few SVG units inward from the inner/outer boundaries. Gate the response with the *fixed-world* oblique light vector, so it appears mainly on the appropriately oriented arc rather than as a uniform white concentric ring. Use restrained warm brass response at the existing base color. Smoothstep widths include pixel footprint to avoid thin mobile speckles. There is **no increase** to Solar global brightness or new noise field.

## Exact-head evidence and reject conditions

The existing fixed-time material visual job now captures H2.0 default roughness, SVG and forced fallback plus explicit shoulder preview at **1440x900, 2047x1038 and true 390x844**. Its geometry-calibrated ablation report also compares the preview only within Solar and asserts no off-target material changes. Compare current exact-head PNG against archived H2.0 main PNG at the same fixed instant; default baseline should be identical in the masked regions. No fabricated perceptual scores.

Review all full-native previews (not just magnified crop): if the new response looks like two decorative stripes, white ring, bevel cartoon, new illumination hierarchy, a brighter Solar slab or no visible difference on normal mobile zoom, **reject the experiment rather than raising its amplitude by default**. Also inspect mobile labels and the Selected Instant guide.

If optical review passes, a separate implementation stage may reconcile the SVG fallback with the same low-contrast structural material family. The diagnostic-only PR must stay Draft until this decision. Browser CI can check screenshots and shader activation, but only actual native-image review establishes visual usefulness.
