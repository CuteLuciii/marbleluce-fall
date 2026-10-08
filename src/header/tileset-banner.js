    // =========================================================================================
    // 12b. TILESET BANNER: THE NAME INSTEAD OF THE SPLASH PICTURE (6.24)
    // =========================================================================================
    // At the start of a tileset the game fades in a picture over a 92% black curtain that covers
    // the whole board, for seven seconds all told. Here the curtain and the picture are hidden by
    // CSS and a line of text goes into the same overlay — so the game still decides when it fades
    // in and out, and nothing of its timing has to be copied.
    //
    // The name is read when the game sets the picture's src: in the same task, just before, it has
    // already written the new tileset into the header indicator (setActiveTilesetFromCanonicalId
    // runs ahead of the splash). That is the raw id, "RiskyBusiness", so it goes through
    // tilesetName() like the schedule. The picture's slug is only the fallback.
    let tsBannerObserver = null;

    function tsBannerText(img) {
        const shown = (role('current-tileset-name')?.textContent || '').trim();
        if (shown) return tilesetName(shown);
        const slug = ((img.getAttribute('src') || '').match(/([^/]+)\.webp/) || [])[1] || '';
        return slug.split('-').filter(Boolean).map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
    }

    // "Show now" in the settings, so the look can be judged without waiting for the next tileset.
    // It plays the game's own overlay with the game's own timing (1 s in, 3 s held, 3 s out) and
    // the current tileset's name. The settings window would cover the board, so it goes to the
    // taskbar for the length of it and comes back afterwards. A real transition arriving meanwhile
    // simply takes over the overlay.
    let tsPreviewTimer = 0;
    function previewTilesetBanner() {
        buildTilesetBanner();
        const img = role('tileset-transition-splash-image');
        const overlay = role('tileset-transition-splash-overlay');
        const banner = img && img.parentElement && img.parentElement.querySelector(':scope > .mcfo-tsbanner');
        if (!overlay || !banner) return;   // not on the board page: nothing to show it on
        banner.querySelector('.mcfo-tsbanner__name').textContent = tilesetName((role('current-tileset-name')?.textContent || '').trim()) || 'Base Set';
        const parked = windows.has(SETTINGS_KEY) && !windows.get(SETTINGS_KEY).min;
        if (parked) minimiseWindow(SETTINGS_KEY);
        clearTimeout(tsPreviewTimer);
        overlay.style.transition = 'opacity 1000ms ease';
        overlay.style.visibility = 'visible';
        overlay.style.opacity = '0';
        void overlay.offsetWidth;
        overlay.style.opacity = '1';
        tsPreviewTimer = setTimeout(() => {
            overlay.style.transition = 'opacity 3000ms ease';
            overlay.style.opacity = '0';
            tsPreviewTimer = setTimeout(() => {
                overlay.style.visibility = 'hidden';
                if (parked) restoreWindow(SETTINGS_KEY);
            }, 3000);
        }, 4000);
    }

    function buildTilesetBanner() {
        document.documentElement.setAttribute('data-mcfo-tsbanner', settings.tilesetBanner ? '1' : '0');
        const img = role('tileset-transition-splash-image');
        if (!img || !img.parentElement) return;
        let banner = img.parentElement.querySelector(':scope > .mcfo-tsbanner');
        if (!settings.tilesetBanner) {
            if (banner) banner.remove();
            if (tsBannerObserver) { tsBannerObserver.disconnect(); tsBannerObserver = null; }
            return;
        }
        if (!banner) {
            banner = document.createElement('div');
            banner.className = 'mcfo-tsbanner';
            banner.innerHTML = '<div class="mcfo-tsbanner__kicker">New tileset</div>'
                             + '<div class="mcfo-tsbanner__name"></div>';
            img.parentElement.appendChild(banner);
        }
        const fill = () => {
            if (!img.getAttribute('src')) return;   // cleared after the fade-out; keep the old text
            const name = banner.querySelector('.mcfo-tsbanner__name');
            const text = tsBannerText(img);
            if (name.textContent !== text) name.textContent = text;
        };
        if (!tsBannerObserver || tsBannerObserver.img !== img) {
            if (tsBannerObserver) tsBannerObserver.disconnect();
            tsBannerObserver = new MutationObserver(fill);
            tsBannerObserver.img = img;
            tsBannerObserver.observe(img, { attributes: true, attributeFilter: ['src'] });
        }
        fill();
    }

