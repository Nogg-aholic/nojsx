/** @jsxImportSource nojsx */
import { NComponent } from "nojsx/core/components/components";
import type {} from "nojsx/core/types/index";

export class ContactPage extends NComponent {
	name = "";
	email = "";
	message = "";
	submitted = false;

	constructor(props?: any) {
		super("ContactPage", props);
	}

	onNameInput = (e: Event) => {
		this.name = (e.target as HTMLInputElement).value;
	};

	onEmailInput = (e: Event) => {
		this.email = (e.target as HTMLInputElement).value;
	};

	onMessageInput = (e: Event) => {
		this.message = (e.target as HTMLTextAreaElement).value;
	};

	handleSubmit = (e: Event) => {
		e.preventDefault();
		this.submitted = true;
		this.render();
	};

	resetForm = () => {
		this.name = "";
		this.email = "";
		this.message = "";
		this.submitted = false;
		this.render();
	};

	html = () => (
		<div class="page-enter mx-auto max-w-lg">
			<section class="text-center">
				<h1 class="text-3xl font-black text-stone-900 md:text-4xl">Get in Touch</h1>
				<p class="mt-2 text-stone-500">Interactive form with local state -- no backend required.</p>
			</section>

			{this.submitted
				? (
					<div class="mt-10 rounded-xl border border-emerald-200 bg-emerald-50 p-8 text-center">
						<div class="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
							<svg class="h-7 w-7 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
								<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
							</svg>
						</div>
						<h2 class="mt-4 text-xl font-bold text-emerald-800">Message Sent!</h2>
						<p class="mt-2 text-sm text-emerald-700">
							Thanks, <strong>{this.name || "friend"}</strong>. This is a demo -- nothing was actually sent.
						</p>
						<button
							type="button"
							onclick={this.resetForm}
							class="mt-6 rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 active:scale-95"
						>
							Send Another
						</button>
					</div>
				  )
				: (
					<form class="mt-10 space-y-5" onsubmit={this.handleSubmit}>
						<div>
							<label class="block text-sm font-semibold text-stone-700">Name</label>
							<input
								type="text"
								placeholder="Your name"
								oninput={this.onNameInput}
								class="mt-1.5 w-full rounded-lg border border-stone-300 bg-white px-4 py-2.5 text-sm text-stone-800 shadow-sm transition placeholder:text-stone-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
							/>
						</div>
						<div>
							<label class="block text-sm font-semibold text-stone-700">Email</label>
							<input
								type="email"
								placeholder="you@example.com"
								oninput={this.onEmailInput}
								class="mt-1.5 w-full rounded-lg border border-stone-300 bg-white px-4 py-2.5 text-sm text-stone-800 shadow-sm transition placeholder:text-stone-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
							/>
						</div>
						<div>
							<label class="block text-sm font-semibold text-stone-700">Message</label>
							<textarea
								rows="4"
								placeholder="What's on your mind?"
								oninput={this.onMessageInput}
								class="mt-1.5 w-full rounded-lg border border-stone-300 bg-white px-4 py-2.5 text-sm text-stone-800 shadow-sm transition placeholder:text-stone-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
							></textarea>
						</div>
						<button
							type="submit"
							class="w-full rounded-lg bg-amber-600 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-amber-700 active:scale-[0.98]"
						>
							Send Message
						</button>
					</form>
				  )}
		</div>
	);
}
