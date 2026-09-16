import { sexagenaryCycle } from "./sexagenary-data.js";
import {
  GANZHI_PILLARS,
  ganzhiInspectorModel,
  normalizeGanzhiPillar
} from "./ganzhi-inspector-model.js";

const inspector = document.querySelector("#ganzhi-inspector");

if (inspector) {
  const triggers = [...document.querySelectorAll("[data-ganzhi-reference]")];
  const closeButton = inspector.querySelector("#ganzhi-inspector-close");
  const grid = inspector.querySelector("#ganzhi-inspector-grid");
  let activePillar = null;
  let lastTrigger = null;

  function setText(id, value) {
    const node = inspector.querySelector(`#${id}`);
    if (node) node.textContent = value;
  }

  function syncSearch(pillar) {
    const url = new URL(location.href);
    if (pillar) url.searchParams.set("inspect", pillar);
    else url.searchParams.delete("inspect");
    history.replaceState(history.state, "", url.href);
  }

  function updateTriggerState() {
    triggers.forEach(trigger => {
      const active = !inspector.hidden && trigger.dataset.ganzhiReference === activePillar;
      trigger.setAttribute("aria-expanded", String(active));
    });
  }

  function highlightGrid(index) {
    grid?.querySelectorAll("[data-cycle-index]").forEach(node => {
      const active = Number(node.dataset.cycleIndex) === index;
      node.classList.toggle("active", active);
      if (active) node.setAttribute("aria-current", "true");
      else node.removeAttribute("aria-current");
    });
  }

  function renderActive() {
    const config = activePillar ? GANZHI_PILLARS[activePillar] : null;
    if (!config) return false;
    const name = document.querySelector(`#${config.stateId}`)?.textContent?.trim() ?? "";
    const model = ganzhiInspectorModel(activePillar, name);
    inspector.dataset.pillar = activePillar;
    inspector.dataset.ganzhi = model?.name ?? "";
    inspector.dataset.ready = String(Boolean(model));
    setText("ganzhi-inspector-pillar", config.label);

    if (!model) {
      setText("ganzhi-inspector-title", "—");
      setText("ganzhi-inspector-ordinal", "— / 60");
      setText("ganzhi-inspector-stem", "—");
      setText("ganzhi-inspector-stem-meta", "等待目前柱位");
      setText("ganzhi-inspector-branch", "—");
      setText("ganzhi-inspector-branch-meta", "等待目前柱位");
      setText("ganzhi-inspector-previous", "—");
      setText("ganzhi-inspector-current", "—");
      setText("ganzhi-inspector-next", "—");
      highlightGrid(-1);
      return false;
    }

    setText("ganzhi-inspector-title", model.name);
    setText("ganzhi-inspector-ordinal", `${String(model.ordinal).padStart(2, "0")} / 60`);
    setText("ganzhi-inspector-stem", model.stem.name);
    setText(
      "ganzhi-inspector-stem-meta",
      `${model.stem.yinYang} · ${model.stem.element} · ${model.stem.phase} / ${model.stem.period}`
    );
    setText("ganzhi-inspector-branch", model.branch.name);
    setText(
      "ganzhi-inspector-branch-meta",
      `${model.branch.yinYang} · ${model.branch.element} · ${model.branch.phase} / ${model.branch.period}`
    );
    setText("ganzhi-inspector-previous", `← ${model.previous.name}`);
    setText("ganzhi-inspector-current", model.name);
    setText("ganzhi-inspector-next", `${model.next.name} →`);
    highlightGrid(model.index);
    return true;
  }

  function openInspector(pillar, { syncUrl = true, trigger = null } = {}) {
    const normalized = normalizeGanzhiPillar(pillar);
    if (!normalized) return false;
    activePillar = normalized;
    if (trigger) lastTrigger = trigger;
    inspector.hidden = false;
    inspector.dataset.open = "true";
    renderActive();
    updateTriggerState();
    if (syncUrl) syncSearch(normalized);
    return true;
  }

  function closeInspector({ syncUrl = true, restoreFocus = false } = {}) {
    if (inspector.hidden) return;
    inspector.hidden = true;
    inspector.dataset.open = "false";
    if (syncUrl) syncSearch(null);
    updateTriggerState();
    const focusTarget = restoreFocus ? lastTrigger : null;
    activePillar = null;
    if (focusTarget instanceof HTMLElement) focusTarget.focus();
  }

  if (grid) {
    const fragment = document.createDocumentFragment();
    sexagenaryCycle.forEach(item => {
      const cell = document.createElement("span");
      cell.dataset.cycleIndex = String(item.index);
      cell.innerHTML = `<small>${String(item.ordinal).padStart(2, "0")}</small><strong>${item.name}</strong>`;
      fragment.appendChild(cell);
    });
    grid.replaceChildren(fragment);
  }

  triggers.forEach(trigger => {
    trigger.addEventListener("click", () => {
      const pillar = trigger.dataset.ganzhiReference;
      if (!inspector.hidden && activePillar === pillar) {
        closeInspector({ restoreFocus: false });
        return;
      }
      openInspector(pillar, { trigger });
    });
  });

  closeButton?.addEventListener("click", () => closeInspector({ restoreFocus: true }));
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !inspector.hidden) {
      event.preventDefault();
      closeInspector({ restoreFocus: true });
    }
  });

  const observer = new MutationObserver(() => {
    if (!inspector.hidden && activePillar) renderActive();
  });
  Object.values(GANZHI_PILLARS).forEach(({ stateId }) => {
    const node = document.querySelector(`#${stateId}`);
    if (node) observer.observe(node, { childList: true, characterData: true, subtree: true });
  });

  const requestedPillar = normalizeGanzhiPillar(new URLSearchParams(location.search).get("inspect"));
  if (requestedPillar) {
    requestAnimationFrame(() => openInspector(requestedPillar, { syncUrl: false }));
  }
}
