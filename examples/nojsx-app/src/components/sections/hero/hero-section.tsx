/** @jsxImportSource nojsx */
import { NComponent } from "nojsx/core/components/components";
import type {} from "nojsx/core/types/index";

export class HeroSection extends NComponent {
	constructor(props?: any) {
		super("HeroSection", props);
	}

	html = () => (
		<header class="mb-16">
			<div class="flex items-center gap-3 mb-2">
				<span class="w-6 h-[1px] bg-primary"></span>
				<span class="font-mono text-xs text-primary-fixed-dim tracking-[0.3em] uppercase">Architecture v2</span>
			</div>
			<h1 class="text-6xl font-black text-on-surface tracking-tighter leading-none mb-4">Monolith.core</h1>
			<p class="text-on-surface-variant max-w-2xl text-lg font-light leading-relaxed">
				A high-end developer editorial system. Defined by asymmetry, intentional negative space, and a whisper-quiet visual hierarchy. No lines, only light.
			</p>
		</header>
	);
}