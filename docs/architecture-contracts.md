# BaZi Time Atlas — normative architecture contracts

Status: **Accepted**

This document records cross-cutting contracts that are already enforced by the current implementation and regression suite. It is not a future-design wishlist. A change that intentionally alters one of these contracts must update the relevant model/tests and this document in the same review boundary.

`docs/current-status.md` describes the current product checkpoint. `docs/kinetic-atlas-plan.md` is historical rationale. When historical prose conflicts with current tests or the contracts below, the current tests and this document win.

## 1. Selected Instant is the canonical time authority

The main instrument has one canonical **Selected Instant**. Hour, Day, Solar, Month and Year resolve from that instant according to their own laws; they are not independent clocks that merely happen to be drawn concentrically.

Actions in linked-time mode may change the Selected Instant: explicit datetime input, Now, the time slider, playback and linked ring scrubbing. When such an action changes the instant, dependent display state is recomputed from the canonical instant rather than inferred from visual rotation.

**Free Compare does not own time.** It may add independent manual ring offsets for visual comparison, but those offsets must not mutate the Selected Instant or become calendar/astronomy evidence. Returning from Free Compare resets those manual offsets and restores the linked-time view.

A legacy annual longitude projection is also not a second physical instant. When only a projected annual state is known, Month progress/boundary precision must remain suppressed wherever a complete physical instant is required.

## 2. The atlas civil reference is explicitly UTC+08:00

The practical atlas uses its pinned UTC+08:00 reference clock for civil-field interpretation. This is a product/calendar convention, not browser geolocation and not an inference from the viewer's machine timezone.

Current discrete boundary contracts are:

- Year identity changes at the exact **Li Chun** boundary.
- Month identity changes at exact **jie** boundaries.
- Day identity uses the atlas's current **Zi-initial 23:00 next-day** convention.
- Hour identity uses double-hours beginning at odd local clock hours.

Continuous progress through a discrete state does not interpolate or rename the discrete Ganzhi identity. Boundary gates change only when the corresponding exact boundary is crossed.

## 3. Solar longitude is continuous; Zodiac is derived classification

The Solar annual band owns the continuous apparent-solar-longitude coordinate. The 24-term structure is resolved on that coordinate.

Tropical Zodiac is derived from the same solar-longitude phase. It is **not** a sixth independent time ring and must not acquire an independent primary time law, primary radial hit target, visibility authority or reference frame.

Visual alignment is not temporal concurrence. A shared-boundary indicator may claim concurrence only when the resolved boundary timestamps are equal under the current model; collinear drawing alone is insufficient.

## 4. Interaction ownership is separated from domain truth

The browser bootstrap coordinates components but should not re-absorb their laws.

Current ownership is:

- `src/kinetic-atlas.js` — page/root orchestration, canonical page state, renderer coordination, readout mutation and component wiring.
- `src/wheel/atlas-display-model.js` — pure Selected Instant / legacy projection to domain/display state.
- `src/wheel/ring-drag-controller.js` — pointer capture, drag activation threshold, free-vs-linked pointer lifecycle and ring-pose drag dispatch.
- `src/interaction/linked-ring-scrub.js` — conversion from linked ring angular deltas to canonical Selected Instant changes using the ring's real temporal semantics.
- `src/interaction/free-compare-controller.js` — Free Compare mode/UI and manual-offset reset/view-state ownership.
- `src/interaction/kinetic-playback.js` — pure scale, slider and playback time-advance mathematics.
- `src/interaction/kinetic-playback-controller.js` — RAF scheduling plus playback start/stop/toggle and play-button lifecycle.
- `src/wheel/kinetic-renderer.js` and related wheel geometry modules — rendering/geometry; they do not become calendar or source-provenance authorities.

A sub-threshold pointer press may expose press/grab feedback, but it must not create a drag lifecycle or mutate time/offset state until the drag activation contract is satisfied.

## 5. Geometry, camera and CSS have different authority

World geometry, responsive camera framing and CSS layout remain separate responsibilities. The detailed camera contract lives in `docs/camera-ownership.md`.

In particular, responsive CSS must not redefine ring pivots or simulate wheel zoom with transforms. Pointer coordinates must continue to invert through the SVG camera into the canonical world geometry so interaction semantics do not fork by viewport.

The primary radial hierarchy remains faster/smaller inside to slower/larger outside:

`Hour → Day → Solar annual band → Month → Year`

## 6. Seasonal source role is provenance, not a UI label

Seasonal-epoch providers are classified by capability:

- **shape-parameters** — relative/long-term orbital or insolation shape; no absolute seasonal event epoch authority.
- **absolute-state-basis** — continuous Earth/Sun state basis such as DE441; the app must still perform the declared time/frame/apparent-direction transformation and crossing solve.
- **direct-seasonal-event** — directly supplies target longitude-crossing epochs on a declared time basis and coverage range.

These roles are not interchangeable. A direct-event provider must not be described as DE441 merely because DE441/Horizons evidence was used to validate it. Conversely, possession of DE441 state vectors does not by itself mean the app has a direct solar-term event provider.

Coverage is fail-closed. Modern agreement or a useful distant-era comparison does not authorize widening a provider's production range without independent target-era evidence meeting the declared promotion budget.

## 7. Absolute-state seasonal solving has an explicit transformation chain

The app-owned absolute-state solver core must keep the following layers visible in provenance/tests rather than collapsing them into an unnamed "astronomy" conversion:

1. source Earth/Sun states and their origin/frame/time basis;
2. TT to ephemeris-time conversion as required by the source;
3. light-time handling;
4. declared apparent-direction corrections;
5. transformation to the required ecliptic-of-date frame;
6. bracketed/wrapped root solve for the requested solar-longitude crossing.

If the implementation has not demonstrated all corrections required for a claimed target observable, it must fail closed rather than relabel a partial model as Horizons-equivalent truth.

## 8. A seasonal epoch does not resolve all four pillars

Even a trustworthy absolute solar-term epoch does not automatically authorize arbitrary-millennia Day/Hour reconstruction.

Day/Hour proof requires a separate chain covering at least TT↔UT / ΔT and Earth rotation, civil-zone policy, day-boundary convention, selected civil/mean-solar/apparent-solar clock basis and downstream pillar reconstruction.

Therefore an astronomical event timestamp must never be promoted directly into "all four pillars resolved" without that independent proof chain.

## 9. Recurrence claims stay typed

The Research surface distinguishes:

1. exact discrete recurrence;
2. approximate astronomical similarity;
3. resolved or unresolved absolute epoch reconstruction.

A Gregorian/Ganzhi discrete closure is not an astronomical repeat. Similar orbital shape is not an exact civil timestamp. Near-recurrence ranking must not be presented as an exact period.

## 10. Release evidence is exact-revision evidence

The repository uses the lockfile plus `npm ci`, the Quality Gate and the full Visual PNG self-check as source-controlled verification boundaries.

GitHub Pages is eligible only after a successful `Visual PNG self-check` caused by a push to `main`, and deployment checks out that upstream workflow's exact `head_sha`. Pages deployment concurrency belongs to the eligible `deploy` job so skipped PR-triggered `workflow_run` shells cannot cancel a legitimate production deploy; successive eligible main deploys retain latest-wins behavior.

The remaining repository-setting gap is external to source control: `main` is not yet protected by a GitHub branch/ruleset. The intended repository setting is PR-only main changes with required Quality/Visual checks and force-push/delete blocked, without inventing a multi-reviewer requirement for a solo repository.

## Change rule

When a PR deliberately changes one of these contracts, it must do all of the following in the same review boundary:

- state which contract is changing and why;
- update the responsible model/controller rather than patching presentation around it;
- add or update the narrowest relevant unit/browser proof;
- preserve fail-closed behavior where evidence is incomplete;
- update this document and `docs/current-status.md` if the product checkpoint changed.
