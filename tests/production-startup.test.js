const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const {parseHTML} = require('linkedom');

const source = fs.readFileSync(path.join(__dirname, '..', 'HB_Helper.user.js'), 'utf8');

function createPage(pathname, initialBody, html = '') {
    const {window, document} = parseHTML(`<html><head></head><body>${html}</body></html>`);
    window.Element.prototype.getClientRects = function () {
        return this.closest('[hidden]') ? [] : [{}];
    };
    const body = document.body;
    let bodyReady = initialBody;
    Object.defineProperty(document, 'body', {get: () => bodyReady ? body : null});
    const location = new URL(pathname, 'https://www.humblebundle.com');
    const mutations = [];
    const history = {
        pushState(state, title, url) { location.href = new URL(url, location.href).href; },
        replaceState(state, title, url) { location.href = new URL(url, location.href).href; },
    };
    const context = {
        // Run the real entry point, without the test flag used by the unit harnesses.
        document,
        window: {history, addEventListener() {}},
        location,
        navigator: {language: 'en', languages: ['en']},
        DOMParser: window.DOMParser,
        MutationObserver: class {
            constructor(callback) { mutations.push(callback); }
            observe() {}
            disconnect() {}
        },
        console: {warn() {}, error() {}, log() {}},
        GM_getValue: (key, fallback) => fallback,
        GM_setValue() {},
        GM_deleteValue() {},
        GM_addValueChangeListener() {},
        GM_setClipboard() {},
        GM_registerMenuCommand() {},
        GM_xmlhttpRequest() {},
        setTimeout: () => 1,
        clearTimeout() {},
        setInterval: () => 1,
        clearInterval() {},
        URL,
        URLSearchParams,
        TextEncoder,
        TextDecoder,
    };
    return {
        context,
        history,
        mutations,
        ready() {
            bodyReady = true;
            document.dispatchEvent(new window.Event('DOMContentLoaded'));
        },
    };
}

test('production startup mounts the authenticated member grid toolbar', () => {
    const page = createPage('/membership/home', true, `
        <main id="main-content"><section class="page-content"><div>
            <div><h1>2026年11月 Humble Choice</h1></div>
            <div class="grid"><button><div data-testid="product-card">
                <div data-testid="product-thumbnail"><img alt=""></div>
                <div data-testid="product-card-footer"><div class="group/product-title">
                    <div><div class="line-clamp-1">Member Game</div></div>
                </div></div>
            </div></button></div>
        </div></section></main>`);
    assert.doesNotThrow(() => vm.runInNewContext(source, page.context, {timeout: 1000}));
    const controls = page.context.document.getElementById('hb-helper-controls');
    assert.ok(controls, 'real startup adds the member toolbar');
    assert.ok(controls.nextElementSibling === page.context.document.querySelector('main .grid'));
});

for (const pathname of ['/', '/membership/home']) {
    for (const initialBody of [true, false]) {
        test(`production startup and navigation work at ${pathname} with body ${initialBody ? 'present' : 'deferred'}`, () => {
            const page = createPage(pathname, initialBody);
            assert.doesNotThrow(() => vm.runInNewContext(
                source + '\n;globalThis.scriptLoaded = true;',
                page.context,
                {filename: 'HB_Helper.user.js', timeout: 1000}
            ));
            assert.equal(page.context.scriptLoaded, true, 'the entire script finished initialization');
            assert.equal(page.context.__HB_HELPER_TEST_API__, undefined);
            if (!initialBody) {
                assert.equal(page.mutations.length, 0, 'listeners wait for the document body');
                assert.doesNotThrow(() => page.ready());
            }
            assert.ok(page.mutations.length > 0);
            assert.doesNotThrow(() => {
                for (const callback of page.mutations) callback([{
                    target: page.context.document.body,
                    addedNodes: [],
                    removedNodes: [],
                }]);
            }, 'mutation callbacks see initialized Choice state');
            assert.doesNotThrow(() => page.history.pushState({}, '', '/store'));
            assert.doesNotThrow(() => page.history.replaceState({}, '', '/membership/home'));
            assert.doesNotThrow(() => page.history.pushState({}, '', '/about'));
        });
    }
}
