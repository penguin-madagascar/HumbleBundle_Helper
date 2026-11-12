const assert = require('node:assert/strict');
const test = require('node:test');
const {loadUserscript} = require('./helpers/userscript');

const contentId = '22222222-2222-2222-2222-222222222222';
const otherId = '33333333-3333-3333-3333-333333333333';
const bundleId = '11111111-1111-1111-1111-111111111111';
const row = title => `<div class="flex flex-col border-0"><div class="flex flex-wrap items-center justify-between"><div><div class="flex flex-1 flex-col justify-center"><div>${title}</div></div></div><div><button>Reveal key</button><button>Steam</button></div></div><div class="overflow-hidden"></div></div>`;

function fixture({title = 'Synthetic Game', contentRoute = true} = {}) {
    const result = loadUserscript({html: `<main><h1>${title}</h1>${row(title)}</main>`,
        pathname: `/home/library/${contentRoute ? 'content/' + contentId : bundleId}`});
    result.entry = result.api.getLibraryDomEntries()[0];
    return result;
}

function tree(element, props = [{entitlement: {id: contentId, title: 'Synthetic Game'}}]) {
    const host = {tag: 5, stateNode: element, memoizedProps: {}, child: null, sibling: null};
    const ancestors = props.map(memoizedProps => ({tag: 0, memoizedProps, sibling: null}));
    const root = {tag: 3, stateNode: {}, return: null, sibling: null};
    const chain = [host, ...ancestors, root];
    chain.forEach((fiber, index) => {
        fiber.return = chain[index + 1] || null;
        if (index) fiber.child = chain[index - 1];
    });
    root.stateNode.current = root;
    return {host, ancestors, root};
}

function attach(entry, props) {
    const mounted = tree(entry.element, props);
    Object.defineProperty(entry.element, '__reactFiber$synthetic', {value: mounted.host, configurable: true});
    return mounted;
}

const identity = value => value && {...value};

test('binds only a live row direct entitlement and returns its verified id and title', () => {
    const {api, entry, document, requests, values} = fixture();
    attach(entry, [{entitlement: {id: contentId, title: 'Synthetic Game™', platforms: ['Steam'],
        keySlots: [{id: 'unverified-slot'}], key: 'PRIVATE_VALUE'}}]);
    const before = document.documentElement.outerHTML;
    assert.equal(typeof api.getLibraryEntitlement, 'function');
    assert.deepEqual(identity(api.getLibraryEntitlement(entry)), {id: contentId, title: 'Synthetic Game™'});
    assert.equal(document.documentElement.outerHTML, before);
    assert.equal(requests.length, 0);
    assert.equal(values.size, 0);
});

test('does not infer entitlement from route, platform labels, nested collections, or handlers', () => {
    const {api, entry} = fixture();
    assert.equal(api.getLibraryEntitlement(entry), null);
    attach(entry, [{object: {entitlements: {keys: [{id: contentId, title: entry.title}]}},
        contentId, keySlotId: 'unverified-slot', onClick() { throw Error('handler called'); }}]);
    assert.equal(api.getLibraryEntitlement(entry), null);
});

test('requires an own direct entitlement with nonempty string id and matching native title', () => {
    const {api, entry} = fixture();
    for (const entitlement of [
        {id: otherId, title: entry.title},
        {id: contentId, title: 'Another Game'},
        {id: '', title: entry.title},
        {id: '   ', title: entry.title},
        {id: 123, title: entry.title},
        {id: contentId, title: ''},
        {id: contentId, title: 123},
        Object.assign(() => {}, {id: contentId, title: entry.title}),
        Object.assign([], {id: contentId, title: entry.title}),
    ]) {
        attach(entry, [{entitlement}]);
        assert.equal(api.getLibraryEntitlement(entry), null);
    }
    attach(entry, [Object.create({entitlement: {id: contentId, title: entry.title}})]);
    assert.equal(api.getLibraryEntitlement(entry), null);
});

test('permits verified opaque entitlement ids without a content route', () => {
    const {api, entry} = fixture({contentRoute: false});
    attach(entry, [{entitlement: {id: 'synthetic-opaque-entitlement', title: entry.title}}]);
    assert.deepEqual(identity(api.getLibraryEntitlement(entry)), {id: 'synthetic-opaque-entitlement', title: entry.title});
});

test('accepts repeated identity but refuses different direct entitlement ids across ancestry', () => {
    const {api, entry} = fixture({contentRoute: false});
    const entitlement = {id: contentId, title: entry.title};
    attach(entry, [{entitlement}, {entitlement: {...entitlement}}]);
    assert.deepEqual(identity(api.getLibraryEntitlement(entry)), entitlement);
    attach(entry, [{entitlement}, {entitlement: {id: otherId, title: entry.title}}]);
    assert.equal(api.getLibraryEntitlement(entry), null);
});

test('reads committed tree ancestry after the DOM fiber expando becomes the alternate', () => {
    const {api, entry} = fixture();
    const stale = attach(entry, [{entitlement: {id: otherId, title: entry.title}}]);
    const current = tree(entry.element);
    stale.root.stateNode = current.root.stateNode;
    stale.host.alternate = current.host;
    current.host.alternate = stale.host;
    assert.deepEqual(identity(api.getLibraryEntitlement(entry)), {id: contentId, title: entry.title});
    current.ancestors[0].memoizedProps = {};
    assert.equal(api.getLibraryEntitlement(entry), null);
});

test('uses the committed child path when a shared current host retains stale return links', () => {
    const {api, entry} = fixture();
    const stale = attach(entry, [{entitlement: {id: otherId, title: entry.title}}]);
    const current = tree(entry.element);
    stale.root.stateNode = current.root.stateNode;
    current.host.return = stale.ancestors[0];
    assert.deepEqual(identity(api.getLibraryEntitlement(entry)), {id: contentId, title: entry.title});
});

test('does not bind an expando for another node or an unmounted current tree', () => {
    const {api, entry, document} = fixture();
    const mounted = attach(entry);
    mounted.host.stateNode = document.createElement('div');
    assert.equal(api.getLibraryEntitlement(entry), null);
    mounted.host.stateNode = entry.element;
    mounted.root.stateNode.current = {tag: 3, child: null};
    assert.equal(api.getLibraryEntitlement(entry), null);
});

test('refuses stale descriptors after the native title changes or the row detaches', () => {
    const {api, entry} = fixture();
    attach(entry);
    entry.titleElement.textContent = 'Another Game';
    assert.equal(api.getLibraryEntitlement(entry), null);
    entry.titleElement.textContent = entry.title;
    entry.element.remove();
    assert.equal(api.getLibraryEntitlement(entry), null);
});

test('ignores accessors throughout the fiber and entitlement path without invoking them', () => {
    const {api, entry} = fixture();
    let reads = 0;
    const getter = () => { reads++; throw Error('accessor invoked'); };
    for (const target of ['expando', 'return', 'current', 'memoizedProps', 'entitlement', 'id', 'title']) {
        const mounted = attach(entry);
        const objects = {expando: [entry.element, '__reactFiber$synthetic'], return: [mounted.host, 'return'],
            current: [mounted.root.stateNode, 'current'], memoizedProps: [mounted.ancestors[0], 'memoizedProps'],
            entitlement: [mounted.ancestors[0].memoizedProps, 'entitlement'],
            id: [mounted.ancestors[0].memoizedProps.entitlement, 'id'],
            title: [mounted.ancestors[0].memoizedProps.entitlement, 'title']};
        Object.defineProperty(...objects[target], {get: getter, configurable: true});
        assert.equal(api.getLibraryEntitlement(entry), null);
    }
    assert.equal(reads, 0);
});

test('bounds ancestry and current tree traversal and terminates on cycles', () => {
    const {api, entry} = fixture();
    const mounted = attach(entry);
    mounted.host.return = mounted.host;
    assert.equal(api.getLibraryEntitlement(entry), null);
    const deep = Array.from({length: 150}, () => ({}));
    deep[0] = {entitlement: {id: contentId, title: entry.title}};
    attach(entry, deep);
    assert.equal(api.getLibraryEntitlement(entry), null);
    const outside = Array.from({length: 17}, () => ({}));
    outside[16] = deep[0];
    attach(entry, outside);
    assert.equal(api.getLibraryEntitlement(entry), null);
    const cyclic = attach(entry);
    cyclic.root.child = {child: null, sibling: null};
    cyclic.root.child.sibling = cyclic.root.child;
    assert.equal(api.getLibraryEntitlement(entry), null);
});

test('accepts the last observed ancestry level and stops before unobserved higher props', () => {
    const {api, entry} = fixture();
    const props = Array.from({length: 16}, () => ({}));
    props[14] = {entitlement: {id: contentId, title: entry.title}};
    attach(entry, props);
    assert.deepEqual(identity(api.getLibraryEntitlement(entry)), {id: contentId, title: entry.title});
    props[14] = {};
    props[15] = {entitlement: {id: contentId, title: entry.title}};
    attach(entry, props);
    assert.equal(api.getLibraryEntitlement(entry), null);
});

test('refuses a current host beyond the bounded current tree search', () => {
    const {api, entry} = fixture();
    const mounted = attach(entry);
    let sibling = mounted.host;
    for (let index = 0; index < 20000; index += 1) sibling = {tag: 0, child: null, sibling};
    mounted.root.child = sibling;
    assert.equal(api.getLibraryEntitlement(entry), null);
});

test('fails closed for unavailable, inherited, or ambiguous React expandos', () => {
    const {api, entry} = fixture();
    attach(entry);
    Object.defineProperty(entry.element, '__reactFiber$another', {value: tree(entry.element).host});
    assert.equal(api.getLibraryEntitlement(entry), null);
    assert.equal(api.getLibraryEntitlement(null), null);
    assert.equal(api.getLibraryEntitlement({element: {}, title: entry.title}), null);
    const inherited = Object.create({__reactFiber$synthetic: tree(entry.element).host});
    assert.equal(api.getLibraryEntitlement({element: inherited, title: entry.title}), null);
});
