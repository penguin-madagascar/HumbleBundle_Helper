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

function loadApi({onRequest = () => {}} = {}) {
    const values = new Map();
    const element = () => ({
        appendChild() {},
        append() {},
        addEventListener() {},
        classList: createTestClassList(),
        dataset: {},
        style: {},
    });
    const document = {
        body: element(),
        head: element(),
        documentElement: element(),
        createElement: element,
        addEventListener() {},
        getElementById() { return null; },
        querySelector() { return null; },
        choiceTiles: [],
        querySelectorAll(selector) {
            return selector.includes('.choice-content.js-open-choice-modal')
                ? this.choiceTiles
                : [];
        },
    };
    const context = {
        __HB_HELPER_TEST__: true,
        console: {log() {}, warn() {}, error() {}},
        document,
        navigator: {language: 'en', languages: ['en']},
        location: {
            hostname: 'www.humblebundle.com',
            pathname: '/membership/july-2026',
            href: 'https://www.humblebundle.com/membership/july-2026',
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
        let submissions = 0;
        await api.processSteamActivationBatch(
            batch,
            'live-session',
            async () => {
                submissions += 1;
                return submissions === 1 ? failedResponse() : successResponse;
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
        assert.equal(submissions, 2);
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

test('a second Humble tab neither cancels nor submits while another runner holds the lock', async () => {
    const {api} = loadApi();
    const batch = activationBatch([
        {id: 'one', title: 'One', key: 'AAAAA-BBBBB-CCCCC'},
    ], 'first-tab');
    api.setChoiceActivationBatchForTest(batch);
    let submissions = 0;

    const result = await api.runSteamActivationWork({
        owner: 'second-tab',
        sessionId: 'live-session',
        lockManager: {
            request(name, options, callback) {
                return callback(null);
            },
        },
        activateKey: async () => { submissions += 1; },
    });

    assert.equal(result.acquired, false);
    assert.equal(submissions, 0);
    assert.deepEqual(api.getChoiceActivationBatchForTest(), batch);
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

test('the next successful account sync satisfies a deferred ownership refresh', () => {
    const {api} = loadApi();
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

    assert.equal(
        api.getChoiceActivationBatchForTest().ownershipRefresh.state,
        'complete'
    );
});
