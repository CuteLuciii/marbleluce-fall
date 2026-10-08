    // =========================================================================================
    // 9c. TOLL FIELD
    // =========================================================================================
    // How the game changes the toll (app.js): each Reduce / Increase click calls
    // postKingTollDelta(±1), which only moves a target value, and flushKingTollUpdate sends that
    // target as an ABSOLUTE value — POST /api/king/toll { baseToll } — coalescing any clicks that
    // come in while a request is running. Five quick clicks are therefore one or two requests,
    // ending on the final value.
    //
    // So the field needs no request of its own. It presses the game's own button as often as the
    // difference says, and the game does the rest with all its guards: only the King may edit
    // (canEdit), the value is clamped to minBaseToll..maxBaseToll, and at either end the game
    // disables the button at once — a click on a disabled button does nothing, so the loop simply
    // stops there. The game's three controls are only hidden, never removed; renderKingTollControls
    // sets their properties but never rebuilds them.
    //
    // The upper end comes from the game: /api/king/toll-capability (toll.maxBaseToll), the same
    // answer the game's own buttons are clamped to. The field asks for it while the toll controls
    // are on screen and never offers more than that. 17 is the game's own fallback
    // (KING_TOLL_MAX in app.js) until the answer is in.
    const TOLL_FALLBACK_MAX = 17;
    const TOLL_CAP_EVERY_MS = 60000;   // the server caches the answer for 60 s (cacheTtlMs)
    const TOLL_OK_SHOW_MS = 2500;
    const tollCap = { max: TOLL_FALLBACK_MAX, at: 0, busy: false };

    function tollMax() { return tollCap.max; }

    function refreshTollCap(box) {
        if (tollCap.busy || Date.now() - tollCap.at < TOLL_CAP_EVERY_MS) return;
        tollCap.busy = true;
        tollCap.at = Date.now();
        fetch('/api/king/toll-capability', { credentials: 'include', cache: 'no-store' })
            .then(r => r.ok ? r.json() : null)
            .then(d => {
                const t = d && d.toll;
                if (!t || d.isCurrentKing !== true) return;   // only a sitting King gets the bounds
                const vals = Array.isArray(t.allowedValues) ? t.allowedValues.map(Number).filter(Number.isFinite) : [];
                const max = Number.isFinite(Number(t.maxBaseToll)) ? Math.trunc(Number(t.maxBaseToll))
                          : vals.length ? Math.max(...vals) : null;
                if (max !== null && max >= 0 && max !== tollCap.max) { tollCap.max = max; applyTollMax(box); }
            })
            .catch(() => {})
            .finally(() => { tollCap.busy = false; });
    }

    function applyTollMax(box) {
        if (!box || !box.isConnected) return;
        const max = String(tollMax());
        const input = box.querySelector('.mcfo-toll__input');
        const range = box.querySelector('.mcfo-toll__range');
        input.max = max;
        input.title = 'Type 0 to ' + max + ' and press Enter \u00b7 Esc cancels';
        range.max = max;
        box.querySelector('.mcfo-toll__max').textContent = '/ ' + max;
    }

    function tollState() {
        const controls = role('king-toll-controls');
        const raw = (role('king-toll-value')?.textContent || '').trim();
        return {
            controls,
            value: /^\d+$/.test(raw) ? Number(raw) : null,
            canEdit: controls ? controls.getAttribute('data-king-toll-can-edit') === 'true' : false,
            // The game writes its message into the container's title; without one it reads
            // "Current toll: N".
            message: controls ? String(controls.getAttribute('title') || '') : '',
        };
    }

    // Presses the game's Reduce or Increase button as often as the difference says; the game
    // clamps and greys its button at either end, which ends the loop. Also used by section 7c.
    function stepTollTo(want) {
        const st = tollState();
        if (st.value === null) return;
        const diff = want - st.value;
        const button = role(diff > 0 ? 'king-toll-increase' : 'king-toll-decrease');
        for (let n = Math.abs(diff); n > 0 && button && !button.disabled; n--) button.click();
    }

    function commitToll(box, target) {
        const st = tollState();
        const input = box.querySelector('.mcfo-toll__input');
        let want = Math.round(Number(target));
        if (st.value === null || !Number.isFinite(want) || String(target).trim() === '') { syncTollField(box, true); return; }
        want = Math.max(0, Math.min(tollMax(), want));
        input.value = String(want);
        stepTollTo(want);
        input.removeAttribute('data-mcfo-dirty');
        syncTollField(box, true);
    }

    function syncTollField(box, force) {
        const st = tollState();
        const input = box.querySelector('.mcfo-toll__input');
        const range = box.querySelector('.mcfo-toll__range');
        const editing = document.activeElement === input && input.getAttribute('data-mcfo-dirty') === '1';

        if (!st.canEdit) box.setAttribute('data-mcfo-locked', '1'); else box.removeAttribute('data-mcfo-locked');
        input.disabled = !st.canEdit;
        range.disabled = !st.canEdit;
        range.hidden = !settings.tollSlider;

        // Never overwrite what someone is typing; everything else follows the game.
        if (st.value !== null && (force || !editing)) {
            if (input.value !== String(st.value)) input.value = String(st.value);
            if (!box._mcfoDragging && range.value !== String(st.value)) range.value = String(st.value);
        }

        const status = box.querySelector('.mcfo-toll__status');
        const msg = /^Current toll:/i.test(st.message) ? '' : st.message.trim();
        let text = '', tone = '';
        if (/sync/i.test(msg))            { text = 'Syncing…'; tone = 'busy'; }
        else if (/updated/i.test(msg))    { text = 'Updated'; tone = 'ok'; }
        else if (msg && st.canEdit)       { text = msg; tone = 'error'; }
        // "Updated" is a moment, not a state — the game leaves the message standing, so it is
        // shown for a short while after it first appears.
        if (tone === 'ok') {
            if (box._mcfoOkSince === undefined || box._mcfoOkMsg !== msg) { box._mcfoOkSince = Date.now(); box._mcfoOkMsg = msg; }
            if (Date.now() - box._mcfoOkSince > TOLL_OK_SHOW_MS) text = '';
        } else { box._mcfoOkSince = undefined; box._mcfoOkMsg = undefined; }
        if (status.textContent !== text) status.textContent = text;
        if ((status.getAttribute('data-tone') || '') !== tone) status.setAttribute('data-tone', tone);
    }

    function buildTollField() {
        document.documentElement.setAttribute('data-mcfo-toll', settings.tollInput ? '1' : '0');
        const controls = role('king-toll-controls');
        let box = controls && controls.querySelector(':scope > .mcfo-toll');
        if (!settings.tollInput || !controls) { if (box) box.remove(); return; }

        if (!box) {
            box = document.createElement('div');
            box.className = 'mcfo-toll';
            box.innerHTML = '<span class="mcfo-toll__label">Toll</span>'
                          + '<input class="mcfo-toll__input" type="number" inputmode="numeric" min="0" step="1">'
                          + '<span class="mcfo-toll__max"></span>'
                          + '<input class="mcfo-toll__range" type="range" min="0" step="1" title="Drag and let go to set the toll">'
                          + '<span class="mcfo-toll__status"></span>';
            const input = box.querySelector('.mcfo-toll__input');
            const range = box.querySelector('.mcfo-toll__range');
            input.addEventListener('input', () => input.setAttribute('data-mcfo-dirty', '1'));
            input.addEventListener('keydown', e => {
                // Kept to the field: the game may have keys of its own on the page.
                if (e.key === 'Enter')  { e.preventDefault(); e.stopPropagation(); commitToll(box, input.value); input.blur(); }
                if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); input.removeAttribute('data-mcfo-dirty'); syncTollField(box, true); input.blur(); }
            });
            // Leaving the field without Enter discards the entry — it only counts when confirmed.
            input.addEventListener('blur', () => { input.removeAttribute('data-mcfo-dirty'); syncTollField(box, true); });
            // A wheel over a focused number field changes it in some browsers; here that would
            // be an accident waiting to happen on a value that costs other players tickets.
            input.addEventListener('wheel', e => { if (document.activeElement === input) e.preventDefault(); }, { passive: false });
            range.addEventListener('pointerdown', () => { box._mcfoDragging = true; });
            range.addEventListener('input', () => { input.value = range.value; });
            range.addEventListener('change', () => { box._mcfoDragging = false; commitToll(box, range.value); });
            controls.appendChild(box);
            applyTollMax(box);

            // The value and the game's message change between our 1.5 s passes; follow them
            // directly so "Syncing…" and the new number show at once.
            new MutationObserver(() => syncTollField(box)).observe(controls,
                { subtree: true, childList: true, characterData: true, attributes: true,
                  attributeFilter: ['title', 'data-king-toll-can-edit', 'data-king-toll-base'] });
        }
        refreshTollCap(box);
        syncTollField(box);
    }

