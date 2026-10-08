    // =========================================================================================
    // 11d. GRAPHICS: THE GAME'S OWN QUALITY LEVELS, FROM THE SETTINGS (6.21)
    // =========================================================================================
    // Game build v0.10.0b added a quality picker of its own (graphicsQuality.js): auto, high,
    // balanced, low, minimal. It decides how sharply the board is drawn and whether marble trails
    // and the king wall shadow are drawn at all, and it changes nothing about the game itself.
    // It sits in the same panel as the sound controls, behind the header button the gear replaces
    // — with the gear on, that panel is hidden and the picker cannot be reached.
    //
    // Like the sound page (11c) this keeps no second copy. The game listens for a change event on
    // anything matching [data-role="graphics-mode"] anywhere on the page, and it redraws every
    // copy of the control from its own state afterwards. Setting the value on its own select and
    // letting the event bubble is therefore exactly the path its own picker takes, storage in
    // localStorage included. Hidden by display:none changes none of that: events do not care
    // whether an element is drawn.
    //
    // The level names and the sentence under them are read off the game's own control, so a build
    // that renames a level or explains it differently says so here without a change.
    const graphicsSelect = () => soundEl('graphics-mode');

    function graphicsState() {
        const sel = graphicsSelect();
        if (!sel || !sel.options || !sel.options.length) return null;
        const opts = [...sel.options];
        return {
            mode: sel.value,
            modes: opts.map(o => o.value),
            label: m => { const o = opts.find(x => x.value === m); return o ? o.textContent.trim() : m; },
            text: ((soundEl('graphics-mode-description') || {}).textContent || '').trim(),
        };
    }

    function chooseGraphicsMode(mode) {
        const sel = graphicsSelect();
        if (!sel || sel.value === mode) return;
        sel.value = mode;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function graphicsCard(redraw) {
        const card = document.createElement('div');
        card.className = 'mcfo-set__card';
        const g = graphicsState();
        if (!g) {
            const note = document.createElement('div');
            note.className = 'mcfo-set__notice';
            note.textContent = 'The game has not drawn its graphics control yet. Open this page again in a moment.';
            card.appendChild(note);
            return card;
        }
        const top = document.createElement('div');
        top.className = 'mcfo-perf__top';
        const seg = document.createElement('div');
        seg.className = 'mcfo-seg mcfo-perf__levels';
        for (const mode of g.modes) {
            const b = document.createElement('button');
            b.type = 'button';
            b.textContent = g.label(mode);
            b.setAttribute('aria-pressed', g.mode === mode ? 'true' : 'false');
            // The game writes the new description into its own control first; read it back after.
            b.addEventListener('click', () => { chooseGraphicsMode(mode); redraw(); });
            seg.appendChild(b);
        }
        const text = document.createElement('div');
        text.className = 'mcfo-perf__text';
        text.textContent = g.text;
        top.append(seg, text);
        card.appendChild(top);
        return card;
    }

