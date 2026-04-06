#!/usr/bin/env bun
import path from "node:path";
import os from "node:os";
import process from "node:process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync, mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

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

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const NSX_ROOT = resolvePackageRoot(SCRIPT_DIR);
const requireFromNsx = createRequire(path.join(NSX_ROOT, "package.json"));

function resolveTailwindCssEntry(): string {
  return requireFromNsx.resolve("tailwindcss/index.css");
}

function resolveTailwindCliEntry(): string {
  const cliPackageJsonPath = requireFromNsx.resolve("@tailwindcss/cli/package.json");
  const cliPackage = requireFromNsx(cliPackageJsonPath) as {
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

type CliOptions = {
  input: string;
  output: string;
  minify: boolean;
  source: string[];
};

function parseArgs(argv: string[]): CliOptions {
  let input = "";
  let output = "";
  let minify = true;
  const source: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === "--input" || arg === "-i") {
      input = argv[++i] ?? "";
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

    if (arg === "--source" || arg === "-s") {
      const sourceValue = argv[++i] ?? "";
      if (sourceValue) {
        source.push(sourceValue);
      }
      continue;
    }
  }

  if (!input || !output) {
    console.error("[nsx] usage: njsx-build-css --input <path> --output <path> [--no-minify]");
    process.exit(1);
  }

  return {
    input: path.resolve(process.cwd(), input),
    output: path.resolve(process.cwd(), output),
    minify,
    source,
  };
}

async function buildInputWithInjectedSources(opts: CliOptions): Promise<{ inputPath: string; cleanup: () => Promise<void> }> {
  if (!opts.source.length) {
    return {
      inputPath: opts.input,
      cleanup: async () => {},
    };
  }

  const tailwindCssEntry = resolveTailwindCssEntry().replace(/\\/g, "/");
  const inputCss = (await readFile(opts.input, "utf8"))
    .replace(/@import\s+"tailwindcss"\s*;/g, `@import ${JSON.stringify(tailwindCssEntry)};`)
    .replace(/@import\s+'tailwindcss'\s*;/g, `@import ${JSON.stringify(tailwindCssEntry)};`);
  const injected = opts.source
    .map((entry) => `@source ${JSON.stringify(path.resolve(process.cwd(), entry).replace(/\\/g, "/"))};`)
    .join("\n");

  const inputDir = path.dirname(opts.input);
  const parsedInputDir = path.parse(inputDir);
  const relativeInputDir = inputDir.slice(parsedInputDir.root.length);
  const sanitizedRoot = parsedInputDir.root.replace(/[:\\/]+/g, "_");
  const tempRoot = path.join(os.tmpdir(), "nojsx-tailwind", sanitizedRoot, relativeInputDir);
  mkdirSync(tempRoot, { recursive: true });
  const tempDir = await mkdtemp(path.join(tempRoot, "injected-"));
  const tempInputPath = path.join(tempDir, `.nsx-tailwind-${randomUUID()}.css`);
  await writeFile(tempInputPath, `${injected}\n\n${inputCss}`, "utf8");

  return {
    inputPath: tempInputPath,
    cleanup: async () => {
      await rm(tempDir, { recursive: true, force: true });
    },
  };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const temp = await buildInputWithInjectedSources(opts);
  const cliEntry = resolveTailwindCliEntry();

  const args = [
    cliEntry,
    "-i",
    temp.inputPath,
    "-o",
    opts.output,
  ];

  if (opts.minify) {
    args.push("--minify");
  }

  const proc = Bun.spawn([process.execPath, ...args], {
    cwd: process.cwd(),
    stdout: "inherit",
    stderr: "inherit",
  });

  const code = await proc.exited;
  await temp.cleanup();
  process.exit(code);
}

void main();
