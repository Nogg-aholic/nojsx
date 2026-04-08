/** @jsxImportSource nojsx */
import { NComponent } from "nojsx/core/components/components";
import type {} from "nojsx/core/types/index";

export class FloatingStatusBadge extends NComponent {
	constructor(props?: any) {
		super("FloatingStatusBadge", props);
	}

	html = () => (
		<div class="fixed bottom-8 right-8 flex flex-col items-end gap-2 pointer-events-none">
			<span class="font-mono text-[10px] text-primary-fixed-dim bg-surface-container px-3 py-1 border-r-4 border-primary uppercase tracking-widest">Canvas Rendered</span>
			<span class="font-mono text-[10px] text-on-surface-variant opacity-40">1440x900 viewport_active</span>
		</div>
	);
}