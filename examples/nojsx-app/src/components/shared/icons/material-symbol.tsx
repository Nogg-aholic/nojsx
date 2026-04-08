/** @jsxImportSource nojsx */

export function joinClass(...parts: Array<string | undefined | false>): string {
	return parts.filter(Boolean).join(" ");
}

export function MaterialSymbol(props: { icon: string; class?: string; style?: string }) {
	return <span class={joinClass("material-symbols-outlined", props.class)} style={props.style} data-icon={props.icon}>{props.icon}</span>;
}