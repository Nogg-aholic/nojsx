/** @jsxImportSource nojsx */
import { NComponent } from "nojsx/core/components/components";
import type {} from "nojsx/core/types/index";
import type { RegistryRow } from "../model/types";
import { joinClass } from "../icons/material-symbol";

export class RegistryStatus extends NComponent {
	private statusProps: { label: string; tone: RegistryRow["statusTone"] };

	constructor(props?: { label: string; tone: RegistryRow["statusTone"] }) {
		super("RegistryStatus", props);
		this.statusProps = props ?? { label: "STATUS", tone: "testing" };
	}

	html = () => {
		const toneClass = this.statusProps.tone === "ok"
			? "bg-primary/10 text-primary border-primary/20"
			: this.statusProps.tone === "error"
				? "bg-error/10 text-error border-error/20"
				: "bg-on-surface-variant/10 text-on-surface-variant border-on-surface-variant/20";

		return <span class={joinClass("inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono border", toneClass)}>{this.statusProps.label}</span>;
	};
}