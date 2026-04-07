export type NjsxSlotMap = Record<string, string>;
export declare function getSlotsFromProps(props: unknown): NjsxSlotMap | undefined;
export declare function slotFromProps(props: unknown, name: string, fallback?: string): string;
export declare function createSlotGetter(props: unknown, fallback?: string): (name: string) => string;
