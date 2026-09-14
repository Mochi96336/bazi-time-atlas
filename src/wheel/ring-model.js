export const WHEEL_CENTER = Object.freeze({ x: 600, y: 1360 });
export const CURSOR_ANGLE = -90;
export const FAN = Object.freeze({ start: -170, end: -10 });

// Radial position and thickness both carry temporal meaning: fast / short cycles
// live inside and stay narrow, while slow / long cycles move outward and become
// progressively wider. Solar longitude owns one annual coordinate band; zodiac
// is only a derived classification overlay inside that same band.
export const RADII = Object.freeze({
  inner: 686,
  hourOuter: 744,
  dayOuter: 812,
  solarTermOuter: 868,
  solarOuter: 908,
  monthOuter: 1028,
  yearOuter: 1182,
  outer: 1182
});

export const GUIDE_RADII = Object.freeze([
  RADII.inner,
  RADII.hourOuter,
  RADII.dayOuter,
  RADII.solarTermOuter,
  RADII.solarOuter,
  RADII.monthOuter,
  RADII.yearOuter
]);

function ring(definition) {
  return Object.freeze({
    draggable: true,
    defaultLinked: true,
    ...definition
  });
}

export const RINGS = Object.freeze([
  ring({
    id: "hour",
    groupId: "hour-track",
    innerRadius: RADII.inner,
    outerRadius: RADII.hourOuter,
    phaseKind: "sexagenary",
    phaseSource: "hour-pillar",
    steps: 60,
    snapDegrees: 6,
    className: "hour-sector",
    cycleScale: "~5 days"
  }),
  ring({
    id: "day",
    groupId: "day-track",
    innerRadius: RADII.hourOuter,
    outerRadius: RADII.dayOuter,
    phaseKind: "sexagenary",
    phaseSource: "day-pillar",
    steps: 60,
    snapDegrees: 6,
    className: "day-sector",
    cycleScale: "60 days"
  }),
  ring({
    id: "solar",
    groupId: "solar-track",
    innerRadius: RADII.dayOuter,
    outerRadius: RADII.solarOuter,
    phaseKind: "continuous",
    phaseSource: "solar-longitude",
    steps: 24,
    snapDegrees: 15,
    className: "term-sector",
    cycleScale: "1 year"
  }),
  ring({
    id: "month",
    groupId: "month-track",
    innerRadius: RADII.solarOuter,
    outerRadius: RADII.monthOuter,
    phaseKind: "sexagenary",
    phaseSource: "month-pillar",
    steps: 60,
    snapDegrees: 6,
    className: "month-sector",
    cycleScale: "~5 years"
  }),
  ring({
    id: "year",
    groupId: "year-track",
    innerRadius: RADII.monthOuter,
    outerRadius: RADII.yearOuter,
    phaseKind: "sexagenary",
    phaseSource: "year-pillar",
    steps: 60,
    snapDegrees: 6,
    className: "year-sector",
    cycleScale: "60 years"
  })
]);

export const ZODIAC_OVERLAY = Object.freeze({
  id: "zodiac",
  groupId: "zodiac-track",
  innerRadius: RADII.solarTermOuter,
  outerRadius: RADII.solarOuter,
  phaseKind: "derived",
  phaseSource: "solar-longitude",
  linkedPhaseId: "solar",
  steps: 12,
  snapDegrees: 30,
  className: "zodiac-sector"
});

export const SEXAGENARY_RING_IDS = Object.freeze(["hour", "day", "month", "year"]);
export const TRACK_IDS = Object.freeze([...RINGS.map(ring => ring.groupId), ZODIAC_OVERLAY.groupId]);

export function ringModel(id) {
  if (id === ZODIAC_OVERLAY.id) return ZODIAC_OVERLAY;
  return RINGS.find(ring => ring.id === id) ?? null;
}

export function assertWheelModel() {
  if (RINGS.length !== 5) throw new Error("wheel must contain exactly five primary time rings");
  if (new Set(RINGS.map(ring => ring.id)).size !== RINGS.length) throw new Error("ring ids must be unique");
  if (new Set(RINGS.map(ring => ring.groupId)).size !== RINGS.length) throw new Error("ring group ids must be unique");

  RINGS.forEach((ring, index) => {
    if (!(ring.innerRadius < ring.outerRadius)) throw new Error(`${ring.id} ring radii must increase`);
    if (index > 0 && ring.innerRadius !== RINGS[index - 1].outerRadius) {
      throw new Error(`${ring.id} must touch ${RINGS[index - 1].id} without a radial gap`);
    }
    if (index > 0) {
      const thickness = ring.outerRadius - ring.innerRadius;
      const previous = RINGS[index - 1].outerRadius - RINGS[index - 1].innerRadius;
      if (!(thickness > previous)) {
        throw new Error(`${ring.id} must be radially wider than ${RINGS[index - 1].id}`);
      }
    }
  });

  if (RINGS[0].innerRadius !== RADII.inner || RINGS.at(-1).outerRadius !== RADII.outer) {
    throw new Error("ring envelope must match canonical wheel radii");
  }
  if (!(RINGS.find(ring => ring.id === "solar").innerRadius < ZODIAC_OVERLAY.innerRadius
    && ZODIAC_OVERLAY.outerRadius === RINGS.find(ring => ring.id === "solar").outerRadius)) {
    throw new Error("zodiac overlay must remain inside the shared annual solar band");
  }
  return true;
}
