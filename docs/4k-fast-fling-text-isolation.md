# 4K hard-fling SVG text vs high-speed rendering

## New native Windows evidence (2026-09-30)

On a native 4K monitor with Chrome graphics acceleration enabled, a **half-width Chrome window is clean**, while maximized Chrome can black the **webpage only** (tabs remain visible). Turning off graphics acceleration makes the wheel too slow to yield an interpretable result. All earlier 150-frame *smooth* autoplay tests were clean, yet **physically hard-flinging mode 3 (static pure SVG) reproduces page blackouts**. Therefore neither WebGL material nor smooth playback alone is necessary. The remaining high-risk path is high-speed **manual pointer/coasting → SVG text/raster, animated active labels, dynamic motion traces, CSS filters and large full-viewport GPU compositing**. This evidence cannot independently prove text is the cause.

## Isolated manual tests

The standalone public `scripts/fixtures/4k-fling-text-isolation.html` loads the **same production app**, same fixed date, 4K width, and original pointer handlers. It only injects a single iframe-scoped override per mode, never changes live production CSS. Use the *same ring* and a similar strong mouse fling 3–5 times per mode:

- **A baseline**: pure SVG material, all SVG labels and effects intact.
- **B static-text-off**: only fixed ring/solar-term/zodiac glyphs hidden. Animated active readheads remain visible.
- **C active-text-off**: only dynamic active readheads hidden. Fixed sector labels remain visible.
- **D all-text-off**: all text inside SVG wheel hidden. Non-wheel DOM readouts and app data are unchanged.
- **E motion-off**: only fast-fling motion arc visual is hidden; gesture and motion trace calculations still run.
- **F effects-off**: SVG filters, animations and transitions disabled. Text, geometry and drag remain.
- **G webgl-text-off**: WebGL active but all SVG text hidden; relevant only after baseline pure-SVG comparisons.

Before testing, enable graphics acceleration and maximize Chrome on the **same native 4K desktop**. Confirm baseline A still flashes, otherwise comparisons are inconclusive. The 10-second record button watches real pointerdown/move/up, active gesture, inertia and rAF frame intervals. Smooth playback cannot replace manual hard-flinging. Browser compositor black frames may not be captured by rAF timing; select the visual result. Repeating A after B/C checks for thermal or changing-system conditions.

## Interpretation / proof gates

- A flashes, B consistently clean: fixed glyph rasterization is implicated.
- A flashes, C consistently clean: animated active readheads and their individual transform/text updates are implicated.
- A flashes, D clean, B/C each still flash: combined glyph rendering budget / display list is implicated.
- A flashes, E clean: motion arc repaint/raster is implicated, not automatically glyph rendering.
- A flashes, F clean: SVG filter or transition GPU raster path is implicated; isolate filters vs transitions *before* shipping visual changes.
- A–F all flash, G flashes or not: investigate full-width layer size, SVG root compositing and Chrome rendering path rather than declaring a font defect.
- If the right-side diagnostic panel *also* goes black, the browser compositing root may be larger than the iframe. If browser tabs go black, it is outside the site’s presentation layer.

Only after native A/B evidence should a *separate* fix adjust label rendering, motion arcs or layer invalidation. Preserve semantic labels and production visual hierarchy; never hide all text in production merely because a diagnostic mode avoids the bug. Include targeted gesture/inertia regression tests and native-4K manual recheck. Existing static PNG CI cannot certify GPU blackout repair.
