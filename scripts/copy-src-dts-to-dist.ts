#!/usr/bin/env bun

import { cp, mkdir } from 'node:fs/promises';
import path from 'node:path';

const PROJECT_ROOT = path.join(import.meta.dir, '..');
const SRC_ROOT = path.join(PROJECT_ROOT, 'src');
const DIST_ROOT = path.join(PROJECT_ROOT, 'dist');

const DECLARATION_FILES = [
  'core/global/g.d.ts',
  'core/types/index.d.ts',
] as const;

for (const relativePath of DECLARATION_FILES) {
  const sourcePath = path.join(SRC_ROOT, relativePath);
  const targetPath = path.join(DIST_ROOT, relativePath);
  await mkdir(path.dirname(targetPath), { recursive: true });
  await cp(sourcePath, targetPath);
}