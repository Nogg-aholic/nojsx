/** @jsxImportSource nojsx */
import { NComponent, type NComponentProps } from "nojsx/core/components/components";

export class LivePreviewHandshakeCard extends NComponent {
	message = "waiting for handshake...";
	loaded = false;

	constructor(props?: NComponentProps) {
		super("LivePreviewHandshakeCard", props);
	}

	serverLoad = () => {
		return {
			args: {
				message: "live preview serverLoad handshake restored",
			},
		};
	};

	onLoad = (args?: { message?: string }) => {
		this.message = args?.message || "handshake missing";
		this.loaded = true;
	};

	html = () => (
		<div class="mb-6 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 shadow-[0_18px_45px_rgba(0,0,0,0.18)]">
			<div class="flex items-center justify-between gap-4">
				<div>
					<p class="text-[10px] font-semibold uppercase tracking-[0.28em] text-emerald-300/80">live preview handshake</p>
					<p class="mt-1 text-sm text-slate-200">{this.message}</p>
				</div>
				<div class={`rounded-full px-3 py-1 text-xs font-semibold ${this.loaded ? 'bg-emerald-400/20 text-emerald-200' : 'bg-amber-400/20 text-amber-100'}`}>
					{this.loaded ? 'loaded' : 'pending'}
				</div>
			</div>
		</div>
	);
}
