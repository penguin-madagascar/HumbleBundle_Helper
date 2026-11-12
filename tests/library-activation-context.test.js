const assert = require('node:assert/strict');
const test = require('node:test');
const {loadUserscript} = require('./helpers/userscript');

const successResponse = {
    purchase_result_details: 0,
    purchase_receipt_info: {line_items: [{packageid: 1}]},
};
const failureResponse = {purchase_result_details: 9, purchase_receipt_info: {}};

function loadApi() {
    const runtime = loadUserscript({pathname: '/home/library'});
    runtime.context.GM_setValue = (name, value) => {
        runtime.values.set(name, JSON.parse(JSON.stringify(value)));
    };
    return runtime;
}

function activationBatch(api) {
    return {
        version: 2,
        id: 'context-guard-batch',
        state: 'activating',
        runner: {phase: 'activating', owner: 'current-owner', leaseExpiresAt: 1000},
        ownershipRefresh: {state: 'waiting', owner: null, leaseExpiresAt: null, error: null},
        // Synthetic identities and keys; no Library entitlement contract is assumed.
        items: ['AAAAA-BBBBB-CCCCC', 'DDDDD-EEEEE-FFFFF'].map((key, index) => ({
            id: api.encodeLibraryActivationItemId('view', 'entitlement', `slot-${index}`),
            title: `Game ${index + 1}`,
            key,
            status: 'pending-steam-activation',
        })),
    };
}

function assertCancelled(item) {
    assert.equal(item.status, 'steam-activation-failed');
    assert.match(item.error, /cancelled|not submitted/i);
    assert.equal(item.code, null);
}

test('a stale activation context cancels pending keys before submitting and persists completion', async () => {
    const {api} = loadApi();
    const batch = activationBatch(api);
    const saved = [];
    let submissions = 0;
    const result = await api.processSteamActivationBatch(
        batch,
        'synthetic-session',
        async () => { submissions += 1; return successResponse; },
        value => { saved.push(JSON.parse(JSON.stringify(value))); return true; },
        () => {},
        {isContextCurrent: () => false}
    );

    assert.equal(submissions, 0);
    assert.equal(result.stopped, true);
    assert.equal(batch.state, 'complete');
    batch.items.forEach(assertCancelled);
    assert.equal(saved.at(-1).state, 'complete');
    saved.at(-1).items.forEach(assertCancelled);
});

for (const invalidatedBy of ['progress', 'persistence']) {
    test(`context invalidated by ${invalidatedBy} cancels the current unsubmitted key without uncertainty`, async () => {
        const {api} = loadApi();
        const batch = activationBatch(api);
        let current = true;
        let submissions = 0;
        const result = await api.processSteamActivationBatch(
            batch,
            'synthetic-session',
            async () => { submissions += 1; return successResponse; },
            value => {
                if (invalidatedBy === 'persistence' && value.items[0].status === 'activating') {
                    current = false;
                }
                return true;
            },
            () => { if (invalidatedBy === 'progress') current = false; },
            {isContextCurrent: () => current}
        );

        assert.equal(submissions, 0);
        assert.equal(result.stopped, true);
        assert.equal(batch.state, 'complete');
        batch.items.forEach(assertCancelled);
    });
}

for (const [outcome, response] of [['success', successResponse], ['failure', failureResponse]]) {
    test(`context changes during an in-flight definite ${outcome} preserve its result and cancel the remainder`, async () => {
        const {api} = loadApi();
        const batch = activationBatch(api);
        let current = true;
        const submitted = [];
        const saved = [];
        const result = await api.processSteamActivationBatch(
            batch,
            'synthetic-session',
            async (sessionId, key) => {
                submitted.push(key);
                current = false;
                return response;
            },
            value => { saved.push(JSON.parse(JSON.stringify(value))); return true; },
            () => {},
            {
                isContextCurrent: () => current,
                recheckSession: async () => assert.fail('definite results need no session recheck'),
            }
        );

        assert.deepEqual(submitted, ['AAAAA-BBBBB-CCCCC']);
        assert.equal(result.stopped, true);
        assert.equal(batch.state, 'complete');
        assert.equal(batch.items[0].status, outcome === 'success' ? 'activated' : 'steam-activation-failed');
        assert.equal(batch.items[0].key, outcome === 'success' ? null : 'AAAAA-BBBBB-CCCCC');
        if (outcome === 'failure') assert.equal(batch.items[0].code, 9);
        assertCancelled(batch.items[1]);
        assert.equal(saved.at(-1).items[0].status, batch.items[0].status);
        assertCancelled(saved.at(-1).items[1]);
    });
}

for (const [outcome, response] of [
    ['rejection', () => { throw new Error('synthetic transport failure'); }],
    ['invalid response', () => ({})],
]) {
    test(`context changes during an in-flight ${outcome} persist uncertainty without rechecking or retrying`, async () => {
        const {api} = loadApi();
        const batch = activationBatch(api);
        let current = true;
        let submissions = 0;
        let rechecks = 0;
        const saved = [];
        const result = await api.processSteamActivationBatch(
            batch,
            'synthetic-session',
            async () => {
                submissions += 1;
                current = false;
                return response();
            },
            value => { saved.push(JSON.parse(JSON.stringify(value))); return true; },
            () => {},
            {
                isContextCurrent: () => current,
                recheckSession: async () => { rechecks += 1; return {status: 'logged-out'}; },
            }
        );

        assert.equal(submissions, 1);
        assert.equal(rechecks, 0);
        assert.equal(result.stopped, true);
        assert.equal(batch.state, 'complete');
        assert.equal(batch.items[0].status, 'steam-activation-failed');
        assert.match(batch.items[0].error, /uncertain/i);
        assert.equal(batch.items[0].key, 'AAAAA-BBBBB-CCCCC');
        assert.equal(batch.items[0].code, null);
        assertCancelled(batch.items[1]);
        assert.match(saved.at(-1).items[0].error, /uncertain/i);
        assertCancelled(saved.at(-1).items[1]);
    });
}

test('context invalidated during session recheck keeps the rejected in-flight key uncertain', async () => {
    const {api} = loadApi();
    const batch = activationBatch(api);
    let current = true;
    let submissions = 0;
    const result = await api.processSteamActivationBatch(
        batch,
        'synthetic-session',
        async () => { submissions += 1; throw new Error('synthetic transport failure'); },
        () => true,
        () => {},
        {
            isContextCurrent: () => current,
            recheckSession: async () => {
                current = false;
                return {
                    status: 'authenticated',
                    account: {countryCode: 'US', ownedApps: [], wishlistApps: [], sessionId: 'renewed'},
                };
            },
        }
    );

    assert.equal(submissions, 1);
    assert.equal(result.stopped, true);
    assert.match(batch.items[0].error, /uncertain/i);
    assertCancelled(batch.items[1]);
});

test('the locked runner forwards its context guard and persists cancellation while holding the lock', async () => {
    const {api, context, values} = loadApi();
    const batch = activationBatch(api);
    api.setChoiceActivationBatchForTest(batch);
    let current = true;
    let lockHeld = false;
    let submissions = 0;
    const writes = [];
    const save = context.GM_setValue;
    context.GM_setValue = (name, value) => {
        writes.push(lockHeld);
        save(name, value);
    };
    const result = await api.runSteamActivationWork({
        owner: 'current-owner',
        sessionId: 'synthetic-session',
        isContextCurrent: () => current,
        activateKey: async () => { submissions += 1; return successResponse; },
        lockManager: {
            async request(name, options, callback) {
                current = false;
                lockHeld = true;
                try {
                    return await callback({name});
                } finally {
                    lockHeld = false;
                }
            },
        },
    });

    assert.equal(submissions, 0);
    assert.equal(result.stopped, true);
    assert.equal(result.processed, false);
    assert.ok(writes.length > 0);
    assert.ok(writes.every(Boolean));
    const stored = api.getChoiceActivationBatchForTest();
    assert.equal(stored.state, 'complete');
    stored.items.forEach(assertCancelled);
    assert.ok(values.has('hb-helper-steam-activation-batch-v2'));
});
