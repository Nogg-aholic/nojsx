import { NComponent, NComponentProps } from './components.js';
import type { nojsxGlobals } from '../global/registry.js';

function splitPath(fullPath: string): { pathname: string; query: string } {
	const qIndex = fullPath.indexOf('?');
	if (qIndex === -1) return { pathname: fullPath || '/', query: '' };
	return { pathname: fullPath.slice(0, qIndex) || '/', query: fullPath.slice(qIndex + 1) };
}

function fnv1a32(s: string): number {
	let h = 0x811c9dc5;
	for (let i = 0; i < s.length; i++) {
		h ^= s.charCodeAt(i);
		h = Math.imul(h, 0x01000193);
	}
	return h >>> 0;
}

function navInstanceKey(fullPath: string): string {
	return fnv1a32(fullPath).toString(36);
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
	const g = globalThis as any;
	const pageRoutes = g.__nojsxPageRoutes as Record<string, { componentName: string }> | undefined;
	if (!pageRoutes) return null;

	pathname = normalizePathname(pathname);

	// Treat root navigation as home route when '/' isn't explicitly generated.
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

function getPageComponent(): string {
	const g = globalThis as any;
	g.__nojsxNav = g.__nojsxNav ?? { path: '/' };
	const fullPath = String(g.__nojsxNav.path ?? (typeof window !== 'undefined' ? window.location.pathname : '/'));
	const { pathname, query } = splitPath(fullPath);

	const picked = pickRoute(pathname);
	if (!picked) return '';

	g.__nojsxNav.path = fullPath;
	g.__nojsxNav.pathname = pathname;
	g.__nojsxNav.query = query;
	g.__nojsxNav.routeTemplate = picked.template;
	g.__nojsxNav.params = picked.params;

	const componentName = picked.entry?.componentName as string | undefined;
	if (!componentName) return '';

	const Page = (globalThis as unknown as nojsxGlobals).__nojsxComponentLoaders?.[componentName];
	if (!Page) return '';
	return Page({ __key: navInstanceKey(fullPath) }).__html();
}

export class NavOutlet extends NComponent {
	constructor(props?: NComponentProps) {
		super('NavOutlet', props);
	}

	html = (): JSX.Element => <div>{getPageComponent()}</div>;

	onLoad: () => void = () => {
		(globalThis as any).__nojsxNavOutlet = this;
	};
}
