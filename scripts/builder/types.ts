export type BuildNojsxAppDevOptions = {
	appRoot: string;
	origin: string;
	websocketUrl?: string;
	jsxImportSource?: string;
	appHostId?: string;
	shellPagePath?: string;
	pagesRoot?: string;
	stylesEntry?: string;
	outDir?: string;
};

export type BuildNojsxAppOptions = BuildNojsxAppDevOptions;

export type ShellLayoutFields = {
	title: string;
	cspNonce: string;
	appHostId: string;
	bodyClass: string;
	headerAttributes: string;
	headHtml: string;
	headerHtml: string;
	footerHtml: string;
	scriptsHtml: string;
};

export type GeneratedPageModule = {
	fileName: string;
	exportName: string;
	baseExportName: string;
	routePath: string;
	importPath: string;
};

export type GeneratedComponentModule = {
	fileName: string;
	exportName: string;
	importPath: string;
};

export type BuildNojsxAppDevResolvedPaths = {
	appRoot: string;
	origin: string;
	websocketUrl?: string;
	jsxImportSource: string;
	repoRoot: string;
	srcRoot: string;
	upstreamProxyRoot: string;
	consumerGeneratedRoot: string;
	pagesRoot: string;
	shellPagePath: string;
	stylesEntry?: string;
	outRoot: string;
	outSrcRoot: string;
	outUpstreamProxyRoot: string;
	outLoadersPath: string;
	outCssPath?: string;
	outHtmlPath: string;
	appHostId: string;
};

export type BuildNojsxAppResolvedPaths = BuildNojsxAppDevResolvedPaths;