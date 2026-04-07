export function getSlotsFromProps(props) {
    return props?.__slots;
}
export function slotFromProps(props, name, fallback = '') {
    return getSlotsFromProps(props)?.[name] ?? fallback;
}
export function createSlotGetter(props, fallback = '') {
    const slots = getSlotsFromProps(props);
    return (name) => slots?.[name] ?? fallback;
}
