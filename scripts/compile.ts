#!/usr/bin/env bun

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { cp, mkdir, readdir, readFile, rename, rm } from 'node:fs/promises';
import { join, dirname, relative } from 'node:path';

type PackageJson = {
  name: string;
  version: string;
};

const PACKAGE_NAME = '@nogg-aholic/nojsx';

const PROJECT_ROOT = join(import.meta.dir, '..');
const DIST_ROOT = join(PROJECT_ROOT, 'dist');
const SRC_ROOT = join(PROJECT_ROOT, 'src');
const DECLARATION_FILES = ['core/types/index.d.ts'] as const;
const NPM_COMMAND = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function run(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: PROJECT_ROOT,
      stdio: 'inherit',
      shell: false,
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(' ')} exited with code ${code ?? 'unknown'}`));
    });
  });
}

function isRelative(spec: string): boolean {
  return spec.startsWith('./') || spec.startsWith('../');
}

function hasKnownExtension(spec: string): boolean {
  return /\.(?:js|mjs|cjs|json)$/i.test(spec);
}

function isDirectoryIndexImport(spec: string): boolean {
  return spec.endsWith('/index.js') || spec.endsWith('/index.mjs') || spec.endsWith('/index.cjs');
}

function collectMissing(fromFile: string, contents: string): string[] {
  const missing: string[] = [];

  const register = (spec: string) => {
    if (!isRelative(spec)) return;
    if (hasKnownExtension(spec)) return;
    if (isDirectoryIndexImport(spec)) return;
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

async function walk(dir: string): Promise<string[]> {
  if (!existsSync(dir)) return [];

  const failures: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });

  for (const ent of entries) {
    const abs = join(dir, ent.name);
    if (ent.isDirectory()) {
      failures.push(...(await walk(abs)));
      continue;
    }

    if (!ent.isFile()) continue;
    if (!abs.endsWith('.js') && !abs.endsWith('.mjs')) continue;
    if (abs.endsWith('.js.map') || abs.endsWith('.mjs.map')) continue;

    const contents = await readFile(abs, 'utf8');
    failures.push(...collectMissing(abs, contents));
  }

  return failures;
}

async function collectJsFiles(dir: string): Promise<string[]> {
  if (!existsSync(dir)) return [];

  const files: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });

  for (const ent of entries) {
    const abs = join(dir, ent.name);
    if (ent.isDirectory()) {
      files.push(...(await collectJsFiles(abs)));
      continue;
    }

    if (!ent.isFile()) continue;
    if (!abs.endsWith('.js') && !abs.endsWith('.mjs')) continue;
    if (abs.endsWith('.js.map') || abs.endsWith('.mjs.map')) continue;
    files.push(abs);
  }

  return files;
}

async function cleanDist(): Promise<void> {
  await rm(DIST_ROOT, { recursive: true, force: true });
}

async function copyDeclarations(): Promise<void> {
  for (const relativePath of DECLARATION_FILES) {
    const sourcePath = join(SRC_ROOT, relativePath);
    const targetPath = join(DIST_ROOT, relativePath);
    await mkdir(dirname(targetPath), { recursive: true });
    await cp(sourcePath, targetPath);
  }
}

function toPosix(value: string): string {
  return value.replace(/\\/g, '/');
}

function rewriteNojsxSelfImports(fromFile: string, contents: string): string {
  const fromDir = dirname(fromFile);
  const rewriteSpecifier = (subpath: string): string => {
    const targetPath = join(DIST_ROOT, subpath.endsWith('.js') || subpath.endsWith('.mjs') ? subpath : `${subpath}.js`);
    let spec = toPosix(relative(fromDir, targetPath));
    if (!spec.startsWith('.')) spec = `./${spec}`;
    return spec;
  };

  const patterns = [
    /(from\s*)(["'])@nogg-aholic\/nojsx\/([^"']+)\2/g,
    /(import\(\s*)(["'])@nogg-aholic\/nojsx\/([^"']+)\2/g,
  ] as const;

  let next = contents;
  for (const pattern of patterns) {
    next = next.replace(pattern as RegExp, (...args: string[]) => {
      if (args.length >= 4 && (args[1] === 'from ' || args[1] === 'import(' || args[1].startsWith('from') || args[1].startsWith('import('))) {
        const prefix = args[1];
        const quote = args[2];
        const subpath = args[3];
        return `${prefix}${quote}${rewriteSpecifier(subpath)}${quote}`;
      }
      return args[0];
    });
  }

  return next;
}

async function rewriteDistSelfImports(): Promise<void> {
  const files = await collectJsFiles(DIST_ROOT);
  for (const filePath of files) {
    const current = await readFile(filePath, 'utf8');
    const next = rewriteNojsxSelfImports(filePath, current);
    if (next !== current) {
      await Bun.write(filePath, next);
    }
  }
}

async function assertDistRelativeImportExtensions(): Promise<void> {
  const failures = await walk(DIST_ROOT);
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

async function packTgz(): Promise<void> {
  const pkg = JSON.parse(await Bun.file(join(PROJECT_ROOT, 'package.json')).text()) as PackageJson;
  const packedBaseName = pkg.name.replace(/^@/, '').replace(/\//g, '-');
  const versionedTgzName = `${packedBaseName}-${pkg.version}.tgz`;
  const versionedTgzPath = join(PROJECT_ROOT, versionedTgzName);
  const stableTgzName = `${PACKAGE_NAME.replace(/^@/, '').replace(/\//g, '-')}.tgz`;
  const stableTgzPath = join(PROJECT_ROOT, stableTgzName);
  const legacyStableTgzPath = join(PROJECT_ROOT, 'nojsx.tgz');

  if (existsSync(versionedTgzPath)) {
    await rm(versionedTgzPath, { force: true });
  }
  if (existsSync(stableTgzPath)) {
    await rm(stableTgzPath, { force: true });
  }
  if (existsSync(legacyStableTgzPath)) {
    await rm(legacyStableTgzPath, { force: true });
  }

  await run(NPM_COMMAND, ['pack', '--pack-destination', '.']);

  if (!existsSync(versionedTgzPath)) {
    console.error(`[nojsx] Expected packed tarball not found: ${versionedTgzName}`);
    process.exit(1);
  }

  await rename(versionedTgzPath, stableTgzPath);
  console.log(`[nojsx] packed ${stableTgzName}`);
}

async function main(): Promise<void> {
	const shouldPack = process.argv.includes('--pack');

  await cleanDist();
  await run('node', ['./node_modules/typescript/bin/tsc', '-p', 'tsconfig.json']);
  await rewriteDistSelfImports();
  await copyDeclarations();
  await run('node', ['./node_modules/typescript/bin/tsc', '-p', 'tsconfig.scripts.json']);
  await assertDistRelativeImportExtensions();
	if (shouldPack) {
		await packTgz();
	}
}

await main();
