import "./annual-deep-link.js";
import { hiddenStemsForBranch } from "./calendar/hidden-stems.js";

const inspector = document.querySelector("#inspector");
const readingNotes = inspector?.querySelector(".reading-notes");
const params = new URLSearchParams(window.location.search);
const openFromQuery = params.get("hidden") === "1";

let panel;
let summaryValue;
let chipHost;
let note;

function ensurePanel() {
  if (panel || !inspector) return panel;

  panel = document.createElement("details");
  panel.id = "hidden-stems-panel";
  panel.className = "hidden-stems-panel";
  panel.hidden = true;

  const summary = document.createElement("summary");
  const label = document.createElement("span");
  label.textContent = "藏干";
  summaryValue = document.createElement("strong");
  summaryValue.textContent = "";
  const hint = document.createElement("small");
  hint.textContent = "展開地支內部結構";
  summary.append(label, summaryValue, hint);

  const body = document.createElement("div");
  body.className = "hidden-stems-body";
  chipHost = document.createElement("div");
  chipHost.className = "hidden-stems-chips";
  note = document.createElement("p");
  note.textContent = "依約定順序列出主、次、餘藏；順序不代表固定百分比，藏干也不是額外的明干。";
  body.append(chipHost, note);
  panel.append(summary, body);

  if (readingNotes) readingNotes.insertAdjacentElement("beforebegin", panel);
  else inspector.appendChild(panel);
  return panel;
}

function hidePanel() {
  if (!panel) return;
  panel.hidden = true;
  panel.removeAttribute("data-hidden-branch");
}

function renderBranch(branch, forceOpen = false) {
  ensurePanel();
  if (!panel) return;

  const wasOpen = panel.open;
  const stems = hiddenStemsForBranch(branch);
  panel.hidden = false;
  panel.dataset.hiddenBranch = branch;
  summaryValue.textContent = `${branch} · ${stems.map(item => item.name).join(" ")}`;
  chipHost.replaceChildren();

  for (const stem of stems) {
    const item = document.createElement("span");
    item.className = `hidden-stem-chip element-${stem.element}`;
    item.dataset.hiddenStem = stem.name;
    item.dataset.hiddenRole = stem.role;
    item.innerHTML = `<i>${stem.role}</i><strong>${stem.name}</strong><small>${stem.yinYang}${stem.element}</small>`;
    chipHost.appendChild(item);
  }

  panel.open = forceOpen || wasOpen;
  panel.setAttribute(
    "aria-label",
    `${branch}支藏干：${stems.map(item => `${item.role}${item.name}`).join("、")}`
  );
}

function selectedMonthBranch() {
  return document.querySelector(
    '#atlas-wheel [data-select-type="month"].is-selected'
  )?.dataset.selectKey ?? null;
}

function syncFromSelection(forceOpen = false) {
  const branch = selectedMonthBranch();
  if (branch) renderBranch(branch, forceOpen);
  else hidePanel();
}

ensurePanel();
syncFromSelection(openFromQuery);

document.addEventListener("click", event => {
  const target = event.target instanceof Element ? event.target : null;
  if (!target) return;

  const selectable = target.closest("[data-select-type]");
  const layerToggle = target.closest("[data-toggle-layer]");
  if (!selectable && !layerToggle) return;

  queueMicrotask(() => {
    if (layerToggle?.dataset.toggleLayer === "months" && layerToggle.getAttribute("aria-pressed") === "false") {
      hidePanel();
      return;
    }
    syncFromSelection(false);
  });
});

document.addEventListener("keydown", event => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const target = event.target instanceof Element ? event.target.closest("[data-select-type]") : null;
  if (!target) return;
  queueMicrotask(() => syncFromSelection(false));
});
