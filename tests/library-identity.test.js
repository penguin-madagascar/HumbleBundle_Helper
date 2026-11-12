const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function loadApi() {
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
        navigator: {language: 'en', languages: ['en']},
        location: {pathname: '/', href: 'https://www.humblebundle.com/'},
        GM_getValue(name, fallback) { return fallback; },
        GM_deleteValue() {},
        GM_registerMenuCommand() {},
        GM_xmlhttpRequest() { throw new Error('Identity tests must not make requests.'); },
        setTimeout,
        clearTimeout,
        URLSearchParams,
    };
    vm.runInNewContext(
        fs.readFileSync(path.join(__dirname, '..', 'HB_Helper.user.js'), 'utf8'),
        context,
        {filename: 'HB_Helper.user.js'}
    );
    return context.__HB_HELPER_TEST_API__;
}

const api = loadApi();
const plain = value => JSON.parse(JSON.stringify(value));
const libraryId = (viewScope = 'library-view', entitlementId = 'entitlement', keySlotId = 'slot') =>
    `library:v1:${encodeURIComponent(JSON.stringify([viewScope, entitlementId, keySlotId]))}`;
const scopedBatch = ids => ({items: ids.map(id => ({id}))});
const completeBatch = ids => ({
    version: 2,
    id: 'existing-v2-envelope',
    state: 'complete',
    runner: {phase: null, owner: null, leaseExpiresAt: null},
    ownershipRefresh: {state: 'complete', owner: null, leaseExpiresAt: null, error: null},
    items: ids.map(id => ({id, title: 'Display title', key: null, status: 'activated'})),
});

test('Library IDs round-trip canonically without normalizing opaque Unicode identities', () => {
    assert.equal(typeof api.encodeLibraryActivationItemId, 'function');
    assert.equal(typeof api.parseLibraryActivationItemId, 'function');
    const parts = ['视图/検索 : %', ' entitlement/é/e\u0301/😀 ', 'slot:"[]%:零'];
    const id = api.encodeLibraryActivationItemId(...parts);

    assert.equal(id, libraryId(...parts));
    assert.deepEqual(plain(api.parseLibraryActivationItemId(id)), {
        viewScope: parts[0],
        entitlementId: parts[1],
        keySlotId: parts[2],
    });
    assert.equal(api.encodeLibraryActivationItemId(
        ...Object.values(api.parseLibraryActivationItemId(id))
    ), id);
});

test('Library identity requires three nonempty primitive strings', () => {
    assert.equal(typeof api.encodeLibraryActivationItemId, 'function');
    assert.equal(typeof api.parseLibraryActivationItemId, 'function');
    for (const invalid of [undefined, null, '', ' \t\n', 0, {}, []]) {
        for (let index = 0; index < 3; index += 1) {
            const parts = ['view', 'entitlement', 'slot'];
            parts[index] = invalid;
            assert.throws(() => api.encodeLibraryActivationItemId(...parts), /require|identity/i);
            const id = `library:v1:${encodeURIComponent(JSON.stringify(parts))}`;
            assert.equal(api.parseLibraryActivationItemId(id), null);
        }
    }
});

test('Library IDs reject malformed versions, encoding, shapes, and noncanonical representations', () => {
    assert.equal(typeof api.parseLibraryActivationItemId, 'function');
    const encodePayload = value => `library:v1:${encodeURIComponent(value)}`;
    const valid = libraryId();
    const invalid = [
        null, 42, {}, '', 'choice-id', 'library:', 'library:v1', 'library:v2:payload',
        'library:v01:payload', 'library:v1:', 'library:v1:%', 'library:v1:%FF',
        'library:v1:%E0%A4%A',
        encodePayload('null'), encodePayload('{}'), encodePayload('"value"'),
        encodePayload('[]'), encodePayload('["view","entitlement"]'),
        encodePayload('["view","entitlement","slot","extra"]'),
        encodePayload('["view", "entitlement","slot"]'),
        encodePayload('["view","entitlement","\\u0073lot"]'),
        valid.replace('%5B', '%5b'),
        valid.replace('%22library-view%22', '%22library%2Dview%22'),
        `library:v1:${JSON.stringify(['view', 'entitlement', 'slot'])}`,
    ];
    invalid.forEach(id => assert.equal(api.parseLibraryActivationItemId(id), null, String(id)));
});

test('Library scope accepts multiple entitlements in one view and preserves physical slot identity', () => {
    const first = libraryId('view', 'entitlement-from-order-one', 'slot');
    const second = libraryId('view', 'entitlement-from-order-two', 'slot');
    const otherSlot = libraryId('view', 'entitlement-from-order-one', 'other-slot');

    assert.deepEqual(plain(api.inferActivationBatchScope(scopedBatch([first, second, otherSlot]))), {
        kind: 'library', scope: 'view',
    });
    assert.equal(api.inferActivationBatchScope(scopedBatch([first, first])), null);
    assert.equal(api.inferActivationBatchScope(scopedBatch([
        first, api.encodeChoiceActivationItemId(first, 0),
    ])), null);
    assert.deepEqual(plain(api.inferActivationBatchScope(scopedBatch([
        api.encodeChoiceActivationItemId(first, 0),
    ]))), {kind: 'library', scope: 'view'});
    assert.equal(api.inferActivationBatchScope(scopedBatch([
        api.encodeChoiceActivationItemId(first, 1),
    ])), null);
});

test('Library scopes reject different views, mixed sources, and malformed reserved IDs', () => {
    const first = libraryId();
    const download = `download:${'a'.repeat(64)}:game:0`;
    for (const ids of [
        [first, libraryId('other-view', 'other-entitlement')],
        [first, 'choice-id'],
        ['choice-id', first],
        [first, download],
        [download, first],
        ['library:v2:unknown'],
        ['library:v1:%'],
        [api.encodeChoiceActivationItemId('library:v2:unknown', 0)],
        [api.encodeChoiceActivationItemId('library:v1:%', 0)],
        [api.encodeChoiceActivationItemId(first, 0).replace('%3A', '%3a')],
    ]) {
        assert.equal(api.inferActivationBatchScope(scopedBatch(ids)), null, ids.join(', '));
        assert.equal(api.getChoiceActivationBatchForTest(completeBatch(ids)), null);
    }
});

test('existing Choice and Downloads scopes retain their valid v2 batches', () => {
    const choiceIds = ['legacy-choice-id', api.encodeChoiceActivationItemId('choice-id', 1)];
    const downloadIds = [`download:${'b'.repeat(64)}:game%20name:0`];
    for (const [ids, expected] of [
        [choiceIds, {kind: 'choice'}],
        [downloadIds, {kind: 'download', scope: 'b'.repeat(64)}],
    ]) {
        assert.deepEqual(plain(api.inferActivationBatchScope(scopedBatch(ids))), expected);
        assert.deepEqual(plain(api.getChoiceActivationBatchForTest(completeBatch(ids))), completeBatch(ids));
    }
});

test('strict v2 validation accepts Library batches without changing the envelope or statuses', () => {
    const ids = [libraryId('view', 'first-order-entitlement'), libraryId('view', 'second-order-entitlement')];
    const batch = completeBatch(ids);
    const accepted = api.getChoiceActivationBatchForTest(batch);

    assert.deepEqual(plain(api.inferActivationBatchScope(batch)), {kind: 'library', scope: 'view'});
    assert.deepEqual(plain(accepted), batch);
    assert.equal(api.getChoiceActivationBatchForTest({...batch, version: 3}), null);
    assert.equal(api.getChoiceActivationBatchForTest({...batch, viewScope: 'view'}), null);
    assert.equal(api.getChoiceActivationBatchForTest({
        ...batch,
        items: [{...batch.items[0], status: 'invented-library-status'}],
    }), null);
});
