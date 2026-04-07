import path from 'node:path';
import process from 'node:process';
import { cp, mkdir, readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
const previewCompilerCache = new Map();
function readJsxImportSourcePragma(sourceText) {
    const match = sourceText.match(/@jsxImportSource\s+([^\s*]+)/);
    return match?.[1]?.trim() || undefined;
}
function getEffectiveJsxImportSource(sourceText, parsedOptions) {
    return readJsxImportSourcePragma(sourceText)
        || parsedOptions?.jsxImportSource
        || undefined;
}
function findNearestPackageRoot(filePath) {
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
function findNearestTsconfig(startDir) {
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
function formatDiagnostics(diagnostics) {
    return ts.formatDiagnosticsWithColorAndContext(diagnostics, {
        getCanonicalFileName: (fileName) => fileName,
        getCurrentDirectory: () => process.cwd(),
        getNewLine: () => '\n',
    });
}
function addModuleMapEntry(moduleMap, key, outputPath) {
    if (!key) {
        return;
    }
    const normalizedKey = key.replace(/\\/g, '/').replace(/^(\.\/)+/, '');
    moduleMap[normalizedKey] = outputPath;
    if (normalizedKey.endsWith('/index')) {
        moduleMap[normalizedKey.slice(0, -('/index'.length))] = outputPath;
    }
}
function isShellPageParentEntry(sourceText) {
    return /\bShellPageParent\b/.test(sourceText)
        && /\bextends\s+ShellPageParent\b/.test(sourceText);
}
function discoverPagesDirectory(filePath) {
    const entryDir = path.dirname(filePath);
    const projectRoot = findNearestPackageRoot(filePath);
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
async function addDiscoveredPageModuleEntries(moduleMap, filePath, tempEmitRoot, sourceRootPath, baseUrlPath) {
    const pagesDir = discoverPagesDirectory(filePath);
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
async function discoverPageSourceFiles(filePath) {
    const pagesDir = discoverPagesDirectory(filePath);
    if (!pagesDir) {
        return [];
    }
    const entries = await readdir(pagesDir, { withFileTypes: true });
    return entries
        .filter((entry) => entry.isFile() && /\.(ts|tsx)$/i.test(entry.name))
        .map((entry) => path.resolve(path.join(pagesDir, entry.name)));
}
function createCompilerCacheKey(filePath, tsconfigPath, outDir, jsxImportSource) {
    return [
        path.resolve(tsconfigPath || findNearestPackageRoot(filePath)).replace(/\\/g, '/'),
        jsxImportSource,
    ].join('|');
}
function getStableEmitRoot(artifactRoot, filePath) {
    const projectRoot = findNearestPackageRoot(filePath);
    const projectName = path.basename(projectRoot).replace(/[^a-zA-Z0-9._-]+/g, '_') || 'project';
    return path.join(artifactRoot, 'compiler-cache', projectName, 'dist');
}
function arraysEqual(left, right) {
    return left.length === right.length && left.every((value, index) => value === right[index]);
}
function createOrRefreshCompilerCacheEntry(params) {
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
        return existing;
    }
    const versionByFile = new Map();
    const textByFile = new Map();
    versionByFile.set(normalizedFilePath, 1);
    textByFile.set(normalizedFilePath, params.sourceText);
    const host = ts.createIncrementalCompilerHost(params.compilerOptions);
    const originalReadFile = host.readFile.bind(host);
    const originalFileExists = host.fileExists.bind(host);
    const originalGetSourceFile = host.getSourceFile.bind(host);
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
            sourceFile.version = version;
            return sourceFile;
        }
        const sourceFile = originalGetSourceFile(fileName, languageVersionOrOptions, onError, shouldCreateNewSourceFile, ...rest);
        if (sourceFile) {
            const version = String(versionByFile.get(normalizedName) || 0);
            sourceFile.version = version;
        }
        return sourceFile;
    };
    const entry = {
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
    };
    previewCompilerCache.set(params.key, entry);
    return entry;
}
export async function compilePreview(payload) {
    const filePath = String(payload.filePath || '');
    const sourceText = typeof payload.sourceText === 'string' ? payload.sourceText : String(payload.sourceText || '');
    const outDir = String(payload.outDir || '');
    const artifactRoot = typeof payload.artifactRoot === 'string' && payload.artifactRoot.trim()
        ? String(payload.artifactRoot)
        : path.join(process.cwd(), '.nojsx-live-preview');
    if (!filePath || !outDir) {
        throw new Error('Preview compile payload requires filePath and outDir.');
    }
    const projectRoot = findNearestPackageRoot(filePath);
    const tsconfigPath = findNearestTsconfig(path.dirname(filePath));
    const stableEmitRoot = getStableEmitRoot(artifactRoot, filePath);
    const tempEmitRoot = outDir;
    const tempEmitRootNormalized = path.resolve(tempEmitRoot).replace(/\\/g, '/');
    const stableEmitRootNormalized = path.resolve(stableEmitRoot).replace(/\\/g, '/');
    const rewriteStableToRequestPath = (targetPath) => {
        const normalizedTargetPath = path.resolve(targetPath).replace(/\\/g, '/');
        if (!normalizedTargetPath.startsWith(stableEmitRootNormalized)) {
            return normalizedTargetPath;
        }
        return path.join(tempEmitRootNormalized, path.relative(stableEmitRootNormalized, normalizedTargetPath)).replace(/\\/g, '/');
    };
    await mkdir(tempEmitRoot, { recursive: true });
    await mkdir(stableEmitRoot, { recursive: true });
    let parsed;
    if (tsconfigPath) {
        const configFile = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
        if (configFile.error) {
            throw new Error(formatDiagnostics([configFile.error]));
        }
        parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, path.dirname(tsconfigPath));
    }
    else {
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
        };
    }
    const jsxImportSource = getEffectiveJsxImportSource(sourceText, parsed.options);
    if (!jsxImportSource) {
        throw new Error(`Preview compile could not determine jsxImportSource for ${filePath}. Add a file-level @jsxImportSource pragma or set compilerOptions.jsxImportSource in the nearest tsconfig.json.`);
    }
    const compilerOptions = {
        ...parsed.options,
        sourceMap: false,
        noEmitOnError: true,
        outDir: stableEmitRoot,
        jsxImportSource,
    };
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
        rootNames.push(...await discoverPageSourceFiles(filePath));
    }
    const cacheKey = createCompilerCacheKey(filePath, tsconfigPath, stableEmitRoot, jsxImportSource);
    const cacheEntry = createOrRefreshCompilerCacheEntry({
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
    });
    const host = cacheEntry.host;
    const originalWriteFile = host.writeFile.bind(host);
    let emittedJsPath;
    const emittedModuleMap = {};
    host.writeFile = (fileName, text, writeByteOrderMark, onError, sourceFiles, data) => {
        const belongsToEntry = Array.isArray(sourceFiles)
            && sourceFiles.some((sourceFile) => path.resolve(sourceFile.fileName) === path.resolve(filePath));
        if (!emittedJsPath && belongsToEntry && /\.js$/i.test(fileName) && !/\.d\.ts$/i.test(fileName)) {
            emittedJsPath = fileName;
        }
        return originalWriteFile(fileName, text, writeByteOrderMark, onError, sourceFiles, data);
    };
    const builder = ts.createEmitAndSemanticDiagnosticsBuilderProgram(cacheEntry.rootNames, cacheEntry.compilerOptions, cacheEntry.host, cacheEntry.builder);
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
        throw new Error(formatDiagnostics(diagnostics));
    }
    const emitResult = builder.emit();
    const emitDiagnostics = emitResult.diagnostics || [];
    if (emitDiagnostics.length > 0) {
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
    return {
        entryJsPath: path.resolve(emittedJsPath).replace(/\\/g, '/'),
        moduleMap: emittedModuleMap,
        jsxImportSource,
    };
}
async function main() {
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
