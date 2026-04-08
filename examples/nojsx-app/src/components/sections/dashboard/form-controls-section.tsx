/** @jsxImportSource nojsx */
import { NComponent } from "nojsx/core/components/components";
import type {} from "nojsx/core/types/index";

export class FormControlsSection extends NComponent {
	constructor(props?: any) {
		super("FormControlsSection", props);
	}

	html = () => (
		<div class="space-y-6 bg-surface-container-low p-8">
			<h2 class="text-sm font-mono uppercase tracking-[0.2em] text-primary-fixed-dim">02. Form Controls</h2>
			<div class="space-y-4">
				<div class="space-y-2">
					<label class="font-mono text-[10px] uppercase tracking-[0.2em] text-on-surface-variant">NODE LABEL</label>
					<input type="text" value="MONOLITH.PRIMARY" class="w-full bg-[#101010] border border-outline-variant/15 px-4 py-3 text-sm outline-none focus:border-primary" />
				</div>
				<div class="grid grid-cols-2 gap-4">
					<div class="space-y-2">
						<label class="font-mono text-[10px] uppercase tracking-[0.2em] text-on-surface-variant">REGION</label>
						<select class="w-full bg-[#101010] border border-outline-variant/15 px-4 py-3 text-sm outline-none focus:border-primary">
							<option>us-east-1</option>
							<option>eu-central-1</option>
						</select>
					</div>
					<div class="space-y-2">
						<label class="font-mono text-[10px] uppercase tracking-[0.2em] text-on-surface-variant">MODE</label>
						<select class="w-full bg-[#101010] border border-outline-variant/15 px-4 py-3 text-sm outline-none focus:border-primary">
							<option>readonly</option>
							<option>active</option>
						</select>
					</div>
				</div>
				<div class="flex items-center justify-between pt-4 border-t border-outline-variant/10">
					<span class="text-sm text-on-surface-variant">Telemetry Sync</span>
					<button type="button" class="w-12 h-7 bg-primary rounded-full relative">
						<span class="absolute right-1 top-1 w-5 h-5 rounded-full bg-on-primary"></span>
					</button>
				</div>
			</div>
		</div>
	);
}