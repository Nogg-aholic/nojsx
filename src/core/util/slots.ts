export type NjsxSlotMap = Record<string, string>;

export function getSlotsFromProps(props: unknown): NjsxSlotMap | undefined {
	return (props as any)?.__slots as NjsxSlotMap | undefined;
}

export function slotFromProps(props: unknown, name: string, fallback = ''): string {
	return getSlotsFromProps(props)?.[name] ?? fallback;
}

export function createSlotGetter(props: unknown, fallback = ''): (name: string) => string {
	const slots = getSlotsFromProps(props);
	return (name: string) => slots?.[name] ?? fallback;
}
