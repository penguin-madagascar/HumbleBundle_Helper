const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const {parseHTML} = require('linkedom');

const probePath = path.join(__dirname, '..', 'tools', 'library-contract-probe.js');
const bundleId = '11111111-1111-4111-8111-111111111111';
const contentId = '22222222-2222-4222-8222-222222222222';
const page = (html, route = `/home/library/${bundleId}`) => ({
    document: parseHTML(`<html><body><main>${html}</main></body></html>`).document,
    location: new URL(route, 'https://www.humblebundle.com'),
});
const collect = fixture => require(probePath).collectLibraryContractProbe(fixture.document, fixture.location, fixture.performance);
const attach = (node, props, parent = null) => {
    const fiber = {tag: 0, memoizedProps: props, return: parent};
    Object.defineProperty(node, '__reactFiber$fixture', {value: fiber});
    return fiber;
};
const rowHTML = '<div class="flex flex-col border-0"><div aria-label="Steam"></div><button>Reveal key</button></div>';

test('reports observed row entitlement semantics and alias relationships without private values', () => {
    const fixture = page(rowHTML);
    const record = {id: 'PRIVATE_ENTITLEMENT', contentId, type: 'steam', expired: false, preOrdered: true,
        outOfStock: false, redeemable: true, notGiftable: false, redemptionData: {keyFormatted: 'AAAAA-BBBBB-CCCCC'},
        giftStatus: 'unclaimed', directRedeem: {token: 'PRIVATE_REDEEM_TOKEN'}, customDisclaimer: 'PRIVATE_DISCLAIMER'};
    const aggregate = {tag: 0, memoizedProps: {item: {id: bundleId, entitlements: {keys: [record]}}}, return: null};
    attach(fixture.document.querySelector('.border-0'), {entitlement: record}, aggregate);
    const result = collect(fixture);
    assert.deepEqual(result.route, {kind: 'bundle'});
    const sample = result.samples.find(item => item.source === 'props.entitlement');
    const aggregateSample = result.samples.find(item => item.source === 'props.item.entitlements.keys');
    assert.deepEqual(sample.nativePlatforms, ['Steam']);
    assert.equal(sample.entitlement.type, 'steam');
    assert.deepEqual(sample.entitlement.flags, {expired: false, preOrdered: true, outOfStock: false, redeemable: true, notGiftable: false});
    assert.equal(sample.entitlement.revealedKeyPresent, true);
    assert.equal(sample.entitlement.giftStatus, 'unclaimed');
    assert.equal(sample.entitlement.directRedeemType, 'object');
    assert.equal(sample.entitlement.customDisclaimerPresent, true);
    assert.equal(aggregateSample.keysCount, 1);
    assert.equal(sample.shape.id, aggregateSample.shape.id);
    assert.equal(aggregateSample.shape.itemId, aggregateSample.shape.currentRouteId);
    for (const secret of ['PRIVATE_', 'AAAAA-BBBBB-CCCCC', bundleId, contentId]) assert.ok(!JSON.stringify(result).includes(secret));
});

test('redacts unknown enums and accepts only boolean flags and a complete formatted Steam key', () => {
    const fixture = page(rowHTML, `/home/library/content/${contentId}`);
    attach(fixture.document.querySelector('button'), {entitlement: {type: 'AlicePrivate', giftStatus: 'PRIVATE_SESSION',
        expired: 'false', redeemable: 1, keyFormatted: 'AAAAA-BBBBB-CCCCC',
        redemptionData: {keyFormatted: 'prefix AAAAA-BBBBB-CCCCC suffix'},
        key: 'AAAAA-BBBBB-CCCCC', directRedeem: 'PRIVATE_TOKEN', customDisclaimer: ''}});
    const result = collect(fixture);
    assert.deepEqual(result.route, {kind: 'content'});
    assert.equal(result.samples[0].entitlement.type, '[redacted]');
    assert.equal(result.samples[0].entitlement.giftStatus, '[redacted]');
    assert.deepEqual(result.samples[0].entitlement.flags, {});
    assert.equal(result.samples[0].entitlement.revealedKeyPresent, false);
    assert.equal(result.samples[0].entitlement.directRedeemType, 'string');
    assert.equal(result.samples[0].entitlement.customDisclaimerPresent, false);
    for (const secret of ['PRIVATE_', 'AlicePrivate', 'AAAAA-BBBBB-CCCCC']) assert.ok(!JSON.stringify(result).includes(secret));
});

test('captures nearest native pager capabilities and form input names without values', () => {
    const fixture = page(`${rowHTML}<nav aria-label="pagination"><button>Next</button></nav>
        <form><input name="pageSize" value="PRIVATE_VALUE"><input name="sessionToken" value="PRIVATE_TOKEN"></form>`,
        '/home/library?page=2&pageSize=25&token=PRIVATE_QUERY');
    attach(fixture.document.querySelector('.border-0'), {entitlement: {type: 'gog'}});
    attach(fixture.document.querySelector('nav button'), {pageSize: 25, currentPage: 2,
        pageInfo: {totalPages: 7, totalCount: 175, sessionToken: 'PRIVATE_TOKEN'},
        supportedSizes: [10, 25, 50], compact: true, selectionMode: 'PRIVATE_MODE',
        onPageChange: function selectPage() { throw Error('callback invoked'); },
        onPageSizeChange: function selectSize() { throw Error('callback invoked'); },
        _privateState: 'PRIVATE_STATE', sessionToken: 'PRIVATE_TOKEN'});
    const result = collect(fixture);
    assert.deepEqual(result.paging.queryKeys, ['page', 'pageSize', '[other]']);
    assert.deepEqual(result.paging.formInputNames, ['pageSize', '[redacted]']);
    const component = result.paging.ancestors[0];
    assert.ok(component.propNames.includes('onPageSizeChange'));
    assert.ok(component.propNames.includes('selectionMode'));
    assert.ok(!component.propNames.includes('_privateState'));
    assert.ok(!component.propNames.includes('sessionToken'));
    assert.deepEqual(component.functions, [{prop: 'onPageChange', name: 'selectPage'}, {prop: 'onPageSizeChange', name: 'selectSize'}]);
    assert.deepEqual(component.numeric, {pageSize: 25, currentPage: 2, 'pageInfo.totalPages': 7, 'pageInfo.totalCount': 175, supportedSizes: [10, 25, 50]});
    assert.ok(!JSON.stringify(result).includes('PRIVATE_'));
});

test('reports static request descriptor literals without invoking handlers or guessing closure endpoints', () => {
    const fixture = page(`${rowHTML}<div class="flex flex-col border-0"><button>Copy key</button></div>`);
    const buttons = [...fixture.document.querySelectorAll('button')];
    function handleReveal() { return request({url: '/api/library/key/reveal', method: 'POST'}); }
    function handleCopy() { return hiddenClosure(); }
    Object.defineProperty(buttons[0], '__reactProps$fixture', {value: {onClick: handleReveal}});
    Object.defineProperty(buttons[1], '__reactProps$fixture', {value: {onClick: handleCopy}});
    const result = collect(fixture);
    assert.deepEqual(result.buttons[0], {position: {row: 0, button: 0}, label: 'Reveal key', handlerNames: ['handleReveal'],
        requestEvidence: 'static-descriptor', requestLiterals: [{path: '/api/library/key/reveal', method: 'POST'}]});
    assert.equal(result.buttons[1].requestEvidence, 'unknown');
    assert.deepEqual(result.buttons[1].requestLiterals, []);
    assert.ok(!JSON.stringify(result).includes('return request'));
    assert.ok(!JSON.stringify(result).includes('hiddenClosure'));
});

test('never mistakes quoted source, comments, or dynamic templates for a request descriptor', () => {
    const fixture = page(rowHTML.repeat(3));
    const handlers = [function quoted() { return "{url: '/api/counterfeit', method: 'POST'}"; },
        function commented() { /* {url: '/api/counterfeit', method: 'POST'} */ return false; },
        function dynamic() { return request({url: `/api/keys/${privateId}`, method: 'POST'}); }];
    for (const [index, button] of [...fixture.document.querySelectorAll('button')].entries()) {
        Object.defineProperty(button, '__reactProps$fixture', {value: {onClick: handlers[index]}});
    }
    const result = collect(fixture);
    assert.ok(result.buttons.every(button => button.requestEvidence === 'unknown' && button.requestLiterals.length === 0));
    assert.ok(!JSON.stringify(result).includes('counterfeit'));
    assert.ok(!JSON.stringify(result).includes('privateId'));
});

test('keeps existing same-origin API static path words and masks dynamic identifiers and query values', () => {
    const fixture = page(rowHTML);
    fixture.performance = {getEntriesByType(type) {
        assert.equal(type, 'resource');
        return [
            {initiatorType: 'fetch', name: `https://www.humblebundle.com/api/v1/library-entitlements/${contentId}/reveal?page=2&sessionToken=PRIVATE_TOKEN`},
            {initiatorType: 'xmlhttprequest', name: 'https://www.humblebundle.com/api/users/aliceprivate/library'},
            {initiatorType: 'fetch', name: 'https://other.test/api/PRIVATE_PATH'},
            {initiatorType: 'script', name: 'https://www.humblebundle.com/api/PRIVATE_SCRIPT'},
        ];
    }};
    const result = collect(fixture);
    assert.equal(result.resources[0].path, '/api/v1/library-entitlements/[id]/reveal');
    assert.equal(result.resources[1].path, '/api/users/[id]/library');
    assert.deepEqual(result.resources[0].queryKeys, ['page', '[other]']);
    assert.equal(result.resources.length, 2);
    for (const secret of ['PRIVATE_', 'aliceprivate', contentId]) assert.ok(!JSON.stringify(result).includes(secret));
});

test('masks lowercase tokens, key-shaped segments, and member values in timings and source literals', () => {
    const fixture = page(rowHTML);
    fixture.performance = {getEntriesByType() {
        return ['/api/library/redeem/abcdefabcdefabcdefabcdef', '/api/library/keys/abcde-fghij-klmno',
            '/api/members/alicesmith/library', '/api/library/unfamiliar-endpoint'].map(pathname => ({
            initiatorType: 'fetch', name: `https://www.humblebundle.com${pathname}`,
        }));
    }};
    function reveal() { return request({url: '/api/library/redeem/abcdefabcdefabcdefabcdef', method: 'POST'}); }
    Object.defineProperty(fixture.document.querySelector('button'), '__reactProps$fixture', {value: {onClick: reveal}});
    const result = collect(fixture);
    assert.deepEqual(result.resources.map(value => value.path), ['/api/library/redeem/[id]', '/api/library/keys/[id]',
        '/api/members/[id]/library', '/api/library/[id]']);
    assert.equal(result.buttons[0].requestLiterals[0].path, '/api/library/redeem/[id]');
    for (const secret of ['abcdefabcdefabcdefabcdef', 'abcde-fghij-klmno', 'alicesmith', 'unfamiliar-endpoint']) {
        assert.ok(!JSON.stringify(result).includes(secret), `leaked ${secret}`);
    }
});

test('retains handler evidence for unknown native button labels and fixed public phrases', () => {
    const fixture = page('<div class="flex flex-col border-0"><button>Alice secret game</button>' +
        '<button>Reveal your Steam key</button><button>Copy key to clipboard</button><button>复制</button></div>');
    function reveal() { return request({url: '/api/library/reveal', method: 'POST'}); }
    Object.defineProperty(fixture.document.querySelector('button'), '__reactProps$fixture', {value: {onClick: reveal}});
    const result = collect(fixture);
    assert.equal(result.buttons.length, 4);
    assert.deepEqual(result.buttons[0], {position: {row: 0, button: 0}, label: '[redacted]', handlerNames: ['reveal'],
        requestEvidence: 'static-descriptor', requestLiterals: [{path: '/api/library/reveal', method: 'POST'}]});
    assert.deepEqual(result.buttons.slice(1).map(button => button.label), ['Reveal your Steam key', 'Copy key to clipboard', '复制']);
    assert.ok(!JSON.stringify(result).includes('Alice secret game'));
});

test('ignores React accessors, overridden array methods, unrelated props, and cycles', () => {
    const fixture = page(rowHTML);
    const record = {type: 'free'};
    for (const name of ['keyFormatted', 'redemptionData', 'giftStatus', 'expired']) Object.defineProperty(record, name, {get() { throw Error(`read ${name}`); }});
    const keys = [record];
    Object.defineProperty(keys, 'slice', {get() { throw Error('read slice'); }});
    Object.defineProperty(keys, Symbol.iterator, {get() { throw Error('read iterator'); }});
    Object.defineProperty(keys, '1', {get() { throw Error('read array index'); }});
    const props = {item: {entitlements: {keys}}, unrelated: {type: 'PRIVATE_TYPE'}};
    Object.defineProperty(props, 'entitlement', {get() { throw Error('read entitlement'); }});
    const fiber = attach(fixture.document.querySelector('.border-0'), props);
    fiber.return = fiber;
    const result = collect(fixture);
    assert.equal(result.samples.length, 1);
    assert.equal(result.samples[0].entitlement.type, 'free');
    assert.equal(result.samples[0].keysCount, 2);
    assert.ok(!JSON.stringify(result).includes('PRIVATE_'));
});

test('runs as a pasteable read-only console probe without storage, network, handlers, or DOM writes', () => {
    const fixture = page(rowHTML);
    attach(fixture.document.querySelector('.border-0'), {entitlement: {type: 'steam'}});
    const before = fixture.document.documentElement.outerHTML;
    Object.defineProperty(fixture.document, 'cookie', {get() { throw Error('cookie read'); }});
    const output = [];
    const context = {...fixture, URL, URLSearchParams, console: {log(value) { output.push(value); }},
        fetch() { throw Error('fetch'); }, XMLHttpRequest() { throw Error('xhr'); }};
    for (const name of ['localStorage', 'sessionStorage']) Object.defineProperty(context, name, {get() { throw Error(`${name} read`); }});
    vm.runInNewContext(fs.readFileSync(probePath, 'utf8'), context);
    assert.equal(output.length, 1);
    assert.equal(JSON.parse(output[0]).samples[0].entitlement.type, 'steam');
    assert.equal(fixture.document.documentElement.outerHTML, before);
});

test('bounds independent evidence budgets so unrelated data cannot starve row and pager results', () => {
    const fixture = page(`${rowHTML.repeat(150)}<nav aria-label="pagination"><button>Next</button></nav>`);
    const large = Object.fromEntries(Array.from({length: 1000}, (_, index) => [`message${index}`, 'PRIVATE_TRANSLATION']));
    for (const [index, row] of [...fixture.document.querySelectorAll('.border-0')].entries()) {
        attach(row, {translations: large, entitlement: {id: `PRIVATE_${index}`, type: 'steam', redeemable: true}});
    }
    attach(fixture.document.querySelector('nav button'), {pageSize: 25, onPageSizeChange() { throw Error('called'); }});
    const result = collect(fixture);
    assert.ok(result.samples.length > 0 && result.samples.length <= 6);
    assert.ok(result.paging.ancestors.some(component => component.numeric.pageSize === 25));
    assert.ok(JSON.stringify(result).length < 15000);
    assert.ok(!JSON.stringify(result).includes('PRIVATE_'));
});

test('retains late paging capability props and the nearest pager among generic ancestors', () => {
    const fixture = page('<nav aria-label="pagination"><button>Next</button></nav>');
    const unrelated = {tag: 0, memoizedProps: {layoutMode: 'PRIVATE_LAYOUT'}, return: null};
    const wrapper = {tag: 0, memoizedProps: {children: 'PRIVATE_CHILDREN'}, return: unrelated};
    attach(fixture.document.querySelector('nav'), {asChild: true}, wrapper);
    const noise = Object.fromEntries(Array.from({length: 100}, (_, index) => [`message${index}`, 'PRIVATE_MESSAGE']));
    attach(fixture.document.querySelector('button'), {...noise, pageSize: 25, pageInfo: {totalPages: 6},
        onPageSizeChange: function setPageSize() {}}, wrapper);
    const result = collect(fixture);
    assert.equal(result.paging.ancestors[0].numeric.pageSize, 25);
    assert.ok(result.paging.ancestors[0].propNames.includes('onPageSizeChange'));
    assert.equal(result.paging.ancestors[0].numeric['pageInfo.totalPages'], 6);
    assert.ok(!JSON.stringify(result).includes('PRIVATE_'));
});
