    // =========================================================================================
    // 11e. MUSIC PLAYER: THE GAME'S SOUNDTRACK, OURS TO PICK FROM (6.22)
    // =========================================================================================
    // The game reads its playlist from /.mcf-soundtrack/manifest.json and walks it strictly in
    // order: Next is index + 1, and that is the whole of it. Worse, its player downloads every
    // file whole and decodes it before the first note (prodViewer/sound/soundRuntime.js, one
    // decodeAudioData over the complete buffer) - and the files are raw WAV, 12 to 69 MB each. So
    // clicking your way to a track you want costs hundreds of megabytes.
    // This player reads the same manifest and hands the files to an <audio> element instead, which
    // streams them: metadata after about a second, seeking by range request, a few seconds held
    // ahead instead of the whole file. That makes picking a track, shuffling and leaving tracks
    // out cheap. Whenever it starts, the game's own music is switched off with the game's own
    // button - two players would be two songs at once, and section 11c reads that state back.
    const MUSIC_MANIFEST_URL = '/.mcf-soundtrack/manifest.json';
    const MUSIC_LAST_KEY = 'mcfo_music_last';   // track and position, to pick up where it stopped
    const MUSIC_SAVE_EVERY_MS = 10000;
    const MUSIC_MAX_FAILS = 3;                  // a run of unplayable tracks stops the hunt
    // Holding back. The soundtrack is raw WAV at 192 KB a second, and the game's server sends
    // these files at anything between 115 KB and 1.2 MB a second - often less than a track eats.
    // A browser starts as soon as it has a morsel and then runs dry every few seconds, which is
    // heard as a track stopping after a second or two, or stuttering once the read-ahead reserve
    // is used up (Firefox reads 60 s ahead, so that lands around the middle of a track). Instead
    // of playing into an empty buffer, the player waits until a cushion is there and says so.
    const MUSIC_AHEAD_START = 5;                // seconds ready before the first note
    const MUSIC_AHEAD_RESUME = 15;              // seconds ready before it carries on after a dry spell
    const MUSIC_HOLD_MAX_MS = 25000;            // waiting longer than this helps nobody: play on
    const MUSIC_HOLD_STILL_MS = 5000;           // nothing arriving for this long: waiting is pointless

    const music = {
        tracks: null,     // [{ id, album, title, src }] once the manifest has been read
        loading: null,    // the promise while it is on its way
        note: '',         // what went wrong, shown under the player
        fails: 0,         // tracks that would not play, in a row
        fault: '',        // the name of the last refusal, for when something needs looking at
        wantPlay: false,  // what was asked for - the element can be held back and still be "playing"
        holding: false,   // paused on purpose, filling the buffer
        holdNeed: 0,
        holdSince: 0,
        holdGrew: 0,      // when the buffer last grew: a buffer standing still ends the wait
        holdAhead: 0,
        seekAt: 0,        // when the bar was last dragged: after that a small cushion will do
        fresh: false,     // a track that has not played a note yet: it gets going on a small cushion
        el: null,         // the <audio>, built on the first play
        id: '',           // the chosen track, also before anything is loaded
        srcId: '',        // the track actually loaded into the element
        seekTo: 0,        // where to start once the metadata is in
        queue: [],        // the shuffled order, rebuilt when the rotation changes
        filter: '',       // the search box, kept while the window stays open
        open: new Set(),  // the albums folded open
        savedAt: 0,
        sync: null,       // light refresh of the Sound page (bar, buttons, marker)
        barSync: null,    // light refresh of the bar on the page (11f)
        redraw: null,     // full rebuild of the Sound page (list, counts)
    };

    // Two views can be open at once - the Sound page and the bar on the page. Both are refreshed
    // from here, so neither has to know about the other.
    function musicSync() {
        if (music.sync) { try { music.sync(); } catch (e) {} }
        if (music.barSync) { try { music.barSync(); } catch (e) {} }
    }
    const musicFind = id => (music.tracks || []).find(t => t.id === id) || null;
    // What was asked for, not what the element does this second: while it is held back to fill the
    // buffer it is still "playing" as far as the page and the buttons are concerned.
    const musicIsPlaying = () => music.wantPlay && music.srcId === music.id;
    // How many seconds are ready beyond the playhead, in the piece it is playing from.
    function musicAhead() {
        const el = music.el;
        if (!el || !el.buffered || !el.buffered.length) return 0;
        const at = el.currentTime;
        for (let i = 0; i < el.buffered.length; i++) {
            if (at >= el.buffered.start(i) - 0.5 && at <= el.buffered.end(i)) return el.buffered.end(i) - at;
        }
        return 0;
    }
    const musicWhole = () => {
        const el = music.el;
        return !!el && el.duration > 0 && el.buffered.length > 0
            && el.buffered.end(el.buffered.length - 1) >= el.duration - 0.5;
    };

    // Pausing on purpose until the cushion is back. A paused element keeps filling its buffer, so
    // this turns a stutter every two seconds into one honest wait.
    function musicHold(seconds) {
        if (!music.el || music.holding || !music.wantPlay) return;
        music.holding = true;
        music.holdNeed = seconds;
        music.holdSince = Date.now();
        music.holdGrew = Date.now();
        music.holdAhead = musicAhead();
        music.el.pause();
        musicHoldTick();
    }
    function musicHoldTick() {
        if (!music.holding) return;
        const ahead = musicAhead();
        // A browser fills the buffer of a paused track only so far and then stops. Standing still
        // is the sign that waiting brings nothing more, whatever the cushion has reached.
        if (ahead > music.holdAhead + 0.2) { music.holdAhead = ahead; music.holdGrew = Date.now(); }
        const stillMs = Date.now() - music.holdGrew;
        if (!music.el || !music.wantPlay || ahead >= music.holdNeed || musicWhole()
            || stillMs > MUSIC_HOLD_STILL_MS || Date.now() - music.holdSince > MUSIC_HOLD_MAX_MS) {
            const go = music.holding && music.wantPlay && music.el;
            music.holding = false;
            music.note = '';
            if (go) music.el.play().catch(() => {});
            musicSync();
            return;
        }
        music.note = 'Waiting for the track to load: ' + Math.floor(ahead) + ' of ' + music.holdNeed
                   + ' seconds ready. The game\'s server is not always quick with these files.';
        musicSync();
        setTimeout(musicHoldTick, 400);
    }
    const musicOut = id => settings.musicExcluded.indexOf(id) >= 0;
    function musicTime(sec) {
        const s = Math.max(0, Math.floor(Number(sec) || 0));
        return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
    }

    // The manifest gives a path and a name per track; the album is the folder it sits in. The
    // paths come with spaces and commas in them and are handed on as they are: the URL parser
    // encodes what needs encoding, while encodeURI would take the percent of a path that is
    // already encoded and make %2520 out of %20. Only the two characters that would cut a URL
    // short - the hash and the question mark - are spelled out.
    function musicParse(raw) {
        const path = String((raw && (raw.path || raw.src || raw.url)) || '').trim();
        if (!path) return null;
        const parts = path.split('/').filter(Boolean).map(p => { try { return decodeURIComponent(p); } catch (e) { return p; } });
        const file = parts[parts.length - 1] || '';
        return {
            id: path,
            album: parts.length > 1 ? parts[parts.length - 2] : 'Soundtrack',
            title: String((raw && (raw.name || raw.title)) || '').trim() || file.replace(/\.[^.]*$/, ''),
            src: path.replace(/#/g, '%23').replace(/\?/g, '%3F'),
        };
    }

    // Only ever fetched when the Sound page is opened, never on a normal page load.
    function musicLoad() {
        if (music.tracks) return Promise.resolve(music.tracks);
        if (!music.loading) music.loading = (async () => {
            let list = [];
            try {
                const res = await fetch(MUSIC_MANIFEST_URL, { cache: 'no-store' });
                if (!res.ok) throw new Error('HTTP ' + res.status);
                const data = await res.json();
                list = (Array.isArray(data && data.tracks) ? data.tracks : []).map(musicParse).filter(Boolean);
                music.note = list.length ? '' : 'The game\'s soundtrack list came back empty.';
            } catch (e) {
                music.note = 'The soundtrack list could not be read. Reload the page and try again.';
            }
            music.tracks = list;
            music.loading = null;
            musicRestore();
            if (music.redraw) music.redraw();
            musicSync();
            return list;
        })();
        return music.loading;
    }

    // Where it stopped last time, so the page comes back to the same track at the same place.
    // Nothing starts by itself: the position is only handed over on the next press of Play.
    function musicRestore() {
        if (music.id) return;
        let last = null;
        try { last = JSON.parse(localStorage.getItem(MUSIC_LAST_KEY) || 'null'); } catch (e) {}
        if (!last || !musicFind(last.id)) return;
        music.id = String(last.id);
        music.seekTo = Math.max(0, Number(last.pos) || 0);
    }
    function musicRemember() {
        if (!music.id) return;
        const pos = music.el && music.srcId === music.id ? music.el.currentTime : music.seekTo;
        try { localStorage.setItem(MUSIC_LAST_KEY, JSON.stringify({ id: music.id, pos: Math.max(0, Math.floor(pos || 0)) })); } catch (e) {}
        music.savedAt = Date.now();
    }

    // The rotation is everything still ticked on the list. In order that is the manifest's order;
    // shuffled it is one pass through a shuffled copy, so nothing comes round twice while other
    // tracks have not played at all.
    function musicRotation() {
        const out = new Set(settings.musicExcluded);
        return (music.tracks || []).filter(t => !out.has(t.id));
    }
    function musicOrder() {
        const ids = musicRotation().map(t => t.id);
        if (!settings.musicShuffle) return ids;
        const have = new Set(ids);
        const fits = music.queue.length === ids.length && music.queue.every(id => have.has(id));
        if (!fits) music.queue = musicShuffled(ids, music.id);
        return music.queue;
    }
    // Fisher-Yates. Whatever plays right now keeps the front, so a reshuffle never cuts it off.
    function musicShuffled(ids, keep) {
        const a = ids.slice();
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const t = a[i]; a[i] = a[j]; a[j] = t;
        }
        const at = a.indexOf(keep);
        if (at > 0) { a.splice(at, 1); a.unshift(keep); }
        return a;
    }

    // Taking a track out or putting it back never pushes into the list: settingDefaults holds an
    // array of its own, and a shared one would fill up through Reset all.
    function musicSetOut(ids, out) {
        const set = new Set(settings.musicExcluded);
        for (const id of ids) { if (out) set.add(id); else set.delete(id); }
        settings.musicExcluded = [...set];
        music.queue = [];
        saveSettings();
        // Taking off the track that is playing right now means it should stop being heard, not
        // play to its end: it moves on, or falls silent when nothing is left to play.
        if (out && musicIsPlaying() && musicOut(music.id)) {
            if (musicRotation().length) musicSkip(1); else musicPause();
        }
    }

    function musicElement() {
        // Back into the page if something took it out: a player removed from the document is
        // paused by the browser on the spot.
        if (music.el) {
            if (!music.el.isConnected) (document.body || document.documentElement).appendChild(music.el);
            return music.el;
        }
        const el = new Audio();
        el.preload = 'none';
        el.className = 'mcfo-audio';
        el.hidden = true;
        el.volume = Math.max(0, Math.min(1, settings.musicVolume / 100));
        // In the page rather than off to the side: that way the browser treats it as a proper
        // player - media keys and the browser's own sound indicator find it - and it can be
        // looked at when something goes wrong.
        (document.body || document.documentElement).appendChild(el);
        el.addEventListener('loadedmetadata', () => {
            if (music.seekTo > 0 && music.seekTo < el.duration - 1) el.currentTime = music.seekTo;
            music.seekTo = 0;
            musicSync();
        });
        el.addEventListener('timeupdate', () => {
            if (Date.now() - music.savedAt > MUSIC_SAVE_EVERY_MS) musicRemember();
            musicSync();
        });
        el.addEventListener('playing', () => { music.fails = 0; music.fresh = false; musicSync(); });
        // Ran dry: hold back until there is something to play from again. Right after the bar was
        // dragged the small cushion is enough - nobody wants to wait half a minute for a jump.
        el.addEventListener('seeking', () => { music.seekAt = Date.now(); });
        // A track that has not started yet, and a jump with the bar, get going on the small
        // cushion - nobody waits half a minute for the first note. The big one is for a track that
        // was running and ran out: there a longer wait buys a longer stretch of music.
        el.addEventListener('waiting', () => musicHold(
            music.fresh || Date.now() - music.seekAt < 4000 ? MUSIC_AHEAD_START : MUSIC_AHEAD_RESUME));
        // Even when the first notes are already there, a small cushion first: on a quick line
        // that is a fraction of a second.
        el.addEventListener('loadeddata', () => musicHold(MUSIC_AHEAD_START));
        el.addEventListener('pause', () => { musicRemember(); musicSync(); });
        el.addEventListener('progress', () => { musicSync(); });
        el.addEventListener('ended', () => { music.seekTo = 0; musicSkip(1); });
        // A file that will not play is skipped, but a run of them stops rather than racing through
        // the whole soundtrack.
        el.addEventListener('error', () => {
            const t = musicFind(music.id);
            music.fails++;
            if (music.fails >= MUSIC_MAX_FAILS || musicRotation().length < 2) {
                music.note = 'That track would not play' + (t ? ': ' + t.title : '') + '.';
                if (music.redraw) music.redraw();
                return;
            }
            music.note = 'Skipped a track the browser would not play.';
            musicSkip(1);
        });
        music.el = el;
        return el;
    }

    // Starting anything silences the game's own music first, with the game's own button.
    function musicPlay(id) {
        const track = musicFind(id);
        if (!track) return;
        const s = soundState();
        if (s && s.music) soundClick('music-enabled-toggle');
        const el = musicElement();
        music.wantPlay = true;
        if (music.srcId !== track.id) {
            music.id = track.id;
            music.srcId = track.id;
            music.note = '';
            el.src = track.src;
            music.fresh = true;
            el.preload = 'auto';   // keep filling the buffer even while it is held back
            el.load();
        }
        el.play().catch(e => {
            music.fault = (e && e.name) || 'unknown';
            // Holding back pauses the element the moment it asks for data, and that turns the
            // play() just started into an AbortError. Nothing is wrong there - the hold plays it.
            if (music.fault === 'AbortError') return;
            music.note = 'The browser would not start the sound. Click the page once, then press Play again.';
            if (music.redraw) music.redraw();
        });
        musicRemember();
        musicSync();
    }
    function musicPause() {
        music.wantPlay = false;
        music.holding = false;
        music.note = '';
        if (music.el) music.el.pause();
    }
    function musicToggle() {
        if (musicIsPlaying()) { musicPause(); return; }
        const id = musicFind(music.id) ? music.id : musicOrder()[0];
        if (id) musicPlay(id);
    }
    function musicSkip(dir) {
        const order = musicOrder();
        if (!order.length) { musicPause(); return; }
        // Back in the first seconds means the track before; later in it means this one again.
        if (dir < 0 && music.el && music.srcId === music.id && music.el.currentTime > 3) {
            music.el.currentTime = 0;
            return;
        }
        const at = order.indexOf(music.id);
        let next;
        if (at < 0) next = order[dir > 0 ? 0 : order.length - 1];
        else if (settings.musicShuffle && at + dir >= order.length) {
            music.queue = musicShuffled(order);
            next = music.queue[0];
        } else next = order[(at + dir + order.length) % order.length];
        music.seekTo = 0;
        musicPlay(next);
    }

    const MUSIC_ICONS = {
        play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>',
        pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h3.5v14H7zm6.5 0H17v14h-3.5z"/></svg>',
        prev: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 6h2.2v12H7zm11 0v12l-8-6z"/></svg>',
        next: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.8 6H17v12h-2.2zM6 6l8 6-8 6z"/></svg>',
        shuffle: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16.5 4 21 7.6l-4.5 3.6V8.9h-1.8l-2 2.7-1.4-1.9L13.8 6h2.7zm0 8.8L21 16.4 16.5 20v-2.3h-2.7l-2.5-3.3 1.4-1.9 2 2.7h1.8zM3 6h4.4l2.5 3.3-1.4 1.9-2-2.7H3zm0 9.7h3.5l4.9-6.6 1.4 1.9-5.4 7.3H3z"/></svg>',
    };

    // The player on the Sound page. It keeps no copy of anything: every control reads the state
    // above and writes it straight back. sync() is the cheap refresh that runs four times a second
    // while a track plays, so it touches the bar, the buttons and the one marked row - never the
    // whole list. Ticking tracks on and off rebuilds nothing either, or the list would jump back
    // to the top under the hand that ticked it.
    function musicPlayerUi(redrawPage) {
        const box = document.createElement('div');
        box.className = 'mcfo-mus';
        music.sync = null;                       // the nodes of the last drawing are gone
        music.redraw = () => redrawPage();

        if (!music.tracks) {
            void musicLoad();
            const wait = document.createElement('div');
            wait.className = 'mcfo-mus__note';
            wait.textContent = 'Reading the game\'s soundtrack list...';
            box.appendChild(wait);
            return box;
        }
        if (!music.tracks.length) {
            const bad = document.createElement('div');
            bad.className = 'mcfo-set__notice';
            bad.textContent = music.note || 'The game\'s soundtrack list is empty.';
            box.appendChild(bad);
            return box;
        }

        // Now playing.
        const now = document.createElement('div');
        now.className = 'mcfo-mus__now';
        now.innerHTML = '<span class="mcfo-mus__title"></span><span class="mcfo-mus__albumline"></span>';
        const nowTitle = now.querySelector('.mcfo-mus__title');
        const nowAlbum = now.querySelector('.mcfo-mus__albumline');

        // Transport.
        const bar = document.createElement('div');
        bar.className = 'mcfo-mus__row';
        const button = (label, icon, extra) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'mcfo-mus__btn' + (extra || '');
            b.innerHTML = icon;
            b.title = label;
            b.setAttribute('aria-label', label);
            return b;
        };
        const bPrev = button('Previous track', MUSIC_ICONS.prev);
        const bPlay = button('Play', MUSIC_ICONS.play, ' mcfo-mus__btn--play');
        const bNext = button('Next track', MUSIC_ICONS.next);
        const bShuffle = button('Shuffle', MUSIC_ICONS.shuffle);
        bShuffle.setAttribute('aria-pressed', settings.musicShuffle ? 'true' : 'false');
        bPrev.addEventListener('click', () => musicSkip(-1));
        bNext.addEventListener('click', () => musicSkip(1));
        bPlay.addEventListener('click', musicToggle);
        bShuffle.addEventListener('click', () => {
            settings.musicShuffle = !settings.musicShuffle;
            music.queue = [];
            saveSettings();
            bShuffle.setAttribute('aria-pressed', settings.musicShuffle ? 'true' : 'false');
        });
        const count = document.createElement('span');
        count.className = 'mcfo-mus__count';
        bar.append(bPrev, bPlay, bNext, bShuffle, count);

        // Position. The slider runs in seconds, so it is right whatever the track is long.
        const line = document.createElement('div');
        line.className = 'mcfo-mus__row';
        line.innerHTML = '<span class="mcfo-mus__time"></span>'
                       + '<input type="range" class="mcfo-mus__seek" min="0" max="1" step="1" value="0" aria-label="Position in the track">'
                       + '<span class="mcfo-mus__time"></span>';
        const buffered = document.createElement('div');
        buffered.className = 'mcfo-mus__buf';
        buffered.innerHTML = '<span></span>';
        const bufFill = buffered.firstChild;
        const seek = line.querySelector('.mcfo-mus__seek');
        const atText = line.children[0], ofText = line.children[2];
        let seeking = false;
        seek.addEventListener('pointerdown', () => { seeking = true; });
        seek.addEventListener('input', () => { seeking = true; atText.textContent = musicTime(seek.value); });
        seek.addEventListener('change', () => {
            seeking = false;
            if (music.el && music.srcId === music.id && music.el.duration) music.el.currentTime = Number(seek.value);
            else music.seekTo = Number(seek.value);
            musicRemember();
        });

        // Volume. Its own row rather than mcfo-set__sub, which brings the card's padding with it.
        const vol = document.createElement('div');
        vol.className = 'mcfo-mus__row';
        vol.innerHTML = '<span class="mcfo-set__sublabel">Volume</span>'
                      + '<input type="range" class="mcfo-set__range" min="0" max="100" step="1">'
                      + '<span class="mcfo-set__val"></span>';
        const volRange = vol.querySelector('input');
        const volVal = vol.querySelector('.mcfo-set__val');
        volRange.value = String(settings.musicVolume);
        volVal.textContent = settings.musicVolume + '%';
        volRange.addEventListener('input', () => {
            settings.musicVolume = Math.max(0, Math.min(100, Number(volRange.value) || 0));
            volVal.textContent = settings.musicVolume + '%';
            if (music.el) music.el.volume = settings.musicVolume / 100;
            saveSettings();
        });

        // Search and the two big switches over the whole soundtrack.
        const tools = document.createElement('div');
        tools.className = 'mcfo-mus__row';
        const search = document.createElement('input');
        search.type = 'search';
        search.className = 'mcfo-mus__search';
        search.placeholder = 'Search title or album';
        search.value = music.filter;
        search.addEventListener('input', () => { music.filter = search.value; buildList(); });
        const allOn = document.createElement('button');
        allOn.type = 'button';
        allOn.className = 'mcfo-set__reset';
        allOn.textContent = 'All on';
        allOn.addEventListener('click', () => { musicSetOut(music.tracks.map(t => t.id), false); buildList(); });
        const allOff = document.createElement('button');
        allOff.type = 'button';
        allOff.className = 'mcfo-set__reset';
        allOff.textContent = 'All off';
        allOff.addEventListener('click', () => { musicSetOut(music.tracks.map(t => t.id), true); buildList(); });
        tools.append(search, allOn, allOff);

        const list = document.createElement('div');
        list.className = 'mcfo-mus__list';
        const note = document.createElement('div');
        note.className = 'mcfo-mus__note';

        // The list, by album. Albums are folded shut; the one being played, and everything a
        // search matches, is open.
        let albums = [];
        let marked = null;
        function buildList() {
            list.textContent = '';
            marked = null;
            albums = [];
            const q = music.filter.trim().toLowerCase();
            const byAlbum = new Map();
            for (const t of music.tracks) {
                if (!byAlbum.has(t.album)) byAlbum.set(t.album, []);
                byAlbum.get(t.album).push(t);
            }
            for (const [name, tracks] of byAlbum) {
                const shown = q ? tracks.filter(t => (t.title + ' ' + name).toLowerCase().includes(q)) : tracks;
                if (!shown.length) continue;
                const album = { name, tracks, scope: q ? shown : tracks, rows: [], head: null, num: null, tick: null };
                const head = document.createElement('div');
                head.className = 'mcfo-mus__head';
                const fold = document.createElement('button');
                fold.type = 'button';
                fold.className = 'mcfo-mus__fold';
                fold.textContent = name;
                const num = document.createElement('span');
                num.className = 'mcfo-mus__num';
                const tick = document.createElement('input');
                tick.type = 'checkbox';
                tick.className = 'mcfo-mus__tick';
                tick.title = 'Play tracks from this album';
                head.append(fold, num, tick);
                const songs = document.createElement('div');
                songs.className = 'mcfo-mus__songs';
                const open = !!q || music.open.has(name) || shown.some(t => t.id === music.id);
                if (open) music.open.add(name);
                songs.hidden = !open;
                head.toggleAttribute('data-open', open);
                fold.addEventListener('click', () => {
                    const nowOpen = songs.hidden;
                    songs.hidden = !nowOpen;
                    head.toggleAttribute('data-open', nowOpen);
                    if (nowOpen) music.open.add(name); else music.open.delete(name);
                });
                tick.addEventListener('change', () => {
                    musicSetOut(album.scope.map(t => t.id), !tick.checked);
                    for (const row of album.rows) row.tick.checked = !musicOut(row.track.id);
                    counts();
                });
                for (const t of shown) {
                    const row = document.createElement('div');
                    row.className = 'mcfo-mus__song';
                    row.dataset.id = t.id;
                    const play = document.createElement('button');
                    play.type = 'button';
                    play.className = 'mcfo-mus__songname';
                    play.textContent = t.title;
                    play.title = 'Play ' + t.title;
                    const rowTick = document.createElement('input');
                    rowTick.type = 'checkbox';
                    rowTick.className = 'mcfo-mus__tick';
                    rowTick.checked = !musicOut(t.id);
                    rowTick.title = 'Play this track';
                    // Picking a track that was taken out puts it back: the ticks are the rotation,
                    // and a track playing while ticked off would be a lie about the next one.
                    play.addEventListener('click', () => {
                        if (musicOut(t.id)) { musicSetOut([t.id], false); rowTick.checked = true; counts(); }
                        musicPlay(t.id);
                    });
                    rowTick.addEventListener('change', () => { musicSetOut([t.id], !rowTick.checked); counts(); });
                    row.append(play, rowTick);
                    songs.appendChild(row);
                    album.rows.push({ track: t, tick: rowTick });
                }
                album.head = head; album.num = num; album.tick = tick;
                list.append(head, songs);
                albums.push(album);
            }
            if (!albums.length) {
                const none = document.createElement('div');
                none.className = 'mcfo-mus__note';
                none.textContent = 'Nothing matches "' + music.filter.trim() + '".';
                list.appendChild(none);
            }
            counts();
            sync();
        }

        // Every counter that can change without the list being rebuilt.
        function counts() {
            for (const album of albums) {
                const on = album.tracks.filter(t => !musicOut(t.id)).length;
                album.num.textContent = on + '/' + album.tracks.length;
                album.tick.checked = on > 0;
                album.tick.indeterminate = on > 0 && on < album.tracks.length;
            }
            const rotation = musicRotation().length;
            count.textContent = rotation + ' of ' + music.tracks.length + ' tracks';
            const empty = rotation === 0;
            bPrev.disabled = bNext.disabled = empty;
            bPlay.disabled = empty && !musicIsPlaying();
        }

        function sync() {
            const track = musicFind(music.id);
            nowTitle.textContent = track ? track.title : 'Nothing chosen yet';
            nowAlbum.textContent = track ? track.album : '';
            const playing = musicIsPlaying();
            bPlay.innerHTML = playing ? MUSIC_ICONS.pause : MUSIC_ICONS.play;
            bPlay.title = playing ? 'Pause' : 'Play';
            bPlay.setAttribute('aria-label', bPlay.title);
            const loaded = music.el && music.srcId === music.id;
            const duration = loaded && Number.isFinite(music.el.duration) ? music.el.duration : 0;
            const at = loaded ? music.el.currentTime : music.seekTo;
            seek.disabled = !duration;
            if (!seeking) {
                seek.max = String(Math.max(1, Math.floor(duration || 1)));
                seek.value = String(Math.min(Math.floor(at), Math.floor(duration || 0)));
            }
            atText.textContent = musicTime(at);
            ofText.textContent = duration ? musicTime(duration) : '--:--';
            const el2 = music.el;
            const end = loaded && el2 && el2.buffered.length ? el2.buffered.end(el2.buffered.length - 1) : 0;
            bufFill.style.width = duration ? Math.min(100, (end / duration) * 100) + '%' : '0';
            buffered.toggleAttribute('data-thin', music.holding);
            if (marked && marked.dataset.id !== music.id) { marked.removeAttribute('data-current'); marked = null; }
            if (!marked && music.id) {
                marked = list.querySelector('.mcfo-mus__song[data-id="' + CSS.escape(music.id) + '"]');
                if (marked) marked.setAttribute('data-current', '');
            }
            if (marked) marked.toggleAttribute('data-playing', playing);
            note.textContent = music.note;
            note.hidden = !music.note;
        }

        // The word about waiting belongs where the eye is - right under the bar, not below the
        // whole list.
        box.append(now, bar, line, buffered, note, vol, tools, list);
        buildList();
        music.sync = sync;
        return box;
    }

    // The switch for the player on the Sound page, drawn like any setting row, with the player
    // itself under it. Switching it on hushes the game's music; switching it off stops ours and
    // hands the game's own controls back (section 11c).
    function musicItem(redraw) {
        const wrap = document.createElement('div');
        wrap.className = 'mcfo-set__item';
        const row = document.createElement('label');
        row.className = 'mcfo-set__row';
        row.innerHTML = '<span class="mcfo-set__text"><span class="mcfo-set__label"></span>'
                      + '<span class="mcfo-set__hint"></span></span>'
                      + '<input type="checkbox" class="mcfo-switch__input">'
                      + '<span class="mcfo-switch" aria-hidden="true"></span>';
        row.querySelector('.mcfo-set__label').textContent = 'Music player';
        row.querySelector('.mcfo-set__hint').textContent = 'The whole soundtrack by album: pick a track, '
            + 'shuffle it, and take off the ones you would rather not hear. It streams, so a track starts at '
            + 'once instead of after the whole file. While it is on, the game plays no music of its own.';
        const input = row.querySelector('input');
        input.checked = settings.musicPlayer;
        input.addEventListener('change', () => {
            settings.musicPlayer = input.checked;
            saveSettings();
            if (!settings.musicPlayer) musicPause();
            else { const s = soundState(); if (s && s.music) soundClick('music-enabled-toggle'); }
            redraw();
        });
        wrap.appendChild(row);
        if (settings.musicPlayer) {
            const sub = document.createElement('label');
            sub.className = 'mcfo-set__sub';
            sub.innerHTML = '<span class="mcfo-set__sublabel">Player bar</span>'
                          + '<span class="mcfo-set__hint mcfo-set__hint--wide"></span>'
                          + '<input type="checkbox" class="mcfo-switch__input">'
                          + '<span class="mcfo-switch" aria-hidden="true"></span>';
            sub.querySelector('.mcfo-set__hint').textContent = 'A small player to drag anywhere on the page. '
                + 'The note next to the gear shows and hides it.';
            const barOn = sub.querySelector('input');
            barOn.checked = settings.musicBar;
            barOn.addEventListener('change', () => {
                settings.musicBar = barOn.checked;
                saveSettings();
                buildMusicBar();
                buildHeaderButtons();
            });
            wrap.appendChild(sub);
            wrap.appendChild(musicPlayerUi(redraw));
        }
        return wrap;
    }

