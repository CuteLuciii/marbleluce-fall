    // The new achievements page (6.58), built like the new inventory: categories on the left with an
    // Overview on top, search / status / sort above a grid of cards, a detail column on the right.
    // Same way in as the inventory app: turned into source text and run in the page of the
    // achievements frame by achOverhaulBoot, so it must not use anything from outside its own
    // body. Everything comes from one request, /api/achievements (the same the game's page makes);
    // badges are plain images from the game's server. Opening the page tells the server the new
    // unlocks have been seen (/api/achievements/ack), exactly as the game's page does - its own
    // page is kept from doing it twice (see achOverhaulBoot).
    function achOverhaulApp() {
        const root = document.getElementById('mcfo-ach-root');
        if (!root || root.__mi) return;
        root.__mi = true;
        const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
        const big = v => { try { return BigInt(v ?? 0); } catch (e) { return BigInt(Math.trunc(Number(v) || 0)); } };
        const fmt = v => { try { return BigInt(v ?? 0).toLocaleString('en-US'); } catch (e) { return new Intl.NumberFormat('en-US').format(Number(v) || 0); } };
        const compact = v => { const n = big(v); for (const [s, x] of [[1000000000n, 'B'], [1000000n, 'M'], [1000n, 'K']]) if (n >= s && n % s === 0n) return `${n / s}${x}`; return fmt(n); };
        const human = (v, unit) => { const n = big(v); if (unit === 'minutes') return n < 60n ? `${n}m` : `${fmt(n / 60n)}h`; return unit === 'points' ? compact(n) : fmt(n); };
        const CATS = [
            ['participation', 'Participation', '#1d6680', '#5fc4e6'], ['tile_mastery', 'Tile Mastery', '#1b6e60', '#5ad6c0'],
            ['points', 'Points', '#94681a', '#f2c25a'], ['crown', 'Crown', '#a3561f', '#f59a5a'],
            ['rebellions', 'Rebellions', '#8e2a3a', '#f0738a'], ['beverages', 'Beverages', '#255f8c', '#6fb4ec'],
            ['collection', 'Collection', '#5f3792', '#b98af0'], ['equipment', 'Equipment', '#44546a', '#9fb2c8'],
            ['community', 'Community', '#2a7a42', '#6fdc8e'], ['competition', 'Competition', '#923469', '#ef7cbc'],
            ['oddities', 'Miscellany', '#4f437f', '#a99bea'], ['mastery', 'Mastery', '#7a5c16', '#e8c467'],
        ];
        const CAT = Object.fromEntries(CATS.map(([id, label, fill, line]) => [id, { id, label, fill, line }]));
        const catLabel = id => (CAT[id] && CAT[id].label) || String(id || 'Achievement').replaceAll('_', ' ');
        const look = id => { const c = CAT[id] || { fill: '#3a4654', line: '#8796a6' }; return `--mi-fill:${c.fill};--mi-line:${c.line};--mi-ink:#f4f6f9`; };
        const ICON = {
            overview: '<path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z"/>',
            all: '<path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z"/>',
            participation: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-5 15-5 16 0"/>',
            tile_mastery: '<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/>',
            points: '<circle cx="12" cy="12" r="8"/><path d="M12 7v10M8 12h8"/>',
            crown: '<path d="M3 18h18l-1.5-10-4.5 4-3-7-3 7-4.5-4z"/>',
            rebellions: '<path d="M6 21V4M6 4h11l-2 4 2 4H6"/>',
            beverages: '<path d="M7 3h10l-1 18H8zM7.5 9h9"/>',
            collection: '<path d="M4 7h16v13H4zM8 7V4h8v3"/>',
            equipment: '<circle cx="12" cy="12" r="3.5"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>',
            community: '<circle cx="8" cy="9" r="3"/><circle cx="16" cy="9" r="3"/><path d="M2 20c1-4 11-4 12 0M10 20c1-4 11-4 12 0"/>',
            competition: '<path d="M8 4h8v5a4 4 0 01-8 0zM8 6H4c0 3 2 4 4 4M16 6h4c0 3-2 4-4 4M12 13v4M8 20h8"/>',
            oddities: '<path d="M9 9a3 3 0 115 2c-1 1-2 1.5-2 3M12 18h.01"/><circle cx="12" cy="12" r="9"/>',
            mastery: '<path d="M12 2l3 6 6 1-4.5 4 1 6.5L12 16l-5.5 3.5 1-6.5L3 9l6-1z"/><circle cx="12" cy="11" r="2.5"/>',
        };
        const icon = id => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[id] || ICON.all}</svg>`;
        const RELOAD = '<button type="button" class="mi-btn mi-btn--quiet mi-reload" data-mi="reload" title="Load your achievements again">\u21bb Reload</button>';
        const badgeUrl = (raw, mode) => {
            const u = new URL(raw || '/assets/achievements/badge.svg?v=2&key=family%3Aachievement&category=participation&ap=5', location.origin);
            u.searchParams.set('v', '2'); u.searchParams.set('mode', mode);
            return u.origin === location.origin ? u.pathname + u.search : u.href;
        };
        const dateLabel = i => i && i.retroactive && !i.historicalTimeKnown ? 'Previously earned'
            : !(i && i.completedAtMs) ? 'Date unknown' : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(Number(i.completedAtMs)));
        const rewardIcons = r => {
            const out = [];
            if (Number(r.gold) > 0) out.push(['/assets/widgets/metric-icons/gold.svg', `${fmt(r.gold)} Gold`]);
            if (Number(r.diamonds) > 0) out.push(['/assets/widgets/metric-icons/diamonds.svg', `${fmt(r.diamonds)} Diamonds`]);
            const vip = r.vip ?? r.vipPoints;
            if (Number(vip) > 0) {
                const ref = /^VIP_(?:0\d{2}|100)$/.test(String(r.currentVipBadgeRef || '')) ? r.currentVipBadgeRef : 'VIP_000';
                out.push([`/assets/vip-badges/${ref}.svg`, `+${fmt(vip)} VIP`]);
            }
            return out;
        };
        const rewardText = r => rewardIcons(r).map(([src, label]) => `<span class="ma-rew"><img src="${src}" alt="">${esc(label)}</span>`).join('') || '<span class="ma-rew">Reward</span>';

        const st = { snap: null, page: 'overview', focus: new Map(), q: '', mode: 'all', type: 'all', sort: 'close', msg: '' };
        const req = new URLSearchParams(location.search).get('category');
        if (req && (CAT[req] || req === 'all')) st.page = req;

        async function api(url, opts = {}) {
            const res = await fetch(url, { credentials: 'same-origin', headers: { Accept: 'application/json', ...(opts.body ? { 'Content-Type': 'application/json' } : {}) }, ...opts });
            const body = await res.json().catch(() => null);
            if (!res.ok || (body && body.ok === false)) { const e = new Error(String((body && (body.error || body.reason)) || 'request_failed_' + res.status)); e.status = res.status; throw e; }
            return body || {};
        }

        // One list for everything: single achievements and career lines become the same kind of entry.
        function entries() {
            const s = st.snap, out = [];
            (s.oneOffs || []).forEach((i, n) => out.push({ key: 'o' + n + ':' + (i.familyId || i.title), kind: 'one', i, cat: i.category, title: i.title, done: !!i.unlocked,
                ap: Number(i.achievementPoints) || 0, at: Number(i.completedAtMs) || 0, pct: onePct(i) }));
            (s.families || []).forEach((l, n) => {
                const last = (l.history || []).reduce((a, h) => Math.max(a, Number(h.completedAtMs) || 0), 0);
                out.push({ key: 'f' + n + ':' + l.familyId, kind: 'line', i: l, cat: l.category || 'mastery', title: l.title, done: !l.nextMilestone,
                    started: Number(l.completedCount) > 0, ap: l.nextMilestone ? Number(l.nextMilestone.achievementPoints) || 0 : 0, at: last, pct: linePct(l) });
            });
            return out;
        }
        function onePct(i) {
            if (i.unlocked) return 1;
            if (i.secret) return 0;
            if (i.masteryProgress && Number(i.masteryProgress.target)) return Math.min(1, Number(i.masteryProgress.current) / Number(i.masteryProgress.target));
            const r = (i.remainingRequirements || []).filter(e => e.current != null && Number(e.target));
            return r.length ? r.reduce((a, e) => a + Math.min(1, Number(e.current) / Number(e.target)), 0) / r.length : 0;
        }
        function linePct(l) {
            if (!l.nextMilestone) return 1;
            if (l.familyId === 'mcf.mastery.renaissance') return Math.min(1, Number(l.categoriesMeetingTarget) / Math.max(1, Number(l.requiredCategories)));
            const cur = Number(l.currentValue) || 0, to = Number(l.nextMilestone.threshold) || 0, from = l.lastMilestone ? Number(l.lastMilestone.threshold) || 0 : 0;
            return to > from ? Math.max(0, Math.min(1, (cur - from) / (to - from))) : 0;
        }
        function catStats() {
            const m = new Map();
            for (const e of entries()) {
                const c = m.get(e.cat) || { done: 0, total: 0, unlocks: 0 };
                c.total++; if (e.done) c.done++;
                c.unlocks += e.kind === 'one' ? (e.done ? 1 : 0) : Number(e.i.completedCount) || 0;
                m.set(e.cat, c);
            }
            return m;
        }
        function visible() {
            const q = st.q.trim().toLowerCase();
            let list = entries().filter(e => (st.page === 'all' || e.cat === st.page)
                // Unlocked: anything earned, a career line from its first milestone on. Completed: nothing left to earn.
                && (st.mode === 'all' || (st.mode === 'done' ? (e.kind === 'line' ? Number(e.i.completedCount) > 0 : e.done) : st.mode === 'complete' ? e.done : !e.done))
                && (st.type === 'all' || (st.type === 'line') === (e.kind === 'line'))
                && (!q || [e.title, e.i.description, e.cat, catLabel(e.cat)].some(v => String(v || '').toLowerCase().includes(q))));
            const name = (a, b) => String(a.title).localeCompare(String(b.title));
            const sorts = {
                close: (a, b) => (a.done - b.done) || (b.pct - a.pct) || name(a, b),
                recent: (a, b) => (b.at - a.at) || name(a, b),
                ap: (a, b) => (b.ap - a.ap) || name(a, b),
                name,
            };
            return list.sort(sorts[st.sort] || sorts.close);
        }

        // ---- layout ---------------------------------------------------------------------------------
        root.innerHTML = `<div class="mi ma">
            <aside class="mi-side" aria-label="Achievements"></aside>
            <section class="mi-main"><div class="mi-head"></div><div class="mi-body"></div></section>
            <aside class="mi-detail"></aside></div>`;
        const $mi = root.querySelector('.mi'), $side = root.querySelector('.mi-side'), $head = root.querySelector('.mi-head'),
              $body = root.querySelector('.mi-body'), $detail = root.querySelector('.mi-detail');

        function drawSide() {
            const stats = st.snap ? catStats() : new Map();
            const all = [...stats.values()].reduce((a, c) => ({ done: a.done + c.done, total: a.total + c.total }), { done: 0, total: 0 });
            const row = (id, label, c) => `<button type="button" class="inventorySubcategoryButton mi-nav ma-nav" data-page="${id}" aria-current="${st.page === id ? 'page' : 'false'}" style="${look(id)}">
                ${icon(id)}<span>${esc(label)}</span>${c ? `<i>${c.done}/${c.total}</i><b class="ma-navbar"><b style="width:${c.total ? (c.done * 100 / c.total).toFixed(1) : 0}%"></b></b>` : ''}</button>`;
            $side.innerHTML = `<div class="mi-group">${row('overview', 'Overview')}${row('all', 'All', st.snap ? all : null)}</div>
                <div class="mi-group"><h2>Categories</h2>${CATS.map(([id, label]) => row(id, label, stats.get(id) || { done: 0, total: 0 })).join('')}</div>
                <div class="mi-side__foot"><button type="button" class="mi-link" data-mi="classic">Classic achievements</button></div>`;
        }
        $side.addEventListener('click', e => {
            const b = e.target.closest('[data-page], [data-mi]');
            if (!b) return;
            if (b.dataset.mi === 'classic') { const u = new URL(location.href); u.searchParams.set('mlf', 'classic'); location.href = u.href; return; }
            go(b.dataset.page);
        });
        function go(page, focusKey) {
            st.page = page;
            if (focusKey) st.focus.set(page, focusKey);
            const u = new URL(location.href);
            if (CAT[page] || page === 'all') u.searchParams.set('category', page); else u.searchParams.delete('category');
            history.replaceState(null, '', u);
            render();
        }
        function render() {
            drawSide();
            $mi.toggleAttribute('data-overview', st.page === 'overview');
            if (st.page === 'overview') return renderOverview();
            drawHead(); drawGrid(); drawDetail();
        }

        // ---- head + grid ----------------------------------------------------------------------------
        function drawHead() {
            const c = catStats().get(st.page);
            const title = st.page === 'all' ? 'All achievements' : catLabel(st.page);
            const chip = (key, v, label) => `<button type="button" class="mi-rar" data-k="${key}" data-v="${v}" aria-pressed="${st[key] === v}">${label}</button>`;
            $head.innerHTML = `<div class="mi-title"><span class="mi-title__icon">${icon(st.page)}</span><h1>${esc(title)}</h1>
                    ${c ? `<span class="mi-count">${c.done} of ${c.total} complete · ${c.unlocks} unlocks</span>` : ''}${RELOAD}</div>
                <div class="mi-filters">
                    <input type="search" class="mi-search" placeholder="Search achievements" value="${esc(st.q)}">
                    <div class="mi-rars">${chip('mode', 'all', 'All')}${chip('mode', 'open', 'In progress')}${chip('mode', 'done', 'Unlocked')}${chip('mode', 'complete', 'Completed')}</div>
                    <div class="mi-rars">${chip('type', 'all', 'Everything')}${chip('type', 'one', 'Badges')}${chip('type', 'line', 'Career lines')}</div>
                    <label class="mi-sel">Sort <select data-k="sort">${[['close', 'Closest to done'], ['recent', 'Recently unlocked'], ['ap', 'Most AP'], ['name', 'Name']]
                        .map(([v, l]) => `<option value="${v}" ${st.sort === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
                </div>`;
        }
        $head.addEventListener('input', e => { if (e.target.matches('.mi-search')) { st.q = e.target.value; drawGrid(); } });
        $head.addEventListener('change', e => { if (e.target.dataset.k === 'sort') { st.sort = e.target.value; drawGrid(); } });
        $head.addEventListener('click', e => {
            if (e.target.closest('[data-mi=reload]')) { start(true); return; }
            const b = e.target.closest('button[data-k]');
            if (!b) return;
            st[b.dataset.k] = b.dataset.v;
            $head.querySelectorAll(`button[data-k="${b.dataset.k}"]`).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
            drawGrid();
        });
        const bar = (pct, label) => `<div class="ma-bar" role="progressbar" aria-label="${esc(label || 'Progress')}" aria-valuenow="${Math.round(pct * 100)}" aria-valuemin="0" aria-valuemax="100"><b style="width:${(pct * 100).toFixed(1)}%"></b></div>`;
        function progressText(e) {
            const i = e.i;
            if (e.kind === 'line') {
                if (!i.nextMilestone) return i.retired ? 'Retired · all kept' : 'Complete';
                if (i.familyId === 'mcf.mastery.renaissance') return `${fmt(i.categoriesMeetingTarget)} / ${fmt(i.requiredCategories)} categories`;
                return `${human(i.currentValue, i.unit)} / ${human(i.nextMilestone.threshold, i.unit)}`;
            }
            if (i.unlocked) return dateLabel(i);
            if (i.secret) return 'Secret';
            if (i.masteryProgress) return `${fmt(i.masteryProgress.current)} / ${fmt(i.masteryProgress.target)}`;
            const r = i.remainingRequirements || [];
            return r.length ? `${r.length} requirement${r.length === 1 ? '' : 's'} left` : 'Locked';
        }
        function card(e, fk) {
            const i = e.i, line = e.kind === 'line';
            const state = e.done ? 'done' : (line ? (e.started ? 'part' : 'open') : 'open');
            const tier = line ? `<span class="ma-tier">${fmt(i.completedCount || 0)}${i.nextMilestone ? '' : ' ✓'}</span>` : '';
            return `<article class="mi-card ma-card" data-key="${esc(e.key)}" data-state="${state}" style="${look(e.cat)}" aria-selected="${e.key === fk}" tabindex="0">
                <div class="ma-badge"><img src="${esc(badgeUrl(i.iconUrl, 'medium'))}" alt="" loading="lazy">${tier}</div>
                <div class="ma-card__body"><h3>${esc(i.title || 'Achievement')}</h3>
                    <p>${esc(line ? (i.familyId === 'mcf.mastery.renaissance' ? 'Cross-system career' : `Career line · ${fmt(i.completedCount || 0)} milestone${Number(i.completedCount) === 1 ? '' : 's'}`) : (i.description || ''))}</p></div>
                ${!e.done && e.pct > 0 ? bar(e.pct, i.title) : ''}
                <div class="ma-card__foot"><span>${esc(progressText(e))}</span><b>${e.ap ? `${line ? 'next ' : ''}+${fmt(e.ap)} AP` : ''}</b></div>
            </article>`;
        }
        function drawGrid() {
            const list = visible(), fk = focusKey(list);
            $body.innerHTML = list.length ? `<div class="mi-grid ma-grid">${list.map(e => card(e, fk)).join('')}</div>` : '<div class="mi-status"><span>Nothing matches these filters.</span></div>';
        }
        function focusKey(list) {
            const want = st.focus.get(st.page);
            return (want && entries().some(e => e.key === want)) ? want : (list || visible())[0] ? (list || visible())[0].key : '';
        }
        $body.addEventListener('click', e => {
            if (e.target.closest('[data-mi=retry]')) { start(); return; }
            const slot = e.target.closest('[data-goto]');
            if (slot) { const [page, key] = slot.dataset.goto.split('|'); go(page, key); return; }
            const c = e.target.closest('.ma-card');
            if (!c || st.page === 'overview') return;
            st.focus.set(st.page, c.dataset.key);
            $body.querySelectorAll('.ma-card[aria-selected=true]').forEach(x => x.setAttribute('aria-selected', 'false'));
            c.setAttribute('aria-selected', 'true');
            drawDetail();
        });
        $body.addEventListener('keydown', e => { const c = e.target.closest && e.target.closest('.ma-card'); if (c && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); c.click(); } });

        // ---- detail -------------------------------------------------------------------------------
        function drawDetail() {
            const key = focusKey(), e = entries().find(x => x.key === key);
            if (!e) { $detail.innerHTML = '<div class="mi-status"><span>Nothing selected.</span></div>'; return; }
            const i = e.i, line = e.kind === 'line';
            let body = '';
            if (!line) {
                body += `<p class="ma-desc">${esc(i.description || '')}</p>`;
                body += i.unlocked ? `<div class="ma-status ma-status--done">✓ Unlocked · ${esc(dateLabel(i))}</div>`
                    : i.secret ? '<div class="ma-status">Secret - revealed once you earn it</div>'
                    : `<div class="ma-status">${esc(progressText(e))}</div>${e.pct > 0 ? bar(e.pct, i.title) : ''}`;
                const r = !i.unlocked && !i.secret ? (i.remainingRequirements || []) : [];
                if (r.length) body += `<h4>Still to do</h4><ul class="ma-reqs">${r.map(x => `<li><span>${esc(x.label)}</span>${x.current != null && x.target != null ? `<b>${fmt(x.current)} / ${fmt(x.target)}</b>` : ''}</li>`).join('')}</ul>`;
                body += `<div class="ma-ap">+${fmt(i.achievementPoints)} AP</div>`;
            } else if (i.familyId === 'mcf.mastery.renaissance') {
                const target = Number(i.targetDepth || (i.nextMilestone && i.nextMilestone.threshold) || 1);
                body += `<p class="ma-desc">Earn at least ${fmt(target)} achievement${target === 1 ? '' : 's'} in ${fmt(i.requiredCategories)} of 12 categories.</p>
                    <div class="ma-status">Renaissance depth <b>${fmt(i.currentValue)}</b> · ${fmt(i.categoriesMeetingTarget)} / ${fmt(i.requiredCategories)} categories at depth ${fmt(target)}</div>${bar(e.pct)}`;
                const cats = (i.categories || []);
                if (cats.length) body += `<h4>Categories</h4><div class="ma-renai">${cats.map(c => `<button type="button" data-goto="${esc(c.category)}|" class="${c.complete ? 'is-done' : ''}" style="${look(c.category)}">
                    <span>${esc(catLabel(c.category))}</span><b>${fmt(c.count)} / ${fmt(target)}</b></button>`).join('')}</div>`;
                body += ladder(i, v => 'Depth ' + fmt(v));
            } else {
                body += `<div class="ma-status">Career total <b>${human(i.currentValue, i.unit)}</b>${i.unit === 'minutes' ? ' King time' : ''}</div>`;
                if (i.nextMilestone) body += bar(e.pct, i.title) + `<div class="ma-sub">${human(Math.max(0, Number(i.currentValue) - (i.lastMilestone ? Number(i.lastMilestone.threshold) : 0)), i.unit)} into this step${i.repeatEvery && i.repeatFrom && big(i.currentValue) >= big(i.repeatFrom) ? ` · repeats every +${human(i.repeatEvery, i.unit)}` : ''}</div>`;
                else body += `<div class="ma-status ma-status--done">✓ ${i.retired ? 'Retired family - earned milestones are kept' : `All ${fmt(i.completedCount)} milestones earned`}</div>`;
                body += ladder(i, v => human(v, i.unit));
                if (Array.isArray(i.opponents)) body += `<h4>Players dethroned <span class="ma-sub">${fmt(i.opponents.length)} / 20</span></h4><ol class="ma-opp">${i.opponents.map(o => `<li>${esc(o.displayName || o.playerId)}</li>`).join('')}</ol>`;
            }
            $detail.innerHTML = `<div class="mi-detail__inner ma-detail" style="${look(e.cat)}">
                <div class="ma-bigbadge" data-state="${e.done ? 'done' : 'open'}"><img src="${esc(badgeUrl(i.iconUrl, 'large'))}" alt=""></div>
                <h2>${esc(i.title || 'Achievement')}</h2>
                <button type="button" class="mi-pill ma-catpill" data-goto="${esc(e.cat)}|">${esc(catLabel(e.cat))}</button>
                ${body}</div>`;
        }
        // The steps of a career line: the ones earned (with date), the next one, and that is where it stops -
        // the server only names the next milestone.
        function ladder(l, label) {
            const hist = [...(l.history || [])].sort((a, b) => Number(a.threshold) - Number(b.threshold));
            const rows = hist.map(h => `<li class="is-done"><img src="${esc(badgeUrl(h.iconUrl || l.iconUrl, 'tiny'))}" alt=""><span><b>${esc(label(h.threshold))}</b><small>+${fmt(h.achievementPoints)} AP · ${esc(dateLabel(h))}</small></span><i>✓</i></li>`);
            if (l.nextMilestone) rows.push(`<li class="is-next"><span class="ma-dot"></span><span><b>${esc(label(l.nextMilestone.threshold))}</b><small>next · +${fmt(l.nextMilestone.achievementPoints)} AP</small></span><i>${Math.round(linePct(l) * 100)}%</i></li>`);
            return rows.length ? `<h4>Milestones</h4><ol class="ma-ladder">${rows.reverse().join('')}</ol>` : '';
        }
        $detail.addEventListener('click', e => { const g = e.target.closest('[data-goto]'); if (g) { const [page, key] = g.dataset.goto.split('|'); go(page, key); } });

        // ---- overview -----------------------------------------------------------------------------
        function renderOverview() {
            const s = st.snap, next = s.nextReward || {};
            const per = 125, prog = Number(next.progress) || 0;
            $detail.innerHTML = '';
            $head.innerHTML = `<div class="mi-title"><span class="mi-title__icon">${icon('overview')}</span><h1>Achievement Chronicle</h1><span class="mi-count">${esc(s.displayName || '')}</span>${RELOAD}</div>`;
            const close = entries().filter(e => !e.done && e.pct > 0).sort((a, b) => b.pct - a.pct).slice(0, 8);
            const cycles = (s.rewardCycles || []).slice(0, 2);
            const share = new URL(`/players/${encodeURIComponent(String(s.publicAchievementId || ''))}/achievements`, location.origin).href;
            const recent = (s.recentlyUnlocked || []).slice(0, 6);
            const stats = catStats();
            $body.innerHTML = `<div class="ma-over">
                <section class="ma-stats">
                    <div class="ma-stat"><span>Achievement Points</span><b>${fmt(s.achievementPoints)} <small>AP</small></b></div>
                    <div class="ma-stat"><span>Unlocked</span><b>${fmt(s.completionCount)}</b></div>
                    <div class="ma-stat ma-stat--reward"><span>Next reward at ${fmt(next.boundaryAp)} AP</span><div class="ma-rewline">${rewardText(next)}</div>
                        ${bar(Math.min(1, prog / per), 'Progress to the next AP reward')}<small>${fmt(prog)} of ${per} AP · ${fmt(Math.max(0, per - prog))} to go</small></div>
                </section>
                ${cycles.length ? `<section><h2>AP rewards</h2><div class="ma-cycles">${cycles.map((c, n) => `<div class="ma-cycle"><h3>${n ? 'Next cycle' : 'Current cycle'} <span>${fmt(c.cycleIndex)}</span></h3>
                    <ol>${(c.milestones || []).map(m => { const isNext = m.boundaryAp === next.boundaryAp;
                        return `<li class="${m.reached ? 'is-done' : ''}${isNext ? ' is-next' : ''}"><b>${fmt(m.boundaryAp)}</b><span>${rewardText(m)}</span></li>`; }).join('')}</ol></div>`).join('')}</div></section>` : ''}
                ${close.length ? `<section><h2>Closest to done</h2><div class="mi-grid ma-grid">${close.map(e => card(e, '').replace('<article ', `<article data-goto="${e.cat}|${esc(e.key)}" `)).join('')}</div></section>` : ''}
                <section><h2>Recently unlocked</h2>${recent.length ? `<div class="ma-recent">${recent.map(r => `<div class="ma-recentrow" style="${look(r.category)}"><img src="${esc(badgeUrl(r.iconUrl, 'tiny'))}" alt=""><span><b>${esc(r.title)}</b><small>${esc(catLabel(r.category))} · ${esc(dateLabel(r))}</small></span><i>+${fmt(r.achievementPoints)} AP</i></div>`).join('')}</div>` : '<p class="mi-note">Your first unlock is waiting.</p>'}</section>
                <section><h2>Categories</h2><div class="ma-cats">${CATS.map(([id, label]) => { const c = stats.get(id) || { done: 0, total: 0 };
                    return `<button type="button" class="ma-cat" data-goto="${id}|" style="${look(id)}">${icon(id)}<span>${esc(label)}</span><b>${c.done}/${c.total}</b>${bar(c.total ? c.done / c.total : 0)}</button>`; }).join('')}</div></section>
                <section><h2>Public Chronicle</h2><div class="ma-share">
                    <span>${s.visibility === 'public' ? 'Visible to everyone at' : 'Private - your AP and unlocks stay hidden.'}</span>
                    ${s.visibility === 'public' ? `<a href="${esc(share)}" target="_blank" rel="noopener">${esc(share)}</a><button type="button" class="mi-btn" data-act="copy">Copy link</button>` : ''}
                    <button type="button" class="mi-btn" data-act="privacy">${s.visibility === 'public' ? 'Make private' : 'Make public'}</button>
                    ${st.msg ? `<span class="ma-sub">${esc(st.msg)}</span>` : ''}</div></section>
            </div>`;
            $body.querySelector('[data-act=copy]') && ($body.querySelector('[data-act=copy]').onclick = async ev => {
                try { await navigator.clipboard.writeText(share); ev.target.textContent = 'Copied'; } catch (e) { ev.target.textContent = 'Copy failed'; }
                setTimeout(() => { if (ev.target.isConnected) ev.target.textContent = 'Copy link'; }, 1600);
            });
            $body.querySelector('[data-act=privacy]').onclick = async () => {
                const visibility = s.visibility === 'public' ? 'private' : 'public';
                try { await api('/api/achievements/privacy', { method: 'POST', body: JSON.stringify({ visibility }) }); s.visibility = visibility; st.msg = ''; }
                catch (e) { st.msg = 'That did not work: ' + e.message; }
                renderOverview();
            };
        }

        // ---- start ------------------------------------------------------------------------------------
        // again: the reload button - the data is fetched anew, the page and the place in it stay.
        async function start(again) {
            const btn = $head.querySelector('[data-mi=reload]');
            if (again && btn) { btn.disabled = true; btn.classList.add('is-busy'); }
            if (!again) { drawSide(); $body.innerHTML = '<div class="mi-status">Reading your Chronicle …</div>'; }
            try {
                st.snap = await api('/api/achievements');
            } catch (e) {
                const out = e && (e.status === 401 || e.status === 403);
                $body.innerHTML = `<div class="mi-status"><b>${out ? 'Sign in to see your achievements' : 'The Chronicle did not answer'}</b><span>${esc(out ? 'Achievements open for a signed-in player.' : e.message)}</span><button type="button" class="mi-btn" data-mi="retry">Try again</button></div>`;
                return;
            }
            render();
            // As the game's page: the new unlocks have been seen now.
            const pending = (st.snap.presentation && st.snap.presentation.pending) || [];
            if (pending.length) api('/api/achievements/ack', { method: 'POST', body: JSON.stringify({ acknowledgeThroughSequence: Math.max(...pending.map(p => Number(p.completionSequence) || 0)) }) }).catch(() => {});
        }
        start();
    }

