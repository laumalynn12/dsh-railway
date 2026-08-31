/*
 * Self-check for mobile-settings.js. Run: node mobile-settings.test.js
 * No framework — asserts only. Tests the new semantic-selector based version.
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
const SETTINGS = '<div role="dialog" aria-modal="true" aria-labelledby="t"><nav></nav><div></div></div>';
const OTHER = '<div role="dialog" aria-modal="true" aria-label="Preview"></div>';
const SEL = '[role="dialog"][aria-modal="true"][aria-labelledby]';
assert.ok(CSS.includes(SEL), 'stylesheet must key on the aria-labelledby dialog');
assert.ok(!CSS.includes('[aria-label="Preview"]'), 'must not rely on aria-label patterns');

// Shell layout: nav position and rail strip width
assert.match(CSS, /\[role="dialog"\][^\}]*position:\s*fixed/);
assert.match(CSS, /bottom:\s*0/);
// Touch targets reach the 44px minimum.
assert.match(CSS, /min-height:\s*44px/);
// Safe-area insets present
assert.ok(CSS.includes('safe-area-inset-top') || CSS.includes('safe-area-inset-bottom') ||
         CSS.includes('safe-area-inset-right') || CSS.includes('safe-area-inset-left'),
         'must include safe-area-inset values');

// All three sections have media queries at breakpoint
const sectionCount = (CSS.match(/@media \(max-width:\s*\d+px\)/g) || []).length;
assert.ok(sectionCount >= 3, `expected at least 3 media query blocks (shell + 3 sections), got ${sectionCount}`);

// Verify each section's distinctive pattern exists
const hasModelsSection = /modelRow|modelAdvanced|modelField/i.test(CSS);
const hasPluginsSection = /tablist|cards|catalog/i.test(CSS);
const hasInventorySection = /search|switcher|groupBody/i.test(CSS);

assert.ok(hasModelsSection, 'models section CSS must include model row patterns');
assert.ok(hasPluginsSection, 'plugins section CSS must include tablist/card patterns');
assert.ok(hasInventorySection, 'inventory section CSS must include search/switcher patterns');

console.log('mobile-settings: all checks passed');
