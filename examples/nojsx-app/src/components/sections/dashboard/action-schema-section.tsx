/** @jsxImportSource nojsx */
import { NComponent } from "nojsx/core/components/components";
import type {} from "nojsx/core/types/index";

export class ActionSchemaSection extends NComponent {
	constructor(props?: any) {
		super("ActionSchemaSection", props);
	}

	html = () => (
		<div class="space-y-6">
			<h2 class="text-sm font-mono uppercase tracking-[0.2em] text-primary-fixed-dim">04. Action Schema</h2>
			<div class="flex flex-wrap gap-4 items-end">
				<button type="button" class="bg-gradient-to-br from-primary to-primary-container text-on-primary font-bold py-3 px-8 rounded-md text-xs uppercase tracking-[0.1em] transition-transform hover:scale-[0.98]">Deploy Core</button>
				<button type="button" class="border border-outline-variant/15 hover:border-outline-variant/40 text-on-surface py-3 px-8 rounded-md text-xs uppercase tracking-[0.1em] transition-all">Rollback</button>
				<button type="button" class="text-primary-fixed-dim py-3 px-4 text-xs uppercase font-bold tracking-[0.1em] hover:opacity-70">Details</button>
				<button type="button" class="bg-error/10 text-error border border-error/20 py-3 px-8 rounded-md text-xs uppercase tracking-[0.1em] hover:bg-error/20 transition-all">Purge</button>
				<button type="button" class="w-11 h-11 border border-outline-variant/15 flex items-center justify-center hover:bg-surface-container-high transition-colors"><span class="material-symbols-outlined text-lg" data-icon="terminal">terminal</span></button>
			</div>
		</div>
	);
}