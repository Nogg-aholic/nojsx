#!/usr/bin/env bun

import { existsSync } from 'node:fs';
import { rename, rm } from 'node:fs/promises';
import { join } from 'node:path';

type PackageJson = {
  name: string;
  version: string;
};

const PROJECT_ROOT = join(import.meta.dir, '..');
const pkg = JSON.parse(await Bun.file(join(PROJECT_ROOT, 'package.json')).text()) as PackageJson;

const versionedTgzName = `${pkg.name}-${pkg.version}.tgz`;
const versionedTgzPath = join(PROJECT_ROOT, versionedTgzName);
const stableTgzName = `${pkg.name}.tgz`;
const stableTgzPath = join(PROJECT_ROOT, stableTgzName);

if (existsSync(versionedTgzPath)) {
  await rm(versionedTgzPath, { force: true });
}
if (existsSync(stableTgzPath)) {
  await rm(stableTgzPath, { force: true });
}

const packProc = Bun.spawn(['npm', 'pack', '--pack-destination', '.'], {
  cwd: PROJECT_ROOT,
  stdout: 'inherit',
  stderr: 'inherit',
});

const packCode = await packProc.exited;
if (packCode !== 0) {
  process.exit(packCode);
}

if (!existsSync(versionedTgzPath)) {
  console.error(`[nojsx] Expected packed tarball not found: ${versionedTgzName}`);
  process.exit(1);
}

await rename(versionedTgzPath, stableTgzPath);
console.log(`[nojsx] packed ${stableTgzName}`);
