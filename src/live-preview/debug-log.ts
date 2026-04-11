import os from 'node:os';
import path from 'node:path';
import { mkdir, appendFile, writeFile } from 'node:fs/promises';

type DebugLogRecord = {
  time: string;
  scope: string;
  step: string;
  data?: unknown;
};

function sanitizeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 80) || 'default';
}

export function getLivePreviewDebugLogPath(serverSessionId: string, requestPath?: string): string {
  const root = path.join(os.tmpdir(), 'nojsx-live-preview', 'logs');
  const session = sanitizeSegment(serverSessionId || 'default');
  const request = sanitizeSegment((requestPath || 'root').replace(/^\/+/, ''));
  return path.join(root, `${session}__${request}.jsonl`);
}

export async function resetLivePreviewDebugLog(serverSessionId: string, requestPath?: string): Promise<string> {
  const filePath = getLivePreviewDebugLogPath(serverSessionId, requestPath);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, '', 'utf8');
  return filePath;
}

export async function appendLivePreviewDebugLog(serverSessionId: string, scope: string, step: string, data?: unknown, requestPath?: string): Promise<void> {
  const filePath = getLivePreviewDebugLogPath(serverSessionId, requestPath);
  await mkdir(path.dirname(filePath), { recursive: true });
  const record: DebugLogRecord = {
    time: new Date().toISOString(),
    scope,
    step,
    data,
  };
  await appendFile(filePath, `${JSON.stringify(record)}\n`, 'utf8');
}
