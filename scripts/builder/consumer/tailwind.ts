import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

function resolveTailwindBuilderRoot(fromDir: string): string {
    const packageJsonProbe = path.join(fromDir, "package.json");
    const requireFromDir = createRequire(existsSync(packageJsonProbe) ? packageJsonProbe : import.meta.url);
	const builderPackageJsonPath = requireFromDir.resolve("nojsx/package.json");
    return path.dirname(builderPackageJsonPath);
}

function resolvePackageRoot(startDir: string): string {
    let current = startDir;
    while (true) {
        const pkgJson = path.join(current, "package.json");
        if (existsSync(pkgJson)) {
            return current;
        }

        const parent = path.dirname(current);
        if (parent === current) {
            break;
        }
        current = parent;
    }

    return path.resolve(startDir, "..");
}

function resolveTailwindCliEntry(builderRoot: string): string {
    const requireFromBuilder = createRequire(path.join(builderRoot, "package.json"));
    const cliPackageJsonPath = requireFromBuilder.resolve("@tailwindcss/cli/package.json");
    const cliPackage = requireFromBuilder(cliPackageJsonPath) as {
        bin?: string | Record<string, string>;
    };
    const binValue = typeof cliPackage.bin === "string"
        ? cliPackage.bin
        : cliPackage.bin?.tailwindcss;

    if (!binValue) {
        throw new Error("Unable to determine @tailwindcss/cli bin entry.");
    }

    return path.resolve(path.dirname(cliPackageJsonPath), binValue);
}

export type TailwindCliOptions = {
    cwd: string;
    input: string;
    output: string;
    minify: boolean;
};

export function parseTailwindCliArgs(argv: string[]): TailwindCliOptions {
    let cwd = process.cwd();
    let input = "";
    let output = "";
    let minify = true;

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];

        if (arg === "--input" || arg === "-i") {
            input = argv[++i] ?? "";
            continue;
        }

        if (arg === "--cwd") {
            cwd = argv[++i] ?? cwd;
            continue;
        }

        if (arg === "--output" || arg === "-o") {
            output = argv[++i] ?? "";
            continue;
        }

        if (arg === "--no-minify") {
            minify = false;
            continue;
        }

        if (arg === "--minify") {
            minify = true;
            continue;
        }
    }

    if (!input || !output) {
        throw new Error("[nojsx] usage: nojsx-build-css --input <path> --output <path> [--no-minify]");
    }

    return {
        cwd: path.resolve(process.cwd(), cwd),
        input: path.resolve(process.cwd(), input),
        output: path.resolve(process.cwd(), output),
        minify,
    };
}

export async function runTailwindCli(options: TailwindCliOptions, builderRoot: string): Promise<number> {
    const cliEntry = resolveTailwindCliEntry(builderRoot);
    const tempDir = await mkdtemp(path.join(builderRoot, ".tailwind-build-"));
    const stagedInputPath = path.join(tempDir, "entry.css");
    const sourceImportUrl = pathToFileURL(options.input).href;
    const stagedSource = `@import ${JSON.stringify(sourceImportUrl)};\n`;

    await writeFile(stagedInputPath, stagedSource, "utf8");

    try {
        const args = [
            cliEntry,
            "--cwd",
            options.cwd,
            "-i",
            stagedInputPath,
            "-o",
            options.output,
        ];

        if (options.minify) {
            args.push("--minify");
        }

        const proc = Bun.spawn([process.execPath, ...args], {
            cwd: builderRoot,
            stdout: "inherit",
            stderr: "inherit",
        });

        return await proc.exited;
    } finally {
        await rm(tempDir, { recursive: true, force: true });
    }
}

export async function buildCss(stylesEntry: string, outputPath: string, srcRoot: string, repoRoot: string): Promise<void> {
    const builderRoot = resolveTailwindBuilderRoot(repoRoot);
    const code = await runTailwindCli({
        cwd: srcRoot,
        input: stylesEntry,
        output: outputPath,
        minify: false,
    }, builderRoot);

    if (code !== 0) {
        throw new Error(`[nojsx] Tailwind CSS build failed with exit code ${code}`);
    }
}

export async function runTailwindCliFromArgv(argv: string[], startDir = import.meta.dir): Promise<number> {
    const builderRoot = resolvePackageRoot(startDir);
    const options = parseTailwindCliArgs(argv);
    return runTailwindCli(options, builderRoot);
}

if (import.meta.main) {
    const code = await runTailwindCliFromArgv(process.argv.slice(2), import.meta.dir);
    process.exit(code);
}
