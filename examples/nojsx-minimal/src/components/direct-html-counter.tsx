/** @jsxImportSource nojsx */
import { NComponent } from "nojsx/core/components/components";
import type {} from "nojsx/core/types/index";

export class DirectHtmlCounter extends NComponent {
	count = 0;
	updates = 0;

	randomColor = () =>
		`#${Math.floor(Math.random() * 0xffffff)
			.toString(16)
			.padStart(6, "0")}`;

	constructor(props?: any) {
		super("DirectHtmlCounter", props);
	}

	incrementHtmlOnly = () => {
		this.count += 1;
		this.updates += 1;
		const swatchColor = this.randomColor();
		const content = `
				<div data-direct-html-id=${this.id} class="space-y-2 text-sm text-slate-300">
					<p>This panel was updated with <span class="font-semibold text-emerald-300">this.updateHtml()</span>, so the component did not call render.</p>
					<p class="text-slate-400">Only the targeted DOM subtree changed. No component re-render ran upward or downward in the tree.</p>
					<p class="font-mono text-xs text-slate-500">html-only count: ${this.count} | patch count: ${this.updates} | swatch: ${swatchColor}</p>
				</div>
		`;

		this.updateHtml(`[data-direct-html-id="${this.id}"]`, content);
		this.updateHtml(`[data-count-id="${this.id}"]`, `update html only: ${this.count}`);
	};

	html = () => {
		const swatchColor = this.randomColor();

		return (
			<div class="rounded-2xl border border-emerald-300/25 bg-emerald-500/6 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
				<div class="flex items-center justify-between gap-4">
					<div>
						<p class="text-[10px] font-semibold uppercase tracking-[0.24em] text-emerald-300/80">Direct Html Update</p>
						<p class="mt-1 text-sm text-slate-200">This demo mutates a specific DOM region without calling render at all.</p>
					</div>
					<div class="text-xs font-medium text-emerald-300">targeted patch only</div>
				</div>
				<button
					type="button"
					onclick={this.incrementHtmlOnly}
					class="mt-4 rounded-xl border border-emerald-300/25 bg-emerald-500 px-3 py-2 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(16,185,129,0.28)] transition hover:bg-emerald-400"
				>
					<p data-count-id={this.id}>update html only: {this.count}</p>
				</button>
				<div>
					<div class="mt-4 flex items-start gap-4 rounded-xl border border-emerald-300/20 bg-emerald-500/8 p-4">
						<div>
							<div
								class="h-25 w-25 shrink-0 rounded-lg border border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.2)]"
								style={`background-color: ${swatchColor};`}
							></div>
							<p class="font-mono text-xs text-slate-500">
								Render: {this.count +1} | patches: {this.updates} | swatch: {swatchColor}
							</p>
						</div>
						<div data-direct-html-id={this.id} class="space-y-2 text-sm text-slate-300">
							<p>
								This initial block is rendered once. After that, the button only patches this region with{" "}
								<span class="font-semibold text-emerald-300">updateHtml</span>.
							</p>
							<p class="text-slate-400">The component instance keeps its state, but the framework does not run a full render cycle for these updates.</p>
							<p class="font-mono text-xs text-slate-500">
								Render: {this.count} | patches: {this.updates} | swatch: {swatchColor}
							</p>
						</div>
					</div>
				</div>
			</div>
		);
	};
}
