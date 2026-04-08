/** @jsxImportSource nojsx */
import { NComponent } from "nojsx/core/components/components";
import type {} from "nojsx/core/types/index";
import { SWATCHES } from "../../shared/model/data";
import { SwatchCard } from "../../shared/display/swatch-card";

export class ColorTypeSection extends NComponent {
	constructor(props?: any) {
		super("ColorTypeSection", props);
	}

	html = () => (
		<section>
			<div class="grid grid-cols-12 gap-8">
				<div class="col-span-12 lg:col-span-4 space-y-8">
					<h2 class="text-sm font-mono uppercase tracking-[0.2em] text-primary-fixed-dim">01. Color &amp; Type</h2>
					<div class="space-y-2">
						<p class="text-4xl font-bold tracking-tight">Inter Bold</p>
						<p class="text-on-surface-variant leading-relaxed">Standard editorial body typeface for high-legibility and technical precision.</p>
						<div class="pt-4 flex flex-wrap gap-2">
							<span class="px-2 py-1 bg-surface-container-low text-[10px] font-mono text-on-surface-variant">400 REGULAR</span>
							<span class="px-2 py-1 bg-surface-container-low text-[10px] font-mono text-on-surface-variant">700 BOLD</span>
							<span class="px-2 py-1 bg-surface-container-low text-[10px] font-mono text-on-surface-variant">900 BLACK</span>
						</div>
					</div>
					<div class="space-y-2 font-mono">
						<p class="text-2xl font-medium tracking-tight text-primary-fixed-dim">JetBrains Mono</p>
						<p class="text-on-surface-variant text-sm">Used for code blocks, labels, and architectural metadata.</p>
					</div>
				</div>
				<div class="col-span-12 lg:col-span-8 grid grid-cols-4 md:grid-cols-6 gap-px bg-outline-variant/10">{SWATCHES.map((swatch) => <SwatchCard {...swatch} />)}</div>
			</div>
		</section>
	);
}