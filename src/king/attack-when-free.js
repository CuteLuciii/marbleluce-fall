    // =========================================================================================
    // 7b. ATTACK WHEN FREE (opt-in)
    // =========================================================================================
    // The game greys its attack button out while you are bidding (currently_bidding), while your
    // marble runs (currently_in_tile) or during a lava cooldown. This button does what the
    // MarbleMind bot's /attack does in that case, minus its points limit: sit out the lava
    // cooldown, send !unbid once, wait until the marble is free — and then press the GAME'S OWN
    // attack button. The attack itself is never rebuilt; it goes through the game's click handler
    // with every check the game makes there.
    //
    // It has to be a copy: a disabled button fires no click at all, so the game's own cannot be
    // intercepted while it is grey. The game also rewrites the whole tray (innerHTML) on every
    // state change, so the copy is re-inserted on each redraw, and the waiting state lives here,
    // not on the element.
    //
    // The source of truth is /api/king/me — the same call the game and the bot use. The game only
    // re-checks with growing pauses (up to 15 s) and gives up after a few tries; once we see
    // "free" we nudge it with the event its own chat sends after an unbid.
    const ASSIST_POLL_MS = 2500;
    const ASSIST_MAX_WAIT_MS = 5 * 60 * 1000;   // counted from the end of a lava cooldown, like the bot
    const ASSIST_LAVA_MAX_MS = 5 * 60 * 1000;
    // A Royal Celebration (5-50 tiles) and your own Rebellion (up to 125 tiles) block attacks too.
    // Since 6.59.1 they are sat out like a lava cooldown instead of ending the wait after 5 min.
    const ASSIST_CELEB_MAX_MS = 90 * 60 * 1000;
    const ASSIST_REBELLION_MAX_MS = 3 * 60 * 60 * 1000;
    // The phases in which nothing is cleared and autobid keeps playing (9g reads this).
    const ASSIST_SIT_PHASES = ['lava', 'lockout', 'celebration', 'rebellion'];
    const ASSIST_REBID_MS = 8000;              // a bid still/again there this long after the unbid
    const ASSIST_NATIVE_WAIT_MS = 10000;       // how long the game may take to release its button
    const ASSIST_DEAD_REASONS = ['current_king', 'not_logged_in', 'already_in_king_tile'];
    // Try again until King (6.20): after the press the attack is watched (phase 'watch'). The
    // server reports already_in_king_tile while the marble runs; once that is gone without the
    // crown, it was a miss, and the next try starts from the top: a lava cooldown after a pop is
    // sat out like any other, a fresh !unbid is allowed once per try.
    const ASSIST_SETTLE_MS = 10000;            // no run reported this long after the press: judged anyway
    const ASSIST_RUN_MAX_MS = 2 * 60 * 1000;   // an attack is over in seconds; this is only the lid
    const ASSIST_RETRY_GAP_MS = 8000;          // never two presses closer than this
    const assist = { active: false, phase: '', started: 0, clearStart: 0, unbidSent: false, unbidAt: 0,
                     lavaUntil: 0, timer: 0, note: '', noteUntil: 0,
                     tries: 0, pressedAt: 0, sawRun: false, lastPressAt: 0 };

    function nativeAttack() {
        const content = document.querySelector('.mcf-king-action-content');
        return content ? content.querySelector('[data-action="king-attack"]') : null;
    }
    const nativeEnabled = b => !!b && !b.disabled && b.getAttribute('aria-disabled') !== 'true';
    const nativeReasons = b => String((b && b.getAttribute('data-king-action-reasons')) || '').split(',').map(x => x.trim()).filter(Boolean);

    function buildAttackAssist() {
        document.documentElement.setAttribute('data-mcfo-attack', settings.attackAssist ? '1' : '0');
        const native = nativeAttack();
        let copy = document.querySelector('.mcfo-attack');
        if (!settings.attackAssist) {
            if (copy) copy.remove();
            if (assist.active) assistStop('');
            return;
        }
        if (!native) { if (copy) copy.remove(); return; }
        if (!copy || copy.previousElementSibling !== native) {
            if (copy) copy.remove();
            copy = document.createElement('button');
            copy.type = 'button';
            copy.className = 'mcf-king-attack-placeholder mcfo-attack';
            copy.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); assistClick(); });
            native.insertAdjacentElement('afterend', copy);
        }
        drawAttackAssist(copy, native);
    }

    function lavaLeft() {
        const s = Math.max(0, Math.ceil((assist.lavaUntil - Date.now()) / 1000));
        return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
    }

    // Only writes what changed — every write is a mutation, and the tray observer calls us back.
    function drawAttackAssist(copy, native) {
        let text, title, state = '', enabled = true;
        const noteOn = assist.note && Date.now() < assist.noteUntil;
        if (assist.active) {
            state = assist.phase === 'rebid' ? 'warn' : 'wait';
            text = { unbid: 'UNBIDDING\u2026', tile: 'WAITING: IN TILE', lava: 'WAITING: LAVA ' + lavaLeft(),
                     lockout: 'NEW KING SAFE ' + lavaLeft(), celebration: 'WAITING: CELEBRATION',
                     rebellion: 'WAITING: YOUR REBELLION',
                     rebid: 'BID CAME BACK', attack: 'ATTACKING\u2026', watch: 'ATTACK RUNNING\u2026',
                     wait: 'WAITING\u2026' }[assist.phase] || 'WAITING\u2026';
            if (assist.tries > 1) text = 'TRY ' + assist.tries + ' \u00b7 ' + text;
            title = assist.phase === 'rebid'
                ? 'A bid came back after the unbid — is something bidding for you automatically? Click to cancel.'
                : settings.attackRetry
                    ? 'Attacking until you are King, try ' + assist.tries + '. Click to cancel.'
                    : 'Waiting until your marble is free, then attacking. Click to cancel.';
        } else if (noteOn) {
            state = 'warn'; text = assist.note; title = assist.note; enabled = false;
        } else if (nativeEnabled(native)) {
            text = (native.textContent || 'ATTACK').trim();
            title = settings.attackRetry ? 'Attack the throne, and again after every miss until you are King' : 'Attack the throne';
        } else if (nativeReasons(native).some(r => ASSIST_DEAD_REASONS.includes(r))) {
            text = (native.textContent || '').trim(); title = text; enabled = false;
        } else {
            text = settings.attackRetry ? 'ATTACK UNTIL KING' : 'ATTACK WHEN FREE';
            title = 'Unbids if needed, waits until your marble is free, then attacks'
                  + (settings.attackRetry ? ', and again after every miss until you are King' : '') + '. Click again to cancel.';
        }
        if (copy.textContent !== text) copy.textContent = text;
        if (copy.title !== title) copy.title = title;
        if (copy.disabled === enabled) copy.disabled = !enabled;
        if ((copy.getAttribute('data-mcfo-state') || '') !== state) {
            if (state) copy.setAttribute('data-mcfo-state', state); else copy.removeAttribute('data-mcfo-state');
        }
        copy.classList.toggle('mcf-king-attack-placeholder--enabled', enabled && !state);
    }

    function redrawAssist() {
        const copy = document.querySelector('.mcfo-attack');
        if (copy) drawAttackAssist(copy, nativeAttack());
    }

    function assistStop(note) {
        clearTimeout(assist.timer);
        Object.assign(assist, { active: false, phase: '', clearStart: 0, unbidSent: false, unbidAt: 0, lavaUntil: 0,
                                note: note || '', noteUntil: note ? Date.now() + 4000 : 0,
                                tries: 0, pressedAt: 0, sawRun: false });
        redrawAssist();
        if (note) setTimeout(redrawAssist, 4100);
    }

    function assistClick() {
        if (assist.active) { assistStop(''); return; }
        const native = nativeAttack();
        // Free already: the game's own click — and with "try again" the watching starts there.
        if (nativeEnabled(native) && !settings.attackRetry) { native.click(); return; }
        Object.assign(assist, { active: true, phase: 'wait', started: Date.now(), clearStart: 0,
                                unbidSent: false, unbidAt: 0, lavaUntil: 0, note: '', noteUntil: 0,
                                tries: 1, pressedAt: 0, sawRun: false });
        if (nativeEnabled(native)) { pressAttack(native); return; }
        redrawAssist();
        assistTick();
    }

    // The game's own attack click. Without "try again" that is the end of it; with it, the attack
    // is watched until it is over, and a miss starts the next try (assistTick).
    function pressAttack(native) {
        native.click();
        assist.lastPressAt = Date.now();
        if (!settings.attackRetry) { assistStop(''); return; }
        Object.assign(assist, { phase: 'watch', pressedAt: Date.now(), sawRun: false });
        redrawAssist();
        clearTimeout(assist.timer);
        assist.timer = setTimeout(assistTick, ASSIST_POLL_MS);
    }

    function nextTry(now) {
        Object.assign(assist, { phase: 'wait', tries: assist.tries + 1, started: now, clearStart: 0,
                                unbidSent: false, unbidAt: 0, lavaUntil: 0, pressedAt: 0, sawRun: false });
    }

    async function readKingMe() {
        try {
            const r = await fetch('/api/king/me', { credentials: 'include', cache: 'no-store' });
            return r.ok ? await r.json() : null;
        } catch (e) { return null; }
    }

    // The game re-reads eligibility on this event (kingPane.js onKingEligibilityInvalidated).
    // Sent from the page's own window and without detail, so Firefox's sandbox never gets between.
    function nudgeKingEligibility() {
        try { pageWindow.dispatchEvent(new pageWindow.CustomEvent('mcf:king-eligibility-invalidated')); }
        catch (e) { try { window.dispatchEvent(new CustomEvent('mcf:king-eligibility-invalidated')); } catch (e2) {} }
    }

    async function assistTick() {
        if (!assist.active) return;
        const me = await readKingMe();
        if (!assist.active) return;
        const now = Date.now();
        const reasons = me && Array.isArray(me.reasons) ? me.reasons : null;
        if (reasons) {
            if (reasons.includes('current_king')) { assistStop("YOU'RE THE KING"); return; }
            if (assist.phase === 'watch') {
                const running = reasons.includes('already_in_king_tile');
                if (running) assist.sawRun = true;
                const since = now - assist.pressedAt;
                const over = running ? since > ASSIST_RUN_MAX_MS : (assist.sawRun || since > ASSIST_SETTLE_MS);
                if (!over) { redrawAssist(); assist.timer = setTimeout(assistTick, ASSIST_POLL_MS); return; }
                if (running) { assistStop('ATTACK DID NOT END'); return; }
                nextTry(now);   // a miss: this very answer decides how the next try begins
            }
            const free = me.state !== 'blocked' && reasons.length === 0;
            if (free && now - assist.lastPressAt < ASSIST_RETRY_GAP_MS) {
                redrawAssist(); assist.timer = setTimeout(assistTick, ASSIST_POLL_MS); return;
            }
            if (free) { assist.phase = 'attack'; redrawAssist(); pressWhenReleased(now); return; }
            const lava = reasons.includes('lava_cooldown_active');
            const celeb = reasons.includes('royal_celebration');
            const rebel = reasons.includes('active_rebellion') || reasons.includes('rebellion_active');
            if (celeb || rebel || lava || reasons.includes('lockout_active')) {
                // Sat out, nothing cleared: the cooldown only runs down with the clock, and an
                // unbid now would throw away a bid for nothing (the bot's lesson of 05.09.).
                // Since 6.43 the same for lockout_active, the 3 minutes in which a freshly crowned
                // King cannot be attacked (king.lockoutUntilMs): autobid keeps playing meanwhile.
                // Since 6.59.1 also a Royal Celebration and your own Rebellion: before, they fell
                // into the clearing branch below - an !unbid for nothing, then 'NOT FREE IN 5 MIN'.
                // Each block has its own clock: lava, then a new King's lockout, would add up to 6 min.
                const kind = celeb ? 'celebration' : rebel ? 'rebellion' : lava ? 'lava' : 'lockout';
                if (assist.phase !== kind) assist.sitSince = now;
                assist.phase = kind;
                if (kind === 'lava' || kind === 'lockout') assist.lavaUntil = Number(lava ? me.lavaCooldownUntilMs : me.lockoutUntilMs) || assist.lavaUntil;
                const lid = kind === 'celebration' ? ASSIST_CELEB_MAX_MS : kind === 'rebellion' ? ASSIST_REBELLION_MAX_MS : ASSIST_LAVA_MAX_MS;
                if (now - (assist.sitSince || assist.started) > lid) {
                    assistStop({ lava: 'LAVA TOO LONG', lockout: 'KING SAFE TOO LONG', celebration: 'CELEBRATION TOO LONG', rebellion: 'REBELLION TOO LONG' }[kind]);
                    return;
                }
                // Autobid bids on meanwhile: once the block is over, clearing starts afresh, with one
                // !unbid of its own and its own 5 minutes.
                assist.clearStart = 0;
                assist.unbidSent = false;
            } else {
                if (!assist.clearStart) assist.clearStart = now;
                const bidding = reasons.includes('currently_bidding');
                if (bidding && !assist.unbidSent) {
                    // Once only: !unbid pulls whatever bid is pending, so a second one later could
                    // take a good bid instead (the bot's AUTO-UNBID lesson).
                    const r = sendChatLine('!unbid');
                    assist.unbidSent = true;
                    assist.unbidAt = now;
                    assist.phase = r.ok ? 'unbid' : 'wait';
                } else if (bidding && assist.unbidSent && now - assist.unbidAt > ASSIST_REBID_MS) {
                    assist.phase = 'rebid';
                } else if (reasons.includes('currently_in_tile')) {
                    assist.phase = 'tile';
                } else if (!bidding) {
                    assist.phase = 'wait';
                }
                if (now - assist.clearStart > ASSIST_MAX_WAIT_MS) { assistStop('NOT FREE IN 5 MIN'); return; }
            }
        }
        redrawAssist();
        assist.timer = setTimeout(assistTick, ASSIST_POLL_MS);
    }

    // Free according to the server: make the game look again, then press its button the moment it
    // is released. If it is not released in time, back to waiting — the server may have changed
    // its mind (a new bid, a new run).
    function pressWhenReleased(since) {
        nudgeKingEligibility();
        const step = () => {
            if (!assist.active) return;
            const native = nativeAttack();
            if (nativeEnabled(native)) {
                pressAttack(native);
                return;
            }
            if (Date.now() - since > ASSIST_NATIVE_WAIT_MS) { assist.phase = 'wait'; redrawAssist(); assist.timer = setTimeout(assistTick, ASSIST_POLL_MS); return; }
            assist.timer = setTimeout(step, 300);
        };
        step();
    }

