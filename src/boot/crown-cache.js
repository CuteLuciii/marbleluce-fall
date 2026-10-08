    // =========================================================================================
    // 0a. CROWN LIST CACHE (6.53) - the one part that also runs inside the inventory frame
    // =========================================================================================
    // Every click on Crowns waits 2-3 s on "Loading inventory": /api/inventory/crowns answers with
    // the whole recipe of every crown (1.1 MB for 52 crowns, uncompressed, no-store), the other
    // categories with 10-20 KB. The pictures are not the problem - the game keeps them in its
    // own Cache Storage (mcf-crown-thumbnails-*).
    //
    // So the list is kept as well: the page gets the last list at once, and the real request runs
    // behind it. Same answer: nothing happens. Different (bought a crown, the bot or a loadout
    // changed something): the page is loaded again, and then shows the fresh list. Any change made
    // here (equip, pool, random) throws the kept list away first, so the list the game fetches
    // right after it always comes from the server - exactly as before. This runs at
    // document-start in the frame, before the game's module asks for the list.
    const INV_CACHE = 'mcfo-inventory-v1';
    const INV_CACHE_KEY = '/__mcfo-cache/inventory/crowns';
    const INV_CACHE_MAX_AGE = 7 * 24 * 3600 * 1000;
    let invCacheGen = 0;
    function invCacheDrop(win) {
        invCacheGen++;
        try { return win.caches.open(INV_CACHE).then(c => c.delete(INV_CACHE_KEY)).catch(() => {}); } catch (e) { return Promise.resolve(); }
    }
    function invListCache() {
        const pw = (typeof unsafeWindow !== 'undefined' && unsafeWindow) || window;
        const nativeFetch = pw.fetch;
        if (typeof nativeFetch !== 'function' || !pw.caches) return;
        // What the page shows from the list - the rest of the 1.1 MB does not change by itself.
        const sig = txt => {
            try {
                const d = JSON.parse(txt);
                return JSON.stringify([d.playerId, d.selectedInventoryItemId, d.randomEnabled, d.randomPoolInventoryItemIds,
                    (d.availableCrownItems || []).map(i => i && i.inventoryItemId)]);
            } catch (e) { return 'x' + txt.length; }
        };
        const store = (txt, gen) => {
            if (gen !== invCacheGen) return Promise.resolve();   // a change was made meanwhile: this list is old
            return pw.caches.open(INV_CACHE).then(c => c.put(INV_CACHE_KEY, new pw.Response(txt,
                { headers: { 'Content-Type': 'application/json', 'X-Mcfo-At': String(Date.now()) } }))).catch(() => {});
        };
        pw.fetch = function (input, init) {
            let url, method;
            try {
                url = new URL(typeof input === 'string' ? input : String((input && input.url) || ''), pw.location.href);
                method = String((init && init.method) || (input && typeof input === 'object' && input.method) || 'GET').toUpperCase();
            } catch (e) { return nativeFetch.apply(this, arguments); }
            if (url.origin !== pw.location.origin || !url.pathname.startsWith('/api/inventory/crowns')) return nativeFetch.apply(this, arguments);
            const self = this, args = arguments;
            const live = () => nativeFetch.apply(self, args);
            if (method !== 'GET' || url.search || !/^\/api\/inventory\/crowns\/?$/.test(url.pathname)) {
                return invCacheDrop(pw).then(live);   // a change - the next list must come from the server
            }
            const gen = invCacheGen;
            return pw.caches.open(INV_CACHE).then(c => c.match(INV_CACHE_KEY)).then(hit => {
                const at = hit ? Number(hit.headers.get('X-Mcfo-At')) || 0 : 0;
                if (!hit || Date.now() - at > INV_CACHE_MAX_AGE) {
                    return live().then(res => { if (res.ok) res.clone().text().then(t => store(t, gen)); return res; });
                }
                return hit.text().then(old => {
                    live().then(res => (res.ok ? res.text() : null)).then(fresh => {
                        if (!fresh || gen !== invCacheGen) return;
                        store(fresh, gen).then(() => {
                            if (sig(fresh) !== sig(old) && gen === invCacheGen) {
                                console.log('[MarbleLuceFall] crown list changed on the server - loading the inventory again');
                                pw.location.reload();
                            }
                        });
                    }).catch(() => {});
                    return new pw.Response(old, { status: 200, headers: { 'Content-Type': 'application/json' } });
                });
            }).catch(() => live());
        };
    }
