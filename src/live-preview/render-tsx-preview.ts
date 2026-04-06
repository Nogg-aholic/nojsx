import path from 'node:path';
import os from 'node:os';
import process from 'node:process';
import { mkdtemp, readFile, rm, readdir, stat, writeFile } from 'node:fs/promises';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

type ProviderInfo = {
  jsxImportSource: string;
  projectRoot: string;
  providerPackageRoot?: string;
  tsconfigPath?: string;
  packageJson?: Record<string, unknown>;
  resolveFrom: string;
  resolved: Record<string, string>;
};

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

async function resolveJsxProvider(filePath: string, sourceText: string): Promise<ProviderInfo> {
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
  try {
    providerRunnerPath = resolver.resolve(runnerSpecifier);
  } catch {
    const selfRunnerPath = resolveSelfPackageExport(projectRoot, projectPackageJson, runnerSpecifier);
    if (selfRunnerPath && existsSync(selfRunnerPath)) {
      providerRunnerPath = selfRunnerPath;
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
  return source.replace(/(from\s+["'])([^"']+)(["'])/g, (_match, start, specifier, end) => {
    if (!specifier.startsWith(prefix)) {
      return `${start}${specifier}${end}`;
    }

    const targetPath = resolveProviderSpecifier(provider, specifier);
    return `${start}${pathToFileURL(targetPath).href}${end}`;
  });
}

function rewriteProviderImportsForBrowser(source: string, httpPort: number | undefined, provider: ProviderInfo): string {
  const prefix = `${provider.jsxImportSource}/`;
  return source.replace(/(from\s+["'])([^"']+)(["'])/g, (_match, start, specifier, end) => {
    if (!specifier.startsWith(prefix)) {
      return `${start}${specifier}${end}`;
    }

    if (!(typeof httpPort === 'number' && Number.isFinite(httpPort))) {
      throw new Error('[livePreview] httpPort is required to build browser preview modules.');
    }
    const targetPath = resolveProviderSpecifier(provider, specifier);
    const relativeTarget = path.relative(findNearestPackageRoot(provider.projectRoot), targetPath).replace(/\\/g, '/');
    const targetUrl = `http://127.0.0.1:${httpPort}/${relativeTarget}`;
    return `${start}${targetUrl}${end}`;
  });
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
    `import { livePreviewJSX, getLivePreviewHtml } from ${JSON.stringify((globalThis as any).__livePreview.jsxRuntimeSpecifier)};`,
    `import * as entry from ${JSON.stringify(entryModuleUrl)};`,
    `const candidates = [entry.preview, entry.default, entry.App, entry.Page, entry.Root];`,
    `const rootExport = candidates.find((value) => typeof value === 'function' && typeof value.prototype?.__html === 'function');`,
    `if (!rootExport) {`,
    `  throw new Error('Live preview entry module must export an NComponent root as preview, default, App, Page, or Root.');`,
    `}`,
    `if (!globalThis.__livePreviewMode && !globalThis.live_preview) {`,
    `  const root = document.getElementById('app');`,
    `  if (!root) throw new Error('Missing #app element');`,
    `  livePreviewJSX(rootExport, {}, { mount: root });`,
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

function discoverFallbackCssFiles(filePath: string): string[] {
  const exampleRoot = path.dirname(filePath);
  const candidates = [
    path.join(exampleRoot, 'app.input.css'),
    path.join(exampleRoot, 'app.css'),
    path.join(exampleRoot, 'styles', 'app.input.css'),
    path.join(exampleRoot, 'styles', 'app.css'),
    path.join(exampleRoot, 'css', 'app.input.css'),
    path.join(exampleRoot, 'css', 'app.css'),
  ];

  return candidates.filter((candidate, index) => existsSync(candidate) && candidates.indexOf(candidate) === index);
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
    : discoverFallbackCssFiles(filePath);

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

  for (let i = 0; i < entryCssFiles.length; i++) {
    const entryCssPath = entryCssFiles[i];
    const entryOutputPath = entryCssFiles.length === 1
      ? cssOutputPath
      : path.join(tempDir, `preview-${i}.css`);

    await runProcess('bun', [
      cliScript,
      '--input', path.relative(providerPackageRoot, entryCssPath).replace(/\\/g, '/'),
      '--output', path.relative(providerPackageRoot, entryOutputPath).replace(/\\/g, '/'),
      '--source', sourceArg,
      '--no-minify',
    ], providerPackageRoot);

    cssParts.push(await readFile(entryOutputPath, 'utf8'));
  }

  return cssParts.join('\n');
}

async function emitCompiledJs(filePath: string, sourceText: string, outDir: string): Promise<{ emittedJsPath: string; moduleMap: Record<string, string> }> {
  const tempOutDir = path.join(outDir, 'dist');
  mkdirSync(tempOutDir, { recursive: true });
  const compileScriptPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'compile-tsx-preview.js');
  const { stdout } = await runProcess(process.execPath, [
    compileScriptPath,
    JSON.stringify({
      filePath,
      sourceText,
      outDir: tempOutDir,
    }),
  ], process.cwd());
  const compileResult = JSON.parse(stdout.trim() || '{}') as { entryJsPath?: string; moduleMap?: Record<string, string> };
  const emittedJsPath = compileResult.entryJsPath;
  if (!emittedJsPath) {
    throw new Error(`[livePreview] Preview compile helper did not return an emitted JavaScript path for ${filePath}.`);
  }

  if (process.env.LIVE_PREVIEW_DEBUG_DUMP === 'true') {
    const debugDumpPath = path.join(process.cwd(), 'tmp-live-preview-compile-result.json');
    await writeFile(debugDumpPath, JSON.stringify(compileResult, null, 2), 'utf8');
  }

  return {
    emittedJsPath,
    moduleMap: compileResult.moduleMap || {},
  };
}

async function buildInlinePreviewHtml({ filePath, sourceText, tempDir }: { filePath: string; sourceText: string; tempDir: string }): Promise<string> {
  const provider = await resolveJsxProvider(filePath, sourceText);
  const renderShellPageParentDocument = await loadRenderer(provider);
  const httpPort = (globalThis as any).__livePreview?.httpPort as number | undefined;
  const { emittedJsPath: compiledJsPath, moduleMap } = await emitCompiledJs(filePath, sourceText, tempDir);
  const entryModuleUrl = await materializeBrowserModuleGraph({
    entryPath: compiledJsPath,
    httpPort,
    moduleMap,
    provider,
  });
  const autoMountEntryUrl = createDataModuleUrl(
    rewriteProviderImportsForBrowser(createAutoMountEntryModuleSource(entryModuleUrl), httpPort, provider),
  );
  const css = await buildCssForPreview(filePath, tempDir, provider);
  const runtimeBase = typeof httpPort === 'number' && Number.isFinite(httpPort)
    ? `http://127.0.0.1:${httpPort}`
    : '';
  const urlBaseRoot = findNearestPackageRoot(provider.projectRoot);

  return renderShellPageParentDocument({
    title: `${provider.jsxImportSource} TSX Preview`,
    importMap: {
      [`${provider.jsxImportSource}/jsx-runtime`]: runtimeBase ? `http://127.0.0.1:${httpPort}/${path.relative(urlBaseRoot, provider.resolved.jsxRuntime).replace(/\\/g, '/')}` : pathToFileURL(provider.resolved.jsxRuntime).href,
      [`${provider.jsxImportSource}/core/components/components`]: runtimeBase ? `http://127.0.0.1:${httpPort}/${path.relative(urlBaseRoot, provider.resolved.components).replace(/\\/g, '/')}` : pathToFileURL(provider.resolved.components).href,
      [`${provider.jsxImportSource}/core/util/client-bootstrap`]: runtimeBase ? `http://127.0.0.1:${httpPort}/${path.relative(urlBaseRoot, provider.resolved.clientBootstrap).replace(/\\/g, '/')}` : pathToFileURL(provider.resolved.clientBootstrap).href,
    },
    shellSrc: '',
    shellScriptHtml: `<script type="module">\nimport ${JSON.stringify(autoMountEntryUrl)};\n</script>`,
    bodyClass: 'grid min-h-screen place-items-center bg-slate-100 p-6',
    appHostId: 'app',
    headerAttributes: 'lang="en"',
    headExtraHtml: css ? `<style>\n${css}\n</style>` : '',
  });
}

async function materializeBrowserModuleGraph({ entryPath, httpPort, moduleMap, provider }: { entryPath: string; httpPort?: number; moduleMap: Record<string, string>; provider: ProviderInfo }): Promise<string> {
  const moduleSpecs = Object.entries(moduleMap || {});
  const uniqueEmittedPaths = [...new Set(moduleSpecs.map(([, emittedPath]) => path.resolve(emittedPath).replace(/\\/g, '/')))];
  const emittedPathToModuleUrl = new Map<string, string>();
  const pendingSourceByPath = new Map<string, string>();

  for (const emittedPath of uniqueEmittedPaths) {
    pendingSourceByPath.set(emittedPath, await readFile(emittedPath, 'utf8'));
    emittedPathToModuleUrl.set(emittedPath, `__NOJSX_PENDING_MODULE_${emittedPathToModuleUrl.size}__`);
  }

  const specifierToModuleUrl: Record<string, string> = {};
  for (const [specifier, emittedPath] of moduleSpecs) {
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
    for (const emittedPath of uniqueEmittedPaths) {
      const isEntryModule = emittedPath === normalizedEntryPath;
      let rewrittenSource = stripSourceMapComment(pendingSourceByPath.get(emittedPath) || '');
      if (!isEntryModule) {
        rewrittenSource = stripPreviewBootstrap(rewrittenSource);
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

    for (const [specifier, emittedPath] of moduleSpecs) {
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
    const source = await readFile(emittedPath, 'utf8');
    const isEntryModule = emittedPath === normalizedEntryPath;
    let rewrittenSource = stripSourceMapComment(source);
    if (!isEntryModule) {
      rewrittenSource = stripPreviewBootstrap(rewrittenSource);
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
    if (process.env.LIVE_PREVIEW_DEBUG_DUMP === 'true' && isEntryModule) {
      const debugDumpPath = path.join(process.cwd(), 'tmp-live-preview-generated-module.mjs');
      await writeFile(debugDumpPath, rewritten, 'utf8');
    }
  }

  if (process.env.LIVE_PREVIEW_DEBUG_DUMP === 'true') {
    const debugGraphPath = path.join(process.cwd(), 'tmp-live-preview-materialized-graph.json');
    await writeFile(debugGraphPath, JSON.stringify(Object.fromEntries([...emittedPathToModulePath.entries()].map(([emittedPath, modulePath]) => [emittedPath, modulePath])), null, 2), 'utf8');
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
  const provider = await resolveJsxProvider(filePath, sourceText);
  const { emittedJsPath: emittedPath, moduleMap } = await emitCompiledJs(filePath, sourceText, outDir);
  const entryModulePath = await materializePreviewModuleGraph({
    entryPath: emittedPath,
    provider,
    outDir,
    moduleMap,
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
  const sourceText = (() => {
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
  const artifactRoot = typeof (payload as any)?.artifactRoot === 'string' && (payload as any).artifactRoot.trim()
    ? (payload as any).artifactRoot
    : path.join(os.tmpdir(), 'nojsx-live-preview', 'shared');
  const httpPort = typeof (payload as any)?.httpPort === 'number' && Number.isFinite((payload as any).httpPort)
    ? (payload as any).httpPort
    : undefined;
  mkdirSync(artifactRoot, { recursive: true });
  const tempBase = path.join(artifactRoot, 'requests');
  mkdirSync(tempBase, { recursive: true });
  const tempDir = await mkdtemp(path.join(tempBase, 'live-preview-contract-'));
  const projectRoot = findNearestPackageRoot(filePath);
  const provider = await resolveJsxProvider(filePath, sourceText);
  const outputPath = path.join(tempDir, 'live-preview-output.html');

  (globalThis as any).__livePreview = {
    filePath,
    sourceText,
    httpPort,
    workingDirectory: projectRoot,
    projectRoot,
    jsxImportSource: provider.jsxImportSource,
    jsxRuntimeSpecifier: `${provider.jsxImportSource}/jsx-runtime`,
    tempDir,
    outputPath,
    mode: 'html',
  };

  try {
    const html = await buildInlinePreviewHtml({ filePath, sourceText, tempDir });
    const compiledPath = await compileTsxToModule(filePath, sourceText, tempDir);

    const runnerPath = path.join(tempDir, `${randomUUID()}.runner.mjs`);
    const moduleUrl = pathToFileURL(compiledPath).href + `?t=${Date.now()}`;
    (globalThis as any).__livePreview.precomputedHtml = html;
    await writeFile(runnerPath, [
      `globalThis.__livePreview = ${JSON.stringify({
        filePath,
        sourceText,
        httpPort,
        workingDirectory: projectRoot,
        projectRoot,
        jsxImportSource: (globalThis as any).__livePreview.jsxImportSource,
        jsxRuntimeSpecifier: (globalThis as any).__livePreview.jsxRuntimeSpecifier,
        tempDir,
        outputPath,
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
      return await readFile(outputPath, 'utf8');
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