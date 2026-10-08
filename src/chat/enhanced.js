    // =========================================================================================
    // 9f. ENHANCED CHAT (opt-in)
    // =========================================================================================
    // What used to be the separate chat script (Chat Slim / Chat Pro Customizer up to 10.8),
    // folded in so there is one script to install and one settings page. Off unless switched on:
    // the chat is the part of the page people read most, and nobody should find it rearranged
    // without having asked for it.
    //
    // Limited to the real message list. The game builds its cosmetic PREVIEWS (chat shop, chat
    // items in the inventory) from the same markup as chat lines. Searched page-wide, grouping and
    // text sizes reached into those previews too: all preview lines share one sender, so they were
    // grouped and lost their header ("The username above shows the selected treatment" vanished).
    //
    // Should the old script still be installed, this part stays idle — two scripts setting the
    // same attributes and both correcting the scroll position would work against each other.
    const CHAT_LIST_SEL = '[data-role="chat-messages"], .mcf-chat__messages';
    const CHAT_LIST_CSS = ':is([data-role="chat-messages"], .mcf-chat__messages)';
    const CHAT_GROUP_MIN = 5;   // minutes two lines may be apart and still share a header

    // System lines that break up the conversation. The shop pattern is the one the MarbleMind bot
    // uses on the Discord side, so both recognise the same lines. Checked against 891 system lines
    // (167 shop, 139 crown, 66 toll) and, what counts, against 6,333 player messages: not one false
    // hit. That is why the crown rule wants both halves — "CROWN CLAIMED!" alone could be typed by
    // a player, and the line would be gone without a trace. Rebellions stay, always.
    const CHAT_FILTERS = [
        { id: 'shop',  key: 'chatHideShop',  pattern: /has appeared in the\s+\S+\s+Shop:/i },
        { id: 'crown', key: 'chatHideCrown', pattern: /\bCROWN CLAIMED!.*has captured the Crown\b/i },
        { id: 'toll',  key: 'chatHideToll',  pattern: /\bchanged the Crown toll\b/i },
    ];

    const chatPlusStyle = document.createElement('style');
    let chatPlusSig = null;
    let chatListWatched = null;
    let chatListObserver = null;
    let chatPassPlanned = false;

    function chatSlimPresent() { return !!document.querySelector('.mcf-settings-btn, .mcfc-win'); }
    function chatPlusActive() { return !!settings.chatPlus && !chatSlimPresent(); }

    function applyChatPlus() {
        const on = chatPlusActive();
        const html = document.documentElement;
        html.setAttribute('data-mcfo-chatplus', on ? '1' : '0');
        html.setAttribute('data-mcfo-chatcos', on && settings.chatCosmeticSwitch ? '1' : '0');
        writeChatTypography();
        watchChatList();
        // A pass over all lines only when something that decides them changed; new lines bring
        // their own pass through the observer.
        const sig = [on, settings.chatGroup, settings.chatEmotes, ...CHAT_FILTERS.map(f => settings[f.key])].join();
        if (sig !== chatPlusSig) { chatPlusSig = sig; planChatPass(); }
    }

    // Sizes live in their own style element, rewritten on change — also while a slider is dragged.
    function writeChatTypography() {
        if (!chatPlusStyle.isConnected) (document.head || document.documentElement).appendChild(chatPlusStyle);
        const on = chatPlusActive();
        const css = !on ? '' : [
            settings.chatGroup ? `${CHAT_LIST_CSS} { gap: 0 !important; }` : '',
            settings.chatSizes ? `${CHAT_LIST_CSS} .mcf-chat__sender { font-size: ${settings.chatNameSize / 100}em !important; }` : '',
            settings.chatSizes ? `${CHAT_LIST_CSS} .mcf-chat__text { font-size: ${settings.chatTextSize / 100}em !important; }` : '',
        ].filter(Boolean).join('\n');
        if (chatPlusStyle.textContent !== css) chatPlusStyle.textContent = css;
    }

    // Only the message list is watched, and a burst of changes becomes one pass per frame.
    // Our own changes are attributes, which this observer does not listen to — no loop.
    function watchChatList() {
        const list = document.querySelector(CHAT_LIST_SEL);
        if (list === chatListWatched) return;
        if (chatListObserver) chatListObserver.disconnect();
        chatListWatched = list;
        chatScrollBoxCache = null;
        if (!list) return;
        chatListObserver = new MutationObserver(planChatPass);
        chatListObserver.observe(list, { childList: true, subtree: true });
        planChatPass();
    }

    function planChatPass() {
        if (chatPassPlanned) return;
        chatPassPlanned = true;
        requestAnimationFrame(() => { chatPassPlanned = false; chatPass(); });
    }

    function chatFilterReason(msg) {
        const text = ((msg.querySelector('.mcf-chat__text') || msg).textContent) || '';
        const rule = CHAT_FILTERS.find(r => settings[r.key] && r.pattern.test(text));
        return rule ? rule.id : null;
    }
    // The name alone (6.39.2): a name flourish is drawn as a character INSIDE the sender element
    // (span.mcf-chat__username-decoration, "\u25C6" or "\u203A"), so its textContent is
    // "Name\u25C6" and never equals the account name.
    function senderText(el) {
        if (!el) return '';
        let t = '';
        for (const n of el.childNodes) {
            if (n.nodeType === 3) t += n.textContent;
            else if (n.nodeType === 1 && !n.classList.contains('mcf-chat__username-decoration')) t += n.textContent;
        }
        return t.trim();
    }
    function chatSender(msg) {
        return senderText(msg && msg.querySelector('.mcf-chat__sender')).replace(/\[|\]/g, '').trim();
    }
    function chatMinutes(msg) {
        const spans = msg ? msg.querySelectorAll('.mcf-chat__meta span') : [];
        for (let i = spans.length - 1; i >= 0; i--) {
            const m = spans[i].textContent.trim().match(/^(\d{1,2}):(\d{2})$/);
            if (m) return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
        }
        return -1;
    }
    function chatClose(t1, t2) {
        if (t1 < 0 || t2 < 0) return true;   // unreadable: allow grouping
        const d = Math.abs(t1 - t2);
        return d <= CHAT_GROUP_MIN || d >= 24 * 60 - CHAT_GROUP_MIN;   // across midnight
    }

    // ---- keeping the scroll position ----
    // Grouping hides the header of merged lines. When a new line comes from the same sender, the
    // PREVIOUS one turns from single into start/mid after the fact — it loses its header and
    // shrinks, and with it the content ABOVE the scroll position. The browser keeps scrollTop, so
    // the view slides; on a reload it happens to every line at once and you land in the middle of
    // the history. So the position is noted before any change and restored after: at the end stays
    // at the end, otherwise the line you were looking at stays where it was.
    //
    // "At the end" is written down by a scroll listener as you go, not measured afterwards: once
    // the new line is in the DOM, the distance to the end has already grown by its height and it
    // would look as if you had scrolled up.
    const CHAT_END_SLACK = 60;
    let chatScrollBoxCache = null;
    let chatScrollHooked = null;
    let chatAtEnd = true;

    function chatScrollBox() {
        if (chatScrollBoxCache && chatScrollBoxCache.isConnected) return chatScrollBoxCache;
        let el = document.querySelector(CHAT_LIST_SEL);
        while (el && el !== document.body) {
            const ov = getComputedStyle(el).overflowY;
            if ((ov === 'auto' || ov === 'scroll') && el.scrollHeight > el.clientHeight + 4) { chatScrollBoxCache = el; return el; }
            el = el.parentElement;
        }
        return null;
    }
    // Not every scroll event is the reader. When lines grow, the browser's scroll anchoring moves
    // scrollTop to keep the visible line in place, and that fires a scroll event too — measured
    // then, the distance to the end has just grown by the growth and it looks as if the reader had
    // scrolled up (6.4: the chat crept upwards after a reload). So a scroll event that comes with a
    // changed size of content or box does not take "at the end" away; a real scroll up fires a run
    // of events at an unchanged size and is noticed at once.
    function hookChatScroll(box) {
        if (!box || chatScrollHooked === box) return;
        chatScrollHooked = box;
        let lastHeight = box.scrollHeight, lastClient = box.clientHeight;
        box.addEventListener('scroll', () => {
            const resized = box.scrollHeight !== lastHeight || box.clientHeight !== lastClient;
            lastHeight = box.scrollHeight;
            lastClient = box.clientHeight;
            if (resized && chatAtEnd) return;
            chatAtEnd = box.scrollHeight - box.scrollTop - box.clientHeight <= CHAT_END_SLACK;
        }, { passive: true });
    }
    // Clamped here on purpose, so the intent is in the code and not left to the browser.
    function setChatScroll(box, v) { box.scrollTop = Math.max(0, Math.min(v, box.scrollHeight - box.clientHeight)); }

    function chatPass() {
        const list = document.querySelector(CHAT_LIST_SEL);
        if (list) tomatoPass(list);
        if (list) mentionPass(list);
        if (list) emotePass(list);
        if (chatSlimPresent()) return;   // the old script owns these attributes while it runs
        if (!list) return;
        const on = chatPlusActive();
        const all = list.querySelectorAll('article.mcf-chat__message');

        // Filtering comes BEFORE grouping and inside the same scroll bracket: both change the
        // height, and two separate passes would work the correction against each other.
        let filterChanged = false;
        all.forEach(msg => {
            const why = on ? chatFilterReason(msg) : null;
            if (msg.getAttribute('data-mcf-filter') === why) return;
            if (why) msg.setAttribute('data-mcf-filter', why); else msg.removeAttribute('data-mcf-filter');
            filterChanged = true;
        });
        // Hidden lines are no neighbours: a hidden system line would otherwise split two messages
        // that stand right beneath each other on screen.
        const shown = Array.prototype.filter.call(all, m => !m.hasAttribute('data-mcf-filter'));

        if (!on || !settings.chatGroup) {
            let removed = false;
            all.forEach(m => { if (m.hasAttribute('data-mcf-group')) { m.removeAttribute('data-mcf-group'); removed = true; } });
            if (filterChanged || removed) {
                const b = chatScrollBox();
                hookChatScroll(b);
                if (b && chatAtEnd) setChatScroll(b, b.scrollHeight);
            }
            return;
        }

        // The state BEFORE the change; offsetTop is read once, not per line.
        const box = chatScrollBox();
        hookChatScroll(box);
        const atEnd = chatAtEnd;
        let anchor = null, anchorOffset = 0;
        if (box && !atEnd) {
            for (const m of shown) {
                const top = m.offsetTop - box.scrollTop;
                if (top >= 0) { anchor = m; anchorOffset = top; break; }
            }
        }
        let changed = false;
        shown.forEach((msg, i) => {
            const prev = shown[i - 1], next = shown[i + 1];
            const name = chatSender(msg), t = chatMinutes(msg);
            const withPrev = name && prev && name === chatSender(prev) && chatClose(t, chatMinutes(prev));
            const withNext = name && next && name === chatSender(next) && chatClose(t, chatMinutes(next));
            const group = withNext && !withPrev ? 'start' : withNext && withPrev ? 'mid' : withPrev ? 'end' : 'single';
            if (msg.getAttribute('data-mcf-group') !== group) { msg.setAttribute('data-mcf-group', group); changed = true; }
        });
        if ((changed || filterChanged) && box) {
            if (atEnd) setChatScroll(box, box.scrollHeight);
            else if (anchor) setChatScroll(box, anchor.offsetTop - anchorOffset);
        }
    }

