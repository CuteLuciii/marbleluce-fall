    // =========================================================================================
    // 9a. OWN REBELLION PANEL
    // =========================================================================================
    // Up to 3.9 this was left alone, because all eight buttons carry the same
    // data-role="rebellion-tier-start" and the same label "Start". But each sits in its own
    // block that names its tier:
    //
    //     <div data-role="rebellion-tier" data-tier-cost="2500">
    //         <strong data-role="rebellion-tier-multiplier">x25</strong> …
    //         <button data-role="rebellion-tier-start">Start</button>
    //
    // (renderRebellionTiers in app.js, which writes data-tier-cost from REBELLION_TIERS.) So the
    // button is found by its tier, not by its position.
    //
    // NOTHING IS BOUGHT BY THIS SCRIPT. A tier here presses the game's own Start button, which
    // calls purchaseRebellionTier(cost) — with every guard the game has: signed in, room ready,
    // no rebellion running, not already buying, and an idempotency key against double charges.
    //
    // Three safety rules, because a click here spends diamonds:
    //   1. The game re-renders the whole tier list on every state change (textContent = '' and
    //      rebuilt), so a button is never kept: it is looked up afresh at the moment of the click.
    //   2. Before pressing, the block found by cost must also show the expected multiplier and
    //      its button must be enabled. If anything does not match, nothing is pressed.
    //   3. The game's Start buys at once, without asking. Here the first click only arms the
    //      tier and names the amount; the second, within four seconds, buys.
    //
    // The tiers are the game's (REBELLION_TIERS, app.js). They are only the fallback for the
    // labels — what is actually offered, and whether it is enabled, is read from the game's
    // panel every quarter second while ours is open.
    const REB_TIERS = [
        { cost: 500,   mult: 5,   hue: '#5fb8e8' },
        { cost: 1000,  mult: 10,  hue: '#5fd0b0' },
        { cost: 1700,  mult: 17,  hue: '#8fd06a' },
        { cost: 2500,  mult: 25,  hue: '#e0d060' },
        { cost: 5000,  mult: 50,  hue: '#f0a040' },
        { cost: 7500,  mult: 75,  hue: '#f07050' },
        { cost: 10000, mult: 100, hue: '#f0506a' },
        { cost: 12500, mult: 125, hue: '#d060e0' },
    ];
    const REB_CONFIRM_MS = 4000;

    function nativeRebellionPanel() { return role('rebellion-panel'); }

    function nativeTier(cost) {
        const panel = nativeRebellionPanel();
        return panel && panel.querySelector(`[data-role="rebellion-tier"][data-tier-cost="${cost}"]`);
    }

    // The game's Start for exactly this tier — or null if anything about it does not add up.
    function verifiedStartButton(tier) {
        const block = nativeTier(tier.cost);
        if (!block) return null;
        const mult = (block.querySelector('[data-role="rebellion-tier-multiplier"]')?.textContent || '').trim();
        if (mult !== `x${tier.mult}`) return null;
        const button = block.querySelector('[data-role="rebellion-tier-start"]');
        if (!button || button.disabled || button.getAttribute('aria-disabled') === 'true') return null;
        return button;
    }

    // The game's panel is what fetches the status (fetchRebellionStatus runs on opening it), so
    // it is opened through its own toggle — invisibly — whenever ours opens.
    function wakeNativeRebellion() {
        const panel = nativeRebellionPanel();
        if (panel && panel.hidden !== true) return;
        const toggle = document.querySelector('[data-role="nav-region"] > [data-role="rebellion-toggle"]')
                    || role('rebellion-toggle');
        if (!toggle) return;
        // This click, too, would bubble up to our "close menus" listener and shut the panel
        // that has just opened.
        keepMenuOnce = true;
        setTimeout(() => { keepMenuOnce = false; }, 0);
        toggle.click();
    }

    let rebTimer = null;
    function stopRebellionPopup() {
        if (rebTimer) { clearInterval(rebTimer); rebTimer = null; }
        if (!document.documentElement.hasAttribute('data-mcfo-rebpop')) return;
        document.documentElement.removeAttribute('data-mcfo-rebpop');
        // Closed by Esc or by our own button, the game's panel would otherwise stay open — and
        // turn visible the moment the attribute above is gone.
        const panel = nativeRebellionPanel();
        if (panel && panel.hidden !== true) panel.querySelector('[data-role="rebellion-panel-close"]')?.click();
    }

    function showRebellionPopup(anchor) {
        const menu = showPanel(anchor, 'mcfo-menu--reb', m => {
            m.innerHTML = '<div class="mcfo-reb__head"><span class="mcfo-reb__title">Start a Rebellion</span>'
                        + '<span class="mcfo-reb__note">Rebellion bids can\u2019t be cancelled.</span></div>'
                        + '<div class="mcfo-reb__info">'
                        +   '<div class="mcfo-reb__active" hidden></div>'
                        +   '<div class="mcfo-reb__wallet"></div>'
                        +   '<div class="mcfo-reb__msg"></div>'
                        + '</div>'
                        + '<div class="mcfo-reb__grid"></div>';
            const grid = m.querySelector('.mcfo-reb__grid');
            for (const tier of REB_TIERS) {
                const b = document.createElement('button');
                b.type = 'button';
                b.className = 'mcfo-reb__tier';
                b.style.setProperty('--mcfo-tier', tier.hue);
                b.setAttribute('data-mcfo-cost', String(tier.cost));
                b.innerHTML = '<span class="mcfo-reb__mult"></span><span class="mcfo-reb__tiles"></span><span class="mcfo-reb__cost"></span><span class="mcfo-reb__quest">Quest</span>';
                b.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); rebellionTierClicked(tier, b, m); });
                grid.appendChild(b);
            }
        }, { centre: true });
        if (!menu) return;   // second click on the button: showPanel closed it (and us with it)
        // Only now: showPanel closes any open menu first, and that would take the attribute
        // straight off again. Set in the same task as the game's panel opens, so it never paints.
        document.documentElement.setAttribute('data-mcfo-rebpop', '1');
        wakeNativeRebellion();
        syncRebellionPopup(menu);
        placePanel(anchor, menu);
        rebTimer = setInterval(() => {
            if (!menu.isConnected) { stopRebellionPopup(); return; }
            syncRebellionPopup(menu);
        }, 250);
    }

    // Mirrors the game's panel into ours: what is enabled, the balance, the running rebellion
    // and the game's own message ("Starting Rebellion…", "Rebellion started.", errors).
    function syncRebellionPopup(menu) {
        const panel = nativeRebellionPanel();
        mirrorRebellionInfo(menu, panel, 'Rebellion panel not found.');
        syncRebellionTiers(menu);
    }
    // Status box, balance and message — the game writes them into the same three fields in both
    // modes (Rebellion and Royal Celebration), so both popups share this.
    function mirrorRebellionInfo(menu, panel, missing) {
        const text = r => (panel?.querySelector(`[data-role="${r}"]`)?.textContent || '').trim();

        const active = panel?.querySelector('[data-role="rebellion-status"]');
        const activeBox = menu.querySelector('.mcfo-reb__active');
        const activeText = active && active.style.display !== 'none' ? (active.textContent || '').trim() : '';
        activeBox.hidden = !activeText;
        if (activeBox.textContent !== activeText) activeBox.textContent = activeText;

        const wallet = text('rebellion-wallet');
        const walletEl = menu.querySelector('.mcfo-reb__wallet');
        if (walletEl.textContent !== wallet) walletEl.textContent = wallet;

        const msgEl = menu.querySelector('.mcfo-reb__msg');
        const msg = panel ? text('rebellion-message') : missing;
        if (msgEl.textContent !== msg) msgEl.textContent = msg;
        // The game colours its message by tone; read that back rather than guess from the words.
        const colour = panel?.querySelector('[data-role="rebellion-message"]')?.style.color || '';
        const tone = /243,\s*164|#f3a4a4/i.test(colour) ? 'error' : /159,\s*216|#9fd8b6/i.test(colour) ? 'success' : '';
        if ((msgEl.getAttribute('data-tone') || '') !== tone) msgEl.setAttribute('data-tone', tone);
    }
    function syncRebellionTiers(menu) {

        for (const b of menu.querySelectorAll('.mcfo-reb__tier')) {
            const tier = REB_TIERS.find(t => String(t.cost) === b.getAttribute('data-mcfo-cost'));
            const block = nativeTier(tier.cost);
            const quest = questMarkFor('reb', tier.mult).length > 0;
            if (b.hasAttribute('data-mcfo-quest') !== quest) b.toggleAttribute('data-mcfo-quest', quest);
            const nb = block && block.querySelector('[data-role="rebellion-tier-start"]');
            const usable = !!verifiedStartButton(tier);
            const armed = b.getAttribute('data-mcfo-armed') === '1';
            // An armed tier that has become unusable meanwhile is disarmed, not left waiting.
            if (armed && !usable) disarm(b);
            b.disabled = !usable;
            b.title = !block ? 'Loading tiers …' : (nb && nb.title) || '';
            const armedNow = b.getAttribute('data-mcfo-armed') === '1';
            const mult  = armedNow ? 'Confirm' : `x${tier.mult}`;
            const tiles = armedNow ? `${number(tier.cost)} diamonds?` : `${tier.mult} tiles`;
            const cost  = armedNow ? 'click again' : `${number(tier.cost)} diamonds`;
            const [m1, m2, m3] = b.children;
            if (m1.textContent !== mult)  m1.textContent = mult;
            if (m2.textContent !== tiles) m2.textContent = tiles;
            if (m3.textContent !== cost)  m3.textContent = cost;
        }
    }

    function disarm(b) {
        b.removeAttribute('data-mcfo-armed');
        clearTimeout(b._mcfoDisarm);
    }

    function rebellionTierClicked(tier, b, menu) {
        if (b.disabled) return;
        // First click: arm this tier, disarm any other.
        if (b.getAttribute('data-mcfo-armed') !== '1') {
            for (const other of menu.querySelectorAll('.mcfo-reb__tier[data-mcfo-armed="1"]')) disarm(other);
            b.setAttribute('data-mcfo-armed', '1');
            b._mcfoDisarm = setTimeout(() => { disarm(b); syncRebellionPopup(menu); }, REB_CONFIRM_MS);
            syncRebellionPopup(menu);
            return;
        }
        // Second click: look the game's button up NOW and check it once more.
        disarm(b);
        const button = verifiedStartButton(tier);
        if (!button) {
            const msgEl = menu.querySelector('.mcfo-reb__msg');
            msgEl.textContent = 'Not started: the game\u2019s panel did not confirm this tier. Nothing was spent.';
            msgEl.setAttribute('data-tone', 'error');
            return;
        }
        // The press bubbles up to our own "close menus on any click" listener; this one click
        // is let through, so the panel stays open and shows how the purchase went.
        keepMenuOnce = true;
        setTimeout(() => { keepMenuOnce = false; }, 0);   // should the click never reach document
        button.click();
        syncRebellionPopup(menu);
    }

