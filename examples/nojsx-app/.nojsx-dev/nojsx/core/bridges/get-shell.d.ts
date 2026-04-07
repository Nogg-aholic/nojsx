import { NComponent } from '../components/components.js';
import { ShellBridgeExtended } from '../types/index.js';
export declare function extendShellBridge(shell: NComponent): ShellBridgeExtended;
export declare function createGetShellFunctionServer(): () => ShellBridgeExtended;
