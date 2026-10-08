    // =========================================================================================
    // 8b. TILESET CARD: CURRENT AND NEXT (6.36)
    // =========================================================================================
    // The tileset card has two lines: the tileset, and the game's session line ("Active: Earning
    // Tickets"). The session line is about tickets, so it moves over to the Tickets card, and the
    // tileset card says what comes next instead:
    //
    //     Current: Base Set
    //     Next: Even Tide (14:00)
    //
    // "Next" comes from the schedule the Events panel reads (/api/gameplay/chat-command/schedule,
    // public): rows { tilesetId, startsAtUtcMs, durationMs, activeNow }, the first row that has
    // not begun yet. Asked every ten minutes and whenever the row shown has begun; the clock is
    // the viewer's own, and a start on another day gets the weekday in front.
    // The game's session line is hidden, not moved: it keeps writing into it (syncStatus in
    // app.js, text and title), and a watcher copies both over at once.
    const NEXT_EVERY_MS = 10 * 60 * 1000;
    const nextEv = { rows: [], at: 0, busy: false, fail: 0 };
    let tstatusWatch = null;

    async function loadNextEvents() {
        if (nextEv.busy) return;
        nextEv.busy = true;
        try {
            const r = await fetch(eventsUrl(12), { credentials: 'include', cache: 'no-store' });
            const d = r.ok ? await r.json() : null;
            if (!d || !d.window || !Array.isArray(d.window.rows)) throw new Error('HTTP ' + r.status);
            // The server's clock against ours, so "has begun" means the same on both sides.
            const skew = Number(d.window.nowUtcMs) ? Number(d.window.nowUtcMs) - Date.now() : 0;
            nextEv.rows = d.window.rows.map(x => ({ id: x.tilesetId, start: Number(x.startsAtUtcMs) - skew }))
                .filter(x => x.id && Number.isFinite(x.start)).sort((a, b) => a.start - b.start);
            nextEv.fail = 0;
        } catch (e) {
            nextEv.fail++;   // tried again on the next beat that is due, a little later each time
        }
        nextEv.at = Date.now();
        nextEv.busy = false;
    }

    function nextEventText() {
        const now = Date.now();
        const row = nextEv.rows.find(x => x.start > now);
        const due = now - nextEv.at > NEXT_EVERY_MS * (nextEv.fail ? Math.min(nextEv.fail, 3) / 5 : 1);
        if (!nextEv.busy && (due || (!row && now - nextEv.at > 60 * 1000))) loadNextEvents();
        if (!row) return null;
        const d = new Date(row.start);
        const clock = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const sameDay = d.toDateString() === new Date(now).toDateString();
        return { name: tilesetName(row.id), time: sameDay ? clock : d.toLocaleDateString([], { weekday: 'short' }) + ' ' + clock,
                 title: `starts in ${durationText(row.start - now)}` };
    }

    function buildSessionLines() {
        const on = !!settings.sessionNext;
        document.documentElement.setAttribute('data-mcfo-sessnext', on ? '1' : '0');
        const cell = role('session-cell');
        const label = cell && cell.querySelector('[data-role="session-label"]');
        const socket = cell && cell.querySelector(':scope > [data-role="socket"]');
        const tickets = document.querySelector('[data-role="metric-cell"][data-metric-role="tickets"]');
        let line = cell && cell.querySelector(':scope > .mcfo-nextev');
        let status = document.querySelector('.mcfo-tstatus');

        // "Tileset:" becomes "Current:" — and back, when switched off.
        if (label) {
            if (!label.hasAttribute('data-mcfo-orig')) label.setAttribute('data-mcfo-orig', label.textContent);
            const want = on ? 'Current:' : label.getAttribute('data-mcfo-orig');
            if (label.textContent !== want) label.textContent = want;
        }
        if (!on) {
            if (line) line.remove();
            if (status) status.remove();
            if (tstatusWatch) { tstatusWatch.disconnect(); tstatusWatch = null; }
            return;
        }
        if (cell) {
            if (!line) {
                line = document.createElement('span');
                line.className = 'mcfo-nextev';
                line.innerHTML = '<span class="mcfo-nextev__label">Next:</span><strong class="mcfo-nextev__name"></strong><span class="mcfo-nextev__time"></span>';
                cell.appendChild(line);
            }
            const next = nextEventText();
            const name = next ? next.name : (nextEv.at ? 'nothing in the next 12 hours' : '\u2026');
            const time = next ? `(${next.time})` : '';
            const nameEl = line.querySelector('.mcfo-nextev__name'), timeEl = line.querySelector('.mcfo-nextev__time');
            if (nameEl.textContent !== name) nameEl.textContent = name;
            if (timeEl.textContent !== time) timeEl.textContent = time;
            const title = next ? next.title : '';
            if (line.title !== title) line.title = title;
        }
        if (tickets && socket) {
            if (!status) {
                status = document.createElement('span');
                status.className = 'mcfo-tstatus';
            }
            if (status.parentElement !== tickets) tickets.appendChild(status);   // the third, right-aligned column
            copySessionStatus(socket, status);
            if (!tstatusWatch || tstatusWatch.target !== socket) {
                if (tstatusWatch) tstatusWatch.disconnect();
                tstatusWatch = new MutationObserver(() => { const st = document.querySelector('.mcfo-tstatus'); if (st) copySessionStatus(socket, st); });
                tstatusWatch.observe(socket, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['title'] });
                tstatusWatch.target = socket;
            }
        }
    }

    // "Active: Earning Tickets" as two lines, the state in colour; anything else (Live connecting,
    // Live reconnecting) as it is.
    function copySessionStatus(socket, status) {
        const text = (socket.textContent || '').trim();
        const title = socket.getAttribute('title') || '';
        if (status.getAttribute('data-mcfo-src') === text && status.title === title) return;
        status.setAttribute('data-mcfo-src', text);
        status.title = title;
        const m = text.match(/^([^:]+):\s*(.+)$/);
        const state = m ? m[1].trim().toLowerCase() : '';
        status.setAttribute('data-mcfo-state', state === 'active' ? 'active' : state === 'inactive' ? 'inactive' : '');
        status.innerHTML = '';
        const top = document.createElement('b');
        top.textContent = m ? m[1].trim() : text;
        status.appendChild(top);
        if (m) {
            const sub = document.createElement('span');
            sub.textContent = m[2].trim();
            status.appendChild(sub);
        }
    }

