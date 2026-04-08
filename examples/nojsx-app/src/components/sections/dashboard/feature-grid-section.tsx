/** @jsxImportSource nojsx */
import { NComponent } from "nojsx/core/components/components";
import type {} from "nojsx/core/types/index";
import { FEATURE_CARDS } from "../../shared/model/data";
import { FeatureTile } from "../../shared/display/feature-tile";

export class FeatureGridSection extends NComponent {
	constructor(props?: any) {
		super("FeatureGridSection", props);
	}

	html = () => (
		<section class="grid grid-cols-12 gap-8 pb-12">
			<div class="col-span-12 lg:col-span-8 grid grid-cols-2 gap-8">{FEATURE_CARDS.map((card) => <FeatureTile {...card} />)}</div>
			<div class="col-span-12 lg:col-span-4 bg-primary text-on-primary p-12 flex flex-col justify-between">
				<div>
					<span class="font-mono text-[10px] uppercase tracking-[0.3em] opacity-70">Status Report</span>
					<h3 class="text-4xl font-black tracking-tighter mt-4 leading-tight italic">All systems nominal.</h3>
				</div>
				<div class="mt-12 space-y-4">
					<p class="text-sm opacity-80 leading-relaxed">The Monolith core is operating at peak efficiency. No immediate maintenance is required for current production clusters.</p>
					<div class="flex items-center gap-4 pt-4 border-t border-on-primary/10">
						<div class="flex -space-x-2">
							<div class="w-6 h-6 rounded-full border-2 border-primary bg-surface overflow-hidden flex items-center justify-center text-[10px] font-bold text-primary-fixed-dim">A</div>
							<div class="w-6 h-6 rounded-full border-2 border-primary bg-surface overflow-hidden flex items-center justify-center text-[10px] font-bold text-primary-fixed-dim">B</div>
						</div>
						<span class="font-mono text-[10px] uppercase tracking-widest font-bold">Verified by 12 Ops</span>
					</div>
				</div>
			</div>
		</section>
	);
}