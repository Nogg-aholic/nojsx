import { NComponent } from "./components.js";
import { renderShellPageParentDocument } from "./shell-page-parent-renderer.js";
function escapeHtml(input) {
    return input
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}
export class ShellPageParent extends NComponent {
    shellProps;
    constructor(props) {
        super("ShellPageParent", props);
        this.shellProps = {
            title: props?.title ?? "App",
            importMap: props?.importMap ?? {},
            cspNonce: props?.cspNonce ?? "",
            cspContent: props?.cspContent ?? "",
            shellSrc: props?.shellSrc ?? "./shell.js",
            shellScriptHtml: props?.shellScriptHtml,
            bodyClass: props?.bodyClass,
            appHostId: props?.appHostId,
            headExtraHtml: props?.headExtraHtml,
            bodyBeforeShellHtml: props?.bodyBeforeShellHtml,
            bodyAfterShellHtml: props?.bodyAfterShellHtml,
            class: props?.class,
            __id: props?.__id,
            key: props?.key,
            __key: props?.__key,
        };
    }
    html = () => {
        const hostId = this.shellProps.appHostId ?? "info";
        const className = this.shellProps.bodyClass?.trim();
        const classAttr = className ? ` class="${escapeHtml(className)}"` : "";
        return `<div id="${escapeHtml(hostId)}"${classAttr}></div>`;
    };
    renderDocument() {
        return renderShellPageParentDocument(this.shellProps);
    }
}
//# sourceMappingURL=shell-page-parent.js.map