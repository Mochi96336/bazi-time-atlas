import { DAY_BOUNDARY, resolveBirthPillars } from "./calendar/tyme-adapter.js";

const form = document.querySelector("#birth-form");
const dateInput = document.querySelector("#birth-date");
const timeInput = document.querySelector("#birth-time");
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

const dayRuleNote = document.querySelector("#day-rule-note");

function selectedBoundary() {
  return form.elements.namedItem("day-boundary").value;
}

function parseInput() {
  const [year, month, day] = dateInput.value.split("-").map(Number);
  const [hour, minute] = timeInput.value.split(":").map(Number);
  return { year, month, day, hour, minute, second: 0 };
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

function renderResult(result) {
  const { input, pillars, convention } = result;
  readout.textContent = `${String(input.year).padStart(4, "0")}-${String(input.month).padStart(2, "0")}-${String(input.day).padStart(2, "0")} · ${String(input.hour).padStart(2, "0")}:${String(input.minute).padStart(2, "0")}`;
  badge.textContent = boundaryLabel(convention.dayBoundary);
  conventionDay.textContent = convention.dayBoundary === DAY_BOUNDARY.CIVIL_MIDNIGHT ? "00:00 換日" : "23:00 換日";
  dayRuleNote.textContent = convention.dayBoundary === DAY_BOUNDARY.CIVIL_MIDNIGHT
    ? "00:00 才進入下一干支日"
    : "23:00 起計下一干支日";

  for (const [key, node] of Object.entries(pillarTargets)) {
    node.textContent = pillars[key].name;
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
