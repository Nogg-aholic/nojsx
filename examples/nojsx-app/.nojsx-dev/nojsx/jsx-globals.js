"use strict";
// Ensures JSX runtime globals exist early enough for ESM module init.
// This module must have NO imports.
const root = globalThis;
if (typeof root.g === 'undefined') {
    if (typeof root.eval === 'function') {
        root.eval('var g = globalThis;');
    }
    else {
        root.g = root;
    }
}
const gg = root.g;
const ggAny = gg;
// Stable Fragment symbol used by compiled components.
// IMPORTANT: must be stable for the life of the page.
if (typeof gg.Fragment !== 'symbol') {
    gg.Fragment = Symbol('Fragment');
}
function ensureProxy(name, implKey) {
    if (typeof ggAny[name] === 'function')
        return;
    ggAny[name] = (...args) => {
        const impl = ggAny[implKey];
        if (typeof impl !== 'function') {
            throw new Error(`[nojsx] ${name} is not initialized`);
        }
        return impl(...args);
    };
}
// Proxies: compiled output often does `const _jsxDEV = globalThis.jsxDEV` at module init.
// If jsx-runtime hasn't executed yet, that capture would otherwise be undefined forever.
ensureProxy('jsx', '__nojsx_jsx_impl');
ensureProxy('jsxs', '__nojsx_jsxs_impl');
ensureProxy('jsxDEV', '__nojsx_jsxDEV_impl');
// Some emitters/tools use _jsxDEV as a global.
if (typeof gg._jsxDEV !== 'function') {
    gg._jsxDEV = gg.jsxDEV;
}
