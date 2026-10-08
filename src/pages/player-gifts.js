    // =========================================================================================
    // 12f. PLAYER GIFTS: WHO CAN STILL GET SOMETHING FROM YOU (6.44)
    // =========================================================================================
    // The game lets every signed-in player give every other one ONE Gold Gift and ONE Diamond
    // Gift, ever (/api/player-gifts/*, on the profile page). Its own panel answers one name at a
    // time, behind a search box, on a page that takes a while to load. This window asks the same
    // endpoints for everybody who is playing right now and lists who can still get what.
    //
    // There is no list of all players in the game. "Playing right now" = the three participation
    // boards of the current episode (top 100 each, public, with playerId) plus whoever wrote in
    // the chat recently (names only → the game's own gift search finds their id).
    //
    // A gift that has been sent, or a recipient whose lifetime cap is full, never opens again —
    // both are remembered per giver in localStorage and not asked for again. Open answers are
    // kept 10 minutes.
    const GIFT_KEY = '#gifts';
    const GIFT_STORE = 'mcfo_gifts';
    const GIFT_OPEN_TTL = 10 * 60 * 1000;
    const GIFT_BOARDS = ['tiles_played_total', 'tickets_spent_total', 'points_earned_total'];
    const GIFT_CUR = [['gold', 'Gold'], ['diamonds', 'Diamonds']];
    const gift = {
        players: new Map(),     // playerId -> { id, name }
        elig: new Map(),        // playerId -> { at, gold, diamonds }  (the game's eligibility objects)
        balance: {},            // currency -> giver balance, from the newest answer
        loading: false, done: 0, total: 0, listAt: 0,
        query: '', openRow: null, arm: null, busy: false,
        body: null,
    };
    const giftStoreRead = () => { try { return JSON.parse(localStorage.getItem(GIFT_STORE) || '{}') || {}; } catch (e) { return {}; } };
    const giftStoreWrite = s => { try { localStorage.setItem(GIFT_STORE, JSON.stringify(s)); } catch (e) {} };
    function giftOnlyOpen() { try { return localStorage.getItem('mcfo_gifts_onlyopen') !== '0'; } catch (e) { return true; } }

    // Closed for good: 'sent' (you gave this one already) or 'full' (their lifetime cap is reached).
    function giftClosed(id) {
        const s = giftStoreRead(), me = loPlayerNow();
        return (me && s[me] && s[me][id]) || {};
    }
    function giftRemember(id, el) {
        const me = loPlayerNow();
        if (!me || !el) return;
        const s = giftStoreRead();
        const mine = s[me] || (s[me] = {});
        const row = Object.assign({}, mine[id]);
        for (const [cur] of GIFT_CUR) {
            const e = el[cur];
            if (!e) continue;
            if (e.pairwiseAvailable === false) row[cur] = 'sent';
            else if (Number(e.recipientRemaining) <= 0) row[cur] = 'full';
        }
        if (Object.keys(row).length) { mine[id] = row; giftStoreWrite(s); }
    }
    // 'open' | 'sent' | 'full' | 'low' (too little balance for the smallest amount) | 'wait' | 'err'
    function giftStatus(id, cur) {
        const closed = giftClosed(id)[cur];
        if (closed) return closed;
        const el = gift.elig.get(id);
        if (!el) return 'wait';
        const e = el[cur];
        if (!e) return 'err';
        if (e.pairwiseAvailable === false) return 'sent';
        if (Number(e.recipientRemaining) <= 0) return 'full';
        const amounts = (e.permittedAmounts || []).map(Number);
        if (!amounts.some(a => Number(e.giverBalance) >= a)) return 'low';
        return 'open';
    }
    const giftCanGive = id => GIFT_CUR.some(([cur]) => ['open', 'low', 'wait'].includes(giftStatus(id, cur)));

    async function giftCollectPlayers() {
        const me = loPlayerNow(), myName = (accountName() || '').toLowerCase();
        const add = (id, name) => {
            if (!id || !name || !/^twitch:/.test(id) || id === me || name.toLowerCase() === myName) return;
            if (!gift.players.has(id)) gift.players.set(id, { id, name: String(name) });
        };
        let ep = null;
        try { ep = (await apiJson('/api/stat-windows/current')).currentEpisode; } catch (e) {}
        if (ep && ep.id) {
            await Promise.all(GIFT_BOARDS.map(async key => {
                try {
                    const r = await apiJson(`/api/leaderboards?windowType=episode&windowId=${encodeURIComponent(ep.id)}&statKey=${key}&limit=100`);
                    for (const row of r.rows || []) add(String(row.playerId || ''), row.displayName);
                } catch (e) {}
            }));
        }
        // Chat names that are not on a board yet: the gift search maps a name to its id. Capped,
        // one request each.
        const known = new Set([...gift.players.values()].map(p => p.name.toLowerCase()));
        const chatNames = [...new Set([...document.querySelectorAll('.mcf-chat__sender')].map(senderText).filter(Boolean))]
            .filter(n => !known.has(n.toLowerCase()) && n.toLowerCase() !== myName && n.length >= 2).slice(0, 20);
        for (const n of chatNames) {
            try {
                const r = await apiJson('/api/player-gifts/search?q=' + encodeURIComponent(n));
                const hit = (r.candidates || []).find(c => String(c.displayName || '').toLowerCase() === n.toLowerCase());
                if (hit) add(String(hit.playerId), hit.displayName);
            } catch (e) {}
        }
        gift.listAt = Date.now();
    }

    async function giftCheck(id) {
        const r = await apiJson('/api/player-gifts/eligibility?recipientPlayerId=' + encodeURIComponent(id));
        const el = { at: Date.now(), gold: r.eligibility && r.eligibility.gold, diamonds: r.eligibility && r.eligibility.diamonds };
        gift.elig.set(id, el);
        for (const [cur] of GIFT_CUR) if (el[cur] && Number.isFinite(Number(el[cur].giverBalance))) gift.balance[cur] = Number(el[cur].giverBalance);
        giftRemember(id, el);
        return el;
    }

    // Four at a time: ~0.1 s per answer, so a hundred players take a few seconds, and the list
    // fills in while it runs.
    async function giftLoad(force) {
        if (gift.loading) return;
        gift.loading = true; giftDraw();
        try {
            // Our own id keeps us out of the list and keys the remembered gifts.
            try { await loKnowPlayer(); } catch (e) {}
            if (force || !gift.players.size || Date.now() - gift.listAt > GIFT_OPEN_TTL) await giftCollectPlayers();
            const todo = [...gift.players.keys()].filter(id => {
                const c = giftClosed(id);
                if (c.gold && c.diamonds) return false;
                const el = gift.elig.get(id);
                return force || !el || Date.now() - el.at > GIFT_OPEN_TTL;
            });
            gift.done = 0; gift.total = todo.length;
            let next = 0, lastDraw = 0;
            const worker = async () => {
                while (next < todo.length) {
                    const id = todo[next++];
                    try { await giftCheck(id); } catch (e) { gift.elig.set(id, { at: Date.now(), error: e.message }); }
                    gift.done++;
                    if (Date.now() - lastDraw > 250) { lastDraw = Date.now(); giftDraw(); }
                }
            };
            await Promise.all([worker(), worker(), worker(), worker()]);
        } finally {
            gift.loading = false;
            giftDraw();
        }
    }

    // Searching for someone who is not in the list: the game's search, then their status.
    let giftSearchTimer = 0;
    function giftSearchMore(q) {
        clearTimeout(giftSearchTimer);
        if (q.length < 2) return;
        giftSearchTimer = setTimeout(async () => {
            const me = loPlayerNow();
            try {
                const r = await apiJson('/api/player-gifts/search?q=' + encodeURIComponent(q));
                const fresh = (r.candidates || []).filter(c => /^twitch:/.test(c.playerId) && c.playerId !== me && !gift.players.has(c.playerId));
                for (const c of fresh) gift.players.set(c.playerId, { id: c.playerId, name: String(c.displayName || c.playerId) });
                giftDraw();
                for (const c of fresh) { try { await giftCheck(c.playerId); } catch (e) {} giftDraw(); }
            } catch (e) {}
        }, 400);
    }

    async function giftSend(id, cur, amount) {
        const p = gift.players.get(id);
        gift.busy = true; giftDraw();
        try {
            const opKey = 'mcfo_gift_op_' + id + '|' + cur + '|' + amount;
            // Same id on a retry: the server books one gift per operationId, so a click that got
            // no answer cannot send twice.
            let op = null;
            try { op = sessionStorage.getItem(opKey); } catch (e) {}
            if (!op) { op = (crypto.randomUUID && crypto.randomUUID()) || 'gift-' + Date.now() + '-' + Math.random().toString(16).slice(2); try { sessionStorage.setItem(opKey, op); } catch (e) {} }
            await apiJson('/api/player-gifts/' + cur, { method: 'POST', body: JSON.stringify({ recipientPlayerId: id, amount, operationId: op }) });
            try { sessionStorage.removeItem(opKey); } catch (e) {}
            notice(`Sent <b>${escapeHtml(amount.toLocaleString('en-US'))} ${cur === 'gold' ? 'Gold' : 'Diamonds'}</b> to <b>${escapeHtml(p ? p.name : id)}</b>.`);
            try { await giftCheck(id); } catch (e) {}
        } catch (e) {
            notice(`Gift was not sent: ${escapeHtml(e.message || 'unknown error')}`, 'error');
        } finally {
            gift.busy = false; gift.arm = null; giftDraw();
        }
    }

    const GIFT_LABEL = { open: 'open', sent: 'sent', full: 'cap full', low: 'too little', wait: '…', err: '?' };
    function giftDraw() {
        const body = gift.body;
        if (!body || !body.isConnected) return;
        const scroll = body.querySelector('.mcfo-gift__list');
        const head = body.querySelector('.mcfo-gift__bal');
        const prog = body.querySelector('.mcfo-gift__prog');
        if (!scroll) return;
        const fmt = n => Number.isFinite(n) ? n.toLocaleString('en-US') : '–';
        head.textContent = `Your balance: ${fmt(gift.balance.gold)} Gold · ${fmt(gift.balance.diamonds)} Diamonds`;
        prog.textContent = gift.loading
            ? (gift.total ? `Checking ${gift.done} / ${gift.total} players …` : 'Collecting players …')
            : `${gift.players.size} active players`;

        const q = gift.query.trim().toLowerCase();
        const onlyOpen = giftOnlyOpen();
        const rows = [...gift.players.values()]
            .filter(p => !q || p.name.toLowerCase().includes(q))
            .filter(p => !onlyOpen || q || giftCanGive(p.id))
            .sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
        const keepTop = scroll.scrollTop;
        scroll.textContent = '';
        if (!rows.length) {
            const empty = document.createElement('div');
            empty.className = 'mcfo-gift__empty';
            empty.textContent = gift.loading ? 'Loading …' : q ? 'Nobody by that name — searching the game …' : 'Nobody left to gift right now.';
            scroll.appendChild(empty);
        }
        for (const p of rows) {
            const row = document.createElement('div');
            row.className = 'mcfo-gift__row' + (gift.openRow === p.id ? ' mcfo-gift__row--open' : '');
            const line = document.createElement('button');
            line.type = 'button';
            line.className = 'mcfo-gift__line';
            const nm = document.createElement('span');
            nm.className = 'mcfo-gift__name';
            nm.textContent = p.name;
            line.appendChild(nm);
            for (const [cur] of GIFT_CUR) {
                const st = giftStatus(p.id, cur);
                const tag = document.createElement('span');
                tag.className = 'mcfo-gift__st mcfo-gift__st--' + st;
                tag.textContent = GIFT_LABEL[st];
                line.appendChild(tag);
            }
            line.addEventListener('click', () => {
                gift.openRow = gift.openRow === p.id ? null : p.id;
                gift.arm = null;
                giftDraw();
                // Older than the TTL: ask again before offering buttons.
                const el = gift.elig.get(p.id);
                if (gift.openRow === p.id && (!el || Date.now() - el.at > GIFT_OPEN_TTL)) giftCheck(p.id).then(giftDraw, giftDraw);
            });
            row.appendChild(line);
            if (gift.openRow === p.id) row.appendChild(giftAmounts(p));
            scroll.appendChild(row);
        }
        scroll.scrollTop = keepTop;
    }

    // The amounts the server allows (normally 1,000/2,500/5,000 Gold and 100/250/500 Diamonds,
    // fewer near the cap). First click arms the button, the second one sends — no browser dialog.
    function giftAmounts(p) {
        const box = document.createElement('div');
        box.className = 'mcfo-gift__amounts';
        const el = gift.elig.get(p.id) || {};
        for (const [cur, label] of GIFT_CUR) {
            const line = document.createElement('div');
            line.className = 'mcfo-gift__cur';
            const lab = document.createElement('span');
            lab.className = 'mcfo-gift__curlab';
            lab.textContent = label;
            line.appendChild(lab);
            const st = giftStatus(p.id, cur), e = el[cur];
            if (st !== 'open' && st !== 'low') {
                const t = document.createElement('span');
                t.className = 'mcfo-gift__note';
                t.textContent = st === 'sent' ? 'You already gave this player your ' + label + ' Gift.'
                    : st === 'full' ? 'This player has reached the lifetime ' + label + ' Gift cap.'
                    : st === 'wait' ? 'Checking …' : 'Not available right now.';
                line.appendChild(t);
            } else {
                for (const a of (e.permittedAmounts || []).map(Number)) {
                    const b = document.createElement('button');
                    b.type = 'button';
                    b.className = 'mcfo-doc__btn mcfo-gift__amt';
                    const armed = gift.arm === p.id + '|' + cur + '|' + a;
                    b.textContent = armed ? `Send ${a.toLocaleString('en-US')}?` : a.toLocaleString('en-US');
                    if (armed) b.classList.add('mcfo-doc__btn--main');
                    b.disabled = gift.busy || Number(e.giverBalance) < a;
                    b.addEventListener('click', ev => {
                        ev.stopPropagation();
                        if (armed) { giftSend(p.id, cur, a); return; }
                        gift.arm = p.id + '|' + cur + '|' + a;
                        giftDraw();
                        setTimeout(() => { if (gift.arm === p.id + '|' + cur + '|' + a) { gift.arm = null; giftDraw(); } }, 5000);
                    });
                    line.appendChild(b);
                }
                const rest = document.createElement('span');
                rest.className = 'mcfo-gift__note';
                rest.textContent = `can still receive ${Number(e.recipientRemaining).toLocaleString('en-US')}`;
                line.appendChild(rest);
            }
            box.appendChild(line);
        }
        const warn = document.createElement('div');
        warn.className = 'mcfo-gift__warn';
        warn.textContent = 'One Gold Gift and one Diamond Gift per player, ever. Gifts cannot be undone.';
        box.appendChild(warn);
        return box;
    }

    function showGifts() {
        showDocWindow(GIFT_KEY, 'Player gifts', { width: 520, height: Math.min(640, innerHeight - 80) }, body => {
            const scroll = docBox(body);
            scroll.classList.add('mcfo-gift');
            scroll.innerHTML = `
                <div class="mcfo-gift__top">
                    <div class="mcfo-gift__bal"></div>
                    <input class="mcfo-gift__search" type="search" placeholder="Search player …" maxlength="64" autocomplete="off">
                    <div class="mcfo-gift__head"><span>Player</span><span>Gold</span><span>Diamonds</span></div>
                </div>
                <div class="mcfo-gift__list"></div>`;
            const input = scroll.querySelector('.mcfo-gift__search');
            input.value = gift.query;
            input.addEventListener('input', () => { gift.query = input.value; giftDraw(); giftSearchMore(input.value.trim()); });
            const check = document.createElement('label');
            check.className = 'mcfo-doc__check';
            check.innerHTML = '<input type="checkbox"> Only players I can still gift';
            check.firstChild.checked = giftOnlyOpen();
            check.firstChild.addEventListener('change', e => { try { localStorage.setItem('mcfo_gifts_onlyopen', e.target.checked ? '1' : '0'); } catch (x) {} giftDraw(); });
            const prog = document.createElement('span');
            prog.className = 'mcfo-gift__prog';
            docFoot(scroll, check, prog, docButton('Refresh', () => giftLoad(true)));
            gift.body = body;
            giftDraw();
            giftLoad(false);
        });
    }

