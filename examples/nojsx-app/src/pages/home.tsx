/** @jsxImportSource nojsx */
import { NComponent } from "nojsx/core/components/components";
import type {} from "nojsx/core/types/index";
import { ControlsAndActionsSection } from "../components/sections/dashboard/controls-and-actions-section";
import { FeatureGridSection } from "../components/sections/dashboard/feature-grid-section";
import { FloatingStatusBadge } from "../components/sections/dashboard/floating-status-badge";
import { RegistrySection } from "../components/sections/dashboard/registry-section";
import { HeroSection } from "../components/sections/hero/hero-section";
import { ColorTypeSection } from "../components/sections/tokens/color-type-section";

export class Home extends NComponent {
	constructor(props?: any) {
		super("Home", props);
	}

	html = () => (
		<>
			<HeroSection />
			<div class="space-y-24">
				<ColorTypeSection />
				<ControlsAndActionsSection />
				<RegistrySection />
				<FeatureGridSection />
			</div>
			<FloatingStatusBadge />
		</>
	);
}

export class HomePage extends Home {
	constructor(props?: any) {
		super(props);
		this.name = "HomePage";
	}
}
