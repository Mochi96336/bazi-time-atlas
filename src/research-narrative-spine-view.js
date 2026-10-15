const spine = Object.freeze({
  discrete: document.querySelector("#research-spine-discrete"),
  astronomy: document.querySelector("#research-spine-astronomy"),
  evidence: document.querySelector("#research-spine-evidence")
});

function setOutcome(name, text, state) {
  const node = spine[name];
  if (!node) return;
  node.textContent = text;
  const link = node.closest("[data-research-spine]");
  if (link) link.dataset.researchSpineState = state;
}

// The outline summarizes the fixed argument of this page, not the current Δ
// selected in the 01 sandbox. The live explorer has its own readouts.
setOutcome("discrete", "24,000 離散候選", "candidate");
setOutcome("astronomy", "TT 提前 10–14 d", "offset");
setOutcome("evidence", "24,000 ≠ 完整週期", "conclusion");