    // =========================================================================================
    // 9e. CHAT POP-OUT
    // =========================================================================================
    // The chat as one of our windows. What moves is desktop-chat-pane, the column the game
    // attaches the chat to — see the CSS for why the pane and not the chat. Closing the window
    // puts the pane back exactly where it came from; nothing of the chat is ever destroyed.
    //
    // The state (docked / window / parked) survives a reload: kept under its own key, and the
    // chat window is left out of restoreParked, which would otherwise bring it back as a lazy
    // taskbar entry without the chat in it.
    const CHAT_WIN = '#chat';
    const CHAT_POP_KEY = 'mcfo_chat_popped';
    let chatDock = null;            // { parent, next } — where the pane stood before
    let chatPopRestored = false;
    let chatPopSaved = null;
    let chatPopMark = null;

    function saveChatPop(v) {
        if (chatPopSaved === v) return;
        chatPopSaved = v;
        try { if (v) localStorage.setItem(CHAT_POP_KEY, v); else localStorage.removeItem(CHAT_POP_KEY); } catch (e) {}
    }

    function popOutChat() {
        const pane = role('desktop-chat-pane');
        const chat = chatRoot();
        if (!pane || !chat) return;
        const open = windows.get(CHAT_WIN);
        if (open) { restoreWindow(CHAT_WIN); return; }

        // A collapsed chat is opened first — a window with a 44px rail in it makes no sense.
        if (chat.getAttribute('data-collapsed') === 'true') {
            relayoutBusy = true;
            try { chat.querySelector('[data-role="chat-collapse"]')?.click(); } finally { relayoutBusy = false; }
        }
        chatDock = { parent: pane.parentElement, next: pane.nextSibling };
        const w = makeWindow(CHAT_WIN, 'Chat', { width: 380, height: Math.min(760, innerHeight - 80) });
        w.onClose = dockChat;
        w.body.appendChild(pane);
        document.documentElement.setAttribute('data-mcfo-chatpop', '1');
        saveChatPop('open');
        drawTaskbar();
        // The column is gone now (CSS above) — the lanes may take its width.
        relayoutGame();
    }

    function dockChat() {
        const pane = role('desktop-chat-pane');
        if (pane) {
            const d = chatDock;
            if (d && d.parent && d.parent.isConnected) {
                d.parent.insertBefore(pane, d.next && d.next.parentNode === d.parent ? d.next : null);
            } else {
                role('lane-play-region')?.appendChild(pane);   // its home in the game's markup
            }
        }
        chatDock = null;
        chatPopMark = null;
        document.documentElement.removeAttribute('data-mcfo-chatpop');
        saveChatPop(null);
        // The column is back — without this the lanes keep the width they had in the meantime
        // and the docked chat covers the right lane (the same fault as the animated column).
        relayoutGame();
    }

    function markChatForPark() {
        const chat = chatRoot();
        const lines = chat ? visibleChatLines(chat) : [];
        chatPopMark = lines.length ? lineKey(lines[lines.length - 1]) : '';
    }

    // How many lines came since the mark — the same rule as the rail's counter.
    function newLinesSince(chat, mark) {
        const lines = visibleChatLines(chat);
        let at = -1;
        for (let i = lines.length - 1; i >= 0; i--) { if (lineKey(lines[i]) === mark) { at = i; break; } }
        return at >= 0 ? lines.length - 1 - at : (mark === '' ? lines.length : -1);
    }

    function drawChatPop() {
        const on = !!settings.chatPopout;
        document.documentElement.setAttribute('data-mcfo-popbtn', on ? '1' : '0');
        const chat = chatRoot();
        const header = chat && chat.querySelector('.mcf-chat__header');
        const collapse = header && header.querySelector('[data-role="chat-collapse"]');

        // The cosmetics button shows only a symbol since 6.16.1; its words come back as the
        // tooltip, read at the moment the pointer arrives, so it always tells the current state.
        const cos = header && header.querySelector('.mcf-chat__cosmetics-toggle');
        if (cos && !cos.dataset.mcfoTip) {
            cos.dataset.mcfoTip = '1';
            cos.addEventListener('pointerenter', () => {
                cos.title = cos.getAttribute('aria-pressed') === 'true' ? 'Chat cosmetics: on (click to turn off)' : 'Chat cosmetics: off (click to turn on)';
            });
        }

        let btn = header && header.querySelector('.mcfo-chatpop-btn');
        if (!on) {
            if (btn) btn.remove();
            if (windows.has(CHAT_WIN)) closeWindow(CHAT_WIN);   // switched off: back into place
            return;
        }
        if (header && collapse && !btn) {
            btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'mcfo-chatpop-btn';
            btn.title = 'Pop the chat out into a window';
            btn.innerHTML = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'
                          + '<path d="M9 2.5h4.5V7M13.5 2.5 7.5 8.5M12 9.5v3a1 1 0 0 1-1 1H3.5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h3"/></svg>';
            btn.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); popOutChat(); });
            header.insertBefore(btn, collapse);
        }

        // Put back what was there before the reload — only on the desktop layout, where the
        // pane exists and is shown.
        if (!chatPopRestored && chat && collapse && !collapse.hidden) {
            chatPopRestored = true;
            let want = null;
            try { want = localStorage.getItem(CHAT_POP_KEY); } catch (e) {}
            if (want === 'open' || want === 'min') {
                popOutChat();
                if (want === 'min') minimiseWindow(CHAT_WIN);
            }
        }

        // Parked: count what comes in, and show it on the taskbar button.
        const w = windows.get(CHAT_WIN);
        if (!w || !chat) return;
        saveChatPop(w.min ? 'min' : 'open');
        let badge = '';
        if (w.min) {
            if (chatPopMark === null) {
                const lines = visibleChatLines(chat);
                chatPopMark = lines.length ? lineKey(lines[lines.length - 1]) : '';
            }
            const n = newLinesSince(chat, chatPopMark);
            badge = n < 0 ? '\u2022' : n > 99 ? '99+' : n > 0 ? String(n) : '';
        } else {
            chatPopMark = null;
        }
        if ((w.badge || '') !== badge) { w.badge = badge; drawTaskbar(); }
    }

