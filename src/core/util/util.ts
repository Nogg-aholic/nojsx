export function join(...parts: Array<string | false | undefined | null>) {
	return parts.filter(Boolean).join(' ');
}

export function renderSlotChildren(children: unknown): string {
	if (children == null || children === false) return '';
	if (Array.isArray(children)) return children.map(renderSlotChildren).join('');
	return String(children);
}


export const __njsxAttachParents = (root: any, rootName: string): void => {
		if (!root || typeof root !== 'object') return;
		(root as any).__njsxIntrinsicName = rootName;
		const walk = (node: any, parent: any, path: string): void => {
			if (!node || typeof node !== 'object') return;
			(node as any).__njsxParent = parent;
			(node as any).__njsxRoot = root;
			(node as any).__njsxRootName = rootName;
			(node as any).__njsxPath = path;
			(node as any).__njsxSlotTemplateName = node?.template?.name ?? null;
			(node as any).__njsxParentIntrinsic = root;
			(node as any).__njsxParentIntrinsicName = rootName;

			const slots = (node as any).slots;
			if (!Array.isArray(slots)) return;
			for (let i = 0; i < slots.length; i++) {
				const s = slots[i];
				const tname = s?.template?.name ?? `slot${i}`;
				walk(s, node, `${path}.slots[${i}](${tname})`);
			}
		};
		walk(root, null, rootName);
};