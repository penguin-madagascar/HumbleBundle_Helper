const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const {parseHTML} = require('linkedom');

const collectorPath = path.join(__dirname, '..', 'tools', 'library-diagnostics.js');
const bundleId = '11111111-1111-4111-8111-111111111111';
const contentId = '22222222-2222-4222-8222-222222222222';
const title = 'Beyond the Metroidverse Bundle';
const flight = text => `<script>self.__next_f.push(${JSON.stringify([1, text])})</script>`;
const page = (html, route = '/home/library') => ({
    document: parseHTML(`<!doctype html><html><head><title>${title}</title></head><body>${html}</body></html>`).document,
    location: new URL(route, 'https://www.humblebundle.com'),
});
const collect = ({document, location, performance}) => require(collectorPath).collectLibraryDiagnostics(document, location, performance);

test('captures known Library routes, native tabs, cards, and pagination without query values', () => {
    const fixture = page(`<main class="library grid" data-entitlement-id="private-id">
        <h1>${title}</h1><div role="tablist"><button role="tab" aria-selected="true">Purchased</button>
        <button role="tab" aria-selected="false">Bundles</button></div>
        <article data-testid="content-card"><a href="/home/library/${bundleId}?token=private-token">${title}</a>
        <button aria-haspopup="menu">Steam</button></article>
        <a href="/home/library/content/${contentId}">Downloads</a>
        <nav aria-label="Pagination"><button disabled>Previous</button><button aria-current="page">2</button>
        <a href="/home/library?page=3&cursor=private-cursor">Next</a>
        <select aria-label="Items per page"><option>10</option><option selected>25</option></select></nav>
        </main>`, '/home/library?tab=purchased&page=2&token=private-token');
    const result = collect(fixture);
    assert.equal(result.route.kind, 'library');
    assert.deepEqual(result.queryKeys, ['tab', 'page', '[other]']);
    assert.deepEqual(result.tabs.map(tab => [tab.label, tab.selected]), [['Purchased', true], ['Bundles', false]]);
    assert.deepEqual(result.routes.map(route => route.kind), ['bundle', 'content', 'library']);
    assert.equal(result.headings[0].label, title);
    assert.ok(result.mainHTML.includes('<article data-testid="content-card">'));
    assert.ok(result.mainHTML.includes('<button aria-haspopup="menu">Steam</button>'));
    assert.ok(result.dataAttributes.includes('data-entitlement-id'));
    assert.ok(result.pagination.some(control => control.label === 'Previous' && control.disabled));
    assert.ok(result.pagination.some(control => control.options?.some(option => option.label === '25' && option.selected)));
    assert.ok(!JSON.stringify(result).includes('private-'));
    assert.deepEqual(collect(page('<main></main>', `/home/library/${bundleId}`)).route, {
        kind: 'bundle', pathname: `/home/library/${bundleId}`, uuid: bundleId,
    });
    assert.equal(collect(page('<main></main>', `/home/library/content/${contentId}`)).route.kind, 'content');
    assert.equal(collect(page('<main></main>', '/home/library/not-a-uuid')).route.kind, 'unknown');
});

test('never emits revealed keys, tokens, account text, arbitrary attributes, or script values', () => {
    const secrets = ['AAAAA-BBBBB-CCCCC', 'CSRF_SUPER_SECRET', 'person@example.test', 'AlicePrivate', 'SECRETQUERY'];
    const fixture = page(`<main class="AlicePrivate" data-key="AAAAA-BBBBB-CCCCC" data-CSRF_SUPER_SECRET="x">
        <h1>AlicePrivate</h1><p>person@example.test</p><pre>AAAAA-BBBBB-CCCCC</pre>
        <div title="CSRF_SUPER_SECRET" data-testid="AlicePrivate" aria-label="AlicePrivate">CSRF_SUPER_SECRET</div>
        <input value="AAAAA-BBBBB-CCCCC"><textarea>CSRF_SUPER_SECRET</textarea>
        <svg><text>person@example.test</text></svg><iframe srcdoc="AlicePrivate"></iframe>
        <style>/* CSRF_SUPER_SECRET */</style>
        <a href="/home/library/${bundleId}?SECRETQUERY=AAAAA-BBBBB-CCCCC">${title}</a>
        <script type="application/json">${JSON.stringify({
            entitlements: [{contentId, keySlotId: 'AAAAA-BBBBB-CCCCC', selectedProvider: 'steam',
                key: 'AAAAA-BBBBB-CCCCC', token: 'CSRF_SUPER_SECRET', email: 'person@example.test',
                account: 'AlicePrivate', 'person@example.test': {AlicePrivate: 'AAAAA-BBBBB-CCCCC'}}],
        })}</script></main>`, '/home/library?SECRETQUERY=CSRF_SUPER_SECRET');
    const result = collect(fixture);
    const serialized = JSON.stringify(result);
    for (const secret of secrets) assert.ok(!serialized.includes(secret), `leaked ${secret}`);
    for (const tag of ['input', 'textarea', 'script', 'style', 'svg', 'iframe']) {
        assert.ok(!result.mainHTML.includes(`<${tag}`), `included ${tag} subtree`);
    }
    assert.ok(result.fields.some(field => field.path.endsWith('.entitlements[].contentId') && field.type === 'string'));
    assert.ok(result.fields.some(field => field.path.endsWith('.keySlotId') && field.type === 'string'));
    assert.ok(result.fields.some(field => field.path.endsWith('.selectedProvider') && field.label === 'steam'));
});

test('reads only JSON Flight rows and skips UTF-8 text payloads and executable scripts', () => {
    const text = '你好🙂\na:{"counterfeit":{"contentId":"fake"}}\n';
    const row = `1:T${Buffer.byteLength(text).toString(16)},${text}`;
    const records = row + `2:${JSON.stringify({props: {entitlements: [{contentId, selectedDRM: 'steam', pageSize: 25}]}})}\n`;
    const fixture = page(`<main></main>${flight(records.slice(0, 30))}${flight(records.slice(30))}
        <script>throw new Error('must not execute')</script>
        <script>self.__next_f.push([1, (() => { throw Error('must not execute'); })()])</script>
        <script type="application/json">{broken}</script>`);
    const result = collect(fixture);
    assert.equal(result.sources.flightRecords, 1);
    assert.ok(result.fields.some(field => field.path === '$.props.entitlements[].selectedDRM'));
    assert.ok(result.fields.some(field => field.path.endsWith('.pageSize') && field.type === 'number'));
    assert.ok(!JSON.stringify(result).includes('counterfeit'));
    assert.ok(!JSON.stringify(result).includes('fake'));
    assert.equal(result.contract, 'unknown');
});

test('leaves live DOM, storage, cookies, network, and navigation untouched when pasted', () => {
    const fixture = page(`<main><h1>Library</h1><button>Reveal key</button><input value="PRIVATE"></main>
        <script type="application/json">{"contentId":"PRIVATE"}</script>`);
    const before = fixture.document.documentElement.outerHTML;
    for (const name of ['cookie', 'localStorage', 'sessionStorage']) {
        Object.defineProperty(fixture.document, name, {get() { throw Error(`read ${name}`); }});
    }
    const output = [];
    const context = {...fixture, URL, URLSearchParams, TextEncoder, TextDecoder,
        console: {log(value) { output.push(value); }},
        fetch() { throw Error('network'); }, XMLHttpRequest() { throw Error('network'); },
        history: new Proxy({}, {get() { throw Error('navigation'); }}),
    };
    for (const name of ['localStorage', 'sessionStorage']) {
        Object.defineProperty(context, name, {get() { throw Error(`read ${name}`); }});
    }
    vm.runInNewContext(fs.readFileSync(collectorPath, 'utf8'), context);
    assert.equal(output.length, 1);
    assert.equal(JSON.parse(output[0]).route.kind, 'library');
    assert.equal(fixture.document.documentElement.outerHTML, before);
    assert.equal(fixture.location.href, 'https://www.humblebundle.com/home/library');
});

test('bounds structural output and metadata traversal while preserving unfamiliar shapes as unknown', () => {
    const fixture = page(`<main>${'<section data-content-id="PRIVATE"><span>PRIVATE</span></section>'.repeat(2000)}</main>
        <script type="application/json">${JSON.stringify({mystery: {entitlements: Array.from({length: 200}, (_, id) => ({id, contentId}))}})}</script>`);
    const result = collect(fixture);
    assert.ok(result.mainHTML.length <= 20000);
    assert.ok(result.fields.length <= 100);
    assert.equal(result.contract, 'unknown');
    assert.ok(result.fields.some(field => field.path.includes('[other]')));
    assert.ok(!JSON.stringify(result).includes('PRIVATE'));
});

test('redacts custom element names and handles malformed links and current select state', () => {
    const fixture = page(`<main><alice-private role="tab">Purchased</alice-private>
        <nav aria-label="Pagination"><a href="http://[">Next</a>
        <select aria-label="Page size"><option selected>10</option><option>50</option></select></nav>
        <script type="application/json">{"selected_drm":"steam","key_slot_id":"PRIVATE"}</script></main>`);
    const options = [...fixture.document.querySelectorAll('option')];
    Object.defineProperty(options[0], 'selected', {value: false});
    Object.defineProperty(options[1], 'selected', {value: true});
    const result = collect(fixture);
    assert.equal(result.tabs[0].tag, 'div');
    assert.ok(!JSON.stringify(result).includes('alice-private'));
    assert.ok(result.pagination.some(control => control.options?.some(option => option.label === '50' && option.selected)));
    assert.ok(result.fields.some(field => field.path === '$.selected_drm' && field.label === 'steam'));
    assert.ok(result.fields.some(field => field.path === '$.key_slot_id' && field.type === 'string'));
});

test('preserves Chinese Library labels and known native product-card hosts', () => {
    const result = collect(page(`<main><h1>您的游戏库</h1><button role="tab" aria-selected="true">已购买</button>
        <button role="tab">捆绑包</button><article data-testid="product-card"><div data-testid="product-card-footer">
        <span data-testid="product-card-title">${title}</span><button>显示密钥</button></div></article></main>`));
    assert.equal(result.headings[0].label, '您的游戏库');
    assert.deepEqual(result.tabs.map(tab => tab.label), ['已购买', '捆绑包']);
    assert.ok(result.mainHTML.includes('data-testid="product-card-footer"'));
    assert.ok(result.mainHTML.includes('<button>显示密钥</button>'));
});

test('prioritizes entitlement and paging metadata after large localization records', () => {
    const translations = Object.fromEntries(Array.from({length: 180}, (_, id) => [`message${id}`, `PRIVATE translation ${id}`]));
    const metadata = {subscriptionProducts: [{subscriptionEntitlement: {contentId, entitlement_id: 'PRIVATE',
        keySlots: [{key_type: 'steam', selectedDeliveryMethod: 'steam', redemptionState: 'available'}]}}],
        purchasedProducts: [], bundleItems: [], pageInfo: {pageSize: 25, totalPages: 10}};
    const result = collect(page(`<main></main>${flight(`1:${JSON.stringify({translations})}\n2:${JSON.stringify(metadata)}\n`)}`));
    for (const suffix of ['.subscriptionEntitlement.contentId', '.entitlement_id', '.keySlots[].key_type',
        '.selectedDeliveryMethod', '.redemptionState', '.pageInfo.pageSize']) {
        assert.ok(result.fields.some(field => field.path.endsWith(suffix)), `missing ${suffix}`);
    }
    assert.ok(!JSON.stringify(result).includes('PRIVATE'));
    assert.equal(result.contract, 'unknown');
});

test('bounds data attribute names outside the main HTML budget', () => {
    const longName = `data-${Array(10000).fill('key').join('-')}`;
    const result = collect(page(`<main ${longName}="PRIVATE"></main>`));
    assert.ok(result.dataAttributes.every(name => name.length <= 85));
    assert.ok(JSON.stringify(result).length < 25000);
});

test('recognizes lowercase pagination labels from the actual native pager', () => {
    const result = collect(page('<main><nav aria-label="pagination"><a href="/home/library">First</a><a href="/home/library">Next</a></nav></main>'));
    assert.equal(result.pagination.length, 2);
});

test('reports existing API resource paths without request, query, account, or token values', () => {
    const fixture = page('<main></main>');
    fixture.performance = {getEntriesByType(type) {
        assert.equal(type, 'resource');
        return [
            {name: `https://www.humblebundle.com/api/v2/user/library/entitlements/${contentId}?page=2&token=PRIVATE_TOKEN`, initiatorType: 'fetch'},
            {name: 'https://www.humblebundle.com/bff/library/purchased-products/AlicePrivate?limit=25&operationName=PRIVATE_OPERATION', initiatorType: 'xmlhttprequest'},
            {name: 'https://www.humblebundle.com/_next/static/chunks/PRIVATE_HASH.js', initiatorType: 'script'},
            {name: 'https://ads.example.test/person@example.test?key=PRIVATE_KEY', initiatorType: 'fetch'},
        ];
    }};
    const result = collect(fixture);
    assert.equal(result.client.resources.length, 2);
    assert.ok(result.client.resources[0].path.startsWith('/api/v2/user/library/entitlements/'));
    assert.ok(result.client.resources[1].path.startsWith('/bff/library/purchased-products/'));
    assert.deepEqual(result.client.resources[0].queryKeys, ['page', '[other]']);
    assert.deepEqual(result.client.resources[1].queryKeys, ['limit', 'operationName']);
    assert.ok(!result.client.resources[0].path.includes(contentId));
    for (const secret of ['PRIVATE', 'AlicePrivate', 'person@example.test']) assert.ok(!JSON.stringify(result).includes(secret));
});

test('discovers component memoizedProps schemas with per-anchor provenance and consistent opaque ID aliases', () => {
    const fixture = page(`<main><div class="flex flex-col border-0"><a href="/home/library/content/${contentId}">Downloads</a></div>
        <a href="/home/library/content/${contentId}">Downloads</a>
        <nav aria-label="pagination"><a href="/home/library">Next</a></nav></main>`);
    const anchors = [...fixture.document.querySelectorAll('a')];
    const shared = {tag: 0, memoizedProps: {pageInfo: {page: 2, pageSize: 25, total: 123, supportedSizes: [10, 25, 50]},
        onPageChange() { throw Error('handler invoked'); }}, return: null};
    for (const [index, anchor] of anchors.entries()) {
        const component = {tag: 0, memoizedProps: {product: {contentId, entitlementId: `PRIVATE_ENTITLEMENT_${index}`,
            keySlots: [{keySlotId: 'PRIVATE_SLOT', selectedProvider: 'steam', status: 'available', key: 'AAAAA-BBBBB-CCCCC'}]},
            children: {$$typeof: Symbol.for('react.element'), props: {email: 'person@example.test'}}}, return: shared};
        Object.defineProperty(component.memoizedProps, 'auth', {enumerable: true, get() { throw Error('auth getter invoked'); }});
        Object.defineProperty(anchor, '__reactFiber$PRIVATE_RANDOM', {value: {tag: 5, memoizedProps: {onClick() { throw Error('clicked'); }}, return: component}});
    }
    const result = collect(fixture);
    const targets = result.client.targets.filter(target => target.kind === 'content-link');
    assert.deepEqual(targets.map(target => target.index), [0, 1]);
    assert.ok(targets.every(target => target.ancestry.some(ancestor => ancestor.component !== undefined)));
    const fields = result.client.components.flatMap(component => component.fields);
    const ids = fields.filter(field => field.path.endsWith('.contentId'));
    assert.ok(ids.length >= 2);
    assert.equal(ids[0].alias, ids[1].alias);
    assert.ok(ids.every(field => field.matchesRouteUUID));
    assert.ok(fields.some(field => field.path.endsWith('.selectedProvider') && field.label === 'steam'));
    assert.ok(fields.some(field => field.path.endsWith('.pageSize') && field.value === 25));
    assert.ok(fields.some(field => field.path.endsWith('.supportedSizes[]') && field.value === 50));
    assert.ok(fields.some(field => field.path.endsWith('.onPageChange') && field.type === 'function'));
    for (const secret of ['PRIVATE_', 'AAAAA-BBBBB-CCCCC', 'person@example.test']) assert.ok(!JSON.stringify(result).includes(secret));
    assert.equal(result.contract, 'unknown');
});

test('never invokes prop-array getters, iterators, accessors, handlers, or auth subtrees', () => {
    const fixture = page(`<main><a href="/home/library/content/${contentId}">Downloads</a></main>`);
    const slots = [];
    Object.defineProperty(slots, '0', {get() { throw Error('array index getter'); }});
    slots[1] = {keySlotId: 'PRIVATE_SLOT'};
    Object.defineProperty(slots, 'slice', {get() { throw Error('array slice getter'); }});
    Object.defineProperty(slots, Symbol.iterator, {get() { throw Error('array iterator getter'); }});
    const props = {keySlots: slots, private_key: {id: 'PRIVATE_AUTH'}, sessionId: 'PRIVATE_SESSION'};
    props.data = props;
    const fiber = {tag: 0, memoizedProps: props};
    fiber.return = fiber;
    Object.defineProperty(fixture.document.querySelector('a'), '__reactFiber$PRIVATE', {value: fiber});
    const result = collect(fixture);
    const fields = result.client.components.flatMap(component => component.fields);
    assert.ok(fields.some(field => field.path === '$.keySlots[].keySlotId' && field.alias));
    assert.ok(!fields.some(field => field.path.endsWith('.id')));
    assert.ok(!JSON.stringify(result).includes('PRIVATE'));
    assert.equal(result.client.targets[0].ancestry.length, 1);
});

test('bounds client schemas and retains paging evidence among many card components', () => {
    const fixture = page(`<main>${Array.from({length: 100}, () => `<a href="/home/library/content/${contentId}">Downloads</a>`).join('')}</main>`);
    const pager = {tag: 0, memoizedProps: {pageInfo: {pageSize: 25, total: 100}}, return: null};
    for (const [index, anchor] of [...fixture.document.querySelectorAll('a')].entries()) {
        Object.defineProperty(anchor, '__reactFiber$PRIVATE', {value: {tag: 0, memoizedProps: {products: Array.from({length: 15}, (_, item) => ({contentId, entitlementId: `PRIVATE_${index}_${item}`, keySlotId: `PRIVATE_SLOT_${item}`}))}, return: pager}});
    }
    const result = collect(fixture);
    assert.ok(result.client.targets.length <= 40);
    assert.ok(result.client.components.length <= 80);
    assert.ok(result.client.components.reduce((sum, component) => sum + component.fields.length, 0) <= 160);
    assert.ok(result.client.components.flatMap(component => component.fields).some(field => field.path.endsWith('.pageSize') && field.value === 25));
});

test('reserves component discovery for the pager before twenty independent card ancestry chains', () => {
    const fixture = page(`<main>${Array.from({length: 20}, () => `<a href="/home/library/content/${contentId}">Downloads</a>`).join('')}
        <nav aria-label="pagination"><a href="/home/library">Next</a></nav></main>`);
    const anchors = [...fixture.document.querySelectorAll('a')];
    for (const anchor of anchors.slice(0, 20)) {
        let fiber = null;
        for (let depth = 0; depth < 4; depth++) fiber = {tag: 0, memoizedProps: {contentId}, return: fiber};
        Object.defineProperty(anchor, '__reactFiber$PRIVATE', {value: fiber});
    }
    Object.defineProperty(anchors[20], '__reactFiber$PRIVATE', {value: {tag: 0, memoizedProps: {pageInfo: {pageSize: 25, totalPages: 4}}, return: null}});
    const result = collect(fixture);
    const pager = result.client.targets.find(target => target.kind === 'pagination');
    assert.ok(pager.ancestry.some(ancestor => ancestor.component !== undefined));
    assert.ok(result.client.components.flatMap(component => component.fields).some(field => field.path.endsWith('.pageSize') && field.value === 25));
    assert.ok(result.client.components.length <= 80);
});

test('prioritizes paging fields over product arrays within the same component prop budget', () => {
    const fixture = page(`<main><a href="/home/library/content/${contentId}">Downloads</a></main>`);
    const props = {products: Array.from({length: 12}, (_, index) => ({contentId, entitlementId: `PRIVATE_${index}`, keySlotId: `PRIVATE_SLOT_${index}`, id: index})),
        pageInfo: {pageSize: 25, totalPages: 4}};
    Object.defineProperty(fixture.document.querySelector('a'), '__reactFiber$PRIVATE', {value: {tag: 0, memoizedProps: props, return: null}});
    const fields = collect(fixture).client.components.flatMap(component => component.fields);
    assert.ok(fields.some(field => field.path === '$.pageInfo.pageSize' && field.value === 25));
    assert.ok(fields.some(field => field.path === '$.pageInfo.totalPages' && field.value === 4));
    assert.ok(fields.length <= 40);
});

test('reports primitive field names inside the observed row and aggregate entitlement objects', () => {
    for (const pathname of ['/home/library', `/home/library/${bundleId}`, `/home/library/content/${contentId}`]) {
        const fixture = page(`<main><div class="flex flex-col border-0"><a href="/home/library/content/${contentId}">Downloads</a></div></main>`, pathname);
        const record = {id: contentId, title, type: 'PRIVATE_TYPE', key: 'AAAAA-BBBBB-CCCCC', keyType: 'steam',
            revealedKeyValue: 'PRIVATE_REVEALED', redemptionToken: 'PRIVATE_TOKEN', isClaimed: true, canRedeem: false,
            deliveryKind: 'PRIVATE_DELIVERY', claimDescriptor: {claimState: 'PRIVATE_STATE'}};
        const aggregate = {tag: 0, memoizedProps: {payload: {id: bundleId, title, entitlements: {keys: [record]}}}, return: null};
        const row = {tag: 0, memoizedProps: {entitlement: record, AlicePrivate: 'PRIVATE_ACCOUNT'}, return: aggregate};
        Object.defineProperty(fixture.document.querySelector('a'), '__reactFiber$PRIVATE', {value: row});
        const result = collect(fixture);
        const fields = result.client.components.flatMap(component => component.fields);
        for (const suffix of ['.type', '.key', '.revealedKeyValue', '.redemptionToken', '.isClaimed', '.canRedeem', '.deliveryKind', '.claimDescriptor.claimState']) {
            assert.ok(fields.some(field => field.path === `$.entitlement${suffix}`), `row missing ${suffix}`);
            assert.ok(fields.some(field => field.path.endsWith(`.entitlements.keys[]${suffix}`)), `aggregate missing ${suffix}`);
        }
        const ids = fields.filter(field => field.path === '$.entitlement.id' || field.path.endsWith('.entitlements.keys[].id'));
        assert.equal(ids[0].alias, ids[1].alias);
        assert.ok(ids.every(field => field.matchesRouteUUID));
        assert.ok(fields.some(field => field.path === '$.entitlement.redemptionToken' && field.type === 'string' && !field.alias));
        for (const secret of ['PRIVATE_', 'AAAAA-BBBBB-CCCCC', 'AlicePrivate']) assert.ok(!JSON.stringify(result).includes(secret));
    }
});

test('masks dynamic domain dictionary names and leaves sensitive subtrees type-only', () => {
    const fixture = page(`<main><a href="/home/library/content/${contentId}">Downloads</a></main>`);
    const record = {id: contentId, keyMap: {AlicePrivate: {id: 'PRIVATE_ID'}, [bundleId]: {key: 'PRIVATE_KEY'}},
        metadata: {'AAAAA-BBBBB-CCCCC': 'PRIVATE_KEY', 'person@example.test': 'PRIVATE_EMAIL'},
        extraMetadata: {aliceprivate: {id: 'PRIVATE_DYNAMIC_ACCOUNT'}},
        account: {id: 'PRIVATE_ACCOUNT', name: 'AlicePrivate'}, sessionId: 'PRIVATE_SESSION', privateKey: 'PRIVATE_KEY'};
    Object.defineProperty(record, 'claimable', {enumerable: true, get() { throw Error('domain getter invoked'); }});
    Object.defineProperty(fixture.document.querySelector('a'), '__reactFiber$PRIVATE', {value: {tag: 0, memoizedProps: {entitlement: record}, return: null}});
    const result = collect(fixture);
    const fields = result.client.components.flatMap(component => component.fields);
    assert.ok(fields.some(field => field.path === '$.entitlement.account' && field.type === 'object'));
    assert.ok(!fields.some(field => field.path.startsWith('$.entitlement.account.')));
    assert.ok(!fields.some(field => field.path === '$.entitlement.sessionId' && field.alias));
    assert.ok(fields.some(field => field.path.includes('[entry]')));
    for (const secret of ['PRIVATE_', 'AAAAA-BBBBB-CCCCC', 'person@example.test', 'AlicePrivate', 'aliceprivate', bundleId]) assert.ok(!JSON.stringify(result).includes(secret));
});

test('reports missing primitive paging names only within known paging containers', () => {
    const fixture = page('<main><nav aria-label="pagination"><a href="/home/library">Next</a></nav></main>');
    const props = {pageInfo: {pageSize: 25, endReached: false, pageMode: 'PRIVATE_MODE', visiblePages: [1, 2]},
        AlicePrivate: false, outsideUnknown: 'PRIVATE_OUTSIDE'};
    Object.defineProperty(fixture.document.querySelector('a'), '__reactFiber$PRIVATE', {value: {tag: 0, memoizedProps: props, return: null}});
    const result = collect(fixture);
    const fields = result.client.components.flatMap(component => component.fields);
    for (const name of ['endReached', 'pageMode', 'visiblePages']) assert.ok(fields.some(field => field.path === `$.pageInfo.${name}`));
    assert.ok(!JSON.stringify(result).includes('AlicePrivate'));
    assert.ok(!JSON.stringify(result).includes('outsideUnknown'));
    assert.ok(!JSON.stringify(result).includes('PRIVATE'));
});
