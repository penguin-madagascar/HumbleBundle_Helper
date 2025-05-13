// ==UserScript==
// @name         HumbleBundle Helper
// @namespace    https://github.com/penguin-madagascar/HumbleBundle_Helper
// @version      0.0.2
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
      margin: 0 !important;
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
                headers: { 'Cache-Control': 'no-cache' },
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

    (async function run() {
        let owned;
        try {
            owned = await fetchOwnedSet();
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
                loginLink.addEventListener('click', function() {
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
            document.querySelectorAll('.tier-item-view').forEach(el => markOne(el, ownedSet));
        }

        markOwnedItems(owned);

        const ob = new MutationObserver(muts => {
            muts.forEach(mu => {
                mu.addedNodes.forEach(n => {
                    if (n.nodeType === 1 && n.matches('.tier-item-view')) markOne(n, owned);
                    else if (n.nodeType === 1 && n.querySelectorAll)
                        n.querySelectorAll('.tier-item-view').forEach(v => markOne(v, owned));
                });
            });
        });
        ob.observe(document.body, { childList: true, subtree: true });
    })();

    // Owned Games Check: Check a single game element and mark it as owned if it matches the user's owned app set
    async function markOne(viewEl, ownedSet) {
        if (viewEl.classList.contains('owned')) return;
        const titleEl = viewEl.querySelector('.item-title');
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

})();