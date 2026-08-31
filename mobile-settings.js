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

/* ===== Shell Layout (Top Bar Navigation) ===== */
/* Changes from 2-column (nav rail + content) to single-column layout with
   a horizontal top bar. Structural selectors only: the panel is
   dialog > (nav, div) where the div holds (header, options); hashed
   CSS-Module class names are never referenced. */
const SHELL_CSS = `@media (max-width: 768px) {
${S} {
  flex-direction: column;
  width: 100vw;
  max-width: 100vw;
  height: 100vh;
  height: 100dvh;
  max-height: none;
  border-radius: 0;
}
/* Horizontal top bar: nav becomes the first row, sticky so it stays
   visible while the options column scrolls beneath it. */
${S} > nav {
  order: 0;
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  flex-direction: row;
  align-items: center;
  flex-wrap: nowrap;
  gap: 6px;
  width: 100%;
  flex: none;
  padding: 8px 12px calc(8px + env(safe-area-inset-bottom, 0px));
  background: var(--dsw-alias-bg-layer-2);
  box-shadow: 0 1px 0 var(--dsw-alias-border-l2);
  box-sizing: border-box;
}
/* Panel title ("Settings") is visually hidden on phones so the section
   tabs own the whole bar. It cannot be display:none: the dialog names
   itself through aria-labelledby pointing at this node, and a hidden
   target strips the accessible name. This is the sr-only pattern (the
   same one upstream uses for the close button's label) — the element
   stays in the accessibility tree while taking no bar space. */
${S} > nav > div:first-child {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
/* Section tabs (General / Models / Agent Presets / Plugins) scroll
   horizontally after the title. */
${S} > nav > div:last-child {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: row;
  gap: 6px;
  overflow-x: auto;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
  align-items: center;
}
${S} > nav > div:last-child::-webkit-scrollbar {
  display: none;
}
${S} > nav button {
  flex: 0 0 auto;
  min-height: 44px;
  padding: 8px 12px;
  border-radius: 20px;
  font-size: 13px;
}
${S} > nav button > span {
  overflow: visible;
  text-overflow: clip;
  white-space: nowrap;
}
/* Content column: everything below the bar. Header row (actions + close)
   stays visible; options take the remaining height and scroll. */
${S} > nav + div {
  order: 1;
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
${S} > nav + div > div:first-child {
  flex: none;
  height: auto;
  min-height: 52px;
  align-items: center;
  padding: 8px 12px;
}
${S} > nav + div > div:first-child button {
  min-width: 44px;
  min-height: 44px;
}
${S} > nav + div > div:last-child {
  flex: 1 1 auto;
  min-height: 0;
  padding: 0 16px calc(16px + env(safe-area-inset-bottom, 0px));
  overflow-wrap: anywhere;
  -webkit-overflow-scrolling: touch;
}
}`;

/* ===== Models Section (provider list/grid) ===== */
/* Provider rows are <ul.rows > <li.rowCard>. Each rowCard has:
 *   - .rowHead: contains .rowIdentity (displayName, credential dots) +
 *                .rowActions (edit button, remove button)
 * Model lists (inside providers) use .modelRow which is a 4-column grid:
 *   model-id | model-name | chevron | delete
 * We preserve horizontal layouts while making controls touch-friendly. */
const MODELS_CSS = `@media (max-width: 600px) {
  /* =========================
     Provider rows (.rowCard)
     =========================
     Desktop: name | credential | edit | delete (horizontal)
     Mobile:  Keep horizontal but wrap if needed; actions at bottom or side
   */
  [role="dialog"] .rows {
    display: block !important;
  }
  [role="dialog"] .rowCard {
    width: 100% !important;
    max-width: none !important;
    margin-bottom: 12px !important;
  }
  [role="dialog"] .rowHead {
    display: flex !important;
    flex-direction: column !important;
    gap: 8px !important;
  }
  [role="dialog"] .rowIdentity {
    flex: none;
    width: 100%;
    font-size: 14px;
  }
  [role="dialog"] .rowActions {
    display: flex !important;
    flex-direction: row !important;
    justify-content: flex-end;
    gap: 8px;
  }
  [role="dialog"] .rowActions button {
    min-width: 44px !important;
    min-height: 44px !important;
    padding: 0 12px !important;
    border-radius: 8px !important;
  }
  [role="dialog"] .rowName {
    overflow-wrap: break-word !important;
  }

  /* =========================
     Model list rows (.modelRow)
     =========================
     Desktop: 4-col grid — id | name | chevron | delete
     Mobile:  Compress to inline layout with ellipsis for long values;
             icon buttons grow to 44px targets
   */
  [role="dialog"] [class*="modelRow"] {
    display: flex !important;
    flex-direction: row !important;
    flex-wrap: nowrap !important;
    align-items: center !important;
    gap: 8px !important;
    padding: 8px 12px !important;
    margin: 0 !important;
    background: transparent !important;
  }
  /* First two columns (id, name) share remaining space, last two icons fixed */
  [role="dialog"] [class*="modelRow"] > * {
    flex: 1 1 auto;
    min-width: 0;
  }
  [role="dialog"] [class*="modelRow"] > *:last-child,
  [role="dialog"] [class*="modelRow"] > *:nth-last-child(2) {
    flex: 0 0 auto;
    width: 40px !important;
    height: 40px !important;
    min-width: 40px !important;
    min-height: 40px !important;
  }
  /* Icon buttons inside modelRow become touch targets */
  [role="dialog"] [class*="modelRow"] .iconButton {
    all: unset !important;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    width: 44px !important;
    height: 44px !important;
    padding: 0 !important;
    border-radius: 8px !important;
    cursor: pointer !important;
  }
  /* Long model names/id get ellipsis */
  [role="dialog"] [class*="modelRow"] input,
  [role="dialog"] [class*="modelRow"] select,
  [role="dialog"] [class*="modelRow"] span:first-child {
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
    max-width: 1fr !important;
  }
}
`;

/* ===== Plugins Section (tabs & cards) ===== */
/* Uses role="tablist" pattern identified in the source; hashed fragments
   like "card", "cards", "catalog" survive the module build. */
const PLUGINS_CSS = `@media (max-width: 768px) {
  /* Inner sub-tabs inside the content stay horizontally scrollable pills */
  [role="dialog"] [role="tablist"],
  [role="dialog"] [class*="tabs"] {
    display: flex !important;
    flex-direction: row !important;
    gap: 6px !important;
    overflow-x: auto !important;
    scrollbar-width: none !important;
    -webkit-overflow-scrolling: touch !important;
    padding-bottom: 4px !important;
    width: 100% !important;
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
  /* Single-column card grid for plugin and inventory sections */
  [role="dialog"] [class*="cards"],
  [role="dialog"] [class*="catalog"]:has([class*="grid"]) {
    grid-template-columns: minmax(0, 1fr) !important;
  }
  [role="dialog"] [class*="card"]:has([class*="body"]),
  [role="dialog"] [data-plugin-module] {
    width: 100% !important;
  }
  /* List-style plugins (generic card lists) fill the full column */
  [role="dialog"] ul,
  [role="dialog"] > div[class*="card"][role="button"] {
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
