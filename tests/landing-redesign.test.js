const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const {flightScript, loadUserscript} = require('./helpers/userscript');

const markup = fs.readFileSync(path.join(__dirname, 'fixtures', 'landing-next.html'), 'utf8');
const storageKey = 'hb-helper-landing-sort-mode';
const feeds = {
    games: [
        ['/games/puzzlers-to-puzzle-you', '2026-11-25T19:00:00.000Z'],
        ['/games/marmalade-games-ultimate-digital-game-night', '2026-11-18T19:00:00.000Z'],
        ['/games/resident-evil-biohazard-unleashed-2026', '2026-12-03T05:00:00.000Z'],
    ],
    books: [
        ['/books/certifications-and-security-for-cloud-and-devops-wiley-books', '2026-12-02T19:00:00.000Z'],
        ['/books/python-for-ai-development-eduxpress-books', '2026-11-20T19:00:00.000Z'],
    ],
    software: [
        ['/software/create-and-elevate-amazing-art-tools-from-corel-software-encore', '2026-11-23T19:00:00.000Z'],
        ['/software/premium-assets-unreal-game-dev-collection-software', '2026-11-12T19:00:00.000Z'],
    ],
};

function createPage({mode = 'default', pathname = '/bundles'} = {}) {
    const records = Object.fromEntries(Object.entries(feeds).map(([category, products], index) => [
        String(index + 1),
        ['$', '$Lfeed', null, {
            feedItems: products.map(([url, endDate]) => ({
                relationTo: 'products',
                value: {url, category, endDate, productType: 'humble-bundle'},
            })),
            layout: 'grid',
            header: {title: category[0].toUpperCase() + category.slice(1)},
            surface: 'bundles-listing',
        }],
    ]));
    return loadUserscript({
        html: markup + flightScript(records),
        pathname,
        values: new Map([[storageKey, mode]]),
    });
}

function section(page, category) {
    const heading = [...page.document.querySelectorAll('h2')]
        .find(element => element.textContent.toLowerCase() === category);
    return heading.parentElement.parentElement;
}

function cards(page, category) {
    return [...section(page, category).querySelectorAll('[data-testid="product-card"]')];
}

function controls(page, category) {
    return page.document.querySelector(
        `.hb-helper-landing-sort-controls[data-hb-helper-sort-section="${category}"]`
    );
}

function button(page, category, mode) {
    return controls(page, category).querySelector(`[data-hb-helper-sort="${mode}"]`);
}

function visualUrls(page, category) {
    return cards(page, category)
        .sort((a, b) => Number(a.style.order || 0) - Number(b.style.order || 0))
        .map(card => card.querySelector('a[data-testid="product-link"]').getAttribute('href'));
}

test('Next bundle listing mounts separate controls without reparenting React headings', () => {
    const page = createPage();
    const headingParents = [...page.document.querySelectorAll('h2')]
        .map(heading => [heading, heading.parentElement]);

    page.api.refreshLandingSortPageForTest();

    for (const category of Object.keys(feeds)) assert.ok(controls(page, category), category);
    for (const [heading, parent] of headingParents) assert.equal(heading.parentElement, parent);
    assert.equal(page.document.querySelectorAll('.hb-helper-landing-sort-header h2').length, 0);
});

test('Next ending-soon sorting changes only the clicked grid through CSS order', () => {
    const page = createPage();
    page.api.refreshLandingSortPageForTest();
    const originalCards = cards(page, 'games');
    const bookOrder = visualUrls(page, 'books');

    button(page, 'games', 'ending').click();

    assert.deepEqual(visualUrls(page, 'games'), [feeds.games[1][0], feeds.games[0][0], feeds.games[2][0]]);
    assert.deepEqual(cards(page, 'games'), originalCards, 'React-owned DOM children stay in place');
    assert.deepEqual(visualUrls(page, 'books'), bookOrder);
    assert.equal(page.values.get(storageKey), 'ending');
});

test('Next default sorting clears CSS order and restores the original rendered order', () => {
    const page = createPage({mode: 'ending'});
    page.api.refreshLandingSortPageForTest();
    assert.notDeepEqual(visualUrls(page, 'games'), feeds.games.map(([url]) => url));

    button(page, 'games', 'default').click();

    assert.deepEqual(visualUrls(page, 'games'), feeds.games.map(([url]) => url));
    assert.ok(cards(page, 'games').every(card => !card.style.order));
});

test('Next listings disable newest sorting when Humble supplies no start dates', () => {
    const page = createPage({mode: 'newest'});
    page.api.refreshLandingSortPageForTest();

    assert.equal(button(page, 'games', 'newest').disabled, true);
    assert.match(button(page, 'games', 'newest').title, /start date/i);
    assert.equal(button(page, 'games', 'default').getAttribute('aria-pressed'), 'true');
    assert.deepEqual(visualUrls(page, 'games'), feeds.games.map(([url]) => url));
});

test('saved ending-soon preference initializes each Next category independently', () => {
    const page = createPage({mode: 'ending'});
    page.api.refreshLandingSortPageForTest();

    for (const category of Object.keys(feeds)) {
        const expected = [...feeds[category]].sort((a, b) => Date.parse(a[1]) - Date.parse(b[1]));
        assert.deepEqual(visualUrls(page, category), expected.map(([url]) => url));
        assert.equal(button(page, category, 'ending').getAttribute('aria-pressed'), 'true');
    }
    page.api.refreshLandingSortPageForTest();
    assert.equal(page.document.querySelectorAll('.hb-helper-landing-sort-controls').length, 3);
});

test('Next category route installs controls only for its own category', () => {
    const page = createPage({pathname: '/games'});
    page.api.refreshLandingSortPageForTest();

    assert.ok(controls(page, 'games'));
    assert.equal(controls(page, 'books'), null);
    assert.equal(controls(page, 'software'), null);
});
