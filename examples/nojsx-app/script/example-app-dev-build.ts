#!/usr/bin/env bun
import { buildNojsxAppDev } from '../../../src/dev/build-nojsx-app-dev.js';

type BuildOptions = {
  appRoot: string;
  origin: string;
  jsxImportSource?: string;
};

export async function buildExampleAppDev(options: BuildOptions): Promise<{ devRoot: string }> {
  return buildNojsxAppDev({
    appRoot: options.appRoot,
    origin: options.origin,
    jsxImportSource: options.jsxImportSource,
    appHostId: 'info',
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
  const origin = readCliArg('--origin') ?? 'http://127.0.0.1:4173';
  const jsxImportSource = readCliArg('--jsx-import-source');

  await buildExampleAppDev({
    appRoot,
    origin,
    jsxImportSource,
  });
}

if (import.meta.main) {
  await main();
}
