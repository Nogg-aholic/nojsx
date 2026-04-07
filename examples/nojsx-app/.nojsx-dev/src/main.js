await import("nojsx/jsx-runtime");
/*@ts-ignore*/
import "./__nojsx_component_loaders.js";
import { bootstrapClientRuntime } from "nojsx/core/util/client-bootstrap";
import ShellPage from "./app.js";
const g = globalThis;
function splitPath(fullPath) {
    const qIndex = fullPath.indexOf("?");
    if (qIndex === -1)
        return { pathname: fullPath || "/", query: "" };
    return { pathname: fullPath.slice(0, qIndex) || "/", query: fullPath.slice(qIndex + 1) };
}
function normalizeRoutePath(pathname) {
    if (!pathname)
        return "/";
    if (!pathname.startsWith("/"))
        return `/${pathname}`;
    return pathname;
}
function syncNavState(pathValue) {
    const normalized = normalizeRoutePath(pathValue);
    const next = splitPath(normalized);
    g.__nojsxNav = g.__nojsxNav ?? {};
    g.__nojsxNav.path = normalized;
    g.__nojsxNav.pathname = next.pathname;
    g.__nojsxNav.query = next.query;
}
function renderCurrentRoute() {
    const outlet = g.__nojsxNavOutlet;
    if (outlet && typeof outlet.render === "function") {
        outlet.render();
        return;
    }
    renderShell();
    const mountedOutlet = g.__nojsxNavOutlet;
    if (mountedOutlet && typeof mountedOutlet.render === "function") {
        mountedOutlet.render();
    }
}
function setCurrentRoute(pathValue) {
    syncNavState(pathValue);
    renderCurrentRoute();
}
function getNavPathFromLocation() {
    if (typeof window === "undefined")
        return "/";
    const rawHash = window.location.hash || "";
    if (rawHash.startsWith("#/")) {
        return rawHash.slice(1);
    }
    const pathname = window.location.pathname || "/";
    const search = window.location.search || "";
    // In file/app shells, index.html is the true entrypoint and route should live in hash.
    if (pathname === "/") {
        return rawHash.startsWith("#/") ? rawHash.slice(1) : "/home";
    }
    if (pathname.endsWith("/index.html") || pathname.endsWith("\\index.html")) {
        return rawHash.startsWith("#/") ? rawHash.slice(1) : "/home";
    }
    return `${pathname}${search}`;
}
function normalizeNavPath(path) {
    if (!path)
        return "/";
    if (path.startsWith("http://") || path.startsWith("https://"))
        return path;
    if (path === "/home")
        return "/";
    if (path.startsWith("/"))
        return path;
    if (path === "home")
        return "/";
    return `/${path}`;
}
syncNavState(getNavPathFromLocation());
let rootShellComponent = null;
function renderShell() {
    const info = document.getElementById("info");
    if (!info)
        return;
    if (!rootShellComponent) {
        const factory = g.__nojsxComponentLoaders?.ShellPage;
        rootShellComponent = factory ? factory() : new ShellPage();
    }
    const component = rootShellComponent;
    const componentId = String(component?.id ?? "");
    const hasMountedRoot = componentId.length > 0 && !!document.querySelector(`[data-component-id="${componentId}"]`);
    // After initial mount, re-render in place so child components (like NavOutlet)
    // are updated instead of being torn down to a placeholder.
    if (hasMountedRoot && typeof component?.render === "function") {
        component.render();
        return;
    }
    const html = typeof component?.__html === "function" ? component.__html() : "";
    info.innerHTML = html;
}
function renderRoutedContent() {
    renderShell();
    const outlet = g.__nojsxNavOutlet;
    if (outlet && typeof outlet.render === "function") {
        outlet.render();
    }
}
function navigateInternal(path) {
    const next = normalizeNavPath(path);
    if (next.startsWith("http://") || next.startsWith("https://")) {
        window.location.href = next;
        return;
    }
    g.__nojsxNav = g.__nojsxNav ?? {};
    syncNavState(next);
    const nextHash = `#${next}`;
    if (window.location.hash !== nextHash) {
        window.history.pushState({}, "", nextHash);
    }
    setCurrentRoute(next);
}
function wireNavigation() {
    if (window.__nojsxExampleNavWired)
        return;
    window.__nojsxExampleNavWired = true;
    document.addEventListener("click", (event) => {
        const target = event.target;
        const anchor = target?.closest("a");
        if (!anchor)
            return;
        const rawHref = anchor.getAttribute("href")?.trim();
        if (!rawHref)
            return;
        const isInternal = rawHref.startsWith("/") || rawHref.startsWith("#") || !rawHref.includes(":");
        if (!isInternal)
            return;
        event.preventDefault();
        if (rawHref.startsWith("#"))
            return;
        navigateInternal(rawHref);
    });
    const syncFromLocation = () => {
        setCurrentRoute(getNavPathFromLocation());
    };
    window.addEventListener("popstate", syncFromLocation);
    window.addEventListener("hashchange", syncFromLocation);
}
bootstrapClientRuntime();
wireNavigation();
setCurrentRoute(getNavPathFromLocation());
