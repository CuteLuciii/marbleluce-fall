    // =========================================================================================
    // 9j. TOMATOES AS A SHORT NOTICE (6.25)
    // =========================================================================================
    // A tomato that hits you arrives as a private "Command result" — "X sent you a tomato." —
    // with a picture below it. Whether the picture shows is up to chance: the game drops it when
    // its path is not one it accepts, and hides the whole frame when it fails to load. The text
    // always comes. So the line is turned into one small notice of our own, the same every time,
    // with an x like Discord's "dismiss message".
    //
    // The game's own children stay in the node, only hidden: it keeps the node in a cache and may
    // compare or reuse it, and taking its parts out would be asking for trouble. Private rows live
    // only in the page (a reload clears them), so dismissed notices are remembered for the page
    // only — keyed by sender and minute, because the game may render a row afresh.
    //
    // Runs from chatPass(), which the chat list observer already drives; it does not depend on the
    // enhanced chat being switched on.
    const TOMATO_IN_RE = /^\s*(.+?) sent you a tomato\.?\s*$/i;
    const TOMATO_ICON = '<svg class="mcfo-tomato__icon" viewBox="0 0 24 24" aria-hidden="true">'
        + '<circle cx="12" cy="14" r="8.5" fill="#e0483a"/>'
        + '<ellipse cx="9" cy="11.5" rx="2.4" ry="1.5" fill="#ff8a78" opacity="0.7"/>'
        + '<path d="M12 6.2 L9 3.6 L11.2 6.4 L7.4 6.6 L11 7.8 L9.6 10 L12 8.4 L14.4 10 L13 7.8 L16.6 6.6 L12.8 6.4 L15 3.6 Z" fill="#3d9a3a"/>'
        + '</svg>';
    const tomatoGone = new Set();

    // Answers to your own throws (6.35.1), as the game words them (checked against 1,600 of the
    // bot's): "Sent a tomato to X.", "You can tomato that player again in a moment.", "Could not
    // find an active player named X." (older: "active chat user"), and a bare "Tomato" with a
    // picture. Thrown with the tomato button, all answers of one throw become ONE line — 14 throws
    // used to fill the chat with 14 command results. The first answer carries the line, the others
    // are hidden. Typed by hand, each answer becomes a small line of its own. Every line has an x.
    // The refusal does not name the player, so who was on cooldown is worked out at the end:
    // the targets that neither landed nor were unknown.
    const TOMATO_OUT_RE = /^\s*(?:Sent a tomato to (.+?)|(You can tomato that player again in a moment)|Could not find an active (?:player|chat user) named (.+?)|(Tomato))\.?\s*$/i;
    let tomatoRun = null;               // the throw of the tomato button whose answers are gathered
    const tomatoRows = new Map();       // row key -> { run, host, gone } — the game may draw a row afresh

    // --- Messages that mention you (6.36) ---
    // Your name anywhere in a message, with or without @, as a whole word and in any case —
    // "DreamingLucie" matches "@dreaminglucie" and "hi DreamingLucie!", not "DreamingLucie2".
    // Only the row is marked; the text stays the game's own. Each row is checked once per name
    // (data-mcfo-mfor), so a long chat costs nothing on the next pass.
    // Nicknames (6.37, Settings › Chat › Nicknames): more words that mean you, same rules.
    let mentionRe = null, mentionFor = '', mentionMe = '';
    function mentionWords(name) {
        const nick = String(settings.chatMentionNames || '').split(/[,;\n]+/).map(x => x.trim().replace(/^@/, '')).filter(x => x.length >= 2);
        return [...new Set([name, ...nick].filter(Boolean).map(x => x.toLowerCase()))];
    }
    function mentionPass(list) {
        const name = settings.chatMentions ? (accountName() || '') : '';
        const words = name ? mentionWords(name) : [];
        const key = words.join('|');
        if (key !== mentionFor) {
            mentionFor = key;
            mentionMe = name.toLowerCase();
            const esc = w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
            mentionRe = words.length ? new RegExp('(^|[^\\p{L}\\p{N}_])@?(?:' + words.map(esc).join('|') + ')(?![\\p{L}\\p{N}_])', 'iu') : null;
        }
        for (const msg of list.querySelectorAll('article.mcf-chat__message:not(.mcf-chat__private)')) {
            if (msg.getAttribute('data-mcfo-mfor') === mentionFor) continue;
            msg.setAttribute('data-mcfo-mfor', mentionFor);
            const sender = senderText(msg.querySelector('.mcf-chat__sender'));
            const text = msg.querySelector('.mcf-chat__text')?.textContent || '';
            const hit = !!mentionRe && sender.toLowerCase() !== mentionMe && mentionRe.test(text);
            if (msg.hasAttribute('data-mcfo-mention') !== hit) msg.toggleAttribute('data-mcfo-mention', hit);
        }
    }

    // A change to the nicknames checks every row again.
    function mentionRefresh() {
        mentionFor = '\u0000';
        const list = document.querySelector(CHAT_LIST_SEL);
        if (list) mentionPass(list);
    }

