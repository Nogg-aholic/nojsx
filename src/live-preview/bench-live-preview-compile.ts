import os from 'node:os';
import path from 'node:path';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';

import { compilePreview } from './compile-tsx-preview.js';

type BenchResult = {
  iteration: number;
  durationMs: number;
  entryJsPath: string;
  moduleCount: number;
};

async function main(): Promise<void> {
  const filePath = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.resolve('examples/nojsx-app/src/app.tsx');
  const iterationsArg = Number(process.argv[3] || '5');
  const iterations = Number.isFinite(iterationsArg) && iterationsArg > 0 ? Math.floor(iterationsArg) : 5;
  const artifactRoot = path.join(os.tmpdir(), 'nojsx-live-preview', 'manual-bench');
  const sourceText = await readFile(filePath, 'utf8');
  const results: BenchResult[] = [];

  await rm(artifactRoot, { recursive: true, force: true }).catch(() => undefined);
  await mkdir(artifactRoot, { recursive: true });

  for (let index = 0; index < iterations; index += 1) {
    const outDir = path.join(artifactRoot, `request-${index + 1}`, 'dist');
    await mkdir(outDir, { recursive: true });

    const startedAt = performance.now();
    const result = await compilePreview({
      filePath,
      sourceText,
      outDir,
      artifactRoot,
    });
    const durationMs = Number((performance.now() - startedAt).toFixed(1));

    results.push({
      iteration: index + 1,
      durationMs,
      entryJsPath: result.entryJsPath,
      moduleCount: Object.keys(result.moduleMap || {}).length,
    });
  }

  process.stdout.write(`${JSON.stringify({
    filePath,
    iterations,
    artifactRoot,
    results,
  }, null, 2)}\n`);
}

const invokedScriptPath = process.argv[1];
const isDirectCliInvocation = typeof invokedScriptPath === 'string'
  && invokedScriptPath.length > 0
  && !invokedScriptPath.startsWith('[')
  && import.meta.url === new URL(`file://${invokedScriptPath.replace(/\\/g, '/')}`).href;

if (isDirectCliInvocation) {
  void main().catch((error) => {
    process.stderr.write(String(error?.stack || error?.message || error));
    process.exit(1);
  });
}
