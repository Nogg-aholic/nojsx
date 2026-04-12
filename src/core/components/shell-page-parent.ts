import { NComponent, NComponentProps } from "./components.js";
import { nojsxComponentLoaders } from "../components/registry.js";
import { renderShellPageParentDocument } from "../util/shell-page-parent-renderer.js";

export interface ShellPageParentDocumentProps {
  title: string;
  importMap: Record<string, string>;
  cspNonce: string;
  cspContent: string;
  shellSrc: string;
  shellScriptHtml?: string;
  bodyClass?: string;
  appHostId?: string;
  headExtraHtml?: string;
  bodyBeforeShellHtml?: string;
  bodyAfterShellHtml?: string;
  headerAttributes?: string;
}

export type ShellPageParentProps = NComponentProps & Partial<ShellPageParentDocumentProps>;

function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export class ShellPageParent extends NComponent {
  private readonly shellProps: ShellPageParentProps;

  constructor(props?: ShellPageParentProps) {
    const inferredName = new.target?.name && new.target.name !== 'ShellPageParent'
      ? new.target.name
      : 'ShellPageParent';
    super(inferredName, props);
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

  html = (): JSX.Element => {
    const hostId = this.shellProps.appHostId ?? "info";
    const className = this.shellProps.bodyClass?.trim();
    const classAttr = className ? ` class="${escapeHtml(className)}"` : "";
    return `<div id="${escapeHtml(hostId)}"${classAttr}></div>` as unknown as JSX.Element;
  };

  renderDocument(): string {
    return renderShellPageParentDocument(this.shellProps);
  }
}

nojsxComponentLoaders.ShellPageParent = (props?: any) => new ShellPageParent(props);
