/** @jsxImportSource nojsx */
import { NComponent, type NComponentProps } from "nojsx/core/components/components";
import type { HostOpenApiDocument } from "nojsx/core/transport/server/upstream-host-openapi";
import type {} from "nojsx/core/types/index";

const getDocs = globalThis.getDocs!;
const getDocsHtml = globalThis.getDocsHtml!;

export class OpenApiPage extends NComponent {
  openApiDocument: HostOpenApiDocument | null = null;
  openApiDoc: string | null = null;
  error: string | null = null;
  isLoading = false;

  constructor(props?: NComponentProps) {
    super("OpenApi", props);
  }

  loadOpenApiDoc = async () => {
    if (this.isLoading || this.openApiDoc) return;

    this.isLoading = true;
    this.error = null;
    this.render();

    try {
      const document = await this.callOnServerAsync(getDocs, vscode.commands.getCommands);
      const html = await this.callOnServerAsync(getDocsHtml, vscode.commands.getCommands);
      this.openApiDocument = document;
      this.openApiDoc = html;
    } catch (error) {
      this.error = String((error as Error)?.message ?? error);
    } finally {
      this.isLoading = false;
      this.render();
    }
  };

  get operationSummary() {
    const firstPathEntry = this.openApiDocument ? Object.entries(this.openApiDocument.paths)[0] : null;
    const pathName = firstPathEntry?.[0] ?? null;
    const operation = firstPathEntry?.[1]?.post;

    return {
      title: this.openApiDocument?.info.title ?? null,
      version: this.openApiDocument?.info.version ?? null,
      pathName,
      operationId: operation?.operationId ?? null,
      summary: operation?.summary ?? null,
    };
  }

  html = () => (
    <section class="space-y-6">
      <div>
        <p class="text-[10px] font-semibold uppercase tracking-[0.28em] text-violet-300/70">/openapi</p>
        <h2 class="mt-2 text-2xl font-semibold tracking-tight text-white">OpenAPI Scalar Preview</h2>
        <p class="mt-2 max-w-lg text-sm leading-6 text-slate-300">
          Loads generated host API documentation for an arbitrary VS Code symbol and embeds the Scalar preview inline.
        </p>
      </div>

      <div class="rounded-2xl border border-violet-400/20 bg-violet-500/10 p-4 text-sm text-slate-200">
        <p class="text-[10px] font-semibold uppercase tracking-[0.24em] text-violet-300/80">Symbol</p>
        <p class="mt-2 font-mono text-xs text-violet-100">vscode.commands.getCommands</p>
      </div>

      {this.openApiDocument ? (
        <div class="rounded-2xl border border-sky-400/20 bg-sky-500/10 p-4 text-sm text-slate-200">
          <p class="text-[10px] font-semibold uppercase tracking-[0.24em] text-sky-300/80">OpenAPI Document</p>
          <div class="mt-3 grid gap-3 md:grid-cols-2">
            <div>
              <p class="text-[10px] uppercase tracking-[0.2em] text-slate-400">Title</p>
              <p class="mt-1 text-sm text-sky-100">{this.operationSummary.title || "unknown"}</p>
            </div>
            <div>
              <p class="text-[10px] uppercase tracking-[0.2em] text-slate-400">Version</p>
              <p class="mt-1 font-mono text-xs text-sky-100">{this.operationSummary.version || "unknown"}</p>
            </div>
            <div>
              <p class="text-[10px] uppercase tracking-[0.2em] text-slate-400">Operation</p>
              <p class="mt-1 font-mono text-xs text-sky-100">{this.operationSummary.operationId || "unknown"}</p>
            </div>
            <div>
              <p class="text-[10px] uppercase tracking-[0.2em] text-slate-400">Path</p>
              <p class="mt-1 font-mono text-xs text-sky-100 break-all">{this.operationSummary.pathName || "unknown"}</p>
            </div>
          </div>
          {this.operationSummary.summary ? (
            <p class="mt-3 text-sm text-slate-300">{this.operationSummary.summary}</p>
          ) : null}
        </div>
      ) : null}

      {this.error ? (
        <div class="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">
          <p class="font-semibold text-red-200">Failed to load OpenAPI preview</p>
          <p class="mt-2 break-all text-red-100/90">{this.error}</p>
        </div>
      ) : this.openApiDoc ? (
        <div class="overflow-hidden rounded-2xl border border-violet-400/20 bg-slate-950/60">
          <iframe
            title="OpenAPI Scalar Preview"
            srcDoc={this.openApiDoc}
            style="width: 100%; height: 720px; border: 0; background: white;"
          />
        </div>
      ) : (
        <div class="rounded-2xl border border-violet-400/20 bg-violet-500/10 p-4 text-sm text-slate-200">
          {this.isLoading ? 'Loading OpenAPI documentation...' : 'Preparing OpenAPI preview...'}
        </div>
      )}
    </section>
  );

  onLoad = () => {
    void this.loadOpenApiDoc();
  };
}

