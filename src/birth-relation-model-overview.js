import { RELATION_MODEL_FAMILIES } from "./calendar/relation-models.js";

const panel = document.querySelector("#pillar-relations-panel");
const intro = panel?.querySelector(".pillar-relations-intro");

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function pairGlyph() {
  const glyph = node("div", "relation-model-glyph");
  glyph.append(
    node("span", "relation-model-dot"),
    node("span", "relation-model-line"),
    node("span", "relation-model-dot")
  );
  return glyph;
}

function groupGlyph() {
  const glyph = node("div", "relation-model-glyph");
  const bracket = node("span", "relation-model-bracket");
  bracket.append(node("i"));
  glyph.append(bracket);
  return glyph;
}

function punishmentGlyph(family) {
  const glyph = node("div", "relation-model-glyph");
  const modes = node("div", "relation-model-punishment-glyphs");
  for (const mode of family.modes ?? []) {
    const item = node("span", null, `${mode.glyph} ${mode.label}`);
    item.dataset.mode = mode.id;
    modes.append(item);
  }
  glyph.append(modes);
  return glyph;
}

function glyphFor(family) {
  if (family.id === "pair") return pairGlyph();
  if (family.id === "complete-group") return groupGlyph();
  return punishmentGlyph(family);
}

function install() {
  if (!panel || !intro) return;

  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = "./relation-models.css";
  stylesheet.dataset.relationModelStyles = "1";
  document.head.append(stylesheet);

  const section = node("section", "relation-model-overview");
  section.id = "relation-model-overview";
  section.setAttribute("aria-label", "關係資料模型總覽");

  const head = node("div", "relation-model-overview-head");
  head.append(
    node("small", null, "RELATION TOPOLOGY"),
    node("span", null, "先看結構，再看名稱")
  );

  const grid = node("div", "relation-model-grid");
  for (const family of RELATION_MODEL_FAMILIES) {
    const card = node("article", "relation-model-card");
    card.dataset.relationModel = family.id;
    card.dataset.topology = family.topology;
    if (family.memberCount !== null) card.dataset.memberCount = String(family.memberCount);

    const header = node("header");
    header.append(
      node("small", null, family.kicker),
      node("strong", null, family.title)
    );

    const labels = node("div", "relation-model-labels");
    for (const label of family.labels) labels.append(node("span", null, label));

    card.append(
      header,
      glyphFor(family),
      labels,
      node("p", null, family.summary)
    );
    grid.append(card);
  }

  section.append(head, grid);
  intro.insertAdjacentElement("afterend", section);
}

install();
