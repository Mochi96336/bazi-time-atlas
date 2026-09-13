export const SVG_NS = "http://www.w3.org/2000/svg";

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
  nodes.forEach((node, index) => node.classList.toggle("is-active", index === activeIndex));
}
