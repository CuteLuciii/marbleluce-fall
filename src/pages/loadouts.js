    // =========================================================================================
    // 12e. LOADOUTS: WHAT YOU WEAR, SAVED AND PUT BACK ON (6.31)
    // =========================================================================================
    // Every slot of the inventory works the same way in the game's own pages (inventory.js,
    // marbleTrails/ and marbleBorders/inventoryPage.js): GET reads the choice, POST .../selected
    // equips. Crowns, trails and borders add a random mode and a pool (random-pool/<id>, POST in,
    // DELETE out, at most 10). A loadout stores the exact item, by inventoryItemId: two items of
    // the same name need not look alike. An item that is gone is skipped, never swapped for a
    // namesake.
    // The code is shared with the MarbleMind Discord bot: "MLF-LOADOUT-1:" + base64url(JSON),
    // { v: 1, name, player, slots: { <slot>: { sel, selName, random?, pool? } } }. Base64 because
    // phone keyboards turn straight quotes into curly ones and raw JSON would arrive broken.
    // The slot keys below are the bot's; change both sides together.
    const LO_STORE = 'mcfo_loadouts';     // { <playerId>: { <name, lower case>: { name, savedAt, player, slots } } }
    const LO_PREFIX = 'MLF-LOADOUT-1:';
    const loBlank = id => !id || String(id).startsWith('system_no_chat_treatment:');
    const loMarble = (label, base) => ({
        label, source: base, random: true,
        read: d => { const e = d.equipment || {};
                     return { items: d.items || [], sel: e.selectedInventoryItemId ?? e.inventoryItemId ?? null,
                              random: !!e.randomEnabled, pool: e.poolItemIds || [] }; },
        pick: id => [base + '/selected', { inventoryItemId: id || null }],
        poolPath: id => base + '/random-pool/' + encodeURIComponent(id),
        randomPath: base + '/random-enabled',
    });
    const loChat = (label, slotType) => ({
        label, source: '/api/inventory/chat-cosmetics?slotType=' + slotType,
        read: d => ({ items: d.availableItems || [], sel: loBlank(d.selectedInventoryItemId) ? null : d.selectedInventoryItemId }),
        pick: id => ['/api/inventory/chat-cosmetics/selected', { slotType, inventoryItemId: id || null }],
    });
    // Royal titles and default tolls (game v0.10.1f): one list of items, one pick per occasion
    // ("contexts": chat / throne / celebration, throne capture / celebration start / end), set with
    // POST .../selected { slotType, inventoryItemId }. There is no "none": every occasion always has a pick.
    const loContext = (label, base, slotType) => ({
        label, source: base, context: true,
        read: d => { const c = (d.contexts || []).find(x => x.slotType === slotType);
                     return { items: d.availableItems || [], sel: (c && (c.selectedInventoryItemId ?? c.inventoryItemId)) || null }; },
        pick: id => [base + '/selected', { slotType, inventoryItemId: id }],
    });
    const LO_SLOTS = {
        krone: { label: 'Crown', source: '/api/inventory/crowns', random: true,
                 read: d => ({ items: d.availableCrownItems || [], sel: d.selectedInventoryItemId || 'system_no_crown',
                               random: !!d.randomEnabled, pool: d.randomPoolInventoryItemIds || [] }),
                 pick: id => ['/api/inventory/crowns/selected', { inventoryItemId: id || 'system_no_crown' }],
                 poolPath: id => '/api/inventory/crowns/random-pool/' + encodeURIComponent(id),
                 randomPath: '/api/inventory/crowns/random-enabled' },
        farbe: { label: 'Chat colour', source: '/api/inventory/chat-font-colors',
                 read: d => { const v = d.ordinarySelectedInventoryItemId ?? d.selectedInventoryItemId;
                              return { items: d.availableItems || [], sel: loBlank(v) ? null : v }; },
                 pick: id => ['/api/inventory/chat-font-colors/ordinary-selected', { inventoryItemId: id || null }] },
        farbeKing: { label: 'Chat colour as King', source: '/api/inventory/chat-font-colors',
                 read: d => ({ items: d.availableItems || [], sel: loBlank(d.kingSelectedInventoryItemId) ? null : d.kingSelectedInventoryItemId }),
                 pick: id => ['/api/inventory/chat-font-colors/king-selected', { inventoryItemId: id || null }] },
        chat:   loChat('Chat background', 'chat_background_style'),
        namen:  loChat('Username style', 'username_style'),
        blase:  loChat('King chat bubble', 'king_chat_bubble_style'),
        trail:  loMarble('Marble trail', '/api/inventory/marble-trails'),
        border: loMarble('Marble border', '/api/inventory/marble-borders'),
        // Bidding indicators (game v0.10.2): same equipment shape as borders - the game even draws
        // their inventory page with the border page's code (data-border-card-id, /selected,
        // /random-pool, /random-enabled), so the border slot type fits as is.
        indikator: loMarble('Bidding indicator', '/api/inventory/bidding-indicators'),
        // Wreaths (game v0.10.3) and rebellion auras (v0.10.4): the game draws both inventory pages
        // with the same marble-style code (renderMarbleStyleInventory), so /selected, /random-pool
        // and /random-enabled work the same way. Keys shared with the bot's /loadout.
        kranz: loMarble('Wreath', '/api/inventory/wreaths'),
        aura:  loMarble('Rebellion aura', '/api/inventory/rebellion-auras'),
        titelChat:  loContext('Title in chat', '/api/inventory/royal-titles', 'royal_title_chat'),
        titelThron: loContext('Title on the throne', '/api/inventory/royal-titles', 'royal_title_throne'),
        titelFeier: loContext('Title in celebrations', '/api/inventory/royal-titles', 'royal_title_celebration'),
        tollThron:  loContext('Toll on throne capture', '/api/inventory/default-tolls', 'default_toll_throne'),
        tollFeier:  loContext('Toll at celebration start', '/api/inventory/default-tolls', 'default_toll_celebration'),
        tollEnde:   loContext('Toll at celebration end', '/api/inventory/default-tolls', 'default_toll_completed'),
    };
    const lo = { player: null, busy: false, status: '', draft: { name: '', code: '', as: '' } };   // drafts survive the redraws

    function loAll() {
        try { return JSON.parse(localStorage.getItem(LO_STORE) || '{}') || {}; } catch (e) { return {}; }
    }
    function loMine() { return (lo.player && loAll()[lo.player]) || {}; }
    function loPut(key, value) {
        const all = loAll();
        const mine = all[lo.player] || (all[lo.player] = {});
        if (value) mine[key] = value; else delete mine[key];
        try { localStorage.setItem(LO_STORE, JSON.stringify(all)); } catch (e) { /* storage full or blocked */ }
    }
    function loItemName(items, id) {
        if (!id) return 'Default';
        const it = items.find(i => String(i.inventoryItemId) === String(id));
        return (it && (it.displayName || it.definitionId)) || '?';
    }
    async function loFetch(path, method, body) {
        if (method && method !== 'GET' && String(path).startsWith('/api/inventory/crowns')) await invCacheDrop(window);   // 0a
        const r = await fetch(path, {
            method: method || 'GET', credentials: 'include',
            headers: body ? { 'Content-Type': 'application/json', Accept: 'application/json' } : { Accept: 'application/json' },
            body: body ? JSON.stringify(body) : undefined,
        });
        let data = null;
        try { data = await r.json(); } catch (e) { /* not JSON */ }
        return { ok: r.ok && !(data && data.ok === false), status: r.status, data };
    }
    // One request per source: the chat colour serves two slots.
    async function loState() {
        const cache = new Map(), out = {};
        for (const [key, s] of Object.entries(LO_SLOTS)) {
            if (!cache.has(s.source)) cache.set(s.source, await loFetch(s.source).catch(e => ({ ok: false, status: 0, data: null, err: e.message })));
            const r = cache.get(s.source);
            out[key] = r.ok && r.data ? s.read(r.data) : { error: (r.data && r.data.error) || r.err || 'HTTP ' + r.status };
            const pid = r.data && (r.data.playerId || (r.data.player && r.data.player.playerId));
            if (pid && !lo.player) lo.player = String(pid);
        }
        return out;
    }
    async function loSave(name) {
        const state = await loState();
        if (!lo.player) throw new Error('Not signed in.');
        const slots = {}, failed = [];
        for (const [key, st] of Object.entries(state)) {
            if (st.error) { failed.push(LO_SLOTS[key].label); continue; }
            slots[key] = { sel: st.sel ?? null, selName: loItemName(st.items, st.sel) };
            if (LO_SLOTS[key].random) Object.assign(slots[key], { random: st.random, pool: st.pool, poolNames: st.pool.map(id => loItemName(st.items, id)) });
        }
        // Nothing readable, nothing saved: a server hiccup must not overwrite a good loadout.
        if (!Object.keys(slots).length) throw new Error('The inventory did not answer.');
        loPut(name.toLowerCase(), { name, savedAt: Date.now(), player: lo.player, slots });
        return failed;
    }
    // Only what differs is sent. Per slot: pool first (out before in, the pool holds ten), then
    // the pick, random on or off last, so the end state is the saved one whatever the game pulls
    // along. With random saved the pick is left alone: the game draws it anew every run.
    async function loLoad(saved) {
        const state = await loState();
        const lines = [];
        let changed = 0;
        for (const [key, want] of Object.entries(saved.slots || {})) {
            const s = LO_SLOTS[key], have = state[key];
            if (!s) continue;
            if (!have || have.error) { lines.push(['warn', s.label + ': could not be read']); continue; }
            const there = new Set(have.items.map(i => String(i.inventoryItemId)));
            const steps = [], missing = [];
            if (s.random && Array.isArray(want.pool)) {
                const pool = want.pool.filter(id => there.has(String(id)));
                missing.push(...want.pool.filter(id => !there.has(String(id))));
                const havePool = new Set(have.pool.map(String));
                for (const id of have.pool) if (!pool.includes(id)) steps.push([s.poolPath(id), {}, 'DELETE']);
                for (const id of pool) if (!havePool.has(String(id))) steps.push([s.poolPath(id), {}, 'POST']);
            }
            if ((!s.random || !want.random) && String(want.sel ?? '') !== String(have.sel ?? '') && (want.sel || !s.context)) {
                if (want.sel && !there.has(String(want.sel))) missing.push(want.sel);
                else steps.push([...s.pick(want.sel), 'POST']);
            }
            if (s.random && want.random !== undefined && !!want.random !== !!have.random) steps.push([s.randomPath, { enabled: !!want.random }, 'POST']);
            const gone = missing.length ? ` (${missing.length} item${missing.length > 1 ? 's' : ''} no longer in your inventory)` : '';
            if (!steps.length) { lines.push([missing.length ? 'warn' : 'same', loSlotText(key, want) + gone]); continue; }
            let failed = null;
            for (const [path, body, method] of steps) {
                const r = await loFetch(path, method, body).catch(e => ({ ok: false, status: 0, data: null, err: e.message }));
                if (!r.ok) { failed = (r.data && r.data.error) || r.err || 'HTTP ' + r.status; break; }
            }
            if (failed) lines.push(['error', s.label + ': ' + failed]);
            else { changed++; lines.push([missing.length ? 'warn' : 'done', loSlotText(key, want) + gone]); }
        }
        if (changed) loRefreshInventory();
        return { lines, changed };
    }
    function loSlotText(key, v) {
        const label = (LO_SLOTS[key] && LO_SLOTS[key].label) || key;
        if (v.random) return `${label}: random from ${(v.pool || []).length}`;
        return `${label}: ${v.selName || 'Default'}`;
    }
    // An open Inventory window still shows the old picks: it is simply loaded again.
    function loRefreshInventory() {
        const w = windows.get('/inventory');
        try {
            if (w && w.frame && w.frame.contentWindow) w.frame.contentWindow.location.reload();
            else if (document.getElementById('inventory-root')) location.reload();
        } catch (e) { /* not there yet */ }
    }
    function loB64(text) {
        const bytes = new TextEncoder().encode(text);
        let bin = '';
        for (const b of bytes) bin += String.fromCharCode(b);
        return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }
    function loUnB64(text) {
        let t = text.replace(/-/g, '+').replace(/_/g, '/');
        while (t.length % 4) t += '=';
        return new TextDecoder().decode(Uint8Array.from(atob(t), c => c.charCodeAt(0)));
    }
    function loCode(saved) {
        const slots = {};
        for (const [k, v] of Object.entries(saved.slots || {})) {
            slots[k] = { sel: v.sel ?? null, selName: v.selName || null };
            if (v.random !== undefined) slots[k].random = !!v.random;
            if (Array.isArray(v.pool)) slots[k].pool = v.pool;
        }
        return LO_PREFIX + loB64(JSON.stringify({ v: 1, name: saved.name, player: saved.player || null, slots }));
    }
    // Takes the code with code-block fences, spaces or line breaks around it, as Discord hands it over.
    function loReadCode(text) {
        const m = String(text || '').replace(/\s+/g, '').match(/MLF-LOADOUT-1:([A-Za-z0-9_\-+/=]+)/);
        if (!m) throw new Error('That is not a loadout code (it starts with MLF-LOADOUT-1:).');
        let j;
        try { j = JSON.parse(loUnB64(m[1])); } catch (e) { throw new Error('The code is incomplete or damaged.'); }
        if (!j || j.v !== 1 || !j.slots || typeof j.slots !== 'object') throw new Error('Unknown code version.');
        const slots = {};
        for (const [k, v] of Object.entries(j.slots)) {
            if (!LO_SLOTS[k] || !v || typeof v !== 'object') continue;
            slots[k] = { sel: v.sel == null ? null : String(v.sel), selName: v.selName ? String(v.selName).slice(0, 80) : null };
            if (LO_SLOTS[k].random && v.random !== undefined) slots[k].random = !!v.random;
            if (LO_SLOTS[k].random && Array.isArray(v.pool)) slots[k].pool = v.pool.slice(0, 10).map(String);
        }
        if (!Object.keys(slots).length) throw new Error('The code holds no known slot.');
        return { name: String(j.name || '').trim().slice(0, 40), player: j.player ? String(j.player) : null, slots };
    }
    // Checked against this account's inventory: a code from another player is refused (the item
    // ids exist once), names are filled in, missing items counted but kept - one may come back.
    async function loImport(code, name) {
        const state = await loState();
        if (!lo.player) throw new Error('Not signed in.');
        if (code.player && code.player !== lo.player) throw new Error('This code belongs to another player account. Items always belong to exactly one account.');
        let missing = 0;
        for (const [k, v] of Object.entries(code.slots)) {
            const have = state[k];
            if (!have || have.error) continue;
            const there = new Set(have.items.map(i => String(i.inventoryItemId)));
            if (v.sel && !there.has(v.sel)) missing++;
            const known = loItemName(have.items, v.sel);
            v.selName = v.sel ? (known !== '?' ? known : (v.selName || '?')) : 'Default';
            if (v.pool) { v.poolNames = v.pool.map(id => loItemName(have.items, id)); missing += v.pool.filter(id => !there.has(id)).length; }
        }
        loPut(name.toLowerCase(), { name, savedAt: Date.now(), player: lo.player, slots: code.slots });
        return missing;
    }
    async function loCopy(text) {
        try { await navigator.clipboard.writeText(text); return true; } catch (e) { /* fall back below */ }
        const t = document.createElement('textarea');
        t.value = text; t.style.cssText = 'position:fixed;left:-9999px;top:0';
        document.body.appendChild(t); t.select();
        let ok = false;
        try { ok = document.execCommand('copy'); } catch (e) { /* nothing */ }
        t.remove();
        return ok;
    }

    // --- In the inventory (6.32): a loadout bar above the game's inventory, and while a new
    // loadout is being built, buttons on every item card. Building never equips anything: the
    // picks only go into the draft, across all inventory pages, until Save. A slot left out of a
    // loadout stays as it is when the loadout is put on, so a loadout can be just trail and border.
    // The game redraws its cards with innerHTML all the time; the bar therefore sits beside the
    // root (never inside it), and the card buttons are set again after every redraw.
    const LO_DRAFT = 'mcfo_lo_draft';
    const LO_STATUS = 'mcfo_lo_status';
    // Inventory sub-page -> the slots its cards can fill. Pages not listed (shields, king tile
    // backgrounds ...) get no buttons: they are not part of a loadout yet.
    const LO_PAGES = {
        crowns:                 [['krone', 'Loadout'], ['krone', 'Pool', 'pool']],
        chat_font_colors:       [['farbe', 'Chat'], ['farbeKing', 'As King']],
        chat_background_style:  [['chat', 'Loadout']],
        username_style:         [['namen', 'Loadout']],
        king_chat_bubble_style: [['blase', 'Loadout']],
        marble_trails:          [['trail', 'Loadout'], ['trail', 'Pool', 'pool']],
        marble_borders:         [['border', 'Loadout'], ['border', 'Pool', 'pool']],
        bidding_indicator_style: [['indikator', 'Loadout'], ['indikator', 'Pool', 'pool']],
        rebellion_aura_style:   [['aura', 'Loadout'], ['aura', 'Pool', 'pool']],
        wreaths:                [['kranz', 'Loadout'], ['kranz', 'Pool', 'pool']],
        royal_title:            [['titelChat', 'Chat'], ['titelThron', 'Throne'], ['titelFeier', 'Celebration']],
        default_toll:           [['tollThron', 'Throne'], ['tollFeier', 'Celeb. start'], ['tollEnde', 'Celeb. end']],
    };
    const LO_NONE = { marble_trails: ['trail', 'No trail'], marble_borders: ['border', 'No border'],
                      bidding_indicator_style: ['indikator', 'No indicator'],
                      rebellion_aura_style: ['aura', 'Default aura'], wreaths: ['kranz', 'No wreath'] };
    const loDocs = new Set();
    let loUi = { mode: '', confirm: null, pick: '' };   // mode: '' | 'save' | 'import'

    function loDraft() {
        try { return JSON.parse(localStorage.getItem(LO_DRAFT) || 'null'); } catch (e) { return null; }
    }
    function loSetDraft(d) {
        try { if (d) localStorage.setItem(LO_DRAFT, JSON.stringify(d)); else localStorage.removeItem(LO_DRAFT); } catch (e) { /* blocked */ }
        loRedraw();
    }
    // The status survives the inventory being reloaded after Put on.
    function loSay(html, tone) {
        try { sessionStorage.setItem(LO_STATUS, JSON.stringify({ html, tone: tone || '', at: Date.now() })); } catch (e) { /* blocked */ }
        loRedraw();
    }
    function loStatus() {
        try { const s = JSON.parse(sessionStorage.getItem(LO_STATUS) || 'null'); return s && Date.now() - s.at < 5 * 60 * 1000 ? s : null; } catch (e) { return null; }
    }
    const loEsc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
    // --- On the Current Points card (6.35) ---
    // The saved loadouts as a menu; one click puts one on, the result comes as a short notice.
    // The last one put on this way carries a tick — a reminder, not a check of what you wear.
    const LO_LAST = 'mcfo_lo_last';
    // Opens at once (6.37.1). It used to wait for the player id first — a fetch of the crown
    // inventory, a second or two on a busy evening — so the first click seemed to do nothing,
    // and a second click in that time opened it and closed it again straight after.
    function showLoadoutMenu(anchor) {
        const menu = showPanel(anchor, 'mcfo-menu--lo', m => {
            m.innerHTML = '<div class="mcfo-lo__head">Put on a loadout</div><div class="mcfo-lo__empty">Loading \u2026</div>';
        });
        if (!menu) return;   // a second click on the card: showPanel closed it
        const fill = () => {
            if (!menu.isConnected) return;
            let last = '';
            try { last = localStorage.getItem(LO_LAST) || ''; } catch (e) { /* blocked */ }
            const list = Object.values(loMine()).sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
            menu.querySelector('.mcfo-lo__empty')?.remove();
            if (!list.length) {
                const p = document.createElement('div');
                p.className = 'mcfo-lo__empty';
                p.textContent = 'No loadouts saved yet. Save what you wear in the inventory, on the Loadouts bar.';
                menu.appendChild(p);
            }
            for (const l of list) {
                const b = document.createElement('button');
                b.type = 'button';
                b.className = 'mcfo-lo__item';
                if (l.name.toLowerCase() === last) b.setAttribute('data-mcfo-last', '1');
                const n = Object.keys(l.slots || {}).length;
                b.innerHTML = `<b>${loEsc(l.name)}</b><small>${n} slot${n === 1 ? '' : 's'}</small>`;
                b.disabled = lo.busy;
                b.addEventListener('click', ev => { ev.stopPropagation(); closeMenus(); loQuickPutOn(l); });
                menu.appendChild(b);
            }
            menu.appendChild(document.createElement('hr'));
            const inv = document.createElement('button');
            inv.type = 'button';
            inv.textContent = 'Manage loadouts \u2026';
            inv.addEventListener('click', ev => { ev.stopPropagation(); closeMenus(); openPage('/inventory', 'Inventory'); });
            menu.appendChild(inv);
            placePanel(anchor, menu);   // the height is only known now
        };
        if (loPlayerNow()) { fill(); return; }
        loKnowPlayer().then(fill).catch(e => {
            const p = menu.isConnected && menu.querySelector('.mcfo-lo__empty');
            if (p) p.textContent = e.message || String(e);
        });
    }
    async function loQuickPutOn(l) {
        if (lo.busy) return;
        lo.busy = true; loRedraw();
        try {
            const r = await loLoad(l);
            try { localStorage.setItem(LO_LAST, l.name.toLowerCase()); } catch (e) { /* blocked */ }
            const bad = r.lines.filter(([t]) => t === 'warn' || t === 'error');
            notice(`<b>${loEsc(l.name)}</b> put on, ${r.changed} slot${r.changed === 1 ? '' : 's'} changed.`
                + (bad.length ? ' ' + bad.map(([, x]) => loEsc(x)).join(' · ') : ''), bad.some(([t]) => t === 'error') ? 'error' : '');
            loSay(`<b>${loEsc(l.name)}</b> put on, ${r.changed} slot${r.changed === 1 ? '' : 's'} changed.`, bad.length ? 'warn' : 'done');
        } catch (e) {
            notice(loEsc(e.message || e), 'error');
        }
        lo.busy = false; loRedraw();
    }
    async function loRun(job) {
        if (lo.busy) return;
        lo.busy = true; loRedraw();
        try { await job(); } catch (e) { loSay(loEsc(e.message || e), 'error'); }
        lo.busy = false; loRedraw();
    }
    // The dailies (12d) are read at start-up anyway and name the viewer — the same id the
    // inventory answers with, without asking the inventory.
    function loPlayerNow() {
        const viewer = daily.data && daily.data.viewer && daily.data.viewer.playerId;
        if (!lo.player && viewer) lo.player = String(viewer);
        return lo.player;
    }
    async function loKnowPlayer() {
        if (loPlayerNow()) return lo.player;
        const r = await loFetch('/api/inventory/crowns');
        if (r.data && r.data.playerId) lo.player = String(r.data.playerId);
        if (!lo.player) throw new Error('Sign in to use loadouts.');
        return lo.player;
    }
    function loRedraw() {
        for (const doc of [...loDocs]) {
            if (!doc.defaultView || !doc.getElementById('inventory-root')) { loDocs.delete(doc); continue; }
            loDrawBar(doc);
            loDecorate(doc);
        }
    }

    // Rarities first (6.56, reworked 6.56.1). A category of the inventory opens on one tile per
    // rarity - name, count, whether the equipped item and pool items are in it - and a click on a
    // tile shows that rarity's items, with "Rarities" to go back. Since build 16553fb the game
    // has a rarity filter of its own (a select above the cards, inventoryFilters.js): it hides
    // the other cards, or on the marble pages pages through that rarity alone, and keeps the
    // equipped name and the preview right. The tiles simply turn that select, so the game's
    // filter state IS the view: no rarity = the tiles. Items without a rarity (No Treatment,
    // No Crown, the Basic ones) are the game's "default" and get a tile of their own, last.
    // The counts come from the frame side (0a, invRarityTap), which sees the whole list.
    const INV_RAR_LOOK = {   // tile, fill, line: the game's rarity palette (canonicalRarityPalette.js, crownPreviewStyle)
        unique: ['#4a1238', '#ff4fcf', '#ffb3ea'], exclusive: ['#2a2c31', '#f7fbff', '#ffffff'],
        cosmic: ['#111013', '#272330', '#514a61'], ethereal: ['#534351', '#c6a0c1', '#e0d2de'],
        mythic: ['#321e1d', '#992824', '#d66a66'], legendary: ['#3d3021', '#bc7824', '#e1b16b'],
        epic: ['#241a2c', '#592285', '#a862e2'], rare: ['#1c2633', '#20569d', '#5da4e1'],
        common: ['#131b14', '#214d24', '#4d8b51'], default: ['#1b2128', '#3a4654', '#8796a6'],
    };
    const INV_RAR_ORDER = Object.keys(INV_RAR_LOOK);   // the game's order: rarest first, default last
    const invRarName = r => r.charAt(0).toUpperCase() + r.slice(1);
    const invRarSelect = root => root.querySelector('.inventorySelectionPanel select[data-inventory-rarity]');
    function invRarity(doc, root) {
        const html = doc.documentElement;
        const page = loPage(doc);
        let info = null;
        try { info = JSON.parse(html.getAttribute('data-mcfo-rarinfo') || 'null'); } catch (e) {}
        const panel = root.querySelector('.inventorySelectionPanel');
        const cards = panel && panel.querySelector(':scope > .inventoryCards');
        const select = invRarSelect(root);
        const on = !!(settings.invRarityGroups && info && info.page === page && info.groups && info.groups.length && cards && select);
        const r = on ? select.value : '';
        const view = !on ? '' : r ? 'pick' : 'all';
        if ((html.getAttribute('data-mcfo-rarview') || '') !== view) {
            if (view) html.setAttribute('data-mcfo-rarview', view); else html.removeAttribute('data-mcfo-rarview');
        }
        let bar = panel && panel.querySelector(':scope > .mcfo-rar');
        if (!on) { if (bar) bar.remove(); return; }
        if (!bar) {
            bar = doc.createElement('div');
            bar.className = 'mcfo-rar';
            bar.addEventListener('click', e => {
                const b = e.target.closest && e.target.closest('[data-mcfo-rar]');
                if (b) invRarPick(doc, root, b.getAttribute('data-mcfo-rar'));
            });
        }
        if (bar.nextElementSibling !== cards) cards.before(bar);
        const groups = [...info.groups].sort((a, b) => INV_RAR_ORDER.indexOf(a.r) - INV_RAR_ORDER.indexOf(b.r));
        const g = groups.find(x => x.r === r) || { r, n: 0, sel: false, pool: 0 };
        const sig = JSON.stringify([view, r, view === 'all' ? groups : g, info.total]);
        if (bar.__mcfoSig === sig) return;
        bar.__mcfoSig = sig;
        const look = x => { const c = INV_RAR_LOOK[x] || INV_RAR_LOOK.default;
            return `--mcfo-rar-bg:${c[0]};--mcfo-rar-fill:${c[1]};--mcfo-rar-line:${c[2]}`; };
        const tags = x => `<span class="mcfo-rar__tags">${x.sel ? '<i data-tone="eq">Equipped</i>' : ''}${x.pool ? `<i>${x.pool} in pool</i>` : ''}</span>`;
        if (view === 'all') {
            bar.innerHTML = `<div class="mcfo-rar__grid">${groups.map(x => `
                <button type="button" class="mcfo-rar__tile" data-mcfo-rar="${escapeHtml(x.r)}" style="${look(x.r)}">
                    <span class="mcfo-rar__gem"></span><b>${escapeHtml(invRarName(x.r))}</b><span class="mcfo-rar__n">${x.n}</span>${tags(x)}
                </button>`).join('')}</div>`;
        } else {
            bar.innerHTML = `<div class="mcfo-rar__bar" style="${look(r)}">
                <button type="button" class="mcfo-rar__back" data-mcfo-rar="">‹ Rarities</button>
                <span class="mcfo-rar__gem"></span><b>${escapeHtml(invRarName(r))}</b><span class="mcfo-rar__of">${g.n}</span>${tags(g)}
            </div>`;
        }
    }
    function invRarPick(doc, root, r) {
        const select = invRarSelect(root);
        if (!select) return;
        if (r && ![...select.options].some(o => o.value === r)) return;
        select.value = r;
        // The game listens with select.onchange; an event made in the page's own window reaches it.
        select.dispatchEvent(new (doc.defaultView.Event)('change', { bubbles: true }));
        invRarity(doc, root);
        const list = root.querySelector('.inventorySelectionPanel > .inventoryCards');
        if (list) list.scrollTop = 0;
    }
    const INV_RAR_CSS = `
        /* the panel is a grid (header | [filters] | list as 1fr | pager): the tiles get a row of their own above the list */
        .inventorySelectionPanel:has(> .mcfo-rar) { grid-template-rows: auto auto minmax(0, 1fr) auto; row-gap: 10px; }
        html[data-mcfo-rarview=pick] .inventorySelectionPanel:has(> .mcfo-rar):has(> .inventoryFilters) { grid-template-rows: auto auto auto minmax(0, 1fr) auto; }
        .mcfo-rar { margin: 0; min-width: 0; }
        .mcfo-rar__grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }
        .mcfo-rar__tile { position: relative; display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 4px 10px;
            min-height: 74px; padding: 12px 14px; text-align: left; cursor: pointer; border-radius: 10px;
            border: 1px solid var(--mcfo-rar-line); background: linear-gradient(160deg, var(--mcfo-rar-bg), rgba(0, 0, 0, 0.35));
            color: #f2f4f7; font: 13px/1.25 system-ui, sans-serif; box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.03); }
        .mcfo-rar__tile:hover { box-shadow: 0 0 0 1px var(--mcfo-rar-line), 0 0 14px -2px var(--mcfo-rar-line); }
        .mcfo-rar__tile b { font-size: 15px; font-weight: 800; }
        .mcfo-rar__n { font: 800 20px/1 system-ui, sans-serif; color: var(--mcfo-rar-line); }
        .mcfo-rar__tile .mcfo-rar__tags { grid-column: 1 / -1; min-height: 18px; }
        .mcfo-rar__gem { width: 14px; height: 14px; border-radius: 4px; transform: rotate(45deg); flex: none;
            background: var(--mcfo-rar-fill); border: 2px solid var(--mcfo-rar-line); box-sizing: border-box; }
        .mcfo-rar__tags { display: flex; gap: 5px; flex-wrap: wrap; }
        .mcfo-rar__tags i { font: 700 11px/1 system-ui, sans-serif; font-style: normal; padding: 3px 7px; border-radius: 999px;
            background: rgba(0, 0, 0, 0.35); border: 1px solid rgba(255, 255, 255, 0.18); color: #dfe5ec; }
        .mcfo-rar__tags i[data-tone=eq] { border-color: var(--mcfo-rar-line); color: #fff; }
        .mcfo-rar__bar { display: flex; align-items: center; gap: 9px; flex-wrap: wrap; padding: 7px 10px 7px 7px; border-radius: 10px;
            border: 1px solid var(--mcfo-rar-line); background: linear-gradient(90deg, var(--mcfo-rar-bg), rgba(0, 0, 0, 0.2));
            color: #f2f4f7; font: 13px/1.25 system-ui, sans-serif; }
        .mcfo-rar__bar b { font-size: 14px; font-weight: 800; }
        .mcfo-rar__of { color: #c3cbd4; font-size: 12px; }
        .mcfo-rar__back { border: 1px solid rgba(255, 255, 255, 0.22); border-radius: 7px; background: rgba(0, 0, 0, 0.35); color: #f2f4f7;
            font: 700 12px/1 system-ui, sans-serif; padding: 7px 10px; cursor: pointer; }
        .mcfo-rar__back:hover { border-color: var(--mcfo-rar-line); }
        /* the overview: only the tiles. A rarity picked: the game's select is the tiles' job, Equipped and the count stay */
        html[data-mcfo-rarview=all] .inventorySelectionPanel > .inventoryCards,
        html[data-mcfo-rarview=all] .inventorySelectionPanel > .inventoryActions,
        html[data-mcfo-rarview=all] .inventorySelectionPanel .inventoryFilters,
        html[data-mcfo-rarview=pick] .inventorySelectionPanel .inventoryFilters label:has(> select[data-inventory-rarity]) { display: none; }
    `;

    function invDocAssist(doc) {
        const root = doc && doc.getElementById && doc.getElementById('inventory-root');
        if (!root || doc.documentElement.hasAttribute('data-mcfo-invassist')) return;
        doc.documentElement.setAttribute('data-mcfo-invassist', '1');
        const st = doc.createElement('style');
        st.id = 'mcfo-inv-assist';
        st.textContent = LO_CSS + INV_GRID_CSS + INV_RAR_CSS;
        (doc.head || doc.documentElement).appendChild(st);
        loDocs.add(doc);
        const keepScroll = invKeepScroll(doc, root);
        let queued = false;
        new MutationObserver(() => {
            // Right away, not in the 60 ms batch below: the game has just thrown the old list away,
            // and a frame at the top (or with the long button texts) is exactly the jump we hide.
            // The loadout buttons first: they make the cards taller, and the old place may only
            // exist with them (without, the browser clamps it).
            invShortLabels(root);
            invRarity(doc, root);
            loDecorate(doc);
            keepScroll();
            invFitSoon(root);
            if (queued) return;
            queued = true;
            // The bar too: its No trail / No border button depends on the page shown.
            setTimeout(() => { queued = false; loDrawBar(doc); loDecorate(doc); invTitleCount(doc); }, 60);
        }).observe(root, { childList: true, subtree: true });
        invTitleCount(doc);
        invShortLabels(root);
        invRarity(doc, root);
        loKnowPlayer().catch(() => {}).then(() => loRedraw());
        loRedraw();
    }

    // The card grid (6.52). The game caps the page at 1480 px and gives every card at least 230 px
    // plus a 1.4:1 preview: in a wide window that is one or two huge cards per row, and 52 crowns
    // to scroll through. Here the page takes the whole window and the cards get small - six or
    // seven per row. Badges sit on the preview, the button texts get a short form (full text stays
    // as the tooltip), so a card is picture, name and two buttons.
    const INV_GRID_CSS = `
        /* the game's siteNavigation.css caps it with main.mcfPageContent (max-width + margin auto) */
        main#inventory-root.inventoryMain { width: 100%; max-width: none; margin-inline: 0; padding: 14px 18px; }
        .inventorySelectionPanel > .inventoryCards { grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px; overflow-anchor: none; }
        .inventoryBiddingIndicatorsPage .inventorySelectionPanel > .inventoryCards { grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); }
        .inventoryRebellionAurasPage .inventorySelectionPanel > .inventoryCards { grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); }
        .inventorySelectionPanel > .inventoryChatCards { grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); }
        /* 6.52.2: a card shows picture, name and buttons. The item's description (colours, materials,
           construction ...) and the rarity line are on the focus panel when you click the card. */
        .inventorySelectionPanel .inventoryCard .cosmeticComponents,
        .inventorySelectionPanel .inventoryCard .inventoryMeta,
        .inventorySelectionPanel .inventoryCardPreview p.inventoryMuted { display: none; }   /* "Border available", "Full aura · gameplay scale ..." */
        /* The crown renderer's stage keeps a min-height of 166 px; in a small card that pushed the
           crown down and cut it off at the bottom. */
        .inventorySelectionPanel .inventoryCardPreview .crownItemPreviewStage { min-height: 0; height: 100%; }
        /* Chat previews are a chat line: their own height, not a picture box. */
        .inventorySelectionPanel .inventoryChatCards .inventoryCardPreview { aspect-ratio: auto; min-height: 0; }
        .inventorySelectionPanel .inventoryChatCards .chatCosmeticPreview { min-height: 0; }
        /* SVG previews (borders, auras, indicators) are cut to the item by invFitPreviews; the box
           then gets the item's shape. */
        .inventoryBordersPage .inventorySelectionPanel .inventoryCardPreview { aspect-ratio: 1 / 1; }
        .inventoryBiddingIndicatorsPage .inventorySelectionPanel .inventoryCardPreview { aspect-ratio: 2.6 / 1; }
        /* 6.54.2: rebellion auras had no box at all - the game sets aspect-ratio auto + overflow visible on that
           page, and its SVG comes with an inline 320 x 320 px (max-width only shrinks the width). Whenever the fit
           below had not happened yet (window hidden while the game drew), the picture ran 320 px tall over the
           name and the Equip / Pool buttons. Now the box is square and the SVG always fills it, fitted or not. */
        .inventoryRebellionAurasPage .inventorySelectionPanel .inventoryCardPreview { aspect-ratio: 1 / 1; overflow: hidden; }
        .inventorySelectionPanel .inventoryCardPreview [data-border-card] > svg,
        .inventorySelectionPanel .inventoryCardPreview svg[data-mcfo-fit="1"] { width: 100% !important; height: 100% !important; max-width: none !important; aspect-ratio: auto !important; }
        .inventorySelectionPanel .inventoryCardPreview [data-border-card] { height: 100%; }
        .inventorySelectionPanel .inventoryCard { position: relative; display: flex; flex-direction: column; gap: 6px; padding: 7px; }
        /* the game filters crowns and chat by setting hidden on the card (inventoryFilters.js); display:flex above beat its [hidden] rule */
        .inventorySelectionPanel .inventoryCard[hidden], .inventorySelectionPanel [data-inventory-no-matches][hidden] { display: none; }
        .inventorySelectionPanel .inventoryCard > .inventoryCardPreview { flex: none; }
        .inventorySelectionPanel .inventoryCardActions { margin-top: auto; }
        .inventorySelectionPanel .inventoryCard h3 { margin: 0; font-size: 12.5px; line-height: 1.25; min-height: 2.5em;
            display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .inventorySelectionPanel .inventoryCard .inventoryMeta { font-size: 11px; }
        .inventorySelectionPanel .inventoryCard .inventoryBadges { position: absolute; top: 11px; left: 11px; right: 11px;
            gap: 4px; z-index: 1; pointer-events: none; }
        .inventorySelectionPanel .inventoryCard .inventoryBadge { font-size: 10.5px; padding: 1px 6px; background: rgba(8, 12, 18, 0.8); }
        .inventorySelectionPanel .inventoryCard .inventoryBadge:not([data-tone]) { display: none; }
        .inventorySelectionPanel .inventoryCardActions { grid-template-columns: none; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); gap: 5px; }
        .inventorySelectionPanel .inventoryCardActions .inventoryAction { min-height: 0; padding: 5px 4px; font-size: 12px; line-height: 1.2; }
        .inventorySelectionPanel .inventoryCardActions .inventoryAction[data-mcfo-short] { font-size: 0; }
        .inventorySelectionPanel .inventoryCardActions .inventoryAction[data-mcfo-short]::after { content: attr(data-mcfo-short); font-size: 12px; }
        .inventorySelectionPanel .mcfo-lob { gap: 4px; margin-top: 0; }
        .inventorySelectionPanel .mcfo-lob__pick { padding: 4px 3px; font-size: 11px; }
        /* 6.54.2: between 821 px (where the game turns to one column) and ~1000 px the sidebar (280) and the
           middle column (430) leave the card list about 100 px - one cut-off card. Stack the middle column
           and the list there; the middle column keeps its full width, so Random On is not cut off either. */
        @media (min-width: 821px) and (max-width: 999px) {
            /* one scrolling column - details, preview, list - instead of three boxes that each scroll
               (stacked boxes squeezed the details so far that Default / Random were hidden) */
            .inventoryGrid { grid-template-columns: minmax(0, 1fr); grid-template-rows: none; grid-auto-rows: max-content; align-content: start; align-items: start;
                overflow-y: auto; overscroll-behavior: contain; }
            .inventoryGrid .inventoryFocus { grid-template-rows: auto auto; overflow: visible; }
            .inventoryGrid .inventoryFocus > .inventoryPanel:first-child,
            .inventoryGrid .inventoryBorderFocusPanel, .inventoryGrid .inventoryTrailFocusPanel,
            .inventoryGrid .inventorySelectionPanel, .inventoryGrid .inventorySelectionPanel > .inventoryCards { overflow: visible; }
        }
    `;
    // Cut SVG previews to the item (6.52.2). The renderers draw into a fixed square or strip
    // (borders -84..84 around a marble of radius ~24, indicators 450 x 116 with the marble at the
    // left end), which in a small card leaves a small item in a lot of empty background. Once the
    // card is drawn, the viewBox is set to the box around everything except the full-size
    // background rect, plus a margin. The renderers set their viewBox once and never again, and
    // the compact card previews stand still, so the cut holds.
    function invFitPreviews(root) {
        let open = 0;
        for (const svg of root.querySelectorAll('.inventorySelectionPanel .inventoryCardPreview svg, .mi-thumb > svg, .mi-slot__pic > svg')) {
            if (svg.hasAttribute('data-mcfo-fit') || svg.parentElement.closest('svg')) continue;
            const vb = svg.viewBox && svg.viewBox.baseVal;
            if (!vb || !vb.width) continue;
            const box = invSvgBox(svg, vb);
            if (!box) { open++; continue; }   // not drawn yet
            const [x0, y0, x1, y1] = box;
            // Trails come as one rendered picture over the whole scene (<g><image>): where the
            // stroke really is cannot be measured - that preview stays as the game draws it.
            if (svg.querySelector(':scope > g > image')) { svg.setAttribute('data-mcfo-fit', 'skip'); continue; }
            const pad = Math.max(x1 - x0, y1 - y0) * 0.1;
            svg.setAttribute('viewBox', `${x0 - pad} ${y0 - pad} ${x1 - x0 + 2 * pad} ${y1 - y0 + 2 * pad}`);
            svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
            svg.setAttribute('data-mcfo-fit', '1');
        }
        return open;
    }
    // The box around what is really visible, in the svg's own units: measured shape by shape with
    // the real screen matrix (so the transforms that place the marble count); under a clip or
    // mask only the clip's outline counts. getBBox alone made every border look a third smaller
    // than it could be.
    function invSvgBox(svg, vb) {
        const toSvg = svg.getScreenCTM() && svg.getScreenCTM().inverse();
        if (!toSvg) return null;
        const doc = svg.ownerDocument, win = doc.defaultView;
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        const put = (x, y) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); };
        // shape = the geometry, space = whose user space it is drawn in (a clip path's shapes are
        // in the clipped element's space). Shapes are followed along their outline: the box of a
        // rotated ring is ~40 % bigger than the ring (borders are drawn turned by 35 degrees).
        const addShape = (shape, space) => {
            const m = space.getScreenCTM && space.getScreenCTM();
            if (!m) return;
            const k = toSvg.multiply(m);
            const at = (px, py) => put(k.a * px + k.c * py + k.e, k.b * px + k.d * py + k.f);
            let len = 0;
            try { len = typeof shape.getTotalLength === 'function' ? shape.getTotalLength() : 0; } catch (e) { len = 0; }
            if (len > 0) {
                const n = Math.min(64, Math.max(12, Math.ceil(len / 4)));
                for (let i = 0; i <= n; i++) { const p = shape.getPointAtLength(len * i / n); at(p.x, p.y); }
                return;
            }
            let bb; try { bb = shape.getBBox(); } catch (e) { return; }
            if (!bb.width || !bb.height) return;
            at(bb.x, bb.y); at(bb.x + bb.width, bb.y); at(bb.x, bb.y + bb.height); at(bb.x + bb.width, bb.y + bb.height);
        };
        const ref = (el, attr) => {
            const m = /url\(["']?#([^"')]+)/.exec(el.getAttribute(attr) || '');
            return m && doc.getElementById(m[1]);
        };
        const SKIP = new Set(['defs', 'mask', 'clippath', 'lineargradient', 'radialgradient', 'filter', 'pattern', 'title', 'desc', 'style']);
        const walk = el => {
            const tag = el.tagName.toLowerCase();
            if (SKIP.has(tag)) return;
            const cs = win.getComputedStyle(el);
            if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return;
            // under a clip or mask only its own outline can show
            const cut = ref(el, 'clip-path') || ref(el, 'mask');
            if (cut && cut.children.length) { for (const c of cut.querySelectorAll('*')) if (!c.children.length) addShape(c, el); return; }
            if (!el.children.length || tag === 'text') { addShape(el, el); return; }
            for (const c of el.children) walk(c);
        };
        for (const el of svg.children) {
            if (el.tagName.toLowerCase() === 'rect' && +el.getAttribute('width') >= vb.width * 0.9) continue;   // the background
            walk(el);
        }
        return x1 > x0 ? [x0, y0, x1, y1] : null;
    }
    const invFitLater = new WeakMap();
    function invFitSoon(root) {
        if (invFitLater.get(root)) return;
        invFitLater.set(root, true);
        let tries = 0;
        const run = () => {
            const open = invFitPreviews(root);
            // 6.54.2: no longer give up after 3 s - a window that was minimized or hidden while the game
            // drew cannot be measured yet; keep trying once a second (2 min) until it can.
            if (open && ++tries < 140) setTimeout(run, tries < 20 ? 150 : 1000); else invFitLater.set(root, false);
        };
        requestAnimationFrame(run);
    }

    const INV_SHORT = { 'add to pool': '+ Pool', 'remove from pool': '\u2212 Pool', 'not pool eligible': 'No pool' };
    function invShortLabels(root) {
        for (const b of root.querySelectorAll('.inventorySelectionPanel .inventoryCardActions .inventoryAction')) {
            const text = b.textContent.trim();
            const short = INV_SHORT[text.toLowerCase()] || '';
            if ((b.getAttribute('data-mcfo-short') || '') === short) continue;
            if (short) { b.setAttribute('data-mcfo-short', short); b.title = text; }
            else { b.removeAttribute('data-mcfo-short'); b.removeAttribute('title'); }
        }
    }

    // The list keeps its place (6.52). The game draws the whole inventory again on every click -
    // looking at a card, equipping it (with a "Loading inventory" in between) - and the card list
    // is a scroll box of its own: the new one starts at the top. We note where each scroller
    // stood and put the fresh one back there. The key is the subpage plus the game's own pager
    // ("2/3" on borders and trails), so a new page or another subpage still starts at the top;
    // so does a click in the sidebar. Narrow windows (below 821 px) scroll the document instead,
    // which the loading step collapses - that one is put back too.
    const invCardKey = c => c.getAttribute('data-id') || c.getAttribute('data-border-card-id') || c.getAttribute('data-trail-card-id') || '';
    // The cards of a scroller: the card list itself, or (6.54.2, narrow window) the whole column around it.
    const invCards = el => el.matches('.inventoryCards') ? el.querySelectorAll(':scope > article') : el.querySelectorAll('.inventorySelectionPanel .inventoryCards > article');
    function invTopCard(list) {
        const top = list.getBoundingClientRect().top;
        for (const c of invCards(list)) {
            const r = c.getBoundingClientRect();
            if (r.bottom > top) return { id: invCardKey(c), off: r.top - top };
        }
        return {};
    }
    const INV_SCROLLERS = ['.inventorySelectionPanel > .inventoryCards', '.inventorySidebar', '.inventoryGrid'];   // the last scrolls only between 821 and 999 px
    function invKeepScroll(doc, root) {
        const keep = new Map();
        const pager = () => { const p = root.querySelector('.inventorySelectionPanel > .inventoryActions span'); return p ? p.textContent.trim() : ''; };
        const key = i => i === 1 ? 'sidebar' : (i === 2 ? 'col|' : '') + loPage(doc) + '|' + ((invRarSelect(root) || {}).value || '') + '|' + pager();
        const loading = () => !!root.querySelector('.inventoryStatus');
        let docWas = false;
        doc.addEventListener('scroll', e => {
            if (loading()) return;   // the collapse of the loading step is no place to remember
            const t = e.target;
            if (t === doc) { keep.set('doc', (doc.scrollingElement || doc.documentElement).scrollTop); return; }
            const i = t.matches ? INV_SCROLLERS.findIndex(sel => t.matches(sel)) : -1;
            if (i >= 0) keep.set(key(i), { top: t.scrollTop, ...invTopCard(t) });
        }, true);
        doc.addEventListener('click', e => {
            const nav = e.target.closest && e.target.closest('.inventorySidebar [data-page]');
            if (nav) for (const k of [...keep.keys()]) if (k !== 'sidebar') keep.delete(k);
        }, true);
        return () => {
            if (loading()) { docWas = true; return; }
            INV_SCROLLERS.forEach((sel, i) => {
                const el = root.querySelector(sel);
                if (!el || el.__mcfoKept) return;
                el.__mcfoKept = true;
                const v = keep.get(key(i));
                if (!v || !v.top || el.scrollTop) return;
                // Back to the card that was at the top, at the same distance. Pixels alone are not
                // enough: chat previews are drawn a moment later, the fresh cards are lower at first.
                // The previews keep growing for a moment after that (the browser's own scroll
                // anchoring then held a spot INSIDE the card and let its top slide up), so the card is
                // held in place for 1.5 s - until the player scrolls or clicks.
                const find = () => v.id && [...invCards(el)].find(c => invCardKey(c) === v.id);
                const place = () => { const card = find(); if (!card) return false;
                    const d = card.getBoundingClientRect().top - el.getBoundingClientRect().top - v.off;
                    if (Math.abs(d) >= 1) el.scrollTop += d; return true; };
                if (!place()) { el.scrollTop = v.top; return; }
                const until = Date.now() + 1500;
                let user = false;
                const stop = () => { user = true; };
                for (const ev of ['wheel', 'pointerdown', 'keydown', 'touchstart']) el.addEventListener(ev, stop, { once: true, passive: true });
                const hold = () => { if (user || !el.isConnected || Date.now() > until) return; place(); requestAnimationFrame(hold); };
                requestAnimationFrame(hold);
            });
            if (docWas) {
                docWas = false;
                const se = doc.scrollingElement || doc.documentElement, v = keep.get('doc');
                if (v && se.scrollTop < v) se.scrollTop = v;
            }
        };
    }

    // "Your Royal Titles (12)" (6.38.4): the game lists every title as a card and never says how
    // many. The ones every player has (Queen, King, Crown: "Included for every player") are
    // counted too, and named in the tooltip.
    function invTitleCount(doc) {
        const grid = doc.querySelector('.inventoryRoyalTitleCards');
        const h = grid && grid.parentElement && grid.parentElement.querySelector(':scope > h2');
        if (!h) return;
        const cards = [...grid.querySelectorAll(':scope > article.inventoryCard')];
        // Since game v0.10.1g the card no longer says it; the unlock info button carries the text.
        const base = cards.filter(c => {
            const info = c.querySelector('[data-unlock-copy]');
            return /included for every player/i.test(info ? info.getAttribute('data-unlock-copy') : c.textContent);
        }).length;
        let tag = h.querySelector('.mcfo-titlecount');
        if (!tag) { tag = doc.createElement('span'); tag.className = 'mcfo-titlecount'; h.appendChild(tag); }
        const text = ` (${cards.length})`;
        if (tag.textContent !== text) tag.textContent = text;
        const tip = base ? `${cards.length - base} of your own, ${base} included for every player` : '';
        if (tag.title !== tip) tag.title = tip;
    }

    function loPage(doc) {
        const cur = doc.querySelector('button.inventorySubcategoryButton[aria-current="page"]');
        return (cur && cur.getAttribute('data-subpage')) || '';
    }
    // Title and toll cards carry no id; the page's own pickers (one <select> per occasion) do,
    // with the display name as option text - and names are unique there.
    function loCardId(card) {
        const id = card.getAttribute('data-id') || card.getAttribute('data-trail-card-id') || card.getAttribute('data-border-card-id');
        if (id) return id;
        const name = ((card.querySelector('h3') || {}).textContent || '').trim();
        const opt = name && [...card.ownerDocument.querySelectorAll('select[data-royal-title-slot] option, select[data-default-toll-slot] option')]
            .find(o => o.textContent.trim() === name);
        return opt ? opt.value : '';
    }
    // What a draft slot says, short: for the chips in the bar and the button states.
    function loPicked(draft, slot, id, kind) {
        const v = draft && draft.slots[slot];
        if (!v) return false;
        if (kind === 'pool') return !!v.random && (v.pool || []).includes(id);
        return !v.random && String(v.sel ?? '') === String(loBlank(id) ? '' : id);
    }
    function loToggle(slot, id, name, kind) {
        const draft = loDraft();
        if (!draft) return;
        const v = draft.slots[slot];
        const sel = loBlank(id) ? null : id;
        if (kind === 'pool') {
            const pool = v && v.random ? [...(v.pool || [])] : [];
            const at = pool.indexOf(id);
            if (at >= 0) pool.splice(at, 1);
            else if (pool.length >= 10) { loSay('A random pool holds ten at most.', 'warn'); return; }
            else pool.push(id);
            const names = { ...(v && v.random ? v.poolNames || {} : {}) };
            if (at >= 0) delete names[id]; else names[id] = name;
            if (pool.length) draft.slots[slot] = { random: true, pool, poolNames: names };
            else delete draft.slots[slot];
        } else if (loPicked(draft, slot, id, 'sel')) {
            delete draft.slots[slot];
        } else {
            draft.slots[slot] = { sel, selName: name || 'Default', random: LO_SLOTS[slot].random ? false : undefined };
        }
        loSetDraft(draft);
    }

    function loDecorate(doc) {
        const draft = loDraft();
        const page = loPage(doc);
        const kinds = (draft && LO_PAGES[page]) || [];
        for (const card of doc.querySelectorAll('article.inventoryCard')) {
            let box = card.querySelector(':scope > .mcfo-lob');
            if (!kinds.length) { if (box) box.remove(); continue; }
            const id = loCardId(card);
            if (!id) continue;
            if (!box) { box = doc.createElement('div'); box.className = 'mcfo-lob'; card.appendChild(box); }
            const name = ((card.querySelector('h3') || {}).textContent || '').trim() || '?';
            const want = kinds.filter(([, , kind]) => !(kind === 'pool' && id === 'system_no_crown'));
            if (box.children.length !== want.length) {
                box.textContent = '';
                for (const [slot, label, kind] of want) {
                    const b = doc.createElement('button');
                    b.type = 'button';
                    b.className = 'mcfo-lob__pick';
                    b.dataset.slot = slot; b.dataset.kind = kind || 'sel'; b.dataset.label = label;
                    b.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); loToggle(b.dataset.slot, loCardId(card), name, b.dataset.kind); });
                    box.appendChild(b);
                }
            }
            for (const b of box.children) {
                const on = loPicked(draft, b.dataset.slot, id, b.dataset.kind);
                const text = (on ? '\u2713 ' : '+ ') + b.dataset.label;
                if (b.textContent !== text) b.textContent = text;
                b.setAttribute('aria-pressed', on ? 'true' : 'false');
            }
        }
    }

    function loChips(draft) {
        return Object.keys(LO_SLOTS).filter(k => draft.slots[k]).map(k => {
            const v = draft.slots[k];
            const what = v.random ? `random from ${(v.pool || []).length}` : (v.selName || 'Default');
            return `<span class="mcfo-lobar__chip" data-slot="${k}" title="Click to take it out">${loEsc(LO_SLOTS[k].label)}: <b>${loEsc(what)}</b> <i>\u00d7</i></span>`;
        }).join('');
    }

    function loDrawBar(doc) {
        const root = doc.getElementById('inventory-root');
        let bar = doc.querySelector('.mcfo-lobar');
        if (!bar) { bar = doc.createElement('div'); bar.className = 'mcfo-lobar'; root.parentNode.insertBefore(bar, root); }
        const draft = loDraft();
        const list = Object.values(loMine()).sort((a, b) => a.name.localeCompare(b.name));
        if (loUi.pick && !list.some(l => l.name.toLowerCase() === loUi.pick)) loUi.pick = '';
        const pick = loUi.pick || (list[0] ? list[0].name.toLowerCase() : '');
        const off = lo.busy ? ' disabled' : '';
        const status = loStatus();
        let html;
        if (draft) {
            const n = Object.keys(draft.slots).length, total = Object.keys(LO_SLOTS).length;
            const none = LO_NONE[loPage(doc)];
            html = `<div class="mcfo-lobar__row"><span class="mcfo-lobar__title">New loadout</span>`
                + `<span class="mcfo-lobar__count">${n} of ${total} slots</span>`
                + (none ? `<button type="button" data-a="none"${off}>${loPicked(draft, none[0], '', 'sel') ? '\u2713 ' : '+ '}${none[1]}</button>` : '')
                + `<span class="mcfo-lobar__gap"></span>`
                + `<input type="text" maxlength="40" placeholder="Name" data-f="name"><button type="button" data-a="build-save" class="mcfo-lobar__main"${off}>Save</button>`
                + `<button type="button" data-a="build-close"${off}>Close</button></div>`
                + `<div class="mcfo-lobar__chips">${n ? loChips(draft) : '<span class="mcfo-lobar__hint">Pick items below with <b>+ Loadout</b> (or <b>+ Pool</b> for a random pool) on any inventory page. Nothing is equipped while you build.</span>'}</div>`;
            if (loUi.confirm) {
                html += `<div class="mcfo-lobar__confirm">Not in this loadout: <b>${loEsc(loUi.confirm.join(', '))}</b>. When you put it on, those stay as they are.`
                    + ` <button type="button" data-a="confirm-yes" class="mcfo-lobar__main">Save anyway</button><button type="button" data-a="confirm-no">Cancel</button></div>`;
            }
        } else {
            html = `<div class="mcfo-lobar__row"><span class="mcfo-lobar__title">Loadouts</span>`
                + (list.length
                    ? `<select data-f="pick"${off}>${list.map(l => `<option value="${loEsc(l.name.toLowerCase())}"${l.name.toLowerCase() === pick ? ' selected' : ''}>${loEsc(l.name)}</option>`).join('')}</select>`
                      + `<button type="button" data-a="load" class="mcfo-lobar__main"${off}>${lo.busy ? 'Working \u2026' : 'Put on'}</button><button type="button" data-a="code"${off}>Copy code</button><button type="button" data-a="del"${off}>Delete</button>`
                    : `<span class="mcfo-lobar__hint">None saved yet.</span>`)
                + `<span class="mcfo-lobar__gap"></span>`
                + `<button type="button" data-a="new"${off}>New loadout</button><button type="button" data-a="wear"${off}>Save what I wear</button><button type="button" data-a="import"${off}>Import</button></div>`;
            if (loUi.mode === 'save') {
                html += `<div class="mcfo-lobar__row"><span class="mcfo-lobar__hint">Everything you wear now, under a name:</span><input type="text" maxlength="40" placeholder="Name" data-f="name">`
                    + `<button type="button" data-a="wear-save" class="mcfo-lobar__main"${off}>Save</button><button type="button" data-a="cancel">Cancel</button></div>`;
            } else if (loUi.mode === 'import') {
                html += `<div class="mcfo-lobar__row mcfo-lobar__row--import"><textarea rows="2" data-f="code" placeholder="MLF-LOADOUT-1:\u2026 (from Copy code, or /loadout export in Discord)"></textarea>`
                    + `<input type="text" maxlength="40" placeholder="Save as (empty: name in the code)" data-f="as"><button type="button" data-a="import-go" class="mcfo-lobar__main"${off}>Import</button><button type="button" data-a="cancel">Cancel</button></div>`;
            }
        }
        if (status) html += `<div class="mcfo-lobar__status" data-tone="${status.tone}">${status.html}<button type="button" data-a="hush" aria-label="Dismiss">\u00d7</button></div>`;
        // Typed text survives the redraw.
        const keep = {};
        for (const f of bar.querySelectorAll('[data-f]')) keep[f.dataset.f] = f.value;
        const focused = doc.activeElement && doc.activeElement.dataset && doc.activeElement.dataset.f;
        if (bar._mcfoHtml === html) return;
        bar._mcfoHtml = html;
        bar.innerHTML = html;
        for (const f of bar.querySelectorAll('[data-f]')) if (keep[f.dataset.f] != null && f.dataset.f !== 'pick') f.value = keep[f.dataset.f];
        if (focused) { const f = bar.querySelector(`[data-f="${focused}"]`); if (f) f.focus(); }
        loBind(doc, bar);
    }

    function loBind(doc, bar) {
        const val = f => { const x = bar.querySelector(`[data-f="${f}"]`); return x ? x.value.trim() : ''; };
        const picked = () => loMine()[(bar.querySelector('[data-f=pick]') || {}).value || ''];
        const sel = bar.querySelector('[data-f=pick]');
        if (sel) sel.addEventListener('change', () => { loUi.pick = sel.value; });
        for (const ch of bar.querySelectorAll('.mcfo-lobar__chip')) ch.addEventListener('click', () => {
            const d = loDraft(); if (!d) return; delete d.slots[ch.dataset.slot]; loUi.confirm = null; loSetDraft(d);
        });
        const saveDraft = (name) => loRun(async () => {
            const d = loDraft();
            await loKnowPlayer();
            // Pool names were kept by id while building; saved, they are a list like everywhere else.
            const slots = {};
            for (const [k, v] of Object.entries(d.slots)) {
                slots[k] = { ...v };
                if (v.random) slots[k].poolNames = (v.pool || []).map(id => (v.poolNames || {})[id] || '?');
            }
            loPut(name.toLowerCase(), { name, savedAt: Date.now(), player: lo.player, slots });
            loUi.confirm = null; loUi.pick = name.toLowerCase();
            loSetDraft({ slots: {} });   // empty again: the next loadout can start right away
            loSay(`Saved <b>${loEsc(name)}</b>. The picks are cleared for the next one.`, 'done');
        });
        const on = (a, fn) => { const b = bar.querySelector(`[data-a="${a}"]`); if (b) b.addEventListener('click', fn); };
        on('hush', () => { try { sessionStorage.removeItem(LO_STATUS); } catch (e) { /* blocked */ } loRedraw(); });
        on('new', () => { loUi.mode = ''; loSetDraft({ slots: {} }); });
        on('build-close', () => { loUi.confirm = null; loSetDraft(null); });
        on('none', () => { const n = LO_NONE[loPage(doc)]; if (n) loToggle(n[0], '', 'None', 'sel'); });
        on('build-save', () => {
            const d = loDraft(), name = val('name');
            if (!d || !Object.keys(d.slots).length) { loSay('Pick at least one item first.', 'warn'); return; }
            if (!name) { const f = bar.querySelector('[data-f=name]'); if (f) f.focus(); loSay('Give the loadout a name.', 'warn'); return; }
            const missing = Object.keys(LO_SLOTS).filter(k => !d.slots[k]).map(k => LO_SLOTS[k].label);
            if (missing.length) { loUi.confirm = missing; loUi.confirmName = name; loRedraw(); return; }
            saveDraft(name);
        });
        on('confirm-yes', () => saveDraft(loUi.confirmName || val('name')));
        on('confirm-no', () => { loUi.confirm = null; loRedraw(); });
        on('wear', () => { loUi.mode = loUi.mode === 'save' ? '' : 'save'; loRedraw(); });
        on('import', () => { loUi.mode = loUi.mode === 'import' ? '' : 'import'; loRedraw(); });
        on('cancel', () => { loUi.mode = ''; loRedraw(); });
        on('wear-save', () => {
            const name = val('name');
            if (!name) { const f = bar.querySelector('[data-f=name]'); if (f) f.focus(); return; }
            loRun(async () => {
                const failed = await loSave(name);
                loUi.mode = ''; loUi.pick = name.toLowerCase();
                loSay(`Saved <b>${loEsc(name)}</b>.` + (failed.length ? ` Not readable just now: ${loEsc(failed.join(', '))}.` : ''), failed.length ? 'warn' : 'done');
            });
        });
        on('import-go', () => loRun(async () => {
            const code = loReadCode(val('code'));
            const name = val('as') || code.name;
            if (!name) throw new Error('The code has no name: type one into Save as.');
            const missing = await loImport(code, name);
            loUi.mode = ''; loUi.pick = name.toLowerCase();
            loSay(`Imported <b>${loEsc(name)}</b>.` + (missing ? ` ${missing} item${missing > 1 ? 's are' : ' is'} not in your inventory right now; those slots stay as they are when you put it on.` : ''), missing ? 'warn' : 'done');
        }));
        on('load', () => { const l = picked(); if (l) loRun(async () => {
            const r = await loLoad(l);
            const marks = { done: 'ok', same: 'same', warn: 'warn', error: 'err' };
            const bad = r.lines.some(([t]) => t === 'warn' || t === 'error');
            loSay(`<b>${loEsc(l.name)}</b> put on, ${r.changed} slot${r.changed === 1 ? '' : 's'} changed.<ul>`
                + r.lines.map(([t, x]) => `<li data-t="${marks[t]}">${loEsc(x)}</li>`).join('') + '</ul>', bad ? 'warn' : 'done');
        }); });
        on('code', async () => {
            const l = picked(); if (!l) return;
            const code = loCode(l);
            const ok = await loCopy(code);
            // Blocked clipboard: the code is shown, selected, to be copied by hand.
            loSay(ok ? `Code for <b>${loEsc(l.name)}</b> copied. In Discord: <code>/loadout import</code> and paste it into <i>code</i>.`
                     : `The browser blocked copying. Copy the code for <b>${loEsc(l.name)}</b> by hand:<textarea readonly rows="2">${loEsc(code)}</textarea>`, ok ? 'done' : 'warn');
            const shown = !ok && bar.querySelector('.mcfo-lobar__status textarea');
            if (shown) { shown.focus(); shown.select(); }
        });
        // Two clicks to delete: the first only asks.
        const del = bar.querySelector('[data-a=del]');
        if (del) del.addEventListener('click', () => {
            const l = picked(); if (!l) return;
            if (del.dataset.sure) { loPut(l.name.toLowerCase(), null); loUi.pick = ''; loSay(`Deleted <b>${loEsc(l.name)}</b>.`, 'done'); return; }
            del.dataset.sure = '1'; del.textContent = 'Sure?';
            setTimeout(() => { if (del.isConnected) { delete del.dataset.sure; del.textContent = 'Delete'; } }, 4000);
        });
    }

    const LO_CSS = `
        .mcfo-lobar { margin: 0 0 12px; padding: 10px 12px; border: 1px solid #2c4254; border-radius: 10px;
            background: linear-gradient(180deg, rgba(22, 38, 52, 0.92), rgba(14, 25, 35, 0.92)); color: #cfe2f2;
            font: 13px/1.35 system-ui, sans-serif; position: relative; z-index: 5; }
        .mcfo-lobar__row { display: flex; gap: 7px; align-items: center; flex-wrap: wrap; }
        .mcfo-lobar__row + .mcfo-lobar__row { margin-top: 8px; }
        .mcfo-lobar__title { font-weight: 800; color: #e6f0f7; margin-right: 4px; }
        .mcfo-lobar__count, .mcfo-lobar__hint { color: #9ab0c0; font-size: 12px; }
        .mcfo-lobar__gap { flex: 1; }
        .mcfo-lobar button, .mcfo-lob__pick { border: 1px solid #2c4254; border-radius: 7px; background: #111f2b; color: #cfe2f2;
            font: 700 12px/1 system-ui, sans-serif; padding: 7px 10px; cursor: pointer; white-space: nowrap; }
        .mcfo-lobar button:hover:not(:disabled), .mcfo-lob__pick:hover { background: #16283a; border-color: #4d7ea6; color: #fff; }
        .mcfo-lobar button:disabled { opacity: 0.5; cursor: default; }
        .mcfo-lobar button.mcfo-lobar__main { background: #1d4a6e; border-color: #3f7fae; color: #fff; }
        .mcfo-lobar button[data-sure] { border-color: #a0503c; color: #ffb4a0; }
        .mcfo-lobar select, .mcfo-lobar input, .mcfo-lobar textarea { box-sizing: border-box; border: 1px solid #2c4254; border-radius: 7px;
            background: #0b1620; color: #e6f0f7; font: 12.5px system-ui, sans-serif; padding: 6px 8px; min-width: 0; }
        .mcfo-lobar select { max-width: 220px; }
        .mcfo-lobar input { width: 170px; }
        .mcfo-lobar__row--import textarea { flex: 1 1 100%; resize: vertical; font: 11.5px ui-monospace, monospace; word-break: break-all; }
        .mcfo-lobar__chips { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px; }
        .mcfo-lobar__chip { border: 1px solid #3f7fae; border-radius: 999px; padding: 4px 9px; font-size: 12px; cursor: pointer; background: rgba(29, 74, 110, 0.35); }
        .mcfo-lobar__chip i { font-style: normal; opacity: 0.6; margin-left: 2px; }
        .mcfo-lobar__chip:hover i { opacity: 1; }
        .mcfo-lobar__confirm { margin-top: 8px; padding: 8px 10px; border-radius: 8px; border: 1px solid #6f5a28; background: rgba(60, 45, 12, 0.45); color: #ffe3a3; font-size: 12.5px; }
        .mcfo-lobar__confirm button { margin-left: 6px; }
        .mcfo-lobar__status { margin-top: 8px; padding: 8px 30px 8px 10px; border-radius: 8px; font-size: 12.5px; position: relative;
            border: 1px solid #2c5a3e; background: rgba(16, 52, 32, 0.45); color: #c8f0d6; }
        .mcfo-lobar__status[data-tone=warn] { border-color: #6f5a28; background: rgba(60, 45, 12, 0.45); color: #ffe3a3; }
        .mcfo-lobar__status[data-tone=error] { border-color: #7a3a2c; background: rgba(70, 20, 12, 0.45); color: #ffc2b2; }
        .mcfo-lobar__status button[data-a=hush] { position: absolute; top: 5px; right: 5px; padding: 3px 7px; }
        .mcfo-lobar__status ul { margin: 5px 0 0; padding-left: 18px; columns: 2; }
        .mcfo-lobar__status li[data-t=same] { opacity: 0.6; }
        .mcfo-lobar__status li[data-t=warn] { color: #ffe3a3; }
        .mcfo-lobar__status li[data-t=err] { color: #ffb4a0; }
        .mcfo-lobar__status textarea { display: block; width: 100%; margin-top: 6px; font: 11.5px ui-monospace, monospace; word-break: break-all; }
        .mcfo-lob { display: flex; gap: 5px; flex-wrap: wrap; margin-top: 6px; }
        .mcfo-lob__pick { flex: 1; padding: 6px 8px; border-style: dashed; }
        .mcfo-lob__pick[aria-pressed=true] { border-style: solid; background: #1d4a6e; border-color: #5aa0d8; color: #fff; }
    `;

