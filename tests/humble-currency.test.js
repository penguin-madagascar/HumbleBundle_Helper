const assert = require('node:assert/strict');
const test = require('node:test');
const {loadUserscript} = require('./helpers/userscript');

// Reduced from the user's actual /user/settings Location row.
function locationRow(label = '位置', country = 'Canada') {
    return `<div class="space-y-0 p-4 flex"><div class="w-full min-w-0">
        <div class="flex items-center gap-2"><h3 class="truncate text-base">${label}</h3>
            <button data-state="closed">Edit</button></div>
        <p class="text-muted-foreground mt-1 text-sm">${country}</p>
    </div></div>`;
}

test('reads the localized account Location row supplied by the user', () => {
    for (const label of ['位置', 'Location']) {
        const {api, document} = loadUserscript({html: locationRow(label)});
        assert.equal(api.findHumbleAccountCurrencyCode(document), 'CAD');
    }
});

test('prefers the labelled Location row over visitor and billing country attributes', () => {
    const {api, document} = loadUserscript({html: `
        <div data-country="US">Visitor country</div>
        <section data-country-code="UA">Billing address</section>
        ${locationRow()}`});
    assert.equal(api.findHumbleAccountCurrencyCode(document), 'CAD');
});

test('keeps legacy country select and explicit country data compatibility', () => {
    for (const [html, expected] of [
        ['<label for="country">Location</label><select id="country"><option value="US">United States</option><option value="CA" selected>Canada</option></select>', 'CAD'],
        ['<div data-location="GB"></div>', 'GBP'],
    ]) {
        const {api, document} = loadUserscript({html});
        assert.equal(api.findHumbleAccountCurrencyCode(document), expected);
    }
});

test('does not treat a translated Location heading without a value as a currency', () => {
    const {api, document} = loadUserscript({html: locationRow('位置', '')});
    assert.equal(api.findHumbleAccountCurrencyCode(document), null);
});

test('resolves and caches CAD from the fetched settings document for all price pages', async () => {
    for (const pathname of ['/membership/home', '/games/example']) {
        const warnings = [];
        const {api, requests} = loadUserscript({pathname, logger: {warn: (...args) => warnings.push(args)}});
        const first = api.resolveHumbleCurrencyCode();
        const second = api.resolveHumbleCurrencyCode();
        assert.equal(requests.length, 1);
        assert.ok(requests[0].url.startsWith('https://www.humblebundle.com/user/settings?'));
        requests[0].onload({status: 200, responseText: `<html><body>${locationRow()}</body></html>`});
        assert.deepEqual(await Promise.all([first, second]), ['CAD', 'CAD']);
        assert.equal(await api.resolveHumbleCurrencyCode(), 'CAD');
        assert.equal(requests.length, 1);
        assert.equal(warnings.length, 0);
    }
});

test('a missing Location settles as unavailable rather than guessing USD and warns once', async () => {
    const warnings = [];
    const {api, requests} = loadUserscript({logger: {warn: (...args) => warnings.push(args)}});
    const first = api.resolveHumbleCurrencyCode();
    requests[0].onload({status: 200, responseText: '<html><body><h3>Account</h3></body></html>'});
    assert.equal(await first, null);
    assert.equal(await api.resolveHumbleCurrencyCode(), null);
    assert.equal(requests.length, 1);
    assert.equal(warnings.length, 1);
    assert.doesNotMatch(warnings[0][0], /using USD/);
});

test('a network failure settles as unavailable and does not repeat warnings on each total refresh', async () => {
    const warnings = [];
    const {api, requests} = loadUserscript({logger: {warn: (...args) => warnings.push(args)}});
    const first = api.resolveHumbleCurrencyCode();
    requests[0].onerror();
    assert.equal(await first, null);
    assert.equal(await api.resolveHumbleCurrencyCode(), null);
    assert.equal(warnings.length, 1);
    assert.equal(requests.length, 1);
});
