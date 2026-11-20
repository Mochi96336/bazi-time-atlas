// Research redesign R5: a dashed term opens its plain-language explanation in
// place, so the reader does not lose their spot by jumping to the glossary.
// Without JS the link still jumps to the glossary entry.

const glossary = document.querySelector("#research-glossary");

function definitionFor(href) {
  const id = decodeURIComponent((href ?? "").replace(/^#/, ""));
  if (!id.startsWith("term-")) return null;
  const entry = glossary?.querySelector(`#${CSS.escape(id)}`);
  const term = entry?.querySelector("dt")?.textContent?.trim();
  const text = entry?.querySelector("dd")?.textContent?.trim();
  return term && text ? { id, term, text } : null;
}

function closeNote(link) {
  document.getElementById(link.getAttribute("aria-controls") ?? "")?.remove();
  link.setAttribute("aria-expanded", "false");
}

function openNote(link, definition) {
  const note = document.createElement("span");
  note.className = "research-term-note";
  note.id = `${definition.id}-note-${Math.random().toString(36).slice(2, 7)}`;
  note.setAttribute("role", "note");
  const strong = document.createElement("strong");
  strong.textContent = definition.term;
  note.append(strong, definition.text);
  // Open below the sentence, never inside it: the paragraph keeps reading
  // as one line of thought and the note sits right under it.
  const host = link.closest("p, li, dd, figcaption") ?? link;
  let anchor = host;
  while (anchor.nextElementSibling?.classList.contains("research-term-note")) anchor = anchor.nextElementSibling;
  anchor.after(note);
  link.setAttribute("aria-expanded", "true");
  link.setAttribute("aria-controls", note.id);
}

export function bindInlineGlossary(root = document) {
  if (!glossary) return 0;
  let bound = 0;
  for (const link of root.querySelectorAll("a.research-term[href^='#term-']")) {
    if (link.dataset.inlineGlossary === "bound") continue;
    const definition = definitionFor(link.getAttribute("href"));
    if (!definition) continue;
    link.dataset.inlineGlossary = "bound";
    link.setAttribute("aria-expanded", "false");
    link.addEventListener("click", event => {
      event.preventDefault();
      if (link.getAttribute("aria-expanded") === "true") closeNote(link);
      else openNote(link, definition);
    });
    bound += 1;
  }
  return bound;
}

const count = bindInlineGlossary();
document.documentElement.dataset.researchInlineGlossary = String(count);
