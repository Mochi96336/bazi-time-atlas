import {
  DAY_HOUR_TIME_BASIS,
  DAY_HOUR_TIME_BASIS_VALUES,
  isDayHourTimeBasis
} from "../calendar/day-hour-time-basis.js";
import {
  DAY_BOUNDARY,
  DAY_BOUNDARY_VALUES
} from "../calendar/day-boundary.js";
import { equationOfTimeModelBinding } from "./equation-of-time-model-binding.js";
import { geographicLongitudeBinding } from "./geographic-longitude-binding.js";
import {
  localZoneConventionBinding,
  LOCAL_ZONE_CONVENTION_KIND
} from "./local-zone-convention.js";
import {
  TARGET_INSTANT_BASIS,
  targetInstantBinding
} from "./target-instant-binding.js";

const HARD_BLOCKER_STATUSES = new Set([
  "uncertain-estimate",
  "missing-deep-time-model",
  "missing-model",
  "unbound-convention"
]);

function assertBoolean(value, name) {
  if (typeof value !== "boolean") throw new TypeError(`${name} must be boolean`);
}

function normalizeDayBoundary(value) {
  if (value === null || value === undefined) return null;
  if (!DAY_BOUNDARY_VALUES.includes(value)) {
    throw new RangeError(`dayBoundary must be null or one of: ${DAY_BOUNDARY_VALUES.join(", ")}`);
  }
  return value;
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

function targetInstantDetail(binding, identity) {
  if (identity) return "Δ=0 比較不需要建立另一個跨時代 target instant。";
  if (!binding.bound) {
    return "回歸頁目前只指定年月日，沒有 hour/minute/second 或等價的物理時間座標。日柱在 23:00 子初換日規則下也可能隨日內相位改變，時柱更無法由 date-only 狀態唯一決定。";
  }
  if (binding.basis === TARGET_INSTANT_BASIS.TT_JULIAN_DAY) {
    return "目標時刻已明確綁定為 TT Julian day；這是均勻動力時間座標，落到地球自轉／地方鐘面前仍需要 TT→UT1。";
  }
  if (binding.basis === TARGET_INSTANT_BASIS.UT1_JULIAN_DAY) {
    return "目標時刻已明確綁定為 UT1 Julian day；Earth-rotation coordinate 已存在，但尚未因此得到地方鐘面 convention。";
  }
  return `目標時刻已綁定為 UT1 加固定地方 offset (${binding.localOffsetHoursFromUt1 >= 0 ? "+" : ""}${binding.localOffsetHoursFromUt1} h)；這是明示的 proleptic convention，不是未來 UTC／政治時區預測。`;
}

function localZoneDetail(binding) {
  if (!binding.bound) {
    return "尚未綁定把 Earth-rotation coordinate 映到哪一套地方鐘面；可以是明示的 civil-timezone policy，也可以是研究用 proleptic fixed offset。";
  }
  if (binding.kind === LOCAL_ZONE_CONVENTION_KIND.PROLEPTIC_FIXED_OFFSET_FROM_UT1) {
    const sign = binding.localOffsetHoursFromUt1 >= 0 ? "+" : "";
    return `已採用 UT1 ${sign}${binding.localOffsetHoursFromUt1} h 的 proleptic fixed local zone。它足以定義研究用地方鐘面，但 futureUtcPolicyResolved=false、civilTimezonePolicyResolved=false，不是未來 UTC／DST／政治時區預測。`;
  }
  return `已綁定 resolved civil-timezone policy：${binding.timeZoneId}。`;
}

function dayBoundaryDetail(dayBoundary) {
  if (dayBoundary === null) {
    return "Birth 引擎已有 canonical 日界規則，但 recurrence 必須明示選定 convention，不能用 boolean 宣稱『已綁定』。";
  }
  if (dayBoundary === DAY_BOUNDARY.ZI_INITIAL_NEXT_DAY) {
    return "已明示採用 canonical zi-initial-next-day：子初 23:00 起算下一個干支日。";
  }
  return "已明示採用 canonical civil-midnight：00:00 民用午夜才切換干支日。";
}

function longitudeDetail(binding, clockBasis, needsLongitude) {
  if (!clockBasis) return "只有選 local mean/apparent solar clock 時才需要。";
  if (!needsLongitude) return "civil/zone clock 不需要經度修正。";
  if (!binding.bound) {
    return "選太陽時計時後必須指定觀測地經度；東經為正、西經為負，不能用 longitudeBound boolean 代替座標。";
  }
  const hemisphere = binding.longitudeDegrees >= 0 ? "E" : "W";
  return `太陽時經度已綁定：${hemisphere}${Math.abs(binding.longitudeDegrees)}°（east-positive）。`;
}

function equationOfTimeDetail(binding, clockBasis, needsEquationOfTime) {
  if (!clockBasis) return "只有 local apparent solar clock 需要。";
  if (!needsEquationOfTime) return "此 local clock basis 不需要 EoT。";
  if (!binding.bound) {
    return "視太陽時需要明示一個 registry-owned EoT model；不能用 boolean 或有限數值輸出冒充深時間驗證。";
  }
  if (!binding.validatedForTarget) {
    const target = binding.targetYear === null ? "目前 target" : String(binding.targetYear);
    return `已找到 ${binding.modelId}，但其 ${binding.validationScope ?? "registered"} evidence 沒有授權 ${target} 的 recurrence EoT；model presence 不等於 target-era validation。`;
  }
  return `EoT model ${binding.modelId} 已由 ${binding.evidenceId} 驗證涵蓋 target year ${binding.targetYear}。`;
}

export function dayHourResolutionProof({
  identity = false,
  relativeTermGeometry,
  absoluteSeasonalEpoch,
  targetInstant = null,
  earthRotationBridge,
  earthRotationEstimateAvailable = false,
  localZoneConvention = null,
  dayBoundary = null,
  sexagenaryDayArithmetic,
  clockBasis = null,
  longitudeDegrees = null,
  equationOfTimeModelId = null,
  targetYear = null,
  hourBranchRule = true,
  fiveRatsRule = true
}) {
  for (const [name, value] of Object.entries({
    identity,
    relativeTermGeometry,
    absoluteSeasonalEpoch,
    earthRotationBridge,
    earthRotationEstimateAvailable,
    sexagenaryDayArithmetic,
    hourBranchRule,
    fiveRatsRule
  })) assertBoolean(value, name);

  if (clockBasis !== null && !isDayHourTimeBasis(clockBasis)) {
    throw new RangeError(`clockBasis must be null or one of: ${DAY_HOUR_TIME_BASIS_VALUES.join(", ")}`);
  }

  const normalizedDayBoundary = normalizeDayBoundary(dayBoundary);
  const longitude = geographicLongitudeBinding(longitudeDegrees);
  const equationOfTimeModel = equationOfTimeModelBinding(equationOfTimeModelId, targetYear);
  const target = targetInstantBinding(targetInstant);
  const localZone = localZoneConventionBinding(localZoneConvention, target);
  const targetInstantBound = target.bound;
  const localZoneBound = localZone.bound;
  const dayBoundaryBound = normalizedDayBoundary !== null;
  const longitudeBound = longitude.bound;
  const earthRotationBridgeRequired = targetInstantBound && target.requiresEarthRotationBridge;
  const earthRotationRequirementSatisfied = targetInstantBound
    && (!earthRotationBridgeRequired || earthRotationBridge);
  const earthRotationEstimateCapability = earthRotationEstimateAvailable;
  const earthRotationEstimateForTarget = earthRotationBridgeRequired
    && earthRotationEstimateCapability;

  const dayRequirements = Object.freeze({
    relativeTermGeometry,
    absoluteSeasonalEpoch,
    targetInstantBound,
    earthRotationBridge:earthRotationRequirementSatisfied,
    localZoneBound,
    dayBoundaryBound,
    sexagenaryDayArithmetic
  });
  const dayBlockers = Object.entries(dayRequirements)
    .filter(([, satisfied]) => !satisfied)
    .map(([name]) => name);
  const dayResolved = identity || dayBlockers.length === 0;

  const needsLongitude = clockBasis === DAY_HOUR_TIME_BASIS.LOCAL_MEAN_SOLAR
    || clockBasis === DAY_HOUR_TIME_BASIS.LOCAL_APPARENT_SOLAR;
  const needsEquationOfTime = clockBasis === DAY_HOUR_TIME_BASIS.LOCAL_APPARENT_SOLAR;
  const equationOfTimeRequirementSatisfied = !needsEquationOfTime || equationOfTimeModel.validatedForTarget;
  const hourRequirements = Object.freeze({
    resolvedDayPillar:dayResolved,
    clockBasisBound:clockBasis !== null,
    longitudeBound:!needsLongitude || longitudeBound,
    equationOfTimeModel:equationOfTimeRequirementSatisfied,
    hourBranchRule,
    fiveRatsRule
  });
  const hourBlockers = Object.entries(hourRequirements)
    .filter(([, satisfied]) => !satisfied)
    .map(([name]) => name);
  const hourResolved = identity || hourBlockers.length === 0;

  const targetInstantStatus = identity
    ? "not-required"
    : targetInstantBound
      ? "satisfied"
      : "unbound-convention";

  const earthRotationStatus = identity
    ? "not-required"
    : !absoluteSeasonalEpoch || !targetInstantBound
      ? "blocked"
      : !earthRotationBridgeRequired
        ? "not-required"
        : earthRotationBridge
          ? "satisfied"
          : earthRotationEstimateForTarget
            ? "uncertain-estimate"
            : "missing-deep-time-model";
  const earthRotationDetail = identity
    ? "Δ=0 identity comparison 不需要跨 epoch 的 Earth-rotation projection。"
    : !absoluteSeasonalEpoch
      ? "必須先取得絕對 seasonal epoch，才能完成目前 recurrence proof chain。"
      : !targetInstantBound
        ? earthRotationEstimateCapability
          ? "此年份已有深時間 ΔT / TT→UT1 模型能力，但 recurrence 尚未定義 target instant reference basis，因此不能產生此比較狀態的 UT1 estimate。"
          : "recurrence 尚未定義 target instant reference basis；Earth-rotation projection 必須等目標時刻先綁定。"
        : !earthRotationBridgeRequired
          ? `target instant 已直接位於 ${target.inputTimeScale} Earth-rotation coordinate；不應再重複要求 TT→UT1 bridge。`
          : earthRotationBridge
            ? "TT target 已被確定地投影到地球自轉時間。"
            : earthRotationEstimateForTarget
              ? "已有此 TT target 的 TT→UT1 深時間 ΔT 點估計與統計不確定性；但它不是 deterministic UT1，更不能直接當成未來 UTC／民用時間，因此尚不足以唯一判定日柱或時柱。"
              : "TT target 要落到地球自轉時間，仍需要深時間 Earth-rotation / ΔT 模型；不能由軌道形狀本身推出。";

  const clockBasisDetail = !clockBasis
    ? "尚未選 civil / local-mean-solar / local-apparent-solar clock；這是 pillar membership 的地方鐘面 basis，不是 target instant 的物理時間尺度。"
    : clockBasis === DAY_HOUR_TIME_BASIS.CIVIL
      && localZone.kind === LOCAL_ZONE_CONVENTION_KIND.PROLEPTIC_FIXED_OFFSET_FROM_UT1
        ? "已選 civil/zone-clock reading；此處使用的是研究用 proleptic fixed local zone，不代表未來政治時區已解決。"
        : `已選 ${clockBasis} local clock。`;

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
      "target-instant",
      "目標時刻／reference basis",
      targetInstantStatus,
      targetInstantDetail(target, identity),
      "input"
    ),
    stage(
      "earth-rotation-bridge",
      "地球自轉橋 · TT↔UT1 / ΔT",
      earthRotationStatus,
      earthRotationDetail,
      "physics"
    ),
    stage(
      "civil-zone",
      "地方鐘面／zone convention",
      localZoneBound ? "satisfied" : "unbound-convention",
      localZoneDetail(localZone),
      "civil"
    ),
    stage(
      "day-boundary",
      "日界規則",
      dayBoundaryBound ? "satisfied" : "unbound-convention",
      dayBoundaryDetail(normalizedDayBoundary),
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
      "Day / Hour local clock basis",
      clockBasis ? "satisfied" : "unbound-convention",
      clockBasisDetail,
      "civil"
    ),
    stage(
      "longitude",
      "經度",
      !clockBasis ? "conditional" : needsLongitude ? (longitudeBound ? "satisfied" : "unbound-convention") : "not-required",
      longitudeDetail(longitude, clockBasis, needsLongitude),
      "civil"
    ),
    stage(
      "equation-of-time",
      "Equation of Time",
      !clockBasis ? "conditional" : needsEquationOfTime ? (equationOfTimeModel.validatedForTarget ? "satisfied" : "missing-deep-time-model") : "not-required",
      equationOfTimeDetail(equationOfTimeModel, clockBasis, needsEquationOfTime),
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

  const firstHardBlocker = stages.find(item => HARD_BLOCKER_STATUSES.has(item.status))?.id ?? null;

  return Object.freeze({
    identity,
    targetInstant:Object.freeze({ ...target }),
    targetInstantBound,
    targetInstantBasis:target.basis,
    localZoneConvention:Object.freeze({ ...localZone }),
    localZoneBound,
    dayBoundary:normalizedDayBoundary,
    dayBoundaryBound,
    earthRotationBridgeRequired,
    clockBasis,
    longitude:Object.freeze({ ...longitude }),
    longitudeDegrees:longitude.longitudeDegrees,
    longitudeBound,
    equationOfTimeModel:Object.freeze({ ...equationOfTimeModel }),
    equationOfTimeModelValidated:equationOfTimeModel.validatedForTarget,
    needsLongitude,
    needsEquationOfTime,
    earthRotationEstimateCapability,
    earthRotationEstimateAvailable:earthRotationEstimateForTarget,
    firstHardBlocker,
    stages,
    day:freezeResult({
      resolved:dayResolved,
      status:identity ? "identical-by-definition" : dayResolved ? "resolved" : "blocked",
      blockers:identity ? [] : dayBlockers,
      stages:["relative-term-geometry", "absolute-seasonal-epoch", "target-instant", "earth-rotation-bridge", "civil-zone", "day-boundary", "sexagenary-day-arithmetic"]
    }),
    hour:freezeResult({
      resolved:hourResolved,
      status:identity ? "identical-by-definition" : hourResolved ? "resolved" : "blocked",
      blockers:identity ? [] : hourBlockers,
      stages:["resolved-day-pillar", "target-instant", "clock-basis", "longitude", "equation-of-time", "hour-rules"]
    })
  });
}

/** Current capabilities intentionally represented by the recurrence page. */
export function currentRecurrenceDayHourProof({
  identity,
  astronomyWithinRange,
  absoluteSeasonalEpoch = false,
  targetInstant = null,
  localZoneConvention = null,
  dayBoundary = null,
  clockBasis = null,
  longitudeDegrees = null,
  equationOfTimeModelId = null,
  targetYear = null,
  earthRotationEstimateAvailable = false
}) {
  assertBoolean(identity, "identity");
  assertBoolean(astronomyWithinRange, "astronomyWithinRange");
  assertBoolean(absoluteSeasonalEpoch, "absoluteSeasonalEpoch");
  assertBoolean(earthRotationEstimateAvailable, "earthRotationEstimateAvailable");
  return dayHourResolutionProof({
    identity,
    relativeTermGeometry:astronomyWithinRange,
    absoluteSeasonalEpoch,
    targetInstant,
    earthRotationBridge:false,
    earthRotationEstimateAvailable,
    localZoneConvention,
    dayBoundary,
    sexagenaryDayArithmetic:true,
    clockBasis,
    longitudeDegrees,
    equationOfTimeModelId,
    targetYear,
    hourBranchRule:true,
    fiveRatsRule:true
  });
}