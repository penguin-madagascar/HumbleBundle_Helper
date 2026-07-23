const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function loadSteamSessionApi() {
    const element = () => ({
        appendChild() {},
        append() {},
        addEventListener() {},
        classList: {toggle() {}, contains() { return false; }},
        dataset: {},
        style: {},
    });
    const document = {
        body: element(),
        head: element(),
        documentElement: element(),
        createElement: element,
        addEventListener() {},
        getElementById() { return null; },
        querySelector() { return null; },
        querySelectorAll() { return []; },
    };
    const context = {
        __HB_HELPER_TEST__: true,
        console: {log() {}, warn() {}, error() {}},
        document,
        navigator: {language: 'en', languages: ['en']},
        location: {pathname: '/', href: 'https://www.humblebundle.com/'},
        DOMParser: class {
            parseFromString(html) {
                const userInfo = html.match(/data-userinfo=(['\"])(.*?)\1/)?.[2]
                    ?.replace(/&quot;/g, '"');
                return {
                    querySelector(selector) {
                        return selector === '#application_config' && userInfo
                            ? {getAttribute() { return userInfo; }}
                            : null;
                    },
                };
            }
        },
        GM_getValue() { return []; },
        GM_setValue() {},
        GM_deleteValue() {},
        GM_addValueChangeListener() {},
        GM_setClipboard() {},
        GM_registerMenuCommand() {},
        GM_xmlhttpRequest() {},
        setTimeout,
        clearTimeout,
        URLSearchParams,
        Map,
        Set,
        Promise,
        Date,
        Math,
        JSON,
        Array,
        Object,
        String,
        Number,
        Boolean,
        RegExp,
        Error,
    };
    context.globalThis = context;
    vm.runInNewContext(
        fs.readFileSync(path.join(__dirname, '..', 'HB_Helper.user.js'), 'utf8'),
        context,
        {filename: 'HB_Helper.user.js'}
    );
    return context.__HB_HELPER_TEST_API__;
}

const api = loadSteamSessionApi();
const plain = value => JSON.parse(JSON.stringify(value));
const steamHtml = `
    <div id="application_config" data-userinfo='{"logged_in":true,"country_code":"us"}'></div>
    <script>var g_sessionID = "ephemeral-session";</script>
`;

test('parses Steam user info and session ID from one HTML response', () => {
    assert.deepEqual(plain(api.parseSteamSession(steamHtml)), {
        loggedIn: true,
        countryCode: 'US',
        sessionId: 'ephemeral-session',
    });
});

test('does not request dynamic store data for logged-out Steam responses', async () => {
    const requests = [];
    const sync = api.createSteamSessionSynchronizer({
        request: async url => {
            requests.push(url);
            return '<div id="application_config" data-userinfo=\'{"logged_in":false}\'></div>';
        },
    });

    const state = await sync.sync();
    assert.equal(state.status, 'logged-out');
    assert.equal(requests.length, 1);
});

test('releases a settled non-forced synchronization request', async () => {
    let rootRequests = 0;
    const sync = api.createSteamSessionSynchronizer({
        request: async (url, responseType) => {
            if (responseType === 'text') rootRequests += 1;
            return '<div id="application_config" data-userinfo=\'{"logged_in":false}\'></div>';
        },
    });

    await sync.sync();
    await sync.sync();
    assert.equal(rootRequests, 2);
});

test('creates authenticated snapshots with country, app lists, and an ephemeral session ID', async () => {
    const sync = api.createSteamSessionSynchronizer({
        request: async (url, responseType) => responseType === 'text'
            ? steamHtml
            : {rgOwnedApps: [10, 20], rgWishlist: [30]},
    });

    const state = await sync.sync();
    assert.deepEqual(plain(state), {
        status: 'authenticated',
        account: {
            countryCode: 'US',
            ownedApps: [10, 20],
            wishlistApps: [30],
            sessionId: 'ephemeral-session',
        },
        error: null,
    });
});

test('turns missing session IDs and invalid dynamic-store data into synchronization errors', async () => {
    for (const [html, dynamicStoreData] of [
        [steamHtml.replace('var g_sessionID = "ephemeral-session";', ''), {rgOwnedApps: [], rgWishlist: []}],
        [steamHtml, {rgOwnedApps: []}],
    ]) {
        const sync = api.createSteamSessionSynchronizer({
            request: async (url, responseType) => responseType === 'text' ? html : dynamicStoreData,
        });
        const state = await sync.sync();
        assert.equal(state.status, 'error');
        assert.equal(state.account, null);
    }
});

test('does not let stale generations overwrite newer Steam session state', async () => {
    let resolveFirst;
    const firstResponse = new Promise(resolve => { resolveFirst = resolve; });
    let rootRequests = 0;
    const sync = api.createSteamSessionSynchronizer({
        request: async (url, responseType) => {
            if (responseType === 'json') return {rgOwnedApps: [2], rgWishlist: [3]};
            rootRequests += 1;
            return rootRequests === 1 ? firstResponse : steamHtml;
        },
    });

    const stale = sync.sync();
    const current = await sync.sync({force: true});
    resolveFirst(steamHtml.replace('"us"', '"ca"'));
    await stale;
    assert.equal(current.account.countryCode, 'US');
    assert.equal(sync.getState().account.countryCode, 'US');
});

test('clears derived UI state after logged-out and error transitions', async () => {
    const cleared = [];
    const responses = [steamHtml, {rgOwnedApps: [1], rgWishlist: [2]},
        '<div id="application_config" data-userinfo=\'{"logged_in":false}\'></div>',
        steamHtml, {rgOwnedApps: []}];
    const sync = api.createSteamSessionSynchronizer({
        request: async () => responses.shift(),
        onClearDerivedState: state => cleared.push(state.status),
    });

    await sync.sync();
    await sync.sync({force: true});
    await sync.sync({force: true});
    assert.deepEqual(cleared, ['logged-out', 'error']);
});

test('coalesces adjacent focus and visibility synchronization triggers', async () => {
    let syncCalls = 0;
    let release;
    const sync = api.createSteamSessionSynchronizer({
        request: async (url, responseType) => {
            syncCalls += responseType === 'text' ? 1 : 0;
            await new Promise(resolve => { release = resolve; });
            return responseType === 'text'
                ? '<div id="application_config" data-userinfo=\'{"logged_in":false}\'></div>'
                : null;
        },
    });
    const trigger = api.createSteamSessionSyncTrigger(sync, callback => callback());

    const focus = trigger();
    const visibility = trigger();
    release();
    await Promise.all([focus, visibility]);
    assert.equal(syncCalls, 1);
});
