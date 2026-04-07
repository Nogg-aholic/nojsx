#!/usr/bin/env bun
import { existsSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
const PROJECT_ROOT = join(import.meta.dir, '..');
const EXAMPLES = [
    join(PROJECT_ROOT, 'examples', 'nojsx-app'),
    join(PROJECT_ROOT, 'examples', 'nojsx-minimal'),
];
async function removeIfExists(targetPath) {
    if (!existsSync(targetPath)) {
        return;
    }
    await rm(targetPath, { recursive: true, force: true });
}
async function run(command, cwd) {
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
await run(['bun', 'run', 'pack:tgz'], PROJECT_ROOT);
for (const exampleDir of EXAMPLES) {
    await removeIfExists(join(exampleDir, 'node_modules'));
    await removeIfExists(join(exampleDir, 'package-lock.json'));
    await removeIfExists(join(exampleDir, 'bun.lock'));
    await run(['bun', 'install'], exampleDir);
}
//# sourceMappingURL=refresh-examples.js.map