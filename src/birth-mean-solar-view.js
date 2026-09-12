import { localMeanSolarTime } from "./astronomy/mean-solar-time.js";

const form = document.querySelector("#birth-form");
const utcOffsetInput = document.querySelector("#birth-utc-offset");
const timeGroup = utcOffsetInput?.closest(".birth-field-group");
const timeBasisNote = form?.querySelector(".time-basis-note");
const pillarSummary = document.querySelector(".pillar-summary");
const query = new URLSearchParams(window.location.search);

let longitudeInput;
let preview;
let previewTime;
let previewCorrection;
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
    basisCopy.textContent = "四柱仍用民用鐘面；下方只比較經度校正。未加均時差，因此不是真太陽時。";
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
  preview.setAttribute("aria-label", "地方平太陽時預覽");
  preview.innerHTML = `
    <div class="mean-solar-preview-copy">
      <small>LOCAL MEAN SOLAR TIME</small>
      <strong>地方平太陽時</strong>
      <span>只做經度校正；尚未加入均時差。</span>
    </div>
    <div class="mean-solar-preview-readout">
      <b id="mean-solar-time">--:--:--</b>
      <span id="mean-solar-correction">+0.00 min</span>
    </div>
    <div id="mean-solar-meta" class="mean-solar-preview-meta"></div>
  `;
  previewTime = preview.querySelector("#mean-solar-time");
  previewCorrection = preview.querySelector("#mean-solar-correction");
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
    const result = localMeanSolarTime(currentInput(), longitudeDegrees, utcOffsetHours);
    const crossedDate = !sameDate(result.civil, result.meanSolar);

    preview.hidden = false;
    longitudeInput.removeAttribute("aria-invalid");
    previewTime.textContent = formatClock(result.meanSolar, crossedDate);
    previewCorrection.textContent = formatSignedMinutes(result.correctionMinutes);
    previewMeta.textContent = `${longitudeDegrees >= 0 ? "E" : "W"}${Math.abs(longitudeDegrees).toFixed(4)}° · UTC${utcOffsetHours >= 0 ? "+" : "−"}${Math.abs(utcOffsetHours)} · ${crossedDate ? "已跨民用日期" : "未跨日期"}`;

    form.dataset.longitude = longitudeDegrees.toFixed(4);
    form.dataset.meanSolarCorrectionMinutes = result.correctionMinutes.toFixed(4);
    form.dataset.meanSolarClock = `${pad(result.meanSolar.hour)}:${pad(result.meanSolar.minute)}:${pad(result.meanSolar.second)}`;
  } catch {
    preview.hidden = true;
    longitudeInput.setAttribute("aria-invalid", "true");
    delete form.dataset.meanSolarCorrectionMinutes;
    delete form.dataset.meanSolarClock;
  }
}

if (install()) {
  form.addEventListener("input", event => {
    if (event.target !== longitudeInput && event.target !== utcOffsetInput) update();
  });
  form.addEventListener("change", update);
  update();
}
