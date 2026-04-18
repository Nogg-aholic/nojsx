import path from "node:path";
import { buildGeneratedLoadersModule } from "./consumer/loader-generation.js";
import { readShellPageLayoutFields } from "./_nojsx/shell-page.js";
import { renderDevHtmlDocument } from "nojsx/core/shell-page";
import type { BuildNojsxAppOptions, BuildNojsxAppResolvedPaths } from "./types.js";
import { existsSync } from "node:fs";
import { buildAppCss, transpileAppSource, transpileSourceTree } from "./consumer/transpile.js";
import { mkdir } from "node:fs/promises";


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
	const stylesHref = paths.outCssPath ? `${paths.origin}/src/styles/app.css` : undefined;
	return { shellLayout, stylesHref };
}

async function writeOutputHtml(paths: BuildNojsxAppResolvedPaths, preparation: BuildPreparation): Promise<void> {
	const documentHtml = await renderDevHtmlDocument({
		origin: paths.origin,
		shellLayout: preparation.shellLayout,
		websocketUrl: paths.websocketUrl,
		stylesHref: preparation.stylesHref
	});
	await ensureParentDir(paths.outHtmlPath);
	await Bun.write(paths.outHtmlPath, documentHtml);
}

async function writeGeneratedLoaders(paths: BuildNojsxAppResolvedPaths): Promise<void> {
	const loaderJsxImportSource = paths.jsxImportSource === "nojsx/index" || paths.jsxImportSource === "nojsx/index.js"
		? "nojsx"
		: "nojsx";
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
}

export type { BuildNojsxAppOptions } from "./types.js";

export async function buildNojsxApp(options: BuildNojsxAppOptions): Promise<{ outRoot: string }> {
	const paths = resolveBuildPaths(options);
	const preparation = await prepareBuild(paths);
	await writeOutputHtml(paths, preparation);
	await compileBuild(paths, options);
	return { outRoot: paths.outRoot };
}
