const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'HB_Helper.user.js'), 'utf8');
const batchStorageKey = 'hb-helper-steam-activation-batch-v2';
const plain = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));

function createLockManager() {
    const tails = new Map();
    const names = [];
    return {
        names,
        request(name, options, callback) {
            names.push(name);
            const pending = (tails.get(name) || Promise.resolve()).then(() => callback({name}));
            tails.set(name, pending.catch(() => {}));
            return pending;
        },
    };
}

function loadApi({values = new Map(), lockManager = createLockManager()} = {}) {
    const writes = [];
    const element = () => ({
        appendChild() {},
        addEventListener() {},
        classList: {add() {}, remove() {}},
        dataset: {},
        style: {},
    });
    const context = {
        __HB_HELPER_TEST__: true,
        console: {log() {}, warn() {}, error() {}},
        document: {
            body: element(),
            head: element(),
            documentElement: element(),
            createElement: element,
            addEventListener() {},
            getElementById() { return null; },
            querySelector() { return null; },
            querySelectorAll() { return []; },
        },
        navigator: {language: 'en', languages: ['en'], locks: lockManager},
        location: {pathname: '/', href: 'https://www.humblebundle.com/'},
        GM_getValue(name, fallback) { return plain(values.has(name) ? values.get(name) : fallback); },
        GM_setValue(name, value) { writes.push(name); values.set(name, plain(value)); },
        GM_deleteValue(name) { writes.push(name); values.delete(name); },
        GM_registerMenuCommand() {},
        GM_xmlhttpRequest() { throw new Error('Library batch tests must not make requests.'); },
        setTimeout,
        clearTimeout,
        URLSearchParams,
        Set,
        Map,
    };
    vm.runInNewContext(source, context, {filename: 'HB_Helper.user.js'});
    writes.length = 0;
    return {api: context.__HB_HELPER_TEST_API__, values, writes, lockManager};
}

function completeBatch(items, id = 'previous-library-batch') {
    return {
        version: 2,
        id,
        state: 'complete',
        runner: {phase: null, owner: null, leaseExpiresAt: null},
        ownershipRefresh: {state: 'complete', owner: null, leaseExpiresAt: null, error: null},
        items: items.map(item => ({
            title: 'Same Steam application',
            key: null,
            status: 'activated',
            ...item,
        })),
    };
}

function candidate(api, entitlementId, keySlotId = 'base-game', viewScope = 'purchased-view') {
    return {
        id: api.encodeLibraryActivationItemId(viewScope, entitlementId, keySlotId),
        title: 'Same Steam application',
    };
}

test('Library always uses its injected per-slot reveal callback', async () => {
    const {api, lockManager} = loadApi();
    const selected = candidate(api, 'order-one-entitlement');
    const revealed = [];
    const result = await api.runChoiceCollectionWork([selected], {
        lockManager,
        revealKey: async item => { revealed.push(item.id); return 'AAAAA-BBBBB-CCCCC'; },
        revealKeys: async () => assert.fail('Library must not enter Choice multi-key collection'),
    });

    assert.equal(result.started, true);
    assert.equal(result.pendingCount, 1);
    assert.deepEqual(revealed, [selected.id]);
    assert.equal(result.batch.items[0].id, selected.id);
    assert.equal(result.batch.items[0].key, 'AAAAA-BBBBB-CCCCC');
});

test('Library collection requires an injected single-key callback before any storage mutation', async () => {
    const {api, lockManager, writes} = loadApi();
    const selected = candidate(api, 'order-one-entitlement');

    await assert.rejects(api.runChoiceCollectionWork([selected], {
        lockManager,
        revealKeys: async () => assert.fail('Choice reveal must not be a Library fallback'),
    }), /Library.*single-key.*callback/i);

    assert.deepEqual(writes, []);
    assert.deepEqual(lockManager.names, []);
});

test('Library partial retry skips activated slots while separate purchases stay independent', async () => {
    const {api, lockManager} = loadApi();
    const selected = [
        candidate(api, 'order-one-entitlement', 'base-game'),
        candidate(api, 'order-one-entitlement', 'dlc'),
        candidate(api, 'order-two-entitlement', 'base-game'),
    ];
    const keys = ['AAAAA-BBBBB-CCCCC', 'DDDDD-EEEEE-FFFFF', 'GGGGG-HHHHH-IIIII'];
    const initial = await api.runChoiceCollectionWork(selected, {
        lockManager,
        owner: 'library-owner',
        revealKey: async item => keys[selected.findIndex(candidate => candidate.id === item.id)],
    });
    assert.equal(initial.pendingCount, 3);
    const submitted = [];
    const activated = await api.runSteamActivationWork({
        lockManager,
        owner: 'library-owner',
        sessionId: 'mock-session',
        isContextCurrent: () => true,
        beforeSubmit: async () => true,
        activateKey: async (sessionId, key) => {
            submitted.push(key);
            return key === keys[0]
                ? {purchase_result_details: 0, purchase_receipt_info: {line_items: [{appid: 1}]}}
                : {purchase_result_details: 9};
        },
    });
    assert.equal(activated.processed, true);
    assert.deepEqual(submitted, keys);
    const previous = plain(activated.batch);
    previous.ownershipRefresh.state = 'complete';
    api.setChoiceActivationBatchForTest(previous);

    const retried = [];
    const retry = await api.runChoiceCollectionWork(selected, {
        lockManager,
        revealKey: async item => { retried.push(item.id); return 'JJJJJ-KKKKK-LLLLL'; },
    });

    assert.equal(retry.started, true);
    assert.equal(retry.pendingCount, 2);
    assert.deepEqual(retried, [selected[1].id, selected[2].id]);
    assert.deepEqual(plain(retry.batch.items[0]), {
        ...selected[0], key: null, status: 'activated',
    });
    assert.equal(retry.batch.items.length, 3);
    assert.equal(retry.batch.items.some(item => keys.includes(item.key)), false);
    assert.ok(api.getChoiceActivationBatchForTest(retry.batch));
});

test('Library all-success retry carries raw and canonical Choice-wrapped markers without revealing', async () => {
    const {api, lockManager} = loadApi();
    const selected = [candidate(api, 'order-one', 'base'), candidate(api, 'order-one', 'dlc')];
    api.setChoiceActivationBatchForTest(completeBatch([
        {id: selected[0].id},
        {id: api.encodeChoiceActivationItemId(selected[1].id, 0)},
    ]));

    const result = await api.runChoiceCollectionWork(selected, {
        lockManager,
        revealKey: async () => assert.fail('Completed physical slots must not reveal again'),
    });

    assert.equal(result.started, true);
    assert.equal(result.pendingCount, 0);
    assert.equal(result.batch.version, 2);
    assert.equal(result.batch.state, 'complete');
    assert.deepEqual(plain(result.batch.items), selected.map(item => ({
        ...item, key: null, status: 'activated',
    })));
    assert.ok(api.getChoiceActivationBatchForTest(result.batch));
});

test('Library success markers are reusable only in the same view scope', async () => {
    const {api, lockManager} = loadApi();
    const oldItem = candidate(api, 'shared-entitlement', 'base', 'old-view');
    const selected = candidate(api, 'shared-entitlement', 'base', 'new-view');
    api.setChoiceActivationBatchForTest(completeBatch([{id: oldItem.id}]));
    const revealed = [];

    const result = await api.runChoiceCollectionWork([selected], {
        lockManager,
        revealKey: async item => { revealed.push(item.id); return 'AAAAA-BBBBB-CCCCC'; },
    });

    assert.equal(result.started, true);
    assert.equal(result.pendingCount, 1);
    assert.deepEqual(revealed, [selected.id]);
    assert.equal(result.batch.items.some(item => item.id === oldItem.id), false);
});

test('completed failed and uncertain Library slots are never auto-submitted on resume', async () => {
    const {api, lockManager} = loadApi();
    const selected = [candidate(api, 'order-one', 'failed'), candidate(api, 'order-one', 'uncertain')];
    const previous = completeBatch(selected.map((item, index) => ({
        id: item.id,
        key: index === 0 ? null : 'OLDXX-OLDXX-OLDXX',
        status: index === 0 ? 'humble-key-retrieval-failed' : 'steam-activation-failed',
        error: index === 0 ? 'reveal failed' : 'activation outcome uncertain',
    })));
    api.setChoiceActivationBatchForTest(previous);

    const resumed = await api.runSteamActivationWork({
        lockManager,
        sessionId: 'mock-session',
        activateKey: async () => assert.fail('Completed failure must not submit on resume'),
    });
    assert.equal(resumed.processed, false);
    assert.deepEqual(plain(api.getChoiceActivationBatchForTest()), previous);

    const revealed = [];
    const explicitRetry = await api.runChoiceCollectionWork([selected[1]], {
        lockManager,
        revealKey: async item => { revealed.push(item.id); return 'NEWXX-NEWXX-NEWXX'; },
    });
    assert.equal(explicitRetry.pendingCount, 1);
    assert.deepEqual(revealed, [selected[1].id]);
    assert.equal(explicitRetry.batch.items.length, 1);
    assert.equal(explicitRetry.batch.items[0].key, 'NEWXX-NEWXX-NEWXX');
});

test('Library selection reconciliation never writes Choice or Downloads persistent selection', async () => {
    const {api, values, writes, lockManager} = loadApi();
    values.set('hb-helper-choice-selected-games-v1', ['preserved-choice']);
    const downloadScope = 'a'.repeat(64);
    values.set(api.getDownloadSelectionStorageKeyForTest(downloadScope), {
        [downloadScope]: [`download:${downloadScope}:preserved-game:0`],
    });
    const before = plain([...values]);
    const selected = candidate(api, 'order-one');
    const batch = completeBatch([{id: selected.id}]);

    const result = await api.reconcileActivationSelectionStorageFromBatch(batch, {lockManager});

    assert.equal(result.reconciled, true);
    assert.equal(result.updated, false);
    assert.deepEqual(plain([...values]), before);
    assert.deepEqual(writes, []);
    assert.deepEqual(lockManager.names, []);
});

test('Library collection rejects malformed and mixed selections before locks, reveal, or storage', async () => {
    const {api, lockManager, writes} = loadApi();
    const selected = candidate(api, 'order-one');
    for (const selection of [
        [selected, {...selected}],
        [selected, {id: 'choice-game', title: 'Choice'}],
        [selected, {id: `download:${'a'.repeat(64)}:game:0`, title: 'Download'}],
        [{id: 'library:v1:%', title: 'Malformed'}],
        [selected, {id: api.encodeChoiceActivationItemId(selected.id, 0), title: 'Alias duplicate'}],
        [{id: api.encodeChoiceActivationItemId(selected.id, 1), title: 'Invalid Library index'}],
    ]) {
        const result = await api.runChoiceCollectionWork(selection, {
            lockManager,
            revealKey: async () => assert.fail('Invalid selection must not reveal'),
        });
        assert.equal(result.invalidSelection, true);
    }
    assert.deepEqual(writes, []);
    assert.deepEqual(lockManager.names, []);
});

test('Library and Choice collection share the existing global lock and active-batch exclusion', async () => {
    const values = new Map();
    const lockManager = createLockManager();
    const library = loadApi({values, lockManager});
    const choice = loadApi({values, lockManager});
    let releaseReveal;
    let revealStarted;
    const started = new Promise(resolve => { revealStarted = resolve; });
    const revealGate = new Promise(resolve => { releaseReveal = resolve; });
    const collecting = library.api.runChoiceCollectionWork([
        candidate(library.api, 'order-one'),
    ], {
        lockManager,
        revealKey: async () => { revealStarted(); await revealGate; return 'AAAAA-BBBBB-CCCCC'; },
    });
    await started;
    const competing = choice.api.runChoiceCollectionWork([{id: 'choice-game', title: 'Choice'}], {
        lockManager,
        revealKey: async () => assert.fail('Choice must not reveal over an active Library batch'),
    });
    releaseReveal();

    assert.equal((await collecting).started, true);
    const blocked = await competing;
    assert.equal(blocked.started, false);
    assert.equal(blocked.busy, true);
    assert.deepEqual(lockManager.names, ['hb-helper-choice-collection', 'hb-helper-choice-collection']);
    assert.equal(library.api.inferActivationBatchScope(values.get(batchStorageKey)).kind, 'library');
});

test('an active Choice or Downloads batch blocks a new Library batch without replacing it', async () => {
    for (const id of ['choice-game', `download:${'a'.repeat(64)}:game:0`]) {
        const {api, lockManager, writes} = loadApi();
        const active = completeBatch([{id, key: 'AAAAA-BBBBB-CCCCC', status: 'pending-steam-activation'}]);
        active.state = 'activating';
        active.runner = {phase: 'activating', owner: 'other-owner', leaseExpiresAt: Date.now() + 60000};
        active.ownershipRefresh.state = 'waiting';
        api.setChoiceActivationBatchForTest(active);
        writes.length = 0;

        const result = await api.runChoiceCollectionWork([candidate(api, 'order-one')], {
            lockManager,
            revealKey: async () => assert.fail('Active source must block Library reveal'),
        });

        assert.equal(result.busy, true);
        assert.equal(result.started, false);
        assert.deepEqual(plain(api.getChoiceActivationBatchForTest()), active);
        assert.deepEqual(writes, []);
    }
});

test('Library cancellation preserves a revealed key and records every remaining frozen slot', async () => {
    const {api, lockManager} = loadApi();
    const selected = [
        candidate(api, 'order-one', 'base'),
        candidate(api, 'order-one', 'dlc'),
        candidate(api, 'order-two', 'base'),
    ];
    let current = true;
    const revealed = [];
    const result = await api.runChoiceCollectionWork(selected, {
        lockManager,
        owner: 'library-owner',
        isContextCurrent: () => current,
        revealKey: async item => {
            revealed.push(item.id);
            current = false;
            return 'AAAAA-BBBBB-CCCCC';
        },
    });

    assert.equal(result.started, true);
    assert.equal(result.stale, true);
    assert.equal(result.pendingCount, 1);
    assert.deepEqual(revealed, [selected[0].id]);
    assert.deepEqual(plain(result.batch.items), [
        {...selected[0], key: 'AAAAA-BBBBB-CCCCC', status: 'pending-steam-activation'},
        ...selected.slice(1).map(item => ({
            ...item,
            key: null,
            status: 'humble-key-retrieval-failed',
            error: 'Library collection cancelled before this key was submitted',
        })),
    ]);
    assert.ok(api.getChoiceActivationBatchForTest(result.batch));

    const activation = await api.runSteamActivationWork({
        lockManager,
        owner: 'library-owner',
        sessionId: 'mock-session',
        isContextCurrent: () => current,
        beforeSubmit: async () => true,
        activateKey: async () => assert.fail('Cancelled Library collection must not submit keys'),
    });
    assert.equal(activation.stopped, true);
    const stored = api.getChoiceActivationBatchForTest();
    assert.equal(stored.items.length, selected.length);
    assert.equal(stored.items[0].status, 'steam-activation-failed');
    assert.equal(stored.items[0].key, 'AAAAA-BBBBB-CCCCC');
});

test('Library cancellation after an uncertain reveal preserves success markers and the full snapshot', async () => {
    const {api, lockManager} = loadApi();
    const selected = [
        candidate(api, 'order-one', 'already-activated'),
        candidate(api, 'order-one', 'uncertain'),
        candidate(api, 'order-one', 'unsubmitted'),
        candidate(api, 'order-two', 'unsubmitted'),
    ];
    api.setChoiceActivationBatchForTest(completeBatch([
        {id: api.encodeChoiceActivationItemId(selected[0].id, 0)},
    ]));
    let current = true;
    const revealed = [];
    const result = await api.runChoiceCollectionWork(selected, {
        lockManager,
        isContextCurrent: () => current,
        revealKey: async item => {
            revealed.push(item.id);
            current = false;
            throw new Error('Native Library reveal outcome is uncertain');
        },
    });

    assert.equal(result.started, true);
    assert.equal(result.stale, true);
    assert.equal(result.pendingCount, 0);
    assert.equal(result.batch.state, 'complete');
    assert.deepEqual(revealed, [selected[1].id]);
    assert.deepEqual(plain(result.batch.items), [
        {...selected[0], key: null, status: 'activated'},
        {
            ...selected[1], key: null, status: 'humble-key-retrieval-failed',
            error: 'Native Library reveal outcome is uncertain',
        },
        ...selected.slice(2).map(item => ({
            ...item, key: null, status: 'humble-key-retrieval-failed',
            error: 'Library collection cancelled before this key was submitted',
        })),
    ]);
    assert.ok(api.getChoiceActivationBatchForTest(result.batch));
});

test('Library cancellation before reveal persists created snapshots and leaves preflight cancellation untouched', async () => {
    const beforePreflight = loadApi();
    const before = await beforePreflight.api.runChoiceCollectionWork([
        candidate(beforePreflight.api, 'order-one'),
    ], {
        lockManager: beforePreflight.lockManager,
        isContextCurrent: () => false,
        revealKey: async () => assert.fail('Preflight cancellation must not reveal'),
    });
    assert.equal(before.started, false);
    assert.equal(before.stale, true);
    assert.deepEqual(beforePreflight.writes, []);
    assert.deepEqual(beforePreflight.lockManager.names, []);

    const {api, lockManager} = loadApi();
    const selected = [candidate(api, 'order-one', 'base'), candidate(api, 'order-one', 'dlc')];
    let current = true;
    const result = await api.runChoiceCollectionWork(selected, {
        lockManager,
        isContextCurrent: () => current,
        onBatchStarted: () => { current = false; },
        revealKey: async () => assert.fail('Cancellation after snapshot creation must not reveal'),
    });

    assert.equal(result.started, true);
    assert.equal(result.stale, true);
    assert.equal(result.pendingCount, 0);
    assert.equal(result.batch.state, 'complete');
    assert.deepEqual(plain(result.batch.items), selected.map(item => ({
        ...item, key: null, status: 'humble-key-retrieval-failed',
        error: 'Library collection cancelled before this key was submitted',
    })));
    assert.deepEqual(plain(api.getChoiceActivationBatchForTest()), plain(result.batch));
});
