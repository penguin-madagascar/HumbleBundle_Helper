const assert = require('node:assert/strict');
const test = require('node:test');
const {loadUserscript} = require('./helpers/userscript');

const {api} = loadUserscript();
const userInfo = {logged_in: true, country_code: 'CA', excluded_content_descriptors: [3, 4]};
const config = info => `<div id="application_config" data-userinfo='${JSON.stringify(info)}'></div>`;
const bootstrap = accountId => `<script type="text/javascript">var g_AccountID = ${accountId};
var g_sessionID = "test-session";</script>`;
const page = accountId => config(userInfo) + bootstrap(accountId);
const plain = value => JSON.parse(JSON.stringify(value));

// The anonymous fields and zero account declaration mirror the observed Steam home page.
// Positive IDs below are synthesized bootstrap contracts, not an authenticated capture.
test('keeps the observed anonymous Steam bootstrap without an account principal', () => {
    const session = api.parseSteamSession(config({...userInfo, logged_in: false}) + bootstrap('0'));
    assert.equal(session.loggedIn, false);
    assert.equal(Object.hasOwn(session, 'steamAccountId'), false);
});

test('reads a canonical positive uint32 Steam account ID from the inline session bootstrap', () => {
    for (const accountId of ['1', '123456789', '4294967295']) {
        assert.equal(api.parseSteamSession(page(accountId)).steamAccountId, accountId);
    }
});

test('keeps zero, missing, and noncanonical or out-of-range account declarations absent', () => {
    for (const accountId of ['0', '-1', '+1', '01', '1.0', '1e3', '4294967296', '"123"', 'null', 'NaN', '1 + 2']) {
        assert.equal(Object.hasOwn(api.parseSteamSession(page(accountId)), 'steamAccountId'), false, accountId);
    }
    assert.equal(Object.hasOwn(api.parseSteamSession(config(userInfo)
        + '<script>var g_sessionID = "test-session";</script>'), 'steamAccountId'), false);
    assert.equal(Object.hasOwn(api.parseSteamSession(config({...userInfo, logged_in: false})
        + bootstrap('123')), 'steamAccountId'), false);
});

test('rejects conflicting account declarations in one bootstrap or multiple session bootstraps', () => {
    for (const html of [
        page('123').replace('var g_sessionID', 'var g_AccountID = 456;\nvar g_sessionID'),
        page('123') + bootstrap('456'),
    ]) {
        assert.equal(Object.hasOwn(api.parseSteamSession(html), 'steamAccountId'), false);
    }
});

test('uses the session bootstrap instead of unrelated inline declarations', () => {
    const html = '<script>var g_AccountID = 456;</script>' + page('123');
    assert.equal(api.parseSteamSession(html).steamAccountId, '123');
});

test('does not derive a principal from HTML text, record fields, script strings, or external scripts', () => {
    const spoofedInfo = {...userInfo, accountid: '123', steamid: '76561197960265851', steamAccountId: '123'};
    const session = '<script>var g_sessionID = "test-session";</script>';
    for (const hint of [
        '<div>var g_AccountID = 123;</div>',
        '<script type="application/json">{"g_AccountID":123}</script>',
        '<script>const review = "var g_AccountID = 123;";</script>',
        '<script>/* var g_AccountID = 123; */</script>',
        '<script src="https://example.invalid/bootstrap.js">var g_AccountID = 123;</script>',
    ]) {
        assert.equal(Object.hasOwn(api.parseSteamSession(config(spoofedInfo) + session + hint), 'steamAccountId'), false);
    }
});

test('projects the optional principal into the in-memory authenticated snapshot without changing requests or storage', async () => {
    const values = new Map();
    const {api, requests: unexpectedRequests} = loadUserscript({values});
    const requests = [];
    const sync = api.createSteamSessionSynchronizer({
        request: async (url, type) => {
            requests.push({url, type});
            return type === 'text' ? page('123') : {rgOwnedApps: [10], rgWishlist: [20]};
        },
    });
    const state = await sync.sync();
    assert.deepEqual(plain(state.account), {
        countryCode: 'CA', ownedApps: [10], wishlistApps: [20],
        sessionId: 'test-session', steamAccountId: '123',
    });
    assert.equal(state.status, 'authenticated');
    assert.deepEqual(requests.map(request => request.type), ['text', 'json']);
    assert.equal(unexpectedRequests.length, 0);
    assert.equal(values.size, 0);
});
