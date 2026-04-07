import { jsx as _jsx, jsxs as _jsxs } from "nojsx/jsx-runtime";
/** @jsxImportSource nojsx */
import { NComponent } from "nojsx/core/components/components";
import { Card } from "../components/card";
const PROJECTS = [
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
    constructor(props) {
        super("ProjectsPage", props);
    }
    onFilterInput = (e) => {
        const target = e.target;
        this.filter = target.value.toLowerCase();
        this.render();
    };
    html = () => {
        const filtered = this.filter
            ? PROJECTS.filter((p) => p.name.toLowerCase().includes(this.filter) ||
                p.tags.some((t) => t.toLowerCase().includes(this.filter)))
            : PROJECTS;
        return (_jsxs("div", { class: "page-enter", children: [_jsxs("section", { class: "text-center", children: [_jsx("h1", { class: "text-3xl font-black text-stone-900 md:text-4xl", children: "Projects" }), _jsx("p", { class: "mt-2 text-stone-500", children: "Six demo project cards -- filter by name or tag." })] }), _jsx("div", { class: "mx-auto mt-8 max-w-md", children: _jsx("input", { type: "text", placeholder: "Filter projects...", oninput: this.onFilterInput, class: "w-full rounded-lg border border-stone-300 bg-white px-4 py-2.5 text-sm text-stone-800 shadow-sm transition placeholder:text-stone-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200" }) }), _jsx("div", { class: "mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3", children: filtered.map((project) => (_jsxs(Card, { title: project.name, accent: project.accent, children: [_jsx("p", { class: "text-sm text-stone-600", children: project.description }), _jsx("div", { class: "mt-3 flex flex-wrap gap-1.5", children: project.tags.map((tag) => (_jsx("span", { class: "rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-600", children: tag }))) })] }, project.name))) }), filtered.length === 0 ? (_jsx("p", { class: "mt-10 text-center text-stone-400", children: "No projects match your filter." })) : ("")] }));
    };
}
