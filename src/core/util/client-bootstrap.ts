
export type nojsxClientBootstrapOptions = {
	providerScriptUrls?: string[];
	renderRoute?: () => void;
	rootHostId?: string;
	rootComponentName?: string;
	createRootComponent?: () => unknown;
};

type nojsxClientBootstrapGlobals = typeof globalThis & {
	__nojsxNav?: {
		path?: string;
		pathname?: string;
		query?: string;
	};
	__nojsxNavOutlet?: {
		render?: () => void;
	};
	__nojsxClientNavWired?: boolean;
	__nojsxRootComponent?: unknown;
	__nojsxComponentLoaders?: Record<string, (props?: any) => unknown>;
	__nojsxDelegatedEventsBound?: boolean;
};

function findEventTarget(start: EventTarget | null): HTMLElement | null {
	return start instanceof HTMLElement ? start : null;
}

function bindClientDelegatedEventsImpl(): void {
	const g = globalThis as nojsxClientBootstrapGlobals;
	if (g.__nojsxDelegatedEventsBound) return;
	g.__nojsxDelegatedEventsBound = true;

	document.addEventListener('click', (event) => {
		const target = findEventTarget(event.target);
		const actionTarget = target?.closest('[data-action][data-cid]') as HTMLElement | null;
		if (!actionTarget) return;
		const componentId = actionTarget.getAttribute('data-cid');
		const handlerId = actionTarget.getAttribute('data-action');
		if (!componentId || !handlerId) return;
		const handler = (globalThis as any).getInlineHandler?.(componentId, handlerId);
		if (typeof handler !== 'function') return;
		event.preventDefault();
		handler.call(actionTarget, event);
	});

	const delegatedEvents = ['input', 'change', 'keydown', 'keyup', 'submit'];
	for (const eventName of delegatedEvents) {
		document.addEventListener(eventName, (event) => {
			const target = findEventTarget(event.target);
			const handlerTarget = target?.closest(`[data-on-${eventName}]`) as HTMLElement | null;
			if (!handlerTarget) return;
			const componentId = handlerTarget.getAttribute('data-cid');
			const handlerId = handlerTarget.getAttribute(`data-on-${eventName}`);
			if (!componentId || !handlerId) return;
			const handler = (globalThis as any).getInlineHandler?.(componentId, handlerId);
			if (typeof handler !== 'function') return;
			handler.call(handlerTarget, event);
		});
	}
}

function createDefaultRootRenderer(options: nojsxClientBootstrapOptions): (() => void) | undefined {
	const rootHostId = options.rootHostId?.trim();
	const rootComponentName = options.rootComponentName?.trim();
	const createRootComponent = options.createRootComponent;
	if (!rootHostId || (!rootComponentName && typeof createRootComponent !== 'function')) {
		return options.renderRoute;
	}

	return () => {
		const g = globalThis as nojsxClientBootstrapGlobals;
		const host = document.getElementById(rootHostId);
		if (!host) return;

		if (!g.__nojsxRootComponent) {
			const factory = rootComponentName ? g.__nojsxComponentLoaders?.[rootComponentName] : undefined;
			g.__nojsxRootComponent = factory ? factory() : createRootComponent?.();
		}

		const component = g.__nojsxRootComponent as {
			id?: unknown;
			render?: () => void;
			__html?: () => string;
		} | null | undefined;
		if (!component) return;

		const componentId = String(component.id ?? '');
		const hasMountedRoot = componentId.length > 0 && !!document.querySelector(`[data-component-id="${componentId}"]`);

		if (hasMountedRoot && typeof component.render === 'function') {
			component.render();
			return;
		}

		const html = typeof component.__html === 'function' ? component.__html() : '';
		host.innerHTML = html;
	};
}

function splitPath(fullPath: string): { pathname: string; query: string } {
	const qIndex = fullPath.indexOf('?');
	if (qIndex === -1) return { pathname: fullPath || '/', query: '' };
	return { pathname: fullPath.slice(0, qIndex) || '/', query: fullPath.slice(qIndex + 1) };
}

function normalizeRoutePath(pathname: string): string {
	if (!pathname) return '/';
	if (!pathname.startsWith('/')) return `/${pathname}`;
	return pathname;
}

function syncNavState(pathValue: string): void {
	const g = globalThis as nojsxClientBootstrapGlobals;
	const normalized = normalizeRoutePath(pathValue);
	const next = splitPath(normalized);
	g.__nojsxNav = g.__nojsxNav ?? {};
	g.__nojsxNav.path = normalized;
	g.__nojsxNav.pathname = next.pathname;
	g.__nojsxNav.query = next.query;
}

function getNavPathFromLocation(): string {
	if (typeof window === 'undefined') return '/';
	const g = globalThis as nojsxClientBootstrapGlobals & {
		__nojsxPageRoutes?: Record<string, { componentName: string }>;
	};
	const hasHomeRoute = !!g.__nojsxPageRoutes?.['/home'];
	const hasDashboardRoute = !!g.__nojsxPageRoutes?.['/dashboard'];

	const pathname = window.location.pathname || '/';
	const search = window.location.search || '';

	if (pathname === '/') {
		if (hasHomeRoute) return `/home${search}`;
		if (hasDashboardRoute) return `/dashboard${search}`;
		return '/';
	}

	if (pathname.endsWith('/index.html') || pathname.endsWith('\\index.html')) {
		if (hasHomeRoute) return `/home${search}`;
		if (hasDashboardRoute) return `/dashboard${search}`;
		return '/';
	}

	return `${pathname}${search}`;
}

function normalizeNavPath(path: string): string {
	if (!path) return '/';
	if (path.startsWith('http://') || path.startsWith('https://')) return path;
	if (path.startsWith('/')) return path;
	return `/${path}`;
}

function renderCurrentRoute(renderRoute?: () => void): void {
	const g = globalThis as nojsxClientBootstrapGlobals;
	const outlet = g.__nojsxNavOutlet;
	if (outlet && typeof outlet.render === 'function') {
		outlet.render();
		return;
	}

	renderRoute?.();

	const mountedOutlet = g.__nojsxNavOutlet;
	if (mountedOutlet && typeof mountedOutlet.render === 'function') {
		mountedOutlet.render();
	}
}

function setCurrentRoute(pathValue: string, renderRoute?: () => void): void {
	syncNavState(pathValue);
	renderCurrentRoute(renderRoute);
}

function navigateInternal(path: string, renderRoute?: () => void): void {
	const next = normalizeNavPath(path);
	if (next.startsWith('http://') || next.startsWith('https://')) {
		window.location.href = next;
		return;
	}

	syncNavState(next);
	if (`${window.location.pathname}${window.location.search}` !== next) {
		window.history.pushState({}, '', next);
	}

	setCurrentRoute(next, renderRoute);
}

function wireNavigation(renderRoute?: () => void): void {
	const g = globalThis as nojsxClientBootstrapGlobals;
	if (g.__nojsxClientNavWired) return;
	g.__nojsxClientNavWired = true;

	document.addEventListener('click', (event) => {
		const target = event.target as HTMLElement | null;
		const anchor = target?.closest('a') as HTMLAnchorElement | null;
		if (!anchor) return;
		const rawHref = anchor.getAttribute('href')?.trim();
		if (!rawHref) return;

		const isInternal = rawHref.startsWith('/') || rawHref.startsWith('#') || !rawHref.includes(':');
		if (!isInternal) return;

		event.preventDefault();
		if (rawHref.startsWith('#')) return;
		navigateInternal(rawHref, renderRoute);
	});

	const syncFromLocation = () => {
		setCurrentRoute(getNavPathFromLocation(), renderRoute);
	};

	window.addEventListener('popstate', syncFromLocation);
}

export function bindClientDelegatedEvents(): void {
	const g = globalThis as any;
	const bind = g.bindClientDelegatedEvents;
	if (typeof bind === 'function' && bind !== bindClientDelegatedEvents) {
		bind();
		return;
	}
	bindClientDelegatedEventsImpl();
}

export function bootstrapClientRuntime(options: nojsxClientBootstrapOptions = {}): void {
	const bootstrap = (globalThis as any).bootstrapClientRuntime;
	if (typeof bootstrap === 'function' && bootstrap !== bootstrapClientRuntime) {
		bootstrap(options);
	} else {
		bindClientDelegatedEventsImpl();
	}

	const renderRoute = createDefaultRootRenderer(options);

	syncNavState(getNavPathFromLocation());
	wireNavigation(renderRoute);
	setCurrentRoute(getNavPathFromLocation(), renderRoute);
}

(globalThis as any).bindClientDelegatedEvents = (globalThis as any).bindClientDelegatedEvents ?? bindClientDelegatedEventsImpl;
(globalThis as any).bootstrapClientRuntime = (globalThis as any).bootstrapClientRuntime ?? bootstrapClientRuntime;

