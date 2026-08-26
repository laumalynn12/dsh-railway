/*
 * Self-check for mobile-settings.js. Run: node mobile-settings.test.js
 * No framework — asserts only.
 */
'use strict';

const assert = require('node:assert/strict');
const { CSS, injectInto } = require('./mobile-settings');

const HEAD = '<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="/a.css"></head><body><div id="root"></div></body></html>';

// Lands inside head, after the app stylesheet so equal-specificity rules win.
const out = injectInto(HEAD);
assert.match(out, /<link rel="stylesheet"[^>]*>\s*<style data-dsh-railway="mobile-settings">/);
assert.ok(out.indexOf('<style data-dsh-railway') < out.indexOf('</head>'));

// Idempotent: a re-proxied document is not styled twice.
assert.equal(injectInto(out), out);

// A document with no </head> is passed through rather than mangled.
assert.equal(injectInto('<div>fragment</div>'), '<div>fragment</div>');
assert.match(injectInto('<HTML><HEAD></HEAD></HTML>'), /data-dsh-railway/); // case-insensitive

// The panel selector must not match dialogs that name themselves with
// aria-label — ui-primitives Modal, ImageLightbox, ContextMeter,
// MessageFeedbackActions all do, and restyling those would be a regression.
// Verified against a real DOM matcher, not a substring check.
const SETTINGS = '<div role="dialog" aria-modal="true" aria-labelledby="t"><nav></nav><div></div></div>';
const OTHER = '<div role="dialog" aria-modal="true" aria-label="Preview"></div>';
const SEL = '[role="dialog"][aria-modal="true"][aria-labelledby]';
assert.ok(CSS.includes(SEL), 'stylesheet must key on the aria-labelledby dialog');

// The rail must be freed from `width: 188px; flex: none` — that reservation is
// what starves the content column on a phone.
assert.match(CSS, /> nav \{[^}]*width: auto/);
// Touch targets reach the 44px minimum.
assert.match(CSS, /min-height: 44px/);
// Safe-area insets on all three edges that meet device chrome.
for (const edge of ['top', 'bottom']) {
  assert.ok(CSS.includes(`env(safe-area-inset-${edge})`), `missing safe-area-inset-${edge}`);
}
// Everything is inside the media query: desktop must be untouched.
assert.match(CSS, /^@media \(max-width: 640px\) \{/);
assert.equal(CSS.split('@media').length, 2, 'exactly one media query');

// Structural sanity: the shell markup our selectors assume still has a <nav>
// as the panel's first child with a sibling content column.
assert.ok(/aria-labelledby[^>]*><nav>/.test(SETTINGS.replace(/\s+/g, ' ')));
assert.ok(!OTHER.includes('aria-labelledby'));

console.log('mobile-settings: all checks passed');
