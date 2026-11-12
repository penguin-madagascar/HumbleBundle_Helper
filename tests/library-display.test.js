const assert = require('node:assert/strict');
const test = require('node:test');
const {loadUserscript} = require('./helpers/userscript');

const bundleId = '11111111-1111-4111-8111-111111111111';
const contentId = '22222222-2222-4222-8222-222222222222';
const row = (title, platforms = ['Steam'], purchased = false) => {
    const titleMarkup = `<div class="flex flex-1 items-center gap-2"><div>${platforms.map(platform => `<div aria-label="${platform}"></div>`).join('')}</div><div class="flex flex-1 flex-col justify-center"><div>${title}</div><div>Native subtitle</div></div></div>`;
    return `<div class="flex flex-col border-0">${purchased ? `<a href="/home/library/content/${contentId}">${titleMarkup}</a>` : `<div class="flex flex-wrap items-center justify-between gap-4">${titleMarkup}<div class="flex flex-col gap-1"><button>Reveal</button><button>Steam</button></div></div>`}<div class="overflow-hidden">Native key area</div></div>`;
};
const page = (html, path = `/home/library/${bundleId}`) => loadUserscript({html: `<main><h1>Example Bundle</h1>${html}</main>`, pathname: path});
const purchasedPage = () => loadUserscript({pathname: '/home/library', html: `<main><h2>您的游戏库</h2><p>Latest Choice month</p><div role="tablist"><button role="tab" aria-selected="true">Purchased</button><button role="tab">Bundles</button></div><form>${row('Steam game', ['Steam'], true)}</form></main>`});
const account = {countryCode: 'CA', ownedApps: [10], wishlistApps: [11], sessionId: 'synthetic'};

test('Library prices include only confirmed single Steam delivery, with OS labels ignored', () => {
    const {api} = page(row('Steam game', ['Steam', 'Windows']) + row('Other game', ['GOG'])
        + row('Unknown', ['Windows']) + row('Unselected platform', ['Steam', 'Epic Games']));
    assert.deepEqual(Array.from(api.getVisibleGameTitles()), ['Steam game']);
    assert.equal(api.getHelperPageMode(), 'library');
    assert.equal(api.isPriceTotalsPageForTest(), true);
});

test('Library detail controls sit under H1 and never offer unverified activation', () => {
    for (const path of [`/home/library/${bundleId}`, `/home/library/content/${contentId}`]) {
        const {api, document, requests} = page(row('Steam game'), path);
        const before = document.querySelector('main h1').textContent;
        api.ensureHelperControls();
        const controls = document.querySelector('#hb-helper-controls');
        assert.ok(controls);
        assert.equal(document.querySelector('main h1').nextElementSibling, controls);
        assert.equal(document.querySelector('main h1').textContent, before);
        assert.match(decodeURIComponent(controls.querySelector('a').href), /Example/);
        assert.ok(controls.querySelector('[data-hb-helper-library-action="activate"]').disabled);
        assert.equal(controls.querySelector('[data-hb-helper-choice-action="select"]'), null);
        assert.equal(requests.length, 0);
    }
});

test('Purchased gets a status strip under H2 with no global prices or discussion search', async () => {
    const {api, document} = purchasedPage();
    api.setSteamSessionStateForTest({status: 'authenticated', account, error: null});
    await api.installHelperRouteLifecycleForTest({syncSession: async () => {}});
    const controls = document.querySelector('#hb-helper-library-controls');
    assert.ok(controls);
    assert.equal(document.querySelector('main h2').nextElementSibling, controls);
    assert.equal(controls.nextElementSibling.textContent, 'Latest Choice month');
    assert.equal(document.querySelector('#hb-helper-price-summary'), null);
    assert.equal(document.querySelector('#steamgifts-discussion'), null);
    assert.equal(api.isPriceTotalsPageForTest(), false);
});

test('native Library rows reuse ownership and wishlist matching, excluding non-Steam and unknown platforms', async () => {
    const {api, document} = page(row('Owned') + row('Wishlist') + row('Other', ['GOG']) + row('Unknown', ['Windows']));
    const entries = api.getLibraryGameEntries();
    const app = async title => ({appid: title === 'Owned' ? 10 : 11});
    for (const entry of entries) {
        await api.markGame(entry.tile, new Set([10]), 'owned', app);
        await api.markGame(entry.tile, new Set([11]), 'wishlist', app);
    }
    const rows = document.querySelectorAll('.border-0');
    assert.ok(rows[0].classList.contains('owned'));
    assert.ok(rows[1].classList.contains('wishlist'));
    assert.ok(!rows[2].classList.contains('wishlist'));
    assert.ok(!rows[3].classList.contains('wishlist'));
});

test('Library non-Steam badges preserve titles, native subtitles, and accordion structure on repeated refresh', () => {
    const {api, document} = page(row('Other game', ['GOG']));
    api.refreshNonSteamGameMarkersForTest();
    api.refreshNonSteamGameMarkersForTest();
    const tile = document.querySelector('.border-0');
    const titleColumn = tile.querySelector('.flex-1.flex-col');
    assert.ok(tile.classList.contains('hb-helper-non-steam'));
    assert.equal(tile.children.length, 2);
    assert.equal(titleColumn.firstElementChild.textContent, 'Other game');
    assert.equal(titleColumn.children[1].textContent, 'Native subtitle');
    assert.equal(titleColumn.querySelectorAll('.hb-helper-platform-badges').length, 1);
    assert.deepEqual(Array.from(api.getLibraryGameEntries(), entry => entry.title), ['Other game']);
});

test('Steam links use independent Purchased action hosts and are removed on same-path tab changes', () => {
    const {api, document} = purchasedPage();
    const targets = api.getSteamStoreLinkTargets();
    assert.equal(targets.length, 1);
    assert.equal(targets[0].placementContainer.closest('a, button'), null);
    assert.equal(targets[0].container, document.querySelector('.border-0'));
    document.querySelectorAll('[role="tab"]').forEach(tab => tab.setAttribute('aria-selected', String(tab.textContent === 'Bundles')));
    assert.equal(api.getSteamStoreLinkTargets().length, 0);
    assert.equal(api.getLibraryGameEntries().length, 0);
});

test('leaving Library removes its Steam links from connected native rows', async () => {
    const {api, document, window, location, requests} = page(row('Steam game'));
    window.history = {
        pushState(state, title, url) { location.href = new URL(url, location.href).href; },
        replaceState(state, title, url) { location.href = new URL(url, location.href).href; },
    };
    const nativeRow = document.querySelector('.border-0');
    const pendingLink = api.ensureSteamStoreLink(api.getSteamStoreLinkTargets()[0]);
    requests[0].onload({status: 200, responseText:
        '<div class="match" data-ds-appid="10"><div class="match_name">Steam game</div></div>'});
    await pendingLink;
    assert.ok(nativeRow.querySelector('.hb-helper-steam-store-link'));
    try {
        await api.installHelperRouteLifecycleForTest({syncSession: async () => {}});
        window.history.pushState({}, '', '/store');
        await api.waitForHelperRouteForTest();
        assert.ok(nativeRow.isConnected);
        assert.equal(api.getHelperPageMode(), 'unsupported');
        assert.equal(Boolean(nativeRow.querySelector('.hb-helper-steam-store-link')), false);
        assert.equal(Boolean(nativeRow.querySelector('.hb-helper-steam-store-row')), false);
    } finally {
        window.dispatchEvent(new window.Event('pagehide'));
    }
});

test('Library native hosts wait for React commit before controls or platform decorations', () => {
    const {api, document} = page('<script src="/_next/static/chunks/test.js"></script>' + row('Other', ['GOG']));
    try {
        api.ensureHelperControls();
        api.refreshNonSteamGameMarkersForTest();
        assert.equal(document.querySelector('#hb-helper-controls'), null);
        assert.equal(document.querySelector('.hb-helper-platform-badges'), null);
        assert.equal(document.querySelector('.hb-helper-non-steam'), null);
    } finally {
        api.resetHelperHydrationForTest();
    }
});

test('Purchased explains unavailable ownership checks and removes the reminder after Steam sync', async () => {
    const {api, document, window} = purchasedPage();
    try {
        api.setSteamSessionStateForTest({status: 'logged-out', account: null, error: null});
        await api.installHelperRouteLifecycleForTest({syncSession: async () => {}});
        const controls = document.querySelector('#hb-helper-library-controls');
        assert.equal(controls.querySelector('#hb-helper-login-reminder a').href, 'https://store.steampowered.com/login/');
        api.applySteamSessionState({status: 'authenticated', account, error: null});
        assert.equal(controls.querySelector('#hb-helper-login-reminder'), null);
        assert.equal(controls.querySelectorAll('.hb-helper-library-status').length, 1);
    } finally {
        window.dispatchEvent(new window.Event('pagehide'));
    }
});
