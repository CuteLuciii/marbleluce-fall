    // =========================================================================================
    // 5. WINDOWS
    // =========================================================================================
    // Several pages open at once, each in its own window: movable, resizable, and parkable in a
    // taskbar. The earlier single modal could not do that by construction — one overlay with
    // frames swapped inside it means one page at a time, and a backdrop that dims the board.
    //
    // Everything a window remembers (place, size, parked) is kept per page, so it comes back
    // where you left it.
    const WIN_KEY   = 'mcfo_windows';
    const WIN_MIN_W = 420, WIN_MIN_H = 240;

    // path -> { el, frame, title, min, body, lazy }. A lazy entry is a window parked in an
    // earlier session: it has a taskbar button but no element yet (see restoreParked).
    const windows = new Map();
    let desk = null, taskbar = null, zTop = 10;

    function loadWinState() {
        try { return JSON.parse(localStorage.getItem(WIN_KEY) || '{}') || {}; } catch (e) { return {}; }
    }
    function saveWinState(path, patch) {
        try {
            const all = loadWinState();
            all[path] = Object.assign({}, all[path], patch);
            localStorage.setItem(WIN_KEY, JSON.stringify(all));
        } catch (e) {}
    }

    function buildDesk() {
        if (desk) return;
        desk = document.createElement('div');
        desk.className = 'mcfo-desk';
        document.body.appendChild(desk);

        taskbar = document.createElement('div');
        taskbar.className = 'mcfo-taskbar';
        taskbar.hidden = true;
        document.body.appendChild(taskbar);
    }

    // The taskbar floats just above the game footer, whose height is read rather than assumed.
    // There is no free strip to dock into: measured at 1920x905 the footer carries our own line
    // on the left, the bid area across the middle and the navigation on the right.
    function placeTaskbar() {
        if (!taskbar) return;
        const footer = role('action-region');
        const above = footer ? Math.round(innerHeight - footer.getBoundingClientRect().top) : 56;
        taskbar.style.bottom = (above + 8) + 'px';
    }

    function drawTaskbar() {
        if (!taskbar) return;
        const parked = [...windows.entries()].filter(([, w]) => w.min);
        taskbar.hidden = parked.length === 0;
        taskbar.replaceChildren();
        if (taskbar.hidden) return;
        placeTaskbar();
        for (const [path, w] of parked) {
            const b = document.createElement('button');
            b.type = 'button';
            b.textContent = w.title;
            if (w.badge) {
                const badge = document.createElement('span');
                badge.className = 'mcfo-taskbar__badge';
                badge.textContent = w.badge;
                b.appendChild(badge);
            }
            b.title = 'Restore ' + w.title;
            b.addEventListener('click', () => restoreWindow(path));
            taskbar.appendChild(b);
        }
    }

    function raise(w) { w.el.style.zIndex = String(++zTop); }

    function clampWindow(el, left, top, width, height) {
        const wd = Math.max(WIN_MIN_W, Math.min(width  ?? el.offsetWidth,  innerWidth));
        const ht = Math.max(WIN_MIN_H, Math.min(height ?? el.offsetHeight, innerHeight));
        el.style.width  = Math.round(wd) + 'px';
        el.style.height = Math.round(ht) + 'px';
        el.style.left = Math.round(Math.max(0, Math.min(left, innerWidth  - wd))) + 'px';
        el.style.top  = Math.round(Math.max(0, Math.min(top,  innerHeight - ht))) + 'px';
    }

    function makeWindow(path, title, size) {
        buildDesk();
        const el = document.createElement('div');
        el.className = 'mcfo-win';
        el.innerHTML = '<div class="mcfo-win__head">'
            + '<span class="mcfo-win__title"></span>'
            + '<button type="button" class="mcfo-win__btn" data-mcfo-win="min" title="Minimise">&#8211;</button>'
            + '<button type="button" class="mcfo-win__btn" data-mcfo-win="close" title="Close (Esc)">&#10005;</button>'
            + '</div>'
            + '<div class="mcfo-win__body"></div>'
            + '<div class="mcfo-win__grip" data-edge="se" title="Resize"></div>'
            + ['n', 's', 'e', 'w', 'ne', 'nw', 'sw'].map(e => `<div class="mcfo-win__edge" data-edge="${e}"></div>`).join('');
        el.querySelector('.mcfo-win__title').textContent = title;
        desk.appendChild(el);

        // Where it opens: the last known place, otherwise cascaded so a second window does not
        // land exactly on the first.
        const saved = loadWinState()[path] || {};
        const stufe = windows.size * 28;
        clampWindow(el,
            Number.isFinite(saved.left)   ? saved.left   : 90 + stufe,
            Number.isFinite(saved.top)    ? saved.top    : 70 + stufe,
            Number.isFinite(saved.width)  ? saved.width  : (size?.width  ?? Math.min(1180, innerWidth  * 0.74)),
            Number.isFinite(saved.height) ? saved.height : (size?.height ?? Math.min(800,  innerHeight * 0.76)));

        const w = { el, frame: null, title, min: false, body: el.querySelector('.mcfo-win__body') };
        windows.set(path, w);

        el.addEventListener('pointerdown', () => raise(w), true);
        el.querySelector('[data-mcfo-win="min"]').addEventListener('click', e => { e.stopPropagation(); minimiseWindow(path); });
        el.querySelector('[data-mcfo-win="close"]').addEventListener('click', e => { e.stopPropagation(); closeWindow(path); });
        dragWindow(path, w);
        resizeWindow(path, w);
        raise(w);
        return w;
    }

    // The title is stored with the parked flag: after a reload it is all the taskbar button has.
    function minimiseWindow(path) {
        const w = windows.get(path);
        if (!w || !w.el) return;
        w.min = true;
        w.el.hidden = true;
        // The chat's counter starts at this very moment. Set later, on the next pass, lines
        // arriving in between would already count as seen.
        if (path === CHAT_WIN) markChatForPark();
        saveWinState(path, { min: true, title: w.title });
        drawTaskbar();
    }

    function restoreWindow(path) {
        const w = windows.get(path);
        if (!w) return;
        // Parked in an earlier session: build the window now, on demand. Loading every parked
        // page at startup would cost several page loads before the board is even up.
        if (w.lazy) {
            windows.delete(path);
            // No longer parked — or it would come back to the taskbar on the next load while
            // actually standing open.
            saveWinState(path, { min: false });
            // Windows of our own are rebuilt by their opener; anything else is a page.
            const own = { [SETTINGS_KEY]: showSettings, [HOWTO_KEY]: showHowTo, [CHANGELOG_KEY]: showChangelog, [WHATSNEW_KEY]: showWhatsNew }[path];
            if (own) own(); else openPage(path, w.title);
            return;
        }
        w.min = false;
        w.el.hidden = false;
        raise(w);
        saveWinState(path, { min: false });
        drawTaskbar();
        if (w.frame) frameFreshCheck(w);   // parked through a game update? (6.41)
    }

    // Stale pages (6.41). The game sends its pages without a Cache-Control header, so the browser
    // may keep using an old copy for a while after an update - and that copy loads the OLD build's
    // scripts. A window parked before an update keeps its page as well. (29.09.2026: the inventory's
    // new unlock info stayed missing until Ctrl+Shift+R.) Every page names its build in
    // /immutable-assets/<build>/; when a window shows another build than a fresh copy of "/", the
    // window reloads. Once per build and window, so a check that cannot fix it never loops.
    const assetBuildOf = text => { const m = /\/immutable-assets\/([^/"'?#\s]+)\//.exec(text || ''); return m ? m[1] : ''; };
    const liveBuild = { at: 0, p: null };
    function latestAssetBuild() {
        if (liveBuild.p && Date.now() - liveBuild.at < 60000) return liveBuild.p;
        liveBuild.at = Date.now();
        liveBuild.p = fetch('/', { cache: 'no-store', credentials: 'same-origin' })
            .then(r => (r.ok ? r.text() : '')).then(assetBuildOf).catch(() => '');
        return liveBuild.p;
    }
    async function frameFreshCheck(w) {
        const f = w && w.frame;
        let doc, url;
        try { doc = f && f.contentDocument; url = doc && f.contentWindow.location.href; } catch (e) { return; }
        if (!doc || !doc.documentElement) return;
        const have = assetBuildOf([...doc.querySelectorAll('script[src], link[href]')]
            .map(el => el.getAttribute('src') || el.getAttribute('href')).join(' '));
        if (!have) return;
        const now = await latestAssetBuild();
        if (!now || now === have || w.freshFor === now || f.contentDocument !== doc) return;
        w.freshFor = now;
        console.info('[MarbleLuceFall] window page from build ' + have + ', game is on ' + now + ': reloading');
        // Refresh the cached copy first; the reload itself revalidates as well.
        try { await fetch(url, { cache: 'reload', credentials: 'same-origin' }); } catch (e) {}
        f.removeAttribute('data-mcfo-ready');
        try { f.contentWindow.location.reload(); } catch (e) { f.src = url; }
    }

    function closeWindow(path) {
        const w = windows.get(path);
        if (!w) return;
        // A window may hold something that is not ours to destroy (the chat): it takes it out first.
        if (w.onClose) { try { w.onClose(); } catch (e) { console.warn('[MarbleLuceFall] window close:', e.message); } }
        if (w.el) w.el.remove();   // the frame goes with it — park it instead to keep it loaded
        windows.delete(path);
        // Up to 3.7 the parked flag outlived the window. Harmless then, because nothing read it
        // back; now it would bring a closed window back into the taskbar on the next load.
        saveWinState(path, { min: false });
        drawTaskbar();
    }

    // Windows that were parked when the page was left come back as taskbar buttons — across a
    // reload and across closing the browser, like position and size already did. Only entries
    // with a title count: 3.7 stored the flag without one, and those were never meant to return.
    function restoreParked() {
        const all = loadWinState();
        let any = false;
        for (const [path, st] of Object.entries(all)) {
            if (!st || st.min !== true || !st.title || windows.has(path)) continue;
            if (path === CHAT_WIN) continue;   // the chat restores itself (section 9e)
            windows.set(path, { el: null, frame: null, title: String(st.title), min: true, body: null, lazy: true });
            any = true;
        }
        if (!any) return;
        buildDesk();
        drawTaskbar();
    }

    // ---- BUYING DIAMONDS FROM A WINDOW: STRIPE IN ITS OWN BROWSER WINDOW ----
    // "Continue to Stripe Checkout" is not a link. On click the packages page asks the game server
    // for a checkout session (POST /api/payments/checkout), gets back a one-time Stripe address
    // (checkoutUrl) and then sends ITS OWN frame there (location.href = checkoutUrl). Inside one
    // of our windows that frame is an iframe, and Stripe refuses to be shown in a frame — up to
    // 4.0 the window just stayed white.
    //
    // So the packages page gets a small script of its own (this script does not run inside
    // frames, see the top): on the click it opens an empty browser window at once — later the
    // popup blocker would stop it —, reads the Stripe address from the server's answer and loads
    // it there. The page is handed a harmless in-page jump instead of the Stripe address, so the
    // window with the packages stays as it is. Nothing about the purchase itself is touched: the
    // game's own button creates the session, and paying happens entirely on Stripe's page.
    // If no window could be opened, the whole tab goes to Stripe, as it would without this script.
    // The packages page sends no Content-Security-Policy, so an injected script runs as is.
    function stripeHandoff() {
        if (window.__mcfoStripeHandoff) return;
        window.__mcfoStripeHandoff = true;
        const BUTTON_TEXT = /stripe checkout/i;
        const CHECKOUT_API = /\/api\/payments\/checkout(?:[?#]|$)/;
        let popup = null;

        document.addEventListener('click', e => {
            const b = e.target && e.target.closest ? e.target.closest('button') : null;
            if (!b || b.disabled || !BUTTON_TEXT.test(b.textContent || '')) return;
            try {
                popup = window.open('', 'mcfo-stripe', 'popup,width=620,height=860');
                if (popup) {
                    popup.document.title = 'Stripe Checkout';
                    popup.document.body.style.cssText = 'margin:0;display:grid;place-items:center;height:100vh;'
                        + 'background:#0b121a;color:#cfe2f2;font:600 15px system-ui,sans-serif';
                    popup.document.body.textContent = 'Opening Stripe Checkout\u2026';
                    popup.opener = null;   // Stripe's page gets no handle on the game
                }
            } catch (err) { popup = null; }
        }, true);

        const originalFetch = window.fetch;
        window.fetch = async function (input, init) {
            const res = await originalFetch.apply(this, arguments);
            let url = '';
            try { url = typeof input === 'string' ? input : (input && input.url) || ''; } catch (err) {}
            if (!CHECKOUT_API.test(new URL(url, location.href).pathname + '')) return res;

            const win = popup;
            popup = null;
            let data = null;
            try { data = await res.clone().json(); } catch (err) {}
            const target = data && typeof data.checkoutUrl === 'string' ? data.checkoutUrl : '';
            if (!res.ok || !target) {          // the game refused: its message shows on the page
                if (win && !win.closed) win.close();
                return res;
            }
            if (!win || win.closed) {          // no window (popup blocker): the whole tab goes
                window.top.location.href = target;
                return res;
            }
            win.location.href = target;
            try { win.focus(); } catch (err) {}
            setTimeout(() => {
                const status = document.getElementById('payment-status');
                if (status) { status.className = ''; status.textContent = 'Stripe Checkout opened in its own window.'; }
                for (const b of document.querySelectorAll('button')) if (BUTTON_TEXT.test(b.textContent || '')) b.disabled = false;
            }, 0);
            const body = JSON.stringify(Object.assign({}, data, { checkoutUrl: '#stripe-checkout-opened' }));
            return new Response(body, { status: res.status, statusText: res.statusText, headers: res.headers });
        };
    }

    function armStripeHandoff(frame) {
        let doc = null;
        try { doc = frame.contentDocument; } catch (e) { return; }
        if (!doc || !doc.documentElement || !/^\/payment\//.test(doc.location.pathname)) return;
        if (doc.getElementById('mcfo-stripe-handoff')) return;
        const sc = doc.createElement('script');
        sc.id = 'mcfo-stripe-handoff';
        sc.textContent = '(' + stripeHandoff.toString() + ')();';
        (doc.head || doc.documentElement).appendChild(sc);
    }

    function openPage(path, title) {
        const vorhanden = windows.get(path);
        if (vorhanden) { restoreWindow(path); return vorhanden; }

        const w = makeWindow(path, title);
        // Dailies (6.35): the page reads its quests once, when it loads. A refresh button in the
        // title bar loads just that page again, so progress shows without closing the window.
        if (path === '/dailies') {
            const re = document.createElement('button');
            re.type = 'button';
            re.className = 'mcfo-win__btn';
            re.setAttribute('data-mcfo-win', 'reload');
            re.title = 'Refresh';
            re.innerHTML = '&#8635;';
            re.addEventListener('click', e => {
                e.stopPropagation();
                const f = w.frame;
                if (!f) return;
                // Hidden until it wears the theme again, like on opening; the load handler shows it.
                f.removeAttribute('data-mcfo-ready');
                try { f.contentWindow.location.reload(); } catch (err) { f.src = path; }
                setTimeout(loadDailies, 1500);   // the dots on the page outside follow along
            });
            w.el.querySelector('.mcfo-win__head').insertBefore(re, w.el.querySelector('[data-mcfo-win="min"]'));
        }
        const laedt = document.createElement('div');
        laedt.className = 'mcfo-loading';
        laedt.textContent = 'Loading …';
        w.body.appendChild(laedt);

        const frame = document.createElement('iframe');
        frame.src = path;
        // The page stays invisible until it wears the theme (6.6): shown at once, it came up in the
        // game's own colours and changed a moment later — a flash on every window that opened.
        frame.addEventListener('load', () => {
            try {
                framePanelMode(frame); armStripeHandoff(frame); applyGlassToFrames(); laedt.remove();
                themeFrame(frame);      // the page inside takes the theme as well (section 3b)
                try { shopDocAssist(frame.contentDocument); } catch (e) {}   // quest tags, euros (12d)
                try { invDocAssist(frame.contentDocument); } catch (e) {}    // loadout bar (12e)
            } finally {
                frame.setAttribute('data-mcfo-ready', '1');
            }
            frameFreshCheck(w);   // an old copy from the browser cache? (6.41)
        });
        w.body.appendChild(frame);
        w.frame = frame;
        framePanelMode(frame);
        drawTaskbar();
        return w;
    }

    // Caught in the capture phase, before the game sees the click, so its own navigation stays
    // completely intact — switching the feature off behaves exactly as before.
    //
    // This is what actually routes the footer buttons. Everything else reaches openPage() through
    // the account menu or a header card, so when this listener went missing in the 3.0 rewrite
    // only "How to Play" and "Terms" fell back to full page loads — they are the only two whose
    // sole route is their own button.
    document.addEventListener('click', e => {
        if (!settings.pageOverlay) return;
        const button = e.target && e.target.closest && e.target.closest('[data-role]');
        const page = button ? PAGES[button.getAttribute('data-role')] : linkTarget(e);
        if (!page) return;
        e.preventDefault();
        e.stopPropagation();
        openPage(page.path, page.title);
        // A toast that linked here has done its job; the game's own navigation would have taken
        // it off screen, so leaving it hovering over the window we just opened would be worse.
        //
        // Its own button is the only correct way out: achievementToasts.js waits on a promise
        // that the button resolves, and only then removes the toast, disconnects two observers
        // and pumps the next one out of the queue. Ripping the element out instead would leave
        // that queue stalled for the full five seconds. No button, no action — the game clears
        // the toast on its own timer anyway.
        const toast = e.target.closest && e.target.closest('.mcfAchievementToast');
        const dismiss = toast && toast.querySelector('.mcfAchievementToastDismiss');
        if (dismiss) dismiss.click();
    }, true);

    // A plain link to one of our pages — same rules a browser uses for "this stays in the tab":
    // left button, no modifier, no target, same origin. Anything else (middle click, ctrl-click,
    // a real new tab) is left alone, because that is the user asking for a second tab on purpose.
    function linkTarget(e) {
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return null;
        const a = e.target && e.target.closest && e.target.closest('a[href]');
        if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return null;
        let url;
        try { url = new URL(a.getAttribute('href'), location.href); } catch (err) { return null; }
        if (url.origin !== location.origin) return null;
        return PAGE_BY_PATH.get(url.pathname.replace(/\/+$/, '')) || null;
    }

    // Esc closes the topmost open window — the one you were last in.
    document.addEventListener('keydown', e => {
        if (e.key !== 'Escape') return;
        // Not while typing: Esc in the chat field would otherwise dock the popped-out chat.
        if (e.target && e.target.closest && e.target.closest('input, textarea, select, [contenteditable="true"]')) return;
        const offen = [...windows.entries()].filter(([, w]) => !w.min);
        if (offen.length) {
            offen.sort((x, y) => Number(y[1].el.style.zIndex || 0) - Number(x[1].el.style.zIndex || 0));
            closeWindow(offen[0][0]);
            return;
        }
        closeMenus();
    });

    // Pointer events rather than mouse events: they cover touch and pen, and setPointerCapture
    // keeps the gesture alive when the pointer crosses an iframe. Without that the frame would
    // swallow the movement and the window would stick.
    function dragWindow(path, w) {
        const head = w.el.querySelector('.mcfo-win__head');
        let zieht = false, dx = 0, dy = 0;
        head.addEventListener('pointerdown', e => {
            if (e.button !== 0 || e.target.closest('.mcfo-win__btn')) return;
            const r = w.el.getBoundingClientRect();
            dx = e.clientX - r.left; dy = e.clientY - r.top;
            zieht = true; head.setPointerCapture(e.pointerId); e.preventDefault();
        });
        head.addEventListener('pointermove', e => {
            if (!zieht) return;
            clampWindow(w.el, e.clientX - dx, e.clientY - dy);
        });
        const stop = e => {
            if (!zieht) return;
            zieht = false;
            try { head.releasePointerCapture(e.pointerId); } catch (err) {}
            saveWinState(path, { left: parseInt(w.el.style.left, 10), top: parseInt(w.el.style.top, 10) });
        };
        head.addEventListener('pointerup', stop);
        head.addEventListener('pointercancel', stop);
    }

    // Every edge and corner resizes (6.59), not only the grip bottom right. The opposite edge stays
    // where it is: dragging the left edge moves the window's left side, the right one holds.
    function resizeWindow(path, w) {
        for (const h of w.el.querySelectorAll('[data-edge]')) {
            let zieht = false, x0 = 0, y0 = 0, r0 = null;
            h.addEventListener('pointerdown', e => {
                if (e.button !== 0) return;
                // The window's own numbers, not getBoundingClientRect: that one counts the border too,
                // and every drag made the window a few pixels larger (the old grip did that as well).
                const st = w.el.style, l = parseInt(st.left, 10) || 0, t = parseInt(st.top, 10) || 0,
                      wd = parseInt(st.width, 10) || w.el.offsetWidth, ht = parseInt(st.height, 10) || w.el.offsetHeight;
                r0 = { left: l, top: t, width: wd, height: ht, right: l + wd, bottom: t + ht };
                x0 = e.clientX; y0 = e.clientY;
                zieht = true; h.setPointerCapture(e.pointerId); e.preventDefault(); e.stopPropagation();
            });
            h.addEventListener('pointermove', e => {
                if (!zieht) return;
                const edge = h.dataset.edge, dx = e.clientX - x0, dy = e.clientY - y0;
                let left = r0.left, top = r0.top, wd = r0.width, ht = r0.height;
                if (edge.includes('e')) wd = r0.width + dx;
                if (edge.includes('s')) ht = r0.height + dy;
                if (edge.includes('w')) { wd = Math.max(WIN_MIN_W, r0.width - dx); left = r0.right - wd; }
                if (edge.includes('n')) { ht = Math.max(WIN_MIN_H, r0.height - dy); top = r0.bottom - ht; }
                if (left < 0) { wd += left; left = 0; }
                if (top < 0) { ht += top; top = 0; }
                clampWindow(w.el, left, top, wd, ht);
            });
            const stop = e => {
                if (!zieht) return;
                zieht = false;
                try { h.releasePointerCapture(e.pointerId); } catch (err) {}
                saveWinState(path, { left: parseInt(w.el.style.left, 10), top: parseInt(w.el.style.top, 10),
                                     width: parseInt(w.el.style.width, 10), height: parseInt(w.el.style.height, 10) });
            };
            h.addEventListener('pointerup', stop);
            h.addEventListener('pointercancel', stop);
        }
    }

    // A window that no longer fits a shrunken viewport is pulled back into view.
    addEventListener('resize', () => {
        for (const w of windows.values()) {
            if (!w.el) continue;
            clampWindow(w.el, parseInt(w.el.style.left, 10) || 0, parseInt(w.el.style.top, 10) || 0);
        }
        placeTaskbar();
    });

    // The glass switch lives in the parent, the tint in each embedded document — so the class has
    // to be pushed across whenever it changes.
    function applyGlassToFrames() {
        const alpha = document.documentElement.style.getPropertyValue('--mcfo-glass-a') || '0.78';
        for (const w of windows.values()) {
            const root = w.frame && w.frame.contentDocument && w.frame.contentDocument.documentElement;
            if (!root) continue;
            root.classList.toggle('mcfo-glass', !!settings.glassOverlays);
            root.style.setProperty('--mcfo-glass-a', alpha);
        }
    }

    // The two sliders act through CSS variables on <html>, so moving them repaints at once and
    // nothing has to be rebuilt. See-through is the inverse of the tint: 22% lets 22% of the
    // board through, which is the 0.78 tint 3.7 had fixed.
    function applyTunables() {
        const root = document.documentElement.style;
        const alpha = 1 - settings.glassLevel / 100;
        root.setProperty('--mcfo-glass-a', alpha.toFixed(2));
        // The title bar a touch denser than the page, as before (0.82 over 0.78).
        root.setProperty('--mcfo-glass-head', Math.min(0.97, alpha + 0.04).toFixed(2));
        root.setProperty('--mcfo-drink-scale', (settings.drinkScale / 100).toFixed(2));
        root.setProperty('--mcfo-tsb-scale', (settings.tilesetBannerSize / 100).toFixed(2));
        root.setProperty('--mcfo-kc-scale', (settings.kingCornerSize / 100).toFixed(2));
        root.setProperty('--mcfo-kc-alpha', (settings.kingCornerAlpha / 100).toFixed(2));
        writeKingCornerFlags();
    }

    const SHOP_TO_INVENTORY = {
        'Chat Font Color':        'chat_font_colors',
        'Chat Background Style':  'chat_background_style',
        'Username Style':         'username_style',
        'King Chat Bubble Style': 'king_chat_bubble_style',
    };


    function inventoryTargetFor(doc, link) {
        // Since v0.10.0 the game writes the section into the link itself (shop.js inventoryHref:
        // /inventory?page=…). Where it does, that is the answer; the guesses below are for builds
        // that did not.
        try {
            const page = new URL(link.getAttribute('href') || '', location.origin).searchParams.get('page');
            if (page) return page;
        } catch (e) {}

        // Which shop is on screen: the type button carries aria-current="page".
        const kind = doc.querySelector('.shopTypeButton[aria-current="page"]')?.getAttribute('data-shop-kind');
        if (kind === 'crowns') return 'crowns';
        if (kind === 'marbles') return 'marble_trails';   // the Marble Shop sells trails (v0.10.0)

        // In the chat shop the section depends on the selected offer. Its category is printed in
        // the detail panel, next to this very link — matched by text against the four known
        // labels rather than by position, because that block also holds descriptions and notices.
        for (const p of link.parentElement?.querySelectorAll('p') || []) {
            const target = SHOP_TO_INVENTORY[(p.textContent || '').trim()];
            if (target) return target;
        }
        return null;   // still opens the inventory, just without a section
    }

    function openInventoryAt(pageId) {
        openPage('/inventory', 'Inventory');
        const frame = windows.get('/inventory') && windows.get('/inventory').frame;
        if (!frame || !pageId) return;

        // The frame may be loading for the first time or already warm, so this simply waits for
        // the button to turn up. Roughly three seconds, then it gives up and leaves the
        // inventory on its front page — which is still better than where the link went.
        const clickTab = (attempt = 0) => {
            const doc = frame.contentDocument;
            const tab = doc && doc.querySelector(
                `button.inventorySubcategoryButton[data-subpage="${pageId}"]`);
            if (tab && !tab.disabled) {
                if (tab.getAttribute('aria-current') !== 'page') tab.click();
                return;
            }
            if (attempt < 20) setTimeout(() => clickTab(attempt + 1), 150);
        };
        clickTab();
    }

    function framePanelMode(frame) {
        const doc = frame.contentDocument;
        if (!doc || !doc.head || doc.getElementById('mcfo-panel-css')) return;
        const style = doc.createElement('style');
        style.id = 'mcfo-panel-css';
        // The embedded page's own header and footer would be a second navigation next to the
        // game's, and its heading is already in the panel bar.
        // The tint is applied by the page itself, keyed on a class the parent toggles. Painting
        // it here rather than on the panel keeps a single translucent layer instead of two
        // stacked ones, and keeps every page on a dark ground regardless of the color-scheme it
        // declares — /payment/packages says "normal" and would otherwise fall back to white.
        //
        // ON BODY ONLY, NEVER ON BOTH. Tinting html and body at 0.78 each stacks to 1-0.22^2 =
        // 0.95, which is what made this look untouched the first time round: 4% of the board came
        // through instead of 19%. The root is cleared instead, and the body's background is then
        // propagated to the canvas by the CSS background-propagation rule — painted exactly once,
        // covering the whole frame, and with no white fallback anywhere.
        // Profile and Leaderboards (trackb.css) wrap the page in .trackb-shell with a background
        // of its own, full height — it covered the body, and with it the glass, the theme's
        // pattern and a Deluxe skin's ground (6.38.4). Cleared, like the other pages' grounds.
        style.textContent = `.mcfPageHeader, .mcfPageFooter, nav.mcfPageNav { display: none !important; }
                             .trackb-shell { background: transparent !important; }
                             .mcfPageContent { padding-top: 12px !important; }
                             html.mcfo-glass { color-scheme: dark; background: transparent !important; }
                             html.mcfo-glass body { background: rgba(var(--mcfo-glass-rgb, 11, 18, 26), var(--mcfo-glass-a, 0.78)) !important; }`;
        doc.head.appendChild(style);

        // Bound once per frame document, in the capture phase so the anchor never navigates.
        doc.addEventListener('click', e => {
            if (!settings.pageOverlay) return;
            const link = e.target.closest && e.target.closest('a.shopInventoryLink');
            if (!link) return;
            e.preventDefault();
            e.stopPropagation();
            openInventoryAt(inventoryTargetFor(doc, link));
        }, true);
    }

