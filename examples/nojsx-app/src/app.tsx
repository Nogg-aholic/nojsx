/** @jsxImportSource nojsx */
import { ShellPageParent } from "nojsx/core/components/shell-page-parent";
import { NavOutlet } from "nojsx/core/components/nav-outlet";
import { NavBar } from "./components/navbar";

export default class ShellPage extends ShellPageParent {
	static layout_title = 'NUI';
	static layout_cspNonce = 'nsx-importmap';
	static layout_appHostId = 'info';
	static layout_bodyClass = 'bg-white text-gray-800 dark:bg-black dark:text-neutral-200';
	static layout_head_html = '';
	static headerAttributes = 'lang="en" class="dark" data-theme="theme-emerald-night"';	
	static layout_header = (<div></div>);
	static layout_footer = (<div></div>);
	static layout_scripts = (<div></div>);
	constructor(props?: any) {
		super({...props});
	}

	html = () => (
		<div class="min-h-screen bg-stone-50">
			<NavBar />
			<main class="mx-auto max-w-5xl px-5 py-10">
				<NavOutlet />
			</main>
			<footer class="border-t border-stone-200 bg-white/60 py-6 text-center text-xs text-stone-400">
				nojsx demo app &middot; client-rendered &middot; no framework ceremony
			</footer>
		</div>
	);
}
