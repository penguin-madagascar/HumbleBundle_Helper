/* Paste into the Library page console. Logs a bounded, read-only structural report.
 * Only the known public title/static UI labels and Library route UUIDs may survive.
 * Unknown fields stay anonymous; this does not infer or validate a Library API.
 */
(function () {
    function collectLibraryDiagnostics(document, location, performance = null) {
        const words = value => new Set(value.split(' '));
        const labels = words('Library Purchased Bundles Content Keys Downloads Steam GOG Epic Ubisoft Origin EA Windows Mac Linux Android iOS Redeem Reveal Claimed Unclaimed Available Pending Expired');
        for (const value of ['Beyond the Metroidverse Bundle', 'Reveal key', 'Download', 'Previous', 'Next', 'First', 'Last', 'Load more', 'Pagination', 'Items per page', 'Page size', 'Next page', 'Previous page', '您的游戏库', '游戏库', '已购买', '购买项目', '捆绑包', '合集', '筛选', '排序', '领取', '显示密钥', '已领取', '未领取', '可领取', '已兑换', '未兑换', '下载', '密钥', '上一页', '下一页', '首页', '末页', '每页数量', '每页显示', '分页']) labels.add(value);
        const label = (value, numeric = false) => {
            const text = String(value || '').replace(/\s+/g, ' ').trim();
            return [...labels].some(item => item.toLowerCase() === text.toLowerCase()) || (numeric && /^\d{1,4}$/.test(text)) ? text : '[redacted]';
        };
        const queryNames = words('page pageSize page_size limit offset cursor tab view sort sortBy order search query filter platform provider drm status purchased bundle content operationName variables extensions id contentId entitlementId keySlotId');
        const queryKeys = search => [...new Set([...new URLSearchParams(search).keys()].slice(0, 30).map(key => queryNames.has(key) ? key : '[other]'))];
        const route = value => {
            try {
                const url = new URL(value, location.href);
                const match = url.pathname.match(/^\/home\/library(?:\/(content\/)?([\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}))?\/?$/i);
                if (url.origin !== location.origin || !match) return {kind: 'unknown'};
                return {kind: match[2] ? (match[1] ? 'content' : 'bundle') : 'library', pathname: url.pathname.replace(/\/$/, ''), ...(match[2] ? {uuid: match[2]} : {})};
            } catch (_) { return {kind: 'unknown'}; }
        };
        const main = document.querySelector('main, [role="main"]');
        const root = main || document.body;
        const result = {schemaVersion: 3, contract: 'unknown', route: route(location.href), queryKeys: queryKeys(location.search),
            title: label(document.title), mainFound: Boolean(main), headings: [], tabs: [], routes: [], pagination: [], dataAttributes: [], mainHTML: '', fields: [],
            sources: {jsonDocuments: 0, flightRecords: 0, skippedScripts: 0}};
        const semanticWords = words('library purchased bundle bundles content contents entitlement entitlements key keys slot slots product products thumbnail image footer title header body details card item items pagination page size selected provider drm platform state status testid test id index active type trigger radix collection orientation grid flex block hidden relative absolute overflow auto wrap gap row col cols start end center justify between text font bold medium rounded border button tab tabs list panel menu download downloads action actions');
        const safeName = value => value.length <= 80 && value.split('-').every(part => semanticWords.has(part) || /^\d{1,2}$/.test(part));
        const dataNames = new Set();
        const safeTags = words('main div section article header footer nav aside h1 h2 h3 h4 h5 h6 p span a button select option ul ol li dl dt dd table thead tbody tr th td strong em small label form fieldset legend figure figcaption img br hr pre code details summary');
        const roles = words('main tab tablist tabpanel button link list listitem navigation menu menuitem combobox listbox option region group grid row cell status');
        const escape = value => value.replace(/[&"<>]/g, char => ({'&': '&amp;', '"': '&quot;', '<': '&lt;', '>': '&gt;'}[char]));
        let nodes = 0;
        const append = value => { result.mainHTML += value.slice(0, Math.max(0, 20000 - result.mainHTML.length)); };
        const walk = (node, depth = 0) => {
            if (++nodes > 1200 || depth > 25 || result.mainHTML.length >= 20000) return;
            if (node.nodeType === 3) { const text = label(node.textContent); if (text !== '[redacted]') append(escape(text)); return; }
            if (node.nodeType !== 1 || /^(INPUT|TEXTAREA|SCRIPT|STYLE|SVG|IFRAME|OBJECT|EMBED|TEMPLATE)$/i.test(node.tagName)) return;
            const tag = node.tagName.toLowerCase();
            append(`<${safeTags.has(tag) ? tag : 'div'}`);
            for (const attribute of Array.from(node.attributes)) {
                const name = attribute.name;
                if (name.startsWith('data-')) {
                    const safe = safeName(name.slice(5));
                    dataNames.add(safe ? name : '[other]');
                    if (safe && name !== 'data-testid') append(` ${name}`);
                }
            }
            for (const name of ['class', 'role', 'data-testid', 'type', 'aria-haspopup', 'aria-selected', 'aria-expanded', 'aria-label']) {
                const value = node.getAttribute(name);
                if (value === null) continue;
                const safe = name === 'class' ? value.split(/\s+/).filter(safeName).slice(0, 12).join(' ')
                    : name === 'role' ? (roles.has(value) ? value : '')
                    : name === 'data-testid' ? (safeName(value) ? value : '')
                    : name === 'type' ? (/^(button|submit|reset)$/.test(value) ? value : '')
                    : name === 'aria-haspopup' ? (/^(true|false|menu|listbox|tree|grid|dialog)$/.test(value) ? value : '')
                    : name === 'aria-label' ? (label(value) === '[redacted]' ? '' : label(value))
                    : /^(true|false)$/.test(value) ? value : '';
                if (safe) append(` ${name}="${escape(safe)}"`);
            }
            const target = tag === 'a' ? route(node.getAttribute('href')) : {kind: 'unknown'};
            if (target.kind !== 'unknown') append(` href="${escape(target.pathname)}"`);
            append('>');
            for (const child of node.childNodes) { if (nodes >= 1200 || result.mainHTML.length >= 20000) break; walk(child, depth + 1); }
            append(`</${safeTags.has(tag) ? tag : 'div'}>`);
        };
        let paginationNodes = [];
        if (root) {
            walk(root);
            result.dataAttributes = [...dataNames].slice(0, 100);
            result.headings = [...root.querySelectorAll('h1,h2,h3,h4,h5,h6')].slice(0, 30).map(node => ({tag: node.tagName.toLowerCase(), label: label(node.textContent)}));
            result.tabs = [...root.querySelectorAll('[role="tab"]')].slice(0, 20).map(node => ({tag: safeTags.has(node.tagName.toLowerCase()) ? node.tagName.toLowerCase() : 'div', label: label(node.textContent), selected: node.getAttribute('aria-selected') === 'true'}));
            const seen = new Set();
            for (const node of [...root.querySelectorAll('a[href]')].slice(0, 300)) {
                const target = route(node.getAttribute('href'));
                if (target.kind !== 'unknown' && !seen.has(target.pathname)) { seen.add(target.pathname); result.routes.push({...target, label: label(node.textContent)}); }
            }
            const inPagination = node => {
                for (let parent = node; parent && parent !== root.parentNode; parent = parent.parentElement) {
                    if (['pagination', '分页'].includes(label(parent.getAttribute('aria-label')).toLowerCase()) || parent.classList.contains('pagination')) return true;
                }
                return ['Items per page', 'Page size', 'Next page', 'Previous page', '每页数量', '每页显示', '上一页', '下一页'].includes(label(node.getAttribute('aria-label')));
            };
            const linkQueryKeys = node => { try { return queryKeys(new URL(node.getAttribute('href'), location.href).search); } catch (_) { return []; } };
            paginationNodes = [...root.querySelectorAll('button,a,select')].filter(inPagination).slice(0, 30);
            result.pagination = paginationNodes.map(node => ({
                tag: node.tagName.toLowerCase(), label: label(node.getAttribute('aria-label') || node.textContent, true),
                disabled: node.hasAttribute('disabled') || node.getAttribute('aria-disabled') === 'true', current: node.getAttribute('aria-current') === 'page',
                ...(node.tagName === 'A' ? {route: route(node.getAttribute('href')), queryKeys: linkQueryKeys(node)} : {}),
                ...(node.tagName === 'SELECT' ? {options: [...node.querySelectorAll('option')].slice(0, 20).map(option => ({label: label(option.textContent, true), selected: option.selected ?? option.hasAttribute('selected')}))} : {}),
            }));
        }
        const fieldNames = words('data props pageprops children library purchased purchases purchase bundles bundle bundlepage bundleitems content contents contentid entitlement entitlements entitlementid subscriptionentitlement subscriptionproducts purchasedproducts key keys keyslot keyslots keyslotid keytype keyindex id title name products product items item selectedprovider selecteddrm selecteddeliverymethod provider providers drm platform platforms deliverymethods redemptionstate status state redeemed claimed available total count page pages pagesize pagecount totalpages totalcount currentpage limit offset cursor nextcursor hasnextpage haspreviouspage pageinfo pagination paging results nodes edges node connection perpage pageindex pagenumber totalitems supportedSizes onpagechange onpagesizechange isloading isfetching hasmore'.toLowerCase());
        const normalizeField = key => key.toLowerCase().replace(/_/g, '');
        const safeField = key => key.length <= 80 && /^[a-z_]+$/i.test(key) && (fieldNames.has(normalizeField(key)) || /^(?:library|purchase|purchased|subscription)?(?:content|entitlement|keyslot|product|bundle|redemption|delivery|drm|platform|provider)(?:id|ids|key|keys|item|items|status|state|type|method|methods|provider|providers|platform|platforms|name|count|index|page|pages|size|selected|list|s)?$/.test(normalizeField(key)));
        const domainField = key => safeField(key) && /^(?:(?:subscription|purchased)?(?:entitlement|content|keyslot|product|bundle)(?:id|ids|items|type|state|status|method|methods|count|index|slot|slots|products|entitlement|entitlements|s)?|selectedprovider|selecteddrm|selecteddeliverymethod|keytype|redemptionstate|pageinfo|pagination|pagesize|pagecount|totalpages|totalcount|currentpage|hasnextpage|haspreviouspage)$/.test(normalizeField(key));
        const fieldPath = (path, key) => `${path}${safeField(key) ? `.${key}` : '[other]'}`;
        const seenFields = new Set();
        const shape = (value, path = '$', depth = 0) => {
            if (depth > 14 || result.fields.length >= 100) return;
            const type = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
            const identity = `${path}:${type}`;
            if (!seenFields.has(identity)) {
                seenFields.add(identity);
                const field = {path, type};
                if (type === 'string' && /\.(title|name|status|state|platform|provider|selected_?provider|selected_?drm|key_?type|selected_?delivery_?method|redemption_?state)$/i.test(path) && label(value) !== '[redacted]') field.label = label(value);
                if (type === 'string' && result.route.uuid && value === result.route.uuid) field.matchesRouteId = true;
                result.fields.push(field);
            }
            if (Array.isArray(value)) { for (const item of value.slice(0, 12)) shape(item, `${path}[]`, depth + 1); }
            else if (value && typeof value === 'object') {
                const entries = Object.entries(value);
                if (entries.length > 20 && entries.every(([, item]) => typeof item === 'string')) return;
                for (const [key, item] of entries.sort(([left], [right]) => Number(domainField(right)) - Number(domainField(left))).slice(0, 100)) shape(item, fieldPath(path, key), depth + 1);
            }
        };
        const chunks = [], documents = [];
        let scriptBytes = 0;
        const scripts = [...document.querySelectorAll('script')];
        result.sources.skippedScripts = Math.max(0, scripts.length - 60);
        for (const script of scripts.slice(0, 60)) {
            const text = script.textContent;
            scriptBytes += text.length;
            if (text.length > 1000000 || scriptBytes > 4000000) { result.sources.skippedScripts++; continue; }
            if (script.getAttribute('type') === 'application/json' || script.id === '__NEXT_DATA__') {
                try { documents.push(JSON.parse(text)); result.sources.jsonDocuments++; } catch (_) { result.sources.skippedScripts++; }
            } else {
                const pattern = /self\.__next_f\.push\(\s*(\[\s*1\s*,\s*"(?:[^"\\]|\\.)*"\s*\])\s*\)/g;
                for (const match of text.matchAll(pattern)) {
                    try { chunks.push(JSON.parse(match[1])[1]); } catch (_) { /* Incomplete literal; never execute scripts. */ }
                }
            }
        }
        // Match the userscript's byte-delimited Flight handling; text/import rows are not JSON records.
        const bytes = new TextEncoder().encode(chunks.join(''));
        const decoder = new TextDecoder();
        let offset = 0;
        while (offset < bytes.length && result.sources.flightRecords < 300) {
            const header = decoder.decode(bytes.subarray(offset, offset + 80)).match(/^([\da-f]*):([TAOobUSsLlGgMmV])?([\da-f]+,)?/);
            if (!header) break;
            offset += header[0].length;
            if (header[2]) { if (!header[3]) break; offset += parseInt(header[3], 16); continue; }
            const end = bytes.indexOf(10, offset);
            if (end < 0) break;
            try { documents.push(JSON.parse(decoder.decode(bytes.subarray(offset, end)))); result.sources.flightRecords++; } catch (_) { /* Unsupported protocol row. */ }
            offset = end + 1;
        }
        // Discover contract-shaped nodes before UI/localization records can spend the field budget.
        const candidates = [];
        let visited = 0;
        const discover = (value, path = '$', depth = 0) => {
            if (!value || typeof value !== 'object' || depth > 20 || ++visited > 20000) return;
            if (Array.isArray(value)) { for (const item of value.slice(0, 300)) discover(item, `${path}[]`, depth + 1); return; }
            const entries = Object.entries(value).slice(0, 1000);
            if (entries.some(([key]) => domainField(key))) candidates.push({value, path});
            for (const [key, item] of entries) discover(item, fieldPath(path, key), depth + 1);
        };
        for (const value of documents) discover(value);
        for (const {value, path} of candidates) shape(value, path);
        for (const value of documents) shape(value);
        // Second pass: inspect existing timing entries and relevant component props, never request data.
        const client = result.client = {resources: [], targets: [], components: [], resourceTimingAvailable: typeof performance?.getEntriesByType === 'function'};
        const aliases = new Map();
        const alias = value => { const key = String(value); if (!aliases.has(key)) aliases.set(key, `id-${aliases.size + 1}`); return aliases.get(key); };
        const pathWords = words('api v1 v2 v3 bff home library entitlement entitlements content contents product products purchase purchases purchased bundle bundles user users list graphql query data get search page pagination keys key slots keyslots downloads subscriptions subscription details items resources');
        const pathSegment = segment => {
            const parts = segment.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase().split(/[-_]/);
            return segment.length <= 80 && parts.every(part => pathWords.has(part)) ? segment : `[${alias(segment)}]`;
        };
        if (client.resourceTimingAvailable) {
            const seen = new Set();
            for (const entry of performance.getEntriesByType('resource').slice(-300)) {
                if (!['fetch', 'xmlhttprequest'].includes(entry.initiatorType)) continue;
                try {
                    const url = new URL(entry.name, location.href);
                    if (url.origin !== location.origin || !/^https?:$/.test(url.protocol)) continue;
                    const resource = {type: entry.initiatorType, path: '/' + url.pathname.split('/').filter(Boolean).slice(0, 20).map(pathSegment).join('/'), queryKeys: queryKeys(url.search)};
                    const identity = JSON.stringify(resource);
                    if (!seen.has(identity) && client.resources.length < 80) { seen.add(identity); client.resources.push(resource); }
                } catch (_) { /* Ignore malformed resource names; never load them. */ }
            }
        }
        const own = (value, key) => value && Object.getOwnPropertyDescriptor(value, key)?.value;
        const plain = value => { if (!value || typeof value !== 'object') return false; const proto = Object.getPrototypeOf(value); return Array.isArray(value) || proto === null || Object.getPrototypeOf(proto) === null; };
        const routeIds = new Set([result.route, ...result.routes].map(value => value.uuid?.toLowerCase()).filter(Boolean));
        const propPriority = key => /^(?:pageinfo|pagination|paging|page|pages|pagesize|pagecount|totalpages|totalcount|currentpage|perpage|pageindex|pagenumber|limit|offset|total|count|totalitems|supportedsizes|onpagechange|onpagesizechange)$/.test(normalizeField(key)) ? 2 : Number(domainField(key));
        const ordinaryField = key => /^[a-z][a-zA-Z0-9_]{0,63}$/.test(key) && !/^[a-f\d]{16,}$/i.test(key) && !/[A-Z\d]{12,}/.test(key);
        const sensitiveField = key => /session|token|csrf|cookie|privatekey|secret|password|email|account|username|auth/.test(normalizeField(key));
        const propSchema = props => {
            const fields = [], visited = new Map(), seen = new Set();
            let scanned = 0;
            const visit = (value, path = '$', key = '', depth = 0, domain = '', terminal = false) => {
                if (++scanned > 500 || depth > 10 || fields.length >= 40) return;
                const type = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
                if (type === 'object' || type === 'array') {
                    const scope = domain ? 2 : 1;
                    if (!plain(value) || ((visited.get(value) || 0) & scope) || Object.hasOwn(value, '$$typeof')) return;
                    visited.set(value, (visited.get(value) || 0) | scope);
                }
                if (key && (safeField(key) || (domain && (ordinaryField(key) || key === '[entry]'))) && key !== 'children') {
                    const field = {path, type};
                    if (!terminal && type === 'string' && /(?:title|name|status|state|platform|provider|drm|keytype|deliverymethod)$/.test(normalizeField(key)) && label(value) !== '[redacted]') field.label = label(value);
                    if (!terminal && (type === 'string' || type === 'number') && (/^(?:id|(?:content|entitlement|keyslot|product|subscriptionentitlement|purchase|bundle|provider|platform)id)$/.test(normalizeField(key)) || (domain && /(?:id|identifier)$/.test(normalizeField(key))))) {
                        field.alias = alias(value);
                        if (type === 'string' && routeIds.has(value.toLowerCase())) field.matchesRouteUUID = true;
                        if (value === result.route.uuid) field.matchesCurrentRouteUUID = true;
                    }
                    if (!terminal && type === 'number' && Number.isFinite(value) && value >= 0 && value <= 1000000 && /^(?:page|pages|pagesize|pagecount|totalpages|totalcount|currentpage|perpage|pageindex|pagenumber|limit|offset|total|count|totalitems|supportedsizes)$/.test(normalizeField(key))) field.value = value;
                    const identity = JSON.stringify(field);
                    if (!seen.has(identity)) { seen.add(identity); fields.push(field); }
                }
                if (terminal) return;
                if (type === 'array') {
                    for (let index = 0; index < Math.min(own(value, 'length'), 12); index++) {
                        const descriptor = Object.getOwnPropertyDescriptor(value, index);
                        if (descriptor && Object.hasOwn(descriptor, 'value')) visit(descriptor.value, `${path}[]`, key, depth + 1, domain);
                    }
                }
                else if (type === 'object' && value) {
                    const names = Object.keys(value).slice(0, 100);
                    const dictionary = domain && (/(?:map|dictionary|lookup|byid|bykey|byname|byprovider|byplatform)$/.test(normalizeField(key))
                        || (!/^(?:entitlement|entitlements|pageinfo|pagination|paging)$/.test(normalizeField(key)) && names.length > 0 && names.every(name => !safeField(name) && plain(own(value, name)))));
                    for (const name of names.sort((left, right) => propPriority(right) - propPriority(left))) {
                        if ((!domain && (sensitiveField(name) || name === 'key' || name === 'type')) || ['_owner', 'return', 'child', 'sibling', 'stateNode', 'memoizedState', 'ref', 'elementType'].includes(name)) continue;
                        const descriptor = Object.getOwnPropertyDescriptor(value, name);
                        if (!descriptor || !Object.hasOwn(descriptor, 'value')) continue;
                        const item = descriptor.value;
                        if (!domain && !safeField(name) && !plain(item)) continue;
                        const named = !dictionary && (safeField(name) || (domain && ordinaryField(name)));
                        const childDomain = plain(item) && /^(?:entitlement|entitlements|pageinfo|pagination|paging)$/.test(normalizeField(name)) ? normalizeField(name) : domain;
                        visit(item, domain ? `${path}${named ? `.${name}` : '[entry]'}` : fieldPath(path, name), named ? name : (domain ? '[entry]' : name), depth + 1, childDomain, Boolean(domain && (sensitiveField(name) || name === 'key')));
                    }
                }
            };
            visit(props);
            return fields;
        };
        if (root) {
            const targets = [];
            const addTargets = (kind, elements) => { for (const [index, node] of elements.entries()) if (targets.length < 40) targets.push({kind, index, node}); };
            addTargets('pagination', paginationNodes);
            addTargets('content-link', [...root.querySelectorAll('a[href]')].filter(node => route(node.getAttribute('href')).kind === 'content').slice(0, 20));
            addTargets('product-card', [...root.querySelectorAll('[data-testid="product-card"]')].slice(0, 10));
            addTargets('accordion-row', [...root.querySelectorAll('.flex.flex-col.border-0')].slice(0, 10));
            const componentIds = new Map();
            for (const {kind, index, node} of targets) {
                const target = {kind, index, ancestry: []};
                if (kind === 'content-link') target.route = route(node.getAttribute('href'));
                const fiberKey = Object.getOwnPropertyNames(node).find(key => key.startsWith('__reactFiber$'));
                let fiber = fiberKey ? own(node, fiberKey) : null;
                const seen = new Set();
                for (let depth = 0; fiber && depth < 16 && !seen.has(fiber); depth++, fiber = own(fiber, 'return')) {
                    seen.add(fiber);
                    const tag = own(fiber, 'tag');
                    const ancestor = {depth, kind: [0, 1, 2, 11, 14, 15, 16].includes(tag) ? 'component' : 'host'};
                    if (ancestor.kind === 'component') {
                        if (!componentIds.has(fiber) && client.components.length < 80) {
                            const fields = propSchema(own(fiber, 'memoizedProps'));
                            const component = {id: client.components.length, fields};
                            componentIds.set(fiber, fields.length ? component.id : null);
                            if (fields.length) client.components.push(component);
                        }
                        if (componentIds.get(fiber) !== null && componentIds.has(fiber)) ancestor.component = componentIds.get(fiber);
                    }
                    target.ancestry.push(ancestor);
                }
                client.targets.push(target);
            }
            let remaining = 160;
            const priority = component => (component.fields.some(field => field.value !== undefined) ? 1000 : 0) + component.fields.filter(field => field.alias).length;
            for (const component of [...client.components].sort((left, right) => priority(right) - priority(left))) {
                component.fields = component.fields.slice(0, remaining); remaining -= component.fields.length;
            }
        }
        return result;
    }
    if (typeof module === 'object' && module.exports) module.exports = {collectLibraryDiagnostics};
    else console.log(JSON.stringify(collectLibraryDiagnostics(document, location, typeof performance === 'object' ? performance : null), null, 2));
})();
