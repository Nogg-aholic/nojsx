import { jsx as _jsx, jsxs as _jsxs } from "nojsx/jsx-runtime";
/** @jsxImportSource nojsx */
import { ShellPageParent } from "nojsx/core/components/shell-page-parent";
import { NavOutlet } from "nojsx/core/components/nav-outlet";
import { NavBar } from "./components/navbar";
export default class ShellPage extends ShellPageParent {
    static layout_title = 'NUI';
    static layout_cspNonce = 'nsx-importmap';
    static layout_appHostId = 'info';
    static layout_bodyClass = 'bg-white text-gray-800 dark:bg-black dark:text-neutral-200';
    static layout_head_html = '';
    static headerAttributes = 'lang="en" class="dark" data-theme="theme-emerald-night"';
    static layout_header = (_jsx("div", {}));
    static layout_footer = (_jsx("div", {}));
    static layout_scripts = (_jsx("div", {}));
    constructor(props) {
        super({ ...props });
    }
    html = () => (_jsxs("div", { class: "min-h-screen bg-stone-50", children: [_jsx(NavBar, {}), _jsx("main", { class: "mx-auto max-w-5xl px-5 py-10", children: _jsx(NavOutlet, {}) }), _jsx("footer", { class: "border-t border-stone-200 bg-white/60 py-6 text-center text-xs text-stone-400", children: "nojsx demo app \u00B7 client-rendered \u00B7 no framework ceremony" })] }));
}
