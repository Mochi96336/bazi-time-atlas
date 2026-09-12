import { DAY_BOUNDARY, resolveBirthPillars } from "./calendar/tyme-adapter.js";
import { apparentSolarLongitude } from "./astronomy/solar-longitude.js";

const form = document.querySelector("#birth-form");
const yearInput = document.querySelector("#birth-year");
const monthInput = document.querySelector("#birth-month");
const dayInput = document.querySelector("#birth-day");
const hourInput = document.querySelector("#birth-hour");
const minuteInput = document.querySelector("#birth-minute");
const utcOffsetInput = document.querySelector("#birth-utc-offset");
const readout = document.querySelector("#birth-readout");
const badge = document.querySelector("#boundary-badge");
const errorBox = document.querySelector("#birth-error");
const sensitivity = document.querySelector("#boundary-sensitivity");
const comparison = document.querySelector("#boundary-comparison");
const conventionDay = document.querySelector("#convention-day");
const conventionTime = document.querySelector("#convention-time");
const pillarSummary = document.querySelector(".pillar-summary");

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

const summaryLabels = {
  year: "年柱",
  month: "月柱",
  day: "日柱",
  hour: "時柱"
};

const summaryCells = {};
let annualProjectionLink;
let annualProjectionMeta;
const dayRuleNote = document.querySelector("#day-rule-note");

function installCrossViewLinks() {
  for (const [key, node] of Object.entries(summaryTargets)) {
    const cell = node.parentElement;
    summaryCells[key] = cell;
    cell.tabIndex = 0;
    cell.setAttribute("role", "link");
    cell.style.cursor = "pointer";
    cell.querySelector("span").textContent = `${summaryLabels[key]} ↗`;

    const activate = () => {
      if (cell.dataset.href) window.location.href = cell.dataset.href;
    };
    cell.addEventListener("click", activate);
    cell.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        activate();
      }
    });
  }

  const row = document.createElement("div");
  row.className = "birth-projection-link";
  const label = document.createElement("span");
  label.className = "birth-projection-kicker";
  label.textContent = "出生瞬間 · 太陽黃經";
  annualProjectionLink = document.createElement("a");
  annualProjectionLink.href = "./?month=子&lambda=270";
  annualProjectionLink.textContent = "λ 270.00°　年度盤精確定位 →";
  annualProjectionMeta = document.createElement("span");
  annualProjectionMeta.className = "birth-projection-meta";
  annualProjectionMeta.textContent = "子月 · UTC+08:00 · 不套真太陽時";
  row.append(label, annualProjectionLink, annualProjectionMeta);
  pillarSummary.insertAdjacentElement("afterend", row);
}

function selectedBoundary() {
  return form.elements.namedItem("day-boundary").value;
}

function numberFrom(input) {
  if (input.value.trim() === "") throw new RangeError(`${input.getAttribute("aria-label")}不可空白`);
  const value = Number(input.value);
  if (!Number.isFinite(value)) throw new RangeError(`${input.getAttribute("aria-label")}格式錯誤`);
  return value;
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

function parseUtcOffset() {
  const value = numberFrom(utcOffsetInput);
  if (value < -14 || value > 14) {
    throw new RangeError("出生當時 UTC offset 必須介於 -14 到 +14 小時");
  }
  return value;
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

function formatUtcOffset(offset) {
  const totalMinutes = Math.round(Math.abs(offset) * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const sign = offset < 0 ? "−" : "+";
  return `UTC${sign}${pad(hours)}:${pad(minutes)}`;
}

function renderResult(result, longitude, utcOffsetHours) {
  const { input, pillars, convention } = result;
  readout.textContent = `${pad(input.year, 4)}-${pad(input.month)}-${pad(input.day)} · ${pad(input.hour)}:${pad(input.minute)}`;
  badge.textContent = boundaryLabel(convention.dayBoundary);
  conventionDay.textContent = convention.dayBoundary === DAY_BOUNDARY.CIVIL_MIDNIGHT ? "00:00 換日" : "23:00 換日";
  conventionTime.textContent = `${formatUtcOffset(utcOffsetHours)} · 當地民用`;
  dayRuleNote.textContent = convention.dayBoundary === DAY_BOUNDARY.CIVIL_MIDNIGHT
    ? "00:00 才進入下一干支日"
    : "23:00 起計下一干支日";

  for (const key of Object.keys(pillarTargets)) {
    pillarTargets[key].textContent = pillars[key].name;
    summaryTargets[key].textContent = pillars[key].name;
    const href = `./sexagenary.html?ganzhi=${encodeURIComponent(pillars[key].name)}`;
    summaryCells[key].dataset.href = href;
    summaryCells[key].setAttribute("aria-label", `${summaryLabels[key]} ${pillars[key].name}，在六十甲子 Reference view 查看`);
    summaryCells[key].title = `在六十甲子查看 ${pillars[key].name}`;
  }

  const lambda = longitude.toFixed(6);
  annualProjectionLink.href = `./?month=${encodeURIComponent(pillars.month.branch)}&lambda=${encodeURIComponent(lambda)}`;
  annualProjectionLink.textContent = `λ ${longitude.toFixed(2)}°　年度盤精確定位 →`;
  annualProjectionMeta.textContent = `${pillars.month.branch}月 · ${formatUtcOffset(utcOffsetHours)} · 不套真太陽時`;
}

function renderSensitivity(input, currentBoundary, utcOffsetHours) {
  const alternativeBoundary = currentBoundary === DAY_BOUNDARY.CIVIL_MIDNIGHT
    ? DAY_BOUNDARY.ZI_INITIAL_NEXT_DAY
    : DAY_BOUNDARY.CIVIL_MIDNIGHT;
  const current = resolveBirthPillars(input, {
    dayBoundary: currentBoundary,
    utcOffsetHours
  });
  const alternative = resolveBirthPillars(input, {
    dayBoundary: alternativeBoundary,
    utcOffsetHours
  });

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
    const utcOffsetHours = parseUtcOffset();
    const boundary = selectedBoundary();
    const result = resolveBirthPillars(input, {
      dayBoundary: boundary,
      utcOffsetHours
    });
    const longitude = apparentSolarLongitude(input, utcOffsetHours);
    renderResult(result, longitude, utcOffsetHours);
    renderSensitivity(input, boundary, utcOffsetHours);
  } catch (error) {
    sensitivity.hidden = true;
    errorBox.hidden = false;
    errorBox.textContent = `無法計算：${error.message}`;
  }
}

installCrossViewLinks();
form.addEventListener("input", update);
form.addEventListener("change", update);
update();
