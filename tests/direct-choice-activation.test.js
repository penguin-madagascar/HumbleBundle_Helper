const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function createTestClassList() {
    const names = new Set();
    return {
        add(...items) { items.forEach(item => names.add(item)); },
        remove(...items) { items.forEach(item => names.delete(item)); },
        toggle(item, enabled) {
            if (enabled) names.add(item);
            else names.delete(item);
        },
        contains(item) { return names.has(item); },
    };
}

function loadApi({
    onRequest = () => {},
    lockManager,
    DateImplementation = Date,
    setIntervalImplementation = setInterval,
    clearIntervalImplementation = clearInterval,
} = {}) {
    const values = new Map();
    let document;
    const element = () => {
        const children = [];
        const attributes = new Map();
        const testElement = {
            children,
            parentNode: null,
            appendChild(child) {
                child.remove?.();
                children.push(child);
                child.parentNode = this;
                return child;
            },
            append(...items) { items.forEach(item => this.appendChild(item)); },
            insertBefore(child, reference) {
                child.remove?.();
                const index = children.indexOf(reference);
                children.splice(index < 0 ? children.length : index, 0, child);
                child.parentNode = this;
                return child;
            },
            insertAdjacentElement(position, child) {
                const parent = this.parentNode;
                if (!parent) return child;
                const index = parent.children.indexOf(this);
                child.remove?.();
                parent.children.splice(position === 'beforebegin' ? index : index + 1, 0, child);
                child.parentNode = parent;
                return child;
            },
            remove() {
                const parent = this.parentNode;
                if (parent) {
                    const index = parent.children.indexOf(this);
                    if (index >= 0) parent.children.splice(index, 1);
                }
                this.parentNode = null;
                if (this.id) document.elements.delete(this.id);
            },
            replaceChildren(...items) {
                children.splice(0).forEach(child => { child.parentNode = null; });
                this.append(...items);
            },
            addEventListener() {},
            classList: createTestClassList(),
            dataset: {},
            style: {},
            setAttribute(name, value) {
                attributes.set(name, String(value));
            },
            getAttribute(name) { return attributes.get(name) || null; },
            querySelector(selector) {
                return findMatchingElement(this, selector);
            },
            querySelectorAll(selector) {
                return findMatchingElements(this, selector);
            },
        };
        Object.defineProperty(testElement, 'id', {
            get() { return attributes.get('id') || ''; },
            set(value) {
                const previous = attributes.get('id');
                if (previous) document.elements.delete(previous);
                attributes.set('id', String(value));
                document.elements.set(String(value), testElement);
            },
        });
        Object.defineProperty(testElement, 'nextElementSibling', {
            get() {
                const siblings = this.parentNode?.children || [];
                return siblings[siblings.indexOf(this) + 1] || null;
            },
        });
        Object.defineProperty(testElement, 'firstElementChild', {
            get() { return children[0] || null; },
        });
        return testElement;
    };
    const matchesSelector = (testElement, selector) => {
        if (selector.startsWith('#')) return testElement.id === selector.slice(1);
        if (selector.startsWith('.')) {
            return testElement.classList.contains(selector.slice(1))
                || testElement.className?.split(/\s+/).includes(selector.slice(1));
        }
        const action = selector.match(/^\[data-hb-helper-choice-action="([^"]+)"\]$/);
        return action
            ? testElement.dataset.hbHelperChoiceAction === action[1]
            : false;
    };
    const descendants = root => root.children.flatMap(child => [child, ...descendants(child)]);
    const findMatchingElements = (root, selector) => descendants(root).filter(testElement =>
        selector.split(', ').some(part => matchesSelector(testElement, part))
    );
    const findMatchingElement = (root, selector) => {
        const [ancestor, descendant] = selector.split(' ');
        if (descendant) {
            const parent = findMatchingElement(root, ancestor);
            return parent ? findMatchingElement(parent, descendant) : null;
        }
        return findMatchingElements(root, selector)[0] || null;
    };
    document = {
        body: element(),
        head: element(),
        documentElement: element(),
        elements: new Map(),
        createElement: element,
        addEventListener() {},
        getElementById(id) {
            return this.elements.get(id)
                || [this.body, this.head, this.documentElement]
                    .map(root => findMatchingElement(root, `#${id}`))
                    .find(Boolean)
                || null;
        },
        querySelector(selector) {
            if (selector === '.choice-content.js-open-choice-modal') {
                return this.choiceTiles[0] || null;
            }
            return [this.body, this.head, this.documentElement]
                .map(root => findMatchingElement(root, selector))
                .find(Boolean)
            || null;
        },
        choiceTiles: [],
        querySelectorAll(selector) {
            if (selector === 'h1, h2, h3, h4, h5, h6, p, div') return this.textAnchors;
            return selector.includes('.choice-content.js-open-choice-modal')
                ? this.choiceTiles
                : [this.body, this.head, this.documentElement]
                    .flatMap(root => findMatchingElements(root, selector));
        },
        textAnchors: [],
    };
    const context = {
        __HB_HELPER_TEST__: true,
        console: {log() {}, warn() {}, error() {}},
        document,
        navigator: {language: 'en', languages: ['en'], locks: lockManager},
        location: {
            hostname: 'www.humblebundle.com',
            pathname: '/membership',
            href: 'https://www.humblebundle.com/membership',
        },
        DOMParser: class {
            parseFromString() {
                return {querySelector() { return null; }};
            }
        },
        GM_getValue(name, fallback) {
            return values.has(name) ? values.get(name) : fallback;
        },
        GM_setValue(name, value) {
            values.set(name, JSON.parse(JSON.stringify(value)));
        },
        GM_deleteValue(name) { values.delete(name); },
        GM_addValueChangeListener() {},
        GM_setClipboard() {},
        GM_registerMenuCommand() {},
        GM_xmlhttpRequest: onRequest,
        setTimeout,
        clearTimeout,
        setInterval: setIntervalImplementation,
        clearInterval: clearIntervalImplementation,
        URLSearchParams,
        Map,
        Set,
        Promise,
        Date: DateImplementation,
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
    context.globalThis = context;
    vm.runInNewContext(
        fs.readFileSync(path.join(__dirname, '..', 'HB_Helper.user.js'), 'utf8'),
        context,
        {filename: 'HB_Helper.user.js'}
    );
    return {api: context.__HB_HELPER_TEST_API__, values};
}

const authenticatedState = sessionId => ({
    status: 'authenticated',
    account: {
        countryCode: 'US',
        ownedApps: [],
        wishlistApps: [],
        sessionId,
    },
    error: null,
});

function activationBatch(items, owner = 'current-owner') {
    return {
        version: 2,
        id: 'batch-1',
        state: 'activating',
        runner: {
            phase: 'activating',
            owner,
            leaseExpiresAt: 1000,
        },
        ownershipRefresh: {
            state: 'waiting',
            owner: null,
            leaseExpiresAt: null,
            error: null,
        },
        items: items.map(item => ({
            id: item.id,
            title: item.title,
            key: item.key,
            status: item.status || 'pending-steam-activation',
        })),
    };
}

const successResponse = {
    purchase_result_details: 0,
    purchase_receipt_info: {line_items: [{packageid: 1}]},
};

function createFastPolling() {
    let now = 0;
    class FastDate extends Date {
        static now() {
            now += 1000;
            return now;
        }
    }
    return {
        currentTime() { return now; },
        DateImplementation: FastDate,
        setIntervalImplementation(callback) {
            const handle = {active: true};
            const tick = () => queueMicrotask(() => {
                if (!handle.active) return;
                callback();
                if (handle.active) tick();
            });
            tick();
            return handle;
        },
        clearIntervalImplementation(handle) {
            handle.active = false;
        },
    };
}

const immediateLockManager = {
    request(name, options, callback) {
        return callback({name});
    },
};

function createChoiceModalHarness(api, {
    title = 'Choice game',
    modalTitle = title,
    rowDefinitions,
    unsafeClose = false,
    rowsAvailableAfterQueries = 0,
} = {}) {
    const document = api.getTestDocument();
    const definitions = rowDefinitions || [];
    const events = [];
    const clicks = definitions.map(() => 0);
    const reads = definitions.map(() => 0);
    let rowQueries = 0;
    let modalChecks = 0;
    let globalError = false;
    let opened = 0;

    const titleElement = {textContent: modalTitle};
    const closeButton = {
        className: 'close',
        disabled: false,
        textContent: 'Close',
        getAttribute() { return null; },
        getClientRects() { return [{}]; },
        click() {
            events.push('close');
            if (!unsafeClose) document.elements.delete('site-modal');
        },
    };

    const createField = value => ({
        disabled: false,
        textContent: value,
        value,
        getClientRects() { return [{}]; },
    });
    const createRowRoot = (definition, index) => ({
        classList: {
            contains(name) {
                return definition.statusOnRoot === true && definition.state === name;
            },
        },
        querySelector(selector) {
            if (selector === '.js-keyfield.keyfield.redeemed') {
                return definition.state === 'redeemed' ? {textContent: 'redeemed'} : null;
            }
            if (selector === '.error') {
                return definition.state === 'error' ? {textContent: 'claim failed'} : null;
            }
            if (selector !== '.js-keyfield.keyfield.enabled'
                || definition.hasControl === false) {
                return null;
            }
            return {
                disabled: definition.controlDisabled === true,
                getClientRects() { return [{}]; },
                click() {
                    clicks[index] += 1;
                    events.push(`click:${index}`);
                    definition.state = 'loading';
                    definition.onClick?.({
                        definition,
                        definitions,
                        document,
                        events,
                        createReplacementModal,
                        replaceRowRoot,
                        setActiveModal,
                        setGlobalError(value = true) { globalError = value; },
                        swapRowRoots,
                    });
                },
            };
        },
        querySelectorAll(selector) {
            reads[index] += 1;
            if (selector === 'input, textarea') return [];
            if (selector === '.keyfield-value') {
                return [...(definition.keys || [])].map(createField);
            }
            return [];
        },
    });
    const rowRoots = definitions.map(createRowRoot);
    const replaceRowRoot = index => {
        rowRoots[index] = createRowRoot(definitions[index], index);
        return rowRoots[index];
    };
    const swapRowRoots = (left, right) => {
        [rowRoots[left], rowRoots[right]] = [rowRoots[right], rowRoots[left]];
    };
    const setActiveModal = activeModal => {
        document.elements.set('site-modal', activeModal);
    };
    const createReplacementModal = ({
        replacementTitle = title,
        unsafeReplacementClose = false,
    } = {}) => {
        const replacementTitleElement = {textContent: replacementTitle};
        let replacement;
        const replacementCloseButton = {
            className: 'close',
            disabled: false,
            textContent: 'Close',
            getAttribute() { return null; },
            getClientRects() { return [{}]; },
            click() {
                events.push('close:replacement');
                if (!unsafeReplacementClose
                    && document.elements.get('site-modal') === replacement) {
                    document.elements.delete('site-modal');
                }
            },
        };
        replacement = {
            textContent: replacementTitle,
            getClientRects() {
                modalChecks += 1;
                return [{}];
            },
            classList: {
                contains() { return false; },
            },
            querySelector(selector) {
                if (selector === '.js-select-choice-container.error') return null;
                return null;
            },
            querySelectorAll(selector) {
                if (selector === '.key-redeemer') return [];
                if (selector === 'button, a, [role="button"]') {
                    return [replacementCloseButton];
                }
                if (selector.includes('.human-name-title') && selector.includes('h1')) {
                    return [replacementTitleElement];
                }
                return [];
            },
        };
        return replacement;
    };
    const modal = {
        textContent: modalTitle,
        getClientRects() {
            modalChecks += 1;
            return [{}];
        },
        querySelector(selector) {
            if (selector === '.js-select-choice-container.error') {
                return globalError ? {textContent: 'claim failed'} : null;
            }
            return null;
        },
        querySelectorAll(selector) {
            if (selector === '.key-redeemer') {
                rowQueries += 1;
                definitions.forEach(definition => definition.onRowsQueried?.({
                    definition,
                    definitions,
                    document,
                    rowQueries,
                    replaceRowRoot,
                    setActiveModal,
                    setGlobalError(value = true) { globalError = value; },
                    swapRowRoots,
                }));
                if (rowQueries <= rowsAvailableAfterQueries) return [];
                return rowRoots.slice(0, definitions.length);
            }
            if (selector === 'button, a, [role="button"]') return [closeButton];
            if (selector.includes('.human-name-title') && selector.includes('h1')) {
                return [titleElement];
            }
            return [];
        },
    };
    const tile = {
        textContent: title,
        querySelector() { return null; },
        click() {
            opened += 1;
            events.push('open');
            document.elements.set('site-modal', modal);
        },
    };

    return {
        clicks,
        definitions,
        events,
        modal,
        reads,
        rowRoots,
        tile,
        get opened() { return opened; },
        get rowQueries() { return rowQueries; },
        get modalChecks() { return modalChecks; },
        setGlobalError(value = true) { globalError = value; },
    };
}

function completedBatch(items, id = 'completed-batch') {
    return {
        version: 2,
        id,
        state: 'complete',
        runner: {phase: null, owner: null, leaseExpiresAt: null},
        ownershipRefresh: {
            state: 'complete',
            owner: null,
            leaseExpiresAt: null,
            error: null,
        },
        items,
    };
}

test('Choice key item IDs round-trip canonical indexes and URI-encoded game IDs', () => {
    const {api} = loadApi();
    const gameId = 'machine:name / 游戏?';
    const encoded = api.encodeChoiceActivationItemId(gameId, 12);

    assert.equal(
        encoded,
        'hb-helper-key-v1:12:machine%3Aname%20%2F%20%E6%B8%B8%E6%88%8F%3F'
    );
    assert.deepEqual(
        JSON.parse(JSON.stringify(api.decodeChoiceActivationItemId(encoded))),
        {gameId, keyIndex: 12}
    );
    assert.deepEqual(
        JSON.parse(JSON.stringify(api.decodeChoiceActivationItemId('legacy-game'))),
        {gameId: 'legacy-game', keyIndex: 0}
    );
});

test('Choice key item IDs reject malformed reserved prefixes and decoded slot collisions', () => {
    const {api} = loadApi();
    assert.throws(() => api.encodeChoiceActivationItemId('game', -1), {name: 'TypeError'});
    assert.throws(() => api.encodeChoiceActivationItemId('game', 1.5), {name: 'TypeError'});
    assert.throws(() => api.encodeChoiceActivationItemId('', 0), {name: 'TypeError'});
    for (const id of [
        'hb-helper-key-v1:',
        'hb-helper-key-v1:01:game',
        'hb-helper-key-v1:-1:game',
        'hb-helper-key-v1:9007199254740992:game',
        'hb-helper-key-v1:0:',
        'hb-helper-key-v1:0:%41',
        'hb-helper-key-v1:0:%E0%A4%A',
    ]) {
        assert.equal(api.decodeChoiceActivationItemId(id), null, id);
    }

    const collision = completedBatch([
        {id: 'same-game', title: 'Same game', key: null, status: 'activated'},
        {
            id: 'hb-helper-key-v1:0:same-game',
            title: 'Same game',
            key: null,
            status: 'activated',
        },
    ]);
    assert.equal(api.getChoiceActivationBatchForTest(collision), null);
});

test('stable Choice row roots observe redeemed state from replaced descendant internals', async () => {
    const {api} = loadApi(createFastPolling());
    const harness = createChoiceModalHarness(api, {
        rowDefinitions: [{
            state: 'ready',
            onClick({definition}) {
                queueMicrotask(() => {
                    definition.state = 'redeemed';
                    definition.keys = ['AAAAA-BBBBB-CCCCC'];
                });
            },
        }],
    });
    const initialRoot = harness.rowRoots[0];

    const outcomes = await api.revealChoiceSteamKeys(harness.tile, {
        skipIndexes: new Set(),
    });

    assert.equal(harness.rowRoots[0], initialRoot);
    assert.equal(initialRoot.classList.contains('redeemed'), false);
    assert.ok(initialRoot.querySelector('.js-keyfield.keyfield.redeemed'));
    assert.deepEqual(JSON.parse(JSON.stringify(outcomes)), [
        {keyIndex: 0, key: 'AAAAA-BBBBB-CCCCC'},
    ]);
});

test('already-redeemed Choice rows yield exactly one unique key without clicks', async () => {
    const {api} = loadApi(createFastPolling());
    const harness = createChoiceModalHarness(api, {
        rowDefinitions: [
            {state: 'redeemed', keys: ['AAAAA-BBBBB-CCCCC']},
            {state: 'redeemed', keys: []},
            {state: 'redeemed', keys: ['DDDDD-EEEEE-FFFFF', 'GGGGG-HHHHH-IIIII']},
            {state: 'redeemed', keys: ['JJJJJ-KKKKK-LLLLL', 'JJJJJ-KKKKK-LLLLL']},
        ],
    });

    const outcomes = await api.revealChoiceSteamKeys(harness.tile, {
        skipIndexes: new Set(),
    });

    assert.deepEqual(JSON.parse(JSON.stringify(outcomes)), [
        {keyIndex: 0, key: 'AAAAA-BBBBB-CCCCC'},
        {keyIndex: 1, key: null, error: 'Humble did not provide a Steam key for this game.'},
        {keyIndex: 2, key: null, error: 'Humble did not provide a Steam key for this game.'},
        {keyIndex: 3, key: 'JJJJJ-KKKKK-LLLLL'},
    ]);
    assert.deepEqual(harness.clicks, [0, 0, 0, 0]);
});

test('Choice Get rows reveal once each and wait for the current replacement row before the next click', async () => {
    const {api} = loadApi(createFastPolling());
    const harness = createChoiceModalHarness(api, {
        rowDefinitions: [
            {
                state: 'ready',
                onClick({definition, events}) {
                    queueMicrotask(() => {
                        definition.state = 'redeemed';
                        definition.keys = ['AAAAA-BBBBB-CCCCC'];
                        events.push('settle:0');
                    });
                },
            },
            {
                state: 'ready',
                onClick({definition, events}) {
                    queueMicrotask(() => {
                        definition.state = 'redeemed';
                        definition.keys = ['DDDDD-EEEEE-FFFFF'];
                        events.push('settle:1');
                    });
                },
            },
        ],
    });

    const outcomes = await api.revealChoiceSteamKeys(harness.tile, {
        skipIndexes: new Set(),
    });

    assert.deepEqual(JSON.parse(JSON.stringify(outcomes)), [
        {keyIndex: 0, key: 'AAAAA-BBBBB-CCCCC'},
        {keyIndex: 1, key: 'DDDDD-EEEEE-FFFFF'},
    ]);
    assert.deepEqual(harness.clicks, [1, 1]);
    assert.deepEqual(harness.events, [
        'open',
        'click:0',
        'settle:0',
        'click:1',
        'settle:1',
        'close',
    ]);
    assert.ok(harness.rowQueries >= 5, 'replacement rows must be re-queried');
});

test('a terminal Choice row error is recorded and does not block a later sibling row', async () => {
    const {api} = loadApi(createFastPolling());
    const harness = createChoiceModalHarness(api, {
        rowDefinitions: [
            {
                state: 'ready',
                onClick({definition}) {
                    queueMicrotask(() => { definition.state = 'error'; });
                },
            },
            {
                state: 'ready',
                onClick({definition}) {
                    queueMicrotask(() => {
                        definition.state = 'redeemed';
                        definition.keys = ['DDDDD-EEEEE-FFFFF'];
                    });
                },
            },
        ],
    });

    const outcomes = await api.revealChoiceSteamKeys(harness.tile, {
        skipIndexes: new Set(),
    });

    assert.equal(outcomes[0].keyIndex, 0);
    assert.equal(outcomes[0].key, null);
    assert.match(outcomes[0].error, /Humble/);
    assert.deepEqual(JSON.parse(JSON.stringify(outcomes[1])), {
        keyIndex: 1,
        key: 'DDDDD-EEEEE-FFFFF',
    });
    assert.deepEqual(harness.clicks, [1, 1]);
});

test('prior-success Choice slots are neither read nor clicked and return no outcome', async () => {
    const {api} = loadApi(createFastPolling());
    const harness = createChoiceModalHarness(api, {
        rowDefinitions: [
            {state: 'redeemed', keys: ['AAAAA-BBBBB-CCCCC']},
            {state: 'redeemed', keys: ['DDDDD-EEEEE-FFFFF']},
        ],
    });

    const outcomes = await api.revealChoiceSteamKeys(harness.tile, {
        skipIndexes: new Set([0]),
    });

    assert.deepEqual(JSON.parse(JSON.stringify(outcomes)), [
        {keyIndex: 1, key: 'DDDDD-EEEEE-FFFFF'},
    ]);
    assert.equal(harness.reads[0], 0);
    assert.equal(harness.clicks[0], 0);
});

test('missing or disabled Choice reveal controls fail locally without clicking siblings early', async () => {
    const {api} = loadApi(createFastPolling());
    const harness = createChoiceModalHarness(api, {
        rowDefinitions: [
            {state: 'ready', hasControl: false},
            {state: 'ready', controlDisabled: true},
            {
                state: 'ready',
                onClick({definition}) {
                    queueMicrotask(() => {
                        definition.state = 'redeemed';
                        definition.keys = ['AAAAA-BBBBB-CCCCC'];
                    });
                },
            },
        ],
    });

    const outcomes = await api.revealChoiceSteamKeys(harness.tile, {
        skipIndexes: new Set(),
    });

    assert.equal(outcomes[0].key, null);
    assert.equal(outcomes[1].key, null);
    assert.equal(outcomes[2].key, 'AAAAA-BBBBB-CCCCC');
    assert.deepEqual(harness.clicks, [0, 0, 1]);
});

test('a pre-existing global Choice claim error fails every row without a reveal click', async () => {
    const {api} = loadApi(createFastPolling());
    const harness = createChoiceModalHarness(api, {
        rowDefinitions: [
            {state: 'ready'},
            {state: 'ready'},
        ],
    });
    harness.setGlobalError();

    const outcomes = await api.revealChoiceSteamKeys(harness.tile, {
        skipIndexes: new Set(),
    });

    assert.deepEqual(
        JSON.parse(JSON.stringify(outcomes.map(outcome => outcome.keyIndex))),
        [0, 1]
    );
    assert.deepEqual(harness.clicks, [0, 0]);
});

test('Choice reveal waits for a delayed non-empty row baseline', async () => {
    const {api} = loadApi(createFastPolling());
    const harness = createChoiceModalHarness(api, {
        rowsAvailableAfterQueries: 3,
        rowDefinitions: [{
            state: 'redeemed',
            keys: ['AAAAA-BBBBB-CCCCC'],
        }],
    });

    const outcomes = await api.revealChoiceSteamKeys(harness.tile, {
        skipIndexes: new Set(),
    });

    assert.ok(harness.rowQueries >= 4);
    assert.deepEqual(JSON.parse(JSON.stringify(outcomes)), [
        {keyIndex: 0, key: 'AAAAA-BBBBB-CCCCC'},
    ]);
    assert.deepEqual(harness.clicks, [0]);
});

test('Choice baseline waiting stops on a global claim error before rows appear', async () => {
    const {api} = loadApi(createFastPolling());
    const harness = createChoiceModalHarness(api, {
        rowsAvailableAfterQueries: 5,
        rowDefinitions: [{
            state: 'ready',
            onRowsQueried({rowQueries, setGlobalError}) {
                if (rowQueries === 2) setGlobalError();
            },
        }],
    });

    const outcomes = await api.revealChoiceSteamKeys(harness.tile, {
        skipIndexes: new Set(),
    });

    assert.equal(harness.rowQueries, 2);
    assert.deepEqual(JSON.parse(JSON.stringify(outcomes)), [{
        keyIndex: 0,
        key: null,
        error: 'Humble did not provide a Steam key for this game.',
    }]);
    assert.deepEqual(harness.clicks, [0]);
});

test('same-count Choice row root replacement or reorder is fatal', async t => {
    for (const change of ['replace', 'reorder']) {
        await t.test(change, async () => {
            const {api} = loadApi(createFastPolling());
            const harness = createChoiceModalHarness(api, {
                rowDefinitions: [
                    {
                        state: 'redeemed',
                        keys: ['AAAAA-BBBBB-CCCCC'],
                        onRowsQueried({replaceRowRoot, rowQueries, swapRowRoots}) {
                            if (rowQueries !== 3) return;
                            if (change === 'replace') replaceRowRoot(1);
                            else swapRowRoots(0, 1);
                        },
                    },
                    {
                        state: 'ready',
                        onClick({definition}) {
                            queueMicrotask(() => {
                                definition.state = 'redeemed';
                                definition.keys = ['DDDDD-EEEEE-FFFFF'];
                            });
                        },
                    },
                ],
            });

            const outcomes = await api.revealChoiceSteamKeys(harness.tile, {
                skipIndexes: new Set(),
            });

            assert.deepEqual(JSON.parse(JSON.stringify(outcomes)), [
                {keyIndex: 0, key: 'AAAAA-BBBBB-CCCCC'},
                {
                    keyIndex: 1,
                    key: null,
                    error: 'Humble did not provide a Steam key for this game.',
                },
            ]);
            assert.deepEqual(harness.clicks, [0, 0]);
        });
    }
});

test('an out-of-range prior-success Choice slot fails closed without reading or clicking rows', async () => {
    const {api} = loadApi(createFastPolling());
    const harness = createChoiceModalHarness(api, {
        rowDefinitions: [
            {state: 'redeemed', keys: ['AAAAA-BBBBB-CCCCC']},
            {state: 'redeemed', keys: ['DDDDD-EEEEE-FFFFF']},
        ],
    });

    const outcomes = await api.revealChoiceSteamKeys(harness.tile, {
        skipIndexes: new Set([0, 1, 2]),
    });

    assert.deepEqual(JSON.parse(JSON.stringify(outcomes)), [{
        keyIndex: 3,
        key: null,
        error: 'Humble did not provide a Steam key for this game.',
    }]);
    assert.deepEqual(harness.reads, [0, 0]);
    assert.deepEqual(harness.clicks, [0, 0]);
});

test('global, timeout, modal-identity, and row-count failures stop clicks and fail every remaining slot', async t => {
    const cases = [
        {
            name: 'global error',
            onClick({setGlobalError}) {
                queueMicrotask(() => setGlobalError());
            },
        },
        {name: 'sustained timeout', onClick() {}},
        {
            name: 'modal identity change',
            onClick({createReplacementModal, setActiveModal}) {
                queueMicrotask(() => setActiveModal(createReplacementModal()));
            },
        },
        {
            name: 'row-count change',
            onClick({definitions}) {
                queueMicrotask(() => definitions.pop());
            },
        },
    ];

    for (const scenario of cases) {
        await t.test(scenario.name, async () => {
            const polling = createFastPolling();
            const {api} = loadApi(polling);
            let clickedAt = null;
            const harness = createChoiceModalHarness(api, {
                rowDefinitions: [
                    {
                        state: 'ready',
                        onClick(context) {
                            clickedAt = polling.currentTime();
                            scenario.onClick(context);
                        },
                    },
                    {state: 'ready'},
                    {state: 'ready'},
                ],
            });

            const outcomes = await api.revealChoiceSteamKeys(harness.tile, {
                skipIndexes: new Set([1]),
            });

            assert.deepEqual(
                JSON.parse(JSON.stringify(outcomes.map(outcome => outcome.keyIndex))),
                [0, 2]
            );
            assert.ok(outcomes.every(outcome => outcome.key === null && outcome.error));
            assert.equal(harness.clicks[0], 1);
            assert.equal(harness.clicks[1], 0);
            assert.equal(harness.clicks[2] || 0, 0);
            assert.ok(harness.rowQueries >= 2, 'row count must be polled');
            assert.ok(harness.modalChecks >= 2, 'modal identity must be polled');
            if (scenario.name === 'sustained timeout') {
                const elapsed = polling.currentTime() - clickedAt;
                assert.ok(elapsed >= 60000, `timeout ended after only ${elapsed}ms`);
                assert.ok(elapsed <= 65000, `timeout exceeded the boundary: ${elapsed}ms`);
            }
        });
    }
});

test('a different-title replacement modal remains an unsafe identity change', async () => {
    const {api} = loadApi(createFastPolling());
    const harness = createChoiceModalHarness(api, {
        rowDefinitions: [{
            state: 'ready',
            onClick({createReplacementModal, setActiveModal}) {
                queueMicrotask(() => setActiveModal(createReplacementModal({
                    replacementTitle: 'Different game',
                })));
            },
        }],
    });

    await assert.rejects(
        api.revealChoiceSteamKeys(harness.tile, {skipIndexes: new Set()}),
        /Could not safely close/
    );

    assert.deepEqual(harness.clicks, [1]);
    assert.equal(harness.events.includes('close:replacement'), false);
});

test('a wrong-title modal from the initial Choice click is unsafe and remains open', async () => {
    const {api} = loadApi(createFastPolling());
    const harness = createChoiceModalHarness(api, {
        title: 'Expected game',
        modalTitle: 'Different game',
        rowDefinitions: [{state: 'ready'}],
    });

    await assert.rejects(
        api.revealChoiceSteamKeys(harness.tile, {skipIndexes: new Set()}),
        /Could not safely close/
    );

    assert.equal(harness.events.includes('close'), false);
    assert.equal(api.getTestDocument().elements.get('site-modal'), harness.modal);
});

test('one Choice tile with three row outcomes creates three unique flat v2 items', async () => {
    const {api} = loadApi();
    const result = await api.runChoiceCollectionWork(
        [{id: 'game/one', title: 'Game one'}],
        {
            lockManager: immediateLockManager,
            owner: 'collector',
            revealKeys: async () => [
                {keyIndex: 0, key: 'AAAAA-BBBBB-CCCCC'},
                {
                    keyIndex: 1,
                    key: null,
                    error: 'Humble did not provide a Steam key for this game.',
                },
                {keyIndex: 2, key: 'DDDDD-EEEEE-FFFFF'},
            ],
        }
    );

    assert.equal(result.started, true);
    assert.equal(result.pendingCount, 2);
    assert.equal(result.batch.version, 2);
    assert.equal(result.batch.items.length, 3);
    assert.deepEqual(
        JSON.parse(JSON.stringify(result.batch.items.map(item => item.id))),
        [
            'hb-helper-key-v1:0:game%2Fone',
            'hb-helper-key-v1:1:game%2Fone',
            'hb-helper-key-v1:2:game%2Fone',
        ]
    );
    assert.deepEqual(
        JSON.parse(JSON.stringify(
            result.batch.items.map(item => Object.keys(item).sort().join(','))
        )),
        ['id,key,status,title', 'error,id,key,status,title', 'id,key,status,title']
    );
    assert.equal(api.getChoiceActivationBatchForTest(result.batch)?.items.length, 3);
});

test('retry carries only activated composite slots and reveals only prior failed indexes', async () => {
    const {api} = loadApi();
    api.setChoiceActivationBatchForTest(completedBatch([
        {
            id: 'hb-helper-key-v1:0:retry-game',
            title: 'Old title',
            key: null,
            status: 'activated',
        },
        {
            id: 'hb-helper-key-v1:1:retry-game',
            title: 'Old title',
            key: 'OLDFA-ILEDK-EY000',
            status: 'steam-activation-failed',
            error: 'old failure',
            code: 9,
        },
        {
            id: 'hb-helper-key-v1:2:retry-game',
            title: 'Old title',
            key: null,
            status: 'activated',
        },
    ]));
    let observedSkipIndexes;
    let collectingMarkers;

    const result = await api.runChoiceCollectionWork(
        [{id: 'retry-game', title: 'Current title'}],
        {
            lockManager: immediateLockManager,
            owner: 'collector',
            revealKeys: async (item, {skipIndexes}) => {
                observedSkipIndexes = [...skipIndexes];
                collectingMarkers = api.getChoiceActivationBatchForTest();
                return [{keyIndex: 1, key: 'NEWKE-Y0000-11111'}];
            },
        }
    );

    assert.deepEqual(observedSkipIndexes, [0, 2]);
    assert.equal(collectingMarkers.state, 'collecting');
    assert.deepEqual(
        collectingMarkers.items.map(item => ({
            id: item.id,
            title: item.title,
            key: item.key,
            status: item.status,
        })),
        [
            {
                id: 'hb-helper-key-v1:0:retry-game',
                title: 'Current title',
                key: null,
                status: 'activated',
            },
            {
                id: 'hb-helper-key-v1:2:retry-game',
                title: 'Current title',
                key: null,
                status: 'activated',
            },
        ]
    );
    assert.equal(
        result.batch.items.some(item => item.key === 'OLDFA-ILEDK-EY000'),
        false
    );
    assert.equal(result.batch.items.find(item => item.id.includes(':1:')).key, 'NEWKE-Y0000-11111');
});

test('two partial retries preserve cumulative success markers', async () => {
    const {api} = loadApi();
    api.setChoiceActivationBatchForTest(completedBatch([
        {
            id: 'hb-helper-key-v1:0:cumulative-game',
            title: 'Cumulative game',
            key: null,
            status: 'activated',
        },
        {
            id: 'hb-helper-key-v1:1:cumulative-game',
            title: 'Cumulative game',
            key: null,
            status: 'humble-key-retrieval-failed',
            error: 'first failure',
        },
        {
            id: 'hb-helper-key-v1:2:cumulative-game',
            title: 'Cumulative game',
            key: null,
            status: 'humble-key-retrieval-failed',
            error: 'second failure',
        },
    ], 'retry-zero'));
    let firstSkips;
    const first = await api.runChoiceCollectionWork(
        [{id: 'cumulative-game', title: 'Cumulative game'}],
        {
            lockManager: immediateLockManager,
            owner: 'first-retry',
            revealKeys: async (item, {skipIndexes}) => {
                firstSkips = [...skipIndexes];
                return [
                    {keyIndex: 1, key: 'AAAAA-BBBBB-CCCCC'},
                    {keyIndex: 2, key: null, error: 'still failed'},
                ];
            },
        }
    );
    assert.deepEqual(firstSkips, [0]);

    const afterFirst = JSON.parse(JSON.stringify(first.batch));
    afterFirst.id = 'retry-one-complete';
    afterFirst.state = 'complete';
    afterFirst.runner = {phase: null, owner: null, leaseExpiresAt: null};
    afterFirst.ownershipRefresh = {
        state: 'complete',
        owner: null,
        leaseExpiresAt: null,
        error: null,
    };
    const newlyActivated = afterFirst.items.find(item => item.id.includes(':1:'));
    newlyActivated.status = 'activated';
    newlyActivated.key = null;
    api.setChoiceActivationBatchForTest(afterFirst);

    let secondSkips;
    const second = await api.runChoiceCollectionWork(
        [{id: 'cumulative-game', title: 'Cumulative game'}],
        {
            lockManager: immediateLockManager,
            owner: 'second-retry',
            revealKeys: async (item, {skipIndexes}) => {
                secondSkips = [...skipIndexes];
                return [{keyIndex: 2, key: 'DDDDD-EEEEE-FFFFF'}];
            },
        }
    );

    assert.deepEqual(secondSkips, [0, 1]);
    assert.deepEqual(
        JSON.parse(JSON.stringify(second.batch.items.map(item => ({
            keyIndex: api.decodeChoiceActivationItemId(item.id).keyIndex,
            status: item.status,
            key: item.key,
        })).sort((left, right) => left.keyIndex - right.keyIndex))),
        [
            {keyIndex: 0, status: 'activated', key: null},
            {keyIndex: 1, status: 'activated', key: null},
            {keyIndex: 2, status: 'pending-steam-activation', key: 'DDDDD-EEEEE-FFFFF'},
        ]
    );
});

test('an all-activated composite group completes without opening its modal', async () => {
    const {api} = loadApi();
    api.setChoiceActivationBatchForTest(completedBatch([
        {
            id: 'hb-helper-key-v1:1:complete-game',
            title: 'Complete game',
            key: null,
            status: 'activated',
        },
        {
            id: 'hb-helper-key-v1:0:complete-game',
            title: 'Complete game',
            key: null,
            status: 'activated',
        },
    ]));
    let revealCalls = 0;
    let activationCalls = 0;
    const tile = {click() { assert.fail('known-complete modal must not open'); }};

    const result = await api.runDirectChoiceActivation(
        [{id: 'complete-game', title: 'Complete game', tile}],
        {
            syncSession: async () => authenticatedState('live-session'),
            collectionOptions: {
                lockManager: immediateLockManager,
                owner: 'collector',
                revealKeys: async () => { revealCalls += 1; },
            },
            activationWork: async () => { activationCalls += 1; },
        }
    );

    assert.equal(revealCalls, 0);
    assert.equal(activationCalls, 0);
    assert.equal(result.started, true);
    assert.equal(result.pendingCount, 0);
    assert.equal(result.batch.state, 'complete');
    assert.equal(result.batch.items.length, 2);
    assert.ok(result.batch.items.every(item => item.status === 'activated' && item.key === null));
    assert.ok(api.getChoiceActivationBatchForTest(result.batch));
});

test('a legacy activated ID skips slot zero but still opens the modal to discover siblings', async () => {
    const {api} = loadApi();
    api.setChoiceActivationBatchForTest(completedBatch([
        {id: 'legacy-game', title: 'Legacy game', key: null, status: 'activated'},
    ]));
    let revealCalls = 0;
    let observedSkips;

    const result = await api.runChoiceCollectionWork(
        [{id: 'legacy-game', title: 'Legacy current title'}],
        {
            lockManager: immediateLockManager,
            owner: 'collector',
            revealKeys: async (item, {skipIndexes}) => {
                revealCalls += 1;
                observedSkips = [...skipIndexes];
                return [{keyIndex: 1, key: 'AAAAA-BBBBB-CCCCC'}];
            },
        }
    );

    assert.equal(revealCalls, 1);
    assert.deepEqual(observedSkips, [0]);
    assert.deepEqual(
        JSON.parse(JSON.stringify(result.batch.items.map(item => item.id))),
        [
            'hb-helper-key-v1:0:legacy-game',
            'hb-helper-key-v1:1:legacy-game',
        ]
    );
});

test('active Choice ownership refresh states keep collection busy without writes or reveals', async t => {
    for (const refreshState of ['pending', 'refreshing']) {
        await t.test(refreshState, async () => {
            const {api, values} = loadApi();
            const activeBatch = completedBatch([{
                id: 'hb-helper-key-v1:0:refresh-game',
                title: 'Refresh game',
                key: null,
                status: 'humble-key-retrieval-failed',
                error: 'previous failure',
            }], `active-${refreshState}`);
            activeBatch.ownershipRefresh = refreshState === 'refreshing'
                ? {
                    state: 'refreshing',
                    owner: 'refresh-owner',
                    leaseExpiresAt: 60000,
                    error: null,
                }
                : {
                    state: 'pending',
                    owner: null,
                    leaseExpiresAt: null,
                    error: null,
                };
            api.setChoiceActivationBatchForTest(activeBatch);
            const originalSet = values.set.bind(values);
            let writes = 0;
            values.set = (name, value) => {
                if (name === 'hb-helper-steam-activation-batch-v2') writes += 1;
                return originalSet(name, value);
            };
            let revealCalls = 0;

            const result = await api.runChoiceCollectionWork(
                [{id: 'refresh-game', title: 'Refresh game'}],
                {
                    lockManager: immediateLockManager,
                    owner: 'new-collector',
                    revealKeys: async () => {
                        revealCalls += 1;
                        return [{keyIndex: 0, key: 'AAAAA-BBBBB-CCCCC'}];
                    },
                }
            );

            assert.equal(result.started, false);
            assert.equal(result.busy, true);
            assert.equal(revealCalls, 0);
            assert.equal(writes, 0);
            assert.deepEqual(api.getChoiceActivationBatchForTest(), activeBatch);
        });
    }
});

test('an in-flight Choice ownership refresh cannot interleave with a new collection batch', async () => {
    const {api} = loadApi();
    const oldBatch = completedBatch([{
        id: 'hb-helper-key-v1:0:interleaved-game',
        title: 'Interleaved game',
        key: null,
        status: 'humble-key-retrieval-failed',
        error: 'previous failure',
    }], 'old-refresh-batch');
    oldBatch.ownershipRefresh.state = 'pending';
    api.setChoiceActivationBatchForTest(oldBatch);
    let signalRefreshStarted;
    const refreshStarted = new Promise(resolve => { signalRefreshStarted = resolve; });
    let releaseRefresh;
    const refreshCanFinish = new Promise(resolve => { releaseRefresh = resolve; });
    const refreshRun = api.reconcileChoiceActivationBatch(undefined, {
        refreshBatch: async batch => {
            const claimed = JSON.parse(JSON.stringify(batch));
            claimed.ownershipRefresh = {
                state: 'refreshing',
                owner: 'old-refresh-owner',
                leaseExpiresAt: 60000,
                error: null,
            };
            api.setChoiceActivationBatchForTest(claimed);
            signalRefreshStarted();
            await refreshCanFinish;
            const latest = api.getChoiceActivationBatchForTest();
            if (latest?.id !== batch.id) return {refreshed: false, stopped: true};
            const finished = JSON.parse(JSON.stringify(latest));
            finished.ownershipRefresh = {
                state: 'complete',
                owner: null,
                leaseExpiresAt: null,
                error: null,
            };
            api.setChoiceActivationBatchForTest(finished);
            return {refreshed: true};
        },
    });
    await refreshStarted;
    let revealCalls = 0;

    const collection = await api.runChoiceCollectionWork(
        [{id: 'interleaved-game', title: 'Interleaved game'}],
        {
            lockManager: immediateLockManager,
            owner: 'new-collector',
            revealKeys: async () => {
                revealCalls += 1;
                return [{keyIndex: 0, key: 'AAAAA-BBBBB-CCCCC'}];
            },
        }
    );
    releaseRefresh();
    await refreshRun;

    assert.equal(collection.started, false);
    assert.equal(collection.busy, true);
    assert.equal(revealCalls, 0);
    assert.equal(api.getChoiceActivationBatchForTest().id, 'old-refresh-batch');
    assert.equal(
        api.getChoiceActivationBatchForTest().ownershipRefresh.state,
        'complete'
    );
});

test('an unsafe modal close discards buffered row outcomes and stops later tiles', async () => {
    const {api} = loadApi(createFastPolling());
    const persistedItemCounts = [];
    const observePersistedBatch = () => {
        persistedItemCounts.push(api.getChoiceActivationBatchForTest()?.items.length ?? -1);
    };
    const unsafe = createChoiceModalHarness(api, {
        title: 'Unsafe game',
        unsafeClose: true,
        rowDefinitions: [
            {
                state: 'redeemed',
                keys: ['AAAAA-BBBBB-CCCCC'],
                onRowsQueried: observePersistedBatch,
            },
            {
                state: 'redeemed',
                keys: ['DDDDD-EEEEE-FFFFF'],
                onRowsQueried: observePersistedBatch,
            },
        ],
    });
    const later = createChoiceModalHarness(api, {
        title: 'Later game',
        rowDefinitions: [{state: 'redeemed', keys: ['GGGGG-HHHHH-IIIII']}],
    });

    const result = await api.runChoiceCollectionWork(
        [
            {id: 'unsafe-game', title: 'Unsafe game', tile: unsafe.tile},
            {id: 'later-game', title: 'Later game', tile: later.tile},
        ],
        {lockManager: immediateLockManager, owner: 'collector'}
    );

    assert.equal(later.opened, 0);
    assert.equal(result.batch.items.length, 1);
    assert.deepEqual(JSON.parse(JSON.stringify(result.batch.items[0])), {
        id: 'hb-helper-key-v1:0:unsafe-game',
        title: 'Unsafe game',
        key: null,
        status: 'humble-key-retrieval-failed',
        error: 'Could not safely close the Humble details dialog for Unsafe game. The key was not queued.',
    });
    assert.equal(result.batch.items.some(item => item.key), false);
    assert.ok(persistedItemCounts.length > 0);
    assert.ok(persistedItemCounts.every(count => count === 0));
});

test('same-game row labels use the highest decoded slot in results, copy feedback, and signatures', () => {
    const {api} = loadApi();
    const document = api.getTestDocument();
    const batch = completedBatch([
        {
            id: 'hb-helper-key-v1:0:label-game',
            title: 'Label game',
            key: null,
            status: 'humble-key-retrieval-failed',
            error: 'row failed',
        },
        {
            id: 'hb-helper-key-v1:1:label-game',
            title: 'Label game',
            key: 'AAAAA-BBBBB-CCCCC',
            status: 'steam-activation-failed',
            error: 'Steam failed',
            code: 9,
        },
        {
            id: 'hb-helper-key-v1:2:label-game',
            title: 'Label game',
            key: null,
            status: 'activated',
        },
    ]);
    const results = document.createElement('div');
    results.id = 'hb-helper-choice-activation-results';
    document.body.appendChild(results);

    assert.deepEqual(
        batch.items.map(item => api.getChoiceActivationDisplayLabelForTest(batch, item)),
        [
            'Label game (key 1/3)',
            'Label game (key 2/3)',
            'Label game (key 3/3)',
        ]
    );
    assert.equal(
        api.getChoiceActivationDisplayLabelForTest(
            completedBatch([{id: 'single', title: 'Single', key: null, status: 'activated'}]),
            {id: 'single', title: 'Single'}
        ),
        'Single'
    );

    api.renderChoiceActivationResultsForTest(batch);
    assert.match(results.children[0].textContent, /^3 processed:/);
    assert.match(results.children[1].children[1].children[0].textContent, /Label game \(key 1\/3\)/);
    const steamFailureRow = results.children[2].children[1];
    assert.match(steamFailureRow.children[0].textContent, /Label game \(key 2\/3\)/);
    assert.equal(
        steamFailureRow.children[1].getAttribute('aria-label'),
        'Copy the failed Steam key for Label game (key 2/3)'
    );

    const signature = JSON.parse(api.getChoiceActivationResultsSignatureForTest(batch));
    assert.deepEqual(signature.failures.map(failure => failure.id), [
        'hb-helper-key-v1:0:label-game',
        'hb-helper-key-v1:1:label-game',
    ]);
    assert.deepEqual(signature.failures.map(failure => failure.title), [
        'Label game (key 1/3)',
        'Label game (key 2/3)',
    ]);
    const feedback = {textContent: ''};
    let copied;
    api.copySteamFailedKeyForTest(
        batch,
        batch.items[1],
        feedback,
        (key, type) => { copied = {key, type}; }
    );
    assert.deepEqual(copied, {key: 'AAAAA-BBBBB-CCCCC', type: 'text'});
    assert.equal(feedback.textContent, 'Copied the Steam key for Label game (key 2/3).');
    assert.equal(batch.items[1].title, 'Label game');

    const sparseBatch = completedBatch([
        {
            id: 'hb-helper-key-v1:0:sparse-game',
            title: 'Sparse game',
            key: null,
            status: 'activated',
        },
        {
            id: 'hb-helper-key-v1:2:sparse-game',
            title: 'Sparse game',
            key: null,
            status: 'humble-key-retrieval-failed',
            error: 'missing sibling',
        },
    ]);
    assert.deepEqual(
        sparseBatch.items.map(item =>
            api.getChoiceActivationDisplayLabelForTest(sparseBatch, item)
        ),
        ['Sparse game (key 1/3)', 'Sparse game (key 3/3)']
    );
});

test('Choice result signatures distinguish identical failures by raw slot ID', () => {
    const {api} = loadApi();
    const createFailureBatch = id => completedBatch([{
        id,
        title: 'Same title',
        key: null,
        status: 'humble-key-retrieval-failed',
        error: 'same failure',
    }]);
    const first = api.getChoiceActivationResultsSignatureForTest(
        createFailureBatch('hb-helper-key-v1:0:first-game')
    );
    const second = api.getChoiceActivationResultsSignatureForTest(
        createFailureBatch('hb-helper-key-v1:0:second-game')
    );

    assert.notEqual(first, second);
    assert.equal(
        JSON.parse(first).failures[0].id,
        'hb-helper-key-v1:0:first-game'
    );
});

test('Steam activation progress derives sibling labels without changing persisted titles', async () => {
    const {api} = loadApi();
    const batch = activationBatch([
        {
            id: 'hb-helper-key-v1:0:progress-game',
            title: 'Progress game',
            key: 'AAAAA-BBBBB-CCCCC',
        },
        {
            id: 'hb-helper-key-v1:1:progress-game',
            title: 'Progress game',
            key: 'DDDDD-EEEEE-FFFFF',
        },
    ]);
    const labels = [];

    await api.processSteamActivationBatch(
        batch,
        'live-session',
        async () => successResponse,
        () => true,
        (item, index, total, label) => labels.push(label)
    );

    assert.deepEqual(labels, [
        'Progress game (key 1/2)',
        'Progress game (key 2/2)',
    ]);
    assert.ok(batch.items.every(item => item.title === 'Progress game'));
});

test('Choice selection clears only when every decoded slot for that game activated', () => {
    const {api} = loadApi();
    const partialSelection = new Set(['same-game', 'other-game']);
    const partialBatch = completedBatch([
        {
            id: 'hb-helper-key-v1:0:same-game',
            title: 'Same game',
            key: null,
            status: 'activated',
        },
        {
            id: 'hb-helper-key-v1:1:same-game',
            title: 'Same game',
            key: 'AAAAA-BBBBB-CCCCC',
            status: 'steam-activation-failed',
            error: 'failed',
            code: 9,
        },
        {id: 'other-game', title: 'Other game', key: null, status: 'activated'},
    ]);

    api.reconcileChoiceSelectionFromBatchForTest(partialBatch, partialSelection);
    assert.deepEqual([...partialSelection], ['same-game']);

    const completedSelection = new Set(['same-game']);
    api.reconcileChoiceSelectionFromBatchForTest(completedBatch([
        {
            id: 'hb-helper-key-v1:0:same-game',
            title: 'Same game',
            key: null,
            status: 'activated',
        },
        {
            id: 'hb-helper-key-v1:1:same-game',
            title: 'Same game',
            key: null,
            status: 'activated',
        },
    ]), completedSelection);
    assert.deepEqual([...completedSelection], []);
});

test('collecting Choice success markers never clear a selection', () => {
    const {api} = loadApi();
    const selection = new Set(['same-game']);
    const collectingBatch = {
        version: 2,
        id: 'collecting-markers',
        state: 'collecting',
        runner: {
            phase: 'collecting',
            owner: 'collector',
            leaseExpiresAt: 60000,
        },
        ownershipRefresh: {
            state: 'waiting',
            owner: null,
            leaseExpiresAt: null,
            error: null,
        },
        items: [{
            id: 'hb-helper-key-v1:0:same-game',
            title: 'Same game',
            key: null,
            status: 'activated',
        }],
    };

    const changed = api.reconcileChoiceSelectionFromBatchForTest(
        collectingBatch,
        selection
    );

    assert.equal(changed, false);
    assert.deepEqual([...selection], ['same-game']);
});

test('Choice activation UI is available only for an authenticated Steam snapshot', () => {
    const {api} = loadApi();
    const document = api.getTestDocument();
    const tile = {
        classList: createTestClassList(),
        dataset: {id: 'choice-1'},
        getAttribute() { return null; },
        getClientRects() { return [{}]; },
        querySelector() { return null; },
        textContent: 'Choice game',
    };
    document.choiceTiles = [tile];
    api.setSteamDerivedStateForTest(authenticatedState('live-session').account);
    api.renderChoiceSelectionStateForTest();
    assert.equal(tile.classList.contains('hb-helper-choice-selected'), true);

    api.setSteamSessionStateForTest({
        ...authenticatedState('live-session'),
        status: 'syncing',
    });
    api.renderChoiceSelectionStateForTest();
    assert.equal(api.isChoiceActivationUiAvailable(), false);
    assert.equal(tile.classList.contains('hb-helper-choice-selected'), false);

    api.setSteamSessionStateForTest(authenticatedState('live-session'));
    api.renderChoiceSelectionStateForTest();
    assert.equal(api.isChoiceActivationUiAvailable(), true);
    assert.equal(tile.classList.contains('hb-helper-choice-selected'), true);

    api.setSteamSessionStateForTest({status: 'logged-out', account: null, error: null});
    api.renderChoiceSelectionStateForTest();
    assert.equal(api.isChoiceActivationUiAvailable(), false);
    assert.equal(tile.classList.contains('hb-helper-choice-selected'), false);
});

test('an unauthenticated transition removes Choice controls and failed-key results without an insertion point', () => {
    const {api} = loadApi();
    const document = api.getTestDocument();
    const failedKeyResults = {textContent: 'AAAAA-BBBBB-CCCCC'};
    const controls = {
        remove() {
            document.elements.delete('hb-helper-choice-activation-controls');
            document.elements.delete('hb-helper-choice-activation-results');
        },
    };
    document.elements.set('hb-helper-choice-activation-controls', controls);
    document.elements.set('hb-helper-choice-activation-results', failedKeyResults);
    assert.equal(document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, div').length, 0);

    api.applySteamSessionState({status: 'logged-out', account: null, error: null});

    assert.equal(
        document.getElementById('hb-helper-choice-activation-controls'),
        null
    );
    assert.equal(
        document.getElementById('hb-helper-choice-activation-results'),
        null
    );
});

test('an exact authenticated transition recreates Choice controls and restores results', () => {
    const {api} = loadApi();
    const document = api.getTestDocument();
    const heading = document.createElement('h2');
    heading.textContent = 'YOUR GAMES';
    document.body.appendChild(heading);
    document.textAnchors = [heading];
    document.choiceTiles = [{
        classList: createTestClassList(),
        dataset: {id: 'choice-1'},
        getAttribute() { return null; },
        getClientRects() { return [{}]; },
        querySelector() { return null; },
        textContent: 'Choice game',
    }];
    api.setChoiceActivationBatchForTest({
        version: 2,
        id: 'completed-batch',
        state: 'complete',
        runner: {phase: null, owner: null, leaseExpiresAt: null},
        ownershipRefresh: {
            state: 'complete',
            owner: null,
            leaseExpiresAt: null,
            error: null,
        },
        items: [{
            id: 'choice-1',
            title: 'Choice game',
            key: 'AAAAA-BBBBB-CCCCC',
            status: 'steam-activation-failed',
            error: 'already owned',
        }],
    });
    assert.ok(api.getChoiceActivationBatchForTest());

    api.applySteamSessionState(authenticatedState('live-session'));
    const firstControls = document.getElementById('hb-helper-choice-activation-controls');
    const firstResults = document.getElementById('hb-helper-choice-activation-results');
    assert.ok(firstControls);
    assert.ok(firstResults);

    api.applySteamSessionState({status: 'logged-out', account: null, error: null});
    assert.equal(document.getElementById('hb-helper-choice-activation-controls'), null);
    assert.equal(document.getElementById('hb-helper-choice-activation-results'), null);

    api.applySteamSessionState(authenticatedState('live-session'));
    const restoredControls = document.getElementById('hb-helper-choice-activation-controls');
    const restoredResults = document.getElementById('hb-helper-choice-activation-results');
    assert.ok(restoredControls);
    assert.ok(restoredResults);
    assert.notEqual(restoredControls, firstControls);
    assert.notEqual(restoredResults, firstResults);
    assert.ok(api.getChoiceActivationBatchForTest());
});

test('forces Steam session synchronization before collecting or activating keys', async () => {
    const {api} = loadApi();
    const events = [];
    const result = await api.runDirectChoiceActivation(
        [{id: 'one', title: 'One'}],
        {
            syncSession: async options => {
                events.push(['sync', options]);
                return authenticatedState('fresh-session');
            },
            collectWork: async () => {
                events.push(['collect']);
                return {started: true, pendingCount: 1, batch: {id: 'batch-1'}};
            },
            activationWork: async options => {
                events.push(['activate', options.sessionId]);
                return {processed: true};
            },
        }
    );

    assert.equal(result.processed, true);
    assert.deepEqual(JSON.parse(JSON.stringify(events)), [
        ['sync', {force: true}],
        ['collect'],
        ['activate', 'fresh-session'],
    ]);
});

test('does not reveal keys or create a batch when the forced session sync is unauthenticated', async () => {
    const {api, values} = loadApi();
    let collectionCalls = 0;
    const result = await api.runDirectChoiceActivation(
        [{id: 'one', title: 'One'}],
        {
            syncSession: async () => ({status: 'logged-out', account: null, error: null}),
            collectWork: async () => { collectionCalls += 1; },
        }
    );

    assert.equal(result.authenticationRequired, true);
    assert.equal(collectionCalls, 0);
    assert.equal(values.has('hb-helper-steam-activation-batch-v2'), false);
});

test('submits Steam keys sequentially to ajaxregisterkey with the in-memory session ID', async () => {
    const requests = [];
    const {api} = loadApi({
        onRequest(options) {
            requests.push(options);
            setTimeout(() => options.onload({
                status: 200,
                response: successResponse,
                responseText: '',
            }), 0);
        },
    });
    const batch = activationBatch([
        {
            id: 'hb-helper-key-v1:0:serial-game',
            title: 'Serial game',
            key: 'AAAAA-BBBBB-CCCCC',
        },
        {
            id: 'hb-helper-key-v1:1:serial-game',
            title: 'Serial game',
            key: 'DDDDD-EEEEE-FFFFF',
        },
    ]);
    let activeRequests = 0;
    let maxActiveRequests = 0;
    const activateKey = async (sessionId, key) => {
        activeRequests += 1;
        maxActiveRequests = Math.max(maxActiveRequests, activeRequests);
        try {
            return await api.postSteamActivationKey(sessionId, key);
        } finally {
            activeRequests -= 1;
        }
    };

    await api.processSteamActivationBatch(
        batch,
        'live-session',
        activateKey,
        () => true
    );

    assert.equal(maxActiveRequests, 1);
    assert.equal(requests.length, 2);
    assert.ok(requests.every(request =>
        request.url === 'https://store.steampowered.com/account/ajaxregisterkey/'
    ));
    assert.deepEqual(
        requests.map(request => Object.fromEntries(new URLSearchParams(request.data))),
        [
            {product_key: 'AAAAA-BBBBB-CCCCC', sessionid: 'live-session'},
            {product_key: 'DDDDD-EEEEE-FFFFF', sessionid: 'live-session'},
        ]
    );
});

test('continues after an item-local Steam product failure', async () => {
    const {api} = loadApi();
    const submitted = [];
    const batch = activationBatch([
        {
            id: 'hb-helper-key-v1:0:sibling-game',
            title: 'Sibling game',
            key: 'AAAAA-BBBBB-CCCCC',
        },
        {
            id: 'hb-helper-key-v1:1:sibling-game',
            title: 'Sibling game',
            key: 'DDDDD-EEEEE-FFFFF',
        },
    ]);

    await api.processSteamActivationBatch(
        batch,
        'live-session',
        async (sessionId, key) => {
            submitted.push(key);
            return key.startsWith('AAAAA')
                ? {purchase_result_details: 9, purchase_receipt_info: {}}
                : successResponse;
        },
        () => true
    );

    assert.deepEqual(submitted, ['AAAAA-BBBBB-CCCCC', 'DDDDD-EEEEE-FFFFF']);
    assert.equal(batch.items[0].status, 'steam-activation-failed');
    assert.equal(batch.items[0].code, 9);
    assert.equal(batch.items[1].status, 'activated');
});

test('rechecks the live Steam session after transport or invalid-response failures', async () => {
    const {api} = loadApi();
    for (const failedResponse of [
        () => { throw new Error('network down'); },
        () => ({}),
        () => ({purchase_result_details: 0}),
        () => ({purchase_result_details: null}),
    ]) {
        const batch = activationBatch([
            {id: 'one', title: 'One', key: 'AAAAA-BBBBB-CCCCC'},
            {id: 'two', title: 'Two', key: 'DDDDD-EEEEE-FFFFF'},
        ]);
        let syncCalls = 0;
        const submissions = [];
        await api.processSteamActivationBatch(
            batch,
            'live-session',
            async (sessionId, key) => {
                submissions.push([sessionId, key]);
                return submissions.length === 1 ? failedResponse() : successResponse;
            },
            () => true,
            () => {},
            {
                recheckSession: async options => {
                    syncCalls += 1;
                    assert.equal(options.force, true);
                    return authenticatedState('renewed-session');
                },
            }
        );
        assert.equal(syncCalls, 1);
        assert.deepEqual(submissions, [
            ['live-session', 'AAAAA-BBBBB-CCCCC'],
            ['renewed-session', 'DDDDD-EEEEE-FFFFF'],
        ]);
        assert.equal(batch.items[0].status, 'steam-activation-failed');
        assert.equal(batch.items[1].status, 'activated');
    }
});

test('logged-out or unverifiable sessions mark in-flight work uncertain and cancel the rest', async () => {
    const {api} = loadApi();
    for (const recheckSession of [
        async () => ({status: 'logged-out', account: null, error: null}),
        async () => ({
            status: 'error',
            account: null,
            error: new Error('cannot verify'),
        }),
        async () => { throw new Error('sync crashed'); },
    ]) {
        const batch = activationBatch([
            {id: 'one', title: 'One', key: 'AAAAA-BBBBB-CCCCC'},
            {id: 'two', title: 'Two', key: 'DDDDD-EEEEE-FFFFF'},
        ]);
        let submissions = 0;

        const result = await api.processSteamActivationBatch(
            batch,
            'live-session',
            async () => {
                submissions += 1;
                throw new Error('network down');
            },
            () => true,
            () => {},
            {recheckSession}
        );

        assert.equal(submissions, 1);
        assert.equal(result.stopped, true);
        assert.equal(batch.state, 'complete');
        assert.match(batch.items[0].error, /uncertain/i);
        assert.match(batch.items[1].error, /cancelled|not submitted/i);
        assert.equal(batch.items[0].code, null);
        assert.equal(batch.items[1].code, null);
        assert.equal(batch.items[0].key, 'AAAAA-BBBBB-CCCCC');
        assert.equal(batch.items[1].key, 'DDDDD-EEEEE-FFFFF');
    }
});

test('cancels an interrupted batch only after acquiring the activation Web Lock', async () => {
    let lockHeld = false;
    const writes = [];
    const {api, values} = loadApi();
    const batch = activationBatch([
        {
            id: 'hb-helper-key-v1:0:interrupted-game',
            title: 'Interrupted game',
            key: 'AAAAA-BBBBB-CCCCC',
            status: 'activating',
        },
        {
            id: 'hb-helper-key-v1:1:interrupted-game',
            title: 'Interrupted game',
            key: 'DDDDD-EEEEE-FFFFF',
        },
    ], 'previous-page');
    api.setChoiceActivationBatchForTest(batch);
    const originalSet = values.set.bind(values);
    values.set = (name, value) => {
        if (name === 'hb-helper-steam-activation-batch-v2') writes.push(lockHeld);
        return originalSet(name, value);
    };

    await api.runSteamActivationWork({
        owner: 'reloaded-page',
        sessionId: 'live-session',
        lockManager: {
            async request(name, options, callback) {
                lockHeld = true;
                try {
                    return await callback({name});
                } finally {
                    lockHeld = false;
                }
            },
        },
        activateKey: async () => assert.fail('interrupted work must not be submitted'),
    });

    assert.ok(writes.length > 0);
    assert.ok(writes.every(Boolean));
    const stored = api.getChoiceActivationBatchForTest();
    assert.equal(stored.state, 'complete');
    assert.match(stored.items[0].error, /uncertain/i);
    assert.match(stored.items[1].error, /cancelled|not submitted/i);
});

test('a foreign tab leaves an unexpired collection-to-activation handoff untouched', async () => {
    const {api} = loadApi();
    const batch = activationBatch([
        {
            id: 'hb-helper-key-v1:0:handoff-game',
            title: 'Handoff game',
            key: 'AAAAA-BBBBB-CCCCC',
        },
    ], 'originating-tab');
    batch.runner.leaseExpiresAt = 2000;
    const lockManager = {
        request(name, options, callback) {
            return callback({name});
        },
    };
    let handoffPublished;
    const published = new Promise(resolve => { handoffPublished = resolve; });
    let releaseCollection;
    const collectionCanReturn = new Promise(resolve => { releaseCollection = resolve; });
    let originatingSubmissions = 0;
    const originatingRun = api.runDirectChoiceActivation(
        [{id: 'one', title: 'One'}],
        {
            syncSession: async () => authenticatedState('live-session'),
            collectWork: async () => {
                api.setChoiceActivationBatchForTest(batch);
                handoffPublished();
                await collectionCanReturn;
                return {started: true, pendingCount: 1, batch};
            },
            activationWork: options => api.runSteamActivationWork({
                ...options,
                owner: 'originating-tab',
                lockManager,
                now: () => 1000,
                activateKey: async () => {
                    originatingSubmissions += 1;
                    return successResponse;
                },
            }),
        }
    );
    await published;
    const beforeForeignRun = api.getChoiceActivationBatchForTest();
    let foreignSubmissions = 0;
    const scheduled = [];
    await api.reconcileChoiceActivationBatch(undefined, {
        activationWork: options => api.runSteamActivationWork({
            ...options,
            owner: 'foreign-tab',
            lockManager,
            now: () => 1000,
            activateKey: async () => { foreignSubmissions += 1; },
        }),
        scheduleActivationRetry(callback, delay) {
            scheduled.push({callback, delay});
        },
        now: () => 1000,
        refreshBatch: async () => ({refreshed: true}),
    });

    assert.equal(foreignSubmissions, 0);
    assert.deepEqual(api.getChoiceActivationBatchForTest(), beforeForeignRun);
    assert.equal(scheduled.length, 1);
    assert.equal(scheduled[0].delay, 1025);

    releaseCollection();
    const originatingResult = await originatingRun;
    assert.equal(originatingResult.processed, true);
    assert.equal(originatingSubmissions, 1);
    assert.equal(api.getChoiceActivationBatchForTest().items[0].status, 'activated');
});

test('a visible foreign tab retries at lease expiry and cancels abandoned activation without resuming it', async () => {
    const {api} = loadApi();
    const batch = activationBatch([
        {
            id: 'hb-helper-key-v1:0:abandoned-game',
            title: 'Abandoned game',
            key: 'AAAAA-BBBBB-CCCCC',
        },
    ], 'abandoned-tab');
    batch.runner.leaseExpiresAt = 2000;
    api.setChoiceActivationBatchForTest(batch);
    const scheduled = [];
    let currentTime = 1000;
    let submissions = 0;
    const lockManager = {
        request(name, options, callback) {
            return callback({name});
        },
    };
    const activationWork = options => api.runSteamActivationWork({
        ...options,
        owner: 'visible-foreign-tab',
        lockManager,
        now: () => currentTime,
        activateKey: async () => {
            submissions += 1;
            return successResponse;
        },
    });

    await api.reconcileChoiceActivationBatch(undefined, {
        activationWork,
        scheduleActivationRetry(callback, delay) {
            scheduled.push({callback, delay});
        },
        now: () => currentTime,
        refreshBatch: async () => ({refreshed: true}),
    });

    assert.equal(submissions, 0);
    assert.equal(api.getChoiceActivationBatchForTest().state, 'activating');
    assert.equal(scheduled.length, 1);
    assert.equal(scheduled[0].delay, 1025);

    currentTime = 2025;
    await scheduled[0].callback();

    const cancelled = api.getChoiceActivationBatchForTest();
    assert.equal(submissions, 0);
    assert.equal(cancelled.state, 'complete');
    assert.equal(cancelled.items[0].status, 'steam-activation-failed');
    assert.match(cancelled.items[0].error, /cancelled|not submitted/i);
});

test('a queued second Humble tab rechecks the completed batch after the first runner releases the lock', async () => {
    const {api} = loadApi();
    const batch = activationBatch([
        {
            id: 'hb-helper-key-v1:0:queued-game',
            title: 'Queued game',
            key: 'AAAAA-BBBBB-CCCCC',
        },
    ], 'first-tab');
    api.setChoiceActivationBatchForTest(batch);
    const queue = [];
    let lockHeld = false;
    const lockManager = {
        request(name, options, callback) {
            return new Promise((resolve, reject) => {
                queue.push({name, callback, resolve, reject});
                runNext();
            });
        },
    };
    function runNext() {
        if (lockHeld || queue.length === 0) return;
        lockHeld = true;
        const next = queue.shift();
        Promise.resolve(next.callback({name: next.name}))
            .then(next.resolve, next.reject)
            .finally(() => {
                lockHeld = false;
                runNext();
            });
    }
    let releaseFirstRequest;
    let firstSubmissionStarted;
    const firstSubmitted = new Promise(resolve => { firstSubmissionStarted = resolve; });
    const firstRun = api.runSteamActivationWork({
        owner: 'first-tab',
        sessionId: 'live-session',
        lockManager,
        activateKey: async () => {
            firstSubmissionStarted();
            await new Promise(resolve => { releaseFirstRequest = resolve; });
            return successResponse;
        },
    });
    await firstSubmitted;
    const storedWhileFirstRuns = api.getChoiceActivationBatchForTest();
    let secondSubmissions = 0;
    let secondSettled = false;
    const secondRun = api.runSteamActivationWork({
        owner: 'second-tab',
        sessionId: 'live-session',
        lockManager,
        activateKey: async () => { secondSubmissions += 1; },
    }).finally(() => { secondSettled = true; });
    await Promise.resolve();

    assert.equal(secondSettled, false);
    assert.equal(secondSubmissions, 0);
    assert.deepEqual(
        api.getChoiceActivationBatchForTest(),
        storedWhileFirstRuns
    );

    releaseFirstRequest();
    const [firstResult, secondResult] = await Promise.all([firstRun, secondRun]);

    assert.equal(firstResult.processed, true);
    assert.equal(secondResult.processed, false);
    assert.equal(secondSubmissions, 0);
    const completed = api.getChoiceActivationBatchForTest();
    assert.equal(completed.state, 'complete');
    assert.equal(completed.items[0].status, 'activated');
});

test('completed successful and partial batches request a forced Steam account refresh', async () => {
    const {api} = loadApi();
    for (const items of [
        [{id: 'one', title: 'One', key: null, status: 'activated'}],
        [
            {id: 'one', title: 'One', key: null, status: 'activated'},
            {
                id: 'two',
                title: 'Two',
                key: 'DDDDD-EEEEE-FFFFF',
                status: 'steam-activation-failed',
                error: 'already owned',
                code: 9,
            },
        ],
    ]) {
        const calls = [];
        api.setChoiceActivationBatchForTest({
            version: 2,
            id: `batch-${items.length}`,
            state: 'complete',
            runner: {phase: null, owner: null, leaseExpiresAt: null},
            ownershipRefresh: {
                state: 'pending',
                owner: null,
                leaseExpiresAt: null,
                error: null,
            },
            items,
        });
        await api.reconcileChoiceActivationBatch(undefined, {
            refreshBatch: async () => api.fetchFreshSteamAccountAfterActivation(
                async options => {
                    calls.push(options);
                    return authenticatedState('fresh-session');
                }
            ),
        });
        assert.deepEqual(JSON.parse(JSON.stringify(calls)), [{force: true}]);
    }
});

test('the next successful account sync satisfies a deferred ownership refresh', async () => {
    const lockManager = {
        request(name, options, callback) {
            return callback({name});
        },
    };
    const {api} = loadApi({lockManager});
    api.setChoiceActivationBatchForTest({
        version: 2,
        id: 'batch-1',
        state: 'complete',
        runner: {phase: null, owner: null, leaseExpiresAt: null},
        ownershipRefresh: {
            state: 'failed',
            owner: null,
            leaseExpiresAt: null,
            error: 'refresh deferred',
        },
        items: [{
            id: 'one',
            title: 'One',
            key: null,
            status: 'activated',
        }],
    });

    api.applySteamSessionState(authenticatedState('fresh-session'));
    await new Promise(resolve => setImmediate(resolve));

    assert.equal(
        api.getChoiceActivationBatchForTest().ownershipRefresh.state,
        'complete'
    );
});

test('deferred ownership completion does not overwrite a new batch installed while waiting for the mutation lock', async () => {
    const {api} = loadApi();
    api.setChoiceActivationBatchForTest({
        version: 2,
        id: 'old-completed-batch',
        state: 'complete',
        runner: {phase: null, owner: null, leaseExpiresAt: null},
        ownershipRefresh: {
            state: 'failed',
            owner: null,
            leaseExpiresAt: null,
            error: 'refresh deferred',
        },
        items: [{
            id: 'one',
            title: 'One',
            key: null,
            status: 'activated',
        }],
    });
    let queuedRequest;
    let lockRequested;
    const requested = new Promise(resolve => { lockRequested = resolve; });
    const lockManager = {
        request(name, options, callback) {
            return new Promise((resolve, reject) => {
                queuedRequest = {name, callback, resolve, reject};
                lockRequested();
            });
        },
    };

    const completion = api.satisfyDeferredChoiceOwnershipRefreshForTest({
        lockManager,
    });
    await requested;
    const newBatch = {
        version: 2,
        id: 'new-collecting-batch',
        state: 'collecting',
        runner: {
            phase: 'collecting',
            owner: 'new-tab',
            leaseExpiresAt: 5000,
        },
        ownershipRefresh: {
            state: 'waiting',
            owner: null,
            leaseExpiresAt: null,
            error: null,
        },
        items: [],
    };
    api.setChoiceActivationBatchForTest(newBatch);
    Promise.resolve(queuedRequest.callback({name: queuedRequest.name}))
        .then(queuedRequest.resolve, queuedRequest.reject);

    const result = await completion;

    assert.equal(result.updated, false);
    assert.deepEqual(api.getChoiceActivationBatchForTest(), newBatch);
});
