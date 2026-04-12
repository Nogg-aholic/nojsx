import { NComponent } from './components.js';
import { ShellBridgeExtended } from '../types/index.js';

function splitPath(fullPath: string): { pathname: string; query: string } {
	const qIndex = fullPath.indexOf('?');
	if (qIndex === -1) return { pathname: fullPath || '/', query: '' };
	return { pathname: fullPath.slice(0, qIndex) || '/', query: fullPath.slice(qIndex + 1) };
}

function normalizePathname(pathname: string): string {
	if (!pathname) return '/';
	pathname = pathname.startsWith('/') ? pathname : '/' + pathname;
	if (pathname.length > 1 && pathname.endsWith('/')) pathname = pathname.slice(0, -1);
	return pathname;
}

function matchRoute(pathname: string, template: string): { params: Record<string, string>; score: number } | null {
	const norm = (s: string) => (s.startsWith('/') ? s : '/' + s);
	pathname = norm(pathname);
	template = norm(template);

	const pathSegs = pathname.split('/').filter(Boolean);
	const tmplSegs = template.split('/').filter(Boolean);
	const params: Record<string, string> = {};

	const decodeSafe = (s: string): string => {
		try {
			return decodeURIComponent(s);
		} catch {
			return s;
		}
	};

	const isDynamic = (seg: string): boolean => seg.startsWith('[') && seg.endsWith(']');
	const dynamicKey = (seg: string): string => seg.slice(1, -1);

	const matchFrom = (pathIndex: number, tmplIndex: number): boolean => {
		if (tmplIndex === tmplSegs.length) {
			return pathIndex === pathSegs.length;
		}

		const t = tmplSegs[tmplIndex];
		if (!isDynamic(t)) {
			if (pathIndex >= pathSegs.length) return false;
			if (t !== pathSegs[pathIndex]) return false;
			return matchFrom(pathIndex + 1, tmplIndex + 1);
		}

		const key = dynamicKey(t);
		if (tmplIndex === tmplSegs.length - 1) {
			if (pathIndex >= pathSegs.length) return false;
			params[key] = decodeSafe(pathSegs.slice(pathIndex).join('/'));
			return true;
		}

		for (let end = pathIndex + 1; end <= pathSegs.length; end++) {
			params[key] = decodeSafe(pathSegs.slice(pathIndex, end).join('/'));
			if (matchFrom(end, tmplIndex + 1)) return true;
		}
		delete params[key];
		return false;
	};

	if (!matchFrom(0, 0)) return null;

	const staticCount = tmplSegs.filter((seg) => !isDynamic(seg)).length;
	const score = staticCount * 1000 + tmplSegs.length;
	return { params, score };
}

function pickRoute(pathname: string): { template: string; entry: any; params: Record<string, string> } | null {
	const pageRoutes = g.__nojsxPageRoutes as Record<string, { componentName: string }> | undefined;
	if (!pageRoutes) return null;

	pathname = normalizePathname(pathname);

	if (pathname === '/' && pageRoutes['/home']) {
		return { template: '/home', entry: pageRoutes['/home'], params: {} };
	}

	if (pathname === '/' && pageRoutes['/dashboard']) {
		return { template: '/dashboard', entry: pageRoutes['/dashboard'], params: {} };
	}

	if (pageRoutes[pathname]) {
		return { template: pathname, entry: pageRoutes[pathname], params: {} };
	}

	const matches: Array<{ template: string; entry: any; params: Record<string, string>; score: number }> = [];
	for (const [template, entry] of Object.entries(pageRoutes)) {
		const matched = matchRoute(pathname, template);
		if (matched) {
			matches.push({ template, entry, params: matched.params, score: matched.score });
		}
	}
	if (matches.length > 0) {
		matches.sort((a, b) => b.score - a.score);
		const best = matches[0];
		return { template: best.template, entry: best.entry, params: best.params };
	}

	if (pageRoutes['/']) return { template: '/', entry: pageRoutes['/'], params: {} };
	const first = Object.entries(pageRoutes)[0];
	if (!first) return null;
	return { template: first[0], entry: first[1], params: {} };
}

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
				const next = splitPath(resolved);
				const picked = pickRoute(next.pathname);
				g.__nojsxNav.pathname = next.pathname;
				g.__nojsxNav.query = next.query;
				g.__nojsxNav.routeTemplate = picked?.template;
				g.__nojsxNav.params = picked?.params ?? {};

				try {
					const handled = g.navHandler?.(resolved);
					if (!handled) {
						window.history.pushState({}, '', resolved);
					}
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
