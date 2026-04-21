import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

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

type TsModule = typeof import("typescript");

const typescriptModulePromiseByPath = new Map<string, Promise<TsModule>>();

function stripOuterParens(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith("(") && trimmed.endsWith(")")) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function resolveTypeScriptModulePath(filePath: string): string {
  let current = path.dirname(filePath);
  while (true) {
    const candidate = path.join(current, "node_modules", "typescript", "lib", "typescript.js");
    if (existsSync(candidate)) {
      return candidate;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      throw new Error(`Unable to resolve TypeScript runtime for ${filePath}.`);
    }
    current = parent;
  }
}

async function loadTypeScriptForFile(filePath: string): Promise<TsModule> {
  const modulePath = resolveTypeScriptModulePath(filePath);
  const existing = typescriptModulePromiseByPath.get(modulePath);
  if (existing) {
    return existing;
  }

  const promise = import(pathToFileURL(modulePath).href).then((mod) => (mod.default ?? mod) as TsModule);
  typescriptModulePromiseByPath.set(modulePath, promise);
  return promise;
}

export async function readShellPageLayoutFields(shellPagePath: string, defaults?: Partial<ShellLayoutFields>): Promise<ShellLayoutFields> {
  const tsModule = await loadTypeScriptForFile(shellPagePath);
  const sourceText = await Bun.file(shellPagePath).text();
  const sourceFile = tsModule.createSourceFile(shellPagePath, sourceText, tsModule.ScriptTarget.Latest, true, tsModule.ScriptKind.TSX);
  const out: ShellLayoutFields = {
    title: "NUI",
    cspNonce: "nojsx-importmap",
    appHostId: "app",
    bodyClass: "",
    headerAttributes: 'lang="en"',
    headHtml: "",
    headerHtml: "",
    footerHtml: "",
    scriptsHtml: "",
    ...defaults,
  };

  const byName: Record<string, keyof ShellLayoutFields> = {
    layout_title: "title",
    layout_cspNonce: "cspNonce",
    layout_appHostId: "appHostId",
    layout_bodyClass: "bodyClass",
    layout_headerAttributes: "headerAttributes",
    headerAttributes: "headerAttributes",
    layout_head_html: "headHtml",
    layout_header: "headerHtml",
    layout_footer: "footerHtml",
    layout_scripts: "scriptsHtml",
  };

  const setValue = (propName: string, initializer?: import("typescript").Expression) => {
    const outKey = byName[propName];
    if (!outKey || !initializer) return;
    if (tsModule.isStringLiteral(initializer) || tsModule.isNoSubstitutionTemplateLiteral(initializer)) {
      out[outKey] = initializer.text as never;
      return;
    }
    out[outKey] = stripOuterParens(sourceText.slice(initializer.pos, initializer.end)) as never;
  };

  const visit = (node: import("typescript").Node) => {
    if (tsModule.isClassDeclaration(node) && node.name?.text === "ShellPage") {
      for (const member of node.members) {
        if (!tsModule.isPropertyDeclaration(member)) continue;
        const isStatic = member.modifiers?.some((modifier) => modifier.kind === tsModule.SyntaxKind.StaticKeyword);
        if (!isStatic || !member.name || !tsModule.isIdentifier(member.name)) continue;
        setValue(member.name.text, member.initializer);
      }
    }
    tsModule.forEachChild(node, visit);
  };

  visit(sourceFile);
  return out;
}

export const defaultShellPageParentProviderScripts = [
  `<script>`,
  `(() => {`,
  `  if (typeof globalThis.tailwind === 'undefined') {`,
  `    globalThis.tailwind = { config: () => {} };`,
  `  }`,
  `  const removeDiagnostics = () => {`,
  `    document.getElementById('nojsx-live-preview-diagnostics')?.remove();`,
  `  };`,
  `  removeDiagnostics();`,
  `  window.addEventListener('load', removeDiagnostics, { once: true });`,
  `  new MutationObserver(() => removeDiagnostics()).observe(document.documentElement, { childList: true, subtree: true });`,
  `})();`,
  `</script>`,
].join("\n");

function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function renderShellPageParentDocument(props: { title: any; importMap: any; cspNonce: any; cspContent: any; shellScriptHtml: any; appHostId: any; headExtraHtml: any; bodyClass: any; headerAttributes: any; bodyBeforeShellHtml: any; bodyAfterShellHtml: any; shellSrc?: any; }): string {
  const {
    title = "App",
    importMap = {},
    cspNonce = "",
    cspContent = "",
    shellSrc = "./shell.js",
    shellScriptHtml = "",
    bodyClass,
    appHostId,
    headExtraHtml = "",
    bodyBeforeShellHtml = "",
    bodyAfterShellHtml = "",
    headerAttributes = "",
  } = props;

  const importMapJson = JSON.stringify({ imports: importMap }, null, 2);
  const bodyClassAttr = bodyClass?.trim() ? ` class="${escapeHtml(bodyClass)}"` : "";
  const headerAttributes_ = headerAttributes?.trim() ? ` ${headerAttributes.trim()}` : "";
  const safeHostId = escapeHtml(appHostId ?? "info");
  const shellScriptLine = shellScriptHtml?.trim()
    ? shellScriptHtml
    : (shellSrc?.trim() ? `    <script type="module" src="${escapeHtml(shellSrc)}"></script>` : "");

  return [
    "<!doctype html>",
    `<html${headerAttributes_}>`,
    "  <head>",
    '    <meta charset="UTF-8" />',
    '    <meta name="viewport" content="width=device-width, initial-scale=1.0" />',
    `    <meta http-equiv="Content-Security-Policy" content="${escapeHtml(cspContent)}" />`,
    `    <title>${escapeHtml(title)}</title>`,
    `    <script nonce="${escapeHtml(cspNonce)}" type="importmap">`,
    importMapJson
      .split("\n")
      .map((line) => `      ${line}`)
      .join("\n"),
    "    </script>",
    headExtraHtml,
    "  </head>",
    `  <body${bodyClassAttr}>`,
    bodyBeforeShellHtml,
    `    <div id="${safeHostId}"></div>`,
    shellScriptLine,
    defaultShellPageParentProviderScripts,
    bodyAfterShellHtml,
    "  </body>",
    "</html>",
    "",
  ]
    .filter((line) => line !== "")
    .join("\n");
}

export function renderDevHtmlDocument(params: {
  origin: string;
  importMap?: Record<string, string>;
  shellLayout: ShellLayoutFields;
  websocketUrl?: string;
  stylesHref?: string;
}): Promise<string> {
  const { origin, importMap, shellLayout, websocketUrl, stylesHref } = params;
  return Promise.resolve(renderShellPageParentDocument({
    title: shellLayout.title,
    importMap: importMap ?? {
      "@nogg-aholic/nojsx": `${origin}/_pkg/nojsx/index.js`,
      "@nogg-aholic/nojsx/": `${origin}/_pkg/nojsx/`,
      "@nogg-aholic/nojsx/index.js": `${origin}/_pkg/nojsx/index.js`,
      "@nogg-aholic/nojsx/jsx-runtime": `${origin}/_pkg/nojsx/jsx-runtime.js`,
      "@nogg-aholic/nojsx/jsx-dev-runtime": `${origin}/_pkg/nojsx/jsx-dev-runtime.js`,
      "@nogg-aholic/nrpc": `${origin}/_pkg/nrpc/index.js`,
      "@nogg-aholic/nrpc/": `${origin}/_pkg/nrpc/`,
    },
    cspNonce: shellLayout.cspNonce,
    cspContent:
      "default-src 'self' data: blob: vscode-webview: vscode-file: http: https: ws: wss:; script-src 'self' 'unsafe-eval' 'unsafe-inline' data: blob: vscode-webview: vscode-file: http: https:; style-src 'self' 'unsafe-inline' data: blob: vscode-webview: vscode-file: https://fonts.googleapis.com http: https:; font-src 'self' data: blob: vscode-webview: vscode-file: https://fonts.gstatic.com http: https:; img-src 'self' data: blob: vscode-webview: vscode-file: http: https:; connect-src 'self' data: blob: vscode-webview: vscode-file: http: https: ws: wss:;",
    shellScriptHtml: `<script type="module" src="${origin}/src/main.js"></script>`,
    appHostId: shellLayout.appHostId,
    headExtraHtml: [shellLayout.headHtml, stylesHref ? `<link rel="stylesheet" href="${stylesHref}" />` : ""].filter(Boolean).join("\n"),
    bodyClass: shellLayout.bodyClass,
    headerAttributes: shellLayout.headerAttributes,
    bodyBeforeShellHtml: shellLayout.headerHtml,
    bodyAfterShellHtml: [
      shellLayout.footerHtml,
      websocketUrl ? `<script>globalThis.__nojsxWebSocketUrl = ${JSON.stringify(websocketUrl)};</script>` : "",
      shellLayout.scriptsHtml,
    ]
      .filter(Boolean)
      .join("\n"),
  }));
}
