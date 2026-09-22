const instrument = document.querySelector("#recurrence-instrument");
const spine = Object.freeze({
  discrete: document.querySelector("#research-spine-discrete"),
  astronomy: document.querySelector("#research-spine-astronomy"),
  evidence: document.querySelector("#research-spine-evidence")
});

function boolDataset(name) {
  const value = instrument?.dataset?.[name];
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

function setOutcome(name, text, state) {
  const node = spine[name];
  if (!node) return;
  if (node.textContent !== text) node.textContent = text;
  const link = node.closest("[data-research-spine]");
  if (link) link.dataset.researchSpineState = state;
}

function sync() {
  if (!instrument) return;
  const deltaYears = Number(instrument.dataset.deltaYears);
  if (!Number.isInteger(deltaYears) || deltaYears < 0) {
    for (const name of Object.keys(spine)) setOutcome(name, "等待狀態", "pending");
    return;
  }

  const identity = deltaYears === 0;
  const closed = [
    boolDataset("gregorianClosed"),
    boolDataset("yearSequenceClosed"),
    boolDataset("dayClosed")
  ];

  if (identity) {
    setOutcome("discrete", "基準狀態", "identity");
  } else if (closed.every(value => value !== null)) {
    const count = closed.filter(Boolean).length;
    setOutcome(
      "discrete",
      count === 3 ? "3 / 3 exact" : `${count} / 3 對齊`,
      count === 3 ? "exact" : "partial"
    );
  } else {
    setOutcome("discrete", "等待狀態", "pending");
  }

  const astronomyValidity = instrument.dataset.astronomyValidity;
  const astronomyClosed = boolDataset("astronomyShapeClosed");
  if (identity) {
    setOutcome("astronomy", "同一參照", "identity");
  } else if (astronomyValidity === "outside-range") {
    setOutcome("astronomy", "模型範圍外", "unavailable");
  } else if (astronomyValidity === "within-range" && astronomyClosed !== null) {
    setOutcome(
      "astronomy",
      astronomyClosed ? "形狀重合" : "仍有偏移",
      astronomyClosed ? "exact" : "offset"
    );
  } else {
    setOutcome("astronomy", "等待狀態", "pending");
  }

  if (identity) {
    setOutcome("evidence", "4 / 4 同一", "identity");
  } else {
    const resolved = Number(instrument.dataset.fourPillarResolvedCount);
    if (Number.isInteger(resolved) && resolved >= 0 && resolved <= 4) {
      setOutcome("evidence", `${resolved} / 4 可解析`, resolved === 4 ? "exact" : "partial");
    } else {
      setOutcome("evidence", "等待狀態", "pending");
    }
  }
}

let queued = false;
function scheduleSync() {
  if (queued) return;
  queued = true;
  queueMicrotask(() => {
    queued = false;
    sync();
  });
}

if (instrument) {
  new MutationObserver(scheduleSync).observe(instrument, {
    attributes:true,
    attributeFilter:[
      "data-delta-years",
      "data-gregorian-closed",
      "data-year-sequence-closed",
      "data-day-closed",
      "data-astronomy-validity",
      "data-astronomy-shape-closed",
      "data-four-pillar-resolved-count"
    ]
  });
  scheduleSync();
}
