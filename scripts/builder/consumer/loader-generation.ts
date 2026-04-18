import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";
import type { GeneratedComponentModule, GeneratedPageModule } from "../types.js";

function toExportNameFromPageFile(fileName: string): string {
	const base = fileName.replace(/\.(tsx|ts)$/i, "");
	if (!base) return "HomePage";
	const pascal = base
		.split(/[-_\s]+/g)
		.filter(Boolean)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join("");
	return pascal.endsWith("Page") ? pascal : `${pascal}Page`;
}

function toRoutePathFromPageFile(fileName: string): string {
	const base = fileName
		.replace(/\.(tsx|ts)$/i, "")
		.trim()
		.toLowerCase();
	if (!base || base === "home") return "/home";
	return `/${base}`;
}

async function resolveExportNameFromSourceFile(filePath: string, fallbackFileName: string): Promise<string> {
	const sourceText = await readFile(filePath, "utf8");
	const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
	let preferred: string | undefined;

	const visit = (node: ts.Node) => {
		if (preferred) return;

		if ((ts.isClassDeclaration(node) || ts.isFunctionDeclaration(node)) && node.name?.text) {
			const isExported = node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);
			if (isExported && node.name.text.endsWith("Page")) {
				preferred = node.name.text;
				return;
			}
		}

		ts.forEachChild(node, visit);
	};

	visit(sourceFile);
	return preferred ?? toExportNameFromPageFile(fallbackFileName);
}

export async function buildGeneratedLoadersModule(options: {
	pagesDir?: string;
	shellPagePath?: string;
	sourceRoot?: string;
	importPathPrefix?: string;
	jsxImportSource: string;
}): Promise<{ code: string; pagesFound: number; pages: GeneratedPageModule[] } | null> {
	const pagesDir = options.pagesDir;
	if (!pagesDir) return null;

	const entries = await readdir(pagesDir, { withFileTypes: true });
	const files = entries
		.filter((entry) => entry.isFile() && /\.(tsx|ts)$/i.test(entry.name))
		.map((entry) => entry.name)
		.sort((a, b) => a.localeCompare(b));

	if (files.length === 0) {
		return null;
	}

	const sourceRoot = options.sourceRoot;
	if (!sourceRoot) {
		throw new Error("buildGeneratedLoadersModule requires sourceRoot when pagesDir is provided.");
	}

	const importPathPrefix = options.importPathPrefix ?? "src/";
	const pages: GeneratedPageModule[] = await Promise.all(
		files.map(async (pageFile) => {
			const absPath = path.join(pagesDir, pageFile);
			const relFromSrc = path.relative(sourceRoot, absPath).replace(/\\/g, "/").replace(/\.(tsx|ts)$/i, "");
			const exportName = await resolveExportNameFromSourceFile(absPath, pageFile);
			const baseExportName = exportName.replace(/Page$/, "") || exportName;
			return {
				fileName: pageFile,
				exportName,
				baseExportName,
				routePath: toRoutePathFromPageFile(pageFile),
				importPath: `${importPathPrefix}${relFromSrc}`
			};
		})
	);

	const componentsDir = path.join(sourceRoot, "components");
	const componentModules: GeneratedComponentModule[] = existsSync(componentsDir)
		? (await readdir(componentsDir, { withFileTypes: true }))
				.filter((entry) => entry.isFile() && /\.(tsx|ts)$/i.test(entry.name))
				.map((entry) => entry.name)
				.sort((a, b) => a.localeCompare(b))
				.map((componentFile) => {
					const absPath = path.join(componentsDir, componentFile);
					const relFromSrc = path.relative(sourceRoot, absPath).replace(/\\/g, "/").replace(/\.(tsx|ts)$/i, "");
					return {
						fileName: componentFile,
						exportName: toExportNameFromPageFile(componentFile).replace(/Page$/, ""),
						importPath: `${importPathPrefix}${relFromSrc}`
					};
				})
		: [];

	const shellPagePath = options.shellPagePath;
	const shellModules: Array<{ importPath: string; exportName: string }> = [];
	if (shellPagePath && existsSync(shellPagePath)) {
		const relFromSrc = path.relative(sourceRoot, shellPagePath).replace(/\\/g, "/").replace(/\.(tsx|ts)$/i, "");
		shellModules.push({
			importPath: `${importPathPrefix}${relFromSrc}`,
			exportName: "default"
		});
	}

	const modules = [
		...shellModules.map((shell) => ({ importPath: shell.importPath, exportName: shell.exportName, aliasExportName: "ShellPage" })),
		...pages.map((page) => ({ importPath: page.importPath, exportName: page.exportName, aliasExportName: page.baseExportName })),
		...componentModules.map((component) => ({ importPath: component.importPath, exportName: component.exportName }))
	];

	const withJsExtension = (importPath: string): string => importPath.endsWith('.js') ? importPath : `${importPath}.js`;
	const importLines = modules.map((mod, index) => `import * as M${index} from ${JSON.stringify(withJsExtension(mod.importPath))};`);
	const loaderLines = modules.flatMap((mod, index) => {
		const ctorExpr = mod.exportName === "default" ? `M${index}.default` : `M${index}[${JSON.stringify(mod.exportName)}]`;
		const lines = [
			`if (M${index} && ${ctorExpr}) {`,
			`  __g.__nojsxComponentLoaders[${JSON.stringify(mod.exportName)}] = (props) => new ${ctorExpr}(props);`
		];
		if ("aliasExportName" in mod && typeof mod.aliasExportName === "string" && mod.aliasExportName.length > 0 && mod.aliasExportName !== mod.exportName) {
			lines.push(`  __g.__nojsxComponentLoaders[${JSON.stringify(mod.aliasExportName)}] = (props) => new ${ctorExpr}(props);`);
		}
		lines.push("}");
		return lines;
	});
	const routeLines = pages.map((page) => `  ${JSON.stringify(page.routePath)}: { componentName: ${JSON.stringify(page.exportName)} },`);
	const pagesLines = pages.map((page) => `  ${JSON.stringify(page.exportName)}: ${JSON.stringify(page.routePath)},`);

	const nojsxLoaderImportPath = options.jsxImportSource === "nojsx/index" || options.jsxImportSource === "nojsx/index.js"
		? "@nogg-aholic/nojsx"
		: options.jsxImportSource;

	const code = [
		`import { nojsxComponentLoaders } from ${JSON.stringify(nojsxLoaderImportPath)};`,
		...importLines,
		"const __g = globalThis;",
		"__g.__nojsxComponentLoaders = __g.__nojsxComponentLoaders ?? nojsxComponentLoaders ?? {};",
		...loaderLines,
		"export const nojsxPageRoutes = {",
		...routeLines,
		"};",
		"__g.__nojsxPageRoutes = nojsxPageRoutes;",
		"export const nojsxPages = {",
		...pagesLines,
		"};",
		"__g.__nojsxPages = nojsxPages;",
		""
	].join("\n");

	return { code, pagesFound: pages.length, pages };
}