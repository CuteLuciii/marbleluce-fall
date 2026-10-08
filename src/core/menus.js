    // =========================================================================================
    // 6. MENUS
    // =========================================================================================
    let openMenu = null;

    // Set just before a click that this script forwards to the game from inside an open panel,
    // so that one click does not close the panel it came from.
    let keepMenuOnce = false;

    function closeMenus() {
        if (!openMenu) return;
        openMenu.menu.remove();
        openMenu.anchor.removeAttribute('data-mcfo-open');
        openMenu = null;
        stopRebellionPopup();
    }

    // A box under an anchor. What goes inside is up to the caller: a list of buttons for the
    // account menu, the schedule itself for events.
    // place.centre: centred on the anchor and preferably above it — for the panels that open
    // from buttons at the bottom of the board (beverages, Rebellion), so they rise straight out of
    // the button that opened them. Without it: right-aligned under the anchor (account, events).
    function showPanel(anchor, extraClass, fill, place) {
        const wasOpen = openMenu && openMenu.anchor === anchor;
        closeMenus();
        if (wasOpen) return null;   // a second click closes it again

        const menu = document.createElement('div');
        menu.className = 'mcfo-menu' + (extraClass ? ' ' + extraClass : '');
        fill(menu);
        menu._mcfoPlace = place || {};
        menu.addEventListener('click', ev => ev.stopPropagation());
        document.body.appendChild(menu);
        placePanel(anchor, menu);

        anchor.setAttribute('data-mcfo-open', '1');
        openMenu = { anchor, menu };
        return menu;
    }

    // Under the anchor, but never past the right edge of the window. Called again after the
    // events list has been filled in, because only then is its height known.
    function placePanel(anchor, menu) {
        const a = anchor.getBoundingClientRect();
        const m = menu.getBoundingClientRect();
        const centre = !!(menu._mcfoPlace && menu._mcfoPlace.centre);
        const wantLeft = centre ? a.left + a.width / 2 - m.width / 2 : a.right - m.width;
        menu.style.left = Math.round(Math.max(8, Math.min(wantLeft, innerWidth - m.width - 8))) + 'px';

        // Below by default, above when there is no room. The beverage buttons sit at the bottom
        // edge of the board, so a panel opening downwards was cut off — most of it ended up off
        // screen. Whichever side has more room wins when neither fits.
        const untenPlatz = innerHeight - a.bottom - 6;
        const obenPlatz  = a.top - 6;
        const nachOben   = centre
            ? (obenPlatz >= m.height || obenPlatz > untenPlatz)      // above unless it does not fit
            : (untenPlatz < m.height && obenPlatz > untenPlatz);   // below unless it does not fit
        menu.style.top = nachOben
            ? Math.round(Math.max(8, a.top - 6 - m.height)) + 'px'
            : Math.round(Math.min(a.bottom + 6, innerHeight - m.height - 8)) + 'px';
    }

    function showMenu(anchor, entries) {
        showPanel(anchor, null, menu => {
            for (const entry of entries) {
                if (entry.separator) { menu.appendChild(document.createElement('hr')); continue; }
                const b = document.createElement('button');
                b.type = 'button';
                b.textContent = entry.title;
                if (entry.cls) b.className = entry.cls;
                b.addEventListener('click', ev => { ev.stopPropagation(); closeMenus(); entry.run(); });
                menu.appendChild(b);
            }
        });
    }

    document.addEventListener('click', () => {
        if (keepMenuOnce) { keepMenuOnce = false; return; }
        closeMenus();
    });

    // Logged out, the account card is the game's only way in: its click signs you in with Twitch
    // (app.js launchTwitchSignIn → /auth/twitch/start). Our menu sits on that same card, so up to
    // 6.4.1 a logged-out player got Profile, Dailies and the rest — pages that need a login — and
    // no way to log in at all. Now the menu offers the game's sign-in instead.
    //
    // Which state it is the game writes on the card itself (renderShellIdentity): aria-disabled
    // "true" only while signed in with Twitch, "false" as a guest or when reading the session
    // failed. Before the game's first render the attribute is missing — then the normal menu, so
    // nobody who is signed in is offered a login.
    const SIGN_IN_PATH = '/auth/twitch/start';
    let passCardClick = false;

    function signedOut() {
        const card = role('profile-entry');
        return !!card && card.getAttribute('aria-disabled') === 'false';
    }

    // The game's own click on the card, the way it goes without this script. Why it was blocked
    // before: bindMenu listens in the capture phase on the card itself and stops propagation, and
    // under today's DOM rules that also skips the card's own bubbling listeners — the game's
    // sign-in among them. passCardClick lets this one click through. Should it lead nowhere within
    // a moment (a later build could handle the click elsewhere), straight to the address the game
    // would have opened.
    function signIn() {
        let leaving = false;
        const mark = () => { leaving = true; };
        addEventListener('beforeunload', mark, { once: true });
        addEventListener('pagehide', mark, { once: true });
        const card = role('profile-entry');
        if (card) {
            passCardClick = true;
            try { card.click(); } finally { passCardClick = false; }
        }
        setTimeout(() => { if (!leaving) location.assign(SIGN_IN_PATH); }, 500);
    }

    function accountEntries() {
        const entries = signedOut()
            ? [{ title: 'Log in with Twitch', run: signIn }]
            : ACCOUNT_MENU
                .filter(r => PAGES[r])
                .map(r => ({ title: PAGES[r].title, run: () => openPage(PAGES[r].path, PAGES[r].title) }));
        // Player gifts (12f): an own window, not a page of the game.
        if (!signedOut()) entries.push({ title: 'Player gifts', run: showGifts });
        entries.push({ separator: true });
        entries.push({ title: 'Settings', run: showSettings });
        entries.push({ title: 'How to', run: showHowTo });
        entries.push({ title: 'Changelog', run: showChangelog });
        // A newer MarbleLuceFall, found by the update check (12c): first, in red.
        // Daily rewards waiting (12d): first, in gold — below the update when both are there.
        const waiting = dailyWaiting();
        if (waiting) entries.unshift({ title: `Claim all dailies (${waiting})`, cls: 'mcfo-menu__daily', run: () => claimDailies(false) }, { separator: true });
        if (updateAvailable()) entries.unshift({ title: 'Update available: MLF ' + updateLatest, cls: 'mcfo-menu__update', run: installUpdate }, ...(waiting ? [] : [{ separator: true }]));
        return entries;
    }

    // Events is not a page (/events is a 404) but a dialog of the game's. Instead of opening
    // that dialog we fetch the same schedule it feeds on and show it right under the tileset
    // card — one click less than going through a menu.
    //
    // The game asks with the default horizon of 180 minutes ("Next 3 hours"). Here it is a
    // choice: the same 3 hours, or the full 12 the endpoint allows, which typically turns one
    // entry into three.
    const tilesetName = id => String(id || '').replace(/([a-z0-9])([A-Z])/g, '$1 $2').trim() || '?';

    function durationText(ms) {
        const min = Math.max(0, Math.round(ms / 60000));
        if (min < 60) return `${min}m`;
        const h = Math.floor(min / 60), r = min % 60;
        return r ? `${h}h ${r}m` : `${h}h`;
    }

    function showEvents(anchor) {
        const hours = settings.eventsHours;
        const menu = showPanel(anchor, 'mcfo-menu--events', m => {
            m.innerHTML = `<div class="mcfo-events__head">Upcoming tilesets`
                + `<small>Next ${hours} hours</small></div>`
                + `<div class="mcfo-events__empty">Loading &hellip;</div>`;
        });
        if (!menu) return;   // was already open, and is now closed

        fetch(eventsUrl(hours), { credentials: 'include' })
            .then(r => r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)))
            .then(data => {
                // Only draw while this box is still open, or a late reply writes into a node
                // that was removed long ago.
                if (!menu.isConnected) return;
                const rows = (data && data.window && data.window.rows) || [];
                const now  = (data && data.window && data.window.nowUtcMs) || Date.now();
                menu.querySelector('.mcfo-events__empty')?.remove();

                if (!rows.length) {
                    const p = document.createElement('div');
                    p.className = 'mcfo-events__empty';
                    p.textContent = `Nothing scheduled in the next ${hours} hours.`;
                    menu.appendChild(p);
                } else {
                    const ul = document.createElement('ul');
                    ul.className = 'mcfo-events__list';
                    for (const row of rows) {
                        const li = document.createElement('li');
                        if (row.activeNow) li.setAttribute('data-mcfo-live', '1');
                        const until = row.startsAtUtcMs - now;
                        // When it starts, in the viewer's own time zone and date format — the
                        // browser knows both. How long until then is kept in the tooltip.
                        const start = new Date(row.startsAtUtcMs);
                        const end = new Date(row.startsAtUtcMs + (row.durationMs || 0));
                        const clock = d => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        const day = d => d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
                        const when = row.activeNow ? `live now, until ${clock(end)}`
                                   : until <= 0    ? 'any moment'
                                   :                 `${day(start)}, ${clock(start)}`;
                        const name = document.createElement('span');
                        name.className = 'mcfo-events__name';
                        name.textContent = tilesetName(row.tilesetId);
                        const time = document.createElement('span');
                        time.className = 'mcfo-events__when';
                        time.textContent = row.activeNow ? when : `${when}, lasts ${durationText(row.durationMs)}`;
                        if (until > 0) time.title = `starts in ${durationText(until)}`;
                        li.append(name, time);
                        ul.appendChild(li);
                    }
                    menu.appendChild(ul);
                }
                placePanel(anchor, menu);   // the height is only known now
            })
            .catch(e => {
                if (!menu.isConnected) return;
                const p = menu.querySelector('.mcfo-events__empty');
                if (p) p.textContent = 'Schedule unavailable: ' + e.message;
            });
    }

    function bindMenu(anchor, kind, open) {
        if (!anchor || anchor.getAttribute('data-mcfo-menu') === kind) return;
        anchor.setAttribute('data-mcfo-menu', kind);
        anchor.classList.add('mcfo-anchor');
        anchor.addEventListener('click', e => {
            if (passCardClick) return;   // a click this script hands on to the game (signIn)
            const on = kind === 'account' ? settings.accountMenu : settings.eventsPanel;
            if (!on) return;
            e.preventDefault();
            e.stopPropagation();
            open(anchor);
        }, true);
    }

