const assert = require('node:assert/strict');
const test = require('node:test');
const {flightScript, loadUserscript} = require('./helpers/userscript');

function product(id, title, deliveryMethods = ['steam']) {
    return {id, title, deliveryMethods, productType: 'humble-choice',
        thumbnail: `https://example.invalid/${id}.jpg`};
}

function choicePage(items, html, extra = {}) {
    return loadUserscript({pathname: '/membership/home',
        html: `${flightScript({e: {subscriptionProducts: items}})}${html}`, ...extra});
}

function modal(title, {native = false, genericHeading = false, siteModal = false} = {}) {
    const tag = native ? 'dialog open' : 'div role="dialog"';
    const close = native ? 'dialog' : 'div';
    return `<${tag} aria-modal="true" ${siteModal ? 'id="site-modal"' : ''}>
      ${genericHeading ? '<h2>Game details</h2>' : ''}
      <div class="game-content"><div class="game-name">${title}</div>
        <p>Retail $64.99</p><a href="/library">Redeem in library</a>
        <p>Game description</p></div>
    </${close}>`;
}

function answerSearch(request, item) {
    request.onload({status: 200, responseText:
        `<div class="match" data-ds-appid="42"><div class="match_name">${item.title}</div></div>`});
}

test('bundle Steam links keep their label followed by one decorative Steam icon', async () => {
    const title = 'Bundle Steam Game';
    const {api, document, requests} = loadUserscript({html: `
      <section data-bundle-section="games"><button><div data-testid="bundle-item-card">
        <div data-testid="bundle-item-native-image"><img alt="${title}"></div>
        <div data-testid="platform-icons"><div aria-label="Steam"></div></div>
      </div></button></section>
      <div role="dialog"><h2>${title}</h2></div>`});
    const pending = api.ensureSteamStoreLink(api.getSteamStoreLinkTargets()[0]);
    answerSearch(requests[0], {title});
    await pending;
    const link = document.querySelector('.hb-helper-steam-store-link');
    assert.equal(link.textContent, 'View on Steam');
    assert.equal(link.lastElementChild?.tagName.toLowerCase(), 'svg');
    assert.equal(link.lastElementChild.getAttribute('aria-hidden'), 'true');
    assert.equal(link.lastElementChild.getAttribute('focusable'), 'false');
    assert.ok(link.lastElementChild.querySelector('path').getAttribute('d'));
    await api.ensureSteamStoreLink(api.getSteamStoreLinkTargets()[0]);
    assert.equal(link.querySelectorAll('svg').length, 1);
});

for (const kind of ['portal', 'native', 'site-modal']) {
    test(`Choice ${kind} dialogs receive a Steam link without background cards`, async () => {
        const item = product('mafia', 'Mafia: The Old Country');
        const page = choicePage([item], modal(item.title, {
            native: kind === 'native', siteModal: kind === 'site-modal', genericHeading: true,
        }));
        const targets = page.api.getSteamStoreLinkTargets();
        assert.equal(targets.length, 1);
        assert.equal(targets[0].title, item.title);
        const pending = page.api.ensureSteamStoreLink(targets[0]);
        answerSearch(page.requests[0], item);
        await pending;
        const link = page.document.querySelector('.hb-helper-steam-store-link');
        assert.equal(link.href, 'https://store.steampowered.com/app/42/');
        assert.equal(link.parentElement, page.document.querySelector('[aria-modal="true"]'));
        assert.equal(link.querySelectorAll('svg').length, 1);
    });
}

test('Choice dialog matching ignores a generic first heading and finds the actual game name', () => {
    const item = product('mafia', 'Mafia: The Old Country');
    const {api} = choicePage([item], `<main><section><h1>2026年11月 Humble Choice</h1>
      <div class="grid"><button><div data-testid="product-card">
        <div data-testid="product-thumbnail"><img src="${item.thumbnail}" alt=""></div>
        <div data-testid="product-card-footer"><div class="group/product-title">
          <div><div class="line-clamp-1">${item.title}</div></div>
        </div></div></div></button></div></section></main>${modal(item.title, {genericHeading: true})}`);
    assert.equal(api.getModernChoiceGameEntries().length, 1);
    assert.equal(api.getSteamStoreLinkTargets().length, 1);
});

test('Choice dialog links remain absent for other platforms, unknown products, and ambiguous names', () => {
    const title = 'Example game';
    const steam = product('steam', title);
    for (const items of [
        [product('battle', title, ['blizzard'])],
        [product('unknown', 'Another game')],
        [steam, product('duplicate', title)],
        [{...steam, bundleType: 'coupons'}],
    ]) {
        const {api, requests} = choicePage(items, modal(title, {genericHeading: true}));
        api.ensureSteamStoreLinks();
        assert.equal(api.getSteamStoreLinkTargets().length, 0);
        assert.equal(requests.length, 0);
    }
});

test('a Choice modal Steam search cannot add a stale button after switching to Battle.net', async () => {
    const steam = product('mafia', 'Mafia: The Old Country');
    const battle = product('outer-worlds', 'The Outer Worlds 2', ['blizzard']);
    const page = choicePage([steam, battle], modal(steam.title));
    const target = page.api.getSteamStoreLinkTargets()[0];
    assert.ok(target);
    const pending = page.api.ensureSteamStoreLink(target);
    page.document.querySelector('.game-name').textContent = battle.title;
    answerSearch(page.requests[0], steam);
    await pending;
    assert.equal(page.document.querySelector('.hb-helper-steam-store-link'), null);
});
