// ==UserScript==
// @name         HumbleBundle Helper
// @namespace    https://github.com/penguin-madagascar/HumbleBundle_Helper
// @version      0.0.4
// @description  Highlight owned games in HumbleBundle bundles
// @author       PenguinOfMadagascar
// @match        https://www.humblebundle.com/*
// @grant        GM_xmlhttpRequest
// @connect      store.steampowered.com
// @connect      steamcommunity.com
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
    }`;
    document.head.appendChild(style);

    // Slug: Convert a string to a slug by lowercasing and removing non-alphanumeric characters
    const slug = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');

    // SearchApps: Query Steam community to search for applications matching a keyword and return results
    function searchApps(keyword) {
        return new Promise((resolve) => {
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

    (async function run() {
        let owned, wishlist;
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
    })();

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

    // Region Restriction Check: Collect region‑lock data embedded in the page and render it
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