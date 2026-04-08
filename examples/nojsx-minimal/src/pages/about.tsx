/** @jsxImportSource nojsx */
import { NComponent } from "nojsx/core/components/components";
import type {} from "nojsx/core/types/index";
import { PersistentCounter } from "../components/persistent-counter";

export class About extends NComponent {
	clicks = 0;

	constructor(props?: any) {
		super("About", props);
	}

	increment = () => {
		this.clicks += 1;
		this.render();
	};

	html = () => (
		<section class="space-y-6">
			<div>
				<p class="text-[10px] font-semibold uppercase tracking-[0.28em] text-emerald-300/70">/about</p>
				<h2 class="mt-2 text-2xl font-semibold tracking-tight text-white">Outlet persistence</h2>
				<p class="mt-2 max-w-lg text-sm leading-6 text-slate-300">
					Navigate away and back: `NavOutlet` preserves route instances, so each page can keep its own local state without rebuilding the whole shell.
				</p>
			</div>

			<div class="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-5">
				<div class="flex items-center justify-between gap-4">
					<div>
						<p class="text-[10px] font-semibold uppercase tracking-[0.24em] text-emerald-300/80">Route Cache</p>
						<p class="mt-1 text-sm text-slate-200">This counter belongs to the `/about` page component instance.</p>
					</div>
					<div class="text-xs font-medium text-emerald-300">outlet-managed</div>
				</div>
				<button
					type="button"
					onclick={this.increment}
					class="mt-4 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-emerald-500"
				>
					about counter: {this.clicks}
				</button>
			</div>
			<PersistentCounter></PersistentCounter>
		</section>
	);
}

export class AboutPage extends About {
	constructor(props?: any) {
		super(props);
		this.name = "AboutPage";
	}
}
