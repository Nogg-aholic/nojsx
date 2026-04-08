/** @jsxImportSource nojsx */
import { NComponent } from "nojsx/core/components/components";
import type {} from "nojsx/core/types/index";
import { ActionSchemaSection } from "./action-schema-section";
import { CodeWindowSection } from "./code-window-section";
import { FormControlsSection } from "./form-controls-section";
import { InternalNavigationSection } from "./internal-navigation-section";
import { PerformanceMetricsCard } from "./performance-metrics-card";

export class ControlsAndActionsSection extends NComponent {
	constructor(props?: any) {
		super("ControlsAndActionsSection", props);
	}

	html = () => (
		<section class="grid grid-cols-12 gap-8">
			<div class="col-span-12 lg:col-span-6 space-y-12">
				<FormControlsSection />
				<PerformanceMetricsCard />
			</div>
			<div class="col-span-12 lg:col-span-6 space-y-12">
				<ActionSchemaSection />
				<InternalNavigationSection />
				<CodeWindowSection />
			</div>
		</section>
	);
}