# H2.8 — shared Solar/Zodiac material joint (one alternative to C3)

**Isolated production-style visual experiment. Do not merge without normal-size image review.** Based on research-integrated main `6b7953faa17171778e3bd4af407e6017a3f7e348`. The B2 background is already shipped; no change to its palette or the timing model.

## Why the old artboard is not the reference

The original nested-iframe WebGL artboard [#494](https://github.com/Mochi96336/bazi-time-atlas/pull/494) generated false visual confidence: it initialized its GPU while the child iframe still had its default dimensions, and its post-layout SVG CTM could not fix those already stale GPU pixels. The later corrected #494 Solar-warmth gate caught this. Retire the failed nested WebGL images as production-approval evidence.

Instead compare genuine independently rendered `main` B2 Visual PNGs ([production run](https://github.com/Mochi96336/bazi-time-atlas/actions/runs/36344954544), artifact `10939783954`) with the true directly rendered five-file C3 candidate [#495](https://github.com/Mochi96336/bazi-time-atlas/pull/495), ([exact-head Visual](https://github.com/Mochi96336/bazi-time-atlas/actions/runs/36349373114), artifact `10941757669`), and **this branch's own real page captures**, never a nested material-variant iframe.

The direct full-page C3 captures, at the same genuine 390 and 1440 material modes, do show a modest cold recessed Zodiac strip with unchanged Solar and main datum; but whether even that strip reads as an unnecessary independent belt is still a real design choice, not decided by a test-run success.

## New hypothesis: a physically shared *joint*, not another full-width colored sleeve

This version does **not** reuse C1's six-stop broad blue annulus or C2's metallic satin. It retains the *original* complete Zodiac dark body and adds a very narrow presentation treatment at its physical interfaces to its immediate neighbors:
- Inner boundary at SVG radius **840**: neutral-warm recess fading through a short transition toward the unmodified Zodiac material. This visually connects to the adjacent warm Solar brass instead of separating from it with bright blue.
- The **middle** of the canonical band (radii ~863–887) has **zero overlay opacity**: preserve the existing Zodiac body, texture and color. No uniform alternate colored belt.
- Outer boundary approaching SVG radius **900**: one low-contrast graphite-colored carved lip that dies out at the outermost edge. No white/bright rim or neon stroke.

One fixed-world radial gradient at original `WHEEL_CENTER=(600,1360)`, radius 900, with stops at the normalized radii (840 through 900)/900, is filled through **exactly the same original canonical Zodiac bed path `d`** inside the same existing material base layer; no new annular geometry or independent rotation. Its eight stop opacities top out at .24, and presentation strength is bounded at .82. It adds no texture or WebGL shader work. Solar, graphite, B2 background, Classification categorical pigments, selected ivory cursor, active sectors and mobile readout remain unchanged.

## Acceptance must be a true *native production page* A/B

The ordinary repository full Visual workflow should render this preview directly at 390/1440/2047 in SVG/WebGL/fallback, independently of experimental nested iframes. Compare side by side with **the same native B2 direct captures** and **#495's genuine native C3**. Check 390 original scale first, then 1440 and 2047. A positive result requires that the common Solar/Zodiac annual coordinate reads as a single instrument family with a small visible fabrication joint, without creating a new bluish full-width stripe, star grain, white ring, or confusing separate clock.

Verify the strongest changed pixel bounds stay in the canonical 840–900 Zodiac annulus under shared camera/geometry and that other material areas and classification retain the same appearance. Confidence in the *whole-wheel WebGL* image cannot be inferred from a stale nested artboard or solely from a mask: review the real warm Solar GPU in the full production-style screenshot. A global PNG difference statistic measures change extent, not aesthetic quality.

If the joint is invisible or looks like two decorative stripes, reject it and retain the original/C3 candidate for a documented choice; do not increase opacity and initiate another uncontrolled pass. Both this branch and #495 must stay unmerged while visually evaluated independently.
