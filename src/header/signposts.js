    // =========================================================================================
    // 8. HEADER CARDS AS SIGNPOSTS
    // =========================================================================================
    // Six buttons have left the footer. Anyone who does not know where they went will not find
    // them, so every card that opens something says what it opens.
    //
    // The Diamonds card gets no label of its own: the game's "Purchase" button is already there.
    // That button is intercepted as well, so card and button do the same thing — it used to run
    // window.location.assign('/payment/packages'), which is exactly the page that now opens in
    // the overlay.
    const CARDS = [
        {
            // 6.38: the ticket history (8c). No sign of its own: the right-hand side of the card
            // holds the game's Active line (8b), and the glow says it can be clicked.
            id: 'tickets',
            find: () => document.querySelector('[data-role="metric-cell"][data-metric-role="tickets"]'),
            label: null,
            setting: 'ticketHistory',
            run: el => showTicketHistory(el),
        },
        {
            id: 'gold',
            find: () => document.querySelector('[data-role="metric-cell"][data-metric-role="gold"]'),
            label: 'Shop',
            place: 'float',
            run: () => openPage('/shop', 'Shop'),
        },
        {
            id: 'diamonds',
            find: () => document.querySelector('[data-role="metric-cell"][data-metric-role="diamonds"]'),
            label: null,
            run: () => openPage('/payment/packages', 'Buy Diamonds'),
        },
        {
            // 6.35: a quick way to the saved loadouts (12e), without opening the inventory.
            id: 'points',
            find: () => document.querySelector('[data-role="metric-cell"][data-metric-role="current-points"]'),
            label: 'Loadouts',
            place: 'float',
            setting: 'pointsLoadouts',
            run: el => showLoadoutMenu(el),
        },
        {
            id: 'account',
            find: () => role('profile-entry'),
            label: () => (signedOut() ? 'Log in' : 'Account'),
            place: 'float',
            // No run: the menu is already bound by bindMenu, this only adds the sign.
        },
        {
            id: 'events',
            find: () => firstRole('session-cell', 'tileset-indicator'),
            label: 'Events',
            place: 'float',
        },
    ];

    function setSignpost(card, text, place) {
        let el = card.querySelector(':scope > .mcfo-signpost');
        if (!text) { if (el) el.remove(); return; }
        if (!el) {
            el = document.createElement('span');
            el.className = 'mcfo-signpost' + (place === 'float' ? ' mcfo-signpost--float' : '');
            card.appendChild(el);
        }
        const want = text + ' ›';
        if (el.textContent !== want) el.textContent = want;
    }

    function buildCards() {
        document.documentElement.setAttribute('data-mcfo-cards', settings.cardSignposts ? '1' : '0');
        for (const card of CARDS) {
            const el = card.find();
            if (!el) continue;

            const on = !!settings.cardSignposts && (!card.setting || !!settings[card.setting]);
            el.classList.toggle('mcfo-card', on);
            const label = typeof card.label === 'function' ? card.label() : card.label;
            setSignpost(el, on ? label : null, card.place);

            if (!card.run) continue;
            if (el.getAttribute('data-mcfo-card') === card.id) continue;
            el.setAttribute('data-mcfo-card', card.id);
            el.addEventListener('click', e => {
                if (!settings.cardSignposts || (card.setting && !settings[card.setting])) return;
                e.preventDefault();
                e.stopPropagation();
                card.run(el);
            }, true);
        }
    }

