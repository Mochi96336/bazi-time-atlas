export const SVG_NS = "http://www.w3.org/2000/svg";

const activeSectorIndexByNodes = new WeakMap();

export function svgElement(tag, attrs = {}, parent) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  parent?.appendChild(node);
  return node;
}

export function addTitle(node, text) {
  const title = document.createElementNS(SVG_NS, "title");
  title.textContent = text;
  node.appendChild(title);
  return node;
}

export function setActiveSector(nodes, activeIndex) {
  const hadPrevious = activeSectorIndexByNodes.has(nodes);
  const previousIndex = activeSectorIndexByNodes.get(nodes);
  if (hadPrevious && Object.is(previousIndex, activeIndex)) return;

  // Sector arrays are stable after static wheel construction. Do one complete
  // synchronization the first time, then only touch the old/new active nodes.
  if (!hadPrevious) {
    nodes.forEach((node, index) => node.classList.toggle("is-active", index === activeIndex));
    activeSectorIndexByNodes.set(nodes, activeIndex);
    return;
  }

  if (Number.isInteger(previousIndex) && nodes[previousIndex]) {
    nodes[previousIndex].classList.remove("is-active");
  }
  if (Number.isInteger(activeIndex) && nodes[activeIndex]) {
    nodes[activeIndex].classList.add("is-active");
  }
  activeSectorIndexByNodes.set(nodes, activeIndex);
}
