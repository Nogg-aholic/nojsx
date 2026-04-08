/** @jsxImportSource nojsx */
import { NComponent } from "nojsx/core/components/components";
import type {} from "nojsx/core/types/index";
import type { Swatch } from "../model/types";
import { joinClass } from "../icons/material-symbol";

export class SwatchCard extends NComponent {
	private swatchProps: Swatch;

	constructor(props?: Swatch) {
		super("SwatchCard", props);
		this.swatchProps = props ?? { label: "Swatch", value: "#000000", class: "bg-surface" };
	}

	html = () => (
		<div class={joinClass("aspect-square p-4 flex flex-col justify-end", this.swatchProps.class, this.swatchProps.textClass)}>
			<span class="text-[10px] font-mono text-on-surface-variant">{this.swatchProps.value}</span>
			<span class="text-xs font-bold uppercase">{this.swatchProps.label}</span>
		</div>
	);
}