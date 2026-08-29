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

function loadApi({
    setTimeoutImpl = setTimeout,
    clearTimeoutImpl = clearTimeout,
    gmRequestImpl = () => {},
    consoleImpl = {log() {}, warn() {}, error() {}},
} = {}) {
    const mutationObservers = [];
    const document = {
        body: makeElement('body'),
        head: makeElement('head'),
        documentElement: makeElement('html'),
        elements: new Map(),
        downloadDisclaimers: [],
        createElement: makeElement,
        addEventListener() {},
        getElementById(id) { return this.elements.get(id) || null; },
        querySelector(selector) { return selector === '.choice-modal' ? this.choiceModal : null; },
        querySelectorAll(selector) {
            return selector === '.disclaimer' ? this.downloadDisclaimers : [];
        },
        choiceModal: null,
    };
    const context = {
        __HB_HELPER_TEST__: true,
        console: consoleImpl,
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
        GM_xmlhttpRequest: gmRequestImpl,
        MutationObserver: class {
            constructor(callback) {
                this.callback = callback;
                mutationObservers.push(this);
            }
            observe(target, options) {
                this.target = target;
                this.options = options;
            }
            trigger(mutations) { this.callback(mutations); }
        },
        setTimeout: setTimeoutImpl,
        clearTimeout: clearTimeoutImpl,
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
    return {api: context.__HB_HELPER_TEST_API__, document, context, mutationObservers};
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
    const title = makeElement('h2');
    title.className = 'title';
    if (typeof machineName === 'string') title.dataset.machineName = machineName;
    modal.appendChild(title);
    rows.forEach(({row}) => modal.appendChild(row));
    modal.querySelector = selector => {
        if (selector === 'h2.title[data-machine-name]') {
            return title.dataset.machineName ? title : null;
        }
        if (selector === '[data-machine-name]') return modal.unrelatedMachineName || title;
        return null;
    };
    modal.querySelectorAll = selector => {
        if (selector === '.js-key-redeemer > .key-redeemer') return rows.map(({row}) => row);
        return modal.children.flatMap(child => [child, ...child.querySelectorAll('.hb-helper-region-restrictions')])
            .filter(child => child.className.split(/\s+/).includes('hb-helper-region-restrictions'));
    };
    return modal;
}

function setActiveChoiceModal(document, modal) {
    const siteModal = makeElement();
    siteModal.textContent = 'Choice details';
    siteModal.getClientRects = () => [{}];
    siteModal.querySelector = selector => selector === '.choice-modal' ? modal : null;
    document.elements.set('site-modal', siteModal);
}

function makeMutationNode(isHelperUi = false) {
    return {
        nodeType: 1,
        closest(selector) {
            return isHelperUi && selector.includes('.hb-helper-region-restrictions') ? this : null;
        },
    };
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
    setActiveChoiceModal(document, document.choiceModal);
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
    assert.doesNotMatch(panelText(rows[0].giftField.nextElementSibling), /Humble blocklist/);
    assert.equal(hasClass(rows[1].giftField.nextElementSibling, 'hb-helper-region-restrictions'), true);
    assert.match(panelText(rows[1].giftField.nextElementSibling), /restricted/);
});

test('falls back to monthly data and an exact hash identifier when the Choice title is missing', () => {
    const {api, document, context} = loadApi();
    const rows = [makeRow()];
    document.choiceModal = makeChoiceModal(undefined, rows);
    setActiveChoiceModal(document, document.choiceModal);
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

test('falls back to an exact hash identifier when the present Choice title is unmatched', () => {
    const {api, document, context} = loadApi();
    const rows = [makeRow()];
    document.choiceModal = makeChoiceModal('display-not-in-catalog', rows);
    setActiveChoiceModal(document, document.choiceModal);
    context.location.hash = '#/membership/choices/choice-beta';
    const source = makeElement('script');
    source.textContent = choicePayload({
        'choice-beta': {
            display_item_machine_name: 'display-beta',
            tpkds: [{exclusive_countries: ['US'], disallowed_countries: []}],
        },
    });
    document.elements.set('webpack-subscriber-hub-data', source);

    api.ensureChoiceRegionRestrictionsForTest();

    assert.equal(hasClass(rows[0].giftField.nextElementSibling, 'hb-helper-region-restrictions'), true);
});

test('cleans stale Choice panels when source identity, row count, fields, or anchors are unreliable', () => {
    const {api, document} = loadApi();
    const rows = [makeRow()];
    document.choiceModal = makeChoiceModal('display-missing', rows);
    setActiveChoiceModal(document, document.choiceModal);
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

test('restores Downloads panels for late, partial, and replaced disclaimer rows', () => {
    const scheduled = [];
    let request;
    const {api, document, context, mutationObservers} = loadApi({
        setTimeoutImpl(callback) {
            scheduled.push(callback);
            return scheduled.length;
        },
        clearTimeoutImpl() {},
        gmRequestImpl(options) { request = options; },
    });
    context.location.href = 'https://www.humblebundle.com/downloads?key=TESTORDER123';
    api.getRegionLockInfoForTest();
    request.onload({
        status: 200,
        responseText: JSON.stringify({
            tpkd_dict: {
                all_tpks: [
                    {exclusive_countries: ['US'], disallowed_countries: []},
                    {exclusive_countries: [], disallowed_countries: ['CA']},
                ],
            },
        }),
    });

    assert.equal(mutationObservers.length, 1);
    assert.equal(scheduled.length, 0);
    const observer = mutationObservers[0];
    observer.trigger([{
        target: document.body,
        addedNodes: [makeMutationNode(true)],
        removedNodes: [],
    }]);
    assert.equal(scheduled.length, 0, 'helper-only mutations must not schedule a repaint');

    const first = makeElement();
    document.downloadDisclaimers = [first];
    observer.trigger([{target: document.body, addedNodes: [first], removedNodes: []}]);
    scheduled.shift()();
    assert.equal(first.querySelectorAll('.hb-helper-region-restrictions').length, 1);

    const second = makeElement();
    document.downloadDisclaimers = [first, second];
    observer.trigger([{target: document.body, addedNodes: [second], removedNodes: []}]);
    scheduled.shift()();
    assert.equal(first.querySelectorAll('.hb-helper-region-restrictions').length, 1);
    assert.equal(second.querySelectorAll('.hb-helper-region-restrictions').length, 1);

    const replacements = [makeElement(), makeElement()];
    document.downloadDisclaimers = replacements;
    observer.trigger([{
        target: document.body,
        addedNodes: replacements,
        removedNodes: [first, second],
    }]);
    scheduled.shift()();
    replacements.forEach(disclaimer => {
        assert.equal(disclaimer.querySelectorAll('.hb-helper-region-restrictions').length, 1);
    });

    observer.trigger([{target: document.body, addedNodes: [makeMutationNode(false)], removedNodes: []}]);
    scheduled.shift()();
    replacements.forEach(disclaimer => {
        assert.equal(disclaimer.querySelectorAll('.hb-helper-region-restrictions').length, 1);
    });
});

test('does not log Downloads order keys or API response bodies', () => {
    const messages = [];
    let request;
    const {api, context} = loadApi({
        gmRequestImpl(options) { request = options; },
        consoleImpl: {
            log(...values) { messages.push(values.join(' ')); },
            warn(...values) { messages.push(values.join(' ')); },
            error(...values) { messages.push(values.join(' ')); },
        },
    });
    context.location.href = 'https://www.humblebundle.com/downloads?key=SECRETORDER123';
    api.getRegionLockInfoForTest();
    assert.ok(request);
    assert.match(request.url, /SECRETORDER123/);
    assert.doesNotMatch(messages.join('\n'), /SECRETORDER123/);

    request.onload({status: 503, responseText: 'SECRET_RESPONSE_BODY'});
    assert.doesNotMatch(messages.join('\n'), /SECRET_RESPONSE_BODY/);
});

test('renders only inside the active visible site modal, not a stale Choice modal', () => {
    const {api, document} = loadApi();
    const staleRows = [makeRow()];
    const activeRows = [makeRow()];
    const staleModal = makeChoiceModal('display-stale', staleRows);
    const stalePanel = makeElement();
    stalePanel.className = 'hb-helper-region-restrictions';
    staleRows[0].row.appendChild(stalePanel);
    const activeModal = makeChoiceModal('display-active', activeRows);
    document.choiceModal = staleModal;
    setActiveChoiceModal(document, activeModal);
    const source = makeElement('script');
    source.textContent = choicePayload({
        active: {
            display_item_machine_name: 'display-active',
            tpkds: [{exclusive_countries: ['US'], disallowed_countries: []}],
        },
    });
    document.elements.set('webpack-subscriber-hub-data', source);

    api.ensureChoiceRegionRestrictionsForTest();

    assert.equal(hasClass(activeRows[0].giftField.nextElementSibling, 'hb-helper-region-restrictions'), true);
    assert.equal(staleRows[0].row.children.includes(stalePanel), true);
});

test('does not use unrelated data-machine-name attributes outside the Choice title', () => {
    const {api, document} = loadApi();
    const rows = [makeRow()];
    const modal = makeChoiceModal('display-missing', rows);
    const unrelated = makeElement();
    unrelated.dataset.machineName = 'display-alpha';
    modal.unrelatedMachineName = unrelated;
    modal.appendChild(unrelated);
    document.choiceModal = modal;
    setActiveChoiceModal(document, modal);
    const source = makeElement('script');
    source.textContent = choicePayload({
        alpha: {
            display_item_machine_name: 'display-alpha',
            tpkds: [{exclusive_countries: ['US'], disallowed_countries: []}],
        },
    });
    document.elements.set('webpack-subscriber-hub-data', source);

    api.ensureChoiceRegionRestrictionsForTest();

    assert.equal(modal.querySelectorAll('.hb-helper-region-restrictions').length, 0);
});

test('falls through a subscriber catalog miss to monthly data using the final hash path segment', () => {
    const {api, document, context} = loadApi();
    const rows = [makeRow()];
    document.choiceModal = makeChoiceModal(undefined, rows);
    setActiveChoiceModal(document, document.choiceModal);
    context.location.hash = '#/membership/choices/choice-beta';
    const subscriber = makeElement('script');
    subscriber.textContent = choicePayload({
        other: {
            display_item_machine_name: 'display-other',
            tpkds: [{exclusive_countries: ['US'], disallowed_countries: []}],
        },
    });
    const monthly = makeElement('script');
    monthly.textContent = choicePayload({
        'choice-beta': {
            display_item_machine_name: 'display-beta',
            tpkds: [{exclusive_countries: ['US'], disallowed_countries: []}],
        },
    });
    document.elements.set('webpack-subscriber-hub-data', subscriber);
    document.elements.set('webpack-monthly-product-data', monthly);

    api.ensureChoiceRegionRestrictionsForTest();

    assert.equal(hasClass(rows[0].giftField.nextElementSibling, 'hb-helper-region-restrictions'), true);
});

test('fails closed for invalid Choice metadata and skips only invalid Downloads metadata', () => {
    const {api, document} = loadApi();
    const rows = [makeRow(), makeRow()];
    document.choiceModal = makeChoiceModal('display-alpha', rows);
    setActiveChoiceModal(document, document.choiceModal);
    const source = makeElement('script');
    source.textContent = choicePayload({
        alpha: {
            display_item_machine_name: 'display-alpha',
            tpkds: [
                {exclusive_countries: ['US'], disallowed_countries: []},
                {exclusive_countries: ['US', 5], disallowed_countries: []},
            ],
        },
    });
    document.elements.set('webpack-subscriber-hub-data', source);
    api.ensureChoiceRegionRestrictionsForTest();
    assert.equal(document.choiceModal.querySelectorAll('.hb-helper-region-restrictions').length, 0);

    const invalidDisclaimer = makeElement();
    const validDisclaimer = makeElement();
    api.renderDownloadRegionRestrictionsForTest([
        {exclusive_countries: ['US', 5], disallowed_countries: []},
        {exclusive_countries: ['US'], disallowed_countries: []},
    ], [invalidDisclaimer, validDisclaimer], 'US');
    assert.equal(invalidDisclaimer.children.length, 0);
    assert.equal(hasClass(validDisclaimer.children[0], 'hb-helper-region-restrictions'), true);
});

test('does not match a Choice title machine name against a game-data entry key', () => {
    const {api, document} = loadApi();
    const rows = [makeRow()];
    document.choiceModal = makeChoiceModal('choice-alpha', rows);
    setActiveChoiceModal(document, document.choiceModal);
    const source = makeElement('script');
    source.textContent = choicePayload({
        'choice-alpha': {
            display_item_machine_name: 'display-alpha',
            tpkds: [{exclusive_countries: ['US'], disallowed_countries: []}],
        },
    });
    document.elements.set('webpack-subscriber-hub-data', source);

    api.ensureChoiceRegionRestrictionsForTest();

    assert.equal(document.choiceModal.querySelectorAll('.hb-helper-region-restrictions').length, 0);
});

test('does not match a Choice hash identifier against a display machine name', () => {
    const {api, document, context} = loadApi();
    const rows = [makeRow()];
    document.choiceModal = makeChoiceModal('display-missing', rows);
    setActiveChoiceModal(document, document.choiceModal);
    context.location.hash = '#/membership/choices/display-alpha';
    const source = makeElement('script');
    source.textContent = choicePayload({
        'choice-beta': {
            display_item_machine_name: 'display-alpha',
            tpkds: [{exclusive_countries: ['US'], disallowed_countries: []}],
        },
    });
    document.elements.set('webpack-subscriber-hub-data', source);

    api.ensureChoiceRegionRestrictionsForTest();

    assert.equal(document.choiceModal.querySelectorAll('.hb-helper-region-restrictions').length, 0);
});

test('ignores helper-only row mutations but refreshes mixed Humble mutations', () => {
    const {api} = loadApi();
    assert.ok(api.isHelperUiMutation, 'region mutation test API is missing');
    const humbleRow = makeMutationNode(false);
    const helperPanel = makeMutationNode(true);
    const humbleNode = makeMutationNode(false);

    assert.equal(api.isHelperUiMutation({
        target: humbleRow,
        addedNodes: [helperPanel],
        removedNodes: [],
    }), true);
    assert.equal(api.isHelperUiMutation({
        target: humbleRow,
        addedNodes: [],
        removedNodes: [helperPanel],
    }), true);
    assert.equal(api.isHelperUiMutation({
        target: helperPanel,
        addedNodes: [humbleNode],
        removedNodes: [],
    }), true);
    assert.equal(api.isHelperUiMutation({
        target: humbleRow,
        addedNodes: [helperPanel, humbleNode],
        removedNodes: [],
    }), false);
});

test('clears stale panels when TPKD and Choice row counts differ', () => {
    const {api, document} = loadApi();
    const rows = [makeRow()];
    document.choiceModal = makeChoiceModal('display-alpha', rows);
    setActiveChoiceModal(document, document.choiceModal);
    const stale = makeElement();
    stale.className = 'hb-helper-region-restrictions';
    rows[0].row.appendChild(stale);
    const source = makeElement('script');
    source.textContent = choicePayload({
        alpha: {
            display_item_machine_name: 'display-alpha',
            tpkds: [
                {exclusive_countries: ['US'], disallowed_countries: []},
                {exclusive_countries: ['CA'], disallowed_countries: []},
            ],
        },
    });
    document.elements.set('webpack-subscriber-hub-data', source);

    api.ensureChoiceRegionRestrictionsForTest();

    assert.equal(document.choiceModal.querySelectorAll('.hb-helper-region-restrictions').length, 0);
});

test('clears stale panels when a Choice row has no Gift field', () => {
    const {api, document} = loadApi();
    const {row} = makeRow();
    row.querySelector = () => null;
    const stale = makeElement();
    stale.className = 'hb-helper-region-restrictions';
    row.appendChild(stale);
    document.choiceModal = makeChoiceModal('display-alpha', [{row}]);
    setActiveChoiceModal(document, document.choiceModal);
    const source = makeElement('script');
    source.textContent = choicePayload({
        alpha: {
            display_item_machine_name: 'display-alpha',
            tpkds: [{exclusive_countries: ['US'], disallowed_countries: []}],
        },
    });
    document.elements.set('webpack-subscriber-hub-data', source);

    api.ensureChoiceRegionRestrictionsForTest();

    assert.equal(document.choiceModal.querySelectorAll('.hb-helper-region-restrictions').length, 0);
});

test('fails closed for ambiguous display machine names and does not fall through to hash', () => {
    const {api, document, context} = loadApi();
    const rows = [makeRow()];
    document.choiceModal = makeChoiceModal('display-alpha', rows);
    setActiveChoiceModal(document, document.choiceModal);
    context.location.hash = '#/membership/choices/choice-fallback';
    const source = makeElement('script');
    source.textContent = choicePayload({
        alpha: {
            display_item_machine_name: 'display-alpha',
            tpkds: [{exclusive_countries: ['US'], disallowed_countries: []}],
        },
        beta: {
            display_item_machine_name: 'display-alpha',
            tpkds: [{exclusive_countries: ['CA'], disallowed_countries: []}],
        },
        'choice-fallback': {
            display_item_machine_name: 'display-fallback',
            tpkds: [{exclusive_countries: ['US'], disallowed_countries: []}],
        },
    });
    document.elements.set('webpack-subscriber-hub-data', source);

    api.ensureChoiceRegionRestrictionsForTest();

    assert.equal(document.choiceModal.querySelectorAll('.hb-helper-region-restrictions').length, 0);
});

test('fails closed for conflicting cross-source identity data but accepts identical duplicates', () => {
    const conflicting = loadApi();
    const conflictRows = [makeRow()];
    conflicting.document.choiceModal = makeChoiceModal('display-alpha', conflictRows);
    setActiveChoiceModal(conflicting.document, conflicting.document.choiceModal);
    const subscriber = makeElement('script');
    const monthly = makeElement('script');
    subscriber.textContent = choicePayload({
        alpha: {
            display_item_machine_name: 'display-alpha',
            tpkds: [{exclusive_countries: ['US'], disallowed_countries: []}],
        },
    });
    monthly.textContent = choicePayload({
        alpha: {
            display_item_machine_name: 'display-alpha',
            tpkds: [{exclusive_countries: ['CA'], disallowed_countries: []}],
        },
    });
    conflicting.document.elements.set('webpack-subscriber-hub-data', subscriber);
    conflicting.document.elements.set('webpack-monthly-product-data', monthly);
    conflicting.api.ensureChoiceRegionRestrictionsForTest();
    assert.equal(conflicting.document.choiceModal.querySelectorAll('.hb-helper-region-restrictions').length, 0);

    const identical = loadApi();
    const identicalRows = [makeRow()];
    identical.document.choiceModal = makeChoiceModal('display-alpha', identicalRows);
    setActiveChoiceModal(identical.document, identical.document.choiceModal);
    const identicalSubscriber = makeElement('script');
    const identicalMonthly = makeElement('script');
    const data = {
        display_item_machine_name: 'display-alpha',
        tpkds: [{exclusive_countries: ['US'], disallowed_countries: []}],
    };
    identicalSubscriber.textContent = choicePayload({alpha: data});
    identicalMonthly.textContent = choicePayload({alpha: data});
    identical.document.elements.set('webpack-subscriber-hub-data', identicalSubscriber);
    identical.document.elements.set('webpack-monthly-product-data', identicalMonthly);
    identical.api.ensureChoiceRegionRestrictionsForTest();
    assert.equal(hasClass(identicalRows[0].giftField.nextElementSibling, 'hb-helper-region-restrictions'), true);
});
