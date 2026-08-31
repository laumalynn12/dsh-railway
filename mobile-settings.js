/*
 * Narrow-viewport layouts for the harness settings panel — general shell and
 * section-specific tables / grids / forms.
 *
 * Why this exists: packages/client/ui-settings-general SettingsRoot.module.css
 * ships with zero @media rules. The panel is a fixed two-column dialog —
 * `width: 800px; max-width: calc(100vw - 48px)` with a `width: 188px;
 * flex: none` nav rail. On a 360px-wide phone the panel shrinks to ~312px,
 * the rail still takes 188px, and the content column is left with ~124px.
 * Settings rows (label beside control) do not fit in 124px, so they spill and
 * overlap. Below the breakpoint this turns the panel into a full-screen sheet
 * with the rail as a horizontal tab strip, giving content the whole width.
 *
 * Selectors are semantic, not class-based: the client build runs CSS Modules
 * with Vite's default naming, so `.panel` is emitted as `.panel_a1b2c` and a
 * class selector would break on every rebuild. `[role="dialog"]` attribute
 * selectors uniquely identify the settings panel without depending on hashed
 * names — stable across builds and resistant to tree-shaking or refactors.
 */
'use strict';

/** The settings panel dialog — unique anchor for all rules. */
const S = '[role="dialog"][aria-modal="true"][aria-labelledby]';

/* ===== Shell Layout ===== */
const SHELL_CSS = `@media (max-width: 640px) {
${S} {
  flex-direction: column;
  width: 100vw;
  max-width: 100vw;
  height: 100vh;
  height: 100dvh;
  max-height: none;
  border-radius: 0;
}
${S} > nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  width: 100%;
  height: 72px;
  background: inherit;
  box-shadow: 0 -1px 0 var(--dsw-alias-border-l2);
  flex-direction: row;
  gap: 6px;
  padding: 0 env(safe-area-inset-right, 12px) env(safe-area-inset-bottom, 12px) env(safe-area-inset-left, 12px);
  justify-content: center;
}
${S} > nav > div:first-child {
  order: 1;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 0 14px;
  min-height: 44px;
  font-size: 15px;
  white-space: nowrap;
}
${S} > nav > div:last-child {
  order: 0;
  flex-direction: row;
  gap: 6px;
  overflow-x: auto;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
  margin-top: env(safe-area-inset-bottom, 12px);
}
${S} > nav > div:last-child::-webkit-scrollbar {
  display: none;
}
${S} > nav button {
  flex: 0 0 auto;
  min-height: 44px;
  min-width: 44px;
  padding: 8px 12px;
  border-radius: 20px;
  font-size: 13px;
}
${S} > nav + div {
  min-height: 0;
}
${S} > nav + div > div:first-child {
  height: auto;
  min-height: 48px;
  align-items: center;
  padding: 8px 12px;
}
${S} > nav + div > div:first-child button {
  min-width: 44px;
  min-height: 44px;
}
}`;

/* ===== Models Section (provider list/grid) ===== */
/* Targets model provider entries using data attributes and semantic roles */
const MODELS_CSS = `@media (max-width: 600px) {
  /* Collapse 4-column provider rows into single column */
  [role="dialog"] > :not(nav) table,
  [role="dialog"] > :not(nav):has([class*="modelRow"]) {
    display: block !important;
  }
  [role="dialog"] > :not(nav) ul.rows {
    display: block !important;
  }
  [role="dialog"] > :not(nav) ul.rows li {
    display: block !important;
    width: 100% !important;
  }
  [role="dialog"] > :not(nav) ul.rows li td,
  [role="dialog"] > :not(nav) ul.rows li span,
  [role="dialog"] > :not(nav) ul.rows li div {
    display: block !important;
    width: 100% !important;
    box-sizing: border-box;
  }
  /* Stack advanced fields */
  [role="dialog"] > :not(nav) [class*="modelAdvanced"],
  [role="dialog"] > :not(nav) [class*="advanced"]:has([class*="field"]) {
    display: flex !important;
    flex-direction: column !important;
    width: 100% !important;
  }
  [role="dialog"] > :not(nav) [class*="modelField"],
  [role="dialog"] > :not(nav) [class*="field"]:has([class*="Label"]),
  [role="dialog"] > :not(nav) dt,
  [role="dialog"] > :not(nav) dd {
    width: 100% !important;
    margin-bottom: 8px !important;
  }
  /* Adjust icons and actions */
  [role="dialog"] > :not(nav) [class*="iconButton"],
  [role="dialog"] > :not(nav) [class*="action"] {
    min-width: 44px !important;
    min-height: 44px !important;
  }
}
`;

/* ===== Plugins Section (tabs & cards) ===== */
/* Uses role="tablist" pattern identified in the source */
const PLUGINS_CSS = `@media (max-width: 640px) {
  /* Horizontal scrollable tabs */
  [role="dialog"] [role="tablist"],
  [role="dialog"] [class*="tabs"] {
    display: flex !important;
    flex-direction: row !important;
    gap: 6px;
    overflow-x: auto !important;
    scrollbar-width: none !important;
    -webkit-overflow-scrolling: touch !important;
    padding-bottom: 4px !important;
  }
  [role="dialog"] [role="tablist"]::-webkit-scrollbar,
  [role="dialog"] [class*="tabs"]::-webkit-scrollbar {
    display: none !important;
  }
  [role="dialog"] [role="tab"],
  [role="dialog"] [class*="tab"]:has(span),
  [role="dialog"] [data-active]:has(svg) {
    flex: 0 0 auto !important;
    border-radius: 16px !important;
    padding: 8px 16px !important;
    white-space: nowrap !important;
    min-width: 44px !important;
    min-height: 44px !important;
  }
  /* Single-column card grid */
  [role="dialog"] [class*="cards"],
  [role="dialog"] [class*="catalog"]:has([class*="grid"]) {
    grid-template-columns: minmax(0, 1fr) !important;
  }
  [role="dialog"] [class*="card"]:has([class*="body"]),
  [role="dialog"] [data-plugin-module] {
    width: 100% !important;
  }
  /* Plugin cards */
  [role="dialog"] [class*="card"][list-style="none"] {
    width: 100% !important;
  }
}
`;

/* ===== Plugin Inventory Tab ===== */
/* Inside Plugins section - search input, groups, switcher */
const INVENTORY_CSS = `@media (max-width: 600px) {
  [role="dialog"] [class*="search"] {
    width: 100% !important;
  }
  [role="dialog"] [class*="search"] input {
    width: 100% !important;
    height: 40px !important;
    font-size: 14px !important;
    padding: 0 36px 0 38px !important;
  }
  [role="dialog"] [class*="groupBody"],
  [role="dialog"] [class*="cards"]:has(div[style*="display: grid"]) {
    grid-template-columns: minmax(0, 1fr) !important;
  }
  [role="dialog"] [class*="switcher"]:has([class*="chevron"]) {
    width: 100% !important;
    justify-content: space-between !important;
  }
  [role="dialog"] [class*="catalogHeading"] h3,
  [role="dialog"] [class*="groupTitle"] {
    font-size: 14px !important;
  }
  /* Details grid in plugin cards */
  [role="dialog"] [class*="details"] {
    grid-template-columns: auto minmax(0, 1fr) !important;
  }
  [role="dialog"] [class*="details"] dt,
  [role="dialog"] [class*="details"] dd {
    word-break: break-word !important;
    overflow-wrap: anywhere !important;
  }
}
`;

const CSS = SHELL_CSS + MODELS_CSS + PLUGINS_CSS + INVENTORY_CSS;

const STYLE_TAG = `<style data-dsh-railway="mobile-settings">${CSS}</style>`;

/**
 * Insert the stylesheet at the end of <head>, after the app's own stylesheet
 * link so equal-specificity rules resolve our way. A document with no </head>
 * is returned untouched: dsh always serves one, and silently mangling an
 * unexpected response is worse than shipping it unstyled.
 */
function injectInto(html) {
  if (html.includes('data-dsh-railway="mobile-settings"')) return html;
  const at = html.toLowerCase().lastIndexOf('</head>');
  if (at < 0) return html;
  return html.slice(0, at) + STYLE_TAG + html.slice(at);
}

module.exports = { CSS, STYLE_TAG, injectInto };
