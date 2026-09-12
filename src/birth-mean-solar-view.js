import { localApparentSolarTime } from "./astronomy/apparent-solar-time.js";

const form = document.querySelector("#birth-form");
const utcOffsetInput = document.querySelector("#birth-utc-offset");
const timeGroup = utcOffsetInput?.closest(".birth-field-group");
const timeBasisNote = form?.querySelector(".time-basis-note");
const pillarSummary = document.querySelector(".pillar-summary");
const query = new URLSearchParams(window.location.search);

let longitudeInput;
let preview;
let meanSolarTime;
let longitudeCorrection;
let equationCorrection;
let apparentSolarTime;
let totalCorrection;
let previewMeta;
let longitudeTouched = false;

function numberFrom(selector) {
  const input = document.querySelector(selector);
  const value = Number(input?.value);
  if (!input || input.value.trim() === "" || !Number.isFinite(value)) {
    throw new RangeError(`invalid input: ${selector}`);
  }
  return value;
}

function currentInput() {
  return {
    year: numberFrom("#birth-year"),
    month: numberFrom("#birth-month"),
    day: numberFrom("#birth-day"),
    hour: numberFrom("#birth-hour"),
    minute: numberFrom("#birth-minute"),
    second: 0
  };
}

function pad(value, width = 2) {
  return String(value).padStart(width, "0");
}

function sameDate(a, b) {
  return a.year === b.year && a.month === b.month && a.day === b.day;
}

function formatClock(time, includeDate = false) {
  const clock = `${pad(time.hour)}:${pad(time.minute)}:${pad(time.second)}`;
  return includeDate
    ? `${pad(time.year, 4)}-${pad(time.month)}-${pad(time.day)} · ${clock}`
    : clock;
}

function formatSignedMinutes(value) {
  const sign = value >= 0 ? "+" : "−";
  return `${sign}${Math.abs(value).toFixed(2)} min`;
}

function install() {
  if (!form || !utcOffsetInput || !timeGroup || !timeBasisNote || !pillarSummary) return false;

  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = "./mean-solar-time.css";
  stylesheet.dataset.meanSolarStyles = "1";
  document.head.append(stylesheet);

  const basisTitle = timeBasisNote.querySelector("strong");
  const basisCopy = timeBasisNote.querySelector("span");
  if (basisTitle) basisTitle.textContent = "目前排盤基準：出生地民用時間 + UTC offset";
  if (basisCopy) {
    basisCopy.textContent = "四柱仍用民用鐘面；下方只比較經度校正與均時差，尚未切換排盤基準。";
  }

  const field = document.createElement("label");
  field.className = "longitude-input";
  const title = document.createElement("span");
  title.className = "longitude-input-label";
  title.textContent = "出生地經度";
  longitudeInput = document.createElement("input");
  longitudeInput.id = "birth-longitude";
  longitudeInput.name = "birth-longitude";
  longitudeInput.type = "number";
  longitudeInput.inputMode = "decimal";
  longitudeInput.min = "-180";
  longitudeInput.max = "180";
  longitudeInput.step = "0.0001";
  longitudeInput.setAttribute("aria-label", "出生地經度，東經為正西經為負");
  const unit = document.createElement("small");
  unit.textContent = "°　東正／西負";
  field.append(title, longitudeInput, unit);

  const hint = document.createElement("span");
  hint.className = "longitude-input-hint";
  hint.textContent = "預設跟隨 UTC offset 的等效經線；請改成出生地實際經度才有校正意義。";
  field.append(hint);
  timeGroup.append(field);

  preview = document.createElement("section");
  preview.id = "mean-solar-preview";
  preview.className = "mean-solar-preview";
  preview.setAttribute("aria-label", "地方平太陽時與地方視太陽時比較");
  preview.innerHTML = `
    <div class="mean-solar-preview-copy">
      <small>SOLAR TIME BASIS</small>
      <strong>地方太陽時比較</strong>
      <span>平太陽時 = 經度校正；視太陽時再加均時差。</span>
    </div>
    <div class="solar-time-rows">
      <div class="solar-time-row" data-time-layer="mean">
        <span>平太陽時</span>
        <b id="mean-solar-time">--:--:--</b>
        <em id="mean-solar-correction">+0.00 min</em>
      </div>
      <div class="solar-time-row eot" data-time-layer="equation">
        <span>均時差 EoT</span>
        <b id="equation-of-time">+0.00 min</b>
        <em>視 − 平</em>
      </div>
      <div class="solar-time-row apparent" data-time-layer="apparent">
        <span>視太陽時</span>
        <b id="apparent-solar-time">--:--:--</b>
        <em id="total-solar-correction">+0.00 min</em>
      </div>
    </div>
    <div id="mean-solar-meta" class="mean-solar-preview-meta"></div>
  `;
  meanSolarTime = preview.querySelector("#mean-solar-time");
  longitudeCorrection = preview.querySelector("#mean-solar-correction");
  equationCorrection = preview.querySelector("#equation-of-time");
  apparentSolarTime = preview.querySelector("#apparent-solar-time");
  totalCorrection = preview.querySelector("#total-solar-correction");
  previewMeta = preview.querySelector("#mean-solar-meta");

  const projectionLink = document.querySelector(".birth-projection-link");
  (projectionLink ?? pillarSummary).insertAdjacentElement("afterend", preview);

  const queryLongitude = query.get("lon");
  if (queryLongitude !== null && Number.isFinite(Number(queryLongitude))) {
    longitudeInput.value = String(Number(queryLongitude));
    longitudeTouched = true;
  } else {
    longitudeInput.value = String(Number(utcOffsetInput.value) * 15);
  }

  longitudeInput.addEventListener("input", () => {
    longitudeTouched = true;
    update();
  });
  utcOffsetInput.addEventListener("input", () => {
    if (!longitudeTouched && utcOffsetInput.value.trim() !== "" && Number.isFinite(Number(utcOffsetInput.value))) {
      longitudeInput.value = String(Number(utcOffsetInput.value) * 15);
    }
    update();
  });
  return true;
}

function update() {
  if (!preview || !longitudeInput) return;
  try {
    const longitudeDegrees = Number(longitudeInput.value);
    if (!Number.isFinite(longitudeDegrees)) throw new RangeError("invalid longitude");
    const utcOffsetHours = numberFrom("#birth-utc-offset");
    const result = localApparentSolarTime(currentInput(), longitudeDegrees, utcOffsetHours);
    const meanCrossedDate = !sameDate(result.civil, result.meanSolar);
    const apparentCrossedDate = !sameDate(result.civil, result.apparentSolar);

    preview.hidden = false;
    longitudeInput.removeAttribute("aria-invalid");
    meanSolarTime.textContent = formatClock(result.meanSolar, meanCrossedDate);
    longitudeCorrection.textContent = formatSignedMinutes(result.longitudeCorrectionMinutes);
    equationCorrection.textContent = formatSignedMinutes(result.equationOfTimeMinutes);
    apparentSolarTime.textContent = formatClock(result.apparentSolar, apparentCrossedDate);
    totalCorrection.textContent = formatSignedMinutes(result.totalCorrectionMinutes);
    previewMeta.textContent = `${longitudeDegrees >= 0 ? "E" : "W"}${Math.abs(longitudeDegrees).toFixed(4)}° · UTC${utcOffsetHours >= 0 ? "+" : "−"}${Math.abs(utcOffsetHours)} · EoT = 視太陽時 − 平太陽時 · ${apparentCrossedDate ? "視太陽時已跨民用日期" : "未跨日期"}`;

    form.dataset.longitude = longitudeDegrees.toFixed(4);
    form.dataset.meanSolarCorrectionMinutes = result.longitudeCorrectionMinutes.toFixed(4);
    form.dataset.meanSolarClock = `${pad(result.meanSolar.hour)}:${pad(result.meanSolar.minute)}:${pad(result.meanSolar.second)}`;
    form.dataset.equationOfTimeMinutes = result.equationOfTimeMinutes.toFixed(4);
    form.dataset.apparentSolarClock = `${pad(result.apparentSolar.hour)}:${pad(result.apparentSolar.minute)}:${pad(result.apparentSolar.second)}`;
    form.dataset.totalSolarCorrectionMinutes = result.totalCorrectionMinutes.toFixed(4);
  } catch {
    preview.hidden = true;
    longitudeInput.setAttribute("aria-invalid", "true");
    delete form.dataset.meanSolarCorrectionMinutes;
    delete form.dataset.meanSolarClock;
    delete form.dataset.equationOfTimeMinutes;
    delete form.dataset.apparentSolarClock;
    delete form.dataset.totalSolarCorrectionMinutes;
  }
}

if (install()) {
  form.addEventListener("input", event => {
    if (event.target !== longitudeInput && event.target !== utcOffsetInput) update();
  });
  form.addEventListener("change", update);
  update();
}
