/** @jsxImportSource nojsx */
import { NComponent } from "nojsx/core/components/components";
import type {} from "nojsx/core/types/index";

export class PersistentCounter extends NComponent {
	count = 0;

	randomColor = () => `#${Math.floor(Math.random() * 0xffffff)
		.toString(16)
		.padStart(6, "0")}`;

	constructor(props?: any) {
		super("PersistentCounter", props);
	}

	increment =async () => {
		this.count += 1;
		this.render();
        const fs = await import("fs");
        console.log(!!fs)
	};

	html = () => {
		const swatchColor = this.randomColor();

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
				<button
					type="button"
					onclick={this.increment}
					class="mt-4 rounded-xl border border-violet-300/20 bg-violet-500 px-3 py-2 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(139,92,246,0.35)] transition hover:bg-violet-400"
				>
					persistent nested counter: {this.count}
				</button>
				<div class="mt-4 flex items-start gap-4 rounded-xl border border-white/10 bg-white/3 p-4">
					<div class="h-25 w-25 shrink-0 rounded-lg border border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.2)]" style={`background-color: ${swatchColor};`}></div>
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
