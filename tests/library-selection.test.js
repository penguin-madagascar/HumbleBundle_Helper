const assert = require('node:assert/strict');
const test = require('node:test');
const {loadUserscript} = require('./helpers/userscript');

const bundleId = '11111111-1111-4111-8111-111111111111';
const firstId = '22222222-2222-4222-8222-222222222222';
const secondId = '33333333-3333-4333-8333-333333333333';
const account = {countryCode: 'CA', ownedApps: [10], wishlistApps: [], sessionId: 'synthetic'};
const fixtures = [];
test.afterEach(() => {
    for (const {window, api} of fixtures.splice(0)) {
        window.dispatchEvent(new window.Event('pagehide'));
        api.resetHelperHydrationForTest();
    }
});
const titleMarkup = (title, platform) => `<div class="flex flex-1 items-center gap-2"><div aria-label="${platform}"></div><div class="flex flex-1 flex-col justify-center"><div>${title}</div><div>Native subtitle</div></div></div>`;
const row = ({title = 'Same game', id = firstId, platform = 'Steam'} = {}, purchased) => `<div class="flex flex-col border-0">${purchased
    ? `<a href="/home/library/content/${id}">${titleMarkup(title, platform)}</a>`
    : `<div class="flex flex-wrap items-center justify-between gap-4">${titleMarkup(title, platform)}<div><button>Reveal key</button><button>Steam</button></div></div>`}<div class="overflow-hidden">Native key area</div></div>`;

function bind(entry, {id = firstId, slotId = 'slot-1', keys, platform = 'steam',
    deliveryMethods = [platform], productMethods} = {}, purchased) {
    const slot = {id: slotId, title: entry.title, type: 'synthetic-key',
        redemptionData: {keyFormatted: null}, customDisclaimer: '', expired: false,
        preOrdered: false, outOfStock: false, redeemable: true, giftStatus: '', directRedeem: null};
    const memoizedProps = purchased ? {item: {id, contentId: 'same-product', title: entry.title,
        deliveryMethods, entitlements: {keys: keys || [slot], downloads: []}}}
        : {entitlement: {...slot, id}};
    const host = {tag: 5, stateNode: entry.element, memoizedProps: {}, child: null, sibling: null};
    const component = {tag: 0, memoizedProps, child: host, sibling: null};
    const ancestor = productMethods ? {tag: 0, memoizedProps: {subscriptionProducts: [{id: 'display-product',
        title: entry.title, deliveryMethods: productMethods}]}, child: component, sibling: null} : null;
    const root = {tag: 3, stateNode: {}, child: ancestor || component, return: null, sibling: null};
    host.return = component;
    component.return = ancestor || root;
    if (ancestor) ancestor.return = root;
    root.stateNode.current = root;
    Object.defineProperty(entry.element, '__reactFiber$selection', {value: host, configurable: true});
}

function fixture(records = [{}, {id: secondId}], kind = 'purchased', {next = false} = {}) {
    const purchased = kind === 'purchased';
    const html = `<main>${purchased ? '<h2>Your Library</h2><div role="tablist"><button role="tab" aria-selected="true">Purchased</button><button role="tab" aria-selected="false">Bundles</button></div><form><input aria-label="Search"><button aria-haspopup="dialog">Sort and filter</button>' : '<h1>Example Bundle</h1>'}${records.map(record => row(record, purchased)).join('')}${purchased ? '<nav aria-label="pagination"><button>Next</button></nav></form>' : ''}</main>${next ? '<script src="/_next/static/chunks/synthetic.js"></script>' : ''}`;
    const result = loadUserscript({html, pathname: purchased ? '/home/library'
        : `/home/library/${kind === 'content' ? 'content/' + firstId : bundleId}`});
    result.api.getLibraryGameEntries().forEach((entry, index) => {
        if (records[index].unbound) return;
        bind(entry, records[index], purchased);
    });
    fixtures.push(result);
    return result;
}

const controls = document => document.querySelector('.hb-helper-library-status');
const action = (document, name) => controls(document)?.querySelector(`[data-hb-helper-library-action="${name}"]`);
const toggles = document => [...document.querySelectorAll('.hb-helper-library-selection-toggle')];
const selected = api => [...api.getSelectedLibraryRecordIdsForTest()];
function featuredFixture(record, purchased = true) {
    const result = loadUserscript({pathname: '/home/library', html: '<main><h2>Your Library</h2><div role="region" aria-label="Your Library"><div role="group"><button><div data-testid="product-card"><img alt=""><div data-testid="product-card-footer"><div><div><div>Featured game</div></div></div></div></div></button></div></div><div role="tablist"><button role="tab" aria-selected="true">Purchased</button></div><form></form></main>'});
    fixtures.push(result);
    bind(result.api.getLibraryGameEntries()[0], record, purchased);
    return result;
}
function click(api, target, type = 'click', key) {
    let prevented = false;
    api.handleLibrarySelectionEventForTest({target, type, key,
        preventDefault() { prevented = true; }, stopPropagation() {}, stopImmediatePropagation() {}});
    return prevented;
}

test('Library selection keeps equal titles and product IDs separate by live purchase identity', async () => {
    const {api, document, values, requests} = fixture();
    api.setSteamSessionStateForTest({status: 'authenticated', account, error: null});
    await api.installHelperRouteLifecycleForTest({syncSession: async () => {}});
    assert.equal(toggles(document).length, 2);
    assert.equal(toggles(document)[0].closest('a, button') === toggles(document)[0], true);
    assert.equal(toggles(document)[0].parentElement.closest('a, button'), null);
    assert.equal(action(document, 'activate').disabled, true);
    click(api, toggles(document)[0]);
    assert.deepEqual(selected(api), [firstId]);
    assert.deepEqual(toggles(document).map(button => button.getAttribute('aria-checked')), ['true', 'false']);
    assert.equal(values.size, 0);
    assert.equal(requests.some(request => request.method === 'POST'), false);
});

test('duplicate rows of the same entitlement share selection while different purchases do not', () => {
    const {api, document} = fixture([{}, {}, {id: secondId}]);
    api.refreshLibrarySelectionForTest();
    click(api, toggles(document)[1]);
    assert.deepEqual(selected(api), [firstId]);
    assert.deepEqual(toggles(document).map(button => button.getAttribute('aria-checked')), ['true', 'true', 'false']);
    click(api, toggles(document)[0], 'keydown', ' ');
    assert.deepEqual(selected(api), []);
    click(api, toggles(document)[2], 'keydown', 'Enter');
    assert.deepEqual(selected(api), [secondId]);
});

test('native cards navigate normally until selection mode is active and Steam links stay independent', () => {
    const {api, document} = fixture([{}]);
    api.refreshLibrarySelectionForTest();
    const link = document.querySelector('main form a');
    assert.equal(click(api, link), false);
    api.setLibrarySelectionModeForTest(true);
    assert.equal(click(api, link), true);
    assert.deepEqual(selected(api), [firstId]);
    const steamLink = document.createElement('a');
    steamLink.className = 'hb-helper-steam-store-link';
    link.parentElement.appendChild(steamLink);
    assert.equal(click(api, steamLink), false);
    assert.deepEqual(selected(api), [firstId]);
});

test('featured card parent button selects only a bound purchase while helper checkbox stays outside it', () => {
    const {api, document} = featuredFixture({});
    api.refreshLibrarySelectionForTest();
    const nativeButton = document.querySelector('[role="group"] > button');
    assert.equal(toggles(document)[0].parentElement, nativeButton.parentElement);
    assert.equal(click(api, nativeButton), false);
    api.setLibrarySelectionModeForTest(true);
    assert.equal(click(api, nativeButton), true);
    assert.deepEqual(selected(api), [firstId]);
});

test('featured display-only Steam product hints cannot grant selection to another delivery method', () => {
    for (const deliveryMethods of [['gog'], ['steam', 'gog'], ['steam', 'unknown-provider'], []]) {
        const {api, document} = featuredFixture({deliveryMethods, productMethods: ['steam']});
        api.refreshLibrarySelectionForTest();
        assert.equal(toggles(document).length, 0, `must not select ${JSON.stringify(deliveryMethods)}`);
    }
    const {api, document} = featuredFixture({deliveryMethods: ['Steam key'], productMethods: ['steam']});
    api.refreshLibrarySelectionForTest();
    assert.equal(toggles(document).length, 1);
});

test('a bound entitlement without delivery methods needs native Steam proof rather than product hints', () => {
    const featured = featuredFixture({productMethods: ['steam']}, false);
    featured.api.refreshLibrarySelectionForTest();
    assert.equal(toggles(featured.document).length, 0);
    const native = fixture([{}], 'bundle');
    native.api.refreshLibrarySelectionForTest();
    assert.equal(toggles(native.document).length, 1);
    const other = fixture([{platform: 'GOG'}], 'bundle');
    other.api.refreshLibrarySelectionForTest();
    assert.equal(toggles(other.document).length, 0);
});

test('selection omits non-Steam, unbound, and slotless rows and leaves their native clicks alone', () => {
    const {api, document} = fixture([{}, {id: secondId, platform: 'GOG'},
        {id: secondId, unbound: true}, {id: secondId, keys: []}]);
    api.refreshLibrarySelectionForTest();
    assert.equal(toggles(document).length, 1);
    api.setLibrarySelectionModeForTest(true);
    const nativeLinks = document.querySelectorAll('main form a');
    assert.equal(click(api, nativeLinks[1]), false);
    assert.equal(click(api, nativeLinks[2]), false);
    assert.equal(click(api, nativeLinks[3]), false);
});

test('bundle details have selection but a content detail only offers disabled Activate this game', () => {
    for (const kind of ['bundle', 'content']) {
        const {api, document} = fixture([{}], kind);
        api.ensureHelperControls();
        api.refreshLibrarySelectionForTest();
        assert.equal(action(document, 'activate').disabled, true);
        if (kind === 'content') {
            assert.equal(action(document, 'activate').textContent, 'Activate this game');
            assert.equal(action(document, 'select'), null);
            assert.equal(action(document, 'clear'), null);
            assert.equal(action(document, 'select-unowned'), null);
            assert.equal(toggles(document).length, 0);
        } else {
            assert.ok(action(document, 'select'));
            assert.ok(action(document, 'clear'));
            assert.ok(action(document, 'select-unowned'));
            assert.equal(toggles(document).length, 1);
        }
    }
});

test('same-path native search, filter, submit, pagination, and tab actions clear selection', () => {
    const {api, document} = fixture([{}]);
    const targets = [
        ['input', document.querySelector('input')], ['change', document.querySelector('input')],
        ['submit', document.querySelector('form')],
        ['click', document.querySelector('[aria-haspopup="dialog"]')],
        ['click', document.querySelector('nav button')],
        ['click', document.querySelector('[role="tab"]')],
    ];
    for (const [type, target] of targets) {
        api.refreshLibrarySelectionForTest();
        click(api, toggles(document)[0]);
        assert.deepEqual(selected(api), [firstId]);
        api.handleLibraryViewEventForTest({type, target});
        assert.deepEqual(selected(api), []);
    }
});

test('panel replacement, URL changes, leaving Library, and pagehide discard memory selection', async () => {
    const {api, document, location, window} = fixture([{}]);
    api.setSteamSessionStateForTest({status: 'authenticated', account, error: null});
    await api.installHelperRouteLifecycleForTest({syncSession: async () => {}});
    click(api, toggles(document)[0]);
    const form = document.querySelector('form');
    const replacement = form.cloneNode(true);
    form.replaceWith(replacement);
    api.refreshLibrarySelectionForTest();
    assert.deepEqual(selected(api), []);
    bind(api.getLibraryGameEntries()[0], {}, true);
    api.refreshLibrarySelectionForTest();
    click(api, toggles(document)[0]);
    location.search = '?page=2';
    api.refreshLibrarySelectionForTest();
    assert.deepEqual(selected(api), []);
    click(api, toggles(document)[0]);
    window.dispatchEvent(new window.Event('pagehide'));
    assert.deepEqual(selected(api), []);
    api.refreshLibrarySelectionForTest();
    click(api, toggles(document)[0]);
    location.pathname = '/store';
    api.refreshLibrarySelectionForTest();
    assert.deepEqual(selected(api), []);
    assert.equal(toggles(document).length, 0);
    assert.equal(document.querySelector('.hb-helper-library-selected'), null);
    assert.equal(controls(document), null);
});

test('native row disappearance alone does not erase selected identities', () => {
    const {api, document} = fixture([{}, {id: secondId}]);
    api.refreshLibrarySelectionForTest();
    click(api, toggles(document)[0]);
    document.querySelector('.border-0').remove();
    api.refreshLibrarySelectionForTest();
    assert.deepEqual(selected(api), [firstId]);
});

test('same-path native tab changes remove stale selection controls and classes', () => {
    const {api, document} = fixture([{}]);
    api.refreshLibrarySelectionForTest();
    click(api, toggles(document)[0]);
    const nativeTabs = document.querySelectorAll('[role="tab"]');
    nativeTabs[0].setAttribute('aria-selected', 'false');
    nativeTabs[1].setAttribute('aria-selected', 'true');
    api.refreshLibrarySelectionForTest();
    assert.deepEqual(selected(api), []);
    assert.equal(toggles(document).length, 0);
    assert.equal(document.querySelector('.hb-helper-library-selected'), null);
    assert.equal(controls(document), null);
});

test('select unowned requires account data and matches Steam ownership without claiming keys', async () => {
    const {api, document, requests, values} = fixture([{title: 'Owned'}, {id: secondId, title: 'Unowned'}], 'bundle');
    api.ensureHelperControls();
    assert.equal(action(document, 'select-unowned').disabled, true);
    let lookups = 0;
    await api.selectUnownedLibraryEntriesForTest({findApp: async () => { lookups += 1; }});
    assert.equal(lookups, 0);
    api.setSteamSessionStateForTest({status: 'authenticated', account, error: null});
    api.refreshLibrarySelectionForTest();
    await api.selectUnownedLibraryEntriesForTest({findApp: async title => ({appid: title === 'Owned' ? 10 : 11})});
    assert.deepEqual(selected(api), [secondId]);
    assert.equal(action(document, 'activate').disabled, true);
    assert.equal(requests.length, 0);
    assert.equal([...values.keys()].some(key => /library.*select/i.test(key)), false);
});

test('unowned lookup preserves selection while pending and ignores a result after a new view or Clear', async () => {
    const {api, document, location} = fixture([{}], 'bundle');
    api.setSteamSessionStateForTest({status: 'authenticated', account, error: null});
    api.ensureHelperControls();
    click(api, toggles(document)[0]);
    let finish;
    const lookup = api.selectUnownedLibraryEntriesForTest({findApp: () => new Promise(resolve => { finish = resolve; })});
    assert.deepEqual(selected(api), [firstId]);
    assert.equal(action(document, 'select-unowned').disabled, true);
    action(document, 'clear').click();
    finish({appid: 11});
    await lookup;
    assert.deepEqual(selected(api), []);
    const secondLookup = api.selectUnownedLibraryEntriesForTest({findApp: () => new Promise(resolve => { finish = resolve; })});
    location.search = '?page=2';
    api.refreshLibrarySelectionForTest();
    finish({appid: 11});
    await secondLookup;
    assert.deepEqual(selected(api), []);
});

test('unowned selection stops at an account switch before another Steam lookup', async () => {
    const {api} = fixture([{}, {id: secondId}], 'bundle');
    api.setSteamSessionStateForTest({status: 'authenticated', account, error: null});
    let finish;
    let lookups = 0;
    const pending = api.selectUnownedLibraryEntriesForTest({findApp: () => {
        lookups += 1;
        return new Promise(resolve => { finish = resolve; });
    }});
    api.setSteamSessionStateForTest({status: 'authenticated', account: {...account, ownedApps: []}, error: null});
    finish({appid: 11});
    await pending;
    assert.equal(lookups, 1);
    assert.deepEqual(selected(api), []);
});

test('selection controls do not decorate Next native hosts before their React commit', () => {
    const {api, document} = fixture([{unbound: true}], 'bundle', {next: true});
    try {
        const before = document.querySelector('main').outerHTML;
        api.refreshLibrarySelectionForTest();
        api.ensureHelperControls();
        assert.equal(document.querySelector('main').outerHTML, before);
        assert.equal(toggles(document).length, 0);
    } finally {
        api.resetHelperHydrationForTest();
    }
});
