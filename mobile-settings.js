/*
 * Narrow-viewport layout for the harness settings panel, injected into the
 * served index.html by server.js.
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
 * class selector would break on every rebuild. `[role="dialog"]
 * [aria-modal="true"][aria-labelledby]` is uniquely the settings panel —
 * every other dialog in the app names itself with aria-label instead
 * (ui-primitives Modal, ImageLightbox, ContextMeter, MessageFeedbackActions).
 * Attribute selectors also outrank the single-class module rules they
 * override, so nothing here needs !important.
 */
'use strict';

/** The settings panel. Also the specificity anchor for every rule below. */
const S = '[role="dialog"][aria-modal="true"][aria-labelledby]';

/*
 * ponytail: styles the settings SHELL only (panel, rail, header, options
 * gutters). Individual sections keep their own fixed grids — e.g.
 * ui-settings-models ModelsSection.module.css `.modelRow` is
 * `grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr) auto auto`. Those
 * shrink rather than overlap because of the minmax(0, …) tracks, and freeing
 * the ~188px the rail was holding is what actually makes them fit. If a
 * specific section still reads badly on a phone, add a rule for it here
 * (it needs a stable structural selector, since its classes are hashed too);
 * restructuring a section's own grid means patching that package.
 */
const CSS = `@media (max-width: 640px) {
${S} {
  flex-direction: column;
  width: 100vw;
  max-width: 100vw;
  height: 100vh;
  height: 100dvh;
  max-height: none;
  border-radius: 0;
}
${S} * {
  min-width: 0;
}
${S} > nav {
  width: auto;
  gap: 12px;
  padding: max(12px, env(safe-area-inset-top)) 12px 0;
}
${S} > nav > div:last-child {
  flex-direction: row;
  gap: 8px;
  overflow-x: auto;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
}
${S} > nav > div:last-child::-webkit-scrollbar {
  display: none;
}
${S} > nav button {
  flex: 0 0 auto;
  min-height: 44px;
}
${S} > nav button > span {
  flex: none;
  overflow: visible;
  text-overflow: clip;
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
${S} > nav + div > div:last-child {
  padding: 0 16px calc(16px + env(safe-area-inset-bottom));
  overflow-wrap: anywhere;
  -webkit-overflow-scrolling: touch;
}
}
`;

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
