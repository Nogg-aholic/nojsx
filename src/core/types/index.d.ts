type __nojsxPropsOf<T> = T extends (props: infer P, ...args: any[]) => any ? P : {};

type __nojsxComponentOf<TTemplate> = (props: __nojsxPropsOf<TTemplate>) => any;

type __nojsxNodeOf<TTemplate, Slots> = __nojsxComponentOf<TTemplate> & Slots;

type __nojsxJsxFn = (tag: string | Function | symbol, props?: JSX.HtmlTag, key?: any) => string;
type __nojsxJsxDevFn = (
  tag: string | Function | symbol,
  props?: any,
  key?: any,
  _isStaticChildren?: any,
  _source?: any,
  _self?: any
) => string;
type __nojsxLivePreviewJsxFn = (
  tag: string | Function | symbol,
  props?: JSX.HtmlTag,
  options?: { mount?: string | Element }
) => string;
type __nojsxPreviewRenderDocumentFn = (html: string) => void;
type __nojsxGetLivePreviewHtmlFn = () => Promise<string>;
type __nojsxIsLivePreviewModeFn = () => boolean;
type __nojsxEditorFn = (entry: Function, props?: Record<string, unknown>) => string;
type __nojsxPromiseLikeKeys = 'then' | 'catch' | 'finally';
type __nojsxRpcify<T> =
  T extends (...args: infer A) => infer R
    ? ((...args: A) => Promise<Awaited<R>>) & { __nojsxRpcName?: string }
    : T extends object
      ? { [K in keyof T as K extends __nojsxPromiseLikeKeys ? never : K]: __nojsxRpcify<T[K]> }
      : T;

type __nojsxVscodeRpcApi = __nojsxRpcify<typeof import('vscode')>;
type __nojsxRpcSymbolRef = { __nojsxRpcName?: string };

export type IntrinsicRenderer = (props?: any) => any;

export type __nojsxSlotCaptureToken = {
  id: number;
  rootName: string;
  component: unknown;
  parentId: string | null;
};

export type nojsxNavState = {
  path: string;
  pathname?: string;
  query?: string;
  routeTemplate?: string | null;
  params?: Record<string, string>;
};

declare type ComponentInstance = import('nojsx/core/components/components').NComponent;

export type ExtractParamKeys<T extends string> = T extends `${string}[${infer Param}]${infer Rest}`
  ? Param | ExtractParamKeys<Rest>
  : never;

export type RouteParams<T extends string> = ExtractParamKeys<T> extends never
  ? Record<string, string> | undefined
  : { [K in ExtractParamKeys<T>]: string } & Record<string, string>;

export type NavArgs<T extends string> = ExtractParamKeys<T> extends never
  ? [params?: RouteParams<T>]
  : [params: RouteParams<T>];

export type ShellBridgeExtended = ComponentInstance & {
  nav: <TPath extends string>(path: TPath, ...args: NavArgs<TPath>) => void;
};

declare global {
  var g: GlobalThis;
  var vscode: __nojsxVscodeRpcApi;
  var getDocs: ((symbolOrReference: __nojsxRpcSymbolRef) => Promise<import('nojsx/core/transport/server/upstream-host-openapi').HostOpenApiDocument>) & { __nojsxRpcName?: string };
  var getDocsHtml: ((symbolOrReference: __nojsxRpcSymbolRef) => Promise<string>) & { __nojsxRpcName?: string };

  namespace JSX {
    type Element = string;

    interface IntrinsicAttributes {
      key?: string | number;
      children?: unknown;
    }

    type HandlerThis = import('nojsx/core/components/components').NComponent & { [key: string]: any };

    interface HtmlTag {
      children?: unknown;
      class?: string;
      id?: string;
      role?: string;
      href?: string;
      type?: string;
      onclick?: string | ((this: HandlerThis) => void);
      [key: string]: unknown;
    }

    interface HtmlButtonTag extends HtmlTag {
      type?: string;
    }
    interface HtmlAnchorTag extends HtmlTag {
      href?: string;
    }
    interface HtmlInputTag extends HtmlTag {
      type?: string;
    }
    interface HtmlTableRowTag extends HtmlTag {}
    interface HtmlTableCellTag extends HtmlTag {}
    interface HtmlDivTag extends HtmlTag {}

    interface IntrinsicElements {
      [key: string]: HtmlTag;
    }
  }

  namespace nojsx {
    type Element = JSX.Element;
    type HtmlTag = JSX.HtmlTag;
    type HtmlButtonTag = JSX.HtmlButtonTag;
    type HtmlDivTag = JSX.HtmlDivTag;
  }

  function join(...parts: Array<string | false | undefined | null>): string;
}

export interface nojsxComponent {
  template: ((props: any) => any) | string;
  __nojsxNoSlotCapture?: boolean;
  slots?: Array<nojsxComponent>;
}

declare global {
  interface GlobalThis {
    getDocs?: ((symbolOrReference: __nojsxRpcSymbolRef) => Promise<import('nojsx/core/transport/server/upstream-host-openapi').HostOpenApiDocument>) & { __nojsxRpcName?: string };
    getDocsHtml?: ((symbolOrReference: __nojsxRpcSymbolRef) => Promise<string>) & { __nojsxRpcName?: string };
    __currentComponentId?: string | null;

    __nojsxInlineHandlerNextId?: number;
    __nojsxInlineHandlers?: Map<string, Function>;
    __nojsxInlineHandlersByComponent?: Map<string, Set<string>>;
    __nojsxDelegatedEventsBound?: boolean;

    __nojsxSlotCaptureWired?: boolean;
    __nojsxSlotCaptureNextId?: number;
    __nojsxSlotCaptureStack?: __nojsxSlotCaptureToken[];
    __nojsxSlotCaptureData?: Map<number, Record<string, string>>;
    __nojsxDebugSlots?: boolean;

    __nojsxInsideIntrinsic?: string;

    __nojsxNav?: nojsxNavState;
    __nojsxNavOutlet?: ComponentInstance;
    __nojsxPageRoutes?: Record<string, { componentName: string }>;
    __nojsxPages?: Record<string, string>;

    n: Record<string, unknown>;
    __nojsx_jsx_impl?: __nojsxJsxFn;
    __nojsx_jsxs_impl?: __nojsxJsxFn;
    __nojsx_jsxDEV_impl?: __nojsxJsxDevFn;
    __livePreviewMode?: boolean;
    __nojsxDevPreviewMode?: boolean;
    __livePreviewRequestPath?: string;
    Fragment?: symbol;
    jsx?: __nojsxJsxFn;
    jsxs?: __nojsxJsxFn;
    jsxDEV?: __nojsxJsxDevFn;
    _jsxDEV?: __nojsxJsxDevFn;
    livePreviewJSX?: __nojsxLivePreviewJsxFn;
    getLivePreviewHtml?: __nojsxGetLivePreviewHtmlFn;
    isLivePreviewMode?: __nojsxIsLivePreviewModeFn;
    NComponent?: typeof import('nojsx/core/components/components').NComponent;
    renderPreviewDocument?: __nojsxPreviewRenderDocumentFn;
    jsxEditor?: __nojsxEditorFn;
    live_preview?: boolean;
    __livePreview?: {
      filePath?: string;
      sourceText?: string;
      serverProcessRef?: string;
      serverSessionId?: string;
      hostCapabilities?: Record<string, unknown>;
      workingDirectory?: string;
      projectRoot?: string;
      requestPath?: string;
      tempDir?: string;
      outputPath?: string;
      httpPort?: number;
      precomputedHtml?: string;
      mode?: string;
    };
    __livePreviewHtml?: string;
  }
}

export {};
