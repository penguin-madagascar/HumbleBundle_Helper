// ==UserScript==
// @name         HumbleBundle Helper
// @namespace    https://github.com/penguin-madagascar/HumbleBundle_Helper
// @version      0.0.8
// @description  Highlight owned games in HumbleBundle bundles
// @author       PenguinOfMadagascar
// @match        https://www.humblebundle.com/*
// @grant        GM_xmlhttpRequest
// @connect      store.steampowered.com
// @connect      steamcommunity.com
// @connect      api.xiaoheihe.cn
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
      margin-bottom: 4px !important;
    }
    #hb-helper-price-summary .hb-helper-price-value {
      font-weight: bold !important;
    }`;
    document.head.appendChild(style);

    // Slug: Convert a string to a slug by lowercasing and removing non-alphanumeric characters
    const slug = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const appSearchCache = new Map();
    const priceHistoryCache = new Map();
    let steamCountryCodePromise;
    let pageRefreshTimer;
    let priceTotalsRunId = 0;
    let lastPriceTitlesKey = '';
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

    // SearchApps: Query Steam community to search for applications matching a keyword and return results
    function searchApps(keyword) {
        if (appSearchCache.has(keyword)) return appSearchCache.get(keyword);

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
        appSearchCache.set(keyword, request);
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

    function buildSteamGiftsSearchUrl() {
        let term;
        if (isChoicePage()) {
            term = `[Humble Choice] ${getChoicePeriod()}`.trim();
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

    function getVisibleGameTitles() {
        return Array.from(document.querySelectorAll(
            '.tier-item-view .item-title, '
            + '.choice-content.js-open-choice-modal .content-choice-title'
        ))
            .filter(title => title.getClientRects().length > 0)
            .map(title => title.textContent.trim())
            .filter(Boolean);
    }

    async function findSteamAppId(title) {
        const titleSlug = slug(title);
        const results = await searchApps(title);
        const app = results.find(result => slug(result.name) === titleSlug);
        return app ? Number(app.appid) : null;
    }

    function renderBundlePriceTotals({
        region, currencyCode, gameCount, totalCount, current, original, lowest
    }) {
        const summary = document.getElementById('hb-helper-price-summary');
        if (!summary) return;
        const currency = new Intl.NumberFormat('zh-CN', {
            style: 'currency',
            currency: currencyCode,
        });
        summary.innerHTML = `
            <div class="hb-helper-price-title">Steam price totals (${region}, ${currencyCode})</div>
            <div>Current: <span class="hb-helper-price-value">${currency.format(current)}</span></div>
            <div>Original: <span class="hb-helper-price-value">${currency.format(original)}</span></div>
            <div>Historical low: <span class="hb-helper-price-value">${currency.format(lowest)}</span></div>
            <div>${gameCount}/${totalCount} games matched</div>`;
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

        try {
            const steamCountryCode = await fetchSteamCountryCode();
            const appIds = [...new Set((await Promise.all(titles.map(findSteamAppId))).filter(Boolean))];
            const prices = [];
            for (const appId of appIds) {
                try {
                    prices.push(await fetchXiaoheihePriceHistory(appId, steamCountryCode));
                } catch (error) {
                    console.warn('[HB-Helper] Fetch price failed:', error);
                }
            }
            if (prices.length === 0) throw new Error('No Steam prices matched this bundle');
            if (runId !== priceTotalsRunId) return;

            const totals = prices.reduce((total, price) => ({
                current: total.current + price.current,
                original: total.original + price.original,
                lowest: total.lowest + price.lowest,
            }), {current: 0, original: 0, lowest: 0});
            renderBundlePriceTotals({
                region: steamCountryCode,
                currencyCode: prices[0].currency,
                gameCount: prices.length,
                totalCount: titles.length,
                ...totals,
            });
        } catch (error) {
            if (runId !== priceTotalsRunId) return;
            console.warn('[HB-Helper] Load bundle price totals failed:', error);
            if (summary) summary.textContent = error.message;
        }
    }

    // Owned Games Check: Check a single game element and mark it as owned if it matches the user's owned app set
    async function markOne(viewEl, ownedSet) {
        if (viewEl.classList.contains('owned')) return;
        const titleEl = viewEl.querySelector('.item-title, .content-choice-title');
        if (!titleEl) return;
        const title = titleEl.textContent.trim();
        const titleSlug = slug(title);
        const results = await searchApps(title);
        for (const app of results) {
            if (!ownedSet.has(+app.appid)) continue;
            if (slug(app.name) === titleSlug) {
                viewEl.classList.add('owned');
                return;
            }
        }
    }

    async function markWishlistOne(viewEl, wishlistSet) {
        if (viewEl.classList.contains('wishlist')) return;
        const titleEl = viewEl.querySelector('.item-title, .content-choice-title');
        if (!titleEl) return;
        const title = titleEl.textContent.trim();
        const titleSlug = slug(title);
        const results = await searchApps(title);
        for (const app of results) {
            if (!wishlistSet.has(+app.appid)) continue;
            if (slug(app.name) === titleSlug) {
                viewEl.classList.add('wishlist');
                return;
            }
        }
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
