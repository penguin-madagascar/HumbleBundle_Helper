const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {parseHTML} = require('linkedom');

const source = fs.readFileSync(path.join(__dirname, '..', '..', 'HB_Helper.user.js'), 'utf8');

function flightScript(records) {
    const stream = Object.entries(records)
        .map(([id, value]) => `${id}:${JSON.stringify(value)}\n`)
        .join('');
    return `<script>self.__next_f.push(${JSON.stringify([1, stream])})</script>`;
}

function loadUserscript({html = '', pathname = '/games/test-bundle', values = new Map(), logger = console} = {}) {
    const {document, window} = parseHTML(`<!doctype html><html><head></head><body>${html}</body></html>`);
    window.Element.prototype.getClientRects = function () {
        return this.closest('[hidden], [style*="display: none"], [style*="display:none"]') ? [] : [{}];
    };
    const location = new URL(pathname, 'https://www.humblebundle.com');
    const requests = [];
    const context = {
        __HB_HELPER_TEST__: true,
        document,
        window,
        location,
        navigator: {language: 'en', languages: ['en']},
        DOMParser: window.DOMParser,
        MutationObserver: window.MutationObserver,
        console: logger,
        GM_getValue: (key, fallback) => values.has(key) ? values.get(key) : fallback,
        GM_setValue: (key, value) => values.set(key, value),
        GM_deleteValue: key => values.delete(key),
        GM_addValueChangeListener() {},
        GM_registerMenuCommand() {},
        GM_setClipboard() {},
        GM_xmlhttpRequest(request) { requests.push(request); },
        fetch() { throw new Error('Unexpected network request in DOM regression test'); },
        setTimeout,
        clearTimeout,
        setInterval,
        clearInterval,
        URL,
        URLSearchParams,
        TextEncoder,
        TextDecoder,
    };
    vm.runInNewContext(source, context, {filename: 'HB_Helper.user.js'});
    return {api: context.__HB_HELPER_TEST_API__, document, window, location, values, requests, context};
}

module.exports = {flightScript, loadUserscript};
