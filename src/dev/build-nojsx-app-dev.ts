import path from 'node:path';
import { existsSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import ts from 'typescript';
import { renderShellPageParentDocument } from '../core/components/shell-page-parent-renderer.js';
import { buildGeneratedLoadersModule, readShellPageLayoutFields } from '../live-preview/shell-page-shared.js';

export type BuildNojsxAppDevOptions = {
  appRoot: string;
  origin: string;
  websocketUrl?: string;
  upstreamHostRpcEndpoint?: string;
  jsxImportSource?: string;
  appHostId?: string;
  shellPagePath?: string;
  pagesRoot?: string;
  stylesEntry?: string;
  outDir?: string;
  liveReload?: boolean;
};

function buildLiveReloadScript(origin: string): string {
  return [
    '<script>',
    '(() => {',
    '  const g = globalThis;',
    `  const endpoint = ${JSON.stringify(`${origin}/__nojsx_live_reload`)};`,
    '  const href = String(globalThis.location?.href ?? "").toLowerCase();',
    '  const protocol = String(globalThis.location?.protocol ?? "").toLowerCase();',
    "  const isWebview = protocol === 'vscode-webview:' || protocol === 'vscode-file:' || href.includes('purpose=webviewview') || href.includes('vscode-resource-base-authority=') || href.includes('parentorigin=vscode-file');",
    "  const scrollKey = '__nojsx_live_reload_scroll';",
    '  if (g.__nojsxLiveReloadSource) {',
    '    g.__nojsxLiveReloadSource.close();',
    '  }',
    '  let currentVersion = Number(g.__nojsxLiveReloadVersion ?? 0) || null;',
    '  let isReloading = false;',
    '',
    '  let scrollPersistTimer = null;',
    '',
    '  const readSavedScroll = () => {',
    '    try {',
    '      const raw = sessionStorage.getItem(scrollKey);',
    '      if (!raw) return null;',
    '      const parsed = JSON.parse(raw);',
    '      return {',
    '        x: Number(parsed?.x ?? 0),',
    '        y: Number(parsed?.y ?? 0),',
    '      };',
    '    } catch {',
    '      return null;',
    '    }',
    '  };',
    '',
    '  const persistScroll = () => {',
    '    try {',
    '      sessionStorage.setItem(scrollKey, JSON.stringify({ x: window.scrollX, y: window.scrollY }));',
    '    } catch {',
    '    }',
    '  };',
    '',
    '  const schedulePersistScroll = () => {',
    '    if (scrollPersistTimer) {',
    '      clearTimeout(scrollPersistTimer);',
    '    }',
    '    scrollPersistTimer = setTimeout(() => {',
    '      scrollPersistTimer = null;',
    '      persistScroll();',
    '    }, 40);',
    '  };',
    '',
    '  const restoreScroll = () => {',
    '    const saved = readSavedScroll();',
    '    if (!saved) return;',
    '    const apply = () => window.scrollTo(saved.x, saved.y);',
    '    apply();',
    '    requestAnimationFrame(() => {',
    '      apply();',
    '      requestAnimationFrame(apply);',
    '    });',
    '    setTimeout(apply, 0);',
    '    setTimeout(apply, 80);',
    '    setTimeout(() => sessionStorage.removeItem(scrollKey), 160);',
    '  };',
    '',
    '  const applyVersion = (nextVersion) => {',
    '    if (!nextVersion) return;',
    '    if (currentVersion === null) {',
    '      currentVersion = nextVersion;',
    '      g.__nojsxLiveReloadVersion = nextVersion;',
    '      return;',
    '    }',
    '    if (nextVersion !== currentVersion && !isReloading) {',
    '      currentVersion = nextVersion;',
    '      g.__nojsxLiveReloadVersion = nextVersion;',
    '      isReloading = true;',
    '      persistScroll();',
    '      location.reload();',
    '    }',
    '  };',
    '',
    '  const connect = () => {',
    '    try {',
    '      const source = new EventSource(endpoint);',
    '      g.__nojsxLiveReloadSource = source;',
    '      source.onmessage = (event) => {',
    '        try {',
    '          const payload = JSON.parse(event.data);',
    '          applyVersion(Number(payload?.version ?? 0));',
    '        } catch {',
    '        }',
    '      };',
    '      source.onerror = () => {',
    '      };',
    '    } catch {',
    '    }',
    '  };',
    '',
    "  if ('scrollRestoration' in history) {",
    "    history.scrollRestoration = 'manual';",
    '  }',
    "  window.addEventListener('scroll', schedulePersistScroll, { passive: true });",
    '  restoreScroll();',
    '  if (!isWebview) {',
    '    connect();',
    '  }',
    "  window.addEventListener('beforeunload', () => {",
    '    if (scrollPersistTimer) {',
    '      clearTimeout(scrollPersistTimer);',
    '      scrollPersistTimer = null;',
    '    }',
    '    if (g.__nojsxLiveReloadSource) {',
    '      g.__nojsxLiveReloadSource.close();',
    '      g.__nojsxLiveReloadSource = null;',
    '    }',
    '    persistScroll();',
    '  }, { once: true });',
    '})();',
    '</script>',
  ].join('\n');
}

function resolvePackageRoot(startDir: string): string {
  let current = startDir;
  while (true) {
    const pkgJson = path.join(current, 'package.json');
    const tailwindBuilder = path.join(current, 'scripts', 'build-tailwind.ts');
    if (existsSync(pkgJson) && existsSync(tailwindBuilder)) {
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

function runProcess(command: string, args: string[], cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    });

    let stderr = '';
    let stdout = '';
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
        resolve();
        return;
      }
      reject(new Error(stderr || stdout || `Process exited with code ${code}`));
    });
  });
}

async function buildCssForDev(stylesEntry: string, outputPath: string, srcRoot: string, repoRoot: string): Promise<void> {
  const tailwindBuilder = path.join(repoRoot, 'scripts', 'build-tailwind.ts');
  await runProcess('bun', [
    tailwindBuilder,
    '--input', stylesEntry,
    '--output', outputPath,
    '--source', srcRoot,
    '--no-minify',
  ], repoRoot);
}

async function transpileTsModuleToFile(
  sourcePath: string,
  outPath: string,
  jsxImportSource: string,
  devNojsxRoot?: string,
): Promise<void> {
  const source = await readFile(sourcePath, 'utf8');
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
  if (typeof result.outputText !== 'string') {
    throw new Error(`[nojsx:dev-build] TypeScript transpile produced no output for ${sourcePath}`);
  }
  let outputText = result.outputText;
  if (devNojsxRoot) {
    const relativeNojsxRoot = path.relative(path.dirname(outPath), devNojsxRoot).replace(/\\/g, '/');
    outputText = outputText.replace(/(["'])nojsx\//g, `$1${relativeNojsxRoot}/`);
  }
  await Bun.write(outPath, outputText);
}

async function ensureParentDir(filePath: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
}

function toDevJsPath(srcRoot: string, devSrcRoot: string, sourcePath: string): string {
  const relativeSourcePath = path.relative(srcRoot, sourcePath);
  return path.join(devSrcRoot, relativeSourcePath).replace(/\.(ts|tsx)$/i, '.js');
}

async function copyNojsxDistIntoDevRoot(repoRoot: string, devNojsxRoot: string): Promise<void> {
  const distRoot = path.join(repoRoot, 'dist');
  const files = await Array.fromAsync(new Bun.Glob('**/*').scan({ cwd: distRoot, onlyFiles: true }));
  for (const relativePath of files) {
    const sourcePath = path.join(distRoot, relativePath);
    const targetPath = path.join(devNojsxRoot, relativePath);
    await ensureParentDir(targetPath);
    await Bun.write(targetPath, Bun.file(sourcePath));
  }
}

async function transpileNojsxSourceIntoDevRoot(repoRoot: string, devNojsxRoot: string): Promise<void> {
  const sourceRoot = path.join(repoRoot, 'src');
  const sourceFiles = await Array.fromAsync(new Bun.Glob('**/*.{ts,tsx,js}').scan({ cwd: sourceRoot, onlyFiles: true }));
  for (const relativePath of sourceFiles) {
    if (/\.d\.ts$/i.test(relativePath)) {
      continue;
    }

    const sourcePath = path.join(sourceRoot, relativePath);
    const targetPath = path.join(devNojsxRoot, relativePath).replace(/\.(ts|tsx)$/i, '.js');
    await ensureParentDir(targetPath);

    if (/\.(ts|tsx)$/i.test(relativePath)) {
      await transpileTsModuleToFile(sourcePath, targetPath, 'nojsx', devNojsxRoot);
      continue;
    }

    await Bun.write(targetPath, Bun.file(sourcePath));
  }
}

export async function buildNojsxAppDev(options: BuildNojsxAppDevOptions): Promise<{ devRoot: string }> {
  const appRoot = path.resolve(options.appRoot);
  const origin = options.origin;
  const websocketUrl = options.websocketUrl
    ?? (() => {
      try {
        const url = new URL(origin);
        url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
        url.pathname = '/ws';
        url.search = '';
        url.hash = '';
        return url.toString();
      } catch {
        return undefined;
      }
    })();
  const upstreamHostRpcEndpoint = options.upstreamHostRpcEndpoint;
  const jsxImportSource = options.jsxImportSource ?? 'nojsx';
  const repoRoot = resolvePackageRoot(appRoot);
  const srcRoot = path.join(appRoot, 'src');
  const pagesRoot = options.pagesRoot ? path.resolve(appRoot, options.pagesRoot) : path.join(srcRoot, 'pages');
  const shellPagePath = options.shellPagePath ? path.resolve(appRoot, options.shellPagePath) : path.join(srcRoot, 'app.tsx');
  const stylesEntry = options.stylesEntry ? path.resolve(appRoot, options.stylesEntry) : path.join(srcRoot, 'styles', 'app.css');
  const devRoot = options.outDir ? path.resolve(appRoot, options.outDir) : path.join(appRoot, 'dist');
  const devSrcRoot = path.join(devRoot, 'src');
  const devNojsxRoot = path.join(devRoot, 'nojsx');
  const devLoadersPath = path.join(devSrcRoot, '__nojsx_component_loaders.js');
  const devCssPath = path.join(devSrcRoot, 'styles', 'app.css');
  const devHtmlPath = path.join(devRoot, 'index.html');
  const liveReloadStampPath = path.join(devRoot, '.nojsx-live-reload.json');

  const shellLayout = await readShellPageLayoutFields(shellPagePath, { appHostId: options.appHostId ?? 'app' });
  const liveReloadScript = options.liveReload === false ? '' : buildLiveReloadScript(origin);
  const documentHtml = renderShellPageParentDocument({
    title: shellLayout.title,
    importMap: {
      'nojsx/jsx-runtime': `${origin}/nojsx/jsx-runtime.js`,
      'nojsx/jsx-dev-runtime': `${origin}/nojsx/jsx-dev-runtime.js`,
      'nojsx/core/components/components': `${origin}/nojsx/core/components/components.js`,
      'nojsx/core/components/nav-outlet': `${origin}/nojsx/core/components/nav-outlet.js`,
      'nojsx/core/components/shell-page-parent': `${origin}/nojsx/core/components/shell-page-parent.js`,
      'nojsx/core/components/shell-page-parent-renderer': `${origin}/nojsx/core/components/shell-page-parent-renderer.js`,
      'nojsx/core/util/client-bootstrap': `${origin}/nojsx/core/util/client-bootstrap.js`,
      'nojsx/core/global/registry': `${origin}/nojsx/core/global/registry.js`,
    },
    cspNonce: shellLayout.cspNonce,
    cspContent: "default-src 'self' data: blob: vscode-webview: vscode-file: http: https: ws: wss:; script-src 'self' 'unsafe-eval' 'unsafe-inline' data: blob: vscode-webview: vscode-file: http: https:; style-src 'self' 'unsafe-inline' data: blob: vscode-webview: vscode-file: https://fonts.googleapis.com http: https:; font-src 'self' data: blob: vscode-webview: vscode-file: https://fonts.gstatic.com http: https:; img-src 'self' data: blob: vscode-webview: vscode-file: http: https:; connect-src 'self' data: blob: vscode-webview: vscode-file: http: https: ws: wss:;",
    shellScriptHtml: `<script type="module" src="${origin}/src/main.js"></script>`,
    appHostId: shellLayout.appHostId,
    headExtraHtml: `${shellLayout.headHtml}\n<link rel="stylesheet" href="${origin}/src/styles/app.css" />`,
    bodyClass: shellLayout.bodyClass,
    headerAttributes: shellLayout.headerAttributes,
    bodyBeforeShellHtml: shellLayout.headerHtml,
    bodyAfterShellHtml: [
      shellLayout.footerHtml,
      upstreamHostRpcEndpoint ? `<script>globalThis.__nojsxUpstreamHostRpcEndpoint = ${JSON.stringify(upstreamHostRpcEndpoint)};</script>` : '',
      websocketUrl ? `<script>globalThis.__nojsxWebSocketUrl = ${JSON.stringify(websocketUrl)};</script>` : '',
      shellLayout.scriptsHtml,
      liveReloadScript,
    ].filter(Boolean).join('\n'),
  });

  await ensureParentDir(devHtmlPath);
  await Bun.write(devHtmlPath, documentHtml);

  const sourceFiles = await Array.fromAsync(new Bun.Glob('**/*.{ts,tsx,css}').scan({ cwd: srcRoot, onlyFiles: true }));
  for (const relativePath of sourceFiles) {
    const sourcePath = path.join(srcRoot, relativePath);

    if (path.resolve(sourcePath) === path.resolve(stylesEntry)) {
      await ensureParentDir(devCssPath);
      await buildCssForDev(stylesEntry, devCssPath, srcRoot, repoRoot);
      continue;
    }

    if (/\.(ts|tsx)$/i.test(relativePath)) {
      const outPath = toDevJsPath(srcRoot, devSrcRoot, sourcePath);
      await ensureParentDir(outPath);
      await transpileTsModuleToFile(sourcePath, outPath, jsxImportSource, devNojsxRoot);
    }
  }

  if (existsSync(stylesEntry)) {
    await ensureParentDir(devCssPath);
    await buildCssForDev(stylesEntry, devCssPath, srcRoot, repoRoot);
  }

  const loaders = await buildGeneratedLoadersModule({
    pagesDir: pagesRoot,
    shellPagePath,
    sourceRoot: path.dirname(pagesRoot),
    importPathPrefix: './',
    jsxImportSource: '../nojsx',
  });
  await ensureParentDir(devLoadersPath);
  await Bun.write(devLoadersPath, loaders?.code ?? '');
  await copyNojsxDistIntoDevRoot(repoRoot, devNojsxRoot);
  await transpileNojsxSourceIntoDevRoot(repoRoot, devNojsxRoot);
  await Bun.write(liveReloadStampPath, JSON.stringify({ version: Date.now() }));

  return { devRoot };
}