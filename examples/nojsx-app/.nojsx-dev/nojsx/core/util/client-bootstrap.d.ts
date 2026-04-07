export type nojsxClientBootstrapOptions = {
    providerScriptUrls?: string[];
};
export declare function bindClientDelegatedEvents(): void;
export declare function bootstrapClientRuntime(options?: nojsxClientBootstrapOptions): void;
export declare function renderPreviewDocument(html: string): void;
