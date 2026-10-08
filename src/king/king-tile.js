    // =========================================================================================
    // 4. KING TILE: NAME, GOLD, TOLL
    // =========================================================================================
    // Two sources for name and toll, on purpose:
    //   1. /api/king/snapshot?view=summary -> king.displayName, king.baseToll, king.capturedAtMs
    //      The truth, and available immediately on load.
    //   2. the chat lines                                     Instant, without waiting for a poll.
    // The poll alone would lag; the chat alone would be incomplete, because someone who reloads
    // has seen no lines at all. Chat is read from the text node, which still works when another
    // script has hidden the line with display:none.
    let kingState = { name: null, toll: null, at: 0 };
    let kingReported = false;

    function kingAnchor() {
        for (const r of KING_ANCHORS) { const el = role(r); if (el) return el; }
        return null;
    }

    function kingField(anchor, kind) {
        let el = anchor.querySelector(`:scope > .mcfo-king-field--${kind}`);
        if (el) return el;
        el = document.createElement('div');
        el.className = `mcfo-king-field mcfo-king-field--${kind}`;
        el.innerHTML = kind === 'name'
            ? '<span class="mcfo-name"></span>'
            : '<span class="mcfo-label">Toll:</span><span class="mcfo-value"></span>';
        anchor.appendChild(el);
        return el;
    }

    // Which of the game's lines to hide, as words on <html> (CSS above). "off" hides the whole
    // block. With the switch off entirely nothing is written and the game's look stays untouched.
    const KING_CORNER_LINES = [['kcName', 'name'], ['kcReign', 'reign'], ['kcDuration', 'duration'],
                               ['kcGold', 'gold'], ['kcTolls', 'tolls'], ['kcThwarted', 'thwarted']];
    function writeKingCornerFlags() {
        const html = document.documentElement;
        if (!settings.kingCorner) { html.removeAttribute('data-mcfo-kc'); return; }
        const hide = KING_CORNER_LINES.filter(([k]) => !settings[k]).map(([, w]) => w);
        html.setAttribute('data-mcfo-kc', ['on', ...hide].join(' '));
    }

    // The set toll as one more line in the game's right column. The game rebuilds that block
    // when the layout changes, so this runs every tick and simply puts the line back.
    function drawTollLine(labels) {
        const right = labels.querySelector('.mcf-king-corner-labels__right');
        let line = labels.querySelector('.mcfo-kc-toll');
        if (!right || !settings.kingCorner || !settings.kingToll || kingState.toll === null) { line?.remove(); return; }
        if (!line || line.parentNode !== right) {
            line?.remove();
            line = document.createElement('span');
            line.className = 'mcfo-kc-toll';
            line.innerHTML = 'Toll: <b></b>';
            right.appendChild(line);
        }
        const v = String(kingState.toll);
        if (line.lastChild.textContent !== v) line.lastChild.textContent = v;
        line.setAttribute('data-mcfo-stale', (Date.now() - kingState.at > KING_POLL_MS * 2) ? '1' : '0');
    }

    // The king's VIP tier (6.42), one more line in the game's left column, under "<title> <time>".
    // The king snapshot carries no VIP, but the public leaderboard does: statKey=vip_points lists
    // every player with VIP points (all_time, no login needed; 52 players on 2026-10-01). Whoever is
    // missing has fewer than 10 points, which the game calls plain "Initiate". Tier names and colours
    // exactly as the game has them (_shared/mcf-shared/vip.js, chatPane.js MATERIAL_TEXT_COLORS).
    const VIP_MATERIALS = ['Bronze', 'Silver', 'Gold', 'Emerald', 'Sapphire', 'Ruby', 'Diamond', 'Amethyst', 'Ethereal', 'Cosmic'];
    const VIP_PRESTIGE  = ['Initiate', 'Honored', 'Favored', 'Revered', 'Exalted', 'Ascendant', 'Radiant', 'Imperial', 'Eternal', 'Cosmic'];
    const VIP_STARTS    = [10, 115, 270, 475, 730, 1040, 1445, 1900, 2425, 3200];
    const VIP_STEPS     = [10, 15, 20, 25, 30, 40, 45, 50, 75, 100];
    const VIP_COLOURS   = { Bronze: '#eeaa66', Silver: '#f6fbff', Gold: '#ffe36e', Emerald: '#4ff0a7', Sapphire: '#76c8ff',
                            Ruby: '#ff6c86', Diamond: '#e5fdff', Amethyst: '#df9dff', Ethereal: '#bcfff0', Cosmic: '#ffc1ff' };
    const VIP_BOARD_URL = '/api/leaderboards?windowType=all_time&statKey=vip_points&limit=100';
    const VIP_BOARD_MS  = 5 * 60 * 1000;
    const vipBoard = { at: 0, busy: false, full: false, byName: new Map(), missFor: '', missAt: 0 };

    function vipTier(points) {
        let tier = { label: 'Initiate', material: null };
        if (!(points >= 10)) return tier;
        VIP_PRESTIGE.forEach((prestige, p) => VIP_MATERIALS.forEach((material, m) => {
            if (VIP_STARTS[p] + VIP_STEPS[p] * m <= points) tier = { label: `${material} ${prestige}`, material };
        }));
        return tier;
    }
    async function refreshVipBoard() {
        if (vipBoard.busy) return;
        vipBoard.busy = true;
        try {
            const res = await fetch(VIP_BOARD_URL, { credentials: 'include' });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const rows = ((await res.json()) || {}).rows || [];
            vipBoard.byName = new Map(rows.map(r => [String(r.displayName || '').toLowerCase(), Number(r.value) || 0]));
            vipBoard.full = rows.length >= 100;   // a full page may have cut someone off: then "missing" proves nothing
            vipBoard.at = Date.now();
        } catch (e) {
            vipBoard.at = Date.now() - VIP_BOARD_MS + 60 * 1000;   // try again in a minute
        } finally { vipBoard.busy = false; }
    }
    function drawVipLine(labels) {
        const left = labels.querySelector('.mcf-king-corner-labels__left');
        const nameEl = labels.querySelector('[data-role="king-corner-name"]');
        let line = labels.querySelector('.mcfo-kc-vip');
        if (!left || !nameEl || !settings.kingCorner || !settings.kcVip) { line?.remove(); return; }
        if (Date.now() - vipBoard.at > VIP_BOARD_MS) refreshVipBoard();
        // The name as the game shows it, minus its crown: always the current king, even between polls.
        const name = (nameEl.textContent || '').replace(/^\s*\u{1F451}\uFE0F?\s*/u, '').trim().toLowerCase();
        if (!name || !vipBoard.at) { line?.remove(); return; }
        let points = vipBoard.byName.get(name);
        if (points === undefined) {
            // A new king who is not on the board: fetch once more (points may have just come in), at most once a minute
            if (vipBoard.missFor !== name || Date.now() - vipBoard.missAt > 60 * 1000) { vipBoard.missFor = name; vipBoard.missAt = Date.now(); refreshVipBoard(); }
            if (vipBoard.full) { line?.remove(); return; }
            points = 0;
        }
        const tier = vipTier(points);
        if (!line || line.parentNode !== left) {
            line?.remove();
            line = document.createElement('span');
            line.className = 'mcfo-kc-vip';
            left.appendChild(line);
        }
        if (line.textContent !== tier.label) line.textContent = tier.label;
        const colour = tier.material ? VIP_COLOURS[tier.material] : '';
        if (line.style.color !== colour) line.style.color = colour;
    }

    function drawKingFields() {
        const anchor = kingAnchor();
        if (!anchor) return;
        const clear = () => anchor.querySelectorAll(':scope > .mcfo-king-field').forEach(e => e.remove());

        // Since game v0.10.1: the game draws the read-outs itself, ours join them (see above).
        const labels = document.querySelector('[data-role="king-corner-labels"]');
        if (labels) { clear(); drawTollLine(labels); drawVipLine(labels); return; }

        // Older builds without the game's block: our own two fields, as before 6.28.
        const showName = settings.kingCorner && settings.kcName;
        const showToll = settings.kingCorner && settings.kingToll;
        if (!showName && !showToll) { clear(); return; }
        if (kingState.name === null && kingState.toll === null) { clear(); return; }
        // Name and toll have their own switches since 3.8; whichever is off loses its field.
        if (!showName) anchor.querySelector(':scope > .mcfo-king-field--name')?.remove();
        if (!showToll) anchor.querySelector(':scope > .mcfo-king-field--toll')?.remove();

        // Absolutely positioned inside the frame; were the frame static, the fields would stick
        // to the edge of the page instead.
        if (getComputedStyle(anchor).position === 'static') anchor.style.position = 'relative';

        const stale = (Date.now() - kingState.at > KING_POLL_MS * 2) ? '1' : '0';

        if (showName && kingState.name !== null) {
            const field = kingField(anchor, 'name');
            field.querySelector('.mcfo-name').textContent = kingState.name;
            field.setAttribute('data-mcfo-stale', stale);
        }
        if (showToll && kingState.toll !== null) {
            const field = kingField(anchor, 'toll');
            field.querySelector('.mcfo-value').textContent = String(kingState.toll);
            field.setAttribute('data-mcfo-stale', stale);
        }
    };

    function setKing(name, toll) {
        if (name) kingState.name = name;
        if (toll !== undefined && toll !== null) {
            const n = Number(toll);
            if (Number.isInteger(n) && n >= 0) kingState.toll = n;
        }
        kingState.at = Date.now();
        drawKingFields();
    }

    async function pollKing() {
        if (!settings.kingCorner || (!settings.kcName && !settings.kingToll)) return;
        try {
            const res = await fetch('/api/king/snapshot?view=summary', { credentials: 'include' });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const data = await res.json();
            const king = data && data.king;
            if (!king) throw new Error('no king in the response');
            setKing(king.displayName, king.baseToll);
        } catch (e) {
            // Report once, not on every attempt, or the console fills up within the hour.
            if (!kingReported) { kingReported = true; console.warn('[MarbleLuceFall] king snapshot unavailable:', e.message); }
        }
    }

    function readChat() {
        const list = document.querySelector('[data-role="chat-messages"], .mcf-chat__messages');
        if (!list) return;
        for (const msg of list.querySelectorAll('article.mcf-chat__message:not([data-mcfo-read])')) {
            msg.setAttribute('data-mcfo-read', '1');
            const text = (msg.querySelector('.mcf-chat__text') || msg).textContent || '';

            const crown = CROWN_PATTERN.exec(text);
            if (crown) {
                // The toll belonged to the previous king; showing it on would be worse than a gap.
                kingState.toll = null;
                setKing(crown[1].trim(), null);
                pollKing();   // pull the truth straight away (toll, exact spelling)
                continue;
            }

            const toll = TOLL_PATTERN.exec(text);
            if (toll) setKing((text.match(/^(.+?)\s+changed the Crown toll/i) || [])[1], toll[1]);
        }
    }

