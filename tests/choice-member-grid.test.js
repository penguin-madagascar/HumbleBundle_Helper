const assert = require('node:assert/strict');
const test = require('node:test');
const {flightScript, loadUserscript} = require('./helpers/userscript');

function product(id, deliveryMethods = ['steam']) {
    return {
        id,
        productType: 'humble-choice',
        title: `Member Game ${id}`,
        thumbnail: `https://hb-prd.imgix.net/product-media/${id}.jpg`,
        deliveryMethods,
    };
}

// Reduced from the authenticated member page's supplied DOM structure.
function memberCard(item) {
    return `<button type="button" aria-haspopup="dialog">
      <div data-testid="product-card"><div>
        <div data-testid="product-thumbnail"><img alt="" src="/_next/image?url=${encodeURIComponent(item.thumbnail)}&amp;w=640&amp;q=75"></div>
      </div><div data-testid="product-card-footer">
        <div class="group/product-title"><div><div class="line-clamp-1">${item.title}</div></div></div>
        <div>Get game</div>
      </div></div>
    </button>`;
}

function memberPage(items, {catalogs = [items], pathname = '/membership/home'} = {}) {
    const records = Object.fromEntries(catalogs.map((subscriptionProducts, index) => [
        String(index + 1), {subscriptionProducts},
    ]));
    return loadUserscript({pathname, html: `${flightScript(records)}
      <main id="main-content" class="flex grow flex-col overflow-x-clip"><div class="relative">
        <section class="page-content"><div class="flex flex-col gap-10">
          <div><h1>2026年11月 Humble Choice</h1><a>Claim all</a></div>
          <div class="grid grid-cols-1 sm:grid-cols-2">${items.map(memberCard).join('')}</div>
        </div></section>
      </div></main>`});
}

test('recognizes the authenticated Choice grid under its localized month heading', () => {
    const items = [product('first'), product('second', ['blizzard'])];
    const {api, document} = memberPage(items);
    assert.equal(typeof api.getModernChoiceMemberGrid, 'function');
    assert.ok(api.getModernChoiceMemberGrid() === document.querySelector('.grid'));
    const entries = api.getModernChoiceGameEntries();
    assert.deepEqual(Array.from(entries, entry => entry.title), items.map(item => item.title));
    assert.ok(entries[0].tile === document.querySelector('[data-testid="product-card"]'));
    assert.equal(entries[0].tile.parentElement.tagName, 'BUTTON');
    assert.deepEqual(Array.from(api.getVisibleGameTitles()), [items[0].title]);
});

test('uses an exact visible member title when the thumbnail is unavailable', () => {
    const item = product('first');
    const {api, document} = memberPage([item]);
    document.querySelector('img').setAttribute('src', '/different-image.jpg');
    assert.equal(api.getModernChoiceGameEntries()[0]?.title, item.title);
    document.querySelector('img').removeAttribute('src');
    assert.equal(api.getModernChoiceGameEntries()[0]?.title, item.title);
    document.querySelector('.line-clamp-1').textContent = item.title.toLowerCase();
    assert.equal(api.getModernChoiceGameEntries().length, 0);
});

test('rejects conflicting thumbnail and title identities in member cards', () => {
    const items = [product('first'), product('second')];
    const {api, document} = memberPage(items);
    document.querySelector('.line-clamp-1').textContent = items[1].title;
    assert.deepEqual(Array.from(api.getModernChoiceGameEntries(), entry => entry.title), [items[1].title]);
});

test('deduplicates repeated identical catalog records by product identity', () => {
    const items = [product('first'), product('second')];
    const {api} = memberPage(items, {catalogs: [items, items.map(item => ({...item}))]});
    assert.deepEqual(Array.from(api.getModernChoiceGameEntries(), entry => entry.title), items.map(item => item.title));
});

test('keeps real catalog ambiguity fail-closed', () => {
    const first = product('first');
    for (const duplicate of [
        {...product('second'), thumbnail: first.thumbnail},
        {...first, title: 'Conflicting member title'},
    ]) {
        const {api} = memberPage([first], {catalogs: [[first, duplicate]]});
        assert.equal(api.getModernChoiceGameEntries().length, 0);
    }
});

test('does not identify member grids on public or unrelated routes', () => {
    for (const pathname of ['/membership', '/store/example', '/games/example']) {
        const {api} = memberPage([product('first')], {pathname});
        assert.equal(api.getModernChoiceMemberGrid(), null);
        assert.equal(api.getModernChoiceGameEntries().length, 0);
    }
});

test('requires a Choice heading and direct button children containing product cards', () => {
    const {api, document} = memberPage([product('first')]);
    document.querySelector('h1').textContent = 'Humble Store';
    assert.equal(api.getModernChoiceMemberGrid(), null);
    document.querySelector('h1').textContent = '2026年11月 Humble Choice';
    const extra = document.createElement('a');
    extra.textContent = 'An unrelated store card';
    document.querySelector('.grid').appendChild(extra);
    assert.equal(api.getModernChoiceMemberGrid(), null);
});

test('does not choose between two indistinguishable member grids', () => {
    const {api, document} = memberPage([product('first')]);
    const grid = document.querySelector('.grid');
    grid.parentElement.appendChild(grid.cloneNode(true));
    assert.equal(api.getModernChoiceMemberGrid(), null);
});
