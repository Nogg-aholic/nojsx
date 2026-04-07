import { jsx as _jsx, jsxs as _jsxs } from "nojsx/jsx-runtime";
/** @jsxImportSource nojsx */
import { NComponent } from "nojsx/core/components/components";
export class NavBar extends NComponent {
    menuOpen = false;
    constructor(props) {
        super("NavBar", props);
    }
    navigateTo = (path) => {
        this.menuOpen = false;
        const shell = this.getShell();
        shell.nav(path);
        this.render();
    };
    goHome = () => { this.navigateTo("/home"); };
    goProjects = () => { this.navigateTo("/projects"); };
    goContact = () => { this.navigateTo("/contact"); };
    toggleMenu = () => {
        this.menuOpen = !this.menuOpen;
        this.render();
    };
    html = () => {
        const mobileMenuClass = this.menuOpen ? "max-h-48 opacity-100" : "max-h-0 opacity-0";
        return (_jsxs("nav", { class: "sticky top-0 z-50 border-b border-amber-200/60 bg-white/80 backdrop-blur-md", children: [_jsxs("div", { class: "mx-auto flex max-w-5xl items-center justify-between px-5 py-3", children: [_jsxs("button", { type: "button", onclick: this.goHome, class: "flex items-center gap-2 text-xl font-black tracking-tight text-stone-800 transition hover:text-amber-700", children: [_jsx("span", { class: "inline-block h-6 w-6 rounded-md bg-gradient-to-br from-amber-400 to-orange-500" }), "Folio"] }), _jsxs("div", { class: "hidden gap-1 md:flex", children: [_jsx("button", { type: "button", onclick: this.goHome, class: "nav-link", children: "Home" }), _jsx("button", { type: "button", onclick: this.goProjects, class: "nav-link", children: "Projects" }), _jsx("button", { type: "button", onclick: this.goContact, class: "nav-link", children: "Contact" })] }), _jsx("button", { type: "button", onclick: this.toggleMenu, class: "rounded-md p-2 text-stone-600 transition hover:bg-stone-100 md:hidden", children: _jsx("svg", { class: "h-5 w-5", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", "stroke-width": "2", children: _jsx("path", { "stroke-linecap": "round", "stroke-linejoin": "round", d: "M4 6h16M4 12h16M4 18h16" }) }) })] }), _jsx("div", { class: `overflow-hidden transition-all duration-300 md:hidden ${mobileMenuClass}`, children: _jsxs("div", { class: "flex flex-col gap-1 px-5 pb-4", children: [_jsx("button", { type: "button", onclick: this.goHome, class: "nav-link text-left", children: "Home" }), _jsx("button", { type: "button", onclick: this.goProjects, class: "nav-link text-left", children: "Projects" }), _jsx("button", { type: "button", onclick: this.goContact, class: "nav-link text-left", children: "Contact" })] }) })] }));
    };
}
