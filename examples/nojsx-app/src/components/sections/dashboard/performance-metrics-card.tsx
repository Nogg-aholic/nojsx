/** @jsxImportSource nojsx */
import { NComponent } from "nojsx/core/components/components";
import type {} from "nojsx/core/types/index";
import { METRICS, STATUS_CHIPS } from "../../shared/model/data";
import { MetricBar } from "../../shared/display/metric-bar";
import { StatusPill } from "../../shared/display/status-pill";

export class PerformanceMetricsCard extends NComponent {
	constructor(props?: any) {
		super("PerformanceMetricsCard", props);
	}

	html = () => (
		<div class="space-y-8 bg-surface-container-low p-8 border-l border-primary/20">
			<h2 class="text-sm font-mono uppercase tracking-[0.2em] text-primary-fixed-dim">03. Performance Metrics</h2>
			<div class="space-y-6">
				{METRICS.map((metric) => <MetricBar {...metric} />)}
				<div class="flex flex-wrap gap-3">{STATUS_CHIPS.map((chip) => <StatusPill {...chip} />)}</div>
			</div>
		</div>
	);
}