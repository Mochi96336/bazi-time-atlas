# BaZi Time Atlas — normative architecture contracts

Status: **Accepted**

This document records cross-cutting contracts that are already enforced by the current implementation and regression suite. It is not a future-design wishlist. A change that intentionally alters one of these contracts must update the relevant model/tests and this document in the same review boundary.

Documentation roles are complementary rather than competing sources of truth: `docs/current-status.md` is the current product/implementation checkpoint; this file is the normative cross-cutting architecture contract; `docs/kinetic-atlas-plan.md` is historical rationale. When prose disagrees with production behavior, the implementation plus its regression evidence must be reconciled with the responsible current document rather than treating an older statement as authority.

## 1. Selected Instant is the canonical time authority

The main instrument has one canonical **Selected Instant**. Hour, Day, Solar, Month and Year resolve from that instant according to their own laws; they are not independent clocks that merely happen to be drawn concentrically.

Actions in linked-time mode may change the Selected Instant: explicit datetime input, Now, the time slider, playback and linked ring scrubbing. When such an action changes the instant, dependent display state is recomputed from the canonical instant rather than inferred from visual rotation.

**Free Compare does not own time.** It may add independent manual ring offsets for visual comparison, but those offsets must not mutate the Selected Instant or become calendar/astronomy evidence. Returning from Free Compare resets those manual offsets and restores the linked-time view.

A legacy annual longitude projection is also not a second physical instant. When only a projected annual state is known, Month progress/boundary precision must remain suppressed wherever a complete physical instant is required.

## 2. Atlas temporal context is explicit and shareable

The practical Atlas has one typed temporal context containing a fixed UTC offset and a canonical day-boundary convention. The production default remains **UTC+08:00 + Zi-initial 23:00 next-day**, but that default is not an immutable civil authority: explicit supported temporal-context changes reinterpret the same physical Selected Instant and persist canonically in the Atlas URL.

The fixed offset is a product/calendar convention. It is not browser geolocation, not an inference from the viewer's machine timezone, and not geographic longitude. In particular, a UTC offset must never be multiplied by 15° and silently promoted into longitude for solar-time analysis.

Current discrete boundary contracts are:

- Year identity changes at the exact **Li Chun** boundary.
- Month identity changes at exact **jie** boundaries.
- Day identity uses the selected canonical day-boundary convention: `zi-initial-next-day` or `civil-midnight`.
- Hour identity uses double-hours beginning at odd local clock hours under the selected fixed-offset civil context.

Changing temporal context does not silently move `selectedMs`; it re-resolves calendar/display state at the same physical instant. Malformed explicit context fails closed to the complete production default rather than applying a partial custom state.

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

Gesture ownership is interruption-safe. External Selected Instant or temporal-context authority, playback takeover, Free Compare reset/mode changes, document hiding, controller teardown, pointer-capture loss/failure and hiding the actively owned ring must not leave a stale drag or inertial owner able to mutate time or manual offsets after ownership has ended.

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

These roles are not interchangeable. A direct-event provider must not be described as a general DE441 state adapter merely because DE441/Horizons evidence was used to validate it. Conversely, possession of DE441 state vectors does not by itself mean the app has a direct solar-term event provider.

Coverage is fail-closed. Modern agreement or a useful distant-era comparison does not authorize widening a provider's production range without independent target-era evidence meeting the declared promotion budget.

## 7. Absolute-state proof and production seasonal-event authority stay distinct

The app-owned absolute-state solver core keeps the following layers visible in provenance/tests rather than collapsing them into an unnamed "astronomy" conversion:

1. source Earth/Sun states and their origin/frame/time basis;
2. TT to ephemeris-time conversion as required by the source;
3. light-time handling;
4. declared apparent-direction corrections;
5. transformation to the required ecliptic-of-date frame;
6. bracketed/wrapped root solve for the requested solar-longitude crossing.

If the implementation has not demonstrated all corrections required for a claimed target observable, it must fail closed rather than relabel a partial model as Horizons-equivalent truth.

For catalogue year **4006**, the complete DE441/Horizons-backed proof chain has been composed and independently validated for all 24 canonical 15° crossings. The recorded maximum epoch error is **0.161 s**, inside the declared **2 s** promotion budget. That evidence proves the bounded target-year result; it does not grant general production authority across the full theoretical DE441 ephemeris range.

Production deliberately does **not** expose the proof-only DE441 state windows as a general absolute-state runtime adapter. Instead, the validated year-4006 result is published through the bounded direct-seasonal-event provider `jpl-de441-seasonal-events-v1`, on TT, with exactly 24 canonical crossings and catalogue-year coverage **4006 only**. Runtime registration re-assesses the pinned product/evidence and fails closed if provenance, payload identity, coverage or parity checks fail.

Therefore these statements are simultaneously required:

- a year-4006 seasonal event may resolve through the reviewed direct-event runtime provider;
- generic absolute-state adapter flags may remain false;
- proof-only state windows must not be relabelled as general runtime coverage;
- DE441's broad source ephemeris range must not be inherited as production seasonal-event coverage without independent target-era validation.

## 8. A seasonal epoch does not resolve all four pillars

Even a trustworthy absolute solar-term epoch does not automatically authorize arbitrary-millennia Day/Hour reconstruction.

The recurrence proof must keep **target-instant reference basis** separate from **Day/Hour local clock basis**. A target may be date-only, a TT Julian-day coordinate, a UT1 Julian-day coordinate, or an explicitly proleptic fixed local offset from UT1. These are different claims. TT still requires an Earth-rotation bridge before it can locate an Earth-rotation clock phase; a target already expressed on UT1 must not be sent through TT→UT1 a second time.

The downstream Day/Hour clock basis is a different choice: `civil`, `local-mean-solar`, or `local-apparent-solar`. Mean/apparent solar clocks are derived local readings used to decide pillar membership; they are not independent physical target instants and must not be accepted as target-instant reference bases.

A fixed offset from UT1 is also not a prediction of future UTC, daylight-saving, or political timezone rules. Deep-time ΔT evidence may support an explicitly uncertain TT→UT1 estimate, but it cannot silently resolve future UTC/civil policy. Any target binding or local-clock projection that needs those policies must remain fail-closed until they are explicitly supplied.

Day/Hour proof therefore requires a separate chain covering the target instant and its reference basis, any required TT↔UT1 / ΔT and Earth-rotation projection, civil/local-zone policy, day-boundary convention, selected Day/Hour clock basis, longitude when a solar basis requires it, and downstream pillar reconstruction.

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
