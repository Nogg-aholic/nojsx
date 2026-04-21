import path from "node:path";
import { cp, mkdir, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { buildGeneratedLoadersModule } from "./consumer/loader-generation.js";
import { readShellPageLayoutFields } from "./_nojsx/shell-page.js";
import { renderDevHtmlDocument } from "@nogg-aholic/nojsx/core/shell-page";
import type { BuildNojsxAppOptions, BuildNojsxAppResolvedPaths } from "./types.js";
import { existsSync } from "node:fs";
import { buildAppCss, transpileAppSource, transpileSourceTree } from "./consumer/transpile.js";


const DEFAULT_STATIC_RUNTIME_PACKAGES = ["@nogg-aholic/nojsx", "@nogg-aholic/nrpc"];

function normalizePackageMountName(packageName: string): string {
	return packageName.startsWith("@nogg-aholic/") ? packageName.slice("@nogg-aholic/".length) : packageName;
}

function createImportMap(params: {
	origin: string;
	target: BuildNojsxAppOptions["target"];
	extension?: Record<string, string>;
}): Record<string, string> {
	const { origin, target, extension } = params;
	const assetBase = target === "static" ? "./_pkg" : `${origin}/_pkg`;
	return {
		"@nogg-aholic/nojsx": `${assetBase}/nojsx/index.js`,
		"@nogg-aholic/nojsx/": `${assetBase}/nojsx/`,
		"@nogg-aholic/nojsx/index.js": `${assetBase}/nojsx/index.js`,
		"@nogg-aholic/nojsx/jsx-runtime": `${assetBase}/nojsx/jsx-runtime.js`,
		"@nogg-aholic/nojsx/jsx-dev-runtime": `${assetBase}/nojsx/jsx-dev-runtime.js`,
		"@nogg-aholic/nrpc": `${assetBase}/nrpc/index.js`,
		"@nogg-aholic/nrpc/": `${assetBase}/nrpc/`,
		...(extension ?? {}),
	};
}

function resolveStaticRuntimePackages(options: BuildNojsxAppOptions): string[] {
	if (options.target !== "static") {
		return [];
	}

	const configured = options.static?.copyRuntimePackages;
	if (!configured?.length) {
		return [...DEFAULT_STATIC_RUNTIME_PACKAGES];
	}

	return Array.from(new Set(configured));
}


function resolveWebsocketUrl(origin: string, websocketUrl?: string): string | undefined {
	if (websocketUrl) {
		return websocketUrl;
	}

	try {
		const url = new URL(origin);
		url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
		url.pathname = "/ws";
		url.search = "";
		url.hash = "";
		return url.toString();
	} catch {
		return undefined;
	}
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
	return startDir;
}

function resolveBuildPaths(options: BuildNojsxAppOptions): BuildNojsxAppResolvedPaths {
	const appRoot = path.resolve(options.appRoot);
	const repoRoot = resolvePackageRoot(appRoot);
	const srcRoot = path.join(appRoot, "src");
	const upstreamProxyRoot = path.join(appRoot, "upstreamProxy");
	const consumerGeneratedRoot = srcRoot;
	const pagesRoot = options.pagesRoot ? path.resolve(appRoot, options.pagesRoot) : path.join(srcRoot, "pages");
	const shellPagePath = options.shellPagePath ? path.resolve(appRoot, options.shellPagePath) : path.join(srcRoot, "app.tsx");
	const requestedStylesEntry = options.stylesEntry ? path.resolve(appRoot, options.stylesEntry) : path.join(srcRoot, "styles", "app.css");
	const stylesEntry = existsSync(requestedStylesEntry) ? requestedStylesEntry : undefined;
	const outRoot = options.outDir ? path.resolve(appRoot, options.outDir) : path.join(appRoot, "dist");
	const outSrcRoot = path.join(outRoot, "src");
	const outCssPath = stylesEntry ? path.join(outSrcRoot, "styles", "app.css") : undefined;
	return {
		appRoot,
		origin: options.origin,
		websocketUrl: resolveWebsocketUrl(options.origin, options.websocketUrl),
		jsxImportSource: options.jsxImportSource ?? "nojsx",
		target: options.target ?? "dev-server",
		importMap: createImportMap({
			origin: options.origin,
			target: options.target ?? "dev-server",
			extension: options.importMap?.extend,
		}),
		staticRuntimePackages: resolveStaticRuntimePackages(options),
		repoRoot,
		srcRoot,
		upstreamProxyRoot,
		consumerGeneratedRoot,
		pagesRoot,
		shellPagePath,
		stylesEntry,
		outRoot,
		outSrcRoot,
		outUpstreamProxyRoot: path.join(outRoot, "upstreamProxy"),
		outLoadersPath: path.join(outSrcRoot, "__nojsx_component_loaders.js"),
		outCssPath,
		outHtmlPath: path.join(outRoot, "index.html"),
		appHostId: options.appHostId ?? "app"
	};
}

type BuildPreparation = {
	shellLayout: Awaited<ReturnType<typeof readShellPageLayoutFields>>;
	stylesHref?: string;
};
export async function ensureParentDir(filePath: string): Promise<void> {
	await mkdir(path.dirname(filePath), { recursive: true });
}
async function prepareBuild(paths: BuildNojsxAppResolvedPaths): Promise<BuildPreparation> {
	const shellLayout = await readShellPageLayoutFields(paths.shellPagePath, { appHostId: paths.appHostId });
	const stylesHref = !paths.outCssPath
		? undefined
		: paths.target === "static"
			? "./src/styles/app.css"
			: `${paths.origin}/src/styles/app.css`;
	return { shellLayout, stylesHref };
}

async function writeOutputHtml(paths: BuildNojsxAppResolvedPaths, preparation: BuildPreparation): Promise<void> {
	const documentHtml = await renderDevHtmlDocument({
		origin: paths.target === "static" ? "." : paths.origin,
		importMap: paths.importMap,
		shellLayout: preparation.shellLayout,
		websocketUrl: paths.target === "static" ? undefined : paths.websocketUrl,
		stylesHref: preparation.stylesHref
	});
	await ensureParentDir(paths.outHtmlPath);
	await Bun.write(paths.outHtmlPath, documentHtml);
}

async function copyExportedPackageAssets(params: {
	packageName: string;
	appRoot: string;
	outRoot: string;
}): Promise<void> {
	const { packageName, appRoot, outRoot } = params;
	const requireFromApp = createRequire(path.join(appRoot, "package.json"));
	const packageJsonPath = requireFromApp.resolve(`${packageName}/package.json`);
	const packageRoot = path.dirname(packageJsonPath);
	const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8")) as {
		exports?: Record<string, { import?: string } | string>;
		main?: string;
	};
	const mountedName = normalizePackageMountName(packageName);
	const copied = new Set<string>();
	const copyTarget = async (relativeExportPath: string): Promise<void> => {
		if (!relativeExportPath.startsWith("./dist/")) {
			return;
		}
		const normalizedPath = relativeExportPath.replace(/^\.\//, "");
		if (copied.has(normalizedPath)) {
			return;
		}
		copied.add(normalizedPath);
		const sourcePath = path.join(packageRoot, normalizedPath);
		const targetPath = path.join(outRoot, "_pkg", mountedName, normalizedPath.replace(/^dist\//, ""));
		await ensureParentDir(targetPath);
		await cp(sourcePath, targetPath, { force: true });
	};

	const exportValues = Object.values(packageJson.exports ?? {});
	for (const exportValue of exportValues) {
		if (typeof exportValue === "string") {
			await copyTarget(exportValue);
			continue;
		}
		if (exportValue?.import) {
			await copyTarget(exportValue.import);
		}
	}

	if (typeof packageJson.main === "string") {
		await copyTarget(packageJson.main);
	}
}

async function copyStaticRuntimePackages(paths: BuildNojsxAppResolvedPaths): Promise<void> {
	if (paths.target !== "static") {
		return;
	}

	for (const packageName of paths.staticRuntimePackages) {
		await copyExportedPackageAssets({
			packageName,
			appRoot: paths.appRoot,
			outRoot: paths.outRoot,
		});
	}
}

async function writeGeneratedLoaders(paths: BuildNojsxAppResolvedPaths): Promise<void> {
	const loaderJsxImportSource = paths.jsxImportSource === "nojsx/index" || paths.jsxImportSource === "nojsx/index.js"
		? "@nogg-aholic/nojsx"
		: paths.jsxImportSource;
	const loaders = await buildGeneratedLoadersModule({
		pagesDir: paths.pagesRoot,
		shellPagePath: paths.shellPagePath,
		sourceRoot: path.dirname(paths.pagesRoot),
		importPathPrefix: "./",
		jsxImportSource: loaderJsxImportSource
	});
	await ensureParentDir(paths.outLoadersPath);
	await Bun.write(paths.outLoadersPath, loaders?.code ?? "");
}

async function compileBuild(paths: BuildNojsxAppResolvedPaths, options: BuildNojsxAppOptions): Promise<void> {
	await transpileAppSource({
		srcRoot: paths.srcRoot,
		outSrcRoot: paths.outSrcRoot,
		stylesEntry: paths.stylesEntry,
		outCssPath: paths.outCssPath,
		repoRoot: paths.repoRoot,
		jsxImportSource: paths.jsxImportSource,
	});
	await transpileSourceTree({
		srcRoot: paths.upstreamProxyRoot,
		outRoot: paths.outUpstreamProxyRoot,
		jsxImportSource: paths.jsxImportSource,
	});
	await writeGeneratedLoaders(paths);
	await buildAppCss({
		srcRoot: paths.srcRoot,
		stylesEntry: paths.stylesEntry,
		outCssPath: paths.outCssPath,
		repoRoot: paths.repoRoot,
	});
	await copyStaticRuntimePackages(paths);
}

export type { BuildNojsxAppOptions } from "./types.js";

export async function buildNojsxApp(options: BuildNojsxAppOptions): Promise<{ outRoot: string }> {
	const paths = resolveBuildPaths(options);
	const preparation = await prepareBuild(paths);
	await writeOutputHtml(paths, preparation);
	await compileBuild(paths, options);
	return { outRoot: paths.outRoot };
}
