export const WHEEL_CENTER = Object.freeze({ x: 600, y: 1360 });
export const CURSOR_ANGLE = -90;
export const FAN = Object.freeze({ start: -170, end: -10 });

export const RADII = Object.freeze({
  inner: 760,
  yearOuter: 834,
  monthOuter: 908,
  dayOuter: 982,
  solarOuter: 1072,
  zodiacOuter: 1182
});

export const GUIDE_RADII = Object.freeze([
  RADII.inner,
  RADII.yearOuter,
  RADII.monthOuter,
  RADII.dayOuter,
  RADII.solarOuter,
  RADII.zodiacOuter
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
    id: "year",
    groupId: "year-track",
    innerRadius: RADII.inner,
    outerRadius: RADII.yearOuter,
    phaseKind: "sexagenary",
    phaseSource: "year-pillar",
    steps: 60,
    snapDegrees: 6,
    className: "year-sector"
  }),
  ring({
    id: "month",
    groupId: "month-track",
    innerRadius: RADII.yearOuter,
    outerRadius: RADII.monthOuter,
    phaseKind: "sexagenary",
    phaseSource: "month-pillar",
    steps: 60,
    snapDegrees: 6,
    className: "month-sector"
  }),
  ring({
    id: "day",
    groupId: "day-track",
    innerRadius: RADII.monthOuter,
    outerRadius: RADII.dayOuter,
    phaseKind: "sexagenary",
    phaseSource: "day-pillar",
    steps: 60,
    snapDegrees: 6,
    className: "day-sector"
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
    className: "term-sector"
  }),
  ring({
    id: "zodiac",
    groupId: "zodiac-track",
    innerRadius: RADII.solarOuter,
    outerRadius: RADII.zodiacOuter,
    phaseKind: "derived",
    phaseSource: "solar-longitude",
    linkedPhaseId: "solar",
    steps: 12,
    snapDegrees: 30,
    className: "zodiac-sector"
  })
]);

export const SEXAGENARY_RING_IDS = Object.freeze(["year", "month", "day"]);
export const TRACK_IDS = Object.freeze(RINGS.map(ring => ring.groupId));

export function ringModel(id) {
  return RINGS.find(ring => ring.id === id) ?? null;
}

export function assertWheelModel() {
  if (RINGS.length !== 5) throw new Error("wheel must contain exactly five primary rings");
  if (new Set(RINGS.map(ring => ring.id)).size !== RINGS.length) throw new Error("ring ids must be unique");
  if (new Set(RINGS.map(ring => ring.groupId)).size !== RINGS.length) throw new Error("ring group ids must be unique");

  RINGS.forEach((ring, index) => {
    if (!(ring.innerRadius < ring.outerRadius)) throw new Error(`${ring.id} ring radii must increase`);
    if (index > 0 && ring.innerRadius !== RINGS[index - 1].outerRadius) {
      throw new Error(`${ring.id} must touch ${RINGS[index - 1].id} without a radial gap`);
    }
  });

  if (RINGS[0].innerRadius !== RADII.inner || RINGS.at(-1).outerRadius !== RADII.zodiacOuter) {
    throw new Error("ring envelope must match canonical wheel radii");
  }
  return true;
}
