    // =========================================================================================
    // 11f. THE PLAYER BAR: THE MUSIC PLAYER ON THE PAGE (6.23)
    // =========================================================================================
    // Skipping a track should not mean three clicks through the settings. This is the same player
    // as on the Sound page - it holds nothing of its own, it reads the state above and writes it
    // back - in a small box that can be dragged anywhere and stays where it was put. Its place is
    // kept with the windows, under a path of its own.
    const MUSIC_BAR_KEY = '#musicbar';
    const MUSIC_BAR_ICONS = {
        close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
        list: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h11M4 12h11M4 17h7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="18" cy="16.5" r="2.6" fill="currentColor"/><path d="M20.6 16.5V8l-3 .6" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
    };
    // A note for the header, drawn like the gear next to it.
    const NOTE_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true">'
        + '<path d="M10 17.4V6.6l8-1.6v10.2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>'
        + '<circle cx="7.6" cy="17.6" r="2.7" fill="currentColor"/>'
        + '<circle cx="15.6" cy="15.6" r="2.7" fill="currentColor"/></svg>';

    function buildMusicBar() {
        const want = settings.musicPlayer && settings.musicBar;
        let bar = document.querySelector('.mcfo-bar');
        if (!want) {
            if (bar) bar.remove();
            music.barSync = null;
            return;
        }
        if (bar && bar.isConnected) return;
        // The bar needs the names, so the list is fetched here as well - once, a small file.
        void musicLoad();

        bar = document.createElement('div');
        bar.className = 'mcfo-bar';
        bar.innerHTML =
              '<div class="mcfo-bar__top">'
            +   '<span class="mcfo-bar__title"></span>'
            +   '<button type="button" class="mcfo-bar__x mcfo-barbtn" title="Hide the bar" aria-label="Hide the bar">'
            +     MUSIC_BAR_ICONS.close + '</button>'
            + '</div>'
            + '<div class="mcfo-bar__sub"></div>'
            + '<div class="mcfo-bar__row"></div>'
            + '<div class="mcfo-bar__line" title="Jump to another place in the track">'
            +   '<span class="mcfo-bar__buf"></span><span class="mcfo-bar__at"></span></div>';
        document.body.appendChild(bar);

        const title = bar.querySelector('.mcfo-bar__title');
        const sub = bar.querySelector('.mcfo-bar__sub');
        const row = bar.querySelector('.mcfo-bar__row');
        const line = bar.querySelector('.mcfo-bar__line');
        const bufFill = bar.querySelector('.mcfo-bar__buf');
        const atFill = bar.querySelector('.mcfo-bar__at');

        const button = (label, icon) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'mcfo-barbtn';
            b.innerHTML = icon;
            b.title = label;
            b.setAttribute('aria-label', label);
            return b;
        };
        const bPrev = button('Previous track', MUSIC_ICONS.prev);
        const bPlay = button('Play', MUSIC_ICONS.play);
        const bNext = button('Next track', MUSIC_ICONS.next);
        const bShuffle = button('Shuffle', MUSIC_ICONS.shuffle);
        const bList = button('The whole soundtrack', MUSIC_BAR_ICONS.list);
        bPlay.classList.add('mcfo-barbtn--play');
        const vol = document.createElement('input');
        vol.type = 'range';
        vol.className = 'mcfo-bar__vol';
        vol.min = '0'; vol.max = '100'; vol.step = '1';
        vol.value = String(settings.musicVolume);
        vol.title = 'Volume';
        vol.setAttribute('aria-label', 'Volume');
        row.append(bPrev, bPlay, bNext, bShuffle, vol, bList);

        bPrev.addEventListener('click', () => musicSkip(-1));
        bNext.addEventListener('click', () => musicSkip(1));
        bPlay.addEventListener('click', musicToggle);
        bShuffle.addEventListener('click', () => {
            settings.musicShuffle = !settings.musicShuffle;
            music.queue = [];
            saveSettings();
            musicSync();
        });
        vol.addEventListener('input', () => {
            settings.musicVolume = Math.max(0, Math.min(100, Number(vol.value) || 0));
            if (music.el) music.el.volume = settings.musicVolume / 100;
            saveSettings();
        });
        // The way to the list: the Sound page, opened on the spot. Only from the button - the
        // title and the line under it are what the box gets dragged by, and a box made of nothing
        // but buttons cannot be moved anywhere.
        bList.addEventListener('click', () => { settingsView = 'Sound'; showSettings(); });
        bar.querySelector('.mcfo-bar__x').addEventListener('click', () => {
            settings.musicBar = false;
            saveSettings();
            buildMusicBar();
            buildHeaderButtons();
        });

        // Jumping: the line is the track from end to end.
        line.addEventListener('pointerdown', e => {
            const el = music.el;
            if (!el || !el.duration) return;
            const r = line.getBoundingClientRect();
            music.seekAt = Date.now();
            el.currentTime = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * el.duration;
            musicRemember();
            musicSync();
        });

        // Dragging: anywhere on the box that is not a control.
        let dragging = false, dx = 0, dy = 0;
        function place(left, top) {
            const w = bar.offsetWidth, h = bar.offsetHeight;
            bar.style.left = Math.round(Math.max(0, Math.min(left, innerWidth - w))) + 'px';
            bar.style.top = Math.round(Math.max(0, Math.min(top, innerHeight - h))) + 'px';
        }
        bar.addEventListener('pointerdown', e => {
            if (e.button !== 0 || e.target.closest('button, input, .mcfo-bar__line')) return;
            const r = bar.getBoundingClientRect();
            dx = e.clientX - r.left; dy = e.clientY - r.top;
            dragging = true;
            // A pointer id the browser no longer knows about throws here; the drag works without
            // the capture, it just stops at the edge of the box.
            try { bar.setPointerCapture(e.pointerId); } catch (err) {}
            bar.setAttribute('data-drag', '');
            e.preventDefault();
        });
        bar.addEventListener('pointermove', e => { if (dragging) place(e.clientX - dx, e.clientY - dy); });
        const stop = e => {
            if (!dragging) return;
            dragging = false;
            bar.removeAttribute('data-drag');
            try { bar.releasePointerCapture(e.pointerId); } catch (err) {}
            saveWinState(MUSIC_BAR_KEY, { left: parseInt(bar.style.left, 10), top: parseInt(bar.style.top, 10) });
        };
        bar.addEventListener('pointerup', stop);
        bar.addEventListener('pointercancel', stop);

        // Where it opens: where it was left, otherwise bottom left, clear of the game's footer.
        const saved = loadWinState()[MUSIC_BAR_KEY] || {};
        place(Number.isFinite(saved.left) ? saved.left : 16,
              Number.isFinite(saved.top) ? saved.top : innerHeight - 170);
        addEventListener('resize', () => {
            if (!bar.isConnected) return;
            place(parseInt(bar.style.left, 10) || 0, parseInt(bar.style.top, 10) || 0);
        });

        music.barSync = function () {
            const track = musicFind(music.id);
            title.textContent = track ? track.title : 'Nothing chosen yet';
            title.title = (track ? track.title + ' · ' + track.album + ' — ' : '') + 'drag to move the bar';
            // While it waits for the track to arrive, the line under the title says so: on the bar
            // there is no room for the whole sentence the Sound page shows.
            sub.textContent = music.holding
                ? 'Loading... ' + Math.floor(musicAhead()) + '/' + music.holdNeed + 's'
                : (track ? track.album : '');
            sub.toggleAttribute('data-wait', music.holding);
            const playing = musicIsPlaying();
            bPlay.innerHTML = playing ? MUSIC_ICONS.pause : MUSIC_ICONS.play;
            bPlay.title = playing ? 'Pause' : 'Play';
            bPlay.setAttribute('aria-label', bPlay.title);
            bShuffle.setAttribute('aria-pressed', settings.musicShuffle ? 'true' : 'false');
            if (document.activeElement !== vol) vol.value = String(settings.musicVolume);
            const el = music.el;
            const loaded = el && music.srcId === music.id;
            const duration = loaded && Number.isFinite(el.duration) ? el.duration : 0;
            const end = loaded && el.buffered.length ? el.buffered.end(el.buffered.length - 1) : 0;
            atFill.style.width = duration ? Math.min(100, (el.currentTime / duration) * 100) + '%' : '0';
            bufFill.style.width = duration ? Math.min(100, (end / duration) * 100) + '%' : '0';
        };
        music.barSync();
    }

