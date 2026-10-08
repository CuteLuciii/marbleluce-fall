    // =========================================================================================
    // 9h. GROWING MESSAGE BOX
    // =========================================================================================
    // The game's message field is an <input>: one line, however long the message (up to 280
    // characters), so a long one scrolls out of sight to the left while it is being written. An
    // <input> cannot wrap. A textarea takes its place on screen and grows with the text, up to
    // CHATGROW_LINES lines, the way a messenger's box does.
    //
    // The game's field stays the real one — its place in the form, its listeners, its value. The
    // textarea only writes into it (chatPane.js):
    //   - every change is copied over and announced with an 'input' event, which is what drives
    //     the suggestions for !tomato and the other targeted commands;
    //   - Enter submits the game's form, exactly what Enter in the input did (submit → ws.send →
    //     input.value = '');
    //   - what the game writes itself — a picked suggestion, the empty field after sending, Unbid
    //     putting a draft back — is copied back. The game sets .value directly, which fires no
    //     event, so the two are compared on a short timer while the box is in place;
    //   - when the game focuses its field (after a suggestion), the focus moves on to the textarea.
    // The chat takes no line breaks: Enter never makes one, and pasted ones become spaces.
    //
    // Not on touch screens. There the game keeps the portrait layout while the on-screen keyboard
    // is up, and it knows the keyboard is up by asking whether ITS field has the focus
    // (app.js updateLayoutMode → chatController.hasFocusedInput). With the focus in our textarea
    // the answer would be no, and the layout would flip under the keyboard.
    const CHATGROW_LINES = 5;
    const CHATGROW_SYNC_MS = 200;
    let chatGrow = null;   // { input, ta, form, synced, timer, onFocus, tabIndex }
    const coarsePointer = () => { try { return matchMedia('(pointer: coarse)').matches; } catch (e) { return false; } };

    function applyChatGrow() {
        const on = !!settings.chatGrow && !coarsePointer();
        document.documentElement.setAttribute('data-mcfo-chatgrow', on ? '1' : '0');
        const input = document.querySelector('.mcf-chat__form [data-role="chat-input"]');
        if (chatGrow && (!on || chatGrow.input !== input || !chatGrow.ta.isConnected)) removeChatGrow();
        if (on && !chatGrow && input && input.tagName === 'INPUT') installChatGrow(input);
    }

    function installChatGrow(input) {
        const form = input.form || input.closest('form');
        if (!form) return;
        const ta = document.createElement('textarea');
        ta.className = input.className + ' mcfo-chatgrow';
        ta.rows = 1;
        ta.maxLength = input.maxLength > 0 ? input.maxLength : 280;
        ta.placeholder = input.placeholder;
        ta.disabled = input.disabled;
        ta.setAttribute('autocomplete', 'off');
        ta.setAttribute('aria-label', 'Message chat');
        ta.value = input.value;
        const st = { input, ta, form, synced: input.value, timer: 0, onFocus: null, tabIndex: input.getAttribute('tabindex') };
        input.setAttribute('data-mcfo-grow', '1');
        input.setAttribute('tabindex', '-1');   // Tab should land in the textarea, not in the hidden field
        input.after(ta);
        chatGrow = st;

        ta.addEventListener('input', () => {
            const flat = ta.value.replace(/[\r\n]+/g, ' ');
            if (flat !== ta.value) {
                const at = ta.selectionStart;
                ta.value = flat;
                ta.setSelectionRange(at, at);
            }
            pushChatGrow(st);
            fitChatGrow(st);
        });
        ta.addEventListener('keydown', e => {
            if (e.key !== 'Enter' || e.isComposing || e.keyCode === 229) return;
            e.preventDefault();
            if (e.shiftKey) return;   // no line breaks in this chat
            pushChatGrow(st);
            try {
                if (typeof form.requestSubmit === 'function') form.requestSubmit();
                else form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
            } catch (err) {}
            pullChatGrow(st);
        });
        st.onFocus = () => {
            if (ta.disabled) return;
            pullChatGrow(st);
            ta.focus();
            ta.setSelectionRange(ta.value.length, ta.value.length);
        };
        input.addEventListener('focus', st.onFocus);
        st.timer = setInterval(() => pullChatGrow(st), CHATGROW_SYNC_MS);
        fitChatGrow(st);
    }

    function removeChatGrow() {
        const st = chatGrow;
        chatGrow = null;
        if (!st) return;
        clearInterval(st.timer);
        st.input.removeEventListener('focus', st.onFocus);
        const hadFocus = document.activeElement === st.ta;
        st.ta.remove();
        st.input.removeAttribute('data-mcfo-grow');
        if (st.tabIndex === null) st.input.removeAttribute('tabindex');
        else st.input.setAttribute('tabindex', st.tabIndex);
        st.form.style.removeProperty('--mcfo-chatgrow-line');
        if (hadFocus && st.input.isConnected) st.input.focus();
    }

    // Textarea -> the game's field, with the event the game listens for.
    function pushChatGrow(st) {
        st.synced = st.ta.value;
        if (st.input.value === st.ta.value) return;
        st.input.value = st.ta.value;
        try { st.input.dispatchEvent(new pageWindow.Event('input', { bubbles: true })); }
        catch (e) { try { st.input.dispatchEvent(new Event('input', { bubbles: true })); } catch (e2) {} }
    }

    // The game's field -> textarea: whatever the game wrote itself, and its read-only state.
    function pullChatGrow(st) {
        const { input, ta } = st;
        if (ta.disabled !== input.disabled) ta.disabled = input.disabled;
        if (ta.placeholder !== input.placeholder) ta.placeholder = input.placeholder;
        if (input.value === st.synced) return;
        st.synced = input.value;
        ta.value = input.value;
        if (document.activeElement === ta) ta.setSelectionRange(ta.value.length, ta.value.length);
        fitChatGrow(st);
    }

    // Height to the text, at most CHATGROW_LINES lines, then it scrolls inside. The composer
    // grows upwards and the message list gets shorter by the same amount — whoever was reading
    // the newest line keeps seeing it.
    function fitChatGrow(st) {
        const { ta, form } = st;
        const list = document.querySelector(CHAT_LIST_SEL);
        const stick = !!list && list.scrollHeight - list.scrollTop - list.clientHeight < 32;
        const before = ta.offsetHeight;
        const cs = getComputedStyle(ta);
        const edge = (parseFloat(cs.borderTopWidth) || 0) + (parseFloat(cs.borderBottomWidth) || 0);
        const pad = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
        const line = parseFloat(cs.lineHeight) || (parseFloat(cs.fontSize) || 16) * 1.25;
        const one = Math.ceil(line + pad + edge);
        const max = Math.ceil(line * CHATGROW_LINES + pad + edge);
        ta.style.height = 'auto';
        const want = Math.max(one, ta.scrollHeight + edge);
        ta.style.height = Math.min(want, max) + 'px';
        ta.style.overflowY = want > max ? 'auto' : 'hidden';
        form.style.setProperty('--mcfo-chatgrow-line', one + 'px');
        if (stick && ta.offsetHeight !== before) list.scrollTop = list.scrollHeight;
    }

