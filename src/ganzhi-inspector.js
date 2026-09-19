import { atlasStructureInspectorState } from "./atlas-structure-inspector-model.js";
import { sexagenaryCycle } from "./sexagenary-data.js";
import {
  GANZHI_PILLARS,
  ganzhiInspectorModel,
  normalizeGanzhiPillar,
  sexagenaryReferenceByName
} from "./ganzhi-inspector-model.js";

const inspector = document.querySelector("#ganzhi-inspector");
const instrument = document.querySelector("#kinetic-instrument");

if (inspector) {
  const triggers = [...document.querySelectorAll("[data-ganzhi-reference]")];
  const closeButton = inspector.querySelector("#ganzhi-inspector-close");
  const grid = inspector.querySelector("#ganzhi-inspector-grid");
  const headerKicker = inspector.querySelector(".ganzhi-inspector-head span");
  let activePillar = null;
  let activeReference = null;
  let activeStructureTab = "basic";
  let lastTrigger = null;

  const pillarLabels = Object.freeze({
    year: "年柱",
    month: "月柱",
    day: "日柱",
    hour: "時柱"
  });

  function node(tag, className = null, text = null) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== null) element.textContent = text;
    return element;
  }

  function createStructureShell() {
    const shell = node("section", "ganzhi-structure");
    shell.id = "ganzhi-structure";
    shell.hidden = true;
    shell.dataset.ready = "false";
    shell.dataset.activeTab = "basic";
    shell.setAttribute("aria-label", "四柱結構檢視");

    const tabs = node("div", "ganzhi-structure-tabs");
    tabs.setAttribute("role", "tablist");
    tabs.setAttribute("aria-label", "四柱結構分頁");
    for (const [key, label] of [["basic", "基本"], ["ten-gods", "十神"], ["relations", "關係"]]) {
      const button = node("button", "ganzhi-structure-tab", label);
      button.type = "button";
      button.dataset.structureTab = key;
      button.id = `ganzhi-structure-tab-${key}`;
      button.setAttribute("role", "tab");
      button.setAttribute("aria-controls", `ganzhi-structure-panel-${key}`);
      button.setAttribute("aria-selected", String(key === "basic"));
      button.tabIndex = key === "basic" ? 0 : -1;
      tabs.append(button);
    }

    const panels = node("div", "ganzhi-structure-panels");
    for (const key of ["basic", "ten-gods", "relations"]) {
      const panel = node("section", "ganzhi-structure-panel");
      panel.id = `ganzhi-structure-panel-${key}`;
      panel.dataset.structurePanel = key;
      panel.setAttribute("role", "tabpanel");
      panel.setAttribute("aria-labelledby", `ganzhi-structure-tab-${key}`);
      panel.hidden = key !== "basic";
      panels.append(panel);
    }

    shell.append(tabs, panels);
    inspector.querySelector(".ganzhi-inspector-parts")?.after(shell);
    return shell;
  }

  const structureShell = createStructureShell();
  const structureTabs = [...structureShell.querySelectorAll("[data-structure-tab]")];

  function setText(id, value) {
    const target = inspector.querySelector(`#${id}`);
    if (target) target.textContent = value;
  }

  function pillarInput() {
    return {
      yearPillar: document.querySelector("#state-year")?.textContent?.trim() ?? "",
      monthPillar: document.querySelector("#state-month")?.textContent?.trim() ?? "",
      dayPillar: document.querySelector("#state-day")?.textContent?.trim() ?? "",
      hourPillar: document.querySelector("#state-hour")?.textContent?.trim() ?? ""
    };
  }

  function syncStructureTabs() {
    structureShell.dataset.activeTab = activeStructureTab;
    inspector.dataset.structureTab = activeStructureTab;
    structureTabs.forEach(tab => {
      const active = tab.dataset.structureTab === activeStructureTab;
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
      tab.classList.toggle("active", active);
    });
    structureShell.querySelectorAll("[data-structure-panel]").forEach(panel => {
      panel.hidden = panel.dataset.structurePanel !== activeStructureTab;
    });
  }

  function activateStructureTab(key, { focus = false } = {}) {
    if (!activePillar) return false;
    const tab = structureTabs.find(candidate => candidate.dataset.structureTab === key);
    if (!tab) return false;
    activeStructureTab = key;
    syncStructureTabs();
    if (focus) tab.focus();
    return true;
  }

  function pillarContextRow(model, selectedKey) {
    const row = node("div", "ganzhi-structure-pillar-row");
    for (const pillar of model.pillars) {
      const card = node("article", "ganzhi-structure-pillar");
      card.dataset.pillar = pillar.key;
      card.dataset.selected = String(pillar.key === selectedKey);
      card.append(
        node("small", null, pillar.label),
        node("strong", null, pillar.name)
      );
      row.append(card);
    }
    return row;
  }

  function hiddenStemStrip(pillar) {
    const block = node("div", "ganzhi-structure-hidden");
    block.append(node("small", null, `${pillar.branch}藏干`));
    const chips = node("div", "ganzhi-structure-chips");
    for (const hidden of pillar.hiddenStems) {
      const chip = node("span", "ganzhi-structure-chip");
      chip.dataset.hiddenStem = hidden.name;
      chip.dataset.tenGod = hidden.tenGod.name;
      chip.append(
        node("i", null, hidden.role),
        node("b", null, hidden.name),
        node("strong", null, hidden.tenGod.name)
      );
      chips.append(chip);
    }
    block.append(chips);
    return block;
  }

  function renderBasic(model) {
    const panel = structureShell.querySelector('[data-structure-panel="basic"]');
    if (!panel) return;
    const selected = model.pillars.find(pillar => pillar.key === activePillar) ?? model.pillars[0];
    const dayMaster = node("div", "ganzhi-structure-day-master");
    dayMaster.append(
      node("small", null, "日主"),
      node("strong", null, `${model.dayMaster} · ${model.dayMasterMeta.yinYang}${model.dayMasterMeta.element}`)
    );
    panel.replaceChildren(
      dayMaster,
      pillarContextRow(model, activePillar),
      hiddenStemStrip(selected)
    );
  }

  function renderTenGods(model) {
    const panel = structureShell.querySelector('[data-structure-panel="ten-gods"]');
    if (!panel) return;
    const list = node("div", "ganzhi-ten-god-list");
    for (const pillar of model.pillars) {
      const row = node("article", "ganzhi-ten-god-row");
      row.dataset.pillar = pillar.key;
      row.append(
        node("small", null, pillar.label),
        node("b", null, pillar.name),
        node("strong", null, pillar.visibleStem.tenGod),
        node(
          "span",
          null,
          pillar.key === "day"
            ? `${pillar.visibleStem.relation.name} · ${pillar.visibleStem.relation.groupLabel}`
            : `${pillar.visibleStem.relation.groupLabel} · ${pillar.visibleStem.relation.samePolarity ? "同陰陽" : "異陰陽"}`
        ),
        hiddenStemStrip(pillar)
      );
      list.append(row);
    }

    const derivation = node("details", "ganzhi-ten-god-derivation");
    derivation.append(node("summary", null, "十神推導"));
    const map = node("div", "ganzhi-ten-god-map");
    for (const group of model.tenGodDerivation) {
      const row = node("div", "ganzhi-ten-god-map-row");
      row.append(
        node("small", null, group.groupLabel),
        node("span", null, `${group.targetElement} · 同陰陽 ${group.same.name} · 異陰陽 ${group.opposite.name}`)
      );
      map.append(row);
    }
    derivation.append(map);
    panel.replaceChildren(list, derivation);
  }

  function relationSection(title, entries, formatter) {
    const section = node("section", "ganzhi-relation-family");
    section.append(node("small", null, title));
    if (entries.length === 0) {
      section.append(node("span", "ganzhi-relation-empty", "無"));
      return section;
    }
    const list = node("div", "ganzhi-relation-list");
    for (const entry of entries) {
      const item = node("div", "ganzhi-relation-item");
      const { label, detail } = formatter(entry);
      item.append(node("strong", null, label), node("span", null, detail));
      list.append(item);
    }
    section.append(list);
    return section;
  }

  function formatPunishment(event) {
    if (event.kind === "mutual") {
      return {
        label: event.label,
        detail: `${pillarLabels[event.left.pillar]} ${event.left.branch} ↔ ${pillarLabels[event.right.pillar]} ${event.right.branch}`
      };
    }
    if (event.kind === "directed") {
      return {
        label: event.label,
        detail: `${pillarLabels[event.source.pillar]} ${event.source.branch} → ${pillarLabels[event.target.pillar]} ${event.target.branch}`
      };
    }
    return {
      label: event.label,
      detail: `${event.branch} · ${event.supports.map(key => pillarLabels[key]).join(" / ")}`
    };
  }

  function renderRelations(model) {
    const panel = structureShell.querySelector('[data-structure-panel="relations"]');
    if (!panel) return;
    panel.dataset.relationFamilies = "3";
    panel.replaceChildren(
      relationSection("明干／地支成對關係", model.relations.pairs, relation => ({
        label: relation.label,
        detail: `${pillarLabels[relation.left.pillar]} ${relation.left.value} ↔ ${pillarLabels[relation.right.pillar]} ${relation.right.value}`
      })),
      relationSection("完整三支", model.relations.groups, group => ({
        label: group.label,
        detail: `${group.members.join("·")} · ${group.element}${group.season ? ` · ${group.season}` : ""}`
      })),
      relationSection("刑", model.relations.punishments, formatPunishment)
    );
  }

  function renderStructure() {
    if (!activePillar) {
      structureShell.hidden = true;
      structureShell.dataset.ready = "false";
      inspector.dataset.structureReady = "false";
      return false;
    }
    structureShell.hidden = false;
    const model = atlasStructureInspectorState(pillarInput());
    const ready = Boolean(model);
    structureShell.dataset.ready = String(ready);
    inspector.dataset.structureReady = String(ready);
    if (!model) {
      for (const panel of structureShell.querySelectorAll("[data-structure-panel]")) {
        panel.replaceChildren(node("span", "ganzhi-structure-wait", "等待四柱資料"));
      }
      syncStructureTabs();
      return false;
    }
    renderBasic(model);
    renderTenGods(model);
    renderRelations(model);
    syncStructureTabs();
    return true;
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
    grid?.querySelectorAll("[data-cycle-index]").forEach(target => {
      const active = Number(target.dataset.cycleIndex) === index;
      target.classList.toggle("active", active);
      if (active) target.setAttribute("aria-current", "true");
      else target.removeAttribute("aria-current");
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
    if (headerKicker) headerKicker.textContent = config ? "四柱結構" : "六十甲子 reference";
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
      renderStructure();
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
    renderStructure();
    return true;
  }

  function openInspector(pillar, { syncUrl = true, trigger = null } = {}) {
    const normalized = normalizeGanzhiPillar(pillar);
    if (!normalized) return false;
    const wasClosed = inspector.hidden;
    activePillar = normalized;
    activeReference = null;
    if (wasClosed) activeStructureTab = "basic";
    if (trigger) lastTrigger = trigger;
    inspector.hidden = false;
    inspector.dataset.open = "true";
    if (instrument) instrument.dataset.ganzhiInspectorOpen = "true";
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
    activeStructureTab = "basic";
    lastTrigger = null;
    inspector.hidden = false;
    inspector.dataset.open = "true";
    if (instrument) instrument.dataset.ganzhiInspectorOpen = "true";
    renderActive();
    updateTriggerState();
    if (syncUrl) syncSearch();
    return true;
  }

  function closeInspector({ syncUrl = true, restoreFocus = false } = {}) {
    if (inspector.hidden) return;
    inspector.hidden = true;
    inspector.dataset.open = "false";
    if (instrument) instrument.dataset.ganzhiInspectorOpen = "false";
    const focusTarget = restoreFocus ? lastTrigger : null;
    activePillar = null;
    activeReference = null;
    activeStructureTab = "basic";
    renderStructure();
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

  structureTabs.forEach((tab, index) => {
    tab.addEventListener("click", () => {
      activateStructureTab(tab.dataset.structureTab ?? "basic");
    });
    tab.addEventListener("keydown", event => {
      if (!activePillar) return;
      let targetIndex = null;
      if (event.key === "ArrowRight") targetIndex = (index + 1) % structureTabs.length;
      else if (event.key === "ArrowLeft") targetIndex = (index - 1 + structureTabs.length) % structureTabs.length;
      else if (event.key === "Home") targetIndex = 0;
      else if (event.key === "End") targetIndex = structureTabs.length - 1;
      if (targetIndex === null) return;
      event.preventDefault();
      activateStructureTab(structureTabs[targetIndex].dataset.structureTab ?? "basic", { focus: true });
    });
  });

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

  document.addEventListener("atlas-ganzhi-inspect", event => {
    const pillar = event?.detail?.pillar;
    if (!pillar) return;
    openInspector(pillar, { trigger:null });
  });

  closeButton?.addEventListener("click", () => closeInspector({ restoreFocus: true }));
  document.addEventListener("atlas-tools-closing", () => {
    closeInspector({ restoreFocus: false });
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !inspector.hidden) {
      event.preventDefault();
      event.stopImmediatePropagation();
      closeInspector({ restoreFocus: true });
    }
  });

  const observer = new MutationObserver(() => {
    if (!inspector.hidden && activePillar) renderActive();
  });
  Object.values(GANZHI_PILLARS).forEach(({ stateId }) => {
    const target = document.querySelector(`#${stateId}`);
    if (target) observer.observe(target, { childList: true, characterData: true, subtree: true });
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