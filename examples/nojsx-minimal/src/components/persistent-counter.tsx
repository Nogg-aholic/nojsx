/** @jsxImportSource nojsx */
import { NComponent, type NComponentProps } from "nojsx/core/components/components";
import type {} from "nojsx/core/types/index";

export class PersistentCounter extends NComponent {
	count = 0;
	swatchColor = "";
	handshakeMessage = "waiting for handshake...";
	handshakeReady = false;
	serverReloadCount = 0;
	serverCreatedAt = "";
	serverLastLoadAt = "";
	clientLoadedAt = "";

	randomColor = () =>
		`#${Math.floor(Math.random() * 0xffffff)
			.toString(16)
			.padStart(6, "0")}`;

	constructor(props?: NComponentProps) {
		super("PersistentCounter", props);
	}

	serverLoad = () => {
		this.serverReloadCount += 1;
		if (!this.serverCreatedAt) {
			this.serverCreatedAt = new Date().toISOString();
		}
		if (!this.swatchColor) {
			this.swatchColor = this.randomColor();
		}
		this.serverLastLoadAt = new Date().toISOString();
		const parentId = this.parent?.id || "root";
		return {
			args: {
				message: `server linked: ${this.id}`,
				parentId,
				serverReloadCount: this.serverReloadCount,
				serverCreatedAt: this.serverCreatedAt,
				serverLastLoadAt: this.serverLastLoadAt,
			}
		};
	};

	onLoad = (args?: {
		message?: string;
		parentId?: string;
		serverReloadCount?: number;
		serverCreatedAt?: string;
		serverLastLoadAt?: string;
		__snapshot?: Record<string, unknown>;
	}) => {
		this.handshakeMessage = args?.parentId ? `${args.message || "server linked"} via ${args.parentId}` : args?.message || "server linked";
		this.handshakeReady = true;
		this.serverReloadCount = Number(args?.serverReloadCount ?? 0);
		this.serverCreatedAt = args?.serverCreatedAt || this.serverCreatedAt;
		this.serverLastLoadAt = args?.serverLastLoadAt || "";
		this.clientLoadedAt = new Date().toISOString();
	};

	testRPC = (args?: { message?: string; parentId?: string; nextCount?: number }) => {
		this.handshakeMessage = args?.parentId ? `${args.message || "server linked"} via ${args.parentId}` : args?.message || "server linked";
		this.handshakeReady = true;
		if (typeof args?.nextCount === "number") {
			this.count = args.nextCount;
		}
		this.swatchColor = this.randomColor();
	};

	serverRPCTest = async () => {
		const nextCount = this.count + 1;
		await this.callOnServerAsync(this.testRPC, [{
			message: "hi",
			parentId: "hi",
			nextCount,
		}]);
	};

	html = () => {
		const swatchColor = this.swatchColor || "#4f46e5";

		return (
			<div class="rounded-2xl border border-violet-300/30 bg-[#161f34] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
				<div class="flex items-center justify-between gap-4">
					<div>
						<p class="text-[10px] font-semibold uppercase tracking-[0.24em] text-violet-300/70">Nested Component</p>
						<p class="mt-1 text-sm text-slate-200">Its local state should remain intact while the page host changes.</p>
					</div>
					<div class="flex items-center gap-2 text-xs text-slate-400">
						<div class="h-2 w-2 rounded-full bg-violet-500 shadow-[0_0_10px_rgba(139,92,246,0.45)]"></div>
						sticky state
					</div>
				</div>
				<div class="mt-3 flex items-center justify-between gap-3 rounded-xl border border-violet-300/15 bg-violet-400/8 px-3 py-2 text-xs">
					<p class="truncate text-violet-100">{this.handshakeMessage}</p>
					<span
						class={`shrink-0 rounded-full px-2 py-1 font-semibold ${this.handshakeReady ? "bg-emerald-400/20 text-emerald-200" : "bg-amber-400/20 text-amber-100"}`}
					>
						{this.handshakeReady ? "server ready" : "pending"}
					</span>
				</div>
				<div class="mt-3 rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-slate-300">
					<p class="font-semibold uppercase tracking-[0.22em] text-slate-400">server persistence demo</p>
					<p class="mt-2">server instance created: <span class="font-mono text-slate-100">{this.serverCreatedAt || "not yet"}</span></p>
					<p class="mt-1">serverLoad calls on this same instance: <span class="font-mono text-sky-200">{this.serverReloadCount}</span></p>
					<p class="mt-1">last serverLoad timestamp: <span class="font-mono text-slate-100">{this.serverLastLoadAt || "not yet"}</span></p>
					<p class="mt-1">client onLoad timestamp: <span class="font-mono text-slate-100">{this.clientLoadedAt || "not yet"}</span></p>
				</div>
				<button
					type="button"
					onclick={this.serverRPCTest}
					class="mt-4 rounded-xl border border-violet-300/20 bg-violet-500 px-3 py-2 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(139,92,246,0.35)] transition hover:bg-violet-400"
				>
					persistent nested counter: {this.count}
				</button>
				<div class="mt-4 flex items-start gap-4 rounded-xl border border-white/10 bg-white/3 p-4">
					<div
						class="h-25 w-25 shrink-0 rounded-lg border border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.2)]"
						style={`background-color: ${swatchColor};`}
					></div>
					<div class="space-y-2 text-sm text-slate-300">
						<p>
							This box changes color on every re-render of <span class="font-semibold text-violet-200">this component</span>.
						</p>
						<div class="text-slate-400">{this.props?.explanation}</div>
						<p class="font-mono text-xs text-slate-500">current render color: {swatchColor}</p>
					</div>
				</div>
				{this.props?.children}
			</div>
		);
	};
}
