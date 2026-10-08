    // Rarities first (6.56, reworked 6.56.1) - the part inside the inventory frame. In 12e every
    // category opens on one tile per rarity; a click on a tile switches the game's own rarity
    // filter (since game build 16553fb, inventoryFilters.js), which also pages through that
    // rarity alone. The tiles need numbers the page does not show - borders, trails, auras,
    // indicators and wreaths draw only 12 cards at a time - so they are counted here, from the
    // whole list as it comes from the server, and handed to 12e as data-mcfo-rarinfo on <html>
    // (the one thing the frame's page and the script in the top window share). Read only:
    // the answer goes on to the game unchanged.
    const INV_RAR_MODULE = { 'marble-trails': 'marble_trails', 'marble-borders': 'marble_borders',
        'rebellion-auras': 'rebellion_aura_style', 'bidding-indicators': 'bidding_indicator_style', 'wreaths': 'wreaths' };
    // The game's own reading (inventoryFilters.js): no rarity is "default" - No Treatment, No Crown, Basic ...
    const invRarToken = i => String((i && i.rarity) || 'default').trim().toLowerCase() || 'default';
    // The page a list belongs to, or null. main: the list itself, not one of its sub-paths.
    function invRarTarget(url) {
        const m = url.pathname.match(/^\/api\/inventory\/([a-z-]+)(\/.*)?$/);
        if (!m) return null;
        const main = !m[2] || m[2] === '/';
        if (m[1] === 'crowns') return { page: 'crowns', main };
        if (m[1] === 'chat-font-colors') return { page: 'chat_font_colors', main };
        if (m[1] === 'chat-cosmetics') return { page: url.searchParams.get('slotType') || '', main };
        if (INV_RAR_MODULE[m[1]]) return { page: INV_RAR_MODULE[m[1]], main };
        return null;
    }
    function invRarInfo(page, d) {
        const items = d.items || d.availableCrownItems || d.availableItems || [];
        const eq = d.equipment || {};
        const sel = new Set([eq.inventoryItemId, d.selectedInventoryItemId, d.ordinarySelectedInventoryItemId, d.kingSelectedInventoryItemId]
            .filter(Boolean).map(String));
        const pool = new Set((eq.poolItemIds || d.randomPoolInventoryItemIds || []).map(String));
        const groups = new Map();
        let total = 0;
        for (const i of items) {
            const r = invRarToken(i);
            const g = groups.get(r) || { r, n: 0, sel: false, pool: 0 };
            const id = String((i && i.inventoryItemId) || '');
            g.n++;
            if (!(i && i.systemDefault)) total++;   // "N owned" leaves No Treatment out, as the game does
            if (sel.has(id)) g.sel = true;
            if (pool.has(id)) g.pool++;
            groups.set(r, g);
        }
        // A chat slot with nothing chosen wears its No Treatment (No Crown has an id of its own).
        const blank = 'ordinarySelectedInventoryItemId' in d || 'kingSelectedInventoryItemId' in d
            ? !d.ordinarySelectedInventoryItemId || !d.kingSelectedInventoryItemId
            : 'availableItems' in d && !d.selectedInventoryItemId;
        const def = groups.get('default');
        if (blank && def && items.some(i => i && i.systemDefault)) def.sel = true;
        return { page, total, groups: [...groups.values()] };
    }
    function invRarityTap() {
        const pw = (typeof unsafeWindow !== 'undefined' && unsafeWindow) || window;
        const innerFetch = pw.fetch;   // the crown list cache's, when it is installed
        if (typeof innerFetch !== 'function') return;
        const html = document.documentElement;
        const last = new Map();        // page -> the whole list, last seen
        const info = (page, d) => { try { html.setAttribute('data-mcfo-rarinfo', JSON.stringify(invRarInfo(page, d))); } catch (e) {} };
        pw.fetch = function (input, init) {
            let url, method;
            try {
                url = new URL(typeof input === 'string' ? input : String((input && input.url) || ''), pw.location.href);
                method = String((init && init.method) || (input && typeof input === 'object' && input.method) || 'GET').toUpperCase();
            } catch (e) { return innerFetch.apply(this, arguments); }
            const t = url.origin === pw.location.origin ? invRarTarget(url) : null;
            const live = innerFetch.apply(this, arguments);
            if (!t) return live;
            if (method !== 'GET' || !t.main) {
                // Equip / pool on a marble page: the game keeps its list and takes the new equipment
                // from the answer - the counts follow it.
                const d = last.get(t.page);
                if (d) live.then(res => (res.ok ? res.clone().json() : null)).then(b => {
                    if (b && b.equipment) { const n = { ...d, equipment: b.equipment }; last.set(t.page, n); info(t.page, n); }
                }).catch(() => {});
                return live;
            }
            // The game also fetches other lists for its previews (a border page asks for the trails):
            // only the list of the page on show counts.
            const current = new URLSearchParams(pw.location.search).get('page') || 'crowns';
            if (t.page === current) live.then(res => (res.ok ? res.clone().json() : null)).then(d => {
                if (d && typeof d === 'object') { last.set(t.page, d); info(t.page, d); }
            }).catch(() => {});
            return live;
        };
    }

