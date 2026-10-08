    // =========================================================================================
    // 9d. CHAT RAIL
    // =========================================================================================
    // The rail sits inside the chat element (which the game builds once and keeps), covers it
    // while collapsed, and presses the game's own collapse button when clicked.
    //
    // The unread counter cannot key on message ids: the chat rebuilds its whole list on every
    // render (els.messages.innerHTML = '' in chatPane.js) and puts no id on the rows. So at the
    // moment of collapsing, the last visible line is remembered by its text, and everything
    // below it is new. Lines hidden by the chat script's filter (data-mcf-filter) do not count.
    // Should the remembered line have scrolled out of the game's buffer, there is no telling how
    // many came — the badge then shows a dot instead of inventing a number.
    let railMark = null;
    let railTimer = 0;

    // The game always starts with the chat open and remembers nothing. The state is kept here
    // and put back once on load by pressing the game's own button, exactly as a click would.
    // Recording only starts after that, so the page's initial "open" never overwrites it.
    const CHAT_COLLAPSED_KEY = 'mcfo_chat_collapsed';
    let chatRestored = false;
    let chatSaved = null;
    let relayoutBusy = false;

    // Making the game size its lanes again. It does that in fixed pixels, and only when the chat
    // is collapsed or opened (app.js: onCollapseChange -> ui.setLayoutMode -> the lane grid).
    // A window resize does NOT do it on the desktop layout: updateLayoutMode only re-applies the
    // layout when the mode changes — the resize nudge of 3.14 therefore did nothing at all.
    // When the script changes the chat column itself (pop-out, docking), the one way left is the
    // game's own button, pressed twice in one go: the chat ends up as it was, the game has
    // measured the new width, and no frame is painted in between.
    function relayoutGame() {
        const chat = chatRoot();
        const toggle = chat && chat.querySelector('[data-role="chat-collapse"]');
        if (!toggle) return;
        relayoutBusy = true;
        try { toggle.click(); toggle.click(); } finally { relayoutBusy = false; }
    }

    // The same after the window changes size (6.12). The game keeps the lane grid of the old size
    // in pixels (app.js syncActionAwareMainGrid, only called from setLayoutMode), so a smaller
    // window, or the move to another screen, left the board at its old size, cut down by
    // max-width/max-height, with the room around it unused. Once the resizing has stopped, and
    // only in the desktop layout: the portrait and landscape layouts size themselves.
    // Also called when the king's tray changes height (watchTrayHeight, 6.13).
    let refitTimer = 0;
    function refitSoon() {
        clearTimeout(refitTimer);
        refitTimer = setTimeout(() => {
            if (!settings.boardRefit) return;
            const mode = (role('shell') || { getAttribute: () => null }).getAttribute('data-layout-mode');
            if (mode && mode !== 'desktop') return;
            relayoutGame();
            placeKingTray();
            placeChat();
        }, 250);
    }
    addEventListener('resize', refitSoon);

    // Smooth collapse and opening without misleading the game (FLIP: first, last, invert, play).
    // The game measures its lanes in the moment the button is pressed, so the layout has to jump.
    // What glides is only the picture: the lanes, the king tile and the chat column are measured
    // just before and just after the click, put back where they were with translate/scale, and
    // let go. Transforms change no layout, so neither the game's measurement nor its
    // ResizeObserver ever sees the motion, and the compositor does the work — a CSS transition
    // runs even when the fps cap holds the page's animation frames back.
    // Individual translate/scale properties rather than transform: they add to a transform an
    // element may already have instead of replacing it.
    const GLIDE_MS = 340;
    const GLIDE_EASE = 'cubic-bezier(0.32, 0.72, 0, 1)';
    let glideBefore = null;
    let glideTimer = 0;

    function glideParts() {
        const parts = [...document.querySelectorAll('[data-role="main-region"] [data-role="lane-panel"], [data-role="main-region"] [data-role="king-pane"]')];
        const pane = role('desktop-chat-pane');
        if (pane) parts.push(pane);
        return parts;
    }

    function glideReset() {
        clearTimeout(glideTimer);
        for (const el of document.querySelectorAll('[data-mcfo-glide]')) {
            el.style.transition = ''; el.style.translate = ''; el.style.scale = '';
            el.removeAttribute('data-mcfo-glide');
        }
    }

    // Capture phase: "before" is read while the old layout still stands — including a glide that
    // is still running, so a quick second click continues from where the picture actually is.
    document.addEventListener('click', e => {
        glideBefore = null;
        if (relayoutBusy || !settings.chatRail) return;
        const html = document.documentElement;
        if (html.hasAttribute('data-mcfo-chat-instant') || html.getAttribute('data-mcfo-chatpop') === '1') return;
        const toggle = e.target && e.target.closest && e.target.closest('[data-role="chat-collapse"]');
        if (!toggle || !toggle.closest('[data-role="lane-play-region"]')) return;
        glideBefore = glideParts().map(el => ({ el, r: el.getBoundingClientRect() }));
    }, true);

    // Bubble phase: the game's own listener on the button has run, the new layout stands. All of
    // this happens inside the same click, so no frame is painted between the jump and the undo.
    document.addEventListener('click', () => {
        const before = glideBefore;
        glideBefore = null;
        if (before) glideChat(before);
    });

    function glideChat(before) {
        glideReset();   // "after" must be the plain new layout, not a picture of the last glide
        const moves = [];
        for (const { el, r: b } of before) {
            if (!el.isConnected) continue;
            const a = el.getBoundingClientRect();
            if (!a.width || !a.height || !b.width || !b.height) continue;
            // The chat column only moves its left edge; it is slid along, never stretched.
            // Lanes and king tile keep their aspect ratio, so they are scaled from their centre.
            const isChat = el.getAttribute('data-role') === 'desktop-chat-pane';
            const dx = isChat ? b.left - a.left : (b.left + b.width / 2) - (a.left + a.width / 2);
            const dy = isChat ? 0 : (b.top + b.height / 2) - (a.top + a.height / 2);
            const sx = isChat ? 1 : b.width / a.width;
            const sy = isChat ? 1 : b.height / a.height;
            if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5 && Math.abs(sx - 1) < 0.002 && Math.abs(sy - 1) < 0.002) continue;
            moves.push({ el, dx, dy, sx, sy });
        }
        if (!moves.length) return;
        for (const m of moves) {
            m.el.setAttribute('data-mcfo-glide', '');
            m.el.style.transition = 'none';
            m.el.style.translate = `${m.dx}px ${m.dy}px`;
            m.el.style.scale = `${m.sx} ${m.sy}`;
        }
        void document.body.offsetWidth;   // commit the starting point before letting go
        for (const m of moves) {
            m.el.style.transition = `translate ${GLIDE_MS}ms ${GLIDE_EASE}, scale ${GLIDE_MS}ms ${GLIDE_EASE}`;
            m.el.style.translate = '0px 0px';
            m.el.style.scale = '1 1';
        }
        glideTimer = setTimeout(glideReset, GLIDE_MS + 80);
    }

    function chatRoot() {
        return document.querySelector('[data-role="desktop-chat-pane"] .mcf-chat') || null;
    }

    function visibleChatLines(chat) {
        const list = chat.querySelector('[data-role="chat-messages"], .mcf-chat__messages');
        if (!list) return [];
        return [...list.querySelectorAll('article.mcf-chat__message')].filter(m => !m.hasAttribute('data-mcf-filter'));
    }
    const lineKey = m => (m.textContent || '').replace(/\s+/g, ' ').trim();

    function drawChatRail() {
        const chat = chatRoot();
        if (!chat) return;
        const on = !!settings.chatRail;
        let rail = chat.querySelector(':scope > .mcfo-chatrail');
        if (!on) { if (rail) rail.remove(); railMark = null; return; }

        if (!rail) {
            rail = document.createElement('div');
            rail.className = 'mcfo-chatrail';
            rail.title = 'Open the chat';
            rail.innerHTML = '<span class="mcfo-chatrail__btn">'
                + '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 3 5 8l5 5"/></svg></span>'
                + '<span class="mcfo-chatrail__badge" hidden></span>'
                + '<span class="mcfo-chatrail__label">Chat</span>'
                + '<span class="mcfo-chatrail__room"></span>';
            rail.addEventListener('click', e => {
                e.preventDefault();
                e.stopPropagation();
                chat.querySelector('[data-role="chat-collapse"]')?.click();
            });
            chat.appendChild(rail);
            // Follow the chat directly: collapsing, new lines, the filter tagging them.
            const nudge = () => { clearTimeout(railTimer); railTimer = setTimeout(() => { drawChatRail(); drawChatPop(); }, 60); };
            new MutationObserver(nudge).observe(chat, { attributes: true, attributeFilter: ['data-collapsed'], childList: true, subtree: true });
        }

        const room = (chat.querySelector('[data-role="chat-room-label"]')?.textContent || '').trim();
        const roomEl = rail.querySelector('.mcfo-chatrail__room');
        if (roomEl.textContent !== room) roomEl.textContent = room;

        const collapsed = chat.getAttribute('data-collapsed') === 'true';
        const toggle = chat.querySelector('[data-role="chat-collapse"]');
        // Only on the desktop layout — the portrait layout has no collapse button.
        if (!chatRestored && toggle && !toggle.hidden) {
            chatRestored = true;
            let want = null;
            try { want = localStorage.getItem(CHAT_COLLAPSED_KEY); } catch (e) {}
            if (want === '1' && !collapsed) {
                document.documentElement.setAttribute('data-mcfo-chat-instant', '');
                toggle.click();
                setTimeout(() => document.documentElement.removeAttribute('data-mcfo-chat-instant'), 120);
                chatSaved = '1';
                return;   // the observer brings us back with the new state
            }
        }
        if (chatRestored) {
            const now = collapsed ? '1' : '0';
            if (chatSaved !== now) {
                chatSaved = now;
                try { localStorage.setItem(CHAT_COLLAPSED_KEY, now); } catch (e) {}
            }
        }

        const lines = visibleChatLines(chat);
        const badge = rail.querySelector('.mcfo-chatrail__badge');
        if (!collapsed) {
            // Open: keep the mark on the newest line, so the count starts exactly at collapsing.
            railMark = lines.length ? lineKey(lines[lines.length - 1]) : '';
            badge.hidden = true;
            return;
        }
        if (railMark === null) railMark = lines.length ? lineKey(lines[lines.length - 1]) : '';
        let at = -1;
        for (let i = lines.length - 1; i >= 0; i--) { if (lineKey(lines[i]) === railMark) { at = i; break; } }
        const fresh = at >= 0 ? lines.length - 1 - at : (railMark === '' ? lines.length : -1);
        const text = fresh < 0 ? '\u2022' : fresh > 99 ? '99+' : String(fresh);
        badge.hidden = fresh === 0;
        if (badge.textContent !== text) badge.textContent = text;
        rail.title = fresh === 0 ? 'Open the chat' : fresh < 0 ? 'Open the chat · many new messages' : `Open the chat · ${fresh} new`;
    }

