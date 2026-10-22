// Browser and visual suites share one manifest so CI sharding cannot silently
// omit an existing browser check. Each suite runs in an isolated runner.
export const VISUAL_CI_SUITES = Object.freeze({
  shader: [
    "check-material-shader.mjs"
  ],
  home: [
    "check-mobile-material-budget.mjs",
    "check-mobile-camera-lifecycle.mjs",
    "check-camera-history-navigation.mjs",
    "check-deep-links.mjs",
    "check-mean-solar-preview.mjs",
    "check-birth-advanced.mjs",
    "check-view-shells.mjs",
    "check-kinetic-boundaries.mjs",
    "check-kinetic-composition.mjs",
    "check-mobile-legend-layout.mjs",
    "check-mobile-time-contract.mjs",
    "check-time-context-control.mjs",
    "check-ganzhi-inspector.mjs",
    "check-scale-emphasis.mjs",
    "check-classification-overlay.mjs",
    "check-ring-visibility.mjs",
    "check-reference-frame.mjs",
    "check-discrete-phase.mjs",
    "check-temporal-motion-hierarchy.mjs",
    "check-temporal-boundary-continuity.mjs",
    "check-linked-boundary-drag.mjs",
    "check-free-compare-drag.mjs",
    "check-free-compare-readheads.mjs",
    "check-boundary-gates.mjs"
  ],
  research: [
    "check-recurrence-lab.mjs",
    "check-research-task-hierarchy.mjs",
    "check-research-date-explorer.mjs",
    "check-r17-live-interactions.mjs",
    "check-astronomical-residuals.mjs",
    "check-four-pillar-determinacy.mjs",
    "check-day-hour-proof-chain.mjs",
    "check-recurrence-longitude-controls.mjs",
    "check-seasonal-epoch-source-audit.mjs",
    "check-near-recurrence.mjs",
    "check-seasonal-drift-evidence-live.mjs"
  ],
  "capture-pages": [
    "visual-check-r17-unfolded-phase.mjs",
    "visual-check-r17-in-context.mjs",
    "visual-check-r17-production-optin.mjs",
    "visual-check-r18-closure-journey.mjs",
    "check-tools-human-ux.mjs",
    "visual-check.mjs",
    "visual-check-research-01-diagram-lab.mjs",
    "visual-check-research-02-diagram-lab.mjs",
    "visual-check-research-02-production.mjs",
    "visual-check-research-03-diagram-lab.mjs",
    "visual-check-research-03-production.mjs",
    "visual-check-research-production-rhythm.mjs"
  ],
  "capture-interactions": [
    "check-wide-desktop-composition.mjs",
    "visual-check-wide-desktop.mjs",
    "visual-check-selected-instant-editor.mjs",
    "visual-check-scale-windows.mjs",
    "visual-check-solar-time-panel.mjs",
    "visual-check-find-time.mjs"
  ],
  "capture-material": [
    // The ablation check reads images produced by material-prototype.
    "visual-check-material-prototype.mjs",
    "visual-check-material-ablation.mjs"
  ],
  "capture-responsive": [
    "check-mobile-zodiac-datum.mjs",
    "check-home-h24-responsive.mjs",
    "visual-check-determinacy.mjs"
  ]
});