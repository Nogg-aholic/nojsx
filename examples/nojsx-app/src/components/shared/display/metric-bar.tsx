/** @jsxImportSource nojsx */
import { NComponent } from "nojsx/core/components/components";
import type {} from "nojsx/core/types/index";
import type { Metric } from "../model/types";
import { joinClass } from "../icons/material-symbol";

export class MetricBar extends NComponent {
	private metricProps: Metric;

	constructor(props?: Metric) {
		super("MetricBar", props);
		this.metricProps = props ?? { label: "Metric", value: "0%", segments: [] };
	}

	html = () => (
		<div class="space-y-2">
			<div class="flex justify-between font-mono text-[10px] uppercase">
				<span class="text-on-surface-variant">{this.metricProps.label}</span>
				<span class={joinClass("text-on-surface", this.metricProps.valueClass)}>{this.metricProps.value}</span>
			</div>
			<div class="w-full h-1 bg-surface-container-high flex overflow-hidden">
				{this.metricProps.segments.map((segment) => (
					<div class={joinClass("h-full", segment.class)} style={`width: ${segment.width}`}></div>
				))}
			</div>
		</div>
	);
}