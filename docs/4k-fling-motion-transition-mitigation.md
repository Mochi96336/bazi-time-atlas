# 4K fast-fling SVG transition mitigation

## Evidence (native Windows Chrome, 2026-09-30)

- 4K half-width Chrome did not black out; maximized Chrome could black only website content (browser tabs remained visible). Graphics acceleration disabled made the wheel too slow for a valid comparison.
- Smooth autoplay and its 150-frame fixture did not reproduce the failure, but **strong manual fling** did, including pure-SVG mode.
- Disabling fixed or dynamic SVG glyphs independently (B/C) did little. Removing *all* SVG text reduced blackouts; removing motion arcs on top of that made almost no extra difference. This does not prove fonts cause the blackout.
- Keeping all glyphs and disabling SVG effects (F) helped greatly. Isolating effects established **transition off (I)** was noticeably more effective than filter off (H).
- A manual equivalent of the **motion-only M guard** (transitions off during actual SVG drag and coasting only) was reported effective on the native device. **Effective does not establish zero blackouts**; the final live default must be retested.

## Implemented mitigation

Production now defaults to the broad motion-only M guard, which is limited to `#kinetic-wheel` while the existing drag controller sets `data-active-ring` or `data-coasting-ring`. It disables only CSS `transition`, not SVG glyphs, CSS filters, material rendering, or CSS animations. Resting styles and smooth autoplay remain unchanged.

- Default: `/` or `/?material=roughness` (normal production defaults).
- Force the native-tested broad guard: `/?motionTransitionAudit=all`.
- Alternate narrower diagnostic, **not yet natively established**: `/?motionTransitionAudit=surfaces`.
- Immediate rollback without a new deploy: `/?motionTransitionAudit=off`. Use this to compare normal 4K flicker and isolate a regression.

This rollback is explicitly URL-scoped; it does not touch browser or Windows settings. It remains valid for any material mode.

## Validation and known limits

The standalone `scripts/fixtures/4k-fling-text-isolation.html` now explicitly sets `motionTransitionAudit=off` on existing A/B/C/D/E/F/G/H/I/J/K/L controls, preserving historical unmitigated comparison. M/N are the only fixture modes that enable the guard. This avoids making A silently inherit the new production fix.

Quality, syntax and existing visual CI are necessary but **cannot reproduce Windows native 4K GPU compositor blackout**. On final deployed `main`, manually test 4K maximized Chrome, graphics acceleration enabled, **same ring and comparable hard flings** with default URL then `?motionTransitionAudit=off`; verify that default is substantially better and report whether any flashes remain. Also check that active boundary/read-head semantics, pointer capture, free/linked drag, inertia and the stationary visual appearance are unchanged. Investigate a tighter selector only after native comparative evidence; do not permanently strip typography or shadows based on these tests.
