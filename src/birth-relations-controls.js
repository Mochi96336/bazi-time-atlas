const form = document.querySelector("#birth-form");
const panel = document.querySelector("#pillar-relations-panel");
const count = panel?.querySelector(".pillar-relations-count");
const intro = panel?.querySelector(".pillar-relations-intro");
const graphWrap = panel?.querySelector(".pillar-relations-graph-wrap");
const pairEmpty = panel?.querySelector(".pillar-relations-empty");
const pairList = panel?.querySelector(".pillar-relations-list");
const groupsBand = panel?.querySelector(".pillar-groups-band");
const punishmentsBand = panel?.querySelector("#pillar-punishments-band");

const layerConfig = {
  pair: { label: "PAIR" },
  group: { label: "三支" },
  punishment: { label: "刑" }
};

let manual = false;
let active = new Set();
let bar;
const buttons = new Map();

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function counts() {
  return {
    pair: Number(count?.dataset.relationCount ?? 0),
    group: Number(count?.dataset.groupCount ?? 0),
    punishment: Number(count?.dataset.punishmentCount ?? 0)
  };
}

function install() {
  if (!form || !panel || !count || !intro || !graphWrap || !pairEmpty || !pairList || !groupsBand || !punishmentsBand) {
    return false;
  }

  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = "./relation-controls.css";
  stylesheet.dataset.relationControlsStyles = "1";
  document.head.append(stylesheet);

  bar = node("div", "relation-layer-bar");
  bar.dataset.relationControls = "1";
  bar.setAttribute("aria-label", "四柱關係圖層");

  for (const [key, config] of Object.entries(layerConfig)) {
    const button = node("button", "relation-layer-toggle");
    button.type = "button";
    button.dataset.relationLayer = key;
    button.setAttribute("aria-pressed", "false");
    const label = node("span", null, config.label);
    const value = node("b", null, "0");
    button.append(label, value);
    button.addEventListener("click", () => {
      manual = true;
      if (active.has(key)) active.delete(key);
      else active.add(key);
      render();
    });
    buttons.set(key, { button, value });
    bar.append(button);
  }

  intro.insertAdjacentElement("afterend", bar);
  return true;
}

function autoSelect(currentCounts) {
  if (manual) return;
  active = new Set(Object.keys(layerConfig).filter(key => currentCounts[key] > 0));
  if (active.size === 0) active.add("pair");
}

function render() {
  const currentCounts = counts();
  autoSelect(currentCounts);

  for (const [key, refs] of buttons) {
    const isActive = active.has(key);
    refs.button.classList.toggle("active", isActive);
    refs.button.setAttribute("aria-pressed", String(isActive));
    refs.button.dataset.layerCount = String(currentCounts[key]);
    refs.value.textContent = String(currentCounts[key]);
  }

  const pairVisible = active.has("pair");
  graphWrap.hidden = !pairVisible;
  pairList.hidden = !pairVisible;
  pairEmpty.hidden = !pairVisible || currentCounts.pair > 0;

  groupsBand.hidden = !active.has("group");
  punishmentsBand.hidden = !active.has("punishment");

  panel.dataset.visibleRelationLayers = [...active].join(",");
}

function scheduleRender() {
  queueMicrotask(render);
}

if (install()) {
  form.addEventListener("input", scheduleRender);
  form.addEventListener("change", scheduleRender);
  render();
}
