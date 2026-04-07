#!/usr/bin/env bun
import path from "node:path";
import { existsSync } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { renderShellPageParentDocument } from "../src/core/components/shell-page-parent-renderer.js";
function toRoutePath(fileName) {
    const base = fileName.replace(/\.(tsx|ts)$/i, "");
    if (base.toLowerCase() === "home")
        return "/home";
    return `/${base.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase()}`;
}
function toExportName(fileName) {
    const base = fileName.replace(/\.(tsx|ts)$/i, "");
    return `${base.charAt(0).toUpperCase()}${base.slice(1)}Page`;
}
async function discoverPages(pagesRoot) {
    const entries = await Array.fromAsync(new Bun.Glob("*.{ts,tsx}").scan({ cwd: pagesRoot }));
    return entries.sort((a, b) => a.localeCompare(b)).map((fileName) => ({
        fileName,
        exportName: toExportName(fileName),
        routePath: toRoutePath(fileName),
        importPath: `./pages/${fileName.replace(/\.(tsx|ts)$/i, ".js")}`,
    }));
}
async function buildLoaderModule(pagesRoot, jsxImportSource) {
    const pages = await discoverPages(pagesRoot);
    const importLines = pages.map((page, index) => `import * as M${index} from ${JSON.stringify(page.importPath)};`);
    const loaderLines = pages.flatMap((page, index) => [
        `if (M${index} && M${index}[${JSON.stringify(page.exportName)}]) {`,
        `  __g.__nojsxComponentLoaders[${JSON.stringify(page.exportName)}] = (props) => new M${index}[${JSON.stringify(page.exportName)}](props);`,
        `}`,
    ]);
    const routeLines = pages.map((page) => `  ${JSON.stringify(page.routePath)}: { componentName: ${JSON.stringify(page.exportName)} },`);
    const pageLines = pages.map((page) => `  ${JSON.stringify(page.exportName)}: ${JSON.stringify(page.routePath)},`);
    return [
        `import { nojsxComponentLoaders } from ${JSON.stringify(`${jsxImportSource}/core/global/registry`)};`,
        ...importLines,
        "const __g = globalThis;",
        "__g.__nojsxComponentLoaders = __g.__nojsxComponentLoaders ?? nojsxComponentLoaders ?? {};",
        ...loaderLines,
        "export const nojsxPageRoutes = {",
        ...routeLines,
        "};",
        "__g.__nojsxPageRoutes = nojsxPageRoutes;",
        "export const nojsxPages = {",
        ...pageLines,
        "};",
        "__g.__nojsxPages = nojsxPages;",
        "",
    ].join("\n");
}
function stripOuterParens(text) {
    const trimmed = text.trim();
    if (trimmed.startsWith("(") && trimmed.endsWith(")")) {
        return trimmed.slice(1, -1).trim();
    }
    return trimmed;
}
async function readShellPageLayoutFields(shellPagePath) {
    const sourceText = await readFile(shellPagePath, "utf8");
    const sourceFile = ts.createSourceFile(shellPagePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const out = {
        title: "NUI",
        cspNonce: "nojsx-importmap",
        appHostId: "info",
        bodyClass: "",
        headerAttributes: 'lang="en"',
        headHtml: "",
        headerHtml: "",
        footerHtml: "",
        scriptsHtml: "",
    };
    const byName = {
        layout_title: "title",
        layout_cspNonce: "cspNonce",
        layout_appHostId: "appHostId",
        layout_bodyClass: "bodyClass",
        layout_headerAttributes: "headerAttributes",
        headerAttributes: "headerAttributes",
        layout_head_html: "headHtml",
        layout_header: "headerHtml",
        layout_footer: "footerHtml",
        layout_scripts: "scriptsHtml",
    };
    const setValue = (propName, initializer) => {
        const outKey = byName[propName];
        if (!outKey || !initializer)
            return;
        if (ts.isStringLiteral(initializer) || ts.isNoSubstitutionTemplateLiteral(initializer)) {
            out[outKey] = initializer.text;
            return;
        }
        out[outKey] = stripOuterParens(sourceText.slice(initializer.pos, initializer.end));
    };
    const visit = (node) => {
        if (ts.isClassDeclaration(node) && node.name?.text === "ShellPage") {
            for (const member of node.members) {
                if (!ts.isPropertyDeclaration(member))
                    continue;
                const isStatic = member.modifiers?.some((m) => m.kind === ts.SyntaxKind.StaticKeyword);
                if (!isStatic || !member.name || !ts.isIdentifier(member.name))
                    continue;
                setValue(member.name.text, member.initializer);
            }
        }
        ts.forEachChild(node, visit);
    };
    visit(sourceFile);
    return out;
}
function resolvePackageRoot(startDir) {
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
    return startDir;
}
function runProcess(command, args, cwd) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            cwd,
            windowsHide: true,
            stdio: ["ignore", "pipe", "pipe"],
            env: process.env,
        });
        let stderr = "";
        let stdout = "";
        child.stdout.setEncoding("utf8");
        child.stderr.setEncoding("utf8");
        child.stdout.on("data", (chunk) => {
            stdout += chunk;
        });
        child.stderr.on("data", (chunk) => {
            stderr += chunk;
        });
        child.on("error", reject);
        child.on("close", (code) => {
            if (code === 0) {
                resolve();
                return;
            }
            reject(new Error(stderr || stdout || `Process exited with code ${code}`));
        });
    });
}
async function buildCssForDev(stylesEntry, outputPath, srcRoot, repoRoot) {
    const tailwindBuilder = path.join(repoRoot, "scripts", "build-tailwind.ts");
    await runProcess("bun", [
        tailwindBuilder,
        "--input", stylesEntry,
        "--output", outputPath,
        "--source", srcRoot,
        "--no-minify",
    ], repoRoot);
}
async function transpileTsModuleToFile(sourcePath, outPath, jsxImportSource) {
    const source = await readFile(sourcePath, "utf8");
    const result = ts.transpileModule(source, {
        compilerOptions: {
            module: ts.ModuleKind.ESNext,
            target: ts.ScriptTarget.ES2022,
            jsx: ts.JsxEmit.ReactJSX,
            jsxImportSource,
            moduleResolution: ts.ModuleResolutionKind.Bundler,
        },
        fileName: sourcePath,
    });
    await Bun.write(outPath, result.outputText);
}
async function ensureParentDir(filePath) {
    await mkdir(path.dirname(filePath), { recursive: true });
}
function toDevJsPath(srcRoot, devSrcRoot, sourcePath) {
    const relativeSourcePath = path.relative(srcRoot, sourcePath);
    return path.join(devSrcRoot, relativeSourcePath).replace(/\.(ts|tsx)$/i, ".js");
}
async function copyNojsxDistIntoDevRoot(repoRoot, devNojsxRoot) {
    const distRoot = path.join(repoRoot, "dist");
    const files = await Array.fromAsync(new Bun.Glob("**/*").scan({ cwd: distRoot, onlyFiles: true }));
    for (const relativePath of files) {
        const sourcePath = path.join(distRoot, relativePath);
        const targetPath = path.join(devNojsxRoot, relativePath);
        await ensureParentDir(targetPath);
        await Bun.write(targetPath, Bun.file(sourcePath));
    }
}
async function transpileNojsxSourceIntoDevRoot(repoRoot, devNojsxRoot) {
    const sourceRoot = path.join(repoRoot, 'src');
    const sourceFiles = await Array.fromAsync(new Bun.Glob('**/*.{ts,tsx,js}').scan({ cwd: sourceRoot, onlyFiles: true }));
    for (const relativePath of sourceFiles) {
        const sourcePath = path.join(sourceRoot, relativePath);
        const targetPath = path.join(devNojsxRoot, relativePath).replace(/\.(ts|tsx)$/i, '.js');
        await ensureParentDir(targetPath);
        if (/\.(ts|tsx)$/i.test(relativePath)) {
            await transpileTsModuleToFile(sourcePath, targetPath, 'nojsx');
            continue;
        }
        await Bun.write(targetPath, Bun.file(sourcePath));
    }
}
export async function buildExampleAppDev(options) {
    const appRoot = path.resolve(options.appRoot);
    const origin = options.origin;
    const jsxImportSource = options.jsxImportSource ?? "nojsx";
    const repoRoot = resolvePackageRoot(path.dirname(fileURLToPath(import.meta.url)));
    const srcRoot = path.join(appRoot, "src");
    const pagesRoot = path.join(srcRoot, "pages");
    const shellPagePath = path.join(srcRoot, "app.tsx");
    const stylesEntry = path.join(srcRoot, "styles", "app.css");
    const devRoot = path.join(appRoot, ".nojsx-dev");
    const devSrcRoot = path.join(devRoot, "src");
    const devNojsxRoot = path.join(devRoot, "nojsx");
    const devLoadersPath = path.join(devSrcRoot, "__nojsx_component_loaders.js");
    const devCssPath = path.join(devSrcRoot, "styles", "app.css");
    const devHtmlPath = path.join(devRoot, "index.html");
    const shellLayout = await readShellPageLayoutFields(shellPagePath);
    const documentHtml = renderShellPageParentDocument({
        title: shellLayout.title,
        importMap: {
            "nojsx/jsx-runtime": `${origin}/nojsx/jsx-runtime.js`,
            "nojsx/jsx-dev-runtime": `${origin}/nojsx/jsx-dev-runtime.js`,
            "nojsx/core/components/components": `${origin}/nojsx/core/components/components.js`,
            "nojsx/core/components/nav-outlet": `${origin}/nojsx/core/components/nav-outlet.js`,
            "nojsx/core/components/shell-page-parent": `${origin}/nojsx/core/components/shell-page-parent.js`,
            "nojsx/core/components/shell-page-parent-renderer": `${origin}/nojsx/core/components/shell-page-parent-renderer.js`,
            "nojsx/core/util/client-bootstrap": `${origin}/nojsx/core/util/client-bootstrap.js`,
            "nojsx/core/global/registry": `${origin}/nojsx/core/global/registry.js`,
        },
        cspNonce: shellLayout.cspNonce,
        cspContent: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self';",
        shellScriptHtml: `<script type="module" src="${origin}/src/main.js"></script>`,
        appHostId: shellLayout.appHostId,
        headExtraHtml: `${shellLayout.headHtml}\n<link rel="stylesheet" href="${origin}/src/styles/app.css" />`,
        bodyClass: shellLayout.bodyClass,
        headerAttributes: shellLayout.headerAttributes,
        bodyBeforeShellHtml: shellLayout.headerHtml,
        bodyAfterShellHtml: [shellLayout.footerHtml, shellLayout.scriptsHtml].filter(Boolean).join("\n"),
    });
    await ensureParentDir(devHtmlPath);
    await Bun.write(devHtmlPath, documentHtml);
    const sourceFiles = await Array.fromAsync(new Bun.Glob("**/*.{ts,tsx,css}").scan({ cwd: srcRoot, onlyFiles: true }));
    for (const relativePath of sourceFiles) {
        const sourcePath = path.join(srcRoot, relativePath);
        if (relativePath === "styles/app.css") {
            await ensureParentDir(devCssPath);
            await buildCssForDev(stylesEntry, devCssPath, srcRoot, repoRoot);
            continue;
        }
        if (/\.(ts|tsx)$/i.test(relativePath)) {
            const outPath = toDevJsPath(srcRoot, devSrcRoot, sourcePath);
            await ensureParentDir(outPath);
            await transpileTsModuleToFile(sourcePath, outPath, jsxImportSource);
        }
    }
    if (existsSync(stylesEntry)) {
        await ensureParentDir(devCssPath);
        await buildCssForDev(stylesEntry, devCssPath, srcRoot, repoRoot);
    }
    await ensureParentDir(devLoadersPath);
    await Bun.write(devLoadersPath, await buildLoaderModule(pagesRoot, jsxImportSource));
    await copyNojsxDistIntoDevRoot(repoRoot, devNojsxRoot);
    await transpileNojsxSourceIntoDevRoot(repoRoot, devNojsxRoot);
    return { devRoot };
}
function parseArgs(argv) {
    let appRoot = "";
    let origin = "";
    let jsxImportSource = "nojsx";
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === "--app-root") {
            appRoot = argv[++i] ?? "";
            continue;
        }
        if (arg === "--origin") {
            origin = argv[++i] ?? "";
            continue;
        }
        if (arg === "--jsx-import-source") {
            jsxImportSource = argv[++i] ?? "nojsx";
            continue;
        }
    }
    if (!appRoot || !origin) {
        throw new Error("usage: bun scripts/example-app-dev-build.ts --app-root <path> --origin <url> [--jsx-import-source nojsx]");
    }
    return { appRoot, origin, jsxImportSource };
}
if (import.meta.main) {
    try {
        const options = parseArgs(process.argv.slice(2));
        await buildExampleAppDev(options);
    }
    catch (error) {
        console.error(String(error));
        process.exit(1);
    }
}
//# sourceMappingURL=example-app-dev-build.js.map