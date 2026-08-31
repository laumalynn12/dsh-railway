/*
 * Self-check for mobile-settings.js. Run: node mobile-settings.test.js
 * No framework — asserts only. Verifies the top-bar shell layout and the
 * section-specific responsive rules.
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

// The panel selector must uniquely target settings panels and not match
// other dialogs that use aria-label (ui-primitives Modal, ImageLightbox, etc.)
const SEL = '[role="dialog"][aria-modal="true"][aria-labelledby]';
assert.ok(CSS.includes(SEL), 'stylesheet must key on the aria-labelledby dialog');

// ===== Shell: top-bar navigation =====
// The nav bar is sticky at the top so it stays visible while content scrolls.
assert.match(CSS, /> nav \{[^}]*position:\s*sticky/, 'nav must be a sticky top bar');
assert.match(CSS, /> nav \{[^}]*top:\s*0/, 'sticky bar must pin to the top');
assert.match(CSS, /> nav \{[^}]*flex-direction:\s*row/, 'nav must lay out horizontally');
// Panel is a full-viewport column: bar on top, content fills the rest.
assert.match(CSS, /\{\s*flex-direction:\s*column/, 'panel must be a column');
assert.match(CSS, /100dvh/, 'panel height must use dynamic viewport units');
// Touch targets reach the 44px minimum.
assert.match(CSS, /min-height:\s*44px/);
// Safe-area inset present for device chrome.
assert.ok(CSS.includes('safe-area-inset'), 'must include safe-area-inset values');

// ===== Section rules present =====
const hasModelsSection = /modelRow|modelAdvanced|modelField/i.test(CSS);
const hasPluginsSection = /tablist|cards|catalog/i.test(CSS);
const hasInventorySection = /search|switcher|groupBody/i.test(CSS);

assert.ok(hasModelsSection, 'models section CSS must include model row patterns');
assert.ok(hasPluginsSection, 'plugins section CSS must include tablist/card patterns');
assert.ok(hasInventorySection, 'inventory section CSS must include search/switcher patterns');

console.log('mobile-settings: all checks passed');
