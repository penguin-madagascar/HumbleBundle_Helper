// ==UserScript==
// @name         HumbleBundle Helper
// @name:zh-CN   Humble Bundle 助手
// @namespace    https://github.com/penguin-madagascar/HumbleBundle_Helper
// @version      0.0.25
// @description  Highlight Steam games and summarize regional prices on Humble Bundle
// @description:zh-CN 在 Humble Bundle 上标记 Steam 游戏并汇总区域价格
// @icon         https://raw.githubusercontent.com/penguin-madagascar/HumbleBundle_Helper/main/assets/icon-32.png
// @icon64       https://raw.githubusercontent.com/penguin-madagascar/HumbleBundle_Helper/main/assets/icon-64.png
// @author       PenguinOfMadagascar
// @license      MIT
// @match        https://www.humblebundle.com/*
// @match        https://store.steampowered.com/account/registerkey*
// @run-at       document-start
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @connect      api.steampowered.com
// @connect      store.steampowered.com
// @connect      steamcommunity.com
// @connect      api.xiaoheihe.cn
// @connect      api.frankfurter.dev
// ==/UserScript==

(function () {
    'use strict';

    const style = document.createElement('style');
    style.textContent = `
    .tier-item-view.owned {
      box-sizing: border-box !important;
      background: rgba(100,255,100,.35) !important;
      border-radius: 8px !important;
      padding: 6px !important;
    }
    .tier-item-view.wishlist {
      box-sizing: border-box !important;
      background: rgba(100,100,255,.35) !important;
      border-radius: 8px !important;
      padding: 6px !important;
    }
    .choice-content.js-open-choice-modal.owned {
      background: rgba(100,255,100,.35) !important;
    }
    .choice-content.js-open-choice-modal.wishlist {
      background: rgba(100,100,255,.35) !important;
    }
    #hb-helper-controls {
      box-sizing: border-box !important;
      margin: 8px 0 !important;
    }
    #hb-helper-login-reminder {
      box-sizing: border-box !important;
      background: rgba(0, 0, 0, 0.5) !important;
      color: #fff !important;
      padding: 10px !important;
      margin: 8px 0 !important;
      border-radius: 4px !important;
    }
    #hb-helper-login-reminder a {
      color: #fff !important;
    }
    #steamgifts-discussion {
      box-sizing: border-box !important;
      margin: 8px 0 !important;
    }
    #steamgifts-discussion a {
      display: inline-block !important;
      background: #3b7bbf !important;
      color: #fff !important;
      padding: 6px 10px !important;
      border-radius: 4px !important;
      text-decoration: none !important;
    }
    #steamgifts-discussion a:hover {
      opacity: .9 !important;
    }
    .hb-helper-steam-store-link {
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      box-sizing: border-box !important;
      background: #1b75bb !important;
      color: #fff !important;
      min-height: 36px !important;
      padding: 8px 14px !important;
      margin: 8px 0 !important;
      border-radius: 4px !important;
      text-decoration: none !important;
      font-weight: bold !important;
      line-height: 1.2 !important;
      cursor: pointer !important;
    }
    .hb-helper-steam-store-row {
      box-sizing: border-box !important;
      display: block !important;
      flex-basis: 100% !important;
      grid-column: 1 / -1 !important;
      margin-top: 8px !important;
      width: 100% !important;
    }
    .hb-helper-steam-store-link:hover {
      opacity: .9 !important;
    }
    #hb-helper-price-summary {
      box-sizing: border-box !important;
      background: rgba(0, 0, 0, 0.5) !important;
      color: #fff !important;
      padding: 10px !important;
      margin: 8px 0 !important;
      border-radius: 4px !important;
      line-height: 1.5 !important;
    }
    #hb-helper-price-summary .hb-helper-price-title {
      font-weight: bold !important;
    }
    #hb-helper-price-summary .hb-helper-price-header {
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
      gap: 12px !important;
      margin-bottom: 4px !important;
    }
    #hb-helper-price-scope {
      flex: 0 0 auto !important;
      background: rgba(255, 255, 255, 0.15) !important;
      border: 1px solid rgba(255, 255, 255, 0.4) !important;
      border-radius: 4px !important;
      color: #fff !important;
      cursor: pointer !important;
      padding: 3px 8px !important;
    }
    #hb-helper-price-scope:hover:not(:disabled) {
      background: rgba(255, 255, 255, 0.25) !important;
    }
    #hb-helper-price-scope:disabled {
      cursor: default !important;
      opacity: 0.5 !important;
    }
    #hb-helper-choice-activation-controls {
      box-sizing: border-box !important;
      background: rgba(0, 0, 0, 0.5) !important;
      border-radius: 4px !important;
      color: #fff !important;
      display: flex !important;
      flex-wrap: wrap !important;
      gap: 8px !important;
      line-height: 1.5 !important;
      margin: 8px 0 !important;
      padding: 10px !important;
    }
    #hb-helper-choice-activation-controls button {
      box-sizing: border-box !important;
      border: 1px solid transparent !important;
      border-radius: 4px !important;
      color: #fff !important;
      cursor: pointer !important;
      font: inherit !important;
      font-weight: 700 !important;
      min-height: 32px !important;
      padding: 5px 10px !important;
    }
    #hb-helper-choice-activation-controls button[data-hb-helper-choice-action="activate"] {
      background: rgba(35, 134, 54, 0.92) !important;
      border-color: rgba(93, 190, 117, 0.9) !important;
    }
    #hb-helper-choice-activation-controls button[data-hb-helper-choice-action="activate"]:hover:not(:disabled) {
      background: rgba(46, 160, 67, 0.96) !important;
    }
    #hb-helper-choice-activation-controls button[data-hb-helper-choice-action="select-unowned"] {
      background: rgba(9, 105, 218, 0.92) !important;
      border-color: rgba(84, 174, 255, 0.9) !important;
    }
    #hb-helper-choice-activation-controls button[data-hb-helper-choice-action="select-unowned"]:hover:not(:disabled) {
      background: rgba(31, 111, 235, 0.96) !important;
    }
    #hb-helper-choice-activation-controls button[data-hb-helper-choice-action="select"] {
      background: rgba(111, 66, 193, 0.92) !important;
      border-color: rgba(163, 113, 247, 0.9) !important;
    }
    #hb-helper-choice-activation-controls button[data-hb-helper-choice-action="select"]:hover:not(:disabled) {
      background: rgba(130, 80, 223, 0.96) !important;
    }
    #hb-helper-choice-activation-controls button[data-hb-helper-choice-action="clear"] {
      background: rgba(207, 34, 46, 0.92) !important;
      border-color: rgba(255, 129, 130, 0.9) !important;
    }
    #hb-helper-choice-activation-controls button[data-hb-helper-choice-action="clear"]:hover:not(:disabled) {
      background: rgba(218, 54, 51, 0.96) !important;
    }
    #hb-helper-choice-activation-controls button:disabled {
      cursor: default !important;
      opacity: 0.5 !important;
    }
    #hb-helper-choice-activation-controls .hb-helper-choice-status {
      flex: 1 0 100% !important;
      min-height: 20px !important;
    }
    .choice-content.js-open-choice-modal.hb-helper-choice-selected {
      position: relative !important;
      box-shadow: 0 0 0 4px #ffbf00 !important;
    }
    .choice-content.js-open-choice-modal.hb-helper-choice-selected::before {
      content: '';
      position: absolute;
      inset: 0;
      background: rgba(255, 191, 0, 0.25);
      pointer-events: none;
      z-index: 1;
    }
    .choice-content.js-open-choice-modal.hb-helper-choice-selected::after {
      content: '✓';
      position: absolute;
      top: 8px;
      right: 8px;
      display: grid;
      width: 28px;
      height: 28px;
      place-items: center;
      border-radius: 50%;
      background: #ffbf00;
      color: #1a1a1a;
      font-size: 20px;
      font-weight: 700;
      line-height: 1;
      pointer-events: none;
      z-index: 2;
    }
    html.hb-helper-choice-select-mode .choice-content.js-open-choice-modal {
      cursor: pointer !important;
    }
    html.hb-helper-choice-select-mode .choice-content.js-open-choice-modal * {
      pointer-events: none !important;
    }
    #hb-helper-steam-activation-status {
      background: rgba(0, 0, 0, 0.86) !important;
      border-radius: 4px !important;
      box-sizing: border-box !important;
      color: #fff !important;
      font: 14px/1.45 Arial, sans-serif !important;
      max-width: min(420px, calc(100vw - 24px)) !important;
      padding: 12px !important;
      position: fixed !important;
      right: 12px !important;
      top: 72px !important;
      z-index: 2147483647 !important;
    }
    #hb-helper-steam-activation-status strong {
      display: block !important;
      margin-bottom: 4px !important;
    }
    .hb-helper-landing-sort-header {
      box-sizing: border-box !important;
      display: flex !important;
      align-items: center !important;
      flex-wrap: nowrap !important;
      gap: 12px !important;
      margin-bottom: 28px !important;
      width: 100% !important;
    }
    .hb-helper-landing-sort-header > h3 {
      flex: 1 1 auto !important;
      margin: 0 !important;
      min-width: 0 !important;
    }
    .hb-helper-landing-sort-controls {
      display: inline-flex !important;
      align-items: center !important;
      flex-wrap: wrap !important;
      flex: 0 0 auto !important;
      gap: 6px !important;
      justify-content: flex-end !important;
      margin-left: auto !important;
      vertical-align: middle !important;
    }
    .hb-helper-landing-sort-controls button {
      box-sizing: border-box !important;
      background: rgba(255, 255, 255, 0.12) !important;
      border: 1px solid rgba(255, 255, 255, 0.35) !important;
      border-radius: 4px !important;
      color: inherit !important;
      cursor: pointer !important;
      font: inherit !important;
      font-size: 14px !important;
      font-weight: 700 !important;
      line-height: 1.2 !important;
      min-height: 32px !important;
      padding: 6px 10px !important;
    }
    .hb-helper-landing-sort-controls button:hover {
      background: rgba(255, 255, 255, 0.2) !important;
    }
    .hb-helper-landing-sort-controls button:focus-visible {
      outline: 2px solid currentColor !important;
      outline-offset: 2px !important;
    }
    .hb-helper-landing-sort-controls button.hb-helper-landing-sort-active {
      background: rgba(255, 255, 255, 0.28) !important;
      border-color: currentColor !important;
    }
    @media (max-width: 640px) {
      .hb-helper-landing-sort-header {
        align-items: flex-start !important;
        flex-wrap: wrap !important;
      }
      .hb-helper-landing-sort-controls {
        display: flex !important;
        flex: 1 0 100% !important;
        justify-content: flex-start !important;
        margin-left: 0 !important;
        margin-bottom: 10px !important;
      }
    }
    #hb-helper-price-summary .hb-helper-price-value {
      font-weight: bold !important;
    }
    #hb-helper-price-summary .hb-helper-match-details {
      margin-top: 4px !important;
    }
    #hb-helper-price-summary .hb-helper-match-details summary {
      display: inline-flex !important;
      align-items: center !important;
      gap: 6px !important;
      background: rgba(255, 255, 255, 0.15) !important;
      border: 1px solid rgba(255, 255, 255, 0.4) !important;
      border-radius: 4px !important;
      color: #fff !important;
      cursor: pointer !important;
      list-style: none !important;
      margin-top: 2px !important;
      padding: 3px 8px !important;
      user-select: none !important;
    }
    #hb-helper-price-summary .hb-helper-match-details summary::-webkit-details-marker {
      display: none !important;
    }
    #hb-helper-price-summary .hb-helper-match-details summary::before {
      content: '' !important;
      border-bottom: 4px solid transparent !important;
      border-left: 6px solid currentColor !important;
      border-top: 4px solid transparent !important;
      transition: transform 0.15s ease !important;
    }
    #hb-helper-price-summary .hb-helper-match-details summary:hover {
      background: rgba(255, 255, 255, 0.25) !important;
    }
    #hb-helper-price-summary .hb-helper-match-details summary:focus-visible {
      outline: 2px solid #fff !important;
      outline-offset: 2px !important;
    }
    #hb-helper-price-summary .hb-helper-match-details[open] summary::before {
      transform: rotate(90deg) !important;
    }
    #hb-helper-price-summary .hb-helper-match-group {
      margin-top: 4px !important;
    }
    #hb-helper-price-summary .hb-helper-match-group ul {
      margin: 2px 0 0 20px !important;
      padding: 0 !important;
    }
    #hb-helper-settings-dialog {
      box-sizing: border-box !important;
      border: 0 !important;
      border-radius: 8px !important;
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.28) !important;
      color: #222 !important;
      font: 14px/1.4 Arial, sans-serif !important;
      max-width: min(420px, calc(100vw - 32px)) !important;
      padding: 20px !important;
      width: 420px !important;
    }
    #hb-helper-settings-dialog::backdrop {
      background: rgba(0, 0, 0, 0.38) !important;
    }
    #hb-helper-settings-dialog h2 {
      font-size: 18px !important;
      line-height: 1.3 !important;
      margin: 0 0 16px !important;
    }
    #hb-helper-settings-dialog .hb-helper-settings-row {
      display: grid !important;
      gap: 6px !important;
      margin-bottom: 18px !important;
    }
    #hb-helper-settings-dialog label {
      font-weight: 700 !important;
    }
    #hb-helper-settings-dialog select {
      box-sizing: border-box !important;
      font: inherit !important;
      min-height: 36px !important;
      padding: 6px 8px !important;
      width: 100% !important;
    }
    #hb-helper-settings-dialog .hb-helper-settings-actions {
      display: flex !important;
      gap: 8px !important;
      justify-content: flex-end !important;
    }
    #hb-helper-settings-dialog button {
      box-sizing: border-box !important;
      cursor: pointer !important;
      font: inherit !important;
      min-height: 34px !important;
      padding: 6px 12px !important;
    }`;
    (document.head || document.documentElement).appendChild(style);

    const languageValueKey = 'hb-helper-language-v1';
    const languageSettings = ['auto', 'en', 'zh-CN'];
    const messages = {
        en: {
            settingsMenu: 'Settings',
            settingsTitle: 'Humble Bundle Helper Settings',
            languageLabel: 'Language',
            languageAuto: 'Follow browser',
            languageEnglish: 'English',
            languageChinese: '中文',
            cancel: 'Cancel',
            save: 'Save',
            landingDefaultLabel: 'Default',
            landingDefaultTitle: 'Use Humble Bundle default order',
            landingEndingLabel: 'Ending Soon',
            landingEndingTitle: 'Sort bundles by nearest end date',
            landingNewestLabel: 'Newly Added',
            landingNewestTitle: 'Sort bundles by newest start date',
            landingSortAria: 'Sort {heading} bundles',
            loginSteamLoadAccountData: 'Login to Steam to load account data',
            steamInvalidAccountData: 'Steam returned invalid account data',
            steamGiftsSearch: 'Search SteamGifts discussions (for potential region lock)',
            loadingPriceTotals: 'Loading Steam price totals...',
            loginSteamCheckOwned: 'Login to Steam to check owned games',
            refreshAfterLogin: 'Please refresh this page after login',
            viewOnSteam: 'View on Steam',
            requestFailedHttp: 'Request failed with HTTP {status}',
            networkRequestFailed: 'Network request failed',
            xiaoheiheNoPrice: 'Xiaoheihe has no {region} price for Steam app {appId}',
            xiaoheiheInvalidPrice: 'Invalid Xiaoheihe price for Steam app {appId}',
            invalidExchangeRate: 'Invalid Frankfurter exchange rate',
            steamItemNotFound: 'Steam item not found',
            regionalPriceUnavailable: 'Regional price unavailable',
            showUnpricedItems: ({count}) =>
                `Show ${count} unpriced item${count === 1 ? '' : 's'}`,
            unavailable: 'Unavailable',
            hbPrice: 'HB: {price}',
            showUnowned: 'Show unowned',
            showAll: 'Show all',
            togglePriceScope: 'Toggle between all games and games not owned on Steam',
            loginFilterOwned: 'Login to Steam to filter out owned games',
            allItems: 'all items',
            unownedItems: 'unowned items',
            priceTotalsTitle: 'Steam price totals ({priceRegion})',
            currentPrice: 'Current',
            originalPrice: 'Original',
            historicalLow: 'Historical low',
            matchedItems: '{matched}/{selected} Steam items identified ({scope})',
            pricedItems: '{priced}/{matched} identified items have price history',
            choiceActivate: 'Activate',
            choiceSelectUnowned: 'Select unowned',
            choiceSelect: 'Select',
            choiceSelectDone: 'Done',
            choiceClearSelection: 'Clear',
            choiceSelectedCount: '{count} selected',
            choiceNoSelection: 'Select at least one Choice game first',
            choiceRevealStarting: 'Preparing {count} selected game key(s)...',
            choiceRevealProgress: 'Revealing key for {title} ({current}/{total})...',
            choiceRevealFailed: 'Could not reveal a Steam key for {title}',
            choiceQueueReady: 'Opening Steam activation page for {count} key(s)...',
            steamActivationTitle: 'Humble Choice key activation',
            steamActivationLoginRequired: 'Log in to Steam, then refresh this page to continue activating queued keys',
            steamActivationProgress: 'Activating {title} ({current}/{total})...',
            steamActivationComplete: 'Activated {count} key(s)',
            steamActivationFailed: 'Activation failed for {title}: {message}',
            steamActivationFailedDetail: 'Steam returned result detail {detail}',
            noRegionRestrictions: 'No Region Restrictions',
            exclusiveCountries: 'Exclusive countries: {countries}',
            disallowedCountries: 'Disallowed countries: {countries}',
        },
        'zh-CN': {
            settingsMenu: '设置',
            settingsTitle: 'Humble Bundle Helper 设置',
            languageLabel: '语言',
            languageAuto: '跟随浏览器',
            languageEnglish: 'English',
            languageChinese: '中文',
            cancel: '取消',
            save: '保存',
            landingDefaultLabel: '默认',
            landingDefaultTitle: '使用 Humble Bundle 默认排序',
            landingEndingLabel: '即将结束',
            landingEndingTitle: '按最近结束时间排序慈善包',
            landingNewestLabel: '最新添加',
            landingNewestTitle: '按最新开始时间排序慈善包',
            landingSortAria: '排序 {heading} 慈善包',
            loginSteamLoadAccountData: '登录 Steam 后才能加载账号数据',
            steamInvalidAccountData: 'Steam 返回了无效的账号数据',
            steamGiftsSearch: '搜索 SteamGifts 讨论（查看可能的区域限制）',
            loadingPriceTotals: '正在加载 Steam 价格汇总...',
            loginSteamCheckOwned: '登录 Steam 以检查已拥有游戏',
            refreshAfterLogin: '登录后请刷新此页面',
            viewOnSteam: '在 Steam 中查看',
            requestFailedHttp: '请求失败，HTTP 状态码 {status}',
            networkRequestFailed: '网络请求失败',
            xiaoheiheNoPrice: '小黑盒没有 Steam 应用 {appId} 的 {region} 区价格',
            xiaoheiheInvalidPrice: 'Steam 应用 {appId} 的小黑盒价格无效',
            invalidExchangeRate: 'Frankfurter 汇率无效',
            steamItemNotFound: '未找到 Steam 项目',
            regionalPriceUnavailable: '区域价格不可用',
            showUnpricedItems: ({count}) => `显示 ${count} 个无法定价的项目`,
            unavailable: '不可用',
            hbPrice: 'HB：{price}',
            showUnowned: '显示未拥有',
            showAll: '显示全部',
            togglePriceScope: '在所有游戏和 Steam 未拥有游戏之间切换',
            loginFilterOwned: '登录 Steam 后可过滤已拥有游戏',
            allItems: '全部项目',
            unownedItems: '未拥有项目',
            priceTotalsTitle: 'Steam 价格汇总（{priceRegion}）',
            currentPrice: '当前价格',
            originalPrice: '原价',
            historicalLow: '史低价格',
            matchedItems: '已识别 {matched}/{selected} 个 Steam 项目（{scope}）',
            pricedItems: '{matched} 个已识别项目中有 {priced} 个包含价格历史',
            choiceActivate: '激活',
            choiceSelectUnowned: '选择未拥有',
            choiceSelect: '选择',
            choiceSelectDone: '完成选择',
            choiceClearSelection: '清空选择',
            choiceSelectedCount: '已选择 {count} 个',
            choiceNoSelection: '请先至少选择一个 Humble Choice 游戏',
            choiceRevealStarting: '正在准备 {count} 个已选游戏的 key...',
            choiceRevealProgress: '正在显示 {title} 的 key（{current}/{total}）...',
            choiceRevealFailed: '无法显示 {title} 的 Steam key',
            choiceQueueReady: '正在打开 Steam 激活页面，将激活 {count} 个 key...',
            steamActivationTitle: 'Humble Choice key 激活',
            steamActivationLoginRequired: '请登录 Steam，然后刷新此页面继续激活等待队列',
            steamActivationProgress: '正在激活 {title}（{current}/{total}）...',
            steamActivationComplete: '已激活 {count} 个 key',
            steamActivationFailed: '{title} 激活失败：{message}',
            steamActivationFailedDetail: 'Steam 返回结果详情 {detail}',
            noRegionRestrictions: '无区域限制',
            exclusiveCountries: '仅限国家/地区：{countries}',
            disallowedCountries: '禁止激活国家/地区：{countries}',
        },
    };

    function getBrowserLanguage() {
        const languages = Array.isArray(navigator.languages) && navigator.languages.length
            ? navigator.languages
            : [navigator.language];
        return languages.some(language => String(language || '').toLowerCase().startsWith('zh'))
            ? 'zh-CN'
            : 'en';
    }

    function getLanguageSetting() {
        const savedLanguage = GM_getValue(languageValueKey, 'auto');
        return languageSettings.includes(savedLanguage) ? savedLanguage : 'auto';
    }

    function getCurrentLanguage() {
        const languageSetting = getLanguageSetting();
        return languageSetting === 'auto' ? getBrowserLanguage() : languageSetting;
    }

    const currentLanguage = getCurrentLanguage();

    function t(key, values = {}) {
        const message = messages[currentLanguage]?.[key] ?? messages.en[key] ?? key;
        const template = typeof message === 'function' ? message(values) : message;
        return String(template).replace(/\{(\w+)\}/g, (match, name) =>
            Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : match
        );
    }

    function saveSettingsDialog(event) {
        event.preventDefault();
        const languageSelect = document.getElementById('hb-helper-settings-language');
        const languageSetting = languageSettings.includes(languageSelect?.value)
            ? languageSelect.value
            : 'auto';
        GM_setValue(languageValueKey, languageSetting);
        location.reload();
    }

    function createSettingsDialog() {
        const dialog = document.createElement('dialog');
        dialog.id = 'hb-helper-settings-dialog';

        const form = document.createElement('form');
        form.addEventListener('submit', saveSettingsDialog);

        const title = document.createElement('h2');
        title.textContent = t('settingsTitle');

        const row = document.createElement('div');
        row.className = 'hb-helper-settings-row';

        const label = document.createElement('label');
        label.htmlFor = 'hb-helper-settings-language';
        label.textContent = t('languageLabel');

        const languageSelect = document.createElement('select');
        languageSelect.id = 'hb-helper-settings-language';
        [
            ['auto', t('languageAuto')],
            ['en', t('languageEnglish')],
            ['zh-CN', t('languageChinese')],
        ].forEach(([value, labelText]) => {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = labelText;
            languageSelect.appendChild(option);
        });

        row.append(label, languageSelect);

        const actions = document.createElement('div');
        actions.className = 'hb-helper-settings-actions';

        const cancelButton = document.createElement('button');
        cancelButton.type = 'button';
        cancelButton.textContent = t('cancel');
        cancelButton.addEventListener('click', () => dialog.close());

        const saveButton = document.createElement('button');
        saveButton.type = 'submit';
        saveButton.textContent = t('save');

        actions.append(cancelButton, saveButton);
        form.append(title, row, actions);
        dialog.appendChild(form);
        (document.body || document.documentElement).appendChild(dialog);
        return dialog;
    }

    function openSettingsDialog() {
        const dialog = document.getElementById('hb-helper-settings-dialog')
            || createSettingsDialog();
        const languageSelect = dialog.querySelector('#hb-helper-settings-language');
        if (languageSelect) languageSelect.value = getLanguageSetting();
        if (!dialog.open && typeof dialog.showModal === 'function') {
            dialog.showModal();
        } else {
            dialog.setAttribute('open', '');
        }
    }

    function registerSettingsMenuCommand() {
        GM_registerMenuCommand(t('settingsMenu'), openSettingsDialog);
    }

    registerSettingsMenuCommand();

    function normalizeSteamTitle(value) {
        return String(value)
            .replace(/[™®©℠]/g, '')
            .replace(/&/g, 'and')
            .normalize('NFKD')
            .replace(/\p{M}/gu, '')
            .toLowerCase()
            .replace(/[^\p{L}\p{N}]/gu, '');
    }

    const communityAppSearchCache = new Map();
    const storeAppSearchCache = new Map();
    const steamAppMatchCache = new Map();
    const priceHistoryCache = new Map();
    const exchangeRateCache = new Map();
    const steamAccountCacheKey = 'steam-account-data-v1';
    const choiceSelectionCacheKey = 'hb-helper-choice-selected-games-v1';
    const steamActivationQueueKey = 'hb-helper-steam-activation-queue-v1';
    const steamRequestOptions = {
        cookiePartition: {topLevelSite: 'https://store.steampowered.com'},
    };
    let bundleItemsByTitle;
    let steamAccountDataPromise;
    let pageRefreshTimer;
    let landingSortRefreshTimer;
    let priceTotalsRunId = 0;
    let lastPriceTitlesKey = '';
    let lastPriceResult;
    let priceScope = 'all';
    let landingPageDataCache;
    let landingPageDataSourcePromise;
    const landingSortModeBySection = new Map();
    let steamLoginRequired = false;
    let ownedApps;
    let wishlistApps;
    let choiceSelectionMode = false;
    let choiceActivationInProgress = false;
    let steamActivationInProgress = false;
    const cachedChoiceSelection = GM_getValue(choiceSelectionCacheKey, []);
    const selectedChoiceGameIds = new Set(
        Array.isArray(cachedChoiceSelection) ? cachedChoiceSelection : []
    );
    const landingSortModes = [
        {
            key: 'default',
            labelKey: 'landingDefaultLabel',
            titleKey: 'landingDefaultTitle',
        },
        {
            key: 'ending',
            labelKey: 'landingEndingLabel',
            titleKey: 'landingEndingTitle',
        },
        {
            key: 'newest',
            labelKey: 'landingNewestLabel',
            titleKey: 'landingNewestTitle',
        },
    ];
    const landingSortSectionConfigs = [
        {
            sectionKey: 'games',
            heading: 'Games',
            dataKey: 'games',
            mosaicSelector: '.js-games-mosaic',
            pathPrefix: '/games/',
            stamp: 'games',
        },
        {
            sectionKey: 'books',
            heading: 'Books',
            dataKey: 'books',
            mosaicSelector: '.js-books-mosaic',
            pathPrefix: '/books/',
            stamp: 'books',
        },
        {
            sectionKey: 'software',
            heading: 'Software',
            dataKey: 'software',
            mosaicSelector: '.js-software-mosaic',
            pathPrefix: '/software/',
            stamp: 'software',
        },
    ];
    const europeanSteamCountries = new Set([
        'AT', 'BE', 'CY', 'DE', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR',
        'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PT', 'SI', 'SK',
    ]);
    const choiceMonthPattern = new RegExp(
        '^(January|February|March|April|May|June|July|August|September|October|November|December)'
        + '\\s+\\d{4}\\s+GAMES$',
        'i'
    );

    function searchSteamCommunity(keyword) {
        if (communityAppSearchCache.has(keyword)) {
            return communityAppSearchCache.get(keyword);
        }

        const request = new Promise((resolve) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: 'https://steamcommunity.com/actions/SearchApps/' + encodeURIComponent(keyword),
                responseType: 'json',
                onload: ({status, response}) => {
                    if (status === 200 && Array.isArray(response)) resolve(response);
                    else resolve([]);
                },
                onerror: () => resolve([])
            });
        });
        communityAppSearchCache.set(keyword, request);
        return request;
    }

    function searchSteamStore(keyword) {
        if (storeAppSearchCache.has(keyword)) return storeAppSearchCache.get(keyword);

        const params = new URLSearchParams({
            term: keyword,
            f: 'games',
            cc: 'US',
            l: 'english',
            use_store_query: '1',
            use_search_spellcheck: '1',
        });
        const request = new Promise((resolve) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: `https://store.steampowered.com/search/suggest?${params}`,
                responseType: 'text',
                onload: ({status, response, responseText}) => {
                    if (status !== 200) {
                        resolve([]);
                        return;
                    }
                    const html = responseText || response || '';
                    const searchPage = new DOMParser().parseFromString(html, 'text/html');
                    const results = Array.from(
                        searchPage.querySelectorAll('.match[data-ds-appid]')
                    ).map(element => ({
                        appid: Number(element.getAttribute('data-ds-appid')),
                        name: element.querySelector('.match_name')?.textContent.trim() || '',
                    })).filter(app => app.appid && app.name);
                    resolve(results);
                },
                onerror: () => resolve([]),
            });
        });
        storeAppSearchCache.set(keyword, request);
        return request;
    }

    function findExactSteamApp(title, results) {
        const normalizedTitle = normalizeSteamTitle(title);
        const matches = new Map();
        for (const app of results) {
            const appId = Number(app.appid);
            if (appId && normalizeSteamTitle(app.name) === normalizedTitle) {
                matches.set(appId, {appid: appId, name: app.name});
            }
        }
        return matches.size === 1 ? matches.values().next().value : null;
    }

    function findSteamApp(title) {
        const cacheKey = normalizeSteamTitle(title);
        if (steamAppMatchCache.has(cacheKey)) return steamAppMatchCache.get(cacheKey);

        const request = (async () => {
            const storeMatch = findExactSteamApp(title, await searchSteamStore(title));
            if (storeMatch) return storeMatch;
            return findExactSteamApp(title, await searchSteamCommunity(title));
        })();
        request.then(() => schedulePageRefresh(), () => schedulePageRefresh());
        steamAppMatchCache.set(cacheKey, request);
        return request;
    }

    function getSteamStoreUrl(appId) {
        return `https://store.steampowered.com/app/${appId}/`;
    }

    function getCachedSteamAccountData() {
        const data = GM_getValue(steamAccountCacheKey);
        if (!data
            || !/^[A-Z]{2}$/.test(data.countryCode)
            || !Array.isArray(data.ownedApps)
            || !Array.isArray(data.wishlistApps)) {
            return null;
        }
        return data;
    }

    function fetchSteamAccountData() {
        if (!steamAccountDataPromise) {
            steamAccountDataPromise = (async () => {
                try {
                    const html = await gmRequest(
                        `https://store.steampowered.com/?l=english&_=${Date.now()}`,
                        'text',
                        steamRequestOptions
                    );
                    const steamPage = new DOMParser().parseFromString(html, 'text/html');
                    const userInfoText = steamPage.querySelector('#application_config')
                        ?.getAttribute('data-userinfo');
                    const userInfo = JSON.parse(userInfoText || '{}');
                    if (!userInfo.logged_in) throw new Error(t('loginSteamLoadAccountData'));

                    const userData = await gmRequest(
                        `https://store.steampowered.com/dynamicstore/userdata/?_=${Date.now()}`,
                        'json',
                        {
                            ...steamRequestOptions,
                            headers: {'Cache-Control': 'no-cache'},
                        }
                    );
                    if (!Array.isArray(userData?.rgOwnedApps)
                        || !Array.isArray(userData?.rgWishlist)) {
                        throw new Error(t('steamInvalidAccountData'));
                    }

                    const data = {
                        countryCode: userInfo.country_code.toUpperCase(),
                        ownedApps: userData.rgOwnedApps,
                        wishlistApps: userData.rgWishlist,
                        updatedAt: Date.now(),
                    };
                    GM_setValue(steamAccountCacheKey, data);
                    return data;
                } catch (error) {
                    const cachedData = getCachedSteamAccountData();
                    if (!cachedData) throw error;
                    console.warn('[HB-Helper] Using cached Steam account data:', error);
                    return cachedData;
                }
            })();
        }
        return steamAccountDataPromise;
    }

    async function fetchOwnedSet() {
        return new Set((await fetchSteamAccountData()).ownedApps);
    }

    async function fetchWishlistSet() {
        return new Set((await fetchSteamAccountData()).wishlistApps);
    }

    function getBundleTitle() {
        const meta = document.querySelector('meta[property="og:title"]');
        if (meta && meta.content) return meta.content.trim();
        const logo = document.querySelector('.bundle-logo');
        if (logo && logo.getAttribute('alt')) return logo.getAttribute('alt').trim();
        return document.title.trim();
    }

    function getCurrentPath() {
        return location.pathname.replace(/\/$/, '') || '/';
    }

    function isLandingSortPage() {
        return ['/bundles', '/games', '/books', '/software'].includes(getCurrentPath());
    }

    function getActiveLandingSortConfigs() {
        const path = getCurrentPath();
        if (path === '/bundles') return landingSortSectionConfigs;
        const dataKey = path.slice(1);
        return landingSortSectionConfigs.filter(config => config.dataKey === dataKey);
    }

    function isGamesBundlePage() {
        return location.pathname.startsWith('/games/') && getCurrentPath() !== '/games';
    }

    function isChoicePage() {
        return location.pathname === '/membership'
            || location.pathname === '/membership/'
            || location.pathname.startsWith('/membership/home');
    }

    function isPriceTotalsPage() {
        return isGamesBundlePage() || isChoicePage();
    }

    function normalizedText(element) {
        return element.textContent.replace(/\s+/g, ' ').trim();
    }

    function normalizeHumblePath(value) {
        try {
            return new URL(value, location.origin).pathname.replace(/\/$/, '') || '/';
        } catch (error) {
            return String(value || '').split(/[?#]/)[0].replace(/\/$/, '');
        }
    }

    function parseHumbleDateTime(value) {
        if (!value) return null;
        const dateText = String(value);
        const hasTimezone = /(?:Z|[+-]\d\d:\d\d)$/i.test(dateText);
        const time = Date.parse(hasTimezone ? dateText : `${dateText}Z`);
        return Number.isFinite(time) ? time : null;
    }

    function hasLandingPageProductData(pageData) {
        return landingSortSectionConfigs.some(config =>
            Array.isArray(pageData?.data?.[config.dataKey]?.mosaic)
        );
    }

    function parseLandingPageData(text, sourceLabel) {
        try {
            const pageData = JSON.parse(text || '{}');
            if (!hasLandingPageProductData(pageData)) return null;
            landingPageDataCache = pageData;
            return pageData;
        } catch (error) {
            console.warn(`[HB-Helper] Failed to parse landing data from ${sourceLabel}:`, error);
            return null;
        }
    }

    function readLandingPageDataElement() {
        const dataElement = document.getElementById('landingPage-json-data');
        return dataElement ? parseLandingPageData(dataElement.textContent, 'document') : null;
    }

    function readLandingPageDataFromHtml(html) {
        const match = String(html || '').match(
            /<script id="landingPage-json-data" type="application\/json">\s*([\s\S]*?)\s*<\/script>/
        );
        return match ? parseLandingPageData(match[1], 'source') : null;
    }

    function loadLandingPageDataFromSource() {
        if (landingPageDataSourcePromise) return landingPageDataSourcePromise;
        landingPageDataSourcePromise = fetch(location.href, {credentials: 'include'})
            .then(response => {
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return response.text();
            })
            .then(html => {
                if (readLandingPageDataFromHtml(html)) scheduleLandingSortPageRefresh();
            })
            .catch(error => {
                console.warn('[HB-Helper] Failed to load landing data source:', error);
            });
        return landingPageDataSourcePromise;
    }

    function getLandingPageData() {
        const pageData = readLandingPageDataElement() || landingPageDataCache || null;
        if (!pageData && isLandingSortPage()) loadLandingPageDataFromSource();
        return pageData;
    }

    function observeLandingPageDataElement() {
        if (!isLandingSortPage() || readLandingPageDataElement()) return;
        const observer = new MutationObserver(() => {
            if (readLandingPageDataElement()) observer.disconnect();
        });
        observer.observe(document.documentElement || document, {
            childList: true,
            characterData: true,
            subtree: true,
        });
    }

    observeLandingPageDataElement();

    function getLandingSortProductData(config) {
        const sections = getLandingPageData()?.data?.[config.dataKey]?.mosaic;
        if (!Array.isArray(sections)) return null;

        const products = [];
        for (const section of sections) {
            for (const product of section.products || []) {
                if (product?.type !== 'bundle'
                    || product.tile_stamp !== config.stamp
                    || !String(product.product_url || '').startsWith(config.pathPrefix)) {
                    continue;
                }
                products.push({
                    productUrl: normalizeHumblePath(product.product_url),
                    originalIndex: products.length,
                    startTime: parseHumbleDateTime(product['start_date|datetime']),
                    endTime: parseHumbleDateTime(product['end_date|datetime']),
                });
            }
        }

        return products.length > 1 ? products : null;
    }

    function findLandingSortSection(config) {
        return Array.from(document.querySelectorAll('.landing-mosaic-section'))
            .find(section => findLandingSortHeading(section, config)
                && section.querySelector(`.landing-page-mosaic ${config.mosaicSelector}`)) || null;
    }

    function findLandingSortHeading(section, config) {
        return Array.from(section.querySelectorAll(
            ':scope > h3, :scope > .hb-helper-landing-sort-header > h3'
        ))
            .find(heading => normalizedText(heading) === config.heading) || null;
    }

    function getLandingSortTileEntries(section, productByUrl) {
        return Array.from(section.querySelectorAll('.tile-holder.js-tile-holder'))
            .map((holder, domIndex) => {
                if (!holder.dataset.hbHelperLandingOriginalIndex) {
                    holder.dataset.hbHelperLandingOriginalIndex = String(domIndex);
                }
                const link = holder.matches('a[href]') ? holder : holder.querySelector('a[href]');
                const product = productByUrl.get(normalizeHumblePath(link?.getAttribute('href')));
                const originalDomIndex = Number(holder.dataset.hbHelperLandingOriginalIndex);
                return {
                    holder,
                    domIndex,
                    originalDomIndex: Number.isFinite(originalDomIndex) ? originalDomIndex : domIndex,
                    product,
                };
            });
    }

    function getLandingSortState(config) {
        const section = findLandingSortSection(config);
        const products = getLandingSortProductData(config);
        if (!section || !products) return null;

        const productByUrl = new Map(products.map(product => [product.productUrl, product]));
        const entries = getLandingSortTileEntries(section, productByUrl);

        return {config, section, products, entries};
    }

    function compareOptionalTime(a, b, direction) {
        const aHasTime = Number.isFinite(a);
        const bHasTime = Number.isFinite(b);
        if (!aHasTime && !bHasTime) return 0;
        if (!aHasTime) return 1;
        if (!bHasTime) return -1;
        return (a - b) * direction;
    }

    function getLandingSortMode(sectionKey) {
        return landingSortModeBySection.get(sectionKey) || 'default';
    }

    function compareLandingSortEntries(a, b, mode) {
        let result = 0;
        if (mode === 'ending') {
            result = compareOptionalTime(a.product.endTime, b.product.endTime, 1);
        } else if (mode === 'newest') {
            result = compareOptionalTime(a.product.startTime, b.product.startTime, -1);
        }

        return result
            || a.product.originalIndex - b.product.originalIndex
            || a.originalDomIndex - b.originalDomIndex;
    }

    function getDefaultLandingSortIndex(entry) {
        return entry.product ? entry.product.originalIndex : entry.originalDomIndex;
    }

    function getLandingSortDesiredEntries(state) {
        const mode = getLandingSortMode(state.config.sectionKey);
        if (mode === 'default') {
            return [...state.entries].sort((a, b) =>
                getDefaultLandingSortIndex(a) - getDefaultLandingSortIndex(b)
                || a.originalDomIndex - b.originalDomIndex
            );
        }

        const matchedEntries = state.entries
            .filter(entry => entry.product)
            .sort((a, b) => compareLandingSortEntries(a, b, mode));
        const unmatchedEntries = state.entries
            .filter(entry => !entry.product)
            .sort((a, b) => a.originalDomIndex - b.originalDomIndex);
        return matchedEntries.concat(unmatchedEntries);
    }

    function renderLandingSortControls(config) {
        const controls = document.querySelector(
            `.hb-helper-landing-sort-controls[data-hb-helper-sort-section="${config.sectionKey}"]`
        );
        if (!controls) return;

        const activeMode = getLandingSortMode(config.sectionKey);
        landingSortModes.forEach(mode => {
            const button = controls.querySelector(`[data-hb-helper-sort="${mode.key}"]`);
            if (!button) return;
            const isActive = mode.key === activeMode;
            button.classList.toggle('hb-helper-landing-sort-active', isActive);
            button.setAttribute('aria-pressed', String(isActive));
        });
    }

    function ensureLandingSortControls(state) {
        const {config, section} = state;
        const heading = findLandingSortHeading(section, config);
        if (!heading) return null;

        let header = section.querySelector(
            `.hb-helper-landing-sort-header[data-hb-helper-sort-section="${config.sectionKey}"]`
        );
        if (!header) {
            header = document.createElement('div');
            header.className = 'hb-helper-landing-sort-header';
            header.dataset.hbHelperSortSection = config.sectionKey;
            heading.insertAdjacentElement('beforebegin', header);
            header.appendChild(heading);
        } else if (heading.parentElement !== header) {
            header.insertBefore(heading, header.firstChild);
        }

        let controls = header.querySelector('.hb-helper-landing-sort-controls');
        if (!controls) {
            controls = document.createElement('div');
            controls.className = 'hb-helper-landing-sort-controls';
            controls.dataset.hbHelperSortSection = config.sectionKey;
            controls.setAttribute('role', 'group');
            controls.setAttribute('aria-label', t('landingSortAria', {heading: config.heading}));

            for (const mode of landingSortModes) {
                const button = document.createElement('button');
                button.type = 'button';
                button.textContent = t(mode.labelKey);
                button.title = t(mode.titleKey);
                button.dataset.hbHelperSort = mode.key;
                button.addEventListener('click', () => {
                    landingSortModeBySection.set(config.sectionKey, mode.key);
                    renderLandingSortControls(config);
                    applyLandingSort(getLandingSortState(config));
                });
                controls.appendChild(button);
            }
        }

        if (controls.parentElement !== header) {
            header.appendChild(controls);
        }
        renderLandingSortControls(config);
        return controls;
    }

    function getLandingSortLayoutSlots(state) {
        const layouts = Array.from(state.section.querySelectorAll('.mosaic-layout'))
            .map(layout => ({
                container: layout,
                count: layout.querySelectorAll(':scope > .tile-holder.js-tile-holder').length,
            }))
            .filter(slot => slot.count > 0);

        if (layouts.length) return layouts;

        const fallbackContainer = state.section.querySelector(state.config.mosaicSelector);
        const fallbackCount = fallbackContainer
            ? fallbackContainer.querySelectorAll(':scope > .tile-holder.js-tile-holder').length
            : 0;
        return fallbackContainer && fallbackCount
            ? [{container: fallbackContainer, count: fallbackCount}]
            : [];
    }

    function applyLandingSort(state) {
        if (!state) return;

        const desiredHolders = getLandingSortDesiredEntries(state).map(entry => entry.holder);
        const currentHolders = state.entries.map(entry => entry.holder);
        if (desiredHolders.every((holder, index) => holder === currentHolders[index])) return;

        const slots = getLandingSortLayoutSlots(state);
        let holderIndex = 0;
        for (const slot of slots) {
            for (let i = 0; i < slot.count && holderIndex < desiredHolders.length; i++) {
                slot.container.appendChild(desiredHolders[holderIndex]);
                holderIndex++;
            }
        }
    }

    function removeLandingSortControls(config) {
        document.querySelectorAll(
            `.hb-helper-landing-sort-header[data-hb-helper-sort-section="${config.sectionKey}"]`
        ).forEach(header => {
            const heading = header.querySelector('h3');
            if (heading) header.insertAdjacentElement('beforebegin', heading);
            header.remove();
        });
        document.querySelectorAll(
            `.hb-helper-landing-sort-controls[data-hb-helper-sort-section="${config.sectionKey}"]`
        ).forEach(controls => controls.remove());
    }

    function refreshLandingSortPage() {
        const activeConfigs = getActiveLandingSortConfigs();
        if (activeConfigs.length === 0) return;

        const activeSectionKeys = new Set(activeConfigs.map(config => config.sectionKey));
        document.querySelectorAll('.hb-helper-landing-sort-controls').forEach(controls => {
            if (!activeSectionKeys.has(controls.dataset.hbHelperSortSection)) {
                controls.remove();
            }
        });

        for (const config of activeConfigs) {
            const state = getLandingSortState(config);
            if (!state) {
                removeLandingSortControls(config);
                continue;
            }
            ensureLandingSortControls(state);
            applyLandingSort(state);
        }
    }

    function scheduleLandingSortPageRefresh() {
        clearTimeout(landingSortRefreshTimer);
        landingSortRefreshTimer = setTimeout(refreshLandingSortPage, 150);
    }

    function observeLandingSortPageChanges() {
        const observer = new MutationObserver(() => scheduleLandingSortPageRefresh());
        observer.observe(document.body, {childList: true, subtree: true});
    }

    function normalizeCurrencyCode(value) {
        const match = String(value || '').trim().toUpperCase().match(/^[A-Z]{3}$/);
        return match ? match[0] : null;
    }

    function findTextAnchor(pattern) {
        return Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, div'))
            .filter(element => pattern.test(normalizedText(element)))
            .sort((a, b) =>
                a.childElementCount - b.childElementCount
                || normalizedText(a).length - normalizedText(b).length
            )[0] || null;
    }

    function findHelperInsertionPoint() {
        if (isGamesBundlePage()) {
            const anchor = findTextAnchor(
                /^Pay at least .+ for (?:these )?\d+ items?[.!]?$/i
            );
            return anchor ? {anchor, position: 'beforebegin'} : null;
        }

        if (isChoicePage()) {
            const yourGamesHeading = findTextAnchor(/^YOUR GAMES$/i);
            if (yourGamesHeading) return {anchor: yourGamesHeading, position: 'afterend'};
            if (!document.querySelector('.choice-content.js-open-choice-modal')) return null;
            const monthHeading = findTextAnchor(choiceMonthPattern);
            if (monthHeading) return {anchor: monthHeading, position: 'beforebegin'};
        }
        return null;
    }

    function getChoicePeriod() {
        const heading = findTextAnchor(choiceMonthPattern);
        return heading ? normalizedText(heading).replace(/\s+GAMES$/i, '') : '';
    }

    function findCurrencyInPriceText(text) {
        const currencyPatterns = [
            [/\bUSD\b|US\$/i, 'USD'],
            [/\bCAD\b|CA\$/i, 'CAD'],
            [/\bAUD\b|A\$/i, 'AUD'],
            [/\bNZD\b|NZ\$/i, 'NZD'],
            [/\bHKD\b|HK\$/i, 'HKD'],
            [/\bSGD\b|SG\$/i, 'SGD'],
            [/\bEUR\b|€/i, 'EUR'],
            [/\bGBP\b|£/i, 'GBP'],
            [/\bUAH\b|₴/i, 'UAH'],
            [/\bRUB\b|₽/i, 'RUB'],
            [/\bINR\b|₹/i, 'INR'],
            [/\bBRL\b|R\$/i, 'BRL'],
            [/\bPLN\b|zł/i, 'PLN'],
            [/\bKRW\b|₩/i, 'KRW'],
            [/\bCNY\b|CN¥/i, 'CNY'],
            [/\bJPY\b|¥/i, 'JPY'],
            [/\bCHF\b/i, 'CHF'],
            [/\$/i, 'USD'],
        ];
        return currencyPatterns.find(([pattern]) => pattern.test(text))?.[1] || null;
    }

    function findHumbleCurrencyCode() {
        const currencyElements = document.querySelectorAll(
            'meta[property="product:price:currency"], '
            + '[itemprop="priceCurrency"], [data-currency-code], [data-currency]'
        );
        for (const element of currencyElements) {
            const code = normalizeCurrencyCode(
                element.content
                || element.getAttribute('content')
                || element.getAttribute('data-currency-code')
                || element.getAttribute('data-currency')
                || element.textContent
            );
            if (code) return code;
        }

        for (const script of document.querySelectorAll('script:not([src])')) {
            const match = script.textContent.match(
                /"(?:currency|currency_code|currencyCode)"\s*:\s*"([A-Z]{3})"/i
            );
            if (match) return match[1].toUpperCase();
        }

        const payAnchor = findTextAnchor(/^Pay at least .+ for (?:these )?\d+ items?[.!]?$/i);
        return findCurrencyInPriceText(payAnchor?.textContent || document.body.innerText);
    }

    function buildSteamGiftsSearchUrl() {
        let term;
        if (isChoicePage()) {
            term = `[Humble Bundle] ${getChoicePeriod()}`.trim();
        } else {
            const title = getBundleTitle();
            const word = title.match(/[A-Za-z0-9]+/)?.[0] || title.trim().split(/\s+/)[0] || 'Bundle';
            term = `[Humble Bundle] ${word}`;
        }
        return 'https://www.steamgifts.com/discussions/search?q=' + encodeURIComponent(term);
    }

    function isSteamRegisterKeyPage() {
        return location.hostname === 'store.steampowered.com'
            && location.pathname.startsWith('/account/registerkey');
    }

    function waitForCondition(check, timeout = 8000, interval = 120) {
        return new Promise(resolve => {
            const startedAt = Date.now();
            const timer = setInterval(() => {
                const result = check();
                if (result || Date.now() - startedAt >= timeout) {
                    clearInterval(timer);
                    resolve(result || null);
                }
            }, interval);
        });
    }

    function getVisibleChoiceTiles() {
        return Array.from(document.querySelectorAll('.choice-content.js-open-choice-modal'))
            .filter(tile => tile.getClientRects().length > 0);
    }

    function getChoiceTileTitle(tile) {
        return normalizedText(tile.querySelector('.content-choice-title, .human-name-title, .item-title') || tile);
    }

    function getChoiceTileId(tile) {
        const dataKeys = [
            'machineName',
            'productMachineName',
            'subproductMachineName',
            'contentChoiceId',
            'humanName',
            'slug',
            'id',
        ];
        for (const key of dataKeys) {
            if (tile.dataset[key]) return `${key}:${tile.dataset[key]}`;
        }

        const attributeNames = [
            'data-machine-name',
            'data-product-machine-name',
            'data-subproduct-machine-name',
            'data-content-choice-id',
            'data-human-name',
            'data-slug',
            'data-id',
        ];
        for (const name of attributeNames) {
            const value = tile.getAttribute(name);
            if (value) return `${name}:${value}`;
        }

        return `title:${normalizeSteamTitle(getChoiceTileTitle(tile))}`;
    }

    function saveChoiceSelection() {
        GM_setValue(choiceSelectionCacheKey, [...selectedChoiceGameIds]);
    }

    function setChoiceStatus(message) {
        const status = document.querySelector(
            '#hb-helper-choice-activation-controls .hb-helper-choice-status'
        );
        if (status) status.textContent = message || '';
    }

    function renderChoiceSelectionState() {
        const visibleIds = new Set();
        getVisibleChoiceTiles().forEach(tile => {
            const id = getChoiceTileId(tile);
            visibleIds.add(id);
            tile.classList.toggle('hb-helper-choice-selected', selectedChoiceGameIds.has(id));
        });

        if (visibleIds.size > 0) {
            for (const id of [...selectedChoiceGameIds]) {
                if (!visibleIds.has(id)) selectedChoiceGameIds.delete(id);
            }
        }
        saveChoiceSelection();

        const controls = document.getElementById('hb-helper-choice-activation-controls');
        if (!controls) return;
        const activateButton = controls.querySelector('[data-hb-helper-choice-action="activate"]');
        const selectUnownedButton = controls.querySelector('[data-hb-helper-choice-action="select-unowned"]');
        const selectButton = controls.querySelector('[data-hb-helper-choice-action="select"]');
        const clearButton = controls.querySelector('[data-hb-helper-choice-action="clear"]');
        if (activateButton) activateButton.disabled = choiceActivationInProgress;
        if (selectUnownedButton) selectUnownedButton.disabled = choiceActivationInProgress;
        if (selectButton) {
            selectButton.disabled = choiceActivationInProgress;
            selectButton.textContent = choiceSelectionMode ? t('choiceSelectDone') : t('choiceSelect');
            selectButton.setAttribute('aria-pressed', String(choiceSelectionMode));
        }
        if (clearButton) clearButton.disabled = choiceActivationInProgress;
        if (!choiceActivationInProgress) {
            setChoiceStatus(t('choiceSelectedCount', {count: selectedChoiceGameIds.size}));
        }
        document.documentElement.classList.toggle('hb-helper-choice-select-mode', choiceSelectionMode);
    }

    function setChoiceSelectionMode(enabled) {
        choiceSelectionMode = enabled;
        renderChoiceSelectionState();
    }

    function toggleChoiceTileSelection(tile) {
        const id = getChoiceTileId(tile);
        if (selectedChoiceGameIds.has(id)) selectedChoiceGameIds.delete(id);
        else selectedChoiceGameIds.add(id);
        saveChoiceSelection();
        renderChoiceSelectionState();
    }

    function selectUnownedChoiceTiles() {
        selectedChoiceGameIds.clear();
        getVisibleChoiceTiles()
            .filter(tile => !tile.classList.contains('owned'))
            .forEach(tile => selectedChoiceGameIds.add(getChoiceTileId(tile)));
        saveChoiceSelection();
        renderChoiceSelectionState();
    }

    function clearChoiceSelection() {
        selectedChoiceGameIds.clear();
        saveChoiceSelection();
        renderChoiceSelectionState();
    }

    function getSelectedChoiceTiles() {
        return getVisibleChoiceTiles()
            .filter(tile => selectedChoiceGameIds.has(getChoiceTileId(tile)));
    }

    function handleChoiceSelectionClick(event) {
        if (!choiceSelectionMode || !isChoicePage()) return;
        const tile = event.target.closest?.('.choice-content.js-open-choice-modal');
        if (!tile) return;
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        toggleChoiceTileSelection(tile);
    }

    function getActiveChoiceModal() {
        const modal = document.getElementById('site-modal');
        if (!modal || modal.getClientRects().length === 0) return null;
        return normalizedText(modal) ? modal : null;
    }

    function findSteamKeyInText(text) {
        const match = String(text || '').match(/\b[A-Z0-9]{5}(?:-[A-Z0-9]{5}){2,4}\b/i);
        return match ? match[0].toUpperCase() : null;
    }

    function extractSteamKeyFromScope(scope) {
        for (const input of scope.querySelectorAll('input, textarea')) {
            const key = findSteamKeyInText(input.value);
            if (key) return key;
        }
        return findSteamKeyInText(normalizedText(scope));
    }

    function isVisibleElement(element) {
        return !element.disabled && element.getClientRects().length > 0;
    }

    function findChoiceSteamControl(scope) {
        return Array.from(scope.querySelectorAll('.keyfield-value')).find(element =>
            isVisibleElement(element)
            && normalizedText(element).toLowerCase() === 'get game on steam'
        ) || null;
    }

    async function closeChoiceModal() {
        const modal = getActiveChoiceModal();
        if (!modal) return;
        const closeButton = Array.from(
            modal.querySelectorAll('button, a, [role="button"]')
        ).find(element => {
            const text = [
                element.textContent,
                element.getAttribute('aria-label'),
                element.getAttribute('title'),
                element.className,
            ].join(' ');
            return isVisibleElement(element) && /(close|dismiss|×|关闭|取消)/i.test(text);
        });
        if (closeButton) closeButton.click();
        else document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}));
        await waitForCondition(() => !getActiveChoiceModal(), 1200);
    }

    async function revealChoiceSteamKey(tile) {
        tile.click();
        const modal = await waitForCondition(getActiveChoiceModal, 8000);
        if (!modal) return null;

        try {
            const ready = await waitForCondition(
                () => extractSteamKeyFromScope(modal) || findChoiceSteamControl(modal),
                8000
            );
            if (!ready) return null;

            const key = extractSteamKeyFromScope(modal);
            if (key) return key;

            ready.click();
            return await waitForCondition(() => extractSteamKeyFromScope(modal), 5000);
        } finally {
            await closeChoiceModal();
        }
    }

    async function startChoiceActivation() {
        if (choiceActivationInProgress) return;
        const tiles = getSelectedChoiceTiles();
        if (tiles.length === 0) {
            setChoiceStatus(t('choiceNoSelection'));
            return;
        }

        choiceActivationInProgress = true;
        setChoiceSelectionMode(false);
        setChoiceStatus(t('choiceRevealStarting', {count: tiles.length}));
        const results = [];
        let openingSteam = false;
        try {
            for (let index = 0; index < tiles.length; index++) {
                const tile = tiles[index];
                const title = getChoiceTileTitle(tile);
                setChoiceStatus(t('choiceRevealProgress', {
                    title,
                    current: index + 1,
                    total: tiles.length,
                }));
                const key = await revealChoiceSteamKey(tile);
                if (!key) {
                    results.push({
                        id: getChoiceTileId(tile),
                        title,
                        key: null,
                        status: 'reveal-failed',
                    });
                    setChoiceStatus(t('choiceRevealFailed', {title}));
                    continue;
                }
                results.push({
                    id: getChoiceTileId(tile),
                    title,
                    key,
                    status: 'pending',
                });
            }

            const queue = results.filter(item => item.key);
            if (queue.length === 0) return;
            GM_setValue(steamActivationQueueKey, queue);
            setChoiceStatus(t('choiceQueueReady', {count: queue.length}));
            openingSteam = true;
            location.assign('https://store.steampowered.com/account/registerkey');
        } finally {
            choiceActivationInProgress = false;
            if (!openingSteam) renderChoiceSelectionState();
        }
    }

    function ensureChoiceActivationControls(controls, summary) {
        let choiceControls = document.getElementById('hb-helper-choice-activation-controls');
        if (!isChoicePage()) {
            choiceControls?.remove();
            return;
        }

        if (!choiceControls) {
            choiceControls = document.createElement('div');
            choiceControls.id = 'hb-helper-choice-activation-controls';

            const activateButton = document.createElement('button');
            activateButton.type = 'button';
            activateButton.dataset.hbHelperChoiceAction = 'activate';
            activateButton.addEventListener('click', startChoiceActivation);

            const selectUnownedButton = document.createElement('button');
            selectUnownedButton.type = 'button';
            selectUnownedButton.dataset.hbHelperChoiceAction = 'select-unowned';
            selectUnownedButton.addEventListener('click', selectUnownedChoiceTiles);

            const selectButton = document.createElement('button');
            selectButton.type = 'button';
            selectButton.dataset.hbHelperChoiceAction = 'select';
            selectButton.addEventListener('click', () => setChoiceSelectionMode(!choiceSelectionMode));

            const clearButton = document.createElement('button');
            clearButton.type = 'button';
            clearButton.dataset.hbHelperChoiceAction = 'clear';
            clearButton.addEventListener('click', clearChoiceSelection);

            const status = document.createElement('div');
            status.className = 'hb-helper-choice-status';

            choiceControls.append(activateButton, selectUnownedButton, selectButton, clearButton, status);
        }

        choiceControls.querySelector('[data-hb-helper-choice-action="activate"]').textContent = t('choiceActivate');
        choiceControls.querySelector('[data-hb-helper-choice-action="select-unowned"]').textContent = t('choiceSelectUnowned');
        choiceControls.querySelector('[data-hb-helper-choice-action="clear"]').textContent = t('choiceClearSelection');

        if (summary.nextElementSibling !== choiceControls) {
            summary.insertAdjacentElement('afterend', choiceControls);
        } else if (choiceControls.parentNode !== controls) {
            controls.appendChild(choiceControls);
        }
        renderChoiceSelectionState();
    }

    function ensureHelperControls() {
        if (!isPriceTotalsPage()) return null;
        const insertionPoint = findHelperInsertionPoint();
        if (!insertionPoint) return null;

        let controls = document.getElementById('hb-helper-controls');
        if (!controls) {
            controls = document.createElement('div');
            controls.id = 'hb-helper-controls';
        }

        let steamGifts = document.getElementById('steamgifts-discussion');
        if (!steamGifts) {
            steamGifts = document.createElement('div');
            steamGifts.id = 'steamgifts-discussion';
            const link = document.createElement('a');
            link.id = 'hb-helper-steamgifts-link';
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            steamGifts.appendChild(link);
        }
        const steamGiftsLink = steamGifts.querySelector('#hb-helper-steamgifts-link');
        steamGiftsLink.textContent = t('steamGiftsSearch');
        steamGiftsLink.href = buildSteamGiftsSearchUrl();

        let summary = document.getElementById('hb-helper-price-summary');
        if (!summary) {
            summary = document.createElement('div');
            summary.id = 'hb-helper-price-summary';
            summary.textContent = t('loadingPriceTotals');
        }

        if (steamGifts.parentNode !== controls) controls.appendChild(steamGifts);
        if (summary.parentNode !== controls) controls.appendChild(summary);
        if (steamGifts.nextElementSibling !== summary) {
            controls.insertBefore(summary, steamGifts.nextSibling);
        }
        ensureChoiceActivationControls(controls, summary);
        const {anchor, position} = insertionPoint;
        if (position === 'beforebegin' && anchor.previousElementSibling !== controls) {
            anchor.insertAdjacentElement('beforebegin', controls);
        } else if (position === 'afterend' && anchor.nextElementSibling !== controls) {
            anchor.insertAdjacentElement('afterend', controls);
        }
        return controls;
    }

    function ensureSteamLoginReminder() {
        const controls = ensureHelperControls();
        if (!controls) return;

        let loginDiv = document.getElementById('hb-helper-login-reminder');
        if (!loginDiv) {
            loginDiv = document.createElement('div');
            loginDiv.id = 'hb-helper-login-reminder';
            const loginLink = document.createElement('a');
            loginLink.href = 'https://store.steampowered.com/login/';
            loginLink.target = '_blank';
            loginLink.rel = 'noopener noreferrer';
            loginLink.addEventListener('click', () => {
                if (loginDiv.querySelector('.hb-helper-login-message')) return;
                const message = document.createElement('div');
                message.className = 'hb-helper-login-message';
                message.textContent = t('refreshAfterLogin');
                loginDiv.appendChild(message);
            });
            loginDiv.appendChild(loginLink);
        }
        loginDiv.querySelector('a').textContent = t('loginSteamCheckOwned');
        if (loginDiv.parentNode !== controls || controls.firstElementChild !== loginDiv) {
            controls.insertBefore(loginDiv, controls.firstChild);
        }
    }

    function getSteamStoreLink(container) {
        return Array.from(container.querySelectorAll('.hb-helper-steam-store-link'))[0] || null;
    }

    function removeSteamStoreLink(link) {
        const row = link.parentElement?.classList.contains('hb-helper-steam-store-row')
            ? link.parentElement
            : null;
        link.remove();
        if (row && row.children.length === 0) row.remove();
    }

    function removeDuplicateSteamStoreLinks(container, keepLink) {
        Array.from(container.querySelectorAll('.hb-helper-steam-store-link'))
            .forEach(link => {
                if (link !== keepLink) removeSteamStoreLink(link);
            });
    }

    function getSteamStoreLinkRow(link) {
        if (link.parentElement?.classList.contains('hb-helper-steam-store-row')) {
            return link.parentElement;
        }

        const row = document.createElement('div');
        row.className = 'hb-helper-steam-store-row';
        row.appendChild(link);
        return row;
    }

    function insertSteamStoreLink(link, target) {
        const {container, placementContainer, before, after} = target;
        if (placementContainer) {
            const row = getSteamStoreLinkRow(link);
            if (after?.parentNode === placementContainer) {
                if (after.nextElementSibling !== row) {
                    after.insertAdjacentElement('afterend', row);
                }
            } else if (before?.parentNode === placementContainer) {
                if (before.previousElementSibling !== row) {
                    placementContainer.insertBefore(row, before);
                }
            } else if (row.parentNode !== placementContainer) {
                placementContainer.appendChild(row);
            }
            return;
        }

        const previousRow = link.parentElement?.classList.contains('hb-helper-steam-store-row')
            ? link.parentElement
            : null;
        if (before?.parentNode === container) {
            if (before.previousElementSibling !== link) {
                container.insertBefore(link, before);
            }
        } else if (after?.parentNode === container) {
            if (after.nextElementSibling !== link) {
                after.insertAdjacentElement('afterend', link);
            }
        } else if (link.parentNode !== container) {
            container.appendChild(link);
        }
        if (previousRow && previousRow.children.length === 0) previousRow.remove();
    }

    async function ensureSteamStoreLink(target) {
        const {container, title} = target;
        const normalizedTitle = normalizeSteamTitle(title);
        let existingLink = getSteamStoreLink(container);
        if (existingLink && existingLink.dataset.hbHelperTitle !== normalizedTitle) {
            removeSteamStoreLink(existingLink);
            existingLink = null;
        }

        if (!title || !shouldMatchSteamTitle(title)) {
            removeDuplicateSteamStoreLinks(container, null);
            return;
        }

        const app = await findSteamApp(title);
        if (!container.isConnected) return;

        if (!app) {
            removeDuplicateSteamStoreLinks(container, null);
            return;
        }

        let link = getSteamStoreLink(container);
        if (!link) {
            link = document.createElement('a');
        }
        link.className = 'hb-helper-steam-store-link';
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.setAttribute('role', 'button');
        link.textContent = t('viewOnSteam');
        link.href = getSteamStoreUrl(app.appid);
        link.dataset.hbHelperTitle = normalizedTitle;
        link.dataset.hbHelperAppid = String(app.appid);
        removeDuplicateSteamStoreLinks(container, link);
        insertSteamStoreLink(link, target);
    }

    function findChoicePlatformPanel(scope) {
        const candidates = Array.from(scope.querySelectorAll('div, section, article, aside'))
            .filter(element => {
                const text = normalizedText(element);
                return /\bPLATFORM\b/i.test(text)
                    && /OPERATING\s+SYSTEMS/i.test(text)
                    && /\bSTEAM\b/i.test(text);
            })
            .sort((a, b) =>
                normalizedText(a).length - normalizedText(b).length
                || a.childElementCount - b.childElementCount
            );
        return candidates[0] || null;
    }

    function firstTextElement(scope, selectors) {
        return Array.from(scope.querySelectorAll(selectors))
            .find(element => normalizedText(element));
    }

    function findBundleDetailTitle(container, detailIndex) {
        const localTitleEl = firstTextElement(
            container,
            '.item-title, .human-name-title, .content-choice-title, .product-title, .game-title, h1, h2, h3'
        );
        if (localTitleEl) return {title: normalizedText(localTitleEl), anchor: localTitleEl};

        const tileTitleEl = Array.from(
            document.querySelectorAll('.tier-item-view .item-title')
        )[detailIndex];
        if (tileTitleEl) return {title: normalizedText(tileTitleEl), anchor: tileTitleEl};

        return {title: '', anchor: null};
    }

    function findChoiceModalTitle(modal) {
        return firstTextElement(
            modal,
            '.human-name-title, .content-choice-title, .product-title, .game-title, h1, h2, h3'
        );
    }

    function getSteamStoreLinkTargets() {
        const targets = [];
        document.querySelectorAll('.tier-item-details-view').forEach((container, detailIndex) => {
            const {title, anchor: titleEl} = findBundleDetailTitle(container, detailIndex);
            if (!title) return;
            const platformRows = Array.from(
                container.querySelectorAll('.delivery-and-oses.icons-and-blurbs')
            );
            const lastPlatformRow = platformRows.at(-1);
            targets.push({
                container,
                title,
                placementContainer: lastPlatformRow?.parentElement || null,
                after: lastPlatformRow || titleEl,
                before: lastPlatformRow ? null : container.querySelector('section.description'),
            });
        });

        document.querySelectorAll('#site-modal').forEach(container => {
            const titleEl = findChoiceModalTitle(container);
            const title = titleEl ? normalizedText(titleEl) : '';
            if (!container || !title) return;
            const platformPanel = findChoicePlatformPanel(container);
            targets.push({
                container,
                title,
                placementContainer: platformPanel,
                before: platformPanel
                    ? null
                    : container.querySelector('.recommendation-copy') || container.querySelector('.price'),
                after: platformPanel
                    ? null
                    : container.querySelector('.steam-rating') || titleEl,
            });
        });
        return targets;
    }

    function ensureSteamStoreLinks() {
        getSteamStoreLinkTargets().forEach(target => {
            ensureSteamStoreLink(target);
        });
    }

    function markVisibleGames() {
        document.querySelectorAll('.tier-item-view, .choice-content.js-open-choice-modal')
            .forEach(element => {
                if (ownedApps) markOne(element, ownedApps);
                if (wishlistApps) markWishlistOne(element, wishlistApps);
            });
    }

    function refreshHelperPage(forcePriceReload = false) {
        const controls = ensureHelperControls();
        ensureSteamStoreLinks();
        if (!controls) return;
        if (steamLoginRequired) ensureSteamLoginReminder();
        else document.getElementById('hb-helper-login-reminder')?.remove();
        markVisibleGames();
        schedulePriceTotalsReload(forcePriceReload);
    }

    function schedulePageRefresh(forcePriceReload = false) {
        clearTimeout(pageRefreshTimer);
        pageRefreshTimer = setTimeout(() => refreshHelperPage(forcePriceReload), 300);
    }

    function observePageChanges() {
        const observer = new MutationObserver(() => schedulePageRefresh());
        observer.observe(document.body, {childList: true, subtree: true});
        document.addEventListener('click', handleChoiceSelectionClick, true);
        document.addEventListener('click', () => schedulePageRefresh(), true);
        document.addEventListener('change', () => schedulePageRefresh(), true);
    }

    function getSteamActivationQueue() {
        const queue = GM_getValue(steamActivationQueueKey, []);
        return Array.isArray(queue)
            ? queue.filter(item => item?.title && item?.key)
            : [];
    }

    function saveSteamActivationQueue(queue) {
        GM_setValue(steamActivationQueueKey, queue);
    }

    function renderSteamActivationStatus(message) {
        let panel = document.getElementById('hb-helper-steam-activation-status');
        if (!panel) {
            panel = document.createElement('div');
            panel.id = 'hb-helper-steam-activation-status';
            const title = document.createElement('strong');
            title.textContent = t('steamActivationTitle');
            const body = document.createElement('div');
            body.className = 'hb-helper-steam-activation-body';
            panel.append(title, body);
            (document.body || document.documentElement).appendChild(panel);
        }
        panel.querySelector('.hb-helper-steam-activation-body').textContent = message || '';
    }

    function readJsonDataset(element, name) {
        try {
            return JSON.parse(element?.getAttribute(name) || '{}');
        } catch (error) {
            return {};
        }
    }

    function getSteamWebApiToken() {
        const config = document.getElementById('application_config');
        const userInfo = readJsonDataset(config, 'data-userinfo');
        const storeUserConfig = readJsonDataset(config, 'data-store_user_config');
        if (userInfo.logged_in === false) return null;
        return storeUserConfig.webapi_token
            || (typeof unsafeWindow !== 'undefined' ? unsafeWindow.g_wapit : '')
            || '';
    }

    function waitForSteamWebApiToken() {
        return waitForCondition(getSteamWebApiToken, 15000);
    }

    function postSteamActivationKey(token, key) {
        const url = 'https://api.steampowered.com/IStoreService/RegisterCDKey/v1/'
            + `?access_token=${encodeURIComponent(token)}`;
        const data = new URLSearchParams({
            input_json: JSON.stringify({
                activation_code: key,
                purchase_platform: 1,
                is_request_from_client: false,
            }),
        }).toString();

        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'POST',
                url,
                data,
                responseType: 'json',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                },
                onload: ({status, response, responseText}) => {
                    if (status !== 200) {
                        reject(new Error(t('requestFailedHttp', {status})));
                        return;
                    }
                    try {
                        resolve(response || JSON.parse(responseText || '{}'));
                    } catch (error) {
                        reject(error);
                    }
                },
                onerror: () => reject(new Error(t('networkRequestFailed'))),
            });
        });
    }

    function getSteamActivationError(response) {
        const data = response?.response || response || {};
        const receipt = data.purchase_receipt_info || {};
        const detail = data.purchase_result_details ?? data.purchase_result_detail ?? 'unknown';
        return receipt.error_string
            || receipt.error_headline
            || data.error_string
            || data.error_message
            || t('steamActivationFailedDetail', {detail});
    }

    function isSteamActivationSuccess(response) {
        const data = response?.response || response || {};
        const receipt = data.purchase_receipt_info;
        const lineItems = receipt?.line_items || receipt?.lineItems;
        return Boolean(receipt)
            && !receipt.error_string
            && !receipt.error_headline
            && (!Array.isArray(lineItems) || lineItems.length > 0);
    }

    async function runSteamActivationPage() {
        if (steamActivationInProgress) return;
        const queue = getSteamActivationQueue();
        if (queue.length === 0) {
            document.getElementById('hb-helper-steam-activation-status')?.remove();
            return;
        }

        steamActivationInProgress = true;
        const token = await waitForSteamWebApiToken();
        if (!token) {
            renderSteamActivationStatus(t('steamActivationLoginRequired'));
            steamActivationInProgress = false;
            return;
        }

        for (let index = 0; index < queue.length; index++) {
            const item = queue[index];
            if (item.status === 'activated') continue;

            renderSteamActivationStatus(t('steamActivationProgress', {
                title: item.title,
                current: index + 1,
                total: queue.length,
            }));

            try {
                const response = await postSteamActivationKey(token, item.key);
                if (!isSteamActivationSuccess(response)) {
                    const message = getSteamActivationError(response);
                    item.status = 'failed';
                    item.error = message;
                    saveSteamActivationQueue(queue);
                    renderSteamActivationStatus(t('steamActivationFailed', {
                        title: item.title,
                        message,
                    }));
                    steamActivationInProgress = false;
                    return;
                }
                item.status = 'activated';
                saveSteamActivationQueue(queue);
            } catch (error) {
                item.status = 'failed';
                item.error = error.message;
                saveSteamActivationQueue(queue);
                renderSteamActivationStatus(t('steamActivationFailed', {
                    title: item.title,
                    message: error.message,
                }));
                steamActivationInProgress = false;
                return;
            }
        }

        GM_deleteValue(steamActivationQueueKey);
        renderSteamActivationStatus(t('steamActivationComplete', {count: queue.length}));
        steamActivationInProgress = false;
    }

    async function run() {
        if (isSteamRegisterKeyPage()) {
            runSteamActivationPage();
            return;
        }

        if (isLandingSortPage()) {
            observeLandingSortPageChanges();
            refreshLandingSortPage();
            return;
        }

        if (!isPriceTotalsPage()) return;
        observePageChanges();
        refreshHelperPage(true);

        try {
            [ownedApps, wishlistApps] = await Promise.all([fetchOwnedSet(), fetchWishlistSet()]);
            steamLoginRequired = false;
        } catch (error) {
            console.warn('[HB-Helper] Fetch owned games failed:', error);
            steamLoginRequired = true;
            refreshHelperPage();
        }

        if (!steamLoginRequired) {
            renderPriceTotals();
        }

        refreshHelperPage();
    }

    function startHelper() {
        if (!document.body) {
            document.addEventListener('DOMContentLoaded', startHelper, {once: true});
            return;
        }
        run();
    }

    startHelper();

    function gmRequest(url, responseType = 'json', options = {}) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url,
                responseType,
                ...options,
                onload: ({status, response, responseText}) => {
                    if (status !== 200) {
                        reject(new Error(t('requestFailedHttp', {status})));
                        return;
                    }
                    resolve(responseType === 'json' ? response : responseText || response);
                },
                onerror: () => reject(new Error(t('networkRequestFailed'))),
            });
        });
    }

    async function fetchSteamCountryCode() {
        return (await fetchSteamAccountData()).countryCode;
    }

    function getXiaoheiheRegionCode(steamCountryCode) {
        const countryCode = steamCountryCode.toLowerCase();
        const regionAliases = {
            gb: 'uk',
        };
        return regionAliases[countryCode]
            || (europeanSteamCountries.has(steamCountryCode) ? 'eu' : countryCode);
    }

    async function fetchXiaoheihePriceHistory(appId, steamCountryCode) {
        const cacheKey = `${steamCountryCode}:${appId}`;
        if (priceHistoryCache.has(cacheKey)) return priceHistoryCache.get(cacheKey);

        const request = (async () => {
            const params = new URLSearchParams({
                appid: appId,
                platf: 'steam',
                cc: getXiaoheiheRegionCode(steamCountryCode),
                days: '720',
            });
            const data = await gmRequest(
                `https://api.xiaoheihe.cn/game/get_game_prices/history/v2?${params}`
            );
            const prices = data.result?.prices;
            if (data.status !== 'ok' || !prices?.length) {
                throw new Error(t('xiaoheiheNoPrice', {region: steamCountryCode, appId}));
            }

            const latest = prices.at(-1);
            const current = Number(latest.price);
            const discount = Number(latest.discount);
            const previousFullPrice = prices.findLast(price => Number(price.discount) === 0);
            const original = discount > 0
                ? Number(previousFullPrice?.price) || current / (1 - discount / 100)
                : current;
            const lowest = Number(data.result.lowest_info?.price)
                || Math.min(...prices.map(price => Number(price.price)));
            const price = {current, original, lowest, currency: latest.currency};
            if (Object.values(price).some(value => value === undefined || value === null)
                || [current, original, lowest].some(value => !Number.isFinite(value))) {
                throw new Error(t('xiaoheiheInvalidPrice', {appId}));
            }
            return price;
        })();
        priceHistoryCache.set(cacheKey, request);
        try {
            return await request;
        } catch (error) {
            priceHistoryCache.delete(cacheKey);
            throw error;
        }
    }

    async function fetchExchangeRate(baseCurrency, quoteCurrency) {
        if (baseCurrency === quoteCurrency) return 1;
        const cacheKey = `${baseCurrency}:${quoteCurrency}`;
        if (exchangeRateCache.has(cacheKey)) return exchangeRateCache.get(cacheKey);

        const request = gmRequest(
            `https://api.frankfurter.dev/v2/rate/${baseCurrency}/${quoteCurrency}`
        ).then(data => {
            const rate = Number(data.rate);
            if (!Number.isFinite(rate)) throw new Error(t('invalidExchangeRate'));
            return rate;
        });
        exchangeRateCache.set(cacheKey, request);
        try {
            return await request;
        } catch (error) {
            exchangeRateCache.delete(cacheKey);
            throw error;
        }
    }

    function getBundleItemsByTitle() {
        if (!isGamesBundlePage()) return null;
        if (bundleItemsByTitle) return bundleItemsByTitle;

        const dataElement = document.getElementById('webpack-bundle-page-data');
        if (!dataElement) return null;
        const itemData = JSON.parse(dataElement.textContent).bundleData?.tier_item_data;
        if (!itemData) return null;

        bundleItemsByTitle = new Map(
            Object.values(itemData)
                .filter(item => item.human_name)
                .map(item => [normalizeSteamTitle(item.human_name), item])
        );
        return bundleItemsByTitle;
    }

    function isSteamBundleItem(item) {
        return item.cta_badge?.badge !== 'coupon'
            && Boolean(item.availability_icons?.delivery_to_platform?.['hb-steam']);
    }

    function shouldMatchSteamTitle(title) {
        const item = getBundleItemsByTitle()?.get(normalizeSteamTitle(title));
        return !item || isSteamBundleItem(item);
    }

    function getVisibleGameTitles() {
        return Array.from(document.querySelectorAll(
            '.tier-item-view .item-title, '
            + '.choice-content.js-open-choice-modal .content-choice-title'
        ))
            .filter(title => title.getClientRects().length > 0)
            .map(title => title.textContent.trim())
            .filter(title => title && shouldMatchSteamTitle(title));
    }

    function formatPrice(value, currencyCode) {
        return new Intl.NumberFormat(currentLanguage === 'zh-CN' ? 'zh-CN' : 'en-US', {
            style: 'currency',
            currency: currencyCode,
        }).format(value);
    }

    function appendMatchDetails(summary, unmatchedGames, unpricedGames) {
        const groups = [
            [t('steamItemNotFound'), unmatchedGames],
            [t('regionalPriceUnavailable'), unpricedGames],
        ].filter(([, games]) => games.length > 0);
        if (groups.length === 0) return;

        const details = document.createElement('details');
        details.className = 'hb-helper-match-details';
        const detailsSummary = document.createElement('summary');
        const missingCount = groups.reduce((total, [, games]) => total + games.length, 0);
        detailsSummary.textContent = t('showUnpricedItems', {count: missingCount});
        details.appendChild(detailsSummary);

        for (const [label, games] of groups) {
            const group = document.createElement('div');
            group.className = 'hb-helper-match-group';
            const heading = document.createElement('strong');
            heading.textContent = `${label} (${games.length})`;
            const list = document.createElement('ul');
            for (const game of games) {
                const item = document.createElement('li');
                item.textContent = game.title;
                list.appendChild(item);
            }
            group.append(heading, list);
            details.appendChild(group);
        }
        summary.appendChild(details);
    }

    function renderPriceTotals() {
        if (!lastPriceResult) return;
        const summary = document.getElementById('hb-helper-price-summary');
        if (!summary) return;

        const {
            region, currencyCode, humbleCurrencyCode, exchangeRate, games
        } = lastPriceResult;
        const canFilterOwned = ownedApps && !steamLoginRequired;
        if (!canFilterOwned) priceScope = 'all';
        const selectedGames = priceScope === 'unowned'
            ? games.filter(game => !game.appId || !ownedApps.has(game.appId))
            : games;
        const matchedGames = selectedGames.filter(game => game.appId);
        const pricedGames = selectedGames.filter(game => game.price);
        const unmatchedGames = selectedGames.filter(game => !game.appId);
        const unpricedGames = matchedGames.filter(game => !game.price);
        const totals = pricedGames.reduce((total, game) => ({
            current: total.current + game.price.current,
            original: total.original + game.price.original,
            lowest: total.lowest + game.price.lowest,
        }), {current: 0, original: 0, lowest: 0});
        const formatTotal = value => {
            if (!currencyCode || pricedGames.length === 0) return t('unavailable');
            const steamPrice = formatPrice(value, currencyCode);
            if (!humbleCurrencyCode || !exchangeRate) return steamPrice;
            return `${steamPrice} (${t('hbPrice', {
                price: formatPrice(value * exchangeRate, humbleCurrencyCode),
            })})`;
        };
        const scopeLabel = priceScope === 'all' ? t('showUnowned') : t('showAll');
        const scopeDescription = canFilterOwned
            ? t('togglePriceScope')
            : t('loginFilterOwned');
        const priceRegion = currencyCode ? `${region}, ${currencyCode}` : region;
        const scope = priceScope === 'all' ? t('allItems') : t('unownedItems');

        summary.textContent = '';
        const header = document.createElement('div');
        header.className = 'hb-helper-price-header';
        const title = document.createElement('div');
        title.className = 'hb-helper-price-title';
        title.textContent = t('priceTotalsTitle', {priceRegion});
        const scopeButton = document.createElement('button');
        scopeButton.id = 'hb-helper-price-scope';
        scopeButton.type = 'button';
        scopeButton.title = scopeDescription;
        scopeButton.disabled = !canFilterOwned;
        scopeButton.textContent = scopeLabel;
        header.append(title, scopeButton);
        summary.appendChild(header);

        const addPriceLine = (label, value) => {
            const row = document.createElement('div');
            const price = document.createElement('span');
            price.className = 'hb-helper-price-value';
            price.textContent = value;
            row.append(`${label}: `, price);
            summary.appendChild(row);
        };
        addPriceLine(t('currentPrice'), formatTotal(totals.current));
        addPriceLine(t('originalPrice'), formatTotal(totals.original));
        addPriceLine(t('historicalLow'), formatTotal(totals.lowest));

        const matchedLine = document.createElement('div');
        matchedLine.textContent = t('matchedItems', {
            matched: matchedGames.length,
            selected: selectedGames.length,
            scope,
        });
        const pricedLine = document.createElement('div');
        pricedLine.textContent = t('pricedItems', {
            priced: pricedGames.length,
            matched: matchedGames.length,
        });
        summary.append(matchedLine, pricedLine);
        appendMatchDetails(summary, unmatchedGames, unpricedGames);

        scopeButton.addEventListener('click', () => {
            priceScope = priceScope === 'all' ? 'unowned' : 'all';
            renderPriceTotals();
        });
    }

    function schedulePriceTotalsReload(force = false) {
        const titles = [...new Set(getVisibleGameTitles())];
        if (titles.length === 0) {
            priceTotalsRunId++;
            lastPriceTitlesKey = '';
            return;
        }

        const titlesKey = [...titles].sort().join('\n');
        if (!force && titlesKey === lastPriceTitlesKey) return;
        lastPriceTitlesKey = titlesKey;
        loadPriceTotals(titles);
    }

    async function loadPriceTotals(titles) {
        const runId = ++priceTotalsRunId;
        const summary = document.getElementById('hb-helper-price-summary');
        if (summary) summary.textContent = t('loadingPriceTotals');
        lastPriceResult = null;

        try {
            const humbleCurrencyCode = findHumbleCurrencyCode();
            const resolvedGames = await Promise.all(titles.map(async title => {
                const app = await findSteamApp(title);
                return {title, appId: app?.appid || null};
            }));
            const games = resolvedGames.filter((game, index) =>
                !game.appId
                || resolvedGames.findIndex(other => other.appId === game.appId) === index
            );
            const steamCountryCode = await fetchSteamCountryCode();
            const appIds = games.map(game => game.appId).filter(Boolean);
            const pricesByAppId = new Map();
            for (const appId of appIds) {
                try {
                    pricesByAppId.set(
                        appId,
                        await fetchXiaoheihePriceHistory(appId, steamCountryCode)
                    );
                } catch (error) {
                    console.warn('[HB-Helper] Fetch price failed:', error);
                }
            }
            if (runId !== priceTotalsRunId) return;

            const currencyCode = pricesByAppId.values().next().value?.currency || null;
            let exchangeRate;
            if (currencyCode && humbleCurrencyCode && humbleCurrencyCode !== currencyCode) {
                try {
                    exchangeRate = await fetchExchangeRate(currencyCode, humbleCurrencyCode);
                } catch (error) {
                    console.warn('[HB-Helper] Fetch exchange rate failed:', error);
                }
            }
            if (runId !== priceTotalsRunId) return;

            lastPriceResult = {
                region: steamCountryCode,
                currencyCode,
                humbleCurrencyCode,
                exchangeRate,
                games: games.map(game => ({
                    ...game,
                    price: pricesByAppId.get(game.appId) || null,
                })),
            };
            renderPriceTotals();
        } catch (error) {
            if (runId !== priceTotalsRunId) return;
            console.warn('[HB-Helper] Load bundle price totals failed:', error);
            if (summary) summary.textContent = error.message;
        }
    }

    async function markGame(viewEl, appSet, className) {
        if (viewEl.classList.contains(className)) return;
        const titleEl = viewEl.querySelector('.item-title, .content-choice-title');
        if (!titleEl) return;
        const title = titleEl.textContent.trim();
        if (!shouldMatchSteamTitle(title)) return;
        const app = await findSteamApp(title);
        if (app && appSet.has(app.appid)) viewEl.classList.add(className);
    }

    // Owned Games Check: Check a single game element and mark it as owned if it matches the user's owned app set
    function markOne(viewEl, ownedSet) {
        return markGame(viewEl, ownedSet, 'owned');
    }

    function markWishlistOne(viewEl, wishlistSet) {
        return markGame(viewEl, wishlistSet, 'wishlist');
    }

    // Region Restriction Check
    getRegionLockInfo();

    // Region Restriction Check: Collect region-lock data embedded in the page and render it
    function getRegionLockInfo() {
        const productsInfo = {};
        const splitedURL = location.href.split(/downloads\?key=([A-Za-z0-9]+)/);
        if (splitedURL.length >= 2) {
            const orderID = splitedURL[1];
            const ApiURL = `https://www.humblebundle.com/api/v1/order/${orderID}?all_tpkds=true`;
            console.log('Humble Key Restriction User Script::', `Request API ${ApiURL}`);
            GM_xmlhttpRequest({
                method: 'GET',
                url: ApiURL,
                onload: (res) => {
                    const {status, responseText} = res;
                    if (status === 200) {
                        if (responseText !== '') {
                            const products = JSON.parse(responseText).tpkd_dict.all_tpks;
                            for (let product of products) {
                                const humanName = product.human_name;
                                productsInfo[humanName] = {};
                                productsInfo[humanName].exclusive_countries = product.exclusive_countries || [];
                                productsInfo[humanName].disallowed_countries = product.disallowed_countries || [];
                                productsInfo[humanName].machine_name = product.machine_name;
                                if (product.steam_app_id && product.steam_app_id !== '') {
                                    productsInfo[humanName].steam_app_id = product.steam_app_id;
                                }
                            }
                            setTimeout(() => {
                                const disclaimers = document.querySelectorAll('.disclaimer');
                                Object.values(productsInfo).forEach((info, idx) => insertRegionLockInfo(info, disclaimers[idx]));
                            }, 1000);
                        }
                    } else {
                        console.error('Humble Key Restriction User Script::', `Request order failed with ${status} HTTP status and ${responseText} content.`);
                    }
                },
            });
        }
    }

    function insertRegionLockInfo(productInfo, container) {
        const insertElem = document.createElement('div');

        // Region Restriction Check: Determine activation possibility for the current user
        const restrictionInfo = document.createElement('span');
        if (productInfo.exclusive_countries.length === 0 && productInfo.disallowed_countries.length === 0) {
            restrictionInfo.textContent = t('noRegionRestrictions');
            restrictionInfo.setAttribute('style', `color:green; font-weight: bold; word-wrap:break-word; overflow:hidden;`);
        } else if (productInfo.exclusive_countries.length > 0) {
            restrictionInfo.textContent = t('exclusiveCountries', {
                countries: productInfo.exclusive_countries,
            });
            restrictionInfo.setAttribute('style', `color:red; font-weight: bold; word-wrap:break-word; overflow:hidden;`);
        } else if (productInfo.disallowed_countries.length > 0) {
            restrictionInfo.textContent = t('disallowedCountries', {
                countries: productInfo.disallowed_countries,
            });
            restrictionInfo.setAttribute('style', `color:red; font-weight: bold; word-wrap:break-word; overflow:hidden;`);
        }

        insertElem.appendChild(document.createElement('br'));
        insertElem.appendChild(restrictionInfo);
        const target = container || document.querySelector('.disclaimer') || document.body;
        if (target) target.appendChild(insertElem);
    }

})();
