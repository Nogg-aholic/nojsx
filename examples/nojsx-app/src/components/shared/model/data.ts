import type { FeatureCardData, Metric, NavItem, RegistryRow, StatusChip, Swatch } from "./types";

export const TOP_NAV: NavItem[] = [
	{ label: "Foundations", active: true },
	{ label: "Components" },
	{ label: "Patterns" },
	{ label: "Guidelines" },
];

export const SIDEBAR_ITEMS: NavItem[] = [
	{ label: "Tokens", icon: "data_object", active: true },
	{ label: "Atoms", icon: "category", muted: true },
	{ label: "Molecules", icon: "layers", muted: true },
	{ label: "Organisms", icon: "widgets", muted: true },
	{ label: "Templates", icon: "dashboard", muted: true },
];

export const SIDEBAR_FOOTER: NavItem[] = [
	{ label: "DOCUMENTATION", icon: "description", muted: true },
	{ label: "REPOSITORY", icon: "terminal", muted: true },
];

export const SWATCHES: Swatch[] = [
	{ label: "Surface", value: "#131313", class: "bg-surface" },
	{ label: "Low", value: "#1B1B1B", class: "bg-surface-container-low" },
	{ label: "Default", value: "#1F1F1F", class: "bg-surface-container" },
	{ label: "High", value: "#2A2A2A", class: "bg-surface-container-high" },
	{ label: "Primary", value: "#D2E5FF", class: "bg-primary", textClass: "text-on-primary" },
	{ label: "Accent", value: "#9ECBFF", class: "bg-primary-container", textClass: "text-on-primary-container" },
];

export const METRICS: Metric[] = [
	{
		label: "L1 Cache Pressure",
		value: "82%",
		segments: [{ width: "82%", class: "bg-primary" }],
		valueClass: "text-primary",
	},
	{
		label: "Compute Quota (Global)",
		value: "4.2 / 12.0 TFLOPS",
		segments: [
			{ width: "35%", class: "bg-primary" },
			{ width: "25%", class: "bg-primary-container/30" },
		],
	},
];

export const STATUS_CHIPS: StatusChip[] = [
	{ label: "node_ok", tone: "ok", animate: true },
	{ label: "crit_fail", tone: "error" },
	{ label: "sync_pending", tone: "pending" },
];

export const REGISTRY_ROWS: RegistryRow[] = [
	{ nodeId: "MOL-0x2A1F", status: "OPERATIONAL", statusTone: "ok", payloadType: "L7-JSON-STREAM", throughput: "1.2 GB/s", throughputTone: "ok", uptime: "42d 12h 08m" },
	{ nodeId: "MOL-0x2B88", status: "ERROR_LOG_HWM", statusTone: "error", payloadType: "UDP-INGRESS", throughput: "--", throughputTone: "error", uptime: "0d 0h 02m" },
	{ nodeId: "MOL-0x41C2", status: "TESTING", statusTone: "testing", payloadType: "BLOB-STORE-V2", throughput: "342 MB/s", throughputTone: "default", uptime: "1d 14h 55m" },
	{ nodeId: "MOL-0x9F00", status: "OPERATIONAL", statusTone: "ok", payloadType: "GRPC-BALANCER", throughput: "8.4 GB/s", throughputTone: "ok", uptime: "128d 04h 22m" },
];

export const FEATURE_CARDS: FeatureCardData[] = [
	{
		eyebrow: "Architecture Viz",
		title: "Topology Map",
		description: "Real-time visualization of monolith nodes across 12 clusters.",
		action: "Enter Workspace",
		icon: "hub",
	},
	{
		eyebrow: "Security Protocol",
		title: "Auth Layers",
		description: "Encrypted handshakes and zero-trust verification modules.",
		action: "Manage Keys",
		icon: "shield",
	},
];