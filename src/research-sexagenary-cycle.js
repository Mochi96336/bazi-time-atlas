import { polar, annularSectorPath } from "./geometry.js";
import { heavenlyStems, earthlyBranches, sexagenaryCycle, cycleItem, wrapCycleIndex } from "./sexagenary-data.js";

const NS = "http://www.w3.org/2000/svg";
const svg = typeof document === "undefined" ? null : document.querySelector("#research-sexagenary-wheel");

export function cycleIndexFromLocalPoint(x, y, cx = 320, cy = 320) {
  if (![x, y, cx, cy].every(Number.isFinite)) throw new RangeError("cycle point coordinates must be finite");
  const angle = (Math.atan2(y - cy, x - cx) * 180 / Math.PI + 360) % 360;
  return wrapCycleIndex(Math.floor((angle + 3) / 6));
}

if (svg) {
  const cx = 320;
  const cy = 320;
  let activeIndex = 0;
  const groups = Object.fromEntries(
    ["guides", "stems", "branches", "cycle", "selection"].map(name => [
      name,
      svg.querySelector(`[data-research-cycle-group="${name}"]`)
    ])
  );
  const stemNodes = [];
  const branchNodes = [];
  const cycleNodes = [];

  function svgEl(tag, attrs = {}, parent = svg) {
    const node = document.createElementNS(NS, tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
    parent.appendChild(node);
    return node;
  }

  function textAt(parent, radius, angle, text, className) {
    const { x, y } = polar(cx, cy, radius, angle);
    const node = svgEl("text", { x, y, class: className }, parent);
    node.textContent = text;
    return node;
  }

  function addTitle(node, text) {
    const title = document.createElementNS(NS, "title");
    title.textContent = text;
    node.appendChild(title);
  }

  [150, 205, 275].forEach(radius => {
    svgEl("circle", { cx, cy, r: radius, class: "research-cycle-guide" }, groups.guides);
  });
  textAt(groups.guides, 117, 0, "天干 · 10", "research-cycle-guide-label");
  textAt(groups.guides, 176, 0, "地支 · 12", "research-cycle-guide-label");

  heavenlyStems.forEach((stem, index) => {
    const angle = index * 36;
    const point = polar(cx, cy, 150, angle);
    const circle = svgEl("circle", { cx:point.x, cy:point.y, r:21, class:"research-cycle-node" }, groups.stems);
    const label = textAt(groups.stems, 150, angle, stem.name, "research-cycle-node-label");
    stemNodes.push({ circle, label });
  });

  earthlyBranches.forEach((branch, index) => {
    const angle = index * 30;
    const point = polar(cx, cy, 205, angle);
    const circle = svgEl("circle", { cx:point.x, cy:point.y, r:19, class:"research-cycle-node" }, groups.branches);
    const label = textAt(groups.branches, 205, angle, branch.name, "research-cycle-node-label");
    branchNodes.push({ circle, label });
  });

  sexagenaryCycle.forEach((item, index) => {
    const angle = index * 6;
    const tickInner = polar(cx, cy, index % 5 === 0 ? 253 : 258, angle);
    const tickOuter = polar(cx, cy, 270, angle);
    const tick = svgEl("line", {
      x1:tickInner.x, y1:tickInner.y, x2:tickOuter.x, y2:tickOuter.y,
      class:`research-cycle-tick${index % 5 === 0 ? " major" : ""}`
    }, groups.cycle);
    const dotPoint = polar(cx, cy, 275, angle);
    const dot = svgEl("circle", {
      cx:dotPoint.x, cy:dotPoint.y, r:index % 5 === 0 ? 4.8 : 3.5,
      class:`research-cycle-dot${index % 5 === 0 ? " major" : ""}`
    }, groups.cycle);
    if (index % 5 === 0) textAt(groups.cycle, 296, angle, String(item.ordinal).padStart(2, "0"), "research-cycle-index");
    const hit = svgEl("path", {
      d:annularSectorPath(cx, cy, 242, 306, angle - 3, angle + 3),
      class:"research-cycle-hit", tabindex:-1, role:"button",
      "aria-label":`第 ${item.ordinal} 日序，${item.name}`
    }, groups.cycle);
    addTitle(hit, `${String(item.ordinal).padStart(2, "0")} · ${item.name}`);
    hit.addEventListener("click", () => setActive(index));
    hit.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        setActive(index);
      }
    });
    cycleNodes.push({ tick, dot, hit });
  });

  function renderSelection(item) {
    groups.selection.replaceChildren();
    const angle = item.index * 6;
    const inner = polar(cx, cy, 232, angle);
    const outer = polar(cx, cy, 294, angle);
    svgEl("line", { x1:inner.x, y1:inner.y, x2:outer.x, y2:outer.y, class:"research-cycle-ray" }, groups.selection);
    const cap = polar(cx, cy, 275, angle);
    svgEl("circle", { cx:cap.x, cy:cap.y, r:7, class:"research-cycle-cap" }, groups.selection);
  }

  function updateReadout(item) {
    document.querySelector("#research-cycle-title").textContent = item.name;
    document.querySelector("#research-cycle-ordinal").textContent = `${String(item.ordinal).padStart(2, "0")} / 60`;
    document.querySelector("#research-cycle-stem").textContent = item.stem.name;
    document.querySelector("#research-cycle-stem-meta").textContent = `${item.stem.yinYang} · ${item.stem.element}`;
    document.querySelector("#research-cycle-stem-index").textContent = `${item.stemIndex + 1} / 10`;
    document.querySelector("#research-cycle-branch").textContent = item.branch.name;
    document.querySelector("#research-cycle-branch-meta").textContent = `${item.branch.yinYang} · ${item.branch.element}`;
    document.querySelector("#research-cycle-branch-index").textContent = `${item.branchIndex + 1} / 12`;
    document.querySelector("#research-cycle-center-kicker").textContent = item.name;
    document.querySelector("#research-cycle-center-value").textContent = `${String(item.ordinal).padStart(2, "0")} / 60`;
    document.querySelector("#research-cycle-center-note").textContent = `天干 ${item.stem.name} · ${item.stemIndex + 1}/10　地支 ${item.branch.name} · ${item.branchIndex + 1}/12`;
    svg.setAttribute("aria-label", `六十日序第 ${item.ordinal} 位，${item.name}`);
  }

  function updateHighlights(item) {
    stemNodes.forEach((node, index) => {
      const active = index === item.stemIndex;
      node.circle.classList.toggle("active", active);
      node.label.classList.toggle("active", active);
    });
    branchNodes.forEach((node, index) => {
      const active = index === item.branchIndex;
      node.circle.classList.toggle("active", active);
      node.label.classList.toggle("active", active);
    });
    cycleNodes.forEach((node, index) => {
      const active = index === item.index;
      node.tick.classList.toggle("active", active);
      node.dot.classList.toggle("active", active);
      node.dot.setAttribute("r", active ? "7" : index % 5 === 0 ? "4.8" : "3.5");
      node.hit.setAttribute("aria-pressed", String(active));
    });
  }

  function setActive(index) {
    activeIndex = wrapCycleIndex(index);
    const item = cycleItem(activeIndex);
    renderSelection(item);
    updateHighlights(item);
    updateReadout(item);
  }

  let activePointerId = null;

  function indexFromPointer(event) {
    const matrix = svg.getScreenCTM();
    if (!matrix) return null;
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const local = point.matrixTransform(matrix.inverse());
    return cycleIndexFromLocalPoint(local.x, local.y, cx, cy);
  }

  function scrubToPointer(event) {
    const index = indexFromPointer(event);
    if (index === null || index === activeIndex) return;
    setActive(index);
  }

  svg.addEventListener("pointerdown", event => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    activePointerId = event.pointerId;
    svg.setPointerCapture?.(event.pointerId);
    scrubToPointer(event);
    event.preventDefault();
  });
  svg.addEventListener("pointermove", event => {
    if (event.pointerId !== activePointerId) return;
    scrubToPointer(event);
    event.preventDefault();
  });
  const releasePointer = event => {
    if (event.pointerId !== activePointerId) return;
    svg.releasePointerCapture?.(event.pointerId);
    activePointerId = null;
  };
  svg.addEventListener("pointerup", releasePointer);
  svg.addEventListener("pointercancel", releasePointer);

  svg.setAttribute("tabindex", "0");
  svg.addEventListener("keydown", event => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      setActive(activeIndex - 1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      setActive(activeIndex + 1);
    }
  });

  setActive(0);
}
