import { NComponent } from '../components/components.js';
import { ShellBridgeExtended } from '../types/index.js';

function tryFallbackToIndexRoute(dynamicTemplate: string): string | null {
	const pageRoutes = g.__nojsxPageRoutes as Record<string, { componentName: string }> | undefined;
	if (!pageRoutes) return null;

	let candidate = String(dynamicTemplate || '');
	if (!candidate.startsWith('/')) candidate = '/' + candidate;
	// Strip trailing slashes.
	while (candidate.length > 1 && candidate.endsWith('/')) candidate = candidate.slice(0, -1);

	// Only collapse trailing dynamic segments, e.g. '/ohlc/[path]' -> '/ohlc'.
	while (candidate.includes('[')) {
		const parts = candidate.split('/').filter(Boolean);
		if (parts.length === 0) break;
		const last = parts[parts.length - 1];
		if (!(last.startsWith('[') && last.endsWith(']'))) break;
		const next = '/' + parts.slice(0, -1).join('/');
		candidate = next || '/';
		if (pageRoutes[candidate]) return candidate;
		if (candidate === '/') break;
	}

	return null;
}

function resolveNavPath(path: string, params?: Record<string, string>): string {
	const needsParams = path.includes('[');
	if (needsParams && (!params || Object.keys(params).length === 0)) {
		const fallback = tryFallbackToIndexRoute(path);
		if (fallback) return fallback;
		throw new Error(`[ShellBridgeExtended] nav(): params required for dynamic path: ${path}`);
	}

	try {
		return path.replace(/\[([^\]]+)\]/g, (_match, key: string) => {
			const value = params?.[key];
			if (value == null || value === '') {
				throw new Error(`[ShellBridgeExtended] nav(): missing param "${key}" for path: ${path}`);
			}
			return encodeURIComponent(String(value));
		});
	} catch (err) {
		const fallback = tryFallbackToIndexRoute(path);
		if (fallback) return fallback;
		throw err;
	}
}

function resolveNavInput(pathOrKey: string, params?: Record<string, string>): string {
	// If the input looks like a path, use it directly.
	if (pathOrKey.startsWith('/')) return resolveNavPath(pathOrKey, params);

	// Otherwise treat it as a page key and resolve via the generated enum-like map.
	const pages = g.__nojsxPages as Record<string, string> | undefined;
	const routeTemplate = pages?.[pathOrKey];
	if (!routeTemplate) {
		throw new Error(`[ShellBridgeExtended] nav(): unknown page key: ${pathOrKey}`);
	}

	return resolveNavPath(String(routeTemplate), params);
}

export function extendShellBridge(shell: NComponent): ShellBridgeExtended {
	// Prototype chain:
	//   extended -> extensionProto (methods) -> shell (actual bridge)
	const extensionProto = Object.create(shell) as ShellBridgeExtended;

	const splitPath = (fullPath: string): { pathname: string; query: string } => {
		const qIndex = fullPath.indexOf('?');
		if (qIndex === -1) return { pathname: fullPath || '/', query: '' };
		return { pathname: fullPath.slice(0, qIndex) || '/', query: fullPath.slice(qIndex + 1) };
	};

	// Keep these non-enumerable to avoid surprising iteration over keys.
	Object.defineProperties(extensionProto, {
		getCurrentPath: {
			value: function () {
				const full = String(g.__nojsxNav?.path ?? (typeof window !== 'undefined' ? window.location.pathname : '/'));
				return splitPath(full).pathname;
			},
			enumerable: false,
		},
		getPageParams: {
			value: function () {
				return (g.__nojsxNav?.params ?? {}) as Record<string, string>;
			},
			enumerable: false,
		},
		getPageParam: {
			value: function (_this: NComponent, key: string) {
				return (g.__nojsxNav?.params?.[key] ?? undefined) as string | undefined;
			},
			enumerable: false,
		},
		nav: {
			value: function (this: NComponent, path: string, params?: Record<string, string>) {
				const resolved = resolveNavInput(String(path), params);

				if (typeof window === 'undefined') return;

				g.__nojsxNav = g.__nojsxNav ?? { path: '/' };
				g.__nojsxNav.path = resolved;

				const from = window.location.pathname;
				try {
					window.history.pushState({}, '', resolved);
				} catch {
					// Ignore if history isn't available.
				}


				// Re-render the navigation outlet only (avoid re-rendering the whole ShellPage).
				const outlet = g.__nojsxNavOutlet as any;
				if (outlet?.render && typeof outlet.render === 'function') {

					outlet.render();
				}
			},
			enumerable: false,
		},
	});

	return Object.create(extensionProto) as ShellBridgeExtended;
}

export function createGetShellFunctionServer(): () => ShellBridgeExtended {
	return function (this: NComponent) {
		let current: NComponent | null = this;
		while (current) {
			if (current.id === 'ShellPage') {
				return extendShellBridge(current);
			}
			current = current.parent;
		}

		// Fallback: if ShellPage isn't in the hierarchy, extend the current component.
		return extendShellBridge(this);
	};
}
