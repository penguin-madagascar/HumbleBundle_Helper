const assert = require('node:assert/strict');
const test = require('node:test');
const {loadUserscript} = require('./helpers/userscript');

const loggedOutHtml = '<div id="application_config" data-userinfo=\'{"logged_in":false}\'></div>';
const unknownHtml = '<html><body>Refreshing session…</body></html>';
const authenticatedHtml = '<div id="application_config" data-userinfo=\'{"logged_in":true,"country_code":"ca"}\'></div>'
    + '<script>var g_sessionID = "test-session";</script>';
const userData = {rgOwnedApps: [42], rgWishlist: [43]};

test('distinguishes missing or unexpected Steam login markers from explicit logout', () => {
    const {api} = loadUserscript();
    assert.equal(api.parseSteamSession(unknownHtml).loggedIn, null);
    assert.equal(api.parseSteamSession('<div id="application_config" data-userinfo=\'{"logged_in":"false"}\'></div>').loggedIn, null);
    assert.equal(api.parseSteamSession(loggedOutHtml).loggedIn, false);
});

for (const [description, initialHtml] of [['expired', loggedOutHtml], ['intermediate', unknownHtml]]) {
    test(`recovers an ${description} Steam session before showing a login prompt`, async () => {
        const {api} = loadUserscript();
        const responses = [initialHtml, authenticatedHtml, userData];
        const requests = [];
        const transitions = [];
        const cleared = [];
        let renewals = 0;
        const request = async (...args) => { requests.push(args); return responses.shift(); };
        const sync = api.createSteamSessionSynchronizer({
            request,
            refreshSession: async options => {
                assert.ok(options.request === request);
                assert.equal(options.isCurrent(), true);
                renewals += 1;
                return true;
            },
            onStateChange: state => transitions.push(state),
            onClearDerivedState: state => cleared.push(state.status),
        });
        const state = await sync.sync();
        assert.equal(state.status, 'authenticated');
        assert.deepEqual(Array.from(state.account.ownedApps), [42]);
        assert.equal(renewals, 1);
        assert.equal(requests.length, 3);
        assert.ok(requests[0][0].startsWith('https://store.steampowered.com/?'));
        assert.ok(requests[1][0].startsWith('https://store.steampowered.com/?'));
        assert.ok(requests[2][0].includes('/dynamicstore/userdata/'));
        assert.equal(requests[0][2].headers['Cache-Control'], 'no-cache');
        assert.equal(requests[1][2].headers['Cache-Control'], 'no-cache');
        assert.ok(transitions.some(state => state.phase === 'refreshing'));
        assert.ok(transitions.every(state => !['logged-out', 'error'].includes(state.status)));
        assert.deepEqual(cleared, []);
    });
}

test('confirms logout after one refused renewal and a second explicit logged-out response', async () => {
    const {api} = loadUserscript();
    let probes = 0;
    let renewals = 0;
    const cleared = [];
    const sync = api.createSteamSessionSynchronizer({
        request: async () => { probes += 1; return loggedOutHtml; },
        refreshSession: async () => { renewals += 1; return false; },
        onClearDerivedState: state => cleared.push(state.status),
    });
    assert.equal((await sync.sync()).status, 'logged-out');
    assert.equal(probes, 2);
    assert.equal(renewals, 1);
    assert.deepEqual(cleared, ['logged-out']);
});

test('keeps unverified pages and failed renewals separate from confirmed logout', async () => {
    for (const [html, refreshSession] of [
        [unknownHtml, async () => false],
        [loggedOutHtml, async () => { throw new Error('Refresh request failed'); }],
        [loggedOutHtml, async () => true],
    ]) {
        const {api} = loadUserscript();
        let probes = 0;
        const sync = api.createSteamSessionSynchronizer({
            request: async () => { probes += 1; return html; },
            refreshSession,
        });
        assert.equal((await sync.sync()).status, 'error');
        assert.equal(probes, 2);
    }
});

test('accepts an authoritative authenticated probe even if the renewal response failed', async () => {
    const {api} = loadUserscript();
    const responses = [loggedOutHtml, authenticatedHtml, userData];
    const sync = api.createSteamSessionSynchronizer({
        request: async () => responses.shift(),
        refreshSession: async () => { throw new Error('Lost refresh response'); },
    });
    assert.equal((await sync.sync()).status, 'authenticated');
});

test('reports a Steam renewal rate limit as a synchronization error after rechecking', async () => {
    const {api} = loadUserscript();
    let probes = 0;
    let renewals = 0;
    const sync = api.createSteamSessionSynchronizer({request: async (url, type) => {
        if (type === 'json') {
            renewals += 1;
            return {success: false, error: 84};
        }
        probes += 1;
        return loggedOutHtml;
    }});
    assert.equal((await sync.sync()).status, 'error');
    assert.equal(probes, 2);
    assert.equal(renewals, 1);
});

test('coalesces overlapping synchronization throughout renewal', async () => {
    const {api} = loadUserscript();
    let finishRenewal;
    let signalRenewal;
    const renewing = new Promise(resolve => { signalRenewal = resolve; });
    const responses = [loggedOutHtml, authenticatedHtml, userData];
    let renewals = 0;
    const sync = api.createSteamSessionSynchronizer({
        request: async () => responses.shift(),
        refreshSession: () => {
            renewals += 1;
            signalRenewal();
            return new Promise(resolve => { finishRenewal = resolve; });
        },
    });
    const first = sync.sync();
    await renewing;
    const second = sync.sync();
    assert.ok(first === second, 'one synchronization covers both callers');
    finishRenewal(true);
    assert.equal((await first).status, 'authenticated');
    assert.equal(renewals, 1);
});

test('stops an obsolete synchronization after renewal without overwriting a newer account', async () => {
    const {api} = loadUserscript();
    let finishRenewal;
    let renewalOptions;
    let signalRenewal;
    const renewing = new Promise(resolve => { signalRenewal = resolve; });
    let probes = 0;
    const sync = api.createSteamSessionSynchronizer({
        request: async (url, type) => {
            if (type === 'json') return userData;
            probes += 1;
            return probes === 1 ? loggedOutHtml : authenticatedHtml;
        },
        refreshSession: options => {
            renewalOptions = options;
            signalRenewal();
            return new Promise(resolve => { finishRenewal = resolve; });
        },
    });
    const old = sync.sync();
    await renewing;
    const latest = sync.sync({force: true});
    assert.equal(renewalOptions.isCurrent(), false);
    finishRenewal(true);
    await Promise.all([old, latest]);
    assert.equal(sync.getState().status, 'authenticated');
    assert.equal(probes, 2);
});

test('waits for an in-flight cookie exchange before publishing a newer account snapshot', async () => {
    const {api} = loadUserscript();
    let cookieAccount = '';
    let finishExchange;
    let signalExchange;
    const exchanging = new Promise(resolve => { signalExchange = resolve; });
    let probes = 0;
    const sync = api.createSteamSessionSynchronizer({request: async (url, type) => {
        if (url.includes('/jwt/ajaxrefresh')) return {
            success: true, login_url: 'https://store.steampowered.com/login/settoken',
            steamID: '76561198000000000', nonce: 'synthetic-nonce', auth: 'synthetic-auth',
        };
        if (url.includes('/login/settoken')) {
            signalExchange();
            return new Promise(resolve => { finishExchange = () => {
                cookieAccount = 'A';
                resolve({result: 1, token: 'synthetic-token'});
            }; });
        }
        if (type === 'json') return {rgOwnedApps: [cookieAccount === 'A' ? 42 : 99], rgWishlist: []};
        probes += 1;
        return cookieAccount ? authenticatedHtml.replace('test-session', `session-${cookieAccount}`) : loggedOutHtml;
    }});
    const old = sync.sync();
    await exchanging;
    cookieAccount = 'B';
    const latest = sync.sync({force: true});
    await Promise.resolve();
    assert.equal(probes, 1, 'new probes wait until the cookie-mutating request settles');
    finishExchange();
    await Promise.all([old, latest]);
    assert.equal(sync.getState().account.sessionId, `session-${cookieAccount}`);
    assert.deepEqual(Array.from(sync.getState().account.ownedApps), [42]);
});

test('does not renew healthy sessions or turn transport failures into logout', async () => {
    for (const failProbe of [false, true]) {
        const {api} = loadUserscript();
        let renewals = 0;
        const sync = api.createSteamSessionSynchronizer({
            request: async (url, type) => {
                if (failProbe) throw new Error('Network unavailable');
                return type === 'text' ? authenticatedHtml : userData;
            },
            refreshSession: async () => { renewals += 1; return true; },
        });
        assert.equal((await sync.sync()).status, failProbe ? 'error' : 'authenticated');
        assert.equal(renewals, 0);
    }
});
