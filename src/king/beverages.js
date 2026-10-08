    // =========================================================================================
    // 7. BEVERAGES BESIDE THE ATTACK BUTTON
    // =========================================================================================
    // Four buttons flanking the attack button — Water and Lava on the left, Milk and Acid on the
    // right — each opening the three sizes with BOTH prices, so the currency stays a choice the
    // way the game's own panel offers it. An earlier version bought gold-only straight from the
    // king tile; that took the decision away and put the controls somewhere they did not belong.
    //
    // NOTHING IS BOUGHT BY THIS SCRIPT. Every price forwards to the game's own button:
    //
    //   [data-action="king-beverage-activate"][data-beverage-type][data-size][data-currency]
    //
    // So every guard the game has keeps applying — the 15 s unlock at the start of a reign, the
    // balance, the once-per-currency-per-reign limit — and no request is assembled here. If the
    // panel is not mounted, it is opened, the button pressed, and closed again.
    //
    // Colours are the ones the bubbles actually have on the board
    // (KING_BEVERAGE_MARBLE_STYLES in renderLaneFrame.js), so a button looks like what it buys.
    const BEVERAGES = [
        { type: 'water', label: 'Water', side: 'left',  fill: '#2389da', stroke: '#9fd8ff', text: '#ffffff',
          gold: { small: 225, medium: 525, large: 1200 }, diamonds: { small: 40, medium: 70, large: 100 } },
        { type: 'lava',  label: 'Lava',  side: 'left',  fill: '#e34116', stroke: '#ffbd69', text: '#ffffff',
          gold: { small: 150, medium: 450, large: 1050 }, diamonds: { small: 35, medium: 65, large: 95 } },
        { type: 'milk',  label: 'Milk',  side: 'right', fill: '#f5f0dc', stroke: '#ffffff', text: '#182026',
          gold: { small: 180, medium: 600, large: 1350 }, diamonds: { small: 40, medium: 70, large: 100 } },
        { type: 'acid',  label: 'Acid',  side: 'right', fill: '#55c94d', stroke: '#c8ff80', text: '#ffffff',
          gold: { small: 180, medium: 600, large: 1350 }, diamonds: { small: 40, medium: 70, large: 100 } },
    ];
    const BEV_SIZES = [['small', 'Small'], ['medium', 'Medium'], ['large', 'Large']];
    const BEV_CURRENCIES = [['gold', 'Gold'], ['diamonds', 'Diamond']];

    // Which packages are still available. Read from the game, never guessed: /beverages/me lists
    // rights per type + size + currency, and state !== 'available' means spent. Read-only, costs
    // nothing. Both currencies are kept now, not just gold.
    const bevRights = new Map();
    let bevReported = false;

    // Pressed here, the answer not in yet: "type|size|currency" -> time of the click. The button
    // greys out at once instead of after the next poll and stays so until /beverages/me lists the
    // right as spent. Should the game refuse after all (the server said no), it comes back after
    // BEV_PENDING_MS. The game answers within a second as a rule, so it is asked a few times
    // right after a purchase instead of waiting for the 20 s poll.
    const bevPending = new Map();
    const BEV_PENDING_MS = 5000;
    const BEV_RECHECK_MS = [500, 1500, 3000];

    // true once the rights were read, false when the game did not answer.
    async function loadBevRights() {
        try {
            const res = await fetch('/api/king/beverages/me', { credentials: 'include', cache: 'no-store' });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const data = await res.json();
            for (const right of data?.rights || []) {
                bevRights.set(`${right.beverageType}|${right.size}|${right.currency}`, {
                    state: String(right.state || ''),
                    price: Number(right.price),
                });
            }
            return true;
        } catch (e) {
            if (!bevReported) { bevReported = true; console.warn('[MarbleLuceFall] beverage rights unavailable:', e.message); }
            return false;
        }
    }

    async function pollBeverages() {
        if (!settings.kingTray) return;
        await loadBevRights();
        // A click whose right is spent now (or in the game's own pending) needs no stand-in.
        for (const [key] of bevPending) {
            const right = bevRights.get(key);
            if (right && right.state !== 'available') bevPending.delete(key);
        }
        refreshBevPanel();
    }

    function nativeBeverageButton(type, size, currency) {
        return document.querySelector(
            `[data-action="king-beverage-activate"][data-beverage-type="${type}"]`
            + `[data-size="${size}"][data-currency="${currency}"]`);
    }

    // A click this script forwards to the game from inside one of its own panels. .click()
    // dispatches synchronously, so the flag is used up by our document listener on the way and
    // the panel stays open; reset afterwards in case the game stopped the click before that.
    function forwardClick(el) {
        keepMenuOnce = true;
        try { el.click(); } finally { keepMenuOnce = false; }
    }

    // Presses the game's button. done(true) once it was pressed; done(false) when the game's
    // button is greyed out (not unlocked yet, not enough gold) or not there at all.
    function buyBeverage(type, size, currency, done = () => {}) {
        const press = () => {
            const button = nativeBeverageButton(type, size, currency);
            if (!button) { console.warn('[MarbleLuceFall] no native beverage button for', type, size, currency); return null; }
            if (button.disabled) return false;   // the game says no, so we say no
            forwardClick(button);
            return true;
        };
        const settle = ok => {
            if (ok) for (const ms of BEV_RECHECK_MS) setTimeout(pollBeverages, ms);
            done(!!ok);
        };
        const first = press();
        if (first !== null) { settle(first); return; }

        // Panel not mounted: open it, press, close it again — the same route a person would take.
        const toggle = role('beverages-toggle');
        if (!toggle) { settle(false); return; }
        const wasOpen = toggle.getAttribute('aria-expanded') === 'true';
        if (!wasOpen) forwardClick(toggle);
        setTimeout(() => {
            settle(press());
            if (!wasOpen) setTimeout(() => forwardClick(toggle), 60);
        }, 350);
    }

    // One price button, drawn from what is known right now: when the panel opens, on a click,
    // and after every poll while the panel is open.
    function paintBevButton(buy) {
        const { bev, size, sizeLabel, currency, currencyLabel } = buy._mcfoBev;
        const key = `${bev.type}|${size}|${currency}`;
        const right = bevRights.get(key);
        const price = Number.isFinite(right?.price) ? right.price : bev[currency][size];
        const serverPending = right?.state === 'pending';
        const spent = !!right && right.state !== 'available' && !serverPending;
        const pending = !spent && (serverPending || bevPending.has(key));
        buy.textContent = `${currencyLabel} ${number(price)}${pending ? ' …' : ''}`;
        buy.disabled = spent || pending;
        buy.setAttribute('data-mcfo-state', spent ? 'spent' : pending ? 'pending' : 'ready');
        buy.title = spent ? `${bev.label} ${sizeLabel} — already bought with ${currencyLabel} this reign`
            : pending ? `${bev.label} ${sizeLabel} — activating …`
            : `Activate ${bev.label} ${sizeLabel} for ${number(price)} ${currencyLabel}`;
    }

    function refreshBevPanel() {
        if (!openMenu || !openMenu.menu.classList.contains('mcfo-menu--bev')) return;
        openMenu.menu.querySelectorAll('.mcfo-bev__buy').forEach(paintBevButton);
    }

    // The panel stays open after a purchase (6.4): Small, Medium and Large one after another are
    // three clicks, not three trips through the drink button. It closes like every panel of this
    // script — a click elsewhere, or on the drink button again.
    function showBeveragePanel(bev, anchor) {
        showPanel(anchor, 'mcfo-menu--bev', menu => {
            const head = document.createElement('div');
            head.className = 'mcfo-bev__head';
            head.textContent = bev.label;
            head.style.color = bev.stroke === '#ffffff' ? '#e8e2c8' : bev.stroke;
            menu.appendChild(head);
            // The open quests that ask for this beverage (12d), with how far you are.
            for (const q of questMarkFor('bev', bev.type)) {
                const line = document.createElement('div');
                line.className = 'mcfo-bev__quest';
                line.textContent = 'Quest: ' + (q.title || 'Beverage') + questProgress(q);
                menu.appendChild(line);
            }

            for (const [size, sizeLabel] of BEV_SIZES) {
                const row = document.createElement('div');
                row.className = 'mcfo-bev__row';

                const name = document.createElement('span');
                name.className = 'mcfo-bev__size';
                name.textContent = sizeLabel;
                row.appendChild(name);

                for (const [currency, currencyLabel] of BEV_CURRENCIES) {
                    const buy = document.createElement('button');
                    buy.type = 'button';
                    buy.className = 'mcfo-bev__buy';
                    buy.setAttribute('data-mcfo-cur', currency);
                    buy._mcfoBev = { bev, size, sizeLabel, currency, currencyLabel };
                    paintBevButton(buy);
                    buy.addEventListener('click', e => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (buy.disabled) return;
                        const key = `${bev.type}|${size}|${currency}`;
                        const at = Date.now();
                        bevPending.set(key, at);
                        paintBevButton(buy);
                        buyBeverage(bev.type, size, currency, ok => {
                            if (!ok && bevPending.get(key) === at) bevPending.delete(key);
                            refreshBevPanel();
                        });
                        setTimeout(() => {
                            if (bevPending.get(key) !== at) return;
                            bevPending.delete(key);
                            refreshBevPanel();
                        }, BEV_PENDING_MS);
                    });
                    row.appendChild(buy);
                }
                menu.appendChild(row);
            }
        }, { centre: true });
    }

    // The tray content is replaced wholesale by the game on every king-state update
    //
    //     actionTray.innerHTML = hasContent ? html : '';      (kingPane.js)
    //
    // so anything put in here is deleted on the next one. Our buttons are ours, not moved
    // originals, and a watcher puts them back at once when the tray is rebuilt.
    // Symbols for the beverage buttons (6.12), in the colours the bubbles have on the board
    // (BEVERAGES). Each has a dark outline, so it reads on light and dark buttons alike, whatever
    // the theme makes of the button around it.
    const DRINK_ICONS = {
        water: '<svg class="mcfo-drink__icon" viewBox="0 0 24 24" aria-hidden="true">'
            + '<path d="M12 2.5C9.5 6.5 5.5 10.6 5.5 14.8a6.5 6.5 0 0 0 13 0C18.5 10.6 14.5 6.5 12 2.5Z" fill="#2389da" stroke="#0b2a44" stroke-width="1.3" stroke-linejoin="round"/>'
            + '<path d="M9 15.5a3 3 0 0 0 2.4 3" fill="none" stroke="#9fd8ff" stroke-width="1.6" stroke-linecap="round"/></svg>',
        lava: '<svg class="mcfo-drink__icon" viewBox="0 0 24 24" aria-hidden="true">'
            + '<path d="M12 3.5c.9 3.3 5.5 5.9 5.5 11a5.5 5.5 0 0 1-11 0c0-2.6 1.2-4.4 2.6-5.8.3 1.8 1.1 3 2.1 3.5-.1-3.6.3-6.3.8-8.7Z" fill="#e34116" stroke="#4a1204" stroke-width="1.3" stroke-linejoin="round"/>'
            + '<path d="M12 12.8c1 1.4 2.4 2.3 2.4 4.1a2.4 2.4 0 0 1-4.8 0c0-1.6 1.4-2.6 2.4-4.1Z" fill="#ffbd69"/></svg>',
        milk: '<svg class="mcfo-drink__icon" viewBox="0 0 24 24" aria-hidden="true">'
            + '<path d="M9.6 5h4.8l1.9 3.3c.4.7.7 1.5.7 2.3v9a1.6 1.6 0 0 1-1.6 1.6H8.6A1.6 1.6 0 0 1 7 20.6v-9c0-.8.3-1.6.7-2.3Z" fill="#f5f0dc" stroke="#39434a" stroke-width="1.3" stroke-linejoin="round"/>'
            + '<rect x="7.7" y="13.2" width="8.6" height="4" fill="#9fd8ff"/>'
            + '<rect x="9.1" y="2.2" width="5.8" height="2.8" rx="0.8" fill="#2389da" stroke="#39434a" stroke-width="1.1"/></svg>',
        acid: '<svg class="mcfo-drink__icon" viewBox="0 0 24 24" aria-hidden="true">'
            + '<path d="M7.8 13h8.4l2.4 4.9a2.3 2.3 0 0 1-2.1 3.4H7.4a2.3 2.3 0 0 1-2.1-3.4Z" fill="#55c94d"/>'
            + '<path d="M10.2 2.8v5.1L5.3 17.9a2.3 2.3 0 0 0 2.1 3.4h9.2a2.3 2.3 0 0 0 2.1-3.4L13.8 7.9V2.8" fill="none" stroke="#16330f" stroke-width="1.3" stroke-linejoin="round"/>'
            + '<path d="M9 2.8h6" stroke="#16330f" stroke-width="1.6" stroke-linecap="round"/>'
            + '<circle cx="10.5" cy="16.5" r="1.1" fill="#c8ff80"/><circle cx="13.6" cy="18.6" r="0.9" fill="#c8ff80"/><circle cx="12.6" cy="10.8" r="0.8" fill="#55c94d"/></svg>',
    };

    function buildKingTray() {
        document.documentElement.setAttribute('data-mcfo-tray', settings.kingTray ? '1' : '0');
        const content = document.querySelector('.mcf-king-action-content');

        if (!settings.kingTray) {
            document.querySelectorAll('.mcfo-stack').forEach(e => e.remove());
            return;
        }
        if (!content) return;
        // Already there in the look chosen: nothing to do. In the other look: built anew.
        const icons = settings.drinkIcons === 1;
        const have = content.querySelector('.mcfo-stack');
        if (have && have.getAttribute('data-mcfo-icons') === (icons ? '1' : '0')) return;
        content.querySelectorAll('.mcfo-stack').forEach(e => e.remove());

        for (const side of ['left', 'right']) {
            const stack = document.createElement('div');
            stack.className = 'mcfo-stack mcfo-stack--' + side;
            stack.setAttribute('data-mcfo-icons', icons ? '1' : '0');
            for (const bev of BEVERAGES.filter(b => b.side === side)) {
                const b = document.createElement('button');
                b.type = 'button';
                b.className = 'mcfo-drink';
                b.setAttribute('data-mcfo-drink', bev.type);
                if (icons) {
                    b.classList.add('mcfo-drink--icon');
                    b.innerHTML = DRINK_ICONS[bev.type];
                    b.title = bev.label;
                    b.setAttribute('aria-label', bev.label);
                } else {
                    b.textContent = bev.label;
                    b.style.background = bev.fill;
                    b.style.borderColor = bev.stroke;
                    b.style.color = bev.text;
                }
                b.addEventListener('click', e => {
                    e.preventDefault();
                    e.stopPropagation();
                    showBeveragePanel(bev, b);
                });
                questDot(b);   // shown or not by the html element (12d), so right from the first frame
                stack.appendChild(b);
            }
            content.appendChild(stack);
        }
    }

    // The beverage buttons take the height of the attack button (6.20.3). Measured on the button
    // that is really shown — ours while "attack when free" is on, the game's otherwise, both carry
    // the game's class — and handed to the CSS as a variable. Besides the look, this keeps the
    // tray from growing: a beverage button taller than the attack button made the whole tray
    // taller than the one the game measured its column with, and the king tile ended up out of
    // line (see alignPanes).
    function syncDrinkHeight() {
        const content = document.querySelector('.mcf-king-action-content');
        if (!content) return;
        const attack = [...content.querySelectorAll('.mcf-king-attack-placeholder')]
            .find(b => b.getBoundingClientRect().height > 0);
        if (!attack) return;
        const h = Math.round(attack.getBoundingClientRect().height);
        if (h > 0 && content.style.getPropertyValue('--mcfo-drink-h') !== h + 'px') {
            content.style.setProperty('--mcfo-drink-h', h + 'px');
        }
    }

    function watchTray() {
        const tray = role('king-action-tray');
        if (!tray || tray.getAttribute('data-mcfo-watched') === '1') return;
        tray.setAttribute('data-mcfo-watched', '1');
        new MutationObserver(() => { buildKingTray(); buildAttackAssist(); syncDrinkHeight(); placeKingTray(); }).observe(tray, { childList: true, subtree: true });
    }

    // The king tile is fitted into its pane by scale and centred (kingPane.js syncKingTileFit:
    // min(width / 640, height / 1080)). In a pane taller than the tile needs, room is left above
    // and below it, while the tray stays at the bottom of the pane — the taller the screen, the
    // farther from the tile. It is lifted to sit TRAY_GAP under the tile, by translate (CSS above).
    // Measured again whenever the pane or the tray changes size, on every rebuild of the tray and
    // on the 1.5 s beat.
    const TRAY_GAP = 8;
    let trayResize = null;
    const trayObserved = new WeakSet();
    function placeKingTray() {
        document.documentElement.setAttribute('data-mcfo-traylift', settings.trayLift ? '1' : '0');
        const tray = role('king-action-tray');
        if (!tray) return;
        if (!settings.trayLift) { tray.style.removeProperty('--mcfo-tray-lift'); return; }
        if (!trayResize && typeof ResizeObserver === 'function') trayResize = new ResizeObserver(() => requestAnimationFrame(placeKingTray));
        for (const el of [role('king-viewport'), tray]) {
            if (el && trayResize && !trayObserved.has(el)) { trayObserved.add(el); trayResize.observe(el); }
        }
        const frame = role('king-tile-frame');
        const pane = role('king-pane');
        const now = parseFloat(tray.style.getPropertyValue('--mcfo-tray-lift')) || 0;
        let lift = 0;
        if (frame && pane && !tray.hidden) {
            const f = frame.getBoundingClientRect(), t = tray.getBoundingClientRect();
            // While the chat glides the pane is scaled (glideChat): screen pixels are then not the
            // pixels translate moves by, so both are brought back to the pane's own.
            const k = pane.offsetHeight ? pane.getBoundingClientRect().height / pane.offsetHeight : 1;
            if (f.height > 0 && t.height > 0 && k > 0) {
                const home = t.top + now * k;   // where the tray would be without the lift
                lift = Math.max(0, Math.round((home - f.bottom) / k - TRAY_GAP));
            }
        }
        if (Math.abs(lift - now) >= 1) tray.style.setProperty('--mcfo-tray-lift', lift + 'px');
    }

    // Chat height follows the board (6.13): half the room the lane tiles leave above them goes to
    // the chat as a margin at the top and at the bottom (CSS above). Measured on a lane: its svg is
    // sized to the tile's aspect inside the lane's viewport (layoutLaneViewport), so the room is
    // how far below the top of the chat's own column the svg begins. No fixed sizes anywhere:
    // whatever the window and the screen, the room is measured, and where the tiles fill the
    // height there is none. Skipped while the chat glides (the lanes are scaled for a moment).
    let chatResize = null;
    const chatObserved = new WeakSet();
    function placeChat() {
        document.documentElement.setAttribute('data-mcfo-chatfit', settings.chatFit ? '1' : '0');
        const pane = role('desktop-chat-pane');
        if (!pane) return;
        if (!settings.chatFit) { pane.style.removeProperty('--mcfo-chat-inset'); return; }
        if (document.querySelector('[data-mcfo-glide]')) return;
        const stage = [...document.querySelectorAll('[data-role="main-region"] [data-role="lane-stage"]')]
            .find(s => s.getBoundingClientRect().height > 0);
        if (!chatResize && typeof ResizeObserver === 'function') chatResize = new ResizeObserver(() => requestAnimationFrame(placeChat));
        for (const el of [stage, role('lane-play-region')]) {
            if (el && chatResize && !chatObserved.has(el)) { chatObserved.add(el); chatResize.observe(el); }
        }
        const now = parseFloat(pane.style.getPropertyValue('--mcfo-chat-inset')) || 0;
        const p = pane.getBoundingClientRect();
        let inset = 0;
        if (stage && p.height > 0) {
            const top = p.top - now;   // where the chat would start without the margin
            inset = Math.max(0, Math.round((stage.getBoundingClientRect().top - top) / 2));
        }
        if (Math.abs(inset - now) >= 1) pane.style.setProperty('--mcfo-chat-inset', inset + 'px');
    }

    // The game sizes its columns once on load and subtracts the height of the king's tray — which
    // is still empty then, 0px (app.js measureActionTrayHeight). Once it fills, the king column is
    // too wide, and its tile, centred above the tray, sticks out above the lanes until the next
    // refit (ninkasi, 15.09.: after every reload; a resize put it right). So a change of the
    // tray's height is a reason to refit, like a change of window size.
    //
    // An EMPTY tray is no reason (6.20.1). While a marble runs in the king tile the game empties
    // the tray (kingPane.js renderTray: innerHTML '', class lane-action-tray--empty), and a refit
    // then gave the king column the room of a pane without a tray: the tile jumped to the size of
    // the lanes and the bar was gone (Luce, 16.09.). Now the empty tray keeps the height it last
    // had when filled (--mcfo-tray-keep, CSS above), so nothing moves at all, and only a change
    // between two filled heights refits — the empty tray at load still counts as 0, so the fix of
    // 15.09. stays.
    let trayHeightSeen = null;   // the last FILLED height (0 while none was seen yet)
    let trayHeightWatch = null;
    function watchTrayHeight() {
        const tray = role('king-action-tray');
        if (!tray || trayHeightWatch || typeof ResizeObserver !== 'function') return;
        trayHeightWatch = new ResizeObserver(() => {
            const h = Math.round(tray.getBoundingClientRect().height);
            if (h === 0 || tray.classList.contains('lane-action-tray--empty')) {
                if (trayHeightSeen === null) trayHeightSeen = 0;
                return;
            }
            if (trayHeightSeen !== null && h !== trayHeightSeen) refitSoon();
            trayHeightSeen = h;
            tray.style.setProperty('--mcfo-tray-keep', h + 'px');
        });
        trayHeightWatch.observe(tray);
    }

    // The king column is viewport + tray (app.js computeActionAwareLaneGridColumns:
    // viewportHeight = availableHeight - measureActionTrayHeight). Measured in a moment when the
    // tray is empty — while a marble runs in the king tile — the viewport gets the full height:
    // the king tile ends up one tray taller than the lanes and its tray hangs below their bottom
    // edge (Luce, 16.09.). The game measures again only when the chat opens or closes, so a page
    // loaded in such a moment keeps it for the rest of the session. 6.20.1 keeps the empty tray
    // at its last filled height, which stops it from happening again; this puts right what is
    // already wrong, whenever it is found.
    //
    // A refit is two clicks on the game's chat toggle, so it is kept rare: at most one per
    // ALIGN_COOLDOWN_MS, and given up after ALIGN_MAX_TRIES. A mismatch the game itself cannot
    // resolve must not fold the chat every few seconds for ever.
    const ALIGN_TOLERANCE_PX = 3;
    const ALIGN_COOLDOWN_MS = 15000;
    const ALIGN_MAX_TRIES = 3;
    let alignAt = 0, alignTries = 0;
    function alignPanes() {
        if (!settings.boardRefit) return;
        const king = role('king-pane');
        const lane = document.querySelector('[data-role="main-region"] [data-role="lane-panel"]');
        if (!king || !lane) return;
        const mode = (role('shell') || { getAttribute: () => null }).getAttribute('data-layout-mode');
        if (mode && mode !== 'desktop') return;
        const k = king.getBoundingClientRect(), l = lane.getBoundingClientRect();
        if (!k.height || !l.height) return;
        const off = Math.round(k.bottom - l.bottom);
        if (Math.abs(off) <= ALIGN_TOLERANCE_PX) { alignTries = 0; return; }   // in line again
        const now = Date.now();
        if (alignTries >= ALIGN_MAX_TRIES || now - alignAt < ALIGN_COOLDOWN_MS) return;
        alignAt = now;
        alignTries++;
        console.log(`[MarbleLuceFall] king column ${Math.abs(off)}px ${off > 0 ? 'below' : 'above'} the lanes - having the game measure again`);
        refitSoon();
    }

