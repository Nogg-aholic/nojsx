/** @jsxImportSource nojsx */
import path from "node:path";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
const srcRoot = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.dirname(srcRoot);
const devRoot = path.join(appRoot, "dist");
const liveReloadStampPath = path.join(devRoot, ".nojsx-live-reload.json");
const port = Number(process.env.PORT || 4173);
const liveReloadClients = new Set<WritableStreamDefaultWriter<string>>();

function broadcastLiveReload(version: number): void {
	const payload = `data: ${JSON.stringify({ version })}\n\n`;
	for (const writer of Array.from(liveReloadClients)) {
		void writer.write(payload).catch(() => {
			liveReloadClients.delete(writer);
			void writer.close().catch(() => {});
		});
	}
}

async function readLiveReloadVersion(): Promise<number> {
	try {
		const raw = await readFile(liveReloadStampPath, "utf8");
		const parsed = JSON.parse(raw) as { version?: number };
		return Number(parsed.version ?? 0);
	} catch {
		return 0;
	}
}

function findRepoRoot(startDir: string): string {
	let current = startDir;
	while (true) {
		const pkgPath = path.join(current, "package.json");
		const scriptsPath = path.join(current, "script", "example-app-dev-build.ts");
		if (existsSync(pkgPath) && existsSync(scriptsPath)) {
			return current;
		}
		const parent = path.dirname(current);
		if (parent === current) {
			break;
		}
		current = parent;
	}
	return path.resolve(appRoot, "..", "..", "..");
}

const repoRoot = findRepoRoot(appRoot);
const buildScriptPath = path.join(repoRoot, "script", "example-app-dev-build.ts");

function contentType(filePath: string): string {
	const ext = path.extname(filePath).toLowerCase();
	return ext === ".js" || ext === ".mjs"
		? "text/javascript; charset=utf-8"
		: ext === ".json"
			? "application/json; charset=utf-8"
			: ext === ".html"
				? "text/html; charset=utf-8"
				: ext === ".css"
					? "text/css; charset=utf-8"
					: ext === ".map"
						? "application/json; charset=utf-8"
						: "application/octet-stream";
}

function responseHeaders(contentTypeValue: string): HeadersInit {
	return {
		"content-type": contentTypeValue,
		"cache-control": "no-cache",
		"access-control-allow-origin": "*",
		"access-control-allow-methods": "GET, POST, OPTIONS",
		"access-control-allow-headers": "*",
	};
}

function resolveSafePath(root: string, relativePath: string): string | null {
	const normalizedRelative = relativePath.replace(/^[/\\]+/, "");
	const absolutePath = path.resolve(root, normalizedRelative);
	const relativeToRoot = path.relative(root, absolutePath);
	if (relativeToRoot.startsWith("..") || path.isAbsolute(relativeToRoot)) {
		return null;
	}
	return absolutePath;
}

let preparedOrigin: string | null = null;
let preparePromise: Promise<void> | null = null;

async function ensurePrepared(origin: string): Promise<void> {
	if (preparedOrigin === origin) return;
	if (!preparePromise) {
		preparePromise = new Promise<void>((resolve, reject) => {
			const child = spawn("bun", [buildScriptPath, "--app-root", appRoot, "--origin", origin], {
				cwd: repoRoot,
				windowsHide: true,
				stdio: ["ignore", "pipe", "pipe"],
				env: process.env,
			});

			let stderr = "";
			let stdout = "";
			child.stdout.setEncoding("utf8");
			child.stderr.setEncoding("utf8");
			child.stdout.on("data", (chunk) => {
				stdout += chunk;
			});
			child.stderr.on("data", (chunk) => {
				stderr += chunk;
			});
			child.on("error", reject);
			child.on("close", (code) => {
				if (code === 0) {
					resolve();
					return;
				}
				reject(new Error(stderr || stdout || `Build failed with code ${code}`));
			});
		})
			.then(() => {
				preparedOrigin = origin;
			})
			.finally(() => {
				preparePromise = null;
			});
	}
	await preparePromise;
}

function normalizeRequestPath(url: URL): string {
	if (url.pathname === "/" || url.pathname === "/index.html") {
		return "index.html";
	}

	const pathname = decodeURIComponent(url.pathname).replace(/^\/+/, "");
	if (!pathname.includes(".") && !pathname.startsWith("src/") && !pathname.startsWith("nojsx/")) {
		return "index.html";
	}

	return pathname;
}

const server = Bun.serve({
	port,
	development: true,
	async fetch(request: Request) {
		const requestUrl = new URL(request.url);

		if (request.method === "OPTIONS") {
			return new Response(null, {
				status: 204,
				headers: {
					"access-control-allow-origin": "*",
					"access-control-allow-methods": "GET, POST, OPTIONS",
					"access-control-allow-headers": "*",
					"access-control-max-age": "86400",
				},
			});
		}

		if (requestUrl.pathname === "/__nojsx_live_reload") {
			const stream = new TransformStream<string, Uint8Array>({
				transform(chunk, controller) {
					controller.enqueue(new TextEncoder().encode(chunk));
				},
			});
			const writer = stream.writable.getWriter();
			liveReloadClients.add(writer);

			const version = await readLiveReloadVersion();
			await writer.write(`retry: 1000\n`);
			await writer.write(`data: ${JSON.stringify({ version })}\n\n`);

			request.signal.addEventListener("abort", () => {
				liveReloadClients.delete(writer);
				void writer.close().catch(() => {});
			}, { once: true });

			return new Response(stream.readable, {
				headers: {
					"content-type": "text/event-stream; charset=utf-8",
					"cache-control": "no-cache, no-store, must-revalidate",
					"access-control-allow-origin": "*",
					"access-control-allow-methods": "GET, POST, OPTIONS",
					"access-control-allow-headers": "*",
					connection: "keep-alive",
					"x-accel-buffering": "no",
				},
			});
		}

		if (requestUrl.pathname === "/__nojsx_live_reload/publish" && request.method === "POST") {
			const payload = await request.json().catch(() => null) as { version?: number } | null;
			const version = Number(payload?.version ?? 0) || Date.now();
			await Bun.write(liveReloadStampPath, JSON.stringify({ version }));
			broadcastLiveReload(version);
			return Response.json({ ok: true, version }, {
				headers: {
					"cache-control": "no-cache",
					"access-control-allow-origin": "*",
					"access-control-allow-methods": "GET, POST, OPTIONS",
					"access-control-allow-headers": "*",
				},
			});
		}

		await ensurePrepared(requestUrl.origin);

		const relativePath = normalizeRequestPath(requestUrl);
		let absolutePath = resolveSafePath(devRoot, relativePath);

		if (!absolutePath) {
			return new Response("Forbidden", { status: 403 });
		}

		if (!path.extname(absolutePath)) {
			const withJs = `${absolutePath}.js`;
			const asIndexJs = path.join(absolutePath, "index.js");
			if (existsSync(withJs)) {
				absolutePath = withJs;
			} else if (existsSync(asIndexJs)) {
				absolutePath = asIndexJs;
			}
		}

		if (!existsSync(absolutePath)) {
			return new Response("Not Found", { status: 404 });
		}

		const body = await readFile(absolutePath);
		return new Response(body, {
			status: 200,
			headers: responseHeaders(contentType(absolutePath)),
		});
	},
});

console.log(`[nojsx-app] dev server http://127.0.0.1:${server.port}`);
