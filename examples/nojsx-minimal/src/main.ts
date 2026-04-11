await import('nojsx/jsx-runtime');
/*@ts-ignore*/
import './__nojsx_component_loaders.js';
import { bootstrapClientRuntime } from 'nojsx/core/util/client-bootstrap';
import ShellPage from './app.js';

const g = globalThis as any;

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
  const normalized = normalizeRoutePath(pathValue);
  const next = splitPath(normalized);
  g.__nojsxNav = g.__nojsxNav ?? {};
  g.__nojsxNav.path = normalized;
  g.__nojsxNav.pathname = next.pathname;
  g.__nojsxNav.query = next.query;
}

function renderCurrentRoute(): void {
  const outlet = g.__nojsxNavOutlet;
  if (outlet && typeof outlet.render === 'function') {
    outlet.render();
    return;
  }
  renderShell();
  const mountedOutlet = g.__nojsxNavOutlet;
  if (mountedOutlet && typeof mountedOutlet.render === 'function') {
    mountedOutlet.render();
  }
}

function setCurrentRoute(pathValue: string): void {
  syncNavState(pathValue);
  renderCurrentRoute();
}

function getNavPathFromLocation(): string {
  if (typeof window === 'undefined') return '/';

  const rawHash = window.location.hash || '';
  if (rawHash.startsWith('#/')) {
    return rawHash.slice(1);
  }

  const pathname = window.location.pathname || '/';
  const search = window.location.search || '';

  if (pathname === '/') {
    return rawHash.startsWith('#/') ? rawHash.slice(1) : '/';
  }

  if (pathname.endsWith('/index.html') || pathname.endsWith('\\index.html')) {
    return rawHash.startsWith('#/') ? rawHash.slice(1) : '/';
  }

  return `${pathname}${search}`;
}

function normalizeNavPath(path: string): string {
  if (!path) return '/';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  if (path.startsWith('/')) return path;
  return `/${path}`;
}

syncNavState(getNavPathFromLocation());

let rootShellComponent: any | null = null;

function renderShell(): void {
  const host = document.getElementById('info');
  if (!host) return;

  if (!rootShellComponent) {
    const factory = g.__nojsxComponentLoaders?.ShellPage as ((props?: any) => unknown) | undefined;
    rootShellComponent = factory ? factory() : (new ShellPage() as unknown);
  }

  const component = rootShellComponent;
  const componentId = String((component as any)?.id ?? '');
  const hasMountedRoot = componentId.length > 0 && !!document.querySelector(`[data-component-id="${componentId}"]`);

  if (hasMountedRoot && typeof (component as any)?.render === 'function') {
    (component as any).render();
    return;
  }

  const html = typeof (component as any)?.__html === 'function' ? (component as any).__html() : '';
  host.innerHTML = html;
}

function navigateInternal(path: string): void {
  const next = normalizeNavPath(path);
  if (next.startsWith('http://') || next.startsWith('https://')) {
    window.location.href = next;
    return;
  }

  g.__nojsxNav = g.__nojsxNav ?? {};
  syncNavState(next);
  console.log("next route:  ", next)

  const nextHash = `#${next}`;
  if (window.location.hash !== nextHash) {
    window.history.pushState({}, '', nextHash);
  }

  setCurrentRoute(next);
}

function wireNavigation(): void {
  if ((window as any).__nojsxExampleNavWired) return;
  (window as any).__nojsxExampleNavWired = true;

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
    console.log("INTERNAL RENDER?")
    navigateInternal(rawHref);
  });

  const syncFromLocation = () => {
    setCurrentRoute(getNavPathFromLocation());
  };

  window.addEventListener('popstate', syncFromLocation);
  window.addEventListener('hashchange', syncFromLocation);
}

bootstrapClientRuntime();
wireNavigation();
setCurrentRoute(getNavPathFromLocation());
