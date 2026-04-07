#!/usr/bin/env bun
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
const PROJECT_ROOT = join(import.meta.dir, '..');
const SOURCE_DIST_DIR = join(PROJECT_ROOT, 'dist');
const ROOT_MIRROR_DIR = join(PROJECT_ROOT, '..', 'dist');
await rm(SOURCE_DIST_DIR, { recursive: true, force: true });
await rm(ROOT_MIRROR_DIR, { recursive: true, force: true });
//# sourceMappingURL=clean-dist.js.map