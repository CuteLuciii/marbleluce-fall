
    function howToSections() {
        return [
            { title: 'Getting around', items: [
                'Click your name for Profile, Dailies, Inventory, Achievements, Leaderboards, Settings, How to and Changelog. Logged out, the same menu offers Log in with Twitch.',
                'The header cards are signposts: Gold opens the Shop, Diamonds the packages, the tileset card the upcoming tilesets.',
                'Pages open as windows over the running game. Drag the title bar to move one, any edge or corner to resize it, – parks it in the taskbar, Esc closes the top one.',
                'The new inventory: categories on the left (Overview on top shows everything you wear), search, rarity, Equipped and In pool above the cards, a large preview with Equip and Pool on the right; double-click a card to equip it. "Classic inventory" at the bottom of the sidebar opens the game\'s own. Settings \u203a Inventory \u203a New inventory',
                'The new achievements page: categories on the left with how far you are in each, an Overview on top (AP, next reward, AP reward cycles, closest to done, recently unlocked, Public Chronicle), filters and sorting above the cards, the picked achievement on the right - career lines with all their milestones. "Classic achievements" at the bottom of the sidebar opens the game\'s page. Settings \u203a Achievements \u203a New achievements page',
                'In the classic inventory a category opens on one tile per rarity (items without one share the Default tile), with how many items you have in it and whether your equipped item is among them; click a tile for its items, \u2039 Rarities goes back. Settings \u203a Inventory \u203a Rarities first',
            ] },
            { title: 'Ticket rail', items: [
                'Rebellion sits left of the chips. The bigger chips fold away behind the arrow; 10K to 1B unlock at ten times their amount in tickets.',
                'Unbid takes your bid back out of the queue, the same as typing !unbid.',
                'Autobid bids on every tile for you: click it, switch it on, pick 1 to 100 tickets and choose risk protection. It pauses while you are King.',
            ] },
            { title: 'King tile', items: [
                'The game\'s reign read-outs stand on the tile, with the toll the King has set as an extra line; pick the lines in Settings. The beverage buttons sit left and right of the attack button. A beverage panel stays open after a purchase, so several can be bought in a row.',
                'On the throne you can type the toll instead of clicking it up and down.',
                'Attack when free (opt-in in Settings) waits until your marble is free and attacks for you. Set to try again, it starts over after every miss until you are King.',
                'On the throne (opt-in in Settings) sets your toll and pours the beverages you picked by itself when you take the crown, once per reign. Beverages spend gold or diamonds for good.',
            ] },
            { title: 'Shop and dailies', items: [
                'A gold Quest tag in the shop marks an offer that would complete one of today\'s open shop quests; while one is in the rotation, the Shop sign on the Gold card has a gold dot.',
                'Diamond prices show what they cost in euros, from the cheapest to the dearest diamond pack.',
                'A gold dot on your account card means a daily reward is waiting: "Claim all dailies" at the top of the menu takes everything that is ready. Settings › Shop and dailies › Claim dailies by themselves does it without the click.',
            ] },
            { title: 'Chat', items: [
                'The chat folds into a slim rail with a counter for new messages, or pops out into a window of its own.',
                'The message box grows with long messages, up to five lines.',
                'While you are at the bottom, the chat stays at the newest message; scroll up to read and it stays put.',
                'Typing !tomato and a name opens a list of players to choose from; it only shows while there is something to choose.',
                'Enhanced chat (opt-in) groups messages by sender and hides the system lines you pick.',
            ] },
            { title: 'Music', items: [
                'Settings › Sound: the music player lays the game’s whole soundtrack out by album. Click a track to hear that one, take its tick off to keep it out of the rotation, or tick a whole album on or off at its heading.',
                'The note next to the gear puts a small player on the page: drag it where you like and it stays there. Previous, play, next, shuffle, volume, and a line that shows how far the track has got and how much of it has loaded - click the line to jump.',
                'Shuffle plays everything once before anything comes round again. The bar under the buttons goes anywhere in a track, and where you stopped is where it starts next time — nothing ever begins by itself.',
                'While the player is on, the game plays no music of its own. Switch it off and the game’s own music controls are back where they were.',
            ] },
            { title: 'Themes', items: [
                `Settings › Theme: ${THEMES.length} themes in ${new Set(THEMES.map(t => t.group)).size} groups. Random picks a new one on every load, and every few minutes if you like.`,
                'Custom: choose hue, accent and intensity, a gradient and a pattern.',
                'Deluxe themes go further than colour: textures, scenery and effects — a Deluxe version of every game theme, and the TARDIS. Under their tiles you choose how much moves: Full, Subtle or Off.',
            ] },
            { title: 'If something looks off', items: [
                'Every part can be switched off in Settings, and switching it off gives back the game’s own look.',
                'On a slower machine the Performance levels help; the frame rate counter shows the difference.',
            ] },
        ];
    }

    // "6.3" against "6.2.1", part by part; a range like "3.8 – 3.16" counts by its first number.
    function cmpVersion(a, b) {
        const parts = v => String(v).split(/[^\d.]/)[0].split('.').map(Number);
        const pa = parts(a), pb = parts(b);
        for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
            const d = (pa[i] || 0) - (pb[i] || 0);
            if (d) return d;
        }
        return 0;
    }
    const niceDate = iso => new Date(iso + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

    // Returns the scrolling part; docFoot puts its bar below it, outside the scroll.
    function docBox(body) {
        body.textContent = '';
        const box = document.createElement('div');
        box.className = 'mcfo-doc';
        const scroll = document.createElement('div');
        scroll.className = 'mcfo-doc__scroll';
        box.appendChild(scroll);
        body.appendChild(box);
        return scroll;
    }
    function docList(box, items) {
        const ul = document.createElement('ul');
        for (const text of items) { const li = document.createElement('li'); linkSettings(li, text); ul.appendChild(li); }
        box.appendChild(ul);
    }

    // "Settings › Chat › Tidy name suggestions", "(Settings, King tile, After a miss)", "in Settings
    // under Theme": the way changelog and how-to have always pointed at a switch. Wherever the
    // words after "Settings" are a real page — and after that, optionally, a real switch on it —
    // they become a link that opens exactly there. Matched against SETTINGS_SECTIONS, so a
    // renamed page simply stops being a link instead of pointing into nothing, and old entries
    // get their links without being rewritten.
    // "Inventory \u203a Loadouts" in a text opens the inventory, where the loadout bar sits (6.32).
    function linkSettings(el, text) {
        const parts = String(text).split('Inventory \u203a Loadouts');
        parts.forEach((part, i) => {
            if (i) {
                const a = document.createElement('a');
                a.className = 'mcfo-doc__link';
                a.href = '#';
                a.textContent = 'Inventory \u203a Loadouts';
                a.addEventListener('click', e => { e.preventDefault(); openPage('/inventory', 'Inventory'); });
                el.appendChild(a);
            }
            linkSettingsOnly(el, part);
        });
    }
    function linkSettingsOnly(el, text) {
        const titles = SETTINGS_SECTIONS.map(x => x.title).sort((a, b) => b.length - a.length);
        let rest = String(text), m;
        const sep = /^(\s*[›,]\s*|\s+under\s+)/;
        while ((m = /\bSettings\b/.exec(rest))) {
            let tail = rest.slice(m.index + m[0].length);
            const s1 = sep.exec(tail);
            const title = s1 && titles.find(t => tail.slice(s1[0].length).startsWith(t));
            if (!title) { el.append(rest.slice(0, m.index + m[0].length)); rest = tail; continue; }
            let len = m[0].length + s1[0].length + title.length, label = null;
            tail = rest.slice(m.index + len);
            const s2 = /^\s*[›,]\s*/.exec(tail);
            if (s2) {
                const section = SETTINGS_SECTIONS.find(x => x.title === title);
                const labels = sectionItems(section).map(i => i.label).filter(Boolean)
                    .concat(...sectionItems(section).map(i => [i.sub && i.sub.label, ...(i.subs || []).map(x => x.label)]).filter(Boolean))
                    .sort((a, b) => b.length - a.length);
                label = labels.find(l => tail.slice(s2[0].length).startsWith(l)) || null;
                if (label) len += s2[0].length + label.length;
            }
            el.append(rest.slice(0, m.index));
            const a = document.createElement('a');
            a.className = 'mcfo-doc__link';
            a.href = '#';
            a.textContent = rest.slice(m.index, m.index + len);
            a.addEventListener('click', e => { e.preventDefault(); openSettingsAt(title, label); });
            el.appendChild(a);
            rest = rest.slice(m.index + len);
        }
        el.append(rest);
    }
    function openSettingsAt(title, label) {
        settingsView = title;
        showSettings();
        if (!label) return;
        const w = windows.get(SETTINGS_KEY);
        const hit = w && w.body && [...w.body.querySelectorAll('.mcfo-set__label, .mcfo-set__sub-label')]
            .find(x => x.textContent.trim() === label);
        const item = hit && (hit.closest('.mcfo-set__item') || hit.closest('.mcfo-set__row'));
        if (!item) return;
        item.scrollIntoView({ block: 'center' });
        // A ring that fades once — shows where to look, then gets out of the way.
        item.classList.add('mcfo-set__item--found');
        requestAnimationFrame(() => item.classList.add('mcfo-set__item--fade'));
        setTimeout(() => item.classList.remove('mcfo-set__item--found', 'mcfo-set__item--fade'), 3000);
    }
    function docVersion(box, entry) {
        const head = document.createElement('div');
        head.className = 'mcfo-doc__ver';
        head.innerHTML = '<span class="mcfo-doc__vnum"></span><span class="mcfo-doc__date"></span>';
        head.firstChild.textContent = 'Version ' + entry.v;
        head.lastChild.textContent = niceDate(entry.date);
        box.appendChild(head);
        docList(box, entry.items);
    }
    function docButton(label, run, main) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'mcfo-doc__btn' + (main ? ' mcfo-doc__btn--main' : '');
        b.textContent = label;
        b.addEventListener('click', run);
        return b;
    }
    function docFoot(box, ...children) {
        const foot = document.createElement('div');
        foot.className = 'mcfo-doc__foot';
        foot.append(...children);
        (box.parentNode && box.parentNode.classList.contains('mcfo-doc') ? box.parentNode : box).appendChild(foot);
    }

    function showDocWindow(key, title, size, fill) {
        const have = windows.get(key);
        if (have && !have.lazy) { restoreWindow(key); fill(have.body); return have; }
        if (have) windows.delete(key);
        const w = makeWindow(key, title, size);
        w.el.classList.add('mcfo-win--solid');
        fill(w.body);
        drawTaskbar();
        return w;
    }

    function showHowTo() {
        showDocWindow(HOWTO_KEY, 'How to', { width: 540, height: Math.min(700, innerHeight - 80) }, body => {
            const box = docBox(body);
            const intro = document.createElement('p');
            intro.className = 'mcfo-doc__intro';
            intro.textContent = 'A short tour of what this script adds. Everything here can be switched off in Settings.';
            box.appendChild(intro);
            for (const s of howToSections()) {
                const h = document.createElement('h3');
                h.textContent = s.title;
                box.appendChild(h);
                docList(box, s.items);
            }
            docFoot(box, docButton('Changelog', showChangelog), docButton('Settings', showSettings, true));
        });
    }

    function showChangelog() {
        showDocWindow(CHANGELOG_KEY, 'Changelog', { width: 520, height: Math.min(700, innerHeight - 80) }, body => {
            const box = docBox(body);
            for (const entry of CHANGELOG) docVersion(box, entry);
            docFoot(box, docButton('How to', showHowTo));
        });
    }

    function readSeen() { try { return localStorage.getItem(WHATSNEW_SEEN); } catch (e) { return null; } }

    // At start-up: only if this version's news have not been dismissed for good.
    function maybeShowWhatsNew() {
        const seen = readSeen();
        if (seen && cmpVersion(seen, SCRIPT_VERSION) >= 0) return;
        showWhatsNew();
    }

    function showWhatsNew() {
        const height = Math.min(560, innerHeight - 80);
        const w = showDocWindow(WHATSNEW_KEY, 'What’s new', { width: 480, height }, renderWhatsNew);
        // In the middle, unless it was put somewhere else before.
        if (w && w.el && !Number.isFinite((loadWinState()[WHATSNEW_KEY] || {}).left)) {
            clampWindow(w.el, Math.round((innerWidth - 480) / 2), 90, 480, height);
        }
    }

    function renderWhatsNew(body) {
        const box = docBox(body);
        const seen = readSeen();
        // Everything newer than the version last dismissed; after a fresh install, this version.
        const news = seen ? CHANGELOG.filter(e => cmpVersion(e.v, seen) > 0 && cmpVersion(e.v, SCRIPT_VERSION) <= 0) : [];
        const list = news.length ? news : [CHANGELOG[0]];
        const intro = document.createElement('p');
        intro.className = 'mcfo-doc__intro';
        intro.textContent = list.length > 1 ? `New since version ${seen}:`
                          : seen ? 'New in this version:' : 'Welcome! New in this version — and How to has a short tour of everything else:';
        box.appendChild(intro);
        for (const entry of list) docVersion(box, entry);

        const check = document.createElement('label');
        check.className = 'mcfo-doc__check';
        check.innerHTML = '<input type="checkbox"><span>Don’t show this again</span>';
        const input = check.querySelector('input');
        // Ticked from the start (6.4): once read is enough for most people, so this version counts
        // as seen as soon as the window shows. Whoever wants it back on every load unticks it.
        // Unticked: back to what was stored before, so skipped versions are not lost.
        const before = seen === SCRIPT_VERSION ? null : seen;
        input.checked = true;
        try { localStorage.setItem(WHATSNEW_SEEN, SCRIPT_VERSION); } catch (e) {}
        input.addEventListener('change', () => {
            try {
                if (input.checked) localStorage.setItem(WHATSNEW_SEEN, SCRIPT_VERSION);
                else if (before) localStorage.setItem(WHATSNEW_SEEN, before);
                else localStorage.removeItem(WHATSNEW_SEEN);
            } catch (e) {}
        });
        docFoot(box, check, docButton('Changelog', showChangelog), docButton('How to', showHowTo),
                docButton('Got it', () => closeWindow(WHATSNEW_KEY), true));
    }

    // Two levels since 4.0: an overview with one tile per page, and the page itself. One long
    // scroll through every switch had grown to eight chapters — finding one meant reading all.
    // The page you are on is kept while the window lives; a fresh load starts at the overview.
    let settingsView = null;      // null = overview, otherwise a section title
    let settingsRedraw = null;    // redraws whatever is showing (for switches other switches need)

    function renderSettings(body) {
        const box = document.createElement('div');
        box.className = 'mcfo-set';
        const section = settingsView && SETTINGS_SECTIONS.find(x => x.title === settingsView);
        if (!section) settingsView = null;
        box.setAttribute('data-view', settingsView || '');
        settingsRedraw = () => renderSettings(body);
        if (section) settingsPage(box, body, section); else settingsOverview(box, body);

        // Keep the scroll position when redrawing the same page, or every switch that greys
        // others would jump back to the top. A different page starts at the top.
        const alt = body.querySelector('.mcfo-set');
        const same = alt && alt.getAttribute('data-view') === box.getAttribute('data-view');
        body.replaceChildren(box);
        if (same) box.scrollTop = alt.scrollTop;
    }

    function settingsOverview(box, body) {
        themeView = null;   // the Theme page opens on its landing page again
        const intro = document.createElement('div');
        intro.className = 'mcfo-set__intro';
        intro.textContent = 'Pick a part of the page. Every switch works at once, nothing needs saving.';
        box.appendChild(intro);

        const tiles = document.createElement('div');
        tiles.className = 'mcfo-set__tiles';
        for (const section of SETTINGS_SECTIONS) {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'mcfo-set__tile';
            b.innerHTML = '<span class="mcfo-set__tile-title"></span><span class="mcfo-set__tile-blurb"></span>'
                        + '<span class="mcfo-set__tile-state"></span><span class="mcfo-set__tile-arrow" aria-hidden="true">\u203A</span>';
            b.querySelector('.mcfo-set__tile-title').textContent = section.title;
            b.querySelector('.mcfo-set__tile-blurb').textContent = section.blurb || '';
            const st = sectionState(section);
            const stEl = b.querySelector('.mcfo-set__tile-state');
            stEl.textContent = st.text;
            stEl.toggleAttribute('data-none', st.none);
            b.addEventListener('click', () => { settingsView = section.title; renderSettings(body); });
            tiles.appendChild(b);
        }
        box.appendChild(tiles);
        box.appendChild(settingsFoot('Reset all', () => Object.assign(settings, settingDefaults), body));
    }

    // What a tile says about its page: how many of its switches are on, or the chosen level.
    function sectionState(section) {
        if (section.render === 'theme') {
            const t = THEMES.find(x => x.id === settings.themeId) || THEMES[0];
            return { text: 'Theme: ' + t.label, none: t.id === 'original' };
        }
        if (section.render === 'performance') {
            const level = PERF_LEVELS.find(l => l.id === settings.perfLevel) || PERF_LEVELS[0];
            const g = graphicsState();
            return { text: 'Level: ' + level.label + (g ? ' \u00b7 Graphics: ' + g.label(g.mode) : ''),
                     none: level.id === 'off' && (!g || g.mode === 'auto') };
        }
        if (section.render === 'sound') {
            const s = soundState();
            if (!s) return { text: 'Not loaded yet', none: true };
            const chosen = musicFind(music.id);
            const musicText = settings.musicPlayer
                ? (musicIsPlaying() && chosen ? 'Playing: ' + chosen.title : 'Player on')
                : `Music ${s.music ? 'on' : 'off'}`;
            return { text: `Effects ${s.sfx ? 'on' : 'off'} \u00b7 ${musicText}`,
                     none: !s.sfx && !s.music && !settings.musicPlayer };
        }
        const items = sectionItems(section);
        const on = items.filter(i => settings[i.key] && (!i.needs || settings[i.needs])).length;
        return { text: `${on} of ${items.length} on`, none: on === 0 };
    }

    function sectionKeys(section) {
        if (section.render === 'theme') return ['themeId', 'themeHue', 'themeTint', 'themeAccent', 'themeGradient', 'themePattern', 'themeRandom', 'themeRotate', 'themeFx', 'boardClear'];
        if (section.render === 'performance') return ['perfLevel', 'perfFpsMeter', ...PERF_LEVERS.map(l => l.key)];
        // The game keeps its own sound (11c); only the player's own settings are ours (11e).
        if (section.render === 'sound') return ['musicPlayer', 'musicBar', 'musicShuffle', 'musicVolume'];
        const keys = [];
        for (const item of sectionItems(section)) { keys.push(item.key); for (const sub of itemSubs(item)) if (sub.key) keys.push(sub.key); }
        if (section.throne) keys.push('throneDrinkSet');
        return keys;
    }

    function settingsPage(box, body, section) {
        const crumb = document.createElement('div');
        crumb.className = 'mcfo-set__crumb';
        const back = document.createElement('button');
        back.type = 'button';
        back.className = 'mcfo-set__back';
        back.textContent = '\u2039 All settings';
        back.addEventListener('click', () => { settingsView = null; renderSettings(body); });
        const title = document.createElement('span');
        title.className = 'mcfo-set__crumb-title';
        title.textContent = section.title;
        crumb.append(back, title);
        box.appendChild(crumb);

        if (section.render === 'performance') {
            box.appendChild(performanceCard(() => renderSettings(body)));
            const gt = document.createElement('div');
            gt.className = 'mcfo-set__sub-title';
            gt.textContent = 'The game\'s own graphics';
            box.append(gt, graphicsCard(() => renderSettings(body)));
        } else if (section.render === 'theme') {
            box.appendChild(themeCard(() => renderSettings(body)));
        } else if (section.render === 'sound') {
            box.appendChild(soundCard(() => renderSettings(body)));
        } else {
            // On the throne page the cost warning stands right above Pour beverages, not above the
            // toll switches, which cost nothing: the items are split into two cards around it.
            let card = document.createElement('div');
            card.className = 'mcfo-set__card';
            for (const item of section.items) {
                if (section.throne && item.key === 'throneDrinks') {
                    if (card.children.length) box.appendChild(card);
                    box.appendChild(throneNotice());
                    card = document.createElement('div');
                    card.className = 'mcfo-set__card';
                }
                card.appendChild(settingItem(item));
            }
            box.appendChild(card);
            if (section.throne) box.appendChild(throneDrinksCard());

            for (const group of section.groups || []) {
                const sub = document.createElement('div');
                sub.className = 'mcfo-set__sub-title';
                sub.textContent = group.title;
                box.appendChild(sub);
                if (group.note) {
                    const note = document.createElement('div');
                    note.className = 'mcfo-set__subnote';
                    note.textContent = group.note;
                    box.appendChild(note);
                }
                const gcard = document.createElement('div');
                gcard.className = 'mcfo-set__card';
                for (const item of group.items) gcard.appendChild(settingItem(item));
                box.appendChild(gcard);
            }
            if (section.grid) {
                const sub = document.createElement('div');
                sub.className = 'mcfo-set__sub-title';
                sub.textContent = section.grid.title;
                box.appendChild(sub);
                const grid = document.createElement('div');
                grid.className = 'mcfo-set__card mcfo-set__grid';
                for (const item of section.grid.items) grid.appendChild(settingItem(item));
                box.appendChild(grid);
            }
            if (section.extra) {
                const sub = document.createElement('div');
                sub.className = 'mcfo-set__section';
                sub.textContent = section.extra.title;
                box.appendChild(sub);
                if (section.title === 'Chat' && chatSlimPresent()) {
                    const note = document.createElement('div');
                    note.className = 'mcfo-set__notice';
                    note.textContent = 'The separate chat script (Chat Slim / Chat Pro Customizer) is still installed. '
                        + 'Everything it did is part of this script now — remove it in Tampermonkey and reload. '
                        + 'Until then the enhanced chat here stays idle, so the two do not work against each other.';
                    box.appendChild(note);
                }
                const card2 = document.createElement('div');
                card2.className = 'mcfo-set__card';
                for (const item of section.extra.items) card2.appendChild(settingItem(item));
                box.appendChild(card2);
            }
        }
        box.appendChild(settingsFoot('Reset this page', () => {
            if (section.render === 'sound') {
                soundOff();                      // the default there: both off
                musicPause();
                settings.musicExcluded = [];     // a new array, never the one behind the defaults
                music.queue = [];
            }
            for (const k of sectionKeys(section)) settings[k] = settingDefaults[k];
        }, body));
    }

    function settingsFoot(label, reset, body) {
        const foot = document.createElement('div');
        foot.className = 'mcfo-set__foot';
        foot.innerHTML = '<span>Changes apply at once and are saved in this browser.</span><button type="button"></button>';
        const b = foot.querySelector('button');
        b.textContent = label;
        b.addEventListener('click', () => { reset(); saveSettings(); apply(); renderSettings(body); });
        return foot;
    }

    // The level picker on top, the levers below. The levers always show what is in effect; on a
    // fixed level they show that level's mix, and touching one turns it into Custom, starting
    // from exactly what was on screen — so "Light, but with the crown turning" is one click.
    function performanceCard(redraw) {
        const card = document.createElement('div');
        card.className = 'mcfo-set__card';

        const top = document.createElement('div');
        top.className = 'mcfo-perf__top';
        const seg = document.createElement('div');
        seg.className = 'mcfo-seg mcfo-perf__levels';
        for (const level of PERF_LEVELS) {
            const b = document.createElement('button');
            b.type = 'button';
            b.textContent = level.label;
            b.setAttribute('aria-pressed', settings.perfLevel === level.id ? 'true' : 'false');
            b.addEventListener('click', () => {
                if (settings.perfLevel === level.id) return;
                if (level.id === 'custom') adoptLevelAsCustom();
                settings.perfLevel = level.id;
                saveSettings(); apply(); redraw();
            });
            seg.appendChild(b);
        }
        const text = document.createElement('div');
        text.className = 'mcfo-perf__text';
        text.textContent = (PERF_LEVELS.find(l => l.id === settings.perfLevel) || PERF_LEVELS[0]).text;
        top.append(seg, text);
        card.appendChild(top);

        const levers = document.createElement('div');
        levers.className = 'mcfo-perf__levers';
        for (const lever of PERF_LEVERS) {
            levers.appendChild(lever.type === 'choice'
                ? perfChoiceItem(lever, redraw)
                : perfSwitchItem(lever, redraw));
        }
        // Not part of any level: a measuring tool, not a saving.
        levers.appendChild(plainSwitchItem({ key: 'perfFpsMeter', label: 'Show frame rate',
            hint: 'A small counter in the chat header, to compare the levels on your own machine.' }));
        card.appendChild(levers);
        return card;
    }

