const assert = require('node:assert/strict');
const test = require('node:test');
const {loadUserscript} = require('./helpers/userscript');

const purchaseId = '22222222-2222-4222-8222-222222222222';
const bundleId = '11111111-1111-4111-8111-111111111111';
const firstKey = 'AAAAA-BBBBB-CCCCC';
const secondKey = 'DDDDD-EEEEE-FFFFF';
const identity = 'a'.repeat(64);
const account = {steamAccountId: '1234', countryCode: 'CA', ownedApps: [], wishlistApps: [], sessionId: 'synthetic-session'};
const success = {purchase_result_details: 0, purchase_receipt_info: {line_items: [{packageid: 1}]}};
const failure = {purchase_result_details: 9, purchase_receipt_info: {}};
const lockManager = {request: async (name, options, callback) => callback({name})};
const fixtures = [];

test.afterEach(() => {
    for (const fixture of fixtures.splice(0)) {
        fixture.window.dispatchEvent(new fixture.window.Event('pagehide'));
        fixture.api.resetHelperHydrationForTest();
    }
});

function fixture({kind = 'purchased', keys = [firstKey, secondKey]} = {}) {
    const purchased = kind === 'purchased';
    const title = 'Same game';
    const heading = purchased ? '<h2>Your Library</h2><div role="tablist"><button role="tab" aria-selected="true">Purchased</button></div><form><input aria-label="Search">' : '<h1>Game details</h1>';
    const titleMarkup = `<div class="flex flex-1 items-center gap-2"><div aria-label="Steam"></div><div class="flex flex-1 flex-col justify-center"><div>${title}</div><div>Subtitle</div></div></div>`;
    const header = purchased ? `<a href="/home/library/content/${purchaseId}">${titleMarkup}</a>` : `<div class="flex flex-wrap items-center justify-between gap-4">${titleMarkup}<div><button>兑换</button></div></div>`;
    const runtime = loadUserscript({pathname: purchased ? '/home/library' : `/home/library/${kind === 'content' ? 'content/' + purchaseId : bundleId}`,
        logger: {warn() {}},
        html: `<main>${heading}<div class="flex flex-col border-0">${header}<div class="overflow-hidden"></div></div>${purchased ? '</form>' : ''}</main>`});
    const record = {id: purchaseId, contentId: 'same-content', title, deliveryMethods: ['steam'],
        entitlements: {keys: keys.map((key, index) => ({id: `slot-${index}`, title, type: 'steam',
            redemptionData: {keyFormatted: key}, customDisclaimer: '', expired: false,
            preOrdered: false, outOfStock: false, redeemable: true, giftStatus: '', directRedeem: null})), downloads: []}};
    const entry = runtime.api.getLibraryGameEntries()[0];
    const host = {tag: 5, stateNode: entry.element, memoizedProps: {}, child: null, sibling: null};
    const component = {tag: 0, memoizedProps: {item: record}, child: host, sibling: null};
    const root = {tag: 3, stateNode: {}, child: component, return: null, sibling: null};
    root.stateNode.current = root;
    host.return = component;
    component.return = root;
    Object.defineProperty(entry.element, '__reactFiber$controller', {value: host});
    runtime.context.GM_setValue = (name, value) => runtime.values.set(name, JSON.parse(JSON.stringify(value)));
    runtime.api.setSteamSessionStateForTest({status: 'authenticated', account, error: null});
    if (purchased) runtime.api.ensurePurchasedLibraryControlsForTest?.();
    else runtime.api.ensureHelperControls();
    runtime.api.refreshLibrarySelectionForTest();
    if (kind !== 'content') runtime.document.querySelector('.hb-helper-library-selection-toggle').click();
    fixtures.push(runtime);
    return {...runtime, record};
}

function dependencies(overrides = {}) {
    return {loadIdentity: async () => identity,
        syncSession: async () => ({status: 'authenticated', account: {...account}, error: null}),
        hashScope: async () => 'b'.repeat(64),
        collectionOptions: {lockManager}, activationOptions: {lockManager},
        postKey: async () => success, ...overrides};
}

test('Library rendering never claims or submits keys and only explicit activation starts work', () => {
    const {api, requests, values} = fixture();
    api.refreshLibrarySelectionForTest();
    assert.equal(typeof api.startLibraryActivationForTest, 'function');
    assert.equal(requests.length, 0);
    assert.equal(values.size, 0);
});

test('activation freezes all selected slots before account verification awaits', async () => {
    const {api, record, document} = fixture();
    let resolveIdentity;
    const submitted = [];
    const pending = api.startLibraryActivationForTest(dependencies({
        loadIdentity: () => resolveIdentity ? Promise.resolve(identity) : new Promise(resolve => { resolveIdentity = resolve; }),
        postKey: async (session, key) => { submitted.push(key); return success; },
    }));
    record.entitlements.keys.length = 0;
    document.querySelector('.border-0').remove();
    resolveIdentity(identity);
    await pending;
    assert.deepEqual(submitted, [firstKey, secondKey]);
});

test('content details activate every Steam slot as one batch without selection controls', async () => {
    const {api, document} = fixture({kind: 'content'});
    const submitted = [];
    const retry = await api.startLibraryActivationForTest(dependencies({postKey: async (session, key) => { submitted.push(key); return success; }}));
    assert.equal(retry.started, true, JSON.stringify(retry));
    assert.deepEqual(submitted, [firstKey, secondKey]);
    assert.equal(document.querySelector('[data-hb-helper-library-action="select"]'), null);
    assert.equal(api.getChoiceActivationBatchForTest().items.length, 2);
});

test('missing Steam principal stops before collection or a native reveal', async () => {
    const {api} = fixture({keys: [null]});
    let collections = 0;
    let reveals = 0;
    const result = await api.startLibraryActivationForTest(dependencies({
        syncSession: async () => ({status: 'authenticated', account: {...account, steamAccountId: undefined}}),
        collectWork: async () => { collections += 1; }, revealKey: async () => { reveals += 1; },
    }));
    assert.equal(result.authenticationRequired, true);
    assert.equal(collections, 0);
    assert.equal(reveals, 0);
});

for (const changed of ['Humble', 'Steam']) {
    test(`${changed} account change before the second Steam submission cancels it`, async () => {
        const {api} = fixture();
        const submitted = [];
        await api.startLibraryActivationForTest(dependencies({
            loadIdentity: async () => changed === 'Humble' && submitted.length ? 'c'.repeat(64) : identity,
            syncSession: async () => ({status: 'authenticated', account: {...account,
                steamAccountId: changed === 'Steam' && submitted.length ? '5678' : account.steamAccountId,
                sessionId: `fresh-${submitted.length}`}}),
            postKey: async (session, key) => { submitted.push({session, key}); return success; },
        }));
        assert.deepEqual(submitted, [{session: 'fresh-0', key: firstKey}]);
        const batch = api.getChoiceActivationBatchForTest();
        assert.equal(batch.items[0].status, 'activated');
        assert.equal(batch.items[1].status, 'steam-activation-failed');
        assert.match(batch.items[1].error, /cancelled|not submitted/i);
        assert.deepEqual([...api.getSelectedLibraryRecordIdsForTest()], [purchaseId]);
    });
}

test('partial success retains the purchase selection and an explicit retry skips its successful slot', async () => {
    const {api} = fixture();
    const submitted = [];
    await api.startLibraryActivationForTest(dependencies({postKey: async (session, key) => {
        submitted.push(key); return key === firstKey ? success : failure;
    }}));
    assert.deepEqual([...api.getSelectedLibraryRecordIdsForTest()], [purchaseId]);
    const retry = await api.startLibraryActivationForTest(dependencies({postKey: async (session, key) => { submitted.push(key); return success; }}));
    assert.equal(retry.started, true, JSON.stringify(retry));
    assert.deepEqual(submitted, [firstKey, secondKey, secondKey]);
    assert.deepEqual([...api.getSelectedLibraryRecordIdsForTest()], []);
});

for (const invalidate of ['cancel', 'navigation']) {
    test(`${invalidate} during an in-flight request records its outcome and stops the next key`, async () => {
        const {api, location, document} = fixture();
        const submitted = [];
        let finish;
        const pending = api.startLibraryActivationForTest(dependencies({postKey: async (session, key) => {
            submitted.push(key); return new Promise(resolve => { finish = resolve; });
        }}));
        while (!finish) await new Promise(resolve => setImmediate(resolve));
        if (invalidate === 'cancel') await api.cancelLibraryActivationForTest();
        else location.search = '?page=2';
        finish(success);
        await pending;
        assert.deepEqual(submitted, [firstKey]);
        const batch = api.getChoiceActivationBatchForTest();
        assert.equal(batch.items[0].status, 'activated');
        assert.equal(batch.items[1].status, 'steam-activation-failed');
        assert.match(batch.items[1].error, /cancelled|not submitted/i);
        if (invalidate === 'navigation') assert.equal(document.querySelector('.hb-helper-library-results').textContent, '');
    });
}

test('unrevealed purchased keys explain the unsupported original-detail reveal and continue other slots', async () => {
    const {api, document} = fixture({keys: [null, secondKey]});
    const submitted = [];
    await api.startLibraryActivationForTest(dependencies({
        revealKey: async () => assert.fail('purchased list rows have no verified reveal transport'),
        postKey: async (session, key) => { submitted.push(key); return success; },
    }));
    assert.deepEqual(submitted, [secondKey]);
    const batch = api.getChoiceActivationBatchForTest();
    assert.equal(batch.items[0].status, 'humble-key-retrieval-failed');
    assert.match(batch.items[0].error, /original.*details|details.*reveal/i);
    assert.match(document.querySelector('.hb-helper-library-results').textContent, /original.*details|details.*reveal/i);
    assert.deepEqual([...api.getSelectedLibraryRecordIdsForTest()], [purchaseId]);
});

test('snapshot deduplicates exact rights and slots and rejects conflicting duplicate slot data', () => {
    const {api} = fixture();
    const record = {id: purchaseId, title: 'Game', deliveryMethods: ['steam'], keySlots: [
        {id: 'slot', title: 'Game', type: 'steam', directRedeem: null, keyFormatted: firstKey},
    ]};
    const entry = {record, platformLabels: ['Steam']};
    const options = {view: {kind: 'purchased'}, selection: new Set([purchaseId]), entries: [entry, entry]};
    assert.equal(api.captureLibraryActivationSnapshotForTest(options).items.length, 1);
    const conflict = {...entry, record: {...record, keySlots: [{...record.keySlots[0], keyFormatted: secondKey}]}};
    assert.equal(api.captureLibraryActivationSnapshotForTest({...options, entries: [entry, conflict]}), null);
});

test('an interrupted Library batch renders without resuming and explicit Cancel unlocks it with uncertain results', async () => {
    const {api, document} = fixture();
    const id = api.encodeLibraryActivationItemId('b'.repeat(64), purchaseId, 'slot-0');
    api.setChoiceActivationBatchForTest({version: 2, id: 'interrupted-library', state: 'activating',
        runner: {phase: 'activating', owner: 'old-page', leaseExpiresAt: 1},
        ownershipRefresh: {state: 'waiting', owner: null, leaseExpiresAt: null, error: null},
        items: [{id, title: 'Same game', key: firstKey, status: 'activating'}]});
    api.refreshLibrarySelectionForTest();
    const notice = document.querySelector('.hb-helper-library-status');
    assert.match(notice.textContent, /unfinished Library activation/i);
    assert.equal(notice.querySelector('[data-hb-helper-library-action="cancel"]').hidden, false);
    await api.cancelLibraryActivationForTest({lockManager});
    const cancelled = api.getChoiceActivationBatchForTest();
    assert.equal(cancelled.state, 'complete');
    assert.match(cancelled.items[0].error, /uncertain/i);
    assert.equal(notice.querySelector('.hb-helper-library-results').textContent, '');
    assert.match(notice.querySelector('#hb-helper-library-key-status').textContent, /uncertain/i);
    assert.equal(notice.querySelector('[data-hb-helper-library-action="activate"]').disabled, false);
});

test('bundle activation verifies identities again before dispatching the exact native single-key reveal', async () => {
    const {api, document, record} = fixture({kind: 'bundle', keys: [null]});
    let identities = 0;
    let clicks = 0;
    const submitted = [];
    document.querySelector('main .border-0 button:not(.hb-helper-library-selection-toggle)').addEventListener('click', () => {
        clicks += 1;
        record.entitlements.keys[0].redemptionData.keyFormatted = firstKey;
    });
    await api.startLibraryActivationForTest(dependencies({
        loadIdentity: async () => { identities += 1; return identity; },
        postKey: async (session, key) => { submitted.push(key); return success; },
    }));
    assert.ok(identities >= 3, 'initial verification, native reveal, and Steam submission each verify Humble');
    assert.equal(clicks, 1);
    assert.deepEqual(submitted, [firstKey]);
});

test('a Humble account switch between the click and native reveal stops before claiming a key', async () => {
    const {api, document} = fixture({kind: 'bundle', keys: [null]});
    let identities = 0;
    let clicks = 0;
    document.querySelector('main .border-0 button:not(.hb-helper-library-selection-toggle)').addEventListener('click', () => { clicks += 1; });
    await api.startLibraryActivationForTest(dependencies({
        loadIdentity: async () => ++identities === 1 ? identity : 'c'.repeat(64),
        postKey: async () => assert.fail('no Steam submission after account switch'),
    }));
    assert.equal(clicks, 0);
});

test('results show all per-key outcomes and copy a failed key only when its button is clicked', async () => {
    const {api, document, context} = fixture();
    const copied = [];
    context.GM_setClipboard = key => copied.push(key);
    await api.startLibraryActivationForTest(dependencies({postKey: async (session, key) => key === firstKey ? success : failure}));
    const results = document.querySelector('.hb-helper-library-results');
    assert.equal(results.querySelectorAll('.hb-helper-choice-result-row').length, 2);
    assert.match(results.textContent, /Activated/);
    assert.equal(results.textContent.includes(secondKey), false);
    assert.deepEqual(copied, []);
    results.querySelector('button').click();
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(copied, [secondKey]);
    assert.equal(results.dataset.hbHelperLibrarySignature.includes(secondKey), false);
});

test('an empty interrupted batch has explicit lock-protected cleanup without guessing its source', async () => {
    const {api, document} = fixture();
    api.setChoiceActivationBatchForTest({version: 2, id: 'unknown-empty-batch', state: 'collecting',
        runner: {phase: 'collecting', owner: 'old-page', leaseExpiresAt: 1},
        ownershipRefresh: {state: 'waiting', owner: null, leaseExpiresAt: null, error: null}, items: []});
    api.refreshLibrarySelectionForTest();
    const cancel = document.querySelector('[data-hb-helper-library-action="cancel"]');
    assert.equal(cancel.hidden, false);
    assert.match(cancel.textContent, /unknown|unidentified/i);
    assert.ok(api.getChoiceActivationBatchForTest());
    const result = await api.cancelLibraryActivationForTest({lockManager});
    assert.equal(result.recovered, true);
    assert.equal(api.getChoiceActivationBatchForTest(), null);
});

test('completed results and stale copy buttons cannot expose a previous Steam account key', async () => {
    const {api, document, context} = fixture();
    const copied = [];
    context.GM_setClipboard = key => copied.push(key);
    await api.startLibraryActivationForTest(dependencies({postKey: async () => failure}));
    const results = document.querySelector('.hb-helper-library-results');
    const staleCopy = results.querySelector('button');
    assert.ok(staleCopy);
    api.setSteamSessionStateForTest({status: 'authenticated', account: {...account, steamAccountId: '5678'}, error: null});
    api.refreshLibrarySelectionForTest();
    assert.equal(results.textContent, '');
    staleCopy.click();
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(copied, []);
});

test('copy revalidates the Humble identity and hides results after an account switch', async () => {
    const {api, document, context} = fixture();
    const copied = [];
    let currentIdentity = identity;
    context.GM_setClipboard = key => copied.push(key);
    await api.startLibraryActivationForTest(dependencies({loadIdentity: async () => currentIdentity, postKey: async () => failure}));
    const results = document.querySelector('.hb-helper-library-results');
    currentIdentity = 'c'.repeat(64);
    results.querySelector('button').click();
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(copied, []);
    assert.equal(results.textContent, '');
});

test('results stay hidden after account loading or navigating back until explicit account verification', async () => {
    const {api, document, location} = fixture();
    let submissions = 0;
    await api.startLibraryActivationForTest(dependencies({postKey: async () => { submissions += 1; return failure; }}));
    const results = document.querySelector('.hb-helper-library-results');
    assert.ok(results.textContent);
    api.setSteamSessionStateForTest({status: 'syncing', account, error: null});
    api.refreshLibrarySelectionForTest();
    assert.equal(results.textContent, '');
    api.setSteamSessionStateForTest({status: 'authenticated', account, error: null});
    location.search = '?page=2';
    api.refreshLibrarySelectionForTest();
    location.search = '';
    api.refreshLibrarySelectionForTest();
    assert.equal(results.textContent, '');
    const verify = document.querySelector('[data-hb-helper-library-action="verify-results"]');
    assert.equal(verify.hidden, false);
    verify.click();
    await new Promise(resolve => setImmediate(resolve));
    assert.ok(results.textContent);
    assert.equal(submissions, 2);
});
