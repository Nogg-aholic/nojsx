/** @jsxImportSource nojsx */
import { NComponent } from "nojsx/core/components/components";
import type {} from "nojsx/core/types/index";
import { Card } from "../components/card";
import { StatCounter } from "../components/stat-counter";

export class HomePage extends NComponent {
	constructor(props?: any) {
		super("HomePage", props);
	}

	html = () => (
		<div class="page-enter">
			{/* Hero section */}
			<section class="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 px-6 py-16 text-center md:py-24">
				<div class="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-amber-200/40 blur-3xl"></div>
				<div class="pointer-events-none absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-orange-200/30 blur-3xl"></div>

				<p class="relative text-sm font-bold uppercase tracking-[0.25em] text-amber-700">Built with nojsx</p>
				<h1 class="relative mt-3 text-4xl font-black leading-tight text-stone-900 md:text-6xl">
					Class-based.<br />Client-rendered.<br />No ceremony.
				</h1>
				<p class="relative mx-auto mt-5 max-w-lg text-lg text-stone-600">
					A TypeScript-first JSX runtime for browser UI -- components render and update with minimal glue work.
				</p>
			</section>

			{/* Feature cards */}
			<section class="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
				<Card id={this.id + "1"} title="JSX Runtime" subtitle="Custom jsx-runtime" accent="amber">
					<p class="text-sm text-stone-600">
						Not React. Not virtual DOM. nojsx compiles TSX to HTML strings and patches the real DOM directly.
					</p>
				</Card>
				<Card id={this.id + "2"} title="NComponent" subtitle="Class-based state" accent="orange">
					<p class="text-sm text-stone-600">
						State lives on the instance. Call <code class="rounded bg-stone-100 px-1 text-xs">this.render()</code> to
						re-render -- no hooks, no reconciler.
					</p>
				</Card>
				<Card id={this.id + "3"} title="Client Routing" subtitle="NavOutlet + getShell().nav()" accent="rose">
					<p class="text-sm text-stone-600">
						Register page routes on the client. NavOutlet swaps pages. History API updates the URL.
					</p>
				</Card>
			</section>

			{/* Interactive counters */}
			<section class="mt-12">
				<h2 class="text-center text-xl font-bold text-stone-800">Interactive State</h2>
				<p class="mt-2 text-center text-sm text-stone-500">Each counter is an independent NComponent instance with its own state.</p>
				<div class="mt-6 grid gap-5 sm:grid-cols-3">
					<StatCounter id="1" label="Alpha" initial={0} step={1} />
					<StatCounter id="2" label="Beta" initial={100} step={10} />
					<StatCounter id="3" label="Gamma" initial={50} step={5} />
				</div>
			</section>
		</div>
	);
}
