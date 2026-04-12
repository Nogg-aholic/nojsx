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
type __nojsxPreviewRenderDocumentFn = (html: string) => void;
type __nojsxEditorFn = (entry: Function, props?: Record<string, unknown>) => string;
type __nojsxNavHandlerFn = (resolvedPath: string) => boolean | void;
type __nojsxPromiseLikeKeys = 'then' | 'catch' | 'finally';
type __nojsxRpcify<T> =
  T extends (...args: infer A) => infer R
    ? ((...args: A) => Promise<Awaited<R>>) & { __nojsxRpcName?: string }
    : T extends object
      ? { [K in keyof T as K extends __nojsxPromiseLikeKeys ? never : K]: __nojsxRpcify<T[K]> }
      : T;

type __nojsxRpcSymbolRef = { __nojsxRpcName?: string };

export type IntrinsicRenderer = (props?: any) => any;

export type nojsxNavState = {
  path: string;
  pathname?: string;
  query?: string;
  routeTemplate?: string | null;
  params?: Record<string, string>;
};

declare type ComponentInstance = import('../../index.js').NComponent;

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
  namespace JSX {
    type Element = string;

    interface IntrinsicAttributes {
      key?: string | number;
      children?: unknown;
    }

    type HandlerThis = import('../../index.js').NComponent & { [key: string]: any };

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
  slots?: Array<nojsxComponent>;
}

declare global {
  interface GlobalThis {
    __currentComponentId?: string | null;

    __nojsxInlineHandlerNextId?: number;
    __nojsxInlineHandlers?: Map<string, Function>;
    __nojsxInlineHandlersByComponent?: Map<string, Set<string>>;
    __nojsxDelegatedEventsBound?: boolean;

    __nojsxNav?: nojsxNavState;
    __nojsxNavOutlet?: ComponentInstance;
    __nojsxPageRoutes?: Record<string, { componentName: string }>;
    __nojsxPages?: Record<string, string>;
    __nojsx_jsx_impl?: __nojsxJsxFn;
    __nojsx_jsxs_impl?: __nojsxJsxFn;
    __nojsx_jsxDEV_impl?: __nojsxJsxDevFn;
   
    Fragment?: symbol;
    jsx?: __nojsxJsxFn;
    jsxs?: __nojsxJsxFn;
    jsxDEV?: __nojsxJsxDevFn;
    _jsxDEV?: __nojsxJsxDevFn;
    NComponent?: typeof import('../../index.js').NComponent;
    navHandler?: __nojsxNavHandlerFn;
  }
}
export const g = globalThis as unknown as GlobalThis;

export {};

type __nojsxInjectedRpcSymbolRef = { __nojsxRpcName?: string };
type __nojsxInjectedHostOpenApiSchema = {
  type?: string;
  description?: string;
  items?: __nojsxInjectedHostOpenApiSchema;
  properties?: Record<string, __nojsxInjectedHostOpenApiSchema>;
  required?: string[];
  anyOf?: __nojsxInjectedHostOpenApiSchema[];
  enum?: Array<string | number | boolean | null>;
};
export type __nojsxInjectedHostOpenApiDocument = {
  openapi: '3.1.0';
  info: {
    title: string;
    version: string;
  };
  paths: Record<
    string,
    {
      post: {
        operationId: string;
        summary?: string;
        description?: string;
        requestBody: {
          required: boolean;
          content: {
            'application/json': {
              schema: __nojsxInjectedHostOpenApiSchema;
            };
          };
        };
        responses: {
          '200': {
            description: string;
            content: {
              'application/json': {
                schema: __nojsxInjectedHostOpenApiSchema;
              };
            };
          };
        };
      };
    }
  >;
};
type __nojsxInjectedVscodeRpcApi = __nojsxInjectedRpcify<Record<string, unknown>>;
type __nojsxInjectedPromiseLikeKeys = 'then' | 'catch' | 'finally';
type __nojsxInjectedRpcify<T> =
  T extends (...args: infer A) => infer R
    ? ((...args: A) => Promise<Awaited<R>>) & { __nojsxRpcName?: string }
    : T extends object
      ? { [K in keyof T as K extends __nojsxInjectedPromiseLikeKeys ? never : K]: __nojsxInjectedRpcify<T[K]> }
      : T;

declare global {
  var vscode: __nojsxInjectedVscodeRpcApi;
  var getDocs:
    ((symbolOrReference: __nojsxInjectedRpcSymbolRef) => Promise<__nojsxInjectedHostOpenApiDocument>)
    & { __nojsxRpcName?: string };
  var getDocsHtml:
    ((symbolOrReference: __nojsxInjectedRpcSymbolRef) => Promise<string>)
    & { __nojsxRpcName?: string };
}
