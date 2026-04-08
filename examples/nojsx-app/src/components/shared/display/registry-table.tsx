/** @jsxImportSource nojsx */
import { NComponent } from "nojsx/core/components/components";
import type {} from "nojsx/core/types/index";
import type { RegistryRow } from "../model/types";
import { joinClass } from "../icons/material-symbol";
import { RegistryStatus } from "./registry-status";

export class RegistryTable extends NComponent {
	private rows: RegistryRow[];

	constructor(props?: { rows?: RegistryRow[] }) {
		super("RegistryTable", props);
		this.rows = props?.rows ?? [];
	}

	html = () => (
		<div class="w-full overflow-hidden">
			<table class="w-full text-left border-collapse">
				<thead class="bg-surface-container-low font-mono text-[10px] uppercase text-on-surface-variant border-b border-outline-variant/10">
					<tr>
						<th class="py-4 px-6 font-medium">Node ID</th>
						<th class="py-4 px-6 font-medium">Status</th>
						<th class="py-4 px-6 font-medium">Payload Type</th>
						<th class="py-4 px-6 font-medium text-right">Throughput</th>
						<th class="py-4 px-6 font-medium text-right">Uptime</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-outline-variant/5">
					{this.rows.map((row) => (
						<tr class="hover:bg-surface-container-low/50 transition-colors group">
							<td class="py-4 px-6 font-mono text-xs">{row.nodeId}</td>
							<td class="py-4 px-6"><RegistryStatus label={row.status} tone={row.statusTone} /></td>
							<td class="py-4 px-6 text-xs text-on-surface-variant">{row.payloadType}</td>
							<td class={joinClass("py-4 px-6 text-right font-mono text-xs", row.throughputTone === "ok" ? "text-primary" : row.throughputTone === "error" ? "text-error" : "text-on-surface")}>{row.throughput}</td>
							<td class="py-4 px-6 text-right font-mono text-xs text-on-surface-variant">{row.uptime}</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}