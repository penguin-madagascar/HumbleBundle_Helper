const assert = require('node:assert/strict');
const test = require('node:test');
const {loadUserscript} = require('./helpers/userscript');
const id = '22222222-2222-4222-8222-222222222222';
const bundle = '11111111-1111-4111-8111-111111111111';
const nativeRow = '<div class="flex flex-col border-0"><div class="flex flex-wrap items-center justify-between"><div><div aria-label="Steam"></div><div class="flex flex-1 flex-col justify-center"><div>One</div></div></div><div><button>Copy key</button><button>Steam</button></div></div><div class="overflow-hidden">Native details</div></div>';
function attach(entry, propsList) {
    const host = {tag: 5, stateNode: entry.element, memoizedProps: {}, sibling: null};
    const chain = [host, ...propsList.map(memoizedProps => ({tag: 0, memoizedProps, sibling: null}))];
    const root = {tag: 3, memoizedState: {isDehydrated: false}, stateNode: {}, return: null, sibling: null};
    chain.push(root);
    for (let index = 0; index < chain.length - 1; index++) {
        chain[index].return = chain[index + 1];
        chain[index + 1].child = chain[index];
    }
    root.stateNode.current = root;
    Object.defineProperty(entry.element, '__reactFiber$metadata', {value: host, configurable: true});
}
function featured(products) {
    const result = loadUserscript({pathname: '/home/library', html: '<main><h2>Your Library</h2><div role="region" aria-label="Your Library"><div role="group"><button><div data-testid="product-card"><img alt=""><div data-testid="product-card-footer"><div><div><div>One</div></div></div></div></div></button></div></div><div role="tablist"><button role="tab" aria-selected="true">Purchased</button></div><form></form></main>'});
    attach(result.api.getLibraryDomEntries()[0], [{subscriptionProducts: products, subscriptionEntitlement: null}]);
    return result;
}
const product = (deliveryMethods, productId = 'public-product') => ({id: productId, title: 'One', productType: 'humble-choice', deliveryMethods});

test('featured Choice uses observed subscriptionProducts for platform display without inventing an entitlement', async () => {
    const {api} = featured([product(['steam'])]);
    const entries = api.getLibraryGameEntries();
    assert.deepEqual(Array.from(api.getVisibleGameTitles()), ['One']);
    assert.equal(api.getLibraryRecord(entries[0]), null);
    assert.equal(api.getSteamStoreLinkTargets().length, 1);
    await api.markGame(entries[0].tile, new Set([42]), 'owned', async () => ({appid: 42}));
    assert.ok(entries[0].tile.classList.contains('owned'));
});

test('featured non-Steam platform and unknown delivery alternatives cannot become Steam matches', () => {
    for (const methods of [['gog'], ['steam', 'future-store']]) {
        const {api, document} = featured([product(methods)]);
        api.refreshNonSteamGameMarkersForTest();
        assert.deepEqual(Array.from(api.getVisibleGameTitles()), []);
        assert.equal(api.getSteamStoreLinkTargets().length, 0);
        if (methods[0] === 'gog') assert.ok(document.querySelector('.hb-helper-non-steam'));
    }
});

test('ambiguous same-title Choice products and getter-backed metadata remain unclassified', () => {
    const {api} = featured([product(['steam'], 'one'), product(['gog'], 'two')]);
    assert.deepEqual(Array.from(api.getVisibleGameTitles()), []);
    const second = featured([]);
    const props = {};
    Object.defineProperty(props, 'subscriptionProducts', {get() { throw Error('getter invoked'); }});
    attach(second.api.getLibraryDomEntries()[0], [props]);
    assert.deepEqual(Array.from(second.api.getVisibleGameTitles()), []);
});

for (const disclaimer of ['', '<p>Activation is restricted to Canada.</p><script>window.changed=true</script><img src="x" onerror="alert(1)">']) {
    test(`Library key notices ${disclaimer ? 'preserve native disclaimer text without copying active markup' : 'state when region data was not provided'}`, () => {
        const {api, document, requests, context} = loadUserscript({pathname: `/home/library/${bundle}`, html: `<main><h1>Bundle</h1>${nativeRow}</main>`});
        const entry = api.getLibraryDomEntries()[0];
        attach(entry, [{entitlement: {id, title: 'One', type: 'synthetic', redemptionData: {keyFormatted: 'AAAAA-BBBBB-CCCCC'}, customDisclaimer: disclaimer}}]);
        assert.equal(typeof api.ensureLibraryRegionWarningsForTest, 'function');
        api.ensureLibraryRegionWarningsForTest();
        api.ensureLibraryRegionWarningsForTest();
        const warning = document.querySelector('.hb-helper-library-region-warning');
        assert.ok(warning);
        assert.equal(document.querySelectorAll('.hb-helper-library-region-warning').length, 1);
        assert.equal(warning.closest('button,a'), null);
        if (disclaimer) assert.match(warning.textContent, /Activation is restricted to Canada\./);
        else assert.match(warning.textContent, /not provided|未提供/);
        assert.equal(warning.querySelector('script,img,a'), null);
        assert.ok(!warning.textContent.includes('AAAAA-BBBBB-CCCCC'));
        assert.equal(context.changed, undefined);
        assert.equal(requests.length, 0);
    });
}

test('targeted Library entry lookup does not traverse unrelated featured product props', () => {
    const {api, document} = featured([product(['steam'])]);
    document.querySelector('form').innerHTML = `<div class="flex flex-col border-0"><a href="/home/library/content/${id}"><div><span aria-label="Steam"></span><div class="flex flex-1 flex-col justify-center"><div>Native Steam row</div></div></div></a><div class="overflow-hidden"></div></div>`;
    const row = document.querySelector('.border-0');
    const entries = api.getLibraryGameEntries({tile: row});
    assert.deepEqual(Array.from(entries, entry => entry.title), ['Native Steam row']);
});

test('bound featured purchase delivery takes precedence over a Steam product offer', () => {
    const {api, document} = featured([product(['steam'])]);
    const entry = api.getLibraryDomEntries()[0];
    attach(entry, [{item: {id: 'synthetic-purchase', title: 'One', deliveryMethods: ['gog'],
        entitlements: {keys: [{id, title: 'One', type: 'synthetic-gog'}]}}}, {subscriptionProducts: [product(['steam'])]}]);
    assert.deepEqual(Array.from(api.getVisibleGameTitles()), []);
    assert.equal(api.getSteamStoreLinkTargets().length, 0);
    api.refreshNonSteamGameMarkersForTest();
    assert.ok(document.querySelector('.hb-helper-non-steam'));
});
