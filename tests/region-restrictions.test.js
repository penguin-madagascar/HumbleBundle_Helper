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
        prepend(...items) {
            items.slice().reverse().forEach(child => {
                child.remove?.();
                children.unshift(child);
                child.parentNode = this;
            });
        },
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
        closest(selector) {
            let current = this;
            while (current) {
                if (selector.startsWith('.')
                    && current.className.split(/\s+/).includes(selector.slice(1))) {
                    return current;
                }
                current = current.parentNode;
            }
            return null;
        },
        querySelectorAll(selector) {
            const descendants = root => root.children.flatMap(child => [child, ...descendants(child)]);
            return descendants(this).filter(child =>
                selector === '.hb-helper-region-restrictions'
                    ? child.className.split(/\s+/).includes('hb-helper-region-restrictions')
                    : selector.startsWith('.')
                        ? selector.slice(1).split('.').every(name =>
                            child.className.split(/\s+/).includes(name)
                        )
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
    fetchImpl = () => Promise.reject(new Error('unexpected fetch')),
    DOMParserImpl,
    consoleImpl = {log() {}, warn() {}, error() {}},
    gmSetValueImpl = () => {},
} = {}) {
    const mutationObservers = [];
    const windowListeners = new Map();
    const document = {
        body: makeElement('body'),
        head: makeElement('head'),
        documentElement: makeElement('html'),
        elements: new Map(),
        scripts: [],
        downloadDisclaimers: [],
        createElement: makeElement,
        addEventListener() {},
        getElementById(id) { return this.elements.get(id) || null; },
        querySelector(selector) { return selector === '.choice-modal' ? this.choiceModal : null; },
        querySelectorAll(selector) {
            if (selector === '.disclaimer') return this.downloadDisclaimers;
            if (selector === '.choice-modal') return this.choiceModals || [];
            if (selector === '.js-select-choice.select-choice') return this.choiceSelects || [];
            if (selector === '.key-redeemer-container') {
                const roots = [
                    this.choiceModal,
                    ...(this.choiceModals || []),
                    ...(this.choiceSelects || []),
                ].filter(Boolean);
                return [...new Set(roots.flatMap(root => root.querySelectorAll?.(selector) || []))];
            }
            if (selector === '.hb-helper-region-restrictions--choice') {
                const roots = [
                    this.body,
                    this.choiceModal,
                    ...(this.choiceModals || []),
                    ...(this.choiceSelects || []),
                ].filter(Boolean);
                return [...new Set(roots.flatMap(root => root.querySelectorAll?.(selector) || []))];
            }
            return [];
        },
        choiceModal: null,
        choiceModals: [],
        choiceSelects: [],
    };
    const context = {
        __HB_HELPER_TEST__: true,
        console: consoleImpl,
        document,
        navigator: {language: 'en', languages: ['en']},
        location: {
            origin: 'https://www.humblebundle.com',
            hostname: 'www.humblebundle.com',
            pathname: '/membership',
            search: '',
            href: 'https://www.humblebundle.com/membership',
            hash: '',
        },
        DOMParser: DOMParserImpl || class {
            parseFromString() { return {querySelector() { return null; }}; }
        },
        fetch: fetchImpl,
        GM_getValue(_name, fallback) { return fallback; },
        GM_setValue: gmSetValueImpl,
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
        URL,
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
    context.window = context;
    context.addEventListener = (type, listener) => {
        const listeners = windowListeners.get(type) || [];
        listeners.push(listener);
        windowListeners.set(type, listeners);
    };
    context.removeEventListener = (type, listener) => {
        windowListeners.set(type, (windowListeners.get(type) || []).filter(item => item !== listener));
    };
    vm.runInNewContext(
        fs.readFileSync(path.join(__dirname, '..', 'HB_Helper.user.js'), 'utf8'),
        context,
        {filename: 'HB_Helper.user.js'}
    );
    return {
        api: context.__HB_HELPER_TEST_API__,
        document,
        context,
        mutationObservers,
        dispatchWindowEvent(type, details = {}) {
            (windowListeners.get(type) || []).forEach(listener => listener({type, ...details}));
        },
    };
}

function plain(value) {
    return JSON.parse(JSON.stringify(value));
}

async function flushMicrotasks() {
    await Promise.resolve();
    await Promise.resolve();
}

function panelText(panel) {
    const visit = element => [element.textContent, ...element.children.flatMap(visit)];
    return visit(panel).filter(Boolean).join(' ');
}

function hasClass(element, className) {
    return element.className.split(/\s+/).includes(className);
}

function choicePanel({container}) {
    return container.children.find(child => hasClass(child, 'hb-helper-region-restrictions')) || null;
}

function makeRow({gift = true, container} = {}) {
    const keyContainer = container || makeElement();
    keyContainer.className = 'key-redeemer-container';
    const row = makeElement();
    row.className = 'key-redeemer';
    const giftField = gift ? makeElement() : null;
    if (giftField) {
        giftField.className = 'giftfield';
        row.appendChild(giftField);
    }
    row.querySelector = selector => selector === '.giftfield' ? giftField : null;
    keyContainer.appendChild(row);
    return {row, giftField, container: keyContainer};
}

function makeChoiceModal(machineName, rows, {displayMachineName} = {}) {
    const modal = makeElement();
    modal.className = 'choice-modal';
    modal.getClientRects = () => [{}];
    const title = makeElement('h2');
    title.className = 'title';
    if (typeof machineName === 'string') title.dataset.machineName = machineName;
    modal.appendChild(title);
    for (const {container} of rows) {
        if (!modal.children.includes(container)) modal.appendChild(container);
    }
    let displayIdentity = null;
    if (displayMachineName) {
        displayIdentity = makeElement();
        displayIdentity.dataset.entityKind = 'display_item';
        displayIdentity.dataset.machineName = displayMachineName;
        modal.appendChild(displayIdentity);
    }
    modal.querySelector = selector => {
        if (selector === 'h2.title[data-machine-name]') {
            return title.dataset.machineName ? title : null;
        }
        if (selector === '[data-entity-kind="display_item"][data-machine-name]') {
            return displayIdentity;
        }
        if (selector === '[data-machine-name]') return modal.unrelatedMachineName || title;
        return null;
    };
    modal.querySelectorAll = selector => {
        if (selector === 'h2.title[data-machine-name]') {
            return title.dataset.machineName ? [title] : [];
        }
        if (selector === '.js-key-redeemer > .key-redeemer') return rows.map(({row}) => row);
        if (selector === '.key-redeemer') return rows.map(({row}) => row);
        if (selector === '.key-redeemer-container') {
            return [...new Set(rows.map(({container}) => container))];
        }
        if (selector === '[data-entity-kind="display_item"][data-machine-name]') {
            return displayIdentity ? [displayIdentity] : [];
        }
        const className = selector === '.hb-helper-region-restrictions--choice'
            ? 'hb-helper-region-restrictions--choice'
            : 'hb-helper-region-restrictions';
        return modal.children.flatMap(child => [child, ...child.querySelectorAll(`.${className}`)])
            .filter(child => child.className.split(/\s+/).includes(className));
    };
    return modal;
}

function makeRedeemedChoiceSurface(machineName, rows, options = {}) {
    const surface = makeChoiceModal(machineName, rows, options);
    surface.className = 'js-select-choice select-choice';
    return surface;
}

function setActiveChoiceModal(document, modal) {
    const siteModal = makeElement();
    siteModal.textContent = 'Choice details';
    siteModal.getClientRects = () => [{}];
    siteModal.querySelector = selector => selector === '.choice-modal' ? modal : null;
    siteModal.querySelectorAll = selector => selector === '.choice-modal' ? [modal] : [];
    siteModal.appendChild(modal);
    document.elements.set('site-modal', siteModal);
    document.choiceModals = [modal];
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

function longCountryList(offset = 0) {
    return Array.from({length: 13}, (_, index) => {
        const value = offset + index;
        return String.fromCharCode(65 + Math.floor(value / 26), 65 + value % 26);
    });
}

function makeChoiceSource(payload = '', {tagName = 'script', type = 'application/json'} = {}) {
    const source = makeElement(tagName);
    if (type !== null) {
        source.type = type;
        source.setAttribute('type', type);
    }
    source.textContent = payload;
    return source;
}

function choiceHtml({
    subscriber,
    monthly,
    subscriberTag = 'script',
    monthlyTag = 'script',
    subscriberType = 'application/json',
    monthlyType = 'application/json',
    sources = [],
} = {}) {
    const scripts = [
        ['webpack-subscriber-hub-data', subscriber, subscriberTag, subscriberType],
        ['webpack-monthly-product-data', monthly, monthlyTag, monthlyType],
        ...sources.map(({id, payload, tag = 'script', type = 'application/json'}) =>
            [id, payload, tag, type]
        ),
    ].filter(([, payload]) => typeof payload === 'string').map(([id, payload, tag, type]) =>
        `<${tag} id="${id}"${type === null ? '' : ` type="${type}"`}>${payload}</${tag}>`
    );
    return `<!doctype html><html><body>${scripts.join('')}</body></html>`;
}

function createChoiceHtmlParser() {
    return class {
        parseFromString(html) {
            const elements = new Map();
            const scripts = [];
            const matches = html.matchAll(
                /<([a-z][a-z0-9-]*)\s+id="([^"]+)"([^>]*)>([\s\S]*?)<\/\1>/gi
            );
            for (const match of matches) {
                const type = /\btype="([^"]*)"/i.exec(match[3])?.[1] ?? null;
                const element = makeChoiceSource(match[4], {tagName: match[1], type});
                elements.set(match[2], element);
                if (match[1].toLowerCase() === 'script') scripts.push(element);
            }
            return {
                scripts,
                getElementById(id) { return elements.get(id) || null; },
                querySelector(selector) {
                    return selector.startsWith('#') ? elements.get(selector.slice(1)) || null : null;
                },
            };
        }
    };
}

function htmlResponse(html, {
    ok = true,
    status = 200,
    redirected = false,
    url = 'https://www.humblebundle.com/membership',
    contentType = 'text/html; charset=utf-8',
} = {}) {
    return {
        ok,
        status,
        redirected,
        url,
        headers: {get(name) { return name.toLowerCase() === 'content-type' ? contentType : null; }},
        async text() { return html; },
    };
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
    assert.equal(api.normalizeRegionRestrictions({exclusiveCountries: ['US'], disallowedCountries: []}).status, 'unavailable');
    assert.equal(
        api.normalizeRegionRestrictions({exclusive_countries: ['US'], disallowedCountries: []}).status,
        'restricted-metadata'
    );
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
    const disclosure = details.querySelector('details');
    assert.ok(disclosure);
    assert.equal(hasClass(disclosure, 'hb-helper-disclosure'), true);
    assert.equal(hasClass(disclosure, 'hb-helper-region-restrictions__details'), true);
    assert.match(panelText(details), /Steam region is unavailable/);
    assert.match(panelText(noRestriction), /Humble has not declared a region restriction/);
});

test('renders redeemed external Choice restrictions at the key container end without Gift', () => {
    const {api, document} = loadApi();
    const countries = ['US', ...Array.from({length: 12}, (_, index) =>
        String.fromCharCode(65 + Math.floor(index / 26)) + String.fromCharCode(65 + (index % 26))
    )];
    const row = makeRow({gift: false});
    const redeemed = makeRedeemedChoiceSurface('display-alpha', [row], {
        displayMachineName: 'display-alpha',
    });
    document.choiceSelects = [redeemed];
    const emptySiteModal = makeElement();
    emptySiteModal.getClientRects = () => [{}];
    document.elements.set('site-modal', emptySiteModal);
    document.elements.set('webpack-subscriber-hub-data', makeChoiceSource(choicePayload({
        alpha: {
            display_item_machine_name: 'display-alpha',
            tpkds: [{exclusive_countries: countries, disallowed_countries: []}],
        },
    })));
    api.setSteamSessionStateForTest({
        status: 'authenticated', account: {countryCode: 'US'}, error: null,
    });

    api.ensureChoiceRegionRestrictionsForTest();

    assert.equal(row.container.children.at(-1).className.includes(
        'hb-helper-region-restrictions'
    ), true);
    const disclosure = row.container.children.at(-1).querySelector('details');
    assert.ok(disclosure);
    assert.equal(hasClass(disclosure, 'hb-helper-disclosure'), true);
    assert.equal(hasClass(disclosure, 'hb-helper-region-restrictions__details'), true);
    assert.match(panelText(row.container.children.at(-1)), /can be activated/);
});

test('numbers multi-key redeemed restrictions in DOM order when rows share a container', () => {
    const {api, document} = loadApi();
    const container = makeElement();
    const first = makeRow({gift: false, container});
    const second = makeRow({gift: false, container});
    document.choiceSelects = [makeRedeemedChoiceSurface('display-alpha', [first, second])];
    document.elements.set('webpack-subscriber-hub-data', makeChoiceSource(choicePayload({
        alpha: {
            display_item_machine_name: 'display-alpha',
            tpkds: [
                {exclusive_countries: ['US'], disallowed_countries: []},
                {exclusive_countries: [], disallowed_countries: ['US']},
            ],
        },
    })));
    api.setSteamSessionStateForTest({
        status: 'authenticated', account: {countryCode: 'US'}, error: null,
    });

    api.ensureChoiceRegionRestrictionsForTest();

    const panels = container.children.filter(child => hasClass(child, 'hb-helper-region-restrictions'));
    assert.equal(panels.length, 2);
    assert.match(panelText(panels[0]), /Key 1\/2/);
    assert.match(panelText(panels[0]), /can be activated/);
    assert.match(panelText(panels[1]), /Key 2\/2/);
    assert.match(panelText(panels[1]), /restricted/);
    assert.equal(hasClass(panels[0].children[0], 'hb-helper-region-restrictions__key-label'), true);
    assert.deepEqual(container.children, [first.row, second.row, panels[0], panels[1]]);
});

test('renders redeemed restrictions at each of multiple key container ends', () => {
    const {api, document} = loadApi();
    const first = makeRow({gift: false});
    const second = makeRow({gift: false});
    document.choiceSelects = [makeRedeemedChoiceSurface('display-alpha', [first, second])];
    document.elements.set('webpack-subscriber-hub-data', makeChoiceSource(choicePayload({
        alpha: {
            display_item_machine_name: 'display-alpha',
            tpkds: [
                {exclusive_countries: ['US'], disallowed_countries: []},
                {exclusive_countries: [], disallowed_countries: ['US']},
            ],
        },
    })));

    api.ensureChoiceRegionRestrictionsForTest();

    assert.equal(first.container.children.at(-1), choicePanel(first));
    assert.equal(second.container.children.at(-1), choicePanel(second));
    assert.match(panelText(choicePanel(first)), /Key 1\/2/);
    assert.match(panelText(choicePanel(second)), /Key 2\/2/);
});

test('Choice redraws preserve each key disclosure for the same fully validated game', () => {
    const {api, document, context} = loadApi();
    const source = makeChoiceSource(choicePayload({
        alpha: {
            display_item_machine_name: 'display-alpha',
            tpkds: [
                {exclusive_countries: longCountryList(), disallowed_countries: []},
                {exclusive_countries: longCountryList(13), disallowed_countries: []},
            ],
        },
    }));
    document.elements.set('webpack-subscriber-hub-data', source);
    context.location.hash = '#alpha';
    api.setSteamSessionStateForTest({
        status: 'authenticated', account: {countryCode: 'US'}, error: null,
    });
    let rows = [makeRow(), makeRow()];
    setActiveChoiceModal(document, makeChoiceModal('display-alpha', rows));
    api.ensureChoiceRegionRestrictionsForTest();
    choicePanel(rows[0]).querySelector('details').open = true;

    rows = [makeRow(), makeRow()];
    setActiveChoiceModal(document, makeChoiceModal('display-alpha', rows));
    api.ensureChoiceRegionRestrictionsForTest();
    assert.equal(choicePanel(rows[0]).querySelector('details').open, true);
    assert.equal(choicePanel(rows[1]).querySelector('details').open, false);

    choicePanel(rows[0]).querySelector('details').open = false;
    choicePanel(rows[1]).querySelector('details').open = true;
    api.setSteamSessionStateForTest({
        status: 'authenticated', account: {countryCode: 'CA'}, error: null,
    });
    source.textContent = choicePayload({
        alpha: {
            display_item_machine_name: 'display-alpha',
            tpkds: [
                {exclusive_countries: longCountryList(26), disallowed_countries: []},
                {exclusive_countries: longCountryList(39), disallowed_countries: []},
            ],
        },
    });
    api.ensureChoiceRegionRestrictionsForTest();
    assert.equal(choicePanel(rows[0]).querySelector('details').open, false);
    assert.equal(choicePanel(rows[1]).querySelector('details').open, true);
});

test('Choice game switches and slot-count changes discard earlier disclosure state', () => {
    const {api, document, context} = loadApi();
    const source = makeChoiceSource(choicePayload({
        alpha: {
            display_item_machine_name: 'display-alpha',
            tpkds: [
                {exclusive_countries: longCountryList(), disallowed_countries: []},
                {exclusive_countries: longCountryList(13), disallowed_countries: []},
            ],
        },
        beta: {
            display_item_machine_name: 'display-beta',
            tpkds: [{exclusive_countries: longCountryList(26), disallowed_countries: []}],
        },
    }));
    document.elements.set('webpack-subscriber-hub-data', source);
    const showGame = (choiceIdentifier, displayMachineName, count) => {
        const rows = Array.from({length: count}, () => makeRow());
        context.location.hash = `#${choiceIdentifier}`;
        setActiveChoiceModal(document, makeChoiceModal(displayMachineName, rows));
        api.ensureChoiceRegionRestrictionsForTest();
        return rows;
    };

    let rows = showGame('alpha', 'display-alpha', 2);
    choicePanel(rows[0]).querySelector('details').open = true;
    rows = showGame('beta', 'display-beta', 1);
    assert.equal(choicePanel(rows[0]).querySelector('details').open, false);
    rows = showGame('alpha', 'display-alpha', 2);
    assert.ok(rows.every(row => choicePanel(row).querySelector('details').open === false));

    choicePanel(rows[0]).querySelector('details').open = true;
    source.textContent = choicePayload({
        alpha: {
            display_item_machine_name: 'display-alpha',
            tpkds: [{exclusive_countries: longCountryList(), disallowed_countries: []}],
        },
    });
    rows = showGame('alpha', 'display-alpha', 1);
    assert.equal(choicePanel(rows[0]).querySelector('details').open, false);
    source.textContent = choicePayload({
        alpha: {
            display_item_machine_name: 'display-alpha',
            tpkds: [
                {exclusive_countries: longCountryList(), disallowed_countries: []},
                {exclusive_countries: longCountryList(13), disallowed_countries: []},
            ],
        },
    });
    rows = showGame('alpha', 'display-alpha', 2);
    assert.ok(rows.every(row => choicePanel(row).querySelector('details').open === false));
});

test('invalid Choice identity, view, and container contexts erase reusable disclosure state', () => {
    const scenarios = [
        {
            label: 'ambiguous catalog identity',
            invalidate({source}) {
                source.textContent = choicePayload([
                    {
                        display_item_machine_name: 'display-alpha',
                        tpkds: [{exclusive_countries: longCountryList(), disallowed_countries: []}],
                    },
                    {
                        display_item_machine_name: 'display-alpha',
                        tpkds: [{exclusive_countries: longCountryList(13), disallowed_countries: []}],
                    },
                ]);
            },
        },
        {
            label: 'multiple active views',
            invalidate({document, modal}) {
                const other = makeChoiceModal('display-alpha', [makeRow()]);
                const siteModal = document.elements.get('site-modal');
                siteModal.querySelectorAll = selector => selector === '.choice-modal'
                    ? [modal, other]
                    : [];
                document.choiceModals = [modal, other];
            },
        },
        {
            label: 'hidden active view',
            invalidate({modal}) { modal.getClientRects = () => []; },
        },
        {
            label: 'missing key container',
            invalidate({rows}) { rows[0].container.className = 'unsupported-container'; },
        },
    ];
    for (const scenario of scenarios) {
        const {api, document, context} = loadApi();
        const source = makeChoiceSource(choicePayload({
            alpha: {
                display_item_machine_name: 'display-alpha',
                tpkds: [{exclusive_countries: longCountryList(), disallowed_countries: []}],
            },
        }));
        document.elements.set('webpack-subscriber-hub-data', source);
        context.location.hash = '#alpha';
        let rows = [makeRow()];
        let modal = makeChoiceModal('display-alpha', rows);
        setActiveChoiceModal(document, modal);
        api.ensureChoiceRegionRestrictionsForTest();
        choicePanel(rows[0]).querySelector('details').open = true;

        scenario.invalidate({document, modal, rows, source});
        api.ensureChoiceRegionRestrictionsForTest();
        assert.equal(modal.querySelectorAll('.hb-helper-region-restrictions').length, 0, scenario.label);

        source.textContent = choicePayload({
            alpha: {
                display_item_machine_name: 'display-alpha',
                tpkds: [{exclusive_countries: longCountryList(), disallowed_countries: []}],
            },
        });
        rows = [makeRow()];
        modal = makeChoiceModal('display-alpha', rows);
        setActiveChoiceModal(document, modal);
        api.ensureChoiceRegionRestrictionsForTest();
        assert.equal(choicePanel(rows[0]).querySelector('details').open, false, scenario.label);
    }
});

test('obsolete Choice fallback responses neither restore nor leave stale disclosure panels', async () => {
    const responses = [];
    const {api, document, context} = loadApi({
        DOMParserImpl: createChoiceHtmlParser(),
        fetchImpl() {
            return new Promise(resolve => responses.push(resolve));
        },
    });
    const source = makeChoiceSource(choicePayload({
        alpha: {
            display_item_machine_name: 'display-alpha',
            tpkds: [{exclusive_countries: longCountryList(), disallowed_countries: []}],
        },
    }));
    document.elements.set('webpack-subscriber-hub-data', source);
    context.location.hash = '#alpha';
    let rows = [makeRow()];
    setActiveChoiceModal(document, makeChoiceModal('display-alpha', rows));
    api.ensureChoiceRegionRestrictionsForTest();
    choicePanel(rows[0]).querySelector('details').open = true;

    document.elements.delete('webpack-subscriber-hub-data');
    const oldRefresh = api.ensureChoiceRegionRestrictionsForTest();
    assert.equal(choicePanel(rows[0]), null);
    context.location.pathname = '/membership/home';
    context.location.search = '?view=beta';
    context.location.hash = '#beta';
    const betaRows = [makeRow()];
    setActiveChoiceModal(document, makeChoiceModal('display-beta', betaRows));
    const currentRefresh = api.ensureChoiceRegionRestrictionsForTest();

    responses[0](htmlResponse(choiceHtml({subscriber: choicePayload({
        alpha: {
            display_item_machine_name: 'display-alpha',
            tpkds: [{exclusive_countries: longCountryList(), disallowed_countries: []}],
        },
    })})));
    await oldRefresh;
    assert.equal(choicePanel(betaRows[0]), null);

    context.location.pathname = '/membership';
    context.location.search = '';
    context.location.hash = '#alpha';
    document.elements.set('webpack-subscriber-hub-data', source);
    rows = [makeRow()];
    setActiveChoiceModal(document, makeChoiceModal('display-alpha', rows));
    api.ensureChoiceRegionRestrictionsForTest();
    assert.equal(choicePanel(rows[0]).querySelector('details').open, false);

    responses[1](htmlResponse(
        choiceHtml({subscriber: choicePayload({
            beta: {
                display_item_machine_name: 'display-beta',
                tpkds: [{exclusive_countries: longCountryList(13), disallowed_countries: []}],
            },
        })}),
        {url: 'https://www.humblebundle.com/membership/home?view=beta'}
    ));
    await currentRefresh;
    assert.equal(choicePanel(rows[0]).querySelector('details').open, false);
});

test('cleans redeemed containers on refresh and when a reused view becomes unreliable', () => {
    const {api, document} = loadApi();
    const row = makeRow({gift: false});
    const surface = makeRedeemedChoiceSurface('display-alpha', [row]);
    document.choiceSelects = [surface];
    const source = makeChoiceSource(choicePayload({
        alpha: {
            display_item_machine_name: 'display-alpha',
            tpkds: [{exclusive_countries: ['US'], disallowed_countries: []}],
        },
    }));
    document.elements.set('webpack-subscriber-hub-data', source);

    api.ensureChoiceRegionRestrictionsForTest();
    api.ensureChoiceRegionRestrictionsForTest();
    assert.equal(row.container.querySelectorAll('.hb-helper-region-restrictions').length, 1);

    surface.querySelector = selector => selector === 'h2.title[data-machine-name]' ? null : null;
    source.textContent = choicePayload({
        beta: {
            display_item_machine_name: 'display-beta',
            tpkds: [{exclusive_countries: ['US'], disallowed_countries: []}],
        },
    });
    api.ensureChoiceRegionRestrictionsForTest();
    assert.equal(row.container.querySelectorAll('.hb-helper-region-restrictions').length, 0);
});

test('clears Choice-owned panels from a reused view after it loses Choice surface classes', () => {
    const {api, document} = loadApi();
    const row = makeRow({gift: false});
    const stale = makeElement();
    stale.className = 'hb-helper-region-restrictions hb-helper-region-restrictions--choice';
    row.container.appendChild(stale);
    const reusedView = makeElement();
    reusedView.className = 'reused-view';
    reusedView.appendChild(row.container);
    document.body.appendChild(reusedView);

    api.ensureChoiceRegionRestrictionsForTest();

    assert.equal(row.container.children.includes(stale), false);
});

test('fails closed and clears Choice panels when a matched row is hidden', () => {
    const {api, document} = loadApi();
    const row = makeRow({gift: false});
    row.row.getClientRects = () => [];
    const stale = makeElement();
    stale.className = 'hb-helper-region-restrictions hb-helper-region-restrictions--choice';
    row.container.appendChild(stale);
    document.choiceSelects = [makeRedeemedChoiceSurface('display-alpha', [row])];
    document.elements.set('webpack-subscriber-hub-data', makeChoiceSource(choicePayload({
        alpha: {
            display_item_machine_name: 'display-alpha',
            tpkds: [{exclusive_countries: ['US'], disallowed_countries: []}],
        },
    })));

    api.ensureChoiceRegionRestrictionsForTest();

    assert.equal(choicePanel(row), null);
});

test('fails closed and clears Choice panels for multiple exact title identities', () => {
    const {api, document} = loadApi();
    const row = makeRow({gift: false});
    const stale = makeElement();
    stale.className = 'hb-helper-region-restrictions hb-helper-region-restrictions--choice';
    row.container.appendChild(stale);
    const surface = makeRedeemedChoiceSurface('display-alpha', [row]);
    const extraTitle = makeElement('h2');
    extraTitle.className = 'title';
    extraTitle.dataset.machineName = 'display-beta';
    surface.appendChild(extraTitle);
    const querySelectorAll = surface.querySelectorAll;
    surface.querySelectorAll = selector => selector === 'h2.title[data-machine-name]'
        ? [surface.querySelector(selector), extraTitle]
        : querySelectorAll(selector);
    document.choiceSelects = [surface];
    document.elements.set('webpack-subscriber-hub-data', makeChoiceSource(choicePayload({
        alpha: {
            display_item_machine_name: 'display-alpha',
            tpkds: [{exclusive_countries: ['US'], disallowed_countries: []}],
        },
    })));

    api.ensureChoiceRegionRestrictionsForTest();

    assert.equal(choicePanel(row), null);
});

test('fails closed for hidden or multiple Choice surfaces, missing containers, and identity conflicts', () => {
    const payload = makeChoiceSource(choicePayload({
        alpha: {
            display_item_machine_name: 'display-alpha',
            tpkds: [{exclusive_countries: ['US'], disallowed_countries: []}],
        },
    }));
    for (const [label, configure] of [
        ['hidden surface', document => {
            const row = makeRow({gift: false});
            const surface = makeRedeemedChoiceSurface('display-alpha', [row]);
            surface.getClientRects = () => [];
            document.choiceSelects = [surface];
            return row;
        }],
        ['multiple surfaces', document => {
            const first = makeRow({gift: false});
            const second = makeRow({gift: false});
            document.choiceSelects = [
                makeRedeemedChoiceSurface('display-alpha', [first]),
                makeRedeemedChoiceSurface('display-alpha', [second]),
            ];
            return first;
        }],
        ['identity conflict', document => {
            const row = makeRow({gift: false});
            document.choiceSelects = [makeRedeemedChoiceSurface(
                'display-alpha', [row], {displayMachineName: 'display-beta'}
            )];
            return row;
        }],
        ['missing container', document => {
            const row = makeRow({gift: false});
            row.container.className = 'unsupported-container';
            document.choiceSelects = [makeRedeemedChoiceSurface('display-alpha', [row])];
            return row;
        }],
    ]) {
        const {api, document} = loadApi();
        const row = configure(document);
        document.elements.set('webpack-subscriber-hub-data', payload);
        api.ensureChoiceRegionRestrictionsForTest();
        assert.equal(choicePanel(row), null, label);
    }
});

test('maps Choice rows by exact machine name and TPKD order at their containers end', () => {
    const {api, document} = loadApi();
    const rows = [makeRow(), makeRow()];
    document.choiceModal = makeChoiceModal('display-alpha', rows);
    setActiveChoiceModal(document, document.choiceModal);
    const source = makeChoiceSource();
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

    assert.equal(hasClass(choicePanel(rows[0]), 'hb-helper-region-restrictions'), true);
    assert.match(panelText(choicePanel(rows[0])), /can be activated/);
    assert.match(panelText(choicePanel(rows[0])), /Humble allowlist/);
    assert.doesNotMatch(panelText(choicePanel(rows[0])), /Humble blocklist/);
    assert.equal(hasClass(choicePanel(rows[1]), 'hb-helper-region-restrictions'), true);
    assert.match(panelText(choicePanel(rows[1])), /restricted/);
});

test('falls back to monthly data and an exact hash identifier when the Choice title is missing', () => {
    const {api, document, context} = loadApi();
    const rows = [makeRow()];
    document.choiceModal = makeChoiceModal(undefined, rows);
    setActiveChoiceModal(document, document.choiceModal);
    context.location.hash = '#choice-beta';
    const source = makeChoiceSource();
    source.textContent = choicePayload({
        'choice-beta': {
            display_item_machine_name: 'display-beta',
            tpkds: [{exclusive_countries: [], disallowed_countries: ['CA']}],
        },
    });
    document.elements.set('webpack-monthly-product-data', source);
    api.setSteamDerivedStateForTest({countryCode: 'US', ownedApps: [], wishlistApps: []});
    api.ensureChoiceRegionRestrictionsForTest();
    assert.equal(hasClass(choicePanel(rows[0]), 'hb-helper-region-restrictions'), true);

    choicePanel(rows[0]).remove();
    api.ensureChoiceRegionRestrictionsForTest();
    assert.equal(hasClass(choicePanel(rows[0]), 'hb-helper-region-restrictions'), true);
    assert.equal(document.choiceModal.querySelectorAll('.hb-helper-region-restrictions').length, 1);
});

test('falls back to an exact hash identifier when the present Choice title is unmatched', () => {
    const {api, document, context} = loadApi();
    const rows = [makeRow()];
    document.choiceModal = makeChoiceModal('display-not-in-catalog', rows);
    setActiveChoiceModal(document, document.choiceModal);
    context.location.hash = '#/membership/choices/choice-beta';
    const source = makeChoiceSource();
    source.textContent = choicePayload({
        'choice-beta': {
            display_item_machine_name: 'display-beta',
            tpkds: [{exclusive_countries: ['US'], disallowed_countries: []}],
        },
    });
    document.elements.set('webpack-subscriber-hub-data', source);

    api.ensureChoiceRegionRestrictionsForTest();

    assert.equal(hasClass(choicePanel(rows[0]), 'hb-helper-region-restrictions'), true);
});

test('cleans stale Choice panels when source identity, row count, fields, or anchors are unreliable', () => {
    const {api, document} = loadApi();
    const rows = [makeRow()];
    document.choiceModal = makeChoiceModal('display-missing', rows);
    setActiveChoiceModal(document, document.choiceModal);
    const stale = makeElement();
    stale.className = 'hb-helper-region-restrictions hb-helper-region-restrictions--choice';
    rows[0].row.appendChild(stale);
    const source = makeChoiceSource();
    source.textContent = choicePayload({
        alpha: {display_item_machine_name: 'display-alpha', tpkds: [{exclusive_countries: [], disallowed_countries: []}, {exclusive_countries: [], disallowed_countries: []}]},
    });
    document.elements.set('webpack-subscriber-hub-data', source);
    api.ensureChoiceRegionRestrictionsForTest();
    assert.equal(document.choiceModal.querySelectorAll('.hb-helper-region-restrictions').length, 0);
});

test('reuses the shared restriction panel primitive for Downloads', () => {
    const {api, document} = loadApi();
    const firstDisclaimer = makeElement();
    const secondDisclaimer = makeElement();
    firstDisclaimer.appendChild(api.createRegionRestrictionPanel(
        {exclusive_countries: ['US'], disallowed_countries: []},
        'US'
    ));
    secondDisclaimer.appendChild(api.createRegionRestrictionPanel(
        {exclusive_countries: [], disallowed_countries: ['CA']},
        'US'
    ));
    assert.equal(hasClass(firstDisclaimer.children[0], 'hb-helper-region-restrictions'), true);
    assert.equal(hasClass(secondDisclaimer.children[0], 'hb-helper-region-restrictions'), true);
    assert.match(panelText(secondDisclaimer.children[0]), /can be activated/);

    const countries = Array.from({length: 13}, (_, index) =>
        String.fromCharCode(65 + Math.floor(index / 26)) + String.fromCharCode(65 + (index % 26))
    );
    const longCountryPanel = api.createRegionRestrictionPanel(
        {exclusive_countries: countries, disallowed_countries: []},
        'US'
    );
    const disclosure = longCountryPanel.querySelector('details');
    assert.ok(disclosure);
    assert.equal(hasClass(disclosure, 'hb-helper-disclosure'), true);
    assert.equal(hasClass(disclosure, 'hb-helper-region-restrictions__details'), true);

    assert.equal(document.body.children.length, 0);
});

test('Downloads expose no separate restriction requester, renderer, or observer seam', () => {
    const {api, mutationObservers} = loadApi();

    assert.equal(api.getRegionLockInfoForTest, undefined);
    assert.equal(api.renderDownloadRegionRestrictionsForTest, undefined);
    assert.equal(mutationObservers.length, 0);
});

test('building a Downloads restriction panel neither requests nor logs order data', () => {
    const messages = [];
    let requests = 0;
    const {api} = loadApi({
        gmRequestImpl() { requests += 1; },
        consoleImpl: {
            log(...values) { messages.push(values.join(' ')); },
            warn(...values) { messages.push(values.join(' ')); },
            error(...values) { messages.push(values.join(' ')); },
        },
    });

    const panel = api.createRegionRestrictionPanel(
        {exclusive_countries: ['US'], disallowed_countries: []},
        'US'
    );

    assert.ok(panel);
    assert.equal(requests, 0);
    assert.equal(messages.length, 0);
});

test('keeps the shared Downloads panel free of Choice ownership and key labels', () => {
    const {api} = loadApi();
    const panel = api.createRegionRestrictionPanel(
        {exclusive_countries: ['US'], disallowed_countries: []},
        'US'
    );

    assert.equal(hasClass(panel, 'hb-helper-region-restrictions--choice'), false);
    assert.equal(panel.querySelector('.hb-helper-region-restrictions__key-label'), null);
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
    const source = makeChoiceSource();
    source.textContent = choicePayload({
        active: {
            display_item_machine_name: 'display-active',
            tpkds: [{exclusive_countries: ['US'], disallowed_countries: []}],
        },
    });
    document.elements.set('webpack-subscriber-hub-data', source);

    api.ensureChoiceRegionRestrictionsForTest();

    assert.equal(hasClass(choicePanel(activeRows[0]), 'hb-helper-region-restrictions'), true);
    assert.equal(staleRows[0].row.children.includes(stalePanel), true);
});

test('uses the active Choice modal as the authority over its nested redeemed Choice surface', () => {
    const {api, document} = loadApi();
    const row = makeRow({gift: false});
    const activeModal = makeChoiceModal('display-like-a-dragon', [row]);
    const redeemedSurface = makeRedeemedChoiceSurface('display-like-a-dragon', [row]);
    activeModal.appendChild(redeemedSurface);
    setActiveChoiceModal(document, activeModal);
    document.choiceSelects = [redeemedSurface];
    const source = makeChoiceSource();
    source.textContent = choicePayload({
        like_a_dragon: {
            display_item_machine_name: 'display-like-a-dragon',
            tpkds: [{exclusive_countries: ['US'], disallowed_countries: []}],
        },
    });
    document.elements.set('webpack-subscriber-hub-data', source);

    api.ensureChoiceRegionRestrictionsForTest();

    assert.ok(choicePanel(row));
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
    const source = makeChoiceSource();
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
    const subscriber = makeChoiceSource();
    subscriber.textContent = choicePayload({
        other: {
            display_item_machine_name: 'display-other',
            tpkds: [{exclusive_countries: ['US'], disallowed_countries: []}],
        },
    });
    const monthly = makeChoiceSource();
    monthly.textContent = choicePayload({
        'choice-beta': {
            display_item_machine_name: 'display-beta',
            tpkds: [{exclusive_countries: ['US'], disallowed_countries: []}],
        },
    });
    document.elements.set('webpack-subscriber-hub-data', subscriber);
    document.elements.set('webpack-monthly-product-data', monthly);

    api.ensureChoiceRegionRestrictionsForTest();

    assert.equal(hasClass(choicePanel(rows[0]), 'hb-helper-region-restrictions'), true);
});

test('fails closed for invalid Choice metadata and invalid shared panel metadata', () => {
    const {api, document} = loadApi();
    const rows = [makeRow(), makeRow()];
    document.choiceModal = makeChoiceModal('display-alpha', rows);
    setActiveChoiceModal(document, document.choiceModal);
    const source = makeChoiceSource();
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

    assert.equal(api.createRegionRestrictionPanel(
        {exclusive_countries: ['US', 5], disallowed_countries: []},
        'US'
    ), null);
    assert.equal(hasClass(api.createRegionRestrictionPanel(
        {exclusive_countries: ['US'], disallowed_countries: []},
        'US'
    ), 'hb-helper-region-restrictions'), true);
});

test('does not match a Choice title machine name against a game-data entry key', () => {
    const {api, document} = loadApi();
    const rows = [makeRow()];
    document.choiceModal = makeChoiceModal('choice-alpha', rows);
    setActiveChoiceModal(document, document.choiceModal);
    const source = makeChoiceSource();
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
    const source = makeChoiceSource();
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
    stale.className = 'hb-helper-region-restrictions hb-helper-region-restrictions--choice';
    rows[0].row.appendChild(stale);
    const source = makeChoiceSource();
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

test('replaces stale Choice panels when a Choice row has no Gift field', () => {
    const {api, document} = loadApi();
    const {row, container} = makeRow({gift: false});
    const stale = makeElement();
    stale.className = 'hb-helper-region-restrictions hb-helper-region-restrictions--choice';
    container.appendChild(stale);
    document.choiceModal = makeChoiceModal('display-alpha', [{row, container}]);
    setActiveChoiceModal(document, document.choiceModal);
    const source = makeChoiceSource();
    source.textContent = choicePayload({
        alpha: {
            display_item_machine_name: 'display-alpha',
            tpkds: [{exclusive_countries: ['US'], disallowed_countries: []}],
        },
    });
    document.elements.set('webpack-subscriber-hub-data', source);

    api.ensureChoiceRegionRestrictionsForTest();

    assert.equal(container.querySelectorAll('.hb-helper-region-restrictions').length, 1);
    assert.equal(container.children.at(-1).className.includes(
        'hb-helper-region-restrictions--choice'
    ), true);
});

test('fails closed for ambiguous display machine names and does not fall through to hash', () => {
    const {api, document, context} = loadApi();
    const rows = [makeRow()];
    document.choiceModal = makeChoiceModal('display-alpha', rows);
    setActiveChoiceModal(document, document.choiceModal);
    context.location.hash = '#/membership/choices/choice-fallback';
    const source = makeChoiceSource();
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
    const subscriber = makeChoiceSource();
    const monthly = makeChoiceSource();
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
    const identicalSubscriber = makeChoiceSource();
    const identicalMonthly = makeChoiceSource();
    const data = {
        display_item_machine_name: 'display-alpha',
        tpkds: [{exclusive_countries: ['US'], disallowed_countries: []}],
    };
    identicalSubscriber.textContent = choicePayload({alpha: data});
    identicalMonthly.textContent = choicePayload({alpha: data});
    identical.document.elements.set('webpack-subscriber-hub-data', identicalSubscriber);
    identical.document.elements.set('webpack-monthly-product-data', identicalMonthly);
    identical.api.ensureChoiceRegionRestrictionsForTest();
    assert.equal(hasClass(choicePanel(identicalRows[0]), 'hb-helper-region-restrictions'), true);
});

test('deduplicates repeated fixed Choice metadata nodes before parsing', () => {
    const {api, document} = loadApi();
    const rows = [makeRow()];
    setActiveChoiceModal(document, makeChoiceModal('display-alpha', rows));
    const source = makeChoiceSource();
    let reads = 0;
    Object.defineProperty(source, 'textContent', {
        get() {
            reads += 1;
            return choicePayload({
                alpha: {
                    display_item_machine_name: 'display-alpha',
                    tpkds: [{
                        exclusive_countries: [reads <= 2 ? 'US' : 'CA'],
                        disallowed_countries: [],
                    }],
                },
            });
        },
    });
    document.elements.set('webpack-subscriber-hub-data', source);
    document.elements.set('webpack-monthly-product-data', source);

    api.ensureChoiceRegionRestrictionsForTest();

    assert.ok(choicePanel(rows[0]));
    assert.equal(reads, 2);
});

test('recovers Choice restrictions from current same-origin HTML when both live webpack nodes are absent', async () => {
    const requests = [];
    const {api, document, context} = loadApi({
        DOMParserImpl: createChoiceHtmlParser(),
        fetchImpl(url, options) {
            requests.push({url, options});
            return Promise.resolve(htmlResponse(choiceHtml({
                subscriber: choicePayload({
                    'choice-beta': {
                        display_item_machine_name: 'display-beta',
                        tpkds: [{exclusive_countries: ['US'], disallowed_countries: []}],
                    },
                }),
            })));
        },
    });
    const rows = [makeRow()];
    const modal = makeChoiceModal(undefined, rows);
    document.choiceModal = modal;
    setActiveChoiceModal(document, modal);
    context.location.href = 'https://www.humblebundle.com/membership#/membership/choices/choice-beta';
    context.location.hash = '#/membership/choices/choice-beta';
    api.setSteamSessionStateForTest({
        status: 'authenticated',
        account: {countryCode: 'US'},
        error: null,
    });

    await api.ensureChoiceRegionRestrictionsForTest();

    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, '/membership');
    assert.equal(requests[0].options.credentials, 'include');
    assert.equal(hasClass(choicePanel(rows[0]), 'hb-helper-region-restrictions'), true);
    assert.match(panelText(choicePanel(rows[0])), /can be activated/);
});

test('discovers renamed Choice JSON metadata in fetched HTML for redeemed external views', async () => {
    const requests = [];
    const {api, document} = loadApi({
        DOMParserImpl: createChoiceHtmlParser(),
        fetchImpl(url, options) {
            requests.push({url, options});
            return Promise.resolve(htmlResponse(choiceHtml({
                sources: [{
                    id: 'choice-data-renamed-2026',
                    payload: choicePayload({
                        'dead-cells': {
                            display_item_machine_name: 'dead-cells',
                            tpkds: [
                                {exclusive_countries: ['US'], disallowed_countries: []},
                                {exclusive_countries: ['US'], disallowed_countries: []},
                            ],
                        },
                    }),
                }],
            })));
        },
    });
    const rows = [makeRow({gift: false}), makeRow({gift: false})];
    document.choiceSelects = [makeRedeemedChoiceSurface('dead-cells', rows)];

    await api.ensureChoiceRegionRestrictionsForTest();

    assert.equal(requests.length, 1);
    assert.ok(choicePanel(rows[0]), 'renamed metadata should render the first redeemed key');
    assert.match(panelText(choicePanel(rows[0])), /Key 1\/2/);
    assert.match(panelText(choicePanel(rows[1])), /Key 2\/2/);
    assert.equal(requests[0].options.credentials, 'include');
    assert.equal(requests[0].options.cache, 'no-store');
    assert.equal(
        requests[0].options.headers.Accept,
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
    );
});

test('discovers renamed Choice JSON metadata from the live DOM without fetching', async () => {
    let requests = 0;
    const {api, document} = loadApi({
        fetchImpl() { requests += 1; },
    });
    const rows = [makeRow()];
    setActiveChoiceModal(document, makeChoiceModal('dead-cells', rows));
    const source = makeChoiceSource(choicePayload({
        'dead-cells': {
            display_item_machine_name: 'dead-cells',
            tpkds: [{exclusive_countries: ['US'], disallowed_countries: []}],
        },
    }));
    document.scripts.push(source);

    await api.ensureChoiceRegionRestrictionsForTest();

    assert.equal(requests, 0);
    assert.ok(choicePanel(rows[0]));
});

test('keeps valid fixed Choice metadata authoritative over renamed scripts', async () => {
    let requests = 0;
    const {api, document} = loadApi({
        fetchImpl() { requests += 1; },
    });
    const rows = [makeRow()];
    setActiveChoiceModal(document, makeChoiceModal('dead-cells', rows));
    const fixedSource = makeChoiceSource(choicePayload({
        'dead-cells': {
            display_item_machine_name: 'dead-cells',
            tpkds: [{exclusive_countries: ['US'], disallowed_countries: []}],
        },
    }));
    const renamedConflict = makeChoiceSource(choicePayload({
        'dead-cells': {
            display_item_machine_name: 'dead-cells',
            tpkds: [{exclusive_countries: ['CA'], disallowed_countries: []}],
        },
    }));
    document.elements.set('webpack-subscriber-hub-data', fixedSource);
    document.scripts.push(fixedSource, renamedConflict);

    await api.ensureChoiceRegionRestrictionsForTest();

    assert.equal(requests, 0);
    assert.ok(choicePanel(rows[0]));
});

test('rejects malformed renamed Choice scripts during structural discovery', async () => {
    const validGame = {
        alpha: {
            display_item_machine_name: 'display-alpha',
            tpkds: [{exclusive_countries: ['US'], disallowed_countries: []}],
        },
    };
    const invalidSources = [
        {id: 'renamed-wrong-mime', payload: choicePayload(validGame), type: 'text/plain'},
        {id: 'renamed-js-wrapper', payload: `window.choiceData = ${choicePayload(validGame)}`},
        {id: 'renamed-invalid-json', payload: '{not json'},
        {
            id: 'renamed-wrong-shape',
            payload: JSON.stringify({contentChoiceOptions: {contentChoiceData: {games: validGame}}}),
        },
    ];
    for (const source of invalidSources) {
        const {api, document, context} = loadApi({
            DOMParserImpl: createChoiceHtmlParser(),
            fetchImpl() {
                return Promise.resolve(htmlResponse(choiceHtml({sources: [source]})));
            },
        });
        const rows = [makeRow()];
        setActiveChoiceModal(document, makeChoiceModal('display-alpha', rows));
        context.location.hash = '#alpha';

        await api.ensureChoiceRegionRestrictionsForTest();

        assert.equal(choicePanel(rows[0]), null, source.id);
    }
});

test('fails closed when renamed Choice catalogs conflict', async () => {
    const {api, document, context} = loadApi({
        DOMParserImpl: createChoiceHtmlParser(),
        fetchImpl() {
            return Promise.resolve(htmlResponse(choiceHtml({
                sources: [
                    {
                        id: 'renamed-one',
                        payload: choicePayload({
                            alpha: {
                                display_item_machine_name: 'display-alpha',
                                tpkds: [{exclusive_countries: ['US'], disallowed_countries: []}],
                            },
                        }),
                    },
                    {
                        id: 'renamed-two',
                        payload: choicePayload({
                            alpha: {
                                display_item_machine_name: 'display-alpha',
                                tpkds: [{exclusive_countries: ['CA'], disallowed_countries: []}],
                            },
                        }),
                    },
                ],
            })));
        },
    });
    const rows = [makeRow()];
    setActiveChoiceModal(document, makeChoiceModal('display-alpha', rows));
    context.location.hash = '#alpha';

    await api.ensureChoiceRegionRestrictionsForTest();

    assert.equal(choicePanel(rows[0]), null);
});

test('recovers Choice restrictions from the fetched monthly webpack source', async () => {
    const payload = choicePayload({
        'choice-beta': {
            display_item_machine_name: 'display-beta',
            tpkds: [{exclusive_countries: ['US'], disallowed_countries: []}],
        },
    });
    const {api, document, context} = loadApi({
        DOMParserImpl: createChoiceHtmlParser(),
        fetchImpl() {
            return Promise.resolve(htmlResponse(choiceHtml({monthly: payload})));
        },
    });
    const rows = [makeRow()];
    setActiveChoiceModal(document, makeChoiceModal(undefined, rows));
    context.location.hash = '#choice-beta';

    await api.ensureChoiceRegionRestrictionsForTest();

    assert.equal(hasClass(
        choicePanel(rows[0]),
        'hb-helper-region-restrictions'
    ), true);
});

test('renders external redeemed views from live data and coalesces their fetched fallback', async () => {
    const live = loadApi({
        fetchImpl() { return Promise.reject(new Error('live metadata should render directly')); },
    });
    const liveRow = makeRow({gift: false});
    live.document.choiceSelects = [makeRedeemedChoiceSurface('display-alpha', [liveRow])];
    live.document.elements.set('webpack-subscriber-hub-data', makeChoiceSource(choicePayload({
        alpha: {
            display_item_machine_name: 'display-alpha',
            tpkds: [{exclusive_countries: ['US'], disallowed_countries: []}],
        },
    })));
    await live.api.ensureChoiceRegionRestrictionsForTest();
    assert.ok(choicePanel(liveRow));

    let requests = 0;
    let resolveResponse;
    const fetched = loadApi({
        DOMParserImpl: createChoiceHtmlParser(),
        fetchImpl() {
            requests += 1;
            return new Promise(resolve => { resolveResponse = resolve; });
        },
    });
    const fetchedRow = makeRow({gift: false});
    fetched.document.choiceSelects = [makeRedeemedChoiceSurface('display-alpha', [fetchedRow])];
    const firstRefresh = fetched.api.ensureChoiceRegionRestrictionsForTest();
    const secondRefresh = fetched.api.ensureChoiceRegionRestrictionsForTest();
    assert.equal(requests, 1);
    assert.equal(firstRefresh, secondRefresh);
    resolveResponse(htmlResponse(choiceHtml({
        subscriber: choicePayload({
            alpha: {
                display_item_machine_name: 'display-alpha',
                tpkds: [{exclusive_countries: ['US'], disallowed_countries: []}],
            },
        }),
    })));
    await Promise.all([firstRefresh, secondRefresh]);

    assert.ok(choicePanel(fetchedRow));
});

test('does not fetch Choice HTML when live webpack data can render the active modal', async () => {
    let requests = 0;
    const {api, document} = loadApi({
        fetchImpl() {
            requests += 1;
            return Promise.reject(new Error('live Choice data should prevent fallback'));
        },
    });
    const rows = [makeRow()];
    const modal = makeChoiceModal('display-alpha', rows);
    document.choiceModal = modal;
    setActiveChoiceModal(document, modal);
    const source = makeChoiceSource();
    source.textContent = choicePayload({
        alpha: {
            display_item_machine_name: 'display-alpha',
            tpkds: [{exclusive_countries: ['US'], disallowed_countries: []}],
        },
    });
    document.elements.set('webpack-subscriber-hub-data', source);

    await api.ensureChoiceRegionRestrictionsForTest();

    assert.equal(requests, 0);
    assert.equal(api.getChoiceRegionSourceStateForTest(), null);
    assert.equal(hasClass(choicePanel(rows[0]), 'hb-helper-region-restrictions'), true);
});

test('reparses a changed live Choice source without fetching', async () => {
    let requests = 0;
    const {api, document} = loadApi({
        fetchImpl() {
            requests += 1;
            return Promise.reject(new Error('updated live data should remain authoritative'));
        },
    });
    const rows = [makeRow()];
    const modal = makeChoiceModal('display-alpha', rows);
    setActiveChoiceModal(document, modal);
    api.setSteamSessionStateForTest({
        status: 'authenticated',
        account: {countryCode: 'US'},
        error: null,
    });
    const source = makeChoiceSource(choicePayload({
        alpha: {
            display_item_machine_name: 'display-alpha',
            tpkds: [{exclusive_countries: ['US'], disallowed_countries: []}],
        },
    }));
    document.elements.set('webpack-subscriber-hub-data', source);
    await api.ensureChoiceRegionRestrictionsForTest();
    assert.match(panelText(choicePanel(rows[0])), /can be activated/);

    source.textContent = choicePayload({
        alpha: {
            display_item_machine_name: 'display-alpha',
            tpkds: [{exclusive_countries: ['CA'], disallowed_countries: []}],
        },
    });
    await api.ensureChoiceRegionRestrictionsForTest();

    assert.equal(requests, 0);
    assert.match(panelText(choicePanel(rows[0])), /restricted/);
});

test('falls back to current HTML after the live Choice source is removed', async () => {
    let requests = 0;
    const fetchedPayload = choicePayload({
        alpha: {
            display_item_machine_name: 'display-alpha',
            tpkds: [{exclusive_countries: [], disallowed_countries: ['US']}],
        },
    });
    const {api, document} = loadApi({
        DOMParserImpl: createChoiceHtmlParser(),
        fetchImpl() {
            requests += 1;
            return Promise.resolve(htmlResponse(choiceHtml({subscriber: fetchedPayload})));
        },
    });
    const rows = [makeRow()];
    setActiveChoiceModal(document, makeChoiceModal('display-alpha', rows));
    api.setSteamSessionStateForTest({
        status: 'authenticated',
        account: {countryCode: 'US'},
        error: null,
    });
    document.elements.set('webpack-subscriber-hub-data', makeChoiceSource(choicePayload({
        alpha: {
            display_item_machine_name: 'display-alpha',
            tpkds: [{exclusive_countries: ['US'], disallowed_countries: []}],
        },
    })));
    await api.ensureChoiceRegionRestrictionsForTest();
    document.elements.delete('webpack-subscriber-hub-data');

    await api.ensureChoiceRegionRestrictionsForTest();

    assert.equal(requests, 1);
    assert.match(panelText(choicePanel(rows[0])), /restricted/);
});

test('keeps a successful route fallback cached across temporary live Choice data', async () => {
    let requests = 0;
    const fallbackPayload = choicePayload({
        alpha: {
            display_item_machine_name: 'display-alpha',
            tpkds: [{exclusive_countries: ['US'], disallowed_countries: []}],
        },
    });
    const {api, document} = loadApi({
        DOMParserImpl: createChoiceHtmlParser(),
        fetchImpl() {
            requests += 1;
            return Promise.resolve(htmlResponse(choiceHtml({subscriber: fallbackPayload})));
        },
    });
    const rows = [makeRow()];
    setActiveChoiceModal(document, makeChoiceModal('display-alpha', rows));

    await api.ensureChoiceRegionRestrictionsForTest();
    document.elements.set('webpack-subscriber-hub-data', makeChoiceSource(choicePayload({
        alpha: {
            display_item_machine_name: 'display-alpha',
            tpkds: [{exclusive_countries: ['CA'], disallowed_countries: []}],
        },
    })));
    await api.ensureChoiceRegionRestrictionsForTest();
    document.elements.delete('webpack-subscriber-hub-data');
    await api.ensureChoiceRegionRestrictionsForTest();

    assert.equal(requests, 1);
    assert.equal(api.getChoiceRegionSourceStateForTest().status, 'ready');
});

test('prefers live Choice data that appears while the route fallback is pending', async () => {
    let resolveRequest;
    const fallbackPayload = choicePayload({
        alpha: {
            display_item_machine_name: 'display-alpha',
            tpkds: [{exclusive_countries: ['CA'], disallowed_countries: []}],
        },
    });
    const {api, document} = loadApi({
        DOMParserImpl: createChoiceHtmlParser(),
        fetchImpl() {
            return new Promise(resolve => { resolveRequest = resolve; });
        },
    });
    const rows = [makeRow()];
    setActiveChoiceModal(document, makeChoiceModal('display-alpha', rows));
    api.setSteamSessionStateForTest({
        status: 'authenticated',
        account: {countryCode: 'US'},
        error: null,
    });
    const pending = api.ensureChoiceRegionRestrictionsForTest();
    document.elements.set('webpack-subscriber-hub-data', makeChoiceSource(choicePayload({
        alpha: {
            display_item_machine_name: 'display-alpha',
            tpkds: [{exclusive_countries: ['US'], disallowed_countries: []}],
        },
    })));
    api.ensureChoiceRegionRestrictionsForTest();

    resolveRequest(htmlResponse(choiceHtml({subscriber: fallbackPayload})));
    await pending;

    assert.match(panelText(choicePanel(rows[0])), /can be activated/);
    assert.equal(api.getChoiceRegionSourceStateForTest().status, 'ready');
});

test('pending Choice fallback rejection re-evaluates live metadata and later fails closed without it', async () => {
    let rejectRequest;
    const {api, document} = loadApi({
        DOMParserImpl: createChoiceHtmlParser(),
        fetchImpl() {
            return new Promise((resolve, reject) => { rejectRequest = reject; });
        },
    });
    const rows = [makeRow()];
    setActiveChoiceModal(document, makeChoiceModal('display-alpha', rows));
    const pending = api.ensureChoiceRegionRestrictionsForTest();
    document.elements.set('webpack-subscriber-hub-data', makeChoiceSource(choicePayload({
        alpha: {
            display_item_machine_name: 'display-alpha',
            tpkds: [{exclusive_countries: longCountryList(), disallowed_countries: []}],
        },
    })));
    api.ensureChoiceRegionRestrictionsForTest();
    choicePanel(rows[0]).querySelector('details').open = true;

    rejectRequest(new Error('fallback unavailable'));
    await pending;

    const livePanel = choicePanel(rows[0]);
    assert.ok(livePanel, 'terminal fallback must not clear newer live metadata');
    assert.equal(livePanel.querySelector('details').open, true);
    assert.equal(api.getChoiceRegionSourceStateForTest().status, 'failed');

    document.elements.delete('webpack-subscriber-hub-data');
    api.ensureChoiceRegionRestrictionsForTest();
    assert.equal(choicePanel(rows[0]), null);
});

test('invalid live Choice element or MIME falls through to HTML while normalized JSON MIME is usable', async () => {
    const payload = choicePayload({
        alpha: {
            display_item_machine_name: 'display-alpha',
            tpkds: [{exclusive_countries: ['US'], disallowed_countries: []}],
        },
    });
    for (const [label, source] of [
        ['non-script', makeChoiceSource(payload, {tagName: 'div'})],
        ['wrong MIME', makeChoiceSource(payload, {type: 'text/plain'})],
    ]) {
        let requests = 0;
        const {api, document} = loadApi({
            DOMParserImpl: createChoiceHtmlParser(),
            fetchImpl() {
                requests += 1;
                return Promise.resolve(htmlResponse(choiceHtml({subscriber: payload})));
            },
        });
        const rows = [makeRow()];
        setActiveChoiceModal(document, makeChoiceModal('display-alpha', rows));
        document.elements.set('webpack-subscriber-hub-data', source);
        await api.ensureChoiceRegionRestrictionsForTest();
        assert.equal(requests, 1, label);
        assert.equal(choicePanel(rows[0]) !== null, true, label);
    }

    let requests = 0;
    const normalized = loadApi({fetchImpl() { requests += 1; }});
    const rows = [makeRow()];
    setActiveChoiceModal(normalized.document, makeChoiceModal('display-alpha', rows));
    normalized.document.elements.set(
        'webpack-subscriber-hub-data',
        makeChoiceSource(payload, {type: 'Application/JSON; Charset=UTF-8'})
    );
    await normalized.api.ensureChoiceRegionRestrictionsForTest();
    assert.equal(requests, 0);
    assert.equal(choicePanel(rows[0]) !== null, true);
});

test('coalesces repeated Choice fallback refreshes while the route request is pending', async () => {
    let resolveRequest;
    let requests = 0;
    const response = new Promise(resolve => { resolveRequest = resolve; });
    const {api, document, context} = loadApi({
        DOMParserImpl: createChoiceHtmlParser(),
        fetchImpl() {
            requests += 1;
            return response;
        },
    });
    const rows = [makeRow()];
    const modal = makeChoiceModal(undefined, rows);
    document.choiceModal = modal;
    setActiveChoiceModal(document, modal);
    context.location.hash = '#choice-beta';

    const firstRefresh = api.ensureChoiceRegionRestrictionsForTest();
    const secondRefresh = api.ensureChoiceRegionRestrictionsForTest();
    assert.equal(requests, 1);
    assert.equal(secondRefresh, firstRefresh);
    resolveRequest(htmlResponse(choiceHtml({
        subscriber: choicePayload({
            'choice-beta': {
                display_item_machine_name: 'display-beta',
                tpkds: [{exclusive_countries: ['US'], disallowed_countries: []}],
            },
        }),
    })));
    await Promise.all([firstRefresh, secondRefresh]);

    assert.equal(hasClass(choicePanel(rows[0]), 'hb-helper-region-restrictions'), true);
});

test('renders only the current Choice modal when its hash changes during a pending fallback request', async () => {
    let resolveRequest;
    const response = new Promise(resolve => { resolveRequest = resolve; });
    const {api, document, context} = loadApi({
        DOMParserImpl: createChoiceHtmlParser(),
        fetchImpl() { return response; },
    });
    const oldRows = [makeRow()];
    const currentRows = [makeRow()];
    const oldModal = makeChoiceModal(undefined, oldRows);
    const currentModal = makeChoiceModal(undefined, currentRows);
    document.choiceModal = oldModal;
    setActiveChoiceModal(document, oldModal);
    context.location.hash = '#choice-old';

    const oldRefresh = api.ensureChoiceRegionRestrictionsForTest();
    setActiveChoiceModal(document, currentModal);
    context.location.hash = '#choice-current';
    const currentRefresh = api.ensureChoiceRegionRestrictionsForTest();
    resolveRequest(htmlResponse(choiceHtml({
        subscriber: choicePayload({
            'choice-old': {
                display_item_machine_name: 'display-old',
                tpkds: [{exclusive_countries: ['US'], disallowed_countries: []}],
            },
            'choice-current': {
                display_item_machine_name: 'display-current',
                tpkds: [{exclusive_countries: ['US'], disallowed_countries: []}],
            },
        }),
    })));
    await Promise.all([oldRefresh, currentRefresh]);

    assert.equal(oldModal.querySelectorAll('.hb-helper-region-restrictions').length, 0);
    assert.equal(currentModal.querySelectorAll('.hb-helper-region-restrictions').length, 1);
});

test('discards a completed Choice source request after the pathname or search route changes', async () => {
    let resolveFirst;
    let resolveSecond;
    const firstResponse = new Promise(resolve => { resolveFirst = resolve; });
    const secondResponse = new Promise(resolve => { resolveSecond = resolve; });
    const requests = [];
    const {api, document, context} = loadApi({
        DOMParserImpl: createChoiceHtmlParser(),
        fetchImpl(url) {
            requests.push(url);
            return requests.length === 1 ? firstResponse : secondResponse;
        },
    });
    const oldRows = [makeRow()];
    const currentRows = [makeRow()];
    const oldModal = makeChoiceModal(undefined, oldRows);
    const currentModal = makeChoiceModal(undefined, currentRows);
    setActiveChoiceModal(document, oldModal);
    context.location.hash = '#choice-old';

    const oldRefresh = api.ensureChoiceRegionRestrictionsForTest();
    context.location.pathname = '/membership/home';
    context.location.search = '?view=current';
    context.location.hash = '#choice-current';
    setActiveChoiceModal(document, currentModal);
    const currentRefresh = api.ensureChoiceRegionRestrictionsForTest();
    assert.deepEqual(requests, ['/membership', '/membership/home?view=current']);

    resolveFirst(htmlResponse(choiceHtml({
        subscriber: choicePayload({
            'choice-current': {
                display_item_machine_name: 'display-current-stale',
                tpkds: [{exclusive_countries: ['CA'], disallowed_countries: []}],
            },
        }),
    })));
    await oldRefresh;
    await flushMicrotasks();
    assert.equal(currentModal.querySelectorAll('.hb-helper-region-restrictions').length, 0);

    resolveSecond(htmlResponse(choiceHtml({
        subscriber: choicePayload({
            'choice-current': {
                display_item_machine_name: 'display-current',
                tpkds: [{exclusive_countries: ['US'], disallowed_countries: []}],
            },
        }),
    }), {url: 'https://www.humblebundle.com/membership/home?view=current'}));
    await currentRefresh;
    assert.equal(currentModal.querySelectorAll('.hb-helper-region-restrictions').length, 1);
});

test('fails closed and caches a terminal fallback result for HTTP, login, non-HTML, and invalid JSON responses', async () => {
    const validPayload = choicePayload({
        'choice-beta': {
            display_item_machine_name: 'display-beta',
            tpkds: [{exclusive_countries: ['US'], disallowed_countries: []}],
        },
    });
    const cases = [
        ['HTTP failure', htmlResponse('', {ok: false, status: 500})],
        ['non-200 success status', htmlResponse(choiceHtml({subscriber: validPayload}), {
            status: 201,
        })],
        ['login redirect', htmlResponse('', {
            redirected: true,
            url: 'https://www.humblebundle.com/user/login',
        })],
        ['login final URL', htmlResponse(choiceHtml({subscriber: validPayload}), {
            url: 'https://www.humblebundle.com/user/login',
        })],
        ['cross-origin final URL', htmlResponse(choiceHtml({subscriber: validPayload}), {
            url: 'https://example.com/membership',
        })],
        ['unparseable final URL', htmlResponse(choiceHtml({subscriber: validPayload}), {
            url: 'not a URL',
        })],
        ['different Choice final URL', htmlResponse(choiceHtml({subscriber: validPayload}), {
            url: 'https://www.humblebundle.com/membership/home?view=current',
        })],
        ['different Choice final search', htmlResponse(choiceHtml({subscriber: validPayload}), {
            url: 'https://www.humblebundle.com/membership?view=current',
        })],
        ['non-HTML response', htmlResponse('{}', {contentType: 'application/json'})],
        ['invalid webpack JSON', htmlResponse(choiceHtml({subscriber: '{not json'}))],
        ['non-script webpack node', htmlResponse(choiceHtml({
            subscriber: validPayload,
            subscriberTag: 'div',
        }))],
        ['wrong webpack MIME', htmlResponse(choiceHtml({
            subscriber: validPayload,
            subscriberType: 'text/plain',
        }))],
    ];
    for (const [label, response] of cases) {
        let requests = 0;
        const {api, document, context} = loadApi({
            DOMParserImpl: createChoiceHtmlParser(),
            fetchImpl() {
                requests += 1;
                return Promise.resolve(response);
            },
        });
        const rows = [makeRow()];
        const modal = makeChoiceModal(undefined, rows);
        document.choiceModal = modal;
        setActiveChoiceModal(document, modal);
        context.location.hash = '#choice-beta';

        await api.ensureChoiceRegionRestrictionsForTest();
        await api.ensureChoiceRegionRestrictionsForTest();

        assert.equal(requests, 1, `${label} should not refetch the same route`);
        assert.equal(modal.querySelectorAll('.hb-helper-region-restrictions').length, 0, label);
    }
});

test('warns only once globally when Choice HTML fallback fails across routes', async () => {
    const warnings = [];
    let requests = 0;
    const {api, document, context} = loadApi({
        DOMParserImpl: createChoiceHtmlParser(),
        fetchImpl() {
            requests += 1;
            return Promise.resolve(htmlResponse('', {ok: false, status: 500}));
        },
        consoleImpl: {
            log() {},
            warn(...values) { warnings.push(values.join(' ')); },
            error() {},
        },
    });
    const rows = [makeRow()];
    setActiveChoiceModal(document, makeChoiceModal(undefined, rows));
    context.location.hash = '#choice-beta';
    await api.ensureChoiceRegionRestrictionsForTest();

    context.location.pathname = '/membership/home';
    context.location.search = '?view=current';
    await api.ensureChoiceRegionRestrictionsForTest();

    assert.equal(requests, 2);
    assert.deepEqual(warnings, ['[HB-Helper] Choice restriction metadata unavailable.']);
});

test('projects fetched Choice data to identity and country arrays without retaining sensitive values', async () => {
    const sensitiveSentinel = 'gamekey-csrf-account-should-never-be-cached-or-logged';
    const messages = [];
    const gmWrites = [];
    const payload = choicePayload({
        'choice-beta': {
            display_item_machine_name: 'display-beta',
            tpkds: [{
                exclusive_countries: ['US'],
                disallowed_countries: ['CA'],
                gamekey: sensitiveSentinel,
            }],
            csrf_token: sensitiveSentinel,
            account: {id: sensitiveSentinel},
        },
    });
    const {api, document, context} = loadApi({
        DOMParserImpl: createChoiceHtmlParser(),
        fetchImpl() {
            return Promise.resolve(htmlResponse(choiceHtml({
                sources: [{id: 'renamed-choice-data', payload}],
            })));
        },
        consoleImpl: {
            log(...values) { messages.push(values.join(' ')); },
            warn(...values) { messages.push(values.join(' ')); },
            error(...values) { messages.push(values.join(' ')); },
        },
        gmSetValueImpl(...values) { gmWrites.push(values); },
    });
    assert.ok(api.parseChoiceRegionCatalogForTest, 'normalized Choice catalog test seam is missing');
    assert.ok(api.getChoiceRegionSourceStateForTest, 'Choice source-state test seam is missing');
    const parsed = api.parseChoiceRegionCatalogForTest(payload);
    assert.deepEqual(plain(parsed), {
        byChoiceIdentifier: {
            'choice-beta': {
                choiceIdentifier: 'choice-beta',
                display_item_machine_name: 'display-beta',
                tpkds: [{exclusive_countries: ['US'], disallowed_countries: ['CA']}],
            },
        },
        byDisplayMachineName: {
            'display-beta': {
                choiceIdentifier: 'choice-beta',
                display_item_machine_name: 'display-beta',
                tpkds: [{exclusive_countries: ['US'], disallowed_countries: ['CA']}],
            },
        },
    });
    const rows = [makeRow()];
    const modal = makeChoiceModal(undefined, rows);
    document.choiceModal = modal;
    setActiveChoiceModal(document, modal);
    context.location.hash = '#choice-beta';

    await api.ensureChoiceRegionRestrictionsForTest();
    const sourceState = api.getChoiceRegionSourceStateForTest();

    assert.equal(typeof sourceState.routeKey, 'string');
    assert.equal(sourceState.status, 'ready');
    assert.deepEqual(plain(sourceState.catalogs), [plain(parsed)]);
    assert.deepEqual(Object.keys(sourceState).sort(), ['catalogs', 'routeKey', 'status']);
    assert.equal(JSON.stringify(sourceState).includes(sensitiveSentinel), false);
    assert.equal(panelText(choicePanel(rows[0])).includes(sensitiveSentinel), false);
    assert.equal(JSON.stringify(gmWrites).includes(sensitiveSentinel), false);
    assert.equal(messages.some(message => message.includes(sensitiveSentinel)), false);
    sourceState.catalogs[0].byChoiceIdentifier['choice-beta']
        .tpkds[0].exclusive_countries.push(sensitiveSentinel);
    assert.equal(JSON.stringify(api.getChoiceRegionSourceStateForTest())
        .includes(sensitiveSentinel), false);
});

test('ignores unrelated cross-source fields but still rejects different restriction metadata', () => {
    const nonConflicting = loadApi();
    const nonConflictRows = [makeRow()];
    nonConflicting.document.choiceModal = makeChoiceModal('display-alpha', nonConflictRows);
    setActiveChoiceModal(nonConflicting.document, nonConflicting.document.choiceModal);
    const subscriber = makeChoiceSource();
    const monthly = makeChoiceSource();
    subscriber.textContent = choicePayload({
        alpha: {
            display_item_machine_name: 'display-alpha',
            public_description: 'subscriber-only copy',
            tpkds: [{exclusive_countries: ['US', 'ca', 'US'], disallowed_countries: [], price: 10}],
        },
    });
    monthly.textContent = choicePayload({
        alpha: {
            display_item_machine_name: 'display-alpha',
            public_description: 'monthly-only copy',
            tpkds: [{exclusive_countries: ['CA', 'us'], disallowed_countries: [], price: 20}],
        },
    });
    nonConflicting.document.elements.set('webpack-subscriber-hub-data', subscriber);
    nonConflicting.document.elements.set('webpack-monthly-product-data', monthly);
    nonConflicting.api.ensureChoiceRegionRestrictionsForTest();
    assert.equal(nonConflicting.document.choiceModal.querySelectorAll('.hb-helper-region-restrictions').length, 1);

    const conflicting = loadApi();
    const conflictRows = [makeRow()];
    conflicting.document.choiceModal = makeChoiceModal('display-alpha', conflictRows);
    setActiveChoiceModal(conflicting.document, conflicting.document.choiceModal);
    const conflictingSubscriber = makeChoiceSource();
    const conflictingMonthly = makeChoiceSource();
    conflictingSubscriber.textContent = choicePayload({
        alpha: {
            display_item_machine_name: 'display-alpha',
            tpkds: [{exclusive_countries: ['US'], disallowed_countries: []}],
        },
    });
    conflictingMonthly.textContent = choicePayload({
        alpha: {
            display_item_machine_name: 'display-alpha',
            tpkds: [{exclusive_countries: ['CA'], disallowed_countries: []}],
        },
    });
    conflicting.document.elements.set('webpack-subscriber-hub-data', conflictingSubscriber);
    conflicting.document.elements.set('webpack-monthly-product-data', conflictingMonthly);
    conflicting.api.ensureChoiceRegionRestrictionsForTest();
    assert.equal(conflicting.document.choiceModal.querySelectorAll('.hb-helper-region-restrictions').length, 0);
});

test('fails closed when an exact Choice hash has conflicting display identity only', () => {
    const {api, document, context} = loadApi();
    const rows = [makeRow()];
    setActiveChoiceModal(document, makeChoiceModal('display-alpha', rows));
    context.location.hash = '#alpha';
    document.elements.set('webpack-subscriber-hub-data', makeChoiceSource(choicePayload({
        alpha: {
            display_item_machine_name: 'display-alpha',
            tpkds: [{exclusive_countries: ['US'], disallowed_countries: []}],
        },
    })));
    document.elements.set('webpack-monthly-product-data', makeChoiceSource(choicePayload({
        alpha: {
            display_item_machine_name: 'display-renamed',
            tpkds: [{exclusive_countries: ['US'], disallowed_countries: []}],
        },
    })));

    api.ensureChoiceRegionRestrictionsForTest();

    assert.equal(document.elements.get('site-modal')
        .querySelector('.choice-modal')
        .querySelectorAll('.hb-helper-region-restrictions').length, 0);
});

test('cross-checks the selected Choice record identity when only title or hash is available', () => {
    const titleOnly = loadApi();
    const titleRows = [makeRow()];
    setActiveChoiceModal(titleOnly.document, makeChoiceModal('display-alpha', titleRows));
    titleOnly.document.elements.set(
        'webpack-subscriber-hub-data',
        makeChoiceSource(choicePayload({
            alpha: {
                display_item_machine_name: 'display-alpha',
                tpkds: [{exclusive_countries: ['US'], disallowed_countries: []}],
            },
        }))
    );
    titleOnly.document.elements.set(
        'webpack-monthly-product-data',
        makeChoiceSource(choicePayload({
            alpha: {
                display_item_machine_name: 'display-renamed',
                tpkds: [{exclusive_countries: ['US'], disallowed_countries: []}],
            },
        }))
    );
    titleOnly.api.ensureChoiceRegionRestrictionsForTest();
    assert.equal(choicePanel(titleRows[0]), null);

    const hashOnly = loadApi();
    const hashRows = [makeRow()];
    setActiveChoiceModal(hashOnly.document, makeChoiceModal(undefined, hashRows));
    hashOnly.context.location.hash = '#alpha';
    hashOnly.document.elements.set(
        'webpack-subscriber-hub-data',
        makeChoiceSource(choicePayload({
            alpha: {
                display_item_machine_name: 'display-alpha',
                tpkds: [{exclusive_countries: ['US'], disallowed_countries: []}],
            },
        }))
    );
    hashOnly.document.elements.set(
        'webpack-monthly-product-data',
        makeChoiceSource(choicePayload({
            beta: {
                display_item_machine_name: 'display-alpha',
                tpkds: [{exclusive_countries: ['US'], disallowed_countries: []}],
            },
        }))
    );
    hashOnly.api.ensureChoiceRegionRestrictionsForTest();
    assert.equal(choicePanel(hashRows[0]), null);
});

test('refreshes Choice restrictions on hashchange without refetching the same source route', async () => {
    let requests = 0;
    const timers = [];
    const {api, document, context, dispatchWindowEvent} = loadApi({
        setTimeoutImpl(callback) {
            timers.push(callback);
            return timers.length;
        },
        clearTimeoutImpl() {},
        fetchImpl() {
            requests += 1;
            return Promise.reject(new Error('live data should avoid fallback'));
        },
    });
    const source = makeChoiceSource();
    source.textContent = choicePayload({
        alpha: {
            display_item_machine_name: 'display-alpha',
            tpkds: [{exclusive_countries: ['US'], disallowed_countries: []}],
        },
        beta: {
            display_item_machine_name: 'display-beta',
            tpkds: [{exclusive_countries: [], disallowed_countries: ['US']}],
        },
    });
    document.elements.set('webpack-subscriber-hub-data', source);
    const firstRows = [makeRow()];
    const secondRows = [makeRow()];
    setActiveChoiceModal(document, makeChoiceModal(undefined, firstRows));
    context.location.hash = '#alpha';
    api.setSteamSessionStateForTest({
        status: 'authenticated',
        account: {countryCode: 'US'},
        error: null,
    });

    await api.installHelperRouteLifecycleForTest({
        syncSession: async () => {},
        reconcileBatch: async () => {},
        recoverCollection: async () => ({recovered: false}),
    });
    assert.equal(choicePanel(firstRows[0])?.className.includes(
        'hb-helper-region-restrictions'
    ), true);

    setActiveChoiceModal(document, makeChoiceModal(undefined, secondRows));
    context.location.hash = '#beta';
    dispatchWindowEvent('hashchange');
    assert.ok(timers.length > 0, 'hashchange should schedule a lightweight page refresh');
    timers.at(-1)();

    assert.match(panelText(choicePanel(secondRows[0])), /restricted/);
    assert.equal(requests, 0);
});

test('queued Choice hash redraws cannot revive A after an immediate A to B to A switch', async () => {
    const timers = [];
    const {api, document, context, dispatchWindowEvent} = loadApi({
        setTimeoutImpl(callback) {
            timers.push(callback);
            return timers.length;
        },
        clearTimeoutImpl() {},
    });
    document.elements.set('webpack-subscriber-hub-data', makeChoiceSource(choicePayload({
        alpha: {
            display_item_machine_name: 'display-alpha',
            tpkds: [{exclusive_countries: longCountryList(), disallowed_countries: []}],
        },
        beta: {
            display_item_machine_name: 'display-beta',
            tpkds: [{exclusive_countries: longCountryList(13), disallowed_countries: []}],
        },
    })));
    let rows = [makeRow()];
    context.location.hash = '#alpha';
    setActiveChoiceModal(document, makeChoiceModal('display-alpha', rows));
    await api.installHelperRouteLifecycleForTest({
        syncSession: async () => {},
        reconcileBatch: async () => {},
        recoverCollection: async () => ({recovered: false}),
    });
    choicePanel(rows[0]).querySelector('details').open = true;

    context.location.hash = '#beta';
    setActiveChoiceModal(document, makeChoiceModal('display-beta', [makeRow()]));
    context.location.hash = '#alpha';
    rows = [makeRow()];
    setActiveChoiceModal(document, makeChoiceModal('display-alpha', rows));
    dispatchWindowEvent('hashchange', {
        oldURL: 'https://www.humblebundle.com/membership#alpha',
        newURL: 'https://www.humblebundle.com/membership#beta',
    });
    dispatchWindowEvent('hashchange', {
        oldURL: 'https://www.humblebundle.com/membership#beta',
        newURL: 'https://www.humblebundle.com/membership#alpha',
    });
    timers.at(-1)();

    assert.equal(choicePanel(rows[0]).querySelector('details').open, false);
});

test('does not schedule a Choice restriction refresh for hash changes off Choice pages', async () => {
    const timers = [];
    const {api, context, dispatchWindowEvent} = loadApi({
        setTimeoutImpl(callback) {
            timers.push(callback);
            return timers.length;
        },
        clearTimeoutImpl() {},
    });
    context.location.pathname = '/user/settings';
    await api.installHelperRouteLifecycleForTest();

    dispatchWindowEvent('hashchange');

    assert.equal(timers.length, 0);
});

test('abandons a queued Choice hash refresh after navigation leaves the Choice page', async () => {
    const timers = [];
    let requests = 0;
    const {api, document, context, dispatchWindowEvent} = loadApi({
        setTimeoutImpl(callback) {
            timers.push(callback);
            return timers.length;
        },
        clearTimeoutImpl() {},
        fetchImpl() {
            requests += 1;
            return Promise.reject(new Error('stale Choice refresh must not fetch'));
        },
    });
    await api.installHelperRouteLifecycleForTest({
        syncSession: async () => {},
        reconcileBatch: async () => {},
        recoverCollection: async () => ({recovered: false}),
    });
    setActiveChoiceModal(document, makeChoiceModal(undefined, [makeRow()]));

    const timerCount = timers.length;
    dispatchWindowEvent('hashchange');
    assert.equal(timers.length, timerCount + 1);
    context.location.pathname = '/user/settings';
    timers.at(-1)();
    await flushMicrotasks();

    assert.equal(requests, 0);
    assert.equal(api.getChoiceRegionSourceStateForTest(), null);
});
