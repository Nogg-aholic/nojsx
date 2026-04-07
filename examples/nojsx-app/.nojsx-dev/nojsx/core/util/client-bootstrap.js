const defaultProviderScriptUrls = [];
function loadScriptOnce(src) {
    return new Promise((resolve, reject) => {
        const existing = document.querySelector(`script[src="${src}"]`);
        if (existing) {
            existing.dataset.nojsxLoaded = '1';
            resolve();
            return;
        }
        const script = document.createElement('script');
        script.src = src;
        script.async = false;
        script.addEventListener('load', () => {
            script.dataset.nojsxLoaded = '1';
            resolve();
        }, { once: true });
        script.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), { once: true });
        document.body.appendChild(script);
    });
}
async function ensureProviderScriptsLoaded(urls) {
    for (const src of urls) {
        try {
            await loadScriptOnce(src);
        }
        catch (error) {
            console.error('[nojsx] provider script load error', src, error);
        }
    }
}
function invokeInlineHandler(target, event, eventName) {
    if (!target)
        return false;
    const handlerId = target.getAttribute(`data-on-${eventName}`);
    const cid = target.getAttribute('data-cid');
    if (!handlerId || !cid)
        return false;
    const g = globalThis;
    const handlers = g.__nojsxInlineHandlers;
    const handler = handlers?.get(`${cid}:${handlerId}`);
    if (typeof handler !== 'function')
        return false;
    handler(event);
    return true;
}
export function bindClientDelegatedEvents() {
    if (typeof window === 'undefined')
        return;
    const g = globalThis;
    if (g.__nojsxDelegatedEventsBound)
        return;
    g.__nojsxDelegatedEventsBound = true;
    document.addEventListener('click', (event) => {
        const target = event.target?.closest('[data-action]');
        if (!target)
            return;
        const handlerId = target.getAttribute('data-action');
        const cid = target.getAttribute('data-cid');
        if (!handlerId || !cid)
            return;
        const handlers = g.__nojsxInlineHandlers;
        const handler = handlers?.get(`${cid}:${handlerId}`);
        if (typeof handler === 'function')
            handler(event);
    });
    const delegatedEvents = [
        'input',
        'change',
        'submit',
        'keydown',
        'keyup',
        'keypress',
        'mousedown',
        'mouseup',
        'dblclick',
        'contextmenu',
        'pointerdown',
        'pointerup',
        'focusin',
        'focusout',
        'paste',
        'copy',
        'cut',
    ];
    for (const eventName of delegatedEvents) {
        document.addEventListener(eventName, (event) => {
            let node = event.target;
            while (node) {
                if (invokeInlineHandler(node, event, eventName))
                    return;
                node = node.parentElement;
            }
        });
    }
}
export function bootstrapClientRuntime(options = {}) {
    if (typeof window === 'undefined')
        return;
    bindClientDelegatedEvents();
    void ensureProviderScriptsLoaded(options.providerScriptUrls ?? defaultProviderScriptUrls);
}
export function renderPreviewDocument(html) {
    if (typeof document === 'undefined')
        return;
    const g = globalThis;
    if (!g.__livePreviewMode && !g.__nojsxDevPreviewMode)
        return;
    if (!html || typeof html !== 'string')
        return;
    const trimmed = html.trimStart().toLowerCase();
    const isDocumentHtml = trimmed.startsWith('<!doctype') || trimmed.startsWith('<html');
    if (!isDocumentHtml)
        return;
    const finalHtml = trimmed.startsWith('<!doctype') ? html : `<!doctype html>${html}`;
    document.open();
    document.write(finalHtml);
    document.close();
}
