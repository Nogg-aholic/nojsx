import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";
import { buildCss } from "./tailwind.js";
import { ensureParentDir } from "../build.js";

function appendJsExtensionToRelativeImports(outputText: string): string {
    return outputText.replace(
        /((?:import|export)\s+(?:[^"'`]*?\s+from\s+)?|import\s*\()(["'])(\.{1,2}\/[^"']+)(\2)/g,
        (_match, prefix: string, quote: string, specifier: string, suffix: string) => {
            if (/\.(?:js|mjs|cjs|json|css|map)$/i.test(specifier)) {
                return `${prefix}${quote}${specifier}${suffix}`;
            }
            if (/\/nojsx(?:\/)?$/i.test(specifier)) {
                return `${prefix}${quote}${specifier}${suffix}`;
            }
            return `${prefix}${quote}${specifier}.js${suffix}`;
        }
    );
}
function toOutputJsPath(srcRoot: string, outSrcRoot: string, sourcePath: string): string {
	const relativeSourcePath = path.relative(srcRoot, sourcePath);
	return path.join(outSrcRoot, relativeSourcePath).replace(/\.(ts|tsx)$/i, ".js");
}
export async function transpileTsModuleToFile(sourcePath: string, outPath: string, jsxImportSource: string, outNojsxRoot?: string): Promise<void> {
	const source = await readFile(sourcePath, "utf8");
    let result: ts.TranspileOutput;
    try {
        result = ts.transpileModule(source, {
            compilerOptions: {
                module: ts.ModuleKind.ESNext,
                target: ts.ScriptTarget.ES2022,
                jsx: ts.JsxEmit.ReactJSX,
                jsxImportSource,
                moduleResolution: ts.ModuleResolutionKind.Bundler
            },
            fileName: sourcePath
        });
    } catch (error) {
        throw new Error(`[nojsx:dev-build] Failed to transpile ${sourcePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
	if (typeof result.outputText !== "string") {
		throw new Error(`[nojsx:dev-build] TypeScript transpile produced no output for ${sourcePath}`);
	}
    let outputText = result.outputText;
	outputText = appendJsExtensionToRelativeImports(outputText);
	await Bun.write(outPath, outputText);
}

export async function transpileSourceTree(params: {
    srcRoot: string;
    outRoot: string;
    jsxImportSource: string;
}): Promise<void> {
    const { srcRoot, outRoot, jsxImportSource } = params;
    if (!existsSync(srcRoot)) {
        return;
    }

    const sourceFiles = await Array.fromAsync(new Bun.Glob("**/*.{ts,tsx}").scan({ cwd: srcRoot, onlyFiles: true }));
    const tasks: Promise<void>[] = [];
    for (const relativePath of sourceFiles) {
        if (/\.d\.ts$/i.test(relativePath)) {
            continue;
        }

        const sourcePath = path.join(srcRoot, relativePath);
        const outPath = toOutputJsPath(srcRoot, outRoot, sourcePath);
        tasks.push((async () => {
            await ensureParentDir(outPath);
            await transpileTsModuleToFile(sourcePath, outPath, jsxImportSource);
        })());
    }

    await Promise.all(tasks);
    }


export async function transpileAppSource(params: {
    srcRoot: string;
    outSrcRoot: string;
    stylesEntry?: string;
    outCssPath?: string;
    repoRoot: string;
    jsxImportSource: string;
}): Promise<void> {
	const { srcRoot, outSrcRoot, stylesEntry, outCssPath, repoRoot, jsxImportSource } = params;
    const sourceFiles = await Array.fromAsync(new Bun.Glob("**/*.{ts,tsx,css}").scan({ cwd: srcRoot, onlyFiles: true }));
    const tasks: Promise<void>[] = [];
    for (const relativePath of sourceFiles) {
        const sourcePath = path.join(srcRoot, relativePath);

        if (stylesEntry && outCssPath && path.resolve(sourcePath) === path.resolve(stylesEntry)) {
            continue;
        }

        if (/\.d\.ts$/i.test(relativePath)) {
            continue;
        }

        if (/\.(ts|tsx)$/i.test(relativePath)) {
            const outPath = toOutputJsPath(srcRoot, outSrcRoot, sourcePath);
            tasks.push((async () => {
                await ensureParentDir(outPath);
				await transpileTsModuleToFile(sourcePath, outPath, jsxImportSource);
            })());
        }
    }

    await Promise.all(tasks);

    if (stylesEntry && outCssPath && existsSync(stylesEntry)) {
        await ensureParentDir(outCssPath);
    }
}

export async function buildAppCss(params: {
    srcRoot: string;
    stylesEntry?: string;
    outCssPath?: string;
    repoRoot: string;
}): Promise<void> {
    const { srcRoot, stylesEntry, outCssPath, repoRoot } = params;

    if (stylesEntry && outCssPath && existsSync(stylesEntry)) {
        await buildCss(stylesEntry, outCssPath, srcRoot, repoRoot);
    }
}
