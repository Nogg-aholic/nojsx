import { NComponent, NComponentProps } from "./components.js";
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
export declare class ShellPageParent extends NComponent {
    private readonly shellProps;
    constructor(props?: ShellPageParentProps);
    html: () => JSX.Element;
    renderDocument(): string;
}
