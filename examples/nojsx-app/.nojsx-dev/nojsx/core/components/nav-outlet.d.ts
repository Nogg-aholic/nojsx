import { NComponent, NComponentProps } from './components.js';
export declare class NavOutlet extends NComponent {
    constructor(props?: NComponentProps);
    html: () => JSX.Element;
    onLoad: () => void;
}
