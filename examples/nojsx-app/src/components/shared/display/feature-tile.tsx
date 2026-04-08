/** @jsxImportSource nojsx */
import { NComponent } from "nojsx/core/components/components";
import type {} from "nojsx/core/types/index";
import type { FeatureCardData } from "../model/types";
import { MaterialSymbol } from "../icons/material-symbol";

export class FeatureTile extends NComponent {
	private tileProps: FeatureCardData;

	constructor(props?: FeatureCardData) {
		super("FeatureTile", props);
		this.tileProps = props ?? {
			eyebrow: "Section",
			title: "Title",
			description: "Description",
			action: "Action",
			icon: "hub",
		};
	}

	html = () => (
		<div class="col-span-2 md:col-span-1 bg-surface-container-low p-8 relative overflow-hidden group">
			<div class="relative z-10">
				<h3 class="text-xs font-mono text-primary-fixed-dim uppercase tracking-[0.2em] mb-4">{this.tileProps.eyebrow}</h3>
				<p class="text-2xl font-bold tracking-tight mb-2">{this.tileProps.title}</p>
				<p class="text-sm text-on-surface-variant leading-relaxed mb-6">{this.tileProps.description}</p>
				<button type="button" class="text-primary font-bold text-xs uppercase tracking-widest flex items-center gap-2 group-hover:gap-4 transition-all">
					{this.tileProps.action} <MaterialSymbol icon={this.tileProps.icon === "hub" ? "arrow_forward" : "lock_open"} class="text-sm leading-none" />
				</button>
			</div>
			<div class="absolute -right-4 -bottom-4 opacity-10 group-hover:opacity-20 transition-opacity">
				<MaterialSymbol icon={this.tileProps.icon} class="text-9xl scale-[1.5] leading-none" />
			</div>
		</div>
	);
}