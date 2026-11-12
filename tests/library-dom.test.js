const assert = require('node:assert/strict');
const test = require('node:test');
const {loadUserscript} = require('./helpers/userscript');

// Synthetic UUIDs describe public routes only; none is an entitlement or key-slot ID.
const bundleId = '11111111-1111-1111-1111-111111111111';
const contentId = '22222222-2222-2222-2222-222222222222';
const secondContentId = '33333333-3333-3333-3333-333333333333';
const tabs = (selected = 'Purchased') => `<div role="tablist">${['Purchased', 'Bundles', 'Vault']
    .map(label => `<button role="tab" aria-selected="${label === selected}">${label}</button>`).join('')}</div>`;
const titleColumn = title => `<div class="flex flex-1 flex-col justify-center"><div>${title}</div><div>Secondary label</div></div>`;
const leftHeader = title => `<div class="flex flex-1 items-center gap-2"><div><span aria-label="Steam"></span><span aria-label="Windows"></span></div>${titleColumn(title)}</div>`;
const purchasedRow = (title, id = contentId) => `<div class="flex flex-col border-0"><a href="/home/library/content/${id}">${leftHeader(title)}</a><div class="overflow-hidden"><div>Expanded downloads and keys</div></div></div>`;
const detailRow = title => `<div class="flex flex-col border-0"><div class="flex flex-wrap items-center justify-between gap-4"><div class="flex flex-1 items-center gap-2"><div class="flex flex-wrap items-center justify-start gap-1"><div data-state class="flex items-center justify-center" aria-label="Steam"></div></div><div class="flex flex-1 flex-col justify-center"><div>${title}</div></div></div><div class="flex flex-col gap-1"><button class="flex items-center gap-1 border border-border justify-center" type="button"><span>Reveal key</span></button><button class="justify-center flex items-center gap-1" type="button"><span>Steam</span></button></div></div><div class="overflow-hidden"><div class="flex gap-2"><div></div><div class="flex flex-1 flex-col justify-between"><div class="flex items-center gap-1"></div></div></div></div></div>`;
const featured = (heading = '您的游戏库') => `<h2>${heading}</h2><div role="region" aria-label="${heading}"><div role="group"><button><div data-testid="product-card"><div><img src="https://example.invalid/game.png" alt=""></div><div data-testid="product-card-footer"><div><div><div>Featured game</div></div><span>Price label</span></div></div></div></button></div></div>`;
const libraryPage = (rows, {selected = 'Purchased', heading = '您的游戏库', extra = ''} = {}) => `<aside>${purchasedRow('Outside main')}</aside><main>${featured(heading)}${tabs(selected)}<form><div><button aria-haspopup="dialog">Sort and filter</button><input placeholder="Search"></div><div class="flex flex-col gap-4"><div>${rows}</div></div><nav aria-label="pagination"><button>Next</button></nav></form>${extra}</main>`;
const open = (html, pathname = '/home/library') => loadUserscript({html, pathname});
const entriesWithoutElements = entries => Array.from(entries, ({title, platformLabels, routeContentId}) => ({
    title, platformLabels: Array.from(platformLabels), ...(routeContentId ? {routeContentId} : {}),
}));

test('Purchased view uses the selected native tab, localized H2, adjacent form, and featured region', () => {
    const {api, document} = open(libraryPage(purchasedRow('First game')), '/home/library?tab=bundles');
    assert.equal(typeof api.getLibraryView, 'function');
    const view = api.getLibraryView();
    assert.equal(view.kind, 'purchased');
    assert.equal(view.routeId, null);
    assert.equal(view.heading, document.querySelector('main h2'));
    assert.equal(view.form, document.querySelector('main form'));
    assert.equal(view.featuredRegion, document.querySelector('main [role="region"]'));
    assert.equal(document.querySelector('main h1'), null);
    assert.equal(api.getHelperPageMode(), 'unsupported');
});

test('Purchased descriptors read only native title and platform labels and keep actions outside the link', () => {
    const {api, document, requests} = open(libraryPage(purchasedRow('First game') + purchasedRow('Second game', secondContentId)));
    assert.equal(typeof api.getLibraryDomEntries, 'function');
    const before = document.documentElement.outerHTML;
    const entries = api.getLibraryDomEntries();
    assert.deepEqual(entriesWithoutElements(entries), [
        {title: 'Featured game', platformLabels: []},
        {title: 'First game', platformLabels: ['Steam', 'Windows'], routeContentId: contentId},
        {title: 'Second game', platformLabels: ['Steam', 'Windows'], routeContentId: secondContentId},
    ]);
    const row = entries[1];
    assert.equal(row.titleElement.textContent, 'First game');
    assert.equal(row.element.firstElementChild.tagName, 'A');
    assert.equal(row.actionHost, row.element);
    assert.equal(row.actionHost.closest('a,button'), null);
    assert.equal(entries[0].actionHost, document.querySelector('main [role="group"]'));
    assert.equal(entries[0].actionHost.closest('a,button'), null);
    for (const entry of entries) {
        assert.equal(Object.hasOwn(entry, 'entitlementId'), false);
        assert.equal(Object.hasOwn(entry, 'keySlotId'), false);
        assert.equal(Object.hasOwn(entry, 'id'), false);
    }
    assert.equal(document.documentElement.outerHTML, before);
    assert.equal(requests.length, 0);
});

test('Purchased discovery excludes same-title rows outside the native form and malformed route links', () => {
    const inside = purchasedRow('Same title');
    const badQuery = purchasedRow('Query link').replace(`content/${contentId}"`, `content/${contentId}?x=1"`);
    const badExternal = purchasedRow('External link').replace('href="/home', 'href="https://other.invalid/home');
    const noExpansion = purchasedRow('Unverified layout').replace('class="overflow-hidden"', 'class="details"');
    const {api} = open(libraryPage(inside + badQuery + badExternal + noExpansion, {
        heading: 'Your Library', extra: purchasedRow('Same title') + `<div>${featured('Unrelated region')}</div>`,
    }));
    assert.deepEqual(entriesWithoutElements(api.getLibraryDomEntries()), [
        {title: 'Featured game', platformLabels: []},
        {title: 'Same title', platformLabels: ['Steam', 'Windows'], routeContentId: contentId},
    ]);
});

test('bundle details use H1 and native rows with no invented IDs or action text in the title', () => {
    const {api, document} = open(`<aside>${detailRow('Outside main')}</aside><main><nav>${detailRow('Breadcrumb decoy')}</nav><h1>Beyond the Metroidverse Bundle</h1><div>${detailRow('First game')}${detailRow('Second game')}</div></main>`, `/home/library/${bundleId}`);
    const view = api.getLibraryView();
    assert.equal(view.kind, 'bundle');
    assert.equal(view.routeId, bundleId);
    assert.equal(view.heading, document.querySelector('main h1'));
    assert.equal(view.form, null);
    assert.equal(view.featuredRegion, null);
    const entries = api.getLibraryDomEntries();
    assert.deepEqual(entriesWithoutElements(entries), [
        {title: 'First game', platformLabels: ['Steam']},
        {title: 'Second game', platformLabels: ['Steam']},
    ]);
    for (const entry of entries) {
        assert.equal(entry.actionHost, entry.titleElement.parentElement);
        assert.equal(entry.actionHost.closest('a,button'), null);
        assert.deepEqual(Object.keys(entry).sort(), ['actionHost', 'element', 'platformLabels', 'title', 'titleElement']);
    }
});

test('single-content detail exposes its route content ID without treating it as entitlement identity', () => {
    const {api, document} = open(`<main><h1>Single game</h1>${detailRow('Single game')}</main>`, `/home/library/content/${contentId}/`);
    const view = api.getLibraryView();
    assert.equal(view.kind, 'content');
    assert.equal(view.routeId, contentId);
    assert.equal(view.heading, document.querySelector('main h1'));
    assert.deepEqual(entriesWithoutElements(api.getLibraryDomEntries()), [
        {title: 'Single game', platformLabels: ['Steam'], routeContentId: contentId},
    ]);
});

test('multiple native content rows do not each claim the single page route content ID', () => {
    const {api} = open(`<main><h1>Single game</h1>${detailRow('First row')}${detailRow('Second row')}</main>`, `/home/library/content/${contentId}`);
    assert.deepEqual(entriesWithoutElements(api.getLibraryDomEntries()), [
        {title: 'First row', platformLabels: ['Steam']},
        {title: 'Second row', platformLabels: ['Steam']},
    ]);
});

test('outer Bundles and Vault views expose no game rows from the Purchased layout', () => {
    for (const [selected, kind] of [['Bundles', 'bundles'], ['Vault', 'vault']]) {
        const {api} = open(libraryPage(purchasedRow('Not a verified game row'), {selected}));
        assert.equal(api.getLibraryView().kind, kind);
        assert.equal(api.getLibraryDomEntries().length, 0);
    }
});

test('unknown routes or tabs remain unsupported without enabling a helper controller', () => {
    for (const pathname of ['/library', '/home/library/no-uuid', `/home/library/${bundleId}/extra`]) {
        const {api} = open(libraryPage(purchasedRow('Do not discover')), pathname);
        assert.equal(api.getLibraryView().kind, 'unsupported');
        assert.equal(api.getLibraryDomEntries().length, 0);
        assert.equal(api.getHelperPageMode(), 'unsupported');
    }
    for (const html of [
        libraryPage(purchasedRow('Do not discover'), {selected: 'Purchased'}).replace('>Purchased</button>', '>Unknown tab</button>'),
        libraryPage(purchasedRow('Do not discover')).replace('>Purchased</button>', '>constructor</button>'),
        libraryPage(purchasedRow('Do not discover')).replace('aria-selected="false">Bundles', 'aria-selected="true">Bundles'),
        '<main><h2>Your Library</h2><form></form></main>',
    ]) {
        const {api} = open(html);
        assert.equal(api.getLibraryView().kind, 'unsupported');
        assert.equal(api.getLibraryDomEntries().length, 0);
    }
});
