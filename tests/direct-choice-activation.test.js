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

function loadApi({onRequest = () => {}, lockManager} = {}) {
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
        setInterval,
        clearInterval,
        URLSearchParams,
        Map,
        Set,
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
        {id: 'one', title: 'One', key: 'AAAAA-BBBBB-CCCCC'},
        {id: 'two', title: 'Two', key: 'DDDDD-EEEEE-FFFFF'},
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
        {id: 'one', title: 'One', key: 'AAAAA-BBBBB-CCCCC'},
        {id: 'two', title: 'Two', key: 'DDDDD-EEEEE-FFFFF'},
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
            id: 'one',
            title: 'One',
            key: 'AAAAA-BBBBB-CCCCC',
            status: 'activating',
        },
        {id: 'two', title: 'Two', key: 'DDDDD-EEEEE-FFFFF'},
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
        {id: 'one', title: 'One', key: 'AAAAA-BBBBB-CCCCC'},
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
        {id: 'one', title: 'One', key: 'AAAAA-BBBBB-CCCCC'},
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
        {id: 'one', title: 'One', key: 'AAAAA-BBBBB-CCCCC'},
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
