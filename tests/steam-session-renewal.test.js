const assert = require('node:assert/strict');
const test = require('node:test');
const {loadUserscript} = require('./helpers/userscript');

const storeUrl = 'https://store.steampowered.com/';
const refreshUrl = 'https://login.steampowered.com/jwt/ajaxrefresh';
const exchangeUrl = 'https://store.steampowered.com/login/settoken';
const refreshResponse = () => ({
    success: true,
    login_url: exchangeUrl,
    steamID: '76561198000000000',
    nonce: 'synthetic-nonce',
    auth: 'synthetic-auth',
    redir: storeUrl,
});
const exchangeResponse = () => ({result: 1, token: 'synthetic-short-lived-token'});

function loadRenewalApi() {
    const page = loadUserscript();
    assert.equal(typeof page.api.refreshSteamSession, 'function', 'Steam renewal helper is available');
    return page;
}

test('renews through the two official Steam endpoints without storing credentials', async () => {
    const {api, values} = loadRenewalApi();
    const requests = [];
    const result = await api.refreshSteamSession({
        request: async (url, responseType, options) => {
            requests.push({url, responseType, options});
            return url === refreshUrl ? refreshResponse() : exchangeResponse();
        },
    });
    assert.equal(result, true);
    assert.deepEqual(requests.map(request => request.url), [refreshUrl, exchangeUrl]);
    for (const {responseType, options} of requests) {
        assert.equal(responseType, 'json');
        assert.equal(options.method, 'POST');
        assert.equal(options.cookiePartition.topLevelSite, 'https://store.steampowered.com');
        assert.equal(options.headers.Origin, 'https://store.steampowered.com');
        assert.equal(options.headers.Referer, storeUrl);
        assert.match(options.headers['Content-Type'], /^application\/x-www-form-urlencoded/);
        assert.equal(Object.hasOwn(options, 'cookie'), false);
    }
    assert.deepEqual(Object.fromEntries(new URLSearchParams(requests[0].options.data)), {redir: storeUrl});
    assert.deepEqual(Object.fromEntries(new URLSearchParams(requests[1].options.data)), {
        steamID: '76561198000000000', nonce: 'synthetic-nonce', auth: 'synthetic-auth', redir: storeUrl,
    });
    assert.equal(values.size, 0);
});

test('does not exchange a token when Steam explicitly refuses renewal', async () => {
    const {api} = loadRenewalApi();
    for (const success of [false, 0]) {
        let count = 0;
        const result = await api.refreshSteamSession({request: async () => {
            count += 1;
            return {success, error: 21};
        }});
        assert.equal(result, false);
        assert.equal(count, 1);
    }
});

test('returns refusal for an explicit token-exchange failure', async () => {
    const {api} = loadRenewalApi();
    let count = 0;
    const result = await api.refreshSteamSession({request: async () =>
        ++count === 1 ? refreshResponse() : {result: 21}});
    assert.equal(result, false);
    assert.equal(count, 2);
});

test('keeps service failures and rate limits distinct from a missing login session', async () => {
    const {api} = loadRenewalApi();
    for (const error of [20, 84, undefined]) {
        await assert.rejects(api.refreshSteamSession({request: async () => ({success: false, error})}),
            /invalid account data/i);
        let calls = 0;
        await assert.rejects(api.refreshSteamSession({request: async () =>
            ++calls === 1 ? refreshResponse() : {result: error}}), /invalid account data/i);
    }
});

test('rejects malformed refresh data before sending it to the Store', async () => {
    const {api} = loadRenewalApi();
    for (const response of [null, {}, [], {success: 'yes'},
        {...refreshResponse(), steamID: ''}, {...refreshResponse(), nonce: null},
        {...refreshResponse(), auth: {unexpected: true}}]) {
        let count = 0;
        await assert.rejects(api.refreshSteamSession({request: async () => {
            count += 1;
            return response;
        }}), /invalid account data/i);
        assert.equal(count, 1);
    }
});

test('rejects unsafe or unexpected exchange destinations', async () => {
    const {api} = loadRenewalApi();
    for (const login_url of [
        'http://store.steampowered.com/login/settoken',
        'https://store.steampowered.com.attacker.invalid/login/settoken',
        'https://steamcommunity.com/login/settoken',
        'https://user:pass@store.steampowered.com/login/settoken',
        'https://store.steampowered.com:444/login/settoken',
        'https://store.steampowered.com/account/ajaxregisterkey/',
        `${exchangeUrl}?redirect=https://attacker.invalid`, `${exchangeUrl}#fragment`,
        '/login/settoken', 'not a URL',
    ]) {
        let count = 0;
        await assert.rejects(api.refreshSteamSession({request: async () => {
            count += 1;
            return {...refreshResponse(), login_url};
        }}), /invalid account data/i);
        assert.equal(count, 1);
    }
});

test('does not accept successful exchanges without a valid token or result', async () => {
    const {api} = loadRenewalApi();
    for (const response of [null, {}, {result: 1}, {result: 1, token: ''},
        {result: '1', token: 'synthetic-token'}]) {
        let count = 0;
        await assert.rejects(api.refreshSteamSession({request: async () =>
            ++count === 1 ? refreshResponse() : response}), /invalid account data/i);
    }
});

test('does not start renewal for an already stale synchronization', async () => {
    const {api} = loadRenewalApi();
    const result = await api.refreshSteamSession({
        isCurrent: () => false,
        request: async () => { throw new Error('Unexpected request'); },
    });
    assert.equal(result, false);
});

test('stops before the exchange if a newer synchronization supersedes renewal', async () => {
    const {api} = loadRenewalApi();
    let current = true;
    let count = 0;
    const result = await api.refreshSteamSession({
        isCurrent: () => current,
        request: async () => {
            count += 1;
            current = false;
            return refreshResponse();
        },
    });
    assert.equal(result, false);
    assert.equal(count, 1);
});

test('propagates network failures without retrying either endpoint', async () => {
    const {api} = loadRenewalApi();
    for (const failingRequest of [1, 2]) {
        let count = 0;
        await assert.rejects(api.refreshSteamSession({request: async () => {
            if (++count === failingRequest) throw new Error('Synthetic network failure');
            return refreshResponse();
        }}), /Synthetic network failure/);
        assert.equal(count, failingRequest);
    }
});
