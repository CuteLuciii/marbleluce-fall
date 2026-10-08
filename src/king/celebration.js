    // =========================================================================================
    // 9k. ROYAL CELEBRATION PANEL (6.30, game v0.10.1b)
    // =========================================================================================
    // A King can buy one Royal Celebration per reign: ScoreZones boosted on all lanes for a number
    // of tiles, the toll set to 10, attackers removed and the throne protected until it ends. The
    // game offers it in the Rebellion panel itself — while you are King that panel is re-rendered
    // by royalCelebrationPanel.js with eight tiers:
    //
    //     <div data-role="royal-celebration-tier" data-tier-id="royal_2500">
    //         <strong data-role="royal-celebration-tier-multiplier">\u00d73</strong>
    //         <span data-role="royal-celebration-tier-cost">2,500 Diamonds</span>
    //         <span data-role="royal-celebration-tier-duration">17 tiles</span>
    //         <button data-role="royal-celebration-tier-start" data-tier-id="royal_2500">Start</button>
    //
    // Same rules as 9a: NOTHING IS BOUGHT BY THIS SCRIPT — a tier presses the game's own Start,
    // which posts to /api/king/celebrations with the game's guards and correlation id. The button
    // is found by its tier id, checked against multiplier and tile count, looked up afresh at the
    // moment of the click, and only the second click within four seconds presses it.
    // Unlike Rebellion tiers, two tiers share a multiplier (x2 for 5 and for 10 tiles), which is
    // why the game gives them ids; the id is what we match on.
    const CEL_TIERS = [
        { id: 'royal_500',   mult: 2,  tiles: 5,  cost: 500,   hue: '#e8d9a0' },
        { id: 'royal_1000',  mult: 2,  tiles: 10, cost: 1000,  hue: '#f0d070' },
        { id: 'royal_1700',  mult: 3,  tiles: 10, cost: 1700,  hue: '#f5c04a' },
        { id: 'royal_2500',  mult: 3,  tiles: 17, cost: 2500,  hue: '#f5a83a' },
        { id: 'royal_5000',  mult: 5,  tiles: 17, cost: 5000,  hue: '#f08a3a' },
        { id: 'royal_7500',  mult: 5,  tiles: 25, cost: 7500,  hue: '#ec6f4a' },
        { id: 'royal_10000', mult: 10, tiles: 25, cost: 10000, hue: '#e85a8a' },
        { id: 'royal_12500', mult: 10, tiles: 50, cost: 12500, hue: '#c070f0' },
    ];

    // The game switches its panel on the same signal it uses for the toll controls.
    function isRoyalMode() {
        return role('bid-area')?.getAttribute('data-king-toll-mode') === 'true';
    }

    function nativeCelTier(id) {
        const panel = nativeRebellionPanel();
        return panel && panel.querySelector(`[data-role="royal-celebration-tier"][data-tier-id="${id}"]`);
    }

    function verifiedCelStart(tier) {
        if (!isRoyalMode()) return null;
        const block = nativeCelTier(tier.id);
        if (!block) return null;
        const mult  = (block.querySelector('[data-role="royal-celebration-tier-multiplier"]')?.textContent || '').trim();
        const tiles = (block.querySelector('[data-role="royal-celebration-tier-duration"]')?.textContent || '').trim();
        if (mult !== `\u00d7${tier.mult}` || tiles !== `${tier.tiles} tiles`) return null;
        const button = block.querySelector('[data-role="royal-celebration-tier-start"]');
        if (!button || button.getAttribute('data-tier-id') !== tier.id) return null;
        if (button.disabled || button.getAttribute('aria-disabled') === 'true') return null;
        return button;
    }

    function showCelebrationPopup(anchor) {
        const menu = showPanel(anchor, 'mcfo-menu--reb', m => {
            m.innerHTML = '<div class="mcfo-reb__head"><span class="mcfo-reb__title mcfo-reb__title--royal">Royal Celebration</span>'
                        + '<span class="mcfo-reb__note">One per reign.</span></div>'
                        + '<div class="mcfo-reb__info">'
                        +   '<div class="mcfo-reb__rule">Boosts ScoreZones across all lanes, dangerous buckets become safe. '
                        +   'Sets the toll to 10, removes attackers and protects you until it ends.</div>'
                        +   '<div class="mcfo-reb__active" hidden></div>'
                        +   '<div class="mcfo-reb__wallet"></div>'
                        +   '<div class="mcfo-reb__msg"></div>'
                        + '</div>'
                        + '<div class="mcfo-reb__grid"></div>';
            const grid = m.querySelector('.mcfo-reb__grid');
            for (const tier of CEL_TIERS) {
                const b = document.createElement('button');
                b.type = 'button';
                b.className = 'mcfo-reb__tier';
                b.style.setProperty('--mcfo-tier', tier.hue);
                b.setAttribute('data-mcfo-cel', tier.id);
                b.innerHTML = '<span class="mcfo-reb__mult"></span><span class="mcfo-reb__tiles"></span><span class="mcfo-reb__cost"></span><span class="mcfo-reb__quest">Quest</span>';
                b.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); celebrationTierClicked(tier, b, m); });
                grid.appendChild(b);
            }
        }, { centre: true });
        if (!menu) return;
        document.documentElement.setAttribute('data-mcfo-rebpop', '1');
        wakeNativeRebellion();
        syncCelebrationPopup(menu);
        placePanel(anchor, menu);
        rebTimer = setInterval(() => {
            if (!menu.isConnected) { stopRebellionPopup(); return; }
            // The reign ended while it was open: nothing here can be bought any more.
            if (!isRoyalMode()) { closeMenus?.(); stopRebellionPopup(); return; }
            syncCelebrationPopup(menu);
        }, 250);
    }

    function syncCelebrationPopup(menu) {
        mirrorRebellionInfo(menu, nativeRebellionPanel(), 'Royal Celebration panel not found.');
        for (const b of menu.querySelectorAll('.mcfo-reb__tier')) {
            const tier = CEL_TIERS.find(t => t.id === b.getAttribute('data-mcfo-cel'));
            const block = nativeCelTier(tier.id);
            const quest = questMarkFor('cel', tier.id).length > 0;
            if (b.hasAttribute('data-mcfo-quest') !== quest) b.toggleAttribute('data-mcfo-quest', quest);
            const usable = !!verifiedCelStart(tier);
            if (b.getAttribute('data-mcfo-armed') === '1' && !usable) disarm(b);
            b.disabled = !usable;
            b.title = !block ? 'Loading tiers \u2026' : '';
            const armedNow = b.getAttribute('data-mcfo-armed') === '1';
            const mult  = armedNow ? 'Confirm' : `x${tier.mult}`;
            const tiles = armedNow ? `${number(tier.cost)} diamonds?` : `${tier.tiles} tiles`;
            const cost  = armedNow ? 'click again' : `${number(tier.cost)} diamonds`;
            const [m1, m2, m3] = b.children;
            if (m1.textContent !== mult)  m1.textContent = mult;
            if (m2.textContent !== tiles) m2.textContent = tiles;
            if (m3.textContent !== cost)  m3.textContent = cost;
        }
    }

    function celebrationTierClicked(tier, b, menu) {
        if (b.disabled) return;
        if (b.getAttribute('data-mcfo-armed') !== '1') {
            for (const other of menu.querySelectorAll('.mcfo-reb__tier[data-mcfo-armed="1"]')) disarm(other);
            b.setAttribute('data-mcfo-armed', '1');
            b._mcfoDisarm = setTimeout(() => { disarm(b); syncCelebrationPopup(menu); }, REB_CONFIRM_MS);
            syncCelebrationPopup(menu);
            return;
        }
        disarm(b);
        const button = verifiedCelStart(tier);
        if (!button) {
            const msgEl = menu.querySelector('.mcfo-reb__msg');
            msgEl.textContent = 'Not started: the game\u2019s panel did not confirm this tier. Nothing was spent.';
            msgEl.setAttribute('data-tone', 'error');
            return;
        }
        keepMenuOnce = true;
        setTimeout(() => { keepMenuOnce = false; }, 0);
        button.click();
        syncCelebrationPopup(menu);
    }

