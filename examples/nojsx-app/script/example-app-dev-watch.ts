#!/usr/bin/env bun
import path from "node:path";
import { existsSync, watch } from "node:fs";
import { fileURLToPath } from "node:url";

import { buildExampleAppDev } from "./example-app-dev-build.js";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(scriptDir, "..");
const port = Number(process.env.PORT || 4173);
const origin = process.env.NOJSX_DEV_ORIGIN || `http://127.0.0.1:${port}`;
const WATCH_DEBOUNCE_MS = 120;
const notifyEndpoint = `${origin}/__nojsx_live_reload/publish`;

let buildQueued = false;
let building = false;
let pendingReason: string | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

async function runBuild(reason: string): Promise<void> {
  if (building) {
    buildQueued = true;
    return;
  }

  building = true;
  try {
    await buildExampleAppDev({ appRoot, origin });
    await fetch(notifyEndpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ version: Date.now() }),
    }).catch(() => {});
    console.log(`[nojsx-app:watch] rebuilt (${reason})`);
  } catch (error) {
    console.error(`[nojsx-app:watch] build failed (${reason})`, error);
  } finally {
    building = false;
    if (buildQueued) {
      buildQueued = false;
      await runBuild("queued-change");
    }
  }
}

await runBuild("startup");

function scheduleBuild(reason: string): void {
  pendingReason = reason;
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  debounceTimer = setTimeout(() => {
    const nextReason = pendingReason ?? "change";
    pendingReason = null;
    debounceTimer = null;
    void runBuild(nextReason);
  }, WATCH_DEBOUNCE_MS);
}

const watcher = watch(appRoot, { recursive: true }, async (event, changedPath) => {
  if (!changedPath) return;
  const fullPath = path.join(appRoot, changedPath.toString());
  if (!existsSync(fullPath) && !changedPath.toString().endsWith("package.json")) {
    return;
  }

  const normalized = fullPath.replace(/\\/g, "/");
  if (normalized.includes("/dist/") || normalized.includes("/node_modules/")) {
    return;
  }

  if (!normalized.includes("/src/") && !normalized.endsWith("/package.json")) {
    return;
  }

  scheduleBuild(`${event}:${path.basename(fullPath)}`);
});

console.log(`[nojsx-app:watch] watching ${appRoot}`);

process.on("SIGINT", () => {
  if (debounceTimer) clearTimeout(debounceTimer);
  watcher.close();
  process.exit(0);
});

process.on("SIGTERM", () => {
  if (debounceTimer) clearTimeout(debounceTimer);
  watcher.close();
  process.exit(0);
});
