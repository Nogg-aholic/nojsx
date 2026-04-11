/** @jsxImportSource nojsx */
import { ShellPageParent, type ShellPageParentProps } from "nojsx/core/components/shell-page-parent";
import { NavOutlet } from "nojsx/core/components/nav-outlet";
import { LivePreviewHandshakeCard } from "./components/live-preview-handshake-card";
import { ShellNav } from "./components/shell-nav";

export default class ShellPage extends ShellPageParent {
	static layout_title = "nojsx minimal";
	static layout_cspNonce = "nsx-importmap";
	static layout_appHostId = "info";
	static layout_bodyClass = "bg-[#0b0f19] text-slate-100 antialiased";

	constructor(props?: ShellPageParentProps) {
		super({ ...props });
	}

	html = () => (
		<div class="min-h-screen bg-[#0b0f19] px-6 py-8 text-slate-100">
			<div class="mx-auto max-w-3xl">
				<header class="mb-8 flex items-center justify-between border-b border-white/10 pb-4">
					<div>
						<p class="text-[11px] font-semibold uppercase tracking-[0.28em] text-sky-300/70">nojsx minimal</p>
						<h1 class="mt-2 text-2xl font-bold tracking-tight text-white">Minimal capabilities demo</h1>
						<p class="mt-2 max-w-xl text-sm leading-6 text-slate-300">A tiny shell that demonstrates `this.getShell().nav(...)`, `NavOutlet`, page instance persistence, and nested component persistence.</p>
					</div>
					<div class="flex items-center gap-3">
						<div class="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.55)]"></div>
						<span class="text-xs font-medium text-slate-400">shell alive</span>
					</div>
				</header>

				<div class="mb-6 rounded-2xl border border-white/10 bg-[#101726] p-4 shadow-[0_18px_45px_rgba(0,0,0,0.28)]">
					<LivePreviewHandshakeCard />
				</div>

				<div class="mb-6 rounded-2xl border border-white/10 bg-[#101726] p-4 shadow-[0_18px_45px_rgba(0,0,0,0.28)]">
					<div class="flex items-center justify-between gap-4 border-b border-white/8 pb-4">
						<div>
							<p class="text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-400">shell navigation</p>
							<p class="mt-1 text-sm text-slate-300">Route changes only swap the outlet content.</p>
						</div>
						<ShellNav />
					</div>
				</div>

				<section class="overflow-hidden rounded-2xl border border-white/10 bg-[#101726] shadow-[0_20px_50px_rgba(0,0,0,0.34)]">
					<div class="flex items-center justify-between border-b border-white/8 bg-[#0d1422] px-6 py-3">
						<span class="text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-400">NavOutlet</span>
						<div class="flex items-center gap-2 text-xs text-slate-400">
							<div class="h-2 w-2 rounded-full bg-sky-500 shadow-[0_0_10px_rgba(14,165,233,0.45)]"></div>
							page host
						</div>
					</div>
					<div class="p-6">
						<NavOutlet />
					</div>
				</section>
			</div>
		</div>
	);
}
