/** @jsxImportSource nojsx */
import { NComponent } from "nojsx/core/components/components";
import type {} from "nojsx/core/types/index";

export class CodeWindowSection extends NComponent {
	constructor(props?: any) {
		super("CodeWindowSection", props);
	}

	html = () => (
		<div class="bg-[#101010] text-[#E7E7E7] rounded-lg overflow-hidden border border-[#1F1F1F] shadow-2xl">
			<div class="flex items-center gap-2 px-4 py-3 bg-[#131313] border-b border-[#1B1B1B]">
				<span class="w-2.5 h-2.5 rounded-full bg-[#FF5F57]"></span>
				<span class="w-2.5 h-2.5 rounded-full bg-[#FEBC2E]"></span>
				<span class="w-2.5 h-2.5 rounded-full bg-[#28C840]"></span>
				<span class="ml-4 font-mono text-[10px] uppercase tracking-widest text-[#9AA0A6]">/core/runtime/shell.tsx</span>
			</div>
			<pre class="p-6 overflow-x-auto text-sm leading-7 font-mono">
				<code>{`export function hydrateShell(node) {
  if (!node) return;
  bootRegistry(node.dataset.route);
  attachPanels(node.querySelectorAll('[data-panel]'));
  mountTelemetry(node);
}`}</code>
			</pre>
		</div>
	);
}
