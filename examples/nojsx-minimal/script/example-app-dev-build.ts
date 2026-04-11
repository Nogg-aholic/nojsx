#!/usr/bin/env bun
import { buildNojsxAppDev } from '../../../src/dev/build-nojsx-app-dev.js';

type BuildOptions = {
  appRoot: string;
  origin: string;
  websocketUrl?: string;
  jsxImportSource?: string;
};

export async function buildExampleAppDev(options: BuildOptions): Promise<{ devRoot: string }> {
  return buildNojsxAppDev({
    appRoot: options.appRoot,
    origin: options.origin,
    websocketUrl: options.websocketUrl,
    jsxImportSource: options.jsxImportSource,
    appHostId: 'app',
  });
}

function readCliArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) {
    return undefined;
  }
  return process.argv[index + 1];
}

async function main(): Promise<void> {
  const appRoot = readCliArg('--app-root') ?? '.';
  const origin = readCliArg('--origin') ?? 'http://127.0.0.1:4174';
  const websocketUrl = readCliArg('--websocket-url');
  const jsxImportSource = readCliArg('--jsx-import-source');

  await buildExampleAppDev({
    appRoot,
    origin,
    websocketUrl,
    jsxImportSource,
  });
}

if (import.meta.main) {
  await main();
}
