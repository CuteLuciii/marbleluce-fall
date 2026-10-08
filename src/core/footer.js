    // =========================================================================================
    // 12. FOOTER: SEASON, EPISODE, BUILD
    // =========================================================================================
    // Season and episode lived inside the tileset card and filled its upper line to within 9px
    // of the edge — which is exactly what the Events chip had to dodge. Moved down here both
    // problems go away at once, and the strip at the bottom left was empty anyway.
    //
    // The original is hidden, not moved: the game rebuilds that card, and a node taken out of it
    // would be destroyed on the next pass (the same lesson as the king tray). The text is copied
    // instead, so whatever the game puts there keeps showing.
    //
    // The build number comes from /api/version, which the game itself never displays. Fetched
    // once — it only changes on a deploy, and a reload comes with that anyway.
    let buildId = null;

    async function loadBuildId() {
        if (buildId !== null) return;
        try {
            const res = await fetch('/api/version', { credentials: 'include' });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const data = await res.json();
            buildId = String(data.buildId || data.serverBuildId || '').trim() || null;
            buildFooterMeta();
        } catch (e) {
            buildId = null;   // simply stays away; not worth a message
        }
    }

    function buildFooterMeta() {
        const region = role('action-region');
        if (!region) return;
        document.documentElement.setAttribute('data-mcfo-footermeta', settings.footerMeta ? '1' : '0');

        let strip = region.querySelector(':scope > .mcfo-footermeta');
        if (!settings.footerMeta) { if (strip) strip.remove(); return; }

        if (!strip) {
            strip = document.createElement('div');
            strip.className = 'mcfo-footermeta';
            strip.innerHTML = '<span class="mcfo-footermeta__window"></span>'
                            + '<span class="mcfo-footermeta__build"></span>'
                            + '<span class="mcfo-footermeta__mlf"></span>'
                            + '<button type="button" class="mcfo-footermeta__update" hidden></button>';
            strip.querySelector('.mcfo-footermeta__update').addEventListener('click', installUpdate);
            region.prepend(strip);
        }

        const source = role('stat-window-indicator');
        const windowText = (source?.textContent || '').trim().replace(/\s+/g, ' ');
        const windowEl = strip.querySelector('.mcfo-footermeta__window');
        if (windowText && windowEl.textContent !== windowText) windowEl.textContent = windowText;

        const buildEl = strip.querySelector('.mcfo-footermeta__build');
        // Labelled, so it is clear which number is whose: the game's build and this script.
        const want = buildId ? '· MCF ' + buildId : '';
        if (buildEl.textContent !== want) buildEl.textContent = want;
        const mlfEl = strip.querySelector('.mcfo-footermeta__mlf');
        const mlf = '· MLF ' + SCRIPT_VERSION;
        if (mlfEl.textContent !== mlf) mlfEl.textContent = mlf;
        const upEl = strip.querySelector('.mcfo-footermeta__update');
        const up = updateAvailable() ? 'update to ' + updateLatest : '';
        if (upEl.textContent !== up) upEl.textContent = up;
        upEl.hidden = !up;
    }

