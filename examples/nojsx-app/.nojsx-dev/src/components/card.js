import { jsx as _jsx, jsxs as _jsxs } from "nojsx/jsx-runtime";
/** @jsxImportSource nojsx */
import { NComponent } from "nojsx/core/components/components";
export class Card extends NComponent {
    cardProps;
    constructor(props) {
        super("Card", props);
        this.cardProps = props ?? {};
    }
    html = () => {
        const { title, subtitle, accent, children } = this.cardProps;
        const accentColor = accent ?? "amber";
        const borderClass = `border-${accentColor}-300`;
        return (_jsxs("div", { class: `rounded-xl border ${borderClass} bg-white/90 backdrop-blur-sm p-6 shadow-md hover:shadow-lg transition-shadow duration-300`, children: [title ? _jsx("h3", { class: "text-lg font-bold text-stone-800 tracking-tight", children: title }) : "", subtitle ? _jsx("p", { class: "mt-1 text-sm text-stone-500", children: subtitle }) : "", children ? _jsx("div", { class: "mt-4", children: children }) : ""] }));
    };
}
