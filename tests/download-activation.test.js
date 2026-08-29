const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const {randomBytes, webcrypto} = require('node:crypto');
const {TextEncoder} = require('node:util');

const source = fs.readFileSync(path.join(__dirname, '..', 'HB_Helper.user.js'), 'utf8');

function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function createClassList(initial = []) {
    const names = new Set(initial);
    return {
        add(...items) { items.forEach(item => names.add(item)); },
        remove(...items) { items.forEach(item => names.delete(item)); },
        toggle(item, enabled) {
            if (enabled === undefined) {
                if (names.has(item)) names.delete(item);
                else names.add(item);
                return names.has(item);
            }
            if (enabled) names.add(item);
            else names.delete(item);
            return enabled;
        },
        contains(item) { return names.has(item); },
        values() { return [...names]; },
    };
}

function createEventDispatcher() {
    const listeners = new Map();
    return {
        addEventListener(type, listener) {
            if (!listeners.has(type)) listeners.set(type, []);
            listeners.get(type).push(listener);
        },
        removeEventListener(type, listener) {
            const current = listeners.get(type) || [];
            listeners.set(type, current.filter(candidate => candidate !== listener));
        },
        dispatchEvent(event) {
            for (const listener of listeners.get(event.type) || []) {
                listener.call(this, event);
            }
            return true;
        },
        listenerCount(type) { return (listeners.get(type) || []).length; },
    };
}

function createDocument() {
    let document;
    const events = createEventDispatcher();
    function matches(element, selector) {
        selector = selector.trim();
        if (!selector) return false;
        if (selector.startsWith('#')) return element.id === selector.slice(1);
        if (selector.startsWith('.')) {
            return selector.slice(1).split('.').every(name => element.classList.contains(name));
        }
        const attribute = selector.match(/^\[([^=\]]+)(?:="([^"]*)")?\]$/);
        if (attribute) {
            const dataName = attribute[1].startsWith('data-')
                ? attribute[1].slice(5).replace(/-([a-z])/g, (match, letter) =>
                    letter.toUpperCase())
                : null;
            const value = dataName && Object.prototype.hasOwnProperty.call(element.dataset, dataName)
                ? String(element.dataset[dataName])
                : element.getAttribute(attribute[1]);
            return attribute[2] === undefined ? value !== null : value === attribute[2];
        }
        return element.tagName.toLowerCase() === selector.toLowerCase();
    }
    function descendants(root) {
        return root.children.flatMap(child => [child, ...descendants(child)]);
    }
    function queryAll(root, selector) {
        const selectors = selector.split(',').map(part => part.trim());
        return descendants(root).filter(element => selectors.some(part => {
            const segments = part.split(/\s+/);
            if (segments.length === 1) return matches(element, part);
            if (!matches(element, segments.at(-1))) return false;
            let ancestor = element.parentNode;
            for (let index = segments.length - 2; index >= 0; index--) {
                while (ancestor && !matches(ancestor, segments[index])) ancestor = ancestor.parentNode;
                if (!ancestor) return false;
                ancestor = ancestor.parentNode;
            }
            return true;
        }));
    }
    function element(tagName = 'div') {
        const attributes = new Map();
        const listeners = new Map();
        const node = {
            tagName: String(tagName).toUpperCase(),
            children: [],
            parentNode: null,
            nodeType: 1,
            dataset: {},
            style: {},
            classList: createClassList(),
            textContent: '',
            value: '',
            disabled: false,
            isConnected: true,
            appendChild(child) {
                child.remove?.();
                this.children.push(child);
                child.parentNode = this;
                return child;
            },
            append(...items) { items.forEach(item => this.appendChild(item)); },
            prepend(...items) {
                [...items].reverse().forEach(item => this.insertBefore(item, this.firstChild));
            },
            insertBefore(child, reference) {
                child.remove?.();
                const index = this.children.indexOf(reference);
                this.children.splice(index < 0 ? this.children.length : index, 0, child);
                child.parentNode = this;
                return child;
            },
            insertAdjacentElement(position, child) {
                if (!this.parentNode) return child;
                const siblings = this.parentNode.children;
                const index = siblings.indexOf(this);
                child.remove?.();
                siblings.splice(position === 'beforebegin' ? index : index + 1, 0, child);
                child.parentNode = this.parentNode;
                return child;
            },
            replaceChildren(...items) {
                this.children.splice(0).forEach(child => { child.parentNode = null; });
                this.append(...items);
            },
            remove() {
                if (this.parentNode) {
                    const index = this.parentNode.children.indexOf(this);
                    if (index >= 0) this.parentNode.children.splice(index, 1);
                }
                this.parentNode = null;
            },
            addEventListener(type, listener) {
                if (!listeners.has(type)) listeners.set(type, []);
                listeners.get(type).push(listener);
            },
            dispatch(type, event = {}) {
                for (const listener of listeners.get(type) || []) listener.call(this, event);
            },
            setAttribute(name, value) {
                attributes.set(name, String(value));
                if (name === 'class') {
                    this.classList = createClassList(String(value).split(/\s+/).filter(Boolean));
                }
            },
            getAttribute(name) { return attributes.has(name) ? attributes.get(name) : null; },
            hasAttribute(name) { return attributes.has(name); },
            removeAttribute(name) { attributes.delete(name); },
            getClientRects() { return this.hidden ? [] : [{}]; },
            querySelector(selector) { return queryAll(this, selector)[0] || null; },
            querySelectorAll(selector) { return queryAll(this, selector); },
            closest(selector) {
                let candidate = this;
                while (candidate) {
                    if (selector.split(',').some(part => matches(candidate, part.trim()))) {
                        return candidate;
                    }
                    candidate = candidate.parentNode;
                }
                return null;
            },
        };
        Object.defineProperties(node, {
            id: {
                get() { return attributes.get('id') || ''; },
                set(value) { attributes.set('id', String(value)); },
            },
            className: {
                get() { return node.classList.values().join(' '); },
                set(value) { node.classList = createClassList(String(value).split(/\s+/).filter(Boolean)); },
            },
            parentElement: {get() { return node.parentNode; }},
            firstChild: {get() { return node.children[0] || null; }},
            firstElementChild: {get() { return node.children[0] || null; }},
            nextSibling: {
                get() {
                    const siblings = node.parentNode?.children || [];
                    return siblings[siblings.indexOf(node) + 1] || null;
                },
            },
            nextElementSibling: {
                get() {
                    const siblings = node.parentNode?.children || [];
                    return siblings[siblings.indexOf(node) + 1] || null;
                },
            },
            previousElementSibling: {
                get() {
                    const siblings = node.parentNode?.children || [];
                    return siblings[siblings.indexOf(node) - 1] || null;
                },
            },
            childElementCount: {get() { return node.children.length; }},
        });
        return node;
    }
    document = {
        head: element('head'),
        body: element('body'),
        documentElement: element('html'),
        title: 'Downloads',
        visibilityState: 'visible',
        createElement: element,
        addEventListener: events.addEventListener,
        removeEventListener: events.removeEventListener,
        dispatchEvent: events.dispatchEvent,
        listenerCount: events.listenerCount,
        getElementById(id) {
            return [this.head, this.body, this.documentElement]
                .flatMap(root => [root, ...descendants(root)])
                .find(candidate => candidate.id === id) || null;
        },
        querySelector(selector) {
            return [this.head, this.body, this.documentElement]
                .map(root => queryAll(root, selector)[0])
                .find(Boolean) || null;
        },
        querySelectorAll(selector) {
            return [this.head, this.body, this.documentElement]
                .flatMap(root => queryAll(root, selector));
        },
    };
    return document;
}

function createGmBus(initial = {}) {
    const values = new Map(Object.entries(clone(initial)));
    const listeners = new Map();
    let nextListenerId = 1;
    const bus = {
        values,
        ignoredWrites: new Set(),
        listenerCount(name) { return listeners.get(name)?.size || 0; },
        bind() {
            return {
                get(name, fallback) {
                    return clone(values.has(name) ? values.get(name) : fallback);
                },
                set(name, value) {
                    if (bus.ignoredWrites.has(name)) return;
                    const oldValue = clone(values.get(name));
                    values.set(name, clone(value));
                    for (const listener of listeners.get(name)?.values() || []) {
                        listener(name, oldValue, clone(value), true);
                    }
                },
                delete(name) {
                    const oldValue = clone(values.get(name));
                    values.delete(name);
                    for (const listener of listeners.get(name)?.values() || []) {
                        listener(name, oldValue, undefined, true);
                    }
                },
                listen(name, listener) {
                    if (!listeners.has(name)) listeners.set(name, new Map());
                    const id = nextListenerId++;
                    listeners.get(name).set(id, listener);
                    return id;
                },
            };
        },
    };
    return bus;
}

function createQueuedLockManager({beforeRelease} = {}) {
    const tails = new Map();
    const names = [];
    return {
        names,
        request(name, options, callback) {
            names.push(name);
            const previous = tails.get(name) || Promise.resolve();
            const current = previous.catch(() => {}).then(async () => {
                const result = await callback({name});
                await beforeRelease?.(name, result);
                return result;
            });
            tails.set(name, current);
            return current;
        },
    };
}

function ephemeralOrderSecret() {
    return randomBytes(24).toString('base64url');
}

function loadApi({
    pathname = '/downloads',
    search,
    gmBus = createGmBus(),
    lockManager = createQueuedLockManager(),
    crypto = webcrypto,
    onRequest = () => {},
    logs = [],
} = {}) {
    const orderSecret = ephemeralOrderSecret();
    const query = search === undefined ? `?key=${encodeURIComponent(orderSecret)}` : search;
    const document = createDocument();
    const gm = gmBus.bind();
    const location = {
        origin: 'https://www.humblebundle.com',
        hostname: 'www.humblebundle.com',
        pathname,
        search: query,
        href: `https://www.humblebundle.com${pathname}${query}`,
    };
    const windowEvents = createEventDispatcher();
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
        console: {
            log(...items) { logs.push(items.map(String).join(' ')); },
            warn(...items) { logs.push(items.map(String).join(' ')); },
            error(...items) { logs.push(items.map(String).join(' ')); },
        },
        document,
        navigator: {language: 'en', languages: ['en'], locks: lockManager},
        location,
        history,
        addEventListener: windowEvents.addEventListener,
        removeEventListener: windowEvents.removeEventListener,
        dispatchEvent: windowEvents.dispatchEvent,
        listenerCount: windowEvents.listenerCount,
        Event: class {
            constructor(type) { this.type = type; }
        },
        MutationObserver: class {
            observe() {}
            disconnect() {}
        },
        crypto,
        TextEncoder,
        URL,
        URLSearchParams,
        DOMParser: class {
            parseFromString() { return {querySelector() { return null; }}; }
        },
        GM_getValue: gm.get,
        GM_setValue: gm.set,
        GM_deleteValue: gm.delete,
        GM_addValueChangeListener: gm.listen,
        GM_setClipboard() {},
        GM_registerMenuCommand() {},
        GM_xmlhttpRequest: onRequest,
        setTimeout,
        clearTimeout,
        setInterval,
        clearInterval,
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
    };
    context.setLocationForTest = applyLocation;
    context.globalThis = context;
    context.window = context;
    vm.runInNewContext(source, context, {filename: 'HB_Helper.user.js'});
    return {
        api: context.__HB_HELPER_TEST_API__,
        context,
        document,
        gmBus,
        lockManager,
        logs,
        orderSecret,
    };
}

function steamKey(seed) {
    const letter = String.fromCharCode(65 + seed);
    return `${letter.repeat(5)}-${letter.repeat(5)}-${letter.repeat(5)}`;
}

function tpk(overrides = {}) {
    return {
        human_name: 'Example Game',
        machine_name: 'example-game',
        keyindex: 0,
        key_type: 'steam',
        key_type_human_name: 'Steam',
        is_gift: false,
        is_expired: false,
        sold_out: false,
        ...overrides,
    };
}

function addTextChild(document, row, className, textContent) {
    const child = document.createElement('span');
    child.className = className;
    child.textContent = textContent;
    row.appendChild(child);
    return child;
}

function treeText(node) {
    return [node.textContent, ...node.children.map(treeText)].join(' ');
}

function downloadRow(document, {
    machineName,
    keyindex,
    title = 'Example Game',
    platform = 'Steam',
    displayState = 'hidden',
    key,
} = {}) {
    const row = document.createElement('div');
    row.className = 'key-redeemer';
    if (machineName !== undefined) row.dataset.machineName = machineName;
    if (keyindex !== undefined) row.dataset.keyindex = String(keyindex);
    row.dataset.downloadDisplayState = displayState;
    addTextChild(document, row, 'human-name-title', title);
    addTextChild(document, row, 'key-type', platform);
    if (key) addTextChild(document, row, 'keyfield-value', key);
    return row;
}

function activationBatch(items, {
    id = 'batch-id',
    state = 'complete',
    owner = null,
} = {}) {
    const active = state !== 'complete';
    return {
        version: 2,
        id,
        state,
        runner: active
            ? {phase: state, owner: owner || 'runner', leaseExpiresAt: Date.now() + 60000}
            : {phase: null, owner: null, leaseExpiresAt: null},
        ownershipRefresh: active
            ? {state: 'waiting', owner: null, leaseExpiresAt: null, error: null}
            : {state: 'complete', owner: null, leaseExpiresAt: null, error: null},
        items: items.map(item => ({
            id: item.id,
            title: item.title || 'Game',
            key: item.key ?? null,
            status: item.status || 'activated',
            ...(item.error ? {error: item.error} : {}),
            ...(Object.prototype.hasOwnProperty.call(item, 'code') ? {code: item.code} : {}),
        })),
    };
}

async function setupPendingDownloadRoute() {
    const loaded = loadApi();
    const {api, context, document, orderSecret: firstSecret} = loaded;
    const secondSecret = ephemeralOrderSecret();
    const firstProducts = [
        tpk({
            human_name: 'Pending order A first private title',
            machine_name: 'pending-order-a-first',
            keyindex: 0,
        }),
        tpk({
            human_name: 'Pending order A second private title',
            machine_name: 'pending-order-a-second',
            keyindex: 1,
        }),
    ];
    const secondProduct = tpk({
        human_name: 'Current order B title',
        machine_name: 'current-order-b',
        keyindex: 2,
    });
    const firstRows = firstProducts.map(product => downloadRow(document, {
        title: product.human_name,
        machineName: product.machine_name,
        keyindex: product.keyindex,
    }));
    const secondRow = downloadRow(document, {
        title: secondProduct.human_name,
        machineName: secondProduct.machine_name,
        keyindex: secondProduct.keyindex,
    });
    const container = document.createElement('div');
    container.className = 'key-container wrapper';
    container.append(...firstRows);
    document.body.appendChild(container);
    api.setSteamDerivedStateForTest({
        countryCode: 'CA',
        ownedApps: [],
        wishlistApps: [],
        sessionId: 'session',
    });
    const authenticated = {
        status: 'authenticated',
        account: {
            countryCode: 'CA',
            ownedApps: [],
            wishlistApps: [],
            sessionId: 'session',
        },
        error: null,
    };
    const orders = new Map([
        [firstSecret, {
            gamekey: firstSecret,
            tpkd_dict: {all_tpks: firstProducts},
        }],
        [secondSecret, {
            gamekey: secondSecret,
            tpkd_dict: {all_tpks: [secondProduct]},
        }],
    ]);
    api.installHelperRouteLifecycleForTest({
        loadOrder: async key => orders.get(key),
        syncSession: async () => authenticated,
        reconcileBatch: async () => ({reconciled: true}),
    });
    await api.waitForHelperRouteForTest();
    const firstScope = await api.hashDownloadOrderKey(firstSecret);
    const secondScope = await api.hashDownloadOrderKey(secondSecret);
    const firstIds = firstProducts.map(product =>
        api.getDownloadActivationItemId(firstScope, product)
    );
    await api.updateDownloadSelection(firstScope, selection => {
        firstIds.forEach(id => selection.add(id));
    });
    api.renderDownloadSelectionStateForTest();

    const navigateToSecondOrder = async () => {
        firstRows.forEach(row => row.remove());
        container.appendChild(secondRow);
        context.history.replaceState(
            {},
            '',
            `/downloads?key=${encodeURIComponent(secondSecret)}`
        );
        await api.waitForHelperRouteForTest();
        return document.getElementById('hb-helper-choice-activation-controls');
    };

    return {
        ...loaded,
        authenticated,
        container,
        firstProducts,
        firstRows,
        firstScope,
        firstIds,
        secondProduct,
        secondRow,
        secondScope,
        navigateToSecondOrder,
    };
}

test('downloads route requires an exact path and a nonempty decoded key', () => {
    const current = loadApi();
    assert.equal(current.api.getDownloadsOrderKey(), current.orderSecret);
    assert.equal(current.api.isDownloadsPage(), true);
    assert.equal(current.api.getHelperPageMode(), 'downloads');
    assert.equal(current.api.isPriceTotalsPageForTest(), false);

    assert.equal(loadApi({pathname: '/downloads/'}).api.isDownloadsPage(), false);
    assert.equal(loadApi({pathname: '/downloads/extra'}).api.isDownloadsPage(), false);
    assert.equal(loadApi({search: ''}).api.isDownloadsPage(), false);
    assert.equal(loadApi({search: '?key='}).api.isDownloadsPage(), false);
    assert.equal(loadApi({pathname: '/games/example'}).api.getHelperPageMode(), 'price-totals');
});

test('the cached order loader validates the response and invalidates without leaking the key', async () => {
    const {api, orderSecret} = loadApi();
    const calls = [];
    const order = {gamekey: orderSecret, tpkd_dict: {all_tpks: [tpk()]}};
    const requestOrder = async url => {
        calls.push(url);
        return order;
    };

    assert.equal(await api.loadDownloadOrder(orderSecret, {requestOrder}), order);
    assert.equal(await api.loadDownloadOrder(orderSecret, {requestOrder}), order);
    assert.equal(calls.length, 1);
    assert.equal(
        calls[0],
        `https://www.humblebundle.com/api/v1/order/${encodeURIComponent(orderSecret)}?all_tpkds=true`
    );

    api.invalidateDownloadOrder();
    await api.loadDownloadOrder(orderSecret, {requestOrder});
    assert.equal(calls.length, 2);

    for (const invalid of [
        {gamekey: ephemeralOrderSecret(), tpkd_dict: {all_tpks: []}},
        {gamekey: orderSecret, tpkd_dict: {}},
    ]) {
        assert.throws(
            () => api.validateDownloadOrder(invalid, orderSecret),
            error => !String(error).includes(orderSecret)
        );
    }
});

test('SHA-256 order scopes isolate deterministic download IDs and require Web Crypto', async () => {
    const {api} = loadApi();
    const firstSecret = ephemeralOrderSecret();
    const secondSecret = ephemeralOrderSecret();
    const firstScope = await api.hashDownloadOrderKey(firstSecret);
    const secondScope = await api.hashDownloadOrderKey(secondSecret);

    assert.match(firstScope, /^[0-9a-f]{64}$/);
    assert.match(secondScope, /^[0-9a-f]{64}$/);
    assert.notEqual(firstScope, secondScope);
    assert.equal(
        api.getDownloadActivationItemId(firstScope, tpk({machine_name: 'name / value', keyindex: 0})),
        `download:${firstScope}:${encodeURIComponent('name / value')}:0`
    );
    assert.deepEqual(
        clone(api.parseDownloadActivationItemId(`download:${firstScope}:name%20%2F%20value:0`)),
        {scope: firstScope, machineName: 'name / value', keyindex: 0}
    );

    const withoutCrypto = loadApi({crypto: null});
    assert.equal(await withoutCrypto.api.hashDownloadOrderKey(withoutCrypto.orderSecret), null);

    const rejectingCrypto = loadApi({
        crypto: {
            subtle: {
                async digest() { throw new Error('digest implementation failed'); },
            },
        },
    });
    assert.equal(
        await rejectingCrypto.api.hashDownloadOrderKey(rejectingCrypto.orderSecret),
        null
    );
    const rejectingContainer = rejectingCrypto.document.createElement('div');
    rejectingContainer.className = 'key-container wrapper';
    rejectingCrypto.document.body.appendChild(rejectingContainer);
    rejectingCrypto.api.setSteamDerivedStateForTest({
        countryCode: 'CA',
        ownedApps: [],
        wishlistApps: [],
        sessionId: 'session',
    });
    await rejectingCrypto.api.initializeDownloadOrderPageForTest({
        loadOrder: async key => ({gamekey: key, tpkd_dict: {all_tpks: [tpk()]}}),
    });
    const rejectingControls = rejectingCrypto.document.getElementById(
        'hb-helper-choice-activation-controls'
    );
    assert.match(treeText(rejectingControls), /Web Crypto SHA-256/);
    assert.equal(treeText(rejectingControls).includes('Could not load this Humble order'), false);
    assert.equal(rejectingCrypto.lockManager.names.length, 0);

    const shortDigestCrypto = loadApi({
        crypto: {subtle: {digest: async () => new Uint8Array(31)}},
    });
    assert.equal(
        await shortDigestCrypto.api.hashDownloadOrderKey(shortDigestCrypto.orderSecret),
        null
    );
});

test('download eligibility accepts keyindex zero and preserves valid revealed keys after expiry', () => {
    const {api} = loadApi();
    assert.equal(api.isEligibleDownloadTpkd(tpk({keyindex: 0})), true);
    assert.equal(api.isEligibleDownloadTpkd(tpk({is_expired: true})), false);
    assert.equal(api.isEligibleDownloadTpkd(tpk({
        is_expired: false,
        expiry_date: '2000-01-01T00:00:00',
    })), false);
    assert.equal(api.isEligibleDownloadTpkd(tpk({
        expiry_date: '2999-01-01T00:00:00Z',
    })), true);
    assert.equal(api.isEligibleDownloadTpkd(tpk({sold_out: true})), false);
    assert.equal(api.isEligibleDownloadTpkd(tpk({
        redeemed_key_val: steamKey(0),
        is_expired: true,
        sold_out: true,
    })), true);
    assert.equal(api.isEligibleDownloadTpkd(tpk({is_gift: true})), false);
    assert.equal(api.isEligibleDownloadTpkd(tpk({key_type: 'steam_keyless'})), false);
    assert.equal(api.isEligibleDownloadTpkd(tpk({key_type_human_name: 'Steam Direct'})), false);
    assert.equal(api.isEligibleDownloadTpkd(tpk({direct_redeem: true})), false);
    assert.equal(api.isEligibleDownloadTpkd(tpk({
        direct_redeem: true,
        redeemed_key_val: steamKey(1),
    })), false);
    assert.equal(api.isEligibleDownloadTpkd(tpk({
        expiry_date: '2000-01-01T00:00:00Z',
        redeemed_key_val: steamKey(2),
    })), true);
    assert.equal(api.isEligibleDownloadTpkd(tpk({machine_name: ''})), false);
    assert.equal(api.isEligibleDownloadTpkd(tpk({keyindex: -1})), false);
});

test('order-scoped GM selection updates serialize across tabs without persisting the order key', async () => {
    const gmBus = createGmBus();
    const lockManager = createQueuedLockManager();
    const first = loadApi({gmBus, lockManager});
    const second = loadApi({gmBus, lockManager, search: first.context.location.search});
    const scope = await first.api.hashDownloadOrderKey(first.orderSecret);
    const firstId = first.api.getDownloadActivationItemId(scope, tpk({machine_name: 'one'}));
    const secondId = first.api.getDownloadActivationItemId(scope, tpk({machine_name: 'two'}));
    first.api.observeDownloadSelection(scope);
    second.api.observeDownloadSelection(scope);

    await Promise.all([
        first.api.updateDownloadSelection(scope, selection => selection.add(firstId)),
        second.api.updateDownloadSelection(scope, selection => selection.add(secondId)),
    ]);

    assert.deepEqual([...first.api.getDownloadSelection(scope)].sort(), [firstId, secondId].sort());
    assert.deepEqual([...second.api.getDownloadSelection(scope)].sort(), [firstId, secondId].sort());
    const persisted = JSON.stringify([...gmBus.values.entries()]);
    assert.equal(persisted.includes(first.orderSecret), false);
    assert.ok(lockManager.names.length >= 2);
    assert.ok(lockManager.names.every(name => name === scope));
});

test('different order scopes update concurrently without overwriting each other', async () => {
    const gmBus = createGmBus();
    const lockManager = createQueuedLockManager();
    const {api} = loadApi({gmBus, lockManager});
    const firstScope = await api.hashDownloadOrderKey(ephemeralOrderSecret());
    const secondScope = await api.hashDownloadOrderKey(ephemeralOrderSecret());
    const firstId = api.getDownloadActivationItemId(firstScope, tpk({machine_name: 'first'}));
    const secondId = api.getDownloadActivationItemId(secondScope, tpk({machine_name: 'second'}));
    let arrivals = 0;
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    const updateAfterBothReads = id => async selection => {
        selection.add(id);
        arrivals += 1;
        if (arrivals === 2) release();
        await gate;
    };

    await Promise.all([
        api.updateDownloadSelection(firstScope, updateAfterBothReads(firstId)),
        api.updateDownloadSelection(secondScope, updateAfterBothReads(secondId)),
    ]);

    assert.deepEqual([...api.getDownloadSelection(firstScope)], [firstId]);
    assert.deepEqual([...api.getDownloadSelection(secondScope)], [secondId]);
    assert.deepEqual(new Set(lockManager.names), new Set([firstScope, secondScope]));
});

test('DOM mapping prefers unique native IDs, then exact displayed keys', () => {
    const {api, document} = loadApi();
    const first = tpk({machine_name: 'first', keyindex: 0, redeemed_key_val: steamKey(0)});
    const second = tpk({machine_name: 'second', keyindex: 1, redeemed_key_val: steamKey(1)});
    const nativeRows = [
        downloadRow(document, {machineName: 'second', keyindex: 1, key: steamKey(0)}),
        downloadRow(document, {machineName: 'first', keyindex: 0, key: steamKey(1)}),
    ];
    const nativeMap = api.mapDownloadOrderRows([first, second], nativeRows);
    assert.equal(nativeMap.pairs.find(pair => pair.row === nativeRows[0]).tpkd, second);
    assert.equal(nativeMap.pairs.find(pair => pair.row === nativeRows[1]).tpkd, first);

    const keyRows = [
        downloadRow(document, {title: 'Wrong B', key: steamKey(1), displayState: 'revealed'}),
        downloadRow(document, {title: 'Wrong A', key: steamKey(0), displayState: 'revealed'}),
    ];
    const keyMap = api.mapDownloadOrderRows([first, second], keyRows);
    assert.equal(keyMap.pairs.find(pair => pair.row === keyRows[0]).tpkd, second);
    assert.equal(keyMap.pairs.find(pair => pair.row === keyRows[1]).tpkd, first);

    const misleadingTitleProduct = tpk({
        human_name: 'The Gift',
        machine_name: 'the-gift',
    });
    const misleadingTitleRow = document.createElement('div');
    misleadingTitleRow.className = 'key-redeemer';
    misleadingTitleRow.textContent = 'The Gift Steam';
    addTextChild(document, misleadingTitleRow, 'human-name-title', 'The Gift');
    addTextChild(document, misleadingTitleRow, 'key-type', 'Steam');
    const misleadingTitleMap = api.mapDownloadOrderRows(
        [misleadingTitleProduct],
        [misleadingTitleRow]
    );
    assert.equal(misleadingTitleMap.pairs.length, 1);
    assert.equal(misleadingTitleMap.pairs[0].tpkd, misleadingTitleProduct);
});

test('equal duplicate DOM groups pair stably while count mismatches disable the whole group', () => {
    const {api, document} = loadApi();
    const products = [
        tpk({machine_name: 'duplicate-a', keyindex: 0}),
        tpk({machine_name: 'duplicate-b', keyindex: 1}),
    ];
    const rows = [downloadRow(document), downloadRow(document)];
    const stable = api.mapDownloadOrderRows(products, rows);
    assert.equal(stable.pairs[0].tpkd, products[0]);
    assert.equal(stable.pairs[0].row, rows[0]);
    assert.equal(stable.pairs[1].tpkd, products[1]);
    assert.equal(stable.pairs[1].row, rows[1]);

    const shortRows = [downloadRow(document)];
    const mismatch = api.mapDownloadOrderRows(products, shortRows);
    assert.equal(mismatch.pairs.length, 0);
    assert.deepEqual([...mismatch.disabledRows], shortRows);
    assert.equal(shortRows[0].classList.contains('hb-helper-download-mapping-disabled'), true);
    assert.equal(shortRows[0].querySelectorAll('.hb-helper-download-mapping-warning').length, 1);

    const sharedKey = steamKey(3);
    const ambiguousKeyProducts = [
        tpk({human_name: 'First Key Match', machine_name: 'key-a', redeemed_key_val: sharedKey}),
        tpk({human_name: 'Second Key Match', machine_name: 'key-b', keyindex: 1, redeemed_key_val: sharedKey}),
    ];
    const ambiguousKeyRow = downloadRow(document, {
        title: 'First Key Match',
        displayState: 'revealed',
        key: sharedKey,
    });
    const ambiguousKeyMap = api.mapDownloadOrderRows(
        ambiguousKeyProducts,
        [ambiguousKeyRow]
    );
    assert.equal(ambiguousKeyMap.pairs.length, 0);
    assert.equal(ambiguousKeyMap.disabledRows.has(ambiguousKeyRow), true);

    const nativeProduct = tpk({
        human_name: 'Native tuple product',
        machine_name: 'native-tuple',
        keyindex: 0,
    });
    const nativeRows = [
        downloadRow(document, {
            title: nativeProduct.human_name,
            machineName: nativeProduct.machine_name,
            keyindex: 0,
        }),
        downloadRow(document, {
            title: 'Different fallback title',
            machineName: nativeProduct.machine_name,
            keyindex: 0,
        }),
    ];
    const nativeMismatch = api.mapDownloadOrderRows([nativeProduct], nativeRows);
    assert.equal(nativeMismatch.pairs.length, 0);
    assert.deepEqual([...nativeMismatch.disabledRows], nativeRows);

    const duplicateNativeProducts = [
        nativeProduct,
        tpk({
            human_name: 'Second API tuple claimant',
            machine_name: nativeProduct.machine_name,
            keyindex: nativeProduct.keyindex,
        }),
    ];
    const singleNativeRow = downloadRow(document, {
        title: nativeProduct.human_name,
        machineName: nativeProduct.machine_name,
        keyindex: nativeProduct.keyindex,
    });
    const inverseNativeMismatch = api.mapDownloadOrderRows(
        duplicateNativeProducts,
        [singleNativeRow]
    );
    assert.equal(inverseNativeMismatch.pairs.length, 0);
    assert.equal(inverseNativeMismatch.disabledRows.has(singleNativeRow), true);

    const conflictingNativeRow = downloadRow(document, {
        title: nativeProduct.human_name,
        machineName: 'different-native-tuple',
        keyindex: nativeProduct.keyindex,
    });
    const conflictingNativeMap = api.mapDownloadOrderRows(
        [nativeProduct],
        [conflictingNativeRow]
    );
    assert.equal(conflictingNativeMap.pairs.length, 1);
    assert.equal(conflictingNativeMap.pairs[0].matchedBy, 'composite');

    const mixedMetadataProducts = [
        tpk({human_name: 'Tuple only in API', machine_name: 'api-tuple'}),
        tpk({
            human_name: 'Tuple only in DOM',
            machine_name: '',
            keyindex: 1,
        }),
    ];
    const mixedMetadataRows = [
        downloadRow(document, {title: mixedMetadataProducts[0].human_name}),
        downloadRow(document, {
            title: mixedMetadataProducts[1].human_name,
            machineName: 'dom-tuple',
            keyindex: 1,
        }),
    ];
    const mixedMetadataMap = api.mapDownloadOrderRows(
        mixedMetadataProducts,
        mixedMetadataRows
    );
    assert.equal(mixedMetadataMap.pairs.length, 2);
    assert.ok(mixedMetadataMap.pairs.every(pair => pair.matchedBy === 'composite'));
});

test('duplicate normalized download tuple IDs keep stable mapping but are quarantined from selection', async () => {
    const {api, document, orderSecret} = loadApi();
    const scope = await api.hashDownloadOrderKey(orderSecret);
    const products = [
        tpk({
            human_name: 'First duplicate tuple',
            machine_name: 'shared-tuple',
            keyindex: 0,
            exclusive_countries: ['CA'],
        }),
        tpk({
            human_name: 'Second duplicate tuple',
            machine_name: 'shared-tuple',
            keyindex: 0,
            exclusive_countries: ['MX'],
        }),
    ];
    const rows = products.map(product => downloadRow(document, {
        title: product.human_name,
    }));
    const mapping = api.mapDownloadOrderRows(products, rows);

    assert.equal(mapping.pairs.length, 2);
    assert.equal(mapping.pairs[0].tpkd, products[0]);
    assert.equal(mapping.pairs[0].row, rows[0]);
    assert.equal(mapping.pairs[1].tpkd, products[1]);
    assert.equal(mapping.pairs[1].row, rows[1]);
    assert.equal(
        api.getDownloadActivationItemId(scope, products[0]),
        api.getDownloadActivationItemId(scope, products[1])
    );
    assert.deepEqual([...mapping.disabledRows], rows);

    api.upsertDownloadRegionWarnings(mapping);
    assert.match(treeText(rows[0]), /CA/);
    assert.match(treeText(rows[1]), /MX/);

    const container = document.createElement('div');
    container.className = 'key-container wrapper';
    container.append(...rows);
    document.body.appendChild(container);
    api.setDownloadOrderStateForTest(
        scope,
        {gamekey: orderSecret, tpkd_dict: {all_tpks: products}},
        mapping
    );
    api.setSteamDerivedStateForTest({
        countryCode: 'CA',
        ownedApps: [],
        wishlistApps: [],
        sessionId: 'session',
    });
    api.mountDownloadActivationControlsForTest();
    api.setDownloadSelectionModeForTest(true);
    assert.ok(rows.every(row => row.getAttribute('role') !== 'button'));

    const duplicateId = api.getDownloadActivationItemId(scope, products[0]);
    await api.updateDownloadSelection(scope, selection => selection.add(duplicateId));
    let sessionSyncs = 0;
    let reveals = 0;
    const result = await api.startDownloadActivationForTest({
        directActivationOptions: {
            syncSession: async () => {
                sessionSyncs += 1;
                return {status: 'logged-out', account: null, error: null};
            },
            collectionOptions: {
                revealKey: async () => {
                    reveals += 1;
                    return steamKey(0);
                },
            },
        },
        reconcileBatch: async () => ({reconciled: true}),
    });
    assert.equal(result.noSelection, true);
    assert.equal(sessionSyncs, 0);
    assert.equal(reveals, 0);
    assert.equal(api.getChoiceActivationBatchForTest(), null);
});

test('composite mapping uses root key-redeemer state evidence without title inference', () => {
    const {api, document} = loadApi();
    const cases = [
        {
            product: tpk({human_name: 'Sold Product', machine_name: 'sold', sold_out: true}),
            decorate(row) { row.classList.add('sold-out'); },
        },
        {
            product: tpk({
                human_name: 'Expired Product',
                machine_name: 'expired',
                expiry_date: '2000-01-01T00:00:00',
            }),
            decorate(row) { row.dataset.status = 'expired'; },
        },
        {
            product: tpk({human_name: 'Gift Product', machine_name: 'gift', is_gift: true}),
            decorate(row) { row.setAttribute('data-redeem-state', 'gift'); },
        },
    ];

    for (const {product, decorate} of cases) {
        const row = document.createElement('div');
        row.className = 'key-redeemer';
        addTextChild(document, row, 'human-name-title', product.human_name);
        addTextChild(document, row, 'key-type', 'Steam');
        decorate(row);
        const mapping = api.mapDownloadOrderRows([product], [row]);
        assert.equal(mapping.pairs.length, 1);
        assert.equal(mapping.pairs[0].tpkd, product);
    }

    const titleOnlyProduct = tpk({
        human_name: 'A Gift In The Title',
        machine_name: 'title-only',
    });
    const titleOnlyRow = document.createElement('div');
    titleOnlyRow.className = 'key-redeemer';
    addTextChild(document, titleOnlyRow, 'human-name-title', titleOnlyProduct.human_name);
    addTextChild(document, titleOnlyRow, 'key-type', 'Steam');
    const titleOnlyMapping = api.mapDownloadOrderRows([titleOnlyProduct], [titleOnlyRow]);
    assert.equal(titleOnlyMapping.pairs.length, 1);
});

test('production-shaped hidden Steam rows map from heading and keyfield evidence', async () => {
    const {api, document, orderSecret} = loadApi();
    const products = [
        tpk({
            human_name: 'A Gift In The Game Title',
            machine_name: 'production-hidden-data-title',
            keyindex: 0,
        }),
        tpk({
            human_name: 'Production H4 Hidden Row',
            machine_name: 'production-hidden-h4',
            keyindex: 1,
        }),
    ];
    const firstRow = document.createElement('div');
    firstRow.className = 'key-redeemer';
    const firstHeading = document.createElement('div');
    firstHeading.className = 'heading-text';
    firstHeading.setAttribute('data-title', products[0].human_name);
    const misleadingH4 = document.createElement('h4');
    misleadingH4.textContent = 'Not the data-title value';
    firstHeading.appendChild(misleadingH4);
    const firstKeyfield = document.createElement('div');
    firstKeyfield.className = 'keyfield';
    firstKeyfield.setAttribute('title', 'Reveal your Steam key');
    firstRow.append(firstHeading, firstKeyfield);

    const secondRow = document.createElement('div');
    secondRow.className = 'key-redeemer';
    const secondHeading = document.createElement('div');
    secondHeading.className = 'heading-text';
    const secondH4 = document.createElement('h4');
    secondH4.textContent = products[1].human_name;
    secondHeading.appendChild(secondH4);
    const secondKeyfield = document.createElement('div');
    secondKeyfield.className = 'keyfield steam-key-redeemer';
    secondKeyfield.setAttribute('title', 'Reveal your key');
    secondRow.append(secondHeading, secondKeyfield);

    const rows = [firstRow, secondRow];
    const mapping = api.mapDownloadOrderRows(products, rows);
    assert.equal(mapping.pairs.length, 2);
    assert.equal(mapping.pairs[0].tpkd, products[0]);
    assert.equal(mapping.pairs[0].row, firstRow);
    assert.equal(mapping.pairs[1].tpkd, products[1]);
    assert.equal(mapping.pairs[1].row, secondRow);

    const scope = await api.hashDownloadOrderKey(orderSecret);
    const container = document.createElement('div');
    container.className = 'key-container wrapper';
    container.append(...rows);
    document.body.appendChild(container);
    api.setDownloadOrderStateForTest(
        scope,
        {gamekey: orderSecret, tpkd_dict: {all_tpks: products}},
        mapping
    );
    api.setSteamDerivedStateForTest({
        countryCode: 'CA',
        ownedApps: [],
        wishlistApps: [],
        sessionId: 'session',
    });
    api.mountDownloadActivationControlsForTest();
    api.setDownloadSelectionModeForTest(true);
    assert.ok(rows.every(row => row.getAttribute('role') === 'button'));
});

test('download activation falls back to machine name for a safe nonempty batch title', async () => {
    const {api, document, orderSecret} = loadApi();
    const scope = await api.hashDownloadOrderKey(orderSecret);
    const product = tpk({
        human_name: '',
        machine_name: 'machine-name-title-fallback',
    });
    const row = downloadRow(document, {
        title: product.machine_name,
        machineName: product.machine_name,
        keyindex: product.keyindex,
    });
    const container = document.createElement('div');
    container.className = 'key-container wrapper';
    container.appendChild(row);
    document.body.appendChild(container);
    api.setDownloadOrderStateForTest(
        scope,
        {gamekey: orderSecret, tpkd_dict: {all_tpks: [product]}},
        api.mapDownloadOrderRows([product], [row])
    );
    api.setSteamDerivedStateForTest({
        countryCode: 'CA',
        ownedApps: [],
        wishlistApps: [],
        sessionId: 'session',
    });
    api.mountDownloadActivationControlsForTest();
    const id = api.getDownloadActivationItemId(scope, product);
    await api.updateDownloadSelection(scope, selection => selection.add(id));
    let collectedItems;
    const result = await api.startDownloadActivationForTest({
        directActivationOptions: {
            syncSession: async () => ({
                status: 'authenticated',
                account: {
                    countryCode: 'CA',
                    ownedApps: [],
                    wishlistApps: [],
                    sessionId: 'session',
                },
                error: null,
            }),
            collectWork: async items => {
                collectedItems = items;
                return {started: true, pendingCount: 0};
            },
        },
        reconcileBatch: async () => ({reconciled: true}),
    });

    assert.equal(result.started, true);
    assert.equal(collectedItems.length, 1);
    assert.equal(collectedItems[0].title, product.machine_name);
});

test('an API-only mapping mismatch surfaces one overall warning', async () => {
    const {api, document, orderSecret} = loadApi();
    const scope = await api.hashDownloadOrderKey(orderSecret);
    const product = tpk({human_name: 'Missing DOM row', machine_name: 'missing-row'});
    const container = document.createElement('div');
    container.className = 'key-container wrapper';
    document.body.appendChild(container);
    api.setDownloadOrderStateForTest(
        scope,
        {gamekey: orderSecret, tpkd_dict: {all_tpks: [product]}},
        api.mapDownloadOrderRows([product], [])
    );

    api.refreshDownloadOrderPageForTest();
    api.refreshDownloadOrderPageForTest();

    const warnings = container.querySelectorAll(
        '.hb-helper-download-mapping-summary-warning'
    );
    assert.equal(warnings.length, 1);
    assert.equal(warnings[0].textContent.includes(product.human_name), false);

    container.appendChild(downloadRow(document, {
        machineName: product.machine_name,
        keyindex: product.keyindex,
    }));
    api.refreshDownloadOrderPageForTest();
    assert.equal(container.querySelector('.hb-helper-download-mapping-summary-warning'), null);
});

test('unified restriction panels reuse the canonical download map idempotently', () => {
    const {api, document} = loadApi();
    const product = tpk({exclusive_countries: ['CA'], disallowed_countries: []});
    const row = downloadRow(document, {machineName: product.machine_name, keyindex: 0});
    const mapping = api.mapDownloadOrderRows([product], [row]);

    api.upsertDownloadRegionWarnings(mapping);
    api.upsertDownloadRegionWarnings(mapping);

    const panels = row.querySelectorAll('.hb-helper-region-restrictions');
    assert.equal(panels.length, 1);
    assert.match(treeText(panels[0]), /CA/);
    assert.equal(row.querySelector('.hb-helper-download-region-warning'), null);
});

test('Downloads restrictions expose no legacy raw-order request or positional renderer', () => {
    const {api} = loadApi();

    assert.equal(api.getRegionLockInfoForTest, undefined);
    assert.equal(api.renderDownloadRegionRestrictionsForTest, undefined);
    assert.doesNotMatch(source, /function getRegionLockInfo\s*\(/);
    assert.doesNotMatch(source, /downloadRegionProducts/);
});

test('download restriction details do not toggle the mapped key selection', async () => {
    const {api, document, orderSecret} = loadApi();
    const scope = await api.hashDownloadOrderKey(orderSecret);
    const product = tpk({
        exclusive_countries: Array.from({length: 13}, (_, index) =>
            String.fromCharCode(65 + Math.floor(index / 26), 65 + index % 26)
        ),
        disallowed_countries: [],
    });
    const row = downloadRow(document, {
        machineName: product.machine_name,
        keyindex: product.keyindex,
    });
    const container = document.createElement('div');
    container.className = 'key-container wrapper';
    container.appendChild(row);
    document.body.appendChild(container);
    const mapping = api.mapDownloadOrderRows([product], [row]);
    api.setDownloadOrderStateForTest(
        scope,
        {gamekey: orderSecret, tpkd_dict: {all_tpks: [product]}},
        mapping
    );
    api.setSteamDerivedStateForTest({
        countryCode: 'CA',
        ownedApps: [],
        wishlistApps: [],
        sessionId: 'session',
    });
    api.mountDownloadActivationControlsForTest();
    api.setDownloadSelectionModeForTest(true);
    api.upsertDownloadRegionWarnings(mapping);
    const summary = row.querySelector('.hb-helper-region-restrictions summary');
    let prevented = false;

    const result = api.handleDownloadSelectionEventForTest({
        type: 'click',
        target: summary,
        preventDefault() { prevented = true; },
        stopPropagation() {},
        stopImmediatePropagation() {},
    });
    await result;

    assert.equal(prevented, false);
    assert.equal(api.getDownloadSelection(scope).size, 0);
});

test('revealed keys skip Humble POST and hidden keys require a successful valid response', async () => {
    const {api, orderSecret} = loadApi();
    let posts = 0;
    const revealed = await api.revealDownloadSteamKey(
        tpk({redeemed_key_val: steamKey(0), is_expired: true}),
        {
            orderKey: orderSecret,
            postReveal: async () => { posts += 1; },
        }
    );
    assert.equal(revealed, steamKey(0));
    assert.equal(posts, 0);

    const hidden = await api.revealDownloadSteamKey(tpk(), {
        orderKey: orderSecret,
        postReveal: async () => ({success: true, key: steamKey(1)}),
    });
    assert.equal(hidden, steamKey(1));

    await assert.rejects(
        api.revealDownloadSteamKey(tpk(), {
            orderKey: orderSecret,
            postReveal: async () => ({success: false, key: steamKey(2)}),
        }),
        error => !String(error).includes(orderSecret)
    );
});

test('a successful reveal without a key refetches once and reconciles only by native tuple', async () => {
    const {api, orderSecret} = loadApi();
    const hidden = tpk({machine_name: 'strict-machine', keyindex: 0});
    let refetches = 0;
    const key = await api.revealDownloadSteamKey(hidden, {
        orderKey: orderSecret,
        postReveal: async () => ({success: true}),
        reloadOrder: async () => {
            refetches += 1;
            return {
                gamekey: orderSecret,
                tpkd_dict: {all_tpks: [
                    tpk({machine_name: 'same-title-wrong-machine', keyindex: 0, redeemed_key_val: steamKey(0)}),
                    tpk({machine_name: 'strict-machine', keyindex: 0, redeemed_key_val: steamKey(1)}),
                ]},
            };
        },
    });
    assert.equal(key, steamKey(1));
    assert.equal(refetches, 1);

    await assert.rejects(api.revealDownloadSteamKey(hidden, {
        orderKey: orderSecret,
        postReveal: async () => ({success: true}),
        reloadOrder: async () => ({
            gamekey: orderSecret,
            tpkd_dict: {all_tpks: [
                tpk({machine_name: 'same-title-wrong-machine', keyindex: 0, redeemed_key_val: steamKey(2)}),
            ]},
        }),
    }));
});

test('the Humble reveal request is same-origin urlencoded and collection continues after item failure', async () => {
    const requests = [];
    const {api, orderSecret} = loadApi({
        onRequest(request) {
            requests.push(request);
            request.onload({status: 200, response: {success: true, key: steamKey(0)}});
        },
    });
    const product = tpk({machine_name: 'request-machine', keyindex: 0});
    const response = await api.postHumbleDownloadKey(product, orderSecret);
    assert.deepEqual(clone(response), {success: true, key: steamKey(0)});
    assert.equal(requests[0].url, 'https://www.humblebundle.com/humbler/redeemkey');
    assert.deepEqual(
        Object.fromEntries(new URLSearchParams(requests[0].data)),
        {keytype: 'request-machine', key: orderSecret, keyindex: '0'}
    );

    const batch = activationBatch([], {state: 'collecting', owner: 'collector'});
    let saves = 0;
    await api.collectSingleKeyActivationBatchForTest(
        batch,
        [{id: 'choice-failed', title: 'Failed'}, {id: 'choice-success', title: 'Success'}],
        async item => {
            if (item.id === 'choice-failed') throw new Error('generic Humble failure');
            return steamKey(1);
        },
        () => { saves += 1; return true; }
    );
    assert.equal(batch.items[0].status, 'humble-key-retrieval-failed');
    assert.equal(batch.items[1].status, 'pending-steam-activation');
    assert.ok(saves >= 2);
});

test('shared collection preserves canonical download IDs for single-key scopes', async () => {
    const {api, lockManager} = loadApi();
    const scope = await api.hashDownloadOrderKey(ephemeralOrderSecret());
    const product = tpk({machine_name: 'single-key-download'});
    const id = api.getDownloadActivationItemId(scope, product);

    const result = await api.runChoiceCollectionWorkForTest(
        [{id, title: 'Single-key download'}],
        {
            lockManager,
            revealKey: async () => steamKey(1),
        }
    );

    assert.equal(result.started, true);
    assert.equal(result.pendingCount, 1);
    assert.equal(result.batch.items.length, 1);
    assert.equal(result.batch.items[0].id, id);
    assert.equal(result.batch.items[0].key, steamKey(1));
});

test('Choice multi-key reveal stops sibling clicks when its route context changes', async () => {
    const {api, document} = loadApi({pathname: '/membership', search: ''});
    const titleText = 'Route-guarded multi-key Choice game';
    const tile = document.createElement('div');
    tile.className = 'choice-content js-open-choice-modal';
    addTextChild(document, tile, 'content-choice-title', titleText);
    document.body.appendChild(tile);

    const modal = document.createElement('div');
    modal.id = 'site-modal';
    modal.textContent = 'active modal';
    addTextChild(document, modal, 'human-name-title', titleText);
    const closeButton = document.createElement('button');
    closeButton.textContent = 'Close';
    closeButton.click = () => modal.remove();
    modal.appendChild(closeButton);

    let contextCurrent = true;
    let revealClicks = 0;
    for (let keyIndex = 0; keyIndex < 2; keyIndex += 1) {
        const row = document.createElement('div');
        row.className = 'key-redeemer';
        const reveal = document.createElement('button');
        reveal.className = 'js-keyfield keyfield enabled';
        reveal.click = () => {
            revealClicks += 1;
            row.classList.add('redeemed');
            const value = document.createElement('span');
            value.className = 'keyfield-value';
            const key = steamKey(keyIndex);
            if (keyIndex === 0) {
                Object.defineProperty(value, 'textContent', {
                    configurable: true,
                    get() {
                        contextCurrent = false;
                        return key;
                    },
                });
            } else {
                value.textContent = key;
            }
            row.appendChild(value);
        };
        row.appendChild(reveal);
        modal.appendChild(row);
    }
    tile.click = () => document.body.appendChild(modal);

    const outcomes = await api.revealChoiceSteamKeys(tile, {
        isContextCurrent: () => contextCurrent,
    });

    assert.equal(revealClicks, 1);
    assert.equal(outcomes.length, 2);
    assert.deepEqual(clone(outcomes[0]), {keyIndex: 0, key: steamKey(0)});
    assert.equal(outcomes[1].keyIndex, 1);
    assert.equal(outcomes[1].key, null);
    assert.equal(typeof outcomes[1].error, 'string');

    const selection = new Set(['choice-two-key-game']);
    const completed = activationBatch(outcomes.map(outcome => ({
        id: `hb-helper-key-v1:${outcome.keyIndex}:choice-two-key-game`,
        status: outcome.key ? 'activated' : 'humble-key-retrieval-failed',
    })));
    assert.equal(
        api.reconcileChoiceSelectionFromBatchForTest(completed, selection),
        false
    );
    assert.equal(selection.has('choice-two-key-game'), true);
});

test('a retry that goes stale before Choice row discovery preserves sibling completeness', async () => {
    const {api, document, lockManager} = loadApi({pathname: '/membership', search: ''});
    const gameId = 'choice-retry-two-key';
    const tile = document.createElement('div');
    tile.className = 'choice-content js-open-choice-modal';
    addTextChild(document, tile, 'content-choice-title', 'Retry route guard');
    document.body.appendChild(tile);

    api.setChoiceActivationBatchForTest(activationBatch([
        {
            id: `hb-helper-key-v1:0:${gameId}`,
            status: 'activated',
        },
        {
            id: `hb-helper-key-v1:1:${gameId}`,
            status: 'humble-key-retrieval-failed',
            error: 'previous sibling failure',
        },
    ], {id: 'previous-two-key-retry'}));

    let contextCurrent = true;
    tile.click = () => { contextCurrent = false; };
    const result = await api.runChoiceCollectionWorkForTest(
        [{id: gameId, title: 'Retry route guard', tile}],
        {
            lockManager,
            isContextCurrent: () => contextCurrent,
        }
    );

    assert.equal(result.started, true);
    assert.equal(result.stale, true);
    assert.deepEqual(clone(result.batch.items.map(item => [item.id, item.status])), [
        [`hb-helper-key-v1:0:${gameId}`, 'activated'],
        [`hb-helper-key-v1:1:${gameId}`, 'humble-key-retrieval-failed'],
    ]);
    const selection = new Set([gameId]);
    assert.equal(
        api.reconcileChoiceSelectionFromBatchForTest(result.batch, selection),
        false
    );
    assert.equal(selection.has(gameId), true);
});

test('Choice reconciliation rejects sparse composite groups but keeps legacy single-key behavior', () => {
    const {api} = loadApi({pathname: '/membership', search: ''});
    const cases = [
        {
            name: 'legacy success',
            ids: ['choice-reconcile-game'],
            cleared: true,
        },
        {
            name: 'sparse composite successes',
            ids: [
                'hb-helper-key-v1:0:choice-reconcile-game',
                'hb-helper-key-v1:2:choice-reconcile-game',
            ],
            cleared: false,
        },
        {
            name: 'contiguous composite successes',
            ids: [
                'hb-helper-key-v1:0:choice-reconcile-game',
                'hb-helper-key-v1:1:choice-reconcile-game',
            ],
            cleared: true,
        },
    ];

    for (const candidate of cases) {
        const selection = new Set(['choice-reconcile-game']);
        const batch = activationBatch(candidate.ids.map(id => ({
            id,
            status: 'activated',
        })));
        const changed = api.reconcileChoiceSelectionFromBatchForTest(batch, selection);
        assert.equal(changed, candidate.cleared, candidate.name);
        assert.equal(selection.has('choice-reconcile-game'), !candidate.cleared, candidate.name);
    }
});

test('direct activation preflights the whole selection before session sync or collection', async () => {
    const {api} = loadApi();
    const firstScope = await api.hashDownloadOrderKey(ephemeralOrderSecret());
    const secondScope = await api.hashDownloadOrderKey(ephemeralOrderSecret());
    const firstDownloadId = api.getDownloadActivationItemId(firstScope, tpk());
    const secondDownloadId = api.getDownloadActivationItemId(
        secondScope,
        tpk({machine_name: 'other-scope'})
    );
    const invalidSelections = [
        [],
        [{id: '', title: 'Missing ID'}],
        [{id: 'choice-empty-title', title: '   '}],
        [{id: 42, title: 'Non-string ID'}],
        [{id: 'choice-non-string-title', title: 42}],
        [
            {id: 'duplicate-choice', title: 'First'},
            {id: 'duplicate-choice', title: 'Second'},
        ],
        [{id: 'download:malformed', title: 'Malformed'}],
        [
            {id: 'choice-mixed', title: 'Choice'},
            {id: firstDownloadId, title: 'Download'},
        ],
        [
            {id: firstDownloadId, title: 'First order'},
            {id: secondDownloadId, title: 'Second order'},
        ],
    ];

    for (const selectedItems of invalidSelections) {
        let sessionSyncs = 0;
        let collections = 0;
        let activations = 0;
        const result = await api.runDirectChoiceActivation(selectedItems, {
            syncSession: async () => {
                sessionSyncs += 1;
                return {
                    status: 'authenticated',
                    account: {
                        countryCode: 'CA',
                        ownedApps: [],
                        wishlistApps: [],
                        sessionId: 'session',
                    },
                    error: null,
                };
            },
            collectWork: async () => {
                collections += 1;
                return {started: true, pendingCount: 1};
            },
            activationWork: async () => {
                activations += 1;
                return {processed: true};
            },
        });
        assert.equal(result.invalidSelection, true);
        assert.equal(sessionSyncs, 0);
        assert.equal(collections, 0);
        assert.equal(activations, 0);
    }
});

test('collection preflight preserves an old batch and reveals nothing for invalid selections', async () => {
    const invalidSelectionFactories = [
        () => [],
        () => [{id: '', title: 'Missing ID'}],
        () => [{id: 'choice-empty-title', title: ''}],
        () => [
            {id: 'duplicate-choice', title: 'First'},
            {id: 'duplicate-choice', title: 'Second'},
        ],
        api => [{id: api.getDownloadActivationItemId('a'.repeat(64), tpk()), title: ''}],
        () => [
            {id: 'choice-mixed', title: 'Choice'},
            {id: `download:${'a'.repeat(64)}:machine:0`, title: 'Download'},
        ],
    ];

    for (const makeSelection of invalidSelectionFactories) {
        const {api, lockManager} = loadApi();
        const oldBatch = activationBatch([{
            id: 'old-choice',
            title: 'Old Choice',
            status: 'steam-activation-failed',
            key: steamKey(8),
            error: 'old failure',
        }], {id: 'old-preflight-batch'});
        api.setChoiceActivationBatchForTest(oldBatch);
        let reveals = 0;
        const result = await api.runChoiceCollectionWorkForTest(
            makeSelection(api),
            {
                lockManager,
                revealKey: async () => {
                    reveals += 1;
                    return steamKey(0);
                },
            }
        );

        assert.equal(result.invalidSelection, true);
        assert.equal(reveals, 0);
        assert.deepEqual(clone(api.getChoiceActivationBatchForTest()), oldBatch);
    }
});

test('collection reveals only its validated snapshot when the caller mutates candidates while queued', async () => {
    let releaseCollectionLock;
    let collectionLockRequested;
    const requested = new Promise(resolve => { collectionLockRequested = resolve; });
    const gate = new Promise(resolve => { releaseCollectionLock = resolve; });
    const lockManager = {
        async request(name, options, callback) {
            collectionLockRequested();
            await gate;
            return callback({name});
        },
    };
    const {api} = loadApi({lockManager});
    const selectedItems = [{id: 'choice-snapshot', title: 'Snapshot title'}];
    const revealed = [];
    const collection = api.runChoiceCollectionWorkForTest(selectedItems, {
        lockManager,
        revealKey: async item => {
            revealed.push({id: item.id, title: item.title});
            return steamKey(0);
        },
    });

    await requested;
    selectedItems[0].id = '';
    selectedItems[0].title = '';
    selectedItems.push({id: 'choice-snapshot', title: 'Duplicate mutation'});
    releaseCollectionLock();
    const result = await collection;
    const stored = api.getChoiceActivationBatchForTest();

    assert.equal(result.started, true);
    assert.deepEqual(revealed, [{id: 'choice-snapshot', title: 'Snapshot title'}]);
    assert.equal(stored.items.length, 1);
    assert.equal(stored.items[0].id, 'choice-snapshot');
    assert.equal(stored.items[0].title, 'Snapshot title');
});

test('a foreign collecting batch installed during forced sync is preserved and blocks reveal', async () => {
    const {api, lockManager} = loadApi();
    let releaseSync;
    let syncStarted;
    const started = new Promise(resolve => { syncStarted = resolve; });
    const syncGate = new Promise(resolve => { releaseSync = resolve; });
    let reveals = 0;
    let activations = 0;
    const activation = api.runDirectChoiceActivation(
        [{id: 'choice-after-sync', title: 'Choice after sync'}],
        {
            syncSession: async () => {
                syncStarted();
                await syncGate;
                return {
                    status: 'authenticated',
                    account: {
                        countryCode: 'CA',
                        ownedApps: [],
                        wishlistApps: [],
                        sessionId: 'session',
                    },
                    error: null,
                };
            },
            collectionOptions: {
                lockManager,
                revealKey: async () => {
                    reveals += 1;
                    return steamKey(0);
                },
            },
            activationWork: async () => {
                activations += 1;
                return {processed: true};
            },
        }
    );
    await started;
    const foreignBatch = activationBatch([], {
        id: 'foreign-sync-collecting-batch',
        state: 'collecting',
        owner: 'foreign-sync-owner',
    });
    api.setChoiceActivationBatchForTest(foreignBatch);
    releaseSync();

    const result = await activation;
    assert.equal(result.busy, true);
    assert.equal(reveals, 0);
    assert.equal(activations, 0);
    assert.deepEqual(clone(api.getChoiceActivationBatchForTest()), foreignBatch);
    api.setChoiceActivationBatchForTest(null);
});

test('direct activation aborts after forced session sync when its initiating context changed', async () => {
    const {api} = loadApi();
    let contextCurrent = true;
    let releaseSync;
    let syncStarted;
    const started = new Promise(resolve => { syncStarted = resolve; });
    const syncGate = new Promise(resolve => { releaseSync = resolve; });
    let collections = 0;
    let activations = 0;
    const activation = api.runDirectChoiceActivation(
        [{id: 'choice-pending-sync', title: 'Pending sync title'}],
        {
            isContextCurrent: () => contextCurrent,
            syncSession: async () => {
                syncStarted();
                await syncGate;
                return {
                    status: 'authenticated',
                    account: {
                        countryCode: 'CA',
                        ownedApps: [],
                        wishlistApps: [],
                        sessionId: 'session',
                    },
                    error: null,
                };
            },
            collectWork: async () => {
                collections += 1;
                return {started: true, pendingCount: 1};
            },
            activationWork: async () => {
                activations += 1;
                return {processed: true};
            },
        }
    );

    await started;
    contextCurrent = false;
    releaseSync();
    const result = await activation;
    assert.equal(result.stale, true);
    assert.equal(collections, 0);
    assert.equal(activations, 0);
});

test('collection stops before the next reveal when context changes during a durable reveal', async () => {
    const {api, lockManager} = loadApi();
    let contextCurrent = true;
    let releaseFirstReveal;
    let firstRevealStarted;
    const started = new Promise(resolve => { firstRevealStarted = resolve; });
    const revealGate = new Promise(resolve => { releaseFirstReveal = resolve; });
    let reveals = 0;
    const collection = api.runChoiceCollectionWorkForTest([
        {id: 'choice-first', title: 'First pending reveal'},
        {id: 'choice-second', title: 'Second must not reveal'},
    ], {
        lockManager,
        isContextCurrent: () => contextCurrent,
        revealKey: async () => {
            reveals += 1;
            if (reveals === 1) {
                firstRevealStarted();
                await revealGate;
            }
            return steamKey(reveals);
        },
    });

    await started;
    contextCurrent = false;
    releaseFirstReveal();
    const result = await collection;
    const stored = api.getChoiceActivationBatchForTest();
    assert.equal(result.stale, true);
    assert.equal(reveals, 1);
    assert.equal(stored.items.length, 1);
    assert.equal(stored.items[0].id, 'choice-first');
});

test('collection rechecks context after old-batch selection reconciliation before replacement', async () => {
    const gmBus = createGmBus();
    let scope;
    let invalidateAfterSelectionLock = false;
    let contextCurrent = true;
    const lockManager = createQueuedLockManager({
        beforeRelease: async name => {
            if (invalidateAfterSelectionLock && name === scope) contextCurrent = false;
        },
    });
    const {api} = loadApi({gmBus, lockManager});
    scope = await api.hashDownloadOrderKey(ephemeralOrderSecret());
    const oldSuccessId = api.getDownloadActivationItemId(scope, tpk());
    await api.updateDownloadSelection(scope, selection => selection.add(oldSuccessId));
    const oldBatch = activationBatch([{
        id: oldSuccessId,
        title: 'Old reconciled success',
        status: 'activated',
    }], {id: 'old-context-recheck-batch'});
    api.setChoiceActivationBatchForTest(oldBatch);
    invalidateAfterSelectionLock = true;
    let reveals = 0;

    const result = await api.runChoiceCollectionWorkForTest(
        [{id: 'new-choice-after-reconcile', title: 'New Choice'}],
        {
            lockManager,
            isContextCurrent: () => contextCurrent,
            revealKey: async () => {
                reveals += 1;
                return steamKey(0);
            },
        }
    );

    assert.equal(result.stale, true);
    assert.equal(reveals, 0);
    assert.deepEqual(clone(api.getChoiceActivationBatchForTest()), oldBatch);
});

test('pending download session sync cannot replace a batch or collect after real A-to-B navigation', async () => {
    const fixture = await setupPendingDownloadRoute();
    const {api, authenticated, firstIds, firstProducts, navigateToSecondOrder} = fixture;
    const oldBatch = activationBatch([{
        id: firstIds[0],
        title: 'Old order A private failure',
        key: steamKey(7),
        status: 'steam-activation-failed',
        error: 'old order A private error',
    }], {id: 'old-pending-sync-batch'});
    api.setChoiceActivationBatchForTest(oldBatch);
    let releaseSync;
    let syncStarted;
    const started = new Promise(resolve => { syncStarted = resolve; });
    const syncGate = new Promise(resolve => { releaseSync = resolve; });
    let collections = 0;
    let activations = 0;
    const activation = api.startDownloadActivationForTest({
        directActivationOptions: {
            syncSession: async () => {
                syncStarted();
                await syncGate;
                return authenticated;
            },
            collectWork: async () => {
                collections += 1;
                return {started: true, pendingCount: 1};
            },
            activationWork: async () => {
                activations += 1;
                return {processed: true};
            },
        },
        reconcileBatch: async () => ({reconciled: true}),
    });

    await started;
    const secondControls = await navigateToSecondOrder();
    releaseSync();
    const result = await activation;
    const secondText = treeText(secondControls);
    assert.equal(result.stale, true);
    assert.equal(collections, 0);
    assert.equal(activations, 0);
    assert.deepEqual(clone(api.getChoiceActivationBatchForTest()), oldBatch);
    assert.ok(firstProducts.every(product => !secondText.includes(product.human_name)));
    assert.equal(secondText.includes('Old order A private failure'), false);
    assert.equal(secondText.includes(steamKey(7)), false);
    assert.equal(secondText.includes('old order A private error'), false);
});

test('pending durable download reveal stops at one and cannot leak progress onto order B', async () => {
    const fixture = await setupPendingDownloadRoute();
    const {
        api,
        authenticated,
        firstProducts,
        firstScope,
        navigateToSecondOrder,
    } = fixture;
    let releaseReveal;
    let revealStarted;
    const started = new Promise(resolve => { revealStarted = resolve; });
    const revealGate = new Promise(resolve => { releaseReveal = resolve; });
    let reveals = 0;
    let activationProgressCalls = 0;
    let firstItem;
    const activation = api.startDownloadActivationForTest({
        directActivationOptions: {
            syncSession: async () => authenticated,
            collectionOptions: {
                revealKey: async item => {
                    reveals += 1;
                    firstItem ||= item;
                    if (reveals === 1) {
                        revealStarted();
                        await revealGate;
                    }
                    return steamKey(reveals);
                },
            },
            activationWork: async options => {
                activationProgressCalls += 1;
                options.showProgress(firstItem, 0, 1);
                return {processed: true};
            },
        },
        reconcileBatch: async () => ({reconciled: true}),
    });

    await started;
    const secondControls = await navigateToSecondOrder();
    const busyText = treeText(secondControls);
    assert.match(busyText, /Another Humble key activation batch/);
    assert.ok(firstProducts.every(product => !busyText.includes(product.human_name)));
    releaseReveal();
    const result = await activation;
    const stored = api.getChoiceActivationBatchForTest();
    const secondText = treeText(secondControls);
    assert.equal(result.stale, true);
    assert.equal(reveals, 1);
    assert.equal(activationProgressCalls, 1);
    assert.equal(stored.items.length, 1);
    assert.equal(api.inferActivationBatchScope(stored).scope, firstScope);
    assert.ok(firstProducts.every(product => !secondText.includes(product.human_name)));
    assert.equal(secondText.includes(steamKey(1)), false);
    assert.match(secondText, /Another Humble key activation batch/);
});

test('stale download failure, collection, Steam, and final callbacks leave order B status unchanged', async () => {
    const fixture = await setupPendingDownloadRoute();
    const {
        api,
        authenticated,
        document,
        firstProducts,
        firstIds,
        navigateToSecondOrder,
    } = fixture;
    let releaseReveal;
    let revealStarted;
    const started = new Promise(resolve => { revealStarted = resolve; });
    const revealGate = new Promise(resolve => { releaseReveal = resolve; });
    let reveals = 0;
    const observedStatuses = [];
    const durableBatch = activationBatch([], {
        id: 'stale-callback-durable-batch',
        state: 'collecting',
        owner: 'stale-callback-owner',
    });
    const activation = api.startDownloadActivationForTest({
        directActivationOptions: {
            syncSession: async () => authenticated,
            collectionOptions: {
                revealKey: async () => {
                    reveals += 1;
                    revealStarted();
                    await revealGate;
                    throw new Error('old order private reveal failure');
                },
            },
            collectWork: async (items, options) => {
                api.setChoiceActivationBatchForTest(durableBatch);
                options.onBatchStarted(durableBatch);
                try {
                    await options.revealKey(items[0]);
                } catch (error) {
                    observedStatuses.push(treeText(document.getElementById(
                        'hb-helper-choice-activation-controls'
                    )));
                }
                options.onProgress(items[0]);
                observedStatuses.push(treeText(document.getElementById(
                    'hb-helper-choice-activation-controls'
                )));
                return {started: true, pendingCount: 1, batch: durableBatch};
            },
            activationWork: async options => {
                options.showProgress({
                    id: firstIds[0],
                    title: firstProducts[0].human_name,
                }, 0, 1);
                observedStatuses.push(treeText(document.getElementById(
                    'hb-helper-choice-activation-controls'
                )));
                return {processed: true};
            },
        },
        reconcileBatch: async () => ({reconciled: true}),
    });

    await started;
    const secondControls = await navigateToSecondOrder();
    const expectedBusyText = treeText(secondControls);
    releaseReveal();
    const result = await activation;
    observedStatuses.push(treeText(secondControls));
    api.setChoiceActivationBatchForTest(null);

    assert.equal(result.processed, true);
    assert.equal(reveals, 1);
    assert.ok(observedStatuses.every(status => status === expectedBusyText));
    assert.ok(observedStatuses.every(status =>
        firstProducts.every(product => !status.includes(product.human_name))
    ));
    assert.ok(observedStatuses.every(status =>
        !status.includes('old order private reveal failure')
    ));
});

test('pending Choice sync preserves its initiating controls and leaks no title after downloads navigation', async () => {
    const gmBus = createGmBus({
        'hb-helper-choice-selected-games-v1': ['id:pending-choice-route'],
    });
    let pendingRequest;
    let requestStarted;
    const started = new Promise(resolve => { requestStarted = resolve; });
    const loaded = loadApi({
        pathname: '/membership',
        search: '',
        gmBus,
        onRequest(request) {
            pendingRequest = request;
            requestStarted();
        },
    });
    const {api, context, document} = loaded;
    const privateChoiceTitle = 'Pending Choice private route title';
    const heading = document.createElement('h2');
    heading.textContent = 'YOUR GAMES';
    const tile = document.createElement('div');
    tile.className = 'choice-content js-open-choice-modal';
    tile.dataset.id = 'pending-choice-route';
    addTextChild(document, tile, 'content-choice-title', privateChoiceTitle);
    document.body.append(heading, tile);

    const downloadSecret = ephemeralOrderSecret();
    const downloadProduct = tpk({
        human_name: 'Choice navigation destination',
        machine_name: 'choice-navigation-destination',
    });
    const downloadRowElement = downloadRow(document, {
        title: downloadProduct.human_name,
        machineName: downloadProduct.machine_name,
        keyindex: downloadProduct.keyindex,
    });
    const downloadContainer = document.createElement('div');
    downloadContainer.className = 'key-container wrapper';
    downloadContainer.appendChild(downloadRowElement);
    document.body.appendChild(downloadContainer);
    const authenticated = {
        status: 'authenticated',
        account: {
            countryCode: 'CA',
            ownedApps: [],
            wishlistApps: [],
            sessionId: 'session',
        },
        error: null,
    };
    api.setSteamDerivedStateForTest(authenticated.account);
    api.installHelperRouteLifecycleForTest({
        loadOrder: async key => ({
            gamekey: key,
            tpkd_dict: {all_tpks: [downloadProduct]},
        }),
        syncSession: async () => authenticated,
        reconcileBatch: async () => ({reconciled: true}),
        recoverCollection: async () => ({recovered: false}),
    });
    await api.waitForHelperRouteForTest();
    const initiatingControls = document.getElementById(
        'hb-helper-choice-activation-controls'
    );
    assert.ok(initiatingControls);

    const activation = api.startChoiceActivationForTest();
    await started;
    const controlsPreservedDuringSync = document.getElementById(
        'hb-helper-choice-activation-controls'
    ) === initiatingControls;
    context.history.pushState(
        {},
        '',
        `/downloads?key=${encodeURIComponent(downloadSecret)}`
    );
    await api.waitForHelperRouteForTest();
    pendingRequest.onload({status: 200, response: '', responseText: ''});
    const result = await activation;
    const downloadsControls = document.getElementById(
        'hb-helper-choice-activation-controls'
    );

    assert.equal(controlsPreservedDuringSync, true);
    assert.equal(result.stale, true);
    assert.equal(api.getChoiceActivationBatchForTest(), null);
    assert.equal(treeText(downloadsControls).includes(privateChoiceTitle), false);
});

test('batch scope is inferred only from IDs and foreign results are generic while active', async () => {
    const {api} = loadApi();
    const firstScope = await api.hashDownloadOrderKey(ephemeralOrderSecret());
    const secondScope = await api.hashDownloadOrderKey(ephemeralOrderSecret());
    const firstId = api.getDownloadActivationItemId(firstScope, tpk());
    const secondId = api.getDownloadActivationItemId(secondScope, tpk());
    const download = activationBatch([{id: firstId}]);
    assert.deepEqual(clone(api.inferActivationBatchScope(download)), {
        kind: 'download',
        scope: firstScope,
    });
    assert.deepEqual(clone(api.inferActivationBatchScope(activationBatch([{id: 'choice-id'}]))), {
        kind: 'choice',
    });
    assert.equal(api.inferActivationBatchScope(activationBatch([{id: firstId}, {id: 'choice-id'}])), null);
    assert.equal(api.inferActivationBatchScope(activationBatch([{id: firstId}, {id: secondId}])), null);
    assert.equal(api.inferActivationBatchScope(activationBatch([{id: 'download:malformed'}])), null);
    api.setChoiceActivationBatchForTest(activationBatch(
        [{id: firstId}, {id: 'choice-id'}],
        {state: 'activating', owner: 'invalid'}
    ));
    assert.equal(api.getChoiceActivationBatchForTest(), null);

    const secretTitle = 'Foreign private title';
    const secretKey = steamKey(4);
    const activeForeign = activationBatch([{
        id: firstId,
        title: secretTitle,
        key: secretKey,
        status: 'steam-activation-failed',
        error: 'private failure',
        code: 9,
    }], {state: 'activating', owner: 'foreign'});
    const presentation = api.getActivationBatchPresentation(activeForeign, {
        kind: 'download',
        scope: secondScope,
    });
    assert.equal(presentation.kind, 'busy');
    assert.equal(JSON.stringify(presentation).includes(secretTitle), false);
    assert.equal(JSON.stringify(presentation).includes(secretKey), false);
    assert.equal(JSON.stringify(presentation).includes('private failure'), false);

    const emptyCollecting = activationBatch([], {state: 'collecting', owner: 'foreign'});
    assert.equal(api.getActivationBatchPresentation(emptyCollecting, {kind: 'choice'}).kind, 'busy');
});

test('successful selection reconciliation clears only successes and is idempotent for both scopes', async () => {
    const gmBus = createGmBus();
    const lockManager = createQueuedLockManager();
    const {api} = loadApi({gmBus, lockManager});
    const scope = await api.hashDownloadOrderKey(ephemeralOrderSecret());
    const successId = api.getDownloadActivationItemId(scope, tpk({machine_name: 'success'}));
    const failureId = api.getDownloadActivationItemId(scope, tpk({machine_name: 'failure'}));
    await api.updateDownloadSelection(scope, selection => {
        selection.add(successId);
        selection.add(failureId);
    });
    const batch = activationBatch([
        {id: successId, status: 'activated'},
        {id: failureId, status: 'steam-activation-failed', key: steamKey(0), error: 'failed'},
    ]);

    assert.equal((await api.reconcileActivationSelectionStorageFromBatch(batch)).reconciled, true);
    assert.deepEqual([...api.getDownloadSelection(scope)], [failureId]);
    assert.equal((await api.reconcileActivationSelectionStorageFromBatch(batch)).reconciled, true);
    assert.deepEqual([...api.getDownloadSelection(scope)], [failureId]);

    gmBus.values.set('hb-helper-choice-selected-games-v1', ['choice-success', 'choice-failure']);
    const choiceBatch = activationBatch([
        {id: 'hb-helper-key-v1:0:choice-success', status: 'activated'},
        {
            id: 'hb-helper-key-v1:0:choice-failure',
            status: 'steam-activation-failed',
            key: steamKey(1),
            error: 'failed',
        },
    ]);
    await api.reconcileActivationSelectionStorageFromBatch(choiceBatch);
    assert.deepEqual(gmBus.values.get('hb-helper-choice-selected-games-v1'), ['choice-failure']);
});

test('a newer batch installed during old selection reconciliation is never overwritten', async () => {
    const gmBus = createGmBus();
    let api;
    let scope;
    let replacement;
    const lockManager = createQueuedLockManager({
        beforeRelease: async name => {
            if (name === scope) api.setChoiceActivationBatchForTest(replacement);
        },
    });
    ({api} = loadApi({gmBus, lockManager}));
    scope = await api.hashDownloadOrderKey(ephemeralOrderSecret());
    const successId = api.getDownloadActivationItemId(scope, tpk());
    await api.updateDownloadSelection(scope, selection => selection.add(successId));
    const oldBatch = activationBatch([{id: successId, status: 'activated'}], {id: 'old-batch'});
    replacement = activationBatch([{
        id: 'replacement-choice',
        status: 'pending-steam-activation',
        key: steamKey(0),
    }], {id: 'replacement-batch', state: 'activating', owner: 'replacement'});
    api.setChoiceActivationBatchForTest(oldBatch);

    const result = await api.runChoiceCollectionWorkForTest(
        [{id: 'new-choice', title: 'New Choice'}],
        {lockManager, revealKey: async () => steamKey(1)}
    );

    assert.equal(result.started, false);
    assert.equal(result.stopped, true);
    assert.deepEqual(clone(api.getChoiceActivationBatchForTest()), replacement);
});

test('late reconciliation of an old batch cannot render its private details over a replacement', async () => {
    const gmBus = createGmBus();
    let api;
    let scope;
    let replacement;
    let replaced = false;
    const lockManager = createQueuedLockManager({
        beforeRelease: async name => {
            if (name === scope && !replaced) {
                replaced = true;
                api.setChoiceActivationBatchForTest(replacement);
            }
        },
    });
    const loaded = loadApi({gmBus, lockManager});
    api = loaded.api;
    scope = await api.hashDownloadOrderKey(loaded.orderSecret);
    const foreignScope = await api.hashDownloadOrderKey(ephemeralOrderSecret());
    const product = tpk();
    const successId = api.getDownloadActivationItemId(scope, product);
    const failedId = api.getDownloadActivationItemId(
        scope,
        tpk({machine_name: 'old-failed', keyindex: 1})
    );
    const selectionKey = api.getDownloadSelectionStorageKeyForTest(scope);
    gmBus.values.set(selectionKey, {[scope]: [successId]});
    const oldPrivateTitle = 'Old private failure';
    const oldPrivateKey = steamKey(7);
    const oldBatch = activationBatch([
        {id: successId, status: 'activated'},
        {
            id: failedId,
            title: oldPrivateTitle,
            key: oldPrivateKey,
            status: 'steam-activation-failed',
            error: 'old private error',
        },
    ], {id: 'old-render-batch'});
    replacement = activationBatch([{
        id: api.getDownloadActivationItemId(foreignScope, product),
        title: 'Replacement private title',
        key: steamKey(8),
        status: 'steam-activation-failed',
        error: 'replacement private error',
    }], {id: 'replacement-render-batch', state: 'activating', owner: 'replacement'});

    const row = downloadRow(loaded.document, {
        machineName: product.machine_name,
        keyindex: product.keyindex,
    });
    const container = loaded.document.createElement('div');
    container.className = 'key-container wrapper';
    container.appendChild(row);
    loaded.document.body.appendChild(container);
    api.setDownloadOrderStateForTest(
        scope,
        {gamekey: loaded.orderSecret, tpkd_dict: {all_tpks: [product]}},
        api.mapDownloadOrderRows([product], [row])
    );
    api.setSteamDerivedStateForTest({
        countryCode: 'CA',
        ownedApps: [],
        wishlistApps: [],
        sessionId: 'session',
    });
    const controls = api.mountDownloadActivationControlsForTest();
    api.setChoiceActivationBatchForTest(oldBatch);

    await api.reconcileChoiceActivationBatch(oldBatch);

    const helperText = treeText(controls);
    assert.deepEqual(clone(api.getChoiceActivationBatchForTest()), replacement);
    assert.equal(helperText.includes(oldPrivateTitle), false);
    assert.equal(helperText.includes(oldPrivateKey), false);
    assert.match(helperText, /Another Humble key activation batch/);
});

test('a failed download-selection persistence check preserves the old batch', async () => {
    const gmBus = createGmBus();
    const lockManager = createQueuedLockManager();
    const {api} = loadApi({gmBus, lockManager});
    const scope = await api.hashDownloadOrderKey(ephemeralOrderSecret());
    const successId = api.getDownloadActivationItemId(scope, tpk());
    const selectionKey = api.getDownloadSelectionStorageKeyForTest(scope);
    gmBus.values.set(selectionKey, {[scope]: [successId]});
    const oldBatch = activationBatch([{id: successId, status: 'activated'}], {
        id: 'old-persistence-batch',
    });
    api.setChoiceActivationBatchForTest(oldBatch);
    gmBus.ignoredWrites.add(selectionKey);

    const result = await api.runChoiceCollectionWorkForTest(
        [{id: 'new-choice', title: 'New Choice'}],
        {lockManager, revealKey: async () => steamKey(1)}
    );

    assert.equal(result.started, false);
    assert.equal(result.reconciliationFailed, true);
    assert.deepEqual(clone(api.getChoiceActivationBatchForTest()), oldBatch);
});

test('a failed Choice-selection persistence check also preserves the old batch', async () => {
    const gmBus = createGmBus({
        'hb-helper-choice-selected-games-v1': ['old-choice-success'],
    });
    const lockManager = createQueuedLockManager();
    const {api} = loadApi({gmBus, lockManager});
    const oldBatch = activationBatch([{
        id: 'hb-helper-key-v1:0:old-choice-success',
        status: 'activated',
    }], {id: 'old-choice-persistence-batch'});
    api.setChoiceActivationBatchForTest(oldBatch);
    gmBus.ignoredWrites.add('hb-helper-choice-selected-games-v1');

    const result = await api.runChoiceCollectionWorkForTest(
        [{id: 'new-choice', title: 'New Choice'}],
        {lockManager, revealKey: async () => steamKey(1)}
    );

    assert.equal(result.started, false);
    assert.equal(result.reconciliationFailed, true);
    assert.deepEqual(clone(api.getChoiceActivationBatchForTest()), oldBatch);
});

test('downloads use a white modifier and mount above keys without changing Choice dark styling', () => {
    const {api, document} = loadApi();
    const container = document.createElement('div');
    container.className = 'key-container wrapper';
    const nativeContent = document.createElement('div');
    container.appendChild(nativeContent);
    document.body.appendChild(container);

    const controls = api.mountDownloadActivationControlsForTest();
    assert.equal(container.firstElementChild, controls);
    assert.equal(controls.classList.contains('hb-helper-downloads-controls'), true);
    const css = api.getStyleTextForTest();
    assert.match(css, /#hb-helper-choice-activation-controls\s*\{[\s\S]*background:\s*rgba\(0, 0, 0, 0\.5\)/);
    assert.match(css, /\.hb-helper-downloads-controls[\s\S]*#fff/);
    for (const color of ['#1f2328', '#d0d7de', '#f6f8fa']) assert.ok(css.includes(color));
});

test('live downloads controls gate interaction, restore native rows, and select only non-owned games', async () => {
    const {api, document, orderSecret} = loadApi();
    const scope = await api.hashDownloadOrderKey(orderSecret);
    const owned = tpk({machine_name: 'owned-game', steam_app_id: 101});
    const unknown = tpk({machine_name: 'unknown-game', keyindex: 1});
    const blocked = tpk({machine_name: 'blocked-game', keyindex: 2, is_gift: true});
    const ownedRow = downloadRow(document, {machineName: 'owned-game', keyindex: 0});
    const unknownRow = downloadRow(document, {machineName: 'unknown-game', keyindex: 1});
    const blockedRow = downloadRow(document, {machineName: 'blocked-game', keyindex: 2});
    ownedRow.setAttribute('tabindex', '7');
    ownedRow.setAttribute('role', 'link');
    const container = document.createElement('div');
    container.className = 'key-container wrapper';
    container.append(ownedRow, unknownRow, blockedRow);
    document.body.appendChild(container);
    const mapping = api.mapDownloadOrderRows(
        [owned, unknown, blocked],
        [ownedRow, unknownRow, blockedRow]
    );
    api.setDownloadOrderStateForTest(scope, {
        gamekey: orderSecret,
        tpkd_dict: {all_tpks: [owned, unknown, blocked]},
    }, mapping);

    const controls = api.mountDownloadActivationControlsForTest();
    api.renderDownloadSelectionStateForTest();
    assert.equal(controls.querySelector('.hb-helper-downloads-login'), null);

    api.setSteamDerivedStateForTest({
        countryCode: 'CA',
        ownedApps: [101],
        wishlistApps: [],
        sessionId: 'session',
    });
    api.renderDownloadSelectionStateForTest();
    assert.equal(controls.querySelector('.hb-helper-downloads-login'), null);
    api.setDownloadSelectionModeForTest(true);
    assert.equal(ownedRow.getAttribute('tabindex'), '0');
    assert.equal(ownedRow.getAttribute('role'), 'button');
    assert.equal(blockedRow.hasAttribute('tabindex'), false);

    let prevented = 0;
    await api.handleDownloadSelectionEventForTest({
        type: 'keydown',
        key: 'Enter',
        target: unknownRow,
        preventDefault() { prevented += 1; },
        stopPropagation() {},
        stopImmediatePropagation() {},
    });
    const unknownId = api.getDownloadActivationItemId(scope, unknown);
    assert.deepEqual([...api.getDownloadSelection(scope)], [unknownId]);
    assert.equal(prevented, 1);

    await api.selectUnownedDownloadRowsForTest({
        isOwned: async pair => pair.tpkd === owned,
    });
    assert.deepEqual([...api.getDownloadSelection(scope)], [unknownId]);

    api.setDownloadSelectionModeForTest(false);
    assert.equal(ownedRow.getAttribute('tabindex'), '7');
    assert.equal(ownedRow.getAttribute('role'), 'link');
    assert.equal(unknownRow.hasAttribute('tabindex'), false);
    assert.equal(unknownRow.hasAttribute('role'), false);
});

test('retained Downloads synchronization preserves UI and keeps local selection usable', async () => {
    const {api, document, orderSecret} = loadApi();
    const scope = await api.hashDownloadOrderKey(orderSecret);
    const first = tpk({human_name: 'First game', machine_name: 'first-game'});
    const second = tpk({
        human_name: 'Second game',
        machine_name: 'second-game',
        keyindex: 1,
    });
    const firstRow = downloadRow(document, {
        title: first.human_name,
        machineName: first.machine_name,
        keyindex: first.keyindex,
    });
    const secondRow = downloadRow(document, {
        title: second.human_name,
        machineName: second.machine_name,
        keyindex: second.keyindex,
    });
    const container = document.createElement('div');
    container.className = 'key-container wrapper';
    container.append(firstRow, secondRow);
    document.body.appendChild(container);
    api.setDownloadOrderStateForTest(
        scope,
        {gamekey: orderSecret, tpkd_dict: {all_tpks: [first, second]}},
        api.mapDownloadOrderRows([first, second], [firstRow, secondRow])
    );
    const account = {
        countryCode: 'CA',
        ownedApps: [101],
        wishlistApps: [],
        sessionId: 'session',
    };
    const authenticated = {status: 'authenticated', account, error: null};
    api.setSteamDerivedStateForTest(account);
    const firstId = api.getDownloadActivationItemId(scope, first);
    const secondId = api.getDownloadActivationItemId(scope, second);
    await api.updateDownloadSelection(scope, selection => selection.add(firstId));
    const controls = api.mountDownloadActivationControlsForTest();
    api.setChoiceActivationBatchForTest(activationBatch([{
        id: firstId,
        title: 'First game',
        key: steamKey(3),
        status: 'steam-activation-failed',
        error: 'already owned',
    }]));
    api.renderChoiceActivationResultsForTest();
    api.setDownloadSelectionModeForTest(true);
    const results = document.getElementById('hb-helper-choice-activation-results');
    const resultText = treeText(results);
    const activate = controls.querySelector('[data-hb-helper-choice-action="activate"]');
    const selectUnowned = controls.querySelector(
        '[data-hb-helper-choice-action="select-unowned"]'
    );
    const select = controls.querySelector('[data-hb-helper-choice-action="select"]');
    const clear = controls.querySelector('[data-hb-helper-choice-action="clear"]');
    assert.match(resultText, new RegExp(steamKey(3)));
    assert.equal(firstRow.classList.contains('hb-helper-download-selected'), true);
    assert.equal(firstRow.getAttribute('tabindex'), '0');
    assert.equal(firstRow.getAttribute('role'), 'button');

    api.applySteamSessionState({...authenticated, status: 'syncing'});

    assert.equal(document.getElementById('hb-helper-choice-activation-controls'), controls);
    assert.equal(document.getElementById('hb-helper-choice-activation-results'), results);
    assert.equal(treeText(results), resultText);
    assert.equal(firstRow.classList.contains('hb-helper-download-selected'), true);
    assert.equal(document.documentElement.classList.contains(
        'hb-helper-download-select-mode'
    ), true);
    assert.equal(firstRow.getAttribute('tabindex'), '0');
    assert.equal(firstRow.getAttribute('role'), 'button');
    assert.equal(activate.disabled, true);
    assert.equal(selectUnowned.disabled, false);
    assert.equal(select.disabled, false);
    assert.equal(clear.disabled, false);
    assert.deepEqual(clone(await api.startDownloadActivationForTest()), {
        started: false,
        unavailable: true,
    });
    assert.match(treeText(controls.querySelector('.hb-helper-choice-status')), /1 selected/);
    assert.equal(document.getElementById('hb-helper-login-reminder'), null);

    await api.handleDownloadSelectionEventForTest({
        type: 'click',
        target: firstRow,
        preventDefault() {},
        stopPropagation() {},
        stopImmediatePropagation() {},
    });
    assert.deepEqual([...api.getDownloadSelection(scope)], []);
    await api.selectUnownedDownloadRowsForTest({
        isOwned: async pair => pair.tpkd === first,
    });
    assert.deepEqual([...api.getDownloadSelection(scope)], [secondId]);
    clear.dispatch('click');
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual([...api.getDownloadSelection(scope)], []);
    select.dispatch('click');
    assert.equal(document.documentElement.classList.contains(
        'hb-helper-download-select-mode'
    ), false);

    await api.updateDownloadSelection(scope, selection => selection.add(firstId));
    api.applySteamSessionState(authenticated);
    assert.equal(document.getElementById('hb-helper-choice-activation-controls'), controls);
    assert.equal(document.getElementById('hb-helper-choice-activation-results'), results);
    assert.equal(activate.disabled, false);

    api.applySteamSessionState({status: 'logged-out', account: null, error: null});
    await api.clearSteamAccountDerivedState();
    assert.ok([activate, selectUnowned, select, clear].every(button => button.disabled));
    assert.equal(firstRow.classList.contains('hb-helper-download-selected'), false);
    assert.equal(firstRow.hasAttribute('tabindex'), false);
    assert.equal(firstRow.hasAttribute('role'), false);
    assert.equal(document.documentElement.classList.contains(
        'hb-helper-download-select-mode'
    ), false);
    assert.deepEqual([...api.getDownloadSelection(scope)], [firstId]);

    api.applySteamSessionState(authenticated);
    assert.equal(firstRow.classList.contains('hb-helper-download-selected'), true);
    api.applySteamSessionState({status: 'error', account: null, error: new Error('failed')});
    await api.clearSteamAccountDerivedState();
    assert.ok([activate, selectUnowned, select, clear].every(button => button.disabled));
    assert.equal(firstRow.classList.contains('hb-helper-download-selected'), false);
    assert.deepEqual([...api.getDownloadSelection(scope)], [firstId]);
});

test('Downloads login reminder follows unknown, terminal, retry, and retained-account states', () => {
    const {api, document} = loadApi();
    const container = document.createElement('div');
    container.className = 'key-container wrapper';
    document.body.appendChild(container);
    api.mountDownloadActivationControlsForTest();
    assert.equal(document.getElementById('hb-helper-login-reminder'), null);

    api.applySteamSessionState({status: 'logged-out', account: null, error: null});
    const reminder = document.getElementById('hb-helper-login-reminder');
    assert.ok(reminder);
    assert.match(treeText(reminder), /Log in to Steam/);
    api.applySteamSessionState({status: 'syncing', account: null, error: null});
    assert.equal(document.getElementById('hb-helper-login-reminder'), reminder);
    assert.match(treeText(reminder), /Log in to Steam/);
    api.applySteamSessionState({status: 'logged-out', account: null, error: null});
    assert.equal(document.getElementById('hb-helper-login-reminder'), reminder);

    api.applySteamSessionState({status: 'error', account: null, error: new Error('failed')});
    assert.equal(document.getElementById('hb-helper-login-reminder'), reminder);
    assert.match(treeText(reminder), /Could not synchronize/);
    assert.equal(reminder.querySelector('a'), null);
    const retry = reminder.querySelector('button');
    assert.ok(retry);
    api.applySteamSessionState({status: 'syncing', account: null, error: new Error('failed')});
    assert.equal(document.getElementById('hb-helper-login-reminder'), reminder);
    assert.match(treeText(reminder), /Could not synchronize/);
    assert.equal(retry.disabled, true);

    const account = {
        countryCode: 'CA',
        ownedApps: [],
        wishlistApps: [],
        sessionId: 'session',
    };
    api.applySteamSessionState({status: 'authenticated', account, error: null});
    assert.equal(document.getElementById('hb-helper-login-reminder'), null);
    api.applySteamSessionState({status: 'syncing', account, error: null});
    assert.equal(document.getElementById('hb-helper-login-reminder'), null);
});

test('select unowned abandons an ownership result after navigation to another order', async () => {
    const loaded = loadApi();
    const {api, context, document, orderSecret: firstSecret} = loaded;
    const secondSecret = ephemeralOrderSecret();
    const firstScope = await api.hashDownloadOrderKey(firstSecret);
    const secondScope = await api.hashDownloadOrderKey(secondSecret);
    const firstProduct = tpk({human_name: 'First order', machine_name: 'first-order'});
    const secondProduct = tpk({
        human_name: 'Second order',
        machine_name: 'second-order',
        keyindex: 1,
    });
    const firstRow = downloadRow(document, {
        title: firstProduct.human_name,
        machineName: firstProduct.machine_name,
        keyindex: firstProduct.keyindex,
    });
    const secondRow = downloadRow(document, {
        title: secondProduct.human_name,
        machineName: secondProduct.machine_name,
        keyindex: secondProduct.keyindex,
    });
    const container = document.createElement('div');
    container.className = 'key-container wrapper';
    container.appendChild(firstRow);
    document.body.appendChild(container);
    api.setSteamDerivedStateForTest({
        countryCode: 'CA',
        ownedApps: [],
        wishlistApps: [],
        sessionId: 'session',
    });
    api.setDownloadOrderStateForTest(
        firstScope,
        {gamekey: firstSecret, tpkd_dict: {all_tpks: [firstProduct]}},
        api.mapDownloadOrderRows([firstProduct], [firstRow])
    );
    const secondId = api.getDownloadActivationItemId(secondScope, secondProduct);
    await api.updateDownloadSelection(secondScope, selection => selection.add(secondId));

    let finishOwnership;
    const ownershipGate = new Promise(resolve => { finishOwnership = resolve; });
    const selecting = api.selectUnownedDownloadRowsForTest({
        isOwned: async () => {
            await ownershipGate;
            return false;
        },
    });
    await Promise.resolve();

    firstRow.remove();
    container.appendChild(secondRow);
    context.location.search = `?key=${encodeURIComponent(secondSecret)}`;
    context.location.href = `https://www.humblebundle.com/downloads${context.location.search}`;
    await api.initializeDownloadOrderPageForTest({
        loadOrder: async key => ({
            gamekey: key,
            tpkd_dict: {all_tpks: [secondProduct]},
        }),
    });
    finishOwnership();
    const result = await selecting;

    assert.equal(result?.stale, true);
    assert.deepEqual([...api.getDownloadSelection(secondScope)], [secondId]);
    assert.ok([...api.getDownloadSelection(secondScope)].every(id =>
        api.parseDownloadActivationItemId(id)?.scope === secondScope
    ));
});

test('select unowned preserves selection when a global batch starts during ownership lookup', async () => {
    const {api, document, orderSecret} = loadApi();
    const scope = await api.hashDownloadOrderKey(orderSecret);
    const product = tpk({human_name: 'Batch race', machine_name: 'batch-race'});
    const row = downloadRow(document, {
        title: product.human_name,
        machineName: product.machine_name,
        keyindex: product.keyindex,
    });
    const container = document.createElement('div');
    container.className = 'key-container wrapper';
    container.appendChild(row);
    document.body.appendChild(container);
    api.setSteamDerivedStateForTest({
        countryCode: 'CA',
        ownedApps: [],
        wishlistApps: [],
        sessionId: 'session',
    });
    api.setDownloadOrderStateForTest(
        scope,
        {gamekey: orderSecret, tpkd_dict: {all_tpks: [product]}},
        api.mapDownloadOrderRows([product], [row])
    );
    const id = api.getDownloadActivationItemId(scope, product);
    await api.updateDownloadSelection(scope, selection => selection.add(id));

    let finishOwnership;
    const ownershipGate = new Promise(resolve => { finishOwnership = resolve; });
    const selecting = api.selectUnownedDownloadRowsForTest({
        isOwned: async () => {
            await ownershipGate;
            return true;
        },
    });
    await Promise.resolve();
    api.setChoiceActivationBatchForTest(activationBatch([{
        id,
        key: steamKey(7),
        status: 'pending-steam-activation',
    }], {state: 'collecting', owner: 'foreign'}));
    finishOwnership();

    const result = await selecting;
    assert.equal(result?.stale, true);
    assert.deepEqual([...api.getDownloadSelection(scope)], [id]);
    api.setChoiceActivationBatchForTest(null);
});

test('select unowned revalidates after its locked callback before persistence', async () => {
    let interleaveAfterLockCallback;
    let interleavedNavigation = Promise.resolve();
    const lockManager = {
        names: [],
        async request(name, options, callback) {
            this.names.push(name);
            const callbackResult = callback({name});
            if (interleaveAfterLockCallback) {
                const interleave = interleaveAfterLockCallback;
                interleaveAfterLockCallback = null;
                interleavedNavigation = Promise.resolve(interleave());
            }
            const result = await callbackResult;
            await interleavedNavigation;
            return result;
        },
    };
    const loaded = loadApi({lockManager});
    const {api, context, document, orderSecret: firstSecret} = loaded;
    const secondSecret = ephemeralOrderSecret();
    const firstScope = await api.hashDownloadOrderKey(firstSecret);
    const firstProduct = tpk({human_name: 'First locked order', machine_name: 'first-locked'});
    const secondProduct = tpk({
        human_name: 'Second locked order',
        machine_name: 'second-locked',
        keyindex: 1,
    });
    const firstRow = downloadRow(document, {
        title: firstProduct.human_name,
        machineName: firstProduct.machine_name,
        keyindex: firstProduct.keyindex,
    });
    const secondRow = downloadRow(document, {
        title: secondProduct.human_name,
        machineName: secondProduct.machine_name,
        keyindex: secondProduct.keyindex,
    });
    const container = document.createElement('div');
    container.className = 'key-container wrapper';
    container.appendChild(firstRow);
    document.body.appendChild(container);
    api.setSteamDerivedStateForTest({
        countryCode: 'CA',
        ownedApps: [],
        wishlistApps: [],
        sessionId: 'session',
    });
    api.setDownloadOrderStateForTest(
        firstScope,
        {gamekey: firstSecret, tpkd_dict: {all_tpks: [firstProduct]}},
        api.mapDownloadOrderRows([firstProduct], [firstRow])
    );

    interleaveAfterLockCallback = () => {
        firstRow.remove();
        container.appendChild(secondRow);
        context.location.search = `?key=${encodeURIComponent(secondSecret)}`;
        context.location.href = `https://www.humblebundle.com/downloads${context.location.search}`;
        return api.initializeDownloadOrderPageForTest({
            loadOrder: async key => ({
                gamekey: key,
                tpkd_dict: {all_tpks: [secondProduct]},
            }),
        });
    };
    const result = await api.selectUnownedDownloadRowsForTest({
        isOwned: async () => false,
    });

    assert.equal(result?.stale, true);
    assert.equal(api.getDownloadSelection(firstScope).size, 0);
});

test('live foreign-scope batches disable downloads controls without rendering private details', async () => {
    const {api, document, orderSecret} = loadApi();
    const scope = await api.hashDownloadOrderKey(orderSecret);
    const foreignScope = await api.hashDownloadOrderKey(ephemeralOrderSecret());
    const product = tpk();
    const row = downloadRow(document, {machineName: product.machine_name, keyindex: 0});
    const container = document.createElement('div');
    container.className = 'key-container wrapper';
    container.appendChild(row);
    document.body.appendChild(container);
    api.setDownloadOrderStateForTest(
        scope,
        {gamekey: orderSecret, tpkd_dict: {all_tpks: [product]}},
        api.mapDownloadOrderRows([product], [row])
    );
    api.setSteamDerivedStateForTest({
        countryCode: 'CA',
        ownedApps: [],
        wishlistApps: [],
        sessionId: 'session',
    });
    const controls = api.mountDownloadActivationControlsForTest();
    const privateTitle = 'Private foreign title';
    const privateKey = steamKey(6);
    api.setChoiceActivationBatchForTest(activationBatch([{
        id: api.getDownloadActivationItemId(foreignScope, product),
        title: privateTitle,
        key: privateKey,
        status: 'steam-activation-failed',
        error: 'private foreign failure',
    }], {state: 'activating', owner: 'foreign'}));

    api.renderDownloadSelectionStateForTest();
    api.renderChoiceActivationResultsForTest();
    const helperText = treeText(controls);
    assert.equal(helperText.includes(privateTitle), false);
    assert.equal(helperText.includes(privateKey), false);
    assert.equal(helperText.includes('private foreign failure'), false);
    assert.ok(controls.querySelectorAll('button').every(button => button.disabled));

    api.setChoiceActivationBatchForTest(null);
    await api.reconcileChoiceActivationBatch();
    assert.ok(controls.querySelectorAll('button').every(button => !button.disabled));
});

test('remapping restores native row behavior and removes stale selection and region UI', async () => {
    const {api, document, orderSecret} = loadApi();
    const scope = await api.hashDownloadOrderKey(orderSecret);
    const first = tpk({
        human_name: 'Alpha',
        machine_name: 'alpha',
        exclusive_countries: ['CA'],
    });
    const replacement = tpk({
        human_name: 'Beta',
        machine_name: 'beta',
        keyindex: 1,
    });
    const row = downloadRow(document, {
        title: 'Alpha',
        machineName: 'alpha',
        keyindex: 0,
    });
    row.setAttribute('tabindex', '7');
    row.setAttribute('role', 'link');
    const container = document.createElement('div');
    container.className = 'key-container wrapper';
    container.appendChild(row);
    document.body.appendChild(container);
    const firstMapping = api.mapDownloadOrderRows([first], [row]);
    api.setDownloadOrderStateForTest(
        scope,
        {gamekey: orderSecret, tpkd_dict: {all_tpks: [first]}},
        firstMapping
    );
    api.setSteamDerivedStateForTest({
        countryCode: 'CA',
        ownedApps: [],
        wishlistApps: [],
        sessionId: 'session',
    });
    api.mountDownloadActivationControlsForTest();
    api.upsertDownloadRegionWarnings(firstMapping);
    api.setDownloadSelectionModeForTest(true);
    row.classList.add('hb-helper-download-selected');
    assert.equal(row.getAttribute('role'), 'button');
    assert.equal(row.querySelectorAll('.hb-helper-region-restrictions').length, 1);

    api.setDownloadOrderStateForTest(
        scope,
        {gamekey: orderSecret, tpkd_dict: {all_tpks: [replacement]}},
        firstMapping
    );
    api.refreshDownloadOrderPageForTest();

    assert.equal(row.getAttribute('tabindex'), '7');
    assert.equal(row.getAttribute('role'), 'link');
    assert.equal(row.classList.contains('hb-helper-download-selected'), false);
    assert.equal(row.querySelectorAll('.hb-helper-region-restrictions').length, 0);
});

test('an authenticated order-load failure keeps the order error instead of asking for Steam login', async () => {
    const {api, document} = loadApi();
    const container = document.createElement('div');
    container.className = 'key-container wrapper';
    document.body.appendChild(container);
    api.setSteamDerivedStateForTest({
        countryCode: 'CA',
        ownedApps: [],
        wishlistApps: [],
        sessionId: 'session',
    });

    await assert.rejects(api.initializeDownloadOrderPageForTest({
        loadOrder: async () => { throw new Error('generic load failure'); },
    }));
    api.renderDownloadSelectionStateForTest();

    const controls = document.getElementById('hb-helper-choice-activation-controls');
    assert.match(treeText(controls), /Could not load this Humble order/);
    assert.equal(treeText(controls).includes('Log in to Steam'), false);
});

test('History and popstate route changes install the right lifecycle without stale state', async () => {
    const loaded = loadApi({pathname: '/account', search: ''});
    const {api, context, document, gmBus, orderSecret: firstSecret} = loaded;
    const secondSecret = ephemeralOrderSecret();
    const first = tpk({
        human_name: 'First Order Game',
        machine_name: 'first-order-game',
        exclusive_countries: ['CA'],
    });
    const second = tpk({
        human_name: 'Second Order Game',
        machine_name: 'second-order-game',
        keyindex: 1,
        exclusive_countries: ['MX'],
    });
    const firstScope = await api.hashDownloadOrderKey(firstSecret);
    const secondScope = await api.hashDownloadOrderKey(secondSecret);
    const firstId = api.getDownloadActivationItemId(firstScope, first);
    await api.updateDownloadSelection(firstScope, selection => selection.add(firstId));
    api.setChoiceActivationBatchForTest(activationBatch([{id: firstId}]));

    const firstRow = downloadRow(document, {
        title: first.human_name,
        machineName: first.machine_name,
        keyindex: first.keyindex,
    });
    firstRow.setAttribute('tabindex', '7');
    firstRow.setAttribute('role', 'link');
    const secondRow = downloadRow(document, {
        title: second.human_name,
        machineName: second.machine_name,
        keyindex: second.keyindex,
    });
    const container = document.createElement('div');
    container.className = 'key-container wrapper';
    container.appendChild(firstRow);
    document.body.appendChild(container);

    const stalePriceControls = document.createElement('div');
    stalePriceControls.id = 'hb-helper-controls';
    const staleSteamGifts = document.createElement('div');
    staleSteamGifts.id = 'steamgifts-discussion';
    const stalePriceSummary = document.createElement('div');
    stalePriceSummary.id = 'hb-helper-price-summary';
    stalePriceControls.append(staleSteamGifts, stalePriceSummary);
    document.body.appendChild(stalePriceControls);

    api.setSteamDerivedStateForTest({
        countryCode: 'CA',
        ownedApps: [],
        wishlistApps: [],
        sessionId: 'session',
    });
    const orders = new Map([
        [firstSecret, {gamekey: firstSecret, tpkd_dict: {all_tpks: [first]}}],
        [secondSecret, {gamekey: secondSecret, tpkd_dict: {all_tpks: [second]}}],
    ]);
    const loadCounts = new Map();
    const routeOptions = {
        loadOrder: async key => {
            loadCounts.set(key, (loadCounts.get(key) || 0) + 1);
            return orders.get(key);
        },
        syncSession: async () => ({
            status: 'authenticated',
            account: {
                countryCode: 'CA',
                ownedApps: [],
                wishlistApps: [],
                sessionId: 'session',
            },
            error: null,
        }),
    };

    api.installHelperRouteLifecycleForTest(routeOptions);
    api.installHelperRouteLifecycleForTest(routeOptions);
    await api.waitForHelperRouteForTest();
    assert.equal(context.listenerCount('popstate'), 1);

    const priceRunBeforeDownloads = api.getPriceTotalsRunIdForTest();
    context.history.pushState({}, '', `/downloads?key=${encodeURIComponent(firstSecret)}`);
    await api.waitForHelperRouteForTest();
    assert.equal(document.getElementById('hb-helper-controls'), null);
    assert.equal(document.getElementById('steamgifts-discussion'), null);
    assert.ok(api.getPriceTotalsRunIdForTest() > priceRunBeforeDownloads);
    assert.equal(api.getDownloadSelection(firstScope).size, 0);
    assert.equal(gmBus.listenerCount('hb-helper-steam-activation-batch-v2'), 1);
    assert.equal(
        gmBus.listenerCount(`hb-helper-download-selected-games-v1:${firstScope}`),
        1
    );
    api.setDownloadSelectionModeForTest(true);
    assert.equal(firstRow.getAttribute('role'), 'button');
    assert.match(treeText(firstRow), /CA/);

    const oldPrivateKey = steamKey(9);
    api.setChoiceActivationBatchForTest(activationBatch([{
        id: firstId,
        title: 'First order private failure',
        key: oldPrivateKey,
        status: 'steam-activation-failed',
        error: 'private',
    }]));
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(treeText(container).includes(oldPrivateKey), true);

    firstRow.remove();
    container.appendChild(secondRow);
    context.history.replaceState({}, '', `/downloads?key=${encodeURIComponent(secondSecret)}`);
    assert.equal(treeText(container).includes(oldPrivateKey), false);
    await api.waitForHelperRouteForTest();
    assert.equal(loadCounts.get(secondSecret), 1);
    api.setDownloadSelectionModeForTest(true);
    assert.equal(secondRow.getAttribute('role'), 'button');
    const secondPanelText = treeText(
        secondRow.querySelector('.hb-helper-region-restrictions')
    );
    assert.match(secondPanelText, /MX/);
    assert.equal(secondPanelText.includes('allowlist: CA'), false);

    gmBus.values.set(
        'hb-helper-choice-selected-games-v1',
        ['choice-route-success', 'choice-route-failure']
    );
    gmBus.values.set('hb-helper-steam-activation-batch-v2', activationBatch([
        {id: 'hb-helper-key-v1:0:choice-route-success', status: 'activated'},
        {id: 'hb-helper-key-v1:1:choice-route-success', status: 'activated'},
        {
            id: 'hb-helper-key-v1:0:choice-route-failure',
            status: 'humble-key-retrieval-failed',
            error: 'choice failure',
        },
    ]));
    const heading = document.createElement('h2');
    heading.textContent = 'YOUR GAMES';
    document.body.appendChild(heading);
    context.history.pushState({}, '', '/membership');
    await api.waitForHelperRouteForTest();
    assert.equal(gmBus.listenerCount('hb-helper-choice-selected-games-v1'), 1);
    assert.deepEqual(
        gmBus.values.get('hb-helper-choice-selected-games-v1'),
        ['choice-route-failure']
    );
    assert.deepEqual([...api.getSelectedChoiceGameIdsForTest()], ['choice-route-failure']);
    assert.ok(document.getElementById('hb-helper-controls'));
    assert.equal(document.getElementById('hb-helper-choice-activation-controls')
        .classList.contains('hb-helper-downloads-controls'), false);

    secondRow.remove();
    container.appendChild(firstRow);
    const priceRunBeforeReentry = api.getPriceTotalsRunIdForTest();
    context.history.pushState({}, '', `/downloads?key=${encodeURIComponent(firstSecret)}`);
    assert.equal(document.getElementById('hb-helper-controls'), null);
    assert.ok(api.getPriceTotalsRunIdForTest() > priceRunBeforeReentry);
    await api.waitForHelperRouteForTest();
    assert.ok(document.getElementById('hb-helper-choice-activation-controls')
        .classList.contains('hb-helper-downloads-controls'));

    const foreignBusy = activationBatch([{
        id: api.getDownloadActivationItemId(secondScope, second),
        title: 'Private cross-tab title',
        key: steamKey(8),
        status: 'pending-steam-activation',
    }], {state: 'collecting', owner: 'foreign'});
    api.setChoiceActivationBatchForTest(foreignBusy);
    await new Promise(resolve => setTimeout(resolve, 0));
    const downloadsControls = document.getElementById('hb-helper-choice-activation-controls');
    assert.ok(downloadsControls.querySelectorAll('button').every(button => button.disabled));
    assert.equal(treeText(downloadsControls).includes('Private cross-tab title'), false);
    assert.equal(treeText(downloadsControls).includes(steamKey(8)), false);
    api.setChoiceActivationBatchForTest(null);
    await new Promise(resolve => setTimeout(resolve, 0));

    context.setLocationForTest('/account');
    context.dispatchEvent(new context.Event('popstate'));
    await api.waitForHelperRouteForTest();
    assert.equal(document.getElementById('hb-helper-choice-activation-controls'), null);
    assert.equal(firstRow.getAttribute('role'), 'link');
});

test('helper text mutations do not schedule observer refresh loops', () => {
    const {api, document} = loadApi();
    const controls = document.createElement('div');
    controls.id = 'hb-helper-choice-activation-controls';
    document.body.appendChild(controls);
    const detachedText = {nodeType: 3, parentElement: null};
    assert.equal(api.shouldRefreshForPageMutationsForTest([{
        target: controls,
        addedNodes: [],
        removedNodes: [detachedText],
    }]), false);

    const warning = document.createElement('div');
    warning.className = 'hb-helper-region-restrictions';
    assert.equal(api.shouldRefreshForPageMutationsForTest([{
        target: document.body,
        addedNodes: [warning],
        removedNodes: [],
    }]), false);

    const nativeRow = document.createElement('div');
    nativeRow.className = 'key-redeemer';
    assert.equal(api.shouldRefreshForPageMutationsForTest([{
        target: document.body,
        addedNodes: [nativeRow],
        removedNodes: [],
    }]), true);
});

test('raw order secrets never enter GM data, batches, DOM metadata, locks, logs, or errors', async () => {
    const gmBus = createGmBus();
    const lockManager = createQueuedLockManager();
    const logs = [];
    const {api, document, orderSecret} = loadApi({gmBus, lockManager, logs});
    const scope = await api.hashDownloadOrderKey(orderSecret);
    const product = tpk({machine_name: 'privacy-item'});
    const id = api.getDownloadActivationItemId(scope, product);
    await api.updateDownloadSelection(scope, selection => selection.add(id));
    api.setChoiceActivationBatchForTest(activationBatch([{
        id,
        status: 'steam-activation-failed',
        key: steamKey(0),
        error: 'generic failure',
    }]));
    const row = downloadRow(document, {machineName: product.machine_name, keyindex: 0});
    document.body.appendChild(row);
    api.upsertDownloadRegionWarnings(api.mapDownloadOrderRows([product], [row]));

    let errorText = '';
    try {
        api.validateDownloadOrder({gamekey: ephemeralOrderSecret(), tpkd_dict: {all_tpks: []}}, orderSecret);
    } catch (error) {
        errorText = String(error);
    }
    const domMetadata = [];
    const walk = node => {
        domMetadata.push(JSON.stringify(node.dataset));
        for (const child of node.children) walk(child);
    };
    walk(document.body);
    const forbidden = [
        JSON.stringify([...gmBus.values.entries()]),
        JSON.stringify(api.getChoiceActivationBatchForTest()),
        domMetadata.join('\n'),
        JSON.stringify(lockManager.names),
        logs.join('\n'),
        errorText,
    ];
    assert.ok(forbidden.every(value => !value.includes(orderSecret)));
});
