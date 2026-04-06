/** @jsxImportSource nojsx */
import { NComponent } from "nojsx/core/components/components";
import type {} from "nojsx/core/types/index";
import { HelloWorld2 } from "./button/main";

export default class HelloWorld extends NComponent {
	clicks = 0;

	constructor(props?: any) {
		super("HelloWorld", props);
	}

	increment = () => {
		this.clicks += 1;
		this.render();
	};

	html = () => (
		<div class="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
			<p class="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-600">nojsx minimal tsx</p>
			<h1 class="mt-2 text-3xl font-black text-slate-900">Hello world</h1>
			<p class="mt-2 text-slate-600">Rendered from TSX with nojsx + Tailwind classes.</p>
			<button type="button" onclick={this.increment} class="mt-5 rounded-lg bg-cyan-600 px-4 py-2 font-semibold text-white transition hover:bg-cyan-700">
				Clicked {this.clicks} Times
			</button>
			<HelloWorld2></HelloWorld2>
		</div>
	);
}
