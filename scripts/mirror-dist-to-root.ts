#!/usr/bin/env bun

import { cp, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const PROJECT_ROOT = join(import.meta.dir, '..');
const SOURCE_DIST_DIR = join(PROJECT_ROOT, 'dist');
const ROOT_MIRROR_DIR = join(PROJECT_ROOT, '..', 'dist');

async function main(): Promise<void> {
	if (!existsSync(SOURCE_DIST_DIR)) return;

	await rm(ROOT_MIRROR_DIR, { recursive: true, force: true });
	await mkdir(ROOT_MIRROR_DIR, { recursive: true });
	await cp(SOURCE_DIST_DIR, ROOT_MIRROR_DIR, { recursive: true });
}

await main();