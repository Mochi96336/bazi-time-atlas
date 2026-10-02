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
