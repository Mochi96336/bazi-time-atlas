import { birthAtlasLink } from "./birth-atlas-link.js";

const form = document.querySelector("#birth-form");
const utcOffsetInput = document.querySelector("#birth-utc-offset");

const summaryNodes = Object.freeze({
  year: document.querySelector("#summary-year"),
  month: document.querySelector("#summary-month"),
  day: document.querySelector("#summary-day"),
  hour: document.querySelector("#summary-hour")
});

const summaryLabels = Object.freeze({
  year: "年柱",
  month: "月柱",
  day: "日柱",
  hour: "時柱"
});

function finiteField(id) {
  const node = document.querySelector(id);
  if (!node || node.value.trim() === "") return null;
  const value = Number(node.value);
  return Number.isFinite(value) ? value : null;
}

function currentInput() {
  const year = finiteField("#birth-year");
  const month = finiteField("#birth-month");
  const day = finiteField("#birth-day");
  const hour = finiteField("#birth-hour");
  const minute = finiteField("#birth-minute");
  if ([year, month, day, hour, minute].some(value => value === null)) return null;
  return { year, month, day, hour, minute, second: 0 };
}

function currentContext() {
  if (!form || !utcOffsetInput || utcOffsetInput.value.trim() === "") return null;
  const utcOffsetHours = Number(utcOffsetInput.value);
  const dayBoundary = form.elements.namedItem("day-boundary")?.value;
  if (!Number.isFinite(utcOffsetHours) || utcOffsetHours < -14 || utcOffsetHours > 14 || !dayBoundary) {
    return null;
  }
  return { utcOffsetHours, dayBoundary };
}

function clearLinks() {
  for (const node of Object.values(summaryNodes)) {
    const cell = node?.parentElement;
    if (cell) delete cell.dataset.href;
  }
  document.querySelector(".birth-projection-link a")?.removeAttribute("href");
}

export function updateBirthAtlasCrossView() {
  const input = currentInput();
  const context = currentContext();
  if (!input || !context) {
    clearLinks();
    return;
  }

  const common = {
    birthHref: window.location.href,
    input,
    ...context
  };

  for (const [key, node] of Object.entries(summaryNodes)) {
    const cell = node?.parentElement;
    if (!cell) continue;
    const href = birthAtlasLink({ ...common, inspect: key });
    if (!href) {
      delete cell.dataset.href;
      continue;
    }
    cell.dataset.href = href;
    cell.dataset.atlasInspect = key;
    const ganzhi = node.textContent.trim();
    cell.setAttribute("aria-label", `${summaryLabels[key]} ${ganzhi}，在時間圖譜開啟六十甲子 Reference`);
    cell.title = `在時間圖譜查看 ${ganzhi}`;
  }

  const annualLink = document.querySelector(".birth-projection-link a");
  const atlasHref = birthAtlasLink(common);
  if (annualLink && atlasHref) {
    annualLink.href = atlasHref;
    annualLink.dataset.atlasCrossView = "selected-instant";
  }
}

if (form) {
  form.addEventListener("input", updateBirthAtlasCrossView);
  form.addEventListener("change", updateBirthAtlasCrossView);
  updateBirthAtlasCrossView();
  queueMicrotask(updateBirthAtlasCrossView);
}
