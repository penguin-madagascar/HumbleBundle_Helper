const assert = require('node:assert/strict');
const test = require('node:test');
const {flightScript, loadUserscript} = require('./helpers/userscript');

test('loads current Next data after client navigation while retaining the initial scripts', async () => {
    const html = '<script src="/_next/static/chunks/example.js"></script>'
        + flightScript({e: {subscriptionProducts: [{title: 'Previous page'}]}});
    const {api, location, window} = loadUserscript({pathname: '/', html});
    const visited = [];
    const currentProducts = [{id: 'current-game', title: 'Current page', productType: 'humble-choice'}];
    let pendingSource;
    window.history = {
        pushState(state, title, url) { location.href = new URL(url, location.href).href; },
        replaceState(state, title, url) { location.href = new URL(url, location.href).href; },
    };
    await api.installHelperRouteLifecycleForTest({
        syncSession: async () => {},
        recoverCollection: async () => ({}),
        reconcileBatch: async () => {},
        loadNextPage: fingerprint => {
            visited.push(fingerprint);
            pendingSource = api.loadNextPageDataFromSource(fingerprint, {
                requestPage: async () => ({ok: true, text: async () =>
                    `<html><body>${flightScript({e: {subscriptionProducts: currentProducts}})}</body></html>`}),
            });
            return pendingSource;
        },
    });
    assert.deepEqual(visited, []);
    window.history.pushState({}, '', '/membership');
    await api.waitForHelperRouteForTest();
    await pendingSource;
    assert.deepEqual(visited, ['/membership\n']);
    assert.deepEqual(Array.from(api.getNextPageData('subscriptionProducts')[0], game => game.title), ['Current page']);
    window.history.replaceState({}, '', '#game-detail');
    await api.waitForHelperRouteForTest();
    assert.equal(visited.length, 1);
    window.history.pushState({}, '', '/store');
    await api.waitForHelperRouteForTest();
    assert.equal(visited.length, 1);
});
