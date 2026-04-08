/** @jsxImportSource nojsx */
import { NComponent } from "nojsx/core/components/components";
import type {} from "nojsx/core/types/index";
import { REGISTRY_ROWS } from "../../shared/model/data";
import { RegistryTable } from "../../shared/display/registry-table";

export class RegistrySection extends NComponent {
	constructor(props?: any) {
		super("RegistrySection", props);
	}

	html = () => (
		<section class="space-y-6">
			<div class="flex justify-between items-end">
				<h2 class="text-sm font-mono uppercase tracking-[0.2em] text-primary-fixed-dim">06. High-Density Registry</h2>
				<span class="font-mono text-[10px] text-on-surface-variant">32 OBJECTS FOUND</span>
			</div>
			<RegistryTable rows={REGISTRY_ROWS} />
		</section>
	);
}