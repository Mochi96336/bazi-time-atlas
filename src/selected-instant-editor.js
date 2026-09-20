import {
  atlasInputValueFromFields,
  civilFieldsFromInstant,
  instantFromAtlasLocalInput
} from "./wheel/atlas-display-model.js";
import {
  formatAtlasUtcOffset,
  normalizeAtlasTimeContext
} from "./wheel/atlas-time-context.js";
import { SELECTED_INSTANT_COMMAND } from "./interaction/selected-instant-command.js";

const DESKTOP_QUERY = "(min-width: 821px)";

function canonicalInputValue(value) {
  if (typeof value !== "string") return "";
  return /^\d{4,6}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) ? `${value}:00` : value;
}

function contextFromInstrument(instrument) {
  return normalizeAtlasTimeContext({
    utcOffsetHours:Number(instrument?.dataset.utcOffsetHours),
    dayBoundary:instrument?.dataset.dayBoundary
  });
}

export function installSelectedInstantEditor(
  instrument = document.querySelector("#kinetic-instrument"),
  documentRef = document
) {
  if (!instrument) return null;
  const readoutShell = instrument.querySelector(".instrument-readout");
  const readout = instrument.querySelector("#instant-readout");
  if (!readoutShell || !readout) return null;

  const existing = readoutShell.querySelector("#selected-instant-editor");
  if (existing) return null;

  const form = documentRef.createElement("form");
  form.id = "selected-instant-editor";
  form.className = "selected-instant-editor";
  form.hidden = true;
  form.setAttribute("aria-label", "修改選定時間");
  form.innerHTML = `
    <label class="selected-instant-editor-field">
      <span>選定時間</span>
      <input type="datetime-local" step="1" data-selected-instant-editor-input aria-label="選定時間，秒級">
    </label>
    <small data-selected-instant-editor-basis>—</small>
    <span class="selected-instant-editor-status" data-selected-instant-editor-status aria-live="polite"></span>
    <div class="selected-instant-editor-actions">
      <button type="button" data-selected-instant-editor-cancel>取消</button>
      <button type="submit" data-selected-instant-editor-apply>套用</button>
    </div>
  `;
  readout.insertAdjacentElement("afterend", form);

  const input = form.querySelector("[data-selected-instant-editor-input]");
  const basis = form.querySelector("[data-selected-instant-editor-basis]");
  const status = form.querySelector("[data-selected-instant-editor-status]");
  const cancel = form.querySelector("[data-selected-instant-editor-cancel]");
  const media = documentRef.defaultView?.matchMedia?.(DESKTOP_QUERY) ?? null;
  let open = false;

  function currentContext() {
    try {
      return contextFromInstrument(instrument);
    } catch {
      return null;
    }
  }

  function syncInput() {
    const selectedMs = Number(instrument.dataset.selectedInstantMs);
    const context = currentContext();
    if (!Number.isFinite(selectedMs) || !context) {
      input.value = "";
      basis.textContent = "時間基準不可用";
      return false;
    }
    const fields = civilFieldsFromInstant(selectedMs, context);
    input.value = atlasInputValueFromFields(fields);
    const offset = formatAtlasUtcOffset(context.utcOffsetHours);
    basis.textContent = context.dayBoundary === "civil-midnight"
      ? `${offset} · 00:00 換日`
      : offset;
    input.setAttribute("aria-label", `選定時間，${offset}，秒級`);
    return true;
  }

  function available() {
    const desktop = media ? media.matches : true;
    return desktop
      && instrument.dataset.inverseTimeSearch !== "active";
  }

  function syncAvailability() {
    const enabled = available();
    readoutShell.dataset.instantEditorAvailable = String(enabled);
    if (enabled) {
      readout.setAttribute("role", "button");
      readout.setAttribute("tabindex", "0");
      readout.setAttribute("aria-controls", form.id);
      readout.setAttribute("aria-expanded", String(open));
      readout.title = "修改選定時間";
    } else {
      readout.removeAttribute("role");
      readout.removeAttribute("tabindex");
      readout.removeAttribute("aria-controls");
      readout.removeAttribute("aria-expanded");
      readout.removeAttribute("title");
      if (open) closeEditor({ restoreFocus:false });
    }
  }

  function openEditor() {
    if (!available() || !syncInput()) return false;
    open = true;
    form.hidden = false;
    form.dataset.state = "editing";
    instrument.dataset.instantEditorOpen = "true";
    readoutShell.dataset.instantEditorOpen = "true";
    readout.setAttribute("aria-expanded", "true");
    status.textContent = "";
    status.dataset.state = "idle";
    input.focus();
    input.select?.();
    return true;
  }

  function closeEditor({ restoreFocus = true } = {}) {
    if (!open) return false;
    open = false;
    form.hidden = true;
    form.dataset.state = "idle";
    instrument.dataset.instantEditorOpen = "false";
    readoutShell.dataset.instantEditorOpen = "false";
    readout.setAttribute("aria-expanded", "false");
    status.textContent = "";
    status.dataset.state = "idle";
    syncInput();
    if (restoreFocus && available()) readout.focus();
    return true;
  }

  function applyEditor() {
    const context = currentContext();
    const raw = canonicalInputValue(input.value);
    const instantMs = context ? instantFromAtlasLocalInput(raw, context) : null;
    if (!context || instantMs === null || !Number.isFinite(instantMs)) {
      status.textContent = "日期或時間無效";
      status.dataset.state = "error";
      return false;
    }

    const roundTrip = atlasInputValueFromFields(civilFieldsFromInstant(instantMs, context));
    if (roundTrip !== raw) {
      status.textContent = "日期或時間無效";
      status.dataset.state = "error";
      return false;
    }

    instrument.dispatchEvent(new CustomEvent(SELECTED_INSTANT_COMMAND, {
      bubbles:true,
      detail:{ instantMs, source:"readout-inline" }
    }));
    closeEditor({ restoreFocus:true });
    return true;
  }

  readout.addEventListener("click", () => {
    if (!available()) return;
    if (open) closeEditor({ restoreFocus:true });
    else openEditor();
  });
  readout.addEventListener("keydown", event => {
    if (!available() || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    if (open) closeEditor({ restoreFocus:true });
    else openEditor();
  });
  input.addEventListener("input", () => {
    status.textContent = "";
    status.dataset.state = "idle";
  });
  form.addEventListener("submit", event => {
    event.preventDefault();
    applyEditor();
  });
  cancel.addEventListener("click", () => closeEditor({ restoreFocus:true }));

  documentRef.addEventListener("keydown", event => {
    if (event.key !== "Escape" || !open) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    closeEditor({ restoreFocus:true });
  });

  instrument.addEventListener("atlas-tools-closing", () => closeEditor({ restoreFocus:false }));
  instrument.addEventListener("atlas-find-time-entering", () => closeEditor({ restoreFocus:false }));

  const observer = new MutationObserver(() => {
    if (open && documentRef.activeElement !== input) syncInput();
    syncAvailability();
  });
  observer.observe(instrument, {
    attributes:true,
    attributeFilter:[
      "data-analysis-open",
      "data-inverse-time-search",
      "data-selected-instant-ms",
      "data-utc-offset-hours",
      "data-day-boundary"
    ]
  });
  media?.addEventListener?.("change", syncAvailability);

  instrument.dataset.instantEditorOpen = "false";
  readoutShell.dataset.instantEditorOpen = "false";
  syncInput();
  syncAvailability();

  return Object.freeze({
    open:openEditor,
    close:closeEditor,
    apply:applyEditor,
    sync:syncInput,
    get isOpen() { return open; }
  });
}
