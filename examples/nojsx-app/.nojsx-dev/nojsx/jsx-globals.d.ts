declare const root: GlobalThis & {
    eval?: (code: string) => unknown;
};
declare const gg: GlobalThis;
declare const ggAny: any;
declare function ensureProxy(name: string, implKey: string): void;
