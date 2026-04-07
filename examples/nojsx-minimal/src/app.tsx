/** @jsxImportSource nojsx */
import { NComponent } from "nojsx/core/components/components";
import type {} from "nojsx/core/types/index";
import { HelloWorld2 } from "./button/main";

export default class HelloWorld extends NComponent {
	clicks = 0;

	constructor(props?: any) {
		super("HelloWorld", props);
	}

	increment = () => {
		this.clicks += 1;
		this.render();
	};

	html = () => (
		<html class="dark" lang="en">
			<head>
				<meta charset="utf-8" />
				<meta content="width=device-width, initial-scale=1.0" name="viewport" />
				<link
					href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&amp;family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap"
					rel="stylesheet"
				/>
				<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet" />
				<script id="tailwind-config">

					  
				</script>
				<style></style>
			</head>
			<body class="selection:bg-primary-container selection:text-on-primary-container">
				<header class="w-full top-0 sticky z-50 bg-[#131313] transition-colors duration-200">
					<nav class="flex justify-between items-center h-16 px-8 max-w-[1440px] mx-auto">
						<div class="flex items-center gap-12">
							<span class="text-xl font-bold tracking-tighter text-[#E2E2E2]">Midnight JSX</span>
							<ul class="hidden md:flex gap-8 items-center">
								<li>
									<a class="text-[#D2E5FF] font-semibold border-b-2 border-[#D2E5FF] pb-1 font-['Inter'] tracking-tight" href="#">
										Docs
									</a>
								</li>
								<li>
									<a
										class="text-[#C2C7D0] hover:text-[#E2E2E2] transition-colors duration-200 ease-out hover:bg-[#1F1F1F] px-3 py-1 rounded font-['Inter'] tracking-tight"
										href="#"
									>
										Benchmarks
									</a>
								</li>
								<li>
									<a
										class="text-[#C2C7D0] hover:text-[#E2E2E2] transition-colors duration-200 ease-out hover:bg-[#1F1F1F] px-3 py-1 rounded font-['Inter'] tracking-tight"
										href="#"
									>
										Community
									</a>
								</li>
								<li>
									<a
										class="text-[#C2C7D0] hover:text-[#E2E2E2] transition-colors duration-200 ease-out hover:bg-[#1F1F1F] px-3 py-1 rounded font-['Inter'] tracking-tight"
										href="#"
									>
										Playground
									</a>
								</li>
							</ul>
						</div>
						<div class="flex items-center gap-4">
							<button class="material-symbols-outlined text-[#C2C7D0] hover:text-[#E2E2E2] transition-transform active:scale-95" data-icon="terminal">
								terminal
							</button>
							<button class="monolith-gradient text-[#003257] font-bold px-6 py-2 rounded-md active:scale-95 transition-transform">GitHub</button>
						</div>
					</nav>
					<div class="h-[1px] w-full bg-[#42474F]/15"></div>
				</header>
				<main>
					<section class="relative overflow-hidden bg-surface pt-24 pb-32">
						<div class="max-w-[1440px] mx-auto px-8 relative z-10">
							<div class="max-w-4xl">
								<span class="text-primary-container font-mono text-sm tracking-widest uppercase mb-6 block">Version 2.0 "The Obsidian Update"</span>
								<h1 class="text-7xl md:text-8xl font-extrabold tracking-tighter text-on-surface leading-[0.9] mb-8">
									The JSX Renderer for the <span class="text-transparent bg-clip-text monolith-gradient">Monolith.</span>
								</h1>
								<p class="text-xl text-on-surface-variant leading-relaxed mb-12 max-w-2xl">
									A performance-obsessed, type-safe rendering engine designed for massive monolithic architectures. Zero dependencies. Native speed. Built for
									those who demand absolute control.
								</p>
								<div class="flex flex-wrap gap-4">
									<button class="monolith-gradient text-on-primary font-bold px-8 py-4 rounded-md text-lg active:scale-95 transition-transform">
										Get Started
									</button>
									<button class="border border-outline-variant/40 hover:border-outline-variant text-on-surface px-8 py-4 rounded-md text-lg active:scale-95 transition-transform">
										Read the Benchmarks
									</button>
								</div>
							</div>
						</div>
						<div class="absolute top-0 right-0 w-1/3 h-full opacity-20 pointer-events-none">
							<div class="w-full h-full monolith-gradient blur-[120px] rounded-full translate-x-1/2 -translate-y-1/2"></div>
						</div>
					</section>
					<section class="bg-surface-container-low py-24">
						<div class="max-w-[1440px] mx-auto px-8">
							<div class="grid grid-cols-1 md:grid-cols-3 gap-6">
								<div class="bg-surface-container-lowest p-10 rounded-xl flex flex-col justify-between h-[400px]">
									<div>
										<span class="material-symbols-outlined text-primary mb-6 text-4xl" data-icon="bolt">
											bolt
										</span>
										<h3 class="text-3xl font-bold mb-4">Blazing Fast Performance</h3>
										<p class="text-on-surface-variant leading-relaxed">Engineered for sub-millisecond execution loops in critical path rendering.</p>
									</div>
									<div class="mt-auto">
										<span class="text-6xl font-black tracking-tighter text-on-surface">0.02ms</span>
										<span class="block text-sm text-primary-container uppercase tracking-widest font-mono">Mean Render Latency</span>
									</div>
								</div>
								<div class="bg-surface-container p-10 rounded-xl flex flex-col h-[400px]">
									<div class="flex justify-between items-start mb-8">
										<h3 class="text-3xl font-bold">Type Safe</h3>
										<div class="bg-[#007acc] text-white font-bold px-3 py-1 rounded text-xs">TS</div>
									</div>
									<p class="text-on-surface-variant leading-relaxed mb-8">
										First-class TypeScript support with zero-cost abstractions and strict schema validation.
									</p>
									<div class="mt-auto flex flex-col gap-2">
										<div class="h-2 w-full bg-surface-container-highest rounded-full overflow-hidden">
											<div class="h-full monolith-gradient w-[98%]"></div>
										</div>
										<span class="text-xs text-on-surface-variant font-mono">98.4% Type Coverage in Core</span>
									</div>
								</div>
								<div class="bg-surface-container-lowest p-10 rounded-xl flex flex-col h-[400px]">
									<span class="material-symbols-outlined text-primary mb-6 text-4xl" data-icon="account_tree">
										account_tree
									</span>
									<h3 class="text-3xl font-bold mb-4">Extensible Architecture</h3>
									<p class="text-on-surface-variant leading-relaxed">
										Plug-and-play middleware system for custom attributes, logging, and state management hooks.
									</p>
									<div class="mt-auto grid grid-cols-2 gap-2">
										<div class="p-3 bg-surface-container-low rounded font-mono text-xs text-primary-container">/plugins</div>
										<div class="p-3 bg-surface-container-low rounded font-mono text-xs text-primary-container">/middleware</div>
										<div class="p-3 bg-surface-container-low rounded font-mono text-xs text-primary-container">/hooks</div>
										<div class="p-3 bg-surface-container-low rounded font-mono text-xs text-primary-container">/renderers</div>
									</div>
								</div>
							</div>
						</div>
					</section>
					<section class="bg-surface py-32">
						<div class="max-w-[1440px] mx-auto px-8">
							<div class="mb-16">
								<h2 class="text-5xl font-black tracking-tighter mb-4">Real-time Syntax.</h2>
								<p class="text-on-surface-variant">Experience the fluidity of Midnight's JSX compilation engine.</p>
							</div>
							<div class="grid grid-cols-1 lg:grid-cols-2 bg-surface-container-lowest rounded-2xl overflow-hidden shadow-2xl">
								<div class="border-r border-outline-variant/10 p-8 font-mono text-sm leading-relaxed overflow-x-auto">
									<div class="flex items-center gap-2 mb-8">
										<div class="w-3 h-3 rounded-full bg-red-500/50"></div>
										<div class="w-3 h-3 rounded-full bg-yellow-500/50"></div>
										<div class="w-3 h-3 rounded-full bg-green-500/50"></div>
										<span class="ml-4 text-on-surface-variant text-xs">Component.mjx</span>
									</div>
									<div class="space-y-1">
										<div>
											<span class="text-purple-400">import</span> {"Render"} <span class="text-purple-400">from</span>{" "}
											<span class="text-green-300">"midnight-jsx"</span>;
										</div>
										<div class="text-on-surface-variant opacity-50">// Initialize Monolith Core</div>
										<div>
											<span class="text-blue-400">const</span> <span class="text-yellow-200">App</span> = () =&gt; (
										</div>
										<div class="pl-4">
											&lt;<span class="text-blue-400">div</span> class=<span class="text-green-300">"dashboard"</span>&gt;
										</div>
										<div class="pl-8">
											&lt;<span class="text-blue-400">h1</span>&gt;System Status&lt;/<span class="text-blue-400">h1</span>&gt;
										</div>
										<div class="pl-8">
											&lt;<span class="text-blue-400">MetricCard</span>{" "}
										</div>
										<div class="pl-12">value={<span class="text-orange-300">99.9</span>} </div>
										<div class="pl-12">
											label=<span class="text-green-300">"Uptime"</span>{" "}
										</div>
										<div class="pl-8">/&gt;</div>
										<div class="pl-4">
											&lt;/<span class="text-blue-400">div</span>&gt;
										</div>
										<div>);</div>
										<div class="pt-4">
											<span class="text-yellow-200">Render</span>(&lt;<span class="text-yellow-200">App</span> /&gt;, document.body);
										</div>
									</div>
								</div>
								<div class="bg-surface-container-low p-8 relative">
									<div class="flex justify-between items-center mb-8">
										<span class="text-xs uppercase tracking-widest text-on-surface-variant">Live Preview</span>
										<div class="flex items-center gap-2">
											<span class="w-2 h-2 rounded-full monolith-gradient"></span>
											<span class="text-[10px] font-mono text-primary-container">60 FPS</span>
										</div>
									</div>
									<div class="border border-outline-variant/10 rounded-xl p-8 bg-surface-container-lowest">
										<h1 class="text-2xl font-bold mb-6">System Status</h1>
										<div class="flex items-end justify-between border-b border-outline-variant/20 pb-4">
											<div>
												<span class="block text-4xl font-black text-on-surface">99.9%</span>
												<span class="text-xs text-on-surface-variant uppercase">Uptime</span>
											</div>
											<div class="flex gap-1 h-8 items-end">
												<div class="w-2 h-4 bg-primary-container/20"></div>
												<div class="w-2 h-6 bg-primary-container/40"></div>
												<div class="w-2 h-5 bg-primary-container/60"></div>
												<div class="w-2 h-8 monolith-gradient"></div>
											</div>
										</div>
									</div>
								</div>
							</div>
						</div>
					</section>
					<section class="bg-surface-container-low py-32 overflow-hidden">
						<div class="max-w-[1440px] mx-auto px-8 grid grid-cols-1 lg:grid-cols-2 gap-24 items-center">
							<div>
								<h2 class="text-6xl font-black tracking-tighter mb-8 leading-tight">
									Monolith.core
									<br />
									Benchmarks.
								</h2>
								<div class="space-y-8">
									<div class="flex gap-6 items-start">
										<span class="text-primary text-2xl font-mono">01</span>
										<div>
											<h4 class="text-xl font-bold mb-2">Shadow DOM Bypass</h4>
											<p class="text-on-surface-variant">Our custom diffing algorithm skips the virtual layer entirely for direct-to-node reconciliation.</p>
										</div>
									</div>
									<div class="flex gap-6 items-start">
										<span class="text-primary text-2xl font-mono">02</span>
										<div>
											<h4 class="text-xl font-bold mb-2">Atomic Hydration</h4>
											<p class="text-on-surface-variant">Selective hydration allows interactive elements to wake up without blocking the main thread.</p>
										</div>
									</div>
								</div>
							</div>
							<div class="grid grid-cols-2 gap-4">
								<div class="bg-surface-container-highest/30 p-8 rounded border border-outline-variant/5">
									<span class="block text-sm font-mono text-on-surface-variant mb-4">Memory Footprint</span>
									<span class="text-4xl font-bold">1.2KB</span>
									<div class="mt-4 h-1 bg-primary/20 rounded">
										<div class="h-full bg-primary w-1/4"></div>
									</div>
								</div>
								<div class="bg-surface-container-highest/30 p-8 rounded border border-outline-variant/5">
									<span class="block text-sm font-mono text-on-surface-variant mb-4">Bundle Size (Gzip)</span>
									<span class="text-4xl font-bold">0.8KB</span>
									<div class="mt-4 h-1 bg-primary/20 rounded">
										<div class="h-full bg-primary w-1/5"></div>
									</div>
								</div>
								<div class="col-span-2 bg-surface-container-highest/30 p-8 rounded border border-outline-variant/5">
									<div class="flex justify-between items-center mb-6">
										<span class="text-sm font-mono text-on-surface-variant">vs React 18 (10k Rows)</span>
										<span class="text-xs text-primary font-bold">12x Faster</span>
									</div>
									<div class="space-y-4">
										<div class="flex items-center gap-4">
											<div class="w-24 text-[10px] uppercase text-on-surface-variant">Midnight</div>
											<div class="flex-1 h-3 monolith-gradient rounded"></div>
										</div>
										<div class="flex items-center gap-4">
											<div class="w-24 text-[10px] uppercase text-on-surface-variant">Competitor R</div>
											<div class="w-1/4 h-3 bg-on-surface-variant/20 rounded"></div>
										</div>
									</div>
								</div>
							</div>
						</div>
					</section>
					<section class="bg-surface py-32 text-center">
						<div class="max-w-[1440px] mx-auto px-8">
							<h2 class="text-5xl font-black tracking-tighter mb-12">Built by the Monolith.</h2>
							<div class="flex flex-center justify-center gap-8 mb-24">
								<a
									class="flex items-center gap-3 bg-surface-container-high px-8 py-4 rounded-full hover:bg-surface-container-highest transition-colors"
									href="#"
								>
									<span class="material-symbols-outlined" data-icon="star" style="font-variation-settings: 'FILL' 1;">
										star
									</span>
									<span class="font-bold">Star us on GitHub</span>
									<span class="text-on-surface-variant font-mono">12.4k</span>
								</a>
								<a
									class="flex items-center gap-3 bg-surface-container-high px-8 py-4 rounded-full hover:bg-surface-container-highest transition-colors"
									href="#"
								>
									<span class="material-symbols-outlined" data-icon="forum">
										forum
									</span>
									<span class="font-bold">Join Discord</span>
								</a>
							</div>
							<div class="border-t border-outline-variant/10 pt-24">
								<h3 class="text-sm uppercase tracking-[0.4em] text-on-surface-variant mb-12">Core Contributors</h3>
								<div class="flex flex-wrap justify-center gap-12 grayscale opacity-50 hover:grayscale-0 hover:opacity-100 transition-all duration-500">
									<img
										class="w-16 h-16 rounded-full border-2 border-surface"
										data-alt="portrait of a software engineer developer in a studio with soft overhead lighting"
										src="https://lh3.googleusercontent.com/aida-public/AB6AXuB9nnyHpuf9pItW9WYQs3Dt1ZB7X_4Ch4lh7XLO6zs72_d3PbBqHxMVTQarL7Xi9AXlP0Fqwk8-f2_Ad9RmrkkTJOvhtvU7vtBQWJudtC_A70uAiG-7BCZDzHuC3Oq5DqlkcS2OQK_vSwmPcaCrK5PakQXlgt9LIHjoRtPrIuCR2IEjtHN_pwQD8HVuPF8gBwpR4twuwkH_nT54vvv64BfX-3Xa8o1eRQ9qfmXsN1fwFz785UcaefiK67rCbM3ONKQfCIJdVpwFfWin"
									/>
									<img
										class="w-16 h-16 rounded-full border-2 border-surface"
										data-alt="close up profile of a focused programmer looking at a screen in dark lighting"
										src="https://lh3.googleusercontent.com/aida-public/AB6AXuAXOu7-ZAOPNksDctPyAqXrf9Vh8ZnsG0FAJIK3d9arZniyCYG46G7EgYOAp-5QgkEnSxCjkXqRwY38AWLqwxFjCKvOz2IhHX6dNi7FTfhflwRC-0zoCuRt865gT-OEd2i-NMH5h3jHwvAxWm4PyMFaU4BwqaTzeGjftkw3wsH9xzEAFQUoKQZ-ovF3RtKeg0eBUgSAulmU3N2XBMyeRwaKtX7Mk4j7nM5ouq7cPIYFcRT2evyDS1N-uoLSlcgj1aewnoczjTUXnqVq"
									/>
									<img
										class="w-16 h-16 rounded-full border-2 border-surface"
										data-alt="portrait of a woman in tech smiling in a minimalist modern office setting"
										src="https://lh3.googleusercontent.com/aida-public/AB6AXuB_Z2WaNFtYXcneBzI7Zv1cS6rdk8b515pRCqQbrP97XGKPpWyuakQza7ErO-UhkoAil64jBUO7OCqtNyWhZBt8MBpScSFlm_mkEyUdm7J88aRhNkph81-KhQQlmcvI5XoEwnGeFUIVEMPpPRzan1vUbmq-QIklrNPpob4ouhKrO_an8r_DEe86fxKg7uIIrpwJ07Y03qy6cSUqGvJ9iCmp9GmF7tNOXCFJyF_PSjSP6hTijfHdi27USC6aNpqWW00MQs5v8dhPfssx"
									/>
									<img
										class="w-16 h-16 rounded-full border-2 border-surface"
										data-alt="professional headshot of a developer in a high-key lighting setup"
										src="https://lh3.googleusercontent.com/aida-public/AB6AXuAAu9-iY4DkBYnoVtGaRIx3pviqV8ve-TWKsR-apGS865Vlet69dQsUcOaYXPqzTT5aqC1Q3viTm6sdHvGbms2JB92IHsjuYeq14B39qIO2feGgBf7TLXW6Mn3kO7r8_3B7db45_8rLzDf0WJFsDcLsOF-cXsqrEK5KaXCYyExI5QzRgKowyrPJJyd6CFKreXJ8683RF-S-b9TCakQFoq-51eiPFZy9Py8sIx8Tve1trFud5uu1pI_ioHs4gR2U1aCFtJjQ6E2Av_M_"
									/>
									<img
										class="w-16 h-16 rounded-full border-2 border-surface"
										data-alt="young man with glasses in a dark moody studio lighting portrait"
										src="https://lh3.googleusercontent.com/aida-public/AB6AXuCHhbU2DCDB9ibpkDYZwOhFPFrffoip_G9W43d1DcakpJCzXqNkTSR-hvk3qW_4t7vuVqDZPLn-cg3xM_brAaW2Fe1TGbwqn1f0DpXZau40Xg5UFaPuR6U__8sOGSpyVP-xcmbekWGZ9iDy6fuVuoYFlqq_Wgms7SKK26FwuwUGsBZFEAzc-AJ83Z2zfEdRaOG8Kt2y3IbypZRwL2DwoPd8VBQBCYi2C7xBIjmT1gcJGKIp3dy_-Hdf4TLscIxzlPwjS4cX4kcIfCTY"
									/>
								</div>
							</div>
						</div>
					</section>
				</main>
				<footer class="bg-[#0E0E0E] dark:bg-[#0E0E0E] w-full pt-16 pb-8 border-t border-[#42474F]/15">
					<div class="max-w-[1440px] mx-auto px-8 grid grid-cols-1 md:grid-cols-4 gap-12">
						<div class="md:col-span-1">
							<span class="text-lg font-black text-[#E2E2E2] block mb-4">Midnight Syntax</span>
							<p class="text-[#9ECBFF] font-['Inter'] text-sm leading-relaxed opacity-80">
								Built for the Monolith. A new standard for high-performance JSX rendering.
							</p>
						</div>
						<div>
							<h4 class="text-[#E2E2E2] font-bold text-sm mb-4">Product</h4>
							<ul class="space-y-2">
								<li>
									<a class="text-[#C2C7D0] hover:text-[#9ECBFF] transition-colors font-['Inter'] text-sm" href="#">
										Documentation
									</a>
								</li>
								<li>
									<a class="text-[#C2C7D0] hover:text-[#9ECBFF] transition-colors font-['Inter'] text-sm" href="#">
										Benchmarks
									</a>
								</li>
								<li>
									<a class="text-[#C2C7D0] hover:text-[#9ECBFF] transition-colors font-['Inter'] text-sm" href="#">
										NPM Registry
									</a>
								</li>
							</ul>
						</div>
						<div>
							<h4 class="text-[#E2E2E2] font-bold text-sm mb-4">Ecosystem</h4>
							<ul class="space-y-2">
								<li>
									<a class="text-[#C2C7D0] hover:text-[#9ECBFF] transition-colors font-['Inter'] text-sm" href="#">
										GitHub Repository
									</a>
								</li>
								<li>
									<a class="text-[#C2C7D0] hover:text-[#9ECBFF] transition-colors font-['Inter'] text-sm" href="#">
										Discord Community
									</a>
								</li>
								<li>
									<a class="text-[#C2C7D0] hover:text-[#9ECBFF] transition-colors font-['Inter'] text-sm" href="#">
										Sponsors
									</a>
								</li>
							</ul>
						</div>
						<div>
							<h4 class="text-[#E2E2E2] font-bold text-sm mb-4">Legal</h4>
							<ul class="space-y-2">
								<li>
									<a class="text-[#C2C7D0] hover:text-[#9ECBFF] transition-colors font-['Inter'] text-sm" href="#">
										Privacy Policy
									</a>
								</li>
								<li>
									<a class="text-[#C2C7D0] hover:text-[#9ECBFF] transition-colors font-['Inter'] text-sm" href="#">
										Security
									</a>
								</li>
							</ul>
						</div>
					</div>
					<div class="max-w-[1440px] mx-auto px-8 mt-16 pt-8 border-t border-[#42474F]/10 text-center">
						<p class="text-[#C2C7D0] font-['Inter'] text-sm opacity-60">© 2024 Midnight Syntax. Built for the Monolith.</p>
					</div>
				</footer>
			</body>
		</html>
	);
}
