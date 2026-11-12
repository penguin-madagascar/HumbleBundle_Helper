const assert = require('node:assert/strict');
const {createHash, webcrypto} = require('node:crypto');
const test = require('node:test');
const {loadUserscript} = require('./helpers/userscript');

const primaryEmail = 'Synthetic.Owner+library@example.test';
const otherEmail = 'Synthetic.Other@example.test';
const fingerprint = email => createHash('sha256')
    .update(`humble-account:v1:${email}`)
    .digest('hex');

// Reduced from the verified settings row; these addresses are synthetic.
function emailRow(email = primaryEmail, label = '邮箱地址') {
    return `<div class="space-y-0 p-4 flex"><div class="w-full min-w-0">
        <div class="flex items-center gap-2"><h3 class="truncate text-base">${label}</h3>
            <button>Edit</button></div>
        <p class="text-muted-foreground mt-1 text-sm">${email}</p>
    </div></div>`;
}

function requestHtml(html) {
    return {request: async () => html, cryptoProvider: webcrypto};
}

test('Library identity hashes only the observed primary email setting row', async () => {
    const {api} = loadUserscript();
    assert.equal(typeof api.loadLibraryHumbleIdentity, 'function');
    for (const label of ['邮箱地址', 'Email', 'Email address', 'EMAIL ADDRESS']) {
        const identity = await api.loadLibraryHumbleIdentity(requestHtml(
            emailRow(` \n${primaryEmail}\t `, label)
        ));
        assert.equal(identity, fingerprint(primaryEmail));
        assert.match(identity, /^[a-f0-9]{64}$/);
    }
});

test('Library identity preserves exact email case rather than merging possible accounts', async () => {
    const {api} = loadUserscript();
    const first = await api.loadLibraryHumbleIdentity(requestHtml(emailRow()));
    const second = await api.loadLibraryHumbleIdentity(requestHtml(emailRow(
        primaryEmail.toLowerCase()
    )));
    assert.equal(first, fingerprint(primaryEmail));
    assert.equal(second, fingerprint(primaryEmail.toLowerCase()));
    assert.notEqual(first, second);
});

test('Library identity requests fresh settings HTML at every call', async () => {
    const {api, context, requests} = loadUserscript();
    context.crypto = webcrypto;
    for (const email of [primaryEmail, otherEmail, primaryEmail]) {
        const previousCount = requests.length;
        const pending = api.loadLibraryHumbleIdentity();
        assert.equal(requests.length, previousCount + 1);
        const request = requests.at(-1);
        const url = new URL(request.url);
        assert.equal(request.method, 'GET');
        assert.equal(url.origin, 'https://www.humblebundle.com');
        assert.equal(url.pathname, '/user/settings');
        assert.ok(url.searchParams.has('_'));
        assert.equal(request.responseType, 'text');
        assert.equal(request.headers['Cache-Control'], 'no-cache');
        request.onload({status: 200, responseText: emailRow(email)});
        assert.equal(await pending, fingerprint(email));
    }
});

test('Library identity allows repeated identical rows but rejects conflicting primary emails', async () => {
    const {api} = loadUserscript();
    assert.equal(await api.loadLibraryHumbleIdentity(requestHtml(
        emailRow() + emailRow(primaryEmail, 'Email address')
    )), fingerprint(primaryEmail));
    assert.equal(await api.loadLibraryHumbleIdentity(requestHtml(
        emailRow() + emailRow(otherEmail, 'Email address')
    )), null);
});

test('the notification 邮箱 row cannot poison a valid primary email row', async () => {
    const {api} = loadUserscript();
    const html = emailRow('通知偏好：只接收交易相关邮件', '邮箱') + emailRow();
    assert.equal(await api.loadLibraryHumbleIdentity(requestHtml(html)), fingerprint(primaryEmail));
});

test('Library identity rejects emails outside the verified primary setting structure', async () => {
    const {api} = loadUserscript();
    const invalidDocuments = [
        `<body data-email="${primaryEmail}">${primaryEmail}</body>`,
        emailRow(primaryEmail, '邮箱'),
        emailRow(primaryEmail, 'Email notifications'),
        emailRow(primaryEmail, 'Account name'),
        `<label>Email address<input type="email" value="${primaryEmail}"></label>`,
        `<div><h3>Email address</h3><p>${primaryEmail}</p></div>`,
        `<div><div><h3>Email address</h3></div><section><p class="text-muted-foreground mt-1 text-sm">${primaryEmail}</p></section></div>`,
        emailRow(`<input value="${primaryEmail}">`),
        emailRow(`<span data-email="${primaryEmail}"></span>`),
        emailRow(`<a href="mailto:${primaryEmail}">Change email</a>`),
        `<script>window.account = {email: '${primaryEmail}'}</script>`,
        '<h3>Sign in</h3><input name="email">',
    ];
    for (const html of invalidDocuments) {
        assert.equal(await api.loadLibraryHumbleIdentity(requestHtml(html)), null);
    }
});

test('Library identity rejects masked and invalid email text rather than guessing', async () => {
    const {api} = loadUserscript();
    for (const value of [
        '', 'Account owner', 'S***@example.test', 'S•••@example.test',
        'S…@example.test', 'owner @example.test', 'owner@example',
        'owner@example..test', '.owner@example.test', 'owner.@example.test',
        'own..er@example.test', 'owner@-example.test',
        `${primaryEmail} ${otherEmail}`,
    ]) {
        assert.equal(await api.loadLibraryHumbleIdentity(requestHtml(emailRow(value))), null);
    }
});

test('Library identity fails closed without Web Crypto or a valid SHA-256 digest', async () => {
    const {api} = loadUserscript();
    for (const cryptoProvider of [
        null, {}, {subtle: {}},
        {subtle: {digest: async () => new Uint8Array(8).buffer}},
        {subtle: {digest: async () => { throw new Error(primaryEmail); }}},
    ]) {
        assert.equal(await api.loadLibraryHumbleIdentity({
            request: async () => emailRow(), cryptoProvider,
        }), null);
    }
});

test('Library identity returns only fingerprints and never persists or logs email or response errors', async () => {
    const logged = [];
    const writes = [];
    const logger = Object.fromEntries(['log', 'warn', 'error', 'info', 'debug']
        .map(method => [method, (...args) => logged.push(args)]));
    const {api, context, values} = loadUserscript({logger});
    const storedBefore = Array.from(values);
    context.GM_setValue = (...args) => writes.push(args);
    const results = [
        await api.loadLibraryHumbleIdentity(requestHtml(emailRow())),
        await api.loadLibraryHumbleIdentity({
            request: async () => { throw new Error(`Private response: ${primaryEmail}`); },
            cryptoProvider: webcrypto,
        }),
    ];
    assert.deepEqual(results, [fingerprint(primaryEmail), null]);
    assert.deepEqual(writes, []);
    assert.deepEqual(logged, []);
    assert.deepEqual(Array.from(values), storedBefore);
    assert.ok(!JSON.stringify({results, writes, logged, stored: Array.from(values)})
        .includes(primaryEmail));
});

test('Library identity can recover on the next read after signed-out or unavailable responses', async () => {
    const {api} = loadUserscript();
    for (const unavailable of [null, {}, '<h3>Sign in</h3>']) {
        assert.equal(await api.loadLibraryHumbleIdentity(requestHtml(unavailable)), null);
        assert.equal(await api.loadLibraryHumbleIdentity(requestHtml(emailRow())), fingerprint(primaryEmail));
    }
});
