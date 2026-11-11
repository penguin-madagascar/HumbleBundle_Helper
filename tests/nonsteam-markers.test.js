const assert = require('node:assert/strict');
const test = require('node:test');
const {flightScript, loadUserscript} = require('./helpers/userscript');

function product(id, deliveryMethods, extra = {}) {
    return {id, productType: 'humble-choice', title: `Game ${id}`,
        thumbnail: `https://hb-prd.imgix.net/product-media/${id}.jpg`, deliveryMethods, ...extra};
}

function memberCard(item) {
    return `<button type="button"><div data-testid="product-card">
      <div data-testid="product-thumbnail"><img alt="" src="${item.thumbnail}"></div>
      <div data-testid="product-card-footer"><div class="group/product-title">
        <div><div class="line-clamp-1">${item.title}</div></div>
      </div><div>查看详情</div></div>
    </div></button>`;
}

function memberPage(items, {next = false} = {}) {
    return loadUserscript({pathname: '/membership/home', html: `
      ${next ? '<script src="/_next/static/chunks/test.js"></script>' : ''}
      ${flightScript({e: {subscriptionProducts: items}})}
      <main><section><h1>2026年11月 Humble Choice</h1>
        <div class="grid">${items.map(memberCard).join('')}</div>
      </section></main>`});
}

function bundleCard(title, platforms) {
    return `<button><div data-testid="bundle-item-card" data-bundle-type="games">
      <div data-testid="bundle-item-native-image"><img alt="${title}"></div>
      <div class="flex flex-col"><div class="p-3">
        <div class="line-clamp-2" data-state="closed">${title}</div>
      </div><div data-testid="platform-icons">${platforms.map(platform =>
        `<div role="img" aria-label="${platform}"><svg viewBox="0 0 24 24"></svg></div>`
    ).join('')}</div></div></div></button>`;
}

function badgeText(badge) {
    assert.ok(badge, 'a platform badge group is present');
    return [badge, ...badge.querySelectorAll('*')].map(element =>
        [element.getAttribute('aria-label'), element.getAttribute('title'), element.textContent]
            .filter(Boolean).join(' ')
    ).join(' ');
}

function refresh(api) {
    assert.equal(typeof api.refreshNonSteamGameMarkersForTest, 'function');
    api.refreshNonSteamGameMarkersForTest();
}

test('Choice member cards identify Battle.net without requiring a Steam session', () => {
    const item = product('battle-net', ['blizzard']);
    const {api, document} = memberPage([item]);
    refresh(api);
    const card = document.querySelector('[data-testid="product-card"]');
    assert.equal(card.classList.contains('hb-helper-non-steam'), true);
    const titleRow = card.querySelector('[class~="group/product-title"]');
    const badges = titleRow.querySelector('.hb-helper-platform-badges');
    assert.match(badgeText(badges), /Battle\.net/i);
    assert.equal(titleRow.lastElementChild, badges, 'badges occupy the end of the title row');
    assert.equal(card.querySelector('.line-clamp-1').textContent, item.title);
    assert.deepEqual(Array.from(api.getVisibleGameTitles()), [], 'non-Steam games stay out of Steam totals');
});

for (const platform of ['Epic Games', 'GOG']) {
    test(`ordinary bundle cards use explicit ${platform} native platform metadata`, () => {
        const {api, document} = loadUserscript({html: bundleCard('Example game', [platform, 'Windows'])});
        refresh(api);
        const card = document.querySelector('[data-testid="bundle-item-card"]');
        assert.equal(card.classList.contains('hb-helper-non-steam'), true);
        const titleRow = card.querySelector('.line-clamp-2').parentElement;
        const badges = titleRow.querySelector('.hb-helper-platform-badges');
        assert.match(badgeText(badges), platform === 'GOG' ? /GOG/i : /Epic/i);
        assert.equal(titleRow.lastElementChild, badges);
        assert.equal(card.querySelectorAll('[data-testid="platform-icons"] [aria-label]').length, 2,
            'native platform and OS icons remain intact');
    });
}

test('Steam remains the platform classification when a product also offers GOG', () => {
    const item = product('multiple', ['steam', 'gog']);
    const {api, document} = memberPage([item]);
    refresh(api);
    const card = document.querySelector('[data-testid="product-card"]');
    assert.equal(card.classList.contains('hb-helper-non-steam'), false);
    assert.equal(card.querySelector('.hb-helper-platform-badges'), null);
    assert.deepEqual(Array.from(api.getVisibleGameTitles()), [item.title]);
});

test('an explicit IGN subscription receives a miscellaneous badge', () => {
    const item = product('ign', ['external_key'], {title: 'IGN Plus subscription'});
    const {api, document} = memberPage([item]);
    refresh(api);
    const card = document.querySelector('[data-testid="product-card"]');
    assert.equal(card.classList.contains('hb-helper-non-steam'), true);
    assert.match(badgeText(card.querySelector('.hb-helper-platform-badges')), /IGN|subscription|misc|订阅|杂项/i);
    assert.deepEqual(Array.from(api.getVisibleGameTitles()), []);
});

test('OS-only metadata does not imply a non-Steam redemption platform', () => {
    const item = product('unknown', undefined, {platforms: ['windows', 'mac']});
    const {api, document} = memberPage([item]);
    refresh(api);
    const card = document.querySelector('[data-testid="product-card"]');
    assert.equal(card.classList.contains('hb-helper-non-steam'), false);
    assert.equal(card.querySelector('.hb-helper-platform-badges'), null);
});

test('repeated refreshes do not duplicate badges and a reused Steam card loses old decorations', () => {
    const item = product('reused', ['blizzard']);
    const {api, document} = memberPage([item]);
    const card = document.querySelector('[data-testid="product-card"]');
    refresh(api);
    refresh(api);
    assert.equal(card.querySelectorAll('.hb-helper-platform-badges').length, 1);
    item.deliveryMethods = ['steam'];
    document.querySelector('script').textContent = flightScript({e: {subscriptionProducts: [item]}}).slice(8, -9);
    refresh(api);
    assert.equal(card.classList.contains('hb-helper-non-steam'), false);
    assert.equal(card.querySelector('.hb-helper-platform-badges'), null);
    assert.equal(card.querySelector('.line-clamp-1').textContent, item.title);
});

test('non-Steam markers do not mutate server HTML before its React hosts commit', () => {
    const {api, document} = memberPage([product('pending', ['blizzard'])], {next: true});
    try {
        refresh(api);
        const card = document.querySelector('[data-testid="product-card"]');
        assert.equal(card.classList.contains('hb-helper-non-steam'), false);
        assert.equal(card.querySelector('.hb-helper-platform-badges'), null);
    } finally {
        api.resetHelperHydrationForTest();
    }
});

test('public Choice carousel slides and the matching current title show their platform', () => {
    const item = product('public', ['blizzard']);
    const {api, document} = loadUserscript({pathname: '/membership', html: `
      ${flightScript({e: {subscriptionProducts: [item]}})}
      <main><h2>This Month's Games</h2><div>
        <section aria-label="Media carousel"><div data-media-index="0"><button>
          <img alt="" src="${item.thumbnail}">
        </button></div></section>
        <div class="choice-details"><div><div><h3>${item.title}</h3></div></div></div>
      </div></main>`});
    refresh(api);
    assert.equal(document.querySelector('[data-media-index]').classList.contains('hb-helper-non-steam'), true);
    const heading = document.querySelector('.choice-details h3');
    assert.match(badgeText(heading.parentElement.querySelector('.hb-helper-platform-badges')), /Battle\.net/i);
    assert.equal(heading.textContent, item.title);
});

test('legacy bundle delivery icons support GOG without changing the game title', () => {
    const item = {human_name: 'Legacy GOG game', availability_icons: {delivery_to_platform: {'hb-gog': true}}};
    const {api, document} = loadUserscript({html: `
      <script id="webpack-bundle-page-data" type="application/json">${JSON.stringify({bundleData: {tier_item_data: {legacy: item}}})}</script>
      <div class="tier-item-view"><div><h4 class="item-title">${item.human_name}</h4></div></div>`});
    refresh(api);
    const card = document.querySelector('.tier-item-view');
    assert.equal(card.classList.contains('hb-helper-non-steam'), true);
    assert.match(badgeText(card.querySelector('.hb-helper-platform-badges')), /GOG/i);
    assert.equal(card.querySelector('.item-title').textContent, item.human_name);
});

test('coupons remain miscellaneous even when their delivery metadata mentions Steam', () => {
    const item = product('coupon', ['steam'], {bundleType: 'coupons', title: 'Example discount coupon'});
    const {api, document} = memberPage([item]);
    refresh(api);
    const card = document.querySelector('[data-testid="product-card"]');
    assert.equal(card.classList.contains('hb-helper-non-steam'), true);
    assert.match(badgeText(card.querySelector('.hb-helper-platform-badges')), /coupon|优惠券/i);
    assert.deepEqual(Array.from(api.getVisibleGameTitles()), []);
});

test('platform aliases deduplicate while distinct redemption platforms retain their own badges', () => {
    const item = product('platforms', ['blizzard', 'Battle.net', 'gog', 'GOG.com']);
    const {api, document} = memberPage([item]);
    refresh(api);
    const badges = document.querySelectorAll('.hb-helper-platform-badge');
    assert.equal(badges.length, 2);
    assert.deepEqual(Array.from(badges, badge => badge.getAttribute('aria-label')), ['Battle.net', 'GOG']);
});

test('legacy Choice maps a platform by machine name when its catalog omits the display title', () => {
    const data = {contentChoiceOptions: {contentChoiceData: {game_data: {
        legacy: {display_item_machine_name: 'choice-blizzard', tpkds: [{key_type: 'blizzard'}]},
    }}}};
    const {api, document} = loadUserscript({pathname: '/membership/home', html: `
      <script id="webpack-subscriber-hub-data" type="application/json">${JSON.stringify(data)}</script>
      <div class="choice-content js-open-choice-modal" data-machine-name="choice-blizzard">
        <div class="content-choice-title">Legacy Choice game</div>
      </div>`});
    refresh(api);
    const card = document.querySelector('.choice-content');
    assert.equal(card.classList.contains('hb-helper-non-steam'), true);
    assert.match(badgeText(card.querySelector('.hb-helper-platform-badges')), /Battle\.net/);
});

test('blank or malformed delivery metadata does not invent a platform', () => {
    for (const deliveryMethods of ['', 'not-steam', null, [null, 42, {}, '  ']]) {
        const {api, document} = memberPage([product('malformed', deliveryMethods)]);
        refresh(api);
        const card = document.querySelector('[data-testid="product-card"]');
        assert.equal(card.classList.contains('hb-helper-non-steam'), false);
        assert.equal(card.querySelector('.hb-helper-platform-badges'), null);
    }
});

test('removing a catalog clears orphan platform markers and the title layout class', () => {
    const {api, document} = memberPage([product('removed', ['blizzard'])]);
    refresh(api);
    const card = document.querySelector('[data-testid="product-card"]');
    const titleRow = card.querySelector('[class~="group/product-title"]');
    assert.equal(titleRow.classList.contains('hb-helper-platform-title-row'), true);
    document.querySelector('script').remove();
    refresh(api);
    assert.equal(card.classList.contains('hb-helper-non-steam'), false);
    assert.equal(titleRow.classList.contains('hb-helper-platform-title-row'), false);
    assert.equal(titleRow.querySelector('.hb-helper-platform-badges'), null);
});

test('the page observer ignores helper badge insertion but still sees native title edits', () => {
    const {api, document} = memberPage([product('observer', ['blizzard'])]);
    refresh(api);
    const titleRow = document.querySelector('[class~="group/product-title"]');
    const group = titleRow.querySelector('.hb-helper-platform-badges');
    assert.equal(api.shouldRefreshForPageMutationsForTest([
        {type: 'childList', target: titleRow, addedNodes: [group], removedNodes: []},
    ]), false);
    assert.equal(api.shouldRefreshForPageMutationsForTest([
        {type: 'childList', target: group, addedNodes: [group.firstElementChild], removedNodes: []},
    ]), false);
    const title = titleRow.querySelector('.line-clamp-1');
    assert.equal(api.shouldRefreshForPageMutationsForTest([
        {type: 'characterData', target: title.firstChild, addedNodes: [], removedNodes: []},
    ]), true);
});

for (const bundleType of ['subscriptions', 'misc']) {
    test(`explicit ${bundleType} products override Steam delivery and remain outside Steam totals`, () => {
        const item = product(bundleType, ['steam'], {bundleType});
        const {api, document} = memberPage([item]);
        refresh(api);
        const card = document.querySelector('[data-testid="product-card"]');
        assert.equal(card.classList.contains('hb-helper-non-steam'), true);
        assert.match(badgeText(card.querySelector('.hb-helper-platform-badges')),
            bundleType === 'subscriptions' ? /subscription|订阅/i : /misc|杂项/i);
        assert.deepEqual(Array.from(api.getVisibleGameTitles()), [],
            'miscellaneous offers must not be matched or priced as Steam games');
    });
}

test('navigation away from a bundle clears decorations even when React retains the old card nodes', async () => {
    const {api, document, window, location} = memberPage([product('retained', ['blizzard'])]);
    await api.installHelperRouteLifecycleForTest({syncSession: async () => {},
        reconcileBatch: async () => {}, recoverCollection: async () => ({})});
    const card = document.querySelector('[data-testid="product-card"]');
    const titleRow = card.querySelector('[class~="group/product-title"]');
    assert.equal(card.classList.contains('hb-helper-non-steam'), true);
    location.pathname = '/store/example';
    window.dispatchEvent(new window.Event('popstate'));
    await api.waitForHelperRouteForTest();
    assert.equal(card.isConnected, true, 'the test retains the original native card');
    assert.equal(card.classList.contains('hb-helper-non-steam'), false);
    assert.equal(titleRow.classList.contains('hb-helper-platform-title-row'), false);
    assert.equal(titleRow.querySelector('.hb-helper-platform-badges'), null);
});
