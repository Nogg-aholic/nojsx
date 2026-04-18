type __nojsxJsxFn = (tag: string | Function | symbol, props?: JSX.HtmlTag, key?: any) => string;
type __nojsxJsxDevFn = (
  tag: string | Function | symbol,
  props?: any,
  key?: any,
  _isStaticChildren?: any,
  _source?: any,
  _self?: any
) => string;
type __nojsxNavHandlerFn = (resolvedPath: string) => boolean | void;


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
    navHandler?: __nojsxNavHandlerFn;
  }
}
export const g = globalThis as unknown as GlobalThis;
