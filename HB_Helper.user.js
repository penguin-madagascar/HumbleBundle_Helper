// ==UserScript==
// @name         HumbleBundle Helper
// @name:zh-CN   Humble Bundle 助手
// @namespace    https://github.com/penguin-madagascar/HumbleBundle_Helper
// @version      0.0.13
// @description  Highlight Steam games and summarize regional prices on Humble Bundle
// @description:zh-CN 在 Humble Bundle 上标记 Steam 游戏并汇总区域价格
// @icon         https://raw.githubusercontent.com/penguin-madagascar/HumbleBundle_Helper/main/assets/icon-32.png
// @icon64       https://raw.githubusercontent.com/penguin-madagascar/HumbleBundle_Helper/main/assets/icon-64.png
// @author       PenguinOfMadagascar
// @license      MIT
// @match        https://www.humblebundle.com/*
// @grant        GM_xmlhttpRequest
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
    }`;
    document.head.appendChild(style);

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
    let bundleItemsByTitle;
    let steamCountryCodePromise;
    let pageRefreshTimer;
    let priceTotalsRunId = 0;
    let lastPriceTitlesKey = '';
    let lastPriceResult;
    let priceScope = 'all';
    let steamLoginRequired = false;
    let ownedApps;
    let wishlistApps;
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
        steamAppMatchCache.set(cacheKey, request);
        return request;
    }

    // Run: Fetch the set of owned Steam app IDs from the Steam API
    function fetchOwnedSet() {
        const url = 'https://store.steampowered.com/dynamicstore/userdata/?_=' + Date.now();
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url,
                headers: {'Cache-Control': 'no-cache'},
                responseType: 'json',
                onload: ({status, response}) => {
                    if (status === 200 && response && response.rgOwnedApps)
                        resolve(new Set(response.rgOwnedApps));
                    else
                        reject('Failed to fetch owned apps');
                },
                onerror: () => reject('Network error fetching owned apps'),
            });
        });
    }

    // Run: fetchWishlistSet: Fetch the set of Steam app IDs in the user's wishlist from the Steam API
    function fetchWishlistSet() {
        const url = 'https://store.steampowered.com/dynamicstore/userdata/?_=' + Date.now();
        return new Promise((resolve) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url,
                headers: {'Cache-Control': 'no-cache'},
                responseType: 'json',
                onload: ({status, response}) => {
                    if (status === 200 && response && response.rgWishlist)
                        resolve(new Set(response.rgWishlist));
                    else
                        resolve(new Set());
                },
                onerror: () => resolve(new Set()),
            });
        });
    }

    function getBundleTitle() {
        const meta = document.querySelector('meta[property="og:title"]');
        if (meta && meta.content) return meta.content.trim();
        const logo = document.querySelector('.bundle-logo');
        if (logo && logo.getAttribute('alt')) return logo.getAttribute('alt').trim();
        return document.title.trim();
    }

    function isGamesBundlePage() {
        return location.pathname.startsWith('/games/');
    }

    function isChoicePage() {
        return location.pathname.startsWith('/membership/home');
    }

    function isPriceTotalsPage() {
        return isGamesBundlePage() || isChoicePage();
    }

    function normalizedText(element) {
        return element.textContent.replace(/\s+/g, ' ').trim();
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
            const monthHeading = findTextAnchor(choiceMonthPattern);
            if (monthHeading) return {anchor: monthHeading, position: 'beforebegin'};
            const yourGamesHeading = findTextAnchor(/^YOUR GAMES$/i);
            if (yourGamesHeading) return {anchor: yourGamesHeading, position: 'afterend'};
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
            link.textContent = 'Search SteamGifts discussions (for potential region lock)';
            steamGifts.appendChild(link);
        }
        steamGifts.querySelector('#hb-helper-steamgifts-link').href = buildSteamGiftsSearchUrl();

        let summary = document.getElementById('hb-helper-price-summary');
        if (!summary) {
            summary = document.createElement('div');
            summary.id = 'hb-helper-price-summary';
            summary.textContent = 'Loading Steam price totals...';
        }

        if (steamGifts.parentNode !== controls) controls.appendChild(steamGifts);
        if (summary.parentNode !== controls) controls.appendChild(summary);
        if (steamGifts.nextElementSibling !== summary) {
            controls.insertBefore(summary, steamGifts.nextSibling);
        }
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
            loginLink.textContent = 'Login to Steam to check owned games';
            loginLink.target = '_blank';
            loginLink.rel = 'noopener noreferrer';
            loginLink.addEventListener('click', () => {
                if (loginDiv.querySelector('.hb-helper-login-message')) return;
                const message = document.createElement('div');
                message.className = 'hb-helper-login-message';
                message.textContent = 'Please refresh this page after login';
                loginDiv.appendChild(message);
            });
            loginDiv.appendChild(loginLink);
        }
        if (loginDiv.parentNode !== controls || controls.firstElementChild !== loginDiv) {
            controls.insertBefore(loginDiv, controls.firstChild);
        }
    }

    function markVisibleGames() {
        document.querySelectorAll('.tier-item-view, .choice-content.js-open-choice-modal')
            .forEach(element => {
                if (ownedApps) markOne(element, ownedApps);
                if (wishlistApps) markWishlistOne(element, wishlistApps);
            });
    }

    function refreshHelperPage(forcePriceReload = false) {
        if (!ensureHelperControls()) return;
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
        document.addEventListener('click', () => schedulePageRefresh(), true);
        document.addEventListener('change', () => schedulePageRefresh(), true);
    }

    (async function run() {
        if (!isPriceTotalsPage()) return;
        observePageChanges();
        refreshHelperPage(true);

        try {
            [ownedApps, wishlistApps] = await Promise.all([fetchOwnedSet(), fetchWishlistSet()]);
        } catch (error) {
            console.warn('[HB-Helper] Fetch owned games failed:', error);
            steamLoginRequired = true;
            refreshHelperPage();
            return;
        }

        steamLoginRequired = ownedApps.size === 0;
        if (steamLoginRequired) console.warn('[HB-Helper] No owned games found; maybe logged out');
        renderPriceTotals();
        refreshHelperPage();
    })();

    function gmRequest(url, responseType = 'json') {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url,
                responseType,
                onload: ({status, response, responseText}) => {
                    if (status !== 200) {
                        reject(new Error(`Request failed with HTTP ${status}`));
                        return;
                    }
                    resolve(responseType === 'json' ? response : responseText || response);
                },
                onerror: () => reject(new Error('Network request failed')),
            });
        });
    }

    async function fetchSteamCountryCode() {
        if (!steamCountryCodePromise) {
            steamCountryCodePromise = (async () => {
                const html = await gmRequest(
                    `https://store.steampowered.com/?l=english&_=${Date.now()}`,
                    'text'
                );
                const steamPage = new DOMParser().parseFromString(html, 'text/html');
                const userInfoText = steamPage.querySelector('#application_config')
                    ?.getAttribute('data-userinfo');
                const userInfo = JSON.parse(userInfoText);
                if (!userInfo.logged_in) throw new Error('Login to Steam to load regional prices');
                return userInfo.country_code.toUpperCase();
            })();
        }
        return steamCountryCodePromise;
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
                throw new Error(`Xiaoheihe has no ${steamCountryCode} price for Steam app ${appId}`);
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
                throw new Error(`Invalid Xiaoheihe price for Steam app ${appId}`);
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
            if (!Number.isFinite(rate)) throw new Error('Invalid Frankfurter exchange rate');
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
        return new Intl.NumberFormat('zh-CN', {
            style: 'currency',
            currency: currencyCode,
        }).format(value);
    }

    function appendMatchDetails(summary, unmatchedGames, unpricedGames) {
        const groups = [
            ['Steam item not found', unmatchedGames],
            ['Regional price unavailable', unpricedGames],
        ].filter(([, games]) => games.length > 0);
        if (groups.length === 0) return;

        const details = document.createElement('details');
        details.className = 'hb-helper-match-details';
        const detailsSummary = document.createElement('summary');
        const missingCount = groups.reduce((total, [, games]) => total + games.length, 0);
        detailsSummary.textContent = `Show ${missingCount} unpriced item${missingCount === 1 ? '' : 's'}`;
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
            if (!currencyCode || pricedGames.length === 0) return 'Unavailable';
            const steamPrice = formatPrice(value, currencyCode);
            if (!humbleCurrencyCode || !exchangeRate) return steamPrice;
            return `${steamPrice} (HB: ${formatPrice(value * exchangeRate, humbleCurrencyCode)})`;
        };
        const scopeLabel = priceScope === 'all' ? 'Show unowned' : 'Show all';
        const scopeDescription = canFilterOwned
            ? 'Toggle between all games and games not owned on Steam'
            : 'Login to Steam to filter out owned games';
        const priceRegion = currencyCode ? `${region}, ${currencyCode}` : region;
        const scope = priceScope === 'all' ? 'all items' : 'unowned items';

        summary.innerHTML = `
            <div class="hb-helper-price-header">
                <div class="hb-helper-price-title">
                    Steam price totals (${priceRegion})
                </div>
                <button id="hb-helper-price-scope" type="button"
                    title="${scopeDescription}" ${canFilterOwned ? '' : 'disabled'}>
                    ${scopeLabel}
                </button>
            </div>
            <div>Current: <span class="hb-helper-price-value">${formatTotal(totals.current)}</span></div>
            <div>Original: <span class="hb-helper-price-value">${formatTotal(totals.original)}</span></div>
            <div>Historical low: <span class="hb-helper-price-value">${formatTotal(totals.lowest)}</span></div>
            <div>${matchedGames.length}/${selectedGames.length} Steam items identified (${scope})</div>
            <div>${pricedGames.length}/${matchedGames.length} identified items have price history</div>`;
        appendMatchDetails(summary, unmatchedGames, unpricedGames);

        summary.querySelector('#hb-helper-price-scope')?.addEventListener('click', () => {
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
        if (summary) summary.textContent = 'Loading Steam price totals...';
        lastPriceResult = null;

        try {
            const humbleCurrencyCode = findHumbleCurrencyCode();
            const steamCountryCode = await fetchSteamCountryCode();
            const resolvedGames = await Promise.all(titles.map(async title => {
                const app = await findSteamApp(title);
                return {title, appId: app?.appid || null};
            }));
            const games = resolvedGames.filter((game, index) =>
                !game.appId
                || resolvedGames.findIndex(other => other.appId === game.appId) === index
            );
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
            restrictionInfo.textContent = `No Region Restrictions`;
            restrictionInfo.setAttribute('style', `color:green; font-weight: bold; word-wrap:break-word; overflow:hidden;`);
        } else if (productInfo.exclusive_countries.length > 0) {
            restrictionInfo.textContent = `Exclusive countries: ${productInfo.exclusive_countries}`;
            restrictionInfo.setAttribute('style', `color:red; font-weight: bold; word-wrap:break-word; overflow:hidden;`);
        } else if (productInfo.disallowed_countries.length > 0) {
            restrictionInfo.textContent = `Disallowed countries: ${productInfo.disallowed_countries}`;
            restrictionInfo.setAttribute('style', `color:red; font-weight: bold; word-wrap:break-word; overflow:hidden;`);
        }

        insertElem.appendChild(document.createElement('br'));
        insertElem.appendChild(restrictionInfo);
        const target = container || document.querySelector('.disclaimer') || document.body;
        if (target) target.appendChild(insertElem);
    }

})();
