/** @jsxImportSource nojsx */
import { NComponent } from "nojsx/core/components/components";
import type {} from "nojsx/core/types/index";
import type { StatusChip } from "../model/types";
import { joinClass } from "../icons/material-symbol";

export class StatusPill extends NComponent {
	private pillProps: StatusChip;

	constructor(props?: StatusChip) {
		super("StatusPill", props);
		this.pillProps = props ?? { label: "status", tone: "pending" };
	}

	html = () => {
		const toneClass = this.pillProps.tone === "ok"
			? "border-primary/10"
			: this.pillProps.tone === "error"
				? "border-error/10"
				: "border-outline-variant/10";
		const dotClass = this.pillProps.tone === "ok"
			? "bg-primary"
			: this.pillProps.tone === "error"
				? "bg-error"
				: "bg-on-surface-variant";
		const textClass = this.pillProps.tone === "pending" ? "text-on-surface-variant" : "text-on-surface";

		return (
			<div class={joinClass("flex items-center gap-2 px-3 py-1 bg-surface-container text-xs border", toneClass)}>
				<div class={joinClass("w-1.5 h-1.5 rounded-full", dotClass, this.pillProps.animate ? "animate-pulse" : "")}></div>
				<span class={joinClass("font-mono uppercase text-[10px]", textClass)}>{this.pillProps.label}</span>
			</div>
		);
	};
}