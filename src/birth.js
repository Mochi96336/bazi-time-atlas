import { DAY_BOUNDARY, resolveBirthPillars } from "./calendar/tyme-adapter.js";

const form = document.querySelector("#birth-form");
const yearInput = document.querySelector("#birth-year");
const monthInput = document.querySelector("#birth-month");
const dayInput = document.querySelector("#birth-day");
const hourInput = document.querySelector("#birth-hour");
const minuteInput = document.querySelector("#birth-minute");
const readout = document.querySelector("#birth-readout");
const badge = document.querySelector("#boundary-badge");
const errorBox = document.querySelector("#birth-error");
const sensitivity = document.querySelector("#boundary-sensitivity");
const comparison = document.querySelector("#boundary-comparison");
const conventionDay = document.querySelector("#convention-day");

const pillarTargets = {
  year: document.querySelector("#year-pillar"),
  month: document.querySelector("#month-pillar"),
  day: document.querySelector("#day-pillar"),
  hour: document.querySelector("#hour-pillar")
};

const summaryTargets = {
  year: document.querySelector("#summary-year"),
  month: document.querySelector("#summary-month"),
  day: document.querySelector("#summary-day"),
  hour: document.querySelector("#summary-hour")
};

const dayRuleNote = document.querySelector("#day-rule-note");

function selectedBoundary() {
  return form.elements.namedItem("day-boundary").value;
}

function numberFrom(input) {
  if (input.value.trim() === "") throw new RangeError(`${input.getAttribute("aria-label")}不可空白`);
  return Number(input.value);
}

function parseInput() {
  return {
    year: numberFrom(yearInput),
    month: numberFrom(monthInput),
    day: numberFrom(dayInput),
    hour: numberFrom(hourInput),
    minute: numberFrom(minuteInput),
    second: 0
  };
}

function boundaryLabel(boundary) {
  return boundary === DAY_BOUNDARY.CIVIL_MIDNIGHT
    ? "00:00 午夜換日"
    : "23:00 子初換日";
}

function sameDayAndHour(a, b) {
  return a.pillars.day.name === b.pillars.day.name &&
    a.pillars.hour.name === b.pillars.hour.name;
}

function pad(value, width = 2) {
  return String(value).padStart(width, "0");
}

function renderResult(result) {
  const { input, pillars, convention } = result;
  readout.textContent = `${pad(input.year, 4)}-${pad(input.month)}-${pad(input.day)} · ${pad(input.hour)}:${pad(input.minute)}`;
  badge.textContent = boundaryLabel(convention.dayBoundary);
  conventionDay.textContent = convention.dayBoundary === DAY_BOUNDARY.CIVIL_MIDNIGHT ? "00:00 換日" : "23:00 換日";
  dayRuleNote.textContent = convention.dayBoundary === DAY_BOUNDARY.CIVIL_MIDNIGHT
    ? "00:00 才進入下一干支日"
    : "23:00 起計下一干支日";

  for (const key of Object.keys(pillarTargets)) {
    pillarTargets[key].textContent = pillars[key].name;
    summaryTargets[key].textContent = pillars[key].name;
  }
}

function renderSensitivity(input, currentBoundary) {
  const alternativeBoundary = currentBoundary === DAY_BOUNDARY.CIVIL_MIDNIGHT
    ? DAY_BOUNDARY.ZI_INITIAL_NEXT_DAY
    : DAY_BOUNDARY.CIVIL_MIDNIGHT;
  const current = resolveBirthPillars(input, { dayBoundary: currentBoundary });
  const alternative = resolveBirthPillars(input, { dayBoundary: alternativeBoundary });

  if (sameDayAndHour(current, alternative)) {
    sensitivity.hidden = true;
    comparison.textContent = "";
    return;
  }

  sensitivity.hidden = false;
  comparison.textContent = `${boundaryLabel(currentBoundary)}：${current.pillars.day.name}日・${current.pillars.hour.name}時；${boundaryLabel(alternativeBoundary)}：${alternative.pillars.day.name}日・${alternative.pillars.hour.name}時。`;
}

function update() {
  errorBox.hidden = true;
  try {
    const input = parseInput();
    const boundary = selectedBoundary();
    const result = resolveBirthPillars(input, { dayBoundary: boundary });
    renderResult(result);
    renderSensitivity(input, boundary);
  } catch (error) {
    sensitivity.hidden = true;
    errorBox.hidden = false;
    errorBox.textContent = `無法計算：${error.message}`;
  }
}

form.addEventListener("input", update);
form.addEventListener("change", update);
update();
