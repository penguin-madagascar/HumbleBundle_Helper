const assert = require('node:assert/strict');
const test = require('node:test');
const {loadUserscript} = require('./helpers/userscript');

const bundlePath = '/home/library/11111111-1111-4111-8111-111111111111';
const tick = () => new Promise(resolve => setImmediate(resolve));

function loadSearchPage(titles, pathname = bundlePath) {
    const rows = titles.map(title => `<div class="flex flex-col border-0">
        <div class="flex flex-wrap items-center justify-between"><div class="flex flex-1 items-center gap-2">
        <div><span aria-label="Steam"></span></div><div class="flex flex-1 flex-col justify-center">
        <div class="item-title">${title}</div><div>Native subtitle</div></div></div><button>Reveal key</button></div>
        <div class="overflow-hidden">Native details</div></div>`).join('');
    const page = loadUserscript({pathname, html: `<main><h1>Example bundle</h1>${rows}</main>`});
    // Matching schedules a later page refresh; these tests drive only its requests.
    page.context.setTimeout = () => 0;
    const tiles = page.document.querySelectorAll('.border-0');
    return {...page, lookup: index => page.api.markGame(tiles[index], new Set([42]), 'owned')};
}

function storeTitle(request) {
    const url = new URL(request.url);
    assert.equal(url.hostname, 'store.steampowered.com');
    return url.searchParams.get('term');
}

function answerStore(request) {
    const title = storeTitle(request);
    request.onload({status: 200, responseText:
        `<div class="match" data-ds-appid="42"><div class="match_name">${title}</div></div>`});
}

test('Library title matching starts at most three uncached lookups and drains them in order', async () => {
    const titles = Array.from({length: 8}, (_, index) => `Game ${index + 1}`);
    const {lookup, requests} = loadSearchPage(titles);
    const pending = titles.map((_, index) => lookup(index));
    assert.equal(requests.length, 3);

    for (let index = 0; index < titles.length; index += 1) {
        assert.equal(storeTitle(requests[index]), titles[index]);
        assert.ok(requests.length - index <= 3);
        answerStore(requests[index]);
        await tick();
    }
    await Promise.all(pending);
    assert.equal(requests.length, titles.length);
});

test('one Library slot covers the store lookup and its Community fallback', async () => {
    const {lookup, requests} = loadSearchPage(['One', 'Two', 'Three', 'Four']);
    const pending = [0, 1, 2, 3].map(lookup);
    requests[0].onload({status: 200, responseText: ''});
    await tick();

    assert.equal(requests.length, 4);
    assert.match(requests[3].url, /steamcommunity\.com\/actions\/SearchApps\/One$/);
    assert.ok(!requests.some(request => request.url.includes('term=Four')));
    requests[3].onload({status: 200, response: [{appid: 42, name: 'One'}]});
    await tick();
    assert.equal(storeTitle(requests[4]), 'Four');
    [1, 2, 4].forEach(index => answerStore(requests[index]));
    await Promise.all(pending);
});

test('normalized duplicate titles reuse the pending queue entry and the completed match', async () => {
    const {lookup, requests} = loadSearchPage(['One', 'Two', 'Three', 'Queued', 'Queued™']);
    const pending = [0, 1, 2, 3, 4].map(lookup);
    assert.equal(requests.length, 3);
    answerStore(requests[0]);
    await tick();
    assert.equal(requests.length, 4);
    assert.equal(storeTitle(requests[3]), 'Queued');
    [1, 2, 3].forEach(index => answerStore(requests[index]));
    await Promise.all(pending);

    await lookup(4);
    assert.equal(requests.length, 4);
});

test('a released Library slot stays reserved for its queued lookup when new work arrives', async () => {
    const {lookup, requests} = loadSearchPage(['One', 'Two', 'Three', 'Queued', 'New']);
    const pending = [0, 1, 2, 3].map(lookup);
    const incoming = pending[0].then(() => lookup(4));
    answerStore(requests[0]);
    await tick();
    assert.equal(requests.length, 4);
    assert.equal(storeTitle(requests[3]), 'Queued');
    answerStore(requests[1]);
    await tick();
    assert.equal(requests.length, 5);
    assert.equal(storeTitle(requests[4]), 'New');
    [2, 3, 4].forEach(index => answerStore(requests[index]));
    await Promise.all([...pending, incoming]);
});

test('a rejected Library lookup releases its slot for pending titles', async () => {
    const {lookup, requests, context} = loadSearchPage(['Broken', 'Two', 'Three', 'Four']);
    const send = context.GM_xmlhttpRequest;
    context.GM_xmlhttpRequest = request => {
        if (new URL(request.url).searchParams.get('term') === 'Broken') {
            throw new Error('synthetic request setup failure');
        }
        send(request);
    };
    const pending = Promise.allSettled([0, 1, 2, 3].map(lookup));
    assert.equal(requests.length, 2);
    await tick();
    assert.equal(requests.length, 3);
    assert.deepEqual(requests.map(storeTitle), ['Two', 'Three', 'Four']);
    requests.forEach(answerStore);
    const results = await pending;
    assert.equal(results[0].status, 'rejected');
    assert.match(results[0].reason.message, /synthetic/);
    assert.ok(results.slice(1).every(result => result.status === 'fulfilled'));
});

test('Library request timeouts finish the fallback and release its occupied slot', async () => {
    const {lookup, requests} = loadSearchPage(['One', 'Two', 'Three', 'Four']);
    const pending = [0, 1, 2, 3].map(lookup);
    assert.ok(requests[0].timeout > 0);
    assert.equal(typeof requests[0].ontimeout, 'function');
    requests[0].ontimeout();
    await tick();
    assert.match(requests[3].url, /steamcommunity\.com/);
    assert.ok(requests[3].timeout > 0);
    assert.equal(typeof requests[3].ontimeout, 'function');
    requests[3].ontimeout();
    await tick();
    assert.equal(storeTitle(requests[4]), 'Four');
    [1, 2, 4].forEach(index => answerStore(requests[index]));
    await Promise.all(pending);
});

test('network failures in both searches release a Library slot without matching an app', async () => {
    const {lookup, requests, document} = loadSearchPage(['One', 'Two', 'Three', 'Four']);
    const pending = [0, 1, 2, 3].map(lookup);
    requests[0].onerror();
    await tick();
    assert.match(requests[3].url, /steamcommunity\.com/);
    requests[3].onerror();
    await tick();
    assert.equal(storeTitle(requests[4]), 'Four');
    [1, 2, 4].forEach(index => answerStore(requests[index]));
    await Promise.all(pending);
    assert.equal(document.querySelector('.border-0').classList.contains('owned'), false);
});

for (const pathname of ['/membership/home', '/downloads?key=synthetic-order']) {
    test(`${pathname} keeps its existing uncapped matching and reuses the same cache after Library navigation`, async () => {
        const {lookup, requests, location} = loadSearchPage(['One', 'Two', 'Three', 'Four', 'Five', 'One™'], pathname);
        const pending = [0, 1, 2, 3, 4].map(lookup);
        assert.equal(requests.length, 5);
        assert.ok(requests.every(request => request.timeout === undefined));
        requests.forEach(answerStore);
        await Promise.all(pending);

        location.pathname = bundlePath;
        await lookup(5);
        assert.equal(requests.length, 5);
    });
}
