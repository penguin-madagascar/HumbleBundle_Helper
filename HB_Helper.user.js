// ==UserScript==
// @name         HumbleBundle Helper
// @namespace    https://github.com/penguin-madagascar/HumbleBundle_Helper
// @version      0.0.7
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
    let bundlePriceTotalsPromise;
    const europeanSteamCountries = new Set([
        'AT', 'BE', 'CY', 'DE', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR',
        'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PT', 'SI', 'SK',
    ]);

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

    function ensureBundlePriceSummary(anchor) {
        if (!isGamesBundlePage()) return;

        let summary = document.getElementById('hb-helper-price-summary');
        if (!summary) {
            summary = document.createElement('div');
            summary.id = 'hb-helper-price-summary';
            summary.textContent = 'Loading Steam price totals...';
        }
        if (anchor.nextElementSibling !== summary) {
            anchor.insertAdjacentElement('afterend', summary);
        }
    }

    function injectSteamGiftsButton() {
        function buildSteamGiftsSearchUrl() {
            function firstValidWord(s) {
                const m = s.match(/[A-Za-z0-9]+/);
                if (m) return m[0];
                const p = s.trim().split(/\s+/)[0];
                return p || 'Bundle';
            }

            const title = getBundleTitle();
            const word = firstValidWord(title);
            const term = `[Humble Bundle] ${word}`;
            return 'https://www.steamgifts.com/discussions/search?q=' + encodeURIComponent(term);
        }

        const url = buildSteamGiftsSearchUrl();
        let container = document.getElementById('steamgifts-discussion');
        if (!container) {
            container = document.createElement('div');
            container.id = 'steamgifts-discussion';
            const link = document.createElement('a');
            link.id = 'hb-helper-steamgifts-link';
            link.href = url;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.textContent = 'Search SteamGifts discussions (for potential region lock)';
            container.appendChild(link);
        } else {
            const link = container.querySelector('#hb-helper-steamgifts-link');
            if (link) link.href = url;
        }

        const loginDiv = document.getElementById('hb-helper-login-reminder');
        if (loginDiv) {
            loginDiv.insertAdjacentElement('afterend', container);
            ensureBundlePriceSummary(container);
            return;
        }

        const tierFilters = document.querySelector('.tier-filters');
        if (tierFilters) {
            if (container.parentNode !== tierFilters.parentNode) {
                tierFilters.parentNode.insertBefore(container, tierFilters.nextSibling);
            }
            ensureBundlePriceSummary(container);
            return;
        }

        const target = document.querySelector('.js-basic-info-view') || document.querySelector('.bundle-page') || document.body;
        if (container.parentNode !== target) target.appendChild(container);
        ensureBundlePriceSummary(container);
    }

    (async function run() {
        let owned, wishlist;
        injectSteamGiftsButton();
        loadBundlePriceTotals();
        try {
            owned = await fetchOwnedSet();
            wishlist = await fetchWishlistSet();
        } catch (e) {
            console.warn('[HB-Helper] Fetch owned games failed:', e);
            // Login Prompt Display
            // Description: Display a prompt linking to Steam login when fetch of owned games fails
            // Comment: --
            const tierFilters = document.querySelector('.tier-filters');
            if (tierFilters) {
                const loginDiv = document.createElement('div');
                loginDiv.id = 'hb-helper-login-reminder';
                loginDiv.textContent = 'Login to Steam to highlight owned games';
                tierFilters.parentNode.insertBefore(loginDiv, tierFilters);
            }
            injectSteamGiftsButton();
            return;
        }

        if (owned.size === 0) {
            console.warn('[HB-Helper] No owned games found; maybe logged out');
            // Login Prompt Display
            // Description: Display a prompt linking to Steam login when no owned games are found
            // Comment: --
            const tierFilters = document.querySelector('.tier-filters');
            if (tierFilters && !document.getElementById('hb-helper-login-reminder')) {
                const loginDiv = document.createElement('div');
                loginDiv.id = 'hb-helper-login-reminder';
                loginDiv.style.background = 'rgba(0, 0, 0, 0.5)';
                loginDiv.style.padding = '10px';
                loginDiv.style.margin = '8px 0';
                loginDiv.style.borderRadius = '4px';
                const loginLink = document.createElement('a');
                loginLink.href = 'https://store.steampowered.com/login/';
                loginLink.textContent = 'Login to Steam to check owned games';
                loginLink.target = '_blank';
                loginLink.style.color = '#fff';
                loginLink.addEventListener('click', function () {
                    const msg = document.createElement('div');
                    msg.textContent = 'Please refresh this page after login';
                    loginDiv.appendChild(msg);
                });
                loginDiv.appendChild(loginLink);
                tierFilters.parentNode.insertBefore(loginDiv, tierFilters);
            }
            injectSteamGiftsButton();
        }

        // Owned Games Check
        // Description: Highlight games that the user already owns on the HumbleBundle page
        // Comment: --
        function markOwnedItems(ownedSet) {
            document.querySelectorAll('.tier-item-view, .choice-content.js-open-choice-modal').forEach(el => markOne(el, ownedSet));
        }

        // Wishlist Games Highlight
        // Description: Highlight games that the user has on their Steam wishlist on the HumbleBundle page
        // Comment: --
        function markWishlistItems(wishlistSet) {
            document.querySelectorAll('.tier-item-view, .choice-content.js-open-choice-modal').forEach(el => markWishlistOne(el, wishlistSet));
        }

        markOwnedItems(owned);
        markWishlistItems(wishlist);

        const ob = new MutationObserver(muts => {
            muts.forEach(mu => {
                mu.addedNodes.forEach(n => {
                    if (n.nodeType === 1 && n.matches('.tier-item-view')) {
                        markOne(n, owned);
                        markWishlistOne(n, wishlist);
                    } else if (n.nodeType === 1 && n.matches('.choice-content.js-open-choice-modal')) {
                        markOne(n, owned);
                        markWishlistOne(n, wishlist);
                    } else if (n.nodeType === 1 && n.querySelectorAll) {
                        n.querySelectorAll('.tier-item-view').forEach(v => {
                            markOne(v, owned);
                            markWishlistOne(v, wishlist);
                        });
                        n.querySelectorAll('.choice-content.js-open-choice-modal').forEach(v => {
                            markOne(v, owned);
                            markWishlistOne(v, wishlist);
                        });
                    }
                });
            });
        });
        ob.observe(document.body, {childList: true, subtree: true});
        injectSteamGiftsButton();
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
        const html = await gmRequest(`https://store.steampowered.com/?l=english&_=${Date.now()}`, 'text');
        const steamPage = new DOMParser().parseFromString(html, 'text/html');
        const userInfoText = steamPage.querySelector('#application_config')?.getAttribute('data-userinfo');
        const userInfo = JSON.parse(userInfoText);
        if (!userInfo.logged_in) throw new Error('Login to Steam to load regional prices');
        return userInfo.country_code.toUpperCase();
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
    }

    function getBundleGameTitles() {
        return Array.from(document.querySelectorAll(
            '.tier-item-view .item-title, .choice-content.js-open-choice-modal .content-choice-title'
        ), title => title.textContent.trim()).filter(Boolean);
    }

    async function waitForBundleGameTitles() {
        for (let i = 0; i < 20; i++) {
            const titles = getBundleGameTitles();
            if (titles.length > 0) return [...new Set(titles)];
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        return [];
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

    function loadBundlePriceTotals() {
        if (!isGamesBundlePage() || bundlePriceTotalsPromise) return bundlePriceTotalsPromise;

        bundlePriceTotalsPromise = (async () => {
            const steamCountryCode = await fetchSteamCountryCode();
            const titles = await waitForBundleGameTitles();
            if (titles.length === 0) throw new Error('No games found on this bundle page');

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
        })().catch(error => {
            console.warn('[HB-Helper] Load bundle price totals failed:', error);
            const summary = document.getElementById('hb-helper-price-summary');
            if (summary) summary.textContent = error.message;
        });

        return bundlePriceTotalsPromise;
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
