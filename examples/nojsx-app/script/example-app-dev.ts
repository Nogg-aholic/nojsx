#!/usr/bin/env bun
import path from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(scriptDir, "..");

const children = new Set<ChildProcess>();
let shuttingDown = false;

function startProcess(label: string, command: string, args: string[], cwd: string): ChildProcess {
  const child = spawn(command, args, {
    cwd,
    stdio: "inherit",
    windowsHide: true,
    env: process.env,
  });

  children.add(child);

  child.on("exit", (code, signal) => {
    children.delete(child);

    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    for (const other of children) {
      other.kill("SIGTERM");
    }

    if (signal) {
      console.error(`[nojsx-app:dev] ${label} exited with signal ${signal}`);
      process.exit(1);
    }

    process.exit(code ?? 1);
  });

  child.on("error", (error) => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    for (const other of children) {
      other.kill("SIGTERM");
    }

    console.error(`[nojsx-app:dev] failed to start ${label}`, error);
    process.exit(1);
  });

  return child;
}

function shutdown(): void {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  for (const child of children) {
    child.kill("SIGTERM");
  }

  process.exit(0);
}

startProcess("watcher", "bun", [path.join(scriptDir, "example-app-dev-watch.ts")], appRoot);
startProcess("server", "bun", ["--watch", path.join(appRoot, "src", "server.ts")], appRoot);

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
