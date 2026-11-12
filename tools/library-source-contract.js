/* Paste into the Library console to GET already loaded public static JavaScript.
 * Last 20 eligible assets first, two requests at once, 4 MiB each / 8 MiB total.
 * Reads external script src attributes only, never inline scripts, page state,
 * storage, cookies or handlers. Source is inspected as text and never executed.
 * Prints only allowlisted contract vocabulary, never raw source or unknown values.
 * Asset paths are anonymous. Candidates are evidence hints, not verified contracts.
 */
(function () {
    async function collectLibrarySourceContract(document, location, fetchAsset) {
        const assetLimit = 4 * 1024 * 1024, totalLimit = 8 * 1024 * 1024;
        const privatePath = /(?:^|\/)(?:api|home|users?|accounts?|profiles?|sessions?|login|logout|auth|oauth)(?:[/._-]|$)|[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}|[a-z\d]{5}(?:-[a-z\d]{5}){2,4}|@/i;
        const assetURL = value => {
            try {
                if (!value) return null;
                const url = new URL(value, location.href), decoded = decodeURIComponent(url.pathname);
                const libraryChunk = /^\/_next\/static\/chunks\/app\/home\/library(?:\/(?:content|\[(?:id|contentId|bundleId)\]))*\/(?:page|layout|loading|error|not-found)(?:-[a-z\d]{8,64})?\.m?js$/.test(decoded);
                const privateCandidate = libraryChunk ? decoded.slice('/_next/static/chunks/app/home/library'.length) : decoded;
                return url.origin === location.origin && /^https?:$/.test(url.protocol) && !url.username && !url.password
                    && /^\/(?:_next\/static|assets)\//.test(url.pathname) && /\.m?js$/i.test(url.pathname) && url.pathname.length <= 256
                    && !privatePath.test(privateCandidate) && !/token|secret|session|auth|email|user|account/i.test(url.search) ? url : null;
            } catch (_) { return null; }
        };
        const eligible = [...new Map(Array.from(document.scripts || [], script => assetURL(script.getAttribute('src')))
            .filter(Boolean).map(url => [url.href, url])).values()];
        const assets = eligible.slice(-20).reverse();
        const assetPaths = assets.map((url, index) => `${url.pathname.startsWith('/_next/static/') ? '/_next/static/' : '/assets/'}[asset-${index + 1}].${/\.mjs$/i.test(url.pathname) ? 'mjs' : 'js'}`);
        const report = {schemaVersion: 2, assetPaths,
            assetStates: assetPaths.map(assetPath => ({assetPath, state: 'budget-skipped'})),
            stats: {eligible: eligible.length, selected: assets.length, attempted: 0,
                inspected: 0, omitted: eligible.length - assets.length, byteBudgetReached: false},
            frameworkSignals: {createServerReference: 0, callServer: 0}, candidates: []};
        if (!assets.length) return {...report, reason: 'no verified static asset URLs'};
        // This lightweight mask only finds candidates. No unknown lexer token or
        // raw source slice can reach output, including ambiguous regex literals.
        const lexical = /"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'|`(?:\\[\s\S]|[^`\\])*`|\/\*[\s\S]*?\*\/|\/\/[^\n\r]*/g;
        const pathWords = new Set('api library libraries key keys entitlement entitlements redeem reveal claim redemption content contents bundle bundles product products slot slots keyslot keyslots data purchase purchases download downloads'.split(' '));
        const endpoint = value => value.length <= 256 && /^\/[a-z][a-z\d_-]*(?:\/[a-z][a-z\d_-]*)*\/?$/i.test(value)
            && value.split('/').filter(Boolean).every(part => /^v[1-9]\d?$/.test(part) || part.split(/[-_]/).every(word => pathWords.has(word.toLowerCase())));
        const domainNames = ['redeemKey', 'claimKey', 'revealKey', 'redeemEntitlement', 'redemption'];
        const fieldNames = ['id', 'contentId', 'entitlementId', 'entitlementIds', 'keySlotId', 'keyId', 'keyIntegrationId', 'redemptionGroupId', 'redemptionId', 'productId', 'bundleId', 'platform', 'type'];
        const pageNames = ['page', 'pageSize', 'perPage', 'itemsPerPage', 'supportedPageSizes', 'page_size', 'per_page', 'limit', 'offset', 'pageIndex'];
        const methods = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']);
        const frameworkNames = ['createServerReference', 'callServer'];
        const unique = values => [...new Set(values)];
        const namesIn = (code, names) => names.filter(name => new RegExp(`\\b${name}\\b`).test(code));
        const inspect = (source, assetPath) => {
            if (/^\s*</.test(source)) return 'html-rejected';
            if (/^\s*[\[{]/.test(source)) {
                try { JSON.parse(source); return 'json-rejected'; } catch (_) { /* JavaScript can start with an array or block. */ }
            }
            const literals = [], words = [];
            const code = source.replace(lexical, (value, offset) => {
                if (/^["']/.test(value)) {
                    const text = value.slice(1, -1);
                    if (endpoint(text)) literals.push({offset, value: text});
                    if (methods.has(text) || fieldNames.includes(text) || pageNames.includes(text)
                        || frameworkNames.includes(text)) words.push({offset, value: text});
                } else if (value.startsWith('`')) {
                    // Only static path fragments can become output; interpolation
                    // contents never leave the source scanner.
                    for (const part of value.slice(1, -1).split(/\$\{[^}]*\}/)) {
                        if (endpoint(part)) literals.push({offset, value: part});
                    }
                }
                return ' '.repeat(value.length);
            });
            for (const name of frameworkNames) {
                report.frameworkSignals[name] += [...code.matchAll(new RegExp(`\\b${name}\\b`, 'g'))].length
                    + words.filter(item => item.value === name).length;
            }
            const transport = value => /\bfetch\s*\(|\.\s*(?:post|put|patch|request)\s*\(/i.test(value);
            const definitions = [...code.matchAll(/\b(redeemKey|claimKey|revealKey|redeemEntitlement|redemption)\s*(?:\([^)]{0,150}\)\s*\{|[:=]\s*(?:async\s*)?(?:function\s*\([^)]{0,150}\)\s*\{|\([^)]{0,150}\)\s*=>\s*\{?|[\w$]+\s*=>\s*\{?))/gi)];
            const add = (start, end, hint) => {
                const pagination = hint === 'pagination';
                if (report.candidates.filter(item => (item.hint === 'pagination') === pagination).length >= (pagination ? 3 : 7)) return;
                const window = code.slice(start, end), nearby = words.filter(item => item.offset >= start && item.offset < end).map(item => item.value);
                const candidate = pagination ? {assetPath, hint, parameters: unique([...namesIn(window, pageNames), ...nearby.filter(value => pageNames.includes(value))]),
                    routing: namesIn(window, ['router', 'searchParams', 'URLSearchParams', 'pagination', 'setPage', 'onPageChange']),
                    declaredSizes: unique([...window.matchAll(/\bsupportedPageSizes\s*[:=]\s*\[([\d,\s]+)\]/g)].flatMap(match => match[1].split(',').map(Number).filter(value => [20, 50, 100].includes(value))))}
                    : {assetPath, hint, paths: unique(literals.filter(item => item.offset >= start && item.offset < end).map(item => item.value)).slice(0, 4),
                        transports: unique([...window.matchAll(/(?:\b(fetch)|\.\s*(post|put|patch|request))\s*\(/gi)].map(match => (match[1] || match[2]).toLowerCase())),
                        methods: unique(nearby.filter(value => methods.has(value))), fields: unique([...namesIn(window, fieldNames), ...nearby.filter(value => fieldNames.includes(value))])};
                if (!report.candidates.some(item => JSON.stringify(item) === JSON.stringify(candidate))) report.candidates.push(candidate);
            };
            for (const match of definitions) {
                let end = Math.min(source.length, match.index + 1000);
                if (match[0].endsWith('{')) {
                    let depth = 1;
                    for (let index = match.index + match[0].length; index < end; index++) {
                        if (code[index] === '{') depth++;
                        if (code[index] === '}' && --depth === 0) { end = index + 1; break; }
                    }
                } else {
                    const semicolon = code.indexOf(';', match.index + match[0].length);
                    if (semicolon >= 0) end = Math.min(end, semicolon + 1);
                }
                if (literals.some(item => item.offset >= match.index && item.offset < end && (/^\/api\//.test(item.value) || /redeem|claim|reveal|redemption/i.test(item.value)))
                    && transport(code.slice(match.index, end))) add(match.index, end, domainNames.find(name => name.toLowerCase() === match[1].toLowerCase()));
            }
            for (const literal of literals) {
                if (!/redeem|claim|reveal|redemption/i.test(literal.value)) continue;
                const start = Math.max(0, literal.offset - 250), end = Math.min(source.length, literal.offset + literal.value.length + 300);
                if (!definitions.some(match => match.index >= start && match.index < literal.offset) && transport(code.slice(start, literal.offset))) {
                    add(start, end, /^\/api\//.test(literal.value) ? 'api-transport' : 'redemption-transport');
                }
            }
            const pagingNames = ['pageSize', 'perPage', 'itemsPerPage', 'supportedPageSizes', 'page_size', 'per_page', 'limit'];
            const pagingOffsets = new Set([...code.matchAll(new RegExp(`\\b(?:${pagingNames.join('|')})\\b`, 'g'))].map(match => match.index));
            words.filter(item => pagingNames.includes(item.value)).forEach(item => pagingOffsets.add(item.offset));
            for (const offset of [...pagingOffsets].sort((left, right) => left - right)) {
                const start = Math.max(0, offset - 250), end = Math.min(source.length, offset + 500);
                if (/\b(?:router|searchParams|URLSearchParams|pagination|setPage|onPageChange)\b/.test(code.slice(start, end))) add(start, end, 'pagination');
            }
            return 'inspected';
        };
        let next = 0, bytes = 0;
        const worker = async () => {
            while (next < assets.length && bytes < totalLimit) {
                const index = next++, url = assets[index], state = report.assetStates[index];
                report.stats.attempted++;
                state.state = 'request-failed';
                try {
                    const response = await fetchAsset(url.href, {method: 'GET', cache: 'force-cache', credentials: 'same-origin', redirect: 'error'});
                    const finalURL = response.url ? assetURL(response.url) : url;
                    const rejected = !response.ok ? 'http-rejected'
                        : !finalURL || finalURL.origin !== url.origin || finalURL.pathname !== url.pathname ? 'url-rejected'
                            : !/^(?:application|text)\/(?:javascript|ecmascript)(?:\s*;|$)/i.test(response.headers.get('content-type') || '') ? 'mime-rejected'
                                : Number(response.headers.get('content-length')) > assetLimit ? 'asset-limit' : null;
                    if (rejected) { state.state = rejected; await response.body?.cancel(); continue; }
                    state.state = 'read-failed';
                    const reader = response.body?.getReader();
                    if (!reader) { state.state = 'read-unavailable'; continue; }
                    let size = 0, source = '', complete = false;
                    const decoder = new TextDecoder();
                    try {
                        while (bytes < totalLimit) {
                            const {done, value} = await reader.read();
                            if (done) { complete = true; source += decoder.decode(); break; }
                            size += value.byteLength; bytes = Math.min(totalLimit, bytes + value.byteLength);
                            if (size > assetLimit || bytes >= totalLimit) {
                                state.state = bytes >= totalLimit ? 'byte-budget' : 'asset-limit';
                                break;
                            }
                            source += decoder.decode(value, {stream: true});
                        }
                    } finally {
                        if (!complete) {
                            if (state.state === 'read-failed' && bytes >= totalLimit) state.state = 'byte-budget';
                            await reader.cancel();
                        }
                    }
                    if (complete) {
                        state.state = inspect(source, assetPaths[index]);
                        if (state.state === 'inspected') report.stats.inspected++;
                    }
                } catch (_) { /* Report no response body or potentially private error text. */ }
            }
        };
        await Promise.all([worker(), worker()]);
        report.stats.byteBudgetReached = bytes >= totalLimit;
        while (JSON.stringify(report).length > 14000) report.candidates.pop();
        return report;
    }
    if (typeof module === 'object' && module.exports) module.exports = {collectLibrarySourceContract};
    else collectLibrarySourceContract(document, location, fetch).then(report => console.log(JSON.stringify(report)),
        () => console.log(JSON.stringify({assetPaths: [], reason: 'static source scan failed'})));
})();
