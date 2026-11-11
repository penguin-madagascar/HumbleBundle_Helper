const assert = require('node:assert/strict');
const test = require('node:test');
const {flightScript, loadUserscript} = require('./helpers/userscript');

function product(id, deliveryMethods = ['steam']) {
    return {
        id,
        productType: 'humble-choice',
        title: `Choice Game ${id}`,
        thumbnail: `https://hb-prd.imgix.net/product-media/${id}.jpg`,
        deliveryMethods,
    };
}

function slide(item, index) {
    const src = `/_next/image?url=${encodeURIComponent(item.thumbnail)}&amp;w=384&amp;q=75`;
    return `<div role="group" aria-roledescription="slide" data-media-index="${index}">
        <div><button type="button"><img alt="" src="${src}"></button></div>
    </div>`;
}

function choicePage(items, {slides = items, currentTitle = items[0]?.title || ''} = {}) {
    return `${flightScript({
        e: ['$', '$L71', null, {blockType: 'choice-media-carousel', subscriptionProducts: items}],
    })}
    <main id="main-content"><h2>This Month's Games</h2><div>
        <section aria-label="Media carousel">
            <figure><img alt=""></figure>
            <div role="region" aria-roledescription="carousel">
                <div><div>${slides.map(slide).join('')}</div></div>
            </div>
        </section>
        <div class="choice-details"><div><div><h3>${currentTitle}</h3><p>Retail $19.99</p></div></div>
            <div><p>Current game description</p><h3>About this game</h3></div>
        </div>
    </div></main>`;
}

test('matches current Choice slides through their decoded image URL rather than empty alt text or index', () => {
    const items = [product('first'), product('second')];
    const {api} = loadUserscript({
        pathname: '/membership',
        html: choicePage(items, {slides: [items[1], items[0]]}),
    });

    const entries = api.getModernChoiceGameEntries();
    assert.deepEqual(Array.from(entries, entry => entry.title), [items[1].title, items[0].title]);
    assert.equal(entries[0].tile.getAttribute('data-media-index'), '0');
    assert.equal(entries[0].item.deliveryMethods[0], 'steam');
});

test('ignores unrelated slides and stale or ambiguous Choice thumbnails', () => {
    const known = product('known');
    const duplicate = product('duplicate');
    duplicate.thumbnail = known.thumbnail;
    const unknown = product('unknown');
    const {api, document} = loadUserscript({
        pathname: '/membership/home',
        html: choicePage([known, duplicate], {slides: [known, unknown]}),
    });
    document.body.insertAdjacentHTML('beforeend', `<section>${slide(known, 0)}</section>`);

    assert.equal(api.getModernChoiceGameEntries().length, 0);
});

test('keeps delivery metadata available for excluding non-Steam Choice games', () => {
    const items = [product('steam'), product('battle-net', ['blizzard']), product('subscription', ['external_key'])];
    const {api} = loadUserscript({pathname: '/membership', html: choicePage(items)});

    assert.deepEqual(
        Array.from(api.getModernChoiceGameEntries(), entry => entry.item.deliveryMethods[0]),
        ['steam', 'blizzard', 'external_key']
    );
    assert.deepEqual(Array.from(api.getVisibleGameTitles()), [items[0].title]);
});

test('does not interpret media carousels on unrelated routes as Choice games', () => {
    const {api} = loadUserscript({pathname: '/store/test-game', html: choicePage([product('first')])});
    assert.equal(api.getModernChoiceGameEntries().length, 0);
    assert.equal(api.getModernChoiceSteamLinkTargets().length, 0);
});

test('places one Steam link in the current Choice detail header', () => {
    const items = [product('first'), product('second')];
    const {api, document} = loadUserscript({
        pathname: '/membership',
        html: choicePage(items, {currentTitle: items[1].title}),
    });

    const targets = api.getModernChoiceSteamLinkTargets();
    assert.equal(targets.length, 1);
    assert.equal(targets[0].title, items[1].title);
    assert.equal(targets[0].container, document.querySelector('.choice-details'));
    assert.equal(targets[0].after.querySelector('h3').textContent, items[1].title);
    assert.equal(targets[0].after.parentElement, targets[0].placementContainer);
});

test('does not offer a Steam link for non-Steam or stale Choice details', () => {
    const item = product('battle-net', ['blizzard']);
    for (const currentTitle of [item.title, 'Previously viewed game']) {
        const {api} = loadUserscript({
            pathname: '/membership',
            html: choicePage([item], {currentTitle}),
        });
        assert.equal(api.getModernChoiceSteamLinkTargets().length, 0);
    }
});

test('requires an explicit Steam delivery method instead of a string containing Steam', () => {
    const item = product('first');
    item.deliveryMethods = 'not-steam';
    const {api} = loadUserscript({pathname: '/membership', html: choicePage([item])});

    assert.equal(api.getModernChoiceSteamLinkTargets().length, 0);
});

test('rejects identical Choice detail titles with different product identities', () => {
    for (const deliveryMethods of [['steam'], ['blizzard']]) {
        const items = [product('first'), product('second', deliveryMethods)];
        items[1].title = items[0].title;
        const {api} = loadUserscript({pathname: '/membership', html: choicePage(items)});

        assert.equal(api.getModernChoiceSteamLinkTargets().length, 0);
    }
});

test('does not duplicate a Steam target when matching headings are ambiguous', () => {
    const item = product('first');
    const {api, document} = loadUserscript({pathname: '/membership', html: choicePage([item])});
    document.querySelector('.choice-details').insertAdjacentHTML('beforeend', `<h3>${item.title}</h3>`);

    assert.equal(api.getModernChoiceSteamLinkTargets().length, 0);
});

function answerSteamSearch(request, item) {
    request.onload({status: 200, responseText:
        `<div class="match" data-ds-appid="42"><div class="match_name">${item.title}</div></div>`});
}

test('removes the old Steam link when the current Choice detail changes to a non-Steam product', async () => {
    const items = [product('first'), product('second', ['blizzard'])];
    const {api, document, requests} = loadUserscript({pathname: '/membership', html: choicePage(items)});
    const pending = api.ensureSteamStoreLink(api.getModernChoiceSteamLinkTargets()[0]);
    answerSteamSearch(requests[0], items[0]);
    await pending;
    assert.equal(document.querySelectorAll('.hb-helper-steam-store-link').length, 1);
    document.querySelector('.choice-details h3').textContent = items[1].title;
    api.ensureSteamStoreLinks();
    assert.equal(document.querySelectorAll('.hb-helper-steam-store-link').length, 0);
});

test('discards an in-flight Steam link after switching Choice details', async () => {
    const items = [product('first'), product('second', ['blizzard'])];
    const {api, document, requests} = loadUserscript({pathname: '/membership', html: choicePage(items)});
    const pending = api.ensureSteamStoreLink(api.getModernChoiceSteamLinkTargets()[0]);
    document.querySelector('.choice-details h3').textContent = items[1].title;
    answerSteamSearch(requests[0], items[0]);
    await pending;
    assert.equal(document.querySelectorAll('.hb-helper-steam-store-link').length, 0);
});

test('modern Choice mounts display controls without exposing unsupported redemption actions', () => {
    const {api, document} = loadUserscript({pathname: '/membership', html: choicePage([product('first')])});
    api.setSteamSessionStateForTest({status: 'authenticated', account: {
        ownedApps: [], wishlistApps: [], countryCode: 'CA', sessionId: 'test-session',
    }});
    const controls = api.ensureHelperControls();
    assert.ok(controls, 'new Choice carousel has a display toolbar');
    assert.ok(document.getElementById('hb-helper-price-summary'));
    assert.equal(document.getElementById('hb-helper-choice-activation-controls'), null);
});
