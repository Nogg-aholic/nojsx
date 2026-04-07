export const defaultShellPageParentProviderScripts = [
    `<script>`,
    `(() => {`,
    `  const removeDiagnostics = () => {`,
    `    document.getElementById('nojsx-live-preview-diagnostics')?.remove();`,
    `  };`,
    `  removeDiagnostics();`,
    `  window.addEventListener('load', removeDiagnostics, { once: true });`,
    `  new MutationObserver(() => removeDiagnostics()).observe(document.documentElement, { childList: true, subtree: true });`,
    `})();`,
    `</script>`,
].join("\n");
function escapeHtml(input) {
    return input
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}
export function renderShellPageParentDocument(props) {
    const { title = "App", importMap = {}, cspNonce = "", cspContent = "", shellSrc = "./shell.js", shellScriptHtml = "", bodyClass, appHostId, headExtraHtml = "", bodyBeforeShellHtml = "", bodyAfterShellHtml = "", headerAttributes = "", } = props;
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
