/* Paste into a Humble Library console. One compact report, from existing rows,
 * React data properties and resource timings only. No requests, callbacks,
 * storage reads, hooks, DOM writes, account values or revealed key strings.
 * A static request descriptor is source evidence, not a verified API contract;
 * closure-only handlers deliberately remain unknown.
 */
(function () {
    function collectLibraryContractProbe(document, location, performance = null) {
        const own = (object, key) => object && Object.getOwnPropertyDescriptor(object, key)?.value;
        const object = value => value !== null && typeof value === 'object';
        const words = value => new Set(value.split(' '));
        const sensitive = value => /session|token|csrf|cookie|secret|password|email|account|username|profile|auth|private/i.test(value);
        const identifier = value => typeof value === 'string' && /^[a-zA-Z][a-zA-Z0-9_]{0,39}$/.test(value) && !sensitive(value);
        const types = words('steam gog epic epicgames epic_games epic-games battlenet battle.net battle_net battle-net key keys free download direct directredeem direct_redeem direct-redeem origin ea uplay ubisoft humble drmfree drm-free drm_free android ios itch itch.io');
        const giftStatuses = words('none available unavailable unclaimed claimed gifted pending redeemed unredeemed not_gifted not-gifted notgifted sent received expired disabled enabled eligible ineligible not_giftable');
        const enumValue = (value, allowed) => typeof value === 'string' && /^[a-zA-Z0-9._-]{1,32}$/.test(value) && allowed.has(value.toLowerCase()) ? value.toLowerCase() : '[redacted]';
        const queryNames = words('page pageSize page_size perPage per_page limit offset cursor tab view sort sortBy order search query filter platform provider drm status');
        const queryKeys = search => [...new Set([...new URLSearchParams(search).keys()].slice(0, 24).map(key => queryNames.has(key) ? key : '[other]'))];
        const routeMatch = location.pathname.match(/^\/home\/library(?:\/(content\/)?([\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}))?\/?$/i);
        const routeId = routeMatch?.[2];
        const report = {route: {kind: !routeMatch ? 'unknown' : !routeId ? 'library' : routeMatch[1] ? 'content' : 'bundle'},
            samples: [], paging: {queryKeys: queryKeys(location.search), ancestors: [], formInputNames: []}, buttons: [], resources: []};
        const root = document.querySelector('main, [role="main"]') || document.body;
        if (!root) return report;
        const aliases = new Map();
        const alias = value => {
            if (!(typeof value === 'string' && value.length > 0 && value.length <= 256) && !(typeof value === 'number' && Number.isFinite(value))) return undefined;
            if (!aliases.has(value)) aliases.set(value, `id-${aliases.size + 1}`);
            return aliases.get(value);
        };
        const nativePlatforms = row => {
            const names = new Map(['Steam', 'GOG', 'Epic', 'Epic Games', 'Battle.net', 'Ubisoft', 'Origin', 'EA', 'Windows', 'Mac', 'Linux', 'Android', 'iOS', 'DRM-free'].map(name => [name.toLowerCase(), name]));
            const found = new Set();
            for (const node of [row, ...row.querySelectorAll('[aria-label],[title],[alt],button,svg title')].slice(0, 80)) {
                for (const value of [node.getAttribute('aria-label'), node.getAttribute('title'), node.getAttribute('alt'), node.tagName === 'BUTTON' || node.tagName.toLowerCase() === 'title' ? node.textContent : '']) {
                    const name = names.get(String(value || '').replace(/\s+/g, ' ').trim().toLowerCase());
                    if (name) found.add(name);
                }
            }
            return [...found].slice(0, 6);
        };
        const propsFor = node => {
            const props = [], names = Object.getOwnPropertyNames(node);
            const directKey = names.find(key => key.startsWith('__reactProps$'));
            const direct = directKey && own(node, directKey);
            if (object(direct)) props.push({props: direct, depth: 0, component: false});
            const fiberKey = names.find(key => key.startsWith('__reactFiber$'));
            let fiber = fiberKey && own(node, fiberKey);
            const seen = new Set();
            for (let depth = 0; object(fiber) && depth < 18 && !seen.has(fiber); depth++, fiber = own(fiber, 'return')) {
                seen.add(fiber);
                const value = own(fiber, 'memoizedProps');
                if (object(value)) props.push({props: value, depth, component: [0, 1, 2, 11, 14, 15, 16].includes(own(fiber, 'tag'))});
            }
            return props;
        };
        const seenRecords = new Map();
        const addSample = (record, source, row, item = null, keysCount = undefined) => {
            if (!object(record) || Array.isArray(record) || report.samples.length >= 6) return;
            const sources = seenRecords.get(record) || new Set();
            if (sources.has(source)) return;
            sources.add(source); seenRecords.set(record, sources);
            const flags = {};
            for (const name of ['expired', 'preOrdered', 'outOfStock', 'redeemable', 'notGiftable']) {
                const value = own(record, name);
                if (typeof value === 'boolean') flags[name] = value;
            }
            const key = own(own(record, 'redemptionData'), 'keyFormatted'), disclaimer = own(record, 'customDisclaimer'), direct = own(record, 'directRedeem');
            const entitlement = {type: enumValue(own(record, 'type'), types), flags,
                revealedKeyPresent: typeof key === 'string' && /^[A-Z0-9]{5}(?:-[A-Z0-9]{5}){2,4}$/i.test(key),
                giftStatus: enumValue(own(record, 'giftStatus'), giftStatuses),
                directRedeemType: direct === null ? 'null' : Array.isArray(direct) ? 'array' : typeof direct,
                customDisclaimerPresent: disclaimer != null && disclaimer !== false && disclaimer !== ''};
            const shape = {};
            for (const name of ['id', 'contentId', 'entitlementId', 'keySlotId', 'bundleId', 'productId']) {
                const value = alias(own(record, name));
                if (value) shape[name] = value;
            }
            const itemId = alias(own(item, 'id'));
            if (itemId) shape.itemId = itemId;
            if (routeId) shape.currentRouteId = alias(routeId);
            report.samples.push({source, nativePlatforms: nativePlatforms(row), entitlement,
                ...(keysCount !== undefined ? {keysCount} : {}), shape});
        };
        const rows = [...root.querySelectorAll('.flex.flex-col.border-0')].slice(0, 18);
        for (const row of rows) {
            if (report.samples.length >= 6) break;
            for (const node of [row, ...row.querySelectorAll('a,button')].slice(0, 8)) {
                for (const {props} of propsFor(node)) {
                    addSample(own(props, 'entitlement'), 'props.entitlement', row);
                    const item = own(props, 'item'), keys = own(own(item, 'entitlements'), 'keys');
                    if (!Array.isArray(keys)) continue;
                    const length = own(keys, 'length');
                    for (let index = 0; index < Math.min(length, 2); index++) addSample(own(keys, index), 'props.item.entitlements.keys', row, item, length);
                }
            }
        }
        const numericNames = words('page pages pageSize page_size pageCount totalPages totalCount currentPage perPage per_page pageIndex pageNumber limit offset total count totalItems');
        const sizeNames = words('supportedSizes pageSizes pageSizeOptions');
        const pagingPriority = name => Number(numericNames.has(name) || sizeNames.has(name) || /page|pagination|paging/i.test(name));
        const functionName = value => { const name = own(value, 'name'); return identifier(name) ? name : '[anonymous]'; };
        const pagingProps = props => {
            const propNames = Object.getOwnPropertyNames(props).filter(identifier).sort((left, right) => pagingPriority(right) - pagingPriority(left)).slice(0, 24), functions = [], numeric = {};
            const addNumeric = (value, name, prefix = '') => {
                if (numericNames.has(name) && typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 1000000) numeric[prefix + name] = value;
                if (sizeNames.has(name) && Array.isArray(value)) {
                    const sizes = [];
                    for (let index = 0; index < Math.min(own(value, 'length'), 8); index++) {
                        const size = own(value, index);
                        if (Number.isInteger(size) && size > 0 && size <= 1000) sizes.push(size);
                    }
                    if (sizes.length) numeric[prefix + name] = sizes;
                }
            };
            for (const name of propNames) {
                const value = own(props, name);
                if (typeof value === 'function' && functions.length < 8) functions.push({prop: name, name: functionName(value)});
                addNumeric(value, name);
                if (['pageInfo', 'pagination', 'paging'].includes(name) && object(value)) {
                    for (const key of Object.getOwnPropertyNames(value).filter(identifier).slice(0, 20)) addNumeric(own(value, key), key, name + '.');
                }
            }
            return {propNames, functions, numeric};
        };
        const pagerNodes = [...root.querySelectorAll('[aria-label],.pagination')].filter(node => /^(pagination|items per page|page size|next page|previous page|分页|每页数量|每页显示)$/i.test(node.getAttribute('aria-label') || '') || node.classList.contains('pagination')).slice(0, 4);
        const seenPagingProps = new Set(), pagingCandidates = [];
        for (const pager of pagerNodes) {
            for (const node of [pager, ...pager.querySelectorAll('button,a,select')].slice(0, 6)) {
                for (const {props, depth, component} of propsFor(node)) {
                    if (!component || seenPagingProps.has(props)) continue;
                    seenPagingProps.add(props);
                    pagingCandidates.push({depth, ...pagingProps(props)});
                }
            }
        }
        report.paging.ancestors = pagingCandidates.sort((left, right) => Number(right.propNames.some(pagingPriority)) - Number(left.propNames.some(pagingPriority)) || left.depth - right.depth).slice(0, 3);
        report.paging.formInputNames = [...new Set([...root.querySelectorAll('form input[name],form select[name],form textarea[name]')].slice(0, 24).map(node => {
            const name = node.getAttribute('name'); return identifier(name) ? name : '[redacted]';
        }))];
        // Only a fixed semantic vocabulary can establish a static path segment.
        // An unfamiliar lowercase word can still be a token or account value.
        const pathWords = words('api library libraries key keys entitlement entitlements redeem reveal claim redemption purchase purchases purchased product products bundle bundles content contents user users member members profile profiles account accounts me self current session sessions auth oauth login logout details list query graphql search get page pages pagination provider providers drm platform platforms slot slots keyslot keyslots download downloads gift gifts subscription subscriptions status state data items item resources');
        const path = pathname => {
            if (!pathname.startsWith('/api/') || pathname.length > 512) return null;
            const parts = pathname.split('/').filter(Boolean).slice(0, 12);
            const accountContainers = words('user users account accounts profile profiles');
            const accountRoutes = words('me self current library entitlements contents keys purchases');
            return '/' + parts.map((part, index) => {
                const accountValue = accountContainers.has(parts[index - 1]) && !accountRoutes.has(part);
                const staticWord = part.length <= 48 && part.split(/[-_]/).every(word => pathWords.has(word));
                return !accountValue && (staticWord || /^v[1-9]\d?$/.test(part)) ? part : '[id]';
            }).join('/');
        };
        // A deliberately small lexer: unsupported templates/regular expressions leave
        // the wire unknown. Comments and quoted code never become descriptor tokens.
        const requestLiterals = handler => {
            const source = Function.prototype.toString.call(handler);
            if (source.length > 24000) return [];
            const tokens = [];
            for (let index = 0; index < source.length;) {
                const char = source[index];
                if (/\s/.test(char)) { index++; continue; }
                if (source.startsWith('//', index)) { const end = source.indexOf('\n', index); index = end < 0 ? source.length : end + 1; continue; }
                if (source.startsWith('/*', index)) { const end = source.indexOf('*/', index + 2); if (end < 0) return []; index = end + 2; continue; }
                if (char === '`' || char === '/') return [];
                if (char === '"' || char === "'") {
                    const quote = char; let value = '', escaped = false; index++;
                    while (index < source.length && source[index] !== quote) {
                        if (source[index] === '\\') { escaped = true; index += 2; } else value += source[index++];
                    }
                    if (index >= source.length) return [];
                    tokens.push({kind: 'string', value: escaped ? '' : value}); index++; continue;
                }
                const name = source.slice(index).match(/^[a-zA-Z_$][\w$]*/)?.[0];
                tokens.push({kind: name ? 'name' : 'punctuation', value: name || char}); index += name ? name.length : 1;
            }
            const found = [];
            for (let start = 0; start < tokens.length && found.length < 2; start++) {
                if (tokens[start].value !== '{') continue;
                const values = {}; let index = start + 1;
                for (let count = 0; count < 8; count++) {
                    const key = tokens[index], colon = tokens[index + 1], value = tokens[index + 2], end = tokens[index + 3];
                    if (!['name', 'string'].includes(key?.kind) || colon?.value !== ':' || value?.kind !== 'string') break;
                    values[key.value] = value.value;
                    if (end?.value === '}') {
                        const pathname = values.url || values.path, method = values.method?.toUpperCase();
                        if (typeof pathname === 'string' && !/[?#]/.test(pathname) && /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)$/.test(method)) {
                            const safePath = path(pathname);
                            if (safePath) found.push({path: safePath, method});
                        }
                        break;
                    }
                    if (end?.value !== ',') break;
                    index += 4;
                }
            }
            return found;
        };
        const buttonLabels = words('Reveal Copy Claim Redeem Gift Download Steam GOG Epic');
        for (const label of ['Reveal key', 'Reveal your Steam key', 'Copy key', 'Copy key to clipboard', 'Claim key', 'Redeem key', 'Gift key', 'Show key', '显示密钥', '显示', '复制密钥', '复制', '领取', '兑换', '下载']) buttonLabels.add(label);
        for (const [rowIndex, row] of rows.entries()) {
            for (const [buttonIndex, button] of [...row.querySelectorAll('button')].slice(0, 8).entries()) {
                if (report.buttons.length >= 8) break;
                const label = (button.getAttribute('aria-label') || button.textContent || '').replace(/\s+/g, ' ').trim();
                const handlerNames = [], literals = [];
                for (const {props} of propsFor(button).filter(value => value.depth === 0)) {
                    const handler = own(props, 'onClick');
                    if (typeof handler !== 'function') continue;
                    handlerNames.push(functionName(handler)); literals.push(...requestLiterals(handler));
                }
                const value = {position: {row: rowIndex, button: buttonIndex}, label: buttonLabels.has(label) ? label : '[redacted]', handlerNames: [...new Set(handlerNames)].slice(0, 4),
                    requestEvidence: literals.length ? 'static-descriptor' : 'unknown',
                    requestLiterals: [...new Map(literals.map(value => [JSON.stringify(value), value])).values()].slice(0, 2)};
                report.buttons.push(value);
            }
        }
        if (performance && typeof performance.getEntriesByType === 'function') {
            const seen = new Set();
            for (const entry of performance.getEntriesByType('resource').slice(-200)) {
                if (!['fetch', 'xmlhttprequest'].includes(entry.initiatorType) || typeof entry.name !== 'string') continue;
                try {
                    const url = new URL(entry.name, location.href), pathname = path(url.pathname);
                    if (url.origin !== location.origin || !pathname) continue;
                    const value = {path: pathname, queryKeys: queryKeys(url.search)}, identity = JSON.stringify(value);
                    if (!seen.has(identity) && report.resources.length < 10) { seen.add(identity); report.resources.push(value); }
                } catch (_) { /* A malformed existing timing is not an endpoint. */ }
            }
        }
        // Keep each category useful even with unusually long static endpoint names.
        while (JSON.stringify(report).length >= 14000) {
            if (report.resources.length > 1) report.resources.pop();
            else if (report.buttons.length > 1) report.buttons.pop();
            else if (report.paging.ancestors.length > 1) report.paging.ancestors.pop();
            else if (report.samples.length > 1) report.samples.pop();
            else break;
        }
        return report;
    }
    if (typeof module === 'object' && module.exports) module.exports = {collectLibraryContractProbe};
    else console.log(JSON.stringify(collectLibraryContractProbe(document, location, typeof performance === 'object' ? performance : null)));
})();
