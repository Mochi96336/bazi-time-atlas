# 4K whole-window blackout: phase 2 isolation

Observation (reported on native 4K): **all six material modes** from phase 1 show flashing, and the background itself goes entirely black. This evidence makes procedural WebGL roughness, shader-only aliasing, `preserveDrawingBuffer`, or one material configuration an insufficient explanation. Do not ship an indiscriminate shader simplification.

## Why phase 1 did not isolate the remaining fault

Even `?material=svg` still runs the same JavaScript wheel engine, dynamic SVG rotation and multiple SVG/CSS filters; the page uses large viewport-sized graphics surfaces. Phase 1 varied material but **did not** remove the wheel, SVG filter cost, JS playback or browser compositor. Full-page black can also be a browser GPU-process, Windows desktop compositor, display-driver or refresh-rate handoff symptom. The exact root cause is not yet established.

## Native-device browser test (before changing the website)

1. On the same 4K monitor, run Chrome `chrome://settings/system`, switch **Use graphics acceleration when available** off and **Relaunch**, then retry 4K site motion. Do not change material at the same time. Revert after the test if acceleration is needed.
2. If the problem is gone, investigate Chrome's graphics path; collect `chrome://gpu` **while graphics acceleration is enabled again** and record driver information. As a separate reversible test, compare a supported alternate Chrome ANGLE backend or a different browser. No registry or driver cleanup is justified by the site experiment alone.
3. If it still happens, determine whether *only the webpage background*, the *entire Chrome window including browser tabs*, or *the physical display including other windows* blacks out. These are very different display paths. For monitor-wide blackouts, test cable, refresh/VRR and OS display path rather than continuing to tweak webpage materials.
4. Keep display resolution, OS scaling, browser version, and animation path fixed during each A/B. Save an external phone video if screen recording or screenshots fail to capture a compositor blackout.

## Site / browser compositing isolation

A second **standalone** diagnostic fixture `scripts/fixtures/full-page-blackout-4k.html` adds seven mutually exclusive modes. It is a separate page, not an intrusive modification to production drawing or CSS:

| Mode | What remains |
|---|---|
| 1. blank | Pure 4K static CSS background. No actual app JavaScript, SVG, WebGL or motion. |
| 2. css | Minimal moving CSS-only shape on the same background; no actual app, SVG or WebGL. |
| 3. static-svg | The actual app with its original SVG/fixed material fallback and **no playback**. |
| 4. live-svg | Same full app, pure SVG and normal playback. |
| 5. no-filter | Same full app and playback, with CSS filter, backdrop filter and box shadow removed **inside the fixture iframe only**. |
| 6. no-wheel | Same full app and playback computation, but no SVG/Canvas wheel drawn. Other DOM updates still occur. |
| 7. webgl | Normal fully rendered app with actual WebGL, to reconfirm phase 1. |

The overlay is deliberately **outside the iframe**: note whether the diagnostic panel stays visible when the page goes black. The browser tabs / other windows are outside the HTML app entirely; their state needs human observation.

Frame data measure only `requestAnimationFrame` spacing, **not actual black frames**. Each run records screen CSS pixels and actual DPR, 150 frame timings, and the observer's distinct full-page/whole-display classification. Copy the result for modes 1, 2, 4, 5 and 6 first; repeat any mode that changes the symptom.

## Interpretation

- Blank or minimal CSS-only blacking out: app wheel semantics and SVG are excluded for that mode. Prioritize browser/GPU/driver/compositor/display troubleshooting.
- Blank clean, CSS motion blacks out: even lightweight CSS animation triggers the browser/display path without the app.
- Both minimal modes clean, live SVG black, no-filter clean: investigate heavy SVG/CSS filter interaction, but independently repeat to confirm before deleting visual effects.
- Live SVG black, no-wheel clean: SVG rasterization or SVG + compositor interaction is implicated, still not proof of any particular CSS filter.
- Live SVG and no-wheel both black: page-wide animation/DOM work or browser compositor can fail independent of the wheel; profile JS main-thread and page layout.
- Static SVG blacks without playback: active wheel motion and dynamic ring-render scheduling are *not* necessary for the symptom.
- Chrome with hardware acceleration disabled is clean: a strong diagnostic clue for Chrome's accelerated rendering path; does **not** prove faulty hardware or a specific driver.
- Physical display also blanks outside the browser: inspect driver resets, refresh/VRR, cable, display mode and Windows logs. A CSS hotfix cannot directly repair that mechanism.

Do not change default prod visuals or browser advice based on one unrecorded run. If a site-specific fix is supported, implement separately and validate native 3840×2160 motion; existing 2047px CI screenshots alone are insufficient.
