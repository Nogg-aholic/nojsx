/** @jsxImportSource nojsx */
import { NComponent } from "nojsx/core/components/components";
import type {} from "nojsx/core/types/index";

export class InternalNavigationSection extends NComponent {
	constructor(props?: any) {
		super("InternalNavigationSection", props);
	}

	html = () => (
		<div class="space-y-6 bg-surface-container-low p-8">
			<h2 class="text-sm font-mono uppercase tracking-[0.2em] text-primary-fixed-dim">05. Internal Navigation</h2>
			<div class="grid grid-cols-2 gap-4">
				<button type="button" class="bg-[#101010] border border-outline-variant/15 p-5 text-left hover:border-primary/30 transition-colors">
					<p class="font-mono text-[10px] uppercase tracking-widest text-primary-fixed-dim mb-2">MODULE</p>
					<p class="text-lg font-bold">Runtime Core</p>
				</button>
				<button type="button" class="bg-[#101010] border border-outline-variant/15 p-5 text-left hover:border-primary/30 transition-colors">
					<p class="font-mono text-[10px] uppercase tracking-widest text-primary-fixed-dim mb-2">TRACE</p>
					<p class="text-lg font-bold">Signal Bus</p>
				</button>
			</div>
		</div>
	);
}