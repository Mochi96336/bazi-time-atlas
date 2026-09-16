import { sexagenaryCycle } from "./sexagenary-data.js";
import {
  GANZHI_PILLARS,
  ganzhiInspectorModel,
  normalizeGanzhiPillar,
  sexagenaryReferenceByName
} from "./ganzhi-inspector-model.js";

const inspector = document.querySelector("#ganzhi-inspector");

if (inspector) {
  const triggers = [...document.querySelectorAll("[data-ganzhi-reference]")];
  const closeButton = inspector.querySelector("#ganzhi-inspector-close");
  const grid = inspector.querySelector("#ganzhi-inspector-grid");
  let activePillar = null;
  let activeReference = null;
  let lastTrigger = null;

  function setText(id, value) {
    const node = inspector.querySelector(`#${id}`);
    if (node) node.textContent = value;
  }

  function syncSearch() {
    const url = new URL(location.href);
    if (activePillar) url.searchParams.set("inspect", activePillar);
    else url.searchParams.delete("inspect");
    if (activeReference) url.searchParams.set("reference", activeReference);
    else url.searchParams.delete("reference");
    history.replaceState(history.state, "", url.href);
  }

  function updateTriggerState() {
    triggers.forEach(trigger => {
      const active = !inspector.hidden
        && activeReference === null
        && trigger.dataset.ganzhiReference === activePillar;
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
    const name = config
      ? document.querySelector(`#${config.stateId}`)?.textContent?.trim() ?? ""
      : activeReference ?? "";
    const model = config
      ? ganzhiInspectorModel(activePillar, name)
      : sexagenaryReferenceByName(name);
    const mode = config ? "pillar" : activeReference ? "reference" : "";
    if (!mode) return false;

    inspector.dataset.mode = mode;
    inspector.dataset.pillar = activePillar ?? "";
    inspector.dataset.ganzhi = model?.name ?? "";
    inspector.dataset.ready = String(Boolean(model));
    setText("ganzhi-inspector-pillar", config?.label ?? "六十甲子 reference");

    if (!model) {
      setText("ganzhi-inspector-title", "—");
      setText("ganzhi-inspector-ordinal", "— / 60");
      setText("ganzhi-inspector-stem", "—");
      setText("ganzhi-inspector-stem-meta", config ? "等待目前柱位" : "無效參考");
      setText("ganzhi-inspector-branch", "—");
      setText("ganzhi-inspector-branch-meta", config ? "等待目前柱位" : "無效參考");
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
    activeReference = null;
    if (trigger) lastTrigger = trigger;
    inspector.hidden = false;
    inspector.dataset.open = "true";
    renderActive();
    updateTriggerState();
    if (syncUrl) syncSearch();
    return true;
  }

  function openReference(name, { syncUrl = true } = {}) {
    const reference = sexagenaryReferenceByName(name);
    if (!reference) return false;
    activePillar = null;
    activeReference = reference.name;
    lastTrigger = null;
    inspector.hidden = false;
    inspector.dataset.open = "true";
    renderActive();
    updateTriggerState();
    if (syncUrl) syncSearch();
    return true;
  }

  function closeInspector({ syncUrl = true, restoreFocus = false } = {}) {
    if (inspector.hidden) return;
    inspector.hidden = true;
    inspector.dataset.open = "false";
    const focusTarget = restoreFocus ? lastTrigger : null;
    activePillar = null;
    activeReference = null;
    if (syncUrl) syncSearch();
    updateTriggerState();
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
      if (!inspector.hidden && activeReference === null && activePillar === pillar) {
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

  const params = new URLSearchParams(location.search);
  const requestedPillar = normalizeGanzhiPillar(params.get("inspect"));
  const requestedReference = sexagenaryReferenceByName(params.get("reference"))?.name ?? null;
  if (requestedPillar) {
    requestAnimationFrame(() => openInspector(requestedPillar, { syncUrl: false }));
  } else if (requestedReference) {
    requestAnimationFrame(() => openReference(requestedReference, { syncUrl: false }));
  }
}
