#!/usr/bin/env bun

import { existsSync } from 'node:fs';
import { readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

type PackageJson = {
  name?: string;
  version?: string;
  scripts?: Record<string, string>;
};

const PROJECT_ROOT = join(import.meta.dir, '..');
const EXAMPLES_ROOT = join(PROJECT_ROOT, 'examples');
const ROOT_PACKAGE_JSON_PATH = join(PROJECT_ROOT, 'package.json');

function bumpPatchVersion(version: string): string {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)(.*)$/);
  if (!match) {
    throw new Error(`[nojsx] Cannot bump unsupported version format: ${version}`);
  }

  const [, major, minor, patch, suffix] = match;
  return `${major}.${minor}.${Number(patch) + 1}${suffix}`;
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, 'utf8')) as T;
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(value, null, '\t')}\n`, 'utf8');
}

async function findExampleDirs(): Promise<string[]> {
  if (!existsSync(EXAMPLES_ROOT)) {
    return [];
  }

  const entries = await readdir(EXAMPLES_ROOT, { withFileTypes: true });
  const exampleDirs: string[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const exampleDir = join(EXAMPLES_ROOT, entry.name);
    if (existsSync(join(exampleDir, 'package.json'))) {
      exampleDirs.push(exampleDir);
    }
  }

  return exampleDirs.sort((a, b) => a.localeCompare(b));
}

async function bumpRootPackageVersion(): Promise<string> {
  const pkg = await readJson<PackageJson>(ROOT_PACKAGE_JSON_PATH);
  const currentVersion = pkg.version;
  if (!currentVersion) {
    throw new Error('[nojsx] package.json is missing a version field');
  }

  const nextVersion = bumpPatchVersion(currentVersion);
  pkg.version = nextVersion;
  await writeJson(ROOT_PACKAGE_JSON_PATH, pkg);
  return nextVersion;
}

async function removeIfExists(targetPath: string): Promise<void> {
  if (!existsSync(targetPath)) {
    return;
  }
  await rm(targetPath, { recursive: true, force: true });
}

async function run(command: string[], cwd: string): Promise<void> {
  const proc = Bun.spawn(command, {
    cwd,
    stdout: 'inherit',
    stderr: 'inherit',
    stdin: 'inherit',
  });

  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    process.exit(exitCode);
  }
}

const nextVersion = await bumpRootPackageVersion();
console.log(`[nojsx] bumped package version to ${nextVersion}`);

await run(['bun', 'run', 'pack:tgz'], PROJECT_ROOT);

const exampleDirs = await findExampleDirs();

if (exampleDirs.length === 0) {
  console.log('[nojsx] no example projects found');
  process.exit(0);
}

for (const exampleDir of exampleDirs) {
  console.log(`[nojsx] refreshing ${exampleDir}`);
  await removeIfExists(join(exampleDir, 'node_modules'));
  await removeIfExists(join(exampleDir, 'package-lock.json'));
  await removeIfExists(join(exampleDir, 'bun.lock'));
  await run(['bun', 'install'], exampleDir);

  const examplePkg = await readJson<PackageJson>(join(exampleDir, 'package.json'));
  const buildScript = examplePkg.scripts?.build;
  if (buildScript) {
    await run(['bun', 'run', 'build'], exampleDir);
  }
}
