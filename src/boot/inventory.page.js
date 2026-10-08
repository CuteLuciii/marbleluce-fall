    // The new inventory itself (6.57). It runs in the PAGE of the inventory frame, not in this
    // script's sandbox: the game's preview renderers are ES modules of the page
    // (/immutable-assets/<build>/...), and handing them objects from the sandbox would cross
    // compartments. So this function is turned into source text and put into the frame as a
    // plain <script> by invOverhaulBoot - which means it must not use anything from outside its
    // own body. It talks to the rest of the script only through the DOM: the loadout bar (12e)
    // finds article.inventoryCard[data-id] and the sidebar's aria-current button exactly as it
    // finds them in the game's own inventory.
    //
    // What it uses of the game: the lists and actions of /api/inventory/* (the same requests the
    // game's inventory makes, with the player's own session), and the renderers for the
    // pictures. Nothing is drawn by hand that the game can draw.
    function invOverhaulApp(cfg) {
        const root = document.getElementById('inventory-root');
        if (!root || root.__mi) return;
        root.__mi = true;
        const asset = p => `/immutable-assets/${cfg.build}/${p}`;
        const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
        const RANK = { unique: 0, exclusive: 1, cosmic: 2, ethereal: 3, mythic: 4, legendary: 5, epic: 6, rare: 7, common: 8, default: 9 };
        const LOOK = {   // tile, fill, line - the game's rarity palette; 4th: ground of the picture where it is not the tile
            unique: ['#4a1238', '#ff4fcf', '#ffb3ea', '#7a1a5c'], exclusive: ['#2a2c31', '#ffffff', '#ffffff', '#c3cbd6'],
            cosmic: ['#111013', '#272330', '#514a61'], ethereal: ['#534351', '#c6a0c1', '#e0d2de'],
            mythic: ['#321e1d', '#992824', '#d66a66'], legendary: ['#3d3021', '#bc7824', '#e1b16b'],
            epic: ['#241a2c', '#592285', '#a862e2'], rare: ['#1c2633', '#20569d', '#5da4e1'],
            common: ['#131b14', '#214d24', '#4d8b51'], default: ['#1b2128', '#3a4654', '#8796a6'],
        };
        const rar = i => String((i && i.rarity) || 'default').trim().toLowerCase() || 'default';
        const rarName = r => r.charAt(0).toUpperCase() + r.slice(1);
        const LIGHT = new Set(['exclusive', 'ethereal']);   // pale cards: dark text on them
        const look = r => { const c = LOOK[r] || LOOK.default;
            return `--mi-bg:${c[0]};--mi-fill:${c[1]};--mi-line:${c[2]};--mi-pic:${c[3] || c[0]};--mi-ink:${LIGHT.has(r) ? '#161a21' : '#f4f6f9'}`; };
        const NO_CROWN = 'system_no_crown', NO_CHAT = 'system_no_chat_treatment:';
        const ICON = {
            overview: '<path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z"/>',
            crowns: '<path d="M3 18h18l-1.5-10-4.5 4-3-7-3 7-4.5-4z"/>',
            royal_title: '<path d="M5 5h14v4H5zM8 9v10M16 9v10M6 19h12"/>',
            default_toll: '<circle cx="12" cy="12" r="8"/><path d="M12 8v8M9.5 10.5c0-1.4 5-1.4 5 0s-5 1.6-5 3 5 1.4 5 0"/>',
            wreaths: '<path d="M12 20c-5-1-8-5-8-10M12 20c5-1 8-5 8-10M6 9l-2 1M5 13l-2 0M8 16l-2 1M18 9l2 1M19 13l2 0M16 16l2 1"/>',
            marble_trails: '<circle cx="17" cy="7" r="3.5"/><path d="M14 9c-3 2-6 4-11 9M12 7c-3 1-5 3-8 6"/>',
            marble_borders: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="5"/>',
            bidding_indicator_style: '<circle cx="6" cy="12" r="3.5"/><rect x="11" y="8" width="10" height="8" rx="2"/>',
            rebellion_aura_style: '<circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="9" stroke-dasharray="2 3"/>',
            chat_font_colors: '<path d="M5 19l6-14h2l6 14M8 13h8"/>',
            chat_background_style: '<rect x="3" y="5" width="18" height="12" rx="3"/><path d="M8 17v4l4-4"/>',
            username_style: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-5 15-5 16 0"/>',
            king_chat_bubble_style: '<path d="M4 6h16v10H9l-5 4zM8 9l2 2 2-3 2 3 2-2"/>',
        };
        const icon = id => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[id] || ''}</svg>`;
        // Fetch everything again (6.59): the lists are kept while the page is open, so a crown bought
        // in the shop meanwhile only shows up after this.
        const RELOAD = '<button type="button" class="mi-btn mi-btn--quiet mi-reload" data-mi="reload" title="Load your inventory again">\u21bb Reload</button>';
        // Every page: where its list comes from and how it is equipped.
        const MARBLE = (id, label, endpoint, metaKey, mod, fn, singular, plural, defaultName, extra = {}) =>
            ({ id, label, group: 'Marble', kind: 'marble', url: '/api/inventory/' + endpoint, endpoint, metaKey, mod, fn, singular, plural, defaultName, ...extra });
        const PAGES = [
            { id: 'overview', label: 'Overview', group: '', kind: 'overview' },
            { id: 'crowns', label: 'Crowns', group: 'King', kind: 'crown', url: '/api/inventory/crowns', singular: 'Crown', plural: 'Crowns' },
            { id: 'royal_title', label: 'Royal Title', group: 'King', kind: 'title', url: '/api/inventory/royal-titles', endpoint: 'royal-titles', singular: 'Title', plural: 'Royal Titles' },
            { id: 'default_toll', label: 'Default Toll', group: 'King', kind: 'toll', url: '/api/inventory/default-tolls', endpoint: 'default-tolls', singular: 'Toll', plural: 'Default Tolls' },
            MARBLE('wreaths', 'Wreaths', 'wreaths', 'marbleBorderRecipe', 'marbleBorders/wreathPreview.js', 'renderWreathPreview', 'Wreath', 'Wreaths', 'No Wreath', { group: 'King', wreath: true }),
            MARBLE('marble_trails', 'Marble Trails', 'marble-trails', 'marbleTrailRecipe', 'marbleTrails/productPreview.js', 'renderMarbleTrailPreview', 'Trail', 'Trails', 'No Trail', { companions: ['border'] }),
            MARBLE('marble_borders', 'Marble Borders', 'marble-borders', 'marbleBorderRecipe', 'marbleBorders/productPreview.js', 'renderMarbleBorderPreview', 'Border', 'Borders', 'No Border', { companions: ['trail'] }),
            MARBLE('bidding_indicator_style', 'Bidding Indicators', 'bidding-indicators', 'biddingIndicatorRecipe', 'biddingIndicators/productPreview.js', 'renderBiddingIndicatorPreview', 'Bidding Indicator', 'Bidding Indicators', 'Native default', { wide: true }),
            MARBLE('rebellion_aura_style', 'Rebellion Auras', 'rebellion-auras', 'rebellionAuraRecipe', 'rebellionAuras/productPreview.js', 'renderAuraPreview', 'Aura', 'Auras', 'Default Aura', { companions: ['border', 'trail'], aura: true }),
            { id: 'chat_font_colors', label: 'Chat Font Colors', group: 'Chat', kind: 'font', url: '/api/inventory/chat-font-colors', singular: 'Chat Font Color', plural: 'Chat Font Colors' },
            { id: 'chat_background_style', label: 'Chat Background', group: 'Chat', kind: 'chat', slot: 'chat_background_style', singular: 'Chat Background', plural: 'Chat Backgrounds' },
            { id: 'username_style', label: 'Username Style', group: 'Chat', kind: 'chat', slot: 'username_style', singular: 'Username Style', plural: 'Username Styles' },
            { id: 'king_chat_bubble_style', label: 'King Chat Bubble', group: 'Chat', kind: 'chat', slot: 'king_chat_bubble_style', singular: 'King Chat Bubble', plural: 'King Chat Bubbles', king: true },
        ];
        for (const p of PAGES) if (p.kind === 'chat') p.url = '/api/inventory/chat-cosmetics?slotType=' + p.slot;
        const PAGE = Object.fromEntries(PAGES.map(p => [p.id, p]));
        const requested = new URLSearchParams(location.search).get('page');
        const st = {
            page: PAGE[requested] ? requested : 'overview',
            data: new Map(),          // page -> server answer
            loading: new Map(),       // page -> promise
            focus: new Map(),         // page -> item id
            filter: new Map(),        // page -> { q, rarity, eq, pool, sort }
            busy: false, msg: '', msgTone: '',
            arm: '',                  // two-click confirm (clear pool)
            fullTile: false,          // crown preview: portrait or the whole king tile
        };
        let mods = null;
        const handles = new Set();    // previews drawn, to stop them when a page is left
        const thumbs = new Map();     // card host -> handle
        let io = null;

        // ---- server -------------------------------------------------------------------------
        async function api(path, opts = {}) {
            const res = await fetch(path, { credentials: 'same-origin', headers: { Accept: 'application/json', ...(opts.body ? { 'Content-Type': 'application/json' } : {}) }, ...opts });
            const body = await res.json().catch(() => null);
            if (!res.ok || (body && body.ok === false)) {
                const e = new Error(String((body && (body.error || body.reason)) || 'request_failed_' + res.status));
                e.status = res.status;
                throw e;
            }
            return body || {};
        }
        function load(id, again) {
            const p = PAGE[id];
            if (!p || !p.url) return Promise.resolve(null);
            if (!again && st.data.has(id)) return Promise.resolve(st.data.get(id));
            if (!again && st.loading.has(id)) return st.loading.get(id);
            const pr = api(p.url).then(d => { st.data.set(id, d); st.loading.delete(id); return d; },
                e => { st.loading.delete(id); throw e; });
            st.loading.set(id, pr);
            return pr;
        }

        // ---- what a page holds, in one shape ---------------------------------------------------
        function model(id) {
            const p = PAGE[id], d = st.data.get(id);
            if (!d) return null;
            const m = { p, d, items: [], sel: new Set(), pool: new Set(), random: false, poolLimit: 10, contexts: [] };
            if (p.kind === 'crown') {
                const seen = new Set();
                m.items = (d.availableCrownItems || []).filter(i => { const k = String(i && i.inventoryItemId || ''); if (!k || seen.has(k)) return false; seen.add(k); return true; });
                m.sel.add(String(d.selectedInventoryItemId || NO_CROWN));
                (d.randomPoolInventoryItemIds || []).forEach(x => m.pool.add(String(x)));
                m.random = d.randomEnabled === true;
                m.poolLimit = Math.max(0, Math.trunc(Number(d.randomPoolLimit || 10) || 10));
            } else if (p.kind === 'marble') {
                const eq = d.equipment || {};
                m.items = d.items || [];
                if (eq.inventoryItemId) m.sel.add(String(eq.inventoryItemId));
                (eq.poolItemIds || []).forEach(x => m.pool.add(String(x)));
                m.random = eq.randomEnabled === true;
            } else if (p.kind === 'chat') {
                m.items = d.availableItems || [];
                const none = m.items.find(i => String(i.inventoryItemId).startsWith(NO_CHAT));
                m.sel.add(String(d.selectedInventoryItemId || (none ? none.inventoryItemId : '')));
            } else if (p.kind === 'font') {
                m.items = d.availableItems || [];
                const none = m.items.find(i => String(i.inventoryItemId).startsWith(NO_CHAT));
                const noneId = none ? String(none.inventoryItemId) : '';
                m.ordinary = String(d.ordinarySelectedInventoryItemId || noneId);
                m.king = String(d.kingSelectedInventoryItemId || noneId);
                m.sel.add(m.ordinary); m.sel.add(m.king);
            } else {
                m.items = d.availableItems || [];
                m.contexts = d.contexts || [];
                m.contexts.forEach(c => m.sel.add(String(c.selectedInventoryItemId || '')));
                if (p.kind === 'toll') {
                    const v = i => (i.metadata && i.metadata.tollValue === 'no_change') ? Infinity : Number(i.metadata && i.metadata.tollValue);
                    m.items = [...m.items].sort((a, b) => v(a) - v(b));
                }
            }
            m.byId = new Map(m.items.map(i => [String(i.inventoryItemId), i]));
            m.player = d.viewer || d.player || {};
            return m;
        }
        const itemId = i => String((i && i.inventoryItemId) || '');
        const isSystem = (m, i) => !!(i && (i.systemDefault || itemId(i) === NO_CROWN || itemId(i).startsWith(NO_CHAT)));
        const pooled = m => m.p.kind === 'crown' || m.p.kind === 'marble';
        function filterOf(id) {
            if (!st.filter.has(id)) st.filter.set(id, { q: '', rarity: '', eq: false, pool: false, sort: 'rarity' });
            return st.filter.get(id);
        }
        function visibleItems(m) {
            const f = filterOf(m.p.id), q = f.q.trim().toLowerCase();
            let list = m.items.filter(i => (!f.rarity || rar(i) === f.rarity)
                && (!q || String(i.displayName || '').toLowerCase().includes(q))
                && (!f.eq || m.sel.has(itemId(i)))
                && (!f.pool || m.pool.has(itemId(i))));
            if (m.p.kind === 'toll') return list;   // their own order: by value
            const name = (a, b) => String(a.displayName || '').localeCompare(String(b.displayName || ''));
            const sys = i => isSystem(m, i) ? 0 : 1;   // No Crown / No Treatment first
            list = [...list].sort((a, b) => sys(a) - sys(b) || (f.sort === 'name' ? name(a, b)
                : f.sort === 'rarity-asc' ? (RANK[rar(b)] ?? 9) - (RANK[rar(a)] ?? 9) || name(a, b)
                : (RANK[rar(a)] ?? 9) - (RANK[rar(b)] ?? 9) || name(a, b)));
            return list;
        }
        function focusItem(m) {
            const want = st.focus.get(m.p.id);
            return (want && m.byId.get(want)) || m.items.find(i => m.sel.has(itemId(i))) || visibleItems(m)[0] || m.items[0] || null;
        }

        // ---- renderers ----------------------------------------------------------------------------
        async function loadMods() {
            const get = p => import(asset(p));
            const list = await Promise.all([
                get('crownItemPreview.js'), get('kingTilePreviewRenderer.js'), get('chatCosmeticPreview.js'),
                get('marbleBorders/productPreview.js'), get('marbleTrails/productPreview.js'), get('rebellionAuras/productPreview.js'),
                get('biddingIndicators/productPreview.js'), get('marbleBorders/wreathPreview.js'),
                get('marbleBorders/companionTrail.js'), get('marbleBorders/companionBorder.js'), get('cosmeticProvenance.js'),
                get('crownComponentLabels.js'), get('chatCosmeticLabels.js'), get('marbleBorders/componentLabels.js'),
                get('marbleTrails/componentLabels.js'), get('rebellionAuras/componentLabels.js'), get('biddingIndicators/componentLabels.js'),
            ]);
            const all = Object.assign({}, ...list);
            if (typeof all.renderCrownItemPreview !== 'function' || typeof all.renderChatCosmeticPreview !== 'function') throw new Error('renderers_changed');
            return all;
        }
        const safe = (fn, fallback = '') => { try { const v = fn(); return v == null ? fallback : v; } catch (e) { return fallback; } };
        function keep(h) { if (h && typeof h.destroy === 'function') handles.add(h); return h; }
        function stopAll() {
            for (const h of handles) safe(() => h.destroy());
            handles.clear();
            thumbs.clear();
            if (io) { io.disconnect(); io = null; }
        }
        // One picture: small (card / overview tile) or the big one in the detail column.
        function draw(host, m, item, big) {
            if (!host || !item) return;
            const p = m.p;
            host.textContent = '';
            try {
                if (p.kind === 'crown') {
                    if (isSystem(m, item) && !big) { host.innerHTML = '<div class="mi-none">No Crown</div>'; return; }
                    if (big && !st.fullTile) return void mods.renderKingPfpCrownPreview(host, { player: m.player, kingCosmetics: { crown: isSystem(m, item) ? null : item }, mode: 'shop_crown_preview' });
                    if (big) return void mods.renderKingTilePreview(host, { kingCosmetics: { crown: item }, player: m.player, mode: 'inventory_focus' });
                    return void mods.renderCrownItemPreview(host, { crown: item, presentationMode: 'inventory_card' });
                }
                if (p.kind === 'chat' || p.kind === 'font') {
                    const o = { baseProjection: m.d.projection, playerName: (m.player && m.player.displayName) || 'Player', allowMotion: !!big };
                    if (!big) return void mods.renderChatCosmeticPreview(host, item, { ...o, compact: true });
                    if (p.kind === 'font') {
                        host.innerHTML = '<div class="mi-pair"><div><span>Ordinary chat</span><div data-a></div></div><div><span>King chat</span><div data-b></div></div></div>';
                        void mods.renderChatCosmeticPreview(host.querySelector('[data-a]'), item, { ...o, compareKing: false });
                        void mods.renderChatCosmeticPreview(host.querySelector('[data-b]'), item, { ...o, compareKing: false, simulateKing: true, showStateLabel: true });
                        return;
                    }
                    return void mods.renderChatCosmeticPreview(host, item, { ...o, simulateKing: !!p.king, showStateLabel: !!p.king });
                }
                if (p.kind === 'marble') {
                    const fn = mods[p.fn];
                    const recipe = item.metadata ? item.metadata[p.metaKey] : null;
                    const eq = (m.d.equipment || {});
                    const context = { player: m.player, crown: m.d.crown || null, wreathRotationDirection: eq.rotationDirection || 'clockwise' };
                    const c = m.comp || {};
                    // Borders big: the compact drawing, cut to the marble (zoomTo). The full one resizes
                    // itself with its box and keeps the marble small in the middle of a wide field.
                    const still = !big || p.id === 'marble_borders' || p.wreath;   // wreath full = the whole king tile
                    keep(fn(host, recipe, { compact: still, context, companionBorder: c.border && c.border.recipe, companionTrail: (big && !still) || p.aura ? c.trail && c.trail.recipe : null }));
                    if (big && p.id === 'marble_borders') requestAnimationFrame(() => setTimeout(() => zoomTo(host.querySelector(':scope > svg')), 120));
                    requestAnimationFrame(() => clearGround(host));
                }
            } catch (e) {
                host.innerHTML = '<div class="mi-none">Preview unavailable</div>';
            }
        }

        // The big border picture: the renderer leaves the marble small in a wide field. The viewBox
        // is cut to what is drawn, measured on screen (that counts every transform), plus a margin.
        function zoomTo(svg) {
            const vb = svg && svg.viewBox && svg.viewBox.baseVal;
            if (!vb || !vb.width || !svg.isConnected) return;
            const R = svg.getBoundingClientRect();
            if (!R.width) return;
            let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
            for (const el of svg.children) {
                if (el.tagName === 'defs') continue;
                const r = el.getBoundingClientRect();
                if (!r.width || (el.tagName === 'rect' && r.width >= R.width * 0.9)) continue;   // the background
                x0 = Math.min(x0, r.left); y0 = Math.min(y0, r.top); x1 = Math.max(x1, r.right); y1 = Math.max(y1, r.bottom);
            }
            if (!(x1 > x0)) return;
            const ctm = svg.getScreenCTM();
            if (!ctm) return;
            const inv = ctm.inverse();
            const p0 = new DOMPoint(x0, y0).matrixTransform(inv), p1 = new DOMPoint(x1, y1).matrixTransform(inv);
            const bx = p0.x, by = p0.y, bw = p1.x - p0.x, bh = p1.y - p0.y;
            const side = Math.max(bw, bh) * 1.25;
            svg.setAttribute('viewBox', `${bx + bw / 2 - side / 2} ${by + bh / 2 - side / 2} ${side} ${side}`);
        }

        // The marble renderers lay a dark square under their picture (a rect over the whole viewBox);
        // it would hide the rarity colour behind the picture. Trails draw theirs into one image -
        // that one stays.
        function clearGround(host) {
            const svg = host && host.querySelector(':scope > svg');
            const vb = svg && svg.viewBox && svg.viewBox.baseVal;
            if (!vb || !vb.width) return;
            for (const r of svg.querySelectorAll(':scope > rect')) {
                const w = r.width && r.width.baseVal;
                const full = (w && w.unitType === 2 && w.valueInSpecifiedUnits >= 90) || (w && w.value >= vb.width * 0.9);
                if (full) r.style.fill = 'transparent';
            }
        }

        // ---- layout ------------------------------------------------------------------------------
        root.innerHTML = `<div class="mi">
            <aside class="mi-side" aria-label="Inventory"></aside>
            <section class="mi-main"><div class="mi-head"></div><div class="mi-body"></div></section>
            <aside class="mi-detail"></aside>
        </div>`;
        const $side = root.querySelector('.mi-side'), $head = root.querySelector('.mi-head'),
              $body = root.querySelector('.mi-body'), $detail = root.querySelector('.mi-detail'), $mi = root.querySelector('.mi');

        function drawSide() {
            let html = '', group = null;
            for (const p of PAGES) {
                if (p.group !== group) { if (group !== null) html += '</div>'; group = p.group; html += `<div class="mi-group">${group ? `<h2>${esc(group)}</h2>` : ''}`; }
                const m = p.url && st.data.has(p.id) ? model(p.id) : null;
                const n = m ? m.items.filter(i => !isSystem(m, i)).length : '';
                html += `<button type="button" class="inventorySubcategoryButton mi-nav" data-subpage="${p.id}" data-page="${p.id}" aria-current="${st.page === p.id ? 'page' : 'false'}">
                    ${icon(p.id)}<span>${esc(p.label)}</span><i>${n}</i></button>`;
            }
            html += '</div><div class="mi-side__foot"><button type="button" class="mi-link" data-mi="classic">Classic inventory</button></div>';
            $side.innerHTML = html;
        }
        $side.addEventListener('click', e => {
            const b = e.target.closest('[data-page], [data-mi]');
            if (!b) return;
            if (b.dataset.mi === 'classic') { const u = new URL(location.href); u.searchParams.set('mlf', 'classic'); location.href = u.href; return; }
            go(b.dataset.page);
        });
        function go(id, focusId) {
            if (!PAGE[id]) return;
            if (focusId) st.focus.set(id, focusId);
            st.page = id; st.msg = ''; st.arm = '';
            const u = new URL(location.href); u.searchParams.set('page', id); history.replaceState(null, '', u);
            render();
        }

        // ---- the page ------------------------------------------------------------------------
        let renderGen = 0;
        async function render() {
            const gen = ++renderGen;
            stopAll();
            drawSide();
            const p = PAGE[st.page];
            $mi.dataset.page = p.id;
            $mi.toggleAttribute('data-overview', p.kind === 'overview');
            if (p.kind === 'overview') return renderOverview(gen);
            $head.innerHTML = ''; $detail.innerHTML = '';
            $body.innerHTML = '<div class="mi-status">Loading ' + esc(p.label) + ' …</div>';
            try {
                await load(p.id);
                if (p.companions) await Promise.all(p.companions.map(c => load(c === 'trail' ? 'marble_trails' : 'marble_borders').catch(() => null)));
            } catch (e) { if (gen === renderGen) $body.innerHTML = errorBox(e); return; }
            if (gen !== renderGen) return;
            drawSide();
            drawHead(); drawGrid(); drawDetail();
        }
        function errorBox(e) {
            const signedOut = e && (e.status === 401 || e.status === 403);
            return `<div class="mi-status"><b>${signedOut ? 'Sign in to view your inventory' : 'The inventory did not answer'}</b>
                <span>${signedOut ? 'The inventory opens for a signed-in player.' : esc(e && e.message)}</span>
                <button type="button" class="mi-btn" data-mi="retry">Try again</button></div>`;
        }
        function cur() { const m = model(st.page); if (m) m.comp = m.p.kind === 'marble' ? safe(() => companionsSync(m.p), {}) : {}; return m; }
        function companionsSync(p) {
            const out = {};
            for (const c of p.companions || []) {
                if (c === 'trail' && st.data.has('marble_trails')) out.trail = safe(() => mods.previewCompanionTrail(st.data.get('marble_trails')), null);
                if (c === 'border' && st.data.has('marble_borders')) out.border = safe(() => mods.previewCompanionBorder(st.data.get('marble_borders')), null);
            }
            return out;
        }

        // Header: title, counts, the page-wide controls (random, pool, default), then the filters.
        function drawHead() {
            const m = cur(), p = m.p, f = filterOf(p.id);
            const owned = m.items.filter(i => !isSystem(m, i)).length;
            const groups = new Map();
            for (const i of m.items) { const r = rar(i); groups.set(r, (groups.get(r) || 0) + 1); }
            const rars = [...groups.keys()].sort((a, b) => (RANK[a] ?? 9) - (RANK[b] ?? 9));
            let ctl = '';
            if (pooled(m)) {
                ctl += `<button type="button" class="mi-btn" data-act="random" aria-pressed="${m.random}">Random ${m.random ? 'on' : 'off'}</button>
                    <span class="mi-chip mi-chip--info">Pool ${m.pool.size}/${p.kind === 'crown' ? m.poolLimit : 10}</span>
                    <button type="button" class="mi-btn mi-btn--quiet" data-act="clear" ${m.pool.size ? '' : 'disabled'}>${st.arm === 'clear' ? 'Sure? Empty the pool' : 'Empty pool'}</button>`;
                if (p.kind === 'marble') ctl += `<button type="button" class="mi-btn mi-btn--quiet" data-act="none" aria-pressed="${!m.sel.size && !m.random}">${esc(p.defaultName)}</button>`;
                if (p.wreath) {
                    const dir = (m.d.equipment || {}).rotationDirection || 'clockwise';
                    ctl += `<label class="mi-sel">Rotation <select data-act="rotation">${[['clockwise', 'Clockwise'], ['counterclockwise', 'Counterclockwise'], ['none', 'None']].map(([v, l]) => `<option value="${v}" ${dir === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>`;
                }
            }
            if (m.contexts.length) {
                ctl += m.contexts.map(c => `<span class="mi-chip mi-chip--info">${esc(c.label)}: <b>${esc((m.byId.get(String(c.selectedInventoryItemId)) || {}).displayName || '—')}</b></span>`).join('');
            }
            if (p.kind === 'font') {
                ctl += `<span class="mi-chip mi-chip--info">Ordinary: <b>${esc((m.byId.get(m.ordinary) || {}).displayName || 'No Treatment')}</b></span>
                    <span class="mi-chip mi-chip--info">King: <b>${esc((m.byId.get(m.king) || {}).displayName || 'No Treatment')}</b></span>`;
            }
            const sorts = p.kind === 'toll' ? '' : `<label class="mi-sel">Sort <select data-f="sort">
                ${[['rarity', 'Rarest first'], ['rarity-asc', 'Commonest first'], ['name', 'Name']].map(([v, l]) => `<option value="${v}" ${f.sort === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>`;
            $head.innerHTML = `<div class="mi-title"><span class="mi-title__icon">${icon(p.id)}</span><h1>${esc(p.plural || p.label)}</h1><span class="mi-count">${owned} owned</span>
                    <div class="mi-ctl">${ctl}${RELOAD}</div></div>
                <div class="mi-filters">
                    <input type="search" class="mi-search" data-f="q" placeholder="Search ${esc((p.plural || p.label).toLowerCase())}" value="${esc(f.q)}">
                    ${rars.length ? `<div class="mi-rars"><button type="button" class="mi-rar" data-rar="" aria-pressed="${!f.rarity}">All <i>${m.items.length}</i></button>${rars.map(r =>
                        `<button type="button" class="mi-rar" data-rar="${r}" style="${look(r)}" aria-pressed="${f.rarity === r}"><b></b>${rarName(r)} <i>${groups.get(r)}</i></button>`).join('')}</div>` : ''}
                    <button type="button" class="mi-rar" data-f="eq" aria-pressed="${f.eq}">Equipped</button>
                    ${pooled(m) ? `<button type="button" class="mi-rar" data-f="pool" aria-pressed="${f.pool}">In pool</button>` : ''}
                    ${sorts}
                </div>
                ${st.msg ? `<div class="mi-msg" data-tone="${st.msgTone}">${esc(st.msg)}</div>` : ''}`;
        }
        $head.addEventListener('input', e => {
            const t = e.target;
            if (t.dataset.f === 'q') { filterOf(st.page).q = t.value; drawGrid(); }
        });
        $head.addEventListener('change', e => {
            const t = e.target;
            if (t.dataset.f === 'sort') { filterOf(st.page).sort = t.value; drawGrid(); }
            if (t.dataset.act === 'rotation') act('rotation', null, t.value);
        });
        $head.addEventListener('click', e => {
            const b = e.target.closest('button');
            if (!b) return;
            if (b.dataset.mi === 'reload') { st.data.clear(); render(); return; }
            const f = filterOf(st.page);
            if (b.hasAttribute('data-rar')) { f.rarity = b.dataset.rar; drawHead(); drawGrid(); return; }
            if (b.dataset.f === 'eq' || b.dataset.f === 'pool') { f[b.dataset.f] = !f[b.dataset.f]; drawHead(); drawGrid(); return; }
            if (b.dataset.act) act(b.dataset.act);
        });

        // The cards. Pictures are drawn when a card scrolls into view.
        function drawGrid() {
            const m = cur(), p = m.p;
            for (const h of thumbs.values()) { safe(() => h && h.destroy && h.destroy()); handles.delete(h); }
            thumbs.clear();
            if (io) io.disconnect();
            const list = visibleItems(m), fid = itemId(focusItem(m));
            const textOnly = p.kind === 'title' || p.kind === 'toll';
            $body.innerHTML = list.length ? `<div class="mi-grid${p.wide ? ' mi-grid--wide' : ''}${textOnly ? ' mi-grid--text' : ''}${p.kind === 'chat' || p.kind === 'font' ? ' mi-grid--chat' : ''}">${list.map(i => card(m, i, fid, textOnly)).join('')}</div>`
                : '<div class="mi-status"><span>Nothing matches these filters.</span></div>';
            if (textOnly) return;
            io = new IntersectionObserver(entries => {
                for (const en of entries) {
                    if (!en.isIntersecting) continue;
                    const host = en.target;
                    io.unobserve(host);
                    const item = m.byId.get(host.dataset.thumb);
                    draw(host, cur(), item, false);
                    thumbs.set(host, null);
                }
            }, { rootMargin: '300px' });
            $body.querySelectorAll('[data-thumb]').forEach(h => io.observe(h));
        }
        function badges(m, i) {
            const id = itemId(i), out = [];
            if (m.p.kind === 'font') { if (m.ordinary === id) out.push(['eq', 'Chat']); if (m.king === id) out.push(['eq', 'King']); }
            else if (m.contexts.length) m.contexts.forEach(c => { if (String(c.selectedInventoryItemId) === id) out.push(['eq', c.label]); });
            else if (m.sel.has(id) && !(m.random && pooled(m))) out.push(['eq', 'Equipped']);
            if (m.pool.has(id)) out.push(['pool', 'Pool']);
            return out.map(([t, l]) => `<span class="mi-badge" data-tone="${t}">${esc(l)}</span>`).join('');
        }
        function card(m, i, fid, textOnly) {
            const id = itemId(i), r = rar(i);
            if (textOnly) {
                // Titles and tolls: the name is the card; the occasions it is used for underneath, short.
                const ctx = m.contexts.filter(c => String(c.selectedInventoryItemId) === id)
                    .map(c => `<span class="mi-badge" data-tone="eq">${esc(String(c.label).replace(/\s+default$/i, ''))}</span>`).join('');
                return `<article class="inventoryCard mi-card mi-card--text" data-id="${esc(id)}" data-rarity="${esc(r)}" style="${look(r)}" aria-selected="${id === fid}" tabindex="0">
                    <div class="mi-thumb mi-thumb--text">${esc(i.displayName)}</div><h3>${esc(i.displayName || id)}</h3>
                    <div class="mi-card__foot"><span class="mi-card__rar">${r === 'default' ? '' : esc(rarName(r))}</span></div>
                    <div class="mi-ctx">${ctx}</div></article>`;
            }
            return `<article class="inventoryCard mi-card" data-id="${esc(id)}" data-rarity="${esc(r)}" style="${look(r)}" aria-selected="${id === fid}" tabindex="0">
                <div class="mi-thumb" data-thumb="${esc(id)}"></div>
                <h3>${esc(i.displayName || id)}</h3>
                <div class="mi-card__foot"><span class="mi-dot"></span><span class="mi-card__rar">${r === 'default' ? '' : esc(rarName(r))}</span><span class="mi-badges">${badges(m, i)}</span></div>
            </article>`;
        }
        $body.addEventListener('click', e => {
            if (e.target.closest('.mcfo-lob')) return;   // the loadout buttons (12e) have their own handler
            if (e.target.closest('[data-mi=retry]')) { render(); return; }
            const c = e.target.closest('.mi-card');
            if (!c) return;
            st.focus.set(st.page, c.dataset.id);
            $body.querySelectorAll('.mi-card[aria-selected=true]').forEach(x => x.setAttribute('aria-selected', 'false'));
            c.setAttribute('aria-selected', 'true');
            drawDetail();
        });
        $body.addEventListener('dblclick', e => {
            const c = e.target.closest('.mi-card');
            if (c && !e.target.closest('.mcfo-lob')) act('equip', c.dataset.id);
        });
        $body.addEventListener('keydown', e => {
            const c = e.target.closest && e.target.closest('.mi-card');
            if (!c) return;
            if (e.key === 'Enter') { e.preventDefault(); act('equip', c.dataset.id); }
            if (e.key === ' ') { e.preventDefault(); c.click(); }
        });

        // The detail column: big picture, name, rarity, where it came from, what it is made of, actions.
        let detailHandles = [];
        function drawDetail() {
            for (const h of detailHandles) { safe(() => h.destroy()); handles.delete(h); }
            detailHandles = [];
            const m = cur(), p = m.p, i = focusItem(m);
            if (!i) { $detail.innerHTML = '<div class="mi-status"><span>No item selected.</span></div>'; return; }
            const id = itemId(i), r = rar(i);
            const comp = safe(() => p.kind === 'crown' ? mods.renderCrownComponents(i)
                : p.kind === 'chat' || p.kind === 'font' ? mods.renderChatCosmeticComponents(i)
                : p.aura ? mods.renderAuraComponents(i) : p.id === 'bidding_indicator_style' ? mods.renderBiddingIndicatorComponents(i)
                : p.wreath ? mods.renderWreathComponents(i) : p.id === 'marble_trails' ? mods.renderTrailComponents(i)
                : p.kind === 'marble' ? mods.renderBorderComponents(i) : '', '');
            const prov = safe(() => mods.renderCosmeticProvenance(i), '');
            let actions = '';
            if (p.kind === 'title' || p.kind === 'toll') {
                actions = m.contexts.map(c => { const on = String(c.selectedInventoryItemId) === id;
                    return `<button type="button" class="mi-btn${on ? ' mi-btn--on' : ''}" data-act="context" data-slot="${esc(c.slotType)}" ${on ? 'disabled' : ''}>${on ? '✓ ' : ''}${esc(c.label)}</button>`; }).join('');
                const unlock = i.unlock && i.unlock.kind === 'achievement' ? (i.unlock.title ? `Unlocked by the “${esc(i.unlock.title)}” achievement.` : 'Unlocked by an achievement.')
                    : (i.metadata && i.metadata.unlockDescription) ? esc(i.metadata.unlockDescription) : 'Included for every player';
                actions = `<p class="mi-note">Use it for</p><div class="mi-actions">${actions}</div><p class="mi-note">${unlock}</p>`;
            } else if (p.kind === 'font') {
                actions = `<div class="mi-actions">
                    <button type="button" class="mi-btn mi-btn--main" data-act="font" data-slot="ordinary" ${m.ordinary === id ? 'disabled' : ''}>${m.ordinary === id ? '✓ Ordinary chat' : 'Use in ordinary chat'}</button>
                    <button type="button" class="mi-btn mi-btn--main" data-act="font" data-slot="king" ${m.king === id ? 'disabled' : ''}>${m.king === id ? '✓ King chat' : 'Use in King chat'}</button></div>`;
            } else {
                const eq = m.sel.has(id) && !(pooled(m) && m.random);
                const poolBtn = pooled(m) && !isSystem(m, i)
                    ? `<button type="button" class="mi-btn" data-act="pool" ${!m.pool.has(id) && m.pool.size >= (p.kind === 'crown' ? m.poolLimit : 10) ? 'disabled' : ''}>${m.pool.has(id) ? '− Remove from pool' : '+ Add to pool'}</button>` : '';
                actions = `<div class="mi-actions"><button type="button" class="mi-btn mi-btn--main" data-act="equip" ${eq ? 'disabled' : ''}>${eq ? '✓ Equipped' : 'Equip'}</button>${poolBtn}</div>`;
            }
            const tabs = p.kind === 'crown' ? `<div class="mi-tabs"><button type="button" data-act="tile" aria-pressed="${!st.fullTile}" data-v="0">Portrait</button><button type="button" data-act="tile" aria-pressed="${st.fullTile}" data-v="1">King tile</button></div>` : '';
            const textOnly = p.kind === 'title' || p.kind === 'toll';
            $detail.innerHTML = `<div class="mi-detail__inner" style="${look(r)}">
                ${tabs}
                ${textOnly ? `<div class="mi-big mi-big--text">${esc(i.displayName)}</div>` : `<div class="mi-big mi-big--${p.kind}${st.fullTile && p.kind === 'crown' ? ' mi-big--tile' : ''}${p.wide ? ' mi-big--wide' : ''}"></div>`}
                <h2>${esc(i.displayName || id)}</h2>
                ${r !== 'default' ? `<span class="mi-pill">${esc(rarName(r))}</span>` : ''}
                ${actions}
                <div class="mi-meta">${prov}${comp}</div>
            </div>`;
            if (!textOnly) {
                const host = $detail.querySelector('.mi-big');
                const before = handles.size;
                draw(host, m, i, true);
                if (handles.size > before) detailHandles = [...handles].slice(before);
            }
        }
        $detail.addEventListener('click', e => {
            const b = e.target.closest('button[data-act]');
            if (!b) return;
            if (b.dataset.act === 'tile') { st.fullTile = b.dataset.v === '1'; drawDetail(); return; }
            const m = cur(), i = focusItem(m);
            act(b.dataset.act, itemId(i), b.dataset.slot);
        });

        // ---- actions: the same requests as the game's inventory -------------------------------------
        async function act(kind, id, extra) {
            if (st.busy) return;
            const m = cur(), p = m.p, d = m.d;
            if (kind === 'clear' && st.arm !== 'clear') { st.arm = 'clear'; drawHead(); setTimeout(() => { if (st.arm === 'clear') { st.arm = ''; drawHead(); } }, 4000); return; }
            st.arm = '';
            const item = id ? m.byId.get(id) : null;
            const post = (path, body, method = 'POST') => api(path, { method, body: JSON.stringify(body || {}) });
            st.busy = true; $mi.setAttribute('data-busy', '');
            try {
                if (p.kind === 'crown') {
                    const base = '/api/inventory/crowns';
                    if (kind === 'equip') { await post(base + '/selected', { inventoryItemId: id }); d.selectedInventoryItemId = id; }
                    if (kind === 'random') { await post(base + '/random-enabled', { enabled: !m.random }); d.randomEnabled = !m.random; }
                    if (kind === 'pool') {
                        const has = m.pool.has(id);
                        await api(base + '/random-pool/' + encodeURIComponent(id), { method: has ? 'DELETE' : 'POST' });
                        const next = new Set(m.pool); if (has) next.delete(id); else next.add(id);
                        d.randomPoolInventoryItemIds = [...next];
                    }
                    if (kind === 'clear') { const r = await post(base + '/random-pool/clear', {}); d.randomPoolInventoryItemIds = (r.equipment && r.equipment.poolItemIds) || []; }
                } else if (p.kind === 'marble') {
                    const base = '/api/inventory/' + p.endpoint + '/';
                    let r = null;
                    if (kind === 'equip') r = await post(base + 'selected', { inventoryItemId: id });
                    if (kind === 'none') r = await post(base + 'selected', { inventoryItemId: null });
                    if (kind === 'random') r = await post(base + 'random-enabled', { enabled: !m.random });
                    if (kind === 'pool') r = await post(base + 'random-pool/' + encodeURIComponent(id), {}, m.pool.has(id) ? 'DELETE' : 'POST');
                    if (kind === 'clear') r = await post(base + 'random-pool/clear', {});
                    if (kind === 'rotation') r = await post(base + 'rotation', { direction: extra });
                    if (r && r.equipment) d.equipment = r.equipment;
                    else if (r) await load(p.id, true);
                } else if (p.kind === 'chat') {
                    if (kind === 'equip') { await post('/api/inventory/chat-cosmetics/selected', { slotType: p.slot, inventoryItemId: isSystem(m, item) ? null : id }); await load(p.id, true); }
                } else if (p.kind === 'font') {
                    if (kind === 'font' || kind === 'equip') {
                        const which = kind === 'equip' ? 'ordinary' : extra;
                        await post(`/api/inventory/chat-font-colors/${which}-selected`, { inventoryItemId: isSystem(m, item) ? null : id });
                        await load(p.id, true);
                    }
                } else if (kind === 'context' || kind === 'equip') {
                    const slot = kind === 'equip' ? (m.contexts[0] && m.contexts[0].slotType) : extra;
                    if (slot) { await post(`/api/inventory/${p.endpoint}/selected`, { slotType: slot, inventoryItemId: id }); await load(p.id, true); }
                }
                st.msg = '';
            } catch (e) {
                st.msg = 'That did not work: ' + (e && e.message || 'error'); st.msgTone = 'error';
            } finally {
                st.busy = false; $mi.removeAttribute('data-busy');
            }
            if (st.page !== p.id) return;
            drawHead(); refreshCards(); drawDetail(); drawSide();
        }
        // After an action only the badges and the selection change - the cards and their pictures stay.
        function refreshCards() {
            const m = cur();
            const f = filterOf(m.p.id);
            if (f.eq || f.pool) { drawGrid(); return; }
            const fid = itemId(focusItem(m));
            $body.querySelectorAll('.mi-card').forEach(c => {
                const i = m.byId.get(c.dataset.id);
                if (!i) return;
                if (c.classList.contains('mi-card--text')) {
                    const fresh = card(m, i, '', true), t = document.createElement('template');
                    t.innerHTML = fresh.trim();
                    const ctx = c.querySelector('.mi-ctx'), nctx = t.content.querySelector('.mi-ctx');
                    if (ctx && nctx && ctx.innerHTML !== nctx.innerHTML) ctx.innerHTML = nctx.innerHTML;
                } else {
                    const b = c.querySelector('.mi-badges');
                    const html = badges(m, i);
                    if (b && b.innerHTML !== html) b.innerHTML = html;
                }
                c.setAttribute('aria-selected', String(c.dataset.id === fid));
            });
        }

        // ---- overview: everything you wear, one tile per slot --------------------------------------
        const SLOTS = [
            ['crowns', 'Crown'], ['wreaths', 'Wreath'], ['royal_title', 'Royal Title'], ['default_toll', 'Default Toll'],
            ['marble_borders', 'Border'], ['marble_trails', 'Trail'], ['bidding_indicator_style', 'Bidding Indicator'], ['rebellion_aura_style', 'Rebellion Aura'],
            ['chat_font_colors', 'Chat Font Color'], ['chat_background_style', 'Chat Background'], ['username_style', 'Username Style'], ['king_chat_bubble_style', 'King Chat Bubble'],
        ];
        async function renderOverview(gen) {
            $detail.innerHTML = '';
            $head.innerHTML = `<div class="mi-title"><span class="mi-title__icon">${icon('overview')}</span><h1>What you wear</h1><span class="mi-count">Click a slot to change it</span><div class="mi-ctl">${RELOAD}</div></div>`;
            const groups = [['King', SLOTS.slice(0, 4)], ['Marble', SLOTS.slice(4, 8)], ['Chat', SLOTS.slice(8)]];
            $body.innerHTML = `<div class="mi-over">${groups.map(([g, slots]) => `<section><h2>${g}</h2><div class="mi-over__grid">${slots.map(([id, label]) =>
                `<button type="button" class="mi-slot" data-slot="${id}"><span class="mi-slot__label">${icon(id)}${esc(label)}</span><div class="mi-slot__pic"><div class="mi-status"><span>…</span></div></div><b class="mi-slot__name"></b><span class="mi-slot__sub"></span></button>`).join('')}</div></section>`).join('')}</div>`;
            const order = ['crowns', 'marble_borders', 'marble_trails', ...SLOTS.map(s => s[0])];
            const queue = [...new Set(order)];
            const fill = id => {
                if (gen !== renderGen) return;
                const tile = $body.querySelector(`.mi-slot[data-slot="${id}"]`);
                if (!tile) return;
                const m = model(id);
                if (!m) { tile.querySelector('.mi-slot__pic').innerHTML = '<div class="mi-none">Unavailable</div>'; return; }
                if (m.p.kind === 'marble') m.comp = companionsSync(m.p);
                const name = tile.querySelector('.mi-slot__name'), sub = tile.querySelector('.mi-slot__sub'), pic = tile.querySelector('.mi-slot__pic');
                let item = null, text = '', note = '';
                if (m.contexts.length) {
                    text = m.contexts.map(c => `${c.label}: ${(m.byId.get(String(c.selectedInventoryItemId)) || {}).displayName || '—'}`).join(' · ');
                    pic.innerHTML = `<div class="mi-slot__text">${m.contexts.map(c => `<div><span>${esc(c.label)}</span><b>${esc((m.byId.get(String(c.selectedInventoryItemId)) || {}).displayName || '—')}</b></div>`).join('')}</div>`;
                    name.textContent = ''; sub.textContent = '';
                    return;
                }
                if (m.p.kind === 'font') {
                    item = m.byId.get(m.ordinary);
                    const king = m.byId.get(m.king);
                    note = 'King chat: ' + ((king && king.displayName) || 'No Treatment');
                } else {
                    item = m.items.find(i => m.sel.has(itemId(i))) || null;
                }
                if (pooled(m) && m.random) note = `Random from ${m.pool.size} in the pool`;
                tile.setAttribute('style', look(item ? rar(item) : 'default'));
                name.textContent = item ? (item.displayName || '') : (m.p.defaultName || 'Nothing equipped');
                sub.textContent = note || (item && rar(item) !== 'default' ? rarName(rar(item)) : '');
                pic.textContent = '';
                if (item && !(m.p.kind === 'crown' && isSystem(m, item))) {
                    if (m.p.kind === 'crown') safe(() => mods.renderKingPfpCrownPreview(pic, { player: m.player, kingCosmetics: { crown: item }, mode: 'shop_crown_preview' }));
                    else draw(pic, m, item, false);
                } else pic.innerHTML = `<div class="mi-none">${esc(m.p.defaultName || 'None')}</div>`;
                if (gen === renderGen) drawSide();
            };
            // Four at a time; the marble pages need the border and trail lists for their pictures.
            let next = 0;
            const worker = async () => { while (next < queue.length && gen === renderGen) { const id = queue[next++]; try { await load(id); } catch (e) {} fill(id); } };
            await Promise.all([worker(), worker(), worker(), worker()]);
            for (const [id] of SLOTS) fill(id);   // the marble pictures again, now with both companions
        }
        $body.addEventListener('click', e => {
            const s = e.target.closest('.mi-slot');
            if (!s) return;
            const m = model(s.dataset.slot);
            const sel = m && m.items.find(i => m.sel.has(itemId(i)));
            go(s.dataset.slot, sel ? itemId(sel) : '');
        });

        // ---- start ---------------------------------------------------------------------------------
        drawSide();
        $body.innerHTML = '<div class="mi-status">Loading the inventory …</div>';
        loadMods().then(m => { mods = m; render(); }, e => {
            console.error('[MarbleLuceFall] new inventory: the game\'s renderers did not load', e);
            $body.innerHTML = `<div class="mi-status"><b>The new inventory could not start</b><span>The game changed something it needs (${esc(e && e.message)}). The classic inventory still works.</span>
                <button type="button" class="mi-btn" data-mi="classic-now">Open the classic inventory</button></div>`;
            $body.querySelector('[data-mi=classic-now]').onclick = () => { const u = new URL(location.href); u.searchParams.set('mlf', 'classic'); location.href = u.href; };
        });
    }

