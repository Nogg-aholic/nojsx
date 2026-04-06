
export type nojsxClientBootstrapOptions = {
	providerScriptUrls?: string[];
};

const defaultProviderScriptUrls = [
] as const;

function loadScriptOnce(src: string): Promise<void> {
	return new Promise((resolve, reject) => {
		const existing = document.querySelector(`script[src="${src}"]`) as HTMLScriptElement | null;
		if (existing) {
			existing.dataset.nojsxLoaded = '1';
			resolve();
			return;
		}

		const script = document.createElement('script');
		script.src = src;
		script.async = false;
		script.addEventListener(
			'load',
			() => {
				script.dataset.nojsxLoaded = '1';
				resolve();
			},
			{ once: true },
		);
		script.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), { once: true });
		document.body.appendChild(script);
	});
}

async function ensureProviderScriptsLoaded(urls: readonly string[]): Promise<void> {
	for (const src of urls) {
		try {
			await loadScriptOnce(src);
		} catch (error) {
			console.error('[nojsx] provider script load error', src, error);
		}
	}
}

function invokeInlineHandler(target: Element | null, event: Event, eventName: string): boolean {
	if (!target) return false;
	const handlerId = target.getAttribute(`data-on-${eventName}`);
	const cid = target.getAttribute('data-cid');
	if (!handlerId || !cid) return false;
	const g = globalThis as any;
	const handlers = g.__nojsxInlineHandlers as Map<string, Function> | undefined;
	const handler = handlers?.get(`${cid}:${handlerId}`);
	if (typeof handler !== 'function') return false;
	handler(event);
	return true;
}

export function bindClientDelegatedEvents(): void {
	if (typeof window === 'undefined') return;
	const g = globalThis as any;
	if (g.__nojsxDelegatedEventsBound) return;
	g.__nojsxDelegatedEventsBound = true;

	document.addEventListener('click', (event) => {
		const target = (event.target as Element | null)?.closest('[data-action]');
		if (!target) return;
		const handlerId = target.getAttribute('data-action');
		const cid = target.getAttribute('data-cid');
		if (!handlerId || !cid) return;
		const handlers = g.__nojsxInlineHandlers as Map<string, Function> | undefined;
		const handler = handlers?.get(`${cid}:${handlerId}`);
		if (typeof handler === 'function') handler(event);
	});

	const delegatedEvents = [
		'input',
		'change',
		'submit',
		'keydown',
		'keyup',
		'keypress',
		'mousedown',
		'mouseup',
		'dblclick',
		'contextmenu',
		'pointerdown',
		'pointerup',
		'focusin',
		'focusout',
		'paste',
		'copy',
		'cut',
	] as const;

	for (const eventName of delegatedEvents) {
		document.addEventListener(eventName, (event) => {
			let node = event.target as Element | null;
			while (node) {
				if (invokeInlineHandler(node, event, eventName)) return;
				node = node.parentElement;
			}
		});
	}
}

export function bootstrapClientRuntime(options: nojsxClientBootstrapOptions = {}): void {
	if (typeof window === 'undefined') return;
	bindClientDelegatedEvents();

	void ensureProviderScriptsLoaded(options.providerScriptUrls ?? defaultProviderScriptUrls);
}

export function renderPreviewDocument(html: string): void {
	if (typeof document === 'undefined') return;
	const g = globalThis as any;
	if (!g.__livePreviewMode && !g.__nojsxDevPreviewMode) return;
	if (!html || typeof html !== 'string') return;

	const trimmed = html.trimStart().toLowerCase();
	const isDocumentHtml = trimmed.startsWith('<!doctype') || trimmed.startsWith('<html');
	if (!isDocumentHtml) return;

	const finalHtml = trimmed.startsWith('<!doctype') ? html : `<!doctype html>${html}`;
	document.open();
	document.write(finalHtml);
	document.close();
}
