/** @jsxImportSource nojsx */
import { NComponent, type NComponentProps } from "nojsx/core/components/components";
import type {} from "nojsx/core/types/index";

export class HostProxyDemo extends NComponent {
	commands: string[] = [];
	errorMessage = "";
	loading = false;

	constructor(props?: NComponentProps) {
		super("HostProxyDemo", props);
	}

	loadCommands = async () => {
		this.loading = true;
		this.errorMessage = "";
		this.render();

		try {
			const commands = await this.callHostAsync(vscode.commands.getCommands, true);
			this.commands = commands.filter((command) => command.startsWith("workbench.")).slice(0, 10);
		} catch (error) {
			this.errorMessage = String((error as Error)?.message ?? error);
		} finally {
			this.loading = false;
			this.render();
		}
	};

	html = () => (
		<div class="rounded-2xl border border-fuchsia-400/20 bg-fuchsia-500/8 p-5">
			<div class="flex items-center justify-between gap-4">
				<div>
					<p class="text-[10px] font-semibold uppercase tracking-[0.24em] text-fuchsia-300/80">Upstream Host Proxy</p>
					<p class="mt-1 text-sm text-slate-200">Exercises <span class="font-mono text-fuchsia-200">this.callHostAsync(vscode.commands.getCommands, true)</span>.</p>
				</div>
				<div class="text-xs font-medium text-fuchsia-300">vscode upstream</div>
			</div>
			<button
				type="button"
				onclick={this.loadCommands}
				class="mt-4 rounded-xl bg-fuchsia-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-fuchsia-500"
			>
				{this.loading ? "loading commands..." : "load workbench commands"}
			</button>
			{this.errorMessage ? (
				<p class="mt-3 rounded-lg border border-rose-400/25 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">{this.errorMessage}</p>
			) : null}
			{this.commands.length > 0 ? (
				<ul class="mt-3 space-y-1 text-xs text-slate-300">
					{this.commands.map((command) => (
						<li class="font-mono text-slate-200">{command}</li>
					))}
				</ul>
			) : null}
		</div>
	);
}