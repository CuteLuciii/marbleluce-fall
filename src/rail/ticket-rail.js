    // =========================================================================================
    // 9. THE TICKET RAIL: REBELLION, COLLAPSING, EXTRA CHIPS
    // =========================================================================================
    // Rebellion moves into the rail as a fixed part of it, and everything above 10 folds away
    // behind an arrow. bid-rail is never rebuilt by the game — it is written once and afterwards
    // only has attributes and styles set on it (checked in app.js) — so inserting into it is safe,
    // unlike the king tray.
    //
    // Rebellion is a copy that forwards its click; the original stays hidden in the footer where
    // nothing can destroy it.
    let railOpen = false;
    try { railOpen = localStorage.getItem('mcfo_rail_open') === '1'; } catch (e) {}

    function buildRailGroup() {
        const rail = role('bid-rail');
        if (!rail) return;

        if (!settings.railGroup) {
            // Only our own two buttons. The same attribute also sits on <html>, where it drives
            // the folding CSS — and up to 3.7 a bare [data-mcfo-rail] matched <html> itself, so
            // switching this off removed the whole document: the white page that needed a reload.
            document.querySelectorAll('.mcfo-rebellion[data-mcfo-rail], .mcfo-rail-toggle[data-mcfo-rail]').forEach(e => e.remove());
            document.documentElement.removeAttribute('data-mcfo-rail');
            const panel = role('rebellion-panel');
            if (panel) for (const k of ['position','left','top','right','bottom']) panel.style[k] = '';
            return;
        }

        // Into bid-area, not into bid-rail. Both are centred, so it looks the same — but the
        // game hides the whole rail while you are King and shows the toll controls in its place.
        // Inside the rail the button would vanish exactly then; beside it, it stays.
        const area = role('bid-area');
        let reb = area && area.querySelector('[data-mcfo-rail="rebellion"]');
        if (!reb) {
            reb = document.createElement('button');
            reb.type = 'button';
            reb.className = 'mcfo-rebellion';
            reb.setAttribute('data-mcfo-rail', 'rebellion');
            reb.textContent = 'Rebellion';
            reb.title = 'Open Rebellion purchases';
            reb.addEventListener('click', e => {
                e.preventDefault();
                e.stopPropagation();
                // While you are King the game's own panel shows Royal Celebrations instead of
                // Rebellion tiers; opening it natively therefore needs no case of its own.
                if (settings.rebellionPanel) { (isRoyalMode() ? showCelebrationPopup : showRebellionPopup)(reb); return; }
                const ziel = document.querySelector('[data-role="nav-region"] > [data-role="rebellion-toggle"]');
                if (ziel) ziel.click();
                // The panel is anchored to the ORIGINAL button and would otherwise open at the
                // far right of the screen. Repeated, because the game runs a layout pass of its
                // own after opening.
                for (const ms of [0, 60, 250]) setTimeout(() => placeRebellionPanel(reb), ms);
            });
            if (area) area.prepend(reb);
        }
        const royal = isRoyalMode();
        if ((reb.getAttribute('data-mcfo-royal') === '1') !== royal) {
            if (royal) reb.setAttribute('data-mcfo-royal', '1'); else reb.removeAttribute('data-mcfo-royal');
            reb.textContent = royal ? 'Royal Celebration' : 'Rebellion';
            questDot(reb);   // textContent took the quest dot along (12d)
            reb.title = royal ? 'Open Royal Celebrations (King only, once per reign)' : 'Open Rebellion purchases';
            // A popup opened in the other mode would buy the wrong thing — close it.
            closeMenus?.();
        }

        let arrow = rail.querySelector('[data-mcfo-rail="toggle"]');
        if (!arrow) {
            arrow = document.createElement('button');
            arrow.type = 'button';
            arrow.className = 'mcfo-rail-toggle';
            arrow.setAttribute('data-mcfo-rail', 'toggle');
            arrow.addEventListener('click', e => {
                e.preventDefault();
                e.stopPropagation();
                railOpen = !railOpen;
                try { localStorage.setItem('mcfo_rail_open', railOpen ? '1' : '0'); } catch (err) {}
                buildRailGroup();
                buildExtraChips();
                centreRail();
            });
        }
        rail.appendChild(arrow);          // always last, whatever else was added meanwhile
        arrow.textContent = railOpen ? '\u25C0' : '\u25B6';
        arrow.title = railOpen ? 'Collapse the rail' : 'Show the bigger amounts';

        // Folding is done in CSS, not by touching the chips. The game owns their visibility —
        // restoreBidButtonsForNonKing sets an inline display on every chip whenever the ticket
        // balance changes — and a tug of war over that property would either flicker or, worse,
        // reveal a chip the player has not unlocked. Marking them and letting a rule hide them
        // keeps both jobs apart: the game decides what is unlocked, we decide what is folded.
        document.documentElement.setAttribute('data-mcfo-rail', railOpen ? 'open' : 'closed');
        for (const chip of rail.querySelectorAll('[data-role^="bid-"]')) {
            const amount = Number(chip.getAttribute('data-bid-amount'));
            if (Number.isFinite(amount) && amount > RAIL_ALWAYS) chip.setAttribute('data-mcfo-big', '1');
        }
    }

    // Bring the rebellion panel to our button. It is position:absolute and anchored to the
    // original in the footer, so untouched it opens bottom right — far from where it was asked
    // for.
    //
    // The tiers themselves are left alone on purpose. All eight buttons carry the same
    // data-role="rebellion-tier-start" and the same label "Start" — nothing tells them apart but
    // their order. A home-made panel would have to pick a tier by position, and a wrong guess
    // there spends diamonds. Restyled, yes; rebuilt, no.
    function placeRebellionPanel(anchor) {
        const panel = role('rebellion-panel');
        if (!panel || !anchor) return;
        const p = panel.getBoundingClientRect();
        const a = anchor.getBoundingClientRect();
        if (!p.width || !a.width) return;      // closed, nothing to place

        let left = a.left + a.width / 2 - p.width / 2;
        left = Math.max(8, Math.min(left, innerWidth - p.width - 8));
        let top = a.top - p.height - 10;
        if (top < 8) top = Math.min(a.bottom + 10, innerHeight - p.height - 8);

        panel.style.position = 'fixed';
        panel.style.left   = Math.round(left) + 'px';
        panel.style.top    = Math.round(Math.max(8, top)) + 'px';
        panel.style.right  = 'auto';
        panel.style.bottom = 'auto';
    }

    // ---- UNBID ----
    // The game has no button for it, only the chat command: !unbid takes your bid back out of the
    // queue you are standing in (the reply reads "Your active bid has been set to 0. You are no
    // longer in the queue."). So the button sends exactly that, through the game's own chat form —
    // the same path as typing it, with every check the game makes there — and puts back whatever
    // you had started typing. From PRESTART_3S on an entry is final; the game then answers in the
    // chat, like it would to the typed command.
    //
    // One click, no confirm step: an unbid is wanted in a hurry (a bid that landed on the wrong
    // tile), and it costs nothing — the ticket comes back. Unlike Rebellion, which spends diamonds.
    // A successful unbid fires 'mcf:king-eligibility-invalidated' with reason 'unbid' on the page
    // (chatPane.js) — that is the confirmation the button waits for.
    const UNBID_WAIT_MS = 5000;
    const UNBID_TEXT = {
        idle:  ['Unbid', 'Take your bid back out of the queue'],
        sent:  ['Unbid\u2026', 'Sent, waiting for the game'],
        done:  ['Done', 'The game confirmed the unbid — its reply is in the chat'],
        none:  ['See chat', 'No confirmation from the game — its reply is in the chat'],
    };
    let unbidTimer = 0;
    let unbidPending = false;

    function buildUnbid() {
        let btn = document.querySelector('.mcfo-unbid');
        if (!settings.unbidButton) { if (btn) btn.remove(); return; }
        const area = role('bid-area');
        if (!area) return;
        if (!btn) {
            btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'mcfo-unbid';
            btn.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); unbidClick(btn); });
            unbidState(btn, 'idle');
        }
        // Right of the chips, whatever else was added: last in bid-area, or just before Autobid,
        // which sits right of it. Only moved when out of place — an append on every pass would
        // lay the rail out anew every 1.5 s.
        const tail = area.querySelector(':scope > .mcfo-autobid');
        if (tail) { if (btn.nextElementSibling !== tail) area.insertBefore(btn, tail); }
        else if (area.lastElementChild !== btn) area.appendChild(btn);
    }

    function unbidState(btn, state, title) {
        btn.setAttribute('data-mcfo-state', state);
        btn.textContent = UNBID_TEXT[state][0];
        btn.title = title || UNBID_TEXT[state][1];
    }

    function unbidLater(btn, ms) {
        clearTimeout(unbidTimer);
        unbidTimer = setTimeout(() => unbidState(btn, 'idle'), ms);
    }

    function unbidClick(btn) {
        if (btn.getAttribute('data-mcfo-state') === 'sent') return;   // one at a time
        clearTimeout(unbidTimer);
        const r = sendChatLine('!unbid');
        if (!r.ok) { unbidState(btn, 'none', r.why); unbidLater(btn, 3000); return; }
        unbidPending = true;
        unbidState(btn, 'sent');
        unbidTimer = setTimeout(() => {
            if (!unbidPending) return;
            unbidPending = false;
            unbidState(btn, 'none');
            unbidLater(btn, 3000);
        }, UNBID_WAIT_MS);
    }

    window.addEventListener('mcf:king-eligibility-invalidated', e => {
        if (!unbidPending) return;
        let reason = '';
        try { reason = e.detail && e.detail.reason; } catch (err) {}
        if (reason && reason !== 'unbid') return;
        unbidPending = false;
        const btn = document.querySelector('.mcfo-unbid');
        if (!btn) return;
        unbidState(btn, 'done');
        unbidLater(btn, 2500);
    });

    // One line through the game's own chat form, as if typed. The field is put back afterwards:
    // the game empties it only when it really sent, so an unchanged field means it refused.
    function sendChatLine(text) {
        const form = role('chat-form');
        const input = form && form.querySelector('[data-role="chat-input"]');
        if (!form || !input) return { ok: false, why: 'The chat is not there' };
        if (input.disabled) return { ok: false, why: 'The chat is read-only right now' };
        const draft = input.value;
        input.value = text;
        try {
            if (typeof form.requestSubmit === 'function') form.requestSubmit();
            else form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        } catch (e) {}
        const sent = input.value === '';
        input.value = draft;
        return sent ? { ok: true } : { ok: false, why: 'The chat did not take it (not connected?)' };
    }

