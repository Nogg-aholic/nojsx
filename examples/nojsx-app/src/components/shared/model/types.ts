export type NavItem = {
	label: string;
	active?: boolean;
	icon?: string;
	muted?: boolean;
};

export type Swatch = {
	label: string;
	value: string;
	class: string;
	textClass?: string;
};

export type Metric = {
	label: string;
	value: string;
	segments: Array<{ width: string; class: string }>;
	valueClass?: string;
};

export type StatusChip = {
	label: string;
	tone: "ok" | "error" | "pending";
	animate?: boolean;
};

export type RegistryRow = {
	nodeId: string;
	status: string;
	statusTone: "ok" | "error" | "testing";
	payloadType: string;
	throughput: string;
	throughputTone?: "ok" | "error" | "default";
	uptime: string;
};

export type FeatureCardData = {
	eyebrow: string;
	title: string;
	description: string;
	action: string;
	icon: string;
};