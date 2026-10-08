    // =========================================================================================
    // 14. PERFORMANCE: PACING THE PICTURE
    // =========================================================================================
    // The CSS levers are in section 3. Two levers need the page itself, and that is only
    // reachable through unsafeWindow: with any @grant the script runs in a sandbox whose `window`
    // is a wrapper, and replacing a function there changes it for the script alone (the same
    // lesson the socket tap of 1.5 taught).
    //
    // Both are installed only once a lever first asks for them, so with performance off this
    // script touches none of the page's functions. Once in, they pass straight through whenever
    // no lever needs them.
    // pageWindow is defined at the very top (section 0): the socket tap needs it first.
    const toPage = fn => (typeof exportFunction === 'function' ? exportFunction(fn, pageWindow) : fn);

    // --- Frame rate cap and the still crown: one requestAnimationFrame for the whole page ---
    // Every render loop of the game asks for its next frame through window.requestAnimationFrame
    // afresh each time (presentation loop in app.js, cadence loop in ingest.js, the crown), so a
    // replacement takes hold from the next frame on. Callbacks are collected and run together at
    // the capped rate. The chat binds the native function once at start-up and keeps it — it is
    // cheap and stays as it is.
    const RAF_ID_BASE = 1e9;   // our ids live above the browser's, so cancel knows whose it is
    let rafInstalled = false, nativeRaf = null, nativeCaf = null;
    let rafSeq = RAF_ID_BASE, pumpQueued = false, lastPumpAt = 0;
    const rafWaiting = new Map();
    const crownDraws = new WeakMap();      // callback -> is it a crown's draw loop?
    const crownLastRun = new WeakMap();    // callback -> when it last got a frame
    const crownFrozenAt = new WeakMap();   // callback -> the timestamp it keeps being handed
    let framesDelivered = 0;

    const CROWN_STILL_MS = 500;

    function rafPacingWanted() {
        return Number(perfValue('perfFpsCap')) > 0 || (!!perfValue('perfCrownStill') && !perfValue('perfCrownHide'));
    }

    // The crown's loop is recognised by its source: the draw function that turns the model
    // (crownOverlayProofRenderer.js — `spinRadians` and `renderer.render`). Checked once per
    // callback object; each crown re-queues the same function every frame. Should a later build
    // rename it, the check simply finds nothing and the crown is paced like everything else.
    function isCrownDraw(cb) {
        let v = crownDraws.get(cb);
        if (v === undefined) {
            let src = '';
            try { src = Function.prototype.toString.call(cb); } catch (e) {}
            v = src.includes('spinRadians') && src.includes('renderer.render');
            crownDraws.set(cb, v);
        }
        return v;
    }

    function queuePump() {
        if (pumpQueued) return;
        pumpQueued = true;
        nativeRaf(pump);
    }

    function runSafely(cb, t) {
        // One failing callback must not take the others of this frame down with it. The error
        // is rethrown on its own, so it still shows in the console as the game's.
        try { cb(t); } catch (e) { setTimeout(() => { throw e; }); }
    }

    function pump(t) {
        pumpQueued = false;
        const cap = Number(perfValue('perfFpsCap')) || 0;
        // 2 ms of slack, or a 60 Hz screen would miss every other frame of a 30 fps cap by a
        // fraction of a millisecond and land on 20.
        if (cap && t - lastPumpAt < 1000 / cap - 2) { queuePump(); return; }
        lastPumpAt = t;
        if (!rafWaiting.size) return;
        framesDelivered++;

        const still = !!perfValue('perfCrownStill');
        const batch = [...rafWaiting];
        rafWaiting.clear();
        for (const [id, cb] of batch) {
            if (still && isCrownDraw(cb)) {
                // Held back between redraws, and always handed the same timestamp: the crown
                // turns by the time elapsed since its last frame, so with none elapsing it stands.
                // It is still redrawn now and then, so a resized window never leaves it blank.
                if (t - (crownLastRun.get(cb) || 0) < CROWN_STILL_MS) { rafWaiting.set(id, cb); continue; }
                crownLastRun.set(cb, t);
                if (!crownFrozenAt.has(cb)) crownFrozenAt.set(cb, t);
                runSafely(cb, crownFrozenAt.get(cb));
                continue;
            }
            // A crown that was still is let go again: forget its frozen time, so it turns on
            // from where it stood instead of catching up on the whole pause in one jump.
            if (crownFrozenAt.has(cb)) crownFrozenAt.delete(cb);
            runSafely(cb, t);
        }
        if (rafWaiting.size) queuePump();
    }

    function installRafPacing() {
        if (rafInstalled) return;
        try {
            nativeRaf = pageWindow.requestAnimationFrame.bind(pageWindow);
            nativeCaf = pageWindow.cancelAnimationFrame.bind(pageWindow);
            pageWindow.requestAnimationFrame = toPage(function (cb) {
                if (!rafPacingWanted() && !rafWaiting.size) return nativeRaf(cb);
                const id = ++rafSeq;
                rafWaiting.set(id, cb);
                queuePump();
                return id;
            });
            pageWindow.cancelAnimationFrame = toPage(function (id) {
                if (id > RAF_ID_BASE) rafWaiting.delete(id); else nativeCaf(id);
            });
            rafInstalled = true;
        } catch (e) {
            console.warn('[MarbleLuceFall] frame pacing unavailable:', e.message);
        }
    }

    // --- Chat animations: tell the game the player prefers reduced motion ---
    // The chat picks a cosmetic's motion only when prefers-reduced-motion is not set
    // (chatPane.js: `reducedMotion ? 'none' : …`), so newly drawn lines come without animation
    // classes at all; the CSS rule in section 3 stops the ones already on screen. The answer
    // handed back is a real MediaQueryList that matches — '(min-width: 0px)' always does — so
    // the page gets a genuine object and not one of ours.
    let mediaInstalled = false;
    function installReducedMotion() {
        if (mediaInstalled || typeof pageWindow.matchMedia !== 'function') return;
        try {
            const nativeMatchMedia = pageWindow.matchMedia.bind(pageWindow);
            pageWindow.matchMedia = toPage(function (query) {
                if (perfValue('perfChatMotion') && /prefers-reduced-motion\s*:\s*reduce/i.test(String(query))) {
                    return nativeMatchMedia('(min-width: 0px)');
                }
                return nativeMatchMedia(query);
            });
            mediaInstalled = true;
        } catch (e) {
            console.warn('[MarbleLuceFall] reduced-motion hint unavailable:', e.message);
        }
    }

    // --- Frame rate counter ---
    // Counts the frames the game actually gets. With pacing active that is our pump; without
    // it a light native loop of its own, which exists only while the counter is on.
    let fpsBadge = null, fpsTimer = null, fpsLoopOn = false, fpsNativeFrames = 0, fpsLastDelivered = 0;
    // Min / max / average of the one-second readings since the counter was switched on (or the
    // page loaded). Seconds in a hidden tab do not count: the browser stops animation frames
    // there, and those zeros would drag the minimum and the average down to nothing.
    const fpsStats = { min: Infinity, max: 0, sum: 0, n: 0, since: 0, skip: true };
    let fpsPop = null, fpsHover = false, fpsPinned = false;
    function fpsStatsReset() {
        Object.assign(fpsStats, { min: Infinity, max: 0, sum: 0, n: 0, since: Date.now(), skip: true });
    }
    function fpsPopupDraw() {
        if (!fpsPop || !fpsBadge) return;
        const open = (fpsHover || fpsPinned) && !fpsBadge.hidden;
        fpsPop.hidden = !open;
        fpsBadge.toggleAttribute('data-mcfo-pinned', fpsPinned);
        if (!open) return;
        const has = fpsStats.n > 0;
        const row = (k, v) => `<div class="mcfo-fpspop__row"><span>${k}</span><b>${has ? v + ' fps' : '\u2026'}</b></div>`;
        const t = new Date(fpsStats.since || Date.now());
        const hhmm = String(t.getHours()).padStart(2, '0') + ':' + String(t.getMinutes()).padStart(2, '0');
        fpsPop.innerHTML = row('Min', fpsStats.min) + row('Avg', has ? Math.round(fpsStats.sum / fpsStats.n) : 0)
            + row('Max', fpsStats.max) + `<div class="mcfo-fpspop__note">since ${hhmm}</div>`;
        // Below the badge when it sits in the header card, above it when it floats over the footer.
        const r = fpsBadge.getBoundingClientRect(), h = fpsPop.offsetHeight, w = fpsPop.offsetWidth;
        const below = r.bottom + 6 + h <= innerHeight;
        fpsPop.style.top = Math.round(below ? r.bottom + 6 : r.top - 6 - h) + 'px';
        fpsPop.style.left = Math.round(Math.max(8, Math.min(innerWidth - w - 8, r.right - w))) + 'px';
    }
    function fpsBadgeWire(badge) {
        fpsPop = document.createElement('div');
        fpsPop.className = 'mcfo-fpspop';
        fpsPop.hidden = true;
        document.body.appendChild(fpsPop);
        badge.title = '';
        badge.addEventListener('mouseenter', () => { fpsHover = true; fpsPopupDraw(); });
        badge.addEventListener('mouseleave', () => { fpsHover = false; fpsPopupDraw(); });
        badge.addEventListener('click', e => { e.stopPropagation(); fpsPinned = !fpsPinned; fpsPopupDraw(); });
        // A pinned popup closes on any click elsewhere, like a menu.
        document.addEventListener('click', e => {
            if (fpsPinned && !badge.contains(e.target)) { fpsPinned = false; fpsPopupDraw(); }
        }, true);
    }
    function fpsLoop() {
        if (!fpsLoopOn) return;
        fpsNativeFrames++;
        (nativeRaf || pageWindow.requestAnimationFrame.bind(pageWindow))(fpsLoop);
    }
    function drawFpsMeter() {
        if (!settings.perfFpsMeter) {
            if (fpsBadge) fpsBadge.hidden = true;
            document.documentElement.removeAttribute('data-mcfo-fpshead');
            if (fpsPop) { fpsPinned = false; fpsHover = false; fpsPop.hidden = true; }
            if (fpsTimer) { clearInterval(fpsTimer); fpsTimer = null; }
            fpsLoopOn = false;
            return;
        }
        if (!fpsBadge) {
            fpsBadge = document.createElement('div');
            fpsBadge.className = 'mcfo-fps';
            fpsBadge.textContent = '… fps';
            fpsBadgeWire(fpsBadge);
        }
        fpsBadge.hidden = false;
        // In the chat header, left of its buttons (6.37.1, Luce: there is room, and the Tickets
        // card now carries the game's Active line). Up to 6.37.0 it sat in the Tickets card.
        // Where the header is not shown — chat collapsed to the rail, or a narrow layout without
        // the chat pane — it floats above the footer as before. Checked on every apply() pass,
        // so it follows the layout.
        const chat = chatRoot();
        const header = chat && chat.getAttribute('data-collapsed') !== 'true' && chat.querySelector('.mcf-chat__header');
        const first = header && header.querySelector(':scope > button, :scope > .mcfo-tomato-btn');
        if (header && first && header.getBoundingClientRect().width > 0) {
            if (fpsBadge.parentElement !== header || fpsBadge.nextElementSibling !== first) header.insertBefore(fpsBadge, first);
            fpsBadge.classList.add('mcfo-fps--card');
            fpsBadge.style.bottom = '';
            document.documentElement.setAttribute('data-mcfo-fpshead', '1');
        } else {
            document.documentElement.removeAttribute('data-mcfo-fpshead');
            if (fpsBadge.parentElement !== document.body) document.body.appendChild(fpsBadge);
            fpsBadge.classList.remove('mcfo-fps--card');
            const footer = role('action-region');
            const above = footer ? Math.round(innerHeight - footer.getBoundingClientRect().top) : 56;
            fpsBadge.style.bottom = (above + 8) + 'px';
        }
        if (!fpsLoopOn) { fpsLoopOn = true; fpsNativeFrames = 0; (nativeRaf || pageWindow.requestAnimationFrame.bind(pageWindow))(fpsLoop); }
        if (!fpsTimer) {
            fpsLastDelivered = framesDelivered;
            fpsStatsReset();
            fpsTimer = setInterval(() => {
                const paced = rafInstalled && rafPacingWanted();
                const fps = paced ? framesDelivered - fpsLastDelivered : fpsNativeFrames;
                fpsLastDelivered = framesDelivered;
                fpsNativeFrames = 0;
                fpsBadge.textContent = fps + ' fps';
                fpsBadge.setAttribute('data-mcfo-tone', fps < 20 ? 'low' : fps < 40 ? 'mid' : 'ok');
                // The first second after switching on (or coming back to the tab) is a partial one.
                if (document.hidden) fpsStats.skip = true;
                else if (fpsStats.skip) fpsStats.skip = false;
                else {
                    fpsStats.min = Math.min(fpsStats.min, fps);
                    fpsStats.max = Math.max(fpsStats.max, fps);
                    fpsStats.sum += fps; fpsStats.n++;
                }
                fpsPopupDraw();
            }, 1000);
        }
    }

    function applyPerformance() {
        const tokens = [];
        if (perfValue('perfShadows'))    tokens.push('shadows');
        if (perfValue('perfCrownStill')) tokens.push('crownstill');
        if (perfValue('perfCrownHide'))  tokens.push('crownhide');
        if (perfValue('perfChatMotion')) tokens.push('chatmotion');
        if (perfValue('perfNoBlur'))     tokens.push('noblur');
        if (perfValue('perfEdges'))      tokens.push('edges');
        const want = tokens.join(' ');
        if (document.documentElement.getAttribute('data-mcfo-perf') !== want) {
            document.documentElement.setAttribute('data-mcfo-perf', want);
        }
        if (rafPacingWanted()) installRafPacing();
        if (perfValue('perfChatMotion')) installReducedMotion();
        drawFpsMeter();
    }

