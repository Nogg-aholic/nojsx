/** @jsxImportSource nojsx */
import { NComponent } from "nojsx/core/components/components";
import type {} from "nojsx/core/types/index";
import { joinClass, MaterialSymbol } from "../../shared/icons/material-symbol";

export class IconButton extends NComponent {
	private buttonProps: { icon: string; class?: string };

	constructor(props?: { icon: string; class?: string }) {
		super("IconButton", props);
		this.buttonProps = props ?? { icon: "help" };
	}

	html = () => (
		<button type="button" class={joinClass("p-2 text-[#C2C7D0] text-[10px] uppercase tracking-widest transition-colors duration-200 hover:bg-[#1F1F1F]", this.buttonProps.class)}>
			<MaterialSymbol icon={this.buttonProps.icon} class="text-base leading-none" />
		</button>
	);
}