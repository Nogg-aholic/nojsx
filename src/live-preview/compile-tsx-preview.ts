import path from 'node:path';
import process from 'node:process';
import { mkdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import ts from 'typescript';

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

async function main(): Promise<void> {
  const payloadArg = process.argv[2];
  if (!payloadArg) {
    throw new Error('Missing preview compile payload argument.');
  }

  const payloadJson = payloadArg.startsWith('@')
    ? await readFile(payloadArg.slice(1), 'utf8')
    : payloadArg;
  const payload = JSON.parse(payloadJson.replace(/^\uFEFF/, ''));

  const filePath = String(payload.filePath || '');
  const sourceText = typeof payload.sourceText === 'string' ? payload.sourceText : String(payload.sourceText || '');
  const outDir = String(payload.outDir || '');

  if (!filePath || !outDir) {
    throw new Error('Preview compile payload requires filePath and outDir.');
  }

  const projectRoot = findNearestPackageRoot(filePath);
  const tsconfigPath = findNearestTsconfig(path.dirname(filePath));
  const tempEmitRoot = outDir;
  await mkdir(tempEmitRoot, { recursive: true });

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
    throw new Error(`Preview compile could not determine jsxImportSource for ${filePath}. Add a file-level @jsxImportSource pragma or set compilerOptions.jsxImportSource in the nearest tsconfig.json.`);
  }

  const compilerOptions: ts.CompilerOptions = {
    ...parsed.options,
    sourceMap: false,
    noEmitOnError: true,
    outDir: tempEmitRoot,
    jsxImportSource,
  };

  const sourceRootPath = compilerOptions.rootDir
    ? path.resolve(compilerOptions.rootDir)
    : (tsconfigPath ? path.dirname(tsconfigPath) : projectRoot);
  const baseUrlPath = compilerOptions.baseUrl
    ? path.resolve(compilerOptions.baseUrl)
    : (tsconfigPath ? path.dirname(tsconfigPath) : projectRoot);

  const normalizedProjectRoot = path.resolve(projectRoot);
  const rootNames = [filePath];
  const host = ts.createCompilerHost(compilerOptions);
  const originalReadFile = host.readFile.bind(host);
  const originalFileExists = host.fileExists.bind(host);
  const originalWriteFile = host.writeFile.bind(host);
  let emittedJsPath: string | undefined;
  const emittedModuleMap: Record<string, string> = {};

  host.readFile = (fileName) => {
    if (path.resolve(fileName) === path.resolve(filePath)) {
      return sourceText;
    }
    return originalReadFile(fileName);
  };

  host.fileExists = (fileName) => {
    if (path.resolve(fileName) === path.resolve(filePath)) {
      return true;
    }
    return originalFileExists(fileName);
  };

  host.writeFile = (fileName, text, writeByteOrderMark, onError, sourceFiles, data) => {
    const belongsToEntry = Array.isArray(sourceFiles)
      && sourceFiles.some((sourceFile) => path.resolve(sourceFile.fileName) === path.resolve(filePath));
    if (!emittedJsPath && belongsToEntry && /\.js$/i.test(fileName) && !/\.d\.ts$/i.test(fileName)) {
      emittedJsPath = fileName;
    }

    return originalWriteFile(fileName, text, writeByteOrderMark, onError, sourceFiles, data);
  };

  const program = ts.createProgram(rootNames, compilerOptions, host);
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
    const emittedOutputPath = path.join(tempEmitRoot, relativeEmitPath).replace(/\.(ts|tsx)$/i, '.js');
    const normalizedOutputPath = path.resolve(emittedOutputPath).replace(/\\/g, '/');

    addModuleMapEntry(emittedModuleMap, withoutExtension, normalizedOutputPath);
    if (sourcePath.startsWith(baseUrlPath)) {
      const baseUrlRelativePath = path.relative(baseUrlPath, sourcePath).replace(/\\/g, '/');
      const baseUrlKey = baseUrlRelativePath.replace(/\.(ts|tsx)$/i, '');
      addModuleMapEntry(emittedModuleMap, baseUrlKey, normalizedOutputPath);
    }
  }

  const diagnostics = ts.getPreEmitDiagnostics(program);
  if (diagnostics.length > 0) {
    throw new Error(formatDiagnostics(diagnostics));
  }

  const emitResult = program.emit();
  const emitDiagnostics = emitResult.diagnostics || [];
  if (emitDiagnostics.length > 0) {
    throw new Error(formatDiagnostics(emitDiagnostics));
  }

  if (!emittedJsPath) {
    throw new Error(`Preview compile did not emit a JavaScript file for ${filePath}.`);
  }

  process.stdout.write(JSON.stringify({
    entryJsPath: path.resolve(emittedJsPath).replace(/\\/g, '/'),
    moduleMap: emittedModuleMap,
    jsxImportSource,
  }));
}

void main().catch((error) => {
  process.stderr.write(String(error?.stack || error?.message || error));
  process.exit(1);
});