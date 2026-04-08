/** @jsxImportSource nojsx */
import { ShellPageParent } from "nojsx/core/components/shell-page-parent";
import { NavOutlet } from "nojsx/core/components/nav-outlet";
import { IconButton } from "./components/shell/chrome/icon-button";
import { SidebarLink } from "./components/shell/navigation/sidebar-link";
import { SIDEBAR_ITEMS, SIDEBAR_FOOTER, TOP_NAV } from "./components/shared/model/data";

export default class ShellPage extends ShellPageParent {
	static layout_title = "NUI";
	static layout_cspNonce = "nsx-importmap";
	static layout_appHostId = "info";
	static layout_bodyClass = "bg-white text-gray-800 dark:bg-black dark:text-neutral-200";
	static layout_head_html = `
		<link
			href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&amp;family=JetBrains+Mono:wght@400;500&amp;display=swap"
			rel="stylesheet"
		/>
		<link
			href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap"
			rel="stylesheet"
		/>
	`;
	static headerAttributes = 'lang="en" class="dark" data-theme="theme-emerald-night"';
	static layout_header = (<div></div>);
	static layout_footer = (<div></div>);
	static layout_scripts = (<div></div>);
	constructor(props?: any) {
		super({ ...props });
	}
	renderTopNav= () => {
		return TOP_NAV.map((item) => (
			<button
				type="button"
				class={item.active ? "text-[#D2E5FF] border-b-2 border-[#D2E5FF] pb-1" : "text-[#C2C7D0] hover:text-[#E2E2E2] transition-colors duration-200"}
			>
				{item.label}
			</button>
		));
	}

	html = () => (
		<div class="min-h-screen bg-surface text-on-surface overflow-x-hidden">
			<header class="bg-[#131313] text-on-surface flex justify-between items-center px-8 h-16 w-full max-w-[1920px] mx-auto sticky top-0 z-50">
				<div class="flex items-center gap-8">
					<span class="text-xl font-black text-[#D2E5FF] italic">Midnight Syntax</span>
					<nav class="hidden md:flex gap-6">{this.renderTopNav()}</nav>
				</div>
				<div class="flex items-center gap-4">
					<IconButton icon="settings" />
					<IconButton icon="help" />
					<div class="w-8 h-8 rounded-full overflow-hidden border border-outline-variant/20 bg-surface-container-high flex items-center justify-center font-mono text-[10px] text-primary">
						NS
					</div>
				</div>
			</header>
			<div class="w-full h-[1px] bg-[#1B1B1B]"></div>
			<div class="flex min-h-[calc(100vh-65px)]">
				<aside class="bg-[#0E0E0E] flex flex-col py-8 px-4 h-full border-r border-[#1B1B1B] w-64 shrink-0">
					<div class="mb-8">
						<h3 class="text-[#D2E5FF] font-bold text-sm">System Architecture</h3>
						<p class="font-mono text-[10px] uppercase tracking-widest text-[#C2C7D0] opacity-70">v2.4.0-stable</p>
					</div>
					<nav class="flex flex-col gap-1 mb-8">
						{SIDEBAR_ITEMS.map((item) => (
							<SidebarLink {...item} />
						))}
					</nav>
					<button
						type="button"
						class="bg-gradient-to-br from-primary to-primary-container text-on-primary font-bold py-2 px-4 rounded mb-auto text-xs uppercase tracking-wider flex items-center justify-center gap-2"
					>
						<span class="material-symbols-outlined text-sm leading-none" data-icon="add">add</span>
						New Component
					</button>
					<div class="mt-8 flex flex-col gap-2 pt-8 border-t border-[#1B1B1B]">
						{SIDEBAR_FOOTER.map((item) => (
							<SidebarLink {...item} />
						))}
					</div>
				</aside>
				<main class="flex-1 bg-surface p-12 overflow-y-auto">
					<NavOutlet />
				</main>
			</div>
		</div>
	);
}
