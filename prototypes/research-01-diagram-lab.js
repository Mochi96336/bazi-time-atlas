import { recurrenceState } from "../src/recurrence/gregorian-cycle.js";

const BASE_DATE = Object.freeze({ year:2026, month:9, day:13 });
const DELTAS = Object.freeze([400,1200,8000,1980,24000]);
const states = new Map(DELTAS.map(delta => [delta,recurrenceState(BASE_DATE,delta)]));

function signedPhase(value,period) {
  const half = period / 2;
  return value > half ? value - period : value;
}

function formatSigned(value) {
  if (value === 0) return "0";
  return value > 0 ? `+${value}` : `−${Math.abs(value)}`;
}

function phaseText(state,{ signedGregorian=false } = {}) {
  const gregorian = signedGregorian
    ? formatSigned(signedPhase(state.phases.gregorian,400))
    : state.phases.gregorian;
  return `公 ${gregorian} · 年 ${state.phases.yearSequence} · 日 ${state.phases.day}`;
}

function renderStructuralContext(root) {
  root.querySelectorAll(".structural-context [data-milestone]").forEach(article => {
    const delta = Number.parseInt(article.dataset.milestone,10);
    const state = states.get(delta);
    if (!state) return;
    const line = article.querySelector("p");
    if (line) line.textContent = phaseText(state);
  });
}

function renderState(root,delta) {
  const state = states.get(delta);
  const article = root.querySelector(`.ladder-state[data-milestone="${delta}"]`);
  if (!state || !article) return;

  for (const name of ["gregorian","yearSequence","day"]) {
    const slot = article.querySelector(`[data-phase="${name}"]`);
    if (!slot) continue;
    const raw = state.phases[name];
    const value = name === "gregorian"
      ? signedPhase(raw,400)
      : raw;
    slot.dataset.open = String(value !== 0);
    slot.querySelector("b").textContent = formatSigned(value);
  }
}

function renderTracks(root) {
  const local = states.get(1980);
  const global = states.get(24000);
  const periods = { gregorian:400, yearSequence:60, day:60 };

  for (const name of Object.keys(periods)) {
    const track = root.querySelector(`.phase-track[data-track="${name}"]`);
    if (!track) continue;

    const localValue = signedPhase(local.phases[name],periods[name]);
    const localPoint = track.querySelector('[data-track-point="local"]');
    const globalPoint = track.querySelector('[data-track-point="global"]');
    const residualWindow = name === "gregorian" ? 60 : 12;
    const offset = Math.min(Math.abs(localValue),residualWindow) / residualWindow;
    const position = 100 - offset * 54;

    localPoint?.style.setProperty("--local-position",position.toFixed(2) + "%");
    const localSmall = localPoint?.querySelector("small");
    if (localSmall) localSmall.textContent = formatSigned(localValue);

    const globalValue = signedPhase(global.phases[name],periods[name]);
    const globalSmall = globalPoint?.querySelector("small");
    if (globalSmall) globalSmall.textContent = formatSigned(globalValue);
  }
}

function renderOrigin(root) {
  const local = states.get(1980);
  const global = states.get(24000);
  const localGregorian = formatSigned(signedPhase(local.phases.gregorian,400));

  root.querySelector("#origin-local-gregorian").textContent = localGregorian;

  const localCopy = root.querySelector('.origin-state[data-milestone="1980"] p');
  if (localCopy) {
    localCopy.textContent =
      `年序 ${local.phases.yearSequence} · 日序 ${local.phases.day} · 季節代理 ${localGregorian}`;
  }

  const globalCopy = root.querySelector('.origin-state[data-milestone="24000"] p');
  if (globalCopy) {
    globalCopy.textContent =
      `年序 ${global.phases.yearSequence} · 日序 ${global.phases.day} · 季節代理 ${global.phases.gregorian}`;
  }
}

const params = new URLSearchParams(location.search);
const requested = params.get("direction") ?? "ladder";
const allowed = new Set(["ladder","tracks","origin"]);
const direction = allowed.has(requested) ? requested : "ladder";

document.querySelectorAll(".diagram-direction").forEach(section => {
  section.classList.toggle("is-active",section.dataset.direction === direction);
});

document.querySelectorAll("[data-direction-link]").forEach(link => {
  const active = link.dataset.directionLink === direction;
  link.classList.toggle("is-active",active);
  if (active) link.setAttribute("aria-current","page");
});

renderStructuralContext(document);
renderState(document,1980);
renderState(document,24000);
renderTracks(document);
renderOrigin(document);

const localGregorian = formatSigned(signedPhase(states.get(1980).phases.gregorian,400));
document.querySelector("#ladder-local-gregorian").textContent = localGregorian;

document.documentElement.dataset.diagramLabReady = "true";
document.documentElement.dataset.diagramDirection = direction;
