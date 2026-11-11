const assert = require('node:assert/strict');
const test = require('node:test');
const React = require('react');
const {renderToString} = require('react-dom/server');
const {flightScript, loadUserscript} = require('./helpers/userscript');

const h = React.createElement;
const product = {id: 'one', title: 'One', productType: 'humble-choice',
    thumbnail: 'https://example.invalid/one.jpg', deliveryMethods: ['steam']};
const marker = '<script src="/_next/static/chunks/test.js"></script>';
const tick = () => new Promise(resolve => setTimeout(resolve, 10));

async function waitFor(check) {
    for (let i = 0; i < 200; i += 1) {
        if (check()) return;
        await tick();
    }
    assert.fail('React hydration or deferred helper refresh did not finish');
}

function content(kind) {
    if (kind === 'bundle') return h('main', null,
        h('section', {'data-bundle-section': 'games'}, h('button', null, 'One')));
    if (kind === 'landing') return h('main', null, h('section', null,
        h('div', null, h('h2', null, 'Games')),
        h('div', {className: 'grid'}, ['one', 'two'].map(slug =>
            h('div', {'data-testid': 'product-card', key: slug},
                h('a', {'data-testid': 'product-link', href: `/games/${slug}`}, slug))))));
    if (kind === 'carousel') return h('main', null, h('h2', null, "This Month's Games"),
        h('div', null, h('section', {'aria-label': 'Media carousel'},
            h('div', {'data-media-index': '0'}, h('button', null,
                h('img', {alt: '', src: product.thumbnail})))),
        h('div', {className: 'choice-details'}, h('div', null,
            h('div', null, h('h3', null, product.title))))));
    return h('main', null, h('section', null, h('h1', null, '2026年11月 Humble Choice'),
        h('div', {className: 'grid'}, h('button', null,
            h('div', {'data-testid': 'product-card'},
                h('div', {'data-testid': 'product-thumbnail'}, h('img', {alt: '', src: product.thumbnail})),
                h('div', {'data-testid': 'product-card-footer'},
                    h('div', {className: 'group/product-title'},
                        h('div', null, h('div', {className: 'line-clamp-1'}, 'One')))))))));
}

for (const kind of ['bundle', 'landing', 'member', 'carousel']) {
    for (const delayed of [false, true]) {
        test(`${kind}: defers helper insertion until the exact React host commits${delayed ? ' through Suspense' : ''}`, async () => {
            let available = true;
            let release;
            const suspended = new Promise(resolve => { release = resolve; });
            function Inner() {
                if (!available) throw suspended;
                return content(kind);
            }
            function Announcer() {
                React.useEffect(() => {
                    const node = document.createElement('next-route-announcer');
                    document.body.appendChild(node);
                    return () => node.remove();
                }, []);
                return null;
            }
            function App() {
                return h(React.Fragment, null,
                    h(React.Suspense, {fallback: h('p', null, 'Loading')}, h(Inner)), h(Announcer));
            }
            const metadata = kind === 'landing' ? {feedItems: ['one', 'two'].map(slug => ({value: {
                url: `/games/${slug}`, category: 'games', productType: 'humble-bundle',
                endDate: '2026-12-01T00:00:00Z',
            }}))} : {subscriptionProducts: [product]};
            const pathname = kind === 'landing' ? '/games' : kind === 'member' ? '/membership/home'
                : kind === 'carousel' ? '/membership' : '/games/test';
            const page = loadUserscript({pathname,
                html: `${marker}<div id="root">${renderToString(h(App))}</div>${flightScript({e: metadata})}`});
            const {api, document, window} = page;
            global.window = window;
            global.document = document;
            global.navigator = {userAgent: 'Node'};
            const {hydrateRoot} = require('react-dom/client');
            const errors = [];
            const inject = () => kind === 'landing'
                ? api.refreshLandingSortPageForTest() : api.ensureHelperControls();
            const controls = () => document.querySelector(kind === 'landing'
                ? '.hb-helper-landing-sort-controls' : '#hb-helper-controls');
            let root;
            try {
                inject();
                assert.ok(!controls(), 'server HTML is untouched before hydration starts');
                const tile = api.getModernChoiceGameEntries()[0]?.tile;
                if (tile) {
                    await api.markGame(tile, new Set([42]), 'owned', async () => ({appid: 42}));
                    assert.equal(tile.classList.contains('owned'), false);
                }
                if (kind === 'carousel') {
                    const link = api.ensureSteamStoreLink(api.getSteamStoreLinkTargets()[0]);
                    page.requests[0].onload({status: 200, responseText:
                        '<div class="match" data-ds-appid="42"><div class="match_name">One</div></div>'});
                    await link;
                    assert.equal(document.querySelector('.hb-helper-steam-store-link'), null);
                }
                available = !delayed;
                root = hydrateRoot(document.getElementById('root'), h(App), {
                    onRecoverableError: error => errors.push(error),
                    onUncaughtError: error => errors.push(error),
                });
                await waitFor(() => document.querySelector('next-route-announcer'));
                if (delayed) {
                    inject();
                    assert.ok(!controls(), 'the root announcer does not bypass an unhydrated boundary');
                    available = true;
                    release();
                }
                await waitFor(controls);
                if (tile) {
                    await api.markGame(tile, new Set([42]), 'owned', async () => ({appid: 42}));
                    assert.equal(tile.classList.contains('owned'), true);
                }
                if (kind === 'carousel') await waitFor(() => document.querySelector('.hb-helper-steam-store-link'));
                root.render(h(App));
                await tick();
                inject();
                assert.ok(controls(), 'normal React updates retain a usable target');
                root.render(h('main', null, 'Next route'));
                await tick();
                assert.deepEqual(errors, []);
            } finally {
                api.resetHelperHydrationForTest?.();
                root?.unmount();
            }
        });
    }
}

test('route changes and pagehide cancel deferred hydration retries', async () => {
    const page = loadUserscript({html: `${marker}<main><section data-bundle-section="games"></section></main>`});
    const {api, window, location} = page;
    window.history = {
        pushState(state, title, url) { location.href = new URL(url, location.href).href; },
        replaceState(state, title, url) { location.href = new URL(url, location.href).href; },
    };
    await api.installHelperRouteLifecycleForTest({syncSession: async () => {},
        reconcileBatch: async () => {}, recoverCollection: async () => ({})});
    assert.equal(api.getHelperHydrationStateForTest().retryPending, true);
    window.history.pushState({}, '', '/store');
    await api.waitForHelperRouteForTest();
    assert.equal(api.getHelperHydrationStateForTest().retryPending, false);
    location.pathname = '/games/test';
    api.ensureHelperControls();
    assert.equal(api.getHelperHydrationStateForTest().retryPending, true);
    await new Promise(resolve => setTimeout(resolve, 150));
    assert.equal(api.getHelperHydrationStateForTest().retryPending, false,
        'the hydration timer has transferred work to the shared page-refresh queue');
    window.dispatchEvent(new window.Event('pagehide'));
    await new Promise(resolve => setTimeout(resolve, 350));
    assert.equal(api.getHelperHydrationStateForTest().retryPending, false);
    assert.equal(api.getHelperHydrationStateForTest().deadline, 0);
});

test('hydration retries stop at the deadline and unrelated mutations do not restart polling', async () => {
    const {api, context, window, document} = loadUserscript({
        html: `${marker}<main><section data-bundle-section="games"></section></main>`,
    });
    let now = 1;
    let nextId = 0;
    const timers = new Map();
    context.Date = class extends Date { static now() { return now; } };
    context.setTimeout = (callback, delay) => {
        const id = ++nextId;
        timers.set(id, {callback, due: now + delay});
        return id;
    };
    context.clearTimeout = id => timers.delete(id);
    const advance = async () => {
        const [id, timer] = [...timers].sort((a, b) => a[1].due - b[1].due)[0];
        timers.delete(id);
        now = timer.due;
        timer.callback();
        await Promise.resolve();
    };
    await api.installHelperRouteLifecycleForTest({syncSession: async () => {},
        reconcileBatch: async () => {}, recoverCollection: async () => ({})});
    let calls = 0;
    while (timers.size && calls < 100) {
        await advance();
        calls += 1;
    }
    assert.ok(calls > 0 && calls < 100, 'the retries finish after a bounded number of checks');
    assert.ok(api.getHelperHydrationStateForTest().deadline <= now);
    assert.equal(api.getHelperHydrationStateForTest().retryPending, false);
    assert.equal(document.getElementById('hb-helper-controls'), null);

    document.querySelector('main').appendChild(document.createElement('div'));
    await Promise.resolve();
    while (timers.size && calls < 100) {
        await advance();
        calls += 1;
    }
    assert.equal(timers.size, 0);
    assert.equal(api.getHelperHydrationStateForTest().retryPending, false);
    window.dispatchEvent(new window.Event('focus'));
    await advance();
    assert.equal(api.getHelperHydrationStateForTest().retryPending, true,
        'an explicit user return permits one new bounded retry window');
    window.dispatchEvent(new window.Event('pagehide'));
    assert.equal(timers.size, 0);
});
