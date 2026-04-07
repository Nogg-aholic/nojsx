export function join(...parts) {
    return parts.filter(Boolean).join(' ');
}
export function renderSlotChildren(children) {
    if (children == null || children === false)
        return '';
    if (Array.isArray(children))
        return children.map(renderSlotChildren).join('');
    return String(children);
}
export const __njsxAttachParents = (root, rootName) => {
    if (!root || typeof root !== 'object')
        return;
    root.__njsxIntrinsicName = rootName;
    const walk = (node, parent, path) => {
        if (!node || typeof node !== 'object')
            return;
        node.__njsxParent = parent;
        node.__njsxRoot = root;
        node.__njsxRootName = rootName;
        node.__njsxPath = path;
        node.__njsxSlotTemplateName = node?.template?.name ?? null;
        node.__njsxParentIntrinsic = root;
        node.__njsxParentIntrinsicName = rootName;
        const slots = node.slots;
        if (!Array.isArray(slots))
            return;
        for (let i = 0; i < slots.length; i++) {
            const s = slots[i];
            const tname = s?.template?.name ?? `slot${i}`;
            walk(s, node, `${path}.slots[${i}](${tname})`);
        }
    };
    walk(root, null, rootName);
};
//# sourceMappingURL=util.js.map