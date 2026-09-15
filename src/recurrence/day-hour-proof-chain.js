const CLOCK_BASES = Object.freeze(["civil", "mean-solar", "apparent-solar"]);

function assertBoolean(value, name) {
  if (typeof value !== "boolean") throw new TypeError(`${name} must be boolean`);
}

function stage(id, label, status, detail, kind) {
  return Object.freeze({ id, label, status, detail, kind });
}

function freezeResult(value) {
  return Object.freeze({
    ...value,
    blockers:Object.freeze([...(value.blockers ?? [])]),
    stages:Object.freeze([...(value.stages ?? [])])
  });
}

export function dayHourResolutionProof({
  identity = false,
  relativeTermGeometry,
  absoluteSeasonalEpoch,
  earthRotationBridge,
  civilZoneBound,
  dayBoundaryBound,
  sexagenaryDayArithmetic,
  clockBasis = null,
  longitudeBound = false,
  equationOfTimeModel = false,
  hourBranchRule = true,
  fiveRatsRule = true
}) {
  for (const [name, value] of Object.entries({
    identity,
    relativeTermGeometry,
    absoluteSeasonalEpoch,
    earthRotationBridge,
    civilZoneBound,
    dayBoundaryBound,
    sexagenaryDayArithmetic,
    longitudeBound,
    equationOfTimeModel,
    hourBranchRule,
    fiveRatsRule
  })) assertBoolean(value, name);

  if (clockBasis !== null && !CLOCK_BASES.includes(clockBasis)) {
    throw new RangeError(`clockBasis must be null or one of: ${CLOCK_BASES.join(", ")}`);
  }

  const dayRequirements = Object.freeze({
    relativeTermGeometry,
    absoluteSeasonalEpoch,
    earthRotationBridge,
    civilZoneBound,
    dayBoundaryBound,
    sexagenaryDayArithmetic
  });
  const dayBlockers = Object.entries(dayRequirements)
    .filter(([, satisfied]) => !satisfied)
    .map(([name]) => name);
  const dayResolved = identity || dayBlockers.length === 0;

  const needsLongitude = clockBasis === "mean-solar" || clockBasis === "apparent-solar";
  const needsEquationOfTime = clockBasis === "apparent-solar";
  const hourRequirements = Object.freeze({
    resolvedDayPillar:dayResolved,
    clockBasisBound:clockBasis !== null,
    longitudeBound:!needsLongitude || longitudeBound,
    equationOfTimeModel:!needsEquationOfTime || equationOfTimeModel,
    hourBranchRule,
    fiveRatsRule
  });
  const hourBlockers = Object.entries(hourRequirements)
    .filter(([, satisfied]) => !satisfied)
    .map(([name]) => name);
  const hourResolved = identity || hourBlockers.length === 0;

  const stages = Object.freeze([
    stage(
      "relative-term-geometry",
      "相對節氣幾何",
      relativeTermGeometry ? "satisfied" : "missing-model",
      relativeTermGeometry ? "十二節相對春分的形狀已可計算。" : "沒有可用的節氣形狀模型。",
      "astronomy"
    ),
    stage(
      "absolute-seasonal-epoch",
      "絕對季節 epoch",
      absoluteSeasonalEpoch ? "satisfied" : "missing-deep-time-model",
      absoluteSeasonalEpoch ? "季節節點已放回連續的均勻時間軸。" : "目前只有春分歸零後的相對形狀；缺少目標年份春分／節氣的絕對 TT/TDB 類 epoch。",
      "physics"
    ),
    stage(
      "earth-rotation-bridge",
      "地球自轉橋 · TT↔UT / ΔT",
      earthRotationBridge ? "satisfied" : absoluteSeasonalEpoch ? "missing-deep-time-model" : "blocked",
      earthRotationBridge ? "可把均勻時間的天文事件投影到地球自轉時間。" : "要落到民用日期，還需要深時間 Earth-rotation / ΔT 橋接；不能由軌道形狀本身推出。",
      "physics"
    ),
    stage(
      "civil-zone",
      "民用時區規則",
      civilZoneBound ? "satisfied" : "unbound-convention",
      civilZoneBound ? "已選定事件要投影到哪一套民用時鐘。" : "回歸頁尚未綁定 UTC offset / timezone policy。",
      "civil"
    ),
    stage(
      "day-boundary",
      "日界規則",
      dayBoundaryBound ? "satisfied" : "unbound-convention",
      dayBoundaryBound ? "已選定 23:00 子初換日或民用午夜等日界。" : "Birth 引擎有日界能力，但回歸比較尚未選定這個 convention。",
      "bazi"
    ),
    stage(
      "sexagenary-day-arithmetic",
      "干支日序算術",
      sexagenaryDayArithmetic ? "satisfied" : "missing-model",
      sexagenaryDayArithmetic ? "60 日日序與 Gregorian day-count 算術已存在。" : "缺少可重現的干支日序 anchor / 算術。",
      "bazi"
    ),
    stage(
      "clock-basis",
      "時柱時計 basis",
      clockBasis ? "satisfied" : "unbound-convention",
      clockBasis ? `已選 ${clockBasis} clock。` : "尚未選 civil / mean-solar / apparent-solar clock；不同 basis 可能跨時支甚至日界。",
      "civil"
    ),
    stage(
      "longitude",
      "經度",
      !clockBasis ? "conditional" : needsLongitude ? (longitudeBound ? "satisfied" : "unbound-convention") : "not-required",
      !clockBasis ? "只有選 mean/apparent solar clock 時才需要。" : needsLongitude ? (longitudeBound ? "太陽時經度已綁定。" : "選太陽時計時後必須指定經度。") : "civil clock 不需要經度修正。",
      "civil"
    ),
    stage(
      "equation-of-time",
      "Equation of Time",
      !clockBasis ? "conditional" : needsEquationOfTime ? (equationOfTimeModel ? "satisfied" : "missing-deep-time-model") : "not-required",
      !clockBasis ? "只有 apparent-solar clock 需要。" : needsEquationOfTime ? (equationOfTimeModel ? "視太陽時修正模型可用。" : "視太陽時需要該 epoch 可用的 EoT 模型。") : "此時計 basis 不需要 EoT。",
      "astronomy"
    ),
    stage(
      "hour-rules",
      "時支＋五鼠遁",
      hourBranchRule && fiveRatsRule ? "satisfied" : "missing-model",
      hourBranchRule && fiveRatsRule ? "時支與由已解析日干推出時干的規則已存在。" : "缺少時支或五鼠遁規則。",
      "bazi"
    )
  ]);

  const firstHardBlocker = stages.find(item => item.status === "missing-deep-time-model")?.id
    ?? stages.find(item => item.status === "missing-model")?.id
    ?? stages.find(item => item.status === "unbound-convention")?.id
    ?? null;

  return Object.freeze({
    identity,
    clockBasis,
    needsLongitude,
    needsEquationOfTime,
    firstHardBlocker,
    stages,
    day:freezeResult({
      resolved:dayResolved,
      status:identity ? "identical-by-definition" : dayResolved ? "resolved" : "blocked",
      blockers:identity ? [] : dayBlockers,
      stages:["relative-term-geometry", "absolute-seasonal-epoch", "earth-rotation-bridge", "civil-zone", "day-boundary", "sexagenary-day-arithmetic"]
    }),
    hour:freezeResult({
      resolved:hourResolved,
      status:identity ? "identical-by-definition" : hourResolved ? "resolved" : "blocked",
      blockers:identity ? [] : hourBlockers,
      stages:["resolved-day-pillar", "clock-basis", "longitude", "equation-of-time", "hour-rules"]
    })
  });
}

/** Current capabilities intentionally represented by the recurrence page. */
export function currentRecurrenceDayHourProof({
  identity,
  astronomyWithinRange,
  absoluteSeasonalEpoch = false
}) {
  assertBoolean(identity, "identity");
  assertBoolean(astronomyWithinRange, "astronomyWithinRange");
  assertBoolean(absoluteSeasonalEpoch, "absoluteSeasonalEpoch");
  return dayHourResolutionProof({
    identity,
    relativeTermGeometry:astronomyWithinRange,
    absoluteSeasonalEpoch,
    earthRotationBridge:false,
    civilZoneBound:false,
    dayBoundaryBound:false,
    sexagenaryDayArithmetic:true,
    clockBasis:null,
    longitudeBound:false,
    equationOfTimeModel:false,
    hourBranchRule:true,
    fiveRatsRule:true
  });
}
