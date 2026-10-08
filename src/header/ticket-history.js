    // =========================================================================================
    // 8c. TICKET HISTORY ON THE TICKETS CARD (6.38)
    // =========================================================================================
    // The game shows the ticket balance and nothing about how it got there. Read on every beat
    // from the card itself (the game writes the whole number, grouped for the locale:
    // formatIntegerForDisplay), each rise counts as earned, each fall as spent. Kept in
    // localStorage, so a reload or a second tab carries on the same count:
    //   mcfo_tix = { player, last, earned, spent, since, samples: [[t, earned, spent], ...] }
    // "earned"/"spent" are running totals; a sample every five minutes, 48 hours of them. Any
    // window is then the difference between now and the sample at its start. Both tabs update
    // the same "last" value, so a change is counted once, by whichever tab sees it first.
    // What happened while no tab was open lands on the moment a tab comes back: the change is
    // right, only its time is not. The popup says since when it has been counting.
    const TIX_KEY = 'mcfo_tix';
    const TIX_SAMPLE_MS = 5 * 60 * 1000, TIX_KEEP_MS = 48 * 3600 * 1000;
    const tixOpen = { earned: null, spent: null, at: Date.now() };   // this page, since it was opened
    let tixSeen = null;   // the last value THIS tab saw, for the flying tickets (another tab may count first)

    // --- Flying tickets (6.38) ---
    // When the balance has risen (see tixFlyGain): 2 to 7 small tickets (more for more tickets, on a log scale)
    // and "+N" rise from the number on the card and fade out within a second. Only in a visible
    // tab, never at the Maximum performance level or with reduced motion asked for, and never for
    // the first reading of a page (that is catching up, not earning). A watcher on the number
    // shows it the moment the game writes it, not on the next beat.
    const TIX_SVG = '<svg viewBox="0 0 24 16" aria-hidden="true"><path d="M2 2h20v4a2 2 0 0 0 0 4v4H2v-4a2 2 0 0 0 0-4Z" fill="#f2c14e" stroke="#5a3d06" stroke-width="1.2" stroke-linejoin="round"/><path d="M15 3v10" stroke="#5a3d06" stroke-width="1" stroke-dasharray="1.5 1.5"/></svg>';
    function ticketFly(gain) {
        if (!settings.ticketFly || document.hidden || settings.perfLevel === 'maximum') return;
        try { if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return; } catch (e) {}
        const num = document.querySelector('[data-role="metric-cell"][data-metric-role="tickets"] [data-role="tickets"]');
        const r = num && num.getBoundingClientRect();
        if (!r || !r.width) return;
        const layer = document.createElement('div');
        layer.className = 'mcfo-tixfly';
        layer.style.left = Math.round(r.left + r.width / 2) + 'px';
        layer.style.top = Math.round(r.top + r.height / 2) + 'px';
        const n = Math.max(2, Math.min(7, Math.round(1 + Math.log10(Math.max(1, gain)) * 1.5)));
        for (let i = 0; i < n; i++) {
            const t = document.createElement('span');
            t.className = 'mcfo-tixfly__t';
            t.innerHTML = TIX_SVG;
            layer.appendChild(t);
            const dx = (Math.random() - 0.5) * 90, dy = 40 + Math.random() * 45, rot = (Math.random() - 0.5) * 70;
            t.animate([
                { transform: 'translate(-50%, -50%) scale(0.6) rotate(0deg)', opacity: 0 },
                { transform: `translate(calc(-50% + ${dx * 0.35}px), calc(-50% + ${dy * 0.35}px)) scale(1) rotate(${rot * 0.4}deg)`, opacity: 1, offset: 0.25 },
                { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.85) rotate(${rot}deg)`, opacity: 0 },
            ], { duration: 850 + Math.random() * 300, delay: i * 45, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)', fill: 'both' });
        }
        const plus = document.createElement('span');
        plus.className = 'mcfo-tixfly__plus';
        plus.textContent = '+' + Number(gain).toLocaleString();
        layer.appendChild(plus);
        plus.animate([
            { transform: 'translate(-50%, -50%)', opacity: 0 },
            { transform: 'translate(-50%, calc(-50% + 14px))', opacity: 1, offset: 0.2 },
            { transform: 'translate(-50%, calc(-50% + 46px))', opacity: 0 },
        ], { duration: 1300, easing: 'ease-out', fill: 'both' });
        document.body.appendChild(layer);
        setTimeout(() => layer.remove(), 1700);
    }
    // The game already hands tickets out in portions (a few every couple of minutes), so every
    // portion gets its own flight (6.38.1; 6.38.0 gathered them for 30 s, which was not needed).
    // Only two rises within 3 s become one, so one portion written twice never flies twice.
    const TIX_FLY_GAP_MS = 3 * 1000;
    const tixFly = { pending: 0, last: 0, timer: 0 };
    function tixFlyGain(gain) {
        if (!gain) return;
        tixFly.pending += gain;
        clearTimeout(tixFly.timer);
        const go = () => { const n = tixFly.pending; tixFly.pending = 0; tixFly.last = Date.now(); if (n > 0) ticketFly(n); };
        const wait = TIX_FLY_GAP_MS - (Date.now() - tixFly.last);
        if (wait <= 0) go(); else tixFly.timer = setTimeout(go, wait);
    }
    let tixWatch = null;
    function watchTicketNumber() {
        const num = document.querySelector('[data-role="metric-cell"][data-metric-role="tickets"] [data-role="tickets"]');
        if (!num || (tixWatch && tixWatch.target === num)) return;
        if (tixWatch) tixWatch.disconnect();
        tixWatch = new MutationObserver(() => tixTick());
        tixWatch.observe(num, { childList: true, characterData: true, subtree: true });
        tixWatch.target = num;
    }

    function tixRead() {
        const el = document.querySelector('[data-role="metric-cell"][data-metric-role="tickets"] [data-role="tickets"]');
        const text = (el && el.textContent || '').trim();
        if (!/^\d[\d\s.,'\u00a0\u202f]*$/.test(text)) return null;   // "…", "UNAVAILABLE", "—"
        const n = Number(text.replace(/\D/g, ''));
        return Number.isFinite(n) ? n : null;
    }
    // Two keys: the running totals, read and written on every change (small), and the samples,
    // written once every five minutes (up to 576 of them).
    const TIX_SAMPLES = 'mcfo_tix_s';
    function tixLoad() {
        try {
            const d = JSON.parse(localStorage.getItem(TIX_KEY) || 'null');
            if (!d || typeof d !== 'object') return null;
            const smp = JSON.parse(localStorage.getItem(TIX_SAMPLES) || '[]');
            d.samples = Array.isArray(smp) && smp.length ? smp : [[d.since, 0, 0]];
            return d;
        } catch (e) { return null; }
    }
    function tixTick() {
        if (!settings.ticketHistory || signedOut()) return;
        const value = tixRead();
        const player = loPlayerNow() || accountName();
        if (value === null || !player) return;
        if (tixSeen !== null && value > tixSeen) tixFlyGain(value - tixSeen);
        tixSeen = value;
        const now = Date.now();
        let d = null;
        try { d = JSON.parse(localStorage.getItem(TIX_KEY) || 'null'); } catch (e) { /* blocked */ }
        const fresh = !d || d.player !== player || !Number.isFinite(d.last);
        // Another account in this browser starts its own count.
        if (fresh) d = { player, last: value, earned: 0, spent: 0, since: now, sampledAt: 0 };
        const diff = value - d.last;
        if (diff > 0) d.earned += diff; else d.spent -= diff;
        d.last = value;
        // "This page" starts after the first reading: what changed while no tab was open is not
        // this page's.
        if (tixOpen.earned === null) { tixOpen.earned = d.earned; tixOpen.spent = d.spent; }
        const sample = fresh || now - (d.sampledAt || 0) >= TIX_SAMPLE_MS;
        if (!diff && !sample) return;   // nothing to write
        try {
            if (sample) {
                let smp = [];
                try { smp = fresh ? [] : JSON.parse(localStorage.getItem(TIX_SAMPLES) || '[]'); } catch (e) { smp = []; }
                smp.push([now, d.earned, d.spent]);
                while (smp.length > 2 && now - smp[1][0] > TIX_KEEP_MS) smp.shift();
                d.since = smp[0][0];
                d.sampledAt = now;
                localStorage.setItem(TIX_SAMPLES, JSON.stringify(smp));
            }
            localStorage.setItem(TIX_KEY, JSON.stringify(d));
        } catch (e) { /* full or blocked */ }
    }
    // Earned and spent since the given moment, and from when that really counts (the tracking
    // may be younger than the window).
    function tixWindow(d, from) {
        let base = d.samples[0];
        for (const x of d.samples) { if (x[0] <= from) base = x; else break; }
        return { earned: d.earned - base[1], spent: d.spent - base[2], from: Math.max(from, base[0]) };
    }

    function showTicketHistory(anchor) {
        tixTick();
        const menu = showPanel(anchor, 'mcfo-menu--tix', m => {
            const d = tixLoad();
            const value = tixRead();
            const socket = role('socket');
            const text = (socket && socket.textContent || '').trim();
            const why = (socket && socket.getAttribute('title')) || '';
            const sm = text.match(/^([^:]+):\s*(.+)$/);
            const state = sm ? sm[1].trim().toLowerCase() : '';
            const fmt = n => Number(n).toLocaleString();
            const clock = t => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            let html = `<div class="mcfo-tix__head"><span class="mcfo-tix__title">Tickets</span><span class="mcfo-tix__now">${value === null ? '\u2014' : fmt(value)}</span></div>`;
            if (text) html += `<div class="mcfo-tix__status" data-mcfo-state="${state === 'active' ? 'active' : state === 'inactive' ? 'inactive' : ''}">`
                + (sm ? `<b>${escapeHtml(sm[1].trim())}:</b> ${escapeHtml(sm[2].trim())}` : `<b>${escapeHtml(text)}</b>`)
                + (why ? '<br>' + escapeHtml(why) : '') + '</div>';
            if (d && d.player === (loPlayerNow() || accountName())) {
                const now = Date.now(), midnight = new Date(); midnight.setHours(0, 0, 0, 0);
                const rows = [
                    ['Last hour', tixWindow(d, now - 3600 * 1000), now - 3600 * 1000],
                    ['Today', tixWindow(d, midnight.getTime()), midnight.getTime()],
                    ['This page', { earned: d.earned - (tixOpen.earned ?? d.earned), spent: d.spent - (tixOpen.spent ?? d.spent), from: tixOpen.at }, tixOpen.at],
                ];
                html += '<div class="mcfo-tix__grid"><span class="mcfo-tix__h"></span><span class="mcfo-tix__h">Earned</span><span class="mcfo-tix__h">Spent</span>';
                for (const [label, w, want] of rows) {
                    const late = w.from > want + 60 * 1000 ? `<small>since ${clock(w.from)}</small>` : label === 'This page' ? `<small>since ${clock(w.from)}</small>` : '';
                    html += `<span class="mcfo-tix__label">${label}${late}</span><span class="mcfo-tix__earn">+${fmt(w.earned)}</span><span class="mcfo-tix__spend">\u2212${fmt(w.spent)}</span>`;
                }
                html += '</div>';
                html += `<div class="mcfo-tix__note">Counted in this browser since ${new Date(d.since).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })}, while the game is open in a tab. Changes while no tab was open count at the moment a tab comes back.</div>`;
            } else {
                html += '<div class="mcfo-tix__note">Counting starts now: earned and spent tickets show up here as they come.</div>';
            }
            html += '<button type="button" class="mcfo-tix__go">Leaderboards \u203a</button>';
            m.innerHTML = html;
            m.querySelector('.mcfo-tix__go').addEventListener('click', ev => {
                ev.stopPropagation();
                closeMenus();
                const page = PAGES['leaderboards-nav'];
                if (page) openPage(page.path, page.title);
            });
        });
        if (menu) placePanel(anchor, menu);
    }

