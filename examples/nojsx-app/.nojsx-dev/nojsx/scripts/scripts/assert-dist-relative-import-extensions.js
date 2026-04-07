#!/usr/bin/env bun
import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
const DIST_DIR = join(import.meta.dir, '..', 'dist');
function isRelative(spec) {
    return spec.startsWith('./') || spec.startsWith('../');
}
function hasKnownExtension(spec) {
    return /\.(?:js|mjs|cjs|json)$/i.test(spec);
}
function isDirectoryIndexImport(spec) {
    return spec.endsWith('/index.js') || spec.endsWith('/index.mjs') || spec.endsWith('/index.cjs');
}
function collectMissing(fromFile, contents) {
    const missing = [];
    const register = (spec) => {
        if (!isRelative(spec))
            return;
        if (hasKnownExtension(spec))
            return;
        if (isDirectoryIndexImport(spec))
            return;
        missing.push(`${fromFile}: ${spec}`);
    };
    for (const match of contents.matchAll(/\bfrom\s*(?:"([^"]+)"|'([^']+)')/g)) {
        register((match[1] ?? match[2] ?? '').trim());
    }
    for (const match of contents.matchAll(/\bimport\(\s*(?:"([^"]+)"|'([^']+)')\s*\)/g)) {
        register((match[1] ?? match[2] ?? '').trim());
    }
    return missing;
}
async function walk(dir) {
    if (!existsSync(dir))
        return [];
    const failures = [];
    const entries = await readdir(dir, { withFileTypes: true });
    for (const ent of entries) {
        const abs = join(dir, ent.name);
        if (ent.isDirectory()) {
            failures.push(...(await walk(abs)));
            continue;
        }
        if (!ent.isFile())
            continue;
        if (!abs.endsWith('.js') && !abs.endsWith('.mjs'))
            continue;
        if (abs.endsWith('.js.map') || abs.endsWith('.mjs.map'))
            continue;
        const contents = await readFile(abs, 'utf8');
        failures.push(...collectMissing(abs, contents));
    }
    return failures;
}
async function main() {
    const failures = await walk(DIST_DIR);
    if (!failures.length) {
        console.log('[nojsx] dist import extension assertion passed.');
        return;
    }
    console.error('[nojsx] Found extensionless relative imports in dist output:');
    for (const issue of failures) {
        console.error(` - ${issue}`);
    }
    process.exit(1);
}
await main();
//# sourceMappingURL=assert-dist-relative-import-extensions.js.map