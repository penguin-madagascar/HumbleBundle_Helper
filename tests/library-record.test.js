const assert = require('node:assert/strict');
const test = require('node:test');
const {loadUserscript} = require('./helpers/userscript');

const purchaseId = '22222222-2222-4222-8222-222222222222';
const otherPurchaseId = '33333333-3333-4333-8333-333333333333';
const bundleId = '11111111-1111-4111-8111-111111111111';
const productId = 'synthetic-product-identity';
const title = 'Synthetic Collection';
const row = (name, id) => `<div class="flex flex-col border-0">${id
    ? `<a href="/home/library/content/${id}"><div><div class="flex flex-1 flex-col justify-center"><div>${name}</div></div></div></a>`
    : `<div class="flex flex-wrap items-center justify-between"><div><div class="flex flex-1 flex-col justify-center"><div>${name}</div></div></div><div><button>Reveal key</button><button>Steam</button></div></div>`}<div class="overflow-hidden"></div></div>`;

function fixture({purchased = true, rows, contentRoute = false} = {}) {
    const markup = rows || row(title, purchased ? purchaseId : null);
    const result = loadUserscript({pathname: purchased ? '/home/library' : `/home/library/${contentRoute ? `content/${purchaseId}` : bundleId}`,
        html: purchased ? `<main><h2>Your Library</h2><div role="tablist"><button role="tab" aria-selected="true">Purchased</button></div><form>${markup}</form></main>`
            : `<main><h1>Synthetic Bundle</h1>${markup}</main>`,
        logger: {log() { throw Error('Unexpected logging'); }, warn() { throw Error('Unexpected logging'); }, error() { throw Error('Unexpected logging'); }}});
    result.entries = result.api.getLibraryDomEntries();
    result.entry = result.entries[0];
    return result;
}

function attach(entry, props) {
    const host = {tag: 5, stateNode: entry.element, memoizedProps: {}, child: null, sibling: null};
    const ancestors = props.map(memoizedProps => ({tag: 0, memoizedProps, sibling: null}));
    const root = {tag: 3, stateNode: {}, return: null, sibling: null};
    const chain = [host, ...ancestors, root];
    chain.forEach((fiber, index) => {
        fiber.return = chain[index + 1] || null;
        if (index) fiber.child = chain[index - 1];
    });
    root.stateNode.current = root;
    Object.defineProperty(entry.element, '__reactFiber$synthetic', {value: host, configurable: true});
    return {host, ancestors, root};
}

function slot(overrides = {}) {
    return {id: purchaseId, title, subTitle: 'A synthetic key', type: 'synthetic-steam',
        redemptionData: {keyFormatted: 'aaaaa-bbbbb-ccccc', externalOrderStatus: null, externalAccountName: null},
        redeemedAt: '2026-01-01T00:00:00Z', notGiftable: true, unavailableBefore: null,
        unavailableAfter: '2020-01-01T00:00:00Z', redemptionExpiryDate: null,
        customDisclaimer: '<p>Available in selected countries</p>', customCtaLabel: 'Redeem',
        customCtaUrl: 'https://example.invalid/redeem', instructionsHtml: '<p>Native instructions</p>',
        keyIntegrationId: 'shared-synthetic-platform-integration', directRedeem: null,
        giftStatus: 'synthetic-not-gifted', gameKey: null, expired: false, preOrdered: false,
        outOfStock: false, redeemable: true, ...overrides};
}

function item(overrides = {}) {
    return {id: purchaseId, contentId: productId, title, deliveryMethods: ['synthetic-steam'],
        entitlements: {keys: [slot()], downloads: []}, ...overrides};
}

const plain = value => value === null ? null : JSON.parse(JSON.stringify(value));
const expectedSlot = (overrides = {}) => ({id: purchaseId, title, type: 'synthetic-steam',
    keyFormatted: 'AAAAA-BBBBB-CCCCC', customDisclaimer: '<p>Available in selected countries</p>',
    expired: false, preOrdered: false, outOfStock: false, redeemable: true,
    giftStatus: 'synthetic-not-gifted', directRedeem: null, ...overrides});

test('reads committed React ancestry as props without changing legacy entitlement binding', () => {
    const {api, entry} = fixture({purchased: false});
    const entitlement = slot();
    const props = {entitlement};
    attach(entry, [props]);
    assert.equal(typeof api.getLibraryReactProps, 'function');
    assert.ok(Array.from(api.getLibraryReactProps(entry)).includes(props));
    assert.deepEqual({...api.getLibraryEntitlement(entry)}, {id: purchaseId, title});
    assert.deepEqual(Array.from(api.getLibraryReactProps(null)), []);
});

test('normalizes faithful Purchased item data and seven stable physical key slots', () => {
    const {api, entry, document, requests, values} = fixture();
    const keys = Array.from({length: 7}, (_, index) => slot({id: index ? `synthetic-slot-${index}` : purchaseId,
        title: index ? `Synthetic Add-on ${index}` : title}));
    attach(entry, [{item: item({entitlements: {keys, downloads: []}})}]);
    const before = document.documentElement.outerHTML;
    const result = plain(api.getLibraryRecord(entry));
    assert.deepEqual(result, {id: purchaseId, title, contentId: productId, deliveryMethods: ['synthetic-steam'],
        keySlots: keys.map(key => expectedSlot({id: key.id, title: key.title}))});
    assert.equal(new Set(result.keySlots.map(key => key.id)).size, 7);
    assert.equal(result.keySlots.some(key => 'keyIntegrationId' in key || 'gameKey' in key || 'slotIndex' in key), false);
    assert.equal(document.documentElement.outerHTML, before);
    assert.equal(requests.length, 0);
    assert.equal(values.size, 0);
    assert.equal(api.getLibraryEntitlement(entry), null);
});

test('maps detail direct entitlements independently of the bundle route UUID', () => {
    const {api, entries} = fixture({purchased: false, rows: row(title) + row('Synthetic Add-on')});
    const key = slot({id: 'synthetic-detail-slot'});
    attach(entries[0], [{entitlement: key}]);
    attach(entries[1], [{entitlement: slot({id: 'synthetic-other-slot', title: 'Synthetic Add-on'})}]);
    assert.deepEqual(plain(api.getLibraryRecord(entries[0])), {id: key.id, title,
        keySlots: [expectedSlot({id: key.id})]});
    assert.equal(api.getLibraryRecord(entries[1]).id, 'synthetic-other-slot');
    assert.notEqual(api.getLibraryRecord(entries[0]).id, bundleId);
});

test('uses explicit content-route identity agreement for detail entitlement binding', () => {
    const {api, entry} = fixture({purchased: false, contentRoute: true});
    attach(entry, [{entitlement: slot({id: otherPurchaseId})}]);
    assert.equal(api.getLibraryRecord(entry), null);
    attach(entry, [{entitlement: slot()}]);
    assert.equal(api.getLibraryRecord(entry).id, purchaseId);
});

test('keeps different purchases of the same product separate', () => {
    const {api, entries} = fixture({rows: row(title, purchaseId) + row(title, otherPurchaseId)});
    attach(entries[0], [{item: item()}]);
    attach(entries[1], [{item: item({id: otherPurchaseId, entitlements: {keys: [slot({id: otherPurchaseId})], downloads: []}})}]);
    const records = entries.map(entry => api.getLibraryRecord(entry));
    assert.deepEqual(Array.from(records, record => record.id), [purchaseId, otherPurchaseId]);
    assert.equal(records[0].contentId, records[1].contentId);
    assert.notEqual(records[0].keySlots[0].id, records[1].keySlots[0].id);
});

test('prefers exact matching item data and rejects ambiguous matching records', () => {
    const {api, entry} = fixture();
    attach(entry, [{item: item(), entitlement: slot({id: 'unrelated-slot', title: 'Unrelated'})},
        {item: item({id: otherPurchaseId, title: 'Unrelated'})}]);
    assert.equal(api.getLibraryRecord(entry).id, purchaseId);
    attach(entry, [{item: item()}, {item: item({contentId: 'conflicting-product'})}]);
    assert.equal(api.getLibraryRecord(entry), null);
    attach(entry, [{item: item()}, {item: item()}]);
    assert.equal(api.getLibraryRecord(entry).id, purchaseId);
    const detail = fixture({purchased: false});
    attach(detail.entry, [{entitlement: slot()}, {entitlement: slot({id: otherPurchaseId})}]);
    assert.equal(detail.api.getLibraryRecord(detail.entry), null);
});

test('requires matching own item identity and title, without using product or route identity as a key slot', () => {
    const {api, entry} = fixture();
    for (const candidate of [item({id: otherPurchaseId}), item({title: 'Different title'}),
        item({id: ''}), item({title: ''}), Object.create(item()),
        {...item(), entitlements: {keys: [{id: '', title}], downloads: []}}]) {
        attach(entry, [{item: candidate}]);
        assert.equal(api.getLibraryRecord(entry), null);
    }
    attach(entry, [{item: item({entitlements: {keys: [], downloads: [{id: 'synthetic-download'}]}})}]);
    assert.deepEqual(plain(api.getLibraryRecord(entry)).keySlots, []);
});

test('does not infer state from dates, gameKey, integration ids, or unverified enum values', () => {
    const {api, entry} = fixture({purchased: false});
    attach(entry, [{entitlement: slot({redemptionData: {keyFormatted: 'not a key'}, gameKey: 'AAAAA-BBBBB-CCCCC',
        type: 'unverified-delivery-type', giftStatus: 'unverified-gift-state', directRedeem: {url: 'https://example.invalid'},
        expired: false, preOrdered: true, outOfStock: true, redeemable: false})}]);
    assert.deepEqual(plain(api.getLibraryRecord(entry)).keySlots, [expectedSlot({keyFormatted: null,
        type: 'unverified-delivery-type', giftStatus: 'unverified-gift-state', directRedeem: 'unsupported',
        expired: false, preOrdered: true, outOfStock: true, redeemable: false})]);
    attach(entry, [{entitlement: {id: purchaseId, title}}]);
    assert.deepEqual(plain(api.getLibraryRecord(entry)), {id: purchaseId, title,
        keySlots: [{id: purchaseId, title, keyFormatted: null, directRedeem: 'unsupported'}]});
});

test('rejects malformed and duplicate key-slot collections rather than merging physical slots', () => {
    const {api, entry} = fixture();
    for (const keys of [null, {}, [slot(), slot()], [null], [slot({id: 12})], [slot({title: 12})], new Array(1)]) {
        attach(entry, [{item: item({entitlements: {keys, downloads: []}})}]);
        assert.equal(api.getLibraryRecord(entry), null);
    }
    attach(entry, [{item: item({deliveryMethods: ['synthetic-steam', 12]})}]);
    assert.equal(api.getLibraryRecord(entry), null);
});

test('ignores accessors for schema fields and array entries without invoking them', () => {
    const {api, entry} = fixture();
    let reads = 0;
    const getter = () => { reads++; throw Error('Accessor invoked'); };
    for (const target of ['item', 'id', 'title', 'entitlements', 'keys', 'slot', 'slotId', 'slotTitle']) {
        const key = slot();
        const data = item({entitlements: {keys: [key], downloads: []}});
        const props = {item: data};
        const targets = {item: [props, 'item'], id: [data, 'id'], title: [data, 'title'],
            entitlements: [data, 'entitlements'], keys: [data.entitlements, 'keys'],
            slot: [data.entitlements.keys, '0'], slotId: [key, 'id'], slotTitle: [key, 'title']};
        Object.defineProperty(...targets[target], {get: getter, configurable: true});
        attach(entry, [props]);
        assert.equal(api.getLibraryRecord(entry), null);
    }
    const key = slot();
    Object.defineProperty(key.redemptionData, 'keyFormatted', {get: getter});
    Object.defineProperty(key, 'gameKey', {get: getter});
    Object.defineProperty(key, 'instructionsHtml', {get: getter});
    attach(entry, [{item: item({entitlements: {keys: [key], downloads: []}})}]);
    assert.equal(api.getLibraryRecord(entry).keySlots[0].keyFormatted, null);
    assert.equal(reads, 0);
});

test('uses the committed tree and refuses detached, retitled or ambiguous hosts', () => {
    const {api, entry} = fixture();
    const stale = attach(entry, [{item: item({contentId: 'stale-product'})}]);
    const current = attach(entry, [{item: item()}]);
    Object.defineProperty(entry.element, '__reactFiber$synthetic', {value: stale.host, configurable: true});
    stale.root.stateNode = current.root.stateNode;
    current.host.return = stale.ancestors[0];
    assert.equal(api.getLibraryRecord(entry).contentId, productId);
    entry.titleElement.textContent = 'Changed native title';
    assert.equal(api.getLibraryRecord(entry), null);
    entry.titleElement.textContent = title;
    Object.defineProperty(entry.element, '__reactFiber$ambiguous', {value: current.host});
    assert.equal(api.getLibraryRecord(entry), null);
});

test('normalizes only a complete plain formatted key of three to five groups', () => {
    const {api, entry} = fixture({purchased: false});
    for (const key of ['aaaaa-bbbbb-ccccc', 'aaaaa-bbbbb-ccccc-ddddd', 'aaaaa-bbbbb-ccccc-ddddd-eeeee']) {
        attach(entry, [{entitlement: slot({redemptionData: {keyFormatted: `  ${key}\n`}})}]);
        assert.equal(api.getLibraryRecord(entry).keySlots[0].keyFormatted, key.toUpperCase());
    }
    for (const formatted of ['AAAAA-BBBBB', 'AAAAA-BBBBB-CCCCC-DDDDD-EEEEE-FFFFF',
        'AAAAA-BBBBB-CCCCC\naaaaa-bbbbb-ccccc', 'AAAAA-BBBBB-CCCCC\nDDDDD-EEEEE-FFFFF',
        'Key: AAAAA-BBBBB-CCCCC', 'AAAAA-BBBBB-CCCCC suffix', 'prefixAAAAA-BBBBB-CCCCC',
        'AAAAA-BBBBB-CCCCCsuffix']) {
        attach(entry, [{entitlement: slot({redemptionData: {keyFormatted: formatted}})}]);
        assert.equal(api.getLibraryRecord(entry).keySlots[0].keyFormatted, null);
    }
});

test('bounds key and delivery-method collections to one thousand own array entries', () => {
    const {api, entry} = fixture();
    const keys = Array.from({length: 1000}, (_, index) => slot({id: `synthetic-bounded-slot-${index}`}));
    attach(entry, [{item: item({entitlements: {keys, downloads: []}})}]);
    assert.equal(api.getLibraryRecord(entry).keySlots.length, 1000);
    keys.push(slot({id: 'synthetic-excess-slot'}));
    assert.equal(api.getLibraryRecord(entry) === null, true);
    attach(entry, [{item: item({deliveryMethods: new Array(1001).fill('synthetic-steam')})}]);
    assert.equal(api.getLibraryRecord(entry) === null, true);
    attach(entry, [{item: item({entitlements: {keys: new Array(0xFFFFFFFF), downloads: []}})}]);
    assert.equal(api.getLibraryRecord(entry) === null, true);
});
