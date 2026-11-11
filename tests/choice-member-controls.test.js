const assert = require('node:assert/strict');
const test = require('node:test');
const {flightScript, loadUserscript} = require('./helpers/userscript');

const games = [
    {id: 'steam-game', title: 'Steam Game', deliveryMethods: ['steam']},
    {id: 'other-game', title: 'Other Game', deliveryMethods: ['blizzard']},
].map(game => ({
    ...game,
    productType: 'humble-choice',
    thumbnail: `https://hb-prd.imgix.net/product-media/${game.id}.jpg`,
}));

// Reduced from the authenticated member grid supplied by the user.
function memberPage({heading = '2026年11月 Humble Choice', metadata = true, items = games} = {}) {
    return `<main id="main-content" class="flex grow flex-col overflow-x-clip"><div>
        <section class="page-content"><div class="flex flex-col gap-10">
            <div class="flex flex-col items-center"><h1>${heading}</h1><a>领取全部游戏</a></div>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                ${items.map(game => `<button class="w-full cursor-pointer rounded-xl text-left">
                    <div data-testid="product-card"><div>
                        <div data-testid="product-thumbnail"><img alt="" src="/_next/image?url=${encodeURIComponent(game.thumbnail)}&amp;w=384&amp;q=75"></div>
                        <div data-testid="product-card-footer"><div class="group/product-title"><div>
                            <div class="line-clamp-1 font-extrabold">${game.title}</div>
                        </div></div><div><div>领取游戏</div></div></div>
                    </div></div>
                </button>`).join('')}
            </div>
        </div><div data-testid="full-width-promo"><h2>Humble 商店折扣</h2></div></section>
    </div></main>${metadata ? flightScript({e: {subscriptionProducts: items}}) : ''}`;
}

test('mounts the member toolbar between the translated heading and native game grid', () => {
    for (const heading of ['2026年11月 Humble Choice', 'November 2026 Humble Choice']) {
        const {api, document} = loadUserscript({pathname: '/membership/home', html: memberPage({heading})});
        const grid = document.querySelector('main .grid');
        const nativeButtons = [...grid.children];
        const controls = api.ensureHelperControls();
        assert.ok(controls, 'authenticated member grid has a toolbar');
        assert.ok(controls.nextElementSibling === grid, 'toolbar precedes the grid');
        assert.ok(api.ensureHelperControls() === controls, 'toolbar is reused');
        assert.ok([...grid.children].every((button, index) => button === nativeButtons[index]));
        const link = controls.querySelector('#hb-helper-steamgifts-link');
        assert.ok(link);
        assert.equal(new URL(link.href).searchParams.get('q'), '[Humble Bundle] November 2026');
    }
});

test('member controls restore Steam totals while keeping the unsupported redemption flow hidden', () => {
    const {api, document} = loadUserscript({pathname: '/membership/home', html: memberPage()});
    api.setSteamSessionStateForTest({status: 'authenticated', account: {
        ownedApps: [], wishlistApps: [], countryCode: 'CA', sessionId: 'test-session',
    }});
    assert.ok(api.ensureHelperControls());
    assert.ok(document.getElementById('hb-helper-price-summary'));
    assert.deepEqual(Array.from(api.getVisibleGameTitles()), ['Steam Game']);
    assert.equal(document.getElementById('hb-helper-choice-activation-controls'), null);
    assert.doesNotThrow(() => api.getSteamStoreLinkTargets());
});

test('the base toolbar does not depend on Steam login or matching product metadata', () => {
    const {api, document} = loadUserscript({pathname: '/membership/home', html: memberPage({metadata: false})});
    assert.ok(api.ensureHelperControls());
    api.setSteamSessionStateForTest({status: 'authenticated', account: {
        ownedApps: [], wishlistApps: [], countryCode: 'CA', sessionId: 'test-session',
    }});
    assert.ok(api.ensureHelperControls());
    assert.equal(document.getElementById('hb-helper-choice-activation-controls'), null);
});

test('a member product dialog receives a Steam target only for its identified Steam game', () => {
    const {api, document} = loadUserscript({pathname: '/membership/home', html: memberPage()});
    document.body.insertAdjacentHTML('beforeend', '<div role="dialog"><h2>Steam Game</h2><p>Game details</p></div>');
    const targets = api.getSteamStoreLinkTargets();
    assert.equal(targets.length, 1);
    assert.equal(targets[0].title, 'Steam Game');
    document.querySelector('[role="dialog"] h2').textContent = 'Other Game';
    assert.equal(api.getSteamStoreLinkTargets().length, 0);
});

test('a title-only member dialog is not identified when different products share its title', () => {
    const items = games.map(game => ({...game, title: 'Shared Game'}));
    const {api, document} = loadUserscript({pathname: '/membership/home', html: memberPage({items})});
    document.body.insertAdjacentHTML('beforeend', '<div role="dialog"><h2>Shared Game</h2></div>');
    assert.equal(api.getSteamStoreLinkTargets().length, 0);
});

test('hidden member grids do not hide or disqualify a visible toolbar', () => {
    const {api, document} = loadUserscript({pathname: '/membership/home', html: memberPage()});
    const grid = document.querySelector('main .grid');
    grid.hidden = true;
    assert.ok(api.ensureHelperControls() === null, 'a hidden grid is not a toolbar anchor');
    const visibleGrid = grid.cloneNode(true);
    visibleGrid.hidden = false;
    grid.parentElement.appendChild(visibleGrid);
    const controls = api.ensureHelperControls();
    assert.ok(controls);
    assert.ok(controls.nextElementSibling === visibleGrid);
});

test('member cards receive ownership and wishlist markings only for Steam products', async () => {
    const {api, document} = loadUserscript({pathname: '/membership/home', html: memberPage()});
    const cards = [...document.querySelectorAll('[data-testid="product-card"]')];
    const findApp = async title => {
        assert.equal(title, 'Steam Game');
        return {appid: 42};
    };
    await api.markGame(cards[0], new Set([42]), 'owned', findApp);
    await api.markGame(cards[0], new Set([42]), 'wishlist', findApp);
    assert.equal(cards[0].classList.contains('owned'), true);
    assert.equal(cards[0].classList.contains('wishlist'), true);
    await api.markGame(cards[1], new Set([42]), 'owned', findApp);
    assert.equal(cards[1].classList.contains('owned'), false);
});
