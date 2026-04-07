/** @jsxImportSource nojsx */
import { NComponent } from "nojsx/core/components/components";
import type {} from "nojsx/core/types/index";

export interface CardProps {
	title?: string;
	subtitle?: string;
	accent?: string;
	class?: string;
	children?: unknown;
}

export class Card extends NComponent {
	private cardProps: CardProps;

	constructor(props?: any) {
		super("Card", props);
		this.cardProps = props ?? {};
	}

	html = () => {
		const { title, subtitle, accent, children } = this.cardProps;
		const accentColor = accent ?? "amber";
		const borderClass = `border-${accentColor}-300`;

		return (
			<div class={`rounded-xl border ${borderClass} bg-white/90 backdrop-blur-sm p-6 shadow-md hover:shadow-lg transition-shadow duration-300`}>
				{title ? <h3 class="text-lg font-bold text-stone-800 tracking-tight">{title}</h3> : ""}
				{subtitle ? <p class="mt-1 text-sm text-stone-500">{subtitle}</p> : ""}
				{children ? <div class="mt-4">{children}</div> : ""}
			</div>
		);
	};
}
