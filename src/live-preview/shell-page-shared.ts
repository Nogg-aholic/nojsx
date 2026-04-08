import path from 'node:path';
import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import ts from 'typescript';

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
  routePath: string;
  importPath: string;
};

function stripOuterParens(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

export async function readShellPageLayoutFields(shellPagePath: string, defaults?: Partial<ShellLayoutFields>): Promise<ShellLayoutFields> {
  const sourceText = await readFile(shellPagePath, 'utf8');
  const sourceFile = ts.createSourceFile(shellPagePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const out: ShellLayoutFields = {
    title: 'NUI',
    cspNonce: 'nojsx-importmap',
    appHostId: 'app',
    bodyClass: '',
    headerAttributes: 'lang="en"',
    headHtml: '',
    headerHtml: '',
    footerHtml: '',
    scriptsHtml: '',
    ...defaults,
  };

  const byName: Record<string, keyof ShellLayoutFields> = {
    layout_title: 'title',
    layout_cspNonce: 'cspNonce',
    layout_appHostId: 'appHostId',
    layout_bodyClass: 'bodyClass',
    layout_headerAttributes: 'headerAttributes',
    headerAttributes: 'headerAttributes',
    layout_head_html: 'headHtml',
    layout_header: 'headerHtml',
    layout_footer: 'footerHtml',
    layout_scripts: 'scriptsHtml',
  };

  const setValue = (propName: string, initializer?: ts.Expression) => {
    const outKey = byName[propName];
    if (!outKey || !initializer) return;
    if (ts.isStringLiteral(initializer) || ts.isNoSubstitutionTemplateLiteral(initializer)) {
      out[outKey] = initializer.text as never;
      return;
    }
    out[outKey] = stripOuterParens(sourceText.slice(initializer.pos, initializer.end)) as never;
  };

  const visit = (node: ts.Node) => {
    if (ts.isClassDeclaration(node) && node.name?.text === 'ShellPage') {
      for (const member of node.members) {
        if (!ts.isPropertyDeclaration(member)) continue;
        const isStatic = member.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.StaticKeyword);
        if (!isStatic || !member.name || !ts.isIdentifier(member.name)) continue;
        setValue(member.name.text, member.initializer);
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return out;
}

export function discoverPagesDirectory(filePath: string, findNearestPackageRoot: (filePath: string) => string): string | undefined {
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

export function toExportNameFromPageFile(fileName: string): string {
  const base = fileName.replace(/\.(tsx|ts)$/i, '');
  if (!base) return 'HomePage';
  const pascal = base
    .split(/[-_\s]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
  return pascal.endsWith('Page') ? pascal : `${pascal}Page`;
}

export function toRoutePathFromExportName(exportName: string): string {
  const base = exportName.replace(/Page$/, '');
  const kebab = base
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase();
  if (kebab === 'home') return '/home';
  return `/${kebab || 'home'}`;
}

export async function discoverPageSourceFiles(filePath: string, findNearestPackageRoot: (filePath: string) => string): Promise<string[]> {
  const pagesDir = discoverPagesDirectory(filePath, findNearestPackageRoot);
  if (!pagesDir) {
    return [];
  }

  const entries = await readdir(pagesDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && /\.(ts|tsx)$/i.test(entry.name))
    .map((entry) => path.resolve(path.join(pagesDir, entry.name)));
}

export async function buildGeneratedLoadersModule(options: {
  filePath?: string;
  pagesDir?: string;
  findNearestPackageRoot?: (filePath: string) => string;
  sourceRoot?: string;
  importPathPrefix?: string;
  jsxImportSource: string;
}): Promise<{ code: string; pagesFound: number; pages: GeneratedPageModule[] } | null> {
  const pagesDir = options.pagesDir
    ?? (options.filePath && options.findNearestPackageRoot
      ? discoverPagesDirectory(options.filePath, options.findNearestPackageRoot)
      : undefined);
  if (!pagesDir) return null;

  const entries = await readdir(pagesDir, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && /\.(tsx|ts)$/i.test(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  if (files.length === 0) {
    return null;
  }

  const sourceRoot = options.sourceRoot
    ?? (options.filePath && options.findNearestPackageRoot
      ? path.join(options.findNearestPackageRoot(options.filePath), 'src')
      : undefined);
  if (!sourceRoot) {
    throw new Error('buildGeneratedLoadersModule requires sourceRoot or filePath/findNearestPackageRoot.');
  }

  const importPathPrefix = options.importPathPrefix ?? 'src/';
  const pages: GeneratedPageModule[] = files.map((pageFile) => {
    const absPath = path.join(pagesDir, pageFile);
    const relFromSrc = path.relative(sourceRoot, absPath).replace(/\\/g, '/').replace(/\.(tsx|ts)$/i, '');
    const exportName = toExportNameFromPageFile(pageFile);
    return {
      fileName: pageFile,
      exportName,
      routePath: toRoutePathFromExportName(exportName),
      importPath: `${importPathPrefix}${relFromSrc}`,
    };
  });

  const importLines = pages.map((page, index) => `import * as M${index} from ${JSON.stringify(page.importPath)};`);
  const loaderLines = pages.flatMap((page, index) => [
    `if (M${index} && M${index}[${JSON.stringify(page.exportName)}]) {`,
    `  __g.__nojsxComponentLoaders[${JSON.stringify(page.exportName)}] = (props) => new M${index}[${JSON.stringify(page.exportName)}](props);`,
    '}',
  ]);
  const routeLines = pages.map((page) => `  ${JSON.stringify(page.routePath)}: { componentName: ${JSON.stringify(page.exportName)} },`);
  const pagesLines = pages.map((page) => `  ${JSON.stringify(page.exportName)}: ${JSON.stringify(page.routePath)},`);

  const code = [
    `import { nojsxComponentLoaders } from ${JSON.stringify(`${options.jsxImportSource}/core/global/registry`)};`,
    ...importLines,
    'const __g = globalThis;',
    '__g.__nojsxComponentLoaders = __g.__nojsxComponentLoaders ?? nojsxComponentLoaders ?? {};',
    ...loaderLines,
    'export const nojsxPageRoutes = {',
    ...routeLines,
    '};',
    '__g.__nojsxPageRoutes = nojsxPageRoutes;',
    'export const nojsxPages = {',
    ...pagesLines,
    '};',
    '__g.__nojsxPages = nojsxPages;',
    '',
  ].join('\n');

  return { code, pagesFound: pages.length, pages };
}