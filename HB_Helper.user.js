// ==UserScript==
// @name         HumbleBundle Helper
// @name:zh-CN   Humble Bundle 助手
// @namespace    https://github.com/penguin-madagascar/HumbleBundle_Helper
// @version      0.0.26
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
// @grant        GM_openInTab
// @grant        GM_addValueChangeListener
// @grant        GM_setClipboard
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
    #hb-helper-choice-activation-results {
      box-sizing: border-box !important;
      flex: 1 0 100% !important;
      width: 100% !important;
    }
    #hb-helper-choice-activation-results .hb-helper-choice-result-summary {
      font-weight: 700 !important;
    }
    #hb-helper-choice-activation-results .hb-helper-choice-result-warning {
      color: #ffd166 !important;
      margin-top: 4px !important;
    }
    #hb-helper-choice-activation-results .hb-helper-choice-result-group {
      background: rgba(255, 255, 255, 0.08) !important;
      border-radius: 4px !important;
      margin-top: 8px !important;
      padding: 8px !important;
    }
    #hb-helper-choice-activation-results h4 {
      font-size: 1em !important;
      margin: 0 0 4px !important;
    }
    #hb-helper-choice-activation-results .hb-helper-choice-result-row +
    .hb-helper-choice-result-row {
      margin-top: 5px !important;
    }
    #hb-helper-choice-activation-results .hb-helper-choice-failed-key {
      background: rgba(0, 0, 0, 0.35) !important;
      border-color: rgba(255, 255, 255, 0.45) !important;
      display: block !important;
      font-family: ui-monospace, SFMono-Regular, Consolas, monospace !important;
      font-weight: 400 !important;
      margin-top: 4px !important;
      overflow-wrap: anywhere !important;
      text-align: left !important;
      width: 100% !important;
    }
    #hb-helper-choice-activation-results .hb-helper-choice-copy-feedback {
      min-height: 1.5em !important;
      margin-top: 4px !important;
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
            requestTimedOut: 'The network request timed out.',
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
            choiceActivationBusy: 'Another Humble Choice activation batch is already in progress.',
            choiceWebLocksUnavailable: 'Activation was stopped because this browser does not support the Web Locks API. Update or switch browsers, then try again.',
            choiceRevealStarting: 'Preparing {count} selected game key(s)...',
            choiceRevealProgress: 'Revealing key for {title} ({current}/{total})...',
            choiceRevealFailed: 'Could not reveal a Steam key for {title}',
            choiceModalCloseFailed: 'Could not safely close the Humble details dialog for {title}. The key was not queued.',
            choiceQueueReady: 'Opening Steam activation page for {count} key(s)...',
            choiceHumbleFailureReason: 'Humble did not provide a Steam key for this game.',
            choiceActivationSummary: '{total} processed: {activated} activated, {humbleFailed} Humble key retrieval failure(s), {steamFailed} Steam activation failure(s), {pending} pending.',
            choiceHumbleFailureGroup: 'Humble key retrieval failures',
            choiceSteamFailureGroup: 'Steam activation failures',
            choiceFailureRow: 'Game: {title} — Reason: {reason}',
            choiceCopyFailedKey: 'Copy the failed Steam key for {title}',
            choiceCopiedFailedKey: 'Copied the Steam key for {title}.',
            choiceOwnershipRefreshWarning: 'Warning: Steam ownership could not be refreshed after activation.',
            choiceOwnershipRefreshUnsupportedWarning: 'Warning: Steam ownership could not be refreshed because this browser does not support the Web Locks API. Activation controls have been unlocked.',
            steamActivationTitle: 'Humble Choice key activation',
            steamActivationLoginRequired: 'Log in to Steam, then refresh this page to continue activating queued keys',
            steamActivationProgress: 'Activating {title} ({current}/{total})...',
            steamActivationComplete: 'Activated {count} key(s)',
            steamActivationFailed: 'Activation failed for {title}: {message}',
            steamActivationFailedDetail: 'Steam returned result detail {detail}',
            steamActivationAlreadyOwned: 'The Steam account already owns this product.',
            steamActivationRegionRestricted: 'This product cannot be activated in the Steam account region.',
            steamActivationInvalidKey: 'Steam rejected this product key as invalid.',
            steamActivationAlreadyUsed: 'This product key has already been activated on another Steam account.',
            steamActivationBaseGameRequired: 'The required base game is not owned by this Steam account.',
            steamActivationRateLimited: 'Steam rejected the request because the activation or request limit was reached.',
            steamActivationUnknownCode: 'Steam activation failed (result code {code}).',
            steamActivationRequestFailed: 'The Steam activation request failed: {message}',
            steamActivationInterruptedUncertain: 'Steam activation was interrupted after the request began. The result is uncertain, so this key was not submitted again.',
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
            requestTimedOut: '网络请求超时。',
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
            choiceActivationBusy: '另一个 Humble Choice 激活批次正在处理中。',
            choiceWebLocksUnavailable: '此浏览器不支持 Web Locks API，已停止激活。请更新或更换浏览器后重试。',
            choiceRevealStarting: '正在准备 {count} 个已选游戏的 key...',
            choiceRevealProgress: '正在显示 {title} 的 key（{current}/{total}）...',
            choiceRevealFailed: '无法显示 {title} 的 Steam key',
            choiceModalCloseFailed: '无法安全关闭 {title} 的 Humble 详情弹窗，因此未将此 key 加入队列。',
            choiceQueueReady: '正在打开 Steam 激活页面，将激活 {count} 个 key...',
            choiceHumbleFailureReason: 'Humble 未能为此游戏提供 Steam key。',
            choiceActivationSummary: '共处理 {total} 个：已激活 {activated} 个，Humble key 获取失败 {humbleFailed} 个，Steam 激活失败 {steamFailed} 个，等待处理 {pending} 个。',
            choiceHumbleFailureGroup: 'Humble key 获取失败',
            choiceSteamFailureGroup: 'Steam 激活失败',
            choiceFailureRow: '游戏：{title} — 原因：{reason}',
            choiceCopyFailedKey: '复制 {title} 激活失败的 Steam key',
            choiceCopiedFailedKey: '已复制 {title} 的 Steam key。',
            choiceOwnershipRefreshWarning: '警告：激活完成后无法刷新 Steam 拥有状态。',
            choiceOwnershipRefreshUnsupportedWarning: '警告：此浏览器不支持 Web Locks API，无法刷新 Steam 拥有状态。激活控件已解锁。',
            steamActivationTitle: 'Humble Choice key 激活',
            steamActivationLoginRequired: '请登录 Steam，然后刷新此页面继续激活等待队列',
            steamActivationProgress: '正在激活 {title}（{current}/{total}）...',
            steamActivationComplete: '已激活 {count} 个 key',
            steamActivationFailed: '{title} 激活失败：{message}',
            steamActivationFailedDetail: 'Steam 返回结果详情 {detail}',
            steamActivationAlreadyOwned: '此 Steam 账号已拥有该产品。',
            steamActivationRegionRestricted: '该产品无法在此 Steam 账号所在地区激活。',
            steamActivationInvalidKey: 'Steam 判定此产品 key 无效。',
            steamActivationAlreadyUsed: '此产品 key 已在其他 Steam 账号上激活。',
            steamActivationBaseGameRequired: '此 Steam 账号尚未拥有所需的基础游戏。',
            steamActivationRateLimited: '已达到 Steam 激活或请求频率限制，本次请求被拒绝。',
            steamActivationUnknownCode: 'Steam 激活失败（结果代码 {code}）。',
            steamActivationRequestFailed: 'Steam 激活请求失败：{message}',
            steamActivationInterruptedUncertain: 'Steam 激活请求开始后被中断，结果不确定，因此不会再次提交此 key。',
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
    const steamActivationBatchKey = 'hb-helper-steam-activation-batch-v2';
    const legacySteamActivationQueueKey = 'hb-helper-steam-activation-queue-v1';
    const choiceActivationBatchStates = Object.freeze({
        collecting: 'collecting',
        activating: 'activating',
        complete: 'complete',
    });
    const choiceActivationItemStates = Object.freeze({
        humbleFailed: 'humble-key-retrieval-failed',
        pending: 'pending-steam-activation',
        activating: 'activating',
        activated: 'activated',
        steamFailed: 'steam-activation-failed',
    });
    const choiceActivationOwnershipStates = Object.freeze({
        waiting: 'waiting',
        pending: 'pending',
        refreshing: 'refreshing',
        complete: 'complete',
        failed: 'failed',
    });
    const choiceActivationBatchVersion = 2;
    const choiceActivationRunnerLeaseMs = 120000;
    const choiceOwnershipRefreshLeaseMs = 60000;
    const choiceCollectionLockName = 'hb-helper-choice-collection';
    const steamActivationLockName = 'hb-helper-choice-steam-activation';
    const choiceOwnershipRefreshLockName = 'hb-helper-choice-ownership-refresh';
    const steamAccountDataLockName = 'hb-helper-steam-account-data';
    const choiceSelectionLockName = 'hb-helper-choice-selection';
    const choiceLockRetryMs = 250;
    const gmRequestTimeoutMs = 20000;
    const steamRegisterKeyUrl = 'https://store.steampowered.com/account/registerkey';
    const choiceRuntimeOwnerId = typeof crypto !== 'undefined'
        && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const steamRequestOptions = {
        cookiePartition: {topLevelSite: 'https://store.steampowered.com'},
    };
    let bundleItemsByTitle;
    let steamAccountDataPromise;
    let steamAccountDataGeneration = 0;
    let steamAccountDataPendingGeneration;
    let steamAccountCacheObserved = false;
    let steamAccountApplyPromise = Promise.resolve();
    let lastAppliedSteamAccountUpdatedAt = 0;
    let pageRefreshTimer;
    let choiceCollectionRecoveryTimer;
    let choiceOwnershipRefreshTimer;
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
    let choiceActivationBatchListener;
    let choiceSelectionListener;
    const cachedChoiceSelection = GM_getValue(choiceSelectionCacheKey, []);
    const selectedChoiceGameIds = new Set(
        Array.isArray(cachedChoiceSelection) ? cachedChoiceSelection : []
    );
    GM_deleteValue(legacySteamActivationQueueKey);
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

    function isSteamAccountData(data) {
        return Boolean(data
            && /^[A-Z]{2}$/.test(data.countryCode)
            && Array.isArray(data.ownedApps)
            && Array.isArray(data.wishlistApps)
            && Number.isFinite(data.updatedAt)
            && data.updatedAt > 0);
    }

    function getCachedSteamAccountData() {
        const data = GM_getValue(steamAccountCacheKey);
        return isSteamAccountData(data) ? data : null;
    }

    function parseSteamUserInfo(html) {
        const steamPage = new DOMParser().parseFromString(html, 'text/html');
        const userInfoText = steamPage.querySelector('#application_config')
            ?.getAttribute('data-userinfo');
        return JSON.parse(userInfoText || '{}');
    }

    async function requestSteamAccountSnapshot({
        generation,
        allowCachedFallback,
        request,
        parseUserInfo,
    }) {
        try {
            const html = await request(
                `https://store.steampowered.com/?l=english&_=${Date.now()}`,
                'text',
                steamRequestOptions
            );
            if (generation !== steamAccountDataGeneration) return {superseded: true};
            const userInfo = parseUserInfo(html);
            if (!userInfo.logged_in) throw new Error(t('loginSteamLoadAccountData'));

            const userData = await request(
                `https://store.steampowered.com/dynamicstore/userdata/?_=${Date.now()}`,
                'json',
                {
                    ...steamRequestOptions,
                    headers: {'Cache-Control': 'no-cache'},
                }
            );
            if (generation !== steamAccountDataGeneration) return {superseded: true};
            if (!Array.isArray(userData?.rgOwnedApps)
                || !Array.isArray(userData?.rgWishlist)) {
                throw new Error(t('steamInvalidAccountData'));
            }

            const cachedData = getCachedSteamAccountData();
            const data = {
                countryCode: userInfo.country_code.toUpperCase(),
                ownedApps: userData.rgOwnedApps,
                wishlistApps: userData.rgWishlist,
                updatedAt: Math.max(Date.now(), (cachedData?.updatedAt || 0) + 1),
            };
            if (generation !== steamAccountDataGeneration) return {superseded: true};
            GM_setValue(steamAccountCacheKey, data);
            return {data};
        } catch (error) {
            if (generation !== steamAccountDataGeneration) return {superseded: true};
            if (!allowCachedFallback) throw error;
            const cachedData = getCachedSteamAccountData();
            if (!cachedData) throw error;
            console.warn('[HB-Helper] Using cached Steam account data:', error);
            return {data: cachedData};
        }
    }

    function fetchSteamAccountData({
        force = false,
        allowCachedFallback = true,
        request = gmRequest,
        parseUserInfo = parseSteamUserInfo,
        lockManager,
        requireLock = false,
    } = {}) {
        if (!force && steamAccountDataPromise) return steamAccountDataPromise;

        const requestStartedAt = Date.now();
        const generation = ++steamAccountDataGeneration;
        steamAccountDataPendingGeneration = generation;
        const loadPromise = (async () => {
            const manager = getChoiceLockManager(lockManager);
            let outcome;
            if (manager && typeof manager.request === 'function') {
                outcome = await manager.request(
                    steamAccountDataLockName,
                    {mode: 'exclusive'},
                    async () => {
                        if (generation !== steamAccountDataGeneration) {
                            return {superseded: true};
                        }
                        const cachedData = getCachedSteamAccountData();
                        if (!force
                            && cachedData
                            && cachedData.updatedAt >= requestStartedAt) {
                            return {data: cachedData};
                        }
                        return requestSteamAccountSnapshot({
                            generation,
                            allowCachedFallback,
                            request,
                            parseUserInfo,
                        });
                    }
                );
            } else {
                if (requireLock) throw new Error(t('choiceWebLocksUnavailable'));
                outcome = await requestSteamAccountSnapshot({
                    generation,
                    allowCachedFallback,
                    request,
                    parseUserInfo,
                });
            }
            if (outcome.superseded) return steamAccountDataPromise;
            return outcome.data;
        })();
        const requestPromise = loadPromise
            .catch(error => {
                if (generation === steamAccountDataGeneration
                    && steamAccountDataPromise === requestPromise) {
                    const cachedData = getCachedSteamAccountData();
                    steamAccountDataPromise = cachedData
                        ? Promise.resolve(cachedData)
                        : undefined;
                }
                throw error;
            })
            .finally(() => {
                if (steamAccountDataPendingGeneration === generation) {
                    steamAccountDataPendingGeneration = undefined;
                }
            });
        steamAccountDataPromise = requestPromise;
        return requestPromise;
    }

    function applySteamAccountData(
        account,
        {
            reconcileClasses = reconcileVisibleGameClasses,
            refreshUi = () => {
                renderChoiceSelectionState();
                refreshHelperPage(true);
            },
        } = {}
    ) {
        const apply = async () => {
            if (!isSteamAccountData(account)
                || account.updatedAt <= lastAppliedSteamAccountUpdatedAt) {
                return {applied: false};
            }
            const previousUpdatedAt = lastAppliedSteamAccountUpdatedAt;
            lastAppliedSteamAccountUpdatedAt = account.updatedAt;
            const nextOwnedApps = new Set(account.ownedApps);
            const nextWishlistApps = new Set(account.wishlistApps);
            ownedApps = nextOwnedApps;
            wishlistApps = nextWishlistApps;
            steamLoginRequired = false;
            if (steamAccountDataPendingGeneration === undefined) {
                steamAccountDataPromise = Promise.resolve(account);
            }
            try {
                await reconcileClasses(nextOwnedApps, nextWishlistApps);
                refreshUi();
                return {
                    applied: true,
                    ownedApps: nextOwnedApps,
                    wishlistApps: nextWishlistApps,
                };
            } catch (error) {
                if (lastAppliedSteamAccountUpdatedAt === account.updatedAt) {
                    lastAppliedSteamAccountUpdatedAt = previousUpdatedAt;
                }
                throw error;
            }
        };
        steamAccountApplyPromise = steamAccountApplyPromise.then(apply, apply);
        return steamAccountApplyPromise;
    }

    function applyCachedSteamAccountData(options = {}) {
        const cachedData = getCachedSteamAccountData();
        return cachedData
            ? applySteamAccountData(cachedData, options)
            : Promise.resolve({applied: false});
    }

    function observeSteamAccountCache({applyAccountData = applySteamAccountData} = {}) {
        if (steamAccountCacheObserved) return;
        steamAccountCacheObserved = true;
        GM_addValueChangeListener(
            steamAccountCacheKey,
            (name, oldValue, newValue) => {
                Promise.resolve(applyAccountData(newValue)).catch(error => {
                    console.warn('[HB-Helper] Apply shared Steam account data failed:', error);
                });
            }
        );
    }

    async function loadSteamAccountSets(options = {}) {
        const account = await fetchSteamAccountData(options);
        await applySteamAccountData(account);
        return {ownedApps, wishlistApps};
    }

    function getLoadedSteamAccountSets() {
        return {ownedApps, wishlistApps};
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

    function getChoiceSelection(value = GM_getValue(choiceSelectionCacheKey, [])) {
        const values = Array.isArray(value) || value instanceof Set ? [...value] : [];
        return new Set(values.filter(isNonEmptyString));
    }

    function getSelectedChoiceGameIds() {
        return new Set(selectedChoiceGameIds);
    }

    function replaceChoiceSelection(value) {
        const nextSelection = getChoiceSelection(value);
        if (nextSelection.size === selectedChoiceGameIds.size
            && [...nextSelection].every(id => selectedChoiceGameIds.has(id))) {
            return false;
        }
        selectedChoiceGameIds.clear();
        nextSelection.forEach(id => selectedChoiceGameIds.add(id));
        renderChoiceSelectionState();
        return true;
    }

    function observeChoiceSelection() {
        if (choiceSelectionListener !== undefined) return;
        choiceSelectionListener = GM_addValueChangeListener(
            choiceSelectionCacheKey,
            (name, oldValue, newValue) => replaceChoiceSelection(newValue)
        );
    }

    async function updateChoiceSelection(update, {lockManager} = {}) {
        const mutateStoredSelection = async () => {
            const storedSelection = getChoiceSelection();
            const nextSelection = new Set(storedSelection);
            await update(nextSelection);
            const changed = nextSelection.size !== storedSelection.size
                || [...nextSelection].some(id => !storedSelection.has(id));
            if (changed) GM_setValue(choiceSelectionCacheKey, [...nextSelection]);
            replaceChoiceSelection(nextSelection);
            return {updated: changed, selection: new Set(nextSelection)};
        };
        const lockResult = await requestChoiceExclusiveLock(
            choiceSelectionLockName,
            mutateStoredSelection,
            {lockManager}
        );
        if (lockResult.unsupported) return mutateStoredSelection();
        if (!lockResult.acquired) return lockResult;
        return lockResult.value;
    }

    function setElementTextContent(element, value) {
        if (!element) return;
        const nextValue = value || '';
        if (element.textContent !== nextValue) element.textContent = nextValue;
    }

    function setChoiceStatus(message) {
        const status = document.querySelector(
            '#hb-helper-choice-activation-controls .hb-helper-choice-status'
        );
        setElementTextContent(status, message);
    }

    function renderChoiceSelectionTiles(tiles, selection = selectedChoiceGameIds) {
        tiles.forEach(tile => {
            const id = getChoiceTileId(tile);
            tile.classList.toggle('hb-helper-choice-selected', selection.has(id));
        });
    }

    function renderChoiceSelectionState() {
        renderChoiceSelectionTiles(getVisibleChoiceTiles());

        const controls = document.getElementById('hb-helper-choice-activation-controls');
        if (!controls) return;
        const controlsLocked = choiceActivationInProgress || isChoiceActivationBatchActive();
        if (controlsLocked) choiceSelectionMode = false;
        const activateButton = controls.querySelector('[data-hb-helper-choice-action="activate"]');
        const selectUnownedButton = controls.querySelector('[data-hb-helper-choice-action="select-unowned"]');
        const selectButton = controls.querySelector('[data-hb-helper-choice-action="select"]');
        const clearButton = controls.querySelector('[data-hb-helper-choice-action="clear"]');
        if (activateButton) activateButton.disabled = controlsLocked;
        if (selectUnownedButton) selectUnownedButton.disabled = controlsLocked;
        if (selectButton) {
            selectButton.disabled = controlsLocked;
            setElementTextContent(
                selectButton,
                choiceSelectionMode ? t('choiceSelectDone') : t('choiceSelect')
            );
            selectButton.setAttribute('aria-pressed', String(choiceSelectionMode));
        }
        if (clearButton) clearButton.disabled = controlsLocked;
        if (!choiceActivationInProgress) {
            setChoiceStatus(t('choiceSelectedCount', {count: selectedChoiceGameIds.size}));
        }
        document.documentElement.classList.toggle('hb-helper-choice-select-mode', choiceSelectionMode);
    }

    function setChoiceSelectionMode(enabled) {
        if (enabled && isChoiceActivationBatchActive()) return;
        choiceSelectionMode = enabled;
        renderChoiceSelectionState();
    }

    async function toggleChoiceTileSelection(tile) {
        if (isChoiceActivationBatchActive()) return;
        const id = getChoiceTileId(tile);
        return updateChoiceSelection(selection => {
            if (selection.has(id)) selection.delete(id);
            else selection.add(id);
        });
    }

    async function selectUnownedChoiceTiles() {
        if (isChoiceActivationBatchActive()) return;
        const unownedIds = getVisibleChoiceTiles()
            .filter(tile => !tile.classList.contains('owned'))
            .map(getChoiceTileId);
        return updateChoiceSelection(selection => {
            selection.clear();
            unownedIds.forEach(id => selection.add(id));
        });
    }

    async function clearChoiceSelection() {
        if (isChoiceActivationBatchActive()) return;
        return updateChoiceSelection(selection => selection.clear());
    }

    function getSelectedChoiceTiles() {
        return getVisibleChoiceTiles()
            .filter(tile => selectedChoiceGameIds.has(getChoiceTileId(tile)));
    }

    function handleChoiceSelectionClick(event) {
        if (!choiceSelectionMode || !isChoicePage() || isChoiceActivationBatchActive()) return;
        const tile = event.target.closest?.('.choice-content.js-open-choice-modal');
        if (!tile) return;
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        toggleChoiceTileSelection(tile).catch(error => {
            console.warn('[HB-Helper] Update Choice selection failed:', error);
        });
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
            if (!isVisibleElement(input)) continue;
            const key = findSteamKeyInText(input.value);
            if (key) return key;
        }
        for (const keyField of scope.querySelectorAll('.keyfield-value')) {
            if (!isVisibleElement(keyField)) continue;
            const key = findSteamKeyInText(normalizedText(keyField));
            if (key) return key;
        }
        return null;
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

    async function closeChoiceModal(modal = getActiveChoiceModal()) {
        if (!modal || getActiveChoiceModal() !== modal) return true;
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
        return Boolean(await waitForCondition(() => getActiveChoiceModal() !== modal, 1200));
    }

    function isChoiceModalForTile(modal, tile) {
        const modalTitle = normalizeSteamTitle(normalizedText(findChoiceModalTitle(modal)));
        const tileTitle = normalizeSteamTitle(getChoiceTileTitle(tile));
        return Boolean(modalTitle && tileTitle && modalTitle === tileTitle);
    }

    function getChoiceModalContentSnapshot(modal) {
        if (!modal) return '';
        const fields = Array.from(
            modal.querySelectorAll('input, textarea, .keyfield-value')
        ).map(element => typeof element.value === 'string'
            ? element.value
            : normalizedText(element)
        );
        return JSON.stringify({text: normalizedText(modal), fields});
    }

    function createChoiceModalCloseError(tile) {
        return new Error(t('choiceModalCloseFailed', {title: getChoiceTileTitle(tile)}));
    }

    async function revealChoiceSteamKey(tile) {
        const activeModalBeforeClick = getActiveChoiceModal();
        if (activeModalBeforeClick && !await closeChoiceModal(activeModalBeforeClick)) {
            throw createChoiceModalCloseError(tile);
        }
        const modalBeforeClick = document.getElementById('site-modal');
        const modalSnapshotBeforeClick = getChoiceModalContentSnapshot(modalBeforeClick);
        tile.click();
        const modal = await waitForCondition(() => {
            const activeModal = getActiveChoiceModal();
            if (!activeModal || !isChoiceModalForTile(activeModal, tile)) return null;
            const contentChanged = !modalSnapshotBeforeClick
                || getChoiceModalContentSnapshot(activeModal) !== modalSnapshotBeforeClick;
            return activeModal !== modalBeforeClick || contentChanged ? activeModal : null;
        }, 8000);
        if (!modal) {
            const unmatchedModal = getActiveChoiceModal();
            if (unmatchedModal && !await closeChoiceModal(unmatchedModal)) {
                throw createChoiceModalCloseError(tile);
            }
            return null;
        }

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
            if (!await closeChoiceModal(modal)) {
                throw createChoiceModalCloseError(tile);
            }
        }
    }

    function getChoiceLockManager(lockManager) {
        if (lockManager !== undefined) return lockManager;
        return typeof navigator !== 'undefined' ? navigator.locks : null;
    }

    async function requestChoiceExclusiveLock(
        name,
        callback,
        {lockManager, ifAvailable = false} = {}
    ) {
        const manager = getChoiceLockManager(lockManager);
        if (!manager || typeof manager.request !== 'function') {
            return {
                acquired: false,
                unsupported: true,
                message: t('choiceWebLocksUnavailable'),
            };
        }

        return manager.request(
            name,
            {mode: 'exclusive', ...(ifAvailable ? {ifAvailable: true} : {})},
            async lock => {
                if (!lock) return {acquired: false, unsupported: false};
                return {
                    acquired: true,
                    unsupported: false,
                    value: await callback(),
                };
            }
        );
    }

    function createChoiceActivationBatch(owner = choiceRuntimeOwnerId, now = Date.now()) {
        const randomId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        return {
            version: choiceActivationBatchVersion,
            id: randomId,
            state: choiceActivationBatchStates.collecting,
            runner: {
                phase: choiceActivationBatchStates.collecting,
                owner,
                leaseExpiresAt: now + choiceActivationRunnerLeaseMs,
            },
            ownershipRefresh: {
                state: choiceActivationOwnershipStates.waiting,
                owner: null,
                leaseExpiresAt: null,
                error: null,
            },
            items: [],
        };
    }

    function hasOnlyKeys(value, allowedKeys) {
        return value
            && typeof value === 'object'
            && !Array.isArray(value)
            && Object.keys(value).every(key => allowedKeys.includes(key));
    }

    function isNonEmptyString(value) {
        return typeof value === 'string' && value.trim().length > 0;
    }

    function isValidChoiceActivationItem(item) {
        if (!hasOnlyKeys(item, ['id', 'title', 'key', 'status', 'error', 'code'])
            || !isNonEmptyString(item.id)
            || !isNonEmptyString(item.title)
            || !Object.values(choiceActivationItemStates).includes(item.status)
            || (item.key !== null && !isNonEmptyString(item.key))
            || (item.error !== undefined && !isNonEmptyString(item.error))
            || (item.code !== undefined
                && item.code !== null
                && !(typeof item.code === 'number' && Number.isFinite(item.code))
                && !isNonEmptyString(item.code))) {
            return false;
        }

        if (item.status === choiceActivationItemStates.humbleFailed) {
            return item.key === null && isNonEmptyString(item.error) && item.code === undefined;
        }
        if ([
            choiceActivationItemStates.pending,
            choiceActivationItemStates.activating,
        ].includes(item.status)) {
            return isNonEmptyString(item.key)
                && item.error === undefined
                && item.code === undefined;
        }
        if (item.status === choiceActivationItemStates.activated) {
            return item.key === null && item.error === undefined && item.code === undefined;
        }
        return isNonEmptyString(item.key) && isNonEmptyString(item.error);
    }

    function isValidChoiceActivationRunner(runner, batchState) {
        if (!runner
            || Object.keys(runner).sort().join(',') !== 'leaseExpiresAt,owner,phase') {
            return false;
        }
        if (batchState === choiceActivationBatchStates.collecting) {
            return runner.phase === choiceActivationBatchStates.collecting
                && isNonEmptyString(runner.owner)
                && Number.isFinite(runner.leaseExpiresAt)
                && runner.leaseExpiresAt > 0;
        }
        if (batchState === choiceActivationBatchStates.activating) {
            return runner.phase === choiceActivationBatchStates.activating
                && ((runner.owner === null && runner.leaseExpiresAt === null)
                    || (isNonEmptyString(runner.owner)
                        && Number.isFinite(runner.leaseExpiresAt)
                        && runner.leaseExpiresAt > 0));
        }
        return runner.phase === null
            && runner.owner === null
            && runner.leaseExpiresAt === null;
    }

    function isValidChoiceOwnershipRefresh(refresh, batchState) {
        if (!refresh
            || Object.keys(refresh).sort().join(',') !== 'error,leaseExpiresAt,owner,state'
            || !Object.values(choiceActivationOwnershipStates).includes(refresh.state)) {
            return false;
        }
        if (batchState !== choiceActivationBatchStates.complete) {
            return refresh.state === choiceActivationOwnershipStates.waiting
                && refresh.owner === null
                && refresh.leaseExpiresAt === null
                && refresh.error === null;
        }
        if (refresh.state === choiceActivationOwnershipStates.refreshing) {
            return isNonEmptyString(refresh.owner)
                && Number.isFinite(refresh.leaseExpiresAt)
                && refresh.leaseExpiresAt > 0
                && refresh.error === null;
        }
        if (refresh.state === choiceActivationOwnershipStates.failed) {
            return refresh.owner === null
                && refresh.leaseExpiresAt === null
                && isNonEmptyString(refresh.error);
        }
        return [
            choiceActivationOwnershipStates.pending,
            choiceActivationOwnershipStates.complete,
        ].includes(refresh.state)
            && refresh.owner === null
            && refresh.leaseExpiresAt === null
            && refresh.error === null;
    }

    function isChoiceActivationBatch(batch) {
        if (!hasOnlyKeys(
            batch,
            ['version', 'id', 'state', 'runner', 'ownershipRefresh', 'items']
        )) {
            return false;
        }
        if (batch.version !== choiceActivationBatchVersion
            || !isNonEmptyString(batch.id)
            || !Object.values(choiceActivationBatchStates).includes(batch.state)
            || !Array.isArray(batch.items)
            || !isValidChoiceActivationRunner(batch.runner, batch.state)
            || !isValidChoiceOwnershipRefresh(batch.ownershipRefresh, batch.state)
            || !batch.items.every(isValidChoiceActivationItem)
            || new Set(batch.items.map(item => item.id)).size !== batch.items.length) {
            return false;
        }

        const statuses = new Set(batch.items.map(item => item.status));
        if (batch.state === choiceActivationBatchStates.collecting) {
            return [...statuses].every(status => [
                choiceActivationItemStates.humbleFailed,
                choiceActivationItemStates.pending,
            ].includes(status));
        }
        if (batch.items.length === 0) return false;
        if (batch.state === choiceActivationBatchStates.complete) {
            return !statuses.has(choiceActivationItemStates.pending)
                && !statuses.has(choiceActivationItemStates.activating);
        }
        return true;
    }

    function getChoiceActivationBatch(value = GM_getValue(steamActivationBatchKey, null)) {
        return isChoiceActivationBatch(value) ? value : null;
    }

    function isChoiceActivationBatchActive(batch = getChoiceActivationBatch()) {
        if (!batch) return false;
        if ([
            choiceActivationBatchStates.collecting,
            choiceActivationBatchStates.activating,
        ].includes(batch.state)) {
            return true;
        }
        return batch.state === choiceActivationBatchStates.complete
            && [
                choiceActivationOwnershipStates.pending,
                choiceActivationOwnershipStates.refreshing,
            ].includes(batch.ownershipRefresh.state);
    }

    function saveChoiceActivationBatchIfCurrent(batch, expected = {}) {
        if (!isChoiceActivationBatch(batch)) return false;
        const current = getChoiceActivationBatch();
        if (!current || current.id !== batch.id) return false;
        if (Object.prototype.hasOwnProperty.call(expected, 'state')
            && current.state !== expected.state) {
            return false;
        }
        if (Object.prototype.hasOwnProperty.call(expected, 'runnerOwner')
            && current.runner.owner !== expected.runnerOwner) {
            return false;
        }
        if (Object.prototype.hasOwnProperty.call(expected, 'refreshOwner')
            && current.ownershipRefresh.owner !== expected.refreshOwner) {
            return false;
        }

        GM_setValue(steamActivationBatchKey, batch);
        const stored = getChoiceActivationBatch();
        return Boolean(stored
            && stored.id === batch.id
            && JSON.stringify(stored) === JSON.stringify(batch));
    }

    function requireLockScopedBatchPersistence(saveBatch) {
        if (typeof saveBatch !== 'function') {
            throw new Error('A lock-scoped persistence callback is required.');
        }
        return saveBatch;
    }

    async function collectChoiceActivationBatch(
        batch,
        selectedItems,
        revealKey,
        saveBatch
    ) {
        const persist = requireLockScopedBatchPersistence(saveBatch);
        for (const selectedItem of selectedItems) {
            batch.runner.leaseExpiresAt = Date.now() + choiceActivationRunnerLeaseMs;
            if (persist(batch) === false) return false;
            let key = null;
            let error;
            try {
                key = await revealKey(selectedItem);
            } catch (reason) {
                error = reason?.message;
            }
            batch.items.push({
                id: selectedItem.id,
                title: selectedItem.title,
                key: key || null,
                status: key
                    ? choiceActivationItemStates.pending
                    : choiceActivationItemStates.humbleFailed,
                ...(key ? {} : {error: error || t('choiceHumbleFailureReason')}),
            });
            batch.runner.leaseExpiresAt = Date.now() + choiceActivationRunnerLeaseMs;
            if (persist(batch) === false) return false;
        }
        return true;
    }

    function finishChoiceActivationCollection(
        batch,
        saveBatch,
        openTab = GM_openInTab
    ) {
        const persist = requireLockScopedBatchPersistence(saveBatch);
        const pendingCount = batch.items.filter(
            item => item.status === choiceActivationItemStates.pending
        ).length;
        if (batch.state !== choiceActivationBatchStates.collecting) return pendingCount;
        if (pendingCount === 0) {
            batch.state = choiceActivationBatchStates.complete;
            batch.runner = {phase: null, owner: null, leaseExpiresAt: null};
            batch.ownershipRefresh = {
                state: choiceActivationOwnershipStates.pending,
                owner: null,
                leaseExpiresAt: null,
                error: null,
            };
        } else {
            batch.state = choiceActivationBatchStates.activating;
            batch.runner = {
                phase: choiceActivationBatchStates.activating,
                owner: null,
                leaseExpiresAt: null,
            };
        }
        const saved = persist(batch);
        if (saved === false) return null;
        if (pendingCount > 0) {
            openTab(steamRegisterKeyUrl, {
                active: true,
                insert: true,
                setParent: true,
            });
        }
        return pendingCount;
    }

    async function runChoiceCollectionWork(
        selectedItems,
        {
            lockManager,
            revealKey = ({tile}) => revealChoiceSteamKey(tile),
            openTab = GM_openInTab,
            owner = choiceRuntimeOwnerId,
            onBatchStarted = () => {},
            onProgress = () => {},
        } = {}
    ) {
        const lockResult = await requestChoiceExclusiveLock(
            choiceCollectionLockName,
            async () => {
                const current = getChoiceActivationBatch();
                if (current?.state === choiceActivationBatchStates.collecting) {
                    GM_deleteValue(steamActivationBatchKey);
                } else if (isChoiceActivationBatchActive(current)) {
                    return {started: false, busy: true, batch: current};
                }

                const batch = createChoiceActivationBatch(owner);
                GM_setValue(steamActivationBatchKey, batch);
                const saveBatch = nextBatch => saveChoiceActivationBatchIfCurrent(
                    nextBatch,
                    {runnerOwner: owner}
                );
                onBatchStarted(batch);
                const collected = await collectChoiceActivationBatch(
                    batch,
                    selectedItems,
                    async item => {
                        onProgress(item);
                        return revealKey(item);
                    },
                    saveBatch
                );
                if (!collected) return {started: false, stopped: true, batch};
                const pendingCount = finishChoiceActivationCollection(
                    batch,
                    saveBatch,
                    openTab
                );
                if (pendingCount === null) {
                    return {started: false, stopped: true, batch};
                }
                return {started: true, batch, pendingCount};
            },
            {lockManager}
        );
        if (!lockResult.acquired) return lockResult;
        return lockResult.value;
    }

    async function recoverStaleChoiceCollection({lockManager} = {}) {
        const lockResult = await requestChoiceExclusiveLock(
            choiceCollectionLockName,
            async () => {
                const batch = getChoiceActivationBatch();
                if (batch?.state !== choiceActivationBatchStates.collecting) {
                    return {recovered: false};
                }
                GM_deleteValue(steamActivationBatchKey);
                return {recovered: true};
            },
            {lockManager, ifAvailable: true}
        );
        if (!lockResult.acquired) {
            return {
                recovered: false,
                lockUnavailable: !lockResult.unsupported,
                unsupported: lockResult.unsupported,
                message: lockResult.message,
            };
        }
        return lockResult.value;
    }

    function reconcileChoiceSelectionFromBatch(batch, selection = selectedChoiceGameIds) {
        let changed = false;
        for (const item of batch?.items || []) {
            if (item.status === choiceActivationItemStates.activated
                && selection.delete(item.id)) {
                changed = true;
            }
        }
        return changed;
    }

    function reconcileChoiceSelectionStorageFromBatch(batch, options = {}) {
        return updateChoiceSelection(
            selection => reconcileChoiceSelectionFromBatch(batch, selection),
            options
        );
    }

    function getChoiceActivationCounts(batch) {
        const count = status => batch.items.filter(item => item.status === status).length;
        return {
            total: batch.items.length,
            activated: count(choiceActivationItemStates.activated),
            humbleFailed: count(choiceActivationItemStates.humbleFailed),
            steamFailed: count(choiceActivationItemStates.steamFailed),
            pending: batch.items.filter(item => [
                choiceActivationItemStates.pending,
                choiceActivationItemStates.activating,
            ].includes(item.status)).length,
        };
    }

    function copySteamFailedKey(item, feedback, setClipboard = GM_setClipboard) {
        setClipboard(item.key, 'text');
        feedback.textContent = t('choiceCopiedFailedKey', {title: item.title});
    }

    function appendChoiceFailureGroup(results, titleText, items, includeKeys = false) {
        if (items.length === 0) return;
        const group = document.createElement('section');
        group.className = 'hb-helper-choice-result-group';

        const title = document.createElement('h4');
        title.textContent = titleText;
        group.appendChild(title);

        let feedback;
        if (includeKeys) {
            feedback = document.createElement('div');
            feedback.className = 'hb-helper-choice-copy-feedback';
            feedback.setAttribute('role', 'status');
            feedback.setAttribute('aria-live', 'polite');
        }

        items.forEach(item => {
            const row = document.createElement('div');
            row.className = 'hb-helper-choice-result-row';
            const detail = document.createElement('div');
            detail.textContent = t('choiceFailureRow', {
                title: item.title,
                reason: item.error || t('steamActivationUnknownCode', {
                    code: item.code ?? 'unknown',
                }),
            });
            row.appendChild(detail);

            if (includeKeys && item.key) {
                const keyButton = document.createElement('button');
                keyButton.type = 'button';
                keyButton.className = 'hb-helper-choice-failed-key';
                keyButton.textContent = item.key;
                keyButton.setAttribute('aria-label', t('choiceCopyFailedKey', {
                    title: item.title,
                }));
                keyButton.addEventListener('click', () =>
                    copySteamFailedKey(item, feedback)
                );
                row.appendChild(keyButton);
            }
            group.appendChild(row);
        });

        if (feedback) group.appendChild(feedback);
        results.appendChild(group);
    }

    function getChoiceActivationResultsSignature(batch) {
        if (!batch) return JSON.stringify({language: currentLanguage, batch: null});
        return JSON.stringify({
            language: currentLanguage,
            counts: getChoiceActivationCounts(batch),
            refreshError: batch.ownershipRefresh.state === choiceActivationOwnershipStates.failed
                ? batch.ownershipRefresh.error || t('choiceOwnershipRefreshWarning')
                : null,
            failures: batch.items
                .filter(item => [
                    choiceActivationItemStates.humbleFailed,
                    choiceActivationItemStates.steamFailed,
                ].includes(item.status))
                .map(item => ({
                    status: item.status,
                    title: item.title,
                    key: item.status === choiceActivationItemStates.steamFailed ? item.key : null,
                    error: item.error || null,
                    code: item.code ?? null,
                })),
        });
    }

    function renderChoiceActivationResults(batch = getChoiceActivationBatch()) {
        const results = document.getElementById('hb-helper-choice-activation-results');
        if (!results) return;
        const signature = getChoiceActivationResultsSignature(batch);
        if (results.dataset.hbHelperChoiceResultsSignature === signature) return;
        results.replaceChildren();
        results.dataset.hbHelperChoiceResultsSignature = signature;
        if (!batch) return;

        const counts = getChoiceActivationCounts(batch);
        const summary = document.createElement('div');
        summary.className = 'hb-helper-choice-result-summary';
        summary.textContent = t('choiceActivationSummary', counts);
        results.appendChild(summary);

        if (batch.ownershipRefresh.state === choiceActivationOwnershipStates.failed) {
            const warning = document.createElement('div');
            warning.className = 'hb-helper-choice-result-warning';
            warning.textContent = batch.ownershipRefresh.error
                || t('choiceOwnershipRefreshWarning');
            results.appendChild(warning);
        }

        appendChoiceFailureGroup(
            results,
            t('choiceHumbleFailureGroup'),
            batch.items.filter(item => item.status === choiceActivationItemStates.humbleFailed)
        );
        appendChoiceFailureGroup(
            results,
            t('choiceSteamFailureGroup'),
            batch.items.filter(item => item.status === choiceActivationItemStates.steamFailed),
            true
        );
    }

    async function startChoiceActivation() {
        if (choiceActivationInProgress) {
            setChoiceStatus(t('choiceActivationBusy'));
            return;
        }
        const tiles = getSelectedChoiceTiles();
        if (tiles.length === 0) {
            setChoiceStatus(t('choiceNoSelection'));
            return;
        }

        const selectedItems = tiles.map((tile, index) => ({
            id: getChoiceTileId(tile),
            title: getChoiceTileTitle(tile),
            tile,
            index,
        }));
        choiceActivationInProgress = true;
        let completionStatus = '';
        setChoiceStatus(t('choiceRevealStarting', {count: tiles.length}));
        try {
            const result = await runChoiceCollectionWork(selectedItems, {
                onBatchStarted: batch => {
                    setChoiceSelectionMode(false);
                    renderChoiceActivationResults(batch);
                },
                onProgress: item => setChoiceStatus(t('choiceRevealProgress', {
                    title: item.title,
                    current: item.index + 1,
                    total: selectedItems.length,
                })),
                revealKey: async item => {
                    const key = await revealChoiceSteamKey(item.tile);
                    if (!key) setChoiceStatus(t('choiceRevealFailed', {title: item.title}));
                    return key;
                },
            });
            if (result.unsupported) {
                completionStatus = result.message;
            } else if (!result.started) {
                completionStatus = t('choiceActivationBusy');
            } else if (result.pendingCount > 0) {
                completionStatus = t('choiceQueueReady', {count: result.pendingCount});
            } else {
                await reconcileChoiceActivationBatch(result.batch);
            }
        } finally {
            choiceActivationInProgress = false;
            renderChoiceSelectionState();
            renderChoiceActivationResults();
            if (completionStatus) setChoiceStatus(completionStatus);
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
            selectUnownedButton.addEventListener('click', () => {
                selectUnownedChoiceTiles().catch(error => {
                    console.warn('[HB-Helper] Select unowned Choice games failed:', error);
                });
            });

            const selectButton = document.createElement('button');
            selectButton.type = 'button';
            selectButton.dataset.hbHelperChoiceAction = 'select';
            selectButton.addEventListener('click', () => setChoiceSelectionMode(!choiceSelectionMode));

            const clearButton = document.createElement('button');
            clearButton.type = 'button';
            clearButton.dataset.hbHelperChoiceAction = 'clear';
            clearButton.addEventListener('click', () => {
                clearChoiceSelection().catch(error => {
                    console.warn('[HB-Helper] Clear Choice selection failed:', error);
                });
            });

            const status = document.createElement('div');
            status.className = 'hb-helper-choice-status';

            const results = document.createElement('div');
            results.id = 'hb-helper-choice-activation-results';

            choiceControls.append(
                activateButton,
                selectUnownedButton,
                selectButton,
                clearButton,
                status,
                results
            );
        }

        setElementTextContent(
            choiceControls.querySelector('[data-hb-helper-choice-action="activate"]'),
            t('choiceActivate')
        );
        setElementTextContent(
            choiceControls.querySelector('[data-hb-helper-choice-action="select-unowned"]'),
            t('choiceSelectUnowned')
        );
        setElementTextContent(
            choiceControls.querySelector('[data-hb-helper-choice-action="clear"]'),
            t('choiceClearSelection')
        );

        if (summary.nextElementSibling !== choiceControls) {
            summary.insertAdjacentElement('afterend', choiceControls);
        } else if (choiceControls.parentNode !== controls) {
            controls.appendChild(choiceControls);
        }
        renderChoiceSelectionState();
        renderChoiceActivationResults();
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

    async function reconcileVisibleGameClasses(
        nextOwnedApps = ownedApps,
        nextWishlistApps = wishlistApps
    ) {
        const elements = Array.from(
            document.querySelectorAll('.tier-item-view, .choice-content.js-open-choice-modal')
        );
        await Promise.all(elements.flatMap(element => [
            markOne(element, nextOwnedApps || new Set()),
            markWishlistOne(element, nextWishlistApps || new Set()),
        ]));
    }

    function markVisibleGames() {
        reconcileVisibleGameClasses().catch(error => {
            console.warn('[HB-Helper] Reconcile Steam ownership classes failed:', error);
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

    function isInsideHelperUi(node) {
        const element = node?.nodeType === 3 ? node.parentElement : node;
        return Boolean(element?.closest?.([
            '#hb-helper-controls',
            '#hb-helper-choice-activation-controls',
            '#hb-helper-choice-activation-results',
            '#hb-helper-steam-activation-status',
        ].join(', ')));
    }

    function observePageChanges() {
        const observer = new MutationObserver(mutations => {
            if (mutations.some(mutation => !isInsideHelperUi(mutation.target))) {
                schedulePageRefresh();
            }
        });
        observer.observe(document.body, {childList: true, subtree: true});
        document.addEventListener('click', handleChoiceSelectionClick, true);
        document.addEventListener('click', event => {
            if (!isInsideHelperUi(event.target)) schedulePageRefresh();
        }, true);
        document.addEventListener('change', event => {
            if (!isInsideHelperUi(event.target)) schedulePageRefresh();
        }, true);
    }

    async function runChoiceOwnershipRefreshWork(
        batchId,
        {
            lockManager,
            loadAccount = () => fetchSteamAccountData({
                force: true,
                allowCachedFallback: false,
                lockManager,
                requireLock: true,
            }),
            reconcileClasses = async () => {},
            owner = choiceRuntimeOwnerId,
            now = () => Date.now(),
            leaseMs = choiceOwnershipRefreshLeaseMs,
            heartbeatMs = Math.max(1000, Math.floor(leaseMs / 3)),
        } = {}
    ) {
        const manager = getChoiceLockManager(lockManager);
        if (!manager || typeof manager.request !== 'function') {
            const current = getChoiceActivationBatch();
            const message = t('choiceOwnershipRefreshUnsupportedWarning');
            if (current
                && current.id === batchId
                && current.state === choiceActivationBatchStates.complete
                && [
                    choiceActivationOwnershipStates.pending,
                    choiceActivationOwnershipStates.refreshing,
                ].includes(current.ownershipRefresh.state)) {
                const failedBatch = JSON.parse(JSON.stringify(current));
                failedBatch.ownershipRefresh = {
                    state: choiceActivationOwnershipStates.failed,
                    owner: null,
                    leaseExpiresAt: null,
                    error: message,
                };
                saveChoiceActivationBatchIfCurrent(failedBatch, {
                    refreshOwner: current.ownershipRefresh.owner,
                });
            }
            return {refreshed: false, unsupported: true, message};
        }

        const lockResult = await requestChoiceExclusiveLock(
            choiceOwnershipRefreshLockName,
            async () => {
                const current = getChoiceActivationBatch();
                if (!current
                    || current.id !== batchId
                    || current.state !== choiceActivationBatchStates.complete
                    || ![
                        choiceActivationOwnershipStates.pending,
                        choiceActivationOwnershipStates.refreshing,
                    ].includes(current.ownershipRefresh.state)) {
                    return {refreshed: false};
                }

                const claimed = JSON.parse(JSON.stringify(current));
                claimed.ownershipRefresh = {
                    state: choiceActivationOwnershipStates.refreshing,
                    owner,
                    leaseExpiresAt: now() + leaseMs,
                    error: null,
                };
                GM_setValue(steamActivationBatchKey, claimed);
                const ownsRefresh = () => {
                    const stored = getChoiceActivationBatch();
                    return Boolean(stored
                        && stored.id === batchId
                        && stored.state === choiceActivationBatchStates.complete
                        && stored.ownershipRefresh.state
                            === choiceActivationOwnershipStates.refreshing
                        && stored.ownershipRefresh.owner === owner);
                };
                if (!ownsRefresh()) return {refreshed: false, stopped: true};

                const heartbeat = setInterval(() => {
                    const stored = getChoiceActivationBatch();
                    if (!stored
                        || stored.id !== batchId
                        || stored.ownershipRefresh.owner !== owner) {
                        return;
                    }
                    const renewed = JSON.parse(JSON.stringify(stored));
                    renewed.ownershipRefresh.leaseExpiresAt = now() + leaseMs;
                    saveChoiceActivationBatchIfCurrent(renewed, {refreshOwner: owner});
                }, heartbeatMs);

                try {
                    const account = await loadAccount();
                    if (!Array.isArray(account?.ownedApps)
                        || !Array.isArray(account?.wishlistApps)) {
                        throw new Error(t('steamInvalidAccountData'));
                    }
                    if (!ownsRefresh()) return {refreshed: false, stopped: true};

                    const refreshedOwnedApps = new Set(account.ownedApps);
                    const refreshedWishlistApps = new Set(account.wishlistApps);
                    await reconcileClasses(
                        refreshedOwnedApps,
                        refreshedWishlistApps,
                        account
                    );
                    if (!ownsRefresh()) return {refreshed: false, stopped: true};

                    const completedBatch = JSON.parse(JSON.stringify(getChoiceActivationBatch()));
                    completedBatch.ownershipRefresh = {
                        state: choiceActivationOwnershipStates.complete,
                        owner: null,
                        leaseExpiresAt: null,
                        error: null,
                    };
                    if (!saveChoiceActivationBatchIfCurrent(
                        completedBatch,
                        {refreshOwner: owner}
                    )) {
                        return {refreshed: false, stopped: true};
                    }
                    return {
                        refreshed: true,
                        stopped: false,
                        ownedApps: refreshedOwnedApps,
                        wishlistApps: refreshedWishlistApps,
                    };
                } catch (error) {
                    console.warn('[HB-Helper] Refresh Steam account after activation failed:', error);
                    if (!ownsRefresh()) {
                        return {refreshed: false, stopped: true, error};
                    }
                    const failedBatch = JSON.parse(JSON.stringify(getChoiceActivationBatch()));
                    failedBatch.ownershipRefresh = {
                        state: choiceActivationOwnershipStates.failed,
                        owner: null,
                        leaseExpiresAt: null,
                        error: t('choiceOwnershipRefreshWarning'),
                    };
                    if (!saveChoiceActivationBatchIfCurrent(
                        failedBatch,
                        {refreshOwner: owner}
                    )) {
                        return {refreshed: false, stopped: true, error};
                    }
                    return {refreshed: false, error};
                } finally {
                    clearInterval(heartbeat);
                }
            },
            {lockManager: manager, ifAvailable: true}
        );
        if (!lockResult.acquired) {
            return {
                refreshed: false,
                lockUnavailable: !lockResult.unsupported,
                unsupported: lockResult.unsupported,
                message: lockResult.message,
            };
        }
        return lockResult.value;
    }

    async function refreshCompletedChoiceActivationBatch(batch) {
        const result = await runChoiceOwnershipRefreshWork(
            batch.id,
            {
                reconcileClasses: async (refreshedOwnedApps, refreshedWishlistApps, account) =>
                    applySteamAccountData(account),
            }
        );
        if (result.unsupported) setChoiceStatus(result.message);
        if (result.error) {
            console.warn('[HB-Helper] Steam ownership refresh warning:', result.error);
        }
        const currentBatch = getChoiceActivationBatch();
        if (currentBatch?.id === batch.id) renderChoiceActivationResults(currentBatch);
        await applyCachedSteamAccountData();
        return result;
    }

    async function reconcileChoiceActivationBatch(
        batch = getChoiceActivationBatch(),
        {
            refreshBatch = refreshCompletedChoiceActivationBatch,
            ownershipRetryMs = choiceLockRetryMs,
            applyCachedAccount = applyCachedSteamAccountData,
        } = {}
    ) {
        const currentBatch = getChoiceActivationBatch();
        if (batch && currentBatch?.id !== batch.id) return;
        batch = currentBatch;
        if (!batch) {
            clearTimeout(choiceCollectionRecoveryTimer);
            clearTimeout(choiceOwnershipRefreshTimer);
            renderChoiceActivationResults(null);
            return;
        }

        await reconcileChoiceSelectionStorageFromBatch(batch);
        renderChoiceSelectionState();
        renderChoiceActivationResults(batch);

        clearTimeout(choiceCollectionRecoveryTimer);
        if (batch.state === choiceActivationBatchStates.collecting) {
            choiceCollectionRecoveryTimer = setTimeout(async () => {
                const recovery = await recoverStaleChoiceCollection();
                if (recovery.recovered) {
                    await reconcileChoiceActivationBatch();
                } else if (recovery.lockUnavailable) {
                    choiceCollectionRecoveryTimer = setTimeout(() => {
                        reconcileChoiceActivationBatch().catch(error => {
                            console.warn('[HB-Helper] Recover collection lock failed:', error);
                        });
                    }, 1000);
                }
            }, Math.max(0, batch.runner.leaseExpiresAt - Date.now()) + 25);
            return;
        }
        if (batch.state !== choiceActivationBatchStates.complete) return;
        clearTimeout(choiceOwnershipRefreshTimer);
        const refresh = batch.ownershipRefresh;
        if ([
            choiceActivationOwnershipStates.complete,
            choiceActivationOwnershipStates.failed,
        ].includes(refresh.state)) {
            await applyCachedAccount();
            return;
        }
        if (refresh.state === choiceActivationOwnershipStates.pending
            || refresh.state === choiceActivationOwnershipStates.refreshing) {
            const result = await refreshBatch(batch);
            if (result.lockUnavailable) {
                const latest = getChoiceActivationBatch();
                if (latest?.id === batch.id
                    && [
                        choiceActivationOwnershipStates.pending,
                        choiceActivationOwnershipStates.refreshing,
                    ].includes(latest.ownershipRefresh.state)) {
                    const retryDelay = latest.ownershipRefresh.state
                        === choiceActivationOwnershipStates.refreshing
                        ? Math.max(
                            ownershipRetryMs,
                            latest.ownershipRefresh.leaseExpiresAt - Date.now() + 25
                        )
                        : ownershipRetryMs;
                    choiceOwnershipRefreshTimer = setTimeout(
                        () => reconcileChoiceActivationBatch(undefined, {
                            refreshBatch,
                            ownershipRetryMs,
                        }).catch(error => {
                            console.warn('[HB-Helper] Recover ownership refresh lock failed:', error);
                        }),
                        retryDelay
                    );
                }
            }
        }
    }

    function observeChoiceActivationBatch() {
        if (choiceActivationBatchListener !== undefined) return;
        choiceActivationBatchListener = GM_addValueChangeListener(
            steamActivationBatchKey,
            (name, oldValue, newValue) => {
                const batch = getChoiceActivationBatch(newValue);
                reconcileChoiceActivationBatch(batch).catch(error => {
                    console.warn('[HB-Helper] Reconcile activation batch failed:', error);
                });
            }
        );
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
        setElementTextContent(
            panel.querySelector('.hb-helper-steam-activation-body'),
            message
        );
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
                timeout: gmRequestTimeoutMs,
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
                ontimeout: () => reject(new Error(t('requestTimedOut'))),
            });
        });
    }

    function getSteamActivationFailure(response) {
        const data = response?.response || response || {};
        const receipt = data.purchase_receipt_info || {};
        const rawCode = data.purchase_result_details ?? data.purchase_result_detail ?? 'unknown';
        const numericCode = Number(rawCode);
        const code = Number.isFinite(numericCode) ? numericCode : rawCode;
        const knownReasonKeys = {
            9: 'steamActivationAlreadyOwned',
            13: 'steamActivationRegionRestricted',
            14: 'steamActivationInvalidKey',
            15: 'steamActivationAlreadyUsed',
            24: 'steamActivationBaseGameRequired',
            53: 'steamActivationRateLimited',
        };
        const returnedReason = receipt.error_headline
            || receipt.error_string
            || data.error_string
            || data.error_message;
        return {
            code,
            error: knownReasonKeys[code]
                ? t(knownReasonKeys[code])
                : returnedReason || t('steamActivationUnknownCode', {code}),
        };
    }

    function isSteamActivationSuccess(response) {
        const data = response?.response || response || {};
        const receipt = data.purchase_receipt_info;
        const lineItems = receipt?.line_items || receipt?.lineItems;
        const detail = Number(data.purchase_result_details ?? data.purchase_result_detail);
        return detail === 0
            && Boolean(receipt)
            && !receipt.error_string
            && !receipt.error_headline
            && Array.isArray(lineItems)
            && lineItems.length > 0;
    }

    async function processSteamActivationBatch(
        batch,
        token,
        activateKey = postSteamActivationKey,
        saveBatch,
        showProgress = () => {},
        {
            owner = batch.runner.owner,
            now = () => Date.now(),
            leaseMs = choiceActivationRunnerLeaseMs,
        } = {}
    ) {
        const persist = requireLockScopedBatchPersistence(saveBatch);
        const interruptedItems = batch.items.filter(
            item => item.status === choiceActivationItemStates.activating
        );
        if (interruptedItems.length > 0) {
            for (const item of interruptedItems) {
                item.status = choiceActivationItemStates.steamFailed;
                item.error = t('steamActivationInterruptedUncertain');
                item.code = null;
            }
            if (persist(batch) === false) {
                return {batch, paused: false, stopped: true};
            }
        }
        const pendingItems = batch.items.filter(
            item => item.status === choiceActivationItemStates.pending
        );
        if (!token && pendingItems.length > 0) return {batch, paused: true};
        if (batch.state !== choiceActivationBatchStates.activating) {
            return {batch, paused: false, stopped: true};
        }

        for (let index = 0; index < pendingItems.length; index++) {
            const item = pendingItems[index];
            showProgress(item, index, pendingItems.length);
            item.status = choiceActivationItemStates.activating;
            if (isNonEmptyString(owner)) {
                batch.runner.leaseExpiresAt = now() + leaseMs;
            }
            if (persist(batch) === false) {
                return {batch, paused: false, stopped: true};
            }
            try {
                const response = await activateKey(token, item.key);
                if (isSteamActivationSuccess(response)) {
                    item.status = choiceActivationItemStates.activated;
                    item.key = null;
                    delete item.error;
                    delete item.code;
                } else {
                    const failure = getSteamActivationFailure(response);
                    item.status = choiceActivationItemStates.steamFailed;
                    item.error = failure.error;
                    item.code = failure.code;
                }
            } catch (error) {
                item.status = choiceActivationItemStates.steamFailed;
                item.error = t('steamActivationRequestFailed', {
                    message: error?.message || String(error),
                });
                item.code = null;
            }
            if (isNonEmptyString(owner)) {
                batch.runner.leaseExpiresAt = now() + leaseMs;
            }
            if (persist(batch) === false) {
                return {batch, paused: false, stopped: true};
            }
        }

        batch.state = choiceActivationBatchStates.complete;
        batch.runner = {phase: null, owner: null, leaseExpiresAt: null};
        batch.ownershipRefresh = {
            state: choiceActivationOwnershipStates.pending,
            owner: null,
            leaseExpiresAt: null,
            error: null,
        };
        if (persist(batch) === false) {
            return {batch, paused: false, stopped: true};
        }
        return {batch, paused: false, stopped: false};
    }

    async function runSteamActivationWork({
        lockManager,
        token,
        activateKey = postSteamActivationKey,
        showProgress = () => {},
        owner = choiceRuntimeOwnerId,
        now = () => Date.now(),
        leaseMs = choiceActivationRunnerLeaseMs,
    } = {}) {
        const lockResult = await requestChoiceExclusiveLock(
            steamActivationLockName,
            async () => {
                const current = getChoiceActivationBatch();
                if (!current || current.state !== choiceActivationBatchStates.activating) {
                    return {processed: false, batch: current};
                }

                const batch = JSON.parse(JSON.stringify(current));
                batch.runner = {
                    phase: choiceActivationBatchStates.activating,
                    owner,
                    leaseExpiresAt: now() + leaseMs,
                };
                GM_setValue(steamActivationBatchKey, batch);
                const claimed = getChoiceActivationBatch();
                if (claimed?.id !== batch.id || claimed.runner.owner !== owner) {
                    return {processed: false, stopped: true, batch: claimed};
                }

                const saveBatch = nextBatch => {
                    const stored = getChoiceActivationBatch();
                    if (!stored
                        || stored.id !== nextBatch.id
                        || stored.runner.owner !== owner) {
                        return false;
                    }
                    GM_setValue(steamActivationBatchKey, nextBatch);
                    const saved = getChoiceActivationBatch();
                    return Boolean(saved
                        && saved.id === nextBatch.id
                        && JSON.stringify(saved) === JSON.stringify(nextBatch));
                };
                const result = await processSteamActivationBatch(
                    batch,
                    token,
                    activateKey,
                    saveBatch,
                    showProgress,
                    {owner, now, leaseMs}
                );
                return {...result, processed: !result.paused && !result.stopped};
            },
            {lockManager}
        );
        if (!lockResult.acquired) return lockResult;
        return lockResult.value;
    }

    async function runSteamActivationPage() {
        if (steamActivationInProgress) return;
        const batch = getChoiceActivationBatch();
        if (!batch || batch.state !== choiceActivationBatchStates.activating) {
            document.getElementById('hb-helper-steam-activation-status')?.remove();
            return;
        }

        steamActivationInProgress = true;
        if (!getChoiceLockManager()) {
            renderSteamActivationStatus(t('choiceWebLocksUnavailable'));
            steamActivationInProgress = false;
            return;
        }
        const token = await waitForSteamWebApiToken();
        const result = await runSteamActivationWork({
            token,
            showProgress: (item, index, total) => renderSteamActivationStatus(t('steamActivationProgress', {
                title: item.title,
                current: index + 1,
                total,
            })),
        });
        if (result.unsupported) {
            renderSteamActivationStatus(result.message);
            steamActivationInProgress = false;
            return;
        }
        if (result.paused) {
            renderSteamActivationStatus(t('steamActivationLoginRequired'));
            steamActivationInProgress = false;
            return;
        }
        if (!result.processed) {
            steamActivationInProgress = false;
            return;
        }

        const activatedCount = result.batch.items.filter(
            item => item.status === choiceActivationItemStates.activated
        ).length;
        renderSteamActivationStatus(t('steamActivationComplete', {count: activatedCount}));
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
        observeSteamAccountCache();
        if (isChoicePage()) {
            observeChoiceActivationBatch();
            observeChoiceSelection();
        }
        observePageChanges();
        refreshHelperPage(true);

        if (isChoicePage()) {
            const recovery = await recoverStaleChoiceCollection();
            if (recovery.recovered) {
                renderChoiceSelectionState();
                renderChoiceActivationResults(null);
            } else if (recovery.unsupported) {
                setChoiceStatus(recovery.message);
            }
        }

        try {
            await loadSteamAccountSets();
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
        if (isChoicePage()) await reconcileChoiceActivationBatch();
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
                timeout: options.timeout ?? gmRequestTimeoutMs,
                onload: ({status, response, responseText}) => {
                    if (status !== 200) {
                        reject(new Error(t('requestFailedHttp', {status})));
                        return;
                    }
                    resolve(responseType === 'json' ? response : responseText || response);
                },
                onerror: () => reject(new Error(t('networkRequestFailed'))),
                ontimeout: () => reject(new Error(t('requestTimedOut'))),
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

    async function markGame(viewEl, appSet, className, findApp = findSteamApp) {
        const titleEl = viewEl.querySelector('.item-title, .content-choice-title');
        if (!titleEl) {
            viewEl.classList.toggle(className, false);
            return;
        }
        const title = titleEl.textContent.trim();
        if (!shouldMatchSteamTitle(title)) {
            viewEl.classList.toggle(className, false);
            return;
        }
        const app = await findApp(title);
        viewEl.classList.toggle(className, Boolean(app && appSet.has(app.appid)));
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
