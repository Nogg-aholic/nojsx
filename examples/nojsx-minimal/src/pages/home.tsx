/** @jsxImportSource nojsx */
import { NComponent, type NComponentProps } from "nojsx/core/components/components";
import type {} from "nojsx/core/types/index";
import { DirectHtmlCounter } from "../components/direct-html-counter";
import { HostProxyDemo } from "../components/host-proxy-demo";
import { PersistentCounter } from "../components/persistent-counter";

export class HomePage extends NComponent {
	clicks = 0;

	constructor(props?: NComponentProps) {
		super("Home", props);
	}

	increment = () => {
		this.clicks += 1;
		this.render();
	};

	html = () => (
		<section class="space-y-6">
			<div>
				<p class="text-[10px] font-semibold uppercase tracking-[0.28em] text-sky-300/70">/home</p>
				<h2 class="mt-2 text-2xl font-semibold tracking-tight text-white">Local page state</h2>
				<p class="mt-2 max-w-lg text-sm leading-6 text-slate-300">
					This route owns its own counter and also renders a nested stateful child. Switching routes should not destroy the page instance cached by `NavOutlet`.
				</p>
			</div>

			<div class="rounded-2xl border border-sky-400/20 bg-sky-500/10 p-5">
				<div class="flex items-center justify-between gap-4">
					<div>
						<p class="text-[10px] font-semibold uppercase tracking-[0.24em] text-sky-300/80">Page Instance</p>
						<p class="mt-1 text-sm text-slate-200">This counter belongs to the `/home` page component itself.</p>
					</div>
					<div class="text-xs font-medium text-sky-300">cached by route</div>
				</div>
				<button
					type="button"
					onclick={this.increment}
					class="mt-4 rounded-xl bg-cyan-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-cyan-500"
				>
					home counter: {this.clicks}
				</button>
			</div>
			<PersistentCounter
				explanation={
					<div>
						<p>Updating the nested child below does not re-render upward into this outer counter.</p>
					</div>
				}
			>
				<PersistentCounter
					explanation={
						<div>
							<p>Updating this inner counter does not re-render downward from the outer parent, and outer renders do not force this child to re-render.</p>
						</div>
					}
				></PersistentCounter>
			</PersistentCounter>
			<DirectHtmlCounter />
			<HostProxyDemo />
		</section>
	);
}

