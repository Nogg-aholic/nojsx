import path from 'node:path';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { ServerWebSocket } from 'bun';

export type StartNojsxServerOptions = {
	serverModuleUrl: string;
	port?: number;
	devRoot?: string;
	generatedLoadersPath?: string;
	logPrefix?: string;
	development?: boolean;
	handleRequest?: (
		request: Request,
		server: Bun.Server<{ type: 'main' }>,
	) => Response | null | undefined | Promise<Response | null | undefined>;
};

type NojsxServerRuntime = {
	handleClientConstruct: (data: Uint8Array) => void | Promise<void>;
	handleRpcAwaitFromClient: (data: Uint8Array, ws: ServerWebSocket<{ type: 'main' }>) => void | Promise<void>;
	setSocket: (ws: ServerWebSocket<{ type: 'main' }>) => void;
	deleteSocket: (ws: ServerWebSocket<{ type: 'main' }>) => void;
	nojsxWSEvent: Record<string, number>;
};

async function waitForFile(filePath: string, timeoutMs = 15000): Promise<void> {
	const startedAt = Date.now();
	while (!existsSync(filePath)) {
		if (Date.now() - startedAt >= timeoutMs) {
			throw new Error(`[nojsx] Timed out waiting for generated file: ${filePath}`);
		}
		await Bun.sleep(50);
	}
}

function resolveAppPaths(options: StartNojsxServerOptions): {
	devRoot: string;
	generatedLoadersPath: string;
} {
	const srcRoot = path.dirname(fileURLToPath(options.serverModuleUrl));
	const appRoot = path.dirname(srcRoot);
	const devRoot = options.devRoot ? path.resolve(appRoot, options.devRoot) : path.join(appRoot, 'dist');
	return {
		devRoot,
		generatedLoadersPath: options.generatedLoadersPath
			? path.resolve(appRoot, options.generatedLoadersPath)
			: path.join(devRoot, 'src', '__nojsx_component_loaders.js'),
	};
}

function resolveNrpcDistRoot(fromModuleUrl: string): string {
	const fromFilePath = fileURLToPath(fromModuleUrl);
	const requireFromServerModule = createRequire(fromFilePath);
	const nrpcPackageJsonPath = requireFromServerModule.resolve('@nogg-aholic/nrpc/package.json');
	return path.join(path.dirname(nrpcPackageJsonPath), 'dist');
}

function resolveNojsxDistRoot(fromModuleUrl: string): string {
	const fromFilePath = fileURLToPath(fromModuleUrl);
	const requireFromServerModule = createRequire(fromFilePath);
	const nojsxPackageJsonPath = requireFromServerModule.resolve('nojsx/package.json');
	return path.join(path.dirname(nojsxPackageJsonPath), 'dist');
}

async function loadNojsxServerRuntime(nojsxDistRoot: string): Promise<NojsxServerRuntime> {
	const receiverModule = await import(pathToFileURL(path.join(nojsxDistRoot, 'core', 'transport', 'server', 'receiver.js')).href);
	const senderModule = await import(pathToFileURL(path.join(nojsxDistRoot, 'core', 'transport', 'server', 'sender.js')).href);
	const eventsModule = await import(pathToFileURL(path.join(nojsxDistRoot, 'core', 'transport', 'events.js')).href);
	return {
		handleClientConstruct: receiverModule.handleClientConstruct,
		handleRpcAwaitFromClient: receiverModule.handleRpcAwaitFromClient,
		setSocket: senderModule.setSocket,
		deleteSocket: senderModule.deleteSocket,
		nojsxWSEvent: eventsModule.nojsxWSEvent,
	};
}

function contentType(filePath: string): string {
	const ext = path.extname(filePath).toLowerCase();
	return ext === '.js' || ext === '.mjs'
		? 'text/javascript; charset=utf-8'
		: ext === '.json'
			? 'application/json; charset=utf-8'
			: ext === '.html'
				? 'text/html; charset=utf-8'
				: ext === '.css'
					? 'text/css; charset=utf-8'
					: ext === '.map'
						? 'application/json; charset=utf-8'
						: 'application/octet-stream';
}

function responseHeaders(contentTypeValue: string): HeadersInit {
	return {
		'content-type': contentTypeValue,
		'cache-control': 'no-cache',
		'access-control-allow-origin': '*',
		'access-control-allow-methods': 'GET, POST, OPTIONS',
		'access-control-allow-headers': '*',
	};
}

function resolveSafePath(root: string, relativePath: string): string | null {
	const normalizedRelative = relativePath.replace(/^[/\\]+/, '');
	const absolutePath = path.resolve(root, normalizedRelative);
	const relativeToRoot = path.relative(root, absolutePath);
	if (relativeToRoot.startsWith('..') || path.isAbsolute(relativeToRoot)) {
		return null;
	}
	return absolutePath;
}

function resolvePackageAssetPath(root: string, requestPath: string, prefix: string): string | null {
	if (!requestPath.startsWith(prefix)) {
		return null;
	}

	const relativePath = requestPath.slice(prefix.length);
	return resolveSafePath(root, relativePath);
}

function normalizeRequestPath(url: URL): string {
	if (url.pathname === '/' || url.pathname === '/index.html') {
		return 'index.html';
	}

	const pathname = decodeURIComponent(url.pathname).replace(/^\/+/, '');
	if (pathname.startsWith('src/') || pathname.startsWith('nojsx/') || pathname.startsWith('node_modules/')) {
		return pathname;
	}

	if (
		!pathname.includes('.')
	) {
		return 'index.html';
	}

	return pathname;
}

export async function startNojsxServer(options: StartNojsxServerOptions): Promise<{ port: number; stop: () => void }> {
	const { devRoot, generatedLoadersPath } = resolveAppPaths(options);
	const port = options.port ?? Number(process.env.PORT || 4174);
	const logPrefix = options.logPrefix ?? '[nojsx]';
	const development = options.development ?? true;
	const decoder = new TextDecoder();
	const nojsxDistRoot = resolveNojsxDistRoot(options.serverModuleUrl);
	const nrpcDistRoot = resolveNrpcDistRoot(options.serverModuleUrl);

	await waitForFile(generatedLoadersPath);
	const nojsxRuntime = await loadNojsxServerRuntime(nojsxDistRoot);
	await import(pathToFileURL(generatedLoadersPath).href);

	const server = Bun.serve<{ type: 'main' }>({
		port,
		development,
		async fetch(request: Request, server) {
			const customResponse = await options.handleRequest?.(request, server);
			if (customResponse) {
				return customResponse;
			}

			const requestUrl = new URL(request.url);
			const nojsxPackageAssetPath = resolvePackageAssetPath(nojsxDistRoot, requestUrl.pathname, '/_pkg/nojsx/');
			if (nojsxPackageAssetPath && existsSync(nojsxPackageAssetPath)) {
				const body = await readFile(nojsxPackageAssetPath);
				return new Response(body, { status: 200, headers: responseHeaders(contentType(nojsxPackageAssetPath)) });
			}

			const nrpcPackageAssetPath = resolvePackageAssetPath(nrpcDistRoot, requestUrl.pathname, '/_pkg/nrpc/');
			if (nrpcPackageAssetPath && existsSync(nrpcPackageAssetPath)) {
				const body = await readFile(nrpcPackageAssetPath);
				return new Response(body, { status: 200, headers: responseHeaders(contentType(nrpcPackageAssetPath)) });
			}

			if (requestUrl.pathname === '/ws') {
				const upgraded = server.upgrade(request, { data: { type: 'main' } });
				if (!upgraded) {
					return new Response('WebSocket upgrade failed', { status: 400 });
				}
				return undefined;
			}

			if (request.method === 'OPTIONS') {
				return new Response(null, {
					status: 204,
					headers: {
						'access-control-allow-origin': '*',
						'access-control-allow-methods': 'GET, POST, OPTIONS',
						'access-control-allow-headers': '*',
						'access-control-max-age': '86400',
					},
				});
			}

			const relativePath = normalizeRequestPath(requestUrl);
			let absolutePath = resolveSafePath(devRoot, relativePath);
			if (!absolutePath) {
				return new Response('Forbidden', { status: 403 });
			}

			if (!path.extname(absolutePath)) {
				const withJs = `${absolutePath}.js`;
				const asIndexJs = path.join(absolutePath, 'index.js');
				if (existsSync(withJs)) {
					absolutePath = withJs;
				} else if (existsSync(asIndexJs)) {
					absolutePath = asIndexJs;
				}
			}

			if (!existsSync(absolutePath)) {
				return new Response('Not Found', { status: 404 });
			}

			const body = await readFile(absolutePath);
			return new Response(body, {
				status: 200,
				headers: responseHeaders(contentType(absolutePath)),
			});
		},
		websocket: {
			open(ws: ServerWebSocket<{ type: 'main' }>) {
				nojsxRuntime.setSocket(ws);
			},
			close(ws: ServerWebSocket<{ type: 'main' }>) {
				nojsxRuntime.deleteSocket(ws);
			},
			message(ws: ServerWebSocket<{ type: 'main' }>, message) {
				void (async () => {
					if (typeof message === 'string') return;
					const data = new Uint8Array(message);
					if (data.length === 0) return;

					switch (data[0]) {
						case nojsxRuntime.nojsxWSEvent.ClientConstruct:
							await nojsxRuntime.handleClientConstruct(data);
							break;
						case nojsxRuntime.nojsxWSEvent.RPC_CALL_AWAIT:
							await nojsxRuntime.handleRpcAwaitFromClient(data, ws);
							break;
						case nojsxRuntime.nojsxWSEvent.ClientRender: {
							const componentIdLen = data[1];
							const componentId = decoder.decode(data.subarray(2, 2 + componentIdLen));
							console.log(`${logPrefix} client render`, componentId);
							break;
						}
						default:
							console.warn(`${logPrefix} unhandled ws event: 0x${data[0].toString(16)}`);
					}
				})();
			},
		},
	});

	const stop = () => {
		server.stop(true);
	};

	process.on('SIGINT', () => {
		stop();
		process.exit(0);
	});

	process.on('SIGTERM', () => {
		stop();
		process.exit(0);
	});

	const resolvedPort = server.port ?? port;
	console.log(`${logPrefix} server http://127.0.0.1:${resolvedPort}`);
	return { port: resolvedPort, stop };
}

export async function startNojsxDevServer(options: StartNojsxServerOptions): Promise<{ port: number; stop: () => void }> {
	return startNojsxServer({
		...options,
		development: options.development ?? true,
	});
}