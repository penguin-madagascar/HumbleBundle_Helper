const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function loadNextPageDataApi(scripts = []) {
    const element = () => ({appendChild() {}, append() {}, addEventListener() {}, dataset: {}});
    const document = {
        head: element(),
        body: element(),
        documentElement: element(),
        createElement: element,
        addEventListener() {},
        getElementById() { return null; },
        querySelector() { return null; },
        querySelectorAll(selector) { return selector === 'script' ? scripts : []; },
    };
    const context = {
        __HB_HELPER_TEST__: true,
        document,
        navigator: {language: 'en', languages: ['en']},
        location: {
            origin: 'https://www.humblebundle.com',
            pathname: '/',
            search: '',
            href: 'https://www.humblebundle.com/',
        },
        DOMParser: class {
            parseFromString(html) {
                const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)]
                    .map(match => ({textContent: match[1]}));
                return {querySelectorAll(selector) { return selector === 'script' ? scripts : []; }};
            }
        },
        console,
        GM_getValue(name, fallback) { return fallback; },
        GM_setValue() {},
        GM_deleteValue() {},
        GM_addValueChangeListener() {},
        GM_registerMenuCommand() {},
        TextEncoder,
        TextDecoder,
        MutationObserver: class { observe() {} },
        setTimeout,
        clearTimeout,
        URL,
        URLSearchParams,
    };
    const navigate = value => {
        const url = new URL(value, context.location.href);
        context.location.pathname = url.pathname;
        context.location.search = url.search;
        context.location.href = url.href;
    };
    context.window = {
        addEventListener() {},
        history: {
            pushState(state, unused, url) { navigate(url); },
            replaceState(state, unused, url) { navigate(url); },
        },
    };
    context.globalThis = context;
    vm.runInNewContext(
        fs.readFileSync(path.join(__dirname, '..', 'HB_Helper.user.js'), 'utf8'),
        context,
        {filename: 'HB_Helper.user.js'}
    );
    return {api: context.__HB_HELPER_TEST_API__, scripts, location: context.location, window: context.window};
}

const script = chunk => ({textContent: `self.__next_f.push(${JSON.stringify([1, chunk])})`});
const plain = value => JSON.parse(JSON.stringify(value));

// Reduced from the redesigned bundle's streamed server-component properties.
const bundleRow = 'e:[["$","section",null,{"children":["$","$L6d",null,{"bundlePage":'
    + '{"slug":"puzzlers-to-puzzle-you","tiers":[{"bundleItems":'
    + '[{"id":"guest","title":"The 7th Guest Remake","deliveryMethods":["steam"]}]}]}}]}]]\n';

test('reads bundle properties from inline Flight scripts without executing them', () => {
    const {api} = loadNextPageDataApi([script(bundleRow)]);
    assert.deepEqual(plain(api.getNextPageData('bundlePage')), [{
        slug: 'puzzlers-to-puzzle-you',
        tiers: [{bundleItems: [{id: 'guest', title: 'The 7th Guest Remake', deliveryMethods: ['steam']}]}],
    }]);
});

test('joins split Flight chunks and ignores non-data bootstrap channels', () => {
    const {api} = loadNextPageDataApi([
        {textContent: '(self.__next_f=self.__next_f||[]).push([0])'},
        script(':HL["/_next/static/style.css","style"]\n' + bundleRow.slice(0, 51)),
        script(bundleRow.slice(51)),
    ]);
    assert.equal(api.getNextPageData('bundlePage')[0].slug, 'puzzlers-to-puzzle-you');
});

test('skips UTF-8 length-delimited text containing fake data rows', () => {
    const text = '你好🙂\na:{"bundlePage":{"slug":"fake"}}\n';
    const row = `6e:T${Buffer.byteLength(text).toString(16)},${text}`;
    const {api} = loadNextPageDataApi([script(row + bundleRow)]);
    assert.deepEqual(plain(api.getNextPageData('bundlePage').map(value => value.slug)), ['puzzlers-to-puzzle-you']);
});

test('resolves linked rows and React element props paths used by later tiers', () => {
    const row = 'e:[["$","section",null,{"children":["$","$L6d",null,{"bundlePage":'
        + '{"slug":"puzzlers-to-puzzle-you","tiers":[{"bundleItems":["$20"]},'
        + '{"bundleItems":["$e:0:props:children:props:bundlePage:tiers:0:bundleItems:0"]}]}}]}]]\n'
        + '20:{"id":"guest","title":"The 7th Guest Remake","deliveryMethods":["steam"]}\n'
        + '75:["$","$L79",null,{"bundlePage":"$e:0:props:children:props:bundlePage"}]\n';
    const {api} = loadNextPageDataApi([script(row)]);
    const bundles = api.getNextPageData('bundlePage');
    assert.equal(bundles[0].tiers[1].bundleItems[0].title, 'The 7th Guest Remake');
    assert.equal(bundles[1].slug, 'puzzlers-to-puzzle-you');
});

test('reads listing feed and Choice subscriptions without assuming bundle records', () => {
    const {api} = loadNextPageDataApi([script(
        '4f:["$","$L7c",null,{"feedItems":[{"relationTo":"algolia-hit","value":'
        + '{"url":"/games/puzzlers-to-puzzle-you","endDate":"2026-11-14T05:00:00.000Z"}}]}]\n'
        + '18:{"subscriptionProducts":[{"title":"Mafia: The Old Country","deliveryMethods":["steam"]}]}\n'
    )]);
    assert.equal(api.getNextPageData('feedItems')[0][0].value.url, '/games/puzzlers-to-puzzle-you');
    assert.equal(api.getNextPageData('subscriptionProducts')[0][0].title, 'Mafia: The Old Country');
});

test('ignores executable script text, malformed JSON, imports, and unsupported references', () => {
    const {api} = loadNextPageDataApi([
        {textContent: 'throw new Error("must not execute")'},
        {textContent: 'self.__next_f.push([1, (() => { throw Error("must not execute"); })()])'},
        script('1:I[123,[],"default"]\n2:{broken}\n3:{"bundlePage":"$L1"}\n' + bundleRow),
    ]);
    assert.equal(api.getNextPageData('bundlePage').filter(value => value?.slug).length, 1);
});

test('does not follow inherited properties or loop through cyclic references', () => {
    const {api} = loadNextPageDataApi([script(
        '1:{"bundlePage":{"title":"Safe","self":"$1:bundlePage","missing":"$2",'
        + '"prototype":"$1:constructor:prototype"}}\n'
    )]);
    const bundle = api.getNextPageData('bundlePage')[0];
    assert.equal(bundle.title, 'Safe');
    assert.equal(bundle.self, undefined);
    assert.equal(bundle.missing, undefined);
    assert.equal(bundle.prototype, undefined);
});

test('reads newly replaced document scripts on later calls', () => {
    const {api, scripts} = loadNextPageDataApi([script(bundleRow)]);
    assert.equal(api.getNextPageData('bundlePage')[0].slug, 'puzzlers-to-puzzle-you');
    scripts.splice(0, scripts.length, script('1:{"bundlePage":{"slug":"new-bundle"}}\n'));
    assert.equal(api.getNextPageData('bundlePage')[0].slug, 'new-bundle');
    scripts[0].textContent = script('1:{"bundlePage":{"slug":"updated-bundle"}}\n').textContent;
    assert.equal(api.getNextPageData('bundlePage')[0].slug, 'updated-bundle');
    scripts.splice(0);
    assert.equal(api.getNextPageData('bundlePage').length, 0);
});

test('loads and coalesces a current route source snapshot instead of retained initial scripts', async () => {
    const {api, location} = loadNextPageDataApi([script(bundleRow)]);
    location.pathname = '/membership';
    location.href = `${location.origin}/membership`;
    const calls = [];
    const requestPage = async url => {
        calls.push(url);
        return {
            ok: true,
            url,
            text: async () => `<script>${script('1:{"subscriptionProducts":[{"title":"Current Choice"}]}\n').textContent}</script>`,
        };
    };
    const options = {requestPage};
    const first = api.loadNextPageDataFromSource('/membership\n', options);
    const second = api.loadNextPageDataFromSource('/membership\n', options);
    await Promise.all([first, second]);
    assert.equal(calls.length, 1);
    assert.equal(calls[0], 'https://www.humblebundle.com/membership');
    assert.equal(api.getNextPageData('bundlePage').length, 0);
    assert.equal(api.getNextPageData('subscriptionProducts')[0][0].title, 'Current Choice');
    await api.loadNextPageDataFromSource('/membership\n', options);
    assert.equal(calls.length, 1);
});

test('discards a late source response after the route changes', async () => {
    const {api, location} = loadNextPageDataApi([script(bundleRow)]);
    let finish;
    const requestPage = () => new Promise(resolve => { finish = resolve; });
    const pending = api.loadNextPageDataFromSource('/\n', {requestPage});
    await Promise.resolve();
    location.pathname = '/games';
    location.href = `${location.origin}/games`;
    finish({ok: true, text: async () => `<script>${script('1:{"bundlePage":{"slug":"late"}}\n').textContent}</script>`});
    assert.equal((await pending).stale, true);
    assert.equal(api.getNextPageData('bundlePage')[0].slug, 'puzzlers-to-puzzle-you');
});

test('does not retry a failed source load or accept cross-origin redirects', async () => {
    const {api} = loadNextPageDataApi([script(bundleRow)]);
    let requests = 0;
    const requestPage = async () => {
        requests += 1;
        return {ok: true, url: 'https://example.com/redirect', text: async () => ''};
    };
    await assert.rejects(api.loadNextPageDataFromSource('/\n', {requestPage}));
    await assert.rejects(api.loadNextPageDataFromSource('/\n', {requestPage}));
    assert.equal(requests, 1);
    assert.equal(api.getNextPageData('bundlePage').length, 0);
});

test('starts a fresh source load after navigating away and back while the first request is pending', async () => {
    for (const oldFirst of [true, false]) {
        const {api, window} = loadNextPageDataApi([script(bundleRow)]);
        await api.installHelperRouteLifecycleForTest();
        const pending = [];
        const requestPage = () => new Promise(resolve => { pending.push(resolve); });
        const first = api.loadNextPageDataFromSource('/\n', {requestPage});
        await Promise.resolve();
        window.history.pushState({}, '', '/unrelated');
        window.history.pushState({}, '', '/');
        const latest = api.loadNextPageDataFromSource('/\n', {requestPage});
        await Promise.resolve();
        assert.equal(pending.length, 2);
        const response = slug => ({
            ok: true,
            text: async () => `<script>${script(`1:{"bundlePage":{"slug":"${slug}"}}\n`).textContent}</script>`,
        });
        if (oldFirst) {
            pending[0](response('outdated'));
            assert.equal((await first).stale, true);
            assert.equal(api.getNextPageData('bundlePage').length, 0);
        }
        pending[1](response('latest'));
        assert.equal((await latest).loaded, true);
        if (!oldFirst) {
            pending[0](response('outdated'));
            assert.equal((await first).stale, true);
        }
        assert.equal(api.getNextPageData('bundlePage')[0].slug, 'latest');
    }
});
