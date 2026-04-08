import path from 'node:path';
import os from 'node:os';
import process from 'node:process';
import { mkdtemp, readFile, rm, readdir, stat, writeFile } from 'node:fs/promises';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { buildGeneratedLoadersModule, readShellPageLayoutFields } from './shell-page-shared.js';


import { compilePreview } from './compile-tsx-preview.js';



type ProviderInfo = {
  jsxImportSource: string;
  projectRoot: string;
  providerPackageRoot?: string;
  tsconfigPath?: string;
  packageJson?: Record<string, unknown>;
  resolveFrom: string;
  resolved: Record<string, string>;
};

function normalizeRunnerPathOverride(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  return path.resolve(trimmed);
}

function normalizeServerSessionId(value: unknown): string {
  if (typeof value !== 'string') {
    return 'default';
  }

  const trimmed = value.trim();
  return trimmed || 'default';
}

async function readJsonFile(filePath: string): Promise<any> {
  const contents = await readFile(filePath, 'utf8');
  return JSON.parse(contents.replace(/^\uFEFF/, ''));
}

function findNearestPackageRoot(filePath: string): string {
  let current = path.dirname(filePath);
  while (true) {
    if (existsSync(path.join(current, 'package.json'))) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return path.dirname(filePath);
    }
    current = parent;
  }
}

function findNearestTsconfig(startDir: string): string | undefined {
  let current = startDir;
  while (true) {
    const directTsconfig = path.join(current, 'tsconfig.json');
    if (existsSync(directTsconfig)) {
      return directTsconfig;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return undefined;
    }
    current = parent;
  }
}

function readJsxImportSourcePragma(sourceText: string): string | undefined {
  const match = sourceText.match(/@jsxImportSource\s+([^\s*]+)/);
  return match?.[1]?.trim() || undefined;
}

async function readTsconfigJsxImportSource(tsconfigPath?: string): Promise<string | undefined> {
  if (!tsconfigPath) {
    return undefined;
  }

  try {
    const contents = await readFile(tsconfigPath, 'utf8');
    const parsed = JSON.parse(contents.replace(/^\uFEFF/, ''));
    return parsed?.compilerOptions?.jsxImportSource;
  } catch {
    return undefined;
  }
}

function pickExportTarget(exportValue: unknown): string | undefined {
  if (!exportValue) {
    return undefined;
  }
  if (typeof exportValue === 'string') {
    return exportValue;
  }
  if (typeof exportValue === 'object') {
    const exportRecord = exportValue as Record<string, string | undefined>;
    return exportRecord.import || exportRecord.default || exportRecord.require || exportRecord.types;
  }
  return undefined;
}

function resolveSelfPackageExport(packageRoot: string, packageJson: any, specifier: string): string | undefined {
  if (!packageJson?.exports || !packageJson?.name) {
    return undefined;
  }

  if (specifier === packageJson.name) {
    const mainTarget = pickExportTarget(packageJson.exports['.']) || packageJson.main;
    return mainTarget ? path.resolve(packageRoot, mainTarget) : undefined;
  }

  const prefix = `${packageJson.name}/`;
  if (!specifier.startsWith(prefix)) {
    return undefined;
  }

  const requestedSubpath = `./${specifier.slice(prefix.length)}`;
  const exactTarget = pickExportTarget(packageJson.exports[requestedSubpath]);
  if (exactTarget) {
    return path.resolve(packageRoot, exactTarget);
  }

  for (const [exportKey, exportValue] of Object.entries(packageJson.exports)) {
    if (!exportKey.includes('*')) {
      continue;
    }

    const [prefixPart, suffixPart] = exportKey.split('*');
    if (!requestedSubpath.startsWith(prefixPart) || !requestedSubpath.endsWith(suffixPart)) {
      continue;
    }

    const wildcardValue = requestedSubpath.slice(prefixPart.length, requestedSubpath.length - suffixPart.length);
    const targetPattern = pickExportTarget(exportValue);
    if (!targetPattern) {
      continue;
    }

    return path.resolve(packageRoot, targetPattern.replace('*', wildcardValue));
  }

  return undefined;
}

function findPackageRootFromResolvedFile(filePath: string): string | undefined {
  let current = path.dirname(filePath);
  while (true) {
    const pkgPath = path.join(current, 'package.json');
    if (existsSync(pkgPath)) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return undefined;
    }
    current = parent;
  }
}

async function resolveJsxProvider(filePath: string, sourceText: string, runnerPathOverride?: string): Promise<ProviderInfo> {
  const tsconfigPath = findNearestTsconfig(path.dirname(filePath));
  const jsxImportSource = readJsxImportSourcePragma(sourceText)
    || await readTsconfigJsxImportSource(tsconfigPath)
    || undefined;

  if (!jsxImportSource) {
    throw new Error(`Unable to determine jsxImportSource for ${filePath}. Add a file-level @jsxImportSource pragma or set compilerOptions.jsxImportSource in the nearest tsconfig.json.`);
  }

  const projectRoot = findNearestPackageRoot(filePath);
  const projectPackageJsonPath = path.join(projectRoot, 'package.json');
  const projectPackageJson = existsSync(projectPackageJsonPath)
    ? await readJsonFile(projectPackageJsonPath)
    : undefined;
  const resolveFrom = path.join(projectRoot, 'package.json');
  const resolver = createRequire(resolveFrom);
  const runnerSpecifier = `${jsxImportSource}/live-preview-runner`;
  let providerRunnerPath: string | undefined;
  const normalizedRunnerPathOverride = normalizeRunnerPathOverride(runnerPathOverride);
  if (normalizedRunnerPathOverride) {
    if (!existsSync(normalizedRunnerPathOverride)) {
      throw new Error(`[livePreview] tsxPreviewRunnerPath does not exist: ${normalizedRunnerPathOverride}`);
    }
    providerRunnerPath = normalizedRunnerPathOverride;
  } else {
    try {
      providerRunnerPath = resolver.resolve(runnerSpecifier);
    } catch {
      const selfRunnerPath = resolveSelfPackageExport(projectRoot, projectPackageJson, runnerSpecifier);
      if (selfRunnerPath && existsSync(selfRunnerPath)) {
        providerRunnerPath = selfRunnerPath;
      }
    }
  }

  if (!providerRunnerPath) {
    throw new Error(`Unable to resolve ${JSON.stringify(runnerSpecifier)} from project context ${projectRoot}.`);
  }

  const providerPackageRoot = findPackageRootFromResolvedFile(providerRunnerPath);
  const providerPackageJsonPath = providerPackageRoot ? path.join(providerPackageRoot, 'package.json') : undefined;
  const providerPackageJson = providerPackageJsonPath && existsSync(providerPackageJsonPath)
    ? await readJsonFile(providerPackageJsonPath)
    : undefined;
  const runtimeSpecifiers = {
    jsxRuntime: `${jsxImportSource}/jsx-runtime`,
    jsxDevRuntime: `${jsxImportSource}/jsx-dev-runtime`,
    shellRenderer: `${jsxImportSource}/core/components/shell-page-parent-renderer`,
    clientBootstrap: `${jsxImportSource}/core/util/client-bootstrap`,
    components: `${jsxImportSource}/core/components/components`,
  };

  const resolved: Record<string, string> = {};
  for (const [key, specifier] of Object.entries(runtimeSpecifiers)) {
    const providerResolvedPath = providerPackageRoot && providerPackageJson
      ? resolveSelfPackageExport(providerPackageRoot, providerPackageJson, specifier)
      : undefined;
    if (providerResolvedPath && existsSync(providerResolvedPath)) {
      resolved[key] = providerResolvedPath;
      continue;
    }

    try {
      resolved[key] = resolver.resolve(specifier);
    } catch {
      const selfResolvedPath = resolveSelfPackageExport(projectRoot, projectPackageJson, specifier);
      if (selfResolvedPath && existsSync(selfResolvedPath)) {
        resolved[key] = selfResolvedPath;
        continue;
      }

      if (key === 'shellRenderer') {
        throw new Error(`The installed JSX provider package ${JSON.stringify(jsxImportSource)} does not export ${JSON.stringify(specifier)} required for built-in TSX preview.`);
      }
      throw new Error(`Unable to resolve ${JSON.stringify(specifier)} from project context ${projectRoot}.`);
    }
  }

  return {
    jsxImportSource,
    projectRoot,
    providerPackageRoot,
    tsconfigPath,
    packageJson: providerPackageJson || projectPackageJson,
    resolveFrom,
    resolved,
  };
  
}

function resolveProviderSpecifier(provider: ProviderInfo, specifier: string): string {
  const providerResolvedPath = provider.providerPackageRoot && provider.packageJson
    ? resolveSelfPackageExport(provider.providerPackageRoot, provider.packageJson, specifier)
    : undefined;
  if (providerResolvedPath && existsSync(providerResolvedPath)) {
    return providerResolvedPath;
  }

  const resolver = createRequire(provider.resolveFrom);
  try {
    return resolver.resolve(specifier);
  } catch {
    const selfResolvedPath = resolveSelfPackageExport(provider.projectRoot, provider.packageJson, specifier);
    if (selfResolvedPath && existsSync(selfResolvedPath)) {
      return selfResolvedPath;
    }
    throw new Error(`Unable to resolve provider specifier ${JSON.stringify(specifier)} from project context ${provider.projectRoot}.`);
  }
}

function rewriteProviderImportsForNode(source: string, provider: ProviderInfo): string {
  const prefix = `${provider.jsxImportSource}/`;
  const rewriteSpecifier = (specifier: string): string => {
    if (!specifier.startsWith(prefix)) {
      return specifier;
    }

    const targetPath = resolveProviderSpecifier(provider, specifier);
    return pathToFileURL(targetPath).href;
  };

  return source
    .replace(/(from\s+["'])([^"']+)(["'])/g, (_match, start, specifier, end) => `${start}${rewriteSpecifier(specifier)}${end}`)
    .replace(/(import\s+["'])([^"']+)(["'])/g, (_match, start, specifier, end) => `${start}${rewriteSpecifier(specifier)}${end}`);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getPreviewPackageRequestDir(): string {
  const livePreview = (globalThis as any).__livePreview as { requestPath?: string; filePath?: string; projectRoot?: string } | undefined;
  const requestPath = typeof livePreview?.requestPath === 'string'
    ? livePreview.requestPath.replace(/\\/g, '/')
    : '';
  const filePath = typeof livePreview?.filePath === 'string'
    ? livePreview.filePath.replace(/\\/g, '/')
    : '';
  const projectRoot = typeof livePreview?.projectRoot === 'string'
    ? livePreview.projectRoot.replace(/\\/g, '/')
    : '';

  const requestDir = requestPath ? path.posix.dirname(requestPath) : '';
  if (!requestDir || !filePath || !projectRoot) {
    return requestDir;
  }

  const relativeFilePath = path.relative(projectRoot, filePath).replace(/\\/g, '/');
  if (!relativeFilePath || relativeFilePath.startsWith('..')) {
    return requestDir;
  }

  const relativeFileDir = path.posix.dirname(relativeFilePath);
  if (!relativeFileDir || relativeFileDir === '.') {
    return requestDir;
  }

  const relativeDirPattern = new RegExp(`(?:^|/)${escapeRegExp(relativeFileDir)}$`);
  if (relativeDirPattern.test(requestDir)) {
    return requestDir.slice(0, requestDir.length - relativeFileDir.length).replace(/\/+$/, '');
  }

  const requestSegments = requestDir.split('/').filter(Boolean);
  const relativeSegments = relativeFileDir.split('/').filter(Boolean);
  if (relativeSegments.length === 0 || requestSegments.length < relativeSegments.length) {
    return requestDir;
  }

  const tailMatches = relativeSegments.every((segment, index) => requestSegments[requestSegments.length - relativeSegments.length + index] === segment);
  if (!tailMatches) {
    return requestDir;
  }

  const packageSegments = requestSegments.slice(0, requestSegments.length - relativeSegments.length);
  return packageSegments.length > 0 ? `/${packageSegments.join('/')}` : '';
}

function buildProviderBrowserUrl(specifier: string, httpPort: number | undefined, provider: ProviderInfo): string {
  const prefix = `${provider.jsxImportSource}/`;
  if (!specifier.startsWith(prefix)) {
    return specifier;
  }

  if (!(typeof httpPort === 'number' && Number.isFinite(httpPort))) {
    throw new Error('[livePreview] httpPort is required to build browser preview modules.');
  }

  const packageRequestDir = getPreviewPackageRequestDir();
  const providerSubpath = specifier.slice(prefix.length);
  const browserPath = providerSubpath
    ? `node_modules/${provider.jsxImportSource}/${providerSubpath}.js`
    : `node_modules/${provider.jsxImportSource}`;
  const requestRelativePath = packageRequestDir && packageRequestDir !== '.'
    ? path.posix.join(packageRequestDir, browserPath)
    : browserPath;
  return `http://127.0.0.1:${httpPort}/${requestRelativePath.replace(/^\/+/, '')}`;
}

function rewriteProviderImportsForBrowser(source: string, httpPort: number | undefined, provider: ProviderInfo): string {
  const prefix = `${provider.jsxImportSource}/`;
  const rewriteSpecifier = (specifier: string): string => {
    if (!specifier.startsWith(prefix)) {
      return specifier;
    }
    return buildProviderBrowserUrl(specifier, httpPort, provider);
  };

  return source
    .replace(/(from\s+["'])([^"']+)(["'])/g, (_match, start, specifier, end) => `${start}${rewriteSpecifier(specifier)}${end}`)
    .replace(/(import\s+["'])([^"']+)(["'])/g, (_match, start, specifier, end) => `${start}${rewriteSpecifier(specifier)}${end}`);
}

function createDataModuleUrl(source: string): string {
  return `data:text/javascript;base64,${Buffer.from(source, 'utf8').toString('base64')}`;
}

function stripPreviewBootstrap(source: string): string {
  return source
    .replace(/\nif \(!isLivePreviewMode\(\)\) \{[\s\S]*?\n\}/g, '')
    .replace(/\nif \(isLivePreviewMode\(\)\) \{[\s\S]*?\n\}/g, '');
}

function createAutoMountEntryModuleSource(entryModuleUrl: string): string {
  return [
    `import { getLivePreviewHtml } from ${JSON.stringify((globalThis as any).__livePreview.jsxRuntimeSpecifier)};`,
    `import { bootstrapClientRuntime } from ${JSON.stringify(`${(globalThis as any).__livePreview.jsxImportSource}/core/util/client-bootstrap`)};`,
    `import { ShellPageParent } from ${JSON.stringify(`${(globalThis as any).__livePreview.jsxImportSource}/core/components/shell-page-parent`)};`,
    `import * as entry from ${JSON.stringify(entryModuleUrl)};`,
    `const g = globalThis;`,
    `function resolveMountElement() {`,
    `  const configuredMountId = globalThis.__livePreview?.appHostId;`,
    `  if (typeof configuredMountId === 'string' && configuredMountId.trim()) {`,
    `    const configuredMount = document.getElementById(configuredMountId.trim());`,
    `    if (configuredMount) return configuredMount;`,
    `  }`,
    `  const appMount = document.getElementById('app');`,
    `  if (appMount) return appMount;`,
    `  const fallbackMount = document.querySelector('body > div[id]');`,
    `  if (fallbackMount) return fallbackMount;`,
    `  return null;`,
    `}`,
    `const candidates = [entry.preview, entry.default, entry.App, entry.Page, entry.Root];`,
    `const namedRootExport = candidates.find((value) => typeof value === 'function' && typeof value.prototype?.__html === 'function');`,
    `const exportedEntries = Object.entries(entry).filter(([key, value]) => key !== 'default' && typeof value === 'function' && typeof value.prototype?.__html === 'function');`,
    `const fallbackRootExport = exportedEntries.length > 0 ? exportedEntries[exportedEntries.length - 1][1] : undefined;`,
    `const rootExport = namedRootExport ?? fallbackRootExport;`,
    `function isShellPageParentCtor(value) {`,
    `  if (typeof value !== 'function') return false;`,
    `  let ctor = value;`,
    `  while (ctor && ctor.prototype) {`,
    `    if (ctor === ShellPageParent || ctor.name === 'ShellPageParent') return true;`,
    `    const nextProto = Object.getPrototypeOf(ctor.prototype);`,
    `    if (!nextProto || nextProto === Object.prototype) break;`,
    `    ctor = nextProto.constructor;`,
    `  }`,
    `  return false;`,
    `}`,
    `const entryIsShellPageParent = !!g.__livePreview?.entryExtendsShellPageParent || isShellPageParentCtor(rootExport);`,
    `const previewTargetComponentId = 'ShellPageParent.PreviewTSXTargetComponent';`,
    `class PreviewTSXTargetShellPage extends ShellPageParent {`,
    `  static layout_title = '';`,
    `  static layout_cspNonce = 'nsx-importmap';`,
    `  static layout_appHostId = 'info';`,
    `  static layout_bodyClass = '';`,
    `  static layout_head_html = '';`,
    `  static headerAttributes = 'lang="en"';`,
    `  static layout_header = '<div></div>';`,
    `  static layout_footer = '<div></div>';`,
    `  static layout_scripts = '<div></div>';`,
    `  constructor(props) {`,
    `    super({ ...(props || {}) });`,
    `  }`,
    `  html = () => {`,
    `    if (typeof rootExport !== 'function') return '';`,
    `    const target = new rootExport({ __id: previewTargetComponentId });`,
    `    return typeof target?.__html === 'function' ? target.__html() : '';`,
    `  };`,
    `}`,
    `function splitPath(fullPath) {`,
    `  const qIndex = fullPath.indexOf('?');`,
    `  if (qIndex === -1) return { pathname: fullPath || '/', query: '' };`,
    `  return { pathname: fullPath.slice(0, qIndex) || '/', query: fullPath.slice(qIndex + 1) };`,
    `}`,
    `function normalizeRoutePath(pathname) {`,
    `  if (!pathname) return '/';`,
    `  return pathname.startsWith('/') ? pathname : '/' + pathname;`,
    `}`,
    `function getConfiguredPreviewRoute() {`,
    `  const configured = g.__livePreviewRequestPath || g.__livePreview?.requestPath;`,
    `  if (typeof configured !== 'string' || !configured.trim()) return '';`,
    `  const trimmed = configured.trim();`,
    `  const parseCandidate = (value) => {`,
    `    try {`,
    `      const parsed = new URL(value, 'http://preview.local');`,
    `      const fromQuery = parsed.searchParams.get('__nojsx_route');`,
    `      if (fromQuery && fromQuery.trim()) return normalizeRoutePath(fromQuery.trim());`,
    `      const pathname = parsed.pathname || '';`,
    `      if (!pathname || /\.(tsx?|jsx?|html?)$/i.test(pathname)) return '';`,
    `      return normalizeRoutePath(pathname);`,
    `    } catch {`,
    `      if (/\.(tsx?|jsx?|html?)$/i.test(trimmed)) return '';`,
    `      return normalizeRoutePath(trimmed);`,
    `    }`,
    `  };`,
    `  return parseCandidate(trimmed);`,
    `}`,
    `function getPreviewNavPath() {`,
    `  if (typeof window === 'undefined') return '/';`,
    `  const currentUrl = new URL(window.location.href);`,
    `  const routeQuery = currentUrl.searchParams.get('__nojsx_route');`,
    `  if (routeQuery && routeQuery.trim()) return normalizeRoutePath(routeQuery.trim());`,
    `  const rawHash = window.location.hash || '';`,
    `  if (rawHash.startsWith('#/')) return rawHash.slice(1);`,
    `  const configuredRoute = getConfiguredPreviewRoute();`,
    `  if (configuredRoute) return configuredRoute;`,
    `  return '/home';`,
    `}`,
    `function updatePreviewLocation(pathValue) {`,
    `  if (typeof window === 'undefined') return;`,
    `  const normalized = normalizeRoutePath(pathValue);`,
    `  const currentUrl = new URL(window.location.href);`,
    `  currentUrl.searchParams.set('vscode-livepreview', 'true');`,
    `  if (normalized === '/home') currentUrl.searchParams.delete('__nojsx_route');`,
    `  else currentUrl.searchParams.set('__nojsx_route', normalized);`,
    `  try { window.history.pushState({}, '', currentUrl.toString()); } catch {}`,
    `}`,
    `function syncNavState(pathValue) {`,
    `  const normalized = normalizeRoutePath(pathValue);`,
    `  const next = splitPath(normalized);`,
    `  g.__nojsxNav = g.__nojsxNav ?? {};`,
    `  g.__nojsxNav.path = normalized;`,
    `  g.__nojsxNav.pathname = next.pathname;`,
    `  g.__nojsxNav.query = next.query;`,
    `}`,
    `let rootShellComponent = null;`,
    `function getRootInstance() {`,
    `  if (!rootShellComponent) {`,
    `    if (entryIsShellPageParent) {`,
    `      rootShellComponent = new rootExport({});`,
    `    } else {`,
    `      rootShellComponent = new PreviewTSXTargetShellPage({});`,
    `    }`,
    `  }`,
    `  return rootShellComponent;`,
    `}`,
    `function renderRootShell() {`,
    `  const mount = resolveMountElement();`,
    `  if (!mount) throw new Error('Missing live preview mount element');`,
    `  const component = getRootInstance();`,
    `  const componentId = String(component?.id ?? '');`,
    `  const hasMountedRoot = componentId.length > 0 && !!document.querySelector('[data-component-id="' + componentId + '"]');`,
    `  if (hasMountedRoot && typeof component?.render === 'function') {`,
    `    component.render();`,
    `    return;`,
    `  }`,
    `  const html = typeof component?.__html === 'function' ? component.__html() : '';`,
    `  mount.innerHTML = html;`,
    `}`,
    `function renderPreviewRoute() {`,
    `  const outlet = g.__nojsxNavOutlet;`,
    `  if (outlet && typeof outlet.render === 'function') {`,
    `    outlet.render();`,
    `    return;`,
    `  }`,
    `  renderRootShell();`,
    `  const mountedOutlet = g.__nojsxNavOutlet;`,
    `  if (mountedOutlet && typeof mountedOutlet.render === 'function') {`,
    `    mountedOutlet.render();`,
    `  }`,
    `}`,
    `function syncFromLocation() {`,
    `  syncNavState(getPreviewNavPath());`,
    `  renderPreviewRoute();`,
    `}`,
    `function wirePreviewNavigation() {`,
    `  if (typeof window === 'undefined') return;`,
    `  if (window.__nojsxPreviewNavWired) return;`,
    `  window.__nojsxPreviewNavWired = true;`,
    `  document.addEventListener('click', (event) => {`,
    `    const target = event.target;`,
    `    const anchor = target?.closest ? target.closest('a') : null;`,
    `    if (!anchor) return;`,
    `    const rawHref = anchor.getAttribute('href')?.trim();`,
    `    if (!rawHref) return;`,
    `    const isInternal = rawHref.startsWith('/') || rawHref.startsWith('#') || !rawHref.includes(':');`,
    `    if (!isInternal || rawHref.startsWith('#')) return;`,
    `    event.preventDefault();`,
    `    syncNavState(rawHref);`,
    `    updatePreviewLocation(rawHref);`,
    `    renderPreviewRoute();`,
    `  });`,
    `  window.addEventListener('popstate', syncFromLocation);`,
    `  window.addEventListener('hashchange', syncFromLocation);`,
    `}`,
    `if (!rootExport) {`,
    `  throw new Error('Live preview entry module must export an NComponent root as preview, default, App, Page, Root, or another exported NComponent class/function.');`,
    `}`,
    `if (!globalThis.__livePreviewMode && !globalThis.live_preview) {`,
    `  globalThis.__nojsxDevPreviewMode = true;`,
    `  bootstrapClientRuntime();`,
    `  wirePreviewNavigation();`,
    `  syncFromLocation();`,
    `}`,
    `if (globalThis.__livePreviewMode || globalThis.live_preview) {`,
    `  globalThis.__livePreviewHtml = await getLivePreviewHtml();`,
    `}`,
    '',
  ].join('\n');
}

function rewriteRelativeDynamicImportsWithMap(source: string, originalModulePath: string, emittedPathToModuleUrl: Map<string, string>): string {
  return source.replace(/import\((['"])(\.\.?\/[^'"]+)(\1)\)/g, (_match, quote, specifier) => {
    const resolvedPath = path.resolve(path.dirname(originalModulePath), specifier);
    const withExtension = path.extname(resolvedPath) ? resolvedPath : `${resolvedPath}.js`;
    const mappedUrl = emittedPathToModuleUrl.get(path.resolve(withExtension).replace(/\\/g, '/'));
    return `import(${JSON.stringify(mappedUrl || pathToFileURL(withExtension).href)})`;
  });
}

function rewriteStaticRelativeImportsWithMap(source: string, originalModulePath: string, emittedPathToModuleUrl: Map<string, string>): string {
  return source.replace(/(from\s+["'])(\.\.?\/[^"']+)(["'])/g, (_match, start, specifier, end) => {
    const resolvedPath = path.resolve(path.dirname(originalModulePath), specifier);
    const withExtension = path.extname(resolvedPath) ? resolvedPath : `${resolvedPath}.js`;
    const mappedUrl = emittedPathToModuleUrl.get(path.resolve(withExtension).replace(/\\/g, '/'));
    return `${start}${mappedUrl || pathToFileURL(withExtension).href}${end}`;
  });
}

function rewriteProjectBareImports(source: string, moduleMap: Record<string, string>): string {
  const rewriteSpecifier = (specifier: string) => {
    const providerPrefix = (globalThis as any).__livePreview?.jsxImportSource ? `${(globalThis as any).__livePreview.jsxImportSource}/` : undefined;
    if (!specifier || specifier.startsWith('.') || (providerPrefix && specifier.startsWith(providerPrefix)) || specifier.startsWith('node:')) {
      return specifier;
    }

    const mappedPath = moduleMap?.[specifier];
    if (!mappedPath) {
      return specifier;
    }

    if (/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(mappedPath)) {
      return mappedPath;
    }

    return pathToFileURL(mappedPath).href;
  };

  return source
    .replace(/(from\s+["'])([^"']+)(["'])/g, (_match, start, specifier, end) => `${start}${rewriteSpecifier(specifier)}${end}`)
    .replace(/(import\s+["'])([^"']+)(["'])/g, (_match, start, specifier, end) => `${start}${rewriteSpecifier(specifier)}${end}`);
}

function stripSourceMapComment(code: string): string {
  return code.replace(/\n\/\/# sourceMappingURL=.*$/m, '');
}

function discoverImportedCssFiles(filePath: string, sourceText: string): string[] {
  const imports = new Set<string>();
  const importPattern = /import\s+(?:[^"'\n]+?\s+from\s+)?["']([^"']+\.css)["'];?/g;

  for (const match of sourceText.matchAll(importPattern)) {
    const specifier = match[1];
    if (!specifier || !specifier.startsWith('.')) {
      continue;
    }

    const resolved = path.resolve(path.dirname(filePath), specifier);
    if (existsSync(resolved)) {
      imports.add(resolved);
    }
  }

  return [...imports];
}

async function discoverFallbackCssFiles(filePath: string): Promise<string[]> {
  return discoverFallbackCssFilesFrom(filePath);
}

async function discoverFallbackCssFilesFrom(filePath: string): Promise<string[]> {
  const projectRoot = findNearestPackageRoot(filePath);
  const discovered = new Set<string>();
  let current = path.dirname(filePath);
  let discoveredSrcDir: string | undefined;

  while (true) {
    const srcDir = path.join(current, 'src');
    if (existsSync(srcDir)) {
      discoveredSrcDir = srcDir;
      const candidates = [
        path.join(srcDir, 'app.input.css'),
        path.join(srcDir, 'app.css'),
        path.join(srcDir, 'styles', 'app.input.css'),
        path.join(srcDir, 'styles', 'app.css'),
      ];

      for (const candidate of candidates) {
        if (existsSync(candidate)) {
          discovered.add(candidate);
        }
      }
      break;
    }

    if (path.resolve(current) === path.resolve(projectRoot)) {
      break;
    }

    const parent = path.dirname(current);
    if (parent === current || !path.resolve(parent).startsWith(path.resolve(projectRoot))) {
      break;
    }
    current = parent;
  }

  if (discoveredSrcDir) {
    const stylesDir = path.join(discoveredSrcDir, 'styles');
    if (existsSync(stylesDir)) {
      try {
        const styleFiles = await readdir(stylesDir, { withFileTypes: true });
        for (const entry of styleFiles) {
          if (entry.isFile() && /\.css$/i.test(entry.name)) {
            discovered.add(path.join(stylesDir, entry.name));
          }
        }
      } catch {
        // ignore styles directory read failures
      }
    }
  }

  return [...discovered];
}

// ---------------------------------------------------------------------------
// ShellPageParent route generation for live preview
// ---------------------------------------------------------------------------

function isShellPageParentEntry(sourceText: string): boolean {
  return /\bShellPageParent\b/.test(sourceText)
    && /\bextends\s+ShellPageParent\b/.test(sourceText);
}

function discoverPagesDirectory(filePath: string): string | undefined {
  const entryDir = path.dirname(filePath);
  const projectRoot = findNearestPackageRoot(filePath);

  // Convention: look for pages/ relative to the entry file, then in src/pages, then project root/pages
  const candidates = [
    path.join(entryDir, 'pages'),
    path.join(projectRoot, 'src', 'pages'),
    path.join(projectRoot, 'pages'),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

function toExportNameFromPageFile(fileName: string): string {
  const base = fileName.replace(/\.(tsx|ts)$/i, '');
  if (!base) return 'HomePage';
  const pascal = base
    .split(/[-_\s]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
  return pascal.endsWith('Page') ? pascal : `${pascal}Page`;
}

function toRoutePathFromExportName(exportName: string): string {
  const base = exportName.replace(/Page$/, '');
  const kebab = base
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase();
  if (kebab === 'home') return '/home';
  return `/${kebab || 'home'}`;
}

async function buildInMemoryGeneratedLoadersModule(filePath: string, jsxImportSource: string): Promise<{ code: string; pagesFound: number } | null> {
  const shared = await buildGeneratedLoadersModule({
    filePath,
    findNearestPackageRoot,
    jsxImportSource,
    importPathPrefix: 'src/',
  });
  return shared ? { code: shared.code, pagesFound: shared.pagesFound } : null;
}


async function loadRenderer(provider: ProviderInfo): Promise<(props: any) => string> {
  const rendererModulePath = provider.resolved.shellRenderer;
  const rendererModule = await import(pathToFileURL(rendererModulePath).href);
  const renderShellPageParentDocument = rendererModule.renderShellPageParentDocument as ((props: any) => string) | undefined;
  if (typeof renderShellPageParentDocument !== 'function') {
    throw new Error('[livePreview] renderShellPageParentDocument export not found');
  }
  return renderShellPageParentDocument;
}

function runProcess(command: string, args: string[], cwd: string): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    });

    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      reject(new Error(stderr || stdout || `Process exited with code ${code}`));
    });
  });
}

async function buildCssForPreview(filePath: string, tempDir: string, provider: ProviderInfo): Promise<string> {
  const exampleRoot = path.dirname(filePath);
  const sourceText = (globalThis as any).__livePreview?.sourceText ?? '';
  const importedCssFiles = discoverImportedCssFiles(filePath, sourceText);
  const entryCssFiles = importedCssFiles.length > 0
    ? importedCssFiles
    : await discoverFallbackCssFiles(filePath);

  if (entryCssFiles.length === 0) {
    return '';
  }

  if (provider.jsxImportSource !== 'nojsx') {
    return '';
  }

  const cssOutputPath = path.join(tempDir, 'preview.css');
  const providerPackageRoot = path.dirname(path.dirname(provider.resolved.jsxRuntime));
  const cliScript = path.join(providerPackageRoot, 'dist', 'scripts', 'build-tailwind.js');
  const sourceArg = path.relative(providerPackageRoot, exampleRoot).replace(/\\/g, '/');
  const cssParts: string[] = [];

  const isMissingOptionalTailwindDependency = (error: unknown): boolean => {
    const message = String((error as any)?.stack || (error as any)?.message || error || '');
    return /Cannot find module ['"]@parcel\/watcher['"]/i.test(message);
  };

  for (let i = 0; i < entryCssFiles.length; i++) {
    const entryCssPath = entryCssFiles[i];
    const entryOutputPath = entryCssFiles.length === 1
      ? cssOutputPath
      : path.join(tempDir, `preview-${i}.css`);

    try {
      await runProcess('bun', [
        cliScript,
        '--input', path.relative(providerPackageRoot, entryCssPath).replace(/\\/g, '/'),
        '--output', path.relative(providerPackageRoot, entryOutputPath).replace(/\\/g, '/'),
        '--source', sourceArg,
        '--no-minify',
      ], providerPackageRoot);
    } catch (error) {
      if (isMissingOptionalTailwindDependency(error)) {
        console.warn('[livePreview] Skipping preview CSS build because @parcel/watcher is not installed in the consumer package manager layout.');
        return '';
      }
      throw error;
    }

    cssParts.push(await readFile(entryOutputPath, 'utf8'));
  }

  return cssParts.join('\n');
}

async function emitCompiledJs(filePath: string, sourceText: string, outDir: string): Promise<{ emittedJsPath: string; moduleMap: Record<string, string> }> {
  const tempOutDir = path.join(outDir, 'dist');
  mkdirSync(tempOutDir, { recursive: true });
  const serverSessionId = normalizeServerSessionId(
    (globalThis as any).__livePreview?.serverProcessRef
      ?? (globalThis as any).__livePreview?.serverSessionId,
  );
  const compileResult = await compilePreview({
    filePath,
    sourceText,
    outDir: tempOutDir,
    serverProcessRef: serverSessionId,
    serverSessionId,
  });
  const emittedJsPath = compileResult.entryJsPath;
  if (!emittedJsPath) {
    throw new Error(`[livePreview] Preview compile helper did not return an emitted JavaScript path for ${filePath}.`);
  }

  return {
    emittedJsPath,
    moduleMap: compileResult.moduleMap || {},
  };
}

type CompiledPreviewArtifacts = {
  emittedJsPath: string;
  moduleMap: Record<string, string>;
};

function getPreviewShellRoutesVirtualModulePath(filePath: string): string {
  return path.resolve(path.dirname(filePath), '__nojsx_preview_shell_routes.js').replace(/\\/g, '/');
}

async function buildInlinePreviewHtml({
  filePath,
  sourceText,
  tempDir,
  compiled,
}: {
  filePath: string;
  sourceText: string;
  tempDir: string;
  compiled: CompiledPreviewArtifacts;
}): Promise<string> {
  const provider = await resolveJsxProvider(
    filePath,
    sourceText,
    (globalThis as any).__livePreview?.tsxPreviewRunnerPath,
  );
  const renderShellPageParentDocument = await loadRenderer(provider);
  const httpPort = (globalThis as any).__livePreview?.httpPort as number | undefined;
  const entryModuleUrl = await materializeBrowserModuleGraph({
    entryPath: compiled.emittedJsPath,
    httpPort,
    moduleMap: compiled.moduleMap,
    provider,
  });
  const autoMountEntryUrl = createDataModuleUrl(
    rewriteProviderImportsForBrowser(createAutoMountEntryModuleSource(entryModuleUrl), httpPort, provider),
  );
  const css = await buildCssForPreview(filePath, tempDir, provider);
  const runtimeBase = typeof httpPort === 'number' && Number.isFinite(httpPort)
    ? `http://127.0.0.1:${httpPort}`
    : '';
  const shellLayout = isShellPageParentEntry(sourceText)
    ? await readShellPageLayoutFields(filePath)
    : undefined;
  const headExtraHtml = [
    shellLayout?.headHtml || '',
    css ? `<style>\n${css}\n</style>` : '',
  ].filter(Boolean).join('\n');
  const bodyAfterShellHtml = [shellLayout?.footerHtml, shellLayout?.scriptsHtml]
    .filter(Boolean)
    .join('\n');

  return renderShellPageParentDocument({
    title: `${shellLayout?.title || `${provider.jsxImportSource} TSX Preview`} [runner:1.0.34-pathfix]`,
    importMap: {
      [`${provider.jsxImportSource}/jsx-runtime`]: runtimeBase ? buildProviderBrowserUrl(`${provider.jsxImportSource}/jsx-runtime`, httpPort, provider) : pathToFileURL(provider.resolved.jsxRuntime).href,
      [`${provider.jsxImportSource}/jsx-dev-runtime`]: runtimeBase ? buildProviderBrowserUrl(`${provider.jsxImportSource}/jsx-dev-runtime`, httpPort, provider) : pathToFileURL(provider.resolved.jsxDevRuntime).href,
      [`${provider.jsxImportSource}/core/components/components`]: runtimeBase ? buildProviderBrowserUrl(`${provider.jsxImportSource}/core/components/components`, httpPort, provider) : pathToFileURL(provider.resolved.components).href,
      [`${provider.jsxImportSource}/core/util/client-bootstrap`]: runtimeBase ? buildProviderBrowserUrl(`${provider.jsxImportSource}/core/util/client-bootstrap`, httpPort, provider) : pathToFileURL(provider.resolved.clientBootstrap).href,
    },
    shellSrc: '',
    shellScriptHtml: `<script type="module">\nimport ${JSON.stringify(autoMountEntryUrl)};\n</script>`,
    bodyClass: shellLayout?.bodyClass || '',
    appHostId: shellLayout?.appHostId || 'app',
    headerAttributes: shellLayout?.headerAttributes || 'lang="en"',
    headExtraHtml,
    bodyBeforeShellHtml: shellLayout?.headerHtml || '',
    bodyAfterShellHtml,
  });
}

async function materializeBrowserModuleGraph({ entryPath, httpPort, moduleMap, provider }: { entryPath: string; httpPort?: number; moduleMap: Record<string, string>; provider: ProviderInfo }): Promise<string> {
  const livePreviewState = (globalThis as any).__livePreview as { filePath?: string; sourceText?: string; jsxImportSource?: string } | undefined;
  const pendingVirtualModuleSource = new Map<string, string>();
  const injectedShellSpecifier = '__nojsx_preview_shell_routes';

  if (livePreviewState?.filePath && livePreviewState?.sourceText && isShellPageParentEntry(livePreviewState.sourceText)) {
    const virtualModule = await buildInMemoryGeneratedLoadersModule(livePreviewState.filePath, provider.jsxImportSource);
    if (virtualModule) {
      const virtualPath = getPreviewShellRoutesVirtualModulePath(livePreviewState.filePath);
      pendingVirtualModuleSource.set(virtualPath, virtualModule.code);
      moduleMap = {
        ...moduleMap,
        [injectedShellSpecifier]: virtualPath,
      };
    }
  }

  const normalizedModuleSpecs = Object.entries(moduleMap || {});
  const normalizedUniqueEmittedPaths = [...new Set(normalizedModuleSpecs.map(([, emittedPath]) => path.resolve(emittedPath).replace(/\\/g, '/')))];
  const emittedPathToModuleUrl = new Map<string, string>();
  const pendingSourceByPath = new Map<string, string>();

  for (const emittedPath of normalizedUniqueEmittedPaths) {
    const virtualSource = pendingVirtualModuleSource.get(emittedPath);
    pendingSourceByPath.set(emittedPath, virtualSource ?? await readFile(emittedPath, 'utf8'));
    emittedPathToModuleUrl.set(emittedPath, `__NOJSX_PENDING_MODULE_${emittedPathToModuleUrl.size}__`);
  }

  const specifierToModuleUrl: Record<string, string> = {};
  for (const [specifier, emittedPath] of normalizedModuleSpecs) {
    const normalizedEmittedPath = path.resolve(emittedPath).replace(/\\/g, '/');
    const moduleUrl = emittedPathToModuleUrl.get(normalizedEmittedPath);
    if (moduleUrl) {
      specifierToModuleUrl[specifier] = moduleUrl;
    }
  }

  let stabilized = false;
  const normalizedEntryPath = path.resolve(entryPath).replace(/\\/g, '/');
  while (!stabilized) {
    stabilized = true;
    for (const emittedPath of normalizedUniqueEmittedPaths) {
      const isEntryModule = emittedPath === normalizedEntryPath;
      let rewrittenSource = stripSourceMapComment(pendingSourceByPath.get(emittedPath) || '');
      if (!isEntryModule) {
        rewrittenSource = stripPreviewBootstrap(rewrittenSource);
      }
      if (isEntryModule && pendingVirtualModuleSource.size > 0) {
        rewrittenSource = `${rewrittenSource}\nimport ${JSON.stringify(injectedShellSpecifier)};\n`;
      }
      let rewritten = rewriteProviderImportsForBrowser(rewrittenSource, httpPort, provider);
      rewritten = rewriteStaticRelativeImportsWithMap(rewritten, emittedPath, emittedPathToModuleUrl);
      rewritten = rewriteRelativeDynamicImportsWithMap(rewritten, emittedPath, emittedPathToModuleUrl);
      rewritten = rewriteProjectBareImports(rewritten, specifierToModuleUrl);
      const nextUrl = createDataModuleUrl(rewritten);
      if (emittedPathToModuleUrl.get(emittedPath) !== nextUrl) {
        emittedPathToModuleUrl.set(emittedPath, nextUrl);
        stabilized = false;
      }
    }

    for (const [specifier, emittedPath] of normalizedModuleSpecs) {
      const normalizedEmittedPath = path.resolve(emittedPath).replace(/\\/g, '/');
      const moduleUrl = emittedPathToModuleUrl.get(normalizedEmittedPath);
      if (moduleUrl) {
        specifierToModuleUrl[specifier] = moduleUrl;
      }
    }
  }

  const entryModuleUrl = emittedPathToModuleUrl.get(normalizedEntryPath);
  if (!entryModuleUrl) {
    throw new Error(`[livePreview] Failed to materialize browser entry module for ${entryPath}.`);
  }

  return entryModuleUrl;
}

async function materializePreviewModuleGraph({ entryPath, provider, outDir, moduleMap }: { entryPath: string; provider: ProviderInfo; outDir: string; moduleMap: Record<string, string> }): Promise<string> {
  const livePreviewState = (globalThis as any).__livePreview as { filePath?: string; sourceText?: string } | undefined;
  const virtualModuleSourceByPath = new Map<string, string>();
  const injectedShellSpecifier = '__nojsx_preview_shell_routes';
  if (livePreviewState?.filePath && livePreviewState?.sourceText && isShellPageParentEntry(livePreviewState.sourceText)) {
    const virtualModule = await buildInMemoryGeneratedLoadersModule(livePreviewState.filePath, provider.jsxImportSource);
    if (virtualModule) {
      const virtualPath = getPreviewShellRoutesVirtualModulePath(livePreviewState.filePath);
      virtualModuleSourceByPath.set(virtualPath, virtualModule.code);
      moduleMap = {
        ...moduleMap,
        [injectedShellSpecifier]: virtualPath,
      };
    }
  }

  const moduleSpecs = Object.entries(moduleMap || {});
  const uniqueEmittedPaths = [...new Set(moduleSpecs.map(([, emittedPath]) => path.resolve(emittedPath).replace(/\\/g, '/')))];
  const emittedPathToModulePath = new Map<string, string>();
  const emittedPathToModuleUrl = new Map<string, string>();
  const specifierToModuleUrl: Record<string, string> = {};

  for (const emittedPath of uniqueEmittedPaths) {
    const modulePath = path.join(outDir, `${randomUUID()}.mjs`);
    emittedPathToModulePath.set(emittedPath, modulePath);
    emittedPathToModuleUrl.set(emittedPath, pathToFileURL(modulePath).href);
  }

  for (const [specifier, emittedPath] of moduleSpecs) {
    const normalizedEmittedPath = path.resolve(emittedPath).replace(/\\/g, '/');
    const moduleUrl = emittedPathToModuleUrl.get(normalizedEmittedPath);
    if (moduleUrl) {
      specifierToModuleUrl[specifier] = moduleUrl;
    }
  }

  const normalizedEntryPath = path.resolve(entryPath).replace(/\\/g, '/');
  for (const emittedPath of uniqueEmittedPaths) {
    const source = virtualModuleSourceByPath.get(emittedPath) ?? await readFile(emittedPath, 'utf8');
    const isEntryModule = emittedPath === normalizedEntryPath;
    let rewrittenSource = stripSourceMapComment(source);
    if (!isEntryModule) {
      rewrittenSource = stripPreviewBootstrap(rewrittenSource);
    }
    if (isEntryModule && virtualModuleSourceByPath.size > 0) {
      rewrittenSource = `${rewrittenSource}\nimport ${JSON.stringify(injectedShellSpecifier)};\n`;
    }
    let rewritten = rewriteProviderImportsForNode(rewrittenSource, provider);
    rewritten = rewriteStaticRelativeImportsWithMap(rewritten, emittedPath, emittedPathToModuleUrl);
    rewritten = rewriteRelativeDynamicImportsWithMap(rewritten, emittedPath, emittedPathToModuleUrl);
    rewritten = rewriteProjectBareImports(rewritten, specifierToModuleUrl);
    const materializedModulePath = emittedPathToModulePath.get(emittedPath);
    if (!materializedModulePath) {
      throw new Error(`[livePreview] Failed to allocate materialized path for ${emittedPath}.`);
    }
    await writeFile(materializedModulePath, rewritten, 'utf8');
  }

  const entryModulePath = emittedPathToModulePath.get(normalizedEntryPath);
  if (!entryModulePath) {
    throw new Error(`[livePreview] Failed to materialize entry module for ${entryPath}.`);
  }

  return entryModulePath;
}

function createContractBootstrap(moduleUrl: string): string {
  const outputPathExpr = `globalThis.__livePreview.outputPath`;
  return [
    `globalThis.live_preview = true;`,
    `globalThis.__livePreviewMode = true;`,
    `process.env.LIVE_PREVIEW = 'true';`,
    `process.env.LIVE_PREVIEW_MODE = 'true';`,
    `const mod = await import(${JSON.stringify(moduleUrl)});`,
    `let value = mod.default ?? globalThis.__livePreviewHtml;`,
    `if (typeof value !== 'string') {`,
    `  const outputPath = ${outputPathExpr};`,
    `  if (outputPath) {`,
    `    const fs = await import('node:fs/promises');`,
    `    try {`,
    `      value = await fs.readFile(outputPath, 'utf8');`,
    `    } catch {`,
    `      value = value ?? globalThis.__livePreviewHtml;`,
    `    }`,
    `  }`,
    `}`,
    `if (typeof value !== 'string') {`,
    `  throw new Error('Live preview contract must return HTML as a string, set globalThis.__livePreviewHtml, or write HTML to the provided outputPath.');`,
    `}`,
    `export default value;`,
    '',
  ].join('\n');
}

async function compileTsxToModule(filePath: string, sourceText: string, outDir: string): Promise<string> {
  const compiled = await emitCompiledJs(filePath, sourceText, outDir);
  return compileEmittedPreviewToModule(filePath, sourceText, outDir, compiled);
}

async function compileEmittedPreviewToModule(
  filePath: string,
  sourceText: string,
  outDir: string,
  compiled: CompiledPreviewArtifacts,
): Promise<string> {
  const provider = await resolveJsxProvider(
    filePath,
    sourceText,
    (globalThis as any).__livePreview?.tsxPreviewRunnerPath,
  );
  const entryModulePath = await materializePreviewModuleGraph({
    entryPath: compiled.emittedJsPath,
    provider,
    outDir,
    moduleMap: compiled.moduleMap,
  });
  const bootstrapModulePath = path.join(outDir, `${randomUUID()}.entry.mjs`);
  const bootstrapSource = rewriteProviderImportsForNode(
    createAutoMountEntryModuleSource(pathToFileURL(entryModulePath).href),
    provider,
  );
  await writeFile(bootstrapModulePath, bootstrapSource, 'utf8');
  return bootstrapModulePath;
}

export async function renderLivePreview(payload: unknown): Promise<string> {
  const filePath = typeof (payload as any)?.filePath === 'string' ? (payload as any).filePath : '';
  const rawSourceText = (() => {
    if (typeof (payload as any)?.sourceText === 'string') {
      return (payload as any).sourceText;
    }
    if ((payload as any)?.sourceText != null) {
      return String((payload as any).sourceText);
    }
    if (typeof payload === 'string') {
      return payload;
    }
    return '';
  })();

  const sourceText = rawSourceText;
  const tsxPreviewRunnerPath = normalizeRunnerPathOverride((payload as any)?.tsxPreviewRunnerPath);
  const serverSessionId = normalizeServerSessionId((payload as any)?.serverProcessRef ?? (payload as any)?.serverSessionId);
  const serverProcessRef = serverSessionId;

  const artifactRoot = path.join(os.tmpdir(), 'nojsx-live-preview', 'shared');
  const httpPort = typeof (payload as any)?.httpPort === 'number' && Number.isFinite((payload as any).httpPort)
    ? (payload as any).httpPort
    : undefined;
  mkdirSync(artifactRoot, { recursive: true });
  const tempBase = path.join(artifactRoot, 'requests');
  mkdirSync(tempBase, { recursive: true });
  const tempDir = await mkdtemp(path.join(tempBase, 'live-preview-contract-'));
  const projectRoot = findNearestPackageRoot(filePath);
  const provider = await resolveJsxProvider(filePath, sourceText, tsxPreviewRunnerPath);
  const previewSourceText = sourceText;
  const outputPath = path.join(tempDir, 'live-preview-output.html');
  const entryExtendsShellPageParent = isShellPageParentEntry(previewSourceText);
  const shellLayout = entryExtendsShellPageParent
    ? await readShellPageLayoutFields(filePath)
    : undefined;

  (globalThis as any).__livePreview = {
    filePath,
    sourceText: previewSourceText,
    httpPort,
    workingDirectory: projectRoot,
    projectRoot,
    requestPath: typeof (payload as any)?.requestPath === 'string' ? (payload as any).requestPath : undefined,
    appHostId: shellLayout?.appHostId || 'app',
    jsxImportSource: provider.jsxImportSource,
    jsxRuntimeSpecifier: `${provider.jsxImportSource}/jsx-runtime`,
    tsxPreviewRunnerPath,
    serverProcessRef,
    serverSessionId,
    tempDir,
    outputPath,
    entryExtendsShellPageParent,
    mode: 'html',
  };

  try {
    const compiled = await emitCompiledJs(filePath, previewSourceText, tempDir);
    const html = await buildInlinePreviewHtml({ filePath, sourceText: previewSourceText, tempDir, compiled });
    const compiledPath = await compileEmittedPreviewToModule(filePath, previewSourceText, tempDir, compiled);

    const runnerPath = path.join(tempDir, `${randomUUID()}.runner.mjs`);
    const moduleUrl = pathToFileURL(compiledPath).href + `?t=${Date.now()}`;
    (globalThis as any).__livePreview.precomputedHtml = html;
    await writeFile(runnerPath, [
      `globalThis.__livePreview = ${JSON.stringify({
        filePath,
        sourceText: previewSourceText,
        httpPort,
        workingDirectory: projectRoot,
        projectRoot,
        requestPath: typeof (payload as any)?.requestPath === 'string' ? (payload as any).requestPath : undefined,
        appHostId: shellLayout?.appHostId || 'app',
        jsxImportSource: (globalThis as any).__livePreview.jsxImportSource,
        jsxRuntimeSpecifier: (globalThis as any).__livePreview.jsxRuntimeSpecifier,
        tsxPreviewRunnerPath,
        serverProcessRef,
        serverSessionId,
        tempDir,
        outputPath,
        entryExtendsShellPageParent,
        precomputedHtml: html,
        mode: 'html',
      })};`,
      `globalThis.__livePreviewHtml = ${JSON.stringify(html)};`,
      createContractBootstrap(moduleUrl),
    ].join('\n'), 'utf8');
    const result = await import(pathToFileURL(runnerPath).href + `?t=${Date.now()}`);
    const resolvedHtml = String((result as any).default ?? '');

    if (resolvedHtml) {
      return resolvedHtml;
    }

    if (existsSync(outputPath)) {
      const htmlFromOutput = await readFile(outputPath, 'utf8');
      return htmlFromOutput;
    }

    return '';
  } finally {
    await rm(tempDir, { recursive: true, force: true });
    try {
      const requestEntries = await readdir(tempBase, { withFileTypes: true });
      for (const entry of requestEntries) {
        if (entry.isDirectory()) {
          const fullPath = path.join(tempBase, entry.name);
          try {
            const entryStat = await stat(fullPath);
            if (Date.now() - entryStat.mtimeMs > 1000 * 60 * 60) {
              rmSync(fullPath, { recursive: true, force: true });
            }
          } catch {
            // ignore cleanup errors
          }
        }
      }
    } catch {
      // ignore cleanup errors
    }
  }
}

async function main(): Promise<void> {
  const payloadArg = process.argv[2];
  if (!payloadArg) {
    throw new Error('Missing preview payload argument.');
  }

  const payloadJson = payloadArg.startsWith('@')
    ? await readFile(payloadArg.slice(1), 'utf8')
    : payloadArg;
  const payload = JSON.parse(payloadJson.replace(/^\uFEFF/, ''));
  const html = await renderLivePreview(payload);
  process.stdout.write(html);
}

export default renderLivePreview;

const invokedScriptPath = process.argv[1];
const isDirectCliInvocation = typeof invokedScriptPath === 'string'
  && invokedScriptPath.length > 0
  && !invokedScriptPath.startsWith('[')
  && import.meta.url === pathToFileURL(invokedScriptPath).href;

if (isDirectCliInvocation) {
  void main().catch((error) => {
    process.stderr.write(String(error?.stack || error?.message || error));
    process.exit(1);
  });
}

