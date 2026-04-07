import { jsx as _jsx, jsxs as _jsxs } from "nojsx/jsx-runtime";
/** @jsxImportSource nojsx */
import { NComponent } from "nojsx/core/components/components";
export class ContactPage extends NComponent {
    name = "";
    email = "";
    message = "";
    submitted = false;
    constructor(props) {
        super("ContactPage", props);
    }
    onNameInput = (e) => {
        this.name = e.target.value;
    };
    onEmailInput = (e) => {
        this.email = e.target.value;
    };
    onMessageInput = (e) => {
        this.message = e.target.value;
    };
    handleSubmit = (e) => {
        e.preventDefault();
        this.submitted = true;
        this.render();
    };
    resetForm = () => {
        this.name = "";
        this.email = "";
        this.message = "";
        this.submitted = false;
        this.render();
    };
    html = () => (_jsxs("div", { class: "page-enter mx-auto max-w-lg", children: [_jsxs("section", { class: "text-center", children: [_jsx("h1", { class: "text-3xl font-black text-stone-900 md:text-4xl", children: "Get in Touch" }), _jsx("p", { class: "mt-2 text-stone-500", children: "Interactive form with local state -- no backend required." })] }), this.submitted
                ? (_jsxs("div", { class: "mt-10 rounded-xl border border-emerald-200 bg-emerald-50 p-8 text-center", children: [_jsx("div", { class: "mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100", children: _jsx("svg", { class: "h-7 w-7 text-emerald-600", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", "stroke-width": "2.5", children: _jsx("path", { "stroke-linecap": "round", "stroke-linejoin": "round", d: "M5 13l4 4L19 7" }) }) }), _jsx("h2", { class: "mt-4 text-xl font-bold text-emerald-800", children: "Message Sent!" }), _jsxs("p", { class: "mt-2 text-sm text-emerald-700", children: ["Thanks, ", _jsx("strong", { children: this.name || "friend" }), ". This is a demo -- nothing was actually sent."] }), _jsx("button", { type: "button", onclick: this.resetForm, class: "mt-6 rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 active:scale-95", children: "Send Another" })] }))
                : (_jsxs("form", { class: "mt-10 space-y-5", onsubmit: this.handleSubmit, children: [_jsxs("div", { children: [_jsx("label", { class: "block text-sm font-semibold text-stone-700", children: "Name" }), _jsx("input", { type: "text", placeholder: "Your name", oninput: this.onNameInput, class: "mt-1.5 w-full rounded-lg border border-stone-300 bg-white px-4 py-2.5 text-sm text-stone-800 shadow-sm transition placeholder:text-stone-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200" })] }), _jsxs("div", { children: [_jsx("label", { class: "block text-sm font-semibold text-stone-700", children: "Email" }), _jsx("input", { type: "email", placeholder: "you@example.com", oninput: this.onEmailInput, class: "mt-1.5 w-full rounded-lg border border-stone-300 bg-white px-4 py-2.5 text-sm text-stone-800 shadow-sm transition placeholder:text-stone-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200" })] }), _jsxs("div", { children: [_jsx("label", { class: "block text-sm font-semibold text-stone-700", children: "Message" }), _jsx("textarea", { rows: "4", placeholder: "What's on your mind?", oninput: this.onMessageInput, class: "mt-1.5 w-full rounded-lg border border-stone-300 bg-white px-4 py-2.5 text-sm text-stone-800 shadow-sm transition placeholder:text-stone-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200" })] }), _jsx("button", { type: "submit", class: "w-full rounded-lg bg-amber-600 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-amber-700 active:scale-[0.98]", children: "Send Message" })] }))] }));
}
