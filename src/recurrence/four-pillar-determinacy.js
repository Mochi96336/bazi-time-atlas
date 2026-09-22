const PILLARS = Object.freeze(["year", "month", "day", "hour"]);

function assertBoolean(value, name) {
  if (typeof value !== "boolean") throw new TypeError(`${name} must be boolean`);
}

function freezePillar(value) {
  return Object.freeze({ ...value, missingInputs:Object.freeze([...(value.missingInputs ?? [])]) });
}

/**
 * State the strongest four-pillar claim that the recurrence laboratory can make.
 *
 * The outer astronomy comparator is intentionally spring-equinox anchored: it
 * keeps within-year solar-term shape but removes the common absolute seasonal
 * translation. That is sufficient to ask which side of Li Chun / a Jie boundary
 * a normalized phase occupies, but it is not sufficient to recover a civil day
 * or local clock. The discrete day-phase ring is therefore reported as supporting
 * evidence only; it must not be promoted into a Day/Hour-pillar claim here.
 */
export function fourPillarDeterminacy({
  deltaYears,
  yearSequenceAligned,
  discreteYearSequenceClosed,
  discreteDayClosed,
  astronomyWithinRange = true
}) {
  if (!Number.isInteger(deltaYears) || deltaYears < 0) {
    throw new RangeError("deltaYears must be a non-negative integer");
  }
  assertBoolean(yearSequenceAligned, "yearSequenceAligned");
  assertBoolean(discreteYearSequenceClosed, "discreteYearSequenceClosed");
  assertBoolean(discreteDayClosed, "discreteDayClosed");
  assertBoolean(astronomyWithinRange, "astronomyWithinRange");

  const identity = deltaYears === 0;
  if (identity) {
    const pillars = Object.fromEntries(PILLARS.map(pillar => [pillar, freezePillar({
      status:"identical-by-definition",
      resolved:true,
      pureBoundaryAttribution:true,
      summary:"同一個比較狀態",
      missingInputs:[]
    })]));
    return Object.freeze({
      deltaYears,
      identity:true,
      yearSequenceAligned,
      comparisonFrame:"vernal-equinox-normalized-shape",
      absoluteCivilPhasePreserved:false,
      localClockModeled:false,
      deltaTModeled:false,
      pillars:Object.freeze(pillars)
    });
  }

  const astronomyUsable = astronomyWithinRange;
  const year = astronomyUsable && yearSequenceAligned
    ? freezePillar({
        status:"boundary-resolved",
        resolved:true,
        pureBoundaryAttribution:true,
        summary:"立春窗口可解析完整年柱",
        boundaryCount:1,
        missingInputs:[]
      })
    : freezePillar({
        status:astronomyUsable ? "mixed-with-year-sequence" : "astronomy-unavailable",
        resolved:false,
        pureBoundaryAttribution:false,
        summary:astronomyUsable ? "立春幾何可見，但完整年柱另含 60 年序背景偏移" : "超出天文模型範圍",
        boundaryCount:1,
        missingInputs:astronomyUsable ? ["closed-sexagenary-year-phase"] : ["valid-astronomy-model"]
      });

  const month = astronomyUsable && yearSequenceAligned
    ? freezePillar({
        status:"boundary-resolved",
        resolved:true,
        pureBoundaryAttribution:true,
        summary:"十二節窗口可解析完整月柱",
        boundaryCount:12,
        missingInputs:[]
      })
    : astronomyUsable
      ? freezePillar({
          status:"branch-resolved-stem-mixed",
          resolved:false,
          pureBoundaryAttribution:false,
          summary:"月支跨界可判；月干仍混入未閉合年干序",
          boundaryCount:12,
          missingInputs:["closed-sexagenary-year-phase"]
        })
      : freezePillar({
          status:"astronomy-unavailable",
          resolved:false,
          pureBoundaryAttribution:false,
          summary:"超出天文模型範圍",
          boundaryCount:12,
          missingInputs:["valid-astronomy-model"]
        });

  const day = freezePillar({
    status:"not-resolved-by-shape-model",
    resolved:false,
    pureBoundaryAttribution:false,
    summary:discreteDayClosed
      ? "離散日序雖回到 0，但交節窗口內的民用日相位未被此模型保留"
      : "交節窗口內的民用日相位未被此模型保留",
    discretePhaseClosed:discreteDayClosed,
    missingInputs:[
      "absolute-equinox-to-civil-day-phase",
      "day-rollover-convention"
    ]
  });

  const hour = freezePillar({
    status:"not-resolved-by-shape-model",
    resolved:false,
    pureBoundaryAttribution:false,
    summary:"需要絕對地方時與已解析的日干，外圈形狀比較沒有保留這些量",
    discreteYearSequencePhaseClosed:discreteYearSequenceClosed,
    discreteDayPhaseClosed:discreteDayClosed,
    missingInputs:[
      "absolute-local-clock-phase",
      "timezone-and-longitude",
      "solar-time-convention",
      "resolved-day-stem"
    ]
  });

  return Object.freeze({
    deltaYears,
    identity:false,
    yearSequenceAligned,
    comparisonFrame:"vernal-equinox-normalized-shape",
    absoluteCivilPhasePreserved:false,
    localClockModeled:false,
    deltaTModeled:false,
    pillars:Object.freeze({ year, month, day, hour })
  });
}
