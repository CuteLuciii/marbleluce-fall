    // =========================================================================================
    // 11c. SOUND: THE GAME'S OWN CONTROLS, FROM THE SETTINGS (6.14)
    // =========================================================================================
    // The game's sound sits behind the speaker button top right (app.js soundControlDom): effects
    // on/off and volume, music on/off, volume and next track. The game keeps the state itself
    // (m39.sound.* in localStorage, soundRuntime.js) and redraws every copy of these controls from
    // it (syncSoundControls). The Sound page keeps no second copy: it reads the game's controls and
    // works them — a click on a button, a value and an input event on a slider, which is exactly
    // what the game listens for (one click and one input listener on its root). So the game's own
    // rules stay in force, like a volume above 0 switching the effects back on.
    const soundEl = r => document.querySelector(`[data-role="sound-utility-panel"] [data-role="${r}"]`)
        || document.querySelector(`[data-role="${r}"]`);
    function soundState() {
        const mute = soundEl('sound-mute-toggle'), music = soundEl('music-enabled-toggle');
        if (!mute || !music) return null;
        const next = soundEl('music-next-track');
        const hint = soundEl('sound-status-hint');
        return {
            sfx: mute.getAttribute('aria-pressed') !== 'true',   // pressed = muted
            sfxVol: Number((soundEl('sound-volume-range') || {}).value) || 0,
            music: music.getAttribute('aria-pressed') === 'true',
            musicVol: Number((soundEl('music-volume-range') || {}).value) || 0,
            track: ((soundEl('music-track-label') || {}).textContent || '').trim(),
            nextOk: !!next && !next.disabled,
            locked: !!hint && hint.style.display !== 'none',
        };
    }
    function soundClick(r) { const b = soundEl(r); if (b) b.click(); }
    function soundSlide(r, v) {
        const el = soundEl(r);
        if (!el) return;
        el.value = String(v);
        el.dispatchEvent(new Event('input', { bubbles: true }));
    }
    function soundOff() {
        const s = soundState();
        if (!s) return;
        if (s.sfx) soundClick('sound-mute-toggle');
        if (s.music) soundClick('music-enabled-toggle');
    }

    // Off unless turned on: once, the game's effects and music are switched off with its own
    // buttons — tried on every beat until its controls answer. From then on the game's own memory
    // holds whatever is chosen on the Sound page. The mark is a key of its own: the settings object
    // only keeps the keys it knows, and a lost mark would switch the sound off on every load.
    const SOUND_DEFAULTED_KEY = 'mcfo_sound_defaulted';
    function soundDefaultOnce() {
        try { if (localStorage.getItem(SOUND_DEFAULTED_KEY) === '1') return; } catch (e) { return; }
        if (!soundState()) return;
        soundOff();
        const after = soundState();
        if (after && !after.sfx && !after.music) {
            try { localStorage.setItem(SOUND_DEFAULTED_KEY, '1'); } catch (e) {}
        }
    }

    function soundCard(redraw) {
        const card = document.createElement('div');
        card.className = 'mcfo-set__card';
        const s = soundState();
        if (!s) {
            const note = document.createElement('div');
            note.className = 'mcfo-set__notice';
            note.textContent = 'The game has not drawn its sound controls yet. Open this page again in a moment.';
            card.appendChild(note);
            return card;
        }
        card.appendChild(soundItem('Sound effects', 'Marbles, bumpers, the crown: every sound of the board.', s.sfx,
            on => { if (on !== soundState().sfx) soundClick('sound-mute-toggle'); redraw(); },
            s.sfxVol, v => soundSlide('sound-volume-range', v), redraw));
        // Our own player (11e), and under it the game's music the way it always was - but only
        // while the player is off, so there are never two sets of music controls at once.
        card.appendChild(musicItem(redraw));
        if (!settings.musicPlayer) {
            const gameMusic = soundItem('The game\'s music', 'Its own soundtrack, played straight through its own list.', s.music,
                on => { if (on !== soundState().music) soundClick('music-enabled-toggle'); redraw(); },
                s.musicVol, v => soundSlide('music-volume-range', v), redraw);
            const track = document.createElement('div');
            track.className = 'mcfo-set__sub';
            track.toggleAttribute('data-off', !s.music);
            track.innerHTML = '<span class="mcfo-set__sublabel">Track</span><span class="mcfo-sound__track"></span>'
                            + '<button type="button" class="mcfo-set__reset">Next</button>';
            track.querySelector('.mcfo-sound__track').textContent = s.track || 'No track';
            const next = track.querySelector('button');
            next.disabled = !s.nextOk;
            // The game loads the next track before it names it: redrawn a moment later.
            next.addEventListener('click', () => { soundClick('music-next-track'); setTimeout(redraw, 600); });
            gameMusic.appendChild(track);
            card.appendChild(gameMusic);
        }
        if (s.locked) {
            const note = document.createElement('div');
            note.className = 'mcfo-set__notice';
            note.textContent = 'Your browser only lets the page play sound after your first click on it.';
            card.appendChild(note);
        }
        return card;
    }

    // A switch with a volume slider under it, drawn like settingItem, but reading and writing the
    // game's controls instead of a setting.
    function soundItem(label, hint, on, setOn, volume, setVolume, redraw) {
        const wrap = document.createElement('div');
        wrap.className = 'mcfo-set__item';
        const row = document.createElement('label');
        row.className = 'mcfo-set__row';
        row.innerHTML = '<span class="mcfo-set__text"><span class="mcfo-set__label"></span>'
                      + '<span class="mcfo-set__hint"></span></span>'
                      + '<input type="checkbox" class="mcfo-switch__input">'
                      + '<span class="mcfo-switch" aria-hidden="true"></span>';
        row.querySelector('.mcfo-set__label').textContent = label;
        row.querySelector('.mcfo-set__hint').textContent = hint;
        const input = row.querySelector('input');
        input.checked = on;
        input.addEventListener('change', () => setOn(input.checked));
        wrap.appendChild(row);

        const sub = document.createElement('div');
        sub.className = 'mcfo-set__sub';
        sub.toggleAttribute('data-off', !on);
        sub.innerHTML = '<span class="mcfo-set__sublabel">Volume</span>'
                      + '<input type="range" class="mcfo-set__range" min="0" max="100" step="1"><span class="mcfo-set__val"></span>';
        const range = sub.querySelector('input');
        const val = sub.querySelector('.mcfo-set__val');
        range.value = String(volume);
        val.textContent = volume + '%';
        range.addEventListener('input', () => { val.textContent = range.value + '%'; setVolume(Number(range.value)); });
        range.addEventListener('change', redraw);
        wrap.appendChild(sub);
        return wrap;
    }

    // The gear in place of the game's sound button (CSS in section 2).
    const GEAR_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true">'
        + '<circle cx="12" cy="12" r="3.3" fill="none" stroke="currentColor" stroke-width="1.8"/>'
        + '<path d="M19.4 13.5a7.6 7.6 0 0 0 0-3l2-1.6-2-3.4-2.4.9a7.5 7.5 0 0 0-2.6-1.5L14 2.4h-4l-.4 2.5A7.5 7.5 0 0 0 7 6.4l-2.4-.9-2 3.4 2 1.6a7.6 7.6 0 0 0 0 3l-2 1.6 2 3.4 2.4-.9a7.5 7.5 0 0 0 2.6 1.5l.4 2.5h4l.4-2.5a7.5 7.5 0 0 0 2.6-1.5l2.4.9 2-3.4Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    // The gear and the music note share one cell of the header grid: profile-sound-cell is a two
    // column grid (account card | button), so a third child would drop into a new row. They go
    // into a box of their own instead.
    function buildHeaderButtons() {
        document.documentElement.setAttribute('data-mcfo-gear', settings.settingsButton ? '1' : '0');
        const cell = role('profile-sound-cell');
        const wantNote = settings.musicPlayer;
        let box = document.querySelector('.mcfo-hdr');
        if ((!settings.settingsButton && !wantNote) || !cell) { if (box) box.remove(); return; }
        if (!box || box.parentElement !== cell) {
            if (box) box.remove();
            box = document.createElement('div');
            box.className = 'mcfo-hdr';
            const native = role('sound-utility-toggle');
            if (native) native.after(box); else cell.appendChild(box);
        }

        let note = box.querySelector('.mcfo-note');
        if (wantNote && !note) {
            note = document.createElement('button');
            note.type = 'button';
            note.className = 'mcfo-note';
            note.innerHTML = NOTE_SVG;
            note.addEventListener('click', e => {
                e.preventDefault(); e.stopPropagation();
                settings.musicBar = !settings.musicBar;
                saveSettings();
                buildMusicBar();
                buildHeaderButtons();
            });
            box.prepend(note);
        } else if (!wantNote && note) {
            note.remove();
            note = null;
        }
        if (note) {
            const on = settings.musicBar;
            note.title = on ? 'Hide the player bar' : 'Show the player bar';
            note.setAttribute('aria-label', note.title);
            note.setAttribute('aria-pressed', on ? 'true' : 'false');
        }

        let gear = box.querySelector('.mcfo-gear');
        if (settings.settingsButton && !gear) {
            gear = document.createElement('button');
            gear.type = 'button';
            gear.className = 'mcfo-gear';
            gear.title = 'MarbleLuceFall settings';
            gear.setAttribute('aria-label', 'MarbleLuceFall settings');
            gear.innerHTML = GEAR_SVG;
            gear.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); showSettings(); });
            box.appendChild(gear);
        } else if (!settings.settingsButton && gear) {
            gear.remove();
        }
    }

    // The theme page: one tile per theme with its colours, and for Custom a hue and an
    // intensity slider that repaint the page while they move.
    // Two levels since 6.6: first what holds for every theme (random, rotation) and two ways in —
    // Basic, the colour themes with Custom among them, and Deluxe, the themes with a skin — then
    // the tiles of the one picked. Kept in RAM like the settings page itself.
    let themeView = null;   // null = the landing page, else 'basic' or 'deluxe'
    const themeIsDeluxe = t => !!(t && t.skin);
    const THEME_FOOT = 'The board, the chips, chat cosmetics, rarities, gold and diamonds keep their colours: they mean something.';

    function themeCard(redraw) {
        const card = document.createElement('div');
        card.className = 'mcfo-set__card mcfo-theme';
        if (!themeView) {
            card.appendChild(themeRandomBlock(redraw));
            card.appendChild(themeCategories(redraw));
            card.appendChild(themeToggle('See-through board frames', 'boardClear',
                'Removes the dark bars above and below the tiles and around the king tile, so the page background shows through.', applyBoardClear));
            const foot = document.createElement('div');
            foot.className = 'mcfo-theme__foot';
            foot.textContent = THEME_FOOT;
            card.appendChild(foot);
            return card;
        }
        const head = document.createElement('div');
        head.className = 'mcfo-theme__cathead';
        const back = document.createElement('button');
        back.type = 'button';
        back.className = 'mcfo-set__back';
        back.textContent = '\u2039 Theme';
        back.addEventListener('click', () => { themeView = null; redraw(); });
        const title = document.createElement('span');
        title.className = 'mcfo-set__crumb-title';
        title.textContent = themeView === 'deluxe' ? 'Deluxe themes' : 'Basic themes';
        head.append(back, title);
        card.appendChild(head);
        // One heading and grid per group, in the order THEMES lists them — the groups of this level.
        const groups = [...new Set(THEMES.filter(t => (themeView === 'deluxe') === themeIsDeluxe(t) && themeVisible(t)).map(t => t.group))];
        for (const group of groups) {
            const head = document.createElement('div');
            head.className = 'mcfo-theme__group';
            head.textContent = group;
            card.appendChild(head);
            const grid = document.createElement('div');
            grid.className = 'mcfo-theme__grid';
            for (const t of THEMES.filter(x => x.group === group && themeVisible(x) && (themeView === 'deluxe') === themeIsDeluxe(x))) {
                const b = document.createElement('button');
                b.type = 'button';
                b.className = 'mcfo-theme__pick';
                b.setAttribute('data-mcfo-theme-id', t.id);
                b.setAttribute('aria-pressed', settings.themeId === t.id ? 'true' : 'false');
                b.innerHTML = '<span class="mcfo-theme__swatches"></span><span class="mcfo-theme__name"></span><span class="mcfo-theme__note"></span>';
                b.querySelector('.mcfo-theme__name').textContent = t.label;
                b.querySelector('.mcfo-theme__note').textContent = t.note;
                paintSwatches(b.querySelector('.mcfo-theme__swatches'), t);
                // Deluxe themes show a piece of their skin instead of the five swatches.
                if (t.skin && SKINS[t.skin]) {
                    b.classList.add('mcfo-theme__pick--deluxe');
                    const prev = document.createElement('span');
                    prev.className = 'mcfo-theme__preview';
                    prev.style.cssText = SKINS[t.skin].tile(skinAssets(t.skin));
                    const badge = document.createElement('span');
                    badge.className = 'mcfo-theme__badge';
                    badge.textContent = 'DELUXE';
                    prev.appendChild(badge);
                    b.querySelector('.mcfo-theme__swatches').replaceWith(prev);
                }
                // Themes with a flag or gradient show it under their swatches.
                if (t.stripe) {
                    const band = document.createElement('span');
                    band.className = 'mcfo-theme__stripe';
                    band.style.background = stripeGradient(t, '90deg');
                    b.querySelector('.mcfo-theme__swatches').after(band);
                }
                b.addEventListener('click', () => {
                    if (settings.themeId === t.id) return;
                    settings.themeId = t.id;
                    saveSettings();
                    themeTick();
                    redraw();
                });
                grid.appendChild(b);
            }
            card.appendChild(grid);
        }
        // Under all Deluxe groups (Games, Film & TV, Signature) — once, not per group.
        if (themeView === 'deluxe') card.appendChild(themeFxBlock());

        if (themeView === 'basic' && settings.themeId === 'custom') {
            const custom = document.createElement('div');
            custom.className = 'mcfo-theme__custom';
            custom.appendChild(themeSlider('Hue', 'themeHue', 0, 359, '°', true, card));
            custom.appendChild(themeSlider('Accent', 'themeAccent', 0, 359, '°', true, card));
            custom.appendChild(themeSlider('Intensity', 'themeTint', 0, 200, '%', false, card));
            const hint = document.createElement('div');
            hint.className = 'mcfo-theme__hint';
            hint.textContent = 'Hue colours the surfaces, borders and text. Accent colours buttons, lit borders and highlights, '
                             + 'and with a gradient or a pattern it is the gradient’s second colour and the colour of the pattern.';
            custom.appendChild(hint);
            custom.appendChild(themeToggle('Gradient', 'themeGradient',
                'A band along the edges and a dark wash from hue to accent, like the flag themes.'));
            custom.appendChild(themePatternPicker());
            card.appendChild(custom);
        }
        const foot = document.createElement('div');
        foot.className = 'mcfo-theme__foot';
        foot.textContent = THEME_FOOT;
        card.appendChild(foot);
        return card;
    }

    // The two ways in, as tiles like those of the settings overview, each with a glimpse of what
    // is inside: the theme in use if it is there, else a sample.
    function themeCategories(redraw) {
        const tiles = document.createElement('div');
        tiles.className = 'mcfo-set__tiles mcfo-theme__cats';
        const current = THEMES.find(t => t.id === settings.themeId) || THEMES[0];
        const cats = [
            { id: 'basic', title: 'Basic themes', blurb: 'Colour for the whole page: classics, pride flags, moods, games, editor themes — or your own.' },
            { id: 'deluxe', title: 'Deluxe themes', blurb: 'Textures, scenery and effects over the whole frame of the page.' },
        ];
        for (const cat of cats) {
            const list = THEMES.filter(t => (cat.id === 'deluxe') === themeIsDeluxe(t) && themeVisible(t));
            const inUse = (cat.id === 'deluxe') === themeIsDeluxe(current);
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'mcfo-set__tile';
            b.setAttribute('data-mcfo-theme-cat', cat.id);
            b.innerHTML = '<span class="mcfo-theme__catprev"></span><span class="mcfo-set__tile-title"></span><span class="mcfo-set__tile-blurb"></span>'
                        + '<span class="mcfo-set__tile-state"></span><span class="mcfo-set__tile-arrow" aria-hidden="true">\u203A</span>';
            b.querySelector('.mcfo-set__tile-title').textContent = cat.title;
            b.querySelector('.mcfo-set__tile-blurb').textContent = cat.blurb;
            const st = b.querySelector('.mcfo-set__tile-state');
            st.textContent = `${list.length} themes` + (inUse ? ` · in use: ${current.label}` : '');
            st.toggleAttribute('data-none', !inUse);
            const sample = inUse ? current : (cat.id === 'deluxe' ? list[0] : THEMES.find(t => t.id === 'midnight') || list[0]);
            const prev = b.querySelector('.mcfo-theme__catprev');
            if (sample && sample.skin && SKINS[sample.skin]) prev.style.cssText = SKINS[sample.skin].tile(skinAssets(sample.skin));
            else if (sample) { prev.classList.add('mcfo-theme__swatches'); paintSwatches(prev, sample); }
            b.addEventListener('click', () => { themeView = cat.id; redraw(); });
            tiles.appendChild(b);
        }
        return tiles;
    }

    // How much a Deluxe theme may move, right under its tiles. The note says so when a
    // performance level holds it lower than chosen.
    function themeFxBlock() {
        const box = document.createElement('div');
        box.className = 'mcfo-theme__fx';
        const row = document.createElement('div');
        row.className = 'mcfo-theme__rotate';
        const label = document.createElement('span');
        label.className = 'mcfo-theme__toggle-label';
        label.textContent = 'Deluxe effects';
        const seg = document.createElement('div');
        seg.className = 'mcfo-seg';
        const hint = document.createElement('div');
        hint.className = 'mcfo-theme__hint';
        const writeHint = () => {
            const eff = skinFxEffective();
            const name = v => (THEME_FX_OPTIONS.find(o => o[0] === v) || [v, v])[1];
            hint.textContent = 'Full: particles and moving backgrounds. Subtle: only a glow here and there. Off: a still picture.'
                + (eff !== settings.themeFx ? ` Held at ${name(eff)} right now by the performance level or your system’s reduce-motion setting.` : '');
        };
        for (const [value, text] of THEME_FX_OPTIONS) {
            const b = document.createElement('button');
            b.type = 'button';
            b.textContent = text;
            b.setAttribute('data-mcfo-fx-choice', value);
            b.setAttribute('aria-pressed', settings.themeFx === value ? 'true' : 'false');
            b.addEventListener('click', () => {
                settings.themeFx = value;
                saveSettings();
                skinTick();
                for (const o of seg.children) o.setAttribute('aria-pressed', o === b ? 'true' : 'false');
                writeHint();
            });
            seg.appendChild(b);
        }
        writeHint();
        row.append(label, seg);
        box.append(row, hint);
        return box;
    }

    // Random on load, the rotation timer and a button to shuffle at once — above the tiles.
    function themeRandomBlock(redraw) {
        const box = document.createElement('div');
        box.className = 'mcfo-theme__random';
        box.appendChild(themeToggle('Random theme', 'themeRandom',
            'A different theme every time the page opens or reloads. Crownfall and Custom are left out.',
            () => { scheduleThemeRotation(); redraw(); }));
        const row = document.createElement('div');
        row.className = 'mcfo-theme__rotate';
        row.toggleAttribute('data-off', !settings.themeRandom);
        const label = document.createElement('span');
        label.className = 'mcfo-theme__toggle-label';
        label.textContent = 'Change every';
        const seg = document.createElement('div');
        seg.className = 'mcfo-seg';
        for (const [value, text] of THEME_ROTATE_OPTIONS) {
            const b = document.createElement('button');
            b.type = 'button';
            b.textContent = text;
            b.disabled = !settings.themeRandom;
            b.setAttribute('aria-pressed', settings.themeRotate === value ? 'true' : 'false');
            b.addEventListener('click', () => {
                settings.themeRotate = value;
                saveSettings();
                scheduleThemeRotation();
                for (const o of seg.children) o.setAttribute('aria-pressed', o === b ? 'true' : 'false');
            });
            seg.appendChild(b);
        }
        row.append(label, seg);
        const shuffle = document.createElement('button');
        shuffle.type = 'button';
        shuffle.className = 'mcfo-theme__shuffle';
        shuffle.textContent = 'Shuffle now';
        shuffle.title = 'Pick a random theme right away';
        shuffle.addEventListener('click', () => randomTheme());
        box.append(row, shuffle);
        return box;
    }

    // A switch on the theme page (Custom's gradient, Random). after runs once the change is in.
    function themeToggle(label, key, hint, after) {
        const row = document.createElement('label');
        row.className = 'mcfo-theme__toggle';
        row.innerHTML = '<span><span class="mcfo-theme__toggle-label"></span><small></small></span>'
                      + '<input type="checkbox" class="mcfo-switch__input"><span class="mcfo-switch" aria-hidden="true"></span>';
        row.querySelector('.mcfo-theme__toggle-label').textContent = label;
        row.querySelector('small').textContent = hint;
        const input = row.querySelector('input');
        input.checked = !!settings[key];
        input.addEventListener('change', () => { settings[key] = input.checked; saveSettings(); themeTick(); if (after) after(); });
        return row;
    }

    function applyBoardClear() {
        document.documentElement.setAttribute('data-mcfo-boardclear', settings.boardClear ? '1' : '0');
    }

    // Custom's pattern: one small tile per pattern, drawn in Custom's own colours.
    function themePatternPicker() {
        const box = document.createElement('div');
        const head = document.createElement('div');
        head.className = 'mcfo-theme__toggle-label';
        head.textContent = 'Pattern';
        const grid = document.createElement('div');
        grid.className = 'mcfo-theme__patgrid';
        for (const id of THEME_PATTERN_IDS) {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'mcfo-theme__pat';
            b.setAttribute('data-mcfo-pattern', id);
            b.setAttribute('aria-pressed', settings.themePattern === id ? 'true' : 'false');
            const sw = document.createElement('span');
            sw.className = 'mcfo-theme__patsw';
            paintPattern(sw, id);
            const name = document.createElement('span');
            name.textContent = id === 'none' ? 'None' : THEME_PATTERNS[id].label;
            b.append(sw, name);
            b.addEventListener('click', () => {
                settings.themePattern = id;
                saveSettings();
                themeTick();
                for (const o of grid.children) o.setAttribute('aria-pressed', o === b ? 'true' : 'false');
            });
            grid.appendChild(b);
        }
        box.append(head, grid);
        return box;
    }

    function paintPattern(el, id) {
        const t = normTheme(THEMES.find(x => x.id === 'custom'));
        const p = THEME_PATTERNS[id];
        const layers = p ? p.layers(t.decorTint) : [];
        el.style.backgroundColor = mapColour('#111c27', t);
        el.style.backgroundImage = layers.length ? layers.map(l => l[0]).join(', ') : 'none';
        el.style.backgroundSize = layers.length ? layers.map(l => l[1]).join(', ') : 'auto';
    }

    function paintSwatches(box, t) {
        const colours = themeSwatches(t);
        while (box.children.length < colours.length) box.appendChild(document.createElement('span'));
        colours.forEach((c, i) => { box.children[i].style.background = c; });
    }

    function themeSlider(label, key, min, max, unit, isHue, grid) {
        const row = document.createElement('label');
        row.className = 'mcfo-theme__slider';
        row.innerHTML = '<span></span><input type="range"><output></output>';
        row.firstChild.textContent = label;
        const input = row.querySelector('input');
        const out = row.querySelector('output');
        input.className = 'mcfo-theme__range' + (isHue ? ' mcfo-theme__range--hue' : '');
        input.min = String(min);
        input.max = String(max);
        input.step = '1';
        input.value = String(settings[key]);
        // The hue track shows the hues themselves, at a medium lightness and chroma.
        if (isHue) {
            const stops = [];
            for (let h = 0; h <= 360; h += 30) stops.push(`rgb(${fromOklch(0.7, 0.13, h).join(', ')})`);
            input.style.background = `linear-gradient(to right, ${stops.join(', ')})`;
        }
        out.textContent = settings[key] + unit;
        let pending = false;
        input.addEventListener('input', () => {
            settings[key] = Number(input.value);
            out.textContent = input.value + unit;
            if (pending) return;
            pending = true;
            // Repainting the whole page on every pixel of a drag is wasted work: once per 30 ms.
            setTimeout(() => {
                pending = false;
                themeTick();
                const sw = grid.querySelector('[data-mcfo-theme-id="custom"] .mcfo-theme__swatches');
                if (sw) paintSwatches(sw, THEMES.find(t => t.id === 'custom'));
                // The pattern tiles are drawn in Custom's colours, so they follow the sliders.
                for (const pb of grid.querySelectorAll('.mcfo-theme__pat')) {
                    paintPattern(pb.querySelector('.mcfo-theme__patsw'), pb.getAttribute('data-mcfo-pattern'));
                }
            }, 30);
        });
        input.addEventListener('change', saveSettings);
        return row;
    }

    function adoptLevelAsCustom() {
        for (const lever of PERF_LEVERS) settings[lever.key] = perfValue(lever.key);
    }

    function perfLeverChanged(key, value, redraw) {
        if (settings.perfLevel !== 'custom') { adoptLevelAsCustom(); settings.perfLevel = 'custom'; }
        settings[key] = value;
        saveSettings(); apply(); redraw();
    }

    function perfSwitchItem(lever, redraw) {
        const wrap = switchRow(lever.label, lever.hint, !!perfValue(lever.key));
        wrap.querySelector('input').addEventListener('change', e => perfLeverChanged(lever.key, e.target.checked, redraw));
        return wrap;
    }

    function perfChoiceItem(lever, redraw) {
        const wrap = document.createElement('div');
        wrap.className = 'mcfo-set__item';
        const row = document.createElement('div');
        row.className = 'mcfo-set__row mcfo-set__row--choice';
        row.innerHTML = '<span class="mcfo-set__text"><span class="mcfo-set__label"></span>'
                      + '<span class="mcfo-set__hint"></span></span>';
        row.querySelector('.mcfo-set__label').textContent = lever.label;
        row.querySelector('.mcfo-set__hint').textContent = lever.hint;
        const seg = document.createElement('div');
        seg.className = 'mcfo-seg';
        const now = perfValue(lever.key);
        for (const [value, label] of lever.options) {
            const b = document.createElement('button');
            b.type = 'button';
            b.textContent = label;
            b.setAttribute('aria-pressed', now === value ? 'true' : 'false');
            b.addEventListener('click', () => { if (now !== value) perfLeverChanged(lever.key, value, redraw); });
            seg.appendChild(b);
        }
        row.appendChild(seg);
        wrap.appendChild(row);
        return wrap;
    }

    function plainSwitchItem(item) {
        const wrap = switchRow(item.label, item.hint, !!settings[item.key]);
        wrap.querySelector('input').addEventListener('change', e => {
            settings[item.key] = e.target.checked;
            saveSettings(); apply();
        });
        return wrap;
    }

    function switchRow(label, hint, checked) {
        const wrap = document.createElement('div');
        wrap.className = 'mcfo-set__item';
        const row = document.createElement('label');
        row.className = 'mcfo-set__row';
        row.innerHTML = '<span class="mcfo-set__text"><span class="mcfo-set__label"></span>'
                      + '<span class="mcfo-set__hint"></span></span>'
                      + '<input type="checkbox" class="mcfo-switch__input">'
                      + '<span class="mcfo-switch" aria-hidden="true"></span>';
        row.querySelector('.mcfo-set__label').textContent = label;
        const h = row.querySelector('.mcfo-set__hint');
        if (hint) h.textContent = hint; else h.remove();
        row.querySelector('input').checked = checked;
        wrap.appendChild(row);
        return wrap;
    }

    // One switch, with its sub-control if it has one.
    function settingItem(item) {
        if (item.type === 'seg') return segItem(item);
        const wrap = document.createElement('div');
        wrap.className = 'mcfo-set__item';

        const row = document.createElement('label');
        row.className = 'mcfo-set__row';
        row.innerHTML = '<span class="mcfo-set__text"><span class="mcfo-set__label"></span>'
                      + '<span class="mcfo-set__hint"></span></span>'
                      + '<input type="checkbox" class="mcfo-switch__input">'
                      + '<span class="mcfo-switch" aria-hidden="true"></span>';
        row.querySelector('.mcfo-set__label').textContent = item.label;
        const hint = row.querySelector('.mcfo-set__hint');
        if (item.hint) hint.textContent = item.hint; else hint.remove();
        const input = row.querySelector('input');
        input.checked = !!settings[item.key];
        wrap.appendChild(row);

        const subs = itemSubs(item).map(subControl);
        for (const sub of subs) {
            sub.toggleAttribute('data-off', !input.checked);
            wrap.appendChild(sub);
        }
        if (item.needs && !settings[item.needs]) wrap.setAttribute('data-off', '');
        if (item.group) wrap.setAttribute('data-group', '');
        // Cosmetics page: a switch covered by the main or group switch shows as on and greyed.
        if (cosCovered(item.key)) { input.checked = true; input.disabled = true; wrap.setAttribute('data-off', ''); }

        input.addEventListener('change', () => {
            settings[item.key] = input.checked;
            for (const sub of subs) sub.toggleAttribute('data-off', !input.checked);
            saveSettings();
            apply();
            // Switches that need this one change from grey to live (or back): redraw the page.
            // So does a card of the page that hangs on it (redraw: true).
            if (settingsRedraw && (item.redraw || ALL_ITEMS.some(i => i.needs === item.key))) settingsRedraw();
        });
        return wrap;
    }

    // A choice of a few fixed states as one segmented row (6.50, bidding indicators). A main or
    // group switch that covers it shows its last option (Hide) pressed and greyed.
    function segItem(item) {
        const wrap = document.createElement('div');
        wrap.className = 'mcfo-set__item mcfo-set__item--seg';
        const row = document.createElement('div');
        row.className = 'mcfo-set__row';
        row.innerHTML = '<span class="mcfo-set__text"><span class="mcfo-set__label"></span><span class="mcfo-set__hint"></span></span>';
        row.querySelector('.mcfo-set__label').textContent = item.label;
        const hint = row.querySelector('.mcfo-set__hint');
        if (item.hint) hint.textContent = item.hint; else hint.remove();
        const seg = document.createElement('div');
        seg.className = 'mcfo-seg';
        const covered = cosCovered(item.key);
        const current = covered ? item.options[item.options.length - 1][0] : settings[item.key];
        for (const [value, label] of item.options) {
            const b = document.createElement('button');
            b.type = 'button';
            b.textContent = label;
            b.disabled = covered;
            b.setAttribute('aria-pressed', value === current ? 'true' : 'false');
            b.addEventListener('click', () => {
                if (settings[item.key] === value) return;
                settings[item.key] = value;
                saveSettings(); apply();
                for (const x of seg.children) x.setAttribute('aria-pressed', x === b ? 'true' : 'false');
            });
            seg.appendChild(b);
        }
        row.appendChild(seg);
        wrap.appendChild(row);
        if (covered) wrap.setAttribute('data-off', '');
        return wrap;
    }

    function subControl(sub) {
        const row = document.createElement('div');
        row.className = 'mcfo-set__sub';
        const label = document.createElement('span');
        label.className = 'mcfo-set__sublabel';
        label.textContent = sub.label;
        row.appendChild(label);

        if (sub.type === 'range') {
            const range = document.createElement('input');
            range.type = 'range';
            range.className = 'mcfo-set__range';
            range.min = sub.min; range.max = sub.max; range.step = sub.step;
            range.value = settings[sub.key];
            const val = document.createElement('span');
            val.className = 'mcfo-set__val';
            const reset = document.createElement('button');
            reset.type = 'button';
            reset.className = 'mcfo-set__reset';
            reset.textContent = 'Reset';
            reset.title = `Back to ${sub.def}${sub.unit || ''}`;

            const show = () => {
                val.textContent = range.value + (sub.unit || '');
                reset.disabled = Number(range.value) === sub.def;
            };
            // Live while dragging, saved when let go — the variables make the preview free,
            // but writing localStorage on every pixel of a drag is not.
            range.addEventListener('input', () => {
                settings[sub.key] = Number(range.value);
                show();
                applyTunables();
                applyGlassToFrames();
                writeChatTypography();
            });
            range.addEventListener('change', saveSettings);
            reset.addEventListener('click', () => {
                range.value = sub.def;
                settings[sub.key] = sub.def;
                show();
                applyTunables();
                applyGlassToFrames();
                writeChatTypography();
                saveSettings();
            });
            show();
            row.append(range, val, reset);
        } else if (sub.type === 'text') {
            // Free text (6.37). Saved while typing, a moment after the last key.
            const field = document.createElement('input');
            field.type = 'text';
            field.className = 'mcfo-set__field';
            field.maxLength = 300;
            field.spellcheck = false;
            field.placeholder = sub.placeholder || '';
            field.value = settings[sub.key] || '';
            let timer = 0;
            field.addEventListener('input', () => {
                settings[sub.key] = field.value;
                clearTimeout(timer);
                timer = setTimeout(() => { saveSettings(); if (sub.run) sub.run(); }, 350);
            });
            // Keys typed here are for the field, not for the game's shortcuts underneath.
            field.addEventListener('keydown', e => { if (e.key !== 'Escape') e.stopPropagation(); });
            row.appendChild(field);
        } else if (sub.type === 'action') {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'mcfo-set__reset';
            b.textContent = sub.text;
            b.addEventListener('click', () => sub.run());
            row.appendChild(b);
        } else if (sub.type === 'choice') {
            const seg = document.createElement('div');
            seg.className = 'mcfo-seg';
            for (const [value, text] of sub.options) {
                const b = document.createElement('button');
                b.type = 'button';
                b.textContent = text;
                b.setAttribute('aria-pressed', settings[sub.key] === value ? 'true' : 'false');
                b.addEventListener('click', () => {
                    settings[sub.key] = value;
                    for (const x of seg.children) x.setAttribute('aria-pressed', x === b ? 'true' : 'false');
                    saveSettings();
                });
                seg.appendChild(b);
            }
            row.appendChild(seg);
        }
        return row;
    }

