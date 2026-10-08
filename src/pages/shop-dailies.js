    // =========================================================================================
    // 12d. SHOP AND DAILIES: QUEST ALARM, EURO PRICES, CLAIM ALL (6.27)
    // =========================================================================================
    // Three things the MarbleMind bot did for its own accounts, done here for the player at the
    // keyboard — with their own login, through the same endpoints the game's pages use:
    //
    //   Quest alarm   An offer that would complete one of today's open shop quests gets a
    //                 "Quest" tag in the shop, and the Shop button a gold dot while such an offer
    //                 is in a rotation. Shop quests are only doable while a matching offer is up
    //                 (a rotation lasts 15 minutes), which is why this is worth a dot at all.
    //   Euro prices   Beside every diamond price, what those diamonds cost in euros.
    //   Claim all     Gold dot on the account card when a quest reward or a daily item is waiting,
    //                 "Claim all dailies" at the top of the account menu, and — opt-in — claiming
    //                 by themselves.
    //
    // Only reading, except for the claims. Claims are free and idempotent (a second claim answers
    // 200 with idempotentReplay and changes nothing), so a double click or two open tabs cannot
    // hurt. Nothing here ever buys.
    //
    // /api/dailies (as the game's /dailies.js reads it):
    //   quests.quests[]      { instanceId, title, definitionId, parameters, complete, claimState
    //                          'unclaimed'|'pending'|'claimed', reward {currency, amount} }
    //   dailyItems.items[]   { rankId, rankName, status 'claimed'|…, item (only once claimed —
    //                          an unclaimed item is hidden until the reveal) }
    //   questsResetAtMs      next reset
    // Claims: POST /api/dailies/quests/{instanceId}/claim and /api/dailies/items/{rankId}/claim,
    // body {}. The API answers some refusals with 200 AND ok:false — both count as failure.
    //
    // Shop quests carry their condition: definitionId "shop:chat_shop:king_chat_bubble_style:ethereal"
    // with parameters { shopKind, shopItemType, minimumRarity }. The CROWN shop's quests have NO
    // shopItemType (the shop only sells crowns) — comparing against it anyway matched nothing for
    // two days in the bot. A missing type means "any".
    const DAILY_EVERY_MS = 5 * 60 * 1000;
    const SHOP_EVERY_MS  = 2 * 60 * 1000;
    const SHOP_RANK = { common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 5, mythic: 6, ethereal: 7, cosmic: 8, exclusive: 9, unique: 10 };
    // Quest wording and API segment for the same shop: chat_shop/chat, crown_shop/crowns, marbles.
    const shopNorm = s => String(s || '').toLowerCase().replace(/_shop$/, '').replace(/s$/, '');
    const SHOP_SEGMENT = { chat: 'chat', crown: 'crowns', marble: 'marbles' };

    const daily = { data: null, at: 0, busy: false, resetTimer: 0 };
    const shopOffers = new Map();    // segment -> { at, offers: Map(id -> offer) }
    const money = { usdLo: null, usdHi: null, eurPerUsd: null, at: 0 };

    const escapeHtml = v => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    async function apiJson(path, opts = {}) {
        const res = await fetch(path, Object.assign({ credentials: 'same-origin', cache: 'no-store',
            headers: Object.assign({ Accept: 'application/json' }, opts.body ? { 'Content-Type': 'application/json' } : {}) }, opts));
        const body = await res.json().catch(() => ({}));
        if (!res.ok || (body && body.ok === false)) throw new Error((body && body.error) || 'HTTP ' + res.status);
        return body;
    }

    // --- Dailies ---
    function dailyClaimable(d) {
        const quests = ((d && d.quests && d.quests.quests) || [])
            .filter(q => q.complete === true && q.claimState !== 'claimed' && q.claimState !== 'pending');
        const items = (d && d.dailyItems && d.dailyItems.enabled !== false ? d.dailyItems.items || [] : [])
            .filter(i => i.status !== 'claimed' && i.status !== 'locked');
        return { quests, items, n: quests.length + items.length };
    }
    const dailyWaiting = () => (settings.dailyClaimAll || settings.dailyAutoClaim) && !signedOut() ? dailyClaimable(daily.data).n : 0;

    async function loadDailies() {
        if (signedOut() || (!settings.dailyClaimAll && !settings.dailyAutoClaim && !settings.shopQuestAlarm && !settings.questMarks)) return;
        try { daily.data = await apiJson('/api/dailies'); daily.at = Date.now(); }
        catch (e) { return; }   // a busy server evening; the next beat tries again
        // Straight after the reset the new quests and items are there — look again then, instead
        // of up to five minutes later.
        clearTimeout(daily.resetTimer);
        const reset = Number(daily.data.questsResetAtMs) - Date.now();
        if (reset > 0 && reset < 24 * 3600 * 1000) daily.resetTimer = setTimeout(loadDailies, reset + 20 * 1000);
        showDailyDot();
        if (settings.dailyAutoClaim && dailyClaimable(daily.data).n) claimDailies(true);
        refreshShopQuests();
    }

    const rewardText = r => {
        const n = Number(r && r.amount);
        const cur = String(r && r.currency || '').replace(/s$/, '');   // gold, diamond, ticket
        return n > 0 ? '+' + n.toLocaleString('en-US') + ' ' + cur + (cur === 'gold' || n === 1 ? '' : 's') : '';
    };

    async function claimDailies(auto) {
        if (daily.busy) return;
        daily.busy = true;
        try {
            // Fresh first: the list may be minutes old, and something may have been claimed in
            // the Dailies window or another tab since.
            try { daily.data = await apiJson('/api/dailies'); daily.at = Date.now(); } catch (e) {}
            const { quests, items } = dailyClaimable(daily.data);
            if (!quests.length && !items.length) { if (!auto) notice('Nothing to claim right now.'); return; }
            const rewards = [], failed = [];
            let nq = 0;
            for (const q of quests) {
                try {
                    const r = await apiJson(`/api/dailies/quests/${encodeURIComponent(q.instanceId)}/claim`, { method: 'POST', body: '{}' });
                    rewards.push(rewardText(r.reward || q.reward));
                    nq++;
                } catch (e) { failed.push(`${q.title || 'quest'}: ${e.message}`); }
            }
            const claimedItems = [];
            for (const i of items) {
                try {
                    await apiJson(`/api/dailies/items/${encodeURIComponent(i.rankId)}/claim`, { method: 'POST', body: '{}' });
                    claimedItems.push(i.rankId);
                } catch (e) { failed.push(`${i.rankName || 'item'}: ${e.message}`); }
            }
            // The item itself only shows up after the claim (the game reveals it), so read again.
            try { daily.data = await apiJson('/api/dailies'); daily.at = Date.now(); } catch (e) {}
            const got = ((daily.data && daily.data.dailyItems && daily.data.dailyItems.items) || [])
                .filter(i => claimedItems.includes(i.rankId))
                .map(i => `${i.rankName || 'Daily'} item: <b>${escapeHtml((i.item && i.item.displayName) || 'claimed')}</b>`);
            const parts = [];
            if (nq > 0) parts.push(`${nq} quest${nq === 1 ? '' : 's'}${rewards.filter(Boolean).length ? ' (' + rewards.filter(Boolean).join(', ') + ')' : ''}`);
            parts.push(...got);
            if (parts.length) notice(`${auto ? 'Dailies claimed by themselves' : 'Dailies claimed'}: ${parts.join(' · ')}`);
            if (failed.length) notice(`Could not claim: ${escapeHtml(failed.join(' · '))}`, 'error');
        } finally {
            daily.busy = false;
            showDailyDot();
        }
    }

    // Beside the red update dot (12c) when both are up, never on top of it.
    function showDailyDot() {
        const n = dailyWaiting();
        const card = role('profile-entry');
        if (!card) return;
        let dot = card.querySelector(':scope > .mcfo-dailydot');
        if (n && !dot) {
            dot = document.createElement('span');
            dot.className = 'mcfo-dailydot';
            card.appendChild(dot);
        }
        if (dot) {
            dot.hidden = !n;
            dot.title = n ? `${n} daily reward${n === 1 ? '' : 's'} to claim` : '';
        }
    }

    // --- Money ---
    // There is no one price per diamond: the packages are not linear, and not even monotonic
    // (the $100 pack is worse than the $75 one). A mean would describe a pack nobody buys. So a
    // range: from the cheapest rate of any pack to the dearest — every diamond cost something in
    // that band. USD comes from the game's own packages, the exchange rate from the ECB rates at
    // frankfurter.dev (no key, allows the call from this page), both cached for a day.
    const MONEY_STORE = 'mcfo_money';
    async function loadMoney() {
        if (!settings.shopEuro || Date.now() - money.at < 12 * 3600 * 1000) return;
        try {
            const c = JSON.parse(localStorage.getItem(MONEY_STORE) || 'null');
            if (c && Date.now() - c.at < 24 * 3600 * 1000 && c.usdLo > 0 && c.eurPerUsd > 0) { Object.assign(money, c); return; }
        } catch (e) {}
        try {
            const p = await apiJson('/api/payments/packages');
            let lo = null, hi = null;
            for (const k of (p.packages || [])) {
                const cents = Number(k.priceAmountCents), dia = Number(k.diamondAmount);
                if (!(cents > 0) || !(dia > 0)) continue;
                const usd = cents / 100 / dia;
                if (lo === null || usd < lo) lo = usd;
                if (hi === null || usd > hi) hi = usd;
            }
            const fx = await fetch('https://api.frankfurter.dev/v1/latest?base=USD&symbols=EUR', { credentials: 'omit', cache: 'no-store' })
                .then(r => r.ok ? r.json() : null).catch(() => null);
            const rate = Number(fx && fx.rates && fx.rates.EUR);
            if (lo > 0 && rate > 0) {
                Object.assign(money, { usdLo: lo, usdHi: hi, eurPerUsd: rate, at: Date.now() });
                try { localStorage.setItem(MONEY_STORE, JSON.stringify(money)); } catch (e) {}
            }
        } catch (e) {}
    }
    function euroText(diamonds) {
        const d = Number(diamonds);
        if (!(d > 0) || !money.usdLo || !money.eurPerUsd) return '';
        const f = v => (d * v * money.eurPerUsd).toLocaleString(undefined, { style: 'currency', currency: 'EUR' });
        const lo = f(money.usdLo), hi = f(money.usdHi || money.usdLo);
        return lo === hi ? '≈ ' + lo : `≈ ${lo}–${hi}`;
    }

    // --- Quest dots on Rebellion and beverages (6.35) ---
    // Three quest families name exactly what they want (shared/dailies.js of the game):
    //   rebellion:<tier>            { tier }            "Launch exactly a x5 Rebellion", tiers 5/10/17/25
    //   celebration:<tierId>        { tierId }          Royal Celebration, royal_500 ... royal_2500
    //   beverage:<type>:<n>:<cur>   { beverageType }    "Buy n Water Beverages", any size or currency
    //   beverage:sampler:<a+b>      { requiredTypes }   one of each; which of them are done the API
    //                                                   does not say, so all of them keep their dot
    // Read from the /api/dailies we fetch anyway; a purchase or launch asks again a little later
    // (see below), so a dot goes once the quest is done instead of up to five minutes after.
    const questMarks = { bev: new Map(), reb: new Map(), cel: new Map() };   // key -> [quest]
    function questDot(el) {
        if (el.querySelector(':scope > .mcfo-questdot')) return;
        const dot = document.createElement('span');
        dot.className = 'mcfo-questdot';
        el.appendChild(dot);
    }
    function questMarkFor(kind, key) { return questMarks[kind].get(String(key)) || []; }
    function questProgress(q) {
        const n = Number(q.progress), t = Number(q.target);
        return Number.isFinite(n) && t > 1 ? ` (${Math.min(n, t)}/${t})` : '';
    }
    function paintQuestMarks() {
        for (const m of Object.values(questMarks)) m.clear();
        const add = (kind, key, q) => { const k = String(key); if (!questMarks[kind].has(k)) questMarks[kind].set(k, []); questMarks[kind].get(k).push(q); };
        if (settings.questMarks && !signedOut()) {
            for (const q of (daily.data && daily.data.quests && daily.data.quests.quests) || []) {
                if (q.complete === true || q.claimState === 'claimed') continue;
                const id = String(q.definitionId || ''), part = id.split(':'), p = q.parameters || {};
                if (part[0] === 'rebellion') add('reb', p.tier ?? part[1], q);
                else if (part[0] === 'celebration') add('cel', p.tierId || part[1], q);
                else if (part[0] === 'beverage') {
                    const types = Array.isArray(p.requiredTypes) ? p.requiredTypes
                                : [p.beverageType || (part[1] === 'sampler' ? '' : part[1])];
                    for (const t of types) if (t) add('bev', String(t).toLowerCase(), q);
                }
            }
        }
        const root = document.documentElement;
        const setAttr = (name, value) => {
            if (value) { if (root.getAttribute(name) !== value) root.setAttribute(name, value); }
            else if (root.hasAttribute(name)) root.removeAttribute(name);
        };
        setAttr('data-mcfo-qbev', [...questMarks.bev.keys()].join(' '));
        setAttr('data-mcfo-qreb', questMarks.reb.size ? '1' : '');
        setAttr('data-mcfo-qcel', questMarks.cel.size ? '1' : '');
        // Our buttons are rebuilt now and then (the tray with every king update, the Rebellion
        // label when the reign changes), so the dot is put back where it went missing.
        for (const el of document.querySelectorAll('.mcfo-drink, .mcfo-rebellion')) {
            questDot(el);
            const kind = el.classList.contains('mcfo-drink') ? 'bev' : el.hasAttribute('data-mcfo-royal') ? 'cel' : 'reb';
            const qs = kind === 'bev' ? questMarkFor('bev', el.getAttribute('data-mcfo-drink'))
                                      : [...questMarks[kind].values()].flat();
            const tip = qs.length ? 'Quest: ' + qs.map(q => (q.title || '') + questProgress(q)).join(' / ') : '';
            // The button's own tooltip stays; the quest goes below it, and comes off again. What
            // we wrote is remembered, so a tooltip the button changed itself counts as its own.
            const cur = el.title || '';
            const base = cur === el.getAttribute('data-mcfo-qfull') ? el.getAttribute('data-mcfo-qbase') || '' : cur;
            const want = tip ? (base ? base + '\n' : '') + tip : base;
            if (cur !== want) el.title = want;
            if (el.getAttribute('data-mcfo-qfull') !== want) { el.setAttribute('data-mcfo-qbase', base); el.setAttribute('data-mcfo-qfull', want); }
        }
    }
    // After a beverage, a Rebellion or a Royal Celebration went out — through our buttons or the
    // game's, ours press the game's anyway — the quests are read again, so the dot can go.
    document.addEventListener('click', e => {
        const t = e.target && e.target.closest && e.target.closest(
            '[data-action="king-beverage-activate"], [data-role="rebellion-tier-start"], [data-role="royal-celebration-tier-start"]');
        if (!t || !settings.questMarks) return;
        setTimeout(loadDailies, 3000);
        setTimeout(loadDailies, 12000);
    }, true);

    // --- Quest alarm ---
    function openShopQuests() {
        if (!settings.shopQuestAlarm) return [];
        return ((daily.data && daily.data.quests && daily.data.quests.quests) || []).filter(q =>
            /^shop:/.test(q.definitionId || '') && q.complete !== true && q.claimState !== 'claimed');
    }
    function questCondition(q) {
        const p = q.parameters || {};
        const part = String(q.definitionId || '').split(':');   // shop:<kind>[:<type>]:<rarity>
        return {
            kind: shopNorm(p.shopKind || part[1]),
            type: p.shopItemType || (part.length > 3 ? part[2] : null),
            rarity: String(p.minimumRarity || part[part.length - 1] || '').toLowerCase(),
        };
    }
    function offerQuest(offer, segment) {
        if (!offer || offer.owned === true || offer.status === 'sold_out') return null;
        return openShopQuests().find(q => {
            const c = questCondition(q);
            return c.kind === shopNorm(segment)
                && (!c.type || c.type === offer.slotType || c.type === offer.itemType)
                && (SHOP_RANK[String(offer.rarity || '').toLowerCase()] || 0) >= (SHOP_RANK[c.rarity] || 99);
        }) || null;
    }
    // Always through .../me: the public shop answers owned:null, which reads like "not yet owned".
    async function loadShop(segment, maxAge = SHOP_EVERY_MS) {
        const have = shopOffers.get(segment);
        if (have && Date.now() - have.at < maxAge) return have;
        try {
            const d = await apiJson(`/api/shops/${encodeURIComponent(segment)}/me`);
            const entry = { at: Date.now(), offers: new Map((d.offers || []).map(o => [String(o.id), o])) };
            shopOffers.set(segment, entry);
            return entry;
        } catch (e) { return have || null; }
    }
    // Only the shops an open quest points at, and only while there is one — otherwise not a
    // single extra request.
    async function refreshShopQuests() {
        const kinds = [...new Set(openShopQuests().map(q => SHOP_SEGMENT[questCondition(q).kind]).filter(Boolean))];
        for (const s of kinds) await loadShop(s);
        showShopDot();
    }
    function shopHits() {
        const out = [];
        for (const q of openShopQuests()) {
            const seg = SHOP_SEGMENT[questCondition(q).kind];
            const entry = seg && shopOffers.get(seg);
            if (!entry || Date.now() - entry.at > 15 * 60 * 1000) continue;
            for (const o of entry.offers.values()) if (offerQuest(o, seg) === q) out.push({ q, o });
        }
        return out;
    }
    // On the footer's Shop button AND on the "Shop" signpost of the gold card: by default the
    // footer button is hidden (FOOTER_BUTTONS, "still in the Gold card"), and a dot on a hidden
    // button would be no alarm at all.
    function showShopDot() {
        const hits = shopHits();
        const hosts = [role('shop-nav'),
            document.querySelector('[data-role="metric-cell"][data-metric-role="gold"] > .mcfo-signpost')];
        for (const btn of hosts) {
            if (!btn) continue;
            let dot = btn.querySelector(':scope > .mcfo-shopdot');
            if (hits.length && !dot) {
                dot = document.createElement('span');
                dot.className = 'mcfo-shopdot';
                btn.appendChild(dot);
            }
            if (dot) {
                dot.hidden = !hits.length;
                btn.title = hits.length ? 'In the shop now for your quest: ' + hits.map(h => h.o.displayName).join(', ') : '';
            }
        }
    }

    // --- Inside the shop page (a window's frame, or the page itself) ---
    const SHOP_CSS = `
        .mcfo-eur { display: block; margin-top: 2px; font-size: 0.86em; opacity: 0.72; font-style: normal; }
        .shopBuyButton .mcfo-eur { margin-top: 3px; }
        .mcfo-questtag { position: absolute; left: 8px; top: 8px; z-index: 3; pointer-events: none;
            padding: 2px 7px; border-radius: 999px; background: #f2c14e; color: #1b1405;
            font: 800 11px/1.4 system-ui, sans-serif; letter-spacing: 0.04em; text-transform: uppercase;
            box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.35); }
        article.shopTile[data-mcfo-quest] { position: relative; }`;
    function shopDocAssist(doc) {
        if (!doc || !doc.getElementById || !doc.getElementById('shop-root') || doc.documentElement.hasAttribute('data-mcfo-shopassist')) return;
        doc.documentElement.setAttribute('data-mcfo-shopassist', '1');
        const st = doc.createElement('style');
        st.id = 'mcfo-shop-assist';
        st.textContent = SHOP_CSS;
        (doc.head || doc.documentElement).appendChild(st);
        let queued = false;
        const run = () => { queued = false; annotateShop(doc); };
        new MutationObserver(() => { if (!queued) { queued = true; setTimeout(run, 120); } })
            .observe(doc.getElementById('shop-root'), { childList: true, subtree: true });
        run();
    }
    async function annotateShop(doc) {
        if (!settings.shopEuro && !settings.shopQuestAlarm) return;
        const cur = doc.querySelector('.shopTypeButton[aria-current="page"]');
        const segment = (cur && cur.getAttribute('data-shop-kind')) || 'crowns';
        await Promise.all([loadMoney(), daily.data ? null : loadDailies()]);
        const entry = await loadShop(segment, 60 * 1000);
        if (!entry) return;
        for (const tile of doc.querySelectorAll('article.shopTile[data-offer-id]')) {
            const offer = entry.offers.get(tile.getAttribute('data-offer-id'));
            const small = tile.querySelector('.shopTileText small');
            const eur = settings.shopEuro && offer && offer.prices ? euroText(offer.prices.diamonds) : '';
            let e = small && small.querySelector('.mcfo-eur');
            if (small && eur && !e) { e = doc.createElement('span'); e.className = 'mcfo-eur'; small.appendChild(e); }
            if (e && e.textContent !== eur) e.textContent = eur;
            const q = settings.shopQuestAlarm ? offerQuest(offer, segment) : null;
            let tag = tile.querySelector(':scope > .mcfo-questtag');
            if (q && !tag) { tag = doc.createElement('span'); tag.className = 'mcfo-questtag'; tag.textContent = 'Quest'; tile.appendChild(tag); }
            if (tag) { if (!q) tag.remove(); else tag.title = q.title || 'Completes a daily quest'; }
            if (q) tile.setAttribute('data-mcfo-quest', '1'); else tile.removeAttribute('data-mcfo-quest');
        }
        // The buy button of the selected offer, in the panel beside the grid.
        const sel = doc.querySelector('article.shopTile[aria-selected="true"]');
        const offer = sel && entry.offers.get(sel.getAttribute('data-offer-id'));
        const btn = doc.querySelector('.shopBuyButton[data-currency="diamonds"]');
        if (btn) {
            const eur = settings.shopEuro && offer && offer.prices ? euroText(offer.prices.diamonds) : '';
            let e = btn.querySelector('.mcfo-eur');
            if (eur && !e) { e = doc.createElement('small'); e.className = 'mcfo-eur'; btn.appendChild(e); }
            if (e && e.textContent !== eur) e.textContent = eur;
        }
    }

    // --- A short notice, bottom centre, above the footer ---
    function notice(html, tone) {
        let box = document.querySelector('.mcfo-notices');
        if (!box) { box = document.createElement('div'); box.className = 'mcfo-notices'; document.body.appendChild(box); }
        const n = document.createElement('div');
        n.className = 'mcfo-notice' + (tone === 'error' ? ' mcfo-notice--error' : '');
        n.innerHTML = `<span class="mcfo-notice__text">${html}</span><button type="button" class="mcfo-notice__x" aria-label="Dismiss">×</button>`;
        n.querySelector('button').addEventListener('click', () => n.remove());
        box.appendChild(n);
        setTimeout(() => n.remove(), 12000);
    }

    function startDailies() {
        loadDailies();
        loadMoney();
        setInterval(() => { if (!document.hidden) loadDailies(); }, DAILY_EVERY_MS);
        setInterval(() => { if (!document.hidden && openShopQuests().length) refreshShopQuests(); }, SHOP_EVERY_MS);
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && Date.now() - daily.at > 60 * 1000) loadDailies();
        });
        // The shop opened as a page of its own, not in a window.
        shopDocAssist(document);
        invDocAssist(document);   // the inventory opened as a page of its own (12e)
    }

