/** @jsxImportSource nojsx */
import { NComponent, type NComponentProps } from "nojsx/core/components/components";
import type {} from "nojsx/core/types/index";

export class ShellNav extends NComponent {
	constructor(props?: NComponentProps) {
		super("ShellNav", props);
	}

	navTo = (path: string) => () => {
		console.log(path)
		this.getShell().nav(path);
	};

	html = () => (
		<nav class="flex gap-1 rounded-xl border border-white/10 bg-[#0c1220] p-1">
			<button type="button" onclick={this.navTo("/home")} class="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-200 transition-all hover:bg-white/10 hover:text-white">
				/home
			</button>
			<button type="button" onclick={this.navTo("/about")} class="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-200 transition-all hover:bg-white/10 hover:text-white">
				/about
			</button>
			<button type="button" onclick={this.navTo("/openapi")} class="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-200 transition-all hover:bg-white/10 hover:text-white">
				/OpenApiExample
			</button>
		</nav>
	);
}