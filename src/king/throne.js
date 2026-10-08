    // =========================================================================================
    // 7c. ON THE THRONE: BEVERAGES BY THEMSELVES (opt-in, 6.19; the toll part left in 6.34.1)
    // =========================================================================================
    // The moment you take the crown, the beverages picked in the settings are poured without a
    // click. Nothing is assembled here: every beverage goes through the game's own button
    // (nativeBeverageButton, section 7), so every guard the game has keeps applying: beverages
    // unlock 15 s into a reign, the balance, once per beverage, size and currency per reign.
    // Setting the toll on capture was part of this until 6.34.1; since game v0.10.1f the game's
    // Default Toll (Inventory) does that itself, and a second setter would only fight it.
    //
    // When: on the change to King (the bid area's toll mode, the script-wide King signal), and
    // once per reign. The reign is told apart by king.capturedAtMs from the snapshot, kept in
    // localStorage and written BEFORE anything is pressed: a reload in the middle of a reign must
    // never pour a second time. A reign older than THRONE_FRESH_MS was not "just taken" and is
    // left alone, and so is one the snapshot cannot name: without knowing the reign, nothing is
    // bought. Switching the feature on while already King does nothing until the next reign, so
    // a click in the settings never spends anything by itself.
    const THRONE_DONE_KEY = 'mcfo_throne_done';
    const THRONE_FRESH_MS = 3 * 60 * 1000;
    const THRONE_UNLOCK_MS = 15000;      // the game unlocks beverages this long into a reign
    const THRONE_POUR_MS = 25000;        // how long a greyed-out beverage is tried again
    const THRONE_NOTE_MS = 15000;
    const KING_SIGNAL = '[data-role="bid-area"][data-king-toll-mode="true"]';
    const BEV_ALL_KEYS = BEVERAGES.flatMap(b => BEV_CURRENCIES.flatMap(([c]) => BEV_SIZES.map(([z]) => `${b.type}|${z}|${c}`)));
    const throne = { king: false, running: false };
    const nap = ms => new Promise(r => setTimeout(r, ms));

    function bevPrice(key) {
        const [type, size, currency] = key.split('|');
        const right = bevRights.get(key);
        if (Number.isFinite(right?.price)) return right.price;
        const bev = BEVERAGES.find(b => b.type === type);
        return bev ? bev[currency][size] : 0;
    }
    function bevName(key) {
        const [type, size, currency] = key.split('|');
        const bev = BEVERAGES.find(b => b.type === type);
        const sizeLabel = (BEV_SIZES.find(x => x[0] === size) || [0, size])[1];
        return `${bev ? bev.label : type} ${sizeLabel} (${currency === 'gold' ? 'Gold' : 'Diamond'})`;
    }

    // On the 1.5 s beat. Only the change to King counts, including the first look after a load.
    function throneTick() {
        const king = !!document.querySelector(KING_SIGNAL);
        const became = king && !throne.king;
        throne.king = king;
        if (!became || throne.running) return;
        const pour = settings.throneDrinks && settings.throneDrinkSet.length > 0;
        if (!pour) return;
        throne.running = true;
        throneRun(pour)
            .catch(e => console.warn('[MarbleLuceFall] throne actions failed:', e && e.message))
            .finally(() => { throne.running = false; });
    }

    // Right after the capture the snapshot may still name the previous reign for a moment, so
    // it is asked a few times until it shows a fresh one.
    async function readFreshReign() {
        for (let n = 0; n < 5; n++) {
            try {
                const res = await fetch('/api/king/snapshot?view=summary', { credentials: 'include', cache: 'no-store' });
                if (res.ok) {
                    const at = Number((await res.json())?.king?.capturedAtMs);
                    if (Number.isFinite(at) && at > 0 && Date.now() - at <= THRONE_FRESH_MS) return at;
                }
            } catch (e) {}
            await nap(2000);
        }
        return 0;
    }

    async function throneRun(pour) {
        const reign = await readFreshReign();
        if (!reign) return;
        let done = '';
        try { done = localStorage.getItem(THRONE_DONE_KEY) || ''; } catch (e) {}
        if (done === String(reign)) return;
        try { localStorage.setItem(THRONE_DONE_KEY, String(reign)); } catch (e) {}

        if (pour) throneNote(await throneDrinks(reign, settings.throneDrinkSet.slice()));
    }

    async function throneDrinks(reign, wanted) {
        const wait = reign + THRONE_UNLOCK_MS + 500 - Date.now();
        if (wait > 0) await nap(wait);
        if (!await loadBevRights()) return ['Beverages not poured: the game did not say which ones are still available'];
        const todo = wanted.filter(k => bevRights.get(k)?.state === 'available');
        const already = wanted.length - todo.length;
        const pressed = [];
        const native = key => nativeBeverageButton(...key.split('|'));

        // One at a time, each looked up again: the game may redraw or close its panel after a
        // purchase. A button that stays grey (not enough gold or diamonds) is given up on after
        // THRONE_POUR_MS.
        let opened = false;
        const until = Date.now() + THRONE_POUR_MS;
        while (todo.length && Date.now() < until) {
            let any = false;
            for (const key of todo.slice()) {
                const button = native(key);
                if (!nativeEnabled(button)) continue;
                forwardClick(button);
                pressed.push(key);
                todo.splice(todo.indexOf(key), 1);
                any = true;
                await nap(700);
            }
            if (!todo.length) break;
            const toggle = role('beverages-toggle');
            if (toggle && toggle.getAttribute('aria-expanded') !== 'true' && !todo.some(native)) {
                // The panel is not mounted: opened the way a person would, closed again below.
                forwardClick(toggle);
                opened = true;
                await nap(400);
            } else if (!any) await nap(800);
        }
        if (opened) {
            const toggle = role('beverages-toggle');
            if (toggle && toggle.getAttribute('aria-expanded') === 'true') forwardClick(toggle);
        }

        // Pressed is not bought: the game's answer counts, read back a moment later.
        await nap(2000);
        const read = await loadBevRights();
        refreshBevPanel();
        const bought = read ? pressed.filter(k => bevRights.get(k)?.state !== 'available') : pressed;
        const refused = pressed.filter(k => !bought.includes(k));
        const lines = [];
        if (bought.length) lines.push('Poured: ' + bought.map(bevName).join(', '));
        if (refused.length) lines.push('The game refused: ' + refused.map(bevName).join(', '));
        if (todo.length) lines.push('Not poured, the button stayed grey (not enough gold or diamonds?): ' + todo.map(bevName).join(', '));
        if (already) lines.push(already === 1 ? '1 was already bought this reign' : `${already} were already bought this reign`);
        return lines;
    }

    // What was done, on screen for a while (a click closes it). Toll and beverages finish at
    // different times, so the second adds to the note the first opened.
    let throneNoteTimer = 0;
    function throneNote(lines) {
        if (!lines.length) return;
        console.log('[MarbleLuceFall] on the throne:', lines.join(' | '));
        let note = document.querySelector('.mcfo-throne-note');
        if (!note) {
            note = document.createElement('div');
            note.className = 'mcfo-throne-note';
            const head = document.createElement('b');
            head.textContent = 'On the throne';
            note.appendChild(head);
            note.addEventListener('click', () => note.remove());
            document.body.appendChild(note);
        }
        for (const line of lines) {
            const row = document.createElement('div');
            row.textContent = line;
            note.appendChild(row);
        }
        clearTimeout(throneNoteTimer);
        throneNoteTimer = setTimeout(() => note.remove(), THRONE_NOTE_MS);
    }

    // The settings: what costs what, and a note that nothing of it comes back.
    function throneNotice() {
        const note = document.createElement('div');
        note.className = 'mcfo-set__notice';
        note.textContent = 'Beverages cost gold or diamonds the moment they are poured, and that cannot be undone: '
            + 'no refund, no confirm step. Whatever is picked here is bought by itself every time you take the throne, until you switch it off.';
        return note;
    }

    function throneDrinksCard() {
        const card = document.createElement('div');
        card.className = 'mcfo-set__card mcfo-throne';
        card.toggleAttribute('data-off', !settings.throneDrinks);

        const head = document.createElement('div');
        head.className = 'mcfo-throne__head';
        const title = document.createElement('span');
        title.className = 'mcfo-throne__title';
        title.textContent = 'Beverages to pour';
        const quick = document.createElement('div');
        quick.className = 'mcfo-throne__quick';
        head.append(title, quick);
        card.appendChild(head);

        const picks = [];
        const sum = document.createElement('div');
        sum.className = 'mcfo-throne__sum';
        const redraw = () => {
            const set = new Set(settings.throneDrinkSet);
            for (const b of picks) b.setAttribute('aria-pressed', set.has(b._mcfoKey) ? 'true' : 'false');
            const gold = settings.throneDrinkSet.filter(k => k.endsWith('|gold')).reduce((t, k) => t + bevPrice(k), 0);
            const dia = settings.throneDrinkSet.filter(k => k.endsWith('|diamonds')).reduce((t, k) => t + bevPrice(k), 0);
            const n = settings.throneDrinkSet.length;
            sum.innerHTML = n
                ? `<b>${n}</b> of ${BEV_ALL_KEYS.length} picked: <b>${number(gold)}</b> gold and <b>${number(dia)}</b> diamonds, every reign.`
                : 'Nothing picked yet.';
        };
        // Always a new array in catalogue order: the default ([]) is never changed in place, and
        // the beverages are poured in the order they stand here.
        const choose = keep => {
            settings.throneDrinkSet = BEV_ALL_KEYS.filter(keep);
            saveSettings();
            redraw();
        };

        for (const [text, keep] of [
            ['All gold', k => k.endsWith('|gold')],
            ['All diamonds', k => k.endsWith('|diamonds')],
            ['Everything', () => true],
            ['None', () => false],
        ]) {
            const b = document.createElement('button');
            b.type = 'button';
            b.textContent = text;
            b.addEventListener('click', () => choose(keep));
            quick.appendChild(b);
        }

        const grid = document.createElement('div');
        grid.className = 'mcfo-throne__grid';
        grid.appendChild(document.createElement('span'));
        for (const [, sizeLabel] of BEV_SIZES) {
            const col = document.createElement('span');
            col.className = 'mcfo-throne__col';
            col.textContent = sizeLabel;
            grid.appendChild(col);
        }
        for (const bev of BEVERAGES) {
            const name = document.createElement('span');
            name.className = 'mcfo-throne__name';
            name.textContent = bev.label;
            name.style.color = bev.stroke === '#ffffff' ? '#e8e2c8' : bev.stroke;
            grid.appendChild(name);
            for (const [size, sizeLabel] of BEV_SIZES) {
                const cell = document.createElement('div');
                cell.className = 'mcfo-throne__cell';
                for (const [currency, currencyLabel] of BEV_CURRENCIES) {
                    const key = `${bev.type}|${size}|${currency}`;
                    const b = document.createElement('button');
                    b.type = 'button';
                    b.className = 'mcfo-throne__pick';
                    b.setAttribute('data-cur', currency);
                    b._mcfoKey = key;
                    b.innerHTML = `<i class="mcfo-throne__${currency === 'gold' ? 'coin' : 'gem'}" aria-hidden="true"></i><span></span>`;
                    b.lastChild.textContent = number(bevPrice(key));
                    b.title = `${bev.label} ${sizeLabel} for ${number(bevPrice(key))} ${currencyLabel}`;
                    b.addEventListener('click', () => {
                        const set = new Set(settings.throneDrinkSet);
                        if (set.has(key)) set.delete(key); else set.add(key);
                        choose(k => set.has(k));
                    });
                    picks.push(b);
                    cell.appendChild(b);
                }
                grid.appendChild(cell);
            }
        }
        card.append(grid, sum);
        redraw();
        return card;
    }

