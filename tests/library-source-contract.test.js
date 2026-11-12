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

test('includes compiled Library route chunks while rejecting private routes outside that static shape', async () => {
    const allowed = [
        '/_next/static/chunks/app/home/library/page-abc12345.js',
        '/_next/static/chunks/app/home/library/content/%5BcontentId%5D/page-def67890.js',
        '/_next/static/chunks/app/home/library/[id]/layout-abcdef12.js',
    ];
    const denied = [
        '/home/library/page-abc12345.js', '/assets/home/library/page-abc12345.js',
        '/_next/static/chunks/app/user/settings/page-abc12345.js',
        '/_next/static/chunks/app/home/library/user/page-abc12345.js',
        '/_next/static/chunks/app/home/library/page-abc12345.js?token=PRIVATE_QUERY',
    ];
    const requests = [];
    const result = await collect(page([...allowed, ...denied]), async url => {
        requests.push(new URL(url).pathname);
        return response();
    });
    assert.deepEqual(requests.sort(), allowed.slice().sort());
    assert.equal(result.stats.eligible, allowed.length);
    assert.equal(result.stats.inspected, allowed.length);
    assert.ok(!JSON.stringify(result).includes('contentId%5D'));
    assert.ok(result.assetPaths.every(value => /^\/_next\/static\/\[asset-\d+\]\.js$/.test(value)));
});

test('rejects encoded credential query names before issuing any static request', async () => {
    const requests = [];
    const result = await collect(page([
        '/assets/a.js?%74oken=PRIVATE_QUERY',
        '/_next/static/chunks/app/home/library/page-abc12345.js?%73ession=PRIVATE_QUERY',
        '/assets/a.js?%61uth=PRIVATE_QUERY',
    ]), async url => { requests.push(url); return response(); });
    assert.equal(requests.length, 0);
    assert.equal(result.stats.eligible, 0);
    assert.equal(result.stats.attempted, 0);
    assert.ok(!JSON.stringify(result).includes('PRIVATE_QUERY'));
});

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
    assert.deepEqual(result.assetPaths, ['/_next/static/[asset-1].mjs', '/assets/[asset-2].js']);
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
    assert.deepEqual(result.candidates.filter(item => item.hint !== 'redemption-transport').map(item => item.hint).sort(), ['claimKey', 'redeemEntitlement', 'revealKey']);
    assert.ok(result.candidates.some(item => item.hint === 'redemption-transport' && item.paths.includes('/entitlements/redemption')));
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
    const empty = await collect(page([null, '/unknown/a.js']), () => { throw new Error('request attempted'); });
    assert.deepEqual(empty.assetPaths, []);
    assert.equal(empty.reason, 'no verified static asset URLs');
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

test('reports anonymous scan coverage and distinguishes rejection from an inspected empty asset', async () => {
    const bodies = [response('const plain=1;'), response('PRIVATE_HTML', {headers: {'content-type': 'text/html'}}),
        response(transport, {status: 403}), response('<html>PRIVATE_LOGIN</html>'), response('{"private":"PRIVATE_JSON"}'),
        new Error('PRIVATE_FETCH')];
    const result = await collect(page(bodies.map((_, index) => `/assets/${index}.js`)), async () => {
        const value = bodies.shift();
        if (value instanceof Error) throw value;
        return value;
    });
    assert.equal(result.schemaVersion, 2);
    assert.deepEqual(result.stats, {eligible: 6, selected: 6, attempted: 6, inspected: 1, omitted: 0, byteBudgetReached: false});
    assert.deepEqual(result.assetStates.map(item => item.state), ['inspected', 'mime-rejected', 'http-rejected', 'html-rejected', 'json-rejected', 'request-failed']);
    assert.ok(result.assetStates.every((item, index) => item.assetPath === result.assetPaths[index]));
    assert.ok(!JSON.stringify(result).includes('PRIVATE_'));
});

test('prioritizes the last twenty eligible assets and reports omitted inventory', async () => {
    const requests = [];
    const result = await collect(page(Array.from({length: 21}, (_, index) => `/assets/${index}.js`)), async url => {
        requests.push(url);
        return response(url.endsWith('/20.js') ? transport : 'const plain=1;');
    });
    assert.equal(requests.length, 20);
    assert.ok(!requests.some(url => url.endsWith('/0.js')));
    assert.ok(requests.some(url => url.endsWith('/20.js')));
    assert.ok(requests[0].endsWith('/20.js'));
    assert.equal(result.candidates.length, 1);
    assert.deepEqual(result.stats, {eligible: 21, selected: 20, attempted: 20, inspected: 20, omitted: 1, byteBudgetReached: false});
});

test('allows valid array or block JavaScript prefixes while rejecting actual JSON', async () => {
    const bodies = ['[globalThis].forEach(()=>{' + transport + '});', '{' + transport + '}',
        '[{"redeemKey":"PRIVATE_JSON"}]'];
    const result = await collect(page(bodies.map((_, index) => `/assets/${index}.js`)), async () => response(bodies.shift()));
    assert.equal(result.candidates.length, 2);
    assert.deepEqual(result.assetStates.map(item => item.state), ['inspected', 'inspected', 'json-rejected']);
});

test('counts fixed server-action framework signals without emitting action identities or claiming a redemption contract', async () => {
    const source = 'const n=(0,t.createServerReference)("PRIVATE_ACTION_ID",u.callServer,void 0,u.findSourceMapURL,"redeemKey");'
        + 'const m=t["createServerReference"]("PRIVATE_OTHER_ID",u["callServer"]);';
    const result = await collect(page(['/assets/actions.js']), async () => response(source));
    assert.deepEqual(result.frameworkSignals, {createServerReference: 2, callServer: 2});
    assert.deepEqual(result.candidates, []);
    assert.ok(!JSON.stringify(result).includes('PRIVATE_'));
});

test('reports empty inventory, URL rejection, missing readers, read failures and byte-budget truncation safely', async () => {
    const empty = await collect(page(['/outside.js']), () => { throw new Error('must not request'); });
    assert.equal(empty.schemaVersion, 2);
    assert.deepEqual(empty.stats, {eligible: 0, selected: 0, attempted: 0, inspected: 0, omitted: 0, byteBudgetReached: false});
    const redirect = response();
    Object.defineProperty(redirect, 'url', {value: 'https://www.humblebundle.com/login'});
    const noReader = response();
    Object.defineProperty(noReader, 'body', {value: null});
    const unreadable = response(new ReadableStream({pull(controller) { controller.error(new Error('PRIVATE_READ')); }}));
    const oversized = response(transport, {headers: {'content-type': 'application/javascript', 'content-length': String(4 * 1024 * 1024 + 1)}});
    const values = [redirect, noReader, unreadable, oversized];
    const report = await collect(page(values.map((_, index) => `/assets/${index}.js`)), async () => values.shift());
    assert.deepEqual(report.assetStates.map(item => item.state), ['url-rejected', 'read-unavailable', 'read-failed', 'asset-limit']);
    const large = () => new ReadableStream({pull(controller) { controller.enqueue(new Uint8Array(1024 * 1024).fill(32)); }});
    const truncated = await collect(page(Array.from({length: 5}, (_, index) => `/assets/${index}.js`)), async () => response(large()));
    assert.equal(truncated.stats.byteBudgetReached, true);
    assert.ok(truncated.assetStates.some(item => item.state === 'byte-budget'));
    assert.ok(truncated.assetStates.some(item => item.state === 'budget-skipped'));
    assert.ok(!truncated.assetStates.some(item => item.state === 'read-failed'));
    assert.ok(!JSON.stringify(report).includes('PRIVATE_'));
});

test('finds minified relative redemption transports and template static path fragments only', async () => {
    const bodies = [
        'function n(e){return t.post("/entitlements/"+e+"/redeem",{entitlementId:e})}',
        'function n(e){return fetch(`/api/keys/${PRIVATE_DYNAMIC_TOKEN}/redeem`,{method:"POST",body:JSON.stringify({entitlementId:e})})}',
        'function n(e){return fetch(`/api/PRIVATE_STATIC/${e}/claim`,{method:"POST"})}',
    ];
    const result = await collect(page(bodies.map((_, index) => `/assets/${index}.js`)), async () => response(bodies.shift()));
    assert.ok(result.candidates.some(item => item.paths.includes('/entitlements/') && item.paths.includes('/redeem')));
    assert.ok(result.candidates.some(item => item.paths.includes('/api/keys/') && item.paths.includes('/redeem')));
    assert.ok(!JSON.stringify(result).includes('PRIVATE_'));
});

test('recognizes snake-case and quoted page-size parameters beside minified routing code', async () => {
    const bodies = ['const per_page=20;function p(){router.push({query:{per_page}})}',
        'function n(e){const t=new URLSearchParams;t.set("pageSize",String(e));r.push("?"+t)}',
        'function n(e){const t=new URLSearchParams;t.set("page_size",String(e));r.replace("?"+t)}'];
    const result = await collect(page(bodies.map((_, index) => `/assets/${index}.js`)), async () => response(bodies.shift()));
    const parameters = result.candidates.filter(item => item.hint === 'pagination').flatMap(item => item.parameters);
    assert.ok(['per_page', 'pageSize', 'page_size'].every(name => parameters.includes(name)));
});

test('reports a byte budget exhausted before another fetch returns as budget truncation', async () => {
    let release;
    let cancellations = 0;
    const delayed = new Promise(resolve => { release = resolve; });
    const unlimited = () => new ReadableStream({pull(controller) { controller.enqueue(new Uint8Array(1024 * 1024).fill(32)); }, cancel() { if (++cancellations === 2) release(); }});
    let calls = 0;
    const result = await collect(page(['/assets/0.js', '/assets/1.js', '/assets/2.js']), async () => {
        if (calls++ === 0) { await delayed; return response('const plain=1;'); }
        return response(unlimited());
    });
    assert.equal(result.stats.byteBudgetReached, true);
    assert.ok(!result.assetStates.some(item => item.state === 'read-failed'));
});
