// ==UserScript==
// @name         HumbleBundle Helper
// @namespace    https://github.com/penguin-madagascar/HumbleBundle_Helper
// @version      0.0.1
// @description  Highlight owned games in HumbleBundle bundles (name-based matching)
// @author       PenguinOfMadagascar
// @match        https://www.humblebundle.com/*
// @grant        GM_xmlhttpRequest
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

    const slug = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');

    function searchApps(keyword) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: 'https://steamcommunity.com/actions/SearchApps/'
                    + encodeURIComponent(keyword),
                responseType: 'json',
                onload: ({status, response}) => {
                    if (status === 200 && Array.isArray(response)) resolve(response);
                    else resolve([]);
                },
                onerror: () => resolve([])
            });
        });
    }

    function fetchOwnedSet() {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: 'https://store.steampowered.com/dynamicstore/userdata/',
                withCredentials: true,
                responseType: 'json',
                onload: ({status, response}) => {
                    if (status === 200 && response && response.rgOwnedApps)
                        resolve(new Set(response.rgOwnedApps));
                    else reject('Failed to fetch owned apps');
                },
                onerror: reject
            });
        });
    }

    (async function run() {
        let owned;
        try {
            owned = await fetchOwnedSet();
        } catch (e) {
            console.warn('[HB-Helper] Fetch owned games failed:', e);
            return;
        }

        markOwnedItems(owned);

        const ob = new MutationObserver(muts => {
            muts.forEach(mu => {
                mu.addedNodes.forEach(n => {
                    if (n.nodeType === 1 && n.matches('.tier-item-view')) markOne(n, owned);
                    else if (n.nodeType === 1) n.querySelectorAll &&
                    n.querySelectorAll('.tier-item-view').forEach(v => markOne(v, owned));
                });
            });
        });
        ob.observe(document.body, {childList: true, subtree: true});
    })();

    // Owned Games Check
    function markOwnedItems(ownedSet) {
        document.querySelectorAll('.tier-item-view').forEach(el => markOne(el, ownedSet));
    }

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
