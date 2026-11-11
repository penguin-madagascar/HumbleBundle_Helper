const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const {flightScript, loadUserscript} = require('./helpers/userscript');

const cards = fs.readFileSync(path.join(__dirname, 'fixtures', 'bundle-redesign.html'), 'utf8');
const titles = [
    'The 7th Guest Remake', "A Monster's Expedition", 'Bonfire Peaks',
    'Braid, Anniversary Edition', 'INDIKA', 'TR-49', 'Escape Academy', 'Dungeons of Hinterberg',
];

test('mounts bundle controls above the new item section without an English price heading', () => {
    const {api, document} = loadUserscript({html: cards});
    const section = document.querySelector('[data-bundle-section="games"]');
    const point = api.findHelperInsertionPoint();
    assert.ok(point?.anchor === section, 'new item section is the toolbar anchor');
    assert.equal(point?.position, 'beforebegin');
    const controls = api.ensureHelperControls();
    assert.ok(controls.nextElementSibling === section, 'toolbar precedes item section');
    assert.equal(controls.querySelectorAll('#steamgifts-discussion').length, 1);
    assert.ok(api.ensureHelperControls() === controls, 'toolbar is reused');
});

test('reads actual new cards and follows the selected tier after cards are removed', () => {
    const {api, document} = loadUserscript({html: cards});
    assert.deepEqual(Array.from(api.getVisibleGameTitles()), titles);
    document.querySelectorAll('li').forEach((item, index) => { if (index > 2) item.remove(); });
    assert.deepEqual(Array.from(api.getVisibleGameTitles()), titles.slice(0, 3));
    document.querySelector('li').hidden = true;
    assert.deepEqual(Array.from(api.getVisibleGameTitles()), titles.slice(1, 3));
});

test('excludes non-Steam cards using their platform icons without old bundle JSON', () => {
    const {api, document} = loadUserscript({html: cards});
    document.querySelector('[aria-label="Steam"]').setAttribute('aria-label', 'GOG');
    assert.deepEqual(Array.from(api.getVisibleGameTitles()), titles.slice(1));
});

test('marks the new card from its title without including MSRP or platform text', async () => {
    const {api, document} = loadUserscript({html: cards});
    const card = document.querySelector('[data-testid="bundle-item-card"]');
    await api.markGame(card, new Set([42]), 'owned', async title => {
        assert.equal(title, titles[0]);
        return {appid: 42};
    });
    assert.equal(card.classList.contains('owned'), true);
    await api.markGame(card, new Set(), 'owned', async () => ({appid: 42}));
    assert.equal(card.classList.contains('owned'), false);
});

test('reads new tier metadata, excludes coupons and ignores a previous bundle on SPA navigation', () => {
    const bundlePage = {
        slug: 'test-bundle',
        tiers: [{bundleItems: [
            {title: titles[0], deliveryMethods: ['steam'], bundleType: 'games'},
            {title: 'Discount coupon', deliveryMethods: ['steam'], bundleType: 'coupons'},
        ]}],
    };
    const {api, document, location} = loadUserscript({html: flightScript({e: {bundlePage}})});
    assert.equal(api.getBundleItemsByTitle()?.size, 2);
    assert.equal(api.shouldMatchSteamTitle('Discount coupon'), false);
    location.pathname = '/games/other-bundle';
    assert.equal(api.getBundleItemsByTitle(), null);
    document.body.innerHTML = flightScript({e: {bundlePage: {
        slug: 'other-bundle', tiers: [{bundleItems: [{title: 'Other Game', deliveryMethods: ['gog']}]}],
    }}});
    assert.equal(api.getBundleItemsByTitle()?.size, 1);
    assert.equal(api.shouldMatchSteamTitle('Other Game'), false);
});

test('targets only a new bundle item dialog that matches a visible Steam card', () => {
    const {api, document} = loadUserscript({html: cards + `
        <div role="dialog" aria-labelledby="item-heading"><h2 id="item-heading">Bonfire Peaks</h2>
          <div data-testid="platform-icons"><div aria-label="Steam" role="img"></div></div>
          <p>Game description</p></div>
        <div role="dialog" aria-labelledby="login-heading"><h2 id="login-heading">Log In</h2></div>`});
    let targets = api.getSteamStoreLinkTargets();
    assert.equal(targets.length, 1);
    assert.equal(targets[0].title, 'Bonfire Peaks');
    assert.ok(targets[0].container === document.querySelector('[role="dialog"]'));
    document.getElementById('item-heading').textContent = 'Discount coupon';
    targets = api.getSteamStoreLinkTargets();
    assert.equal(targets.length, 0);
});
