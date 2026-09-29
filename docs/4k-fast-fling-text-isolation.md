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

## Updated native findings, 2026-09-30

User reproduced substantial improvement when disabling **all SVG text**, but hiding only **B fixed labels** or **C active readheads** individually still yielded severe flashing. Hiding motion traces in addition to all text made almost no further difference. Disabling all SVG filters, transitions and animation while **retaining all text** (**F**) improved flashing substantially. Disabling filters after already hiding text gave a small additional improvement, but those cumulative tests do not isolate the independent filter contribution.

**Correction to the initial text hypothesis:** text removal reduces pressure, but these tests do not establish individual text groups as the root cause. An expensive SVG transition, filter, or interaction between their raster invalidation and text density is more consistent with the F result. Do not replace all text with canvas/sprites or strip the typography.

### Phase-4 targeted F breakdown (same standalone fixture)

- **H filter-only**: keeps all text, sectors and transitions; disables only SVG `filter`.
- **I transition-only**: keeps all text and filters; disables only SVG `transition`.
- **J animation-only**: keeps all text and the other two; disables only SVG `animation`.
- **K filter-transition**: tests whether disabling both is necessary, without disabling animations.
- **L motion-scoped-effects**: applies the equivalent F reduction only while the actual SVG drag controller exposes `data-active-ring` or `data-coasting-ring`. Tests whether a future resting-visual-preserving mitigation is plausible; avoid promising equivalent performance because toggling large style subtrees itself can invalidate paint.

First reproduce A (unchanged baseline) and F on the same 4K display; then test H and I, with K only if needed. Compare the *same hard mouse fling on the same ring*. Fixture logs actual CSS `filter`/`transition`/`animation` of key rendered nodes after each 10-second run, along with pointer/inertia and rAF observations. It cannot detect compositor-black frames automatically.

### Evidence required before a functional PR

If I is clean, prioritize removing rapid `fill`/`opacity` transitions from specific `.cycle-sector` and scale-related SVG nodes only during motion; do not remove CSS animation indiscriminately. If H is clean, narrow the scope to rotating major tick drop shadows, static guide shadows and cursor shadow/hover brightness separately. If H and I are only partly effective but K approximates F, consider a bounded motion-only combination. Confirm that resting glyphs, material reflections and active boundaries remain visually equivalent and that 4K hard flings—not just CI screenshots—stop blacking out.

## Interpretation / proof gates

- A flashes, B consistently clean: fixed glyph rasterization is implicated.
- A flashes, C consistently clean: animated active readheads and their individual transform/text updates are implicated.
- A flashes, D clean, B/C each still flash: combined glyph rendering budget / display list is implicated.
- A flashes, E clean: motion arc repaint/raster is implicated, not automatically glyph rendering.
- A flashes, F clean: SVG filter or transition GPU raster path is implicated; isolate filters vs transitions *before* shipping visual changes.
- A–F all flash, G flashes or not: investigate full-width layer size, SVG root compositing and Chrome rendering path rather than declaring a font defect.
- If the right-side diagnostic panel *also* goes black, the browser compositing root may be larger than the iframe. If browser tabs go black, it is outside the site’s presentation layer.

Only after native A/B evidence should a *separate* fix adjust label rendering, motion arcs or layer invalidation. Preserve semantic labels and production visual hierarchy; never hide all text in production merely because a diagnostic mode avoids the bug. Include targeted gesture/inertia regression tests and native-4K manual recheck. Existing static PNG CI cannot certify GPU blackout repair.
