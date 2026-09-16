import { DAY_BOUNDARY } from "./calendar/day-boundary.js";
import { TIME_CONTEXT_COMMAND } from "./interaction/time-context-command.js";
import {
  DEFAULT_ATLAS_TIME_CONTEXT,
  normalizeAtlasTimeContext
} from "./wheel/atlas-time-context.js";

const instrument = document.querySelector("#kinetic-instrument");
const timeBasisHost = document.querySelector(".readout-meta span:last-child");
const timeBasisReadout = timeBasisHost?.querySelector("strong");

function installStyles() {
  if (document.querySelector("#time-context-control-style")) return;
  const style = document.createElement("style");
  style.id = "time-context-control-style";
  style.textContent = `
    #time-context-trigger {
      all: unset;
      display: inline;
      color: inherit;
      cursor: pointer;
      pointer-events: auto;
      text-decoration: underline;
      text-decoration-color: rgba(220,226,221,.28);
      text-decoration-thickness: 1px;
      text-underline-offset: 3px;
    }
    #time-context-trigger:hover { text-decoration-color: rgba(220,226,221,.64); }
    #time-context-trigger:focus-visible {
      outline: 1px solid rgba(244,230,183,.72);
      outline-offset: 3px;
      border-radius: 3px;
    }
    .time-context-popover {
      position: absolute;
      z-index: 7;
      left: 50%;
      bottom: 58px;
      transform: translateX(-50%);
      width: min(286px, calc(100% - 28px));
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr) auto;
      gap: 8px;
      align-items: end;
      padding: 10px;
      border: 1px solid rgba(238,242,237,.14);
      border-radius: 13px;
      background: rgba(12,16,13,.96);
      box-shadow: 0 14px 34px rgba(0,0,0,.34);
      pointer-events: auto;
      text-align: left;
    }
    .time-context-popover[hidden] { display: none; }
    .time-context-popover label {
      min-width: 0;
      display: grid;
      gap: 4px;
      color: #768078;
      font-size: 8px;
      letter-spacing: .05em;
    }
    .time-context-popover input,
    .time-context-popover select {
      min-width: 0;
      width: 100%;
      height: 32px;
      box-sizing: border-box;
      border: 1px solid rgba(238,242,237,.14);
      border-radius: 8px;
      padding: 0 7px;
      color: #dce2dd;
      background: #111512;
      color-scheme: dark;
      font: inherit;
      font-size: 10px;
    }
    .time-context-popover button {
      height: 32px;
      border: 1px solid rgba(244,230,183,.58);
      border-radius: 8px;
      padding: 0 10px;
      color: #171b18;
      background: #e7dbb6;
      font-size: 9px;
      font-weight: 780;
      cursor: pointer;
    }
    @media (max-width: 480px) {
      .time-context-popover {
        bottom: 56px;
        width: min(272px, calc(100% - 22px));
        grid-template-columns: .8fr 1.2fr auto;
        gap: 6px;
        padding: 8px;
      }
      .time-context-popover input,
      .time-context-popover select,
      .time-context-popover button { height: 30px; }
    }
  `;
  document.head.appendChild(style);
}

function currentContext() {
  if (!instrument) return DEFAULT_ATLAS_TIME_CONTEXT;
  try {
    return normalizeAtlasTimeContext({
      utcOffsetHours:Number(instrument.dataset.utcOffsetHours ?? DEFAULT_ATLAS_TIME_CONTEXT.utcOffsetHours),
      dayBoundary:instrument.dataset.dayBoundary ?? DEFAULT_ATLAS_TIME_CONTEXT.dayBoundary
    });
  } catch {
    return DEFAULT_ATLAS_TIME_CONTEXT;
  }
}

if (instrument && timeBasisHost && timeBasisReadout) {
  installStyles();

  const trigger = document.createElement("button");
  trigger.id = "time-context-trigger";
  trigger.type = "button";
  trigger.setAttribute("aria-expanded", "false");
  trigger.setAttribute("aria-controls", "time-context-popover");
  trigger.title = "調整固定 UTC offset 與換日規則";
  timeBasisReadout.replaceWith(trigger);
  trigger.appendChild(timeBasisReadout);

  const panel = document.createElement("form");
  panel.id = "time-context-popover";
  panel.className = "time-context-popover";
  panel.hidden = true;
  panel.setAttribute("aria-label", "時間基準設定");
  panel.innerHTML = `
    <label>UTC offset
      <input id="time-context-utc" type="number" min="-14" max="14" step="0.25" inputmode="decimal">
    </label>
    <label>換日
      <select id="time-context-boundary">
        <option value="${DAY_BOUNDARY.ZI_INITIAL_NEXT_DAY}">23:00 子初</option>
        <option value="${DAY_BOUNDARY.CIVIL_MIDNIGHT}">00:00 午夜</option>
      </select>
    </label>
    <button id="time-context-apply" type="submit">套用</button>
  `;
  instrument.appendChild(panel);

  const utcInput = panel.querySelector("#time-context-utc");
  const boundarySelect = panel.querySelector("#time-context-boundary");

  function syncFields() {
    const context = currentContext();
    utcInput.value = String(context.utcOffsetHours);
    boundarySelect.value = context.dayBoundary;
  }

  function closePanel() {
    panel.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
  }

  function openPanel() {
    syncFields();
    panel.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
    queueMicrotask(() => utcInput.focus({ preventScroll:true }));
  }

  trigger.addEventListener("click", () => {
    if (panel.hidden) openPanel();
    else closePanel();
  });

  panel.addEventListener("submit", event => {
    event.preventDefault();
    let timeContext;
    try {
      timeContext = normalizeAtlasTimeContext({
        utcOffsetHours:Number(utcInput.value),
        dayBoundary:boundarySelect.value
      });
    } catch {
      utcInput.setAttribute("aria-invalid", "true");
      return;
    }
    utcInput.removeAttribute("aria-invalid");
    instrument.dispatchEvent(new CustomEvent(TIME_CONTEXT_COMMAND, {
      detail:{ timeContext, source:"time-context-popover" }
    }));
    closePanel();
  });

  utcInput.addEventListener("input", () => utcInput.removeAttribute("aria-invalid"));
  document.addEventListener("pointerdown", event => {
    if (panel.hidden || panel.contains(event.target) || trigger.contains(event.target)) return;
    closePanel();
  });
  document.addEventListener("keydown", event => {
    if (event.key !== "Escape" || panel.hidden) return;
    closePanel();
    trigger.focus({ preventScroll:true });
  });

  instrument.dataset.timeContextControl = "popover";
}
