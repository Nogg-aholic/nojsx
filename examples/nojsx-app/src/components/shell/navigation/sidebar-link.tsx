/** @jsxImportSource nojsx */
import { NComponent } from "nojsx/core/components/components";
import type {} from "nojsx/core/types/index";
import type { NavItem } from "../../shared/model/types";
import { joinClass, MaterialSymbol } from "../../shared/icons/material-symbol";

export class SidebarLink extends NComponent {
	private linkProps: NavItem;

	constructor(props?: NavItem) {
		super("SidebarLink", props);
		this.linkProps = props ?? { label: "Item" };
	}

	html = () => {
		const { label, icon, active, muted } = this.linkProps;
		return (
			<button
				type="button"
				class={joinClass(
					"px-3 py-2 flex items-center gap-3 transition-colors duration-200",
					active ? "bg-[#1F1F1F] text-[#D2E5FF] border-l-4 border-[#D2E5FF]" : "text-[#C2C7D0] hover:bg-[#1B1B1B] hover:opacity-100",
					muted ? "opacity-70" : "",
				)}
			>
				{icon ? <MaterialSymbol icon={icon} class="text-sm leading-none" /> : ""}
				<span class="font-mono text-xs uppercase tracking-widest">{label}</span>
			</button>
		);
	};
}