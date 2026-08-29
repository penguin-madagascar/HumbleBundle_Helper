const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function makeElement(tagName = 'div') {
    const children = [];
    const attributes = new Map();
    const classNames = new Set();
    const element = {
        tagName: tagName.toUpperCase(),
        children,
        parentNode: null,
        className: '',
        dataset: {},
        textContent: '',
        classList: {
            add(...names) { names.forEach(name => classNames.add(name)); },
            remove(...names) { names.forEach(name => classNames.delete(name)); },
            toggle(name, enabled) {
                if (enabled) classNames.add(name);
                else classNames.delete(name);
            },
            contains(name) { return classNames.has(name); },
        },
        appendChild(child) {
            child.remove?.();
            children.push(child);
            child.parentNode = this;
            return child;
        },
        append(...items) { items.forEach(item => this.appendChild(item)); },
        insertAdjacentElement(position, child) {
            const parent = this.parentNode;
            if (!parent) return child;
            child.remove?.();
            const index = parent.children.indexOf(this);
            parent.children.splice(position === 'beforebegin' ? index : index + 1, 0, child);
            child.parentNode = parent;
            return child;
        },
        remove() {
            const parent = this.parentNode;
            if (!parent) return;
            const index = parent.children.indexOf(this);
            if (index >= 0) parent.children.splice(index, 1);
            this.parentNode = null;
        },
        setAttribute(name, value) { attributes.set(name, String(value)); },
        getAttribute(name) { return attributes.get(name) || null; },
        querySelector(selector) { return this.querySelectorAll(selector)[0] || null; },
        querySelectorAll(selector) {
            const descendants = root => root.children.flatMap(child => [child, ...descendants(child)]);
            return descendants(this).filter(child =>
                selector === '.hb-helper-region-restrictions'
                    ? child.className.split(/\s+/).includes('hb-helper-region-restrictions')
                    : child.tagName.toLowerCase() === selector
            );
        },
    };
    Object.defineProperty(element, 'nextElementSibling', {
        get() {
            const siblings = this.parentNode?.children || [];
            return siblings[siblings.indexOf(this) + 1] || null;
        },
    });
    return element;
}

function loadApi() {
    const document = {
        body: makeElement('body'),
        head: makeElement('head'),
        documentElement: makeElement('html'),
        elements: new Map(),
        createElement: makeElement,
        addEventListener() {},
        getElementById(id) { return this.elements.get(id) || null; },
        querySelector(selector) { return selector === '.choice-modal' ? this.choiceModal : null; },
        querySelectorAll() { return []; },
        choiceModal: null,
    };
    const context = {
        __HB_HELPER_TEST__: true,
        console: {log() {}, warn() {}, error() {}},
        document,
        navigator: {language: 'en', languages: ['en']},
        location: {
            hostname: 'www.humblebundle.com',
            pathname: '/membership',
            href: 'https://www.humblebundle.com/membership',
            hash: '',
        },
        DOMParser: class { parseFromString() { return {querySelector() { return null; }}; } },
        GM_getValue(_name, fallback) { return fallback; },
        GM_setValue() {},
        GM_deleteValue() {},
        GM_addValueChangeListener() {},
        GM_setClipboard() {},
        GM_registerMenuCommand() {},
        GM_xmlhttpRequest() {},
        setTimeout,
        clearTimeout,
        setInterval,
        clearInterval,
        URLSearchParams,
        Map,
        Set,
        Promise,
        Date,
        Math,
        JSON,
        Array,
        Object,
        String,
        Number,
        Boolean,
        RegExp,
        Error,
    };
    context.globalThis = context;
    vm.runInNewContext(
        fs.readFileSync(path.join(__dirname, '..', 'HB_Helper.user.js'), 'utf8'),
        context,
        {filename: 'HB_Helper.user.js'}
    );
    return {api: context.__HB_HELPER_TEST_API__, document, context};
}

function plain(value) {
    return JSON.parse(JSON.stringify(value));
}

function panelText(panel) {
    const visit = element => [element.textContent, ...element.children.flatMap(visit)];
    return visit(panel).filter(Boolean).join(' ');
}

function hasClass(element, className) {
    return element.className.split(/\s+/).includes(className);
}

function makeRow() {
    const row = makeElement();
    const giftField = makeElement();
    giftField.className = 'giftfield';
    row.appendChild(giftField);
    row.querySelector = selector => selector === '.giftfield' ? giftField : null;
    return {row, giftField};
}

function makeChoiceModal(machineName, rows) {
    const modal = makeElement();
    const title = makeElement();
    title.dataset.machineName = machineName;
    modal.appendChild(title);
    rows.forEach(({row}) => modal.appendChild(row));
    modal.querySelector = selector => selector === '[data-machine-name]' ? title : null;
    modal.querySelectorAll = selector => {
        if (selector === '.js-key-redeemer > .key-redeemer') return rows.map(({row}) => row);
        return modal.children.flatMap(child => [child, ...child.querySelectorAll('.hb-helper-region-restrictions')])
            .filter(child => child.className.split(/\s+/).includes('hb-helper-region-restrictions'));
    };
    return modal;
}

function choicePayload(gameData) {
    return JSON.stringify({contentChoiceOptions: {contentChoiceData: {game_data: gameData}}});
}

test('normalizes trusted metadata and gives personalized Humble-metadata verdicts', () => {
    const {api} = loadApi();
    assert.ok(api.normalizeRegionRestrictions, 'region restriction test API is missing');

    const restrictions = api.normalizeRegionRestrictions({
        exclusive_countries: ['us', 'ca'],
        disallowed_countries: ['mx'],
    });
    assert.deepEqual(plain(restrictions), {
        status: 'restricted-metadata',
        exclusiveCountries: ['US', 'CA'],
        disallowedCountries: ['MX'],
    });
    assert.equal(api.getRegionRestrictionVerdict(restrictions, 'US').status, 'allowed');
    assert.equal(api.getRegionRestrictionVerdict(restrictions, 'MX').status, 'restricted');
    assert.equal(api.getRegionRestrictionVerdict(restrictions, null).status, 'unknown-country');
});

test('keeps empty, partial, and malformed country metadata distinct', () => {
    const {api} = loadApi();
    assert.equal(
        api.normalizeRegionRestrictions({exclusive_countries: [], disallowed_countries: []}).status,
        'unmarked'
    );
    assert.equal(api.normalizeRegionRestrictions({exclusive_countries: []}).status, 'unavailable');
    assert.equal(api.normalizeRegionRestrictions({disallowed_countries: ['us']}).status, 'restricted-metadata');
    assert.equal(api.normalizeRegionRestrictions({exclusive_countries: ['US', 8]}).status, 'unavailable');
    assert.equal(api.normalizeRegionRestrictions({exclusive_countries: ['US'], disallowed_countries: 'CA'}).status, 'unavailable');
    assert.equal(api.normalizeRegionRestrictions({disallowed_countries: 'US'}).status, 'unavailable');
});

test('renders inline and details country lists at the 12/13 item boundary without global claims', () => {
    const {api} = loadApi();
    const countries = Array.from({length: 13}, (_, index) =>
        String.fromCharCode(65 + Math.floor(index / 26)) + String.fromCharCode(65 + (index % 26))
    );
    const inline = api.createRegionRestrictionPanel(
        {exclusive_countries: countries.slice(0, 12), disallowed_countries: []},
        'US'
    );
    const details = api.createRegionRestrictionPanel(
        {exclusive_countries: countries, disallowed_countries: []},
        null
    );
    const noRestriction = api.createRegionRestrictionPanel(
        {exclusive_countries: [], disallowed_countries: []},
        'US'
    );
    assert.equal(inline.querySelector('details'), null);
    assert.ok(details.querySelector('details'));
    assert.match(panelText(details), /Steam region is unavailable/);
    assert.match(panelText(noRestriction), /Humble has not declared a region restriction/);
});

test('maps Choice rows by exact machine name and TPKD order, immediately after Gift', () => {
    const {api, document} = loadApi();
    const rows = [makeRow(), makeRow()];
    document.choiceModal = makeChoiceModal('display-alpha', rows);
    const source = makeElement('script');
    source.textContent = choicePayload({
        'choice-alpha': {
            display_item_machine_name: 'display-alpha',
            tpkds: [
                {exclusive_countries: ['US'], disallowed_countries: ['US']},
                {exclusive_countries: [], disallowed_countries: ['US']},
            ],
        },
    });
    document.elements.set('webpack-subscriber-hub-data', source);
    api.setSteamDerivedStateForTest({countryCode: 'US', ownedApps: [], wishlistApps: []});
    api.ensureChoiceRegionRestrictionsForTest();

    assert.equal(hasClass(rows[0].giftField.nextElementSibling, 'hb-helper-region-restrictions'), true);
    assert.match(panelText(rows[0].giftField.nextElementSibling), /can be activated/);
    assert.match(panelText(rows[0].giftField.nextElementSibling), /Humble allowlist/);
    assert.match(panelText(rows[0].giftField.nextElementSibling), /Humble blocklist/);
    assert.equal(hasClass(rows[1].giftField.nextElementSibling, 'hb-helper-region-restrictions'), true);
    assert.match(panelText(rows[1].giftField.nextElementSibling), /restricted/);
});

test('falls back to monthly data and an exact hash identifier, then restores replaced Choice panels idempotently', () => {
    const {api, document, context} = loadApi();
    const rows = [makeRow()];
    document.choiceModal = makeChoiceModal('not-a-match', rows);
    context.location.hash = '#choice-beta';
    const source = makeElement('script');
    source.textContent = choicePayload({
        'choice-beta': {
            display_item_machine_name: 'display-beta',
            tpkds: [{exclusive_countries: [], disallowed_countries: ['CA']}],
        },
    });
    document.elements.set('webpack-monthly-product-data', source);
    api.setSteamDerivedStateForTest({countryCode: 'US', ownedApps: [], wishlistApps: []});
    api.ensureChoiceRegionRestrictionsForTest();
    assert.equal(hasClass(rows[0].giftField.nextElementSibling, 'hb-helper-region-restrictions'), true);

    rows[0].giftField.nextElementSibling.remove();
    api.ensureChoiceRegionRestrictionsForTest();
    assert.equal(hasClass(rows[0].giftField.nextElementSibling, 'hb-helper-region-restrictions'), true);
    assert.equal(document.choiceModal.querySelectorAll('.hb-helper-region-restrictions').length, 1);
});

test('cleans stale Choice panels when source identity, row count, fields, or anchors are unreliable', () => {
    const {api, document} = loadApi();
    const rows = [makeRow()];
    document.choiceModal = makeChoiceModal('display-missing', rows);
    const stale = makeElement();
    stale.className = 'hb-helper-region-restrictions';
    rows[0].row.appendChild(stale);
    const source = makeElement('script');
    source.textContent = choicePayload({
        alpha: {display_item_machine_name: 'display-alpha', tpkds: [{exclusive_countries: [], disallowed_countries: []}, {exclusive_countries: [], disallowed_countries: []}]},
    });
    document.elements.set('webpack-subscriber-hub-data', source);
    api.ensureChoiceRegionRestrictionsForTest();
    assert.equal(document.choiceModal.querySelectorAll('.hb-helper-region-restrictions').length, 0);
});

test('reuses the shared panel for Downloads in API order and never falls back to body', () => {
    const {api, document} = loadApi();
    const firstDisclaimer = makeElement();
    const secondDisclaimer = makeElement();
    api.renderDownloadRegionRestrictionsForTest([
        {exclusive_countries: ['US'], disallowed_countries: []},
        {exclusive_countries: [], disallowed_countries: ['CA']},
    ], [firstDisclaimer, secondDisclaimer], 'US');
    assert.equal(hasClass(firstDisclaimer.children[0], 'hb-helper-region-restrictions'), true);
    assert.equal(hasClass(secondDisclaimer.children[0], 'hb-helper-region-restrictions'), true);
    assert.match(panelText(secondDisclaimer.children[0]), /can be activated/);

    api.renderDownloadRegionRestrictionsForTest(
        [{exclusive_countries: ['US'], disallowed_countries: []}],
        [null],
        'US'
    );
    assert.equal(document.body.children.length, 0);
});
