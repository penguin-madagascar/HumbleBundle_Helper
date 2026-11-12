const assert = require('node:assert/strict');
const test = require('node:test');
const {loadUserscript} = require('./helpers/userscript');

const entitlementId = '22222222-2222-4222-8222-222222222222';
const otherEntitlementId = '33333333-3333-4333-8333-333333333333';
const bundleId = '11111111-1111-4111-8111-111111111111';
const title = 'Synthetic native Steam item';
const syntheticKey = 'AAAAA-BBBBB-CCCCC';
const target = () => ({entitlementId, keySlotId: entitlementId});

function slot(overrides = {}) {
    return {id: entitlementId, title, type: 'steam', redemptionData: {keyFormatted: null},
        expired: false, preOrdered: false, outOfStock: false, redeemable: true,
        directRedeem: null, ...overrides};
}

function row({labels = ['Steam'], buttons = '<button>兑换</button>', directButton = false} = {}) {
    return `<div class="flex flex-col border-0"><div class="flex flex-wrap items-center justify-between"><div><div class="flex flex-1 flex-col justify-center"><div>${title}</div></div>${labels.map(label => `<span aria-label="${label}"></span>`).join('')}</div>${directButton ? buttons : `<div>${buttons}</div>`}</div><div class="overflow-hidden"></div></div>`;
}

function attach(entry, props) {
    const host = {tag: 5, stateNode: entry.element, memoizedProps: {}, sibling: null};
    const parent = {tag: 0, memoizedProps: props, child: host, sibling: null};
    const root = {tag: 3, stateNode: {}, child: parent, return: null};
    host.return = parent;
    parent.return = root;
    root.stateNode.current = root;
    Object.defineProperty(entry.element, '__reactFiber$synthetic', {value: host, configurable: true});
}

function fixture({rows, labels, buttons, directButton, keys, methods, overrides, content = false} = {}) {
    const data = slot(overrides);
    const result = loadUserscript({pathname: `/home/library/${content ? `content/${entitlementId}` : bundleId}`,
        html: `<main><h1>Synthetic bundle</h1>${rows || row({labels, buttons, directButton})}</main>`,
        logger: {log() { throw Error('Unexpected logging'); }, warn() { throw Error('Unexpected logging'); }, error() { throw Error('Unexpected logging'); }}});
    result.entries = result.api.getLibraryDomEntries();
    result.data = data;
    result.props = keys || methods ? {item: {id: entitlementId, title,
        ...(methods === undefined ? {} : {deliveryMethods: methods}),
        entitlements: {keys: keys || [data], downloads: []}}} : {entitlement: data};
    result.entries.forEach(entry => attach(entry, result.props));
    result.button = result.entries[0]?.element.querySelector('button');
    result.clicks = 0;
    result.button?.addEventListener('click', () => { result.clicks++; });
    return result;
}

const rejectsCode = (promise, code) => assert.rejects(promise, error => error.code === code);

test('returns an already revealed exact slot before changed Humble availability checks', async () => {
    const {api, data, button, requests, values} = fixture({overrides: {expired: true, preOrdered: true,
        outOfStock: true, redeemable: false,
        redemptionData: {keyFormatted: syntheticKey.toLowerCase()}}, buttons: '<button>Copy</button><button>Steam</button>'});
    button.addEventListener('click', () => assert.fail('Already revealed key must not be clicked'));
    assert.equal(await api.revealLibrarySteamKey(target()), syntheticKey);
    assert.equal(data.redemptionData.keyFormatted, syntheticKey.toLowerCase());
    assert.equal(requests.length, 0);
    assert.equal(values.size, 0);
});

test('does not return a formatted non-Steam or unverified direct-redeem key', async () => {
    for (const options of [{overrides: {type: 'gog'}}, {overrides: {directRedeem: {unsupported: true}}},
        {labels: ['GOG']}, {methods: ['steam', 'gog']}]) {
        const result = fixture({...options, overrides: {...options.overrides,
            redemptionData: {keyFormatted: syntheticKey}}});
        await rejectsCode(result.api.revealLibrarySteamKey(target()), 'unsupported');
        assert.equal(result.clicks, 0);
    }
});

test('clicks the verified single native 兑换 button once and reads its fresh key', async () => {
    const result = fixture({content: true, labels: ['Steam', 'Windows']});
    const {api, data, requests, values} = result;
    let polls = 0;
    const key = await api.revealLibrarySteamKey(Object.freeze(target()), {waitForKey: async readKey => {
        polls++;
        assert.equal(readKey(), null);
        data.redemptionData.keyFormatted = syntheticKey.toLowerCase();
        return readKey();
    }});
    assert.equal(key, syntheticKey);
    assert.equal(result.clicks, 1);
    assert.equal(polls, 1);
    assert.equal(requests.length, 0);
    assert.equal(values.size, 0);
});

test('uses default polling when the native click reveals synchronously', async () => {
    const result = fixture();
    result.button.addEventListener('click', () => { result.data.redemptionData.keyFormatted = syntheticKey; });
    assert.equal(await result.api.revealLibrarySteamKey(target()), syntheticKey);
    assert.equal(result.clicks, 1);
});

test('uses a verified single native button directly inside the header', async () => {
    const result = fixture({directButton: true, content: true});
    result.button.addEventListener('click', () => { result.data.redemptionData.keyFormatted = syntheticKey; });
    assert.equal(await result.api.revealLibrarySteamKey(target()), syntheticKey);
    assert.equal(result.clicks, 1);
});

test('bounds default polling and reports an unconfirmed outcome without retrying', async () => {
    const result = fixture();
    let waits = 0;
    result.context.setTimeout = (callback, interval) => {
        assert.equal(interval, 250);
        waits++;
        callback();
    };
    await rejectsCode(result.api.revealLibrarySteamKey(target()), 'uncertain');
    assert.equal(waits, 32);
    assert.equal(result.clicks, 1);
});

test('rejects stale context before dispatch without uncertainty or a native click', async () => {
    for (const staleAt of [1, 2]) {
        const result = fixture();
        let checks = 0;
        await rejectsCode(result.api.revealLibrarySteamKey(target(), {
            isContextCurrent: () => ++checks !== staleAt,
            waitForKey: () => assert.fail('Cancelled work must not poll'),
        }), 'cancelled');
        assert.equal(result.clicks, 0);
    }
});

test('requires the exact entitlement and physical key-slot identities', async () => {
    const result = fixture();
    for (const selected of [{entitlementId: otherEntitlementId, keySlotId: entitlementId},
        {entitlementId, keySlotId: otherEntitlementId}, {entitlementId: '', keySlotId: entitlementId}]) {
        await rejectsCode(result.api.revealLibrarySteamKey(selected), 'missing');
    }
    assert.equal(result.clicks, 0);
});

test('rejects every unverified unrevealed state without clicking', async () => {
    const cases = [{type: 'Steam'}, {type: 'synthetic-steam'}, {type: undefined},
        {expired: true}, {expired: undefined}, {preOrdered: true}, {preOrdered: undefined},
        {outOfStock: true}, {outOfStock: undefined}, {redeemable: false}, {redeemable: undefined},
        {directRedeem: undefined}, {directRedeem: {}}];
    for (const overrides of cases) {
        const result = fixture({overrides});
        const waitForKey = async () => null;
        await rejectsCode(result.api.revealLibrarySteamKey(target(), {waitForKey}), 'unsupported');
        assert.equal(result.clicks, 0);
    }
});

test('requires exclusive native Steam evidence when deliveryMethods is absent', async () => {
    for (const labels of [[], ['Windows'], ['Steam', 'Epic Games'], ['Steam', 'Unknown platform']]) {
        const result = fixture({labels});
        await rejectsCode(result.api.revealLibrarySteamKey(target()), 'unsupported');
        assert.equal(result.clicks, 0);
    }
});

test('uses authoritative deliveryMethods without falling back to native labels', async () => {
    for (const methods of [[], ['gog'], ['steam', 'gog'], ['unknown-platform']]) {
        const result = fixture({methods});
        await rejectsCode(result.api.revealLibrarySteamKey(target()), 'unsupported');
        assert.equal(result.clicks, 0);
    }
    const result = fixture({methods: ['steam'], labels: []});
    result.button.addEventListener('click', () => { result.data.redemptionData.keyFormatted = syntheticKey; });
    assert.equal(await result.api.revealLibrarySteamKey(target()), syntheticKey);
    assert.equal(result.clicks, 1);
});

test('refuses a multi-key group even when the selected slot is eligible Steam', async () => {
    const result = fixture({methods: ['steam'], keys: [slot(), slot({id: 'synthetic-other-slot'})]});
    await rejectsCode(result.api.revealLibrarySteamKey(target()), 'unsupported');
    assert.equal(result.clicks, 0);
});

test('requires exactly one enabled verified native action and ignores helper checkboxes', async () => {
    for (const buttons of ['<button>Reveal key</button>', '<button>Redeem</button>',
        '<button disabled>兑换</button>', '<button aria-disabled="true">兑换</button>',
        '<button>兑换</button><button>Steam</button>', '<button>兑换</button><button>兑换</button>']) {
        const result = fixture({buttons});
        await rejectsCode(result.api.revealLibrarySteamKey(target()), 'unsupported');
        assert.equal(result.clicks, 0);
    }
    const result = fixture({buttons: '<button>兑换</button><button class="hb-helper-library-selection-toggle" role="checkbox">Select</button>'});
    result.button.addEventListener('click', () => { result.data.redemptionData.keyFormatted = syntheticKey; });
    assert.equal(await result.api.revealLibrarySteamKey(target()), syntheticKey);
    assert.equal(result.clicks, 1);
    const helperOnly = fixture({buttons: '<button class="hb-helper-library-selection-toggle" role="checkbox">兑换</button>'});
    await rejectsCode(helperOnly.api.revealLibrarySteamKey(target()), 'missing');
    assert.equal(helperOnly.clicks, 0);
});

test('deduplicates repeated entitlement rows and dispatches just one native click', async () => {
    const result = fixture({rows: row() + row()});
    const second = slot();
    attach(result.entries[1], {entitlement: second});
    const secondButton = result.entries[1].element.querySelector('button');
    secondButton.addEventListener('click', () => assert.fail('Duplicate row must not be clicked'));
    result.button.addEventListener('click', () => { result.data.redemptionData.keyFormatted = syntheticKey; });
    assert.equal(await result.api.revealLibrarySteamKey(target()), syntheticKey);
    assert.equal(result.clicks, 1);
    assert.equal(second.redemptionData.keyFormatted, null);
});

test('rejects duplicate identities with conflicting revealed keys', async () => {
    const result = fixture({rows: row() + row(), overrides: {redemptionData: {keyFormatted: syntheticKey}}});
    attach(result.entries[1], {entitlement: slot({redemptionData: {keyFormatted: 'DDDDD-EEEEE-FFFFF'}})});
    await rejectsCode(result.api.revealLibrarySteamKey(target()), 'ambiguous');
    assert.equal(result.clicks, 0);
});

test('marks a missing key after caller context changes as uncertain', async () => {
    const result = fixture();
    let current = true;
    result.button.addEventListener('click', () => { current = false; });
    await rejectsCode(result.api.revealLibrarySteamKey(target(), {
        isContextCurrent: () => current,
        waitForKey: async readKey => readKey(),
    }), 'uncertain');
    assert.equal(result.clicks, 1);
});

test('preserves a definite freshly revealed key after caller cancellation', async () => {
    const result = fixture();
    let current = true;
    result.button.addEventListener('click', () => {
        result.data.redemptionData.keyFormatted = syntheticKey;
        current = false;
    });
    assert.equal(await result.api.revealLibrarySteamKey(target(), {
        isContextCurrent: () => current,
        waitForKey: () => assert.fail('A definite key must not poll'),
    }), syntheticKey);
    assert.equal(result.clicks, 1);
});

test('preserves a definite key from fresh props after cancellation during polling', async () => {
    const result = fixture();
    let current = true;
    assert.equal(await result.api.revealLibrarySteamKey(target(), {
        isContextCurrent: () => current,
        waitForKey: async readKey => {
            assert.equal(readKey(), null);
            result.data.redemptionData.keyFormatted = syntheticKey;
            current = false;
            return readKey();
        },
    }), syntheticKey);
    assert.equal(result.clicks, 1);
});

test('preserves a definite freshly bound key after navigation with retained native DOM', async () => {
    const result = fixture();
    result.button.addEventListener('click', () => {
        result.data.redemptionData.keyFormatted = syntheticKey;
        result.location.pathname = `/home/library/${otherEntitlementId}`;
    });
    assert.equal(await result.api.revealLibrarySteamKey(target(), {waitForKey: async readKey => readKey()}), syntheticKey);
    assert.equal(result.clicks, 1);
});

test('treats navigation without a definite fresh exact-slot key as uncertain', async () => {
    for (const revealKey of [false, true]) {
        const result = fixture();
        result.button.addEventListener('click', () => {
            if (revealKey) result.data.redemptionData.keyFormatted = syntheticKey;
            result.location.pathname = `/home/library/${revealKey ? 'content/' : ''}${otherEntitlementId}`;
        });
        await rejectsCode(result.api.revealLibrarySteamKey(target(), {waitForKey: async readKey => readKey()}), 'uncertain');
        assert.equal(result.clicks, 1);
    }
});

test('keeps a frozen identity target while DOM disappearance becomes uncertain', async () => {
    const result = fixture();
    const selected = Object.freeze(target());
    await rejectsCode(result.api.revealLibrarySteamKey(selected, {waitForKey: async readKey => {
        result.data.redemptionData.keyFormatted = syntheticKey;
        result.entries[0].element.remove();
        return readKey();
    }}), 'uncertain');
    assert.deepEqual(selected, target());
    assert.equal(result.clicks, 1);
});

test('does not accept a poll return value without a fresh native key or click again on timeout', async () => {
    const result = fixture();
    await rejectsCode(result.api.revealLibrarySteamKey(target(), {
        waitForKey: async () => syntheticKey,
    }), 'uncertain');
    assert.equal(result.clicks, 1);
});

test('treats a throwing native dispatch as uncertain without a retry', async () => {
    const result = fixture();
    result.button.click = () => { result.clicks++; throw Error('Synthetic native dispatch failure'); };
    await rejectsCode(result.api.revealLibrarySteamKey(target()), 'uncertain');
    assert.equal(result.clicks, 1);
});
