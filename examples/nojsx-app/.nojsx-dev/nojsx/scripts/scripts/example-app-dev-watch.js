#!/usr/bin/env bun
import path from "node:path";
import { existsSync, watch } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildExampleAppDev } from "./example-app-dev-build.js";
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const appRoot = path.join(repoRoot, "examples", "nojsx-app");
const port = Number(process.env.PORT || 4173);
const origin = process.env.NOJSX_DEV_ORIGIN || `http://127.0.0.1:${port}`;
let buildQueued = false;
let building = false;
async function runBuild(reason) {
    if (building) {
        buildQueued = true;
        return;
    }
    building = true;
    try {
        await buildExampleAppDev({ appRoot, origin });
        console.log(`[nojsx-app:watch] rebuilt (${reason})`);
    }
    catch (error) {
        console.error(`[nojsx-app:watch] build failed (${reason})`, error);
    }
    finally {
        building = false;
        if (buildQueued) {
            buildQueued = false;
            await runBuild("queued-change");
        }
    }
}
await runBuild("startup");
const watcher = watch(appRoot, { recursive: true }, async (event, changedPath) => {
    if (!changedPath)
        return;
    const fullPath = path.join(appRoot, changedPath.toString());
    if (!existsSync(fullPath) && !changedPath.toString().endsWith("package.json")) {
        return;
    }
    const normalized = fullPath.replace(/\\/g, "/");
    if (normalized.includes("/.nojsx-dev/") || normalized.includes("/dist/") || normalized.includes("/node_modules/")) {
        return;
    }
    if (!normalized.includes("/src/") && !normalized.endsWith("/package.json")) {
        return;
    }
    await runBuild(`${event}:${path.basename(fullPath)}`);
});
console.log(`[nojsx-app:watch] watching ${appRoot}`);
process.on("SIGINT", () => {
    watcher.close();
    process.exit(0);
});
process.on("SIGTERM", () => {
    watcher.close();
    process.exit(0);
});
//# sourceMappingURL=example-app-dev-watch.js.map