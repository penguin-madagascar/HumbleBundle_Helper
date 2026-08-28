const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const landingSortStorageKey = 'hb-helper-landing-sort-mode';
const sectionKeys = ['games', 'books', 'software'];

function createClassList() {
    const names = new Set();
    return {
        toggle(name, enabled) {
            if (enabled) names.add(name);
            else names.delete(name);
        },
        contains(name) { return names.has(name); },
    };
}

function createElement() {
    const children = [];
    const attributes = new Map();
    const listeners = new Map();
    return {
        children,
        parentElement: null,
        classList: createClassList(),
        className: '',
        dataset: {},
        style: {},
        appendChild(child) {
            child.parentElement = this;
            children.push(child);
            return child;
        },
        insertBefore(child, reference) {
            child.parentElement = this;
            const index = children.indexOf(reference);
            children.splice(index < 0 ? children.length : index, 0, child);
            return child;
        },
        addEventListener(type, listener) { listeners.set(type, listener); },
        click() { listeners.get('click')?.(); },
        setAttribute(name, value) { attributes.set(name, String(value)); },
        getAttribute(name) { return attributes.get(name) || null; },
        querySelector(selector) {
            const find = element => {
                for (const child of element.children) {
                    if (selector === '.hb-helper-landing-sort-controls'
                        && child.className === 'hb-helper-landing-sort-controls') {
                        return child;
                    }
                    const mode = selector.match(/^\[data-hb-helper-sort="(.+)"\]$/)?.[1];
                    if (mode && child.dataset.hbHelperSort === mode) return child;
                    const nested = find(child);
                    if (nested) return nested;
                }
                return null;
            };
            return find(this);
        },
    };
}

function loadLandingSortApi(values = new Map()) {
    const controlsBySection = new Map();
    const document = {
        body: createElement(),
        head: createElement(),
        documentElement: createElement(),
        createElement,
        addEventListener() {},
        getElementById() { return null; },
        querySelector(selector) {
            const sectionKey = selector.match(/data-hb-helper-sort-section="(.+)"/)?.[1];
            return sectionKey ? controlsBySection.get(sectionKey) || null : null;
        },
        querySelectorAll() { return []; },
    };
    const context = {
        __HB_HELPER_TEST__: true,
        console: {log() {}, warn() {}, error() {}},
        document,
        navigator: {language: 'en', languages: ['en']},
        location: {pathname: '/', href: 'https://www.humblebundle.com/'},
        DOMParser: class {
            parseFromString() { return {querySelector() { return null; }}; }
        },
        GM_getValue(name, fallback) { return values.has(name) ? values.get(name) : fallback; },
        GM_setValue(name, value) { values.set(name, value); },
        GM_deleteValue() {},
        GM_addValueChangeListener() {},
        GM_setClipboard() {},
        GM_registerMenuCommand() {},
        GM_xmlhttpRequest() {},
        setTimeout,
        clearTimeout,
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
    return {api: context.__HB_HELPER_TEST_API__, controlsBySection, values};
}

function createLandingSortState(controlsBySection, sectionKey) {
    const heading = createElement();
    heading.textContent = sectionKey[0].toUpperCase() + sectionKey.slice(1);
    const parent = createElement();
    const section = {
        header: null,
        querySelector(selector) {
            if (selector.startsWith('.hb-helper-landing-sort-header')) return this.header;
            return null;
        },
        querySelectorAll() { return [heading]; },
    };
    heading.parentElement = parent;
    heading.insertAdjacentElement = (position, header) => {
        assert.equal(position, 'beforebegin');
        section.header = header;
        header.parentElement = parent;
        const originalAppendChild = header.appendChild.bind(header);
        header.appendChild = child => {
            const appended = originalAppendChild(child);
            if (child.className === 'hb-helper-landing-sort-controls') {
                controlsBySection.set(sectionKey, child);
            }
            return appended;
        };
        return header;
    };
    const config = {sectionKey, heading: heading.textContent};
    return {config, section, products: [], entries: []};
}

function getButton(controls, mode) {
    return controls.querySelector(`[data-hb-helper-sort="${mode}"]`);
}

function assertActiveMode(controls, mode) {
    for (const candidate of ['default', 'ending', 'newest']) {
        const button = getButton(controls, candidate);
        assert.equal(button.classList.contains('hb-helper-landing-sort-active'), candidate === mode);
        assert.equal(button.getAttribute('aria-pressed'), String(candidate === mode));
    }
}

test('falls back to default for all sections when the saved mode is absent or invalid', () => {
    for (const storedMode of [undefined, 'unexpected']) {
        const values = new Map();
        if (storedMode !== undefined) values.set(landingSortStorageKey, storedMode);
        const {api} = loadLandingSortApi(values);
        assert.ok(api.getLandingSortMode, 'landing-sort persistence test API is missing');
        assert.deepEqual(sectionKeys.map(api.getLandingSortMode), ['default', 'default', 'default']);
    }
});

test('a click changes only its current section and persists the selected mode', () => {
    const {api, controlsBySection, values} = loadLandingSortApi();
    const games = createLandingSortState(controlsBySection, 'games');
    const books = createLandingSortState(controlsBySection, 'books');
    const gameControls = api.ensureLandingSortControls(games);
    const bookControls = api.ensureLandingSortControls(books);

    getButton(gameControls, 'ending').click();

    assert.equal(api.getLandingSortMode('games'), 'ending');
    assert.equal(api.getLandingSortMode('books'), 'default');
    assert.equal(values.get(landingSortStorageKey), 'ending');
    assertActiveMode(gameControls, 'ending');
    assertActiveMode(bookControls, 'default');
});

test('the last click initializes every section in a fresh script context', () => {
    const sharedValues = new Map();
    const first = loadLandingSortApi(sharedValues);
    const games = createLandingSortState(first.controlsBySection, 'games');
    const books = createLandingSortState(first.controlsBySection, 'books');

    getButton(first.api.ensureLandingSortControls(games), 'ending').click();
    getButton(first.api.ensureLandingSortControls(books), 'newest').click();

    const second = loadLandingSortApi(sharedValues);
    assert.deepEqual(sectionKeys.map(second.api.getLandingSortMode), ['newest', 'newest', 'newest']);
});

test('clicking default overwrites a previously saved mode and renders it as active after reload', () => {
    const values = new Map([[landingSortStorageKey, 'newest']]);
    const first = loadLandingSortApi(values);
    const games = createLandingSortState(first.controlsBySection, 'games');
    const gameControls = first.api.ensureLandingSortControls(games);

    assertActiveMode(gameControls, 'newest');
    getButton(gameControls, 'default').click();
    assert.equal(values.get(landingSortStorageKey), 'default');

    const second = loadLandingSortApi(values);
    const books = createLandingSortState(second.controlsBySection, 'books');
    const bookControls = second.api.ensureLandingSortControls(books);
    assertActiveMode(bookControls, 'default');
});
