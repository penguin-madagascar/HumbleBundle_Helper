const assert = require('node:assert/strict');
const test = require('node:test');
const {loadUserscript} = require('./helpers/userscript');

const successResponse = {
    purchase_result_details: 0,
    purchase_receipt_info: {line_items: [{packageid: 1}]},
};
const immediateLockManager = {request: (name, options, callback) => callback({name})};

function loadApi() {
    const runtime = loadUserscript({pathname: '/home/library'});
    runtime.context.GM_setValue = (name, value) => {
        runtime.values.set(name, JSON.parse(JSON.stringify(value)));
    };
    return runtime;
}

function activationBatch(api, kind = 'library', owner = 'current-owner') {
    return {
        version: 2,
        id: 'account-submit-guard-batch',
        state: 'activating',
        runner: {phase: 'activating', owner, leaseExpiresAt: 1000},
        ownershipRefresh: {state: 'waiting', owner: null, leaseExpiresAt: null, error: null},
        // Every identity, key, and session in this file is synthetic.
        items: ['AAAAA-BBBBB-CCCCC', 'DDDDD-EEEEE-FFFFF'].map((key, index) => ({
            id: kind === 'library'
                ? api.encodeLibraryActivationItemId('view', 'entitlement', `slot-${index}`)
                : kind === 'download'
                    ? `download:${'a'.repeat(64)}:game:${index}`
                    : api.encodeChoiceActivationItemId('choice-game', index),
            title: `Game ${index + 1}`,
            key,
            status: 'pending-steam-activation',
        })),
    };
}

function assertCancelled(item) {
    assert.equal(item.status, 'steam-activation-failed');
    assert.match(item.error, /cancelled|not submitted/i);
    assert.doesNotMatch(item.error, /uncertain/i);
    assert.equal(item.code, null);
}

test('a context change during the async guard cancels unsubmitted keys before marking or persisting an active request', async () => {
    const {api} = loadApi();
    const batch = activationBatch(api);
    let current = true;
    let release;
    let submissions = 0;
    let rechecks = 0;
    const writes = [];
    const pending = api.processSteamActivationBatch(
        batch,
        'initial-session',
        async () => { submissions += 1; return successResponse; },
        value => { writes.push(JSON.parse(JSON.stringify(value))); return true; },
        () => {},
        {
            isContextCurrent: () => current,
            beforeSubmit: () => new Promise(resolve => { release = resolve; }),
            recheckSession: async () => { rechecks += 1; return {status: 'logged-out'}; },
        }
    );

    assert.equal(typeof release, 'function');
    assert.equal(batch.items[0].status, 'pending-steam-activation');
    assert.equal(writes.length, 0);
    assert.equal(submissions, 0);
    current = false;
    release('fresh-session');
    const result = await pending;
    assert.equal(result.stopped, true);
    assert.equal(submissions, 0);
    assert.equal(rechecks, 0);
    assert.equal(writes.length, 1);
    batch.items.forEach(assertCancelled);
});

test('each pending key awaits a fresh session before activation state is persisted', async () => {
    const {api} = loadApi();
    const batch = activationBatch(api);
    const events = [];
    let checks = 0;
    const result = await api.processSteamActivationBatch(
        batch,
        'initial-session',
        async (sessionId, key) => { events.push(['submit', sessionId, key]); return successResponse; },
        value => {
            const active = value.items.findIndex(item => item.status === 'activating');
            if (active >= 0) events.push(['persist', active]);
            return true;
        },
        () => {},
        {
            beforeSubmit: async () => {
                events.push(['guard', checks]);
                assert.equal(batch.items[checks].status, 'pending-steam-activation');
                checks += 1;
                return `fresh-session-${checks}`;
            },
        }
    );

    assert.equal(result.stopped, false);
    assert.equal(checks, 2);
    assert.deepEqual(events, [
        ['guard', 0], ['persist', 0], ['submit', 'fresh-session-1', 'AAAAA-BBBBB-CCCCC'],
        ['guard', 1], ['persist', 1], ['submit', 'fresh-session-2', 'DDDDD-EEEEE-FFFFF'],
    ]);
    assert.ok(batch.items.every(item => item.status === 'activated'));
});

test('a true guard result preserves the latest verified session', async () => {
    const {api} = loadApi();
    const batch = activationBatch(api);
    let checks = 0;
    const sessions = [];
    await api.processSteamActivationBatch(
        batch,
        'initial-session',
        async sessionId => { sessions.push(sessionId); return successResponse; },
        () => true,
        () => {},
        {beforeSubmit: async () => ++checks === 1 ? 'fresh-session' : true}
    );

    assert.equal(checks, 2);
    assert.deepEqual(sessions, ['fresh-session', 'fresh-session']);
});

for (const [label, guard] of [
    ['false', async () => false],
    ['rejected', async () => { throw new Error('synthetic account verification failure'); }],
]) {
    test(`a ${label} guard cancels every unsubmitted key without a POST or session recheck`, async () => {
        const {api} = loadApi();
        const batch = activationBatch(api);
        let checks = 0;
        let submissions = 0;
        let rechecks = 0;
        const writes = [];
        const result = await api.processSteamActivationBatch(
            batch,
            'initial-session',
            async () => { submissions += 1; return successResponse; },
            value => { writes.push(JSON.parse(JSON.stringify(value))); return true; },
            () => {},
            {
                beforeSubmit: async () => { checks += 1; return guard(); },
                recheckSession: async () => { rechecks += 1; return {status: 'logged-out'}; },
            }
        );

        assert.equal(checks, 1);
        assert.equal(result.stopped, true);
        assert.equal(submissions, 0);
        assert.equal(rechecks, 0);
        assert.equal(writes.length, 1);
        assert.equal(writes[0].state, 'complete');
        batch.items.forEach(assertCancelled);
    });
}

test('a failed guard for the next key preserves the previous definite activation', async () => {
    const {api} = loadApi();
    const batch = activationBatch(api);
    let checks = 0;
    let submissions = 0;
    const result = await api.processSteamActivationBatch(
        batch,
        'initial-session',
        async () => { submissions += 1; return successResponse; },
        () => true,
        () => {},
        {beforeSubmit: async () => ++checks === 1}
    );

    assert.equal(result.stopped, true);
    assert.equal(submissions, 1);
    assert.equal(checks, 2);
    assert.equal(batch.items[0].status, 'activated');
    assert.equal(batch.items[0].key, null);
    assertCancelled(batch.items[1]);
});

test('without a guard legacy processing starts its POST synchronously before the first await', async () => {
    const {api} = loadApi();
    const batch = activationBatch(api, 'choice');
    const sessions = [];
    const pending = api.processSteamActivationBatch(
        batch,
        'initial-session',
        async sessionId => { sessions.push(sessionId); return successResponse; },
        () => true
    );

    assert.deepEqual(sessions, ['initial-session']);
    const result = await pending;
    assert.equal(result.stopped, false);
    assert.deepEqual(sessions, ['initial-session', 'initial-session']);
});

for (const [label, guards] of [
    ['neither guard', {}],
    ['only a context function', {isContextCurrent: () => true}],
    ['only an account function', {beforeSubmit: async () => true}],
    ['a non-function context', {isContextCurrent: true, beforeSubmit: async () => true}],
    ['a non-function account guard', {isContextCurrent: () => true, beforeSubmit: true}],
]) {
    test(`the Library runner refuses ${label} before any storage write or submission`, async () => {
        const {api, context} = loadApi();
        const batch = activationBatch(api);
        api.setChoiceActivationBatchForTest(batch);
        let writes = 0;
        let submissions = 0;
        context.GM_setValue = () => { writes += 1; };
        const result = await api.runSteamActivationWork({
            owner: 'current-owner',
            sessionId: 'initial-session',
            lockManager: immediateLockManager,
            activateKey: async () => { submissions += 1; return successResponse; },
            ...guards,
        });

        assert.equal(result.processed, false);
        assert.equal(result.libraryContextRequired, true);
        assert.equal(writes, 0);
        assert.equal(submissions, 0);
        assert.equal(JSON.stringify(api.getChoiceActivationBatchForTest()), JSON.stringify(batch));
    });
}

test('a legacy observer cannot resume or cancel Library keys after a foreign lease expires', async () => {
    const {api, context} = loadApi();
    const batch = activationBatch(api, 'library', 'closed-tab');
    api.setChoiceActivationBatchForTest(batch);
    let writes = 0;
    let submissions = 0;
    context.GM_setValue = () => { writes += 1; };
    const result = await api.runSteamActivationWork({
        owner: 'legacy-observer',
        now: () => 10000,
        sessionId: 'initial-session',
        lockManager: immediateLockManager,
        activateKey: async () => { submissions += 1; return successResponse; },
    });

    assert.equal(result.libraryContextRequired, true);
    assert.equal(result.processed, false);
    assert.equal(writes, 0);
    assert.equal(submissions, 0);
    assert.equal(JSON.stringify(api.getChoiceActivationBatchForTest()), JSON.stringify(batch));
});

test('a fully guarded Library runner forwards per-key session verification into the locked processor', async () => {
    const {api} = loadApi();
    api.setChoiceActivationBatchForTest(activationBatch(api));
    let checks = 0;
    const sessions = [];
    const result = await api.runSteamActivationWork({
        owner: 'current-owner',
        sessionId: 'initial-session',
        lockManager: immediateLockManager,
        isContextCurrent: () => true,
        beforeSubmit: async () => `fresh-session-${++checks}`,
        activateKey: async sessionId => { sessions.push(sessionId); return successResponse; },
    });

    assert.equal(result.processed, true);
    assert.equal(checks, 2);
    assert.deepEqual(sessions, ['fresh-session-1', 'fresh-session-2']);
    assert.equal(api.getChoiceActivationBatchForTest().state, 'complete');
});

for (const kind of ['choice', 'download']) {
    test(`the ${kind} runner still activates without either Library guard`, async () => {
        const {api} = loadApi();
        api.setChoiceActivationBatchForTest(activationBatch(api, kind));
        let submissions = 0;
        const result = await api.runSteamActivationWork({
            owner: 'current-owner',
            sessionId: 'initial-session',
            lockManager: immediateLockManager,
            activateKey: async () => { submissions += 1; return successResponse; },
        });

        assert.equal(result.processed, true);
        assert.equal(submissions, 2);
        assert.equal(api.getChoiceActivationBatchForTest().state, 'complete');
    });
}
