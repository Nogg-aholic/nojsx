import os from 'node:os';
import path from 'node:path';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { compilePreview } from './compile-tsx-preview.js';
import renderTsxPreviewRunner from './render-tsx-preview.js';
import { appendLivePreviewDebugLog, resetLivePreviewDebugLog } from './debug-log.js';

type BuildShellEntryPreviewArgs = {
	filePath: string;
	sourceText: string;
	serverSessionId?: string;
	requestPath?: string;
};

type RenderTsxPreviewRunner = (payload: Record<string, unknown>) => Promise<string>;

export async function buildShellEntryPreview(args: BuildShellEntryPreviewArgs): Promise<string> {
	const tempRoot = path.join(os.tmpdir(), 'nojsx-shell-preview');
	await mkdir(tempRoot, { recursive: true });
	const tempDir = path.join(tempRoot, randomUUID());
	const serverSessionId = args.serverSessionId ?? 'default';
	const requestPath = args.requestPath ?? '/home';
	const logPath = await resetLivePreviewDebugLog(serverSessionId, requestPath);
	await appendLivePreviewDebugLog(serverSessionId, 'build-shell-entry-preview', 'start', {
		filePath: args.filePath,
		requestPath,
		logPath,
	}, requestPath);
	const runner = renderTsxPreviewRunner as unknown as RenderTsxPreviewRunner;
	await mkdtemp(`${tempDir}-`);
	let compiled;
	try {
		compiled = await compilePreview({
			filePath: args.filePath,
			sourceText: args.sourceText,
			outDir: tempDir,
			serverSessionId,
			serverProcessRef: serverSessionId,
			requestPath,
		});
		await appendLivePreviewDebugLog(serverSessionId, 'build-shell-entry-preview', 'compile-success', {
			entryJsPath: compiled.entryJsPath,
			jsxImportSource: compiled.jsxImportSource,
			moduleMapKeys: Object.keys(compiled.moduleMap),
		}, requestPath);
	} catch (error) {
		await appendLivePreviewDebugLog(serverSessionId, 'build-shell-entry-preview', 'compile-failure', {
			message: error instanceof Error ? error.message : String(error),
			stack: error instanceof Error ? error.stack : undefined,
		}, requestPath);
		throw error;
	}

	(globalThis as Record<string, unknown>).__livePreview = {
		...((globalThis as Record<string, unknown>).__livePreview as Record<string, unknown> | undefined),
		filePath: args.filePath,
		sourceText: args.sourceText,
		requestPath,
		serverSessionId,
		serverProcessRef: serverSessionId,
		jsxImportSource: compiled.jsxImportSource,
		jsxRuntimeSpecifier: `${compiled.jsxImportSource}/jsx-runtime`,
		debugLogPath: logPath,
	};

	return runner({
		filePath: args.filePath,
		sourceText: args.sourceText,
		tempDir,
		compiled: {
			emittedJsPath: compiled.entryJsPath,
			moduleMap: compiled.moduleMap,
		},
	});
}

export default buildShellEntryPreview;