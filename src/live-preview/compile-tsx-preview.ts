import path from 'node:path';
import os from 'node:os';
import process from 'node:process';
import { cp, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { discoverPageSourceFiles, discoverPagesDirectory } from './shell-page-shared.js';
import { appendLivePreviewDebugLog } from './debug-log.js';

type PreviewCompilerCacheEntry = {
  key: string;
  tsconfigPath?: string;
  projectRoot: string;
  parsed: ts.ParsedCommandLine;
  compilerOptions: ts.CompilerOptions;
  sourceRootPath: string;
  baseUrlPath: string;
  host: ts.CompilerHost;
  builder?: ts.EmitAndSemanticDiagnosticsBuilderProgram;
  rootNames: string[];
  versionByFile: Map<string, number>;
  textByFile: Map<string, string>;
  stampByFile: Map<string, string>;
};

const previewCompilerCache = new Map<string, PreviewCompilerCacheEntry>();

function normalizeServerSessionId(value: unknown): string {
  if (typeof value !== 'string') {
    return 'default';
  }

  const trimmed = value.trim();
  return trimmed || 'default';
}

function resolveProviderPackageRoot(projectRoot: string, jsxImportSource: string): string | undefined {
  try {
    const resolver = createRequire(path.join(projectRoot, 'package.json'));
    const providerPackageJsonPath = resolver.resolve(`${jsxImportSource}/package.json`);
    return path.dirname(providerPackageJsonPath);
  } catch {
    return undefined;
  }
}

function mergeUniqueStrings(...groups: Array<readonly string[] | undefined>): string[] | undefined {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const group of groups) {
    if (!group) continue;
    for (const entry of group) {
      if (typeof entry !== 'string' || !entry.trim()) continue;
      if (seen.has(entry)) continue;
      seen.add(entry);
      out.push(entry);
    }
  }
  return out.length > 0 ? out : undefined;
}

  function resolveProviderSubpathFile(providerPackageRoot: string, subpath: string): string | undefined {
    const normalized = subpath.replace(/^\.\//, '').replace(/\\/g, '/');
    const candidates = normalized.endsWith('.js') || normalized.endsWith('.d.ts')
      ? [normalized]
      : [
          `${normalized}.ts`,
          `${normalized}.tsx`,
          `${normalized}.d.ts`,
          `${normalized}.js`,
          `${normalized}/index.ts`,
          `${normalized}/index.tsx`,
          `${normalized}/index.d.ts`,
          `${normalized}/index.js`,
        ];

    for (const candidate of candidates) {
      const fullPath = path.resolve(providerPackageRoot, candidate);
      if (existsSync(fullPath)) {
        return fullPath;
      }
    }
    return undefined;
  }

  function resolveProviderModuleSpecifier(projectRoot: string, jsxImportSource: string, specifier: string): string | undefined {
    const prefix = `${jsxImportSource}/`;
    if (specifier !== jsxImportSource && !specifier.startsWith(prefix)) {
      return undefined;
    }

    const providerPackageRoot = resolveProviderPackageRoot(projectRoot, jsxImportSource);
    if (!providerPackageRoot) {
      return undefined;
    }

    if (specifier === jsxImportSource) {
      return resolveProviderSubpathFile(providerPackageRoot, 'dist/jsx-runtime')
        ?? resolveProviderSubpathFile(providerPackageRoot, 'src/jsx-runtime');
    }

    const subpath = specifier.slice(prefix.length);
    return resolveProviderSubpathFile(providerPackageRoot, `dist/${subpath}`)
      ?? resolveProviderSubpathFile(providerPackageRoot, `src/${subpath}`);
  }
function toPathSegment(value: string): string {
  return value
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80) || 'default';
}

function readJsxImportSourcePragma(sourceText: string): string | undefined {
  const match = sourceText.match(/@jsxImportSource\s+([^\s*]+)/);
  return match?.[1]?.trim() || undefined;
}

function getEffectiveJsxImportSource(sourceText: string, parsedOptions: ts.CompilerOptions | undefined): string | undefined {
  return readJsxImportSourcePragma(sourceText)
    || parsedOptions?.jsxImportSource
    || undefined;
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
    const candidate = path.join(current, 'tsconfig.json');
    if (existsSync(candidate)) {
      return candidate;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return undefined;
    }
    current = parent;
  }
}

function formatDiagnostics(diagnostics: readonly ts.Diagnostic[]): string {
  return ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: (fileName) => fileName,
    getCurrentDirectory: () => process.cwd(),
    getNewLine: () => '\n',
  });
}

function addModuleMapEntry(moduleMap: Record<string, string>, key: string, outputPath: string): void {
  if (!key) {
    return;
  }

  const normalizedKey = key.replace(/\\/g, '/').replace(/^(\.\/)+/, '');
  moduleMap[normalizedKey] = outputPath;
  if (normalizedKey.endsWith('/index')) {
    moduleMap[normalizedKey.slice(0, -('/index'.length))] = outputPath;
  }
}

function isShellPageParentEntry(sourceText: string): boolean {
  return /\bShellPageParent\b/.test(sourceText)
    && /\bextends\s+ShellPageParent\b/.test(sourceText);
}

async function addDiscoveredPageModuleEntries(moduleMap: Record<string, string>, filePath: string, tempEmitRoot: string, sourceRootPath: string, baseUrlPath: string): Promise<void> {
  const pagesDir = discoverPagesDirectory(filePath, findNearestPackageRoot);
  if (!pagesDir) {
    return;
  }

  const entries = await readdir(pagesDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile() || !/\.(ts|tsx)$/i.test(entry.name)) {
      continue;
    }

    const sourcePath = path.resolve(path.join(pagesDir, entry.name));
    const projectRoot = findNearestPackageRoot(filePath);
    const projectRelativeSourcePath = path.relative(projectRoot, sourcePath).replace(/\\/g, '/');
    const relativeEmitPath = path.relative(sourceRootPath, sourcePath).replace(/\\/g, '/');
    const withoutExtension = projectRelativeSourcePath.replace(/\.(ts|tsx)$/i, '');
    const emittedOutputPath = path.join(tempEmitRoot, relativeEmitPath).replace(/\.(ts|tsx)$/i, '.js');
    const normalizedOutputPath = path.resolve(emittedOutputPath).replace(/\\/g, '/');

    addModuleMapEntry(moduleMap, withoutExtension, normalizedOutputPath);
    if (sourcePath.startsWith(baseUrlPath)) {
      const baseUrlRelativePath = path.relative(baseUrlPath, sourcePath).replace(/\\/g, '/');
      const baseUrlKey = baseUrlRelativePath.replace(/\.(ts|tsx)$/i, '');
      addModuleMapEntry(moduleMap, baseUrlKey, normalizedOutputPath);
    }
  }
}

function createCompilerCacheKey(filePath: string, tsconfigPath: string | undefined, jsxImportSource: string, serverSessionId: string): string {
  return [
    path.resolve(tsconfigPath || findNearestPackageRoot(filePath)).replace(/\\/g, '/'),
    jsxImportSource,
    serverSessionId,
  ].join('|');
}

function getStableEmitRoot(artifactRoot: string, filePath: string, serverSessionId: string): string {
  const projectRoot = findNearestPackageRoot(filePath);
  const projectName = path.basename(projectRoot).replace(/[^a-zA-Z0-9._-]+/g, '_') || 'project';
  const sessionSegment = toPathSegment(serverSessionId);
  return path.join(artifactRoot, 'compiler-cache', projectName, sessionSegment, 'dist');
}

function arraysEqual(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

async function getFileStamp(filePath: string): Promise<string | undefined> {
  try {
    const fileStat = await stat(filePath);
    return `${fileStat.mtimeMs}:${fileStat.size}`;
  } catch {
    return undefined;
  }
}

async function refreshDependencyVersions(cacheEntry: PreviewCompilerCacheEntry, filePath: string): Promise<void> {
  const normalizedEntryPath = path.resolve(filePath);
  const builder = cacheEntry.builder;
  const program = builder?.getProgram();
  if (!program) {
    return;
  }

  const referencedFiles = program.getSourceFiles()
    .map((sourceFile) => path.resolve(sourceFile.fileName))
    .filter((sourcePath) => sourcePath !== normalizedEntryPath)
    .filter((sourcePath) => !sourcePath.endsWith('.d.ts'))
    .filter((sourcePath) => /\.(ts|tsx)$/i.test(sourcePath));

  for (const dependencyPath of referencedFiles) {
    const nextStamp = await getFileStamp(dependencyPath);
    const previousStamp = cacheEntry.stampByFile.get(dependencyPath);
    if (nextStamp == null) {
      cacheEntry.stampByFile.delete(dependencyPath);
      cacheEntry.versionByFile.set(dependencyPath, (cacheEntry.versionByFile.get(dependencyPath) || 0) + 1);
      continue;
    }

    if (previousStamp == null) {
      cacheEntry.stampByFile.set(dependencyPath, nextStamp);
      continue;
    }

    if (previousStamp !== nextStamp) {
      cacheEntry.stampByFile.set(dependencyPath, nextStamp);
      cacheEntry.versionByFile.set(dependencyPath, (cacheEntry.versionByFile.get(dependencyPath) || 0) + 1);
    }
  }
}

async function createOrRefreshCompilerCacheEntry(params: {
  key: string;
  tsconfigPath?: string;
  projectRoot: string;
  parsed: ts.ParsedCommandLine;
  compilerOptions: ts.CompilerOptions;
  sourceRootPath: string;
  baseUrlPath: string;
  rootNames: string[];
  filePath: string;
  sourceText: string;
  serverSessionId: string;
  requestPath?: string;
}): Promise<PreviewCompilerCacheEntry> {
  const normalizedRootNames = [...params.rootNames].map((name) => path.resolve(name)).sort();
  const normalizedFilePath = path.resolve(params.filePath);
  const existing = previewCompilerCache.get(params.key);

  if (existing && arraysEqual(existing.rootNames, normalizedRootNames)) {
    const previousText = existing.textByFile.get(normalizedFilePath);
    if (previousText !== params.sourceText) {
      existing.versionByFile.set(normalizedFilePath, (existing.versionByFile.get(normalizedFilePath) || 0) + 1);
      existing.textByFile.set(normalizedFilePath, params.sourceText);
    }
    existing.parsed = params.parsed;
    existing.compilerOptions = params.compilerOptions;
    existing.sourceRootPath = params.sourceRootPath;
    existing.baseUrlPath = params.baseUrlPath;
    await refreshDependencyVersions(existing, normalizedFilePath);
    return existing;
  }

  const versionByFile = new Map<string, number>();
  const textByFile = new Map<string, string>();
  const stampByFile = new Map<string, string>();
  versionByFile.set(normalizedFilePath, 1);
  textByFile.set(normalizedFilePath, params.sourceText);

  const host = ts.createIncrementalCompilerHost(params.compilerOptions);
  const originalReadFile = host.readFile.bind(host);
  const originalFileExists = host.fileExists.bind(host);
  const originalGetSourceFile = host.getSourceFile.bind(host);
  const originalResolveModuleNames = host.resolveModuleNames?.bind(host);

  host.readFile = (fileName) => {
    const normalizedName = path.resolve(fileName);
    if (textByFile.has(normalizedName)) {
      return textByFile.get(normalizedName);
    }
    return originalReadFile(fileName);
  };

  host.fileExists = (fileName) => {
    const normalizedName = path.resolve(fileName);
    if (textByFile.has(normalizedName)) {
      return true;
    }
    return originalFileExists(fileName);
  };

  host.getSourceFile = (fileName, languageVersionOrOptions, onError, shouldCreateNewSourceFile, ...rest) => {
    const normalizedName = path.resolve(fileName);
    const overriddenText = textByFile.get(normalizedName);
    if (overriddenText != null) {
      const version = String(versionByFile.get(normalizedName) || 0);
      const sourceFile = ts.createSourceFile(fileName, overriddenText, languageVersionOrOptions, true);
      (sourceFile as ts.SourceFile & { version?: string }).version = version;
      return sourceFile;
    }
    const sourceFile = originalGetSourceFile(fileName, languageVersionOrOptions, onError, shouldCreateNewSourceFile, ...rest);
    if (sourceFile) {
      const version = String(versionByFile.get(normalizedName) || 0);
      (sourceFile as ts.SourceFile & { version?: string }).version = version;
    }
    return sourceFile;
  };

  host.resolveModuleNames = (moduleNames, containingFile, reusedNames, redirectedReference, options) => {
    const resolvedByTs = originalResolveModuleNames?.(moduleNames, containingFile, reusedNames, redirectedReference, options);
    return moduleNames.map((moduleName, index) => {
      const existing = resolvedByTs?.[index];
      if (existing) {
        return existing;
      }

      const providerResolvedFileName = resolveProviderModuleSpecifier(params.projectRoot, params.compilerOptions.jsxImportSource || 'nojsx', moduleName);
      if (!providerResolvedFileName) {
        return ts.resolveModuleName(moduleName, containingFile, options, ts.sys).resolvedModule;
      }

      void appendLivePreviewDebugLog(params.serverSessionId, 'compile-preview', 'resolve-module-provider-override', {
        moduleName,
        containingFile,
        providerResolvedFileName,
      }, params.requestPath);

      return {
        resolvedFileName: providerResolvedFileName,
        isExternalLibraryImport: true,
      } as ts.ResolvedModule;
    });
  };

  const entry: PreviewCompilerCacheEntry = {
    key: params.key,
    tsconfigPath: params.tsconfigPath,
    projectRoot: params.projectRoot,
    parsed: params.parsed,
    compilerOptions: params.compilerOptions,
    sourceRootPath: params.sourceRootPath,
    baseUrlPath: params.baseUrlPath,
    host,
    rootNames: normalizedRootNames,
    versionByFile,
    textByFile,
    stampByFile,
  };

  previewCompilerCache.set(params.key, entry);
  return entry;
}

export async function compilePreview(payload: any): Promise<{ entryJsPath: string; moduleMap: Record<string, string>; jsxImportSource: string }> {
  const filePath = String(payload.filePath || '');
  const sourceText = typeof payload.sourceText === 'string' ? payload.sourceText : String(payload.sourceText || '');
  const outDir = String(payload.outDir || '');
  const serverSessionId = normalizeServerSessionId(payload.serverProcessRef ?? payload.serverSessionId);
  const requestPath = typeof payload.requestPath === 'string' ? payload.requestPath : undefined;
  const artifactRoot = path.join(os.tmpdir(), 'nojsx-live-preview', 'shared');

  if (!filePath || !outDir) {
    throw new Error('Preview compile payload requires filePath and outDir.');
  }

  const projectRoot = findNearestPackageRoot(filePath);
  const tsconfigPath = findNearestTsconfig(path.dirname(filePath));
  await appendLivePreviewDebugLog(serverSessionId, 'compile-preview', 'start', {
    filePath,
    projectRoot,
    tsconfigPath,
    outDir,
  }, requestPath);
  const stableEmitRoot = getStableEmitRoot(artifactRoot, filePath, serverSessionId);
  const tempEmitRoot = outDir;
  const tempEmitRootNormalized = path.resolve(tempEmitRoot).replace(/\\/g, '/');
  const stableEmitRootNormalized = path.resolve(stableEmitRoot).replace(/\\/g, '/');
  const rewriteStableToRequestPath = (targetPath: string): string => {
    const normalizedTargetPath = path.resolve(targetPath).replace(/\\/g, '/');
    if (!normalizedTargetPath.startsWith(stableEmitRootNormalized)) {
      return normalizedTargetPath;
    }
    return path.join(tempEmitRootNormalized, path.relative(stableEmitRootNormalized, normalizedTargetPath)).replace(/\\/g, '/');
  };

  await mkdir(tempEmitRoot, { recursive: true });
  await mkdir(stableEmitRoot, { recursive: true });

  let parsed: ts.ParsedCommandLine;
  if (tsconfigPath) {
    const configFile = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
    if (configFile.error) {
      throw new Error(formatDiagnostics([configFile.error]));
    }

    parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, path.dirname(tsconfigPath));
  } else {
    parsed = {
      options: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        jsx: ts.JsxEmit.ReactJSX,
      },
      fileNames: [filePath],
      errors: [],
      wildcardDirectories: {},
      raw: {},
      compileOnSave: false,
      typeAcquisition: { enable: false, include: [], exclude: [] },
      watchOptions: undefined,
    } as ts.ParsedCommandLine;
  }

  const jsxImportSource = getEffectiveJsxImportSource(sourceText, parsed.options);
  if (!jsxImportSource) {
    await appendLivePreviewDebugLog(serverSessionId, 'compile-preview', 'missing-jsx-import-source', { filePath }, requestPath);
    throw new Error(`Preview compile could not determine jsxImportSource for ${filePath}. Add a file-level @jsxImportSource pragma or set compilerOptions.jsxImportSource in the nearest tsconfig.json.`);
  }

  const compilerOptions: ts.CompilerOptions = {
    ...parsed.options,
    sourceMap: false,
    noEmitOnError: true,
    outDir: stableEmitRoot,
    jsxImportSource,
  };

  const providerPackageRoot = resolveProviderPackageRoot(projectRoot, jsxImportSource);
  const providerTypes = providerPackageRoot ? [jsxImportSource] : undefined;
  const providerTypeRoots = providerPackageRoot
    ? [path.join(projectRoot, 'node_modules', '@types'), path.join(providerPackageRoot, 'dist'), path.join(providerPackageRoot, 'src')]
    : undefined;

  compilerOptions.moduleResolution = ts.ModuleResolutionKind.Bundler;
  compilerOptions.types = mergeUniqueStrings(providerTypes, compilerOptions.types);
  compilerOptions.typeRoots = mergeUniqueStrings(providerTypeRoots, compilerOptions.typeRoots);
  await appendLivePreviewDebugLog(serverSessionId, 'compile-preview', 'compiler-options', {
    jsxImportSource,
    providerPackageRoot,
    moduleResolution: compilerOptions.moduleResolution,
    types: compilerOptions.types,
    typeRoots: compilerOptions.typeRoots,
    rootDir: compilerOptions.rootDir,
    baseUrl: compilerOptions.baseUrl,
  }, requestPath);

  const sourceRootPath = compilerOptions.rootDir
    ? path.resolve(compilerOptions.rootDir)
    : (tsconfigPath ? path.dirname(tsconfigPath) : projectRoot);
  const baseUrlPath = compilerOptions.baseUrl
    ? path.resolve(compilerOptions.baseUrl)
    : (tsconfigPath ? path.dirname(tsconfigPath) : projectRoot);

  const normalizedProjectRoot = path.resolve(projectRoot);
  const relativeEntryEmitPath = path.relative(sourceRootPath, path.resolve(filePath)).replace(/\\/g, '/').replace(/\.(ts|tsx)$/i, '.js');
  const fallbackStableEntryJsPath = path.join(stableEmitRoot, relativeEntryEmitPath);
  const rootNames = [filePath];
  if (isShellPageParentEntry(sourceText)) {
    rootNames.push(...await discoverPageSourceFiles(filePath, findNearestPackageRoot));
  }
  const cacheKey = createCompilerCacheKey(filePath, tsconfigPath, jsxImportSource, serverSessionId);
  const cacheEntry = await createOrRefreshCompilerCacheEntry({
    key: cacheKey,
    tsconfigPath,
    projectRoot,
    parsed,
    compilerOptions,
    sourceRootPath,
    baseUrlPath,
    rootNames,
    filePath,
    sourceText,
    serverSessionId,
    requestPath,
  });
  const host = cacheEntry.host;
  const originalWriteFile = host.writeFile.bind(host);
  let emittedJsPath: string | undefined;
  const emittedModuleMap: Record<string, string> = {};

  host.writeFile = (fileName, text, writeByteOrderMark, onError, sourceFiles, data) => {
    const belongsToEntry = Array.isArray(sourceFiles)
      && sourceFiles.some((sourceFile) => path.resolve(sourceFile.fileName) === path.resolve(filePath));
    if (!emittedJsPath && belongsToEntry && /\.js$/i.test(fileName) && !/\.d\.ts$/i.test(fileName)) {
      emittedJsPath = fileName;
    }

    return originalWriteFile(fileName, text, writeByteOrderMark, onError, sourceFiles, data);
  };

  const builder = ts.createEmitAndSemanticDiagnosticsBuilderProgram(
    cacheEntry.rootNames,
    cacheEntry.compilerOptions,
    cacheEntry.host,
    cacheEntry.builder,
  );
  cacheEntry.builder = builder;
  cacheEntry.rootNames = [...rootNames].map((name) => path.resolve(name)).sort();
  const program = builder.getProgram();
  for (const sourceFile of program.getSourceFiles()) {
    const sourcePath = path.resolve(sourceFile.fileName);
    if (!sourcePath.startsWith(normalizedProjectRoot)) {
      continue;
    }
    if (sourceFile.isDeclarationFile || !/\.(ts|tsx)$/i.test(sourcePath)) {
      continue;
    }

    const projectRelativeSourcePath = path.relative(projectRoot, sourcePath).replace(/\\/g, '/');
    const relativeEmitPath = path.relative(sourceRootPath, sourcePath).replace(/\\/g, '/');
    const withoutExtension = projectRelativeSourcePath.replace(/\.(ts|tsx)$/i, '');
    const emittedOutputPath = path.join(stableEmitRoot, relativeEmitPath).replace(/\.(ts|tsx)$/i, '.js');
    const normalizedOutputPath = rewriteStableToRequestPath(emittedOutputPath);

    addModuleMapEntry(emittedModuleMap, withoutExtension, normalizedOutputPath);
    if (sourcePath.startsWith(baseUrlPath)) {
      const baseUrlRelativePath = path.relative(baseUrlPath, sourcePath).replace(/\\/g, '/');
      const baseUrlKey = baseUrlRelativePath.replace(/\.(ts|tsx)$/i, '');
      addModuleMapEntry(emittedModuleMap, baseUrlKey, normalizedOutputPath);
    }
  }

  if (isShellPageParentEntry(sourceText)) {
    await addDiscoveredPageModuleEntries(emittedModuleMap, filePath, stableEmitRoot, sourceRootPath, baseUrlPath);
    for (const [key, outputPath] of Object.entries(emittedModuleMap)) {
      emittedModuleMap[key] = rewriteStableToRequestPath(outputPath);
    }
  }

  const diagnostics = ts.getPreEmitDiagnostics(program);
  if (diagnostics.length > 0) {
    await appendLivePreviewDebugLog(serverSessionId, 'compile-preview', 'pre-emit-diagnostics', {
      count: diagnostics.length,
      formatted: formatDiagnostics(diagnostics),
    }, requestPath);
    throw new Error(formatDiagnostics(diagnostics));
  }

  const emitResult = builder.emit();
  const emitDiagnostics = emitResult.diagnostics || [];
  if (emitDiagnostics.length > 0) {
    await appendLivePreviewDebugLog(serverSessionId, 'compile-preview', 'emit-diagnostics', {
      count: emitDiagnostics.length,
      formatted: formatDiagnostics(emitDiagnostics),
    }, requestPath);
    throw new Error(formatDiagnostics(emitDiagnostics));
  }

  await cp(stableEmitRoot, tempEmitRoot, { recursive: true, force: true });

  if (!emittedJsPath) {
    emittedJsPath = fallbackStableEntryJsPath;
  }

  if (!existsSync(emittedJsPath)) {
    throw new Error(`Preview compile did not emit a JavaScript file for ${filePath}.`);
  }

  emittedJsPath = rewriteStableToRequestPath(emittedJsPath);

  await appendLivePreviewDebugLog(serverSessionId, 'compile-preview', 'success', {
    entryJsPath: emittedJsPath,
    moduleMapKeys: Object.keys(emittedModuleMap),
  }, requestPath);

  return {
    entryJsPath: path.resolve(emittedJsPath).replace(/\\/g, '/'),
    moduleMap: emittedModuleMap,
    jsxImportSource,
  };
}

async function main(): Promise<void> {
  const payloadArg = process.argv[2];
  if (!payloadArg) {
    throw new Error('Missing preview compile payload argument.');
  }

  const payloadJson = payloadArg.startsWith('@')
    ? await readFile(payloadArg.slice(1), 'utf8')
    : payloadArg;
  const payload = JSON.parse(payloadJson.replace(/^\uFEFF/, ''));
  const result = await compilePreview(payload);
  process.stdout.write(JSON.stringify(result));
}

export default compilePreview;

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