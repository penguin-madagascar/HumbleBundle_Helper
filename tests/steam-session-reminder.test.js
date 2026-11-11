const assert = require('node:assert/strict');
const test = require('node:test');
const {loadUserscript} = require('./helpers/userscript');

function loadReminder(language = 'en') {
    const page = loadUserscript({values: new Map([['hb-helper-language-v1', language]])});
    const reminder = page.document.createElement('div');
    page.document.body.appendChild(reminder);
    const render = state => {
        page.api.setSteamSessionStateForTest(state);
        page.api.renderSteamSessionReminderForTest(reminder, {loggedOutMessageKey: 'steamSyncLoggedOut'});
    };
    return {...page, reminder, render};
}

for (const [language, labels] of [
    ['en', {retry: 'Check again', refresh: 'Open Steam to refresh session', refreshing: 'Refreshing Steam session…'}],
    ['zh-CN', {retry: '重新检测', refresh: '打开 Steam 刷新会话', refreshing: '正在刷新 Steam 会话…'}],
]) {
    test(`${language}: unverifiable sessions offer a Store refresh link and recheck action`, () => {
        const {reminder, render} = loadReminder(language);
        render({status: 'error', account: null, error: new Error('Unavailable')});
        assert.equal(reminder.querySelector('a')?.getAttribute('href'), 'https://store.steampowered.com/');
        assert.equal(reminder.querySelector('a')?.textContent, labels.refresh);
        assert.equal(reminder.querySelector('a')?.target, '_blank');
        assert.equal(reminder.querySelector('a')?.rel, 'noopener noreferrer');
        assert.equal(reminder.querySelector('button')?.textContent, labels.retry);
        assert.equal(reminder.querySelector('button')?.disabled, false);
        assert.equal(reminder.getAttribute('role'), 'status');
        assert.equal(reminder.getAttribute('aria-live'), 'polite');
    });

    test(`${language}: confirmed logout keeps a login link and recheck button`, () => {
        const {reminder, render} = loadReminder(language);
        render({status: 'error', account: null, error: new Error('Unavailable')});
        render({status: 'logged-out', account: null, error: null});
        assert.equal(reminder.querySelector('a')?.getAttribute('href'), 'https://store.steampowered.com/login/');
        assert.equal(reminder.querySelector('button')?.textContent, labels.retry);
        assert.equal(reminder.querySelectorAll('button').length, 1);
        assert.equal(reminder.querySelectorAll('a').length, 1);
    });

    test(`${language}: renewal progress replaces a retained synchronization error`, () => {
        const {reminder, render} = loadReminder(language);
        const error = new Error('Previous failure');
        render({status: 'error', account: null, error});
        render({status: 'syncing', phase: 'refreshing', account: null, error});
        assert.equal(reminder.querySelector('.hb-helper-login-message').textContent, labels.refreshing);
        assert.equal(reminder.querySelector('button')?.disabled, true);
        render({status: 'syncing', account: null, error: null});
        assert.equal(reminder.querySelector('a'), null);
        assert.equal(reminder.querySelector('button'), null);
    });
}

test('a retained synchronization error keeps recheck disabled until detection settles', () => {
    const {reminder, render} = loadReminder();
    const error = new Error('Previous failure');
    render({status: 'error', account: null, error});
    render({status: 'syncing', account: null, error});
    assert.equal(reminder.querySelector('button')?.disabled, true);
    assert.match(reminder.querySelector('.hb-helper-login-message').textContent, /Could not synchronize/);
});

test('renewal on initial detection displays progress without opening a Steam page', () => {
    const {reminder, render, requests} = loadReminder();
    render({status: 'syncing', phase: 'refreshing', account: null, error: null});
    assert.equal(reminder.querySelector('.hb-helper-login-message').textContent, 'Refreshing Steam session…');
    assert.equal(reminder.querySelector('a'), null);
    assert.equal(reminder.querySelector('button'), null);
    assert.equal(requests.length, 0);
});
