    // =========================================================================================
    // 12c. UPDATE CHECK (6.26)
    // =========================================================================================
    // Tampermonkey looks for updates by itself, but only about once a day, and installs them
    // silently. This tells you at once: a red dot on the account card, a red first entry in its
    // menu, and "update to ..." next to the version in the footer. Any of them opens the install
    // page, and Tampermonkey asks as usual.
    //
    // Where the number comes from (6.27.1): Greasy Fork's own metadata file, update.greasyfork.org/
    // .../MarbleLuceFall.meta.js — the header block only, about 800 bytes, sent with CORS allowed
    // and max-age=0. It is also exactly what Tampermonkey installs from, so the dot can no longer
    // come before the install works. Up to 6.27 the source was a version.json in the GitHub repo:
    // raw.githubusercontent.com caches for five minutes and, measured 24.09.2026, ignores the
    // query string (x-cache HIT with a random one) — so the dot came 2 to 7 minutes after a
    // release. That file is still written and stays the fallback if Greasy Fork cannot be reached.
    //
    // How often: every two minutes while the tab is visible, once more the moment it becomes
    // visible again (20 s apart at least), never while it is hidden. There is no waiting time on
    // top: 6.26 had 90 s, held only in memory, so every reload started it over, and it bought
    // nothing - raw GitHub hands out a new commit up to five minutes late, and Greasy Fork had
    // 6.26.1 at the same second, so by the time the dot shows the install works.
    //
    // Our own fetch first, the page's as a fallback should the sandbox's ever be refused. Each
    // check leaves one line in the console, so a "no dot" can be read there.
    const UPDATE_META_URL = 'https://update.greasyfork.org/scripts/595115/MarbleLuceFall.meta.js';
    const UPDATE_URL = 'https://raw.githubusercontent.com/CuteLuciii/marbleluce-fall/main/version.json';
    const INSTALL_URL = 'https://update.greasyfork.org/scripts/595115/MarbleLuceFall.user.js';
    const UPDATE_EVERY_MS = 2 * 60 * 1000;
    let updateLatest = null;           // newest version seen, if newer than this one
    let updateCheckedAt = 0;
    let updateBusy = false;

    function updateAvailable() {
        return !!updateLatest;
    }

    async function checkForUpdate() {
        if (updateBusy || document.hidden) return;
        updateBusy = true;
        updateCheckedAt = Date.now();
        try {
            const v = await readLatestVersion();
            updateLatest = /^\d+(\.\d+)*$/.test(v) && cmpVersion(v, SCRIPT_VERSION) > 0 ? v : null;
            console.info('[MarbleLuceFall] update check: installed ' + SCRIPT_VERSION + ', published ' + (v || '?')
                         + (updateLatest ? ' -> update available' : ''));
        } catch (e) {
            // Offline or GitHub unreachable: try again on the next beat.
            console.info('[MarbleLuceFall] update check failed:', e && e.message);
        } finally {
            updateBusy = false;
            showUpdate();
        }
    }

    // Our fetch first, then the page's. Text, parsed here: a Response object handed across
    // from the page is best only asked for plain values.
    // Greasy Fork first, GitHub as the fallback (see above); for each, our fetch and then the page's.
    async function readLatestVersion() {
        const sources = [
            { url: UPDATE_META_URL, read: t => ((/^\/\/\s*@version\s+(\S+)/m.exec(t) || [])[1] || '') },
            { url: UPDATE_URL, read: t => String(JSON.parse(t).version || '') },
        ];
        const pageFetch = typeof unsafeWindow !== 'undefined' && unsafeWindow && unsafeWindow.fetch;
        let lastError = null;
        for (const src of sources) {
            for (const f of [fetch, pageFetch]) {
                if (typeof f !== 'function') continue;
                try {
                    const res = await f.call(f === fetch ? window : unsafeWindow, src.url + '?t=' + Date.now(), { cache: 'no-store', credentials: 'omit' });
                    if (!res.ok) throw new Error('HTTP ' + res.status);
                    const v = String(src.read(String(await res.text()))).trim();
                    if (v) return v;
                    throw new Error('no version in ' + src.url);
                } catch (e) { lastError = e; }
            }
        }
        throw lastError || new Error('no fetch');
    }

    // Called from apply() as well, so the dot comes back when the game rebuilds the card, and
    // shows up once the grace time is over without waiting for the next check.
    function showUpdate() {
        const on = updateAvailable();
        const html = document.documentElement;
        if (on) html.setAttribute('data-mcfo-update', updateLatest); else html.removeAttribute('data-mcfo-update');
        const card = role('profile-entry');
        if (card) {
            let dot = card.querySelector(':scope > .mcfo-updot');
            if (on && !dot) {
                dot = document.createElement('span');
                dot.className = 'mcfo-updot';
                card.appendChild(dot);
            }
            if (dot) dot.title = on ? 'MarbleLuceFall ' + updateLatest + ' is available' : '';
        }
        buildFooterMeta();
    }

    function installUpdate() {
        window.open(INSTALL_URL, '_blank', 'noopener');
    }

    function startUpdateCheck() {
        checkForUpdate();
        setInterval(checkForUpdate, UPDATE_EVERY_MS);
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && Date.now() - updateCheckedAt >= 20 * 1000) checkForUpdate();
        });
    }

