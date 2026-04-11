import { getUpstreamHostRpcEndpoint, invokeUpstreamHostRpcPath } from './upstream-host-proxy.js';

export type HostOpenApiSchema = {
  type?: string;
  description?: string;
  items?: HostOpenApiSchema;
  properties?: Record<string, HostOpenApiSchema>;
  required?: string[];
  anyOf?: HostOpenApiSchema[];
  enum?: Array<string | number | boolean | null>;
};

export type HostOpenApiDocument = {
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
              schema: HostOpenApiSchema;
            };
          };
        };
        responses: {
          '200': {
            description: string;
            content: {
              'application/json': {
                schema: HostOpenApiSchema;
              };
            };
          };
        };
      };
    }
  >;
};

type HostSymbolReference = {
  __nojsxRpcName?: string;
};

export function resolveUpstreamHostOpenApiSymbol(symbolOrReference: HostSymbolReference): string {
  const symbol = symbolOrReference?.__nojsxRpcName;
  if (typeof symbol !== 'string' || symbol.length === 0) {
    throw new Error('Upstream host OpenAPI symbol must be a host RPC reference.');
  }
  if (!symbol.startsWith('vscode.')) {
    throw new Error(`Upstream host OpenAPI symbol must start with "vscode.": ${symbol}`);
  }
  return symbol;
}

export function getUpstreamHostOpenApiEndpoint(symbolOrReference: HostSymbolReference): string {
  return buildUpstreamHostDocsUrl('/openapi', resolveUpstreamHostOpenApiSymbol(symbolOrReference));
}

export function getUpstreamHostOpenApiScalarEndpoint(symbolOrReference: HostSymbolReference): string {
  return buildUpstreamHostDocsUrl('/openapi/scalar', resolveUpstreamHostOpenApiSymbol(symbolOrReference));
}

export async function requestUpstreamHostOpenApiDocument(symbolOrReference: HostSymbolReference): Promise<HostOpenApiDocument> {
  const symbol = resolveUpstreamHostOpenApiSymbol(symbolOrReference);
  const payload = await invokeUpstreamHostRpcPath(['__openapi'], [symbol]);
  return payload as HostOpenApiDocument;
}

export async function requestUpstreamHostOpenApiScalarHtml(symbolOrReference: HostSymbolReference): Promise<string> {
  const symbol = resolveUpstreamHostOpenApiSymbol(symbolOrReference);
  const payload = await invokeUpstreamHostRpcPath(['__openapiScalar'], [symbol]);
  if (typeof payload !== 'string') {
    throw new Error('Upstream host OpenAPI scalar response must be a string.');
  }
  return payload;
}

function buildUpstreamHostDocsUrl(pathname: '/openapi' | '/openapi/scalar', symbol: string): string {
  const url = new URL(getUpstreamHostRpcEndpoint());
  const basePath = url.pathname.endsWith('/rpc') ? url.pathname.slice(0, -4) : url.pathname.replace(/\/$/, '');
  url.pathname = `${basePath}${pathname}`;
  url.search = '';
  url.searchParams.set('symbol', symbol);
  return url.toString();
}
