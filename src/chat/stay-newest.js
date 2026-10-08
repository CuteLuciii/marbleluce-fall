    // =========================================================================================
    // 9i. STAY AT THE NEWEST MESSAGE
    // =========================================================================================
    // The game keeps the chat at the bottom only at the moment it draws it (chatPane.js render):
    // "near the bottom — under 32 px — before redrawing? Then scroll down after." Anything that
    // makes the lines taller AFTER that moment is left alone: web fonts of username styles, badges
    // and pictures loading late, the enhanced chat's text sizes. After a reload most of that
    // arrives a moment after the history has been drawn, so the view ends up a bit above the end —
    // and from then on the next redraw sees more than 32 px and does not stick either. The view
    // creeps upwards.
    //
    // So the size of the lines is watched, not the moment of drawing: a ResizeObserver on every
    // line and on the list itself (the list is the scroll box, its height changes with the
    // composer and the window). Whoever was at the end — written down by the scroll listener of
    // 9f as it happens, never measured afterwards — is taken back to the end. Whoever scrolled up
    // to read stays where they are.
    //
    // The game rebuilds the list with innerHTML on every redraw, so new lines are added to the
    // observer and removed ones taken off, or it would hold on to thousands of dead nodes after a
    // few hours.
    let chatEndList = null, chatEndMO = null, chatEndRO = null, chatEndPlanned = false;

    function applyChatStick() {
        const list = settings.chatStick ? document.querySelector(CHAT_LIST_SEL) : null;
        if (list === chatEndList) return;
        if (chatEndMO) chatEndMO.disconnect();
        if (chatEndRO) chatEndRO.disconnect();
        chatEndMO = chatEndRO = null;
        chatEndList = list;
        if (!list || typeof ResizeObserver === 'undefined') return;
        chatEndRO = new ResizeObserver(planChatEnd);
        chatEndRO.observe(list);
        for (const el of list.children) chatEndRO.observe(el);
        chatEndMO = new MutationObserver(records => {
            for (const r of records) {
                r.addedNodes.forEach(n => { if (n.nodeType === 1) chatEndRO.observe(n); });
                r.removedNodes.forEach(n => { if (n.nodeType === 1) chatEndRO.unobserve(n); });
            }
            planChatEnd();
        });
        chatEndMO.observe(list, { childList: true });
        planChatEnd();
    }

    function planChatEnd() {
        if (chatEndPlanned) return;
        chatEndPlanned = true;
        requestAnimationFrame(() => { chatEndPlanned = false; keepChatEnd(); });
    }

    function keepChatEnd() {
        if (!settings.chatStick) return;
        const box = chatScrollBox();
        if (!box) return;                    // nothing to scroll yet
        hookChatScroll(box);
        if (chatAtEnd && box.scrollHeight - box.scrollTop - box.clientHeight > 1) setChatScroll(box, box.scrollHeight);
    }

