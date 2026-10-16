# Research Visual Constitution

Status: **Draft design contract**

This document defines the visual-design boundary for the Research destination. It inherits the semantic/presentation separation in `docs/visual-architecture-reset.md` and the product/architecture contracts in `docs/current-status.md` and `docs/architecture-contracts.md`.

It is not a color-moodboard and not a CSS wishlist. It defines what the Research page must **feel like, prioritize, and visually prove** before implementation is accepted.

The Research destination is an **interactive BaZi time atlas / scientific essay**, not a dashboard.

---

## 1. Product thesis

The Research page explains one continuous argument:

1. **01 — discrete recurrence**  
   A local Year+Day recurrence appears around +1,980 years for the selected base date. Gregorian structure is added because it and the BaZi month/Jie sequence are both tied to the solar year. Raising the condition yields the +24,000-year global discrete candidate.

2. **02 — astronomical check**  
   The Gregorian/seasonal proxy is then tested against the actual twelve Jie boundaries. All 12 remain displaced by about 10–14 days at +24,000 years.

3. **03 — BaZi consequence**  
   Explain exactly what that does and does not prove for Year / Month / Day / Hour pillars.

The page should feel like the reader is watching **time pass through BaZi coordinate systems**, not reading a collection of analytics cards.

---

## 2. Relationship to the main Atlas

Research and the main Atlas are visually related but have different jobs.

The main Atlas is a **temporal instrument**.

Research is an **interactive explanatory atlas**.

Both must share these principles:

- one canonical time coordinate;
- no fake equivalence between coordinate systems;
- visual marks encode real semantics;
- active state is visually stronger than context;
- text explains diagrams rather than replacing them;
- mobile is recomposed, not merely scaled down.

Research may use linear, radial, orbital, and comparative diagrams where those geometries better explain the claim.

---

## 3. Design workflow contract

Research redesigns must follow this sequence:

```text
baseline capture
      ↓
audit
      ↓
foundations
      ↓
3 visual directions
      ↓
select one visual target
      ↓
prototype outside production
      ↓
design QA
      ↓
production implementation
      ↓
visual regression
```

### 3.1 Baseline capture

Capture at minimum:

- desktop `1440 × 900`;
- mobile `390 × 844`;
- 01 default;
- 01 local recurrence;
- 01 +24,000;
- 02 total drift;
- 02 decomposition;
- 03 fixed +24,000 conclusion.

Existing production screenshots are evidence of the current state, **not aesthetic golden masters**.

### 3.2 Audit

Before redesigning, review:

- information hierarchy;
- reading order;
- typography;
- spacing rhythm;
- color roles;
- surface/border use;
- diagram hierarchy;
- interaction states;
- focus/keyboard visibility;
- responsive reflow;
- whether BaZi/time identity remains visible.

Separate structural problems from polish.

### 3.3 Ideation

For a substantial visual reset, produce **three meaningfully different visual directions** before editing production CSS.

The three directions must vary hierarchy and composition, not only color.

A direction is invalid if it is merely:

- the same layout with a different palette;
- the same dashboard with rounder cards;
- a production screenshot with more shadows.

### 3.4 Visual target

One direction must be selected as a concrete visual target.

Do not start production implementation from prose alone.

### 3.5 Design QA

Compare the selected visual target and the rendered implementation at the same viewport/state.

No handoff while actionable P0/P1/P2 findings remain.

Mandatory QA surfaces:

- typography;
- spacing/layout rhythm;
- color/tokens;
- diagram fidelity;
- copy/content;
- interaction states;
- responsive composition;
- accessibility/focus.

---

## 4. Visual hierarchy rules

### 4.1 One section, one visual hero

Each numbered section gets exactly one primary visual object.

- **01 hero:** local recurrence → global discrete closure.
- **02 hero:** twelve Jie / orbit geometry.
- **03 hero:** selected-instant four-pillar consequence.

Everything else is supporting evidence.

If two objects compete equally for attention, the section has failed hierarchy.

### 4.2 Explanation before instrumentation

The reader should understand the claim before being asked to operate tools.

Controls, sliders, scrubbing, phase fans, decomposition modes and technical inspectors are verification instruments, not the primary explanation.

### 4.3 Space carries hierarchy before borders

Separation priority:

1. spacing;
2. grouping/alignment;
3. typography;
4. divider;
5. subtle layer tint;
6. border;
7. shadow.

Do not use a border because spacing failed.

Do not use a card because grouping failed.

### 4.4 Avoid card-per-concept layouts

Cards are reserved for standalone objects with their own identity or interaction.

Good candidates:

- sticky Research time coordinate;
- a true interactive instrument;
- an expandable deep-dive.

Bad candidates:

- every milestone;
- every paragraph;
- every statistic;
- each pillar when a single strip can communicate the state more clearly.

---

## 5. Color constitution

Use semantic role tokens, never ad-hoc per-component hues.

### 5.1 Neutral roles

```text
--research-bg
--research-layer-1
--research-layer-2
--research-line-subtle
--research-line-strong

--research-text-primary
--research-text-secondary
--research-text-muted
```

Dark layers become progressively lighter above the base background.

Avoid large fields of midtone gray-green.

### 5.2 Semantic accents

Only a small number of accent roles are allowed.

```text
--research-current       cyan / cool accent
--research-candidate     amber / warm accent
--research-unresolved    neutral-muted
--research-danger        red only for actual error/warning
--research-focus         dedicated accessible focus color
```

Meaning:

- **current / selected / local time state → cyan**
- **candidate / closure / conclusion → amber**
- **unresolved / insufficient evidence → neutral**
- **error → red**

The same semantic role must not change color between 01 / 02 / 03.

### 5.3 Contrast rule

The page should read as:

```text
deep background
↓
clear bright body text
↓
secondary explanation
↓
faint structural geometry
↓
few deliberate accent marks
```

Not:

```text
deep background
+
many slightly different gray/green midtones
```

---

## 6. Typography constitution

Body copy is not annotation.

Suggested baseline:

| Role | Desktop | Mobile | Purpose |
| --- | ---: | ---: | --- |
| Display | 40–48 | 30–36 | page thesis |
| Section | 26–30 | 22–26 | 01 / 02 / 03 |
| Subsection | 18–20 | 17–19 | local topic |
| Body | 15–16 | 15–16 | explanation |
| Compact body | 14 | 14 | dense but readable UI |
| Metadata | 12–13 | 12–13 | provenance / secondary state |
| Plot annotation | 11–12 | 11–12 | axes / compact marks |

Rules:

- do not use < 11 px for meaningful prose;
- 12 px text is secondary, not primary explanation;
- long-form explanatory copy should use comfortable line height;
- display text and body text may use different optical treatment but no more than two font families;
- do not create hierarchy mainly by making low-priority text tiny.

---

## 7. Spacing constitution

Use an 8 px base rhythm with a constrained scale:

```text
4  8  12  16  24  32  48  64  80
```

Small spacing is for tightly related items.

Large spacing is semantic separation.

### 7.1 Proximity carries meaning

Closer = more related.

Therefore:

- +1,980, its missing-condition bridge and +24,000 must form one visual group;
- 400 / 1,200 / 8,000 structural milestones are context and should sit farther away from the local→global climax;
- 02 verdict and orbit are one conceptual group;
- 02 decomposition is visibly secondary;
- 03 fixed conclusion and selected-instant reading must not look like duplicate equal-weight reports.

### 7.2 Rhythm over uniformity

Uniform 16 px gaps everywhere flatten hierarchy.

Use larger breaks between argument stages and smaller gaps inside one reasoning unit.

---

## 8. Width and page composition

Research is an interactive essay, not a full-width dashboard.

### 8.1 Narrative width

Explanatory prose should usually remain within approximately:

```text
760–900 px
```

or an equivalent comfortable reading length.

### 8.2 Visual breakout width

Major diagrams may break out to approximately:

```text
1100–1280 px
```

when the geometry benefits from horizontal space.

Do not make every row full viewport width.

### 8.3 Desktop composition

Default pattern:

```text
narrative
     ↓
hero diagram
     ↓
short interpretation
     ↓
supporting evidence / controls
```

### 8.4 Mobile composition

Mobile is a different composition contract.

Do not scale the desktop diagram until labels become microscopic.

Reflow, crop, simplify static context, or change the diagram orientation while preserving semantics.

---

# 9. Diagram grammar

Diagrams are first-class Research content.

A diagram is preferred when a relationship can be understood more directly through **position, direction, alignment, phase, boundary, or motion** than through prose or a table.

A diagram must explain something. Decorative geometry does not count.

## 9.1 One diagram, one claim

Every hero diagram must have one sentence that answers:

> What becomes obvious from this picture that was not obvious from the text?

If there is no clear answer, the diagram is unnecessary.

## 9.2 Four mark roles

Every diagram should separate marks into:

1. **surface** — quiet base geometry;
2. **structure** — boundaries, axes, major divisions;
3. **context** — neighboring labels / supporting values;
4. **active** — the currently selected or argued state.

Active marks must have an explicit readability floor.

Do not fade the entire diagram uniformly when changing emphasis.

## 9.3 Diagram semantics must be real

Geometry must correspond to a real relationship:

- angular position → phase / longitude;
- radial order → scale or nested coordinate system;
- linear position → time progression;
- alignment → recurrence / coincidence;
- boundary line → actual transition;
- distance from zero → actual residual;
- direction / arrow → transformation or tightening of conditions.

Do not use spatial relationships merely because they look attractive.

## 9.4 Diagram labels

Prefer labels integrated into the geometry.

Avoid detached legends when the diagram can carry its own identity.

Annotations should clarify:

- what is aligned;
- what remains different;
- which boundary is active;
- what the user should compare.

## 9.5 Diagram interaction

Interaction should reveal the claim, not just add motion.

Good:

- scrub across a Jie and watch Month pillar change;
- move the 02 longitude cursor and see both orbit and Ganzhi state update;
- select +1,980 and then +24,000 to expose which phase condition changed.

Weak:

- hover animation that changes no interpretation;
- draggable geometry with no semantic consequence;
- controls that only reveal numbers already visible.

## 9.6 Diagram before table

If the central idea is relational, test a diagram before defaulting to a table/card grid.

Tables remain appropriate for exact reference values after the visual relationship is understood.

---

# 10. Diagram candidates by section

## 10.1 Research 01 — local recurrence → global closure

### Primary question

Why does +1,980 matter, why is it insufficient, and why does the reasoning continue to +24,000?

### Hero diagram candidate A — condition ladder

```text
STRUCTURAL CONTEXT
400            1,200            8,000
Gregorian      Gregorian+Year   Gregorian+Day
proxy           structure        structure


LOCAL COINCIDENCE
+1,980
Year      0
Day       0
Solar/
seasonal -20
     │
     │ add the solar-year / month-sequence proxy condition
     │ Gregorian -20 → 0
     ▼
GLOBAL DISCRETE CANDIDATE
+24,000
Year      0
Day       0
Solar/
seasonal  0
```

This should be the first diagram explored.

It communicates **tightening of conditions**, not a false numerical multiple relationship.

### Hero diagram candidate B — three-track alignment

Three horizontal phase tracks:

```text
Gregorian / seasonal proxy  ─────●──────────────○
Year sequence               ─────●──────────────●
Day sequence                ─────●──────────────●
                              +1980          +24000
```

At +1,980 only Year + Day align.

At +24,000 all three align.

This is potentially more diagrammatic and less card-like than the current milestone boxes.

### Supporting diagram — solar-origin fork

```text
                   solar year
                  /          \
Gregorian structure        12 Jie / BaZi month sequence
(discrete proxy)           (actual astronomical boundary)
        │                            │
        └──── 01 proxy ─────┐        │
                            └── 02 verifies truth
```

This must stay conceptually subordinate to the +1,980 → +24,000 hero.

### Existing phase fan

The phase fan is a **verification instrument**, not the hero.

It should be visually quieter than the local→global diagram.

---

## 10.2 Research 02 — twelve Jie do not return

### Primary question

After the discrete candidate closes, did the real BaZi month/year boundaries return?

### Hero diagram — orbit / Jie atlas

The top-view orbit remains the main visual.

Requirements:

- all 12 Jie remain visible;
- Li Chun must read as a stronger boundary because it owns Year and Month transition meaning;
- selected/current month sector must be stronger than neighboring sectors;
- current longitude must link to the persistent Ganzhi coordinate;
- 2026 and 26026 comparison must not imply that a 10–14 day timing shift is literally a huge physical orbital displacement.

### Supporting chart — residual / days early

The chart answers magnitude:

```text
0 = exact return
↑
10–14 days early
```

It supports the orbit claim.

It is not allowed to visually dominate the orbit.

### Deep-dive diagram

The demeaned annual-shape view belongs behind disclosure.

It answers:

> Why is the shift not exactly the same at every longitude?

It must never look like another recurrence criterion.

---

## 10.3 Research 03 — consequence for four pillars

### Primary question

What can actually be concluded for Year / Month / Day / Hour?

### Hero diagram candidate A — four-pillar consequence strip

```text
selected longitude / instant
           │
           ▼
Year      Month      Day       Hour
丙午       庚寅        —          —
resolved  resolved   unresolved unresolved
```

This should feel like one coordinate readout, not four independent cards.

### Hero diagram candidate B — proof-chain branching

```text
solar longitude / Jie
      │
      ├── Year  ✓
      ├── Month ✓
      │
      └── absolute civil-time chain
             ├── Day  ?
             └── Hour ?
```

Use this if the goal is to explain **why** Year/Month are determined but Day/Hour are not.

### Rule

Do not show both candidate A and candidate B at equal weight.

One is the hero; the other is supporting disclosure.

---

# 11. Sticky Research time coordinate

The shared Research time/Ganzhi state is infrastructure, not a competing section.

At source position it may explain itself.

Once sticky it must become a compact coordinate strip.

It should visually answer only:

- what instant / longitude is being compared;
- Base vs Target;
- what the current four-pillar state is;
- what is unresolved.

It must not look like a permanent dashboard header.

---

# 12. Interaction and focus

Focus states must be intentionally designed.

Never allow a browser-default focus outline to wrap an entire major Research section.

Focus must:

- be visible;
- use the semantic focus token;
- match the actual interactive target;
- not create a large white rectangle around non-interactive content.

Hover is not a substitute for keyboard focus.

Tap targets remain practical on mobile even if the visual mark is small.

---

# 13. Responsive diagram contract

For every hero diagram, explicitly define:

- desktop composition;
- mobile composition;
- label reduction strategy;
- interaction target sizing;
- what can be omitted as context;
- what active mark can never be omitted.

Examples:

- 01 local→global hero may switch from horizontal on desktop to vertical on mobile.
- 02 orbit may crop/reframe on mobile but must preserve Li Chun, current sector and selected longitude.
- 03 four-pillar strip may remain four columns only if labels stay readable; otherwise use a compact 2×2 or horizontal scroll only when semantics justify it.

Do not solve mobile by reducing body text or plot labels below the type constitution.

---

# 14. Research acceptance gates

A Research visual PR is not accepted merely because CI is green.

## P0/P1 blockers

Examples:

- wrong semantic state;
- misleading diagram encoding;
- unreadable current state;
- interaction prevents understanding;
- active boundary appears as a false exact claim.

## P2 blockers

Examples:

- hero is visually weaker than supporting evidence;
- meaningful body text falls below the type baseline;
- mobile composition collapses hierarchy;
- color roles drift between sections;
- duplicate equal-weight conclusions;
- unnecessary card/border treatment materially changes the reading rhythm;
- focus state destroys the intended composition.

P3 polish may remain.

---

# 15. First redesign sequence

Do not restyle the whole page at once.

### Phase A — foundations only

The canonical Research token vocabulary lives in `research-foundations.css`. It is intentionally token-only: component selectors, layout ownership and diagram geometry belong to later prototype/implementation layers.

Create Research-specific tokens for:

- neutral layers;
- semantic accents;
- text roles;
- line roles;
- focus;
- type scale;
- spacing scale;
- narrative width;
- breakout width;
- diagram mark roles (`surface / structure / context / active`).

Do not change domain behavior or component geometry in this phase.

### Phase B — prototype 01

Prototype **three** alternatives for the local→global hero.

At least one must be diagram-first rather than card-first.

Compare at 1440 and 390.

Select a target before production implementation.

### Phase C — prototype 02

Keep the orbit.

Explore stronger BaZi boundary emphasis:

- Li Chun as Year/Month boundary;
- current month sector;
- selected longitude;
- 12 Jie hierarchy.

### Phase D — prototype 03

Choose one primary consequence diagram.

Reduce repeated verdict text.

### Phase E — full-page QA

Check:

- typography;
- spacing rhythm;
- color;
- diagram hierarchy;
- interaction states;
- responsive behavior;
- focus/accessibility.

Only then migrate the selected visual system into production.

---

# 16. External principles informing this contract

This constitution adapts principles from:

- Product Design plugin workflow — audit → three-direction ideation → selected visual target → implementation → blocking design QA;
- Product Design ideation guidance — spacing/grouping/alignment/typography before divider, surface tint, border and shadow;
- Product Design design-QA rubric — typography, layout rhythm, color tokens, responsiveness, states, accessibility and copy must all be explicitly checked;
- IBM Carbon — role-based tokens and dark-theme layering rather than ad-hoc color values;
- Atlassian Design System — 8 px spacing foundation, grouping by proximity, hierarchy through whitespace, and readable body typography;
- GitHub Primer — primitives/foundations for color, layout, responsiveness and typography;
- Observable — explanatory text and interactive visualization can form one narrative document rather than a dashboard grid;
- this repository's own `visual-architecture-reset.md` — semantic truth remains immutable while presentation geometry may change.

Reference material:

- https://www.carbondesignsystem.com/building-blocks/foundations/color/overview
- https://atlassian.design/foundations/spacing
- https://atlassian.design/foundations/typography
- https://primer.style/product/getting-started/foundations/
- https://observablehq.github.io/documentation/notebooks/