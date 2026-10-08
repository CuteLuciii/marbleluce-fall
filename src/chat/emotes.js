    // =========================================================================================
    // 9l. TWITCH EMOTES (6.45)
    // =========================================================================================
    // Opt-in (Settings › Chat › Twitch emotes). A word that is the exact name of one of Twitch's
    // global emotes (Kappa, LUL, PogChamp, ...) is drawn as the emote picture, the way Twitch's own
    // chat does it: case-sensitive, whole words only. Only words made of letters and digits count,
    // so the old text smileys of the global set (":)", "<3", ":p") stay text.
    //
    // The pictures come straight from Twitch's public image server (static-cdn.jtvnw.net, no login).
    // Twitch's own list of names needs a token that has no place in a public script, so the list
    // comes from emotes.adamcy.pl (no key, allows the call from this page), cached for a day. If it
    // cannot be reached, a short built-in list of the common ones stands in.
    //
    // Only the text nodes inside .mcf-chat__text change; the game builds a new node whenever a row
    // changes (reconcileChatMessageRows), so a re-drawn row simply comes back as text and is done
    // again. alt and title carry the name: copying a message keeps the word, hovering shows it.
    const EMOTE_LIST_URL = 'https://emotes.adamcy.pl/v1/global/emotes/twitch';
    const EMOTE_CDN = id => `https://static-cdn.jtvnw.net/emoticons/v2/${id}/default/dark/`;
    const EMOTE_TTL = 24 * 3600e3, EMOTE_RETRY = 30 * 60e3;
    const EMOTE_FALLBACK = 'Kappa:25,LUL:425618,PogChamp:305954156,Kreygasm:41,4Head:354,ResidentSleeper:245,'
        + 'NotLikeThis:58765,SeemsGood:64138,VoHiYo:81274,HeyGuys:30259,KappaPride:55338,CoolCat:58127,DansGame:33,'
        + 'SMOrc:52,WutFace:28087,PJSalt:36,Jebaited:114836,BabyRage:22639,FailFish:360,MrDestructoid:28,cmonBruh:84608,'
        + 'CoolStoryBob:123171,TriHard:120232,Keepo:1902,KomodoHype:81273,OhMyDog:81103,PunOko:160401,SwiftRage:34,'
        + 'TheIlluminati:145315,BloodTrail:69,DoritosChip:102242,GivePLZ:112291,TakeNRG:112292,HSCheers:444572,'
        + 'PopCorn:724216,CorgiDerp:49106,BOP:301428702,StinkyCheese:90076,GlitchCat:304486301,TwitchUnity:196892,'
        + 'MingLee:68856,Kappu:160397,imGlitch:112290,TPFufun:508650,VirtualHug:301696583';
    const emotes = { map: null, key: '', loading: false, failedAt: 0 };

    function emoteSetList(pairs, src) {
        const map = new Map();
        for (const [code, id] of pairs) if (/^\w+$/.test(code) && /^[\w-]+$/.test(String(id))) map.set(code, String(id));
        if (!map.size) return false;
        emotes.map = map;
        emotes.key = src + ':' + map.size;
        return true;
    }

    function emoteLoad() {
        if (emotes.loading) return;
        let saved = null;
        try { saved = JSON.parse(localStorage.getItem('mcfo_emotes') || 'null'); } catch (e) {}
        if (!emotes.map && saved && Array.isArray(saved.list)) emoteSetList(saved.list, 'saved');
        const fresh = saved && Date.now() - saved.at < EMOTE_TTL;
        if (fresh || Date.now() - emotes.failedAt < EMOTE_RETRY) {
            if (!emotes.map) emoteSetList(EMOTE_FALLBACK.split(',').map(x => x.split(':')), 'builtin');
            return;
        }
        if (!emotes.map) emoteSetList(EMOTE_FALLBACK.split(',').map(x => x.split(':')), 'builtin');
        emotes.loading = true;
        fetch(EMOTE_LIST_URL, { credentials: 'omit', cache: 'no-store' })
            .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
            .then(data => {
                // [{ code, urls: [{ size, url: ".../emoticons/v2/<id>/default/light/1.0" }] }]
                const list = [];
                for (const e of Array.isArray(data) ? data : []) {
                    const m = /\/emoticons\/v2\/([\w-]+)\//.exec((e && e.urls && e.urls[0] && e.urls[0].url) || '');
                    if (e && typeof e.code === 'string' && m) list.push([e.code, m[1]]);
                }
                if (!emoteSetList(list, 'live')) throw new Error('empty list');
                try { localStorage.setItem('mcfo_emotes', JSON.stringify({ at: Date.now(), list: [...emotes.map] })); } catch (e) {}
                planChatPass();
            })
            .catch(err => { emotes.failedAt = Date.now(); console.warn('[MarbleLuceFall] emote list:', err.message || err); })
            .then(() => { emotes.loading = false; });
    }

    function emoteImg(code, id) {
        const img = document.createElement('img');
        const base = EMOTE_CDN(id);
        img.className = 'mcfo-emote';
        img.src = base + '1.0';
        img.srcset = `${base}1.0 1x, ${base}2.0 2x, ${base}3.0 4x`;
        img.alt = code;
        img.title = code;
        img.loading = 'lazy';
        img.decoding = 'async';
        // A picture that does not load becomes the word again.
        img.addEventListener('error', () => { if (img.parentNode) img.replaceWith(document.createTextNode(code)); }, { once: true });
        return img;
    }

    function emoteText(textEl) {
        const map = emotes.map;
        const walker = document.createTreeWalker(textEl, NodeFilter.SHOW_TEXT);
        const nodes = [];
        while (walker.nextNode()) nodes.push(walker.currentNode);
        for (const node of nodes) {
            const parts = node.data.split(/(\s+)/);
            if (!parts.some(p => map.has(p))) continue;
            const frag = document.createDocumentFragment();
            let run = '';
            for (const p of parts) {
                const id = map.get(p);
                if (!id) { run += p; continue; }
                if (run) { frag.appendChild(document.createTextNode(run)); run = ''; }
                frag.appendChild(emoteImg(p, id));
            }
            if (run) frag.appendChild(document.createTextNode(run));
            node.replaceWith(frag);
        }
    }

    function emotePass(list) {
        if (!settings.chatEmotes) {
            // Switched off: every picture becomes its word again.
            const done = list.querySelectorAll('[data-mcfo-emo]');
            if (!done.length) return;
            done.forEach(el => {
                el.querySelectorAll('img.mcfo-emote').forEach(img => img.replaceWith(document.createTextNode(img.alt)));
                el.normalize();
                el.removeAttribute('data-mcfo-emo');
            });
            return;
        }
        if (!emotes.map || (!emotes.loading && emotes.key.startsWith('builtin'))) emoteLoad();
        if (!emotes.map) return;
        // Each text is done once per list; a fuller list arriving later goes over them again.
        for (const el of list.querySelectorAll('article.mcf-chat__message .mcf-chat__text')) {
            if (el.getAttribute('data-mcfo-emo') === emotes.key) continue;
            el.setAttribute('data-mcfo-emo', emotes.key);
            emoteText(el);
        }
    }

    // --- @ + Tab completes a name (6.37) ---
    // Like Twitch, but only after an @, so a Tab meant for something else never turns a word
    // into a name. "@dre" + Tab -> "DreamingLucie " (the @ goes, the message carries the plain
    // name, the way people write it here). Tab again walks on through the matches, Shift+Tab back;
    // any other key ends the round. Works in the game's field and in our growing box (9h).
    // Names: who wrote in the chat, latest first, then the players the game offers for !tomato
    // (loadTomatoTargets, 9j) — both without yourself.
    const tabDone = { el: null, value: '', matches: [], i: 0, start: 0 };
    function tabNames() {
        const me = (accountName() || '').toLowerCase();
        const seen = new Set(), out = [];
        const add = n => { n = String(n || '').trim(); const k = n.toLowerCase(); if (n && k !== me && !seen.has(k)) { seen.add(k); out.push(n); } };
        const list = document.querySelector(CHAT_LIST_SEL);
        if (list) [...list.querySelectorAll('.mcf-chat__sender')].reverse().forEach(x => add(senderText(x)));
        tomatoPick.names.forEach(add);
        return out;
    }
    function tabField(t) {
        return t && t.closest && t.closest('.mcf-chat__form') && t.matches('[data-role="chat-input"], textarea.mcfo-chatgrow') ? t : null;
    }
    document.addEventListener('focusin', e => {
        // The player list is fetched ahead, so the first Tab already has it.
        if (settings.chatTabComplete && tabField(e.target)) loadTomatoTargets().catch(() => {});
    }, true);
    document.addEventListener('keydown', e => {
        const el = tabField(e.target);
        if (!el) return;
        if (e.key !== 'Tab' || e.ctrlKey || e.altKey || e.metaKey || !settings.chatTabComplete) { if (e.key !== 'Shift') tabDone.el = null; return; }
        const value = el.value, caret = el.selectionStart;
        let round = tabDone.el === el && tabDone.value === value && tabDone.matches.length ? tabDone : null;
        if (!round) {
            const m = value.slice(0, caret).match(/(^|\s)@([^\s@]*)$/);
            if (!m) return;   // no @ word: Tab does what it always does
            const prefix = m[2].toLowerCase();
            const matches = tabNames().filter(n => n.toLowerCase().startsWith(prefix));
            if (!matches.length) return;
            round = { el, matches, i: -1, start: caret - m[2].length - 1, end: caret };
        }
        e.preventDefault();
        e.stopPropagation();
        const n = round.matches.length;
        round.i = round === tabDone ? (round.i + (e.shiftKey ? n - 1 : 1)) % n : (e.shiftKey ? n - 1 : 0);
        const end = round === tabDone ? round.start + round.inserted.length : round.end;
        const name = round.matches[round.i] + (/^\s/.test(value.slice(end)) ? '' : ' ');
        el.value = value.slice(0, round.start) + name + value.slice(end);
        const at = round.start + name.length;
        el.setSelectionRange(at, at);
        Object.assign(tabDone, round, { el, value: el.value, inserted: name });
        // The game's field listens for input (its suggestion list), our box syncs on it.
        try { el.dispatchEvent(new pageWindow.Event('input', { bubbles: true })); }
        catch (err) { try { el.dispatchEvent(new Event('input', { bubbles: true })); } catch (e2) {} }
        // Our box may have rewritten the value on that input (it flattens line breaks): keep up.
        tabDone.value = el.value;
    }, true);

    function chatPassSoon() {
        const list = chatRoot() && chatRoot().querySelector('[data-role="chat-messages"]');
        if (list) setTimeout(() => tomatoPass(list), 0);
    }

    function tomatoRunText(run) {
        const done = run.sent !== undefined && (Date.now() > run.until || run.landed.length + run.waits + run.missing.length >= run.sent);
        const parts = [];
        if (run.landed.length) parts.push(`<b>${run.landed.length}</b> landed`);
        if (run.waits) {
            const lower = new Set([...run.landed, ...run.missing].map(n => n.toLowerCase()));
            const who = done ? run.targets.filter(n => !lower.has(n.toLowerCase())) : [];
            parts.push(`<b>${run.waits}</b> on cooldown` + (who.length && who.length <= 6 ? ' (' + who.map(escapeHtml).join(', ') + ')' : ''));
        }
        if (run.missing.length) parts.push('not in the game: ' + run.missing.map(escapeHtml).join(', '));
        if (!parts.length) parts.push('thrown');
        return 'Tomatoes: ' + parts.join(' \u00b7 ') + (done ? '' : ' \u2026');
    }

    function tomatoNote(msg, html, time, rec) {
        let note = msg.querySelector(':scope > .mcfo-tomato');
        if (!note) {
            note = document.createElement('div');
            note.className = 'mcfo-tomato';
            note.innerHTML = TOMATO_ICON + '<span class="mcfo-tomato__text"></span><span class="mcfo-tomato__time"></span>'
                + '<button type="button" class="mcfo-tomato__x" title="Dismiss" aria-label="Dismiss">&times;</button>';
            note.querySelector('.mcfo-tomato__time').textContent = time;
            note.querySelector('button').addEventListener('click', e => {
                e.preventDefault();
                e.stopPropagation();
                rec.gone = true;
                msg.setAttribute('data-mcfo-tomato-gone', '1');
            });
            msg.appendChild(note);
            msg.setAttribute('data-mcfo-tomato', '1');
        }
        const text = note.querySelector('.mcfo-tomato__text');
        if (text.innerHTML !== html) text.innerHTML = html;
    }

    function tomatoOutRow(msg, m, time, seen) {
        const raw = m[0].trim();
        const n = (seen.get(raw + '|' + time) || 0) + 1;
        seen.set(raw + '|' + time, n);
        const key = raw + '|' + time + '|' + n;
        let rec = tomatoRows.get(key);
        if (!rec) {
            const run = tomatoRun && Date.now() <= tomatoRun.until ? tomatoRun : null;
            rec = { run, host: !run || !run.host, gone: false };
            if (run) {
                run.host = true;
                if (m[1]) run.landed.push(m[1]); else if (m[2]) run.waits++; else if (m[3]) run.missing.push(m[3]); else run.other++;
            }
            tomatoRows.set(key, rec);
        }
        return rec;
    }
    // Drawn after the whole list was counted: the line of a bundle sits on its FIRST answer, and
    // the later ones must already be in its numbers.
    function tomatoOutDraw(msg, m, time, rec) {
        if (rec.gone || !rec.host) { if (!msg.hasAttribute('data-mcfo-tomato-gone')) msg.setAttribute('data-mcfo-tomato-gone', '1'); return; }
        const html = rec.run ? tomatoRunText(rec.run)
            : m[1] ? `Tomato sent to <b>${escapeHtml(m[1])}</b>`
            : m[2] ? 'Tomato: that player is on cooldown, try again in a moment'
            : m[3] ? `Tomato: <b>${escapeHtml(m[3])}</b> is not in the game`
            : 'Tomato thrown';
        tomatoNote(msg, html, time, rec);
    }

    function tomatoPass(list) {
        const rows = list.querySelectorAll('article.mcf-chat__private');
        const seen = new Map(), outs = [];
        let open = false;
        for (const msg of rows) {
            const own = msg.querySelector(':scope > .mcfo-tomato');
            if (!settings.chatTomato) {
                if (own) own.remove();
                msg.removeAttribute('data-mcfo-tomato');
                msg.removeAttribute('data-mcfo-tomato-gone');
                continue;
            }
            const textEl = msg.querySelector(':scope > .mcf-chat__text');
            const time = [...msg.querySelectorAll(':scope > .mcf-chat__meta span')]
                .map(x => x.textContent.trim()).find(t => /^\d{1,2}:\d{2}/.test(t)) || '';
            const out = textEl && (textEl.textContent || '').match(TOMATO_OUT_RE);
            if (out) {
                const rec = tomatoOutRow(msg, out, time, seen);
                outs.push([msg, out, time, rec]);
                if (rec && rec.run && rec.host && rec.run.sent !== undefined && Date.now() <= rec.run.until + 1000) open = true;
                continue;
            }
            if (own) continue;
            const m = textEl && (textEl.textContent || '').match(TOMATO_IN_RE);
            if (!m) continue;
            const key = m[1] + '|' + time;
            const note = document.createElement('div');
            note.className = 'mcfo-tomato';
            note.innerHTML = TOMATO_ICON + '<span class="mcfo-tomato__text"><b></b> threw a tomato at you</span>'
                + '<span class="mcfo-tomato__time"></span>'
                + '<button type="button" class="mcfo-tomato__x" title="Dismiss" aria-label="Dismiss">&times;</button>';
            note.querySelector('b').textContent = m[1];
            note.querySelector('.mcfo-tomato__time').textContent = time;
            note.querySelector('button').addEventListener('click', e => {
                e.preventDefault();
                e.stopPropagation();
                tomatoGone.add(key);
                msg.setAttribute('data-mcfo-tomato-gone', '1');
            });
            msg.appendChild(note);
            msg.setAttribute('data-mcfo-tomato', '1');
            if (tomatoGone.has(key)) msg.setAttribute('data-mcfo-tomato-gone', '1');
        }
        for (const o of outs) tomatoOutDraw(...o);
        if (open && tomatoRun && !tomatoRun.finalTimer) {
            tomatoRun.finalTimer = setTimeout(() => tomatoPass(list), Math.max(0, tomatoRun.until - Date.now()) + 200);
        }
    }

    // --- The tomato button (6.35) ---
    // Throwing is the game's own !tomato, typed into its chat form for you: one line per player,
    // "!tomato <name>". The game's client has sent a tomato with a name but without a picked
    // suggestion since v0.10.1 (targetSelectionRequired leaves tomato out), the server finds the
    // player by name. So nothing is assembled here, and a refusal (the cooldown is 60 s per
    // thrower and target) comes back in the chat as the game's own line.
    // The names are the list the game offers after "!tomato": /api/gameplay/chat-command/tomato-targets,
    // { ok, users: [{ playerId, displayName }] } — players in the game, not only those in the chat.
    const TOMATO_GAP_MS = 700;     // between two lines, so the chat does not take them for a flood
    const tomatoPick = { names: [], at: 0, chosen: new Set(), busy: false, all: false };
    // "All" is kept as a choice of its own (6.38.2): while it is ticked, players who turn up later
    // are ticked as well — when the popup opens and again right before a throw. Unticking anyone
    // ends it. Remembered across reloads.
    const TOMATO_ALL_KEY = 'mcfo_tomato_all';
    try { tomatoPick.all = localStorage.getItem(TOMATO_ALL_KEY) === '1'; } catch (e) { /* blocked */ }
    function tomatoSetAll(on) {
        tomatoPick.all = !!on;
        try { localStorage.setItem(TOMATO_ALL_KEY, on ? '1' : '0'); } catch (e) { /* blocked */ }
    }

    async function loadTomatoTargets() {
        if (Date.now() - tomatoPick.at < 10 * 1000) return tomatoPick.names;
        const res = await fetch('/api/gameplay/chat-command/tomato-targets', { credentials: 'same-origin', cache: 'no-store' });
        const body = await res.json().catch(() => ({}));
        if (!res.ok || !body || body.ok === false || !Array.isArray(body.users)) throw new Error('The game did not hand out the list (HTTP ' + res.status + ').');
        const me = (accountName() || '').toLowerCase();
        const seen = new Set();
        tomatoPick.names = body.users.map(u => String(u.displayName || '').trim())
            .filter(n => n && n.toLowerCase() !== me && !seen.has(n.toLowerCase()) && seen.add(n.toLowerCase()))
            .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
        tomatoPick.at = Date.now();
        return tomatoPick.names;
    }

    function drawTomatoButton() {
        const on = !!settings.chatTomatoBtn && !signedOut();
        document.documentElement.setAttribute('data-mcfo-tombtn', on ? '1' : '0');
        const form = chatRoot() && chatRoot().querySelector('[data-role="chat-form"]');
        const send = form && form.querySelector('[data-role="chat-send"], .mcf-chat__send');
        let btn = document.querySelector('.mcfo-tomato-btn');
        if (!on) { if (btn) btn.remove(); return; }
        if (!form || !send || (btn && btn.nextElementSibling === send)) return;
        if (!btn) {
            btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'mcfo-tomato-btn';
            btn.title = 'Throw tomatoes';
            btn.setAttribute('aria-label', 'Throw tomatoes');
            btn.innerHTML = TOMATO_ICON;
            btn.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); showTomatoPanel(btn); });
        }
        form.insertBefore(btn, send);   // type="button": it never submits the form
    }

    function showTomatoPanel(anchor) {
        const menu = showPanel(anchor, 'mcfo-menu--tomato', m => {
            m.innerHTML = '<div class="mcfo-tom__head">Throw tomatoes</div>'
                + '<div class="mcfo-tom__list"><div class="mcfo-tom__empty">Loading players …</div></div>'
                + '<button type="button" class="mcfo-tom__go" disabled>Throw</button>'
                + '<div class="mcfo-tom__msg"></div>';
        });
        if (!menu) return;
        const list = menu.querySelector('.mcfo-tom__list');
        const go = menu.querySelector('.mcfo-tom__go');
        const msg = menu.querySelector('.mcfo-tom__msg');
        const say = (text, tone) => { msg.textContent = text; msg.setAttribute('data-tone', tone || ''); };
        const count = () => {
            const n = tomatoPick.names.filter(x => tomatoPick.chosen.has(x)).length;
            go.disabled = !n || tomatoPick.busy;
            go.textContent = tomatoPick.busy ? 'Throwing …' : n ? `Throw at ${n}` : 'Throw';
            const all = list.querySelector('.mcfo-tom__row--all input');
            if (all) { all.checked = n > 0 && n === tomatoPick.names.length; all.indeterminate = n > 0 && n < tomatoPick.names.length; }
        };
        const row = (label, checked, onChange, extra) => {
            const r = document.createElement('label');
            r.className = 'mcfo-tom__row' + (extra ? ' ' + extra : '');
            const box = document.createElement('input');
            box.type = 'checkbox';
            box.checked = checked;
            box.addEventListener('change', () => { onChange(box.checked); count(); });
            const name = document.createElement('span');
            name.textContent = label;
            r.append(box, name);
            return r;
        };
        loadTomatoTargets().then(names => {
            if (!menu.isConnected) return;
            // Picks from last time stay, as long as the player is still there: throwing at the
            // same few again after the cooldown is the usual case.
            for (const n of [...tomatoPick.chosen]) if (!names.includes(n)) tomatoPick.chosen.delete(n);
            if (tomatoPick.all) names.forEach(n => tomatoPick.chosen.add(n));
            list.innerHTML = '';
            if (!names.length) {
                list.innerHTML = '<div class="mcfo-tom__empty">Nobody to throw at right now.</div>';
            } else {
                list.appendChild(row(`All (${names.length})`, false, on => {
                    tomatoSetAll(on);
                    names.forEach(n => on ? tomatoPick.chosen.add(n) : tomatoPick.chosen.delete(n));
                    list.querySelectorAll('.mcfo-tom__row:not(.mcfo-tom__row--all) input').forEach(b => { b.checked = on; });
                }, 'mcfo-tom__row--all'));
                for (const n of names) list.appendChild(row(n, tomatoPick.chosen.has(n), on => {
                    if (on) tomatoPick.chosen.add(n);
                    else { tomatoPick.chosen.delete(n); tomatoSetAll(false); }
                }));
            }
            count();
            placePanel(anchor, menu);
        }).catch(e => {
            if (!menu.isConnected) return;
            list.innerHTML = '<div class="mcfo-tom__empty"></div>';
            list.firstChild.textContent = e.message || String(e);
        });
        go.addEventListener('click', async e => {
            e.preventDefault();
            e.stopPropagation();
            if (tomatoPick.busy) return;
            // With All on, whoever joined while the popup was open is taken along too.
            if (tomatoPick.all) {
                try { await loadTomatoTargets(); } catch (err) { /* the list we have will do */ }
                tomatoPick.names.forEach(n => tomatoPick.chosen.add(n));
            }
            const targets = tomatoPick.names.filter(n => tomatoPick.chosen.has(n));
            if (!targets.length || tomatoPick.busy) return;
            // The popup goes at once (Luce, 6.35.2); the throws carry on, and their answers come
            // as one line in the chat.
            closeMenus();
            tomatoPick.busy = true;
            // The answers to these throws are gathered into one line (tomatoPass).
            tomatoRun = { targets, until: Infinity, landed: [], waits: 0, missing: [], other: 0, host: false };
            let sent = 0, why = '';
            for (const [i, n] of targets.entries()) {
                if (i) await new Promise(r => setTimeout(r, TOMATO_GAP_MS));
                const r = sendChatLine('!tomato ' + n);
                if (r.ok) sent++; else { why = r.why; break; }
            }
            tomatoPick.busy = false;
            tomatoRun.sent = sent;
            // Answers come within a second as a rule; a little longer for a busy server.
            tomatoRun.until = Date.now() + 10 * 1000;
            chatPassSoon();
            // The popup is gone by now: only a failure to send at all needs saying, as a notice.
            if (why) notice(escapeHtml(`${sent} of ${targets.length} tomatoes thrown. ${why}.`), 'error');
        });
    }

    // --- Animal calls (6.39) ---
    // The hidden gathering commands of game v0.10.0b: a call (!howl) starts or joins the gathering
    // of one animal. The game shows nobody which word belongs to which animal, so the list is
    // written down here (the MarbleMind bot found them all). Emojis are built from code points:
    // the source stays ASCII.
    // What the chat shows of a gathering: each joiner's line turns into the animal's emoji, the
    // n-th joiner gets n of them (from the fifth on the row is decorated, so they are counted, not
    // matched). A gathering ends 10 minutes after the LAST join, one runs at a time.
    const cp = (...c) => String.fromCodePoint(...c);
    const ANIMAL_CALLS = [
        ['bee', 'buzz', [cp(0x1F41D)]],
        ['cat', 'meow', [cp(0x1F431), cp(0x1F408)]],
        ['cow', 'moo', [cp(0x1F42E), cp(0x1F404)]],
        ['crow', 'caw', [cp(0x1F426, 0x200D, 0x2B1B), cp(0x1F426)]],
        ['dog', 'woof', [cp(0x1F436), cp(0x1F415)]],
        ['duck', 'quack', [cp(0x1F986)]],
        ['elephant', 'trumpet', [cp(0x1F418)]],
        ['fox', 'yip', [cp(0x1F98A)]],
        ['frog', 'croak', [cp(0x1F438)]],
        ['goose', 'honk', [cp(0x1FABF)]],
        ['horse', 'neigh', [cp(0x1F434), cp(0x1F40E)]],
        ['lion', 'roar', [cp(0x1F981)]],
        ['mouse', 'squeak', [cp(0x1F42D), cp(0x1F401)]],
        ['owl', 'hoot', [cp(0x1F989)]],
        ['pig', 'oink', [cp(0x1F437), cp(0x1F416)]],
        ['sheep', 'baa', [cp(0x1F411)]],
        ['wolf', 'howl', [cp(0x1F43A)]],
    ].map(([id, call, emojis]) => ({ id, call, emojis, label: id[0].toUpperCase() + id.slice(1) }));
    const ANIMAL_GATHER_MS = 10 * 60 * 1000;
    const PAW_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">'
        + '<ellipse cx="6" cy="10" rx="2.2" ry="2.8"/><ellipse cx="10" cy="5.8" rx="2.2" ry="2.9"/>'
        + '<ellipse cx="14" cy="5.8" rx="2.2" ry="2.9"/><ellipse cx="18" cy="10" rx="2.2" ry="2.8"/>'
        + '<path d="M12 11c-3 0-6.5 4.2-6.5 6.6 0 2 1.7 2.6 3.3 2.2 1.2-.3 2.1-.8 3.2-.8s2 .5 3.2.8c1.6.4 3.3-.2 3.3-2.2 0-2.4-3.5-6.6-6.5-6.6z"/>'
        + '</svg>';

    // Which animal a chat line is a gathering line of, and the joiner's place — or null. Only
    // lines of nothing but emojis count: someone writing about wolves is no wolf.
    function animalOfText(text) {
        const raw = String(text || '').trim().replace(/\uFE0F/g, '');
        if (!raw || /[\p{L}\p{N}]/u.test(raw)) return null;
        let best = null, tie = false;
        for (const a of ANIMAL_CALLS) {
            // Per animal the most of any of its spellings: the black crow contains the bird.
            const n = Math.max(...a.emojis.map(e => raw.split(e).length - 1));
            if (!n) continue;
            if (!best || n > best.n) { best = { animal: a, n }; tie = false; }
            else if (n === best.n) tie = true;
        }
        return best && !tie ? best : null;
    }

    // The chat's own clock is minutes only ("7:42" or "7:42 PM", the viewer's locale). A line
    // seen arriving gets the real moment; an older one the middle of its minute.
    const animalRows = new WeakMap();
    function chatRowTime(msg) {
        const t = [...msg.querySelectorAll('.mcf-chat__meta span, .mcf-chat__meta')]
            .map(x => x.textContent.trim().match(/(\d{1,2}):(\d{2})\s*([AaPp])?\.?\s*[Mm]?/)).find(Boolean);
        if (!t) return null;
        let h = +t[1];
        if (t[3]) h = (h % 12) + (/p/i.test(t[3]) ? 12 : 0);
        const d = new Date();
        d.setHours(h, +t[2], 30, 0);
        if (d.getTime() > Date.now() + 60 * 1000) d.setDate(d.getDate() - 1);
        return d.getTime();
    }
    function animalRow(msg) {
        if (animalRows.has(msg)) return animalRows.get(msg);
        const hit = animalOfText(msg.querySelector('.mcf-chat__text')?.textContent);
        let rec = null;
        if (hit) {
            const shown = chatRowTime(msg);
            // Within the current minute: it just came in, now is better than the minute.
            const at = shown === null || Math.abs(Date.now() - shown) < 60 * 1000 ? Date.now() : shown;
            const who = senderText(msg.querySelector('.mcf-chat__sender')).toLowerCase();
            rec = { animal: hit.animal, n: hit.n, at, who, msg };
        }
        animalRows.set(msg, rec);
        return rec;
    }

    // Every gathering the chat shows, one chain per animal: lines of the same animal less than 10
    // minutes apart. A chain ends 10 minutes after its last line.
    function animalChains(list) {
        const recs = [...list.querySelectorAll('article.mcf-chat__message:not(.mcf-chat__private)')].map(animalRow).filter(Boolean);
        recs.sort((a, b) => a.at - b.at);
        const open = new Map(), chains = [];
        for (const r of recs) {
            let c = open.get(r.animal);
            if (!c || r.at - c.last.at > ANIMAL_GATHER_MS) {
                c = { animal: r.animal, recs: [], first: r, last: r };
                open.set(r.animal, c);
                chains.push(c);
            }
            c.recs.push(r);
            c.last = r;
        }
        for (const c of chains) c.ends = c.last.at + ANIMAL_GATHER_MS;
        return chains;
    }

    // The ends of gatherings seen, per animal, kept across reloads (6.40): the chat holds only
    // its last lines, the cooldowns run an hour. { animalId: endMs }, older than two hours dropped.
    const ANIMAL_ENDS_KEY = 'mcfo_animal_ends';
    const ANIMAL_REST_MS = 60 * 60 * 1000;    // the same animal: an hour after its gathering ended
    const ANIMAL_PAUSE_MS = 10 * 60 * 1000;   // any animal: at least 10 minutes after the last one ended
    let animalEnds = {};
    try { animalEnds = JSON.parse(localStorage.getItem(ANIMAL_ENDS_KEY) || '{}') || {}; } catch (e) { animalEnds = {}; }
    function animalRemember(chains) {
        let changed = false;
        for (const c of chains) {
            // A running gathering is not over yet: its end still moves with every join.
            if (c.ends > Date.now()) continue;
            if (!(animalEnds[c.animal.id] >= c.ends)) { animalEnds[c.animal.id] = c.ends; changed = true; }
        }
        for (const [id, t] of Object.entries(animalEnds)) {
            if (!(Date.now() - t < ANIMAL_REST_MS + ANIMAL_PAUSE_MS * 6)) { delete animalEnds[id]; changed = true; }
        }
        if (changed) { try { localStorage.setItem(ANIMAL_ENDS_KEY, JSON.stringify(animalEnds)); } catch (e) { /* blocked */ } }
    }

    // The gathering running now: the chain with the latest line, while its 10 minutes last.
    // mine: one of its lines is yours, so you are in already (6.39.1) — or the game said so
    // privately ("You're already part of the pack.") after its first line.
    function animalGathering() {
        const list = document.querySelector(CHAT_LIST_SEL);
        if (!list) return null;
        const chains = animalChains(list);
        animalRemember(chains);
        if (!chains.length) return null;
        const c = chains.reduce((x, y) => (y.last.at >= x.last.at ? y : x));
        if (Date.now() >= c.ends) return null;
        const me = (accountName() || '').toLowerCase();
        let mine = !!me && c.recs.some(r => r.who === me);
        if (!mine && c.first.msg.isConnected) {
            for (const p of list.querySelectorAll('article.mcf-chat__private')) {
                if (!(c.first.msg.compareDocumentPosition(p) & Node.DOCUMENT_POSITION_FOLLOWING)) continue;
                if (/already part of the/i.test(p.querySelector('.mcf-chat__text')?.textContent || p.textContent || '')) { mine = true; break; }
            }
        }
        return { animal: c.animal, joined: Math.max(...c.recs.map(r => r.n)), ends: c.ends, mine };
    }

    // When a new gathering can start at the earliest (6.40), as far as the gatherings seen tell:
    // pause = for every animal (the one running, or the 10 minutes after the last one);
    // rest = per animal, an hour after its own gathering ended.
    function animalCooldowns(g) {
        const now = Date.now();
        const lastEnd = Math.max(0, ...Object.values(animalEnds));
        const pauseUntil = Math.max(g ? g.ends + ANIMAL_PAUSE_MS : 0, lastEnd + ANIMAL_PAUSE_MS);
        const rest = {};
        for (const a of ANIMAL_CALLS) {
            const t = (animalEnds[a.id] || 0) + ANIMAL_REST_MS;
            if (t > now) rest[a.id] = t;
        }
        return { pause: pauseUntil > now ? pauseUntil : 0, rest };
    }
    const minsFrom = t => Math.max(1, Math.ceil((t - Date.now()) / 60000));
    function animalLiveText(g) {
        const min = Math.max(1, Math.round((g.ends - Date.now()) / 60000));
        return `${g.joined} joined, ~${min} min left`;
    }

    function drawAnimalButton() {
        const on = !!settings.chatAnimalBtn && !signedOut();
        const form = chatRoot() && chatRoot().querySelector('[data-role="chat-form"]');
        const send = form && form.querySelector('[data-role="chat-send"], .mcf-chat__send');
        let btn = document.querySelector('.mcfo-animal-btn');
        if (!on) { if (btn) btn.remove(); return; }
        if (!form || !send) return;
        if (!btn) {
            btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'mcfo-animal-btn';
            btn.setAttribute('aria-label', 'Animal calls');
            btn.innerHTML = PAW_ICON;
            btn.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); showAnimalPanel(btn); });
        }
        // Left of the tomato when that is there, else right before Send.
        const tomato = form.querySelector(':scope > .mcfo-tomato-btn');
        const next = tomato || send;
        if (btn.nextElementSibling !== next) form.insertBefore(btn, next);   // type="button": never submits
        const g = animalGathering();
        btn.toggleAttribute('data-mcfo-live', !!g);
        btn.toggleAttribute('data-mcfo-joined', !!(g && g.mine));
        btn.title = g ? `Animal calls - ${g.animal.label} gathering: ${animalLiveText(g)}${g.mine ? ', you are in' : ''}` : 'Animal calls';
    }

    function showAnimalPanel(anchor) {
        const g = animalGathering();
        const cd = animalCooldowns(g);
        const menu = showPanel(anchor, 'mcfo-menu--animals', m => {
            m.innerHTML = '<div class="mcfo-ani__head">Animal calls</div><div class="mcfo-ani__next"></div><div class="mcfo-ani__list"></div>'
                + '<div class="mcfo-ani__foot">One gathering at a time; each call joins it. After one ends, the next can start 10 minutes later at the earliest, and the same animal rests for an hour. Times count from the gatherings this tab has seen in the chat.</div>';
            const next = m.querySelector('.mcfo-ani__next');
            // Only one gathering at a time: while it runs or right after, no other animal starts.
            if (cd.pause) next.textContent = `Next new gathering in ~${minsFrom(cd.pause)} min`;
            else { next.textContent = 'A new gathering can start now'; next.setAttribute('data-ready', ''); }
            const list = m.querySelector('.mcfo-ani__list');
            const order = g ? [g.animal, ...ANIMAL_CALLS.filter(a => a !== g.animal)] : ANIMAL_CALLS;
            for (const a of order) {
                const live = !!g && a === g.animal;
                const b = document.createElement('button');
                b.type = 'button';
                b.className = 'mcfo-ani__row' + (live ? ' mcfo-ani__row--live' : '') + (live && g.mine ? ' mcfo-ani__row--joined' : '');
                b.innerHTML = '<span class="mcfo-ani__emoji"></span><span class="mcfo-ani__name"></span><span class="mcfo-ani__call"></span>';
                b.querySelector('.mcfo-ani__emoji').textContent = a.emojis[0];
                b.querySelector('.mcfo-ani__name').textContent = a.label;
                b.querySelector('.mcfo-ani__call').textContent = !live ? '!' + a.call : g.mine ? 'Joined \u2713' : 'Join !' + a.call;
                if (live) {
                    const sub = document.createElement('span');
                    sub.className = 'mcfo-ani__live';
                    sub.textContent = (g.mine ? 'You are in: ' : 'Gathering: ') + animalLiveText(g);
                    b.appendChild(sub);   // a row of its own, across name and call
                } else if (cd.rest[a.id] && cd.rest[a.id] > cd.pause) {
                    // Its own hour outlasts the pause for all: worth saying per animal.
                    b.classList.add('mcfo-ani__row--rest');
                    const sub = document.createElement('span');
                    sub.className = 'mcfo-ani__rest';
                    sub.textContent = `Resting, ~${minsFrom(cd.rest[a.id])} min`;
                    b.appendChild(sub);
                }
                b.title = 'Send !' + a.call;
                b.addEventListener('click', e => {
                    e.preventDefault();
                    e.stopPropagation();
                    closeMenus();
                    // A refusal ("The pack is resting.") comes back as the game's own chat line.
                    const r = sendChatLine('!' + a.call);
                    if (!r.ok) notice(escapeHtml(`!${a.call} not sent. ${r.why}.`), 'error');
                });
                list.appendChild(b);
            }
        });
        if (menu) placePanel(anchor, menu);
    }

