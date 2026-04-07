import { jsx as _jsx, jsxs as _jsxs } from "nojsx/jsx-runtime";
/** @jsxImportSource nojsx */
import { NComponent } from "nojsx/core/components/components";
export class StatCounter extends NComponent {
    count = 0;
    label = "Count";
    step = 1;
    constructor(props) {
        super("StatCounter" + props.id, props);
        this.count = props?.initial ?? 0;
        this.label = props?.label ?? "Count";
        this.step = props?.step ?? 1;
    }
    increment = () => {
        this.count += this.step;
        this.render();
    };
    decrement = () => {
        this.count -= this.step;
        this.render();
    };
    html = () => (_jsxs("div", { class: "flex flex-col items-center gap-3 rounded-lg border border-amber-200 bg-gradient-to-b from-amber-50 to-white p-5", children: [_jsx("span", { class: "text-xs font-semibold uppercase tracking-widest text-amber-700", children: this.label }), _jsx("span", { class: "text-4xl font-black tabular-nums text-stone-900", children: this.count }), _jsxs("div", { class: "flex gap-2", children: [_jsx("button", { type: "button", onclick: this.decrement, class: "rounded-md border border-stone-300 bg-white px-3 py-1 text-sm font-bold text-stone-600 transition hover:bg-stone-100 active:scale-95", children: "-" }), _jsx("button", { type: "button", onclick: this.increment, class: "rounded-md bg-amber-600 px-3 py-1 text-sm font-bold text-white transition hover:bg-amber-700 active:scale-95", children: "+" })] })] }));
}
