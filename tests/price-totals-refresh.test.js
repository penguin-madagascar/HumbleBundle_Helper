const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'HB_Helper.user.js'), 'utf8');

function createClassList() {
    const names = new Set();
    return {
        add(...values) { values.forEach(value => names.add(value)); },
        remove(...values) { values.forEach(value => names.delete(value)); },
        toggle(value, enabled) {
            if (enabled) names.add(value);
            else names.delete(value);
            return enabled;
        },
        contains(value) { return names.has(value); },
    };
}

function createDocument() {
    function descendants(root) {
        return root.children.flatMap(child =>
            child.nodeType === 1 ? [child, ...descendants(child)] : []
        );
    }
    const createTextNode = value => ({
        nodeType: 3,
        parentNode: null,
        get textContent() { return String(value); },
        remove() {
            if (!this.parentNode) return;
            const index = this.parentNode.children.indexOf(this);
            if (index >= 0) this.parentNode.children.splice(index, 1);
            this.parentNode = null;
        },
    });
    const createElement = tagName => {
        let ownText = '';
        const listeners = new Map();
        const attributes = new Map();
        const element = {
            tagName: String(tagName).toUpperCase(),
            nodeType: 1,
            parentNode: null,
            children: [],
            classList: createClassList(),
            dataset: {},
            style: {},
            id: '',
            className: '',
            appendChild(child) {
                child.remove?.();
                this.children.push(child);
                child.parentNode = this;
                return child;
            },
            append(...items) {
                items.forEach(item => this.appendChild(
                    typeof item === 'string' ? createTextNode(item) : item
                ));
            },
            replaceChildren(...items) {
                this.children.splice(0).forEach(child => { child.parentNode = null; });
                this.append(...items);
            },
            remove() {
                if (!this.parentNode) return;
                const index = this.parentNode.children.indexOf(this);
                if (index >= 0) this.parentNode.children.splice(index, 1);
                this.parentNode = null;
            },
            addEventListener(type, listener) {
                listeners.set(type, listener);
            },
            click() {
                listeners.get('click')?.({target: this});
            },
            setAttribute(name, value) {
                attributes.set(name, String(value));
            },
            getAttribute(name) {
                return attributes.get(name) ?? null;
            },
            removeAttribute(name) {
                attributes.delete(name);
            },
            querySelector(selector) {
                const candidates = descendants(this);
                if (selector.startsWith('#')) {
                    return candidates.find(candidate => candidate.id === selector.slice(1)) || null;
                }
                if (selector.startsWith('.')) {
                    const className = selector.slice(1);
                    return candidates.find(candidate =>
                        candidate.className.split(/\s+/).includes(className)
                    ) || null;
                }
                return null;
            },
            querySelectorAll() { return []; },
        };
        Object.defineProperty(element, 'textContent', {
            get() {
                return ownText + this.children.map(child => child.textContent).join('');
            },
            set(value) {
                ownText = String(value);
                this.children.splice(0).forEach(child => { child.parentNode = null; });
            },
        });
        return element;
    };
    const head = createElement('head');
    const body = createElement('body');
    const documentElement = createElement('html');
    return {
        head,
        body,
        documentElement,
        createElement,
        addEventListener() {},
        getElementById(id) {
            return [head, body, documentElement]
                .flatMap(root => [root, ...descendants(root)])
                .find(element => element.id === id) || null;
        },
        querySelector() { return null; },
        querySelectorAll() { return []; },
    };
}

function loadPriceTotalsApi({language = 'en', account = {}, pathname = '/membership'} = {}) {
    const document = createDocument();
    const location = {
        origin: 'https://www.humblebundle.com',
        hostname: 'www.humblebundle.com',
        pathname,
        search: '',
        href: `https://www.humblebundle.com${pathname}`,
    };
    const applyLocation = url => {
        const next = new URL(url, location.href);
        location.origin = next.origin;
        location.hostname = next.hostname;
        location.pathname = next.pathname;
        location.search = next.search;
        location.href = next.href;
    };
    const history = {
        pushState(state, title, url) {
            if (url !== undefined && url !== null) applyLocation(url);
        },
        replaceState(state, title, url) {
            if (url !== undefined && url !== null) applyLocation(url);
        },
    };
    const context = {
        __HB_HELPER_TEST__: true,
        console: {log() {}, warn(...args) { warnings.push(args); }, error() {}},
        document,
        navigator: {language, languages: [language]},
        location,
        history,
        addEventListener() {},
        removeEventListener() {},
        MutationObserver: class {
            observe() {}
            disconnect() {}
        },
        DOMParser: class {
            parseFromString() {
                return {querySelector() { return null; }, querySelectorAll() { return []; }};
            }
        },
        GM_getValue(name, fallback) { return fallback; },
        GM_setValue() {},
        GM_deleteValue() {},
        GM_addValueChangeListener() {},
        GM_setClipboard() {},
        GM_registerMenuCommand() {},
        GM_xmlhttpRequest() {},
        setTimeout,
        clearTimeout,
        setInterval,
        clearInterval,
        URLSearchParams,
        URL,
        Map,
        Set,
        WeakMap,
        Promise,
        Date,
        Math,
        JSON,
        Array,
        Object,
        String,
        Number,
        Boolean,
        RegExp,
        Error,
        Intl,
    };
    const warnings = [];
    context.globalThis = context;
    context.window = context;
    vm.runInNewContext(source, context, {filename: 'HB_Helper.user.js'});
    const summary = document.createElement('div');
    summary.id = 'hb-helper-price-summary';
    document.body.appendChild(summary);
    const api = context.__HB_HELPER_TEST_API__;
    api.setSteamSessionStateForTest({
        status: 'authenticated',
        account: {
            countryCode: account.countryCode || 'UA',
            ownedApps: account.ownedApps || [],
            wishlistApps: account.wishlistApps || [],
            sessionId: account.sessionId || 'session',
        },
        error: null,
    });
    return {api, context, summary, warnings};
}

function deferred() {
    let resolve;
    const promise = new Promise(resolvePromise => {
        resolve = resolvePromise;
    });
    return {promise, resolve};
}

function priceDependencies({findApp, fetchPriceHistory} = {}) {
    return {
        findSteamApp: findApp || (async () => ({appid: 10, name: 'Example Game'})),
        resolveHumbleCurrencyCode: async () => 'UAH',
        fetchXiaoheihePriceHistory: fetchPriceHistory || (async () => ({
            current: 100,
            original: 150,
            lowest: 80,
            currency: 'UAH',
        })),
        fetchExchangeRate: async () => 1,
    };
}

test('first Steam price load shows loading until the UA/UAH result is ready', async () => {
    const {api, summary} = loadPriceTotalsApi();
    const app = deferred();
    const loading = api.loadPriceTotalsForTest(['Example Game'], priceDependencies({
        findApp: () => app.promise,
    }));

    assert.equal(summary.textContent, 'Loading Steam price totals...');

    app.resolve({appid: 10, name: 'Example Game'});
    await loading;
    assert.match(summary.textContent, /Steam price totals \(UA, UAH\)/);
    assert.match(summary.textContent, /100/);
});

test('same-context refresh keeps the exact rendered DOM until an atomic replacement', async () => {
    const {api, summary} = loadPriceTotalsApi();
    await api.loadPriceTotalsForTest(['Example Game'], priceDependencies());
    const oldText = summary.textContent;
    const oldHeader = summary.children[0];
    const nextPrice = deferred();

    const refreshing = api.loadPriceTotalsForTest(['Example Game'], priceDependencies({
        fetchPriceHistory: () => nextPrice.promise,
    }));

    assert.equal(summary.textContent, oldText);
    assert.strictEqual(summary.children[0], oldHeader);

    nextPrice.resolve({current: 200, original: 250, lowest: 180, currency: 'UAH'});
    await refreshing;
    assert.notStrictEqual(summary.children[0], oldHeader);
    assert.match(summary.textContent, /200/);
});

test('fatal same-context refresh failure marks old data stale and successful recovery clears it', async () => {
    const loaded = loadPriceTotalsApi();
    await loaded.api.loadPriceTotalsForTest(['Example Game'], priceDependencies());
    const oldHeader = loaded.summary.children[0];

    await loaded.api.loadPriceTotalsForTest(['Example Game'], priceDependencies({
        findApp: async () => { throw new Error('refresh failed'); },
    }));
    assert.strictEqual(loaded.summary.children[0], oldHeader);
    const stale = loaded.summary.querySelector('.hb-helper-price-stale');
    assert.equal(stale.textContent, 'Refresh failed; showing previous totals.');
    assert.equal(stale.style.visibility, 'visible');
    assert.equal(stale.getAttribute('aria-hidden'), null);
    assert.equal(loaded.api.getSteamDerivedStateForTest().hasPriceResult, true);
    assert.equal(loaded.warnings.length, 1);

    loaded.summary.querySelector('#hb-helper-price-scope').click();
    const staleAfterScopeChange = loaded.summary.querySelector('.hb-helper-price-stale');
    assert.equal(staleAfterScopeChange.style.visibility, 'visible');
    assert.equal(staleAfterScopeChange.getAttribute('aria-hidden'), null);

    await loaded.api.loadPriceTotalsForTest(['Example Game'], priceDependencies({
        fetchPriceHistory: async () => ({
            current: 210,
            original: 260,
            lowest: 190,
            currency: 'UAH',
        }),
    }));
    const recovered = loaded.summary.querySelector('.hb-helper-price-stale');
    assert.equal(recovered.style.visibility, 'hidden');
    assert.equal(recovered.getAttribute('aria-hidden'), 'true');
    assert.match(loaded.summary.textContent, /210/);
});

test('first-load fatal failure shows the error and does not retain a price result', async () => {
    const initial = loadPriceTotalsApi();

    await initial.api.loadPriceTotalsForTest(['Example Game'], priceDependencies({
        findApp: async () => { throw new Error('initial failed'); },
    }));
    assert.equal(initial.summary.textContent, 'initial failed');
    assert.equal(initial.api.getSteamDerivedStateForTest().hasPriceResult, false);
});

test('individual price and exchange failures still produce partial results', async () => {
    const missingPrice = loadPriceTotalsApi();
    await missingPrice.api.loadPriceTotalsForTest(['Example Game'], priceDependencies({
        fetchPriceHistory: async () => { throw new Error('price failed'); },
    }));
    assert.match(missingPrice.summary.textContent, /Unavailable/);
    assert.equal(missingPrice.api.getSteamDerivedStateForTest().hasPriceResult, true);

    const missingExchange = loadPriceTotalsApi();
    await missingExchange.api.loadPriceTotalsForTest(['Example Game'], {
        ...priceDependencies(),
        resolveHumbleCurrencyCode: async () => 'CAD',
        fetchExchangeRate: async () => { throw new Error('exchange failed'); },
    });
    assert.match(missingExchange.summary.textContent, /UAH/);
    assert.doesNotMatch(missingExchange.summary.textContent, /HB:/);
    assert.equal(missingExchange.api.getSteamDerivedStateForTest().hasPriceResult, true);
});

test('title changes and query changes remain in the same price-result context', async () => {
    const {api, context, summary} = loadPriceTotalsApi();
    await api.loadPriceTotalsForTest(['Game A'], priceDependencies());
    const oldHeader = summary.children[0];
    const secondApp = deferred();
    context.location.search = '?display=tiles';
    context.location.href = 'https://www.humblebundle.com/membership?display=tiles';

    const loading = api.loadPriceTotalsForTest(['Game A', 'Game B'], priceDependencies({
        findApp: title => title === 'Game A'
            ? Promise.resolve({appid: 10, name: title})
            : secondApp.promise,
    }));
    assert.strictEqual(summary.children[0], oldHeader);

    secondApp.resolve({appid: 20, name: 'Game B'});
    await loading;
    assert.match(summary.textContent, /2\/2 Steam items identified/);
});

test('query-only route synchronization retains DOM until its latest refresh completes', async () => {
    const {api, context, summary} = loadPriceTotalsApi({pathname: '/games/example-bundle'});
    await api.loadPriceTotalsForTest(['Example Game'], priceDependencies());
    const nextPrice = deferred();
    let startQueryRefresh = false;
    let queryRefresh;
    const syncSession = async () => {
        if (startQueryRefresh) {
            queryRefresh = api.loadPriceTotalsForTest(['Example Game'], priceDependencies({
                fetchPriceHistory: () => nextPrice.promise,
            }));
        }
    };

    api.installHelperRouteLifecycleForTest({syncSession});
    await api.waitForHelperRouteForTest();
    const oldHeader = summary.children[0];

    startQueryRefresh = true;
    context.history.pushState({}, '', '/games/example-bundle?view=tiles');
    await api.waitForHelperRouteForTest();
    assert.strictEqual(summary.children[0], oldHeader);

    nextPrice.resolve({current: 220, original: 270, lowest: 200, currency: 'UAH'});
    await queryRefresh;
    assert.notStrictEqual(summary.children[0], oldHeader);
    assert.match(summary.textContent, /220/);
});

test('a different valid price pathname does not temporarily show previous totals', async () => {
    const {api, context, summary} = loadPriceTotalsApi();
    await api.loadPriceTotalsForTest(['Example Game'], priceDependencies());
    context.location.pathname = '/games/different-page';
    const app = deferred();

    const loading = api.loadPriceTotalsForTest(['Example Game'], priceDependencies({
        findApp: () => app.promise,
    }));
    assert.equal(summary.textContent, 'Loading Steam price totals...');

    app.resolve({appid: 10, name: 'Example Game'});
    await loading;
});

test('normalized trailing slash does not change context but country and session do', async () => {
    const {api, context, summary} = loadPriceTotalsApi();
    await api.loadPriceTotalsForTest(['Example Game'], priceDependencies());
    const oldHeader = summary.children[0];
    context.location.pathname = '/membership/';
    const samePathApp = deferred();
    const samePathLoad = api.loadPriceTotalsForTest(['Example Game'], priceDependencies({
        findApp: () => samePathApp.promise,
    }));
    assert.strictEqual(summary.children[0], oldHeader);
    samePathApp.resolve({appid: 10, name: 'Example Game'});
    await samePathLoad;

    for (const account of [
        {countryCode: 'CA', sessionId: 'session'},
        {countryCode: 'CA', sessionId: 'next-session'},
    ]) {
        api.setSteamSessionStateForTest({
            status: 'authenticated',
            account: {...account, ownedApps: [], wishlistApps: []},
            error: null,
        });
        const app = deferred();
        const loading = api.loadPriceTotalsForTest(['Example Game'], priceDependencies({
            findApp: () => app.promise,
        }));
        assert.equal(summary.textContent, 'Loading Steam price totals...');
        app.resolve({appid: 10, name: 'Example Game'});
        await loading;
    }
});

test('latest-started run wins when an older refresh finishes last', async () => {
    const {api, summary} = loadPriceTotalsApi();
    await api.loadPriceTotalsForTest(['Example Game'], priceDependencies());
    const olderPrice = deferred();
    const older = api.loadPriceTotalsForTest(['Example Game'], priceDependencies({
        fetchPriceHistory: () => olderPrice.promise,
    }));
    const newer = api.loadPriceTotalsForTest(['Example Game'], priceDependencies({
        fetchPriceHistory: async () => ({
            current: 300,
            original: 350,
            lowest: 280,
            currency: 'UAH',
        }),
    }));
    await newer;
    const newerHeader = summary.children[0];
    assert.match(summary.textContent, /300/);

    olderPrice.resolve({current: 200, original: 250, lowest: 180, currency: 'UAH'});
    await older;
    assert.strictEqual(summary.children[0], newerHeader);
    assert.match(summary.textContent, /300/);
    assert.doesNotMatch(summary.textContent, /200/);
});

test('refresh preserves an expanded missing-price details section', async () => {
    const {api, summary} = loadPriceTotalsApi();
    const unmatched = priceDependencies({findApp: async () => null});
    await api.loadPriceTotalsForTest(['Unknown Game'], unmatched);
    const oldDetails = summary.querySelector('.hb-helper-match-details');
    assert.ok(oldDetails);
    oldDetails.open = true;

    summary.querySelector('#hb-helper-price-scope').click();
    const scopeDetails = summary.querySelector('.hb-helper-match-details');
    assert.notStrictEqual(scopeDetails, oldDetails);
    assert.equal(scopeDetails.open, true);

    await api.loadPriceTotalsForTest(['Unknown Game'], unmatched);
    const newDetails = summary.querySelector('.hb-helper-match-details');
    assert.notStrictEqual(newDetails, oldDetails);
    assert.equal(newDetails.open, true);
});

test('scope label describes current data and sits immediately left of the action button', async () => {
    const loaded = loadPriceTotalsApi();
    loaded.api.setSteamDerivedStateForTest({
        countryCode: 'UA',
        ownedApps: [10],
        wishlistApps: [],
        sessionId: 'session',
    });
    await loaded.api.loadPriceTotalsForTest(['Owned', 'Unowned'], priceDependencies({
        findApp: async title => ({appid: title === 'Owned' ? 10 : 20, name: title}),
    }));

    let button = loaded.summary.querySelector('#hb-helper-price-scope');
    let label = loaded.summary.querySelector('.hb-helper-price-scope-label');
    assert.equal(label.textContent, 'Showing: unowned items');
    assert.equal(button.textContent, 'Show all');
    assert.strictEqual(label.parentNode.children.at(-2), label);
    assert.strictEqual(label.parentNode.children.at(-1), button);

    button.click();
    button = loaded.summary.querySelector('#hb-helper-price-scope');
    label = loaded.summary.querySelector('.hb-helper-price-scope-label');
    assert.equal(label.textContent, 'Showing: all items');
    assert.equal(button.textContent, 'Show unowned');
    assert.match(loaded.summary.textContent, /2\/2 Steam items identified/);

    const oldButton = button;
    await loaded.api.loadPriceTotalsForTest(['Owned', 'Unowned'], priceDependencies({
        findApp: async title => ({appid: title === 'Owned' ? 10 : 20, name: title}),
    }));
    assert.notStrictEqual(loaded.summary.querySelector('#hb-helper-price-scope'), oldButton);
    assert.equal(loaded.summary.querySelector('.hb-helper-price-scope-label').textContent,
        'Showing: all items');
});

test('Chinese stale marker and current-scope label use localized copy', async () => {
    const loaded = loadPriceTotalsApi({language: 'zh-CN'});
    await loaded.api.loadPriceTotalsForTest(['Example Game'], priceDependencies());
    await loaded.api.loadPriceTotalsForTest(['Example Game'], priceDependencies({
        findApp: async () => { throw new Error('refresh failed'); },
    }));

    assert.equal(loaded.summary.querySelector('.hb-helper-price-stale').textContent,
        '刷新失败，正在显示上次成功的价格汇总。');
    assert.equal(loaded.summary.querySelector('.hb-helper-price-scope-label').textContent,
        '当前显示：全部项目');
    assert.equal(loaded.summary.querySelector('#hb-helper-price-scope').textContent,
        '显示未拥有');
});
