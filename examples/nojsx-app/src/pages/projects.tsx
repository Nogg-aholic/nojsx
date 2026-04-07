/** @jsxImportSource nojsx */
import { NComponent } from "nojsx/core/components/components";
import type {} from "nojsx/core/types/index";
import { Card } from "../components/card";

interface Project {
	name: string;
	description: string;
	tags: string[];
	accent: string;
}

const PROJECTS: Project[] = [
	{
		name: "Weather Station",
		description: "Real-time atmospheric readings with animated gauges and 7-day forecast cards.",
		tags: ["IoT", "Canvas", "WebSocket"],
		accent: "amber",
	},
	{
		name: "Task Planner",
		description: "Drag-and-drop kanban board with local-first persistence and keyboard shortcuts.",
		tags: ["DnD", "IndexedDB", "a11y"],
		accent: "orange",
	},
	{
		name: "Color Lab",
		description: "Explore OKLCH color space, build palettes, and export design tokens.",
		tags: ["Color", "OKLCH", "Tokens"],
		accent: "rose",
	},
	{
		name: "Markdown Editor",
		description: "Split-pane editor with live preview, syntax highlighting, and export to PDF.",
		tags: ["Editor", "Markdown", "PDF"],
		accent: "amber",
	},
	{
		name: "Finance Tracker",
		description: "Monthly budget dashboard with category breakdown charts and recurring entries.",
		tags: ["Charts", "Budget", "CSV"],
		accent: "orange",
	},
	{
		name: "Recipe Book",
		description: "Searchable recipe collection with ingredient scaling and nutritional info.",
		tags: ["Search", "Scale", "Print"],
		accent: "rose",
	},
];

export class ProjectsPage extends NComponent {
	filter = "";

	constructor(props?: any) {
		super("ProjectsPage", props);
	}

	onFilterInput = (e: Event) => {
		const target = e.target as HTMLInputElement;
		this.filter = target.value.toLowerCase();
		this.render();
	};

	html = () => {
		const filtered = this.filter
			? PROJECTS.filter(
					(p) =>
						p.name.toLowerCase().includes(this.filter) ||
						p.tags.some((t) => t.toLowerCase().includes(this.filter))
			  )
			: PROJECTS;

		return (
			<div class="page-enter">
				<section class="text-center">
					<h1 class="text-3xl font-black text-stone-900 md:text-4xl">Projects</h1>
					<p class="mt-2 text-stone-500">Six demo project cards -- filter by name or tag.</p>
				</section>

				{/* Filter input */}
				<div class="mx-auto mt-8 max-w-md">
					<input
						type="text"
						placeholder="Filter projects..."
						oninput={this.onFilterInput}
						class="w-full rounded-lg border border-stone-300 bg-white px-4 py-2.5 text-sm text-stone-800 shadow-sm transition placeholder:text-stone-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
					/>
				</div>

				{/* Grid */}
				<div class="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
					{filtered.map((project) => (
						<Card key={project.name} title={project.name} accent={project.accent}>
							<p class="text-sm text-stone-600">{project.description}</p>
							<div class="mt-3 flex flex-wrap gap-1.5">
								{project.tags.map((tag) => (
									<span class="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-600">
										{tag}
									</span>
								))}
							</div>
						</Card>
					))}
				</div>

				{filtered.length === 0 ? (
					<p class="mt-10 text-center text-stone-400">No projects match your filter.</p>
				) : (
					""
				)}
			</div>
		);
	};
}
