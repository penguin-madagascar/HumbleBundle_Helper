const assert = require('node:assert/strict');
const test = require('node:test');
const {flightScript, loadUserscript} = require('./helpers/userscript');

function product(id, deliveryMethods = ['steam'], extra = {}) {
    return {id, productType: 'humble-choice', title: `Game ${id}`,
        thumbnail: `https://example.invalid/${id}.jpg`, deliveryMethods, ...extra};
}

function memberCard(item) {
    return `<button type="button"><div data-testid="product-card">
      <div data-testid="product-thumbnail"><img alt="" src="${item.thumbnail}"></div>
      <div data-testid="product-card-footer"><div class="group/product-title">
        <div><div class="line-clamp-1">${item.title}</div></div>
      </div><div>Details</div></div>
    </div></button>`;
}

function memberPage(items, {ownedApps = [], language = 'en', cards = items} = {}) {
    const loaded = loadUserscript({pathname: '/membership/home',
        values: new Map([['hb-helper-language-v1', language]]), html: `
        ${flightScript({e: {subscriptionProducts: items}})}
        <main><section><h1>2026年11月 Humble Choice</h1>
          <div class="grid">${cards.map(memberCard).join('')}</div>
        </section></main><div id="hb-helper-price-summary"></div>`});
    loaded.api.setSteamDerivedStateForTest({countryCode: 'UA', ownedApps,
        wishlistApps: [], sessionId: 'session'});
    loaded.api.refreshNonSteamGameMarkersForTest();
    loaded.summary = loaded.document.getElementById('hb-helper-price-summary');
    return loaded;
}

function dependencies({findApp, price} = {}) {
    return {
        findSteamApp: findApp || (async title => ({appid: 10, name: title})),
        resolveHumbleCurrencyCode: async () => 'UAH',
        fetchXiaoheihePriceHistory: price || (async () => ({
            current: 100, original: 150, lowest: 80, currency: 'UAH',
        })),
        fetchExchangeRate: async () => 1,
    };
}

function details(page) {
    return page.summary.querySelector('.hb-helper-other-platform-details');
}

function rows(page) {
    return Array.from(details(page)?.querySelectorAll('li') || [], row => row.textContent);
}

function replaceProducts(page, items) {
    page.document.querySelector('script').textContent = flightScript({e: {subscriptionProducts: items}}).slice(8, -9);
}

function deferred() {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return {promise, resolve};
}

async function waitFor(check) {
    for (let i = 0; i < 30; i += 1) {
        if (check()) return;
        await new Promise(resolve => setImmediate(resolve));
    }
    assert.fail('The scheduled price summary did not settle');
}

test('Choice totals list non-Steam titles and their exact platforms without affecting Steam totals', async () => {
    const items = [product('steam'), product('battle', ['blizzard']), product('gog', ['gog']),
        product('epic', ['epic']), product('ign', ['external_key'], {title: 'IGN Plus Subscription'})];
    const page = memberPage(items);
    const matched = [];
    await page.api.loadPriceTotalsForTest(Array.from(page.api.getVisibleGameTitles()), dependencies({
        findApp: async title => { matched.push(title); return {appid: 10, name: title}; },
    }));
    assert.deepEqual(matched, [items[0].title]);
    assert.ok(details(page), 'the other-platform disclosure is rendered');
    assert.equal(details(page).open, false);
    assert.equal(details(page).querySelector('summary').textContent, 'Other platform items (4)');
    assert.equal(details(page).classList.contains('hb-helper-disclosure'), true);
    assert.deepEqual(rows(page).map(row => row.split('—')[0].trim()), items.slice(1).map(item => item.title));
    for (const [index, label] of ['Battle.net', 'GOG', 'Epic Games', 'IGN Plus'].entries()) {
        assert.ok(rows(page)[index].includes(label));
    }
    assert.match(page.summary.textContent, /1\/1 Steam items identified/);
    assert.match(page.summary.querySelector('.hb-helper-price-value').textContent, /100\.00/);
    assert.equal(page.summary.querySelector('.hb-helper-match-details'), null);
});

test('Chinese other-platform disclosure remains usable alongside the all-owned notice', async () => {
    const page = memberPage([product('steam'), product('battle', ['blizzard'])],
        {ownedApps: [10], language: 'zh-CN'});
    await page.api.loadPriceTotalsForTest(['Game steam'], dependencies());
    assert.ok(page.summary.querySelector('.hb-helper-all-owned'));
    assert.ok(details(page));
    assert.equal(details(page).querySelector('summary').textContent, '其他平台项目（1）');
    assert.equal(details(page).closest('[aria-hidden="true"], [inert]'), null);
    details(page).open = true;
    page.summary.querySelector('#hb-helper-price-scope').click();
    assert.equal(details(page).open, true);
    assert.match(rows(page)[0], /Game battle.*Battle\.net/);
});

test('ordinary bundle totals use native redemption icons and omit OS labels', async () => {
    const card = (title, platform) => `<button><div data-testid="bundle-item-card" data-bundle-type="games">
      <div data-testid="bundle-item-native-image"><img alt="${title}"></div>
      <div><div class="line-clamp-2">${title}</div></div>
      <div data-testid="platform-icons"><div role="img" aria-label="${platform}"></div>
        <div role="img" aria-label="Windows"></div></div>
    </div></button>`;
    const page = loadUserscript({html: `<section data-bundle-section="games">
      ${card('Steam Game', 'Steam')}${card('GOG Game', 'GOG')}</section>
      <div id="hb-helper-price-summary"></div>`});
    page.summary = page.document.getElementById('hb-helper-price-summary');
    page.api.setSteamDerivedStateForTest({countryCode: 'UA', ownedApps: [], wishlistApps: [], sessionId: 'session'});
    page.api.refreshNonSteamGameMarkersForTest();
    await page.api.loadPriceTotalsForTest(Array.from(page.api.getVisibleGameTitles()), dependencies());
    assert.equal(rows(page).length, 1);
    assert.match(rows(page)[0], /GOG Game.*GOG/);
    assert.doesNotMatch(rows(page)[0], /Windows/);
});

test('repeated cards and platform aliases produce one item with distinct platform names', async () => {
    const item = product('multi', ['blizzard', 'Battle.net', 'gog', 'GOG.com']);
    const page = memberPage([product('steam'), item], {cards: [product('steam'), item, item]});
    await page.api.loadPriceTotalsForTest(['Game steam'], dependencies());
    assert.equal(rows(page).length, 1);
    assert.equal(details(page).querySelector('summary').textContent, 'Other platform items (1)');
    assert.equal((rows(page)[0].match(/Battle\.net/g) || []).length, 1);
    assert.equal((rows(page)[0].match(/GOG/g) || []).length, 1);
});

test('hidden cards, Steam alternatives, and missing platform metadata are excluded from the list', async () => {
    const items = [product('steam'), product('visible', ['blizzard']), product('hidden', ['gog']),
        product('mixed', ['steam', 'epic']), product('unknown', undefined, {platforms: ['windows']})];
    const page = memberPage(items);
    page.document.querySelectorAll('.grid > button')[2].hidden = true;
    await page.api.loadPriceTotalsForTest(['Game steam', 'Game mixed'], dependencies());
    assert.equal(rows(page).length, 1);
    assert.match(rows(page)[0], /Game visible.*Battle\.net/);
    assert.doesNotMatch(details(page).textContent, /hidden|mixed|unknown|Windows/);
});

test('no other-platform disclosure appears for an entirely Steam bundle', async () => {
    const page = memberPage([product('steam'), product('mixed', ['steam', 'gog'])]);
    await page.api.loadPriceTotalsForTest(['Game steam', 'Game mixed'], dependencies());
    assert.equal(details(page), null);
    assert.doesNotMatch(page.summary.textContent, /Other platform items/);
});

test('other-platform and missing-price disclosures retain independent expansion across refresh and scope changes', async () => {
    const page = memberPage([product('unknown'), product('battle', ['blizzard'])]);
    const unrecognized = dependencies({findApp: async () => null});
    await page.api.loadPriceTotalsForTest(['Game unknown'], unrecognized);
    assert.ok(details(page));
    assert.ok(page.summary.querySelector('.hb-helper-match-details'));
    details(page).open = true;
    page.summary.querySelector('.hb-helper-match-details').open = false;
    page.summary.querySelector('#hb-helper-price-scope').click();
    assert.equal(details(page).open, true);
    assert.equal(page.summary.querySelector('.hb-helper-match-details').open, false);
    await page.api.loadPriceTotalsForTest(['Game unknown'], unrecognized);
    assert.equal(details(page).open, true);
    assert.equal(page.summary.querySelector('.hb-helper-match-details').open, false);
});

test('a pending same-context refresh retains the previous platform list until atomic replacement', async () => {
    const steam = product('steam');
    const item = product('other', ['blizzard']);
    const page = memberPage([steam, item]);
    await page.api.loadPriceTotalsForTest([steam.title], dependencies());
    const previous = details(page);
    assert.ok(previous);
    previous.open = true;
    const pending = deferred();
    item.deliveryMethods = ['epic'];
    replaceProducts(page, [steam, item]);
    const loading = page.api.loadPriceTotalsForTest([steam.title], dependencies({price: () => pending.promise}));
    assert.strictEqual(details(page), previous);
    assert.match(rows(page)[0], /Battle\.net/);
    pending.resolve({current: 200, original: 250, lowest: 180, currency: 'UAH'});
    await loading;
    assert.notStrictEqual(details(page), previous);
    assert.equal(details(page).open, true);
    assert.match(rows(page)[0], /Epic Games/);
    assert.doesNotMatch(rows(page)[0], /Battle\.net/);
});

test('metadata-only changes update the scheduled summary while Steam titles and prices remain the same', async () => {
    const steam = product('steam');
    const item = product('other', ['blizzard']);
    const page = memberPage([steam, item]);
    const calls = [];
    page.context.setTimeout = () => 1;
    page.context.clearTimeout = () => {};
    page.context.GM_xmlhttpRequest = request => {
        calls.push(request.url);
        if (request.url.includes('/search/suggest')) {
            request.onload({status: 200, responseText: `<div class="match" data-ds-appid="10"><div class="match_name">${steam.title}</div></div>`});
        } else if (request.url.includes('/user/settings')) {
            request.onload({status: 200, responseText: '<div><div><h3>Location</h3></div><p>Canada</p></div>'});
        } else if (request.url.includes('api.xiaoheihe.cn')) {
            request.onload({status: 200, response: {status: 'ok', result: {
                prices: [{price: 100, discount: 0, currency: 'CAD'}], lowest_info: {price: 80},
            }}});
        } else assert.fail(`Unexpected request: ${request.url}`);
    };
    assert.equal(typeof page.api.schedulePriceTotalsReloadForTest, 'function');
    page.api.schedulePriceTotalsReloadForTest();
    await waitFor(() => details(page));
    const requestCount = calls.length;
    const price = page.summary.querySelector('.hb-helper-price-value').textContent;
    item.deliveryMethods = ['gog'];
    replaceProducts(page, [steam, item]);
    page.api.refreshNonSteamGameMarkersForTest();
    page.api.schedulePriceTotalsReloadForTest();
    await waitFor(() => rows(page)[0]?.includes('GOG'));
    assert.equal(calls.length, requestCount, 'platform metadata changes do not refetch unchanged Steam prices');
    assert.equal(page.summary.querySelector('.hb-helper-price-value').textContent, price);
    assert.doesNotMatch(rows(page)[0], /Battle\.net/);
});

test('a bundle containing only other platforms renders its list without Steam or currency requests', async () => {
    const page = memberPage([product('battle', ['blizzard']), product('gog', ['gog'])]);
    assert.equal(typeof page.api.schedulePriceTotalsReloadForTest, 'function');
    page.api.schedulePriceTotalsReloadForTest();
    await waitFor(() => details(page));
    assert.equal(rows(page).length, 2);
    assert.equal(page.requests.length, 0);
    assert.doesNotMatch(page.summary.textContent, /All items are owned/);
});
