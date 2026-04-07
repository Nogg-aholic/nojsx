export declare function compilePreview(payload: any): Promise<{
    entryJsPath: string;
    moduleMap: Record<string, string>;
    jsxImportSource: string;
}>;
export default compilePreview;
