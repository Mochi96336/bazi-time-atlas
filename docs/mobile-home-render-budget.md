# Mobile homepage render workload

The production material previously rendered at up to DPR 2 on every changed
pose, including the procedural Solar brass shader. Every draw also read the
canvas bounds and SVG screen CTM after the renderer had written ring transforms.
Decorative orbital motion independently updated on every animation frame.

The mobile/coarse-pointer budget now caps **only the material bitmap** at one
pixel per CSS pixel and coalesces material submissions to about 30 Hz. SVG
labels, hit targets, linked-time calculations, ring transforms and inertia keep
their existing cadence. Fine-pointer desktop retains its DPR 2 ceiling and
unthrottled material submission. Landscape touch devices retain the mobile
budget even when they exceed the 480px layout breakpoint.

Projection is cached until the camera, viewport or canvas size changes. Identical
poses do not redraw. A trailing submission draws the latest pose after input
stops; the initial pose is retained before deferred shader activation too.
Material and orbital scheduling stop while the document is hidden. Orbital
presentation is also bounded to about 30 Hz on mobile, preserving year coupling,
occlusion, velocity response and reduced-motion handling.

At DPR >= 2, the bitmap has one quarter of the previous pixels per submission.
This is a workload reduction, **not a measured fourfold FPS improvement**.
`scripts/check-mobile-material-budget.mjs` exercises the actual homepage with
Chromium/WebGL at DPR 3, verifies the pixel ratio, stable-camera cache and final
rendered pose, and writes its report to the visual CI artifact. Unit tests also
cover 120 Hz input, trailing draws, visibility and resize/camera invalidation.

For same-device material comparison, `?renderAudit=1&materialBudget=full` restores
the former pixel/cadence budget for the diagnostic session. It does not undo the
camera cache or orbital changes. Without `renderAudit=1`, `materialBudget` is
inert. Real iPhone/Safari FPS and touch latency remain device verification work;
virtual-time CI is not a device-performance benchmark.

## Follow-up: SVG motion cost

The lower material budget alone did not resolve the user's low mobile frame
rate. The follow-up removes more work from the actual gesture/render path:

- A gesture retains its screen-to-world inverse across pointer samples. SVG
  camera attributes, ancestor layout attributes, resize, scroll and the visual
  viewport invalidate it. Reprojecting the last screen sample after invalidation
  prevents a stationary finger from changing time as the camera moves.
- The orbital aperture uses one even-odd geometric clipping path instead of a
  luminance mask. The canonical center, radius and original outer rectangle are
  unchanged, and the clip stays outside the rotating field. A single path also
  avoids multi-child SVG clipping that can fall back to mask compositing.
- Mobile/coarse-pointer drag and inertia temporarily omit the tiny major-tick
  bevel filters and cursor glow. The resting finish returns when motion ends;
  the desktop presentation is unchanged.
- Unchanged ring transforms, pose/context diagnostics and readout strings do
  not write back to the DOM. Closed ten-god/classification panels do not repaint
  their hidden text. The closed instant editor does not rewrite its interaction
  attributes for every selected-time change.

The actual-homepage DPR 3 CI fixture now also checks a 32-sample pointer gesture,
bounded projection reads, zero repeated ring-transform writes for identical
commands, no hidden ten-god text writes, and restoration of the resting filters.
These are rendering-work contracts, not a physical-phone FPS measurement. The
calendar model, drag/inertia integration, precision and label density remain
unchanged. The phone model/browser was not available during this follow-up.
