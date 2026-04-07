/** @jsxImportSource nojsx */
import { NComponent } from "nojsx/core/components/components";
import type {} from "nojsx/core/types/index";

export interface StatCounterProps {
	label?: string;
	initial?: number;
	step?: number;
	class?: string;
}

export class StatCounter extends NComponent {
	count = 0;
	label = "Count";
	step = 1;

	constructor(props?: any) {
		super("StatCounter" + props.id, props);
		this.count = props?.initial ?? 0;
		this.label = props?.label ?? "Count";
		this.step = props?.step ?? 1;
	}

	increment = () => {
		this.count += this.step;
		this.render();
	};

	decrement = () => {
		this.count -= this.step;
		this.render();
	};

	html = () => (
		<div class="flex flex-col items-center gap-3 rounded-lg border border-amber-200 bg-gradient-to-b from-amber-50 to-white p-5">
			<span class="text-xs font-semibold uppercase tracking-widest text-amber-700">{this.label}</span>
			<span class="text-4xl font-black tabular-nums text-stone-900">{this.count}</span>
			<div class="flex gap-2">
				<button
					type="button"
					onclick={this.decrement}
					class="rounded-md border border-stone-300 bg-white px-3 py-1 text-sm font-bold text-stone-600 transition hover:bg-stone-100 active:scale-95"
				>
					-
				</button>
				<button
					type="button"
					onclick={this.increment}
					class="rounded-md bg-amber-600 px-3 py-1 text-sm font-bold text-white transition hover:bg-amber-700 active:scale-95"
				>
					+
				</button>
			</div>
		</div>
	);
}
