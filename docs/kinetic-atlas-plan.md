# Kinetic Atlas redesign plan — historical design record

> **Status: historical / non-normative.** This file captures the redesign direction that led to the kinetic atlas. Implementation has since passed several assumptions and delivery phases recorded below. For current behavior and hard regression contracts, use [`current-status.md`](current-status.md).
>
> In particular, the current primary ring stack is **Hour → Day → Solar annual band → Month → Year** from inner to outer; Hour is already a primary ring; Zodiac is a derived sub-band owned by Solar; the recurrence lab is implemented as the secondary **Research** destination; and an absolute-state seasonal crossing solver core now exists while production DE441 integration remains fail-closed. The older stack/order and “future phase” wording below is retained only as design history.

## Product reset

BaZi Time Atlas should stop behaving like a collection of horoscope/calendar dashboards and become a **multi-scale temporal instrument**.

The primary object is one enormous radial / fan-shaped atlas driven by a single instant. Every layer is attached to the same time cursor, but each layer advances at its own rate and by its own rule:

- continuous astronomical phase (apparent solar longitude)
- event boundaries (24 solar terms / 12 jie)
- year pillar (60-step, Li Chun boundary)
- month pillar (60-step, jie boundaries)
- day pillar (60-day continuous sequence)
- hour pillar (12 branch / 60 pillar sequence)
- tropical zodiac (12 fixed 30° sectors)
- optional derived groupings such as five elements, four Western elements and modalities

The page should make the **relative motion, phase mismatch, recurrence and non-closure** visible before it explains them in prose.

## Core visual thesis

1. **One giant instrument, not many cards.** The atlas occupies the first viewport and visually dominates the page.
2. **Fan / partial wheel geometry.** The center sits below the visible frame so the user sees a large 210°–250° sweep rather than a small decorative circle.
3. **Adjacent rings touch.** Rings read like coupled layers of one machine, not isolated donut charts.
4. **Different motion laws are visible.** Continuous layers glide; discrete layers snap at boundaries; long-period layers barely move during short scrubs.
5. **One radial time cursor crosses every layer.** The cursor is the selected instant. It is the visual proof that all layers are projections of the same time.
6. **Text is secondary.** Labels are sparse. Detailed explanation appears only for the selected instant/layer.
7. **No fake equivalence.** Chinese five elements and Western four elements may be compared geometrically, but never asserted to be the same system.

## Interaction model

### Primary controls

- **Time scrubber**: drag across days/months/years and watch every ring move at its own speed.
- **Scale presets**: day, year, 60 years, deep time. The first implementation ships day/year/60-year interaction; deep-time comparison is a later engine because the existing Tyme adapter is bounded to practical calendar years.
- **Now**: return to current instant.
- **Play**: animate the selected scale so relative angular velocities become obvious.
- **Layer toggles**: hide/show without changing the underlying time state.

### Reading behavior

The center readout should show the selected instant and four pillars. A compact side/bottom inspector should show:

- apparent solar longitude
- nearest / active solar-term interval
- current year/month/day/hour pillars
- current tropical zodiac sign
- the current motion scale
- whether a boundary is astronomical, calendar-discrete, or purely classificatory

## Ring stack v1

From inner to outer:

1. **Year pillar — 60**
   - exact value from `resolveBirthPillars`
   - discrete transition at Li Chun
   - visually slow
2. **Month pillar — 60**
   - exact value from `resolveBirthPillars`
   - transition at 12 jie boundaries
   - medium speed and non-uniform in civil days
3. **Day pillar — 60**
   - exact value from `resolveBirthPillars`
   - one step per civil/selected day-boundary rule
   - fast
4. **Solar longitude / solar terms — 360° / 24 markers**
   - continuous angle from `apparentSolarLongitude`
   - solar terms are fixed longitude markers, but their civil timestamps emerge from the astronomical motion
5. **Tropical zodiac — 12 × 30°**
   - fixed longitude classification
   - does not “run” independently; it is read by the solar-longitude cursor

Hour pillar belongs in the inspector first, then becomes a high-speed inner ring after the day/year/month composition is visually stable.

## Motion semantics

The wheel must not fake a universal mechanical period.

- Year/month/day rings are rendered as **state wheels**: the currently active item is aligned to the shared cursor; neighboring items reveal how quickly that layer advances.
- The solar ring is rendered in **absolute longitude space**.
- Zodiac and solar-term markers remain fixed in longitude space.
- When time changes, the solar cursor glides while pillar state wheels counter-rotate/snap according to resolved pillar state.
- This deliberately makes “same time, different coordinate systems” visible.

For animation, interpolate only continuous quantities. Discrete pillar changes snap at their actual resolved boundary; do not tween a Ganzhi label through impossible intermediate states.

## Deep-time / recurrence track

Do not force the practical birth-calculation engine to pretend it can solve arbitrary millennia.

Phase 2 introduces a separate recurrence laboratory:

- calendar-only year+day recurrence model
- 400-year Gregorian structure
- 60-year / 60-day congruence
- 24,000-year global Gregorian + year/day recurrence visualization
- astronomical long-term model as a separate, explicitly versioned engine
- comparison of solar-term interval shape at candidate recurrences
- display “near recurrence” error instead of claiming exact closure

The UI should distinguish:

- exact discrete recurrence
- approximate astronomical recurrence
- non-closure / model-bounded result

## Architecture

### Keep

- `src/calendar/tyme-adapter.js`
- `src/astronomy/solar-longitude.js`
- existing solar-time and equation-of-time modules
- existing data tables for solar terms / zodiac / branches
- existing birth, sexagenary and relation pages as secondary research views
- current test and visual-check infrastructure

### Add

- `src/kinetic-atlas.js` — main page state, time cursor and SVG rendering
- `kinetic-atlas.css` — first-viewport instrument layout
- later: `src/recurrence/` — isolated deep-time engines and error metrics

### Avoid

- another framework migration
- duplicating calendar rules in presentation code
- storing pre-rendered coordinates
- card-per-concept layouts on the main page
- equating civil-month geometry with jie-based month boundaries

## Delivery phases

### Phase 0 — direction lock

- commit this plan
- preserve existing calculation modules and tests
- branch from current main

### Phase 1 — kinetic shell (current branch)

- replace annual dashboard landing view with a giant fan-shaped instrument
- build contiguous year/month/day/solar/zodiac rings
- add shared radial cursor
- add time scrubber, scale selector, play/pause and now
- read exact pillars and solar longitude from existing engines
- make mobile degrade to a clipped fan, not stacked dashboard cards
- preserve navigation to Birth and Sexagenary research pages

Acceptance:

- first viewport is dominated by the instrument
- user can scrub time and immediately see different apparent speeds
- year/month/day values come from the existing resolver, not new ad-hoc formulas
- solar longitude comes from the existing astronomy module
- no regressions to Birth/Sexagenary pages

### Phase 2 — boundary truth

- locate exact next/previous Li Chun and jie instants
- render boundary ticks in civil time
- snap discrete state transitions at exact instants
- expose time-zone convention explicitly
- add tests around boundary crossings

### Phase 3 — recurrence laboratory

- add 60-year, 400-year and 24,000-year discrete recurrence views
- add astronomical model adapter with declared validity range
- search candidate near-recurrences and render residual error
- never label a near recurrence as an exact period

### Phase 4 — optional Western sky layer

- extend from Sun-only zodiac to planets / aspects only after the time atlas is visually stable
- keep ephemeris source/version explicit
- render aspects as transient geometry, not permanent decorative spokes

## Visual quality gate

Every PR changing the main instrument should attach desktop and mobile screenshots generated by the existing visual-check path. Review should specifically inspect:

- fan occupies the intended visual mass
- labels do not collide at 390 px
- cursor crosses every visible ring cleanly
- current active sectors remain legible
- no accidental “dashboard card” regression
- animation does not interpolate discrete pillar identities

## Immediate implementation decision

The first landing-page rewrite will intentionally be **narrower in content but stronger in spatial concept** than the current annual page. Existing detailed annual/birth material remains in the repository; it can be reintroduced only when it supports the kinetic atlas instead of competing with it.
