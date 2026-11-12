const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const probePath = path.join(__dirname, '..', 'tools', 'library-source-contract.js');
const location = new URL('https://www.humblebundle.com/home/library?token=PRIVATE_QUERY');
const page = sources => ({scripts: sources.map(src => ({getAttribute: name => name === 'src' ? src : null}))});
const transport = 'function redeemKey(entitlementId,contentId){return client.post("/api/library/redemption",{entitlementId,contentId})}';
const response = (body = transport, options = {}) => new Response(body, {
    status: 200, headers: {'content-type': 'application/javascript', ...options.headers}, ...options,
});
const collect = (document, fetchAsset) => require(probePath).collectLibrarySourceContract(document, location, fetchAsset);

test('reads only existing verified static scripts and emits a bounded contract skeleton', async () => {
    const sources = [null, '', '/assets/client.js?v=PUBLIC_BUILD', '/_next/static/chunks/library.mjs',
        '/api/library.js', '/home/library.js', '/public/client.js', '/ASSETS/a.js', 'https://other.test/assets/a.js',
        '/assets/user/a.js', '/assets/session/a.js', '/assets/user-settings.js', '/assets/login.js', '/assets/private@example.test.js',
        '/assets/11111111-1111-4111-8111-111111111111.js', '/assets/a.js?token=SECRET', '/assets/a.json'];
    const requests = [];
    const result = await collect(page(sources), async (url, options) => {
        requests.push([url, options]);
        return response(url.includes('client') ? transport : 'const claimKey=(id)=>api.request({url:"/api/keys/claim",method:"POST",data:{id}});');
    });
    assert.deepEqual(result.assetPaths, ['/assets/[asset-1].js', '/_next/static/[asset-2].mjs']);
    assert.equal(requests.length, 2);
    for (const [, options] of requests) assert.deepEqual(options, {method: 'GET', cache: 'force-cache', credentials: 'same-origin', redirect: 'error'});
    assert.ok(result.candidates.some(item => item.hint === 'redeemKey' && item.fields.includes('entitlementId') && item.fields.includes('contentId')));
    assert.ok(result.candidates.some(item => item.hint === 'claimKey' && item.paths.includes('/api/keys/claim') && item.methods.includes('POST')));
    assert.ok(!JSON.stringify(result).includes('PUBLIC_BUILD'));
    assert.ok(!JSON.stringify(result).includes('PRIVATE_QUERY'));
});

test('ignores translation, comment, quoted-code and nontransport matches', async () => {
    const body = '/* function redeemKey(id){return fetch("/api/redeem")} */\n'
        + '// function claimKey(id){return client.post("/api/claim")}\n'
        + 'const translation={redeemKey:"Redeem key",redemption:"/api/redemption"};'
        + 'const quoted="function revealKey(id){return fetch(\\"/api/reveal\\")}";'
        + 'function redeemEntitlement(id){return id;}';
    const result = await collect(page(['/assets/translation.js']), async () => response(body));
    assert.deepEqual(result.candidates, []);
});

test('finds minified method definitions and redemption transports with minified function names', async () => {
    const bodies = ['const x={revealKey:function(e){return a.post("/api/keys/reveal",{entitlementId:e})}};',
        'function n(e){return t.request({url:"/api/library/redemption",method:"POST",data:{keySlotId:e}})}'];
    const result = await collect(page(['/assets/one.js', '/assets/two.js']), async () => response(bodies.shift()));
    assert.ok(result.candidates.some(item => item.hint === 'revealKey'));
    assert.ok(result.candidates.some(item => item.fields.includes('keySlotId') && item.paths.includes('/api/library/redemption')));
});

test('finds named domain transports with relative endpoint fragments and a separately defined API base', async () => {
    const bodies = ['const redeemEntitlement=(entitlementId)=>client.post("/entitlements/"+entitlementId+"/redeem",{entitlementId});',
        'const actions={claimKey:function(keySlotId){return api.request({url:"/keys/"+keySlotId+"/claim",method:"POST",data:{keySlotId}})}};',
        'function revealKey(id){return client.post("keys/"+id+"/reveal",{id})}',
        'const translations={redemption:"/entitlements/redemption"};function unrelated(id){return client.post("/entitlements/redemption",{id})}'];
    const result = await collect(page(bodies.map((_, index) => `/assets/${index}.js`)), async () => response(bodies.shift()));
    assert.deepEqual(result.candidates.map(item => item.hint).sort(), ['claimKey', 'redeemEntitlement', 'revealKey']);
    assert.ok(result.candidates.some(item => item.paths.includes('/entitlements/') && item.paths.includes('/redeem')));
    assert.ok(result.candidates.some(item => item.fields.includes('keySlotId')));
    assert.ok(JSON.stringify(result).length <= 14000);
});

test('retains specific domain payload field names without their values', async () => {
    const names = ['keyIntegrationId', 'redemptionGroupId', 'entitlementIds', 'redemptionId', 'platform', 'type'];
    const body = `function redeemEntitlement(e){return api.post("/api/entitlements/redeem",{${names.map(name => `${name}:"PRIVATE_${name}"`).join(',')}})}`;
    const result = await collect(page(['/assets/a.js']), async () => response(body));
    assert.ok(result.candidates.some(item => names.every(name => item.fields.includes(name))));
    assert.ok(!JSON.stringify(result).includes('PRIVATE_'));
});

test('redacts key-shaped strings, credentials, emails and long credential-looking literals', async () => {
    const secrets = ['AAAAA-BBBBB-CCCCC', 'AAAAA-BBBBB-CCCCC-DDDDD-EEEEE', 'MY_PRIVATE_SECRET',
        'person@example.test', 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJwcml2YXRlIn0.signature123456789'];
    const body = `function redeemKey(id){const a="${secrets[0]}",b="${secrets[1]}",token="${secrets[2]}",email="${secrets[3]}",jwt="${secrets[4]}";return fetch("/api/keys/redeem",{method:"POST",body:{entitlementId:id}})}`;
    const result = await collect(page(['/assets/a.js']), async () => response(body));
    assert.equal(result.candidates.length, 1);
    for (const secret of secrets) assert.ok(!JSON.stringify(result).includes(secret), `leaked ${secret}`);
    assert.ok(result.candidates[0].fields.includes('entitlementId'));
});

test('never emits unknown literals, escaped credentials, regex contents, comments, templates or account numbers', async () => {
    const secrets = ['shortSessionValue123', 'Bearer synthetic123', 'AAAAA\\x2dBBBBB\\x2dCCCCC',
        'person\\u0040example.test', 'synthetic-private-token', 'PRIVATE_COMMENT', 'PRIVATE_TEMPLATE', '76561198000000000'];
    const bodies = [`function redeemKey(id){const t="${secrets[0]}";return fetch("/api/redeem",{headers:{Authorization:t},body:id})}`,
        `function redeemKey(id){return fetch("/api/redeem",{headers:new Headers([["Authorization","${secrets[1]}"]]),body:id})}`,
        `function redeemKey(id){const k="${secrets[2]}",e="${secrets[3]}";return fetch("/api/redeem",{body:id})}`,
        `function redeemKey(id){const r=/"/;const t="${secrets[4]}";const s=/"/;return fetch("/api/redeem",{body:t})}`,
        `function redeemKey(id){/* ${secrets[5]} */const s=\`${secrets[6]}\`,accountId=${secrets[7]};return fetch("/api/redeem",{body:id})}`];
    const result = await collect(page(bodies.map((_, index) => `/assets/${index}.js`)), async () => response(bodies.shift()));
    const output = JSON.stringify(result);
    for (const secret of secrets) assert.ok(!output.includes(secret), `leaked ${secret}`);
    assert.ok(result.candidates.length > 0);
    assert.ok(result.candidates.every(item => !('source' in item)));
});

test('rejects key-shaped asset paths and anonymizes arbitrary static path segments', async () => {
    const sources = ['/assets/AAAAA-BBBBB-CCCCC.js', '/assets/AAAAA%2dBBBBB%2dCCCCC.js', '/assets/shortSessionValue123.js'];
    let requests = 0;
    const result = await collect(page(sources), async () => { requests++; return response(); });
    assert.equal(requests, 1);
    assert.deepEqual(result.assetPaths, ['/assets/[asset-1].js']);
    assert.ok(!JSON.stringify(result).includes('shortSessionValue123'));
});

test('collects only bounded pagination contract hints adjacent to native routing code', async () => {
    const body = 'const supportedPageSizes=[20,50,100];function changeSize(pageSize){const searchParams=new URLSearchParams();searchParams.set("pageSize",String(pageSize));router.push("PRIVATE_ROUTE"+searchParams)}'
        + 'function changePage(perPage){const searchParams=new URLSearchParams();searchParams.set("perPage",String(perPage));router.replace("PRIVATE_ROUTE"+searchParams)}'
        + 'function apply(itemsPerPage){router.push({query:{itemsPerPage}})}';
    const result = await collect(page(['/assets/pagination.js']), async () => response(body));
    const pagination = result.candidates.filter(item => item.hint === 'pagination');
    assert.ok(pagination.length > 0 && pagination.length <= 3);
    assert.ok(pagination.some(item => item.parameters.includes('pageSize') && item.routing.includes('searchParams')));
    assert.ok(pagination.some(item => item.parameters.includes('supportedPageSizes') && item.declaredSizes.join(',') === '20,50,100'));
    assert.ok(!JSON.stringify(result).includes('PRIVATE_ROUTE'));
    const decoy = await collect(page(['/assets/translations.js']), async () => response('const text={pageSize:"pageSize",perPage:"router searchParams",itemsPerPage:"supportedPageSizes [20,50,100]"}'));
    assert.deepEqual(decoy.candidates, []);
});

test('rejects HTML, JSON, non-JavaScript types, invalid final URLs and failed requests before source output', async () => {
    const results = [response('<html>PRIVATE_LOGIN</html>', {headers: {'content-type': 'text/html'}}),
        response('{"private":"PRIVATE_JSON"}', {headers: {'content-type': 'application/json'}}),
        response(transport, {headers: {'content-type': 'text/plain'}}), response('<!doctype html><html>PRIVATE_LOGIN</html>'),
        response('{"redeemKey":"PRIVATE_JSON"}'), response(transport), response(transport), new Error('PRIVATE_NETWORK')];
    Object.defineProperty(results[5], 'url', {value: 'https://www.humblebundle.com/login'});
    Object.defineProperty(results[6], 'url', {value: 'https://other.test/assets/a.js'});
    const result = await collect(page(results.map((_, index) => `/assets/${index}.js`)), async () => {
        const value = results.shift();
        if (value instanceof Error) throw value;
        return value;
    });
    assert.deepEqual(result.candidates, []);
    assert.ok(!JSON.stringify(result).includes('PRIVATE_'));
});

test('bounds requests to twenty and concurrency to two', async () => {
    let active = 0, maxActive = 0, calls = 0;
    const result = await collect(page(Array.from({length: 30}, (_, index) => `/assets/${index}.js`)), async () => {
        calls++; active++; maxActive = Math.max(maxActive, active);
        await new Promise(resolve => setImmediate(resolve));
        active--;
        return response();
    });
    assert.equal(calls, 20);
    assert.equal(maxActive, 2);
    assert.equal(result.assetPaths.length, 20);
    assert.ok(result.candidates.length <= 10);
    assert.ok(result.candidates.every(item => !('source' in item)));
    assert.ok(JSON.stringify(result).length <= 14000);
});

test('rejects per-asset body limits and stops reading after the total byte budget', async () => {
    let cancelled = 0, pulls = 0;
    const body = () => new ReadableStream({
        pull(controller) { pulls++; controller.enqueue(new Uint8Array(1024 * 1024).fill(32)); },
        cancel() { cancelled++; },
    });
    const result = await collect(page(Array.from({length: 10}, (_, index) => `/assets/${index}.js`)), async () => response(body()));
    assert.deepEqual(result.candidates, []);
    assert.ok(cancelled >= 2);
    assert.ok(pulls <= 14, `read ${pulls} chunks`);
    let read = false;
    const oversized = response(transport, {headers: {'content-type': 'text/javascript', 'content-length': String(4 * 1024 * 1024 + 1)}});
    Object.defineProperty(oversized, 'body', {value: {cancel: async () => {}, getReader() { read = true; throw new Error('must not read'); }}});
    await collect(page(['/assets/large.js']), async () => oversized);
    assert.equal(read, false);
});

test('cancels rejected responses without reading their content', async () => {
    let cancelled = 0, read = false;
    const rejected = response('PRIVATE_HTML', {headers: {'content-type': 'text/html'}});
    Object.defineProperty(rejected, 'body', {value: {cancel: async () => { cancelled++; }, getReader() { read = true; throw new Error('must not read'); }}});
    await collect(page(['/assets/a.js']), async () => rejected);
    assert.equal(cancelled, 1);
    assert.equal(read, false);
});

test('keeps dense contract skeleton reports within the output budget', async () => {
    const secret = 'CLIPPING_PRIVATE_SECRET';
    const body = `const accessToken="${secret}";function redeemKey(entitlementId){${' '.repeat(400)}return client.post("/api/redemption",{entitlementId});${' '.repeat(400)}}`;
    const sources = Array.from({length: 20}, (_, index) => `/assets/${'a'.repeat(235)}${index}.js`);
    const result = await collect(page(sources), async () => response(body));
    assert.ok(result.candidates.length > 0);
    assert.ok(result.candidates.every(item => !('source' in item)));
    assert.ok(!JSON.stringify(result).includes(secret));
    assert.ok(!JSON.stringify(result).includes('PRIVATE_SECRET'));
    assert.ok(JSON.stringify(result).length <= 14000);
});

test('never reads inline script text, page state, account data, cookies, storage or handlers', async () => {
    const document = page([null, '/assets/a.js']);
    for (const name of ['cookie', 'body', 'querySelectorAll', 'querySelector']) Object.defineProperty(document, name, {get() { throw new Error(`read ${name}`); }});
    for (const script of document.scripts) Object.defineProperty(script, 'textContent', {get() { throw new Error('read inline'); }});
    const result = await collect(document, async () => response(transport));
    assert.equal(result.candidates.length, 1);
    assert.deepEqual(await collect(page([null, '/unknown/a.js']), () => { throw new Error('request attempted'); }), {
        assetPaths: [], reason: 'no verified static asset URLs',
    });
});

test('console entry point performs only the bounded scan and logs one compact report', async () => {
    const logs = [];
    const context = {document: page(['/assets/a.js']), location, URL, TextDecoder, console: {log: value => logs.push(value)},
        fetch: async () => response(transport)};
    for (const name of ['localStorage', 'sessionStorage', '__NEXT_DATA__', 'eval', 'Function']) Object.defineProperty(context, name, {get() { throw new Error(`read ${name}`); }});
    vm.runInNewContext(fs.readFileSync(probePath, 'utf8'), context);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(logs.length, 1);
    assert.equal(JSON.parse(logs[0]).candidates.length, 1);
});
