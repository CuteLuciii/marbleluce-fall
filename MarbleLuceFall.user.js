// ==UserScript==
// @name         MarbleLuceFall
// @namespace    http://tampermonkey.net/
// @version      6.25
// @description  Layout overhaul for Marble Crownfall: 50+ colour themes (pride, games, film, books, music, patterns, random), pages as windows over the game, autobid with risk protection, unbid and extra ticket chips, king name and toll on the tile, beverage bar, auto toll and beverages on the throne, enhanced chat, a music player with a movable bar, performance levels, how-to and what’s new.
// @author       DreamingLucie
// @match        *://*.marblecrownfall.com/*
// @match        *://marblecrownfall.com/*
// @license      MIT
// @grant        GM_addStyle
// @grant        unsafeWindow
// @run-at       document-start
// ==/UserScript==

/*
 * WHAT THIS IS
 * ------------
 * A layout pass over the live game. It moves nothing off-screen and deletes nothing: every
 * change is either a CSS rule keyed on an attribute of <html>, or a node this script owns and
 * removes again. Turning a switch off restores the original page.
 *
 * It talks to no third-party service. Everything it shows is read from the page itself or from
 * the game's own public endpoints.
 *
 * THE IDEA BEHIND IT
 * ------------------
 * Two problems with the stock layout, and one rule that follows from them:
 *
 *   1. Leaving the board costs you the board. Dailies, Inventory, Leaderboards, Profile and Shop
 *      are ordinary page loads, so opening one tears down the running game and rebuilds it when
 *      you come back. They are opened in an overlay here instead; the game keeps running behind
 *      it, and the second visit is instant because the frame is kept.
 *
 *   2. The footer had eleven buttons in a row and the header had four cards that looked like
 *      read-outs. Everything was reachable and nothing was findable.
 *
 *   The rule: anything removed from the footer must reappear somewhere that says what it is.
 *   The header cards therefore carry labels — Gold is the way to the shop, Diamonds to the
 *   packages, your name to your account, the tileset card to the schedule. A card that opens
 *   something has to say so, or this is a downgrade for anyone who does not already know the
 *   layout by heart.
 *
 * ANCHORS
 * -------
 * Everything is found through the game's own data-role attributes. They are stable across
 * builds; class names are not (they carry build hashes).
 */

(function () {
    'use strict';

    // The script also runs inside the overlay iframes — they serve the same origin. It must not
    // do its work there: every embedded page would build its own overlay, its own footer and a
    // second account menu. The frames are styled from the outside instead (see framePanelMode).
    if (window.top !== window.self) return;

    // =========================================================================================
    // 0. LANE STATE, READ ALONG FROM THE GAME'S SOCKET  (the only part that runs this early)
    // =========================================================================================
    // Autobid (9g) needs to know, lane by lane, which tile is up, which run it belongs to and
    // whether its bidding window is open. The game keeps that inside its modules
    // (laneStateByLane, app.js) and has no endpoint for it: it only arrives as lane_state.v1
    // frames on the gameplay socket, which prodViewer/ingest.js opens with a plain
    // new WebSocket('/ws'). So that socket is read along, passively, the way 1.5 read it for its
    // gold counter. Nothing is ever sent on it.
    //
    // This is why the script runs at document-start since 5.0: the tap has to be in place before
    // the game opens its socket. Everything else waits for the DOM as before — see main() and the
    // end of the file.
    //
    // The tap goes into the page through unsafeWindow. With any @grant the script lives in a
    // sandbox, and a WebSocket replaced there is replaced for the script alone (1.5 found that
    // out: window.WebSocket in the page still read "[native code]").
    const pageWindow = (typeof unsafeWindow !== 'undefined' && unsafeWindow) || window;
    const lanes = new Map();          // laneKey -> { phase, open, runId, tile, at, runChangedAt }
    const laneListeners = [];
    const tapStartedAt = Date.now();
    let tapInstalled = false;

    // One lane_state payload — from the socket, or from the reply to a bid (bidPreviewLaneState).
    function noteLane(laneKey, p, source) {
        const now = Date.now();
        const prev = lanes.get(laneKey);
        const runId = String(p.runId || '');
        const entry = {
            phase: String(p.nativePhase || p.phase || ''),
            open: p.biddingOpen === true,
            runId,
            tile: String(p.tileId || '').trim(),
            at: now,
            // For lane trust (9g) only a CHANGE of run counts, never the mere arrival of a frame:
            // a lane that keeps sending frames of an old run looks fresh and is not (the bot's
            // lesson of 06.08.). The first sighting counts as a change, as in the bot.
            runChangedAt: runId && runId !== (prev ? prev.runId : '') ? now : (prev ? prev.runChangedAt : 0),
        };
        lanes.set(laneKey, entry);
        for (const fn of laneListeners) {
            try { fn(laneKey, entry, prev, source); } catch (e) { /* a listener never breaks the tap */ }
        }
    }

    // Frames come one by one or bundled in kernel_outputs.v1; the bot unpacks them the same way.
    function takeFrame(msg) {
        if (!msg || typeof msg !== 'object') return;
        if (msg.kind === 'kernel_outputs.v1' && Array.isArray(msg.kernelOutputs)) { msg.kernelOutputs.forEach(takeFrame); return; }
        if (msg.kind === 'lane_state.v1' && msg.laneKey && msg.payload && typeof msg.payload === 'object') {
            noteLane(String(msg.laneKey), msg.payload, 'socket');
        }
    }

    function readFrame(data) {
        // Binary frames are physics, most text frames are event digests. Only a frame that
        // mentions lane_state is worth a JSON.parse.
        if (typeof data !== 'string' || data.indexOf('lane_state.v1') === -1) return;
        try { takeFrame(JSON.parse(data)); } catch (e) { /* a broken frame is skipped */ }
    }

    // One socket, tapped at most once, whoever hands it over. The gameplay socket only, never
    // the chat (/chat/ws). Reading a socket that is already open costs nothing: lane_state frames
    // arrive again and again, so there is nothing to catch up on.
    const tappedSockets = new WeakSet();
    function tapSocket(ws) {
        try {
            if (!ws || tappedSockets.has(ws)) return;
            if (new URL(String(ws.url || ''), location.href).pathname !== '/ws') return;
            tappedSockets.add(ws);        // set first: our own addEventListener comes back through here
            ws.addEventListener('message', e => readFrame(e.data));
        } catch (e) { /* never let the tap break the socket */ }
    }

    try {
        const NativeWebSocket = pageWindow.WebSocket;
        // A subclass keeps instanceof, the readyState constants and every method intact.
        class TappedWebSocket extends NativeWebSocket {
            constructor(...args) {
                super(...args);
                tapSocket(this);
            }
        }
        pageWindow.WebSocket = TappedWebSocket;

        // The constructor is the clean way, but it only catches a socket this script was in time
        // for. When the userscript manager injects late — seen in the wild after a cold browser
        // start — the game's socket already exists, not one frame is ever read, and autobid sits
        // there switched on bidding nothing until the page is reloaded (20.09.2026).
        //
        // So the instance is taken from the two methods the game uses on it afterwards as well.
        // It adds its own message listener after the constructor has returned, it sends a
        // subscribe from its own open handler on every connect, and it sends a resync whenever a
        // lane needs a fresh basis (prodViewer/ingest.js) — whichever of those comes first hands
        // the socket over. Both wrappers pass everything through untouched.
        const proto = NativeWebSocket.prototype;
        const nativeAdd = proto.addEventListener;
        proto.addEventListener = function (...args) { tapSocket(this); return nativeAdd.apply(this, args); };
        const nativeSend = proto.send;
        proto.send = function (...args) { tapSocket(this); return nativeSend.apply(this, args); };

        tapInstalled = true;
    } catch (e) {
        // Without the tap everything else still works; autobid then says it cannot see the lanes.
        console.warn('[MarbleLuceFall] could not read the lanes, autobid stays idle:', e.message);
    }

    // Everything from here on needs the page, and starts once it is there (end of the file).
    function main() {

    // =========================================================================================
    // 1. SETTINGS
    // =========================================================================================
    const STORAGE_KEY = 'mcf_overhaul_settings';
    let stored = {};
    try { stored = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch (e) { stored = {}; }

    // The footer buttons this script can hide, each on its own switch. Every one of them stays
    // reachable somewhere else, and the settings say where — hiding a button must never make a
    // page unreachable without the player knowing.
    const FOOTER_BUTTONS = [
        { role: 'dailies-nav',      key: 'hideDailies',      label: 'Dailies',      where: 'account menu' },
        { role: 'inventory-nav',    key: 'hideInventory',    label: 'Inventory',    where: 'account menu' },
        { role: 'leaderboards-nav', key: 'hideLeaderboards', label: 'Leaderboards', where: 'account menu' },
        { role: 'profile-nav',      key: 'hideProfile',      label: 'Profile',      where: 'account menu' },
        { role: 'events-nav',       key: 'hideEvents',       label: 'Events',       where: 'tileset card' },
        { role: 'shop-nav',         key: 'hideShop',         label: 'Shop',         where: 'Gold card' },
    ];

    // Everything the settings window offers, in the order it shows it. A switch defaults to on;
    // a sub-control (slider, choice) belongs to the switch above it and is greyed out while that
    // is off. The keys double as storage keys, so a key once shipped must never change meaning —
    // which is why the two combined switches of 3.7 (kingOverlay, tidyFooter) were not reused
    // but split into new keys and migrated below.
    // PERFORMANCE. Every lever works from the outside — CSS, or pacing the page's own
    // requestAnimationFrame — and none touches the game logic: that runs on its own 50 ms beat
    // measured against the clock (ingest.js, localFrameCadenceMs), so a slower picture never
    // means a slower game. What each lever costs was found in the client, not guessed; the
    // comments at the CSS rules and in section 14 say where.
    const PERF_LEVERS = [
        { key: 'perfShadows',    label: 'No shadows on the king tile',
          hint: 'The turning crown and every wall block carry a drop shadow that is recomputed on every frame.' },
        { key: 'perfCrownStill', label: 'Crown stands still',
          hint: 'The 3D crown stops turning and is redrawn twice a second instead of on every frame.' },
        { key: 'perfChatMotion', label: 'No chat animations',
          hint: 'Shimmer, pulse and twinkle of chat cosmetics.' },
        { key: 'perfNoBlur',     label: 'No blur behind windows',
          hint: 'Transparent windows stay see-through, just without the frosted glass.' },
        { key: 'perfFpsCap',     label: 'Frame rate cap', type: 'choice', def: 0,
          options: [[0, 'Off'], [30, '30 fps'], [20, '20 fps']],
          hint: 'How often the picture is redrawn. The game itself runs 20 times a second either way.' },
        { key: 'perfCrownHide',  label: 'Hide the crown',
          hint: 'No 3D crown at all. The cheapest option for the king tile.' },
        { key: 'perfEdges',      label: 'Plain edges',
          hint: 'Board and king tile drawn without anti-aliasing: slightly jagged, less work.' },
    ];
    const PERF_LEVELS = [
        { id: 'off',      label: 'Off',      text: 'Everything as the game draws it.', set: {} },
        { id: 'light',    label: 'Light',    text: 'The crown stands still, no shadows on the king tile, no chat animations, no blur behind windows. Looks almost the same.',
          set: { perfShadows: true, perfCrownStill: true, perfChatMotion: true, perfNoBlur: true } },
        { id: 'balanced', label: 'Balanced', text: 'Light, and the picture is redrawn at most 30 times a second.',
          set: { perfShadows: true, perfCrownStill: true, perfChatMotion: true, perfNoBlur: true, perfFpsCap: 30 } },
        { id: 'maximum',  label: 'Maximum',  text: 'At most 20 frames a second, no crown, plain edges. Noticeably plainer.',
          set: { perfShadows: true, perfCrownStill: true, perfChatMotion: true, perfNoBlur: true, perfFpsCap: 20, perfCrownHide: true, perfEdges: true } },
        { id: 'custom',   label: 'Custom',   text: 'Your own mix. Changing any lever below switches here.', set: null },
    ];

    const SETTINGS_SECTIONS = [
        { title: 'Windows', blurb: 'Pages over the running game, see-through windows, a board that follows the window.', items: [
            { key: 'pageOverlay', label: 'Open pages in windows',
              hint: 'Dailies, Inventory, Shop and the rest open over the running game instead of leaving it.' },
            { key: 'glassOverlays', label: 'Transparency',
              hint: 'Let the board show through the windows.',
              sub: { key: 'glassLevel', type: 'range', label: 'See-through', min: 5, max: 70, step: 1, def: 22, unit: '%' } },
            { key: 'boardRefit', label: 'Refit the board to the window',
              hint: 'When the window changes size, moves to another screen, or the attack tray fills in after loading, the lanes and the king tile are sized again to use all the room. The game itself only does that when the chat is opened or closed.' },
            { key: 'chatFit', label: 'Chat height follows the board',
              hint: 'Where the tiles leave room above and below, the chat gives up half of it: shorter than the whole page, still taller than the tiles, everything centred. Measured on every window size.' },
        ]},
        { title: 'Theme', blurb: 'Colours for the whole page, and Deluxe themes with textures and effects.', render: 'theme' },
        { title: 'Performance', blurb: 'Lighter drawing for slower machines.', render: 'performance' },
        { title: 'Header', blurb: 'Account menu, labelled cards, upcoming tilesets, the settings button.', items: [
            { key: 'accountMenu', label: 'Account menu',
              hint: 'Click your name for Profile, Dailies, Inventory, Achievements, Leaderboards and these settings.' },
            { key: 'cardSignposts', label: 'Labels on the header cards',
              hint: 'Gold opens the Shop, Diamonds the packages, the tileset card the schedule.' },
            { key: 'eventsPanel', label: 'Upcoming tilesets',
              hint: 'Click the tileset card to see what comes next.',
              sub: { key: 'eventsHours', type: 'choice', label: 'Look ahead', def: 12, options: [[3, '3 hours'], [12, '12 hours']] } },
            { key: 'tilesetBanner', label: 'Tileset name instead of the splash picture',
              hint: 'When a new tileset begins, its name fades in over the board instead of the full-screen picture, and the board stays visible behind it.' },
            { key: 'settingsButton', label: 'Settings button',
              hint: 'A gear top right in place of the game\'s sound button: one click to these settings. The sound controls are on the Sound page.' },
        ]},
        { title: 'Sound', blurb: 'Sound effects, and a music player over the game\'s whole soundtrack, with a bar for the page.', render: 'sound' },
        { title: 'King tile', blurb: 'King name, toll and beverage buttons on the tile.', items: [
            { key: 'kingName', label: 'King name', hint: 'Top left on the king tile.' },
            { key: 'kingToll', label: 'Toll',      hint: 'Top right on the king tile.' },
            { key: 'tollInput', label: 'Type the toll',
              hint: 'On the throne: a field for 0 to 17, confirmed with Enter, instead of the Reduce and Increase buttons.' },
            { key: 'tollSlider', def: false, label: 'Toll slider',
              hint: 'Adds a slider next to the field. Needs the field above.' },
            { key: 'kingTray', label: 'Beverage buttons',
              hint: 'Water and Lava left of the attack button, Milk and Acid right of it. As symbols they take the look of your theme; the name shows when you point at one.',
              subs: [
                  { key: 'drinkScale', type: 'range', label: 'Button size', min: 70, max: 140, step: 5, def: 100, unit: '%' },
                  { key: 'drinkIcons', type: 'choice', label: 'Show', def: 1, options: [[1, 'Symbols'], [0, 'Names']] },
              ] },
            { key: 'trayLift', label: 'Tray under the tile',
              hint: 'The attack tray sits right under the king tile, whatever the size of the window, instead of at the bottom of the pane.' },
            { key: 'attackAssist', def: false, label: 'Attack when free',
              hint: 'Opt-in. Replaces the attack button with one that also works while you are bidding or in a tile: it sends !unbid once, sits out a lava cooldown (your autobid keeps playing meanwhile), waits until your marble is free and then presses the game\'s own attack button. Click it again to cancel. If something bids for you automatically, it says so instead of waiting in vain. Try again until King: after a miss (a lava bubble, the wall holding) it starts over by itself until you sit on the throne. Every miss costs points, a lava pop takes the value of the bubble, so this can burn through a lot.',
              sub: { key: 'attackRetry', type: 'choice', label: 'After a miss', def: 0, options: [[0, 'Stop'], [1, 'Try again until King']] } },
        ]},
        // 17 is TOLL_MAX of section 9c, which is declared further down and not reachable here.
        { title: 'On the throne', blurb: 'Toll and beverages, set by themselves the moment you take the crown.', throne: true, items: [
            { key: 'throneToll', def: false, label: 'Set the toll',
              hint: 'Opt-in. The moment you take the crown, the toll goes to this value, through the game\'s own Reduce and Increase buttons. Whatever you change later in the reign stays as you set it.',
              sub: { key: 'throneTollValue', type: 'range', label: 'Toll', min: 0, max: 17, step: 1, def: 0, unit: '' } },
            { key: 'throneDrinks', def: false, redraw: true, label: 'Pour beverages',
              hint: 'Opt-in. The beverages picked below are poured as soon as the game unlocks them, 15 seconds into your reign, each through the game\'s own button. Its limits still apply: every beverage, size and currency once per reign, and only with enough gold or diamonds. Starts with your next reign, never in the middle of one.' },
        ]},
        { title: 'Ticket rail', blurb: 'Rebellion, Unbid, folding and extra chips.', items: [
            { key: 'railGroup', label: 'Rebellion button and folding',
              hint: 'Rebellion sits beside the chips, the bigger amounts fold away behind an arrow.' },
            { key: 'unbidButton', label: 'Unbid button',
              hint: 'Right of the chips: takes your bid back out of the queue with one click, the same as typing !unbid in the chat. Hidden while you are King, like Rebellion.' },
            { key: 'autobidButton', label: 'Autobid button',
              hint: 'Right of Unbid: opens the autobid menu, where you switch it on, pick 1 to 100 tickets per tile and choose risk protection. One bid per tile. Hidden and paused while you are King.' },
            { key: 'rebellionPanel', label: 'Own Rebellion panel',
              hint: 'All eight tiers at a glance, with a confirm step before diamonds are spent. Needs the Rebellion button above.' },
            { key: 'extraChips', label: 'Extra ticket chips',
              hint: '10K up to 1B, unlocked like the built-in ones: at ten times the amount in tickets.' },
            { key: 'centreRail', label: 'Centre the rail on the board' },
        ]},
        { title: 'Chat', blurb: 'Slim rail, pop-out window, growing message box and the enhanced chat.', items: [
            { key: 'chatRail', label: 'Smooth collapse and slim rail',
              hint: 'The chat glides open and shut and stays the way you left it after a reload; collapsed, it becomes a slim rail with a counter for new messages.' },
            { key: 'chatPopout', label: 'Pop-out button',
              hint: 'Turns the chat into a window of its own: move it, resize it, park it in the taskbar with a counter. Closing the window puts the chat back.' },
            { key: 'chatGrow', label: 'Growing message box',
              hint: 'The box you type in grows with your message, up to five lines, so a long message stays readable while you write it. Enter sends, as before.' },
            { key: 'chatSuggest', label: 'Tidy name suggestions',
              hint: 'Hides the empty bar the game leaves above the message box, and draws the name list for !tomato and the other targeted commands in the colours of your theme.' },
            { key: 'chatTomato', label: 'Tomatoes as a short notice',
              hint: 'When someone throws a tomato at you, the chat shows one small line with their name instead of the picture, with an x to dismiss it.' },
            { key: 'chatStick', label: 'Stay at the newest message',
              hint: 'While you are at the bottom, the chat stays there — also after a reload and when names, fonts or pictures load late. Scroll up to read, and it stays where you are.' },
        ], extra: { title: 'Enhanced chat', items: [
            { key: 'chatPlus', def: false, label: 'Enhanced chat',
              hint: 'Opt-in. Groups messages by sender, hides the system lines you pick and lets you size the text. While off, the chat stays exactly as the game draws it.' },
            { key: 'chatGroup', needs: 'chatPlus', label: 'Group messages',
              hint: 'Lines from one sender within five minutes share one header, like on Discord.' },
            { key: 'chatHideShop', needs: 'chatPlus', label: 'Hide shop announcements',
              hint: '"... has appeared in the ... Shop" — every rotation, several times over.' },
            { key: 'chatHideCrown', needs: 'chatPlus', label: 'Hide crown messages',
              hint: '"CROWN CLAIMED! ... has captured the Crown" — the king tile shows the king anyway.' },
            { key: 'chatHideToll', needs: 'chatPlus', label: 'Hide toll messages',
              hint: '"... changed the Crown toll" — the toll stands on the king tile.' },
            { key: 'chatCosmeticSwitch', needs: 'chatPlus', label: 'Cosmetics button in colour',
              hint: 'The sparkles button in the chat header (chat cosmetics) turns green while cosmetics are on.' },
            { key: 'chatSizes', needs: 'chatPlus', label: 'Text sizes',
              hint: 'Names and messages in the chat, each on its own.',
              subs: [
                { key: 'chatNameSize', type: 'range', label: 'Names',    min: 80, max: 180, step: 5, def: 115, unit: '%' },
                { key: 'chatTextSize', type: 'range', label: 'Messages', min: 80, max: 180, step: 5, def: 100, unit: '%' },
              ] },
        ]}},
        { title: 'Footer', blurb: 'Season line, build, and which buttons stay.', items: [
            { key: 'footerMeta', label: 'Season, episode and build',
              hint: 'Bottom left instead of on the tileset card, plus the game build.' },
        ], grid: { title: 'Hide from the footer',
                   items: FOOTER_BUTTONS.map(b => ({ key: b.key, label: b.label, hint: 'still in the ' + b.where })) } },
    ];

    const settings = {};
    const settingDefaults = {};
    for (const section of SETTINGS_SECTIONS) {
        for (const item of sectionItems(section)) {
            const def = item.def !== undefined ? item.def : true;   // switches are on unless said otherwise
            settingDefaults[item.key] = def;
            settings[item.key] = stored[item.key] !== undefined ? !!stored[item.key] : def;
            for (const sub of itemSubs(item)) {
                settingDefaults[sub.key] = sub.def;
                const v = Number(stored[sub.key]);
                settings[sub.key] = sub.type === 'range'
                    ? (Number.isFinite(v) ? Math.max(sub.min, Math.min(sub.max, v)) : sub.def)
                    : (sub.options.some(o => o[0] === v) ? v : sub.def);
            }
        }
    }
    // Every switch of every page, and the ones that hang on another (needs).
    const ALL_ITEMS = SETTINGS_SECTIONS.flatMap(sectionItems);
    function sectionItems(section) {
        return [...(section.items || []), ...(section.grid ? section.grid.items : []), ...(section.extra ? section.extra.items : [])];
    }
    function itemSubs(item) { return item.subs || (item.sub ? [item.sub] : []); }

    // Carried over from the separate chat script (Chat Slim / Chat Pro Customizer, up to 10.8),
    // which is part of this one since 4.0. Whoever had it installed had the enhanced chat on, with
    // these values — so it comes up the way it was, not switched off. Only while our own key does
    // not exist yet; afterwards the choice made here counts.
    if (stored.chatPlus === undefined) {
        let old = null;
        try { old = JSON.parse(localStorage.getItem('mcf_chat_enhancer_settings')); } catch (e) {}
        if (old && typeof old === 'object') {
            settings.chatPlus = true;
            const flag = (from, to) => { if (old[from] !== undefined) settings[to] = !!old[from]; };
            flag('groupMessages', 'chatGroup');
            flag('hideShopMessages', 'chatHideShop');
            flag('hideCrownMessages', 'chatHideCrown');
            flag('hideTollMessages', 'chatHideToll');
            // Chat Slim kept em (1.15), here it is percent on a 5-step slider (115).
            const pct = v => Math.max(80, Math.min(180, Math.round(parseFloat(v) * 20) * 5));
            if (Number.isFinite(parseFloat(old.nameFontSize))) settings.chatNameSize = pct(old.nameFontSize);
            if (Number.isFinite(parseFloat(old.msgFontSize)))  settings.chatTextSize = pct(old.msgFontSize);
            try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch (e) {}
        }
    }
    // Performance: off unless chosen — it changes how the game looks. The levers hold the Custom
    // mix; the other levels bring their own and leave the Custom mix untouched.
    settingDefaults.perfLevel = 'off';
    settings.perfLevel = PERF_LEVELS.some(l => l.id === stored.perfLevel) ? stored.perfLevel : 'off';
    for (const lever of PERF_LEVERS) {
        const def = lever.type === 'choice' ? lever.def : false;
        settingDefaults[lever.key] = def;
        const v = stored[lever.key];
        settings[lever.key] = v === undefined ? def
            : lever.type === 'choice' ? (lever.options.some(o => o[0] === Number(v)) ? Number(v) : def)
            : !!v;
    }
    settingDefaults.perfFpsMeter = false;
    settings.perfFpsMeter = !!stored.perfFpsMeter;

    // Autobid (9g) is set in its own menu, not in the settings window. Off unless switched on —
    // it spends tickets. Once on it stays on across a reload, like the bot's: an autobid that
    // forgot itself on every reload would quietly stop bidding. Risk protection is on unless
    // turned off on purpose.
    const AUTOBID_MAX = 100;
    const clampTickets = v => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.max(1, Math.min(AUTOBID_MAX, n)) : 1; };
    settingDefaults.autobidOn = false;
    settings.autobidOn = stored.autobidOn === true;
    settingDefaults.autobidAmount = 1;
    settings.autobidAmount = clampTickets(stored.autobidAmount);
    settingDefaults.autobidRisk = true;
    settings.autobidRisk = stored.autobidRisk !== false;

    // Colour themes (section 3b). Every role is [seed, strength]: the seed gives the hue — a number
    // in OKLCH degrees (the stock blue-grey sits at about 245) or simply a colour such as a flag
    // stripe — and strength scales the chroma the game's own colour had.
    //   s  surfaces (the dark greys)        l  lines: borders and dimmer text (defaults to s)
    //   i  ink: the light text (defaults to l, a little calmer)   a  accents (defaults to s)
    // stripe = the colours of a flag or a gradient: a thin band along header, footer, window
    // bars and menus, plus a dark, readable wash of the same colours behind the big surfaces
    // (wash: false leaves that out). flag = hard edges like a real flag. decor = a static
    // pattern over those surfaces: glitter, stripes, scanlines or grid.
    // ring = the band as a thick rim of metal, light along one edge and shadow along the other,
    // instead of a thin line.
    // The ids of 6.0 are kept, so a theme chosen then is still the one chosen now.
    const THEMES = [
        { id: 'original', group: 'Classic', label: 'Crownfall', note: 'The game’s own blue' },

        // Deluxe (6.5): colours like every theme, plus a skin from SKINS (section 3c) — textures,
        // scenery and effects over the frame of the page.
        { id: 'mc-deluxe', group: 'Games', label: 'Minecraft Deluxe', note: 'Grass, dirt, stone and XP', skin: 'minecraft',
          s: ['#866043', 1.1], l: ['#5d9c3a', 1.4], i: [110, 0.3], a: ['#7fcc3c', 1.3] },
        { id: 'satisfactory-deluxe', group: 'Games', label: 'Satisfactory Deluxe', note: 'FICSIT: steel, hazard stripes, a conveyor', skin: 'ficsit',
          s: [255, 0.5], l: ['#fa9549', 2.0], i: [255, 0.4], a: ['#fa9549', 1.5] },
        { id: 'mario-deluxe', group: 'Games', label: 'Super Mario Deluxe', note: 'World 1-1: sky, bricks and ? blocks', skin: 'mario',
          s: ['#049cd8', 1.6], l: ['#e52521', 2.0], a: ['#e52521', 1.4] },
        { id: 'zelda-deluxe', group: 'Games', label: 'Zelda Deluxe', note: 'Hyrule gold, the Triforce, fairies', skin: 'hyrule',
          s: ['#1c3d2a', 1.6], l: ['#c8a24a', 1.4], a: ['#3a9d5d', 1.3] },
        { id: 'tetris-deluxe', group: 'Games', label: 'Tetris Deluxe', note: 'The well, and every button a block', skin: 'tetris',
          s: [265, 1.3], l: ['#a000f0', 1.4], a: ['#00f0f0', 1.3] },
        { id: 'pacman-deluxe', group: 'Games', label: 'Pac-Man Deluxe', note: 'Maze walls, ghosts, a hungry footer', skin: 'pacman',
          s: [265, 1.6], l: ['#2121de', 2.4], a: ['#ffb852', 1.3] },
        { id: 'portal-deluxe', group: 'Games', label: 'Portal Deluxe', note: 'Test chamber, a portal on either side', skin: 'aperture',
          s: [250, 0.5], l: ['#00a2ff', 1.6], a: ['#ff9a00', 1.4] },
        { id: 'sonic-deluxe', group: 'Games', label: 'Sonic Deluxe', note: 'Green Hill and golden rings', skin: 'greenhill',
          s: ['#0a3d91', 1.8], l: ['#1e90ff', 1.6], a: ['#ff3b30', 1.3] },
        { id: 'pokemon-deluxe', group: 'Games', label: 'Pokémon Deluxe', note: 'The chat is a Pokédex', skin: 'pokedex',
          s: ['#3b4cca', 1.4], l: ['#ff1c1c', 1.6], a: ['#ff1c1c', 1.3] },
        { id: 'gameboy-deluxe', group: 'Games', label: 'Game Boy Deluxe', note: 'The chat is a Game Boy', skin: 'gameboy',
          s: ['#306230', 1.6], l: ['#8bac0f', 1.5], i: ['#9bbc0f', 1.0], a: ['#8bac0f', 1.3] },
        { id: 'stardew-deluxe', group: 'Games', label: 'Stardew Valley Deluxe', note: 'Wood, parchment, falling leaves', skin: 'stardew',
          s: ['#5b3a1e', 1.2], l: ['#7cb342', 1.3], a: ['#f2a33a', 1.2] },
        { id: 'hollowknight-deluxe', group: 'Games', label: 'Hollow Knight Deluxe', note: 'Hallownest dark, drifting soul', skin: 'hallownest',
          s: [255, 0.8], l: [235, 1.0], a: ['#8fb8ff', 1.2] },
        { id: 'wow-deluxe', group: 'Games', label: 'World of Warcraft Deluxe', note: 'Gold frames, red buttons, an XP bar', skin: 'wow',
          s: ['#34445e', 1.4], l: ['#c8912f', 1.5], i: ['#f2d27a', 0.45], a: ['#f0a81c', 1.6] },
        { id: 'tardis', group: 'Film & TV', label: 'TARDIS', note: 'The chat is a police box', skin: 'tardis',
          s: ['#0f3d73', 1.6], l: ['#3a70b0', 1.3], i: [240, 0.4], a: ['#8ec5ff', 1.3] },
        // 6.16: seven more for Film & TV (section 3e). No logos, posters or fonts of the originals —
        // their motifs, colours and lettering, drawn anew (Greasy Fork code rules: copyright).
        { id: 'spn-deluxe', group: 'Film & TV', label: 'Supernatural', note: 'A devil’s trap, a salt line, embers', skin: 'hunters',
          s: ['#1a1714', 1.2], l: ['#c8902e', 1.3], i: [60, 0.25], a: ['#c8902e', 1.3] },
        { id: 'bb-deluxe', group: 'Film & TV', label: 'Breaking Bad', note: 'Periodic tiles, desert yellow, blue crystal', skin: 'heisenberg',
          s: ['#1e4d2b', 1.4], l: ['#326947', 1.5], a: ['#6fd3ff', 1.3] },
        { id: 'bttf-deluxe', group: 'Film & TV', label: 'Back to the Future', note: 'Time circuits, flux capacitor, fire trails', skin: 'outatime',
          s: ['#23262d', 1.0], l: ['#ff8a00', 1.5], a: ['#ff5a1f', 1.4] },
        { id: 'eeaao-deluxe', group: 'Film & TV', label: 'Everything Everywhere', note: 'Googly eyes that watch you, the bagel', skin: 'multiverse',
          s: ['#2a131a', 1.4], l: ['#c8102e', 1.6], i: ['#fefcfa', 0.3], a: ['#c8102e', 1.4] },
        { id: 'starwars-deluxe', group: 'Film & TV', label: 'Star Wars', note: 'The crawl, lightsabers, a hologram chat', skin: 'farfaraway',
          s: [250, 0.5], l: ['#ffe81f', 1.4], a: ['#4fb3ff', 1.4] },
        { id: 'vertigo-deluxe', group: 'Film & TV', label: 'Vertigo', note: 'Saul Bass: the spiral, the fall', skin: 'saulbass',
          s: ['#9e3218', 1.4], l: ['#d74219', 1.6], i: ['#fffff2', 0.3], a: ['#d74219', 1.5] },
        { id: 'cinema-deluxe', group: 'Film & TV', label: 'Cinema', note: 'Velvet curtain, marquee lights, popcorn', skin: 'cinema',
          s: ['#4a0a12', 1.4], l: ['#d4a64a', 1.5], a: ['#d4a64a', 1.4] },
        // Books (6.17)
        { id: 'lostbookshop-deluxe', group: 'Books', label: 'The Lost Bookshop', note: 'Der verschwundene Buchladen: blue spines, ivy, the yellow house', skin: 'lostbookshop',
          s: ['#0b1622', 1.3], l: ['#2E4947', 1.4], a: ['#e8c46a', 1.4] },
        { id: 'readingnook-deluxe', group: 'Books', label: 'Reading Nook', note: 'Tea, a book page, a knitted blanket, fairy lights', skin: 'readingnook',
          s: ['#2b1d17', 1.3], l: ['#c98a4b', 1.4], i: ['#f6eedb', 0.3], a: ['#c9a24a', 1.4] },
        // Music (6.18, section 3g)
        { id: 'aerzte-deluxe', group: 'Music', label: 'Die Ärzte', note: 'HELL orange, DUNKEL magenta, a bloodshot eye that watches you', skin: 'aerzte',
          s: [30, 0.3], l: ['#ff4e00', 1.6], a: ['#ff4e00', 1.5] },
        { id: 'linkinpark-deluxe', group: 'Music', label: 'Linkin Park', note: 'Sprayed concrete, a stencil, black and yellow, [brackets]', skin: 'lpark',
          s: [80, 0.25], l: ['#f6d80a', 1.5], a: ['#f6d80a', 1.4] },
        { id: 'kraftklub-deluxe', group: 'Music', label: 'Kraftklub', note: 'Red, black and white, stripes, yellow tickets, matchstick eyes', skin: 'kraftklub',
          s: [25, 0.35], l: ['#e2231a', 1.6], a: ['#ffd400', 1.5] },
        { id: 'goethe-deluxe', group: 'Music', label: 'Goethes Erben', note: 'A dark stage, cyan light, faceless figures, a line of verse', skin: 'goethe',
          s: ['#0b1e44', 1.3], l: ['#5fb8e0', 1.4], a: ['#8ce1ff', 1.4] },
        { id: 'samsa-deluxe', group: 'Music', label: 'Samsas Traum', note: 'An etched plate, a beetle crawling, candles, deep water', skin: 'samsa',
          s: ['#1d3c52', 1.2], l: ['#8a7a58', 1.3], a: ['#e6c98a', 1.3] },
        { id: 'prinzpi-deluxe', group: 'Music', label: 'Prinz Pi', note: 'Rebel lilac, a spinning record, a compass without north', skin: 'prinzpi',
          s: ['#22194F', 1.4], l: ['#674E85', 1.5], a: ['#b7a6d6', 1.4] },
        // Signature themes: each for one account only (owner), offered and applied while that
        // account is signed in (section 3d, themeVisible).
        { id: 'sig-dreaming', group: 'Signature', owner: 'DreamingLucie', label: 'Dreaming', note: 'For DreamingLucie: a soft trans-pastel night', skin: 'dreaming',
          s: ['#2a1f4a', 1.6], l: ['#f5a9b8', 1.4], i: ['#f5a9b8', 0.6], a: ['#5bcefa', 1.3] },
        { id: 'sig-bricks', group: 'Signature', owner: 'CuteLegoGirl', label: 'Brick Builder', note: 'For CuteLegoGirl: bricks and studs', skin: 'bricks',
          s: [250, 0.25], l: ['#ffcd03', 1.4], a: ['#d01012', 1.3] },
        { id: 'sig-highroller', group: 'Signature', owner: 'NuceLoire', label: 'High Roller', note: 'For NuceLoire: felt, gold and chips', skin: 'casino',
          s: ['#0b5d2e', 1.3], l: ['#d4af37', 1.5], i: [90, 0.3], a: ['#d4af37', 1.4] },
        { id: 'sig-ninkasi', group: 'Signature', owner: 'ninkasi1001', label: 'Ninkasi', note: 'For ninkasi1001: amber ale, foam and clay tablets', skin: 'ninkasi',
          s: ['#3a2210', 1.4], l: ['#e8a33d', 1.5], i: [75, 0.3], a: ['#f2b233', 1.4] },
        { id: 'midnight', group: 'Classic', label: 'Midnight',  note: 'Deep navy',     s: [268, 1.5],  a: [262, 1.2] },
        { id: 'amethyst', group: 'Classic', label: 'Amethyst',  note: 'Violet',        s: [305, 1.15], a: [305, 1.1] },
        { id: 'rose',     group: 'Classic', label: 'Rose',      note: 'Soft pink',     s: [355, 1.1],  a: [355, 1.1] },
        { id: 'crimson',  group: 'Classic', label: 'Crimson',   note: 'Deep red',      s: [22, 1.4],   l: [22, 1.5],  a: [25, 1.2] },
        { id: 'copper',   group: 'Classic', label: 'Copper',    note: 'Warm brown',    s: [50, 1.1],   a: [50, 1.1] },
        { id: 'mocha',    group: 'Classic', label: 'Mocha',     note: 'Coffee',        s: [65, 0.9],   l: [60, 1.0],  a: [45, 1.0] },
        { id: 'emerald',  group: 'Classic', label: 'Emerald',   note: 'Green',         s: [160, 1.1],  a: [160, 1.05] },
        { id: 'forest',   group: 'Classic', label: 'Forest',    note: 'Moss and pine', s: [140, 1.3],  a: [125, 1.2] },
        { id: 'ocean',    group: 'Classic', label: 'Ocean',     note: 'Teal',          s: [200, 1.2],  a: [200, 1.1] },
        { id: 'graphite', group: 'Classic', label: 'Graphite',  note: 'Plain grey',    s: [245, 0.1],  a: [245, 0.2] },

        { id: 'trans', group: 'Pride', label: 'Trans', note: 'Blue, pink and white', flag: true,
          s: ['#5bcefa', 2.2], l: ['#f5a9b8', 2.4], i: ['#f5a9b8', 0.8], a: ['#f5a9b8', 1.4],
          stripe: ['#5bcefa', '#f5a9b8', '#ffffff', '#f5a9b8', '#5bcefa'] },
        { id: 'rainbow', group: 'Pride', label: 'Rainbow', note: 'The Pride flag', flag: true,
          s: [290, 0.7], l: [290, 0.9], a: [300, 1.2],
          stripe: ['#e40303', '#ff8c00', '#ffed00', '#008026', '#004dff', '#750787'] },
        { id: 'progress', group: 'Pride', label: 'Progress', note: 'Progress Pride', flag: true,
          s: [265, 0.8], l: ['#f5a9b8', 1.6], a: ['#5bcefa', 1.2],
          stripe: ['#000000', '#784f17', '#5bcefa', '#f5a9b8', '#ffffff', '#e40303', '#ff8c00', '#ffed00', '#008026', '#004dff', '#750787'] },
        { id: 'lesbian', group: 'Pride', label: 'Lesbian', note: 'Orange, white and pink', flag: true,
          s: ['#d52d00', 1.2], l: ['#d162a4', 1.6], i: ['#ff9a56', 0.6], a: ['#d162a4', 1.3],
          stripe: ['#d52d00', '#ef7627', '#ff9a56', '#ffffff', '#d162a4', '#b55690', '#a30262'] },
        { id: 'gay', group: 'Pride', label: 'Gay', note: 'Green, white and blue', flag: true,
          s: ['#3d1a78', 1.4], l: ['#26ceaa', 1.6], a: ['#26ceaa', 1.2],
          stripe: ['#078d70', '#26ceaa', '#98e8c1', '#ffffff', '#7bade2', '#5049cc', '#3d1a78'] },
        { id: 'bi', group: 'Pride', label: 'Bi', note: 'Pink, purple and blue', flag: true,
          s: ['#9b4f96', 1.6], l: ['#d60270', 1.5], a: ['#0038a8', 1.4],
          stripe: ['#d60270', '#d60270', '#9b4f96', '#0038a8', '#0038a8'] },
        { id: 'pan', group: 'Pride', label: 'Pan', note: 'Pink, yellow and blue', flag: true,
          s: ['#21b1ff', 1.5], l: ['#ff218c', 1.8], a: ['#ff218c', 1.3],
          stripe: ['#ff218c', '#ffd800', '#21b1ff'] },
        { id: 'nonbinary', group: 'Pride', label: 'Nonbinary', note: 'Yellow, white, purple, black', flag: true,
          s: ['#9c59d1', 1.5], l: ['#9c59d1', 1.3], i: ['#fcf434', 0.5], a: ['#9c59d1', 1.3],
          stripe: ['#fcf434', '#ffffff', '#9c59d1', '#2c2c2c'] },
        { id: 'genderfluid', group: 'Pride', label: 'Genderfluid', note: 'Pink, purple and blue', flag: true,
          s: ['#2f3cbe', 1.5], l: ['#c011d7', 1.6], a: ['#ff76a4', 1.3],
          stripe: ['#ff76a4', '#ffffff', '#c011d7', '#000000', '#2f3cbe'] },
        { id: 'ace', group: 'Pride', label: 'Ace', note: 'Black, grey, white, purple', flag: true,
          s: [320, 0.5], l: ['#800080', 1.4], a: ['#800080', 1.3],
          stripe: ['#000000', '#a3a3a3', '#ffffff', '#800080'] },
        { id: 'aro', group: 'Pride', label: 'Aro', note: 'Greens, white and grey', flag: true,
          s: ['#3da542', 1.2], l: ['#a7d379', 1.3], a: ['#3da542', 1.2],
          stripe: ['#3da542', '#a7d379', '#ffffff', '#a9a9a9', '#000000'] },

        { id: 'unicorn', group: 'Moods', label: 'Unicorn', note: 'Pastel, with sparkles', decor: 'glitter',
          s: ['#c9b6ff', 2.0], l: ['#ffb3de', 2.0], i: ['#b8ffd9', 0.8], a: ['#8fe3d0', 1.3],
          stripe: ['#ffb3de', '#c9b6ff', '#a7e8ff', '#b8ffd9', '#fff3b0'] },
        { id: 'glitter', group: 'Moods', label: 'Glitter', note: 'Pink and silver, sparkling', decor: 'glitter',
          s: ['#ff8fd8', 1.3], l: ['#e0c8ff', 1.4], a: ['#ff8fd8', 1.4],
          stripe: ['#ffd1f1', '#f4f4ff', '#ff8fd8', '#f4f4ff', '#ffd1f1'] },
        { id: 'antifa', group: 'Moods', label: 'Antifa', note: 'Red and black, against fascism', flag: true,
          s: [25, 0.2], l: ['#e3000f', 2.5], i: [25, 0.3], a: ['#e3000f', 1.6],
          stripe: ['#e3000f', '#e3000f', '#111111', '#111111'] },
        { id: 'punk', group: 'Moods', label: 'Punk', note: 'Hot pink, acid green', flag: true, decor: 'stripes',
          s: [330, 0.4], l: ['#ff2e88', 2.6], i: [330, 0.5], a: ['#b6ff00', 1.6],
          stripe: ['#ff2e88', '#111111', '#b6ff00', '#111111', '#ff2e88'] },
        { id: 'vaporwave', group: 'Moods', label: 'Vaporwave', note: 'Pink, cyan and lilac',
          s: ['#b967ff', 1.8], l: ['#01cdfe', 1.6], a: ['#ff71ce', 1.4],
          stripe: ['#ff71ce', '#01cdfe', '#05ffa1', '#b967ff', '#fffb96'] },
        { id: 'synthwave', group: 'Moods', label: 'Synthwave', note: 'Retro sunset grid', decor: 'grid', tint: '#ff6ad5',
          s: ['#2b1055', 2.0], l: ['#ff6ad5', 1.8], a: ['#ff9a3c', 1.4],
          stripe: ['#2b1055', '#7597de', '#ff6ad5', '#ff9a3c'] },
        { id: 'cyberpunk', group: 'Moods', label: 'Cyberpunk', note: 'Neon yellow and cyan', decor: 'scanlines',
          s: ['#0d1b4c', 1.3], l: ['#fcee0a', 1.6], i: [230, 0.6], a: ['#00f0ff', 1.3],
          stripe: ['#fcee0a', '#00f0ff', '#ff003c'] },
        { id: 'matrix', group: 'Moods', label: 'Matrix', note: 'Green on black', decor: 'scanlines',
          s: ['#00ff41', 1.4], l: ['#00ff41', 1.6], i: ['#00ff41', 1.4], a: ['#00ff41', 1.4],
          stripe: ['#003b00', '#008f11', '#00ff41'] },
        { id: 'aurora', group: 'Moods', label: 'Aurora', note: 'Northern lights',
          s: [230, 1.2], l: ['#00ffa3', 1.5], a: ['#dc1fff', 1.3],
          stripe: ['#00ffa3', '#03e1ff', '#dc1fff'] },
        { id: 'lava', group: 'Moods', label: 'Lava', note: 'Red, orange and ember',
          s: ['#ff3d00', 1.4], l: ['#ff9100', 1.6], a: ['#ff9100', 1.3],
          stripe: ['#ff3d00', '#ff9100', '#ffd600'] },
        { id: 'sunset', group: 'Moods', label: 'Sunset', note: 'Dusk to dawn',
          s: ['#6c5b7b', 1.4], l: ['#f67280', 1.5], a: ['#f8b195', 1.3],
          stripe: ['#355c7d', '#6c5b7b', '#c06c84', '#f67280', '#f8b195'] },
        { id: 'halloween', group: 'Moods', label: 'Halloween', note: 'Pumpkin and witch', flag: true,
          s: ['#6a0dad', 1.3], l: ['#ff7518', 1.6], a: ['#ff7518', 1.3],
          stripe: ['#ff7518', '#1b1b1b', '#6a0dad'] },

        // Games: the colours a game is known by, and a pattern that recalls it. tint = pattern
        // colour where the accent is not the right one.
        { id: 'minecraft', group: 'Games', label: 'Minecraft', note: 'Grass, dirt and stone', flag: true, decor: 'pixels',
          s: ['#866043', 1.3], l: ['#5d9c3a', 1.8], i: [110, 0.5], a: ['#7fcc3c', 1.4],
          stripe: ['#5d9c3a', '#5d9c3a', '#866043', '#866043', '#7f7f7f'] },
        { id: 'satisfactory', group: 'Games', label: 'Satisfactory', note: 'FICSIT orange and steel', flag: true, decor: 'hazard', tint: '#fa9549',
          s: [255, 0.5], l: ['#fa9549', 2.0], i: [255, 0.4], a: ['#fa9549', 1.5],
          stripe: ['#fa9549', '#2b2b30', '#fa9549', '#2b2b30', '#fa9549', '#2b2b30'] },
        { id: 'mario', group: 'Games', label: 'Super Mario', note: 'Red, blue and brick', flag: true, decor: 'bricks',
          s: ['#049cd8', 1.6], l: ['#e52521', 2.0], a: ['#e52521', 1.4],
          stripe: ['#e52521', '#049cd8', '#fbd000', '#43b047'] },
        { id: 'zelda', group: 'Games', label: 'Zelda', note: 'Hyrule green and gold', decor: 'triangles', tint: '#e8c667',
          s: ['#1c3d2a', 1.6], l: ['#c8a24a', 1.4], a: ['#3a9d5d', 1.3],
          stripe: ['#2e7d32', '#c8a24a', '#2f5a8b'] },
        { id: 'tetris', group: 'Games', label: 'Tetris', note: 'Seven tetrominoes', flag: true, decor: 'blocks',
          s: [265, 1.3], l: ['#a000f0', 1.4], a: ['#00f0f0', 1.3],
          stripe: ['#00f0f0', '#f0f000', '#a000f0', '#00f000', '#f00000', '#0000f0', '#f0a000'] },
        { id: 'pacman', group: 'Games', label: 'Pac-Man', note: 'Maze blue and ghosts', flag: true, decor: 'dots', tint: '#ffe600',
          s: [265, 1.6], l: ['#2121de', 2.4], a: ['#ffb852', 1.3],
          stripe: ['#ff0000', '#ffb8ff', '#00ffff', '#ffb852'] },
        { id: 'portal', group: 'Games', label: 'Portal', note: 'Blue portal, orange portal', flag: true,
          s: [250, 0.5], l: ['#00a2ff', 1.6], a: ['#ff9a00', 1.4],
          stripe: ['#00a2ff', '#00a2ff', '#ff9a00', '#ff9a00'] },
        { id: 'sonic', group: 'Games', label: 'Sonic', note: 'Blue, rings and Green Hill', decor: 'checker', tint: '#c97d3c',
          s: ['#0a3d91', 1.8], l: ['#1e90ff', 1.6], a: ['#ff3b30', 1.3],
          stripe: ['#0066cc', '#ffcc00', '#d0021b'] },
        { id: 'pokemon', group: 'Games', label: 'Pokémon', note: 'Poké Ball red and white', flag: true,
          s: ['#3b4cca', 1.4], l: ['#ff1c1c', 1.6], a: ['#ff1c1c', 1.3],
          stripe: ['#ff1c1c', '#ff1c1c', '#222224', '#ffffff', '#ffffff'] },
        { id: 'gameboy', group: 'Games', label: 'Game Boy', note: 'Four shades of green', flag: true, decor: 'pixels',
          s: ['#306230', 1.6], l: ['#8bac0f', 1.5], i: ['#9bbc0f', 1.0], a: ['#8bac0f', 1.3],
          stripe: ['#0f380f', '#306230', '#8bac0f', '#9bbc0f'] },
        { id: 'stardew', group: 'Games', label: 'Stardew Valley', note: 'Farm greens and wood',
          s: ['#5b3a1e', 1.2], l: ['#7cb342', 1.3], a: ['#f2a33a', 1.2],
          stripe: ['#7cb342', '#f2a33a', '#5b3a1e', '#6ec1e4'] },
        { id: 'hollowknight', group: 'Games', label: 'Hollow Knight', note: 'Hallownest blue-grey', wash: false,
          s: [255, 0.8], l: [235, 1.0], a: ['#8fb8ff', 1.2],
          stripe: ['#2c3547', '#9db1d6', '#e9eef5', '#9db1d6', '#2c3547'] },
        // A request: the gold ring of the logo as the rim of header and footer, the yellow and
        // orange of the W as accents, the blue-grey of the globe behind everything. No wash — a
        // gold wash would turn that blue brown.
        { id: 'wow', group: 'Games', label: 'World of Warcraft', note: 'Gold ring on Azeroth blue', ring: true, wash: false,
          s: ['#34445e', 1.4], l: ['#c8912f', 1.5], i: ['#f2d27a', 0.45], a: ['#f0a81c', 1.6],
          stripe: ['#6e3f0e', '#c98a2c', '#f7dc7a', '#d9a53a', '#8a5418', '#d9a53a', '#f7dc7a', '#c98a2c', '#6e3f0e'] },

        { id: 'dracula', group: 'Editor themes', label: 'Dracula', note: 'Purple and pink',
          s: ['#282a36', 2.0], l: ['#6272a4', 1.4], a: ['#bd93f9', 1.4], wash: false,
          stripe: ['#ff79c6', '#bd93f9', '#8be9fd', '#50fa7b', '#f1fa8c', '#ffb86c', '#ff5555'] },
        { id: 'nord', group: 'Editor themes', label: 'Nord', note: 'Arctic blue-grey',
          s: ['#2e3440', 1.0], l: ['#4c566a', 1.0], a: ['#88c0d0', 1.1], wash: false,
          stripe: ['#8fbcbb', '#88c0d0', '#81a1c1', '#5e81ac'] },
        { id: 'catppuccin', group: 'Editor themes', label: 'Catppuccin', note: 'Mocha with mauve',
          s: ['#1e1e2e', 1.6], l: ['#585b70', 1.3], a: ['#cba6f7', 1.4], wash: false,
          stripe: ['#f5e0dc', '#f5c2e7', '#cba6f7', '#89b4fa', '#94e2d5', '#a6e3a1', '#f9e2af', '#fab387'] },
        { id: 'gruvbox', group: 'Editor themes', label: 'Gruvbox', note: 'Retro warm',
          s: [70, 0.6], l: [70, 0.8], a: ['#8ec07c', 1.2], wash: false,
          stripe: ['#fb4934', '#fabd2f', '#b8bb26', '#8ec07c', '#83a598', '#d3869b'] },
        { id: 'tokyonight', group: 'Editor themes', label: 'Tokyo Night', note: 'Night blue and violet',
          s: ['#1a1b26', 1.6], l: ['#414868', 1.3], a: ['#7aa2f7', 1.3], wash: false,
          stripe: ['#7aa2f7', '#bb9af7', '#7dcfff', '#9ece6a'] },
        { id: 'solarized', group: 'Editor themes', label: 'Solarized', note: 'Deep teal',
          s: ['#002b36', 2.4], l: ['#586e75', 1.3], a: ['#268bd2', 1.2], wash: false,
          stripe: ['#b58900', '#cb4b16', '#dc322f', '#d33682', '#6c71c4', '#268bd2', '#2aa198', '#859900'] },

        { id: 'custom', group: 'Your own', label: 'Custom', note: 'Pick hue and accent' },
    ];
    const clampNum = (v, lo, hi, def) => {
        const n = v === null || v === undefined || v === '' ? NaN : Math.round(Number(v));
        return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : def;
    };
    settingDefaults.themeId = 'original';
    settings.themeId = THEMES.some(t => t.id === stored.themeId) ? stored.themeId : 'original';
    settingDefaults.themeHue = 305;
    settings.themeHue = clampNum(stored.themeHue, 0, 359, 305);
    settingDefaults.themeTint = 100;
    settings.themeTint = clampNum(stored.themeTint, 0, 200, 100);
    // Custom's accent had no slider of its own in 6.0 and followed the hue: whoever set a hue
    // then keeps that look until they move the new slider.
    settingDefaults.themeAccent = 305;
    settings.themeAccent = clampNum(stored.themeAccent, 0, 359, settings.themeHue);
    // Custom's background (6.2): a gradient from hue to accent, and one pattern. Both off by
    // default, so a Custom of 6.1 looks as it did. The ids match THEME_PATTERNS (section 3b).
    const THEME_PATTERN_IDS = ['none', 'glitter', 'stripes', 'hazard', 'scanlines', 'grid', 'blocks', 'bricks', 'dots', 'checker', 'pixels', 'triangles'];
    settingDefaults.themeGradient = false;
    settings.themeGradient = stored.themeGradient === true;
    settingDefaults.themePattern = 'none';
    settings.themePattern = THEME_PATTERN_IDS.includes(stored.themePattern) ? stored.themePattern : 'none';
    // Random theme (6.3): a new one on every page load, and if wanted every few minutes.
    const THEME_ROTATE_OPTIONS = [[0, 'Off'], [5, '5 min'], [10, '10 min'], [15, '15 min'], [30, '30 min'], [60, '60 min']];
    settingDefaults.themeRandom = false;
    settings.themeRandom = stored.themeRandom === true;
    settingDefaults.themeRotate = 0;
    settings.themeRotate = THEME_ROTATE_OPTIONS.some(o => o[0] === Number(stored.themeRotate)) ? Number(stored.themeRotate) : 0;
    // Deluxe effects (6.5): full, subtle or off. Full unless chosen otherwise; the performance
    // levels hold it down on their own (section 3c, skinFxEffective).
    const THEME_FX_OPTIONS = [['full', 'Full'], ['subtle', 'Subtle'], ['off', 'Off']];
    settingDefaults.themeFx = 'full';
    settings.themeFx = THEME_FX_OPTIONS.some(o => o[0] === stored.themeFx) ? stored.themeFx : 'full';
    // See-through board frames (6.10): the bars the game paints above and below each tile and
    // around the king tile go, so the page background shows through. On unless switched off.
    settingDefaults.boardClear = true;
    settings.boardClear = stored.boardClear !== false;
    // On the throne (6.19): the beverage packages to pour, as "type|size|currency" — a list, not
    // a switch. Anything else found in storage is dropped rather than guessed at.
    settingDefaults.throneDrinkSet = [];
    settings.throneDrinkSet = Array.isArray(stored.throneDrinkSet)
        ? stored.throneDrinkSet.filter(k => /^(water|lava|milk|acid)\|(small|medium|large)\|(gold|diamonds)$/.test(k)) : [];
    // The music player (6.22, section 11e): off unless switched on, and until then the game plays
    // its music its own way. The tracks taken out of the rotation are kept as the paths the game's
    // own manifest gives them; anything else found in storage is dropped rather than guessed at.
    settingDefaults.musicPlayer = false;
    settings.musicPlayer = stored.musicPlayer === true;
    settingDefaults.musicShuffle = false;
    settings.musicShuffle = stored.musicShuffle === true;
    settingDefaults.musicVolume = 50;
    settings.musicVolume = Number.isFinite(Number(stored.musicVolume))
        ? Math.max(0, Math.min(100, Math.round(Number(stored.musicVolume)))) : 50;
    // The bar on the page (6.23): there whenever the player is, hidden with its own button or
    // here. Where it sits is kept with the windows, not here.
    settingDefaults.musicBar = true;
    settings.musicBar = stored.musicBar !== false;
    settingDefaults.musicExcluded = [];
    settings.musicExcluded = Array.isArray(stored.musicExcluded)
        ? stored.musicExcluded.filter(p => typeof p === 'string' && p.charAt(0) === '/') : [];

    // What a lever is set to right now: from the chosen level, or the Custom mix.
    function perfValue(key) {
        if (settings.perfLevel === 'custom') return settings[key];
        const level = PERF_LEVELS.find(l => l.id === settings.perfLevel);
        const lever = PERF_LEVERS.find(l => l.key === key);
        const v = level && level.set ? level.set[key] : undefined;
        return v !== undefined ? v : (lever && lever.type === 'choice' ? lever.def : false);
    }

    // Carried over from 3.7: whoever had the combined switch off gets both halves off.
    if (stored.kingName === undefined && stored.kingOverlay === false) settings.kingName = settings.kingToll = false;
    if (stored.hideDailies === undefined && stored.tidyFooter === false) {
        for (const b of FOOTER_BUTTONS) settings[b.key] = false;
    }

    function saveSettings() {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch (e) {}
    }

    // =========================================================================================
    // 2. ANCHORS
    // =========================================================================================
    const role = r => document.querySelector(`[data-role="${r}"]`);
    const firstRole = (...roles) => { for (const r of roles) { const el = role(r); if (el) return el; } return null; };

    // Every entry here is a real page answering 200, and every one of them opens in the overlay.
    //
    // The last two took a second look. /terms is a 404 and /how-to-play a 301, which is why they
    // were skipped at first — but neither is the actual address: "How to Play" lives at
    // /how-to-play/ WITH the trailing slash, and the Terms button goes to MCF_POLICY_URLS.terms
    // (policyConfig.js), i.e. /legal/terms. The slashed forms are used here so the frame does not
    // start on a redirect.
    //
    // Both keep their place in the footer; only where they open changes.
    const PAGES = {
        'profile-nav':      { path: '/profile',      title: 'Profile'      },
        'dailies-nav':      { path: '/dailies',      title: 'Dailies'      },
        'inventory-nav':    { path: '/inventory',    title: 'Inventory'    },
        'leaderboards-nav': { path: '/leaderboards', title: 'Leaderboards' },
        'shop-nav':         { path: '/shop',         title: 'Shop'         },
        // The game has no footer button for this one at all — /achievements answers 200 but is
        // only reachable from inside other pages. In the account menu it finally has a home.
        'achievements':     { path: '/achievements',  title: 'Achievements'     },
        // Added by the game in build v0.10.0b. It is reachable only from the panel behind the
        // game's own header button, and the gear takes that button's place (section 11), so
        // without an entry of its own the page would have no way in at all.
        'credits':          { path: '/credits',       title: 'Credits'          },
        'how-to-play-nav':  { path: '/how-to-play/',  title: 'How to Play'      },
        'terms-nav':        { path: '/legal/terms/',  title: 'Terms of Service' },
    };

    // Same pages, looked up by their path. The game also links to some of them with a plain
    // <a href>: the achievement toast ends in <a href="/achievements">View Achievements</a>
    // (achievementToasts.js), and that link carries no data-role, so the listener below used to
    // miss it and the page took over the whole tab.
    const PAGE_BY_PATH = new Map(Object.values(PAGES).map(p => [p.path.replace(/\/+$/, ''), p]));

    // Which footer buttons can be hidden is FOOTER_BUTTONS in section 1. Rebellion and Beverages
    // are deliberately absent: they are copied to the king tray, not hidden, and their originals
    // stay where they are. How to Play and Terms are never hidden.

    // In the account menu, in the order they had in the footer. Credits never had a footer
    // button and comes last, below the pages that are about your own account.
    const ACCOUNT_MENU = ['profile-nav', 'dailies-nav', 'inventory-nav', 'achievements', 'leaderboards-nav', 'credits'];

    // Chips up to and including this stay visible when the rail is collapsed.
    const RAIL_ALWAYS = 10;

    const KING_ANCHORS  = ['king-tile-frame', 'king-fit-viewport', 'king-shared-renderer-stage'];
    // 20 s, not 60 s. The name comes only from this call — the game shows it nowhere in the DOM
    // (checked: the only match on the page is our own field), so it cannot be read off the page.
    // At 60 s the wrong name stood there for minutes after a throne change.
    const KING_POLL_MS  = 20000;
    const TOLL_PATTERN  = /\bchanged the Crown toll\b[^.]*\.\s*Current toll:\s*(\d+)/i;
    // "CROWN CLAIMED! DreamingLucie has captured the Crown from InfernalShock. Long live the
    // King!" — wording taken from recorded chat. This line is in the chat immediately, long
    // before the next poll is due, so it carries the new name straight away.
    const CROWN_PATTERN = /\bCROWN CLAIMED!\s+(.+?)\s+has captured the Crown\b/i;

    // The look-ahead is a setting (3 or 12 hours); 12 is the most the endpoint allows.
    const eventsUrl = hours => `/api/gameplay/chat-command/schedule?hours=${hours}`;

    const number = n => Number(n).toLocaleString();


    // =========================================================================================
    // 3. STYLES
    // =========================================================================================
    // Kept as a string: a colour theme (section 3b) runs this very text through its colour
    // mapping and lays the result over it.
    const BASE_CSS = `
        /* === THE GAME'S ARENA HELP (arenaHelp.js, game v0.10.0f) ===
           The game now puts help texts on the header cards (hover or focus opens a tooltip),
           an "Arena help" button into the footer, a "?" beside the bid buttons for new players
           and a "Currency & arena guide" into the sound controls. Regular players do not need any
           of it, so all of it stays hidden. The cards themselves are untouched: the game wrapped
           label and value in a .arenaHelpMetric button, which keeps showing, just without the
           help cursor. */
        .arenaHelpTooltip,
        .arenaHelpGuide,
        .arenaHelpButton { display: none !important; }
        .arenaHelpMetric { cursor: inherit !important; }

        /* === KING TILE: NAME AND GOLD LEFT, TOLL RIGHT ===
           Deliberately without backdrop-filter. It forced the whole stack underneath onto its
           own texture, which is not rasterised at the resolution of the board — the king tile
           went visibly soft and blocky. The background there is nearly black anyway, so an
           opaque panel is enough. */
        /* No panel, no border: the read-outs sit directly on the tile. What a background used
           to do for legibility a shadow does now — the tile is dark at the top but not evenly
           so, and text without either becomes unreadable over the crown. */
        .mcfo-king-field {
            position: absolute;
            top: 10px;
            z-index: 40;
            pointer-events: none;
            display: flex;
            align-items: center;
            gap: 8px;
            font-family: inherit;
            font-size: 1.25em;
            line-height: 1.2;
            color: #eaf2f8;
            white-space: nowrap;
            text-shadow: 0 1px 3px rgba(0,0,0,0.95), 0 0 10px rgba(0,0,0,0.75);
        }
        /* Capped so the name can never run into the toll field on a narrow window. */
        .mcfo-king-field--name { left: 12px; max-width: calc(100% - 150px); }
        .mcfo-king-field--toll { right: 12px; }
        .mcfo-king-field .mcfo-value { font-weight: 700; color: #ffd479; }
        .mcfo-king-field .mcfo-label { opacity: 0.7; }
        .mcfo-king-field .mcfo-name  { opacity: 0.9; max-width: 220px; overflow: hidden; text-overflow: ellipsis; }
        /* Older than two polls: draw it faint rather than assert a number that may have moved on. */
        .mcfo-king-field[data-mcfo-stale="1"] { opacity: 0.45; }

        /* === TIDY FOOTER ===
           Driven by an attribute on <html> so that switching a button back on brings it straight
           back, with no inline style to clean up anywhere. The attribute is a space-separated
           list of the hidden roles, one rule per button, so each has its own switch. */
        ${FOOTER_BUTTONS.map(b => `html[data-mcfo-hide~="${b.role}"] [data-role="${b.role}"]`).join(',\n        ')} { display: none !important; }
        /* Rebellion and Beverages are only hidden in the footer, never removed: the copies in
           the king tray forward their clicks to exactly these originals. */
        html[data-mcfo-tray="1"] [data-role="nav-region"] > [data-role="rebellion-toggle"],
        html[data-mcfo-tray="1"] [data-role="nav-region"] > [data-role="beverages-toggle"] { display: none !important; }

        /* === KING TRAY: ATTACK CENTRED, REBELLION LEFT, BEVERAGES RIGHT ===
           The attack button was stretched across the whole tray (measured 615 of 635px) while
           its longest label needs 187px. Three columns with 1fr on the outside keep it exactly
           centred however wide the two side buttons are. */
        /* Sized by the tray's own width (6.11): the tray is a container, and gaps, the attack
           button, the beverage buttons and their text are given in cqi (1% of its width) between a
           readable floor and the old sizes. Before, the attack button's fixed 200px and the gaps
           added up to about 330px — on a smaller screen the king pane is narrower than that, and
           the outer buttons were cut off. */
        html[data-mcfo-tray="1"] [data-role="king-action-tray"] { container-type: inline-size; }
        html[data-mcfo-tray="1"] .mcf-king-action-content {
            display: grid !important;
            grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
            align-items: center;
            gap: clamp(4px, 1.6cqi, 10px);
            /* Vertical padding as in the original (7px): at 0 the tray shrank from 57 to 43px,
               and the king pane derives its height from that. */
            padding: 7px clamp(4px, 1.6cqi, 10px);
            /* The height of the beverage buttons, measured from the attack button (6.20.3,
               syncDrinkHeight). The value here only carries the first frames, before the
               measurement is in. */
            --mcfo-drink-h: 30px;
            /* A floor, and the whole point of it is timing (6.20.3). The game rebuilds the tray
               with innerHTML and measures the columns in the SAME task
               (renderTray -> syncKingTileFit -> scheduleActionAwareMainGrid), while our copy of
               the attack button is only put back by a MutationObserver, a beat later. In between,
               the game's own attack button is already hidden by our sheet and this content box is
               empty: 14px, the padding and nothing else. The game then hands the king column the
               width of a pane that has almost no tray — the tile grows, stands higher and pushes
               the bar down, and since the game only measures again when the chat is folded, it
               stays that way (Luce, 16.09.; measured on her page: 564px wide when it counts on a
               57px tray, 579px when it counts on 14px).
               56px is what this box measures when it holds the attack button: the button's 42px
               and 7px of padding above and below, which count in because the page puts every box
               on border-box. The tray around it is then the 57px the game knows. A floor only —
               if the game ever makes its button taller, the box and the tray follow. */
            min-height: 56px;
        }
        html[data-mcfo-tray="1"] .mcf-king-action-content .mcf-king-attack-placeholder {
            /* 200px. Measured widths of the labels the button uses (kingPane.js):
                 SIGN IN TO ATTACK THE THRONE  213px   (ignored: signed-out players have no use
                                                        for a layout script)
                 BID TO ATTACK THE THRONE      187px   <- the yardstick, and the normal state
                 SNAPSHOT UNAVAILABLE          168px      whenever no bid is running
                 CURRENTLY BIDDING             138px
               The ellipsis below is a backstop: should a longer label ever appear, it is clipped
               rather than wrapped. A two-line button makes the tray taller, and the king pane
               computes its height from the tray.
               Since 6.11 200px is the ceiling, not the floor: the button narrows with the tray,
               down to 96px, and its text with it. */
            min-width: 0;
            width: clamp(96px, 34cqi, 200px) !important;
            font-size: clamp(9px, 2.1cqi, 13px) !important;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            justify-self: center;
            grid-column: 2;
            grid-row: 1;
        }
        /* grid-row is required on all three. The side buttons come after the attack button in
           the DOM, and grid auto-placement does not go backwards: without it Rebellion drops to
           a second row, the tray grows from 57 to 90px and the attack button ends up 97px off
           centre (all measured). */
        html[data-mcfo-tray="1"] .mcf-king-action-content [data-mcfo-side="left"]  { grid-column: 1; grid-row: 1; justify-self: start; }
        html[data-mcfo-tray="1"] .mcf-king-action-content [data-mcfo-side="right"] { grid-column: 3; grid-row: 1; justify-self: end; }
        /* Side by side after all. The first attempt stacked them because two in a row seemed to
           need 190px against 95px available — but that was my own min-width:70px, not the text:
           measured at 11px/800 the widest label ("Water") is 30px, so a button is 42px and a pair
           90px. It fits, with 5px to spare.
           Order is deliberate and the same on both sides: the harmless one first, the harmful one
           second — Water then Lava, Milk then Acid. */
        /* The pair fills its column instead of hugging the outer edge. Sized to the text they
           left most of a 197px column empty while sitting at the far rim — the space was there
           all along, the buttons just did not ask for it. With flex they follow the window: about
           96px each on a wide screen, about 44px on a narrow one, and always the same distance
           from the attack button. */
        html[data-mcfo-tray="1"] .mcfo-stack { display: flex; gap: clamp(3px, 1cqi, 6px); grid-row: 1; justify-self: stretch; width: 100%; }
        html[data-mcfo-tray="1"] .mcfo-stack--left  { grid-column: 1; }
        html[data-mcfo-tray="1"] .mcfo-stack--right { grid-column: 3; justify-content: flex-end; }
        /* Scaled through one variable, set from the "Button size" slider — width and text, not
           height. Since 6.20.3 a beverage button is exactly as tall as the attack button beside
           it (Luce: the different heights had bothered her since the buttons took the look of the
           themes). That also settles an old worry written here: a button taller than the attack
           button made the whole tray taller, and the king pane derives its height from the tray,
           so the size slider used to have a ceiling for that reason alone.
           The height comes from syncDrinkHeight as --mcfo-drink-h; the text is centred in it
           instead of being pushed there by padding. */
        .mcfo-drink {
            flex: 1 1 0;
            min-width: 0; max-width: calc(130px * var(--mcfo-drink-scale, 1));
            height: var(--mcfo-drink-h, 30px);
            display: inline-flex; align-items: center; justify-content: center;
            padding: 0 calc(clamp(3px, 1.2cqi, 8px) * var(--mcfo-drink-scale, 1));
            border: 2px solid; border-radius: 6px;
            font-family: inherit; font-weight: 800; font-size: calc(clamp(9px, 2.1cqi, 13px) * var(--mcfo-drink-scale, 1)); line-height: 1; cursor: pointer;
            /* Clipped rather than wrapped when the window gets tight: a second line would make the
               tray taller, and the king pane derives its height from the tray. */
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
            box-shadow: 0 2px 6px rgba(0,0,0,0.5);
            transition: transform 90ms ease, filter 90ms ease;
        }
        .mcfo-drink:hover { transform: translateY(-1px); filter: brightness(1.12); }
        /* Symbols instead of names (6.12): the symbol carries the meaning, so the button itself can
           take the page's look — the stock button colours here, which a theme recolours like the rest
           of this sheet, and a Deluxe skin's own buttons (SKIN_BUTTONS). The name stays as a tooltip
           and for screen readers. The height is the attack button's since 6.20.3, so the symbol is
           simply centred in it; it is capped below so it always fits. */
        .mcfo-drink--icon {
            background: #111f2b; border-color: #355066; color: #cde6ff;
        }
        .mcfo-drink--icon:hover { border-color: #4d7ea6; }
        .mcfo-drink__icon {
            display: block; flex: none;
            /* Grows with the tray up to 22px, times the size slider — and never past 27px, so the
               button stays inside the tray at 140% too. */
            width: min(calc(clamp(15px, 4.4cqi, 22px) * var(--mcfo-drink-scale, 1)), 27px, calc(var(--mcfo-drink-h, 30px) - 8px));
            height: min(calc(clamp(15px, 4.4cqi, 22px) * var(--mcfo-drink-scale, 1)), 27px, calc(var(--mcfo-drink-h, 30px) - 8px));
            filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.45));
        }

        /* === BEVERAGE PANEL === */
        .mcfo-menu--bev { min-width: 268px; padding: 10px 12px 12px; }
        .mcfo-bev__head { font-family: inherit; font-weight: 800; font-size: 13px; line-height: 1; letter-spacing: 0.06em; text-transform: uppercase;
                          padding-bottom: 8px; border-bottom: 1px solid #243443; margin-bottom: 8px; }
        .mcfo-bev__row { display: grid; grid-template-columns: 58px 1fr 1fr; gap: 6px; align-items: center; margin-bottom: 6px; }
        .mcfo-bev__row:last-child { margin-bottom: 0; }
        .mcfo-bev__size { font-size: 11px; font-weight: 800; color: #d8e2e7; }
        /* Currency colours are the game's own, from kingBeverages.js.
           Scoped to .mcfo-menu--bev for the same reason as the Rebellion tiles: the generic
           ".mcfo-menu button" rule is more specific than a bare class and used to strip these
           buttons of border, background and centring — they showed as loose coloured words. */
        .mcfo-menu--bev .mcfo-bev__buy {
            width: auto; text-align: center;
            padding: 6px 4px; border: 1px solid #64757c; border-radius: 5px;
            background: #26343a; color: #fff; font-family: inherit; font-weight: 800; font-size: 11px; line-height: 1; cursor: pointer;
        }
        .mcfo-menu--bev .mcfo-bev__buy[data-mcfo-cur="gold"]     { border-color: #c89d28; color: #ffe692; }
        .mcfo-menu--bev .mcfo-bev__buy[data-mcfo-cur="diamonds"] { border-color: #4db8dc; color: #bcefff; }
        .mcfo-menu--bev .mcfo-bev__buy:hover:not(:disabled) { background: #32444c; }
        .mcfo-menu--bev .mcfo-bev__buy:disabled { opacity: 0.45; cursor: not-allowed; text-decoration: line-through; }
        /* Pressed, the game's answer not in yet: greyed out at once, so a second click cannot land
           while the first is on its way. Not struck through — that stays the sign of a spent one. */
        .mcfo-menu--bev .mcfo-bev__buy[data-mcfo-state="pending"]:disabled { opacity: 0.6; cursor: progress; text-decoration: none; }

        /* === NAME SUGGESTIONS ===
           The list the game opens above the message box for !tomato and the other targeted
           commands (chatPane.js renderSuggestions). The game hides it with the hidden attribute,
           but its own sheet gives it display: grid, border and padding, which beats hidden — so an
           empty, bordered bar stood above the box all the time. Hidden really means hidden here.
           Drawn in the game's stock colours, so every theme maps them like the rest of this sheet;
           !important because the mirrored game rules of a theme come later and are as specific. */
        html[data-mcfo-sugg="1"] .mcf-chat__suggestions[hidden],
        html[data-mcfo-sugg="1"] .mcf-chat__suggestions:empty { display: none !important; }
        html[data-mcfo-sugg="1"] .mcf-chat__suggestions {
            bottom: calc(100% + 2px) !important; gap: 2px !important; padding: 4px !important;
            border: 1px solid #2f3f4e !important; border-radius: 10px !important;
            background: #0e151c !important; box-shadow: 0 -10px 28px rgba(0, 0, 0, 0.5) !important;
        }
        html[data-mcfo-sugg="1"] .mcf-chat__suggestions::before {
            content: 'Choose a player'; padding: 3px 7px 5px; font-size: 10px; font-weight: 800;
            letter-spacing: 0.08em; text-transform: uppercase; color: #8da2b7;
        }
        html[data-mcfo-sugg="1"] .mcf-chat__suggestion {
            padding: 6px 9px !important; border: 1px solid transparent !important; border-radius: 7px !important;
            background: transparent !important; color: #dbeaf2 !important; font-family: inherit; font-weight: 700; cursor: pointer;
        }
        html[data-mcfo-sugg="1"] .mcf-chat__suggestion:hover,
        html[data-mcfo-sugg="1"] .mcf-chat__suggestion:focus-visible {
            background: #1b3550 !important; border-color: #4d7ea6 !important; outline: none;
        }

        /* === GROWING MESSAGE BOX (section 9h) ===
           The game's one-line input stays in the form, out of sight but focusable; the textarea
           after it takes its grid cell. Send stays one line high at the bottom, as in a messenger. */
        html[data-mcfo-chatgrow="1"] .mcf-chat__form > [data-role="chat-input"][data-mcfo-grow] {
            position: absolute !important; width: 1px !important; height: 1px !important; min-width: 0 !important;
            padding: 0 !important; border: 0 !important; opacity: 0 !important; pointer-events: none !important;
            overflow: hidden !important; clip-path: inset(50%) !important;
        }
        html[data-mcfo-chatgrow="1"] .mcf-chat__form .mcfo-chatgrow {
            display: block; box-sizing: border-box; width: 100%; margin: 0; resize: none; overflow-y: hidden;
            font-family: inherit; white-space: pre-wrap; overflow-wrap: anywhere;
        }
        html[data-mcfo-chatgrow="1"] .mcf-chat__form:has(.mcfo-chatgrow) > .mcf-chat__send {
            align-self: end; height: var(--mcfo-chatgrow-line, auto);
        }

        /* === TICKET RAIL: REBELLION IN IT, COLLAPSIBLE ===
           The rail sits in bid-area, whose contents are centred — so however many chips are
           shown, and with Rebellion as part of the group, the whole thing stays centred by
           itself. centreRail only moves bid-area onto the board; it never has to know the width. */
        .mcfo-rebellion, .mcfo-rail-toggle {
            align-self: center;
            padding: 8px 12px; min-height: 40px;
            border: 1px solid #6f4a4a; border-radius: 7px;
            background: #1d1416; color: #ffc9c9;
            font-family: inherit; font-weight: 800; font-size: 12px; line-height: 1; cursor: pointer; white-space: nowrap;
        }
        .mcfo-rebellion:hover { background: #2a1b1e; border-color: #a06a6a; }
        .mcfo-rail-toggle {
            border-color: #46596b; background: #131d26; color: #cfe2f2;
            padding: 8px 10px; font-size: 14px;
        }
        .mcfo-rail-toggle:hover { background: #1b2a38; border-color: #4d7ea6; }
        /* The rebellion panel trimmed down — same content and the same buttons, just less air.
           Measured 420x509 in the original. */
        html[data-mcfo-rail] [data-role="rebellion-panel"] { width: 330px !important; max-width: 92vw; }
        html[data-mcfo-rail] [data-role="rebellion-panel"] * { font-size: 11px !important; }
        html[data-mcfo-rail] [data-role="rebellion-tier-start"] { min-height: 24px !important; padding: 3px 6px !important; }
        /* !important is needed: the game writes an inline display on each chip. */
        html[data-mcfo-rail="closed"] [data-role="bid-rail"] > [data-mcfo-big="1"] { display: none !important; }
        /* While you are King the game hides the rail and shows the toll controls in its place —
           and those carry an inline width:100%. In the flex row they then swallow all remaining
           space and centre themselves inside it, which pushed Rebellion hard against the left
           edge, on top of our own footer line (measured: toll 2082px wide, Rebellion at x=25).
           Sized to their content instead, the two are centred together like Rebellion and the
           rail are. */
        html[data-mcfo-rail] [data-role="bid-area"] > [data-role="king-toll-controls"] {
            width: auto !important;
            flex: 0 0 auto !important;
        }
        /* bid-area has no gap of its own — the chips bring theirs from inside the rail. With
           Rebellion as a sibling it therefore sat flush against whatever came next, the "Reduce
           Toll" button in particular. */
        html[data-mcfo-rail] [data-role="bid-area"] { gap: 10px; }
        /* While you are King, Rebellion and Unbid step aside and leave the toll controls on their
           own: the game hides the ticket rail then, so there is no bid to take back, and a
           rebellion is aimed at the throne you are sitting on. The game marks that state on
           bid-area itself (data-king-toll-mode, written together with the toll controls in
           renderKingTollControls, app.js) — keyed on that, the buttons come and go with the reign
           without any polling of ours. Hidden, not removed: both come back as they were. */
        [data-role="bid-area"][data-king-toll-mode="true"] > .mcfo-rebellion,
        [data-role="bid-area"][data-king-toll-mode="true"] > .mcfo-unbid,
        [data-role="bid-area"][data-king-toll-mode="true"] > .mcfo-autobid { display: none !important; }

        /* === OWN REBELLION PANEL ===
           The game's panel stays in the page and does the buying; while ours is open it is only
           made invisible, never removed — its buttons are what ours press. */
        html[data-mcfo-rebpop="1"] [data-role="rebellion-panel"] { visibility: hidden !important; pointer-events: none !important; }
        .mcfo-menu--reb { width: 470px; max-width: calc(100vw - 16px); padding: 12px 14px 14px; }
        .mcfo-reb__head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px;
                          padding-bottom: 8px; border-bottom: 1px solid #243443; margin-bottom: 9px; }
        .mcfo-reb__title { font-weight: 800; font-size: 14px; letter-spacing: 0.05em; text-transform: uppercase; color: #ffc9c9; }
        .mcfo-reb__note { font-size: 11px; color: #c9a3a3; }
        .mcfo-reb__info { display: grid; gap: 4px; margin-bottom: 10px; font-size: 12px; line-height: 1.35; }
        .mcfo-reb__wallet { color: #bcefff; }
        .mcfo-reb__active { padding: 7px 9px; border: 1px solid #6f4a4a; border-radius: 7px; background: #231417; color: #ffd6d6; }
        .mcfo-reb__active[hidden] { display: none; }
        .mcfo-reb__msg { min-height: 16px; color: #a9bac8; }
        .mcfo-reb__msg[data-tone="error"]   { color: #f3a4a4; }
        .mcfo-reb__msg[data-tone="success"] { color: #9fd8b6; }
        .mcfo-reb__grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 7px; }
        /* One colour per tier, from calm to hot, carried by a single variable so border, number
           and glow stay in step.
           Every rule here is scoped to .mcfo-menu--reb on purpose. The generic menu rule
           ".mcfo-menu button" (block, no border, no background, left-aligned) is more specific
           than a bare class, and in 3.10 it won: the tiles lost frame, background and grid, and
           their three lines ran into one ("x5 5 tiles500 diamonds"). */
        .mcfo-menu--reb .mcfo-reb__tier {
            width: auto; text-align: center; min-width: 0;
            display: grid; gap: 3px; justify-items: center;
            padding: 9px 6px 8px;
            border: 1px solid color-mix(in srgb, var(--mcfo-tier) 55%, #1c2b37);
            border-radius: 9px;
            background: linear-gradient(180deg, color-mix(in srgb, var(--mcfo-tier) 16%, #0f1a24), #0d161f);
            font-family: inherit; color: #dce8ef; cursor: pointer;
            transition: transform 90ms ease, border-color 120ms ease, box-shadow 120ms ease;
        }
        .mcfo-menu--reb .mcfo-reb__tier:hover:not(:disabled) { transform: translateY(-1px); border-color: var(--mcfo-tier);
                                               box-shadow: 0 0 0 1px var(--mcfo-tier), 0 4px 14px color-mix(in srgb, var(--mcfo-tier) 35%, transparent); }
        .mcfo-reb__mult { font-size: 20px; font-weight: 900; line-height: 1.05; color: var(--mcfo-tier); }
        .mcfo-reb__tiles { font-size: 11px; color: #9fb3c2; }
        .mcfo-reb__cost { font-size: 12px; font-weight: 800; color: #bcefff; white-space: nowrap; }
        .mcfo-menu--reb .mcfo-reb__tier:disabled { opacity: 0.4; cursor: not-allowed; transform: none; box-shadow: none; }
        /* Armed: the next click spends. Unmistakably different, and it says the amount. */
        .mcfo-menu--reb .mcfo-reb__tier[data-mcfo-armed="1"] { border-color: #ff6b5a; background: linear-gradient(180deg, #4a1a1a, #2a1012);
                                               box-shadow: 0 0 0 1px #ff6b5a, 0 0 16px rgba(255,107,90,0.45); }
        .mcfo-menu--reb .mcfo-reb__tier[data-mcfo-armed="1"] .mcfo-reb__mult { color: #fff; font-size: 16px; }
        .mcfo-menu--reb .mcfo-reb__tier[data-mcfo-armed="1"] .mcfo-reb__tiles { color: #ffd6d6; font-weight: 800; }

        /* === TOLL FIELD ===
           Replaces the game's Reduce / value / Increase with one field. The game's three stay in
           the page — hidden, never removed: they are what the field presses. Colours taken from
           the game's own toll buttons (buildKingTollControlMarkup in app.js): gold #6f5a28 frame,
           #f1dfad text, value box #10171a with a #5d6d72 frame. */
        html[data-mcfo-toll="1"] [data-role="king-toll-decrease"],
        html[data-mcfo-toll="1"] [data-role="king-toll-increase"],
        html[data-mcfo-toll="1"] [data-role="king-toll-current"] { display: none !important; }
        .mcfo-toll {
            display: inline-flex; align-items: center; gap: 9px;
            min-height: 34px; padding: 3px 10px 3px 12px; box-sizing: border-box;
            border: 1px solid #6f5a28; border-radius: 8px;
            background: linear-gradient(180deg, #1a2124, #131a1d);
            box-shadow: 0 2px 6px rgba(0,0,0,0.45);
        }
        .mcfo-toll[data-mcfo-locked="1"] { opacity: 0.58; }
        .mcfo-toll__label {
            color: #f1dfad; font-weight: 800; font-size: 12px; letter-spacing: 0.09em; text-transform: uppercase;
        }
        .mcfo-toll__input {
            width: 2.6em; height: 26px; box-sizing: border-box; padding: 0 2px;
            border: 1px solid #5d6d72; border-radius: 6px; background: #10171a; color: #edf4f8;
            font-family: inherit; font-size: 18px; font-weight: 900; line-height: 1; text-align: center;
            -moz-appearance: textfield; appearance: textfield;
            transition: border-color 120ms ease, box-shadow 120ms ease;
        }
        .mcfo-toll__input::-webkit-inner-spin-button, .mcfo-toll__input::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        .mcfo-toll__input:focus { outline: none; border-color: #e0b84a; box-shadow: 0 0 0 2px rgba(224, 184, 74, 0.28); }
        /* Typed but not yet confirmed: the frame says "press Enter". */
        .mcfo-toll__input[data-mcfo-dirty="1"] { border-color: #e0b84a; color: #ffe692; }
        .mcfo-toll__max { color: #8d9aa0; font-size: 12px; font-weight: 700; margin-left: -4px; }
        .mcfo-toll__range { width: 150px; accent-color: #c89d28; cursor: pointer; }
        .mcfo-toll__range[hidden] { display: none; }
        .mcfo-toll__status { font-size: 11px; font-weight: 700; white-space: nowrap; }
        .mcfo-toll__status:empty { display: none; }
        .mcfo-toll__status[data-tone="busy"]  { color: #ffd479; }
        .mcfo-toll__status[data-tone="ok"]    { color: #9fd8b6; }
        .mcfo-toll__status[data-tone="error"] { color: #f3a4a4; }

        /* === CHAT: SMOOTH COLLAPSE, SLIM RAIL ===
           The game collapses the chat by switching the column of lane-play-region in one step
           (app.js: 'minmax(0,1fr) clamp(300px,19vw,340px)' <-> 'minmax(0,1fr) 44px', set inline)
           and hiding the chat's body at once (chatPane.css).
           The column itself must NOT be animated. The game sizes its lanes in fixed pixels exactly
           once, in the moment of the click (onCollapseChange -> setLayoutMode -> the lane grid).
           With an animated column (3.13/3.14) it measured the column where it started: on opening
           that is 44px, so the lanes kept the full width and the chat slid over the right lane.
           So the layout jumps and the game measures the final width; the motion is only a picture
           laid over it afterwards (FLIP, see glideChat in section 9d). */
        @keyframes mcfoRailIn  { from { opacity: 0; } to { opacity: 1; } }
        @keyframes mcfoBadgeIn { from { transform: scale(0.4); opacity: 0; } to { transform: none; opacity: 1; } }
        html[data-mcfo-chatrail="1"] .mcf-chat { position: relative; }
        /* Restoring the collapsed state on load happens without any of the motion above —
           the page should simply come up the way it was left, not visibly fold on start. */
        html[data-mcfo-chat-instant] .mcf-chat > *,
        html[data-mcfo-chat-instant] .mcfo-chatrail { animation: none !important; }
        /* Collapsed: the game's own header (turned sideways, a lone arrow halfway down) makes
           way for the rail. Only hidden — its collapse button is what the rail presses. */
        html[data-mcfo-chatrail="1"] .mcf-chat[data-collapsed="true"] .mcf-chat__header { visibility: hidden; }

        .mcfo-chatrail {
            position: absolute; inset: 0; z-index: 5;
            display: none; flex-direction: column; align-items: center; gap: 12px;
            padding: 10px 0 12px;
            background: linear-gradient(180deg, #13222f 0%, #0d1822 45%, #0a121a 100%);
            cursor: pointer; user-select: none;
            transition: background 180ms ease;
        }
        html[data-mcfo-chatrail="1"] .mcf-chat[data-collapsed="true"] .mcfo-chatrail {
            display: flex; animation: mcfoRailIn 240ms 80ms ease both;
        }
        .mcfo-chatrail:hover { background: linear-gradient(180deg, #172a39 0%, #102030 45%, #0b151e 100%); }
        .mcfo-chatrail__btn {
            flex: none; width: 30px; height: 30px; border-radius: 50%;
            display: grid; place-items: center;
            border: 1px solid #355066; background: #111f2b; color: #cde6ff;
            transition: transform 180ms ease, border-color 180ms ease, background 180ms ease;
        }
        .mcfo-chatrail__btn svg { width: 14px; height: 14px; }
        .mcfo-chatrail:hover .mcfo-chatrail__btn { border-color: #4d7ea6; background: #16283a; transform: translateX(-2px); }
        .mcfo-chatrail__badge {
            flex: none; min-width: 22px; height: 22px; padding: 0 6px; box-sizing: border-box; border-radius: 11px;
            background: #e0b84a; color: #1a1405;
            font: 800 11px/22px system-ui, sans-serif; text-align: center;
            box-shadow: 0 0 0 3px rgba(224, 184, 74, 0.18);
            animation: mcfoBadgeIn 220ms cubic-bezier(0.3, 1.4, 0.5, 1) both;
        }
        .mcfo-chatrail__badge[hidden] { display: none; }
        .mcfo-chatrail__label {
            writing-mode: vertical-rl;
            font-size: 11px; font-weight: 800; letter-spacing: 0.34em; text-transform: uppercase;
            color: #8da2b7;
        }
        .mcfo-chatrail__room { writing-mode: vertical-rl; font-size: 10px; letter-spacing: 0.08em; color: #5f7688; }
        .mcfo-chatrail:hover .mcfo-chatrail__label { color: #cfe2f2; }

        /* === SEE-THROUGH BOARD FRAMES (6.10) ===
           A tile keeps its own shape: a lane's svg is sized to the tile's aspect and draws its ground
           inside (layoutLaneViewport, renderLaneFrame tileBg), the king tile is .mcf-king-fit-viewport.
           What is left around them is painted by the boxes they sit in — lane-panel #101516 and
           lane-viewport #090d0f (app.js laneDom), king-pane and king-viewport #0f1215 and the king's
           action tray #0b0f10 (kingPaneDom), and the dark brown of kingPane.js's .mcf-king-pane. Those
           go transparent, and since 6.11 so do the outlines of the frames and the line over the king's
           tray — only the tiles are left. Transparent rather than removed, so no box changes size
           under the game's measurements. !important and the longer selector because a theme recolours
           the same inline colours with [data-mcfo-t~=…] !important (0,2,1). */
        html[data-mcfo-boardclear="1"] [data-role="main-region"] :is([data-role="lane-panel"], [data-role="lane-viewport"], [data-role="king-pane"], [data-role="king-viewport"], [data-role="king-action-tray"], .mcf-king-pane) {
            background: transparent !important;
        }
        html[data-mcfo-boardclear="1"] [data-role="main-region"] :is([data-role="lane-panel"], [data-role="king-pane"], [data-role="king-action-tray"]) {
            border-color: transparent !important;
        }

        /* === KING TRAY UNDER THE TILE (6.11) ===
           Moved by translate only, from a length placeKingTray measures (section 7): the game's
           layout — and the king pane's height, which it derives from the tray — stays as it is. */
        html[data-mcfo-traylift="1"] [data-role="king-action-tray"] { translate: 0 calc(-1 * var(--mcfo-tray-lift, 0px)); }
        /* While a marble runs in the king tile the game empties the tray (6.20.1, watchTrayHeight):
           it keeps the height it had when filled, so the tile above it does not move. */
        [data-role="king-action-tray"].lane-action-tray--empty { box-sizing: border-box; min-height: var(--mcfo-tray-keep, 0px); }

        /* === CHAT HEIGHT FOLLOWS THE BOARD (6.13) ===
           The chat column filled the whole height, while the tiles, fitted by their aspect, often
           leave room above and below. The chat gives up half of that room at the top and at the
           bottom (placeChat measures it), so the two heights approach each other without meeting.
           A margin on the grid item, and the height taken down by the same amount twice: the game
           gives the pane a height of its own, and a margin alone only pushed it down, out at the
           bottom (measured). Not in the pop-out window, where the pane fills the window. */
        html[data-mcfo-chatfit="1"]:not([data-mcfo-chatpop="1"]) [data-role="lane-play-region"] > [data-role="desktop-chat-pane"] {
            margin-block: var(--mcfo-chat-inset, 0px);
            height: calc(100% - 2 * var(--mcfo-chat-inset, 0px)) !important;
            max-height: calc(100% - 2 * var(--mcfo-chat-inset, 0px)) !important;
        }

        /* === CHAT POP-OUT ===
           The whole desktop-chat-pane moves into a window, not just the chat inside it: the game
           re-attaches the chat to that pane on every layout pass (chatController.attach), so the
           chat stays wherever the pane is. The pane itself the game never moves. */
        html[data-mcfo-chatpop="1"] [data-role="lane-play-region"] {
            grid-template-columns: minmax(0, 1fr) 0px !important; column-gap: 0 !important;
        }
        .mcfo-win__body > [data-role="desktop-chat-pane"] {
            position: absolute; inset: 0; height: auto !important; max-height: none !important;
        }
        .mcfo-win__body > [data-role="desktop-chat-pane"] .mcf-chat { border: 0; border-radius: 0; }
        html[data-mcfo-chatpop="1"] [data-role="chat-collapse"],
        html[data-mcfo-chatpop="1"] .mcfo-chatpop-btn,
        html[data-mcfo-chatpop="1"] .mcfo-chatrail { display: none !important; }
        /* The header gets as many columns as it has buttons. The game plans three, the chat
           script four; with ours it can be five, and a fixed count makes the last one wrap. */
        html[data-mcfo-popbtn="1"] .mcf-chat:not([data-collapsed="true"]) .mcf-chat__header {
            grid-template-columns: minmax(0, 1fr) !important; grid-auto-flow: column; grid-auto-columns: auto;
        }
        .mcfo-chatpop-btn {
            width: 30px; height: 30px; padding: 0; box-sizing: border-box;
            display: grid; place-items: center;
            border: 1px solid #355066; border-radius: 7px; background: #111f2b; color: #cde6ff; cursor: pointer;
        }
        .mcfo-chatpop-btn:hover { border-color: #4d7ea6; background: #16283a; }
        .mcfo-chatpop-btn svg { width: 15px; height: 15px; }

        /* === SETTINGS GEAR IN PLACE OF THE SOUND BUTTON (6.14) ===
           The game's speaker button and its panel are hidden, not removed: the Sound page works the
           controls inside it. The gear takes the button's cell (profile-sound-cell, a two-column
           grid: account card | button) and its size. */
        html[data-mcfo-gear="1"] [data-role="sound-utility-toggle"],
        html[data-mcfo-gear="1"] [data-role="sound-utility-panel"] { display: none !important; }
        .mcfo-gear {
            width: 32px; height: 32px; padding: 0; box-sizing: border-box;
            display: grid; place-items: center;
            border: 1px solid #355066; border-radius: 8px; background: #111822; color: #d8e3ef; cursor: pointer;
        }
        .mcfo-gear:hover { border-color: #4d7ea6; background: #16283a; }
        .mcfo-gear svg { width: 17px; height: 17px; display: block; transition: transform 300ms ease; }
        .mcfo-gear:hover svg { transform: rotate(60deg); }
        .mcfo-taskbar__badge {
            display: inline-block; min-width: 18px; height: 18px; padding: 0 5px; box-sizing: border-box; border-radius: 9px;
            background: #e0b84a; color: #1a1405; font: 800 10px/18px system-ui, sans-serif; text-align: center;
        }

        /* === HEADER CARDS AS SIGNPOSTS === */
        .mcfo-card, .mcfo-card * { cursor: pointer !important; }
        .mcfo-card { position: relative; transition: border-color 120ms ease; }
        .mcfo-card:hover { border-color: #4d7ea6 !important; }
        /* Colours taken from the game, not invented. The stock Diamonds card already contains
           the site's own way of saying "this card does something" — the Purchase button, drawn
           as #dcefff on #14283a with a #3d5f78 border at 11px. The signposts borrow exactly
           that, so all four cards speak with one voice and the Diamonds card needs no label of
           its own.
           The first attempt used #7f97ac, which is all but the #8da2b7 of the card captions —
           that is why the words read as another read-out instead of as a way in. */
        .mcfo-signpost {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            white-space: nowrap;
            font-size: 11px;
            font-weight: 700;
            line-height: 1;
            padding: 4px 7px;
            border-radius: 7px;
            border: 1px solid #3d5f78;
            background: #14283a;
            color: #dcefff;
            pointer-events: none;
            transition: background 120ms ease, border-color 120ms ease;
        }
        /* The card already lifts its own border on hover; the chip follows along a step, without
           turning into a second focus point. */
        .mcfo-card:hover .mcfo-signpost { background: #1b3550; border-color: #4d7ea6; }
        /* The game's own Purchase button is the fourth of these chips, so it is pulled into line
           rather than left as the odd one out: same weight, same arrow. Its colours already match
           — they are where the chip style came from. The arrow is added through ::after so the
           game's own label text stays untouched and survives a rebuild. */
        html[data-mcfo-cards="1"] [data-role="diamonds-purchase-link"] { font-weight: 700 !important; }
        html[data-mcfo-cards="1"] [data-role="diamonds-purchase-link"]::after { content: ' ›'; }
        .mcfo-signpost--float { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); }
        /* Was pinned to the lower line while season and episode still filled the upper one to
           within 9px of the edge. With those moved to the footer the card has room again, so the
           chip sits centred like the others — same rule everywhere. */

        /* === FOOTER: SEASON, EPISODE, BUILD ===
           Season and episode used to sit inside the tileset card, where they filled the upper
           line right up to the edge — which is what the Events chip was colliding with. Down
           here they are out of the way, and the build number finally has a place at all: the
           game shows it nowhere. */
        html[data-mcfo-footermeta="1"] [data-role="stat-window-indicator"] { display: none !important; }
        .mcfo-footermeta {
            display: flex; align-items: center; gap: 9px;
            padding: 0 12px;
            font-size: 13px; line-height: 1;
            color: #8da2b7;
            white-space: nowrap;
            pointer-events: none;
        }
        .mcfo-footermeta__build { opacity: 0.65; }

        /* === TILESET BANNER (6.24) ===
           The game announces a new tileset with a picture over a nearly black curtain across the
           whole board. With the option on, curtain and picture go, and a line of text takes their
           place. The overlay itself stays: its fade in, hold and fade out are the game's own, and
           the text simply rides along inside it. */
        /* The doubled attribute is for weight: a theme re-tints the curtain's inline colour with a
           rule of its own (html[data-mcfo-theme] [data-mcfo-t~=...]) that would otherwise win. */
        html[data-mcfo-tsbanner="1"] [data-role="tileset-transition-splash-overlay"][data-role] { background: transparent !important; }
        html[data-mcfo-tsbanner="1"] [data-role="tileset-transition-splash-image"] { display: none !important; }
        html:not([data-mcfo-tsbanner="1"]) .mcfo-tsbanner { display: none; }
        .mcfo-tsbanner {
            display: grid; justify-items: center; gap: 6px;
            padding: 18px 42px 20px;
            border-radius: 14px;
            background: radial-gradient(ellipse at center, rgba(6, 9, 13, 0.62) 0%, rgba(6, 9, 13, 0.38) 55%, rgba(6, 9, 13, 0) 78%);
            text-align: center;
            pointer-events: none;
        }
        .mcfo-tsbanner__kicker {
            font: 700 13px/1 system-ui, sans-serif;
            letter-spacing: 0.32em; text-transform: uppercase;
            color: rgba(255, 255, 255, 0.72);
            text-shadow: 0 1px 6px rgba(0, 0, 0, 0.8);
        }
        .mcfo-tsbanner__name {
            font: 900 clamp(34px, 5.2vw, 72px)/1.05 "Helvetica Neue", "Arial Black", "Archivo Black", Helvetica, Arial, sans-serif;
            letter-spacing: 0.02em;
            color: #fff;
            text-shadow: 0 2px 0 rgba(0, 0, 0, 0.35), 0 4px 22px rgba(0, 0, 0, 0.75);
        }

        /* === TOMATO NOTICE (6.25, section 9j) === */
        .mcf-chat__message[data-mcfo-tomato] > :not(.mcfo-tomato) { display: none !important; }
        .mcf-chat__message[data-mcfo-tomato-gone] { display: none !important; }
        /* The game frames a command result in a box of its own; the notice is the box. */
        .mcf-chat__message[data-mcfo-tomato] { padding: 0 !important; border: 0 !important; background: none !important; box-shadow: none !important; }
        .mcfo-tomato {
            display: flex; align-items: center; gap: 8px;
            padding: 5px 6px 5px 9px;
            border-left: 3px solid #e05a47; border-radius: 6px;
            background: rgba(224, 90, 71, 0.10);
            font-size: 0.92em; line-height: 1.3;
        }
        .mcfo-tomato__icon { flex: none; width: 18px; height: 18px; }
        .mcfo-tomato__text { flex: 1; min-width: 0; overflow-wrap: anywhere; }
        .mcfo-tomato__text b { font-weight: 800; }
        .mcfo-tomato__time { flex: none; font-size: 0.85em; opacity: 0.6; }
        .mcfo-tomato .mcfo-tomato__x {
            flex: none; display: grid; place-items: center;
            width: 22px; height: 22px; padding: 0; margin: 0;
            border: 0; border-radius: 5px; background: transparent; color: inherit;
            font: 700 15px/1 system-ui, sans-serif; opacity: 0.55; cursor: pointer;
        }
        .mcfo-tomato .mcfo-tomato__x:hover { opacity: 1; background: rgba(255, 255, 255, 0.10); }

        /* === MENUS === */
        .mcfo-anchor, .mcfo-anchor * { cursor: pointer !important; }
        .mcfo-anchor[data-mcfo-open="1"] { outline: 1px solid rgba(77, 166, 255, 0.5); outline-offset: 2px; border-radius: 6px; }
        .mcfo-menu {
            position: fixed;
            z-index: 10050;
            min-width: 200px;
            background: #091018;
            border: 1px solid #345064;
            border-radius: 8px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.8);
            color: #d7e2ea;
            padding: 6px;
            font-size: 0.95em;
        }
        .mcfo-menu button {
            display: block; width: 100%; text-align: left;
            background: transparent; border: none; color: #d7e2ea;
            padding: 9px 12px; border-radius: 5px; cursor: pointer; font: inherit;
        }
        .mcfo-menu button:hover { background: #16283a; }
        .mcfo-menu hr { border: 0; border-top: 1px solid #243443; margin: 6px 4px; }

        /* === EVENTS PANEL === */
        .mcfo-menu--events { min-width: 320px; max-width: 380px; padding: 10px 12px 12px; }
        .mcfo-events__head { font-weight: bold; color: #d7e2ea; padding-bottom: 8px; border-bottom: 1px solid #243443; margin-bottom: 6px; }
        .mcfo-events__head small { display: block; font-weight: normal; opacity: 0.6; margin-top: 2px; }
        .mcfo-events__list { list-style: none; margin: 0; padding: 0; max-height: 60vh; overflow: auto; }
        .mcfo-events__list li { display: flex; justify-content: space-between; gap: 14px; padding: 7px 4px; border-bottom: 1px solid #16232f; }
        .mcfo-events__list li:last-child { border-bottom: 0; }
        .mcfo-events__name { font-weight: 600; }
        .mcfo-events__when { opacity: 0.7; white-space: nowrap; }
        .mcfo-events__list li[data-mcfo-live="1"] { color: #ffd479; }
        .mcfo-events__empty { opacity: 0.6; padding: 10px 4px; }

        /* === WINDOWS ===
           Not one modal overlay any more but several independent windows, because a modal one
           cannot do what is wanted here: keep several pages open, park one, and go on playing.
           The desk spans the viewport but lets clicks through — only the windows themselves
           catch them, so the board underneath stays fully playable. */
        .mcfo-desk {
            position: fixed; inset: 0; z-index: 10040;
            pointer-events: none;
        }
        .mcfo-win {
            position: absolute;
            pointer-events: auto;
            display: flex; flex-direction: column;
            min-width: 420px; min-height: 240px;
            background: #0b121a;
            border: 1px solid #345064; border-radius: 10px;
            box-shadow: 0 20px 70px rgba(0,0,0,0.85);
            overflow: hidden;
        }
        .mcfo-win[hidden] { display: none !important; }
        .mcfo-win__head {
            display: flex; align-items: center; gap: 10px;
            padding: 9px 8px 9px 14px;
            background: #0c1721; border-bottom: 1px solid #243443;
            color: #d7e2ea; font-weight: bold;
            cursor: grab; user-select: none; flex: none;
        }
        .mcfo-win__head:active { cursor: grabbing; }
        .mcfo-win__title { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .mcfo-win__btn {
            background: transparent; border: none; color: #9ab0c0;
            font-family: inherit; font-weight: 700; font-size: 15px; line-height: 1; cursor: pointer; padding: 4px 9px; border-radius: 5px;
        }
        .mcfo-win__btn:hover { background: #16283a; color: #fff; }
        .mcfo-win__body { flex: 1; position: relative; background: transparent; }
        .mcfo-win__body iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; background: transparent; transition: opacity 160ms ease; }
        .mcfo-win__body iframe:not([data-mcfo-ready]) { opacity: 0; }
        /* Resize grip, bottom right. Drawn as two hairlines rather than an icon so it reads as
           a corner and not as a button. */
        .mcfo-win__grip {
            position: absolute; right: 0; bottom: 0; width: 18px; height: 18px;
            cursor: nwse-resize;
            background:
                linear-gradient(135deg, transparent 46%, #4a6479 46%, #4a6479 54%, transparent 54%),
                linear-gradient(135deg, transparent 70%, #4a6479 70%, #4a6479 78%, transparent 78%);
        }
        .mcfo-loading {
            position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
            color: #6b8299; font-size: 1.1em; pointer-events: none;
        }

        /* === TASKBAR ===
           Only there while something is parked. Floats just above the game footer, which is full
           to the brim — measured at 1920x905 the footer holds our own line on the left, the bid
           area across the middle and the navigation on the right, with no free strip to dock to. */
        .mcfo-taskbar {
            position: fixed; left: 12px; z-index: 10041;
            display: flex; gap: 8px; flex-wrap: wrap;
            pointer-events: auto;
        }
        .mcfo-taskbar[hidden] { display: none !important; }
        .mcfo-taskbar button {
            display: inline-flex; align-items: center; gap: 7px;
            padding: 6px 12px;
            border: 1px solid #3d5f78; border-radius: 7px;
            background: rgba(20, 40, 58, 0.92);
            color: #dcefff; font-family: inherit; font-weight: 700; font-size: 12px; line-height: 1; cursor: pointer;
        }
        .mcfo-taskbar button:hover { background: #1b3550; border-color: #4d7ea6; }

        /* === GLASS: LET THE GAME SHOW THROUGH ===
           Goes against the original design, hence the switch.

           The first attempt tinted the panel and dimmed the backdrop, and next to nothing came
           through — because both lie on top of each other: 0.42 backdrop under an 0.88 panel
           leaves 0.12 x 0.58, about 7% of the board, and the panel covers 92% x 88% of the
           window so there is barely any bare backdrop to see either. Stacking two translucent
           layers is not twice as see-through, it is half.

           So the tint now lives in ONE place, and in the embedded page rather than the panel
           (see framePanelMode). That also fixes the diamond packages turning white: that page
           declares color-scheme:normal instead of dark, so clearing its background dropped it
           onto the browser's light default canvas. A page that paints its own translucent tint
           never falls through to the canvas at all.

           The backdrop is left almost clear — the panel's border and shadow mark it out well
           enough without dimming the board behind it. */
        /* No dimming layer at all now: with several windows open and the game meant to stay
           playable, a backdrop would be exactly wrong. */
        html[data-mcfo-glass="1"] .mcfo-win {
            background: transparent;
            backdrop-filter: blur(6px);
        }
        /* THE ONE THAT ACTUALLY BLOCKED IT (kept as a warning).
           The body between window and frame used to carry an opaque #0b121a, and everything set
           on the window and inside the page was buried behind it — two rounds of tuning changed
           nothing visible. The title bar went translucent because it is a sibling of the body,
           the page did not because it is a child. It is transparent by default now. */
        html[data-mcfo-glass="1"] .mcfo-win__body { background: transparent; }
        /* The strength comes from the Transparency slider via two variables on <html>; the
           same pair is pushed into every frame (applyGlassToFrames). */
        html[data-mcfo-glass="1"] .mcfo-win__head { background: rgba(12, 23, 33, var(--mcfo-glass-head, 0.82)); }
        /* The small panels stay noticeably more solid — they are dense with text and sit over
           the board rather than over a dimmed backdrop. */
        html[data-mcfo-glass="1"] .mcfo-menu {
            background: rgba(9, 16, 24, 0.93);
            backdrop-filter: blur(3px);
        }

        /* === PERFORMANCE ===
           Each lever is one token in data-mcfo-perf on <html>, so switching it off takes effect
           at once and leaves nothing behind. */

        /* The crown's shadow sits on .crownOverlayProof, whose drawing area is blown up by
           inset:-170% -135% around the crown — a large surface, re-shadowed on every frame
           because the crown under it turns. The wall blocks carry one each (kingPane.js). */
        html[data-mcfo-perf~="shadows"] .mcf-king-crown-overlay-layer .crownOverlayProof,
        html[data-mcfo-perf~="shadows"] .mcf-king-shared-renderer-stage [data-role="king-layout-target-shape"],
        html[data-mcfo-perf~="shadows"] .mcf-king-shared-renderer-stage [data-role="king-wall-block-shape"] { filter: none !important; }

        /* The crown renders through three.js on every frame and sizes its canvas from its box
           each time (crownOverlayProofRenderer.js, draw -> resize). Hidden, that box is 0x0 and
           the canvas drops to 1x1 pixel, so the loop that keeps running costs next to nothing. */
        html[data-mcfo-perf~="crownhide"] [data-role="king-crown-overlay-layer"] { display: none !important; }

        /* Crowns without a 3D model turn through a CSS animation instead (crownOverlayProofBandTurn,
           kingPane.js); the still crown stops that one too. The 3D ones are handled in section 14. */
        html[data-mcfo-perf~="crownstill"] .mcf-king-crown-overlay-layer .crownOverlayProofRotating { animation: none !important; }

        /* Chat cosmetics animate through keyframes (16 of them in chatPane.css). */
        html[data-mcfo-perf~="chatmotion"] .mcf-chat *,
        html[data-mcfo-perf~="chatmotion"] .mcf-chat *::before,
        html[data-mcfo-perf~="chatmotion"] .mcf-chat *::after { animation: none !important; }

        /* A blur behind a window has to be redone whenever anything beneath it moves — and the
           board beneath moves all the time. Includes the chat script's settings window. */
        html[data-mcfo-perf~="noblur"] .mcfo-win,
        html[data-mcfo-perf~="noblur"] .mcfo-menu,
        html[data-mcfo-perf~="noblur"] .mcfc-win { backdrop-filter: none !important; }

        /* Both the board and the king tile are SVG. */
        html[data-mcfo-perf~="edges"] [data-role="lane-stage"] svg,
        html[data-mcfo-perf~="edges"] .mcf-king-shared-renderer-stage svg { shape-rendering: optimizeSpeed; text-rendering: optimizeSpeed; }

        .mcfo-fps {
            position: fixed; right: 12px; z-index: 10041;
            padding: 5px 9px; border-radius: 7px;
            background: rgba(9, 16, 24, 0.85); border: 1px solid #2c4254;
            color: #cfe2f2; font: 700 12px/1 ui-monospace, monospace;
            pointer-events: none; font-variant-numeric: tabular-nums;
        }
        .mcfo-fps[hidden] { display: none !important; }
        /* In the Tickets card (drawFpsMeter): a cell of its grid, right-aligned, no longer floating. */
        .mcfo-fps.mcfo-fps--card { position: static; z-index: auto; justify-self: end; align-self: center; }
        .mcfo-fps[data-mcfo-tone="low"] { color: #ffb4a8; border-color: #6f4a4a; }
        .mcfo-fps[data-mcfo-tone="mid"] { color: #ffd479; }

        /* The level picker: five wide segments in one row, the chosen one described below. */
        .mcfo-perf__levels { display: grid; grid-template-columns: repeat(5, 1fr); }
        .mcfo-perf__levels button { padding: 8px 4px; font-size: 12.5px; }
        .mcfo-perf__top { padding: 12px 14px; display: flex; flex-direction: column; gap: 9px; }
        .mcfo-perf__text { font-size: 12px; color: #9ab0c0; min-height: 2.7em; }
        .mcfo-perf__levers .mcfo-set__item { border-top: 1px solid #192a38; }
        .mcfo-set__row--choice { cursor: default; }

        /* === SETTINGS WINDOW ===
           Stays nearly opaque whatever the transparency is set to. It is dense text, and in
           3.7 it was hard to read over a busy board. It is also the window the transparency
           slider lives in, so the effect is watched on the other windows, not on this one.
           Deliberately no dimming of the screen: that would hide exactly that effect. */
        .mcfo-win--solid .mcfo-win__body,
        html[data-mcfo-glass="1"] .mcfo-win--solid .mcfo-win__body { background: rgba(9, 16, 24, 0.96); }
        html[data-mcfo-glass="1"] .mcfo-win--solid .mcfo-win__head { background: #0c1721; }

        .mcfo-set {
            position: absolute; inset: 0; overflow: auto;
            padding: 16px 18px 20px;
            color: #d7e2ea; font-size: 13px; line-height: 1.35;
        }
        .mcfo-set__section {
            display: flex; align-items: center; gap: 10px;
            margin: 20px 2px 8px;
            font-size: 11px; font-weight: 800; letter-spacing: 0.09em; text-transform: uppercase;
            color: #7f9ab0;
        }
        .mcfo-set__section:first-child { margin-top: 2px; }
        /* A hairline after the title, so the sections read as chapters without boxes around
           their headings. */
        .mcfo-set__section::after { content: ''; flex: 1; height: 1px; background: #1c2d3b; }
        .mcfo-set__sub-title { margin: 12px 2px 6px; font-size: 12px; font-weight: 700; color: #9ab0c0; }

        .mcfo-set__card {
            border: 1px solid #1f3242; border-radius: 10px;
            background: linear-gradient(180deg, rgba(22, 38, 52, 0.55), rgba(14, 25, 35, 0.55));
            overflow: hidden;
        }
        .mcfo-set__item + .mcfo-set__item { border-top: 1px solid #192a38; }

        .mcfo-set__row {
            display: flex; align-items: center; gap: 14px;
            padding: 11px 14px;
            cursor: pointer; user-select: none;
            transition: background 120ms ease;
        }
        .mcfo-set__row:hover { background: rgba(77, 126, 166, 0.08); }
        .mcfo-set__text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
        .mcfo-set__label { font-weight: 700; color: #e6f0f7; font-size: 13.5px; }
        .mcfo-set__hint { font-size: 12px; color: #8da2b7; }
        .mcfo-set__hint--wide { flex: 1; min-width: 0; }

        /* The switch. A real checkbox, only visually hidden, so keyboard and screen readers keep
           working; the pill next to it is drawn from its :checked state. Same green as the
           cosmetics switch in the chat script, so both scripts speak one language. */
        .mcfo-switch__input { position: absolute; opacity: 0; width: 1px; height: 1px; pointer-events: none; }
        .mcfo-switch {
            flex: none; position: relative;
            width: 40px; height: 22px; border-radius: 11px;
            background: #26353f; box-shadow: inset 0 0 0 1px #3d5568;
            transition: background 160ms ease, box-shadow 160ms ease;
        }
        .mcfo-switch::after {
            content: ''; position: absolute; top: 3px; left: 3px;
            width: 16px; height: 16px; border-radius: 50%;
            background: #8ea6b8; box-shadow: 0 1px 3px rgba(0,0,0,0.5);
            transition: transform 160ms ease, background 160ms ease;
        }
        .mcfo-switch__input:checked + .mcfo-switch { background: #2f9e62; box-shadow: inset 0 0 0 1px #3fae72; }
        .mcfo-switch__input:checked + .mcfo-switch::after { transform: translateX(18px); background: #fff; }
        .mcfo-switch__input:focus-visible + .mcfo-switch { outline: 2px solid #4da6ff; outline-offset: 2px; }

        /* Sub-controls hang under their switch, indented to the text, and fade out with it. */
        .mcfo-set__sub {
            display: flex; align-items: center; gap: 12px;
            padding: 0 14px 12px;
            transition: opacity 160ms ease;
        }
        .mcfo-set__sub[data-off] { opacity: 0.35; pointer-events: none; }
        .mcfo-set__sublabel { font-size: 12px; font-weight: 700; color: #9ab0c0; white-space: nowrap; min-width: 82px; }
        .mcfo-set__range { flex: 1; min-width: 0; accent-color: #2f9e62; cursor: pointer; }
        .mcfo-set__val { min-width: 42px; text-align: right; font-weight: 800; color: #ffd479; font-variant-numeric: tabular-nums; }
        .mcfo-set__reset {
            flex: none; border: 1px solid #2c4254; border-radius: 6px; background: transparent;
            color: #8da2b7; font: inherit; font-size: 12px; line-height: 1; padding: 4px 7px; cursor: pointer;
        }
        .mcfo-set__reset:hover { color: #fff; border-color: #4d7ea6; background: #16283a; }
        .mcfo-set__reset[disabled] { visibility: hidden; }

        /* Gear and music note in one cell of the header grid (11f). */
        .mcfo-hdr { display: flex; align-items: center; gap: 6px; }
        .mcfo-note {
            width: 32px; height: 32px; padding: 0; box-sizing: border-box;
            display: grid; place-items: center;
            border: 1px solid #355066; border-radius: 8px; background: #111822; color: #d8e3ef; cursor: pointer;
        }
        .mcfo-note:hover { border-color: #4d7ea6; background: #16283a; }
        .mcfo-note[aria-pressed="true"] { border-color: #3fae72; color: #8ee0b0; }
        .mcfo-note svg { width: 17px; height: 17px; display: block; }

        /* The player bar on the page (11f). Under the windows, over the game. */
        .mcfo-bar {
            position: fixed; z-index: 10035; width: 268px; box-sizing: border-box;
            display: flex; flex-direction: column; gap: 5px;
            padding: 8px 10px 0; border: 1px solid #2c4254; border-radius: 10px;
            background: rgba(12, 22, 32, 0.94); box-shadow: 0 8px 22px rgba(0,0,0,0.45);
            font: 500 12px/1.3 system-ui, sans-serif; color: #e6f0f7;
            cursor: grab; user-select: none; overflow: hidden;
        }
        .mcfo-bar[data-drag] { cursor: grabbing; }
        .mcfo-bar__top { display: flex; align-items: center; gap: 6px; }
        .mcfo-bar__title {
            flex: 1; min-width: 0;
            color: #e6f0f7; font: 800 12.5px/1.25 system-ui, sans-serif;
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .mcfo-bar__sub {
            font-size: 11px; color: #8da2b7; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
            min-height: 14px;
        }
        .mcfo-bar__sub[data-wait] { color: #e0b84a; }
        .mcfo-bar__row { display: flex; align-items: center; gap: 5px; padding-bottom: 7px; }
        .mcfo-barbtn {
            flex: none; width: 26px; height: 26px; padding: 0; display: grid; place-items: center; cursor: pointer;
            border: 1px solid #2c4254; border-radius: 7px; background: #111f2b; color: #cfe2f0;
        }
        .mcfo-barbtn:hover { border-color: #4d7ea6; background: #16283a; color: #fff; }
        .mcfo-barbtn[disabled] { opacity: 0.35; cursor: default; }
        .mcfo-barbtn[aria-pressed="true"] { background: #2f9e62; border-color: #3fae72; color: #fff; }
        .mcfo-barbtn svg { width: 13px; height: 13px; fill: currentColor; }
        .mcfo-bar__x { width: 22px; height: 22px; border-color: transparent; background: transparent; color: #7f97a9; }
        .mcfo-bar__x svg { width: 11px; height: 11px; fill: none; }
        .mcfo-bar__vol { flex: 1; min-width: 0; accent-color: #2f9e62; cursor: pointer; }
        .mcfo-bar__line {
            position: relative; height: 4px; margin: 0 -10px; background: #16283a; cursor: pointer;
        }
        .mcfo-bar__line > span { position: absolute; left: 0; top: 0; height: 100%; }
        .mcfo-bar__buf { background: #33607f; }
        .mcfo-bar__at { background: #2f9e62; }

        /* The music player on the Sound page (11e). */
        .mcfo-mus { display: flex; flex-direction: column; gap: 9px; padding: 2px 14px 12px; }
        .mcfo-mus__now { display: flex; align-items: baseline; gap: 10px; min-width: 0; }
        .mcfo-mus__title { flex: 1; min-width: 0; font-weight: 800; font-size: 13.5px; color: #e6f0f7;
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .mcfo-mus__albumline { flex: none; max-width: 45%; font-size: 12px; color: #8da2b7;
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .mcfo-mus__row { display: flex; align-items: center; gap: 8px; }
        .mcfo-mus__btn {
            flex: none; width: 30px; height: 30px; padding: 0; display: grid; place-items: center; cursor: pointer;
            border: 1px solid #2c4254; border-radius: 8px; background: #111f2b; color: #cfe2f0;
        }
        .mcfo-mus__btn:hover { border-color: #4d7ea6; background: #16283a; color: #fff; }
        .mcfo-mus__btn[disabled] { opacity: 0.35; cursor: default; }
        .mcfo-mus__btn[aria-pressed="true"] { background: #2f9e62; border-color: #3fae72; color: #fff; }
        .mcfo-mus__btn--play { width: 36px; height: 36px; }
        .mcfo-mus__btn svg { width: 15px; height: 15px; fill: currentColor; }
        .mcfo-mus__btn--play svg { width: 18px; height: 18px; }
        .mcfo-mus__count { margin-left: auto; font-size: 12px; color: #8da2b7; white-space: nowrap; }
        .mcfo-mus__time { flex: none; min-width: 38px; font-size: 11.5px; color: #9ab0c0;
            font-variant-numeric: tabular-nums; text-align: center; }
        .mcfo-mus__seek { flex: 1; min-width: 0; accent-color: #2f9e62; cursor: pointer; }
        .mcfo-mus__seek[disabled] { opacity: 0.35; cursor: default; }
        /* How much of the track is loaded: the reason a WAV of 40 MB stutters is worth showing. */
        .mcfo-mus__buf { height: 3px; border-radius: 2px; background: #16283a; margin: -4px 40px 0; overflow: hidden; }
        .mcfo-mus__buf > span { display: block; height: 100%; background: #33607f; transition: width 300ms linear; }
        .mcfo-mus__buf[data-thin] > span { background: #c08a2e; }
        .mcfo-mus__search {
            flex: 1; min-width: 0; border: 1px solid #2c4254; border-radius: 6px;
            background: #0c1620; color: #e6f0f7; font: inherit; font-size: 12px; padding: 5px 8px;
        }
        .mcfo-mus__search:focus { outline: none; border-color: #4d7ea6; }
        .mcfo-mus__list {
            max-height: 250px; overflow-y: auto; overscroll-behavior: contain;
            border: 1px solid #192a38; border-radius: 8px; background: #0c1620;
        }
        .mcfo-mus__head { display: flex; align-items: center; gap: 8px; padding: 6px 10px; border-top: 1px solid #14212d; }
        .mcfo-mus__list > .mcfo-mus__head:first-child { border-top: 0; }
        .mcfo-mus__fold {
            flex: 1; min-width: 0; text-align: left; border: 0; background: transparent; cursor: pointer;
            color: #cfe2f0; font: inherit; font-size: 12.5px; font-weight: 700; padding: 0;
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .mcfo-mus__fold::before { content: '\\203a '; display: inline-block; width: 12px; color: #6d8699; transition: transform 140ms ease; }
        .mcfo-mus__head[data-open] .mcfo-mus__fold::before { transform: rotate(90deg); }
        .mcfo-mus__fold:hover { color: #fff; }
        .mcfo-mus__num { flex: none; font-size: 11px; color: #7f97a9; font-variant-numeric: tabular-nums; }
        .mcfo-mus__tick { flex: none; accent-color: #2f9e62; cursor: pointer; margin: 0; }
        .mcfo-mus__songs { padding: 0 0 4px; }
        .mcfo-mus__song { display: flex; align-items: center; gap: 8px; padding: 2px 10px 2px 22px; }
        .mcfo-mus__song:hover { background: rgba(77, 126, 166, 0.09); }
        .mcfo-mus__song[data-current] .mcfo-mus__songname { color: #ffd479; font-weight: 700; }
        .mcfo-mus__song[data-playing] .mcfo-mus__songname::before { content: '\\25b8\\00a0'; }
        .mcfo-mus__songname {
            flex: 1; min-width: 0; text-align: left; border: 0; background: transparent; cursor: pointer;
            color: #b9cddd; font: inherit; font-size: 12px; padding: 3px 0;
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .mcfo-mus__songname:hover { color: #fff; }
        .mcfo-mus__note { font-size: 12px; color: #9ab0c0; }

        .mcfo-seg { display: inline-flex; border: 1px solid #2c4254; border-radius: 8px; overflow: hidden; }
        .mcfo-seg button {
            border: 0; background: #111f2b; color: #a9bfce;
            font: inherit; font-size: 12px; font-weight: 700; line-height: 1; padding: 6px 13px; cursor: pointer;
        }
        .mcfo-seg button + button { border-left: 1px solid #2c4254; }
        .mcfo-seg button[aria-pressed="true"] { background: #1f5a3c; color: #fff; }
        .mcfo-seg button:hover:not([aria-pressed="true"]) { background: #16283a; color: #fff; }

        /* The footer buttons as a two-column grid of compact switches: six rows of full width
           would make the footer section longer than everything above it. */
        .mcfo-set__grid { display: grid; grid-template-columns: 1fr 1fr; }
        .mcfo-set__grid .mcfo-set__item { border-top: 1px solid #192a38; }
        .mcfo-set__grid .mcfo-set__item:nth-child(-n+2) { border-top: 0; }
        .mcfo-set__grid .mcfo-set__item:nth-child(odd) { border-right: 1px solid #192a38; }
        .mcfo-set__grid .mcfo-set__row { padding: 9px 12px; }
        .mcfo-set__grid .mcfo-set__hint { font-size: 11px; }

        .mcfo-set__foot {
            display: flex; align-items: center; justify-content: space-between; gap: 12px;
            margin-top: 18px; padding: 0 2px;
            font-size: 12px; color: #6b8299;
        }
        .mcfo-set__foot button {
            border: 1px solid #5a3a3a; border-radius: 7px; background: transparent; color: #e7b3b3;
            font: inherit; font-size: 12px; font-weight: 700; padding: 6px 11px; cursor: pointer;
        }
        .mcfo-set__foot button:hover { background: #2a1b1e; border-color: #a06a6a; color: #fff; }

        /* Settings overview: one tile per page, with what it holds and how much of it is on.
           The rules hang on .mcfo-set on purpose — a bare class would lose against any
           "container button" rule (the 3.11 lesson with .mcfo-menu button). */
        .mcfo-set__intro { margin: 2px 2px 14px; font-size: 12.5px; color: #8da2b7; }
        .mcfo-set__tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 10px; }
        .mcfo-set .mcfo-set__tile {
            position: relative; display: flex; flex-direction: column; gap: 4px;
            padding: 13px 34px 12px 14px; text-align: left;
            border: 1px solid #1f3242; border-radius: 10px;
            background: linear-gradient(180deg, rgba(22, 38, 52, 0.55), rgba(14, 25, 35, 0.55));
            color: #d7e2ea; font: inherit; cursor: pointer;
            transition: border-color 120ms ease, background 120ms ease;
        }
        .mcfo-set .mcfo-set__tile:hover { border-color: #4d7ea6; background: linear-gradient(180deg, rgba(28, 48, 66, 0.72), rgba(16, 29, 41, 0.72)); }
        .mcfo-set .mcfo-set__tile:focus-visible { outline: 2px solid #4da6ff; outline-offset: 2px; }
        .mcfo-set__tile-title { font-weight: 800; font-size: 14px; color: #e6f0f7; }
        .mcfo-set__tile-blurb { font-size: 12px; color: #8da2b7; }
        .mcfo-set__tile-state { margin-top: 5px; font-size: 11px; font-weight: 700; color: #7fc79f; }
        .mcfo-set__tile-state[data-none] { color: #6b8299; }
        .mcfo-set__tile-arrow {
            position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
            font-size: 22px; line-height: 1; color: #4d6a82; transition: transform 120ms ease, color 120ms ease;
        }
        .mcfo-set .mcfo-set__tile:hover .mcfo-set__tile-arrow { color: #cfe2f2; transform: translate(3px, -50%); }
        .mcfo-set__crumb { display: flex; align-items: center; gap: 12px; margin: 0 0 16px; }
        .mcfo-set .mcfo-set__back {
            border: 1px solid #2c4254; border-radius: 7px; background: #111f2b; color: #cfe2f2;
            font: inherit; font-size: 12px; font-weight: 700; line-height: 1; padding: 7px 11px; cursor: pointer;
        }
        .mcfo-set .mcfo-set__back:hover { background: #16283a; border-color: #4d7ea6; color: #fff; }
        .mcfo-set__crumb-title { font-size: 16px; font-weight: 800; color: #e6f0f7; }
        /* A switch that needs another one (needs:) is greyed while that one is off. */
        .mcfo-set__item[data-off] { opacity: 0.4; pointer-events: none; }
        .mcfo-set__notice {
            margin: 0 0 10px; padding: 10px 12px; border-radius: 9px;
            border: 1px solid #6f5a28; background: rgba(60, 45, 12, 0.35); color: #ffe3a3; font-size: 12px;
        }

        /* === ON THE THRONE (section 7c) === the beverage picker in the settings, and the note
           on screen after the crown was taken. Button rules hang on .mcfo-set (3.11 lesson). */
        .mcfo-throne { padding: 12px 14px 13px; margin-top: 10px; transition: opacity 160ms ease; }
        .mcfo-throne[data-off] { opacity: 0.4; pointer-events: none; }
        .mcfo-throne__head { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; margin-bottom: 11px; }
        .mcfo-throne__title { font-weight: 700; color: #e6f0f7; font-size: 13.5px; }
        .mcfo-throne__quick { display: flex; gap: 6px; flex-wrap: wrap; }
        .mcfo-set .mcfo-throne__quick button {
            border: 1px solid #2c4254; border-radius: 7px; background: #111f2b; color: #cfe2f2;
            font: inherit; font-size: 12px; font-weight: 700; line-height: 1; padding: 6px 10px; cursor: pointer;
        }
        .mcfo-set .mcfo-throne__quick button:hover { background: #16283a; border-color: #4d7ea6; color: #fff; }
        .mcfo-throne__grid { display: grid; grid-template-columns: 58px repeat(3, minmax(0, 1fr)); gap: 6px 8px; align-items: center; }
        .mcfo-throne__col { font-size: 11px; font-weight: 700; color: #9ab0c0; text-align: center; text-transform: uppercase; letter-spacing: 0.04em; }
        .mcfo-throne__name { font-weight: 800; font-size: 13px; }
        .mcfo-throne__cell { display: flex; gap: 5px; min-width: 0; }
        .mcfo-set .mcfo-throne__pick {
            flex: 1 1 0; min-width: 0; display: inline-flex; align-items: center; justify-content: center; gap: 5px;
            border: 1px solid #2c4254; border-radius: 7px; background: #0f1b26; color: #8da2b7;
            font: inherit; font-size: 12px; font-weight: 700; line-height: 1; padding: 7px 4px; cursor: pointer;
            font-variant-numeric: tabular-nums; white-space: nowrap;
        }
        .mcfo-set .mcfo-throne__pick:hover { border-color: #4d7ea6; color: #fff; }
        .mcfo-set .mcfo-throne__pick[data-cur="gold"][aria-pressed="true"] { background: #4a3a0e; border-color: #e0b84a; color: #ffe3a3; }
        .mcfo-set .mcfo-throne__pick[data-cur="diamonds"][aria-pressed="true"] { background: #0f3a4a; border-color: #5fd0f0; color: #c8f2ff; }
        .mcfo-throne__coin { flex: none; width: 9px; height: 9px; border-radius: 50%; background: #f2c14e; box-shadow: inset 0 0 0 1px #8a6512; }
        .mcfo-throne__gem { flex: none; width: 7px; height: 7px; transform: rotate(45deg); background: #6fdcff; box-shadow: inset 0 0 0 1px #1d6f8a; }
        .mcfo-throne__sum { margin-top: 12px; font-size: 12px; color: #8da2b7; }
        .mcfo-throne__sum b { color: #ffd479; }
        .mcfo-throne-note {
            position: fixed; left: 50%; bottom: 96px; transform: translateX(-50%); z-index: 2147483000;
            max-width: min(560px, 92vw); padding: 10px 14px; border-radius: 10px;
            border: 1px solid #e0b84a; background: rgba(20, 16, 6, 0.94); color: #ffe9b8;
            font: 13px/1.45 system-ui, sans-serif; box-shadow: 0 8px 28px rgba(0, 0, 0, 0.5); cursor: pointer;
        }
        .mcfo-throne-note b { display: block; color: #ffd479; margin-bottom: 3px; }

        /* === ATTACK WHEN FREE (section 7b) ===
           The game's button is hidden, not removed — ours forwards the click to it. Ours carries
           the game's own class, so it looks the same and takes the same place in the tray grid;
           it has no data-action, so the game's click handler never mistakes it for its own. */
        html[data-mcfo-attack="1"] .mcf-king-action-content [data-action="king-attack"] { display: none !important; }
        .mcfo-attack { cursor: pointer; }
        .mcfo-attack:disabled { cursor: not-allowed; }
        .mcfo-attack[data-mcfo-state="wait"] { background: #3a2a0e !important; border-color: #e0b84a !important; color: #ffe3a3 !important; }
        .mcfo-attack[data-mcfo-state="warn"] { background: #3a1616 !important; border-color: #c46a6a !important; color: #ffd0d0 !important; }

        /* === UNBID === right of the chips, the counterpart of Rebellion on the left.
           Calm by default, green when the game confirmed. */
        .mcfo-unbid {
            align-self: center; min-width: 76px;
            padding: 8px 12px; min-height: 40px;
            border: 1px solid #4a5a6f; border-radius: 7px;
            background: #141b24; color: #cfdcea;
            font-family: inherit; font-weight: 800; font-size: 12px; line-height: 1; cursor: pointer; white-space: nowrap;
            transition: background 120ms ease, border-color 120ms ease, color 120ms ease;
        }
        .mcfo-unbid:hover { background: #1b2633; border-color: #6d86a0; }
        .mcfo-unbid[data-mcfo-state="sent"]  { opacity: 0.75; cursor: progress; }
        .mcfo-unbid[data-mcfo-state="done"]  { background: #10291c; border-color: #3fae72; color: #d9ffe8; }
        .mcfo-unbid[data-mcfo-state="none"]  { border-color: #6f4a4a; color: #ffc9c9; }

        /* === AUTOBID === right of Unbid. The colour tells what it is doing at a glance: grey off,
           green bidding, amber holding back (King, risk tile open, another tab), red when
           something needs a look. The words are in its tooltip and in the menu. */
        .mcfo-autobid {
            align-self: center; min-width: 84px;
            padding: 8px 12px; min-height: 40px;
            border: 1px solid #4a5a6f; border-radius: 7px;
            background: #141b24; color: #cfdcea;
            font-family: inherit; font-weight: 800; font-size: 12px; line-height: 1; cursor: pointer; white-space: nowrap;
            transition: background 120ms ease, border-color 120ms ease, color 120ms ease;
        }
        .mcfo-autobid:hover { background: #1b2633; border-color: #6d86a0; }
        .mcfo-autobid[data-mcfo-tone="on"]    { background: #10291c; border-color: #3fae72; color: #d9ffe8; }
        .mcfo-autobid[data-mcfo-tone="hold"]  { background: #2c2310; border-color: #c9a13f; color: #ffe8b0; }
        .mcfo-autobid[data-mcfo-tone="alert"] { background: #2a1416; border-color: #c46a6a; color: #ffd0d0; }
        .mcfo-menu--auto { width: 310px; max-width: 92vw; padding: 10px 12px 12px; }
        .mcfo-auto__head { display: flex; align-items: baseline; justify-content: space-between; gap: 10px;
                           padding-bottom: 8px; border-bottom: 1px solid #243443; margin-bottom: 2px; }
        .mcfo-auto__title { font-weight: 800; font-size: 14px; letter-spacing: 0.05em; text-transform: uppercase; }
        .mcfo-auto__sub { font-size: 11px; color: #8da2b7; }
        .mcfo-auto__row { position: relative; display: flex; align-items: center; justify-content: space-between; gap: 12px;
                          padding: 9px 2px; cursor: pointer; }
        .mcfo-auto__row + .mcfo-auto__row { border-top: 1px solid #16232f; }
        .mcfo-auto__label { font-weight: 700; font-size: 13px; }
        .mcfo-auto__amount { width: 68px; padding: 5px 7px; border: 1px solid #3d5568; border-radius: 6px; background: #0e1821; color: #e6f0f7;
                             font: inherit; font-weight: 800; text-align: right; }
        .mcfo-auto__amount:focus { outline: 2px solid #4da6ff; outline-offset: 1px; }
        .mcfo-auto__hint { font-size: 11.5px; line-height: 1.35; color: #8da2b7; padding: 0 2px 4px; }
        .mcfo-auto__hint[data-tone="warn"] { color: #ffb4a8; }
        .mcfo-auto__box { margin-top: 6px; padding: 7px 9px; border-radius: 7px; border: 1px solid #243443; background: #0e1821;
                          font-size: 12px; line-height: 1.35; }
        .mcfo-auto__box[hidden] { display: none; }
        .mcfo-auto__box[data-tone="on"]    { border-color: #2f7a52; color: #c9f5dc; }
        .mcfo-auto__box[data-tone="hold"]  { border-color: #8a6d2a; color: #ffe8b0; }
        .mcfo-auto__box[data-tone="alert"] { border-color: #8a4a4a; color: #ffd0d0; }
        .mcfo-auto__last { margin-top: 6px; font-size: 11.5px; color: #a9bac8; min-height: 14px; }
        .mcfo-auto__foot { margin-top: 8px; font-size: 11px; line-height: 1.35; color: #7f93a6; }

        /* === ENHANCED CHAT (opt-in, section 9f) ===
           Everything keyed on an attribute of <html> and limited to the real message list, so
           switching it off gives back the game's chat exactly. */
        html[data-mcfo-chatplus="1"] :is([data-role="chat-messages"], .mcf-chat__messages) article.mcf-chat__message[data-mcf-filter] { display: none !important; }
        html[data-mcfo-chatplus="1"] :is([data-role="chat-messages"], .mcf-chat__messages) article.mcf-chat__message[data-mcf-group] {
            padding: 6px 10px !important; margin-bottom: 8px !important; border-radius: 6px !important; line-height: 1.4 !important;
        }
        html[data-mcfo-chatplus="1"] :is([data-role="chat-messages"], .mcf-chat__messages) article.mcf-chat__message[data-mcf-group="mid"] .mcf-chat__meta,
        html[data-mcfo-chatplus="1"] :is([data-role="chat-messages"], .mcf-chat__messages) article.mcf-chat__message[data-mcf-group="end"] .mcf-chat__meta { display: none !important; }
        html[data-mcfo-chatplus="1"] :is([data-role="chat-messages"], .mcf-chat__messages) article.mcf-chat__message[data-mcf-group="start"] {
            border-bottom-left-radius: 0 !important; border-bottom-right-radius: 0 !important; margin-bottom: 0 !important; padding-bottom: 4px !important;
        }
        html[data-mcfo-chatplus="1"] :is([data-role="chat-messages"], .mcf-chat__messages) article.mcf-chat__message[data-mcf-group="mid"] {
            border-radius: 0 !important; margin-bottom: 0 !important; padding-top: 4px !important; padding-bottom: 4px !important;
        }
        html[data-mcfo-chatplus="1"] :is([data-role="chat-messages"], .mcf-chat__messages) article.mcf-chat__message[data-mcf-group="end"] {
            border-top-left-radius: 0 !important; border-top-right-radius: 0 !important; padding-top: 4px !important;
        }
        /* The game's cosmetics button said "Cosmetics on/off" in words — the widest thing in the
           chat header. Since 6.16.1 it is a symbol the size of its neighbours: sparkles, struck
           through while off. The state is in its aria-pressed; only the look hangs on that. The
           button stays the game's own: click and text are still the game's, the text just is not
           shown (screen readers still read it, and it comes back as the tooltip). */
        .mcf-chat__cosmetics-toggle {
            position: relative; display: grid !important; place-items: center; box-sizing: border-box;
            width: 30px !important; min-width: 30px !important; height: 30px !important; min-height: 30px !important;
            padding: 0 !important; font-size: 0 !important; letter-spacing: 0 !important; line-height: 0 !important;
            overflow: hidden; cursor: pointer; transition: background 0.2s, border-color 0.2s, color 0.2s;
        }
        .mcf-chat__cosmetics-toggle::after {
            content: ''; width: 17px; height: 17px; background: currentColor; opacity: 0.5;
            -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M10 2l1.8 5.2L17 9l-5.2 1.8L10 16l-1.8-5.2L3 9l5.2-1.8z'/%3E%3Cpath d='M18 13l.9 2.1L21 16l-2.1.9L18 19l-.9-2.1L15 16l2.1-.9z'/%3E%3Cpath d='M18 2.5l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6z'/%3E%3C/svg%3E") center / contain no-repeat;
                    mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M10 2l1.8 5.2L17 9l-5.2 1.8L10 16l-1.8-5.2L3 9l5.2-1.8z'/%3E%3Cpath d='M18 13l.9 2.1L21 16l-2.1.9L18 19l-.9-2.1L15 16l2.1-.9z'/%3E%3Cpath d='M18 2.5l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6z'/%3E%3C/svg%3E") center / contain no-repeat;
        }
        .mcf-chat__cosmetics-toggle[aria-pressed="true"]::after { opacity: 1; }
        .mcf-chat__cosmetics-toggle:not([aria-pressed="true"])::before {
            content: ''; position: absolute; left: 50%; top: 50%; width: 22px; height: 2px; border-radius: 1px;
            background: currentColor; opacity: 0.85; transform: translate(-50%, -50%) rotate(-45deg);
        }
        /* In colour (setting): green while on. */
        html[data-mcfo-chatcos="1"] .mcf-chat__cosmetics-toggle[aria-pressed="true"] {
            background: #10291c !important; border-color: #3fae72 !important; color: #7dffb4 !important;
        }
        .mcf-chat__cosmetics-toggle:disabled { opacity: 0.5; cursor: default; }

        /* === THEMES (settings page; the engine is section 3b) ===
           Scoped to .mcfo-theme: generic button rules of the settings window would otherwise
           win over a bare class, as they did for the rebellion tiles in 3.10. */
        .mcfo-theme__grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 8px; }
        .mcfo-theme .mcfo-theme__pick {
            display: grid; gap: 5px; padding: 9px 10px; text-align: left;
            border: 1px solid #2c4254; border-radius: 9px; background: #0e1821; color: #d7e2ea;
            font: inherit; cursor: pointer; transition: border-color 120ms ease, background 120ms ease;
        }
        .mcfo-theme .mcfo-theme__pick:hover { border-color: #4d7ea6; }
        .mcfo-theme .mcfo-theme__pick[aria-pressed="true"] { border-color: #4d7ea6; background: #122232; box-shadow: inset 0 0 0 1px #4d7ea6; }
        .mcfo-theme__swatches { display: flex; height: 20px; border-radius: 5px; overflow: hidden; box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08); }
        .mcfo-theme__swatches span { flex: 1; }
        .mcfo-theme__name { font-weight: 800; font-size: 13px; }
        .mcfo-theme__note { font-size: 11px; color: #8da2b7; }
        .mcfo-theme__custom { display: grid; gap: 10px; margin-top: 12px; padding-top: 10px; border-top: 1px solid #1c2c3a; }
        .mcfo-theme__slider { display: grid; grid-template-columns: 76px 1fr 46px; gap: 10px; align-items: center; font-size: 12.5px; }
        .mcfo-theme__slider output { text-align: right; font-variant-numeric: tabular-nums; color: #9ab0c0; }
        .mcfo-theme .mcfo-theme__range { width: 100%; margin: 0; accent-color: #4d7ea6; }
        .mcfo-theme .mcfo-theme__range--hue { -webkit-appearance: none; appearance: none; height: 10px; border-radius: 5px; }
        .mcfo-theme .mcfo-theme__range--hue::-webkit-slider-thumb { -webkit-appearance: none; width: 16px; height: 16px; border-radius: 50%; background: #ffffff; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.6); }
        .mcfo-theme .mcfo-theme__range--hue::-moz-range-thumb { width: 16px; height: 16px; border: 0; border-radius: 50%; background: #ffffff; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.6); }
        .mcfo-theme .mcfo-theme__range--hue::-moz-range-track { background: transparent; }
        .mcfo-theme__foot { margin-top: 12px; font-size: 11.5px; color: #8da2b7; line-height: 1.4; }
        .mcfo-theme__group { margin: 16px 0 7px; font-size: 11px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: #8da2b7; }
        .mcfo-theme__group:first-child { margin-top: 0; }
        .mcfo-theme__stripe { display: block; height: 5px; margin-top: -2px; border-radius: 3px; }
        .mcfo-theme__preview { position: relative; display: block; height: 34px; border-radius: 5px; overflow: hidden;
                               box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.1); }
        .mcfo-theme__badge { position: absolute; right: 4px; top: 4px; padding: 1px 5px; border-radius: 4px; font-size: 9px; font-weight: 800;
                             letter-spacing: 0.1em; line-height: 1.4; background: rgba(0, 0, 0, 0.72); color: #ffe692; }
        .mcfo-theme__fx { display: grid; gap: 6px; margin-top: 10px; padding: 10px 0 2px; border-top: 1px solid #1c2c3a; }
        .mcfo-theme__cats { margin-top: 2px; }
        .mcfo-theme__catprev { display: flex; height: 30px; margin-bottom: 6px; border-radius: 5px; overflow: hidden;
                               box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.1); }
        .mcfo-theme__cathead { display: flex; align-items: center; gap: 12px; margin: 0 0 12px; }
        .mcfo-theme__hint { font-size: 11.5px; line-height: 1.4; color: #8da2b7; }
        .mcfo-theme__toggle { position: relative; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 4px 0; cursor: pointer; }
        .mcfo-theme__toggle-label { display: block; font-size: 12.5px; font-weight: 700; }
        .mcfo-theme__toggle small { display: block; margin-top: 2px; font-size: 11px; line-height: 1.35; color: #8da2b7; }
        .mcfo-theme__patgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(78px, 1fr)); gap: 6px; margin-top: 6px; }
        .mcfo-theme .mcfo-theme__pat {
            display: grid; gap: 4px; padding: 5px; text-align: center;
            border: 1px solid #2c4254; border-radius: 8px; background: #0e1821; color: #d7e2ea;
            font: inherit; font-size: 11px; cursor: pointer;
        }
        .mcfo-theme .mcfo-theme__pat:hover { border-color: #4d7ea6; }
        .mcfo-theme .mcfo-theme__pat[aria-pressed="true"] { border-color: #4d7ea6; box-shadow: inset 0 0 0 1px #4d7ea6; }
        .mcfo-theme__patsw { display: block; height: 30px; border-radius: 5px; box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.06); }
        .mcfo-theme__random { display: grid; gap: 8px; margin-bottom: 14px; padding-bottom: 12px; border-bottom: 1px solid #1c2c3a; }
        .mcfo-theme__rotate { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
        .mcfo-theme__rotate[data-off] { opacity: 0.45; }
        .mcfo-theme__rotate .mcfo-seg button:disabled { cursor: default; }
        .mcfo-theme .mcfo-theme__shuffle {
            justify-self: start; padding: 6px 12px; border: 1px solid #2c4254; border-radius: 7px;
            background: #0e1821; color: #d7e2ea; font: inherit; font-size: 12px; cursor: pointer;
        }
        .mcfo-theme .mcfo-theme__shuffle:hover { border-color: #4d7ea6; }

        /* === HOW TO, CHANGELOG, WHAT'S NEW (section 11b) === */
        .mcfo-doc { position: absolute; inset: 0; overflow: auto; padding: 14px 18px 18px; color: #d7e2ea; font-size: 13px; line-height: 1.45; }
        .mcfo-doc h3 { margin: 16px 0 6px; font-size: 11.5px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: #8da2b7; }
        .mcfo-doc h3:first-child { margin-top: 0; }
        .mcfo-doc ul { margin: 0; padding-left: 18px; display: grid; gap: 5px; }
        .mcfo-doc__intro { margin: 0 0 12px; color: #a9bac8; }
        .mcfo-doc__ver { display: flex; align-items: baseline; gap: 10px; margin: 16px 0 6px; }
        .mcfo-doc__ver:first-child, .mcfo-doc__intro + .mcfo-doc__ver { margin-top: 0; }
        .mcfo-doc__vnum { font-weight: 800; font-size: 14px; color: #e6f0f7; }
        .mcfo-doc__date { font-size: 11.5px; color: #8da2b7; }
        .mcfo-doc__foot { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 18px; padding-top: 12px; border-top: 1px solid #1c2c3a; }
        .mcfo-doc__check { display: flex; align-items: center; gap: 8px; margin-right: auto; font-size: 12.5px; cursor: pointer; }
        .mcfo-doc__check input { accent-color: #4d7ea6; width: 15px; height: 15px; margin: 0; }
        .mcfo-doc .mcfo-doc__btn { padding: 6px 12px; border: 1px solid #2c4254; border-radius: 7px; background: #0e1821; color: #d7e2ea; font: inherit; font-size: 12.5px; cursor: pointer; }
        .mcfo-doc .mcfo-doc__btn:hover { border-color: #4d7ea6; }
        .mcfo-doc .mcfo-doc__btn--main { background: #1b3a55; border-color: #4d7ea6; color: #ffffff; }
    `;
    GM_addStyle(BASE_CSS);

    // =========================================================================================
    // 3b. THEMES
    // =========================================================================================
    // A theme gives the whole page another colour, Material 3 style: one seed hue, and every
    // surface, border and grey text takes on that hue at its old lightness and chroma. The look
    // of the stock page comes from 97 blue-greys (185 uses across app.js, chatPane, kingPane and
    // kingBeverages, measured in OKLCH: chroma under 0.075, hue 170-275) plus ten cyan accents.
    // Those two families are what a theme moves. Whatever MEANS something keeps its colour: gold,
    // diamonds, red and green, the rarity palette (canonicalRarityPalette.js), the chips' art,
    // chat cosmetics — and the board itself.
    //
    // How, without rewriting the game: its colours are mostly inline styles, which only an
    // !important rule can beat. Every element with a themeable inline colour gets a token
    // (data-mcfo-t) that stands for one property and its ORIGINAL value, and one stylesheet holds
    // a rule per token with the mapped colour, scoped to html[data-mcfo-theme]. The game's styles
    // are never touched, so switching back is exact: the attribute goes, the rules stop matching.
    // The chat keeps its colours in chatPane.css instead; its rules are mirrored with mapped
    // values, cosmetic selectors left out. This script's own stylesheet goes through the same
    // mapping as a whole, and the pages in windows get the same treatment from the inside.
    const THEME_PROTECTED = new Set([
        // The rarity palette, all 35 of its colours. "Rare" is a blue, and would otherwise move.
        '#111013', '#131b14', '#1a341c', '#1c1a22', '#1c2633', '#1e3e68', '#20569d', '#214d24', '#241a2c',
        '#272330', '#321e1d', '#38753c', '#3d3021', '#3e1e58', '#3e384a', '#4d8b51', '#514a61', '#534351',
        '#578cd3', '#592285', '#5da4e1', '#662320', '#7c5422', '#8b43c4', '#8c7289', '#992824', '#a862e2',
        '#bc7824', '#c6a0c1', '#cf5f5b', '#d66a66', '#dfb581', '#e0d2de', '#e1b16b', '#e1d0df',
        // Diamonds (kingBeverages.js), cyan by nature.
        '#4db8dc', '#bcefff',
    ]);

    let theme = null;                     // { hue, tint, accent } — null is the stock look
    const themeMemo = new Map();          // colour as written -> mapped, for the current theme

    // ---- colour maths: sRGB <-> OKLCH (Björn Ottosson's OKLab) ----
    const toLin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    const fromLin = c => Math.round(255 * Math.max(0, Math.min(1, c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055)));
    function toOklch(r, g, b) {
        const R = toLin(r), G = toLin(g), B = toLin(b);
        const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
        const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
        const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
        const L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s;
        const A = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s;
        const B2 = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;
        return [L, Math.hypot(A, B2), (Math.atan2(B2, A) * 180 / Math.PI + 360) % 360];
    }
    // Chroma is eased off until the colour fits into sRGB, so a strong hue never clips into a
    // different one.
    function fromOklch(L, C, H) {
        const h = H * Math.PI / 180;
        for (let i = 0; i < 30; i++) {
            const A = C * Math.cos(h), B2 = C * Math.sin(h);
            const l = Math.pow(L + 0.3963377774 * A + 0.2158037573 * B2, 3);
            const m = Math.pow(L - 0.1055613458 * A - 0.0638541728 * B2, 3);
            const s = Math.pow(L - 0.0894841775 * A - 1.2914855480 * B2, 3);
            const R = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
            const G = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
            const B = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;
            if (R > -0.001 && R < 1.001 && G > -0.001 && G < 1.001 && B > -0.001 && B < 1.001) return [fromLin(R), fromLin(G), fromLin(B)];
            C *= 0.9;
        }
        const grey = fromLin(Math.pow(L, 3));
        return [grey, grey, grey];
    }

    // A colour as CSS writes it: #rgb, #rrggbb (also with alpha), rgb(), rgba(). The alpha of an
    // rgba() may be a var() — the glass tints are written that way — and is carried over as is.
    const COLOR_RE = /#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})(?![0-9a-z_-])|rgba?\((?:[^()]|\([^()]*\))*\)/gi;
    function parseColour(text) {
        if (text[0] === '#') {
            let h = text.slice(1).toLowerCase();
            if (h.length <= 4) h = h.replace(/./g, c => c + c);
            const n = parseInt(h.slice(0, 6), 16);
            return { r: n >> 16 & 255, g: n >> 8 & 255, b: n & 255, hex: '#' + h.slice(0, 6),
                     alpha: h.length === 8 ? (parseInt(h.slice(6), 16) / 255).toFixed(3) : null };
        }
        const m = /^rgba?\(\s*(\d+(?:\.\d+)?)\s*[,\s]\s*(\d+(?:\.\d+)?)\s*[,\s]\s*(\d+(?:\.\d+)?)\s*(?:[,/]\s*([^]*?))?\s*\)$/i.exec(text);
        if (!m) return null;
        const r = Math.round(+m[1]), g = Math.round(+m[2]), b = Math.round(+m[3]);
        return { r, g, b, hex: '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join(''),
                 alpha: m[4] !== undefined && m[4] !== '' ? m[4] : null };
    }

    // Which family a colour belongs to. Depends only on the colour, never on the theme.
    //
    // The near-blacks count too. The footer (#0c1012), the page ground (#090d0f) and a dozen more
    // surfaces are blue by a breath only — chroma 0.006-0.011 — and a first cut at 0.012 left them
    // out: the footer kept its colour under every theme (Luce, 14.09.). Dark and faintly blue is
    // a surface of the same family; near-white stays white, that is text.
    const THEME_DARK_L = 0.35;
    function colourFamily(c) {
        if (THEME_PROTECTED.has(c.hex)) return null;
        const [L, C, H] = toOklch(c.r, c.g, c.b);
        if (H < 170 || H > 275) return null;                    // every other hue
        if (C < 0.012 && !(L < THEME_DARK_L && C >= 0.004)) return null;   // plain greys and whites
        if (C < 0.075) return { L, C, kind: 'neutral' };
        if (C < 0.14)  return { L, C, kind: 'accent' };
        return null;                                            // vivid blues: rarity-like, left alone
    }

    // Dark surfaces carry too little chroma to show a hue at all, so they get a floor — as
    // Material 3 tints its surfaces. The tint multiplies it like any other, so Graphite stays grey.
    const THEME_DARK_MIN_C = 0.016;

    function mapColour(text, t) {
        const c = parseColour(text);
        const f = c && colourFamily(c);
        if (!f) return text;
        const base = f.kind === 'neutral' && f.L < THEME_DARK_L ? Math.max(f.C, THEME_DARK_MIN_C) : f.C;
        let { h, k } = f.kind === 'accent' ? t.accent : neutralRole(t, f.L);
        // The more colourful greys — buttons, lit borders, links — lean towards the accent: from
        // chroma 0.035, fully at 0.06. The game's buttons sit at 0.045-0.06 and so end up more
        // than half-way to all the way; surfaces (about 0.02) and plain borders (0.033) keep the
        // hue. Without this the accent had next to nothing to colour: the game has only ten true
        // accents, and Luce (14.09.) saw nothing change but the colour of the slider itself.
        if (f.kind === 'neutral' && f.C > 0.035) {
            const w = Math.min(1, (f.C - 0.035) / 0.025);
            const dh = ((t.accent.h - h + 540) % 360) - 180;
            h = (h + dh * w + 360) % 360;
            k += (t.accent.k - k) * w;
        }
        const [r, g, b] = fromOklch(f.L, base * k, h);
        return c.alpha === null ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${c.alpha})`;
    }

    function themeText(text) {
        if (!theme) return text;
        return String(text).replace(COLOR_RE, m => {
            let v = themeMemo.get(m);
            if (v === undefined) { v = mapColour(m, theme); themeMemo.set(m, v); }
            return v;
        });
    }

    // Whether a value holds anything a theme moves — the same for every theme.
    const themeableMemo = new Map();
    function isThemeable(text) {
        let v = themeableMemo.get(text);
        if (v === undefined) {
            v = (String(text).match(COLOR_RE) || []).some(m => { const c = parseColour(m); return !!(c && colourFamily(c)); });
            if (themeableMemo.size > 5000) themeableMemo.clear();
            themeableMemo.set(text, v);
        }
        return v;
    }

    // Which hue and strength a grey gets, by its lightness: surfaces are dark (about 0.2), lines
    // mid (borders, dim text, about 0.4), ink light (text, 0.75 and up). In between the roles
    // blend — hue along the shorter way round the circle — so two neighbouring greys never jump
    // to different colours.
    const THEME_ANCHORS = [0.22, 0.42, 0.75];
    function neutralRole(t, L) {
        const roles = [t.surface, t.line, t.ink];
        if (L <= THEME_ANCHORS[0]) return roles[0];
        if (L >= THEME_ANCHORS[2]) return roles[2];
        const i = L < THEME_ANCHORS[1] ? 0 : 1;
        const f = (L - THEME_ANCHORS[i]) / (THEME_ANCHORS[i + 1] - THEME_ANCHORS[i]);
        const a = roles[i], b = roles[i + 1];
        const dh = ((b.h - a.h + 540) % 360) - 180;
        return { h: (a.h + dh * f + 360) % 360, k: a.k + (b.k - a.k) * f };
    }

    const hueOf = seed => {
        if (typeof seed === 'number') return seed;
        const c = parseColour(seed);
        return toOklch(c.r, c.g, c.b)[2];
    };
    // The colour a pattern is drawn in, as "r, g, b": a theme's own tint, else its accent made
    // bright enough to show on a dark surface.
    const brightTint = h => fromOklch(0.78, 0.13, h).join(', ');
    const seedTint = seed => { const c = parseColour(seed); return `${c.r}, ${c.g}, ${c.b}`; };

    // One entry of THEMES in the form the engine works with (null = the stock look).
    function normTheme(t) {
        if (!t || t.id === 'original') return null;
        if (t.id === 'custom') {
            const k = settings.themeTint / 100, h = settings.themeHue, ha = settings.themeAccent;
            // With the gradient on, the band runs from the hue to the accent at full strength;
            // the wash is the same pair made dark.
            const grad = settings.themeGradient;
            const bright = x => `rgb(${fromOklch(0.72, 0.14, x).join(', ')})`;
            return { id: 'custom', surface: { h, k }, line: { h, k }, ink: { h, k }, accent: { h: ha, k: 1 },
                     stripe: grad ? [bright(h), bright(ha)] : null, flag: false, wash: grad,
                     decor: settings.themePattern === 'none' ? null : settings.themePattern, decorTint: brightTint(ha) };
        }
        const role = (spec, fallback) => (spec ? { h: hueOf(spec[0]), k: spec[1] } : fallback);
        const surface = role(t.s, { h: 245, k: 1 });
        const line = role(t.l, surface);
        const ink = role(t.i, { h: line.h, k: Math.min(line.k, 1.1) });
        const accent = role(t.a, { h: surface.h, k: 1 });
        return { id: t.id, surface, line, ink, accent, stripe: t.stripe || null, flag: !!t.flag,
                 wash: !!t.stripe && t.wash !== false, decor: t.decor || null,
                 ring: !!t.ring, skin: t.skin || null, decorTint: t.tint ? seedTint(t.tint) : brightTint(accent.h) };
    }

    const currentTheme = () => {
        const t = THEMES.find(x => x.id === settings.themeId);
        // A signature theme belongs to one account: signed in as someone else, the stock look.
        if (t && t.owner && accountName() && !themeVisible(t)) return null;
        return normTheme(t);
    };

    // What a theme looks like, for its tile in the settings: ground, card, border, text, accent.
    const THEME_SAMPLE = ['#0e151c', '#111c27', '#2f3f4e', '#8da2b7', '#4d7ea6'];
    function themeSwatches(t) {
        const p = normTheme(t);
        return THEME_SAMPLE.map(c => (p ? mapColour(c, p) : c));
    }

    // ---- flags, gradients and patterns ----
    // The band: the stripe colours at full strength, hard-edged for a flag.
    function stripeGradient(t, angle) {
        const cs = t.stripe;
        if (!t.flag) return `linear-gradient(${angle}, ${cs.join(', ')})`;
        const step = 100 / cs.length;
        return `linear-gradient(${angle}, ${cs.map((c, i) => `${c} ${(i * step).toFixed(2)}% ${((i + 1) * step).toFixed(2)}%`).join(', ')})`;
    }

    // The wash: the same colours made dark and quiet — lightness 0.26, chroma at most 0.075 — so
    // text on top stays as readable as on the stock surfaces. White, black and grey stripes take
    // the theme's surface hue instead of none.
    function washGradient(t, angle, alpha) {
        const stops = t.stripe.map(seed => {
            const c = parseColour(seed);
            let [, C, H] = toOklch(c.r, c.g, c.b);
            if (C < 0.03) { H = t.surface.h; C = 0.03; }
            const [r, g, b] = fromOklch(0.26, Math.min(C * 0.55, 0.075), H);
            return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        });
        return `linear-gradient(${angle}, ${stops.join(', ')})`;
    }

    // Static on purpose: an animated pattern over these surfaces would repaint them on every
    // frame, and the performance levels exist because paint is what this page is short of.
    // Each pattern is drawn in the theme's pattern colour c ("r, g, b") — so a Custom pattern
    // follows the accent slider. The presets pick one each; Custom offers them all.
    const THEME_PATTERNS = {
        glitter: { label: 'Glitter', layers: () => [
            ['radial-gradient(circle at 20% 30%, rgba(255, 255, 255, 0.55) 0 0.7px, transparent 1.5px)', '110px 80px'],
            ['radial-gradient(circle at 65% 70%, rgba(255, 214, 240, 0.5) 0 0.9px, transparent 1.8px)', '85px 65px'],
            ['radial-gradient(circle at 40% 85%, rgba(214, 228, 255, 0.45) 0 0.6px, transparent 1.3px)', '57px 47px'],
            ['radial-gradient(circle at 85% 15%, rgba(255, 255, 255, 0.35) 0 1.1px, transparent 2px)', '150px 120px'],
        ] },
        stripes: { label: 'Stripes', layers: c => [
            [`repeating-linear-gradient(135deg, rgba(${c}, 0.06) 0 10px, transparent 10px 22px)`, 'auto']] },
        hazard: { label: 'Hazard', layers: c => [
            [`repeating-linear-gradient(135deg, rgba(${c}, 0.12) 0 12px, transparent 12px 24px)`, 'auto']] },
        scanlines: { label: 'Scanlines', layers: () => [
            ['repeating-linear-gradient(0deg, rgba(0, 0, 0, 0.22) 0 1px, transparent 1px 3px)', 'auto']] },
        grid: { label: 'Grid', layers: c => [
            [`linear-gradient(rgba(${c}, 0.09) 1px, transparent 1px)`, '24px 24px'],
            [`linear-gradient(90deg, rgba(${c}, 0.09) 1px, transparent 1px)`, '24px 24px']] },
        blocks: { label: 'Blocks', layers: c => [
            [`linear-gradient(rgba(${c}, 0.08) 2px, transparent 2px)`, '18px 18px'],
            [`linear-gradient(90deg, rgba(${c}, 0.08) 2px, transparent 2px)`, '18px 18px']] },
        bricks: { label: 'Bricks', layers: () => [
            ['linear-gradient(0deg, rgba(0, 0, 0, 0.3) 2px, transparent 2px)', '32px 16px'],
            ['linear-gradient(90deg, rgba(0, 0, 0, 0.3) 2px, transparent 2px)', '32px 32px']] },
        dots: { label: 'Dots', layers: c => [
            [`radial-gradient(circle, rgba(${c}, 0.22) 0 1.6px, transparent 2.2px)`, '18px 18px']] },
        checker: { label: 'Checker', layers: c => [
            [`conic-gradient(rgba(${c}, 0.07) 25%, transparent 0 50%, rgba(${c}, 0.07) 0 75%, transparent 0)`, '28px 28px']] },
        pixels: { label: 'Pixels', layers: c => [
            [`conic-gradient(rgba(${c}, 0.06) 25%, transparent 0 50%, rgba(${c}, 0.06) 0 75%, transparent 0)`, '8px 8px'],
            ['conic-gradient(rgba(0, 0, 0, 0.12) 25%, transparent 0 50%, rgba(0, 0, 0, 0.12) 0 75%, transparent 0)', '24px 24px']] },
        triangles: { label: 'Triangles', layers: c => [
            [`conic-gradient(from 150deg at 50% 30%, rgba(${c}, 0.09) 0 60deg, transparent 60deg)`, '36px 32px']] },
    };

    // One surface, layers from the top: pattern, the flag band (top or bottom edge), the wash.
    // Everything !important: the game's surfaces carry their backgrounds inline.
    function surfaceLayers(t, { band = null, washAngle = '100deg', alpha = 0.6 } = {}) {
        const layers = [];
        const pattern = THEME_PATTERNS[t.decor];
        if (pattern) for (const [img, size] of pattern.layers(t.decorTint)) layers.push([img, size, '0 0', 'repeat']);
        if (band && t.stripe) {
            const px = t.ring ? 6 : t.flag ? 3 : 2;
            // A ring is a rim of metal, not a line: light along its upper edge, shadow along its lower.
            if (t.ring) layers.push(['linear-gradient(180deg, rgba(255, 246, 204, 0.65), rgba(255, 246, 204, 0) 40%, '
                + 'rgba(70, 35, 0, 0) 60%, rgba(70, 35, 0, 0.6))', `100% ${px}px`, band, 'no-repeat']);
            layers.push([stripeGradient(t, '90deg'), `100% ${px}px`, band, 'no-repeat']);
        }
        if (t.wash && t.stripe) layers.push([washGradient(t, washAngle, alpha), '100% 100%', '0 0', 'no-repeat']);
        if (!layers.length) return '';
        const col = n => layers.map(l => l[n]).join(', ');
        return `background-image: ${col(0)} !important; background-size: ${col(1)} !important; `
             + `background-position: ${col(2)} !important; background-repeat: ${col(3)} !important;`;
    }

    // Only for themes with a stripe or a pattern; the classic ones are colour alone.
    function themeDecorCss(t) {
        if (!t || (!t.stripe && !t.decor)) return '';
        const S = 'html[data-mcfo-theme]';
        const glass = 'calc(var(--mcfo-glass-a, 0.78) * 0.7)';
        const rules = [
            `${S} [data-role="top-status-region"] { ${surfaceLayers(t, { band: 'bottom' })} }`,
            `${S} [data-role="action-region"] { ${surfaceLayers(t, { band: 'top' })} }`,
            `${S} .mcf-chat { ${surfaceLayers(t, { washAngle: '170deg', alpha: 0.5 })} }`,
            // The ground between the boards (the game's shell) shows between and around them.
            `${S} [data-role="shell"] { ${surfaceLayers(t, { washAngle: '160deg', alpha: 0.45 })} }`,
            // The header (Chat, the room, Cosmetics and collapse) and the composer (message box and
            // Send) have solid colours of their own in the game's sheet, which covered the wash and
            // the pattern of the chat along the top and the bottom. Their dividing lines stay.
            surfaceLayers(t, { washAngle: '170deg', alpha: 0.5 })
                ? `${S} .mcf-chat .mcf-chat__header, ${S} .mcf-chat .mcf-chat__composer { background-color: transparent !important; background-image: none !important; }` : '',
            `${S} .mcfo-win { ${surfaceLayers(t, { washAngle: '135deg', alpha: glass })} }`,
            `${S} .mcfo-menu { ${surfaceLayers(t, { band: 'top', washAngle: '135deg', alpha: 0.55 })} }`,
        ];
        if (t.stripe) {
            rules.push(`${S} .mcfo-win__head { background-image: ${stripeGradient(t, '90deg')} !important; background-size: 100% ${t.ring ? 3 : 2}px !important;`
                     + ` background-position: bottom !important; background-repeat: no-repeat !important; }`);
        }
        return rules.filter(r => !/\{\s*\}/.test(r)).join('\n');
    }

    // The same inside a page in one of our windows: wash and pattern on its body.
    function frameDecorCss(t) {
        if (!t || (!t.stripe && !t.decor)) return '';
        const layers = surfaceLayers(t, { washAngle: '135deg', alpha: 'calc(var(--mcfo-glass-a, 0.78) * 0.7)' });
        return layers ? `\nhtml[data-mcfo-theme] body { ${layers} background-attachment: fixed !important; }` : '';
    }

    // Style elements of our own in the main page, after the base sheet so they win on equal
    // terms. Through GM_addStyle, like the base sheet, so a page policy cannot block them.
    function ownStyle(id) {
        let el = document.getElementById(id);
        if (el) return el;
        try { el = GM_addStyle('/* ' + id + ' */'); } catch (e) { el = null; }
        if (!el || !el.tagName) { el = document.createElement('style'); (document.head || document.documentElement).appendChild(el); }
        el.id = id;
        return el;
    }
    const themeOwnStyle = ownStyle('mcfo-theme-own');     // this script's CSS, mapped
    const themeRuleStyle = ownStyle('mcfo-theme-rules');  // token rules + mirrored game rules
    const themeDecorStyle = ownStyle('mcfo-theme-decor'); // flag bands, washes, patterns
    const themeAccentStyle = ownStyle('mcfo-theme-accent'); // switches and pressed buttons in the accent

    // ---- the game's inline colours: tokens ----
    const THEME_PROPS = ['background-color', 'background-image', 'border-top-color', 'border-right-color', 'border-bottom-color',
                         'border-left-color', 'color', 'box-shadow', 'text-shadow', 'outline-color', 'fill', 'stroke'];
    const themeTokens = new Map();        // "property|original value" -> token ('' = nothing to move)
    let themeTokenSeq = 0;
    let themeRulesStale = true;
    function themeToken(prop, value) {
        const key = prop + '|' + value;
        let id = themeTokens.get(key);
        if (id === undefined) {
            id = isThemeable(value) ? 't' + (themeTokenSeq++).toString(36) : '';
            themeTokens.set(key, id);
            if (id) themeRulesStale = true;
        }
        return id;
    }

    // Left alone, subtree and all: the board and anything drawn (svg, canvas), pictures, frames
    // (themed from the inside, see themeFrame), the chat messages with their cosmetics, the
    // chips' artwork, anything cosmetic, preview or rarity, and the few buttons of ours whose
    // colours carry meaning (beverages, rebellion tiers, extra chips) or show a theme (settings).
    const THEME_SKIP = [
        'svg', 'canvas', 'img', 'video', 'iframe',
        '[data-role="lane-stage"]', '.mcf-king-shared-renderer-stage',
        '[data-role="chat-messages"]', '.mcf-chat__messages',
        'button[data-bid-amount]', '[data-mcfo-bid]',
        '[class*="cosmetic" i]', '[class*="preview" i]', '[class*="rarity" i]',
        '.mcfo-drink', '.mcfo-bev__buy', '.mcfo-reb__tier', '.mcfo-theme',
        '.mcfo-skin',   // a Deluxe skin's scenery brings its own colours
    ].join(', ');

    function themeElement(el) {
        const st = el.style;
        let want = '';
        if (st && st.length) {
            for (const prop of THEME_PROPS) {
                const v = st.getPropertyValue(prop);
                if (!v || (v.indexOf('#') < 0 && v.indexOf('rgb') < 0)) continue;
                const id = themeToken(prop, v);
                if (id) want = want ? want + ' ' + id : id;
            }
        }
        if ((el.getAttribute('data-mcfo-t') || '') !== want) {
            if (want) el.setAttribute('data-mcfo-t', want); else el.removeAttribute('data-mcfo-t');
        }
    }

    function themeWalk(docOrEl) {
        if (!theme || !docOrEl) return;
        const start = docOrEl.nodeType === 9 ? docOrEl.body : docOrEl;
        if (!start || start.matches(THEME_SKIP)) return;
        const doc = start.ownerDocument;
        themeElement(start);
        // FILTER_REJECT (2) drops a whole subtree, so the board is never even visited.
        const walker = doc.createTreeWalker(start, 1, { acceptNode: n => (n.matches(THEME_SKIP) ? 2 : 1) });
        for (let n = walker.nextNode(); n; n = walker.nextNode()) themeElement(n);
    }

    // ---- the game's stylesheets: mirrored rules ----
    const THEME_SHEETS = /\/(chatPane|siteNavigation|shop|dailies|inventory)\.css(\?|$)/;
    const THEME_SKIP_RULE = /cosmetic|royal|panel--|gradient--|derivative--|username|text--|treatment|vip|private-visual|flourish|frame--|preview|rarity|swatch|crown/i;

    // "a, :is(b, c)" -> each part behind html[data-mcfo-theme]. One attribute more than the
    // original selector, so the copy wins whichever sheet loads last.
    function scopeSelector(sel) {
        const parts = [];
        let depth = 0, from = 0;
        for (let i = 0; i < sel.length; i++) {
            const ch = sel[i];
            if (ch === '(' || ch === '[') depth++;
            else if (ch === ')' || ch === ']') depth--;
            else if (ch === ',' && !depth) { parts.push(sel.slice(from, i)); from = i + 1; }
        }
        parts.push(sel.slice(from));
        return parts.map(p => {
            p = p.trim();
            return /^(html|:root)(?![\w-])/i.test(p) ? p.replace(/^(html|:root)/i, 'html[data-mcfo-theme]') : 'html[data-mcfo-theme] ' + p;
        }).join(', ');
    }

    // The plain name rule (".mcf-chat__sender { color }") carries no cosmetic word, so it is
    // mirrored — and the copy, one attribute more specific, beat every username style: those set
    // their colour and glow with a single class (".mcf-chat__username--soft_glow"), and the
    // theme's grey won (Luce, 14.09.). A styled name carries at least one mcf-chat__username-*
    // class (chatPane.js), so the copy now stops at those and paints plain names only.
    const guardNames = sel => sel.replace(/\.mcf-chat__sender(?![\w-])/g, '.mcf-chat__sender:not([class*="mcf-chat__username-"])');

    function mirrorRules(rules) {
        let out = '';
        for (const rule of Array.from(rules)) {
            if (rule.selectorText !== undefined && rule.style) {
                if (THEME_SKIP_RULE.test(rule.selectorText)) continue;
                const st = rule.style;
                let decl = '';
                for (let i = 0; i < st.length; i++) {
                    const prop = st[i], v = st.getPropertyValue(prop);
                    if (!v || !isThemeable(v)) continue;
                    decl += `${prop}: ${themeText(v)}${st.getPropertyPriority(prop) ? ' !important' : ''}; `;
                }
                if (decl) out += `${guardNames(scopeSelector(rule.selectorText))} { ${decl}}\n`;
            } else if (rule.cssRules && rule.media) {
                const inner = mirrorRules(rule.cssRules);
                if (inner) out += `@media ${rule.media.mediaText} {\n${inner}}\n`;
            }
        }
        return out;
    }

    function mirrorSheets(doc) {
        if (!theme) return '';
        let out = '';
        for (const sheet of Array.from(doc.styleSheets)) {
            if (!THEME_SHEETS.test(sheet.href || '')) continue;
            let rules;
            try { rules = sheet.cssRules; } catch (e) { continue; }   // not readable: left as it is
            out += mirrorRules(rules);
        }
        return out;
    }
    const themeSheetsSig = doc => Array.from(doc.styleSheets).map(s => s.href || '').filter(h => THEME_SHEETS.test(h)).join('|');

    // ---- putting it on the page ----
    let themeSig = null;
    let themeMirror = { sig: null, text: '' };

    function tokenRulesText() {
        let out = '';
        for (const [key, id] of themeTokens) {
            if (!id) continue;
            const i = key.indexOf('|');
            out += `html[data-mcfo-theme] [data-mcfo-t~="${id}"] { ${key.slice(0, i)}: ${themeText(key.slice(i + 1))} !important; }\n`;
        }
        return out;
    }

    function writeThemeRules() {
        themeRulesStale = false;
        const tokens = theme ? tokenRulesText() : '';
        themeRuleStyle.textContent = theme ? tokens + themeMirror.text : '';
        for (const w of windows.values()) if (w.frame) themeFrame(w.frame, tokens);
    }

    // A page in one of our windows (same origin): its own stylesheets mirrored, its inline
    // colours tokenised, the glass tint of framePanelMode mapped through a variable.
    function themeFrame(frame, tokens) {
        let doc;
        try { doc = frame.contentDocument; } catch (e) { return; }
        if (!doc || !doc.documentElement) return;
        const root = doc.documentElement;
        const style = doc.getElementById('mcfo-theme-rules');
        if (!theme) {
            root.removeAttribute('data-mcfo-theme');
            root.style.removeProperty('--mcfo-glass-rgb');
            if (style) style.textContent = '';
            return;
        }
        root.setAttribute('data-mcfo-theme', settings.themeId);
        const glass = parseColour(themeText('rgb(11, 18, 26)'));
        if (glass) root.style.setProperty('--mcfo-glass-rgb', `${glass.r}, ${glass.g}, ${glass.b}`);
        if (!doc.head || !doc.body) return;
        themeWalk(doc);
        let el = style;
        if (!el) { el = doc.createElement('style'); el.id = 'mcfo-theme-rules'; doc.head.appendChild(el); }
        el.textContent = (tokens === undefined || themeRulesStale ? tokenRulesText() : tokens) + mirrorSheets(doc) + frameDecorCss(theme) + skinFrameCss(theme);
        if (doc.body.hasAttribute('data-mcfo-theme-watch')) return;
        doc.body.setAttribute('data-mcfo-theme-watch', '1');
        let queued = false;
        new MutationObserver(() => {
            if (queued) return;
            queued = true;
            setTimeout(() => {
                queued = false;
                if (!theme) return;
                themeWalk(doc);
                if (themeRulesStale) writeThemeRules();
            }, 120);
        }).observe(doc.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['style'] });
    }

    // The parts of the main page that change on their own: reacted to within 60 ms, so a panel
    // that opens does not show in blue first. Everything else is caught by the 1.5 s pass.
    let themeObserved = false, themeWalkQueued = false;
    function watchThemeRoots() {
        if (themeObserved) return;
        themeObserved = true;
        const mo = new MutationObserver(() => {
            if (themeWalkQueued || !theme) return;
            themeWalkQueued = true;
            setTimeout(() => {
                themeWalkQueued = false;
                if (!theme) return;
                themeWalk(document);
                if (themeRulesStale) writeThemeRules();
            }, 60);
        });
        mo.observe(document.body, { childList: true });          // popups appended to <body>
        for (const r of ['top-status-region', 'action-region', 'desktop-chat-pane', 'landscape-side-pane', 'king-action-tray']) {
            const el = role(r);
            if (el) mo.observe(el, { subtree: true, childList: true, attributes: true, attributeFilter: ['style'] });
        }
    }

    // Switches, pressed buttons and the chat's Cosmetics switch show "on" in the theme's accent
    // instead of the fixed green — as Material 3 draws its switches in the primary colour. Knob
    // position and brightness still say on or off; only the hue follows the theme. The
    // strength follows the accent's, within bounds, so Graphite's switches are grey.
    // The tileset banner (12b) takes the accent too: the name bright, the line above it paler,
    // and a glow of the same hue behind the letters.
    function themeAccentCss(t) {
        if (!t) return '';
        const k = Math.min(1.4, Math.max(0.25, t.accent.k));
        const c = (L, C) => `rgb(${fromOklch(L, C * k, t.accent.h).join(', ')})`;
        const S = 'html[data-mcfo-theme]';
        const track = c(0.6, 0.13), edge = c(0.68, 0.12), deep = c(0.3, 0.07), text = c(0.93, 0.04), pressed = c(0.42, 0.09);
        return [
            `${S} .mcfo-switch__input:checked + .mcfo-switch { background: ${track}; box-shadow: inset 0 0 0 1px ${edge}; }`,
            `${S} .mcfo-seg button[aria-pressed="true"] { background: ${pressed}; }`,
            `${S}[data-mcfo-chatcos="1"] .mcf-chat__cosmetics-toggle[aria-pressed="true"] { background: ${deep} !important; border-color: ${edge} !important; color: ${text} !important; }`,
            `${S}[data-mcfo-chatcos="1"] .mcf-chat__cosmetics-toggle[aria-pressed="true"]::before { background-color: ${track}; }`,
            `${S} .mcfo-tsbanner__name { color: ${c(0.84, 0.15)}; text-shadow: 0 2px 0 rgba(0, 0, 0, 0.4), 0 0 26px ${c(0.55, 0.16)}, 0 4px 22px rgba(0, 0, 0, 0.75); }`,
            `${S} .mcfo-tsbanner__kicker { color: ${c(0.9, 0.06)}; }`,
        ].join('\n');
    }

    // ---- random theme ----
    // From every preset but Crownfall and Custom, never the one showing now. The pick becomes the
    // chosen theme, so switching Random off keeps whatever is on screen.
    function randomTheme() {
        const pool = THEMES.filter(t => t.id !== 'original' && t.id !== 'custom' && t.id !== settings.themeId && themeVisible(t));
        const pick = pool[Math.floor(Math.random() * pool.length)];
        if (!pick) return;
        settings.themeId = pick.id;
        saveSettings();
        themeTick();
        // The theme page, if open, shows the new pick as the pressed tile.
        if (settingsRedraw && settingsView === 'Theme' && windows.has(SETTINGS_KEY)) settingsRedraw();
    }

    // The timer runs only while Random is on; changing either restarts it.
    let themeRotateTimer = null, themeRotateEvery = 0;
    function scheduleThemeRotation() {
        const every = settings.themeRandom ? settings.themeRotate : 0;
        if (every === themeRotateEvery) return;
        themeRotateEvery = every;
        clearInterval(themeRotateTimer);
        themeRotateTimer = every ? setInterval(randomTheme, every * 60000) : null;
    }

    // Called on every apply() pass and whenever the choice changes. Cheap when nothing did.
    function themeTick() {
        const t = currentTheme();
        // A preset is fully named by its id; Custom also by its three sliders.
        const sig = !t ? '' : t.id === 'custom'
            ? `custom|${settings.themeHue}|${settings.themeTint}|${settings.themeAccent}|${settings.themeGradient}|${settings.themePattern}` : t.id;
        if (sig !== themeSig) {
            themeSig = sig;
            theme = t;
            themeMemo.clear();
            const root = document.documentElement;
            if (t) root.setAttribute('data-mcfo-theme', settings.themeId); else root.removeAttribute('data-mcfo-theme');
            themeOwnStyle.textContent = t ? themeText(BASE_CSS) : '';
            themeDecorStyle.textContent = themeDecorCss(t);
            themeAccentStyle.textContent = themeAccentCss(t);
            themeMirror = { sig: null, text: '' };
            // Back to the stock look: the tokens go too, nothing of ours is left on the game's nodes.
            if (!t) for (const el of document.querySelectorAll('[data-mcfo-t]')) el.removeAttribute('data-mcfo-t');
            themeRulesStale = true;
        }
        if (!theme) { if (themeRulesStale) writeThemeRules(); skinTick(); return; }
        const sheets = themeSheetsSig(document);
        if (sheets !== themeMirror.sig) { themeMirror = { sig: sheets, text: mirrorSheets(document) }; themeRulesStale = true; }
        themeWalk(document);
        watchThemeRoots();
        if (themeRulesStale) writeThemeRules();
        skinTick();
    }

    // =========================================================================================
    // 3c. DELUXE THEMES: SKINS ON TOP OF THE COLOURS
    // =========================================================================================
    // The themes above recolour what the game draws. A Deluxe theme goes further: on top of its
    // colours (the same engine, the same s/l/i/a roles) it lays a skin — textures, frames, pieces
    // of scenery and, if wanted, moving effects — over the frame of the page: header, footer,
    // chat, windows, menus and buttons. The board itself (lanes, marbles, king tile) is left
    // alone: it redraws all the time and has to stay readable.
    //
    // Everything a skin shows is made here, at load time, from a few lines of code: no image
    // files, nothing fetched. The block textures are this script's own 16x16 pixel art in the
    // manner of the game they recall — painted onto a canvas from a fixed seed, so they look the
    // same on every load, kept as a data URL and scaled up with image-rendering: pixelated. The
    // police box is CSS and one small SVG. So the script stays small and owes nobody an image.
    //
    // A skin is an entry in SKINS:
    //   assets()        its images, made once and kept (skinAssets)
    //   css(S, A, fx)   its style sheet. S is the selector for <html> while it is active, A its
    //                   images, fx(levels, rest) a selector for the effect levels named.
    //   decor           pieces of scenery: a class, where it goes (host) and its markup. Put back
    //                   on every pass should the game rebuild the host.
    //   particles       canvas effects, only at Full: where (host), init(w, h) and step(...).
    //   frame(A)        the same mood on the body of a page in one of our windows.
    //   tile(A)         the preview on its tile in the settings.
    //
    // Effects come in three levels (themeFx): Full — particles and moving backgrounds; Subtle —
    // small, slow movement such as a glowing lamp; Off — a still picture. The performance levels
    // hold them down on their own (Light and Balanced at Subtle, Maximum at Off), and so does the
    // system's "reduce motion". Particles run on their own loop, at most 30 frames a second, and
    // stop while the tab is hidden.
    const skinStyle = ownStyle('mcfo-skin-css');   // after every theme sheet: wins on equal terms
    const skinAssetSets = new Map();
    const skinImages = new Map();
    let skinActive = null, skinFxActive = null;

    const FX_RANK = { off: 0, subtle: 1, full: 2 };
    function skinFxEffective() {
        let fx = settings.themeFx;
        const lvl = settings.perfLevel;
        const cap = lvl === 'maximum' ? 'off'
            : (lvl === 'light' || lvl === 'balanced' || (lvl === 'custom' && perfValue('perfChatMotion'))) ? 'subtle' : 'full';
        if (FX_RANK[cap] < FX_RANK[fx]) fx = cap;
        // "No chat animations" answers reduce-motion queries itself (section 14), so the system's
        // own answer is only asked while that lever is off.
        if (!perfValue('perfChatMotion')) {
            try { if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) fx = 'off'; } catch (e) {}
        }
        return fx;
    }

    // ---- images ----
    function seeded(seed) {
        let a = seed >>> 0;
        return () => {
            a = (a + 0x6D2B79F5) >>> 0;
            let t = a;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }
    const pickOf = (r, list) => list[Math.floor(r() * list.length)];
    function shade(hex, f) {
        const c = parseColour(hex);
        const k = v => Math.max(0, Math.min(255, Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f)));
        return `rgb(${k(c.r)}, ${k(c.g)}, ${k(c.b)})`;
    }

    // A w x h pixel picture from paint(x, y) -> colour, as a PNG data URL. Empty when the
    // browser cannot draw (then the skin's flat colours show).
    function pixelImage(key, w, h, paint) {
        if (skinImages.has(key)) return skinImages.get(key);
        let url = '';
        try {
            const c = document.createElement('canvas');
            c.width = w;
            c.height = h;
            const g = c.getContext('2d');
            if (g) {
                for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
                    const col = paint(x, y);
                    if (!col) continue;
                    g.fillStyle = col;
                    g.fillRect(x, y, 1, 1);
                }
                url = c.toDataURL('image/png');
            }
        } catch (e) { url = ''; }
        skinImages.set(key, url);
        return url;
    }
    const svgUrl = svg => 'data:image/svg+xml,' + encodeURIComponent(svg);

    function skinAssets(id) {
        if (!skinAssetSets.has(id)) skinAssetSets.set(id, SKINS[id].assets ? SKINS[id].assets() : {});
        return skinAssetSets.get(id);
    }

    // ---- Minecraft: pixel art of our own ----
    const MC = {
        dirt:  ['#79553a', '#8a6142', '#6c4b33', '#966c4a', '#5d412c'],
        grass: ['#5b9a38', '#6aae43', '#4f8a31', '#79bd4c', '#467c2b'],
        stone: ['#7d7d7d', '#878787', '#747474', '#909090', '#6a6a6a'],
        deep:  ['#4a4a50', '#53535a', '#434349', '#5c5c63', '#3c3c42'],
        oak:   ['#a3834d', '#9a7a45', '#ad8e57', '#8f7040'],
        dark:  ['#4a3119', '#55391e', '#3f2913', '#5d4023'],
    };
    const MC_FONT = '"Minecraft", "Minecraftia", "Monocraft", "Pixelify Sans", "Silkscreen", ui-monospace, monospace';

    // Noise in a palette, with a few darker specks in pairs — the way the block textures look.
    function mcNoise(key, pal, seed) {
        const r = seeded(seed);
        const px = [];
        for (let i = 0; i < 256; i++) px.push(pickOf(r, pal));
        for (let n = 0; n < 7; n++) {
            const i = Math.floor(r() * 256);
            const dark = shade(pal[pal.length - 1], -0.18);
            px[i] = dark;
            if (i % 16 < 15) px[i + 1] = dark;
        }
        return pixelImage(key, 16, 16, (x, y) => px[y * 16 + x]);
    }
    // Grass block from the side: grass along the top, reaching down unevenly, dirt below.
    function mcGrassSide() {
        const r = seeded(7);
        const reach = Array.from({ length: 16 }, () => 2 + Math.floor(r() * 3) + (r() < 0.2 ? 1 : 0));
        const dirt = seeded(11), grass = seeded(19);
        return pixelImage('mc-grass-side', 16, 16, (x, y) => (y < reach[x] ? pickOf(grass, MC.grass) : pickOf(dirt, MC.dirt)));
    }
    // Planks: four boards of four rows, a dark gap under each and a seam where a board ends.
    function mcPlanks(key, pal, seed) {
        const r = seeded(seed);
        const seams = [3, 11, 7, 14];
        const gap = shade(pal[0], -0.35), seam = shade(pal[0], -0.25);
        return pixelImage(key, 16, 16, (x, y) => {
            const board = Math.floor(y / 4);
            if (y % 4 === 3) return gap;
            if (x === seams[board]) return seam;
            return r() < 0.12 ? shade(pickOf(r, pal), -0.12) : pickOf(r, pal);
        });
    }

    // XP orb, 5 x 5.
    const XP_ORB = ['.###.', '#ooo#', '#o*o#', '#ooo#', '.###.'];
    const XP_COL = { '#': '#3d8c14', o: '#9be62e', '*': '#f2ff9c' };
    function xpOrb(w, h, anywhere) {
        return { x: Math.random() * w, y: anywhere ? Math.random() * h : h + Math.random() * 40,
                 v: 10 + Math.random() * 14, s: Math.random() < 0.5 ? 2 : 3, ph: Math.random() * 6.28 };
    }

    // ---- TARDIS ----
    const TD = { blue: '#0f3d73', dark: '#0a2a52', deep: '#061c38', trim: '#3a70b0', sign: '#0a0a0a', pane: '#f3efd9', lamp: '#fff5c4' };
    const GILL = '"Gill Sans", "Gill Sans MT", "Gill Sans Nova", Seravek, Calibri, "Trebuchet MS", sans-serif';
    function tardisWindow() {
        const W = 60, H = 26, m = 3, bar = 2;
        const cw = (W - 2 * m - 2 * bar) / 3, ch = (H - 2 * m - bar) / 2;
        let panes = '';
        for (let row = 0; row < 2; row++) for (let col = 0; col < 3; col++) {
            panes += `<rect x="${(m + col * (cw + bar)).toFixed(2)}" y="${(m + row * (ch + bar)).toFixed(2)}" width="${cw.toFixed(2)}" height="${ch.toFixed(2)}"/>`;
        }
        return svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">`
            + `<rect width="${W}" height="${H}" fill="${TD.dark}"/><g fill="${TD.pane}">${panes}</g></svg>`);
    }
    // Stars as fixed dots, from a seed so they stay where they are.
    function starField(seed, count, alpha) {
        const r = seeded(seed);
        const dots = [];
        for (let i = 0; i < count; i++) {
            const size = r() < 0.2 ? 1.6 : 1;
            dots.push(`radial-gradient(circle at ${(r() * 100).toFixed(1)}% ${(r() * 100).toFixed(1)}%, rgba(255, 255, 255, ${alpha}) 0 ${size}px, transparent ${size + 0.7}px)`);
        }
        return dots.join(', ');
    }
    function vortexStreak(w, h, anywhere) {
        return { a: Math.random() * Math.PI * 2, d: anywhere ? Math.random() * w * 0.5 : 4 + Math.random() * 12,
                 v: 26 + Math.random() * 46, hue: Math.random() < 0.18 ? 28 + Math.random() * 22 : 200 + Math.random() * 60,
                 spin: 0.2 + Math.random() * 0.3 };
    }

    // Everything of the frame a skin dresses, in three kinds (6.6 — up to 6.5 half of the buttons
    // and every popup kept the stock look under a Deluxe theme):
    //   plain buttons  take the skin's button look completely
    //   meaning        buttons whose colour says something — ticket chips (amount), beverages
    //                  (kind), gold and diamond prices, rebellion tiers: they keep their colours and
    //                  take only the skin's shape, edge and relief
    //   popups         menus, the name list, the game's sound panel: the skin's panel look
    const SKIN_BUTTONS = [
        '.mcf-chat__send', '.mcf-chat__cosmetics-toggle', '.mcf-chat__collapse', '.mcfo-chatpop-btn',
        '.mcfo-taskbar button', '.mcfo-win__head button', '[data-role="sound-utility-toggle"]',
        '.mcfo-rebellion', '.mcfo-rail-toggle', '.mcfo-unbid', '.mcfo-autobid',
        '[data-action="king-attack"]', '.mcfo-attack', '.mcfo-signpost',
        '[data-role="diamonds-purchase-link"]',   // the game's own sign on the Diamonds card (app.js metricCellDom)
        '.mcfo-drink--icon',   // a beverage as a symbol: the symbol says what it is, the button is the skin's (6.12)
        '.mcfo-gear',          // the settings gear top right (6.14)
        '.mcfo-note', '.mcfo-barbtn',   // the note in the header and the buttons of the player bar (6.23)
    ];
    const SKIN_FILLED = ['[data-role="bid-rail"] button[data-bid-amount]', '[data-mcfo-bid]', '.mcfo-drink:not(.mcfo-drink--icon)'];
    const SKIN_EDGED = ['.mcfo-bev__buy', '.mcfo-reb__tier'];
    const SKIN_POPUPS = ['.mcfo-menu', '.mcf-chat__suggestions', '[data-role="sound-utility-panel"]'];
    const SKIN_PANELS = ['.mcfo-set__card', '.mcfo-set__tile', '.mcfo-theme__pick', '.mcfo-bar'];
    const skinSel = (S, list, tail = '') => list.map(x => `${S} ${x}${tail}`).join(', ');

    const SKINS = {
        minecraft: {
            assets: () => ({
                grass: mcGrassSide(),
                dirt: mcNoise('mc-dirt', MC.dirt, 3),
                stone: mcNoise('mc-stone', MC.stone, 5),
                deep: mcNoise('mc-deep', MC.deep, 9),
                dark: mcPlanks('mc-dark', MC.dark, 17),
            }),
            css: (S, A, fx) => {
                const button = `background: url("${A.stone}") 0 0 / 32px 32px repeat, #7d7d7d !important; color: #ffffff !important;
                    text-shadow: 2px 2px 0 #3f3f3f; border: 2px solid #000000 !important; border-radius: 0 !important;
                    box-shadow: inset 2px 2px 0 rgba(255, 255, 255, 0.35), inset -2px -3px 0 rgba(0, 0, 0, 0.4) !important; image-rendering: pixelated;`;
                const buttonHover = `background: linear-gradient(rgba(110, 125, 255, 0.4), rgba(110, 125, 255, 0.4)), url("${A.stone}") 0 0 / 32px 32px repeat, #7d7d7d !important;
                    border-color: #ffffff !important;`;
                const tooltip = `background: linear-gradient(rgba(16, 0, 16, 0.95), rgba(16, 0, 16, 0.95)) padding-box, linear-gradient(#5000ff, #28007f) border-box !important;
                    border: 2px solid transparent !important; border-radius: 0 !important; outline: 1px solid #100010;`;
                const buttons = skinSel(S, SKIN_BUTTONS);
                const hovers = skinSel(S, SKIN_BUTTONS, ':hover:not(:disabled)');
                const relief = 'box-shadow: inset 2px 2px 0 rgba(255, 255, 255, 0.35), inset -2px -3px 0 rgba(0, 0, 0, 0.4) !important;';
                return `
                /* The ground between the boards (the game's shell, #07090b): deepslate in the dark,
                   like the wall of a cave. */
                ${S} [data-role="shell"] {
                    background: linear-gradient(rgba(0, 0, 0, 0.62), rgba(0, 0, 0, 0.62)), url("${A.deep}") 0 0 / 48px 48px repeat, #1e1e22 !important;
                    image-rendering: pixelated;
                }
                ${S} [data-role="shell"] * { image-rendering: auto; }
                ${S} [data-role="top-status-region"] {
                    background: url("${A.grass}") 0 0 / 48px 48px repeat-x, url("${A.dirt}") 0 0 / 48px 48px repeat, #6c4b33 !important;
                    border-bottom: 3px solid #2b1d12 !important; image-rendering: pixelated;
                }
                ${S} [data-role="top-status-region"] *, ${S} [data-role="action-region"] *, ${S} .mcf-chat * { image-rendering: auto; }
                ${S} [data-role="top-status-region"] :is([data-role="metric-cell"], [data-role="session-cell"], [data-role="profile-entry"]) {
                    background: rgba(0, 0, 0, 0.58) !important; border: 2px solid #1b1b1b !important; border-radius: 0 !important;
                    box-shadow: inset 2px 2px 0 rgba(255, 255, 255, 0.16), inset -2px -2px 0 rgba(0, 0, 0, 0.45) !important;
                }
                ${S} [data-role="action-region"] {
                    position: relative; background: url("${A.deep}") 0 0 / 48px 48px repeat, #4a4a50 !important;
                    border-top: 3px solid #1e1e1e !important; image-rendering: pixelated;
                }
                /* The footer buttons as hotbar slots. */
                ${S} [data-role="nav-region"] > :is(button, a) {
                    background: rgba(0, 0, 0, 0.5) !important; color: #ffffff !important; text-shadow: 2px 2px 0 #3f3f3f;
                    border: 2px solid #3a3a3a !important; border-radius: 0 !important;
                    box-shadow: inset 2px 2px 0 rgba(255, 255, 255, 0.2), inset -2px -2px 0 rgba(0, 0, 0, 0.45) !important;
                }
                ${S} [data-role="nav-region"] > :is(button, a):hover { outline: 2px solid #ffffff; outline-offset: -2px; }
                /* The experience bar above the hotbar. */
                ${S} .mcfo-mc-xp {
                    position: absolute; left: 50%; top: 0; transform: translate(-50%, -100%); width: min(460px, 46%); height: 7px;
                    border: 1px solid #000000; background: linear-gradient(90deg, #7efc20 0 62%, rgba(0, 0, 0, 0.78) 62%);
                    box-shadow: inset 0 -2px 0 rgba(0, 0, 0, 0.3); pointer-events: none; z-index: 3;
                }
                ${S} .mcfo-mc-xp::after {
                    content: ''; position: absolute; inset: 0;
                    background: repeating-linear-gradient(90deg, transparent 0 calc(100% / 18 - 1px), rgba(0, 0, 0, 0.65) calc(100% / 18 - 1px) calc(100% / 18));
                }
                ${fx(['full', 'subtle'], '.mcfo-mc-xp')} { animation: mcfoXpGlow 2.4s ease-in-out infinite alternate; }
                ${fx(['subtle'], '.mcfo-mc-xp')} { animation-duration: 4.8s; }
                @keyframes mcfoXpGlow { from { filter: drop-shadow(0 0 1px rgba(126, 252, 32, 0.4)); } to { filter: drop-shadow(0 0 6px rgba(182, 255, 74, 0.95)); } }

                ${S} .mcf-chat {
                    background: linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.5)), url("${A.dark}") 0 0 / 48px 48px repeat, #3f2913 !important;
                    border: 3px solid #111111 !important; border-radius: 0 !important; image-rendering: pixelated;
                    box-shadow: inset 2px 2px 0 rgba(255, 255, 255, 0.1), inset -2px -2px 0 rgba(0, 0, 0, 0.5) !important;
                }
                ${S} .mcf-chat__header {
                    background: linear-gradient(rgba(0, 0, 0, 0.22), rgba(0, 0, 0, 0.22)), url("${A.grass}") 0 0 / 36px 36px repeat-x,
                                url("${A.dirt}") 0 0 / 36px 36px repeat, #6c4b33 !important;
                    border-bottom: 3px solid #2b1d12 !important; image-rendering: pixelated;
                }
                ${S} .mcf-chat__header :is(.mcf-chat__title, .mcf-chat__title strong, .mcf-chat__room) { color: #ffffff !important; text-shadow: 2px 2px 0 #3f3f3f; }
                ${S} .mcf-chat__title strong, ${S} .mcfo-win__title, ${S} .mcfo-bev__head, ${S} .mcfo-events__head { font-family: ${MC_FONT} !important; }
                ${S} .mcf-chat__composer {
                    background: linear-gradient(rgba(0, 0, 0, 0.3), rgba(0, 0, 0, 0.3)), url("${A.stone}") 0 0 / 36px 36px repeat, #7d7d7d !important;
                    border-top: 3px solid #1e1e1e !important; image-rendering: pixelated;
                }
                ${S} .mcf-chat__input { background: rgba(0, 0, 0, 0.75) !important; border: 2px solid #a0a0a0 !important; border-radius: 0 !important; color: #ffffff !important; }
                ${S} .mcf-chat__input:focus { border-color: #ffffff !important; outline: none; }
                ${buttons} { ${button} }
                ${hovers} { ${buttonHover} }

                /* Windows as inventory screens, menus as item tooltips. */
                ${S} .mcfo-win {
                    border: 3px solid #000000 !important; border-radius: 0 !important;
                    box-shadow: inset 3px 3px 0 rgba(255, 255, 255, 0.22), inset -3px -3px 0 rgba(0, 0, 0, 0.45), 0 14px 40px rgba(0, 0, 0, 0.6) !important;
                }
                ${S} .mcfo-win__head {
                    background: url("${A.stone}") 0 0 / 32px 32px repeat, #7d7d7d !important; border-bottom: 3px solid #1e1e1e !important; image-rendering: pixelated;
                }
                ${S} .mcfo-win__head * { image-rendering: auto; }
                ${S} .mcfo-win__title { color: #ffffff !important; text-shadow: 2px 2px 0 #3f3f3f; }
                ${skinSel(S, SKIN_BUTTONS, ':disabled')} { opacity: 0.6; }

                /* Chips, beverages and prices: their colours stay, the shape is the game's. */
                ${skinSel(S, SKIN_FILLED)} {
                    border-radius: 0 !important; border: 2px solid #000000 !important; ${relief} text-shadow: 1px 1px 0 rgba(0, 0, 0, 0.55);
                }
                ${skinSel(S, SKIN_EDGED)} { border-radius: 0 !important; border-width: 2px !important; ${relief} }
                ${skinSel(S, SKIN_FILLED, ':hover:not(:disabled)')} { outline: 2px solid #ffffff; outline-offset: -2px; }

                /* Menus and popups like the windows: stone, black edge, relief. */
                ${skinSel(S, SKIN_POPUPS)} {
                    background: linear-gradient(rgba(18, 18, 18, 0.9), rgba(18, 18, 18, 0.9)), url("${A.stone}") 0 0 / 32px 32px repeat, #1e1e1e !important;
                    border: 3px solid #000000 !important; border-radius: 0 !important; outline: none !important; image-rendering: pixelated;
                    box-shadow: inset 3px 3px 0 rgba(255, 255, 255, 0.16), inset -3px -3px 0 rgba(0, 0, 0, 0.5), 0 10px 28px rgba(0, 0, 0, 0.6) !important;
                }
                ${skinSel(S, SKIN_POPUPS, ' *')} { image-rendering: auto; }
                ${S} .mcfo-menu > button:hover, ${S} .mcf-chat__suggestion:hover {
                    background: rgba(110, 125, 255, 0.35) !important; border-color: transparent !important;
                }
                ${S} :is(.mcfo-events__head, .mcfo-bev__head) { color: #ffffff !important; text-shadow: 2px 2px 0 #3f3f3f; border-bottom-color: #000000 !important; }
                ${S} .mcfo-menu hr { border-top-color: #000000 !important; }

                /* Settings cards and tiles as inventory slots. */
                ${skinSel(S, SKIN_PANELS)} { border-radius: 0 !important; }
                ${skinSel(S, ['.mcfo-set__tile', '.mcfo-theme__pick'])} {
                    border: 2px solid #1b1b1b !important; box-shadow: inset 2px 2px 0 rgba(255, 255, 255, 0.1), inset -2px -2px 0 rgba(0, 0, 0, 0.4) !important;
                }
                ${S} .mcfo-theme__pick[aria-pressed="true"] { border-color: #ffffff !important; }
                `;
            },
            decor: [
                // Centred over the board, like the ticket rail above which it sits — the footer
                // runs under the chat as well, so its middle is not the board's.
                { cls: 'mcfo-mc-xp', host: () => role('action-region'), html: '', place: (el, host) => {
                    const board = role('main-region') || role('lane-play-region');
                    if (!board) return;
                    const b = board.getBoundingClientRect(), f = host.getBoundingClientRect();
                    if (!b.width || !f.width) return;
                    el.style.left = Math.round(b.left + b.width / 2 - f.left) + 'px';
                    el.style.width = Math.round(Math.min(460, b.width * 0.46)) + 'px';
                } },
            ],
            particles: [{
                name: 'xp',
                host: () => document.querySelector('.mcf-chat:not([data-collapsed="true"])'),
                init: (w, h) => ({ orbs: Array.from({ length: 11 }, () => xpOrb(w, h, true)) }),
                step: (g, st, w, h, dt, now) => {
                    g.clearRect(0, 0, w, h);
                    for (const o of st.orbs) {
                        o.y -= o.v * dt;
                        o.x += Math.sin(now / 900 + o.ph) * 12 * dt;
                        if (o.y < -16) Object.assign(o, xpOrb(w, h, false));
                        g.globalAlpha = 0.5 + 0.35 * Math.sin(now / 260 + o.ph);
                        const x0 = Math.round(o.x), y0 = Math.round(o.y);
                        for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) {
                            const c = XP_COL[XP_ORB[y][x]];
                            if (!c) continue;
                            g.fillStyle = c;
                            g.fillRect(x0 + x * o.s, y0 + y * o.s, o.s, o.s);
                        }
                    }
                    g.globalAlpha = 1;
                },
            }],
            frame: A => `\nhtml[data-mcfo-theme] body { background: linear-gradient(rgba(0, 0, 0, 0.55), rgba(0, 0, 0, 0.55)), url("${A.dark}") 0 0 / 48px 48px repeat fixed, #3f2913 !important; }`,
            tile: A => `background: url("${A.grass}") 0 0 / 34px 34px repeat-x, url("${A.dirt}") 0 0 / 34px 34px repeat, #6c4b33; image-rendering: pixelated;`,
        },

        tardis: {
            assets: () => ({ win: tardisWindow(), stars: starField(23, 26, 0.85), twinkle: starField(41, 18, 1), space: starField(59, 70, 0.55) }),
            css: (S, A, fx) => `
                /* The ground between the boards: open space, stars and a faint nebula. */
                ${S} [data-role="shell"] {
                    background: ${A.space}, radial-gradient(ellipse at 15% 85%, rgba(90, 40, 160, 0.22), transparent 55%),
                                radial-gradient(ellipse at 85% 20%, rgba(30, 90, 200, 0.18), transparent 50%), #03060f !important;
                }
                ${S} [data-role="top-status-region"] {
                    position: relative;
                    background: ${A.stars}, radial-gradient(ellipse at 72% 130%, rgba(120, 60, 200, 0.45), transparent 60%),
                                radial-gradient(ellipse at 18% -30%, rgba(40, 120, 255, 0.35), transparent 55%),
                                linear-gradient(180deg, #040818, #0a1438 70%, #140a33) !important;
                    border-bottom: 2px solid ${TD.trim} !important;
                }
                ${S} [data-role="top-status-region"] > :not(.mcfo-skin) { position: relative; z-index: 1; }
                ${fx(['full'], '[data-role="top-status-region"]::before')} {
                    content: ''; position: absolute; inset: 0; pointer-events: none; z-index: 0;
                    background: ${A.twinkle}; animation: mcfoTwinkle 3.2s ease-in-out infinite alternate;
                }
                @keyframes mcfoTwinkle { from { opacity: 0.15; } to { opacity: 1; } }
                ${S} [data-role="top-status-region"] :is([data-role="metric-cell"], [data-role="session-cell"], [data-role="profile-entry"]) {
                    background: rgba(6, 28, 56, 0.8) !important; border: 1px solid ${TD.trim} !important; border-radius: 3px !important;
                }
                ${S} [data-role="action-region"] {
                    background: linear-gradient(180deg, ${TD.trim} 0 2px, ${TD.dark} 2px 5px, ${TD.blue} 5px) !important; border-top: 0 !important;
                    position: relative; isolation: isolate;
                }
                ${S} [data-role="action-region"] > .mcfo-skin-canvas { z-index: -1; }
                ${S} [data-role="nav-region"] > :is(button, a), ${S} .mcfo-taskbar button {
                    background: ${TD.sign} !important; color: #ffffff !important; border: 1px solid #333333 !important; border-radius: 2px !important;
                    font-family: ${GILL}; letter-spacing: 0.08em; text-transform: uppercase;
                }

                /* The chat is the police box: posts left and right, roof and lamp on top, the sign,
                   the windows under it, panels below. The scenery sits in the padding of the chat,
                   because the column around it cuts off anything that sticks out. */
                ${S} .mcf-chat {
                    position: relative; padding: 50px 9px 0 !important; border: 0 !important; border-radius: 0 !important;
                    background: linear-gradient(90deg, ${TD.dark} 0 8px, ${TD.trim} 8px 9px, ${TD.blue} 9px calc(100% - 9px),
                                ${TD.trim} calc(100% - 9px) calc(100% - 8px), ${TD.dark} calc(100% - 8px)) 0 31px / 100% calc(100% - 31px) no-repeat,
                                transparent !important;   /* the box starts under the roof, which stands against the dark */
                }
                ${S} .mcf-chat > :not(.mcfo-skin):not(.mcfo-chatrail) { position: relative; z-index: 1; }
                ${S} .mcf-chat[data-collapsed="true"] { padding: 0 !important; background: ${TD.blue} !important; }
                ${S} .mcf-chat[data-collapsed="true"] > .mcfo-skin { display: none; }
                ${S} .mcfo-tardis-top {
                    position: absolute; left: 0; right: 0; top: 0; height: 50px; pointer-events: none; z-index: 2;
                    background: linear-gradient(${TD.dark}, ${TD.dark}) center 14px / 40% 6px no-repeat,
                                linear-gradient(${TD.trim}, ${TD.trim}) center 20px / 78% 2px no-repeat,
                                linear-gradient(${TD.blue}, ${TD.blue}) center 22px / 80% 6px no-repeat,
                                linear-gradient(${TD.dark}, ${TD.dark}) center 28px / 100% 3px no-repeat;
                }
                ${S} .mcfo-tardis-lamp {
                    position: absolute; left: 50%; top: 2px; width: 10px; height: 12px; transform: translateX(-50%); border-radius: 2px 2px 1px 1px;
                    background: linear-gradient(90deg, transparent 0 2px, ${TD.dark} 2px 3px, transparent 3px 7px, ${TD.dark} 7px 8px, transparent 8px),
                                linear-gradient(90deg, #cfc79d, ${TD.lamp} 45%, #cfc79d);
                    box-shadow: 0 0 8px 2px rgba(255, 245, 196, 0.55);
                }
                ${S} .mcfo-tardis-lamp::before {
                    content: ''; position: absolute; left: -2px; right: -2px; top: -3px; height: 3px; border-radius: 2px 2px 0 0; background: ${TD.dark};
                }
                ${fx(['full', 'subtle'], '.mcfo-tardis-lamp')} { animation: mcfoLamp 1.6s ease-in-out infinite alternate; }
                ${fx(['subtle'], '.mcfo-tardis-lamp')} { animation-duration: 3.2s; }
                @keyframes mcfoLamp { from { box-shadow: 0 0 3px 1px rgba(255, 245, 196, 0.3); } to { box-shadow: 0 0 16px 6px rgba(255, 245, 196, 0.95); } }
                ${S} .mcfo-tardis-sign {
                    position: absolute; left: 9px; right: 9px; bottom: 0; height: 19px; display: flex; align-items: center; justify-content: space-between;
                    padding: 0 10px; background: ${TD.sign}; color: #ffffff; box-shadow: inset 0 0 0 1px #262626, 0 0 0 2px ${TD.dark};
                    font: 700 12px/1 ${GILL}; letter-spacing: 0.14em; text-shadow: 0 0 5px rgba(255, 255, 255, 0.45);
                }
                ${S} .mcfo-tardis-sign span { font-size: 6.5px; line-height: 1.05; letter-spacing: 0.12em; text-align: center; }
                ${S} .mcf-chat__header {
                    background: url("${A.win}") 10% calc(100% - 6px) / 36% 26px no-repeat, url("${A.win}") 90% calc(100% - 6px) / 36% 26px no-repeat,
                                linear-gradient(90deg, transparent calc(50% - 3px), ${TD.dark} calc(50% - 3px) calc(50% + 3px), transparent calc(50% + 3px)),
                                ${TD.blue} !important;
                    padding-bottom: 40px !important; border-bottom: 3px solid ${TD.dark} !important;
                }
                ${S} .mcf-chat__header :is(.mcf-chat__title, .mcf-chat__title strong, .mcf-chat__room) { color: #eaf2ff !important; }
                ${S} .mcf-chat__title strong { font-family: ${GILL}; letter-spacing: 0.12em; text-transform: uppercase; }
                ${S} :is(.mcf-chat__cosmetics-toggle, .mcf-chat__collapse) {
                    background: ${TD.dark} !important; border: 1px solid ${TD.trim} !important; color: #eaf2ff !important; border-radius: 2px !important;
                }
                ${S} .mcf-chat__body {
                    background: linear-gradient(90deg, transparent calc(50% - 3px), ${TD.dark} calc(50% - 3px) calc(50% + 3px), transparent calc(50% + 3px)),
                                linear-gradient(90deg, transparent 12px, rgba(0, 0, 0, 0.25) 12px 14px, transparent 14px calc(50% - 10px),
                                    rgba(255, 255, 255, 0.06) calc(50% - 10px) calc(50% - 8px), transparent calc(50% - 8px) calc(50% + 8px),
                                    rgba(0, 0, 0, 0.25) calc(50% + 8px) calc(50% + 10px), transparent calc(50% + 10px) calc(100% - 14px),
                                    rgba(255, 255, 255, 0.06) calc(100% - 14px) calc(100% - 12px), transparent calc(100% - 12px)),
                                repeating-linear-gradient(180deg, transparent 0 8px, rgba(0, 0, 0, 0.28) 8px 10px, transparent 10px 104px,
                                    rgba(255, 255, 255, 0.07) 104px 106px, transparent 106px 114px, ${TD.dark} 114px 122px),
                                ${TD.blue} !important;
                }
                ${S} .mcf-chat__composer { background: linear-gradient(180deg, ${TD.trim} 0 2px, ${TD.deep} 2px) !important; border-top: 0 !important; }
                ${S} .mcf-chat__input { background: #041630 !important; border: 1px solid ${TD.trim} !important; color: #eaf2ff !important; border-radius: 2px !important; }
                ${S} .mcf-chat__send {
                    background: ${TD.pane} !important; color: #111111 !important; border: 1px solid #b9b394 !important; border-radius: 2px !important;
                    font-family: ${GILL}; letter-spacing: 0.08em; text-transform: uppercase;
                }
                ${S} .mcf-chat__suggestions { background: ${TD.deep} !important; border: 2px solid ${TD.trim} !important; border-radius: 2px !important; }
                ${S} .mcf-chat__suggestion:hover { background: ${TD.blue} !important; }

                /* Windows with the sign as their title bar; they materialise when they open. */
                ${S} .mcfo-win {
                    border: 2px solid ${TD.trim} !important; border-radius: 3px !important;
                    box-shadow: 0 0 0 4px ${TD.dark}, 0 16px 44px rgba(0, 0, 0, 0.65) !important;
                }
                ${S} .mcfo-win__head { background: ${TD.sign} !important; border-bottom: 2px solid ${TD.dark} !important; }
                ${S} .mcfo-win__title {
                    color: #ffffff !important; font-family: ${GILL}; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase;
                    text-shadow: 0 0 6px rgba(255, 255, 255, 0.35);
                }
                ${S} .mcfo-win__head button { background: #1b1b1b !important; color: #ffffff !important; border-color: #333333 !important; }
                /* Windows arrive in one soft fade with a blue glow that dies away. Up to 6.5 they
                   blinked in and out like the police box landing — too much for every window that
                   opens. Fill "backwards" only: a filter left on the window would cost on every frame. */
                ${fx(['full', 'subtle'], '.mcfo-win')} { animation: mcfoMaterialise 0.5s ease-out 1 backwards; }
                @keyframes mcfoMaterialise {
                    from { opacity: 0; transform: scale(0.985); filter: drop-shadow(0 0 18px rgba(142, 197, 255, 0.9)); }
                    to   { opacity: 1; transform: none; filter: drop-shadow(0 0 0 rgba(142, 197, 255, 0)); }
                }
                ${S} .mcfo-menu {
                    background: rgba(6, 28, 56, 0.97) !important; border: 2px solid ${TD.trim} !important; border-radius: 3px !important;
                    box-shadow: 0 0 0 3px ${TD.dark}, 0 10px 30px rgba(0, 0, 0, 0.6) !important;
                }
                ${S} .mcfo-menu button:hover { background: ${TD.blue} !important; }

                /* Every other button: a blue panel with the trim; Send stays the white notice plate. */
                ${skinSel(S, SKIN_BUTTONS.filter(b => !['.mcf-chat__send', '.mcfo-taskbar button', '.mcfo-win__head button', '.mcfo-signpost', '[data-role="diamonds-purchase-link"]'].includes(b)))} {
                    background: ${TD.dark} !important; border: 1px solid ${TD.trim} !important; color: #eaf2ff !important; border-radius: 2px !important;
                    font-family: ${GILL}; letter-spacing: 0.06em;
                }
                ${skinSel(S, SKIN_BUTTONS.filter(b => !['.mcf-chat__send', '.mcfo-taskbar button', '.mcfo-win__head button', '.mcfo-signpost', '[data-role="diamonds-purchase-link"]'].includes(b)), ':hover:not(:disabled)')} {
                    background: ${TD.blue} !important;
                }
                ${skinSel(S, SKIN_BUTTONS, ':disabled')} { opacity: 0.6; }
                ${S} :is(.mcfo-signpost, [data-role="diamonds-purchase-link"]) {
                    background: ${TD.sign} !important; color: #ffffff !important; border: 1px solid #333333 !important; border-radius: 2px !important;
                    font-family: ${GILL}; letter-spacing: 0.08em; text-transform: uppercase;
                }
                ${skinSel(S, SKIN_FILLED)} { border-radius: 2px !important; box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.16), 0 0 0 1px ${TD.dark} !important; }
                ${skinSel(S, SKIN_EDGED)} { border-radius: 2px !important; }
                ${skinSel(S, ['[data-role="sound-utility-panel"]'])} {
                    background: rgba(6, 28, 56, 0.97) !important; border: 2px solid ${TD.trim} !important; border-radius: 3px !important;
                    box-shadow: 0 0 0 3px ${TD.dark}, 0 10px 30px rgba(0, 0, 0, 0.6) !important;
                }
                ${skinSel(S, SKIN_PANELS)} { border-radius: 3px !important; }
                ${skinSel(S, ['.mcfo-set__tile', '.mcfo-theme__pick'])} { border-color: ${TD.trim} !important; }
                ${S} .mcfo-theme__pick[aria-pressed="true"] { border-color: #8ec5ff !important; box-shadow: inset 0 0 0 1px #8ec5ff !important; }
            `,
            decor: [
                { cls: 'mcfo-tardis-top', host: () => document.querySelector('.mcf-chat'),
                  html: '<i class="mcfo-tardis-lamp"></i><div class="mcfo-tardis-sign"><b>POLICE</b><span>PUBLIC<br>CALL</span><b>BOX</b></div>' },
            ],
            particles: [{
                // The time vortex: streaks of light rushing out of the middle of the footer. Until
                // 6.16.1 it ran in the header, behind the cards, where hardly any of it showed.
                name: 'vortex',
                host: () => role('action-region'),
                init: (w, h) => ({ streaks: Array.from({ length: 46 }, () => vortexStreak(w, h, true)) }),
                step: (g, st, w, h, dt) => {
                    g.clearRect(0, 0, w, h);
                    g.globalCompositeOperation = 'lighter';
                    const cx = w / 2, cy = h / 2, squash = Math.min(1, (h / w) * 3);
                    for (const p of st.streaks) {
                        p.d += p.v * dt * (0.4 + p.d / (w / 2));
                        p.a += p.spin * dt;
                        if (p.d > w * 0.62) Object.assign(p, vortexStreak(w, h, false));
                        const len = 6 + p.d * 0.12;
                        const x = cx + Math.cos(p.a) * p.d, y = cy + Math.sin(p.a) * p.d * squash;
                        const x2 = cx + Math.cos(p.a) * (p.d - len), y2 = cy + Math.sin(p.a) * (p.d - len) * squash;
                        g.strokeStyle = `hsla(${p.hue}, 90%, 62%, ${(Math.min(1, p.d / (w * 0.22)) * 0.55).toFixed(3)})`;
                        g.lineWidth = 1 + (p.d / w) * 2.2;
                        g.beginPath();
                        g.moveTo(x2, y2);
                        g.lineTo(x, y);
                        g.stroke();
                    }
                    g.globalCompositeOperation = 'source-over';
                },
            }],
            frame: () => `\nhtml[data-mcfo-theme] body { background: radial-gradient(ellipse at 50% 0%, rgba(58, 112, 176, 0.35), transparent 60%), ${TD.deep} !important; }`,
            tile: () => `background: linear-gradient(${TD.sign}, ${TD.sign}) center 6px / 70% 8px no-repeat,
                         linear-gradient(90deg, ${TD.dark} 0 6px, ${TD.blue} 6px calc(100% - 6px), ${TD.dark} calc(100% - 6px));`,
        },
    };

    // ---- putting a skin in place ----
    function skinCssText(id) {
        const S = `html[data-mcfo-skin="${id}"][data-mcfo-theme]`;
        const fx = (levels, rest) => levels.map(l => `${S}[data-mcfo-fx="${l}"] ${rest}`).join(', ');
        const common = `
            ${S} .mcfo-skin-canvas { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 0; }
            ${S} [data-role="top-status-region"], ${S} .mcf-chat { position: relative; }
            /* Skins give the chat padding and borders. Its height is the height of its column, which
               cuts off whatever sticks out, so they have to go inside it — or the message box is lost. */
            ${S} .mcf-chat { box-sizing: border-box !important; }
            ${S} [data-role="top-status-region"] > :not(.mcfo-skin), ${S} .mcf-chat > :not(.mcfo-skin) { position: relative; z-index: 1; }
            /* The rail of the collapsed chat is a child of the chat too, but it lies over the whole
               chat (absolute, inset 0). Lifted into the flow like the rest it slid under the hidden
               header, out of the 44px column — the rail showed the skin but no button and no count (6.8). */
            ${S} .mcf-chat > .mcfo-chatrail { position: absolute; z-index: 5; }`;
        return common + SKINS[id].css(S, skinAssets(id), fx);
    }

    function skinFrameCss(t) {
        if (!t || !t.skin || !SKINS[t.skin] || !SKINS[t.skin].frame) return '';
        return SKINS[t.skin].frame(skinAssets(t.skin));
    }

    function ensureDecor(skin) {
        for (const d of skin.decor || []) {
            const host = d.host();
            if (!host) continue;
            let el = host.querySelector(`:scope > .${d.cls}`);
            if (!el) {
                el = document.createElement('div');
                el.className = 'mcfo-skin ' + d.cls;
                el.setAttribute('aria-hidden', 'true');
                el.innerHTML = d.html || '';
                host.prepend(el);
            }
            if (d.place) d.place(el, host);   // scenery that follows the layout
        }
    }
    addEventListener('resize', () => { if (skinActive) ensureDecor(SKINS[skinActive]); });

    // Skins that react to the pointer (6.16: the googly eyes of the multiverse). One listener for
    // the whole page, at most once per frame, and only while the active skin has a pointer hook
    // and effects are not off.
    let skinPointerPending = null;
    addEventListener('pointermove', e => {
        if (!skinActive || !SKINS[skinActive].pointer || skinFxActive === 'off') return;
        if (skinPointerPending) { skinPointerPending.x = e.clientX; skinPointerPending.y = e.clientY; return; }
        skinPointerPending = { x: e.clientX, y: e.clientY };
        requestAnimationFrame(() => {
            const p = skinPointerPending;
            skinPointerPending = null;
            if (p && skinActive && SKINS[skinActive].pointer) SKINS[skinActive].pointer(p.x, p.y);
        });
    }, { passive: true });

    // Particles: one canvas per system, prepended to its host, under the host's content.
    const skinCanvases = new Map();   // name -> { cvs, host, sys, state, w, h }
    let skinLoop = 0, skinLast = 0;

    function ensureParticles(skin) {
        const want = skinFxActive === 'full' ? (skin.particles || []) : [];
        for (const [name, p] of skinCanvases) {
            const sys = want.find(s => s.name === name);
            if (!sys || !p.cvs.isConnected || sys.host() !== p.host) { p.cvs.remove(); skinCanvases.delete(name); }
        }
        for (const sys of want) {
            if (skinCanvases.has(sys.name)) continue;
            const host = sys.host();
            if (!host) continue;
            const cvs = document.createElement('canvas');
            cvs.className = 'mcfo-skin mcfo-skin-canvas';
            cvs.setAttribute('aria-hidden', 'true');
            host.prepend(cvs);
            skinCanvases.set(sys.name, { cvs, host, sys, state: null, w: 0, h: 0 });
        }
        if (skinCanvases.size && !skinLoop) skinLoop = requestAnimationFrame(skinFrame);
    }

    function skinFrame(now) {
        skinLoop = 0;
        if (!skinCanvases.size) return;
        skinLoop = requestAnimationFrame(skinFrame);
        if (document.hidden || now - skinLast < 1000 / 30) return;
        const dt = skinLast ? Math.min(0.1, (now - skinLast) / 1000) : 1 / 30;
        skinLast = now;
        for (const p of skinCanvases.values()) {
            const w = p.host.clientWidth, h = p.host.clientHeight;
            if (!w || !h) continue;
            if (w !== p.w || h !== p.h) {
                p.cvs.width = w;
                p.cvs.height = h;
                p.w = w;
                p.h = h;
                p.state = p.sys.init(w, h);
            }
            const g = p.cvs.getContext('2d');
            if (g) p.sys.step(g, p.state, w, h, dt, now);
        }
    }

    function clearSkin() {
        for (const p of skinCanvases.values()) p.cvs.remove();
        skinCanvases.clear();
        document.querySelectorAll('.mcfo-skin').forEach(el => el.remove());
    }

    // On every theme pass: the skin of the current theme, its effect level, its scenery.
    function skinTick() {
        const id = theme && theme.skin && SKINS[theme.skin] ? theme.skin : null;
        const fx = id ? skinFxEffective() : null;
        const root = document.documentElement;
        if (id !== skinActive) {
            clearSkin();
            skinActive = id;
            if (id) root.setAttribute('data-mcfo-skin', id); else root.removeAttribute('data-mcfo-skin');
            skinStyle.textContent = id ? skinCssText(id) : '';
        }
        if (fx !== skinFxActive) {
            skinFxActive = fx;
            if (fx) root.setAttribute('data-mcfo-fx', fx); else root.removeAttribute('data-mcfo-fx');
        }
        if (!id) return;
        ensureDecor(SKINS[id]);
        ensureParticles(SKINS[id]);
    }

    // =========================================================================================
    // 3d. MORE DELUXE THEMES: THE KIT, THE GAMES, THE SIGNATURE THEMES
    // =========================================================================================
    // Minecraft and the TARDIS are written out rule by rule. With a dozen more that would be a
    // dozen copies of the same fifty rules, so the rest describe themselves to a kit instead:
    // the ground, header, cards, footer, chat, buttons, the buttons whose colour means
    // something, popups, windows and the settings tiles, each as a few values. kitCss turns them
    // into the full sheet, reaching every place 6.6 and 6.7 taught the skins to reach. What makes
    // a theme itself — scenery, particles, pixel art, the odd special button — comes on top.
    //
    // Signature themes belong to one account each (owner). They are offered only while that
    // account is signed in, and applied only then: signed in as someone else, the page keeps the
    // stock look. The name is the one the game shows on the account card.
    const ARCADE_FONT = '"Press Start 2P", "Pixelify Sans", "Silkscreen", ui-monospace, monospace';
    const FANTASY_FONT = '"Friz Quadrata", "Cinzel", "Trajan Pro", "Palatino Linotype", "Book Antiqua", Georgia, serif';
    const INDUSTRIAL_FONT = 'Bahnschrift, "DIN Alternate", "DIN Condensed", "Roboto Condensed", "Arial Narrow", sans-serif';
    const ROUND_FONT = '"Nunito", "Quicksand", "Varela Round", "Comfortaa", ui-rounded, "Segoe UI", system-ui, sans-serif';

    // The signed-in player's name as the game writes it on the card ("<name> · Twitch"), or
    // null while signed out or before the game has drawn the card.
    function accountName() {
        const card = role('profile-entry');
        if (!card || card.getAttribute('aria-disabled') !== 'true') return null;
        const text = ((role('profile-name') || {}).textContent || '').split(' · ')[0].trim();
        return text || null;
    }
    function themeVisible(t) {
        if (!t || !t.owner) return true;
        return (accountName() || '').toLowerCase() === t.owner.toLowerCase();
    }

    function kitCss(S, k) {
        const H = k.header, F = k.footer, K = k.cards, C = k.chat, B = k.btn, P = k.popup, W = k.win, L = k.panel;
        const title = k.titleCss || '';
        const buttons = [...SKIN_BUTTONS, '[data-role="nav-region"] > :is(button, a)'];
        return `
        ${S} [data-role="shell"] { background: ${k.ground} !important; }
        ${S} [data-role="top-status-region"] { background: ${H.bg} !important; border-bottom: ${H.border || '0'} !important; ${H.extra || ''} }
        ${S} [data-role="top-status-region"] :is([data-role="metric-cell"], [data-role="session-cell"], [data-role="profile-entry"]) {
            background: ${K.bg} !important; border: ${K.border} !important; border-radius: ${K.radius} !important; box-shadow: ${K.shadow || 'none'} !important;
        }
        ${S} [data-role="action-region"] { position: relative; background: ${F.bg} !important; border-top: ${F.border || '0'} !important; ${F.extra || ''} }
        ${S} .mcf-chat {
            background: ${C.bg} !important; border: ${C.border} !important; border-radius: ${C.radius} !important;
            box-shadow: ${C.shadow || 'none'} !important; ${C.pad ? `padding: ${C.pad} !important;` : ''}
        }
        ${S} .mcf-chat[data-collapsed="true"] { padding: 0 !important; }
        ${S} .mcf-chat[data-collapsed="true"] > .mcfo-skin { display: none; }
        ${S} .mcf-chat__header { background: ${C.head} !important; border-bottom: ${C.headBorder || '0'} !important; }
        ${S} .mcf-chat__header :is(.mcf-chat__title, .mcf-chat__title strong, .mcf-chat__room) { color: ${C.headText} !important; }
        ${S} .mcf-chat__body { background: ${C.body || 'transparent'} !important; }
        ${S} .mcf-chat__composer { background: ${C.comp} !important; border-top: ${C.compBorder || '0'} !important; }
        ${S} .mcf-chat__input {
            background: ${C.input.bg} !important; border: ${C.input.border} !important; color: ${C.input.color} !important; border-radius: ${C.input.radius} !important;
        }
        ${S} .mcf-chat__input::placeholder { color: ${C.input.hint || 'rgba(150, 150, 150, 0.9)'}; }
        ${skinSel(S, buttons)} {
            background: ${B.bg} !important; color: ${B.color} !important; border: ${B.border} !important; border-radius: ${B.radius} !important;
            box-shadow: ${B.shadow || 'none'} !important; ${B.extra || ''}
        }
        ${skinSel(S, buttons, ':hover:not(:disabled)')} { ${B.hover || ''} }
        ${skinSel(S, SKIN_BUTTONS, ':disabled')} { opacity: 0.6; }
        ${skinSel(S, SKIN_FILLED)} {
            border-radius: ${k.filled.radius} !important; ${k.filled.border ? `border: ${k.filled.border} !important;` : ''} box-shadow: ${k.filled.shadow || 'none'} !important;
        }
        ${skinSel(S, SKIN_EDGED)} { border-radius: ${k.filled.radius} !important; }
        ${skinSel(S, SKIN_POPUPS)} {
            background: ${P.bg} !important; border: ${P.border} !important; border-radius: ${P.radius} !important;
            box-shadow: ${P.shadow || 'none'} !important; outline: none !important;
        }
        ${S} .mcfo-menu > button:hover, ${S} .mcf-chat__suggestion:hover { background: ${P.hover} !important; border-color: transparent !important; }
        ${S} :is(.mcfo-events__head, .mcfo-bev__head) { color: ${P.head || W.title} !important; ${title} }
        ${S} .mcfo-win { border: ${W.border} !important; border-radius: ${W.radius} !important; box-shadow: ${W.shadow || 'none'} !important; }
        ${S} .mcfo-win__head { background: ${W.head} !important; border-bottom: ${W.headBorder || '0'} !important; }
        ${S} .mcfo-win__title { color: ${W.title} !important; }
        ${S} :is(.mcf-chat__title strong, .mcfo-win__title) { ${title} }
        ${skinSel(S, SKIN_PANELS)} { border-radius: ${L.radius} !important; }
        ${skinSel(S, ['.mcfo-set__tile', '.mcfo-theme__pick'])} { border-color: ${L.border} !important; }
        ${S} .mcfo-theme__pick[aria-pressed="true"] { border-color: ${L.pressed} !important; box-shadow: inset 0 0 0 1px ${L.pressed} !important; }
        `;
    }

    // A chat on a light ground (a screen, parchment): dark text, names and times — but only the
    // plain ones. Cosmetic text and names keep what their owner equipped; royal lines their gold.
    function lightChatCss(S, ink, dim) {
        return `
        ${S} .mcf-chat__messages { color: ${ink}; }
        ${S} .mcf-chat__message:not(.mcf-chat__message--cosmetic):not(.mcf-chat__message--royal) .mcf-chat__text:not([class*="mcf-chat__text--"]) { color: ${ink} !important; }
        ${S} .mcf-chat__message:not(.mcf-chat__message--royal) .mcf-chat__sender:not([class*="mcf-chat__username-"]) { color: ${ink} !important; }
        ${S} .mcf-chat__message:not(.mcf-chat__message--royal) .mcf-chat__meta { color: ${dim} !important; }
        ${S} .mcf-chat__status { color: ${dim} !important; }`;
    }

    function deluxe(def) {
        return {
            assets: def.assets || (() => ({})),
            css: (S, A, fx) => kitCss(S, def.kit(A)) + (def.extra ? def.extra(S, A, fx) : ''),
            decor: def.decor || [],
            particles: def.particles || [],
            frame: A => `\nhtml[data-mcfo-theme] body { background: ${def.kit(A).ground} !important; }`,
            tile: def.tile,
            pointer: def.pointer,
        };
    }

    // Scenery over the middle of the board (a strip on top of the footer).
    function placeOverBoard(el, host, frac = 0.46, max = 460) {
        const board = role('main-region') || role('lane-play-region');
        if (!board) return;
        const b = board.getBoundingClientRect(), f = host.getBoundingClientRect();
        if (!b.width || !f.width) return;
        el.style.left = Math.round(b.left + b.width / 2 - f.left) + 'px';
        el.style.width = Math.round(Math.min(max, b.width * frac)) + 'px';
    }

    // Things drifting through a box. make(w, h, anywhere) -> a new one; move(p, dt, now, w, h)
    // false when it has left; draw(g, p, now, w, h).
    function drifters(name, host, count, make, move, draw) {
        return {
            name, host,
            init: (w, h) => ({ list: Array.from({ length: count }, () => make(w, h, true)) }),
            step: (g, st, w, h, dt, now) => {
                g.clearRect(0, 0, w, h);
                for (let i = 0; i < st.list.length; i++) {
                    if (move(st.list[i], dt, now, w, h) === false) st.list[i] = make(w, h, false);
                    draw(g, st.list[i], now, w, h);
                }
                g.globalAlpha = 1;
            },
        };
    }
    const rnd = (a, b) => a + Math.random() * (b - a);
    function glowDot(g, x, y, r, rgb, a) {
        const gr = g.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, `rgba(${rgb}, ${a})`);
        gr.addColorStop(1, `rgba(${rgb}, 0)`);
        g.fillStyle = gr;
        g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    function heartPath(g, x, y, s) {
        g.beginPath();
        g.moveTo(x, y + s * 0.3);
        g.bezierCurveTo(x, y, x - s * 0.5, y, x - s * 0.5, y + s * 0.3);
        g.bezierCurveTo(x - s * 0.5, y + s * 0.6, x, y + s * 0.8, x, y + s);
        g.bezierCurveTo(x, y + s * 0.8, x + s * 0.5, y + s * 0.6, x + s * 0.5, y + s * 0.3);
        g.bezierCurveTo(x + s * 0.5, y, x, y, x, y + s * 0.3);
        g.fill();
    }
    function sparklePath(g, x, y, r) {
        g.beginPath();
        g.moveTo(x, y - r);
        g.quadraticCurveTo(x, y, x + r, y);
        g.quadraticCurveTo(x, y, x, y + r);
        g.quadraticCurveTo(x, y, x - r, y);
        g.quadraticCurveTo(x, y, x, y - r);
        g.fill();
    }
    const pixelArt = (key, rows, pal) => pixelImage(key, rows[0].length, rows.length, (x, y) => pal[rows[y][x]] || null);

    // ---- pixel art and pictures of our own ----
    const SMB = { brick: '#c84c0c', light: '#fcbcb0', dark: '#000000', gold: '#f8b800', mid: '#e45c10', sky: '#5c94fc' };
    const smbBrick = () => pixelImage('smb-brick', 16, 16, (x, y) => {
        const off = (Math.floor(y / 4) % 2) * 4;
        if (y % 4 === 3 || (x + off) % 8 === 7) return SMB.dark;
        return y % 4 === 0 ? SMB.mid : SMB.brick;
    });
    function smbGround() {
        const r = seeded(29);
        return pixelImage('smb-ground', 16, 16, (x, y) => {
            if (x === 0 || y === 0) return SMB.light;
            if (x === 15 || y === 15) return SMB.dark;
            if ((x === 7 && y < 7) || (y === 7 && x > 7 && x < 14)) return SMB.dark;
            return r() < 0.06 ? '#9c3a08' : SMB.brick;
        });
    }
    const QMARK = ['.####.', '##..##', '....##', '...##.', '..##..', '..##..', '......', '..##..'];
    const smbQ = () => pixelImage('smb-q', 16, 16, (x, y) => {
        if (x === 15 || y === 15) return SMB.dark;
        if (x === 0 || y === 0) return SMB.brick;
        if ((x === 2 || x === 13) && (y === 2 || y === 13)) return SMB.dark;
        const gx = x - 5, gy = y - 4;
        const ink = (a, b) => a >= 0 && a < 6 && b >= 0 && b < 8 && QMARK[b][a] === '#';
        if (ink(gx, gy)) return SMB.brick;
        if (ink(gx - 1, gy - 1)) return SMB.dark;
        return SMB.gold;
    });
    const smbClouds = size => [
        'radial-gradient(circle at 18% 30%, #ffffff 0 16px, transparent 17px)', 'radial-gradient(circle at 24% 24%, #ffffff 0 21px, transparent 22px)',
        'radial-gradient(circle at 30% 30%, #ffffff 0 15px, transparent 16px)', 'radial-gradient(circle at 72% 64%, #ffffff 0 12px, transparent 13px)',
        'radial-gradient(circle at 77% 58%, #ffffff 0 17px, transparent 18px)', 'radial-gradient(circle at 82% 64%, #ffffff 0 11px, transparent 12px)',
    ].map(l => `${l} 0 0 / ${size}`).join(', ');

    const TET = ['#00f0f0', '#f0f000', '#a000f0', '#00f000', '#f00000', '#0000f0', '#f0a000'];
    const tetrisRow = (key, order) => pixelImage(key, order.length * 8, 8, (x, y) => {
        const c = TET[order[Math.floor(x / 8)]], lx = x % 8;
        if (lx === 0 || y === 0) return shade(c, 0.45);
        if (lx === 7 || y === 7) return shade(c, -0.45);
        return c;
    });
    const TETROMINOES = [
        [[0, 0], [1, 0], [2, 0], [3, 0]], [[0, 0], [1, 0], [0, 1], [1, 1]], [[0, 0], [1, 0], [2, 0], [1, 1]],
        [[1, 0], [2, 0], [0, 1], [1, 1]], [[0, 0], [1, 0], [1, 1], [2, 1]], [[0, 0], [0, 1], [1, 1], [2, 1]], [[2, 0], [0, 1], [1, 1], [2, 1]],
    ];
    function bevelSquare(g, x, y, s, c) {
        g.fillStyle = c; g.fillRect(x, y, s, s);
        g.fillStyle = 'rgba(255, 255, 255, 0.5)'; g.fillRect(x, y, s, 2); g.fillRect(x, y, 2, s);
        g.fillStyle = 'rgba(0, 0, 0, 0.45)'; g.fillRect(x, y + s - 2, s, 2); g.fillRect(x + s - 2, y, 2, s);
    }

    const ghostSvg = color => svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 14 14"><path fill="${color}" d="M1 14V6a6 6 0 0 1 12 0v8l-2-2-2 2-2-2-2 2-2-2z"/>`
        + '<circle cx="4.6" cy="6" r="1.8" fill="#fff"/><circle cx="9.4" cy="6" r="1.8" fill="#fff"/><circle cx="5.2" cy="6.3" r="0.9" fill="#2121de"/><circle cx="10" cy="6.3" r="0.9" fill="#2121de"/></svg>');
    const triforceSvg = () => svgUrl('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 21"><path fill="#f0d890" stroke="#8c7133" stroke-width="0.6" d="M12 0L18 10.5H6z M6 10.5L12 21H0z M18 10.5L24 21H12z"/></svg>');
    const flourishSvg = () => svgUrl('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 12"><path d="M0 6H44C50 6 52 1 56 1S60 6 60 6 60 11 64 11 70 6 76 6H120" fill="none" stroke="#e9eef5" stroke-width="1"/><circle cx="60" cy="6" r="2.4" fill="#e9eef5"/></svg>');
    function diceSvg(n) {
        const pips = { 5: [[6, 6], [18, 6], [12, 12], [6, 18], [18, 18]], 6: [[6, 6], [18, 6], [6, 12], [18, 12], [6, 18], [18, 18]] }[n];
        return svgUrl('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect x="1" y="1" width="22" height="22" rx="5" fill="#f5f0e1" stroke="#b3001b" stroke-width="1.2"/>'
            + pips.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.2" fill="#b3001b"/>`).join('') + '</svg>');
    }
    const STUDS = (col, size) => `radial-gradient(circle at 45% 40%, rgba(255, 255, 255, 0.35) 0 ${size * 0.14}px, transparent ${size * 0.17}px) 0 0 / ${size}px ${size}px,
        radial-gradient(circle, ${col} 0 ${size * 0.3}px, rgba(0, 0, 0, 0.28) ${size * 0.3}px ${size * 0.36}px, transparent ${size * 0.38}px) 0 0 / ${size}px ${size}px`;

    // Real cuneiform for the Ninkasi theme: line 3 of the Hymn to Ninkasi (ETCSL 4.23.1),
    //   dnin-ka-si a zal-le u3-tud-da — "Ninkasi, given birth by the flowing water".
    // Signs AN.NIN.KA.SI  A  NI.LI  IGI.DIB.TU.DA, each checked against the Oracc Sign List (zal is a
    // value of NI, le of LI, u3 is IGI.DIB). Few systems have a cuneiform font and this script loads
    // nothing from elsewhere, so the signs are baked in as outlines: the glyphs of Noto Sans
    // Cuneiform (© Google LLC, SIL Open Font License 1.1). The characters themselves stay out of the
    // source — like emoji, they sit outside the basic plane.
    // Each entry: advance, [x, y, width, height] of the sign, path — font units, y pointing down.
    const CUNEIFORM = {
        AN: [1048, [100, -736, 848, 848], 'M494 112Q494 15 490 -72Q487 -159 481 -236Q420 -157 376 -89Q332 -21 301 33Q246 -56 148 -120Q202 -151 270 -195Q337 -239 417 -300Q318 -287 239 -270Q160 -254 100 -237Q112 -294 112 -348Q112 -402 100 -453Q153 -438 220 -424Q287 -409 369 -397Q304 -445 248 -481Q191 -517 144 -544Q242 -609 297 -697Q325 -648 364 -586Q404 -525 457 -454Q444 -541 429 -611Q414 -681 399 -736Q450 -724 504 -724Q558 -724 615 -736Q598 -674 582 -592Q565 -511 551 -408Q612 -459 678 -520Q744 -581 815 -652L833 -634Q762 -563 702 -498Q642 -432 590 -371Q669 -365 758 -362Q848 -358 948 -358V-332Q840 -332 744 -328Q649 -324 566 -316Q620 -251 686 -179Q751 -107 829 -30L811 -12Q736 -86 667 -150Q598 -213 535 -266Q528 -184 524 -90Q520 5 520 112Z'],
        NIN: [1430, [100, -727, 1230, 871], 'M245 144Q219 103 191 73Q163 43 130 18L172 1Q168 -67 163 -140Q158 -213 152 -283Q145 -353 137 -414Q129 -475 120 -520Q111 -565 100 -587Q120 -583 140 -581Q161 -579 182 -579Q169 -585 156 -591Q143 -597 130 -601Q163 -626 191 -656Q219 -686 245 -727Q266 -685 308 -627Q349 -569 420 -492Q490 -415 598 -314L585 -301H589V-282Q588 -282 587 -282Q586 -281 585 -281L598 -269Q490 -168 420 -91Q349 -14 308 44Q266 101 245 144ZM1240 83Q1239 66 1237 46Q1235 25 1233 3Q1173 8 1097 14Q1021 20 940 26Q859 33 784 41Q709 49 650 59Q591 69 561 82Q565 61 567 40Q569 20 569 -2Q569 -22 567 -44Q565 -66 561 -89Q575 -83 600 -78Q625 -72 657 -67Q651 -105 645 -156Q639 -206 632 -260Q626 -314 620 -362Q613 -410 607 -445Q601 -480 595 -493Q628 -487 669 -487Q686 -487 702 -488Q719 -489 735 -493Q730 -482 724 -447Q717 -412 710 -362Q702 -313 695 -258Q688 -204 682 -153Q676 -102 672 -65Q730 -57 803 -50Q876 -44 954 -38Q1032 -33 1104 -29Q1176 -25 1231 -22L1221 -182Q1180 -176 1128 -170Q1077 -165 1023 -160Q969 -154 921 -148Q873 -142 839 -136Q805 -131 793 -126Q799 -159 799 -200Q799 -217 798 -234Q797 -250 793 -266Q804 -262 838 -256Q871 -250 919 -244Q967 -237 1021 -230Q1075 -224 1127 -218Q1179 -213 1219 -209Q1217 -244 1214 -280Q1211 -315 1208 -350Q1167 -345 1116 -340Q1065 -334 1014 -328Q962 -323 916 -318Q870 -312 837 -306Q804 -301 793 -296Q799 -329 799 -370Q799 -387 798 -404Q797 -420 793 -436Q803 -432 836 -426Q868 -420 914 -414Q959 -408 1011 -402Q1063 -395 1114 -390Q1165 -384 1206 -380Q1202 -435 1196 -486Q1191 -536 1185 -579Q1110 -573 1025 -566Q940 -560 860 -552Q780 -543 717 -532Q654 -522 621 -508Q625 -529 627 -550Q629 -570 629 -592Q629 -612 627 -634Q625 -656 621 -679Q642 -670 686 -662Q731 -654 790 -648Q849 -641 916 -635Q983 -629 1050 -624Q1118 -620 1179 -617Q1170 -675 1159 -702Q1180 -698 1200 -696Q1221 -694 1243 -694Q1263 -694 1285 -696Q1307 -698 1330 -702Q1321 -680 1313 -626Q1305 -573 1298 -500Q1291 -427 1286 -345Q1280 -263 1276 -182Q1271 -101 1268 -32Q1264 37 1262 83ZM202 -13Q273 -50 364 -114Q455 -179 575 -279Q531 -272 480 -264Q428 -256 379 -248Q330 -239 293 -231Q256 -223 240 -216Q246 -249 246 -290Q246 -307 245 -324Q244 -340 240 -356Q254 -350 292 -342Q329 -334 380 -326Q430 -317 482 -310Q534 -304 577 -301Q478 -384 400 -442Q321 -501 257 -539Q248 -499 240 -439Q232 -379 224 -308Q217 -236 212 -160Q206 -84 202 -13Z'],
        KA: [1839, [100, -736, 1639, 848], 'M728 112V71Q643 30 544 -12Q445 -54 355 -89L349 15H330Q330 -5 329 -35Q328 -65 326 -100Q240 -134 178 -156Q116 -178 100 -179Q122 -205 140 -241Q157 -277 169 -308Q157 -340 140 -376Q122 -412 100 -437Q112 -438 150 -451Q189 -464 246 -486Q304 -507 372 -534Q441 -561 513 -592Q585 -623 653 -654Q648 -676 643 -696Q638 -717 633 -736Q684 -724 738 -724Q792 -724 849 -736Q841 -707 833 -673Q825 -639 817 -601Q835 -597 880 -591Q924 -585 986 -578Q1049 -572 1122 -566Q1196 -559 1274 -554Q1352 -548 1427 -544Q1502 -540 1567 -538Q1557 -597 1546 -646Q1534 -695 1523 -736Q1574 -724 1628 -724Q1682 -724 1739 -736Q1716 -653 1694 -534Q1672 -414 1658 -254Q1644 -94 1644 112H1618Q1618 53 1616 -2Q1615 -57 1613 -109Q1557 -108 1479 -104Q1401 -101 1314 -95Q1228 -89 1143 -82Q1058 -75 986 -68Q915 -60 868 -54Q820 -48 809 -43Q812 -62 814 -84Q817 -106 817 -129Q817 -167 809 -202Q820 -197 865 -190Q910 -184 978 -177Q1046 -170 1128 -162Q1210 -155 1296 -149Q1383 -143 1464 -140Q1545 -136 1611 -135Q1605 -245 1595 -338Q1585 -432 1572 -510Q1511 -508 1434 -504Q1358 -500 1276 -494Q1194 -488 1116 -482Q1037 -475 972 -468Q906 -461 863 -455Q820 -449 809 -445Q812 -464 814 -486Q817 -508 817 -531Q817 -545 816 -558Q815 -570 813 -583Q790 -467 773 -310Q756 -153 754 53Q773 63 790 72Q807 82 822 90L810 111Q797 104 783 97Q769 90 754 83V112ZM364 -203Q378 -220 388 -238Q399 -255 409 -280H408Q427 -300 439 -320Q451 -339 464 -367Q463 -367 462 -368Q462 -368 461 -368Q481 -389 493 -408Q505 -428 518 -458Q533 -437 565 -408Q597 -379 636 -349Q676 -319 710 -293L699 -393Q655 -416 608 -434Q562 -451 519 -458Q539 -479 551 -498Q563 -518 576 -548Q593 -523 626 -493Q659 -463 693 -434Q686 -486 678 -532Q670 -579 661 -619Q601 -583 535 -542Q469 -501 406 -460Q344 -420 294 -386Q314 -382 335 -382Q359 -382 392 -388Q383 -366 376 -314Q369 -263 364 -203ZM317 -215Q312 -267 305 -312Q298 -357 288 -382Q252 -358 225 -338Q198 -319 184 -308Q201 -294 236 -270Q271 -246 317 -215ZM720 -159Q719 -185 717 -210Q715 -236 713 -261Q676 -283 632 -305Q587 -327 544 -344Q501 -361 467 -367Q481 -349 512 -322Q542 -295 580 -265Q617 -235 654 -207Q692 -179 720 -159ZM726 -31Q725 -57 724 -82Q723 -108 721 -132Q691 -150 650 -174Q608 -197 563 -220Q518 -242 478 -258Q437 -275 410 -280Q421 -265 448 -240Q476 -216 514 -187Q551 -158 591 -128Q631 -99 667 -74Q703 -48 726 -31ZM727 38Q727 27 727 16Q727 4 726 -6Q704 -20 668 -40Q633 -61 590 -84Q548 -107 505 -128Q462 -149 424 -165Q387 -181 362 -187V-185Q419 -149 482 -109Q546 -69 609 -32Q672 6 727 38Z'],
        SI: [1137, [100, -749, 937, 906], 'M200 157Q206 127 210 98Q213 70 213 44Q213 18 210 -8Q206 -34 200 -59Q258 -43 324 -28Q391 -14 463 -3Q460 -92 452 -157Q444 -222 432 -271Q419 -320 404 -363Q388 -406 370 -452Q400 -445 428 -442Q457 -439 483 -439Q537 -439 586 -452Q568 -406 552 -363Q536 -320 524 -270Q511 -220 503 -154Q495 -89 492 1Q594 17 702 26Q810 35 914 36Q912 -41 906 -128Q899 -216 890 -305Q880 -394 868 -476Q857 -559 845 -626Q770 -624 686 -618Q602 -611 518 -602Q433 -592 354 -581Q276 -570 210 -558Q145 -545 100 -533Q106 -563 110 -592Q113 -620 113 -646Q113 -672 110 -698Q106 -724 100 -749Q166 -731 254 -715Q343 -699 444 -686Q544 -674 646 -666Q747 -658 839 -655Q830 -702 821 -736Q851 -729 880 -726Q908 -723 934 -723Q988 -723 1037 -736Q1021 -677 1006 -596Q992 -516 980 -424Q968 -333 960 -238Q951 -143 946 -53Q942 37 942 112H916Q916 100 916 88Q915 75 915 62Q822 62 722 70Q622 79 526 93Q429 107 346 124Q262 140 200 157Z'],
        A: [727, [100, -736, 527, 848], 'M513 112Q504 22 494 -48Q484 -118 472 -176Q461 -233 446 -283Q431 -333 410 -383Q434 -379 458 -376Q482 -373 507 -373Q484 -511 459 -598Q434 -686 411 -736Q440 -732 468 -730Q497 -727 527 -727Q552 -727 577 -729Q602 -731 627 -736Q608 -688 578 -596Q549 -504 534 -373Q556 -374 578 -376Q601 -379 626 -383Q592 -300 570 -180Q547 -61 539 112ZM195 112Q195 -93 181 -253Q167 -413 145 -533Q123 -653 100 -736Q151 -724 205 -724Q259 -724 316 -736Q293 -653 271 -534Q249 -414 235 -254Q221 -94 221 112Z'],
        NI: [1354, [100, -723, 1154, 1032], 'M232 309Q232 225 229 155Q210 165 194 174Q177 183 165 191Q159 132 143 80Q127 29 100 -14Q148 -16 214 -26Q202 -124 184 -202Q165 -280 139 -351Q190 -339 244 -339Q298 -339 355 -351Q330 -282 311 -206Q292 -131 280 -37Q354 -51 439 -70Q427 -152 410 -220Q392 -288 369 -351Q420 -339 474 -339Q528 -339 585 -351Q563 -291 546 -228Q529 -164 517 -87Q624 -112 740 -142Q857 -172 976 -204Q1095 -235 1207 -266Q1084 -300 954 -334Q824 -369 698 -401Q571 -433 458 -458Q344 -483 252 -499Q160 -515 100 -518Q127 -562 143 -614Q159 -665 165 -723Q202 -700 272 -666Q342 -631 435 -591Q528 -551 634 -508Q740 -464 850 -422Q959 -380 1063 -342Q1167 -305 1254 -276L1249 -266L1254 -256Q1175 -230 1081 -196Q987 -163 888 -125Q788 -87 690 -48Q592 -9 503 29Q497 89 494 158Q492 228 492 309H462Q462 235 460 171Q457 107 452 51Q399 74 352 96Q304 117 266 137Q264 176 263 219Q262 262 262 309Z'],
        LI: [1907, [100, -736, 1707, 848], 'M1698 112Q1691 -1 1684 -91Q1677 -181 1671 -253Q1645 -268 1615 -284Q1585 -301 1553 -320Q1490 -274 1424 -225Q1358 -176 1300 -132Q1243 -87 1203 -52Q1163 -18 1150 -1Q1133 -43 1112 -73Q1091 -103 1062 -131Q1088 -136 1134 -157Q1087 -153 1033 -146Q979 -140 928 -133Q878 -126 840 -119Q803 -112 789 -106Q795 -139 795 -175Q795 -187 794 -200Q793 -213 791 -226L789 -225Q789 -229 790 -231Q789 -232 789 -236L790 -235Q792 -250 794 -266Q795 -281 795 -297Q795 -317 792 -339L785 -334L778 -340Q750 -287 728 -246Q706 -204 686 -169Q703 -141 732 -97Q762 -53 803 1L785 16Q709 -52 657 -94Q605 -136 560 -169Q580 -186 612 -215Q645 -244 683 -281Q721 -318 757 -358Q693 -414 647 -452Q601 -489 560 -519Q582 -538 618 -570Q653 -601 694 -642Q735 -682 772 -725L792 -714Q758 -653 734 -605Q709 -557 686 -519Q701 -493 728 -453Q755 -413 792 -363Q795 -387 795 -412Q795 -425 794 -438Q793 -451 791 -464L789 -463Q789 -467 790 -469Q789 -470 789 -474L790 -473Q792 -488 794 -502Q795 -517 795 -533Q795 -562 789 -593Q801 -588 837 -581Q873 -574 922 -567Q972 -560 1026 -554Q1079 -548 1126 -543Q1106 -551 1090 -558Q1073 -564 1062 -566Q1091 -594 1112 -624Q1133 -654 1150 -696Q1163 -678 1204 -644Q1244 -609 1302 -564Q1359 -520 1424 -472Q1489 -423 1551 -378Q1578 -394 1604 -408Q1629 -423 1652 -436Q1644 -496 1635 -546Q1626 -595 1616 -641Q1605 -687 1591 -736Q1642 -724 1696 -724Q1750 -724 1807 -736Q1793 -686 1782 -630Q1771 -575 1762 -507Q1753 -439 1746 -352Q1739 -264 1734 -150Q1728 -36 1724 112ZM325 16Q249 -52 197 -94Q145 -136 100 -169Q120 -186 152 -215Q185 -244 223 -281Q261 -318 297 -358Q233 -414 187 -452Q141 -489 100 -519Q122 -538 158 -570Q193 -601 234 -642Q275 -682 312 -725L332 -714Q298 -653 274 -605Q249 -557 226 -519Q243 -491 272 -447Q302 -403 343 -349L325 -334L318 -340Q290 -287 268 -246Q246 -204 226 -169Q243 -141 272 -97Q302 -53 343 1ZM613 -382Q570 -421 544 -444Q518 -468 498 -484Q478 -501 451 -519Q469 -535 490 -551Q510 -567 540 -590Q569 -614 613 -653L628 -643Q606 -609 590 -578Q575 -548 559 -519Q575 -491 590 -460Q606 -430 628 -395ZM503 -382Q460 -421 434 -444Q408 -468 388 -484Q368 -501 341 -519Q359 -535 380 -551Q400 -567 430 -590Q459 -614 503 -653L518 -643Q496 -609 480 -578Q465 -548 449 -519Q465 -491 480 -460Q496 -430 518 -395ZM393 -382Q350 -421 324 -444Q298 -468 278 -484Q258 -501 231 -519Q249 -535 270 -551Q290 -567 320 -590Q349 -614 393 -653L408 -643Q386 -609 370 -578Q355 -548 339 -519Q355 -491 370 -460Q386 -430 408 -395ZM1168 -420V-517Q1126 -514 1074 -508Q1022 -503 970 -496Q917 -489 874 -482Q830 -475 806 -468Q830 -462 874 -455Q917 -448 970 -442Q1022 -435 1074 -429Q1127 -423 1168 -420ZM1197 -186Q1263 -218 1342 -262Q1422 -306 1500 -349Q1423 -393 1343 -436Q1263 -479 1197 -511ZM1168 -301V-398Q1127 -395 1075 -390Q1023 -384 970 -377Q917 -370 874 -363Q830 -356 805 -349Q829 -343 873 -336Q917 -329 970 -322Q1023 -316 1075 -310Q1127 -304 1168 -301ZM1667 -294Q1665 -322 1662 -347Q1659 -372 1657 -395L1592 -348ZM503 -32Q460 -71 434 -94Q408 -118 388 -134Q368 -151 341 -169Q359 -185 380 -201Q400 -217 430 -240Q459 -264 503 -303L518 -293Q496 -259 480 -228Q465 -198 449 -169Q465 -141 480 -110Q496 -80 518 -45ZM613 -32Q570 -71 544 -94Q518 -118 498 -134Q478 -151 451 -169Q469 -185 490 -201Q510 -217 540 -240Q569 -264 613 -303L628 -293Q606 -259 590 -228Q575 -198 559 -169Q575 -141 590 -110Q606 -80 628 -45ZM393 -32Q350 -71 324 -94Q298 -118 278 -134Q258 -151 231 -169Q249 -185 270 -201Q290 -217 320 -240Q349 -264 393 -303L408 -293Q386 -259 370 -228Q355 -198 339 -169Q355 -141 370 -110Q386 -80 408 -45ZM1168 -183V-279Q1127 -276 1075 -270Q1023 -265 970 -258Q918 -251 874 -244Q831 -237 806 -230Q830 -224 874 -217Q917 -210 970 -204Q1022 -197 1074 -192Q1126 -186 1168 -183Z'],
        U3: [1829, [100, -757, 1629, 869], 'M960 107Q964 86 966 66Q968 45 968 23Q968 16 968 9Q967 2 967 -5H960Q955 -33 950 -80Q945 -128 940 -186Q935 -245 929 -305Q843 -299 779 -284Q715 -269 662 -249Q608 -229 553 -207Q558 -233 560 -262Q563 -291 563 -322Q563 -351 560 -382Q558 -412 553 -442Q599 -423 650 -403Q702 -383 768 -367Q834 -351 925 -344Q920 -404 914 -457Q909 -510 904 -546Q899 -583 894 -593Q909 -590 926 -588Q942 -587 960 -586Q964 -607 966 -628Q968 -648 968 -670Q968 -690 966 -712Q964 -734 960 -757Q981 -748 1028 -740Q1075 -733 1139 -726Q1203 -719 1276 -714Q1348 -708 1422 -704Q1495 -699 1560 -695L1558 -702Q1579 -698 1600 -696Q1620 -694 1642 -694Q1662 -694 1684 -696Q1706 -698 1729 -702Q1720 -680 1712 -631Q1704 -582 1697 -516Q1690 -449 1684 -374Q1679 -299 1674 -225Q1670 -151 1666 -86Q1663 -21 1661 25V26Q1614 30 1551 35Q1488 40 1418 46Q1349 51 1279 57Q1209 63 1146 70Q1084 78 1036 87Q987 96 960 107ZM474 112Q465 -29 458 -134Q450 -240 444 -320Q438 -400 431 -462Q424 -524 415 -577Q371 -498 339 -435Q307 -372 277 -322Q300 -283 342 -222Q383 -160 441 -84L415 -63Q344 -126 288 -172Q233 -219 188 -255Q142 -291 100 -322Q131 -348 180 -392Q230 -437 288 -493Q345 -549 397 -610L410 -602Q398 -668 379 -736Q430 -724 484 -724Q538 -724 595 -736Q577 -677 564 -620Q552 -564 542 -500Q533 -435 526 -352Q519 -268 513 -155Q507 -42 500 112ZM1637 3Q1632 -50 1627 -119Q1622 -188 1616 -264Q1611 -339 1604 -413Q1598 -487 1590 -550Q1581 -614 1571 -657Q1507 -652 1434 -647Q1362 -642 1289 -636Q1216 -629 1152 -622Q1087 -615 1037 -606Q987 -597 961 -586Q979 -586 998 -588Q1016 -589 1034 -593Q1030 -584 1024 -547Q1019 -510 1013 -456Q1007 -402 1000 -340H1048V-309Q1035 -309 1022 -308Q1009 -308 997 -308L974 -59Q1007 -49 1066 -41Q1126 -33 1201 -26Q1276 -19 1356 -13Q1435 -7 1508 -3Q1582 1 1637 3ZM1295 -98 1288 -215Q1250 -210 1222 -204Q1194 -198 1168 -191Q1143 -184 1110 -175Q1114 -189 1116 -204Q1117 -219 1117 -234Q1117 -265 1110 -299Q1151 -288 1188 -280Q1226 -271 1284 -265Q1281 -303 1278 -333Q1274 -363 1270 -388Q1222 -381 1188 -372Q1155 -362 1110 -350Q1114 -364 1116 -379Q1117 -394 1117 -409Q1117 -440 1110 -474Q1146 -464 1180 -456Q1213 -448 1261 -442Q1255 -470 1248 -495Q1242 -520 1234 -550Q1264 -542 1293 -542Q1308 -542 1324 -544Q1340 -546 1358 -550Q1351 -522 1344 -495Q1338 -468 1333 -435Q1372 -432 1424 -430Q1475 -427 1542 -425V-411Q1470 -407 1418 -403Q1365 -399 1327 -395Q1324 -368 1321 -336Q1318 -303 1316 -262Q1357 -258 1412 -255Q1467 -252 1542 -250V-236Q1463 -232 1408 -228Q1353 -223 1313 -218Q1312 -192 1311 -162Q1310 -132 1309 -98Z'],
        TU: [1836, [100, -736, 1636, 848], 'M1614 112Q1614 80 1612 41Q1611 2 1608 -40Q1458 -57 1348 -67Q1238 -77 1156 -82Q1075 -86 1010 -86Q943 -86 886 -82Q830 -78 768 -70Q801 -154 801 -253Q801 -261 801 -269Q801 -277 800 -284Q830 -271 862 -258Q894 -244 930 -230Q926 -253 917 -273Q908 -293 897 -312Q905 -311 942 -320Q978 -329 1033 -345Q978 -360 942 -369Q905 -378 897 -378Q907 -395 916 -413Q924 -431 928 -451Q893 -438 862 -424Q830 -411 800 -398Q801 -406 801 -414Q801 -422 801 -429Q801 -528 768 -612Q829 -605 886 -600Q943 -595 1010 -595Q1070 -595 1144 -599Q1218 -603 1315 -612Q1412 -621 1541 -634Q1536 -667 1530 -693Q1525 -719 1520 -736Q1571 -724 1625 -724Q1679 -724 1736 -736Q1727 -705 1716 -646Q1706 -588 1695 -512Q1684 -436 1674 -351Q1665 -266 1657 -181Q1649 -96 1644 -20Q1640 55 1640 112ZM785 -334Q709 -402 657 -444Q605 -486 560 -519Q582 -538 618 -570Q653 -601 694 -642Q735 -682 772 -725L792 -714Q758 -653 734 -605Q709 -557 686 -519Q703 -491 732 -447Q762 -403 803 -349ZM325 -334Q249 -402 197 -444Q145 -486 100 -519Q122 -538 158 -570Q193 -601 234 -642Q275 -682 312 -725L332 -714Q298 -653 274 -605Q249 -557 226 -519Q243 -491 272 -447Q302 -403 343 -349ZM613 -382Q570 -421 544 -444Q518 -468 498 -484Q478 -501 451 -519Q469 -535 490 -551Q510 -567 540 -590Q569 -614 613 -653L628 -643Q606 -609 590 -578Q575 -548 559 -519Q575 -491 590 -460Q606 -430 628 -395ZM503 -382Q460 -421 434 -444Q408 -468 388 -484Q368 -501 341 -519Q359 -535 380 -551Q400 -567 430 -590Q459 -614 503 -653L518 -643Q496 -609 480 -578Q465 -548 449 -519Q465 -491 480 -460Q496 -430 518 -395ZM393 -382Q350 -421 324 -444Q298 -468 278 -484Q258 -501 231 -519Q249 -535 270 -551Q290 -567 320 -590Q349 -614 393 -653L408 -643Q386 -609 370 -578Q355 -548 339 -519Q355 -491 370 -460Q386 -430 408 -395ZM1144 -377Q1212 -397 1285 -420Q1358 -442 1430 -464Q1501 -487 1561 -507L1547 -602Q1401 -577 1292 -553Q1184 -529 1104 -506Q1023 -484 960 -462Q1018 -433 1144 -377ZM1597 -189Q1590 -264 1582 -340Q1573 -417 1564 -486Q1488 -456 1398 -418Q1307 -381 1221 -344Q1287 -316 1355 -288Q1423 -259 1486 -234Q1548 -208 1597 -189ZM785 56Q709 -12 657 -54Q605 -96 560 -129Q582 -148 618 -180Q653 -211 694 -252Q735 -292 772 -335L792 -324Q758 -263 734 -215Q709 -167 686 -129Q703 -101 732 -57Q762 -13 803 41ZM325 56Q249 -12 197 -54Q145 -96 100 -129Q122 -148 158 -180Q193 -211 234 -252Q275 -292 312 -335L332 -324Q298 -263 274 -215Q249 -167 226 -129Q243 -101 272 -57Q302 -13 343 41ZM1606 -70Q1605 -94 1602 -120Q1600 -145 1598 -170Q1542 -190 1466 -214Q1389 -239 1306 -264Q1223 -290 1147 -312Q1079 -283 1028 -260Q976 -236 951 -223Q1018 -199 1106 -174Q1194 -150 1316 -124Q1438 -98 1606 -70ZM503 8Q460 -31 434 -54Q408 -78 388 -94Q368 -111 341 -129Q359 -145 380 -161Q400 -177 430 -200Q459 -224 503 -263L518 -253Q496 -219 480 -188Q465 -158 449 -129Q465 -101 480 -70Q496 -40 518 -5ZM613 8Q570 -31 544 -54Q518 -78 498 -94Q478 -111 451 -129Q469 -145 490 -161Q510 -177 540 -200Q569 -224 613 -263L628 -253Q606 -219 590 -188Q575 -158 559 -129Q575 -101 590 -70Q606 -40 628 -5ZM393 8Q350 -31 324 -54Q298 -78 278 -94Q258 -111 231 -129Q249 -145 270 -161Q290 -177 320 -200Q349 -224 393 -263L408 -253Q386 -219 370 -188Q355 -158 339 -129Q355 -101 370 -70Q386 -40 408 -5Z'],
        DA: [1352, [100, -740, 1152, 852], 'M104 112Q108 91 110 70Q112 50 112 29Q112 9 110 -13Q108 -35 104 -58Q124 -50 147 -43Q170 -36 198 -29Q199 -40 200 -52Q201 -64 201 -75Q201 -95 197 -112Q208 -108 234 -102Q261 -97 296 -92Q331 -87 368 -83Q406 -79 438 -77L432 -177Q388 -170 339 -162Q290 -154 251 -146Q212 -138 197 -130Q198 -144 200 -159Q201 -174 201 -189Q201 -210 197 -227Q208 -223 234 -218Q259 -213 293 -208Q327 -203 364 -199Q400 -195 431 -192Q430 -218 428 -242Q426 -267 424 -291Q381 -284 334 -276Q286 -268 248 -260Q211 -252 197 -245Q198 -259 200 -274Q201 -289 201 -304Q201 -325 197 -342Q211 -337 248 -330Q286 -323 334 -318Q381 -312 423 -308L414 -403Q372 -396 326 -388Q281 -381 246 -374Q211 -366 197 -359Q198 -373 200 -388Q201 -403 201 -418Q201 -439 197 -456Q210 -451 246 -444Q281 -438 326 -432Q371 -427 412 -423Q410 -449 407 -473Q404 -497 401 -516Q360 -509 318 -502Q275 -495 242 -488Q210 -481 197 -474Q198 -491 200 -508Q201 -526 200 -544Q170 -540 145 -534Q120 -529 100 -524Q112 -581 112 -635Q112 -689 100 -740Q190 -715 330 -698Q469 -682 654 -670Q838 -657 1060 -642Q1055 -665 1049 -688Q1043 -711 1036 -736Q1087 -724 1141 -724Q1195 -724 1252 -736Q1238 -686 1227 -630Q1216 -575 1207 -507Q1198 -439 1191 -352Q1184 -264 1178 -150Q1173 -36 1169 112H1143Q1133 -37 1124 -148Q1116 -258 1108 -340Q1099 -422 1090 -485Q1081 -548 1069 -603Q914 -598 770 -591Q626 -584 504 -575Q497 -530 492 -458Q487 -387 482 -298Q511 -287 558 -278Q606 -268 665 -260Q724 -253 788 -247Q853 -241 915 -237Q941 -257 976 -285Q1010 -313 1069 -366L1088 -354Q1063 -316 1046 -283Q1029 -250 1011 -217Q1029 -186 1046 -152Q1063 -118 1088 -79L1069 -64Q1027 -102 1001 -126Q975 -151 956 -168Q936 -185 913 -201Q830 -193 746 -184Q663 -174 593 -161Q523 -148 478 -130Q482 -150 484 -170Q486 -191 486 -212Q486 -229 484 -246Q483 -262 481 -281Q477 -214 474 -141Q471 -68 467 6Q483 7 500 8Q516 9 532 10V32L466 38L462 112H447L444 40Q336 52 254 68Q171 85 104 112ZM397 -539Q396 -547 395 -554Q394 -561 392 -567Q361 -564 332 -561Q302 -558 275 -554Q303 -550 335 -546Q367 -542 397 -539ZM442 5 438 -63Q403 -57 362 -50Q322 -44 286 -38Q249 -31 224 -24Q320 -4 442 5Z'],
    };
    const HYMN_LINE = [['AN', 'NIN', 'KA', 'SI'], ['A'], ['NI', 'LI'], ['U3', 'TU', 'DA']];
    // A line as one repeatable picture: a gap between words, a longer pause before it comes round
    // again. ratio = width / height, for the background size.
    function cuneiformLine(words, c, a = 1) {
        const top = -780, height = 1110;
        const paths = [];
        let x = 0;
        words.forEach((word, i) => {
            if (i) x += 450;
            for (const s of word) { paths.push(`<path transform="translate(${x} 0)" d="${CUNEIFORM[s][2]}"/>`); x += CUNEIFORM[s][0]; }
        });
        x += 1100;
        return { url: svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 ${top} ${x} ${height}"><g fill="${c}" opacity="${a}">${paths.join('')}</g></svg>`), ratio: x / height };
    }
    // One sign on its own, cut to its outline.
    function glyphSvg(sign, c) {
        const [, [x, y, w, h], d] = CUNEIFORM[sign];
        return svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${w} ${h}"><path fill="${c}" d="${d}"/></svg>`);
    }
    const mugSvg = () => svgUrl('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">'
        + '<path d="M16 10h2.5a3 3 0 0 1 3 3v2.5a3 3 0 0 1-3 3H16" fill="none" stroke="#5a2a12" stroke-width="2"/>'
        + '<rect x="3" y="7" width="13" height="15" rx="2" fill="#e8a33d" stroke="#5a2a12" stroke-width="1.2"/>'
        + '<path d="M6 10v9" stroke="rgba(255,255,255,0.6)" stroke-width="1.4"/><circle cx="11" cy="15" r="0.9" fill="#fff1cf"/><circle cx="12.5" cy="11.5" r="0.7" fill="#fff1cf"/>'
        + '<rect x="2.5" y="5" width="14" height="3.5" rx="1.5" fill="#fff8e6"/><circle cx="5" cy="5" r="2.6" fill="#fff8e6"/><circle cx="9.5" cy="4" r="3" fill="#fff8e6"/><circle cx="14" cy="5" r="2.6" fill="#fff8e6"/>'
        + '</svg>');

    Object.assign(SKINS, {
        // ---- Satisfactory: FICSIT steel, hazard stripes, a conveyor over the footer ----
        ficsit: deluxe({
            assets: () => ({
                concrete: mcNoise('ficsit-concrete', ['#5b5e63', '#63666b', '#56595e', '#6a6d72', '#505358'], 31),
                plate: pixelArt('ficsit-plate', ['aabaaaaa', 'abcbaaaa', 'aabaaaaa', 'aaaaaaba', 'aaaaabcb', 'aaaaaaba', 'aaaaaaaa', 'aaaaaaaa'],
                                { a: '#44474d', b: '#5d6168', c: '#7a7f87' }),
            }),
            kit: A => {
                const hazard = 'repeating-linear-gradient(-45deg, #fa9549 0 10px, #1d1d1f 10px 20px)';
                return {
                    titleCss: `font-family: ${INDUSTRIAL_FONT}; text-transform: uppercase; letter-spacing: 0.08em;`,
                    ground: `linear-gradient(rgba(0, 0, 0, 0.55), rgba(0, 0, 0, 0.55)), linear-gradient(rgba(255, 255, 255, 0.06) 2px, transparent 2px) 0 0 / 96px 96px,
                             linear-gradient(90deg, rgba(255, 255, 255, 0.06) 2px, transparent 2px) 0 0 / 96px 96px, url("${A.concrete}") 0 0 / 64px 64px, #3a3c40`,
                    header: { bg: `${hazard} bottom / 100% 6px no-repeat, linear-gradient(180deg, #4a4d54, #2b2d32)`, border: '0' },
                    cards: { bg: 'linear-gradient(180deg, #2f3136, #232428)', border: '1px solid #5a5e66', radius: '3px', shadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.08)' },
                    footer: { bg: 'linear-gradient(180deg, #3d3f45, #26272b)', border: '3px solid #fa9549' },
                    chat: {
                        bg: `linear-gradient(rgba(20, 20, 22, 0.8), rgba(20, 20, 22, 0.8)), url("${A.plate}") 0 0 / 24px 24px, #2e3035`,
                        border: '3px solid #1d1d1f', radius: '4px', shadow: 'inset 0 0 0 2px #5a5e66',
                        head: `${hazard} bottom / 100% 5px no-repeat, linear-gradient(180deg, #fa9549, #e07f35)`, headBorder: '2px solid #1d1d1f', headText: '#1d1d1f',
                        comp: 'linear-gradient(180deg, #3d3f45, #2b2d32)', compBorder: '2px solid #1d1d1f',
                        input: { bg: '#141517', border: '1px solid #fa9549', color: '#ffe2c8', radius: '2px' },
                    },
                    btn: { bg: 'linear-gradient(180deg, #fbab69, #fa9549 55%, #d9772d)', color: '#1d1d1f', border: '1px solid #7a3e10', radius: '3px',
                           shadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.45), 0 2px 0 #7a3e10', hover: 'filter: brightness(1.08);',
                           extra: `font-family: ${INDUSTRIAL_FONT}; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase;` },
                    filled: { radius: '3px', border: '1px solid #1d1d1f', shadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.3), 0 2px 0 rgba(0, 0, 0, 0.45)' },
                    popup: { bg: 'rgba(34, 35, 39, 0.97)', border: '2px solid #5a5e66', radius: '4px', hover: 'rgba(250, 149, 73, 0.25)', head: '#fa9549',
                             shadow: '0 0 0 2px #1d1d1f, inset 0 4px 0 #fa9549, 0 12px 30px rgba(0, 0, 0, 0.6)' },
                    win: { border: '2px solid #5a5e66', radius: '4px', shadow: '0 0 0 2px #1d1d1f, 0 16px 40px rgba(0, 0, 0, 0.6)',
                           head: `${hazard} bottom / 100% 4px no-repeat, linear-gradient(180deg, #fa9549, #e07f35)`, headBorder: '2px solid #1d1d1f', title: '#1d1d1f' },
                    panel: { radius: '3px', border: '#5a5e66', pressed: '#fa9549' },
                };
            },
            extra: (S, A, fx) => `
                ${S} .mcfo-ficsit-belt {
                    position: absolute; top: 0; transform: translate(-50%, -100%); height: 12px; z-index: 3; pointer-events: none; overflow: hidden;
                    background: repeating-linear-gradient(90deg, #1b1c1f 0 3px, #2c2d31 3px 14px); border-top: 2px solid #5a5e66; border-bottom: 2px solid #5a5e66;
                }
                ${fx(['full'], '.mcfo-ficsit-belt')} { animation: mcfoBelt 0.7s linear infinite; }
                @keyframes mcfoBelt { from { background-position: 0 0; } to { background-position: 14px 0; } }`,
            decor: [{ cls: 'mcfo-ficsit-belt', host: () => role('action-region'), html: '', place: (el, host) => placeOverBoard(el, host, 0.5, 520) }],
            particles: [drifters('ficsit-items', () => document.querySelector('.mcfo-ficsit-belt'), 8,
                (w, h, any) => ({ x: any ? rnd(0, w) : rnd(-60, -8), c: pickOf(Math.random, ['#8aa0b8', '#d9773a', '#e8dcc0', '#2a2a2a', '#e0b43a']) }),
                (p, dt, now, w) => (p.x += 20 * dt) < w + 8,
                (g, p, now, w, h) => { g.fillStyle = '#111'; g.fillRect(Math.round(p.x) - 4, Math.max(0, h / 2 - 4), 8, 8); g.fillStyle = p.c; g.fillRect(Math.round(p.x) - 3, Math.max(1, h / 2 - 3), 6, 6); })],
            tile: () => 'background: repeating-linear-gradient(-45deg, #fa9549 0 8px, #1d1d1f 8px 16px) bottom / 100% 8px no-repeat, linear-gradient(180deg, #4a4d54, #2b2d32);',
        }),

        // ---- Super Mario: World 1-1 ----
        mario: deluxe({
            assets: () => ({ brick: smbBrick(), ground: smbGround(), q: smbQ() }),
            kit: A => ({
                titleCss: `font-family: ${ARCADE_FONT}; text-shadow: 2px 2px 0 #000000; letter-spacing: 0.04em;`,
                ground: `${smbClouds('520px 300px')}, #5c94fc`,
                header: { bg: `url("${A.brick}") 0 100% / 24px 24px repeat-x, ${smbClouds('420px 120px')}, #5c94fc`, border: '3px solid #000000' },
                cards: { bg: 'rgba(0, 0, 0, 0.5)', border: '2px solid #000000', radius: '0', shadow: 'inset 2px 2px 0 rgba(255, 255, 255, 0.15)' },
                footer: { bg: `url("${A.ground}") 0 0 / 28px 28px repeat, #c84c0c`, border: '3px solid #000000' },
                chat: {
                    bg: `${smbClouds('300px 220px')}, #5c94fc`, border: '3px solid #000000', radius: '0', body: 'rgba(0, 0, 0, 0.32)',
                    head: `url("${A.brick}") 0 0 / 24px 24px repeat, #c84c0c`, headBorder: '3px solid #000000', headText: '#ffffff',
                    comp: `url("${A.ground}") 0 0 / 24px 24px repeat, #c84c0c`, compBorder: '3px solid #000000',
                    input: { bg: 'rgba(0, 0, 0, 0.72)', border: '2px solid #ffffff', color: '#ffffff', radius: '0' },
                },
                btn: { bg: '#f8b800', color: '#000000', border: '2px solid #000000', radius: '0', shadow: 'inset -3px -3px 0 #c84c0c, inset 3px 3px 0 #fcd87c',
                       hover: 'transform: translateY(-3px); background: #fcd000 !important;', extra: 'font-weight: 800; transition: transform 90ms ease;' },
                filled: { radius: '0', border: '2px solid #000000', shadow: 'inset -3px -3px 0 rgba(0, 0, 0, 0.35), inset 3px 3px 0 rgba(255, 255, 255, 0.35)' },
                popup: { bg: '#a33c08', border: '3px solid #fcbcb0', radius: '6px', hover: 'rgba(0, 0, 0, 0.3)', head: '#fcbcb0', shadow: '0 0 0 3px #000000, 0 12px 30px rgba(0, 0, 0, 0.5)' },
                win: { border: '3px solid #000000', radius: '0', shadow: '0 14px 40px rgba(0, 0, 0, 0.5)', title: '#ffffff', headBorder: '3px solid #000000',
                       head: 'linear-gradient(180deg, #0a5c0a, #3cbc3c 30%, #b8f818 45%, #3cbc3c 60%, #0a5c0a)' },
                panel: { radius: '0', border: '#000000', pressed: '#f8b800' },
            }),
            extra: S => `${S} .mcf-chat__header :is(.mcf-chat__title, .mcf-chat__room) { text-shadow: 2px 2px 0 #000000; }
                ${S} [data-role="top-status-region"], ${S} .mcf-chat__header, ${S} [data-role="action-region"], ${S} .mcf-chat__composer, ${S} [data-role="shell"] { image-rendering: pixelated; }
                ${S} [data-role="top-status-region"] *, ${S} [data-role="action-region"] *, ${S} .mcf-chat__header *, ${S} .mcf-chat__composer * { image-rendering: auto; }`,
            particles: [drifters('coins', () => document.querySelector('.mcf-chat:not([data-collapsed="true"])'), 7,
                (w, h, any) => ({ x: rnd(10, w - 10), y: any ? rnd(0, h) : h + 10, v: rnd(10, 18), ph: rnd(0, 6) }),
                (p, dt) => (p.y -= p.v * dt) > -20,
                (g, p, now) => {
                    const sx = Math.max(0.15, Math.abs(Math.cos(now / 400 + p.ph)));
                    g.globalAlpha = 0.7;
                    g.fillStyle = '#8a5a00'; g.beginPath(); g.ellipse(p.x, p.y, 6 * sx + 1, 8, 0, 0, Math.PI * 2); g.fill();
                    g.fillStyle = '#f8d030'; g.beginPath(); g.ellipse(p.x, p.y, 6 * sx, 7, 0, 0, Math.PI * 2); g.fill();
                    g.fillStyle = '#fff4a0'; g.fillRect(p.x - sx, p.y - 4, Math.max(1, 2 * sx), 8);
                })],
            tile: A => `background: url("${A.q}") center / 30px 30px no-repeat, url("${A.brick}") 0 100% / 16px 16px repeat-x, #5c94fc; image-rendering: pixelated;`,
        }),

        // ---- Zelda: Hyrule green and gold ----
        hyrule: deluxe({
            assets: () => ({ tri: triforceSvg() }),
            kit: () => ({
                titleCss: `font-family: ${FANTASY_FONT}; text-transform: uppercase; letter-spacing: 0.1em;`,
                ground: 'conic-gradient(from 150deg at 50% 30%, rgba(200, 162, 74, 0.07) 0 60deg, transparent 60deg) 0 0 / 80px 70px, radial-gradient(ellipse at 50% -20%, rgba(240, 216, 144, 0.14), transparent 60%), #0f2418',
                header: { bg: 'linear-gradient(180deg, #23452f, #132b1d)', border: '2px solid #c8a24a', extra: 'box-shadow: inset 0 -4px 0 #0f2418, inset 0 -5px 0 rgba(200, 162, 74, 0.55) !important;' },
                cards: { bg: 'rgba(8, 20, 13, 0.78)', border: '1px solid #c8a24a', radius: '4px' },
                footer: { bg: 'linear-gradient(180deg, #132b1d, #23452f)', border: '2px solid #c8a24a' },
                chat: {
                    bg: 'radial-gradient(ellipse at 50% 0%, rgba(240, 216, 144, 0.08), transparent 60%), #0e2016', border: '2px solid #c8a24a', radius: '6px',
                    shadow: '0 0 0 3px #0f2418, 0 0 0 4px rgba(200, 162, 74, 0.5)',
                    head: 'linear-gradient(180deg, #2a5238, #16301f)', headBorder: '2px solid #c8a24a', headText: '#f0d890',
                    comp: '#132b1d', compBorder: '2px solid #c8a24a',
                    input: { bg: '#08140d', border: '1px solid #8c7133', color: '#f0e6c8', radius: '3px' },
                },
                btn: { bg: 'linear-gradient(180deg, #2e5c40, #1c3d2a)', color: '#f0d890', border: '1px solid #c8a24a', radius: '4px',
                       shadow: 'inset 0 1px 0 rgba(240, 216, 144, 0.25)', extra: `font-family: ${FANTASY_FONT};`,
                       hover: 'background: linear-gradient(180deg, #3a7550, #24503a) !important; box-shadow: 0 0 8px rgba(240, 216, 144, 0.45) !important;' },
                filled: { radius: '4px', border: '1px solid #c8a24a', shadow: '0 0 0 1px #0f2418' },
                popup: { bg: 'rgba(12, 28, 19, 0.97)', border: '2px solid #c8a24a', radius: '6px', hover: 'rgba(200, 162, 74, 0.2)', head: '#f0d890',
                         shadow: '0 0 0 3px #0f2418, 0 12px 30px rgba(0, 0, 0, 0.6)' },
                win: { border: '2px solid #c8a24a', radius: '6px', shadow: '0 0 0 3px #0f2418, 0 16px 40px rgba(0, 0, 0, 0.6)',
                       head: 'linear-gradient(180deg, #2a5238, #16301f)', headBorder: '2px solid #c8a24a', title: '#f0d890' },
                panel: { radius: '4px', border: '#8c7133', pressed: '#f0d890' },
            }),
            // Header scenery at a third of the width: between the title and the buttons (Cosmetics,
            // pop-out, collapse), which take the right half.
            extra: (S, A, fx) => `
                ${S} .mcfo-hyrule-tri { position: absolute; left: 34%; top: 50%; width: 24px; height: 21px; transform: translate(-50%, -50%);
                    background: url("${A.tri}") center / contain no-repeat; pointer-events: none; filter: drop-shadow(0 0 3px rgba(240, 216, 144, 0.5)); }
                ${fx(['full', 'subtle'], '.mcfo-hyrule-tri')} { animation: mcfoTri 2.6s ease-in-out infinite alternate; }
                @keyframes mcfoTri { from { filter: drop-shadow(0 0 1px rgba(240, 216, 144, 0.3)); } to { filter: drop-shadow(0 0 8px rgba(255, 230, 150, 0.95)); } }`,
            decor: [{ cls: 'mcfo-hyrule-tri', host: () => document.querySelector('.mcf-chat__header'), html: '' }],
            particles: [drifters('fairies', () => document.querySelector('.mcf-chat:not([data-collapsed="true"])'), 5,
                (w, h) => ({ cx: rnd(30, w - 30), cy: rnd(60, h - 60), ax: rnd(20, 60), ay: rnd(15, 45), sp: rnd(0.3, 0.7), ph: rnd(0, 6),
                             rgb: pickOf(Math.random, ['255, 240, 170', '255, 190, 230', '170, 220, 255']) }),
                () => true,
                (g, p, now) => {
                    const t = now / 1000 * p.sp + p.ph;
                    const x = p.cx + Math.sin(t * 1.3) * p.ax, y = p.cy + Math.sin(t * 0.9) * p.ay;
                    glowDot(g, x, y, 12, p.rgb, 0.35 + 0.15 * Math.sin(t * 6));
                    glowDot(g, x, y, 3, '255, 255, 255', 0.95);
                })],
            tile: A => `background: url("${A.tri}") center / 26px 22px no-repeat, linear-gradient(180deg, #2a5238, #0f2418); box-shadow: inset 0 0 0 2px #c8a24a;`,
        }),

        // ---- Tetris: the well, and every button a block ----
        tetris: deluxe({
            assets: () => ({ row: tetrisRow('tetris-row', [0, 4, 1, 2, 3, 6, 5]), row2: tetrisRow('tetris-row2', [2, 6, 0, 5, 1, 3, 4]) }),
            kit: A => ({
                titleCss: `font-family: ${ARCADE_FONT}; text-transform: uppercase; letter-spacing: 0.06em;`,
                ground: 'linear-gradient(rgba(255, 255, 255, 0.035) 1px, transparent 1px) 0 0 / 24px 24px, linear-gradient(90deg, rgba(255, 255, 255, 0.035) 1px, transparent 1px) 0 0 / 24px 24px, #050510',
                header: { bg: `url("${A.row}") 0 100% / 168px 24px repeat-x, #0b0b1a`, border: '0', extra: 'image-rendering: pixelated;' },
                cards: { bg: 'rgba(8, 8, 22, 0.92)', border: '2px solid #3c3c64', radius: '0' },
                footer: { bg: `url("${A.row2}") 0 0 / 168px 24px repeat-x, #0b0b1a`, border: '0', extra: 'image-rendering: pixelated;' },
                chat: {
                    bg: 'linear-gradient(rgba(255, 255, 255, 0.04) 1px, transparent 1px) 0 0 / 20px 20px, linear-gradient(90deg, rgba(255, 255, 255, 0.04) 1px, transparent 1px) 0 0 / 20px 20px, #05050f',
                    border: '0', radius: '0', shadow: 'inset 0 0 0 4px #8a8aa8, inset 0 0 0 6px #3c3c5a',
                    head: '#15152a', headBorder: '3px solid #8a8aa8', headText: '#ffffff',
                    comp: '#15152a', compBorder: '3px solid #8a8aa8',
                    input: { bg: '#000000', border: '2px solid #3c3c5a', color: '#ffffff', radius: '0' },
                },
                btn: { bg: '#00c8e8', color: '#021018', border: '1px solid #000000', radius: '0', shadow: 'inset 3px 3px 0 rgba(255, 255, 255, 0.55), inset -3px -3px 0 rgba(0, 0, 0, 0.4)',
                       hover: 'filter: brightness(1.15);', extra: 'font-weight: 800;' },
                filled: { radius: '0', border: '1px solid #000000', shadow: 'inset 3px 3px 0 rgba(255, 255, 255, 0.45), inset -3px -3px 0 rgba(0, 0, 0, 0.4)' },
                popup: { bg: '#08081a', border: '3px solid #8a8aa8', radius: '0', hover: 'rgba(0, 240, 240, 0.18)', head: '#00f0f0',
                         shadow: 'inset 0 0 0 2px #3c3c5a, 0 12px 30px rgba(0, 0, 0, 0.6)' },
                win: { border: '3px solid #8a8aa8', radius: '0', shadow: '0 0 0 2px #3c3c5a, 0 16px 40px rgba(0, 0, 0, 0.6)', title: '#ffffff',
                       head: `linear-gradient(rgba(5, 5, 16, 0.55), rgba(5, 5, 16, 0.55)), url("${A.row}") 0 0 / 84px 12px repeat-x, #0b0b1a`, headBorder: '3px solid #8a8aa8' },
                panel: { radius: '0', border: '#3c3c5a', pressed: '#00f0f0' },
            }),
            // The seven colours spread over the buttons that matter most.
            extra: S => `
                ${S} .mcfo-rebellion { background: #a000f0 !important; color: #ffffff !important; }
                ${S} .mcfo-unbid { background: #f0a000 !important; }
                ${S} .mcfo-autobid { background: #00d000 !important; }
                ${S} .mcf-chat__send { background: #f0f000 !important; }
                ${S} :is([data-action="king-attack"], .mcfo-attack) { background: #f00000 !important; color: #ffffff !important; }
                ${S} :is(.mcfo-signpost, [data-role="diamonds-purchase-link"]) { background: #0000f0 !important; color: #ffffff !important; }
                ${S} .mcfo-win__title { text-shadow: 2px 2px 0 #000000; }`,
            particles: [drifters('tetrominoes', () => document.querySelector('.mcf-chat:not([data-collapsed="true"])'), 5,
                (w, h, any) => ({ x: Math.floor(rnd(0, w - 56) / 14) * 14, y: any ? rnd(-40, h) : rnd(-120, -40), v: rnd(18, 30), k: Math.floor(rnd(0, 7)) }),
                (p, dt, now, w, h) => (p.y += p.v * dt) < h + 30,
                (g, p) => { g.globalAlpha = 0.22; for (const [bx, by] of TETROMINOES[p.k]) bevelSquare(g, p.x + bx * 14, Math.round(p.y / 14) * 14 + by * 14, 14, TET[p.k]); })],
            tile: A => `background: url("${A.row}") 0 100% / 84px 12px repeat-x, #0b0b1a; box-shadow: inset 0 0 0 2px #8a8aa8; image-rendering: pixelated;`,
        }),

        // ---- Pac-Man: maze walls, ghosts, and Pac-Man eating his way along the footer ----
        pacman: deluxe({
            assets: () => ({ red: ghostSvg('#ff0000'), pink: ghostSvg('#ffb8ff'), cyan: ghostSvg('#00ffff'), orange: ghostSvg('#ffb852') }),
            kit: () => {
                const wall = (w) => `inset 0 0 0 ${w}px #000000, inset 0 0 0 ${w + 2}px #2121de`;
                return {
                    titleCss: `font-family: ${ARCADE_FONT}; letter-spacing: 0.05em;`,
                    ground: 'radial-gradient(circle, rgba(255, 184, 174, 0.35) 0 2px, transparent 2.5px) 0 0 / 28px 28px, #000000',
                    header: { bg: 'linear-gradient(#2121de, #2121de) 0 calc(100% - 1px) / 100% 2px no-repeat, linear-gradient(#2121de, #2121de) 0 calc(100% - 7px) / 100% 2px no-repeat, #000000', border: '0' },
                    cards: { bg: '#000000', border: '2px solid #2121de', radius: '8px', shadow: wall(2) },
                    footer: { bg: 'linear-gradient(#2121de, #2121de) 0 0 / 100% 2px no-repeat, linear-gradient(#2121de, #2121de) 0 6px / 100% 2px no-repeat, #000000', border: '0' },
                    chat: {
                        bg: '#000000', border: '2px solid #2121de', radius: '14px', shadow: wall(3),
                        head: '#000000', headBorder: '2px solid #2121de', headText: '#ffe600',
                        comp: '#000000', compBorder: '2px solid #2121de',
                        input: { bg: '#000000', border: '2px solid #2121de', color: '#ffffff', radius: '8px' },
                    },
                    btn: { bg: '#000000', color: '#ffe600', border: '2px solid #2121de', radius: '8px', shadow: 'inset 0 0 0 2px #000000, inset 0 0 0 3px rgba(33, 33, 222, 0.7)',
                           hover: 'background: #0a0a3a !important; color: #ffffff !important;', extra: 'font-weight: 800;' },
                    filled: { radius: '8px', border: '2px solid #2121de', shadow: 'none' },
                    popup: { bg: '#000000', border: '2px solid #2121de', radius: '12px', hover: 'rgba(33, 33, 222, 0.35)', head: '#ffe600',
                             shadow: `${wall(4)}, 0 12px 30px rgba(0, 0, 0, 0.7)` },
                    win: { border: '2px solid #2121de', radius: '12px', shadow: '0 0 0 3px #000000, 0 0 0 5px #2121de, 0 16px 40px rgba(0, 0, 0, 0.7)',
                           head: '#000000', headBorder: '2px solid #2121de', title: '#ffe600' },
                    panel: { radius: '8px', border: '#2121de', pressed: '#ffe600' },
                };
            },
            extra: (S, A, fx) => `
                ${S} .mcfo-pac-ghosts { position: absolute; left: 34%; top: 50%; transform: translate(-50%, -50%); display: flex; gap: 3px; pointer-events: none; }
                ${S} .mcfo-pac-ghosts i { display: block; width: 13px; height: 13px; background-size: contain; }
                ${S} .mcfo-pac-ghosts i:nth-child(1) { background-image: url("${A.red}"); }
                ${S} .mcfo-pac-ghosts i:nth-child(2) { background-image: url("${A.pink}"); animation-delay: 0.2s; }
                ${S} .mcfo-pac-ghosts i:nth-child(3) { background-image: url("${A.cyan}"); animation-delay: 0.4s; }
                ${S} .mcfo-pac-ghosts i:nth-child(4) { background-image: url("${A.orange}"); animation-delay: 0.6s; }
                ${fx(['full', 'subtle'], '.mcfo-pac-ghosts i')} { animation-name: mcfoBob; animation-duration: 0.9s; animation-iteration-count: infinite; animation-direction: alternate; animation-timing-function: ease-in-out; }
                @keyframes mcfoBob { from { transform: translateY(-1px); } to { transform: translateY(2px); } }
                ${S} .mcfo-pac-lane { position: absolute; top: 0; transform: translate(-50%, -100%); height: 16px; z-index: 3; pointer-events: none;
                    background: #000000; border-top: 2px solid #2121de; border-bottom: 2px solid #2121de; }`,
            decor: [
                { cls: 'mcfo-pac-ghosts', host: () => document.querySelector('.mcf-chat__header'), html: '<i></i><i></i><i></i><i></i>' },
                { cls: 'mcfo-pac-lane', host: () => role('action-region'), html: '', place: (el, host) => placeOverBoard(el, host, 0.5, 520) },
            ],
            particles: [{
                name: 'pac-run', host: () => document.querySelector('.mcfo-pac-lane'),
                init: w => ({ x: -10, eaten: 0, scared: 0, w }),
                step: (g, st, w, h, dt, now) => {
                    g.clearRect(0, 0, w, h);
                    st.x += 55 * dt;
                    if (st.x > w + 100) { st.x = -10; st.eaten = 0; }
                    const cy = h / 2;
                    for (let px = 8, i = 0; px < w; px += 16, i++) {
                        if (px < st.x) { if (i % 8 === 4 && px > st.eaten) { st.scared = now + 3000; st.eaten = px; } continue; }
                        g.fillStyle = '#ffb8ae';
                        if (i % 8 === 4) { g.beginPath(); g.arc(px, cy, 3.5, 0, Math.PI * 2); g.fill(); } else g.fillRect(px - 1, cy - 1, 2, 2);
                    }
                    const mouth = 0.25 + 0.2 * Math.sin(now / 60);
                    g.fillStyle = '#ffe600';
                    g.beginPath(); g.moveTo(st.x, cy); g.arc(st.x, cy, 6, mouth, Math.PI * 2 - mouth); g.closePath(); g.fill();
                    const scared = now < st.scared;
                    ['#ff0000', '#ffb8ff', '#00ffff', '#ffb852'].forEach((c, k) => {
                        const gx = st.x - 26 - k * 16;
                        g.fillStyle = scared ? (Math.floor(now / 200) % 2 ? '#2121de' : '#ffffff') : c;
                        g.beginPath(); g.arc(gx, cy - 1, 5.5, Math.PI, 0); g.lineTo(gx + 5.5, cy + 5); g.lineTo(gx - 5.5, cy + 5); g.closePath(); g.fill();
                    });
                },
            }],
            tile: A => `background: url("${A.red}") 70% 55% / 14px 14px no-repeat, radial-gradient(circle at 28% 55%, #ffe600 0 7px, transparent 7.5px),
                        radial-gradient(circle, #ffb8ae 0 1.5px, transparent 2px) 0 50% / 12px 12px repeat-x, #000000; box-shadow: inset 0 0 0 2px #2121de;`,
        }),

        // ---- Portal: test chamber, blue portal left, orange portal right ----
        aperture: deluxe({
            kit: () => {
                const panels = 'linear-gradient(90deg, #b8c0c7 1px, transparent 1px) 0 0 / 96px 100%, linear-gradient(180deg, #f2f5f7, #d9dfe3)';
                const seam = 'border-image: linear-gradient(90deg, #2aa8ff, #ff8a00) 1;';
                return {
                    titleCss: 'font-family: Univers, "Helvetica Neue", Arial, sans-serif; letter-spacing: 0.04em;',
                    ground: 'linear-gradient(#11151a 2px, transparent 2px) 0 0 / 128px 128px, linear-gradient(90deg, #11151a 2px, transparent 2px) 0 0 / 128px 128px, linear-gradient(180deg, #262c32, #1a1f24)',
                    header: { bg: panels, border: '3px solid', extra: seam },
                    cards: { bg: '#22272c', border: '1px solid #8c969e', radius: '3px' },
                    footer: { bg: panels, border: '3px solid', extra: seam },
                    chat: {
                        bg: 'linear-gradient(#15191d 1px, transparent 1px) 0 0 / 100% 96px, linear-gradient(180deg, #22272c, #1a1f24)', border: '2px solid #8c969e', radius: '6px',
                        shadow: '-5px 0 16px -3px #2aa8ff, 5px 0 16px -3px #ff8a00',
                        head: 'linear-gradient(180deg, #f2f5f7, #d9dfe3)', headBorder: '2px solid #8c969e', headText: '#1d2226',
                        comp: '#15191d', compBorder: '2px solid #8c969e',
                        input: { bg: '#0e1114', border: '1px solid #2aa8ff', color: '#e9edf0', radius: '3px' },
                    },
                    btn: { bg: 'linear-gradient(180deg, #ffffff, #dfe5e9)', color: '#1d2226', border: '1px solid #8c969e', radius: '4px', shadow: '0 1px 0 rgba(0, 0, 0, 0.35)',
                           hover: 'box-shadow: 0 0 0 2px #2aa8ff, 0 0 12px rgba(42, 168, 255, 0.6) !important;' },
                    filled: { radius: '4px', border: '1px solid #1d2226', shadow: '0 1px 0 rgba(0, 0, 0, 0.35)' },
                    popup: { bg: 'rgba(30, 35, 40, 0.97)', border: '1px solid #8c969e', radius: '6px', hover: 'rgba(42, 168, 255, 0.2)', head: '#e9edf0',
                             shadow: '0 0 0 1px #11151a, 0 0 18px rgba(42, 168, 255, 0.35), 0 12px 30px rgba(0, 0, 0, 0.6)' },
                    win: { border: '1px solid #8c969e', radius: '6px', shadow: '-6px 0 18px -4px #2aa8ff, 6px 0 18px -4px #ff8a00, 0 16px 40px rgba(0, 0, 0, 0.6)',
                           head: 'linear-gradient(180deg, #f2f5f7, #d9dfe3)', headBorder: '1px solid #8c969e', title: '#1d2226' },
                    panel: { radius: '4px', border: '#8c969e', pressed: '#2aa8ff' },
                };
            },
            extra: S => `${S} :is(.mcf-chat__send, .mcfo-autobid):hover:not(:disabled) { box-shadow: 0 0 0 2px #ff8a00, 0 0 12px rgba(255, 138, 0, 0.6) !important; }`,
            particles: [drifters('portal-sparks', () => document.querySelector('.mcf-chat:not([data-collapsed="true"])'), 14,
                (w, h) => { const left = Math.random() < 0.5; return { left, x: left ? 2 : w - 2, y: rnd(20, h - 20), v: rnd(14, 34), life: 0, max: rnd(1.5, 3) }; },
                (p, dt) => { p.life += dt; p.x += (p.left ? 1 : -1) * p.v * dt; return p.life < p.max; },
                (g, p) => glowDot(g, p.x, p.y, 5, p.left ? '42, 168, 255' : '255, 138, 0', 0.7 * (1 - p.life / p.max)))],
            tile: () => 'background: radial-gradient(ellipse 6px 14px at 12% 50%, #2aa8ff 0 70%, transparent 100%), radial-gradient(ellipse 6px 14px at 88% 50%, #ff8a00 0 70%, transparent 100%), linear-gradient(180deg, #f2f5f7, #d9dfe3);',
        }),

        // ---- Sonic: Green Hill and golden rings ----
        greenhill: deluxe({
            kit: () => {
                const checker = 'conic-gradient(#c97d3c 25%, #8a4f24 0 50%, #c97d3c 0 75%, #8a4f24 0) 0 9px / 28px 28px';
                const grass = 'linear-gradient(180deg, #58c828 0 6px, #2f8a14 6px 9px, transparent 9px)';
                return {
                    titleCss: 'font-style: italic; font-weight: 900; text-transform: uppercase; letter-spacing: 0.02em;',
                    ground: 'linear-gradient(180deg, #2f7ae0 0%, #6fb6ff 55%, #b8e4ff 72%, #2a9bd8 72.5%, #1f7fbf 100%)',
                    header: { bg: `${grass}, ${checker}`, border: '0' },
                    cards: { bg: 'rgba(10, 30, 70, 0.84)', border: '2px solid #ffd800', radius: '8px' },
                    footer: { bg: `${grass}, ${checker}`, border: '0' },
                    chat: {
                        bg: 'linear-gradient(180deg, rgba(12, 40, 100, 0.93), rgba(8, 26, 70, 0.96))', border: '3px solid #ffd800', radius: '14px', shadow: '0 0 0 3px #0a3d91',
                        head: 'linear-gradient(180deg, #1e5fd0, #0a3d91)', headBorder: '3px solid #ffd800', headText: '#ffffff',
                        comp: `${grass}, ${checker}`, compBorder: '0',
                        input: { bg: '#061a44', border: '2px solid #ffd800', color: '#ffffff', radius: '10px' },
                    },
                    btn: { bg: 'linear-gradient(180deg, #2f78ff, #0a3d91)', color: '#ffffff', border: '2px solid #ffd800', radius: '999px', shadow: 'inset 0 2px 0 rgba(255, 255, 255, 0.35)',
                           hover: 'transform: translateY(-1px); box-shadow: 0 0 10px rgba(255, 216, 0, 0.75) !important;', extra: 'font-style: italic; font-weight: 800;' },
                    filled: { radius: '10px', border: '2px solid #ffd800', shadow: 'none' },
                    popup: { bg: 'rgba(10, 32, 84, 0.97)', border: '3px solid #ffd800', radius: '14px', hover: 'rgba(255, 216, 0, 0.2)', head: '#ffd800',
                             shadow: '0 0 0 3px #0a3d91, 0 12px 30px rgba(0, 0, 0, 0.5)' },
                    win: { border: '3px solid #ffd800', radius: '14px', shadow: '0 0 0 3px #0a3d91, 0 16px 40px rgba(0, 0, 0, 0.5)',
                           head: 'linear-gradient(180deg, #1e5fd0, #0a3d91)', headBorder: '3px solid #ffd800', title: '#ffffff' },
                    panel: { radius: '10px', border: '#ffd800', pressed: '#ffd800' },
                };
            },
            particles: [drifters('rings', () => document.querySelector('.mcf-chat:not([data-collapsed="true"])'), 8,
                (w, h, any) => ({ x: rnd(14, w - 14), y: any ? rnd(0, h) : h + 14, v: rnd(8, 16), ph: rnd(0, 6) }),
                (p, dt) => (p.y -= p.v * dt) > -20,
                (g, p, now) => {
                    const sx = Math.max(0.12, Math.abs(Math.cos(now / 350 + p.ph)));
                    g.globalAlpha = 0.65; g.lineWidth = 2.6; g.strokeStyle = '#ffd800';
                    g.beginPath(); g.ellipse(p.x, p.y, 7 * sx, 7, 0, 0, Math.PI * 2); g.stroke();
                    g.lineWidth = 1; g.strokeStyle = '#fff6a0';
                    g.beginPath(); g.ellipse(p.x, p.y, 5.5 * sx, 5.5, 0, 0, Math.PI * 2); g.stroke();
                })],
            tile: () => 'background: radial-gradient(circle at 70% 45%, transparent 0 6px, #ffd800 6px 9px, transparent 9.5px), linear-gradient(180deg, #58c828 0 3px, transparent 3px) 0 70% / 100% 100% no-repeat, linear-gradient(180deg, #2f7ae0, #9fd8ff 70%, #c97d3c 70%);',
        }),

        // ---- Pokémon: the chat is a Pokédex ----
        pokedex: deluxe({
            kit: () => ({
                titleCss: 'font-weight: 800; letter-spacing: 0.04em;',
                ground: 'radial-gradient(circle, transparent 0 6px, rgba(255, 255, 255, 0.05) 6px 8px, transparent 8px 20px, rgba(255, 255, 255, 0.05) 20px 22px, transparent 22px) 0 0 / 72px 72px, linear-gradient(180deg, #2a0f14, #141416)',
                header: { bg: 'linear-gradient(180deg, #e8173a, #b0081f)', border: '3px solid #222224' },
                cards: { bg: 'rgba(20, 20, 24, 0.86)', border: '2px solid #222224', radius: '6px', shadow: 'inset 0 0 0 1px rgba(255, 255, 255, 0.08)' },
                footer: { bg: 'linear-gradient(180deg, #b0081f, #8b0015)', border: '3px solid #222224' },
                chat: {
                    bg: 'linear-gradient(180deg, #e8173a, #b0081f)', border: '3px solid #222224', radius: '10px 10px 10px 28px', pad: '46px 10px 10px',
                    shadow: 'inset 0 -3px 0 rgba(0, 0, 0, 0.25), 0 8px 24px rgba(0, 0, 0, 0.45)',
                    head: '#dedede', headBorder: '0', headText: '#222224', body: '#1f3531',
                    comp: 'transparent', compBorder: '0',
                    input: { bg: '#1b1b1d', border: '2px solid #222224', color: '#ffffff', radius: '6px' },
                },
                btn: { bg: '#f0f0f0', color: '#222224', border: '2px solid #222224', radius: '8px', shadow: 'inset 0 -4px 0 rgba(0, 0, 0, 0.15)',
                       hover: 'background: #ffffff !important; box-shadow: 0 0 0 2px #dc0a2d !important;', extra: 'font-weight: 800;' },
                filled: { radius: '8px', border: '2px solid #222224', shadow: 'inset 0 -3px 0 rgba(0, 0, 0, 0.2)' },
                popup: { bg: '#1b1d22', border: '3px solid #f0f0f0', radius: '10px', hover: 'rgba(220, 10, 45, 0.35)', head: '#ffffff',
                         shadow: '0 0 0 3px #222224, inset 0 0 0 2px #585c66, 0 12px 30px rgba(0, 0, 0, 0.6)' },
                win: { border: '3px solid #222224', radius: '10px', shadow: '0 16px 40px rgba(0, 0, 0, 0.6)',
                       head: 'linear-gradient(180deg, #e8173a, #b0081f)', headBorder: '3px solid #222224', title: '#ffffff' },
                panel: { radius: '8px', border: '#585c66', pressed: '#dc0a2d' },
            }),
            extra: (S, A, fx) => `
                ${S} .mcf-chat__header { border-radius: 6px 6px 0 0; }
                ${S} .mcf-chat__body { border-radius: 0 0 4px 16px; box-shadow: inset 0 0 0 3px #dedede; }
                ${S} .mcf-chat__send { background: #dc0a2d !important; color: #ffffff !important; }
                ${S} .mcfo-dex-top { position: absolute; left: 0; right: 0; top: 0; height: 44px; pointer-events: none; z-index: 2;
                    background: linear-gradient(#8b0015, #8b0015) 0 42px / 100% 2px no-repeat; }
                ${S} .mcfo-dex-lens { position: absolute; left: 12px; top: 5px; width: 30px; height: 30px; border-radius: 50%; border: 3px solid #f0f0f0; box-shadow: 0 0 0 2px #222224;
                    background: radial-gradient(circle at 35% 35%, #d8f2ff 0 3px, #28aafd 4px 60%, #0a5c9e 100%); }
                ${S} .mcfo-dex-top b { position: absolute; top: 8px; width: 9px; height: 9px; border-radius: 50%; box-shadow: 0 0 0 1.5px #222224; }
                ${S} .mcfo-dex-top b:nth-of-type(1) { left: 56px; background: #ff2a2a; }
                ${S} .mcfo-dex-top b:nth-of-type(2) { left: 70px; background: #ffde00; animation-delay: 0.3s; }
                ${S} .mcfo-dex-top b:nth-of-type(3) { left: 84px; background: #32cb00; animation-delay: 0.6s; }
                ${fx(['full', 'subtle'], '.mcfo-dex-top b')} { animation-name: mcfoLed; animation-duration: 1.2s; animation-iteration-count: infinite; animation-direction: alternate; }
                @keyframes mcfoLed { from { filter: brightness(0.7); } to { filter: brightness(1.35); box-shadow: 0 0 0 1.5px #222224, 0 0 6px rgba(255, 255, 255, 0.7); } }
                ${S} .mcf-chat__body::after { content: ''; position: absolute; left: 0; right: 0; top: 0; height: 30%; pointer-events: none; opacity: 0;
                    background: linear-gradient(180deg, transparent, rgba(160, 255, 220, 0.07), transparent); }
                ${fx(['full'], '.mcf-chat__body::after')} { opacity: 1; animation: mcfoScan 4s linear infinite; }
                @keyframes mcfoScan { from { transform: translateY(-100%); } to { transform: translateY(340%); } }`,
            decor: [{ cls: 'mcfo-dex-top', host: () => document.querySelector('.mcf-chat'), html: '<i class="mcfo-dex-lens"></i><b></b><b></b><b></b>' }],
            tile: () => 'background: radial-gradient(circle at 18% 50%, #bfe8ff 0 2px, #28aafd 3px 8px, #f0f0f0 8px 10px, transparent 10.5px), linear-gradient(180deg, #e8173a, #b0081f);',
        }),

        // ---- Game Boy: the chat is one ----
        gameboy: deluxe({
            kit: () => ({
                titleCss: 'font-family: "Arial Black", "Helvetica Neue", Arial, sans-serif; font-style: italic;',
                ground: 'linear-gradient(rgba(155, 188, 15, 0.07) 1px, transparent 1px) 0 0 / 6px 6px, linear-gradient(90deg, rgba(155, 188, 15, 0.07) 1px, transparent 1px) 0 0 / 6px 6px, #0f380f',
                header: { bg: 'linear-gradient(180deg, #d4d4cc, #b8b8b0)', border: '3px solid #8a8a82' },
                cards: { bg: '#0f380f', border: '3px solid #6b6e80', radius: '4px' },
                footer: { bg: 'repeating-linear-gradient(-60deg, transparent 0 10px, rgba(0, 0, 0, 0.12) 10px 13px) right / 180px 100% no-repeat, linear-gradient(180deg, #c5c5bd, #a8a8a0)', border: '3px solid #8a8a82' },
                chat: {
                    bg: 'linear-gradient(180deg, #cdcdc5, #b9b9b1)', border: '0', radius: '10px 10px 44px 10px', pad: '10px 14px 104px',
                    shadow: 'inset -3px -3px 0 rgba(0, 0, 0, 0.12), inset 3px 3px 0 rgba(255, 255, 255, 0.5), 0 8px 24px rgba(0, 0, 0, 0.4)',
                    head: '#6b6e80', headBorder: '0', headText: '#e3e3dc', body: '#8bac0f',
                    comp: 'transparent', compBorder: '0',
                    input: { bg: '#9bbc0f', border: '3px solid #6b6e80', color: '#0f380f', radius: '4px', hint: '#306230' },
                },
                btn: { bg: 'linear-gradient(180deg, #9a9a9e, #7c7c82)', color: '#f2f2ee', border: '1px solid #5c5c62', radius: '999px',
                       shadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.35), 0 2px 0 #5c5c62', hover: 'filter: brightness(1.1);', extra: 'font-weight: 800;' },
                filled: { radius: '6px', border: '2px solid #2b2b2b', shadow: 'none' },
                popup: { bg: '#0f380f', border: '4px solid #6b6e80', radius: '6px', hover: 'rgba(155, 188, 15, 0.25)', head: '#9bbc0f',
                         shadow: '0 0 0 3px #c5c5bd, 0 12px 30px rgba(0, 0, 0, 0.5)' },
                win: { border: '4px solid #c5c5bd', radius: '8px 8px 26px 8px', shadow: '0 0 0 2px #8a8a82, 0 16px 40px rgba(0, 0, 0, 0.5)', head: '#6b6e80', title: '#e3e3dc' },
                panel: { radius: '6px', border: '#6b6e80', pressed: '#9bbc0f' },
            }),
            extra: (S, A, fx) => `${lightChatCss(S, '#0f380f', '#306230')}
                ${S} .mcf-chat__header { padding-top: 16px !important; border-radius: 6px 6px 0 0; }
                ${S} .mcf-chat__body { box-shadow: inset 0 0 0 8px #6b6e80; padding: 0 8px 8px; border-radius: 0 0 6px 6px; }
                ${S} .mcf-chat__send { background: radial-gradient(circle at 40% 35%, #c0457d, #9a2257) !important; color: #ffffff !important; border-color: #5e1233 !important; }
                ${S} .mcfo-gb-label { position: absolute; left: 50%; top: 3px; transform: translateX(-50%); white-space: nowrap; pointer-events: none;
                    font: 700 7px/1 Arial, sans-serif; letter-spacing: 0.06em; color: #d8d8e8; }
                ${S} .mcfo-gb-led { position: absolute; left: 10px; top: 4px; width: 6px; height: 6px; border-radius: 50%; background: #ff2030; box-shadow: 0 0 5px #ff2030; pointer-events: none; }
                ${fx(['full', 'subtle'], '.mcfo-gb-led')} { animation: mcfoPower 2.8s ease-in-out infinite alternate; }
                @keyframes mcfoPower { from { box-shadow: 0 0 2px #ff2030; } to { box-shadow: 0 0 8px 1px #ff4050; } }
                ${S} .mcfo-gb-pad { position: absolute; left: 0; right: 0; bottom: 0; height: 100px; pointer-events: none; z-index: 2; }
                ${S} .mcfo-gb-pad em { position: absolute; left: 16px; top: 4px; font: italic 900 12px/1 "Arial Black", Arial, sans-serif; color: #2b2a6b; letter-spacing: 0.02em; font-style: italic; }
                ${S} .mcfo-gb-dpad { position: absolute; left: 22px; top: 26px; width: 44px; height: 44px;
                    background: linear-gradient(#2b2b2b, #2b2b2b) center / 14px 44px no-repeat, linear-gradient(#2b2b2b, #2b2b2b) center / 44px 14px no-repeat; }
                ${S} .mcfo-gb-ab { position: absolute; right: 18px; top: 22px; width: 76px; height: 46px;
                    background: radial-gradient(circle at 22% 72%, #b1336c 0 11px, #5e1233 11px 12.5px, transparent 13px), radial-gradient(circle at 78% 28%, #b1336c 0 11px, #5e1233 11px 12.5px, transparent 13px); }
                ${S} .mcfo-gb-ss { position: absolute; left: 50%; bottom: 14px; width: 68px; height: 8px; transform: translateX(-50%) rotate(-24deg);
                    background: linear-gradient(#85858b, #85858b) left / 26px 7px no-repeat, linear-gradient(#85858b, #85858b) right / 26px 7px no-repeat; }
                ${S} .mcfo-gb-speaker { position: absolute; right: 12px; bottom: 6px; width: 46px; height: 30px; background: repeating-linear-gradient(-60deg, transparent 0 6px, rgba(0, 0, 0, 0.25) 6px 9px); }`,
            decor: [
                { cls: 'mcfo-gb-pad', host: () => document.querySelector('.mcf-chat'),
                  html: '<em>GAME BOY</em><i class="mcfo-gb-dpad"></i><i class="mcfo-gb-ab"></i><i class="mcfo-gb-ss"></i><i class="mcfo-gb-speaker"></i>' },
                { cls: 'mcfo-gb-bezel', host: () => document.querySelector('.mcf-chat__header'),
                  html: '<i class="mcfo-gb-led"></i><span class="mcfo-gb-label">DOT MATRIX WITH STEREO SOUND</span>' },
            ],
            tile: () => 'background: linear-gradient(#8bac0f, #8bac0f) 50% 40% / 60% 55% no-repeat, linear-gradient(#6b6e80, #6b6e80) 50% 38% / 72% 70% no-repeat, linear-gradient(180deg, #cdcdc5, #b9b9b1);',
        }),

        // ---- Stardew Valley: wood, parchment, falling leaves ----
        stardew: deluxe({
            assets: () => ({
                planks: mcPlanks('sdv-planks', ['#c68642', '#b5763a', '#d09550', '#a86d34'], 37),
                grass: mcNoise('sdv-grass', ['#6aa336', '#7cb342', '#5d9630', '#8bc34a', '#4e8a2a'], 41),
            }),
            kit: A => ({
                titleCss: 'font-weight: 900; letter-spacing: 0.02em;',
                ground: `linear-gradient(rgba(0, 0, 0, 0.35), rgba(0, 0, 0, 0.35)), url("${A.grass}") 0 0 / 48px 48px repeat, #5d9630`,
                header: { bg: `url("${A.planks}") 0 0 / 48px 48px repeat, #b5763a`, border: '4px solid #6b3a12', extra: 'image-rendering: pixelated;' },
                cards: { bg: 'rgba(63, 39, 19, 0.88)', border: '3px solid #b5651d', radius: '8px', shadow: 'inset 0 0 0 2px #6b3a12' },
                footer: { bg: `url("${A.planks}") 0 0 / 48px 48px repeat, #b5763a`, border: '4px solid #6b3a12', extra: 'image-rendering: pixelated;' },
                chat: {
                    bg: 'radial-gradient(ellipse at 50% 0%, #fbeabb, #f2d690 70%)', border: '5px solid #b5651d', radius: '12px',
                    shadow: 'inset 0 0 0 3px #e8a45a, 0 0 0 3px #6b3a12, 0 8px 20px rgba(0, 0, 0, 0.35)',
                    head: 'linear-gradient(180deg, #e8b86a, #d9a04e)', headBorder: '3px solid #b5651d', headText: '#5b3a1e',
                    comp: '#ecd08a', compBorder: '3px solid #b5651d',
                    input: { bg: '#fff4d6', border: '2px solid #b5651d', color: '#3f2713', radius: '6px', hint: '#9a7a50' },
                },
                btn: { bg: 'linear-gradient(180deg, #f9e6b4, #eccb7c)', color: '#5b3a1e', border: '3px solid #b5651d', radius: '8px',
                       shadow: 'inset 0 0 0 1px #fff4d6, 0 2px 0 #6b3a12', hover: 'filter: brightness(1.06); transform: translateY(-1px);', extra: 'font-weight: 800;' },
                filled: { radius: '8px', border: '3px solid #6b3a12', shadow: '0 2px 0 rgba(0, 0, 0, 0.35)' },
                popup: { bg: '#3f2713', border: '4px solid #b5651d', radius: '12px', hover: 'rgba(246, 223, 163, 0.18)', head: '#f6dfa3',
                         shadow: 'inset 0 0 0 2px #6b3a12, 0 12px 30px rgba(0, 0, 0, 0.5)' },
                win: { border: '5px solid #b5651d', radius: '12px', shadow: '0 0 0 3px #6b3a12, 0 16px 40px rgba(0, 0, 0, 0.5)',
                       head: 'linear-gradient(180deg, #e8b86a, #d9a04e)', headBorder: '3px solid #b5651d', title: '#5b3a1e' },
                panel: { radius: '8px', border: '#b5651d', pressed: '#ffd36a' },
            }),
            extra: S => `${lightChatCss(S, '#3f2713', '#8a6036')}
                ${S} [data-role="shell"] { image-rendering: pixelated; }
                ${S} [data-role="shell"] * { image-rendering: auto; }
                ${S} [data-role="top-status-region"], ${S} [data-role="action-region"] { image-rendering: pixelated; }`,
            particles: [drifters('leaves', () => document.querySelector('.mcf-chat:not([data-collapsed="true"])'), 9,
                (w, h, any) => ({ x: rnd(0, w), y: any ? rnd(0, h) : -10, v: rnd(10, 20), ph: rnd(0, 6), c: pickOf(Math.random, ['#6aa336', '#8bc34a', '#e59a3a', '#c9642a']) }),
                (p, dt, now) => { p.y += p.v * dt; p.x += Math.sin(now / 700 + p.ph) * 14 * dt; return p.y < 9999; },
                (g, p, now, w, h) => {
                    if (p.y > h + 10) { p.y = -10; p.x = rnd(0, w); }
                    g.save(); g.globalAlpha = 0.55; g.translate(p.x, p.y); g.rotate(Math.sin(now / 500 + p.ph) * 0.8);
                    g.fillStyle = p.c; g.beginPath(); g.ellipse(0, 0, 5, 2.6, 0, 0, Math.PI * 2); g.fill(); g.restore();
                })],
            tile: A => `background: linear-gradient(#f2d690, #f2d690) center / 60% 50% no-repeat, url("${A.planks}") 0 0 / 24px 24px repeat; box-shadow: inset 0 0 0 3px #b5651d; image-rendering: pixelated;`,
        }),

        // ---- Hollow Knight: Hallownest dark, pale lines, drifting soul ----
        hallownest: deluxe({
            assets: () => ({ flourish: flourishSvg() }),
            kit: () => {
                const pale = a => `rgba(233, 238, 245, ${a})`;
                return {
                    titleCss: `font-family: ${FANTASY_FONT}; text-transform: uppercase; letter-spacing: 0.18em;`,
                    ground: 'radial-gradient(ellipse at 50% 120%, rgba(157, 177, 214, 0.12), transparent 60%), radial-gradient(ellipse at 10% 0%, rgba(90, 106, 133, 0.15), transparent 50%), #07090f',
                    header: { bg: 'linear-gradient(180deg, #111724, #07090f)', border: `1px solid ${pale(0.55)}` },
                    cards: { bg: 'rgba(7, 9, 15, 0.82)', border: `1px solid ${pale(0.35)}`, radius: '2px' },
                    footer: { bg: 'linear-gradient(180deg, #07090f, #111724)', border: `1px solid ${pale(0.55)}` },
                    chat: {
                        bg: 'linear-gradient(180deg, #0d121c, #07090f)', border: `1px solid ${pale(0.6)}`, radius: '2px', shadow: `0 0 0 4px #07090f, 0 0 0 5px ${pale(0.25)}`,
                        head: 'transparent', headBorder: `1px solid ${pale(0.3)}`, headText: '#e9eef5',
                        comp: '#07090f', compBorder: `1px solid ${pale(0.3)}`,
                        input: { bg: '#050709', border: `1px solid ${pale(0.4)}`, color: '#e9eef5', radius: '2px' },
                    },
                    btn: { bg: 'rgba(7, 9, 15, 0.75)', color: '#e9eef5', border: `1px solid ${pale(0.55)}`, radius: '2px', extra: `font-family: ${FANTASY_FONT}; letter-spacing: 0.08em;`,
                           hover: 'background: rgba(157, 177, 214, 0.18) !important; box-shadow: 0 0 10px rgba(157, 177, 214, 0.5) !important;' },
                    filled: { radius: '2px', border: `1px solid ${pale(0.6)}`, shadow: 'none' },
                    popup: { bg: 'rgba(7, 9, 15, 0.97)', border: `1px solid ${pale(0.55)}`, radius: '2px', hover: 'rgba(157, 177, 214, 0.16)', head: '#e9eef5',
                             shadow: `0 0 0 4px #07090f, 0 0 0 5px ${pale(0.2)}, 0 12px 30px rgba(0, 0, 0, 0.7)` },
                    win: { border: `1px solid ${pale(0.6)}`, radius: '2px', shadow: `0 0 0 4px #07090f, 0 0 0 5px ${pale(0.22)}, 0 16px 40px rgba(0, 0, 0, 0.7)`,
                           head: 'linear-gradient(180deg, #111724, #0a0d15)', headBorder: `1px solid ${pale(0.3)}`, title: '#e9eef5' },
                    panel: { radius: '2px', border: pale(0.3), pressed: '#e9eef5' },
                };
            },
            extra: (S, A) => `${S} .mcfo-hk-flourish { position: absolute; left: 50%; bottom: -7px; width: 120px; height: 12px; transform: translateX(-50%);
                    background: url("${A.flourish}") center / contain no-repeat; pointer-events: none; opacity: 0.8; }`,
            decor: [{ cls: 'mcfo-hk-flourish', host: () => document.querySelector('.mcf-chat__header'), html: '' }],
            particles: [drifters('soul', () => document.querySelector('.mcf-chat:not([data-collapsed="true"])'), 16,
                (w, h, any) => ({ x: rnd(0, w), y: any ? rnd(0, h) : h + 6, v: rnd(6, 14), ph: rnd(0, 6), r: rnd(1, 2.4) }),
                (p, dt, now) => { p.y -= p.v * dt; p.x += Math.sin(now / 1100 + p.ph) * 6 * dt; return p.y > -8; },
                (g, p, now) => { const a = 0.35 + 0.3 * Math.sin(now / 600 + p.ph); glowDot(g, p.x, p.y, p.r * 5, '190, 210, 245', a * 0.5); glowDot(g, p.x, p.y, p.r, '255, 255, 255', a); })],
            tile: A => `background: url("${A.flourish}") center / 80% 10px no-repeat, radial-gradient(ellipse at 50% 120%, rgba(157, 177, 214, 0.3), transparent 60%), #07090f;`,
        }),

        // ---- World of Warcraft: gold frames, red buttons, action bar, XP bar ----
        wow: deluxe({
            assets: () => ({ stone: mcNoise('wow-stone', ['#2a2a2c', '#303033', '#252527', '#353538', '#1f1f21'], 43) }),
            kit: A => {
                const ring = 'border-image: linear-gradient(90deg, #6e3f0e, #c98a2c, #f7dc7a, #c98a2c, #6e3f0e) 1;';
                return {
                    titleCss: `font-family: ${FANTASY_FONT}; text-shadow: 1px 1px 0 #000000;`,
                    ground: `linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.5)), url("${A.stone}") 0 0 / 64px 64px repeat, #252527`,
                    header: { bg: 'linear-gradient(180deg, #3c3a36, #1e1d1b)', border: '4px solid', extra: ring },
                    cards: { bg: 'rgba(0, 0, 0, 0.72)', border: '1px solid #8a6a2c', radius: '4px', shadow: 'inset 0 0 0 1px rgba(247, 220, 122, 0.18)' },
                    footer: { bg: 'linear-gradient(180deg, #2a2926, #141311)', border: '4px solid', extra: ring },
                    chat: {
                        bg: 'rgba(0, 0, 0, 0.62)', border: '1px solid rgba(200, 145, 47, 0.4)', radius: '4px',
                        head: 'linear-gradient(180deg, rgba(60, 40, 10, 0.92), rgba(20, 14, 4, 0.92))', headBorder: '2px solid #c8912f', headText: '#ffd100',
                        comp: 'rgba(0, 0, 0, 0.78)', compBorder: '1px solid rgba(200, 145, 47, 0.5)',
                        input: { bg: 'rgba(0, 0, 0, 0.85)', border: '1px solid #8a6a2c', color: '#ffffff', radius: '3px' },
                    },
                    btn: { bg: 'linear-gradient(180deg, #d4261c, #8a0a0a 60%, #5c0606)', color: '#ffd100', border: '1px solid #c8912f', radius: '4px',
                           shadow: 'inset 0 1px 0 rgba(255, 200, 150, 0.45), 0 0 0 1px #2a1a04', hover: 'filter: brightness(1.18);',
                           extra: `font-family: ${FANTASY_FONT}; text-shadow: 1px 1px 0 #000000;` },
                    filled: { radius: '4px', border: '1px solid #c8912f', shadow: '0 0 0 1px #2a1a04, inset 0 1px 0 rgba(255, 255, 255, 0.25)' },
                    popup: { bg: 'rgba(8, 8, 16, 0.95)', border: '2px solid #c8912f', radius: '6px', hover: 'rgba(200, 145, 47, 0.2)', head: '#ffd100',
                             shadow: '0 0 0 1px #2a1a04, inset 0 0 0 1px rgba(247, 220, 122, 0.25), 0 12px 30px rgba(0, 0, 0, 0.7)' },
                    win: { border: '3px solid #c8912f', radius: '6px', shadow: '0 0 0 1px #2a1a04, 0 0 0 4px rgba(0, 0, 0, 0.6), 0 16px 40px rgba(0, 0, 0, 0.7)',
                           head: 'linear-gradient(180deg, #3a2a0e, #140e04)', headBorder: '2px solid #c8912f', title: '#ffd100' },
                    panel: { radius: '4px', border: '#8a6a2c', pressed: '#ffd100' },
                };
            },
            extra: (S, A, fx) => `
                ${S} [data-role="shell"] { image-rendering: pixelated; }
                ${S} [data-role="shell"] * { image-rendering: auto; }
                ${S} [data-role="nav-region"] > :is(button, a) { background: linear-gradient(180deg, #2c2c2e, #111112) !important; color: #ffd100 !important; }
                ${S} .mcfo-wow-xp { position: absolute; top: 0; transform: translate(-50%, -100%); height: 9px; z-index: 3; pointer-events: none;
                    border: 1px solid #000000; box-shadow: 0 0 0 1px #8a6a2c;
                    background: linear-gradient(90deg, #7a2bc4 0 58%, #2b6bd6 58% 70%, rgba(0, 0, 0, 0.8) 70%); }
                ${S} .mcfo-wow-xp::after { content: ''; position: absolute; inset: 0;
                    background: repeating-linear-gradient(90deg, transparent 0 calc(10% - 1px), rgba(0, 0, 0, 0.7) calc(10% - 1px) 10%); }
                ${fx(['full', 'subtle'], '.mcfo-wow-xp')} { animation: mcfoXpGlow 2.6s ease-in-out infinite alternate; }`,
            decor: [{ cls: 'mcfo-wow-xp', host: () => role('action-region'), html: '', place: (el, host) => placeOverBoard(el, host) }],
            tile: () => 'background: linear-gradient(90deg, #6e3f0e, #c98a2c, #f7dc7a, #c98a2c, #6e3f0e) bottom / 100% 5px no-repeat, linear-gradient(180deg, #d4261c, #5c0606) center / 40% 12px no-repeat, #1e1d1b;',
        }),

        // ---- Signature: DreamingLucie — a soft trans-pastel night ----
        dreaming: deluxe({
            assets: () => ({ stars: starField(71, 60, 0.7) }),
            kit: A => {
                const glass = a => `rgba(255, 255, 255, ${a})`;
                return {
                    titleCss: `font-family: ${ROUND_FONT}; font-weight: 800; text-shadow: 0 0 8px rgba(245, 169, 184, 0.6);`,
                    ground: `radial-gradient(ellipse at 20% 10%, rgba(245, 169, 184, 0.28), transparent 55%), radial-gradient(ellipse at 80% 90%, rgba(91, 206, 250, 0.25), transparent 55%),
                             ${A.stars}, linear-gradient(180deg, #1e1840, #2d1f52 55%, #3a2352)`,
                    header: { bg: 'linear-gradient(90deg, rgba(91, 206, 250, 0.5), rgba(245, 169, 184, 0.5), rgba(255, 255, 255, 0.3), rgba(245, 169, 184, 0.5), rgba(91, 206, 250, 0.5)), #2a1f4a',
                              border: `2px solid ${glass(0.6)}` },
                    cards: { bg: 'rgba(30, 22, 64, 0.74)', border: `1px solid ${glass(0.45)}`, radius: '14px', shadow: '0 0 12px rgba(245, 169, 184, 0.25)' },
                    footer: { bg: 'linear-gradient(90deg, rgba(91, 206, 250, 0.45), rgba(245, 169, 184, 0.45), rgba(255, 255, 255, 0.25), rgba(245, 169, 184, 0.45), rgba(91, 206, 250, 0.45)), #2a1f4a',
                              border: `2px solid ${glass(0.6)}` },
                    chat: {
                        bg: 'linear-gradient(180deg, rgba(42, 31, 74, 0.93), rgba(30, 22, 58, 0.96))', border: `2px solid ${glass(0.55)}`, radius: '22px',
                        shadow: '0 0 0 3px rgba(91, 206, 250, 0.35), 0 0 22px rgba(245, 169, 184, 0.35)',
                        head: 'linear-gradient(90deg, rgba(91, 206, 250, 0.35), rgba(245, 169, 184, 0.35))', headBorder: `1px solid ${glass(0.35)}`, headText: '#ffffff',
                        comp: 'rgba(26, 20, 51, 0.9)', compBorder: `1px solid ${glass(0.25)}`,
                        input: { bg: glass(0.08), border: '1px solid rgba(245, 169, 184, 0.75)', color: '#ffffff', radius: '14px', hint: 'rgba(245, 200, 215, 0.8)' },
                    },
                    btn: { bg: 'linear-gradient(135deg, #7fd7fb, #f5a9b8)', color: '#2a1f4a', border: `1px solid ${glass(0.8)}`, radius: '999px',
                           shadow: '0 2px 10px rgba(245, 169, 184, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.6)',
                           hover: 'filter: brightness(1.08); box-shadow: 0 0 14px rgba(255, 255, 255, 0.55), 0 0 22px rgba(245, 169, 184, 0.5) !important;',
                           extra: `font-family: ${ROUND_FONT}; font-weight: 800;` },
                    filled: { radius: '12px', border: `1px solid ${glass(0.8)}`, shadow: '0 0 8px rgba(255, 255, 255, 0.25)' },
                    popup: { bg: 'rgba(36, 26, 68, 0.96)', border: `1px solid ${glass(0.6)}`, radius: '18px', hover: 'rgba(245, 169, 184, 0.22)', head: '#ffffff',
                             shadow: '0 0 0 3px rgba(91, 206, 250, 0.28), 0 0 24px rgba(245, 169, 184, 0.35), 0 12px 30px rgba(0, 0, 0, 0.5)' },
                    win: { border: `1px solid ${glass(0.6)}`, radius: '18px', shadow: '0 0 0 3px rgba(91, 206, 250, 0.3), 0 0 30px rgba(245, 169, 184, 0.35), 0 16px 40px rgba(0, 0, 0, 0.5)',
                           head: 'linear-gradient(90deg, rgba(91, 206, 250, 0.45), rgba(245, 169, 184, 0.45), rgba(255, 255, 255, 0.3))', headBorder: `1px solid ${glass(0.35)}`, title: '#ffffff' },
                    panel: { radius: '14px', border: glass(0.35), pressed: '#f5a9b8' },
                };
            },
            extra: (S, A, fx) => `
                ${S} .mcfo-dream-sky { position: absolute; left: 34%; top: 50%; width: 46px; height: 26px; transform: translate(-50%, -50%); pointer-events: none; }
                ${S} .mcfo-dream-sky i { position: absolute; left: 12px; top: 2px; width: 20px; height: 20px; border-radius: 50%; box-shadow: inset 6px -3px 0 0 #fff4d6;
                    filter: drop-shadow(0 0 4px rgba(255, 244, 214, 0.8)); }
                ${S} .mcfo-dream-sky b { position: absolute; width: 3px; height: 3px; border-radius: 50%; background: #ffffff; box-shadow: 0 0 5px 1px #f5a9b8; }
                ${S} .mcfo-dream-sky b:nth-of-type(1) { left: 2px; top: 5px; }
                ${S} .mcfo-dream-sky b:nth-of-type(2) { left: 38px; top: 16px; background: #bfeaff; box-shadow: 0 0 5px 1px #5bcefa; animation-delay: 0.8s; }
                ${fx(['full', 'subtle'], '.mcfo-dream-sky b')} { animation-name: mcfoTwinkle; animation-duration: 1.8s; animation-iteration-count: infinite; animation-direction: alternate; }
                @keyframes mcfoTwinkle { from { opacity: 0.15; } to { opacity: 1; } }`,
            decor: [{ cls: 'mcfo-dream-sky', host: () => document.querySelector('.mcf-chat__header'), html: '<i></i><b></b><b></b>' }],
            particles: [drifters('dream', () => document.querySelector('.mcf-chat:not([data-collapsed="true"])'), 16,
                (w, h, any) => ({ x: rnd(8, w - 8), y: any ? rnd(0, h) : h + 10, v: rnd(6, 13), ph: rnd(0, 6), heart: Math.random() < 0.35,
                                  c: pickOf(Math.random, ['#5bcefa', '#f5a9b8', '#ffffff']) }),
                (p, dt, now) => { p.y -= p.v * dt; p.x += Math.sin(now / 900 + p.ph) * 8 * dt; return p.y > -12; },
                (g, p, now) => {
                    const a = 0.35 + 0.35 * Math.sin(now / 420 + p.ph);
                    g.globalAlpha = Math.max(0.05, a); g.fillStyle = p.c;
                    if (p.heart) heartPath(g, p.x, p.y, 8); else sparklePath(g, p.x, p.y, 4 + 2 * Math.sin(now / 300 + p.ph));
                })],
            tile: () => 'background: radial-gradient(circle at 70% 45%, transparent 0 5px, #fff4d6 5px 8px, transparent 8.5px), linear-gradient(90deg, #5bcefa, #f5a9b8, #ffffff, #f5a9b8, #5bcefa) bottom / 100% 5px no-repeat, linear-gradient(180deg, #1e1840, #3a2352);',
        }),

        // ---- Signature: CuteLegoGirl — bricks and studs ----
        bricks: deluxe({
            kit: () => {
                const brickRow = 'linear-gradient(90deg, rgba(0, 0, 0, 0.35) 0 2px, transparent 2px) 0 0 / 96px 100%, linear-gradient(90deg, #d01012 0 25%, #ffcd03 25% 50%, #006cb7 50% 75%, #00852b 75%) 0 0 / 384px 100%';
                return {
                    titleCss: `font-family: ${ROUND_FONT}; font-weight: 900;`,
                    ground: `${STUDS('#4b9f4a', 24)}, #4b9f4a`,
                    header: { bg: `radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.28) 0 4px, rgba(0, 0, 0, 0.18) 4px 6px, transparent 6.5px) 0 2px / 24px 14px repeat-x, ${brickRow}`,
                              border: '3px solid rgba(0, 0, 0, 0.45)' },
                    cards: { bg: '#3a3a3a', border: '2px solid #262626', radius: '4px', shadow: 'inset 0 -4px 0 rgba(0, 0, 0, 0.35), inset 0 2px 0 rgba(255, 255, 255, 0.18)' },
                    footer: { bg: `${STUDS('#8a8a8a', 20)}, #8a8a8a`, border: '3px solid #5a5a5a' },
                    chat: {
                        bg: `${STUDS('#2d2d2d', 22)}, #262626`, border: '8px solid #ffcd03', radius: '4px', pad: '10px 0 0',
                        shadow: 'inset 0 0 0 2px rgba(0, 0, 0, 0.25), 0 6px 0 #b38f00, 0 10px 20px rgba(0, 0, 0, 0.4)',
                        head: 'linear-gradient(90deg, rgba(0, 0, 0, 0.3) 0 2px, transparent 2px) 0 0 / 64px 100%, #d01012', headBorder: '3px solid #8a0a0b', headText: '#ffffff',
                        body: 'rgba(20, 20, 20, 0.78)',
                        comp: 'linear-gradient(90deg, rgba(0, 0, 0, 0.3) 0 2px, transparent 2px) 0 0 / 64px 100%, #006cb7', compBorder: '3px solid #004b80',
                        input: { bg: '#f4f4f4', border: '2px solid #262626', color: '#1b1b1b', radius: '4px', hint: '#777777' },
                    },
                    btn: { bg: '#ffcd03', color: '#1b1b1b', border: '2px solid rgba(0, 0, 0, 0.5)', radius: '4px',
                           shadow: 'inset 0 -4px 0 rgba(0, 0, 0, 0.2), inset 0 2px 0 rgba(255, 255, 255, 0.45)',
                           hover: 'transform: translateY(-2px); filter: brightness(1.05);', extra: `font-family: ${ROUND_FONT}; font-weight: 900; transition: transform 90ms ease;` },
                    filled: { radius: '4px', border: '2px solid rgba(0, 0, 0, 0.45)', shadow: 'inset 0 -4px 0 rgba(0, 0, 0, 0.22), inset 0 2px 0 rgba(255, 255, 255, 0.35)' },
                    popup: { bg: '#3a3a3a', border: '3px solid #ffcd03', radius: '6px', hover: 'rgba(255, 205, 3, 0.22)', head: '#ffcd03',
                             shadow: '0 6px 0 #b38f00, 0 12px 30px rgba(0, 0, 0, 0.5)' },
                    win: { border: '4px solid #d01012', radius: '6px', shadow: '0 6px 0 #8a0a0b, 0 16px 40px rgba(0, 0, 0, 0.5)', title: '#ffffff',
                           head: 'radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.25) 0 4px, rgba(0, 0, 0, 0.2) 4px 6px, transparent 6.5px) 0 2px / 22px 14px repeat-x, #d01012' },
                    panel: { radius: '6px', border: '#ffcd03', pressed: '#ffcd03' },
                };
            },
            extra: (S, A, fx) => `
                ${S} .mcfo-rebellion { background: #d01012 !important; color: #ffffff !important; }
                ${S} .mcfo-unbid { background: #006cb7 !important; color: #ffffff !important; }
                ${S} .mcfo-autobid { background: #00852b !important; color: #ffffff !important; }
                ${S} .mcf-chat__send { background: #00852b !important; color: #ffffff !important; }
                ${S} .mcfo-brick-studs { position: absolute; left: 0; right: 0; top: 0; height: 10px; pointer-events: none; z-index: 2;
                    background: radial-gradient(circle at 50% 60%, #ffe066 0 5px, #b38f00 5px 6px, transparent 6.5px) 4px 0 / 20px 12px repeat-x; }
                ${S} .mcfo-brick-head { position: absolute; left: 34%; top: 50%; width: 22px; height: 20px; transform: translate(-50%, -40%); pointer-events: none;
                    border-radius: 6px 6px 8px 8px; box-shadow: inset -2px -2px 0 rgba(0, 0, 0, 0.18);
                    background: radial-gradient(circle at 34% 42%, #1b1b1b 0 1.7px, transparent 2.1px), radial-gradient(circle at 66% 42%, #1b1b1b 0 1.7px, transparent 2.1px), #ffcd03; }
                ${S} .mcfo-brick-head::before { content: ''; position: absolute; left: 7px; top: -4px; width: 8px; height: 4px; border-radius: 2px 2px 0 0; background: #ffcd03; }
                ${S} .mcfo-brick-head::after { content: ''; position: absolute; left: 6px; top: 10px; width: 10px; height: 4px; border-bottom: 1.7px solid #1b1b1b; border-radius: 0 0 6px 6px; }
                ${fx(['full', 'subtle'], '.mcfo-brick-head')} { animation: mcfoBob 1.4s ease-in-out infinite alternate; }
                @keyframes mcfoBob { from { transform: translate(-50%, -44%); } to { transform: translate(-50%, -34%); } }`,
            decor: [
                { cls: 'mcfo-brick-studs', host: () => document.querySelector('.mcf-chat'), html: '' },
                { cls: 'mcfo-brick-head', host: () => document.querySelector('.mcf-chat__header'), html: '' },
            ],
            particles: [drifters('bricks', () => document.querySelector('.mcf-chat:not([data-collapsed="true"])'), 6,
                (w, h, any) => ({ x: rnd(0, w - 24), y: any ? rnd(0, h) : -20, v: rnd(16, 28), c: pickOf(Math.random, ['#d01012', '#ffcd03', '#006cb7', '#00852b', '#f4f4f4']) }),
                (p, dt, now, w, h) => (p.y += p.v * dt) < h + 20,
                (g, p) => {
                    g.globalAlpha = 0.28; g.fillStyle = p.c;
                    g.fillRect(p.x, p.y, 24, 12); g.fillRect(p.x + 3, p.y - 3, 6, 3); g.fillRect(p.x + 15, p.y - 3, 6, 3);
                    g.fillStyle = 'rgba(0, 0, 0, 0.3)'; g.fillRect(p.x, p.y + 10, 24, 2);
                })],
            tile: () => `background: radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.3) 0 3px, rgba(0, 0, 0, 0.2) 3px 4.5px, transparent 5px) 0 2px / 14px 10px repeat-x,
                         linear-gradient(90deg, #d01012 0 25%, #ffcd03 25% 50%, #006cb7 50% 75%, #00852b 75%);`,
        }),

        // ---- Signature: NuceLoire — high roller: felt, gold, chips, dice ----
        casino: deluxe({
            assets: () => ({ d6: diceSvg(6), d5: diceSvg(5) }),
            kit: () => {
                const bulbs = 'radial-gradient(circle, #fff3b0 0 2.5px, rgba(255, 215, 100, 0.55) 3px, transparent 5px)';
                return {
                    titleCss: 'font-family: Didot, "Bodoni MT", "Playfair Display", Georgia, serif; text-transform: uppercase; letter-spacing: 0.14em;',
                    ground: 'repeating-linear-gradient(45deg, rgba(0, 0, 0, 0.12) 0 2px, transparent 2px 22px), repeating-linear-gradient(-45deg, rgba(0, 0, 0, 0.12) 0 2px, transparent 2px 22px), radial-gradient(ellipse at 50% 40%, #0f6e37, #063d1e 75%)',
                    header: { bg: `${bulbs} 0 calc(100% - 3px) / 22px 10px repeat-x, linear-gradient(180deg, #1a1a1a, #050505)`, border: '3px solid #d4af37' },
                    cards: { bg: 'rgba(8, 8, 8, 0.86)', border: '1px solid #d4af37', radius: '6px', shadow: 'inset 0 0 0 1px rgba(245, 215, 122, 0.15)' },
                    footer: { bg: `${bulbs} 0 3px / 22px 10px repeat-x, linear-gradient(180deg, #4a1f0e, #2a1007)`, border: '3px solid #d4af37' },
                    chat: {
                        bg: 'radial-gradient(ellipse at 50% 30%, #11763d, #07451f 80%)', border: '6px solid #3b1a0b', radius: '18px',
                        shadow: 'inset 0 0 0 2px #d4af37, 0 0 0 2px #d4af37, 0 10px 24px rgba(0, 0, 0, 0.5)',
                        head: 'linear-gradient(180deg, #151515, #050505)', headBorder: '2px solid #d4af37', headText: '#f5d77a',
                        comp: 'linear-gradient(180deg, #151515, #050505)', compBorder: '2px solid #d4af37',
                        input: { bg: '#0b0b0b', border: '1px solid #d4af37', color: '#f5f0e1', radius: '8px' },
                    },
                    btn: { bg: '#b3001b', color: '#ffffff', border: '2px dashed #f5f0e1', radius: '999px', shadow: '0 0 0 2px #b3001b, 0 3px 0 #5a000d',
                           hover: 'filter: brightness(1.12); box-shadow: 0 0 0 2px #b3001b, 0 0 12px rgba(245, 215, 122, 0.7) !important;', extra: 'font-weight: 800;' },
                    filled: { radius: '999px', border: '2px dashed rgba(255, 255, 255, 0.85)', shadow: '0 0 0 2px rgba(0, 0, 0, 0.35), 0 3px 0 rgba(0, 0, 0, 0.45)' },
                    popup: { bg: '#0b0b0b', border: '2px solid #d4af37', radius: '10px', hover: 'rgba(179, 0, 27, 0.35)', head: '#f5d77a',
                             shadow: '0 0 0 1px #5a4510, 0 0 18px rgba(212, 175, 55, 0.3), 0 12px 30px rgba(0, 0, 0, 0.7)' },
                    win: { border: '3px solid #d4af37', radius: '10px', shadow: '0 0 0 2px #3b1a0b, 0 16px 40px rgba(0, 0, 0, 0.7)',
                           head: 'linear-gradient(180deg, #151515, #050505)', headBorder: '2px solid #d4af37', title: '#f5d77a' },
                    panel: { radius: '8px', border: '#8a7224', pressed: '#f5d77a' },
                };
            },
            extra: (S, A, fx) => `
                ${S} :is(.mcf-chat__send, .mcfo-signpost, [data-role="diamonds-purchase-link"]) { background: #d4af37 !important; color: #111111 !important; box-shadow: 0 0 0 2px #d4af37, 0 3px 0 #6e5712 !important; }
                ${S} .mcfo-autobid { background: #111111 !important; box-shadow: 0 0 0 2px #111111, 0 3px 0 #000000 !important; }
                ${fx(['full', 'subtle'], '[data-role="top-status-region"]')} { animation: mcfoMarquee 1.1s steps(2) infinite; }
                ${fx(['full', 'subtle'], '[data-role="action-region"]')} { animation: mcfoMarquee 1.1s steps(2) infinite reverse; }
                @keyframes mcfoMarquee { from { background-position: 0 calc(100% - 3px), 0 0; } to { background-position: 11px calc(100% - 3px), 0 0; } }
                ${S} .mcfo-casino-dice { position: absolute; left: 34%; top: 50%; transform: translate(-50%, -50%); display: flex; gap: 4px; pointer-events: none; }
                ${S} .mcfo-casino-dice i { display: block; width: 17px; height: 17px; background-size: contain; filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.6)); }
                ${S} .mcfo-casino-dice i:nth-child(1) { background-image: url("${A.d6}"); transform: rotate(-12deg); }
                ${S} .mcfo-casino-dice i:nth-child(2) { background-image: url("${A.d5}"); transform: rotate(9deg); }
                ${fx(['full'], '.mcfo-casino-dice i')} { animation: mcfoRoll 5s ease-in-out infinite; }
                @keyframes mcfoRoll { 0%, 86% { rotate: 0deg; } 90% { rotate: 180deg; } 94% { rotate: 300deg; } 100% { rotate: 360deg; } }`,
            decor: [{ cls: 'mcfo-casino-dice', host: () => document.querySelector('.mcf-chat__header'), html: '<i></i><i></i>' }],
            particles: [drifters('chips', () => document.querySelector('.mcf-chat:not([data-collapsed="true"])'), 8,
                (w, h, any) => ({ x: rnd(10, w - 10), y: any ? rnd(0, h) : -14, v: rnd(14, 26), ph: rnd(0, 6), c: pickOf(Math.random, ['#b3001b', '#111111', '#1f4fbf', '#d4af37', '#f5f0e1']) }),
                (p, dt, now, w, h) => (p.y += p.v * dt) < h + 14,
                (g, p, now) => {
                    const sy = Math.max(0.25, Math.abs(Math.cos(now / 500 + p.ph)));
                    g.globalAlpha = 0.45;
                    g.fillStyle = p.c; g.beginPath(); g.ellipse(p.x, p.y, 8, 8 * sy, 0, 0, Math.PI * 2); g.fill();
                    g.setLineDash([2.5, 2.5]); g.strokeStyle = '#ffffff'; g.lineWidth = 1.6;
                    g.beginPath(); g.ellipse(p.x, p.y, 6, 6 * sy, 0, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
                })],
            tile: A => `background: url("${A.d6}") 62% 50% / 16px 16px no-repeat, url("${A.d5}") 80% 50% / 16px 16px no-repeat,
                        radial-gradient(circle at 25% 50%, #b3001b 0 8px, #ffffff 8px 9.5px, #b3001b 9.5px 11px, transparent 11.5px), radial-gradient(ellipse at 50% 40%, #0f6e37, #063d1e 80%);
                        box-shadow: inset 0 0 0 2px #d4af37;`,
        }),

        // ---- Signature: ninkasi1001 — Ninkasi, the Sumerian goddess of beer ----
        // The chat is a glass of amber ale: a head of foam on top, bubbles rising through it. The
        // header is a clay tablet carrying a line of her hymn in real cuneiform, the footer a barrel.
        // In the chat header a mug, and before it DINGIR, the sign scribes wrote before every god's name.
        ninkasi: deluxe({
            assets: () => ({ hymn: cuneiformLine(HYMN_LINE, '#4a200c'), faint: cuneiformLine(HYMN_LINE, '#f2b233', 0.08), mug: mugSvg(), dingir: glyphSvg('AN', '#9a4c16') }),
            kit: A => {
                const foam = 'radial-gradient(circle at 20% 30%, #ffffff 0 3px, transparent 3.5px) 0 0 / 14px 10px, radial-gradient(circle at 70% 65%, rgba(255, 255, 255, 0.8) 0 2px, transparent 2.5px) 0 0 / 11px 9px, linear-gradient(180deg, #fff8e6, #f3e2b8)';
                const clay = `url("${A.hymn.url}") 0 50% / ${Math.round(20 * A.hymn.ratio)}px 20px repeat-x, linear-gradient(180deg, #b8643a, #8e4424)`;
                // Staves of 38px, each rounded by its own light, and an iron hoop along either edge.
                const barrel = 'linear-gradient(180deg, transparent 0 4px, #333333 4px 8px, #707070 8px 9px, transparent 9px calc(100% - 9px), #707070 calc(100% - 9px) calc(100% - 8px), #333333 calc(100% - 8px) calc(100% - 4px), transparent calc(100% - 4px)), '
                    + 'linear-gradient(90deg, rgba(0, 0, 0, 0.4) 0 2px, transparent 2px) 0 0 / 38px 100%, linear-gradient(90deg, #6b3d1c, #94602f 50%, #6b3d1c) 0 0 / 38px 100%';
                return {
                    titleCss: `font-family: ${FANTASY_FONT}; letter-spacing: 0.08em;`,
                    ground: `url("${A.faint.url}") 0 0 / ${Math.round(22 * A.faint.ratio)}px 22px, radial-gradient(ellipse at 50% 0%, rgba(242, 178, 51, 0.16), transparent 60%), linear-gradient(180deg, #2a170b, #170c05)`,
                    header: { bg: clay, border: '3px solid #5a2a12', extra: 'box-shadow: inset 0 2px 0 rgba(255, 220, 180, 0.25) !important;' },
                    cards: { bg: 'rgba(36, 20, 9, 0.86)', border: '1px solid #c8862e', radius: '8px', shadow: 'inset 0 0 0 1px rgba(242, 178, 51, 0.15)' },
                    footer: { bg: barrel, border: '3px solid #333333' },
                    chat: {
                        // Glass: rounded at the foot, a streak of light down the left side.
                        bg: 'linear-gradient(180deg, #c7761f 0%, #8f4a10 40%, #5c2d08 100%)', border: '3px solid rgba(255, 244, 220, 0.55)', radius: '6px 6px 22px 22px',
                        shadow: 'inset 7px 0 0 rgba(255, 255, 255, 0.1), inset -3px 0 0 rgba(0, 0, 0, 0.2), 0 10px 24px rgba(0, 0, 0, 0.5)',
                        head: foam, headBorder: '2px solid #d9b877', headText: '#5a2f0e',
                        body: 'linear-gradient(180deg, rgba(60, 28, 6, 0.5), rgba(38, 17, 4, 0.66))',
                        comp: 'linear-gradient(180deg, #4a2a12, #331c0b)', compBorder: '2px solid #c8862e',
                        input: { bg: '#fbf3df', border: '2px solid #c8862e', color: '#2a1a0c', radius: '999px', hint: '#8a6a45' },
                    },
                    // Buttons are beer mats: round, cream-edged, amber.
                    btn: { bg: 'linear-gradient(180deg, #f7c65a, #e09a26)', color: '#3a1d06', border: '2px solid #fff1cf', radius: '999px',
                           shadow: '0 0 0 2px #8a4a12, 0 3px 0 #5c2d08',
                           hover: 'filter: brightness(1.08); box-shadow: 0 0 0 2px #8a4a12, 0 0 12px rgba(247, 198, 90, 0.7) !important;', extra: 'font-weight: 800;' },
                    filled: { radius: '999px', border: '2px solid rgba(255, 241, 207, 0.85)', shadow: '0 0 0 2px rgba(60, 28, 6, 0.45), 0 3px 0 rgba(0, 0, 0, 0.4)' },
                    popup: { bg: '#2a170b', border: '2px solid #c8862e', radius: '12px', hover: 'rgba(242, 178, 51, 0.22)', head: '#f7c65a',
                             shadow: '0 0 0 1px #5a2a12, 0 0 18px rgba(242, 178, 51, 0.25), 0 12px 30px rgba(0, 0, 0, 0.6)' },
                    win: { border: '3px solid #8e4424', radius: '10px', shadow: '0 0 0 2px #3a1d0a, 0 16px 40px rgba(0, 0, 0, 0.6)',
                           head: clay, headBorder: '2px solid #5a2a12', title: '#fff1cf' },
                    panel: { radius: '10px', border: '#8a5a2a', pressed: '#f7c65a' },
                };
            },
            extra: (S, A, fx) => `
                ${S} .mcf-chat__header .mcf-chat__status { color: #7a4a1c !important; }
                ${S} .mcfo-win__title { text-shadow: 0 1px 0 rgba(0, 0, 0, 0.5); }
                ${S} .mcfo-ninkasi-mug { position: absolute; left: 34%; top: 50%; transform: translate(-50%, -50%); display: flex; align-items: center; gap: 3px; pointer-events: none; }
                /* On the foam DINGIR is dark amber with a golden glow — pale gold vanished into the cream. */
                ${S} .mcfo-ninkasi-mug b { display: block; width: 15px; height: 15px; background: url("${A.dingir}") center / contain no-repeat; filter: drop-shadow(0 0 2px rgba(247, 198, 90, 0.95)); }
                ${S} .mcfo-ninkasi-mug i { display: block; width: 21px; height: 21px; background: url("${A.mug}") center / contain no-repeat; transform-origin: 30% 90%;
                    filter: drop-shadow(0 1px 1px rgba(90, 42, 18, 0.5)); }
                ${fx(['full', 'subtle'], '.mcfo-ninkasi-mug i')} { animation: mcfoCheers 4.5s ease-in-out infinite; }
                ${fx(['full', 'subtle'], '.mcfo-ninkasi-mug b')} { animation: mcfoDingir 2.4s ease-in-out infinite alternate; }
                @keyframes mcfoCheers { 0%, 78% { rotate: 0deg; } 84% { rotate: -16deg; } 90% { rotate: 7deg; } 95%, 100% { rotate: 0deg; } }
                @keyframes mcfoDingir { from { opacity: 0.55; } to { opacity: 1; } }`,
            decor: [{ cls: 'mcfo-ninkasi-mug', host: () => document.querySelector('.mcf-chat__header'), html: '<b></b><i></i>' }],
            particles: [drifters('bubbles', () => document.querySelector('.mcf-chat:not([data-collapsed="true"])'), 18,
                (w, h, any) => ({ x: rnd(6, w - 6), y: any ? rnd(0, h) : h + 6, r: rnd(1.2, 3.2), v: rnd(18, 42), ph: rnd(0, 6) }),
                (p, dt, now) => { p.y -= p.v * dt; p.x += Math.sin(now / 300 + p.ph) * 6 * dt; return p.y > -6; },
                (g, p) => {
                    g.globalAlpha = 0.55;
                    g.strokeStyle = 'rgba(255, 240, 200, 0.9)'; g.lineWidth = 1;
                    g.beginPath(); g.arc(p.x, p.y, p.r, 0, Math.PI * 2); g.stroke();
                    g.fillStyle = 'rgba(255, 250, 235, 0.9)'; g.fillRect(p.x - p.r * 0.45, p.y - p.r * 0.55, 1, 1);
                })],
            tile: A => `background: url("${A.mug}") 42% 62% / 20px 20px no-repeat, url("${A.hymn.url}") 0 100% / ${Math.round(12 * A.hymn.ratio)}px 12px repeat-x,
                        linear-gradient(180deg, #fff8e6 0 22%, #e8cf98 22% 27%, #d98a22 27%, #8f4a10 calc(100% - 12px), #a4532c calc(100% - 12px));
                        box-shadow: inset 0 0 0 2px #c8862e;`,
        }),
    });

    // =========================================================================================
    // 3e. FILM & TV (6.16)
    // =========================================================================================
    // Seven themes you should know at first sight. Each carries the picture its film or series is
    // remembered by — the devil's trap, the element boxes, the time circuits, the googly eyes, the
    // crawl, the spiral, the marquee — drawn here from scratch: no stills, no logos, no fonts of
    // theirs. Texts are our own.
    const SPN_FONT = '"Trajan Pro", "Cinzel", Optima, "Palatino Linotype", "Book Antiqua", Georgia, serif';
    const DECO_FONT = '"Limelight", "Broadway", "Poiret One", Didot, "Bodoni MT", Georgia, serif';
    const CONDENSED_FONT = '"Bebas Neue", "Oswald", "League Gothic", "Arial Narrow", Impact, sans-serif';
    const GEO_FONT = 'Futura, "Century Gothic", "Avenir Next", "Josefin Sans", "Trebuchet MS", sans-serif';

    // Film grain: black specks of noise, a = how dense.
    const grainSvg = (a, freq = 0.85) => svgUrl('<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180">'
        + `<filter id="g"><feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 ${a} 0"/></filter>`
        + '<rect width="180" height="180" filter="url(#g)"/></svg>');
    const polar = (r, deg) => [+(r * Math.cos(deg * Math.PI / 180)).toFixed(2), +(r * Math.sin(deg * Math.PI / 180)).toFixed(2)];
    const starPath = r => [0, 2, 4, 1, 3].map((k, i) => (i ? 'L' : 'M') + polar(r, -90 + k * 72).join(' ')).join('') + 'Z';

    // ---- Supernatural ----
    // A devil's trap: two rings, the pentagram, signs between the rings and in the points. The signs
    // are made-up strokes, not the ones from the show.
    const SIGILS = ['M-1.4-2V2M-1.4 0H1.6', 'M-2 2L0-2 2 2', 'M-1.8-1.8L1.8 1.8M1.8-1.8L-1.8 1.8', 'M0-2V2M-2-.8H2M-2 .8H2',
                    'M-2-2H2L-2 2H2', 'M-2 0A2 2 0 1 1 2 0M0 0V2.2', 'M-2 2V-2L2 2V-2', 'M-1.6-2L1.6 0-1.6 2'];
    function devilsTrapSvg(c, w = 1) {
        const r = seeded(666);
        let marks = '';
        for (let i = 0; i < 24; i++) {
            const deg = i * 15 + 7.5, [x, y] = polar(43.2, deg);
            marks += `<path transform="translate(${x} ${y}) rotate(${deg + 90})" d="${pickOf(r, SIGILS)}"/>`;
        }
        for (let i = 0; i < 5; i++) {
            const [x, y] = polar(26, -90 + i * 72);
            marks += `<path transform="translate(${x} ${y}) scale(1.3)" d="${pickOf(r, SIGILS)}"/>`;
        }
        return svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="-50 -50 100 100"><g fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">`
            + `<circle r="48"/><circle r="38.5"/><path d="${starPath(38.5)}"/><circle r="10"/><path transform="scale(1.6)" d="M-2-2V2M2-2V2M-2 0H2"/>${marks}</g></svg>`);
    }
    // The anti-possession sign: pentagram in a ring, a sun of flames around it.
    function antiPossessionSvg(c) {
        let flames = '';
        for (let i = 0; i < 16; i++) {
            const a = i * 22.5, [x0, y0] = polar(33, a - 7), [x1, y1] = polar(33, a + 7), [tx, ty] = polar(48, a + 6), [cx, cy] = polar(40, a - 7), [dx, dy] = polar(39, a + 10);
            flames += `M${x0} ${y0}Q${cx} ${cy} ${tx} ${ty}Q${dx} ${dy} ${x1} ${y1}Z`;
        }
        return svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="-50 -50 100 100"><path fill="${c}" d="${flames}"/>`
            + `<g fill="none" stroke="${c}" stroke-width="3.4" stroke-linejoin="round"><circle r="31"/><path d="${starPath(29)}"/></g></svg>`);
    }
    // A line of salt across the door.
    function saltSvg() {
        const r = seeded(13);
        let d = '';
        for (let i = 0; i < 190; i++) {
            d += `<circle cx="${(r() * 240).toFixed(1)}" cy="${(4 + r() * 3.5 + (r() < 0.12 ? (r() - 0.5) * 6 : 0)).toFixed(1)}" r="${(0.35 + r() * 0.75).toFixed(2)}" opacity="${(0.45 + r() * 0.55).toFixed(2)}"/>`;
        }
        return svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 12"><g fill="#f4efe6">${d}</g></svg>`);
    }
    const emberMake = (w, h, any) => ({ x: rnd(4, w - 4), y: any ? rnd(0, h) : h + 4, v: rnd(14, 36), ph: rnd(0, 6), r: rnd(0.7, 1.7) });
    const emberMove = (p, dt, now) => { p.y -= p.v * dt; p.x += Math.sin(now / 380 + p.ph) * 12 * dt; return p.y > -6; };
    function emberDraw(g, p, now, w, h) {
        const a = Math.max(0, Math.min(1, p.y / (h * 0.6))) * (0.55 + 0.45 * Math.sin(now / 90 + p.ph * 7));
        glowDot(g, p.x, p.y, p.r * 5, '255, 110, 20', a * 0.45);
        glowDot(g, p.x, p.y, p.r * 1.4, '255, 214, 150', a);
    }

    // ---- Breaking Bad ----
    const heisenbergSvg = c => svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" fill="${c}">`
        + '<path d="M11 17C11 8.5 14 6 20 6s9 2.5 9 11z"/><ellipse cx="20" cy="17.4" rx="16" ry="2.6"/>'
        + '<path d="M9.5 22h8.5l-.6 4.2c-.2 1-1 1.6-2 1.6h-3.6c-1 0-1.8-.7-2-1.6zM22 22h8.5l-.7 4.2c-.2 1-1 1.6-2 1.6h-3.6c-1 0-1.8-.7-2-1.6zM17.5 22.6h5v1.2h-5z"/>'
        + '<path d="M14.5 31.2c2-1.4 3.8-1.6 5.5-.8 1.7-.8 3.5-.6 5.5.8-2 .2-3.7.3-5.5.2-1.8.1-3.5 0-5.5-.2zM17.2 33h5.6c-.4 2.6-1.4 4.2-2.8 4.2s-2.4-1.6-2.8-4.2z"/></svg>');
    // One box of the periodic table: atomic number, symbol, mass.
    function elementTile(n, sym, mass, id, hot) {
        return `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${hot ? '#62b574' : '#3b7f4b'}"/><stop offset="1" stop-color="${hot ? '#1e5a2e' : '#153f22'}"/></linearGradient></defs>`
            + `<rect x="1" y="1" width="38" height="42" fill="url(#${id})" stroke="#d7f0dc" stroke-width="1.4"/>`
            + `<text x="4" y="9.5" font-family="Arial, sans-serif" font-size="7" fill="#e9f7ec">${n}</text>`
            + `<text x="20" y="31" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-weight="700" font-size="21" fill="#ffffff">${sym}</text>`
            + `<text x="20" y="40" text-anchor="middle" font-family="Arial, sans-serif" font-size="5" fill="#cfead5">${mass}</text>`;
    }
    const elementTileSvg = (n, sym, mass, id, hot) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 44">${elementTile(n, sym, mass, id, hot)}</svg>`;
    const ELEMENTS = [[1, 'H', '1.008'], [6, 'C', '12.011'], [7, 'N', '14.007'], [8, 'O', '15.999'], [11, 'Na', '22.990'], [3, 'Li', '6.94'],
                      [15, 'P', '30.974'], [16, 'S', '32.06'], [17, 'Cl', '35.45'], [80, 'Hg', '200.59'], [19, 'K', '39.098'], [53, 'I', '126.90']];
    const elementStripSvg = a => svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ELEMENTS.length * 48} 44"><g opacity="${a}">`
        + ELEMENTS.map(([n, s, m], i) => `<g transform="translate(${i * 48 + 4} 0)">${elementTile(n, s, m, 'e' + i, false)}</g>`).join('') + '</g></svg>');
    const mesaSvg = (far, near) => svgUrl('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 90" preserveAspectRatio="none">'
        + `<path fill="${far}" d="M0 90V52l22-3 10-18h44l9 16 40 4 18-26h52l8 20 60 2 12-14h34l10 18 38-2 12-22h22l9 24V90z"/>`
        + `<path fill="${near}" d="M0 90V70l40-4 16-14h30l12 12 70 4 20-10h44l14 12 80 2 20-16h28l26 18V90z"/></svg>`);
    function crystalDraw(g, p, now) {
        g.save(); g.translate(p.x, p.y); g.rotate(p.a + now / 1000 * p.spin);
        g.globalAlpha = 0.75;
        g.fillStyle = '#6fd3ff';
        g.beginPath(); p.pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill();
        g.fillStyle = 'rgba(255, 255, 255, 0.85)';
        g.beginPath(); g.moveTo(p.pts[0][0], p.pts[0][1]); g.lineTo(p.pts[1][0], p.pts[1][1]); g.lineTo(0, 0); g.closePath(); g.fill();
        g.strokeStyle = '#1f7fb8'; g.lineWidth = 0.8;
        g.beginPath(); p.pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.stroke();
        g.restore();
    }

    // ---- Back to the Future ----
    // The time circuits: digits on seven segments, the month on fourteen, the unlit segments as a
    // faint ghost — the way the displays in the car look when they are on.
    const SEG = { t: [2, 1, 8, 1], b: [2, 17, 8, 17], ml: [2, 9, 5, 9], mr: [5, 9, 8, 9], ul: [1, 2, 1, 8], ll: [1, 10, 1, 16], ur: [9, 2, 9, 8], lr: [9, 10, 9, 16],
                  vu: [5, 2, 5, 8], vl: [5, 10, 5, 16], dul: [2, 2, 4.3, 7.8], dur: [8, 2, 5.7, 7.8], dll: [4.3, 10.2, 2, 16], dlr: [5.7, 10.2, 8, 16] };
    const SEG_DIGIT = ['t ur lr b ll ul', 'ur lr', 't ur ml mr ll b', 't ur ml mr lr b', 'ul ml mr ur lr', 't ul ml mr lr b', 't ul ml mr ll lr b', 't ur lr', 't ur lr b ll ul ml mr', 't ur lr b ul ml mr'];
    const SEG_ALPHA = { A: 't ur lr ll ul ml mr', B: 't ur lr b vu vl mr', C: 't ul ll b', D: 't ur lr b vu vl', E: 't ul ll b ml mr', F: 't ul ll ml', G: 't ul ll b lr mr',
                        J: 'ur lr b ll', L: 'ul ll b', M: 'ul ll ur lr dul dur', N: 'ul ll ur lr dul dlr', O: 't ur lr b ll ul', P: 't ur ul ll ml mr', R: 't ur ul ll ml mr dlr',
                        S: 't ul ml mr lr b', T: 't vu vl', U: 'ul ll b lr ur', V: 'ul ll dll dur', Y: 'dul dur vl' };
    const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    function segCell(x, ch, alpha) {
        const all = alpha ? Object.keys(SEG) : ['t', 'b', 'ml', 'mr', 'ul', 'll', 'ur', 'lr'];
        const lit = new Set(((alpha ? SEG_ALPHA[ch] : SEG_DIGIT[ch]) || '').split(' '));
        const line = k => { const [x1, y1, x2, y2] = SEG[k]; return `<line x1="${x + x1}" y1="${y1}" x2="${x + x2}" y2="${y2}"/>`; };
        return { off: all.filter(k => !lit.has(k)).map(line).join(''), on: all.filter(k => lit.has(k)).map(line).join('') };
    }
    // One row: MONTH DAY YEAR, AM/PM, HOUR:MIN, its name on a plate in its colour below.
    function tcRow(id, name, col, mon, day, year, pm, hour, min) {
        let x = 2, off = '', on = '', boxes = '', labels = '', lamps = '';
        const group = (label, text, alpha) => {
            const w = text.length * 11 + 3;
            boxes += `<rect x="${x}" y="5" width="${w}" height="20" rx="1.2"/>`;
            labels += `<text x="${x + w / 2}" y="3.9">${label}</text>`;
            [...text].forEach((ch, i) => { const c = segCell(x + 2 + i * 11, ch, alpha); off += c.off; on += c.on; });
            x += w + 4;
        };
        group('MONTH', mon, true);
        group('DAY', day);
        group('YEAR', year);
        labels += `<text x="${x + 4}" y="10">AM</text><text x="${x + 4}" y="19">PM</text>`;
        lamps += `<circle cx="${x + 4}" cy="13" r="1.7" fill="${pm ? '#2a2a2a' : col}"/><circle cx="${x + 4}" cy="22" r="1.7" fill="${pm ? col : '#2a2a2a'}"/>`;
        x += 12;
        group('HOUR', hour);
        lamps += `<g class="mcfo-tc-colon" fill="${col}"><circle cx="${x - 0.5}" cy="12" r="1.3"/><circle cx="${x - 0.5}" cy="18" r="1.3"/></g>`;
        x += 3;
        group('MIN', min);
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${x - 2} 32">`
            + `<defs><filter id="mcfoTc${id}" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="0.7" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>`
            + `<g fill="#060606" stroke="#44484d" stroke-width=".6">${boxes}</g>`
            + `<g font-family="Arial Narrow, Arial, sans-serif" font-size="3.6" fill="#d8d8d8" text-anchor="middle">${labels}</g>`
            + `<g transform="translate(0 6)" stroke-linecap="round" stroke-width="1.45" stroke="${col}"><g opacity=".12">${off}</g><g filter="url(#mcfoTc${id})">${on}</g></g>`
            + `${lamps}<rect x="2" y="26.6" width="${x - 6}" height="5" rx=".6" fill="${col}"/>`
            + `<text x="${(x - 2) / 2}" y="30.3" font-family="Arial Narrow, Arial, sans-serif" font-size="3.6" font-weight="700" letter-spacing="1.2" fill="#0b0b0b" text-anchor="middle">${name}</text></svg>`;
    }
    const TC_COL = { dest: '#ff3b2f', now: '#3dff6e', last: '#ffb000' };
    function tcNowRow() {
        const n = new Date(), pad = v => String(v).padStart(2, '0');
        return tcRow('n', 'PRESENT TIME', TC_COL.now, MONTHS[n.getMonth()], pad(n.getDate()), String(n.getFullYear()), n.getHours() >= 12, pad(n.getHours() % 12 || 12), pad(n.getMinutes()));
    }
    const FLUX_SVG = '<svg viewBox="0 0 30 34"><rect x="1" y="1" width="28" height="32" rx="2" fill="#3b3f45" stroke="#9aa0a6"/><rect x="4" y="4" width="22" height="26" rx="1" fill="#101214"/>'
        + '<path d="M7 8L15 17M23 8L15 17M15 17V28" stroke="#6b7078" stroke-width="3" stroke-linecap="round"/>'
        + '<path class="mcfo-flux-pulse" d="M7 8L15 17M23 8L15 17M15 28V17" stroke="#fff4b0" stroke-width="1.6" stroke-linecap="round" stroke-dasharray="1.2 3.2"/>'
        + '<circle cx="15" cy="17" r="2.4" fill="#fffbe0"/></svg>';
    const fireTrailsSvg = () => svgUrl('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 100" preserveAspectRatio="none">'
        + '<defs><linearGradient id="f" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#fff2a8"/><stop offset=".3" stop-color="#ffb000"/><stop offset=".7" stop-color="#ff4d00" stop-opacity=".75"/><stop offset="1" stop-color="#ff2a00" stop-opacity="0"/></linearGradient>'
        + '<filter id="b"><feGaussianBlur stdDeviation="2"/></filter></defs>'
        + '<g fill="url(#f)"><path filter="url(#b)" d="M40 100L196 6h2L110 100z"/><path filter="url(#b)" d="M360 100L204 6h-2L290 100z"/>'
        + '<path d="M60 100L196.5 8h1L86 100z"/><path d="M340 100L203.5 8h-1L314 100z"/></g></svg>');
    // The clock tower, stopped at 10:04, the bolt coming down on it.
    const clockTowerSvg = () => svgUrl('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 160">'
        + '<path fill="#f7f3c8" d="M62 0L50 14h5l-8 10h4l-1 6 8-12h-5l8-11h-5l6-7z"/>'
        + '<g fill="#05060c"><path d="M0 160V112h14V98h72v14h14v48z"/><path d="M30 98V62l20-14 20 14v36z"/><rect x="48" y="30" width="4" height="20"/></g>'
        + '<circle cx="50" cy="76" r="11" fill="#f4e7b2"/><circle cx="50" cy="76" r="11" fill="none" stroke="#05060c" stroke-width="1.4"/>'
        + '<path d="M50 76l-5.1-3.2M50 76l4.1-9.1" stroke="#05060c" stroke-width="1.4" stroke-linecap="round"/>'
        + '<g fill="#f0c060" opacity=".55"><rect x="6" y="122" width="7" height="11"/><rect x="21" y="122" width="7" height="11"/><rect x="72" y="122" width="7" height="11"/><rect x="87" y="122" width="7" height="11"/></g></svg>');

    // ---- Everything Everywhere All at Once ----
    function shardsSvg() {
        const r = seeded(2022), cols = ['#ff2a6d', '#05d9e8', '#ffd319', '#c8102e', '#7b2cbf', '#ffffff', '#3ddc84'];
        let s = '';
        for (let i = 0; i < 26; i++) {
            const x = r() * 420, y = r() * 420, k = 30 + r() * 90;
            s += `<path fill="${pickOf(r, cols)}" opacity="${(0.05 + r() * 0.1).toFixed(2)}" d="M${x.toFixed(0)} ${y.toFixed(0)}l${(k * (r() - 0.2)).toFixed(0)} ${(-k * r()).toFixed(0)}l${(k * r()).toFixed(0)} ${(k * (r() + 0.3)).toFixed(0)}z"/>`;
        }
        return svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 420">${s}</svg>`);
    }
    // The everything bagel: black, a hole in the middle, seeds of everything on it.
    function bagelSvg() {
        const r = seeded(8);
        let seeds = '';
        for (let i = 0; i < 70; i++) {
            const a = r() * 360, d = 11 + r() * 11.5, [x, y] = polar(d, a);
            seeds += `<ellipse cx="${x}" cy="${(y * 0.92).toFixed(2)}" rx="${(0.5 + r() * 0.5).toFixed(2)}" ry="${(0.9 + r() * 0.6).toFixed(2)}" transform="rotate(${(r() * 180).toFixed(0)} ${x} ${(y * 0.92).toFixed(2)})" fill="${pickOf(r, ['#f4ead0', '#e8d9a8', '#ffffff', '#9a8a70'])}"/>`;
        }
        return svgUrl('<svg xmlns="http://www.w3.org/2000/svg" viewBox="-30 -30 60 60"><defs><radialGradient id="g" cx=".42" cy=".36" r=".72"><stop offset="0" stop-color="#444444"/><stop offset=".55" stop-color="#141414"/><stop offset="1" stop-color="#000000"/></radialGradient></defs>'
            + `<path fill="url(#g)" fill-rule="evenodd" d="M-26 0a26 24 0 1 0 52 0a26 24 0 1 0-52 0zM-8 0a8 7 0 1 0 16 0a8 7 0 1 0-16 0z"/>${seeds}</svg>`);
    }
    // The title, spread over the header, each part in another typeface — another universe each.
    const bigWordsSvg = c => svgUrl('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 60" preserveAspectRatio="none">'
        + `<g fill="${c}"><text x="0" y="50" textLength="330" lengthAdjust="spacingAndGlyphs" font-family="Georgia, serif" font-style="italic" font-weight="700" font-size="52">Everything</text>`
        + '<text x="350" y="52" textLength="420" lengthAdjust="spacingAndGlyphs" font-family="Impact, Haettenschweiler, sans-serif" font-size="58">EVERYWHERE</text>'
        + '<text x="790" y="48" textLength="410" lengthAdjust="spacingAndGlyphs" font-family="Courier New, monospace" font-weight="700" font-size="46">all at once</text></g></svg>');
    const EYE = '<i class="mcfo-eye"><b></b></i>';

    // ---- Star Wars ----
    const deathStarSvg = () => svgUrl('<svg xmlns="http://www.w3.org/2000/svg" viewBox="-50 -50 100 100"><defs>'
        + '<radialGradient id="d" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#b9bfc6"/><stop offset=".6" stop-color="#6d747c"/><stop offset="1" stop-color="#2a2e33"/></radialGradient>'
        + '<radialGradient id="c" cx=".62" cy=".62" r=".7"><stop offset="0" stop-color="#8b9299"/><stop offset="1" stop-color="#3d4247"/></radialGradient></defs><g opacity=".6">'
        + '<circle r="46" fill="url(#d)"/><path d="M-46 1.5H46" stroke="#23272b" stroke-width="2.2"/><path d="M-45-.9H45" stroke="rgba(255,255,255,.2)" stroke-width=".6"/>'
        + '<circle cx="-16" cy="-17" r="11" fill="url(#c)" stroke="#2a2e33"/><circle cx="-16" cy="-17" r="2.4" fill="#2a2e33"/>'
        + '<g stroke="rgba(0,0,0,.2)" stroke-width=".5" fill="none"><ellipse rx="46" ry="16"/><ellipse rx="46" ry="32"/></g></g></svg>');
    const saberBg = c => `linear-gradient(90deg, #1c1e21 0 2px, #9aa0a6 2px 4px, #3a3e43 4px 6px, #c9ced3 6px 8px, #2a2d31 8px 9px, transparent 9px), linear-gradient(180deg, ${c} 0%, #ffffff 35% 65%, ${c} 100%)`;
    const saberGlow = (c, k = 1) => `0 0 ${4 * k}px 1px ${c}, 0 0 ${12 * k}px ${2 * k}px ${c}99`;
    function tieFighter(g, x, y, s) {
        g.fillStyle = '#8f98a2';
        g.fillRect(x - s * 0.9, y - s * 0.1, s * 1.8, s * 0.2);
        g.beginPath(); g.arc(x, y, s * 0.36, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#1d232a'; g.beginPath(); g.arc(x, y, s * 0.18, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#3a414a';
        g.fillRect(x - s * 1.02, y - s, s * 0.2, s * 2); g.fillRect(x + s * 0.82, y - s, s * 0.2, s * 2);
    }
    function xWing(g, x, y, s, dir) {   // from above, nose along dir
        g.save(); g.translate(x, y); g.scale(dir, 1);
        g.fillStyle = '#e6e8ea';
        g.beginPath(); g.moveTo(s * 1.5, 0); g.lineTo(-s * 0.8, -s * 0.16); g.lineTo(-s * 0.8, s * 0.16); g.closePath(); g.fill();
        g.fillRect(-s * 0.7, -s * 0.95, s * 0.36, s * 1.9);
        g.fillStyle = '#c8202c'; g.fillRect(-s * 0.7, -s * 0.95, s * 0.36, s * 0.2); g.fillRect(-s * 0.7, s * 0.75, s * 0.36, s * 0.2);
        g.fillStyle = '#9aa3ad'; g.fillRect(-s * 0.4, -s * 1.0, s * 1.2, s * 0.09); g.fillRect(-s * 0.4, s * 0.91, s * 1.2, s * 0.09);
        glowDot(g, -s * 0.95, 0, s * 0.55, '255, 130, 100', 0.85);
        g.restore();
    }
    const CRAWL = '<em>A long run ago, in a lane far, far away....</em><span><i><b>Episode M</b><strong>THE BID STRIKES BACK</strong>'
        + '<p>The throne of Crownfall is held by a greedy King. Across the lanes, a small band of marbles has gathered in secret, hoarding their tickets one bid at a time.</p>'
        + '<p>Tonight they strike. Only a perfect run can topple the crown and bring the gold home to the chat, where every rebel waits for the signal....</p></i></span>';

    // ---- Vertigo ----
    // Saul Bass: a whirlpool of two spirals, a man falling into it, shapes cut from paper.
    function spiralSvg(c, turns, w, a = 1) {
        let d = '', d2 = '';
        const max = turns * Math.PI * 2;
        for (let t = 0; t <= max; t += 0.12) {
            const r = 2 + (t / max) * 96;
            d += (t ? 'L' : 'M') + (r * Math.cos(t)).toFixed(1) + ' ' + (r * Math.sin(t)).toFixed(1);
            d2 += (t ? 'L' : 'M') + (r * Math.cos(t + Math.PI)).toFixed(1) + ' ' + (r * Math.sin(t + Math.PI)).toFixed(1);
        }
        return svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="-100 -100 200 200"><g fill="none" stroke="${c}" stroke-opacity="${a}" stroke-linecap="round"><path d="${d}" stroke-width="${w}"/><path d="${d2}" stroke-width="${w * 0.45}"/></g></svg>`);
    }
    const fallingManSvg = c => svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 80"><g fill="${c}" transform="rotate(-24 30 40)">`
        + '<circle cx="30" cy="11" r="5.2"/><path d="M23.5 18h13l2.5 24h-18z"/>'
        + '<path d="M24 19L9 4l-3.2 3L21.5 23zM36 19L52 7.5l2.6 3.4L38 24.5z"/>'
        + '<path d="M22 41h6.2l-7 22-5.6-2zM15.6 61l5.6 2-9.6 9.6-3-3zM32 41h6l6.5 17-5.2 2.2zM44.5 58l-5.2 2.2 5.8 15.6 4.4-1.4z"/></g></svg>');
    function cutPaperSvg(c, seed, top) {
        const r = seeded(seed);
        let d = '', x = 0;
        while (x < 640) {
            const w = 30 + r() * 90, h = 8 + r() * 30, a = x + w * (0.15 + r() * 0.35), b = x + w * (0.55 + r() * 0.35), h2 = h * (0.35 + r() * 0.6);
            d += top ? `M${x.toFixed(0)} 0L${a.toFixed(0)} ${h.toFixed(0)}L${b.toFixed(0)} ${h2.toFixed(0)}L${(x + w).toFixed(0)} 0Z`
                     : `M${x.toFixed(0)} 60L${a.toFixed(0)} ${(60 - h).toFixed(0)}L${b.toFixed(0)} ${(60 - h2).toFixed(0)}L${(x + w).toFixed(0)} 60Z`;
            x += w + r() * 50;
        }
        return svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 60" preserveAspectRatio="none"><path fill="${c}" d="${d}"/></svg>`);
    }

    // ---- Cinema ----
    const seatsSvg = (back, face) => svgUrl('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 44">'
        + `<path fill="${back}" d="M8 44V14c0-6 4-10 10-10h24c6 0 10 4 10 10v30z"/><path fill="${face}" d="M12 40V15c0-4 3-7 7-7h22c4 0 7 3 7 7v25z"/>`
        + '<path fill="rgba(255,200,150,.1)" d="M14 12c1-2 3-3 5-3h22c2 0 4 1 5 3z"/></svg>');
    const CLAPPER_SVG = '<svg viewBox="0 0 30 28"><rect x="2" y="10" width="26" height="17" rx="1.5" fill="#15151a"/>'
        + '<path d="M5 15h20M5 19.5h20M5 24h20M15 15v9" stroke="#e9e4d8" stroke-width=".9"/>'
        + '<rect x="2" y="9" width="26" height="2.4" fill="#15151a"/><path fill="#f4f1ea" d="M4 9h4l-2 2.4H2zM12 9h4l-2 2.4h-4zM20 9h4l-2 2.4h-4z"/>'
        + '<g class="mcfo-clap-stick"><rect x="2" y="4.5" width="26" height="4.5" fill="#15151a"/><path fill="#f4f1ea" d="M5 4.5h4L6 9H2zM13 4.5h4l-3 4.5h-4zM21 4.5h4l-3 4.5h-4z"/></g></svg>';
    function popcornDraw(g, p) {
        g.globalAlpha = 0.9;
        for (const [dx, dy, k] of p.puffs) {
            g.fillStyle = k ? '#fff6dc' : '#f4d57a';
            g.beginPath(); g.arc(p.x + dx * p.s, p.y + dy * p.s, p.s * (k ? 0.55 : 0.4), 0, Math.PI * 2); g.fill();
        }
    }

    Object.assign(SKINS, {
        // ---- Supernatural: a devil's trap on the floor, a salt line at the door, the family business ----
        // The chat is the leather of a hunter's journal with its stitching; lightning now and then.
        hunters: deluxe({
            assets: () => ({ trap: devilsTrapSvg('#9a3a1e', 1), trapGold: devilsTrapSvg('#e2b25a', 1.6), sigil: antiPossessionSvg('#e2b25a'), grain: grainSvg(0.35), salt: saltSvg() }),
            kit: A => {
                const grain = `url("${A.grain}") 0 0 / 180px 180px`;
                const leather = `${grain}, radial-gradient(ellipse at 30% 15%, rgba(140, 86, 48, 0.35), transparent 60%), linear-gradient(180deg, #3a2417, #22150c)`;
                return {
                    titleCss: `font-family: ${SPN_FONT}; text-transform: uppercase; letter-spacing: 0.2em; text-shadow: 0 0 8px rgba(255, 140, 40, 0.45);`,
                    ground: `${grain}, url("${A.trap}") 50% 52% / min(94vh, 90vw) min(94vh, 90vw) no-repeat, radial-gradient(ellipse at 50% 40%, rgba(90, 60, 30, 0.28), transparent 65%),
                             radial-gradient(ellipse at 50% 115%, rgba(200, 90, 20, 0.22), transparent 55%), #0d0b09`,
                    header: { bg: `${grain}, linear-gradient(180deg, #231c16, #100d0a)`, border: '1px solid #6b4a22',
                              extra: 'box-shadow: 0 1px 0 rgba(226, 178, 90, 0.25), 0 6px 18px rgba(0, 0, 0, 0.6) !important;' },
                    cards: { bg: 'linear-gradient(180deg, rgba(42, 33, 25, 0.94), rgba(20, 16, 12, 0.94))', border: '1px solid #7a5a2e', radius: '3px', shadow: 'inset 0 1px 0 rgba(255, 220, 160, 0.12)' },
                    footer: { bg: `url("${A.salt}") 0 1px / 240px 12px repeat-x, ${grain}, linear-gradient(180deg, #17120e, #0b0908)`, border: '1px solid #6b4a22',
                              extra: 'isolation: isolate;' },
                    chat: {
                        bg: leather, border: '2px solid #a7adb3', radius: '10px',
                        shadow: 'inset 0 0 0 1px #1a0f08, inset 0 0 30px rgba(0, 0, 0, 0.55), 0 0 0 1px #000000',
                        head: 'linear-gradient(180deg, rgba(18, 11, 6, 0.9), rgba(18, 11, 6, 0.6))', headBorder: '1px solid rgba(226, 178, 90, 0.45)', headText: '#e2b25a',
                        body: 'transparent', comp: 'rgba(14, 9, 5, 0.78)', compBorder: '1px solid rgba(226, 178, 90, 0.35)',
                        input: { bg: '#120c08', border: '1px solid #7a5a2e', color: '#f0e4cc', radius: '4px', hint: '#8f7654' },
                    },
                    btn: { bg: 'linear-gradient(180deg, #3b3129, #1d1814)', color: '#e2b25a', border: '1px solid #8a6a3a', radius: '3px',
                           shadow: 'inset 0 1px 0 rgba(255, 220, 160, 0.15), 0 2px 0 #000000',
                           hover: 'color: #fff1d0 !important; box-shadow: inset 0 1px 0 rgba(255, 220, 160, 0.2), 0 0 12px rgba(255, 140, 40, 0.55) !important;',
                           extra: `font-family: ${SPN_FONT}; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700;` },
                    filled: { radius: '3px', border: '1px solid rgba(226, 178, 90, 0.7)', shadow: '0 2px 0 rgba(0, 0, 0, 0.6)' },
                    popup: { bg: '#15100c', border: '1px solid #8a6a3a', radius: '4px', hover: 'rgba(226, 178, 90, 0.16)', head: '#e2b25a',
                             shadow: '0 0 0 1px #000000, 0 14px 32px rgba(0, 0, 0, 0.7)' },
                    win: { border: '1px solid #8a6a3a', radius: '6px', shadow: '0 0 0 1px #000000, 0 16px 40px rgba(0, 0, 0, 0.7)',
                           head: 'linear-gradient(180deg, #2a2019, #15100c)', headBorder: '1px solid #6b4a22', title: '#e2b25a' },
                    panel: { radius: '4px', border: '#6b4a22', pressed: '#e2b25a' },
                };
            },
            extra: (S, A, fx) => `
                ${S} .mcf-chat:not([data-collapsed="true"])::after { content: ''; position: absolute; inset: 5px; border: 1px dashed rgba(226, 190, 130, 0.42); border-radius: 7px; pointer-events: none; z-index: 2; }
                ${S} [data-role="action-region"] > .mcfo-skin-canvas { z-index: -1; }
                ${S} [data-role="top-status-region"]::after { content: ''; position: absolute; inset: 0; pointer-events: none; z-index: 3; opacity: 0;
                    background: linear-gradient(180deg, rgba(210, 225, 255, 0.55), rgba(180, 200, 255, 0.08)); }
                ${fx(['full'], '[data-role="top-status-region"]::after')} { animation: mcfoSpnFlash 11s linear infinite; }
                @keyframes mcfoSpnFlash { 0%, 90% { opacity: 0; } 90.6% { opacity: 0.8; } 91.2% { opacity: 0.1; } 92% { opacity: 0.6; } 93.5%, 100% { opacity: 0; } }
                ${S} .mcfo-spn-motto { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); display: flex; align-items: center; gap: 14px; pointer-events: none; white-space: nowrap;
                    font: 600 11px/1 ${SPN_FONT}; letter-spacing: 0.32em; text-transform: uppercase; color: rgba(226, 178, 90, 0.78); text-shadow: 0 0 6px rgba(255, 140, 40, 0.35); }
                ${S} .mcfo-spn-motto i { display: block; width: 40px; height: 40px; background: url("${A.trapGold}") center / contain no-repeat; opacity: 0.9; }
                ${fx(['full', 'subtle'], '.mcfo-spn-motto i')} { animation: mcfoSpnTurn 90s linear infinite; }
                @media (max-width: 1250px) { ${S} .mcfo-spn-motto b { display: none; } }
                ${S} .mcfo-spn-sigil { position: absolute; left: 34%; top: 50%; width: 26px; height: 26px; transform: translate(-50%, -50%); pointer-events: none;
                    background: url("${A.sigil}") center / contain no-repeat; filter: drop-shadow(0 0 3px rgba(255, 140, 40, 0.6)); }
                ${fx(['full', 'subtle'], '.mcfo-spn-sigil')} { animation: mcfoSpnGlow 3.2s ease-in-out infinite alternate; }
                @keyframes mcfoSpnTurn { to { rotate: 360deg; } }
                @keyframes mcfoSpnGlow { from { opacity: 0.6; } to { opacity: 1; filter: drop-shadow(0 0 7px rgba(255, 140, 40, 0.95)); } }`,
            decor: [
                { cls: 'mcfo-spn-motto', host: () => role('top-status-region'), html: '<b>Saving people</b><i></i><b>Hunting things</b>' },
                { cls: 'mcfo-spn-sigil', host: () => document.querySelector('.mcf-chat__header'), html: '' },
            ],
            particles: [
                drifters('embers', () => document.querySelector('.mcf-chat:not([data-collapsed="true"])'), 14, emberMake, emberMove, emberDraw),
                drifters('embers-salt', () => role('action-region'), 9, emberMake, emberMove, emberDraw),
            ],
            tile: A => `background: url("${A.trapGold}") center / 46px 46px no-repeat, url("${A.salt}") 0 100% / 120px 6px repeat-x,
                        radial-gradient(ellipse at 50% 120%, rgba(200, 90, 20, 0.5), transparent 60%), #120e0b; box-shadow: inset 0 0 0 2px #6b4a22;`,
        }),

        // ---- Breaking Bad: element boxes, the desert's yellow cast, blue crystal ----
        // The chat is a page of the lab notebook, its header a hazmat suit; on it the hat, the
        // glasses and the goatee — the sketch that stands for the man.
        heisenberg: deluxe({
            assets: () => ({ mesa: mesaSvg('#8a6230', '#4e3417'), strip: elementStripSvg(0.24), hat: heisenbergSvg('#111111'), grain: grainSvg(0.22),
                             br: svgUrl(elementTileSvg(35, 'Br', '79.904', 'b', true)), ba: svgUrl(elementTileSvg(56, 'Ba', '137.33', 'b', true)) }),
            kit: A => {
                const graph = 'linear-gradient(rgba(60, 120, 90, 0.2) 1px, transparent 1px) 0 0 / 14px 14px, linear-gradient(90deg, rgba(60, 120, 90, 0.2) 1px, transparent 1px) 0 0 / 14px 14px, '
                    + 'linear-gradient(rgba(60, 120, 90, 0.32) 1px, transparent 1px) 0 0 / 70px 70px, linear-gradient(90deg, rgba(60, 120, 90, 0.32) 1px, transparent 1px) 0 0 / 70px 70px';
                const lab = 'linear-gradient(180deg, #1c4a29, #0f2c18)';
                return {
                    titleCss: 'font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; font-weight: 700;',
                    ground: `url("${A.grain}") 0 0 / 180px 180px, url("${A.mesa}") 0 100% / 1100px 150px repeat-x,
                             radial-gradient(ellipse at 70% 0%, rgba(255, 236, 170, 0.5), transparent 55%), linear-gradient(180deg, #c49a4a 0%, #a37634 45%, #76511f 100%)`,
                    header: { bg: `url("${A.strip}") 0 50% / auto 44px repeat-x, ${lab}`, border: '2px solid #0a1f10',
                              extra: 'box-shadow: 0 3px 0 #f2d21b, 0 8px 20px rgba(0, 0, 0, 0.45) !important;' },
                    cards: { bg: 'linear-gradient(135deg, rgba(47, 107, 60, 0.96), rgba(21, 63, 34, 0.96))', border: '1px solid #cfeed6', radius: '2px', shadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.2), 0 2px 6px rgba(0, 0, 0, 0.35)' },
                    footer: { bg: 'repeating-linear-gradient(-45deg, #f2d21b 0 12px, #111111 12px 24px) 0 0 / 100% 6px no-repeat, linear-gradient(180deg, #1c211b, #0e110d)', border: '0' },
                    chat: {
                        bg: `${graph}, #f6f3e7`, border: '1px solid #b9b39a', radius: '3px', shadow: '0 0 0 4px #1f5a2e',
                        head: '#f2d21b', headBorder: '2px solid #111111', headText: '#111111',
                        body: 'transparent', comp: '#ece6cf', compBorder: '1px solid #b9b39a',
                        input: { bg: '#ffffff', border: '1px solid #1f5a2e', color: '#1b2a1f', radius: '2px', hint: '#7d8a7f' },
                    },
                    btn: { bg: 'linear-gradient(135deg, #4e9a5e, #1f5a2e)', color: '#ffffff', border: '1px solid #d7f0dc', radius: '2px',
                           shadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.25), 0 2px 0 #0d2a16',
                           hover: 'filter: brightness(1.12); box-shadow: 0 0 0 1px #f2d21b, 0 0 12px rgba(111, 211, 255, 0.6) !important;', extra: 'font-weight: 700;' },
                    filled: { radius: '2px', border: '1px solid rgba(215, 240, 220, 0.85)', shadow: '0 2px 0 rgba(0, 0, 0, 0.4)' },
                    popup: { bg: '#123620', border: '1px solid #cfeed6', radius: '3px', hover: 'rgba(242, 210, 27, 0.2)', head: '#f2d21b', shadow: '0 0 0 3px #0a1f10, 0 14px 30px rgba(0, 0, 0, 0.55)' },
                    win: { border: '1px solid #cfeed6', radius: '3px', shadow: '0 0 0 3px #0a1f10, 0 16px 40px rgba(0, 0, 0, 0.55)', head: lab, headBorder: '2px solid #f2d21b', title: '#ffffff' },
                    panel: { radius: '2px', border: '#2f6b3c', pressed: '#f2d21b' },
                };
            },
            extra: (S, A, fx) => lightChatCss(S, '#1b2a1f', '#6b7a6e') + `
                ${S} .mcf-chat__header .mcf-chat__status { color: #3a3a1a !important; }
                ${S} .mcf-chat__send { background: #111111 !important; color: #f2d21b !important; border-color: #111111 !important; }
                ${S} .mcfo-bb-elements { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); display: flex; gap: 5px; pointer-events: none; }
                ${S} .mcfo-bb-elements svg { display: block; width: 38px; height: 42px; filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.5)); }
                ${fx(['full', 'subtle'], '.mcfo-bb-elements svg')} { animation: mcfoBbGlow 3.4s ease-in-out infinite alternate; }
                ${fx(['full', 'subtle'], '.mcfo-bb-elements svg + svg')} { animation-delay: 1.7s; }
                @keyframes mcfoBbGlow { from { filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.5)); } to { filter: drop-shadow(0 0 9px rgba(140, 255, 170, 0.75)); } }
                ${S} .mcfo-bb-hat { position: absolute; left: 34%; top: 50%; width: 30px; height: 30px; transform: translate(-50%, -50%); pointer-events: none;
                    background: url("${A.hat}") center / contain no-repeat; }`,
            decor: [
                { cls: 'mcfo-bb-elements', host: () => role('top-status-region'), html: elementTileSvg(35, 'Br', '79.904', 'mcfoBbBr', true) + elementTileSvg(56, 'Ba', '137.33', 'mcfoBbBa', true) },
                { cls: 'mcfo-bb-hat', host: () => document.querySelector('.mcf-chat__header'), html: '' },
            ],
            particles: [drifters('crystal', () => document.querySelector('.mcf-chat:not([data-collapsed="true"])'), 11,
                (w, h, any) => {
                    const s = rnd(3, 6.5), n = 5, pts = [];
                    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + rnd(-0.3, 0.3), d = s * rnd(0.6, 1.3); pts.push([Math.cos(a) * d, Math.sin(a) * d * 0.7]); }
                    return { x: rnd(8, w - 8), y: any ? rnd(0, h) : -10, v: rnd(8, 18), a: rnd(0, 6), spin: rnd(-1, 1), ph: rnd(0, 6), pts };
                },
                (p, dt, now, w, h) => { p.y += p.v * dt; p.x += Math.sin(now / 900 + p.ph) * 5 * dt; return p.y < h + 10; },
                crystalDraw)],
            tile: A => `background: url("${A.br}") 30% 50% / 24px 27px no-repeat, url("${A.ba}") 66% 50% / 24px 27px no-repeat,
                        repeating-linear-gradient(-45deg, #f2d21b 0 5px, #111111 5px 10px) 0 100% / 100% 4px no-repeat, linear-gradient(180deg, #c49a4a, #76511f);`,
        }),

        // ---- Back to the Future: the time circuits, the flux capacitor, trails of fire ----
        // On top of the chat sit the three rows of the time circuits — where you are going, where you
        // are (the real date and time, live), where you last left. Brushed steel, a plate that reads
        // OUTATIME, and the clock tower stopped at 10:04.
        outatime: deluxe({
            assets: () => ({ fire: fireTrailsSvg(), tower: clockTowerSvg(), stars: starField(1955, 60, 0.75) }),
            kit: A => {
                const steel = 'repeating-linear-gradient(180deg, rgba(255, 255, 255, 0.07) 0 1px, rgba(0, 0, 0, 0.06) 1px 3px), linear-gradient(180deg, #b4bac1, #7d838a 48%, #5c6167 52%, #9aa0a6)';
                return {
                    titleCss: 'font-family: "Arial Black", "Helvetica Neue", Arial, sans-serif; font-style: italic; font-weight: 900; background: linear-gradient(180deg, #fff06a 0%, #ffb000 45%, #ff5a1f 55%, #c21e00 100%); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; filter: drop-shadow(0 1px 0 #3a0a00);',
                    ground: `url("${A.fire}") 50% 100% / 100% 34% no-repeat, url("${A.tower}") 3% 7% / auto 150px no-repeat, ${A.stars},
                             linear-gradient(180deg, #070b1d 0%, #151a3a 50%, #3a1f3a 82%, #5a2a2a 100%)`,
                    header: { bg: steel, border: '2px solid #2b2e33', extra: 'box-shadow: 0 2px 0 #ff8a00, 0 8px 20px rgba(0, 0, 0, 0.5) !important;' },
                    cards: { bg: 'linear-gradient(180deg, #16181c, #0b0c0e)', border: '1px solid #ff8a00', radius: '3px', shadow: 'inset 0 0 0 1px #000000, 0 0 8px rgba(255, 138, 0, 0.3)' },
                    footer: { bg: 'repeating-linear-gradient(90deg, rgba(255, 255, 255, 0.02) 0 1px, transparent 1px 3px), linear-gradient(180deg, #202328, #0f1114)', border: '2px solid #ff8a00' },
                    chat: {
                        bg: 'repeating-linear-gradient(90deg, rgba(255, 255, 255, 0.025) 0 1px, transparent 1px 3px), linear-gradient(180deg, #2c3036 0, #1a1c20 124px, #121417 100%)',
                        border: '2px solid #8d939a', radius: '6px', pad: '124px 0 0',
                        shadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.2), 0 0 0 1px #000000',
                        head: 'linear-gradient(180deg, #33373d, #1d2024)', headBorder: '2px solid #ff8a00', headText: '#ffd08a',
                        body: 'rgba(0, 0, 0, 0.25)', comp: '#16181b', compBorder: '1px solid #3a3e44',
                        input: { bg: '#0b0c0e', border: '1px solid #ff8a00', color: '#ffe7c2', radius: '3px', hint: '#8a7a64' },
                    },
                    btn: { bg: 'linear-gradient(180deg, #f5f6f7 0%, #c3c8cd 45%, #8e949a 52%, #d9dde0 100%)', color: '#16181b', border: '1px solid #4d5258', radius: '4px',
                           shadow: 'inset 0 1px 0 #ffffff, 0 2px 0 #1a1c1f',
                           hover: 'box-shadow: inset 0 1px 0 #ffffff, 0 0 0 1px #ff8a00, 0 0 12px rgba(255, 138, 0, 0.65) !important;', extra: 'font-weight: 800;' },
                    filled: { radius: '4px', border: '1px solid rgba(230, 233, 236, 0.85)', shadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.3), 0 2px 0 rgba(0, 0, 0, 0.5)' },
                    popup: { bg: '#15171b', border: '1px solid #ff8a00', radius: '5px', hover: 'rgba(255, 138, 0, 0.18)', head: '#ffb000', shadow: '0 0 0 1px #000000, 0 0 16px rgba(255, 138, 0, 0.25), 0 12px 30px rgba(0, 0, 0, 0.65)' },
                    win: { border: '2px solid #8d939a', radius: '6px', shadow: '0 0 0 1px #000000, 0 16px 40px rgba(0, 0, 0, 0.65)', head: steel, headBorder: '2px solid #ff8a00', title: '#16181b' },
                    panel: { radius: '4px', border: '#4d5258', pressed: '#ff8a00' },
                };
            },
            extra: (S, A, fx) => `
                ${S} .mcfo-win__title { -webkit-text-fill-color: #16181b; background: none; filter: none; }
                ${S} .mcfo-bttf-tc { position: absolute; top: 8px; left: 50%; width: min(236px, calc(100% - 16px)); transform: translateX(-50%); display: grid; gap: 3px; pointer-events: none; }
                ${S} .mcfo-bttf-tc i { display: block; }
                ${S} .mcfo-bttf-tc svg { display: block; width: 100%; height: auto; }
                ${fx(['full', 'subtle'], '.mcfo-tc-colon')} { animation: mcfoTcBlink 1s steps(1) infinite; }
                @keyframes mcfoTcBlink { 50% { opacity: 0.12; } }
                ${S} .mcfo-bttf-flux { position: absolute; left: 34%; top: 50%; width: 21px; height: 25px; transform: translate(-50%, -50%); pointer-events: none; filter: drop-shadow(0 0 3px rgba(255, 244, 176, 0.5)); }
                ${S} .mcfo-bttf-flux svg { display: block; width: 100%; height: 100%; }
                ${fx(['full', 'subtle'], '.mcfo-flux-pulse')} { animation: mcfoFlux 0.45s linear infinite; }
                @keyframes mcfoFlux { to { stroke-dashoffset: -4.4; } }
                ${S} .mcfo-bttf-plate { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: 106px; height: 42px; box-sizing: border-box; pointer-events: none;
                    border-radius: 5px; border: 2px solid #c9ced3; box-shadow: 0 0 0 1px #2b2e33, 0 3px 8px rgba(0, 0, 0, 0.5);
                    background: radial-gradient(circle at 16% 17%, #8d939a 0 1.8px, transparent 2.3px), radial-gradient(circle at 84% 17%, #8d939a 0 1.8px, transparent 2.3px), linear-gradient(180deg, #fbfbf6, #e2e2d9); }
                ${S} .mcfo-bttf-plate b { position: absolute; top: 3px; left: 0; right: 0; text-align: center; font: italic 700 10px/1 "Brush Script MT", "Segoe Script", "URW Chancery L", cursive; color: #c21e2a; }
                ${S} .mcfo-bttf-plate svg { position: absolute; bottom: 4px; left: 6px; width: calc(100% - 12px); height: 22px; }`,
            decor: [
                { cls: 'mcfo-bttf-tc', host: () => document.querySelector('.mcf-chat'),
                  html: `<i>${tcRow('d', 'DESTINATION TIME', TC_COL.dest, 'OCT', '21', '2015', true, '04', '29')}</i><i></i><i>${tcRow('l', 'LAST TIME DEPARTED', TC_COL.last, 'OCT', '26', '1985', false, '01', '21')}</i>`,
                  place: el => {
                      const n = new Date(), k = n.toDateString() + n.getHours() + ':' + n.getMinutes();
                      if (el.dataset.k !== k && el.children[1]) { el.dataset.k = k; el.children[1].innerHTML = tcNowRow(); }
                  } },
                { cls: 'mcfo-bttf-flux', host: () => document.querySelector('.mcf-chat__header'), html: FLUX_SVG },
                // The letters as a drawing, squeezed to the plate — whatever narrow font the system has.
                { cls: 'mcfo-bttf-plate', host: () => role('top-status-region'),
                  html: '<b>California</b><svg viewBox="0 0 100 22" preserveAspectRatio="none"><text x="50" y="20" text-anchor="middle" textLength="96" lengthAdjust="spacingAndGlyphs" '
                      + 'font-family="Arial Narrow, Roboto Condensed, DejaVu Sans Condensed, Arial, sans-serif" font-weight="700" font-size="23" fill="#1b3f8f">OUTATIME</text></svg>' },
            ],
            // Blue sparks around the circuits, as when the car is about to go.
            particles: [drifters('sparks', () => document.querySelector('.mcf-chat:not([data-collapsed="true"])'), 3,
                (w, h) => ({ x: rnd(10, w - 10), y: rnd(4, 120), t: -rnd(0.4, 3.5), life: rnd(0.12, 0.35), len: rnd(10, 22), a: rnd(0, Math.PI * 2) }),
                p => (p.t += 1 / 30) < p.life,
                (g, p) => {
                    if (p.t < 0) return;
                    g.globalAlpha = 0.9; g.strokeStyle = '#bfe3ff'; g.lineWidth = 1.2; g.shadowColor = '#6fb8ff'; g.shadowBlur = 8;
                    g.beginPath(); g.moveTo(p.x, p.y);
                    let x = p.x, y = p.y;
                    for (let i = 0; i < 5; i++) { x += Math.cos(p.a) * p.len / 5 + rnd(-3, 3); y += Math.sin(p.a) * p.len / 5 + rnd(-3, 3); g.lineTo(x, y); }
                    g.stroke(); g.shadowBlur = 0;
                })],
            tile: A => `background: url("${A.fire}") 50% 100% / 100% 60% no-repeat, radial-gradient(circle at 22% 38%, #ff3b2f 0 2px, transparent 2.5px),
                        radial-gradient(circle at 30% 38%, #3dff6e 0 2px, transparent 2.5px), radial-gradient(circle at 38% 38%, #ffb000 0 2px, transparent 2.5px),
                        linear-gradient(180deg, #070b1d, #3a1f3a 70%, #5a2a2a); box-shadow: inset 0 0 0 2px #8d939a;`,
        }),

        // ---- Everything Everywhere All at Once: googly eyes that watch you, the bagel ----
        // The eyes follow the pointer. The ground is the multiverse coming apart in shards.
        multiverse: deluxe({
            assets: () => ({ shards: shardsSvg(), bagel: bagelSvg(), words: bigWordsSvg('rgba(255, 255, 255, 0.17)') }),
            kit: A => {
                const ink = '#1b1b1b', red = '#c8102e';
                return {
                    titleCss: `font-family: ${CONDENSED_FONT}; text-transform: uppercase; letter-spacing: 0.06em; font-weight: 700;`,
                    ground: `url("${A.shards}") 0 0 / 420px 420px, radial-gradient(ellipse at 50% 30%, rgba(200, 16, 46, 0.25), transparent 60%), linear-gradient(180deg, #25101a, #12060b)`,
                    header: { bg: `url("${A.words}") center / calc(100% - 24px) 82% no-repeat, ${red}`, border: `3px solid ${ink}` },
                    cards: { bg: '#1b0a10', border: '2px solid #fefcfa', radius: '10px', shadow: `3px 3px 0 ${ink}` },
                    footer: { bg: 'linear-gradient(180deg, #1e0b12, #12060b)', border: '4px solid', extra: 'border-image: linear-gradient(90deg, #ff2a6d, #ffd319, #3ddc84, #05d9e8, #7b2cbf, #ff2a6d) 1;' },
                    chat: {
                        bg: 'radial-gradient(circle, rgba(200, 16, 46, 0.07) 0 1.2px, transparent 1.6px) 0 0 / 9px 9px, #fefcfa', border: `3px solid ${ink}`, radius: '16px',
                        shadow: `inset 0 0 0 2px #fefcfa, inset 0 0 0 4px ${red}`,
                        head: red, headBorder: `3px solid ${ink}`, headText: '#fefcfa',
                        body: 'transparent', comp: '#f3ece6', compBorder: `3px solid ${ink}`,
                        input: { bg: '#ffffff', border: `2px solid ${ink}`, color: ink, radius: '999px', hint: '#9a8a8a' },
                    },
                    btn: { bg: '#fefcfa', color: ink, border: `2px solid ${ink}`, radius: '999px', shadow: `3px 3px 0 ${red}`,
                           hover: `transform: translate(-1px, -1px); box-shadow: 4px 4px 0 ${red} !important;`, extra: `font-family: ${CONDENSED_FONT}; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em;` },
                    filled: { radius: '999px', border: `2px solid ${ink}`, shadow: `2px 2px 0 ${ink}` },
                    popup: { bg: '#fefcfa', border: `3px solid ${ink}`, radius: '14px', hover: 'rgba(200, 16, 46, 0.14)', head: red, shadow: `5px 5px 0 ${red}` },
                    win: { border: `3px solid ${ink}`, radius: '16px', shadow: `6px 6px 0 ${red}`, head: red, headBorder: `3px solid ${ink}`, title: '#fefcfa' },
                    panel: { radius: '12px', border: '#6a3040', pressed: red },
                };
            },
            extra: (S, A, fx) => lightChatCss(S, '#1b1b1b', '#8a6a6a') + `
                ${S} :is(.mcfo-menu, .mcf-chat__suggestions, [data-role="sound-utility-panel"]) { color: #1b1b1b !important; }
                ${S} .mcf-chat__header .mcf-chat__status { color: #ffd9de !important; }
                ${S} .mcf-chat__send { background: #c8102e !important; color: #fefcfa !important; box-shadow: 3px 3px 0 #1b1b1b !important; }
                ${S} .mcfo-eye { position: relative; display: block; flex: none; width: 26px; height: 26px; border-radius: 50%;
                    background: radial-gradient(circle at 36% 30%, #ffffff, #efefef 55%, #cfcfcf); box-shadow: 0 0 0 1.5px #1b1b1b, 0 2px 3px rgba(0, 0, 0, 0.45), inset 0 -2px 3px rgba(0, 0, 0, 0.15); }
                ${S} .mcfo-eye b { position: absolute; left: 50%; top: 50%; width: 52%; height: 52%; border-radius: 50%; background: #111111;
                    transform: translate(calc(-50% + var(--dx, 0px)), calc(-50% + var(--dy, 4px))); transition: transform 0.18s cubic-bezier(0.3, 1.7, 0.5, 1); }
                ${S} .mcfo-eye::after { content: ''; position: absolute; left: 20%; top: 13%; width: 28%; height: 17%; border-radius: 50%; background: rgba(255, 255, 255, 0.85); transform: rotate(-30deg); }
                ${S} .mcfo-mv-top { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); display: flex; align-items: center; gap: 10px; pointer-events: none; }
                ${S} .mcfo-mv-top .mcfo-eye:first-child { width: 34px; height: 34px; rotate: -8deg; }
                ${S} .mcfo-mv-top .mcfo-eye:last-child { width: 22px; height: 22px; margin-top: -14px; }
                ${S} .mcfo-mv-bagel { display: block; width: 46px; height: 46px; background: url("${A.bagel}") center / contain no-repeat; filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.5)); }
                ${fx(['full', 'subtle'], '.mcfo-mv-bagel')} { animation: mcfoMvBagel 16s linear infinite; }
                @keyframes mcfoMvBagel { to { rotate: 360deg; } }
                ${S} .mcfo-mv-third { position: absolute; left: 34%; top: 50%; transform: translate(-50%, -50%); pointer-events: none; }
                ${S} .mcfo-mv-third .mcfo-eye { width: 22px; height: 22px; }`,
            decor: [
                { cls: 'mcfo-mv-top', host: () => role('top-status-region'), html: `${EYE}<span class="mcfo-mv-bagel"></span>${EYE}` },
                { cls: 'mcfo-mv-third', host: () => document.querySelector('.mcf-chat__header'), html: EYE },
            ],
            pointer: (x, y) => {
                for (const e of document.querySelectorAll('.mcfo-eye')) {
                    const r = e.getBoundingClientRect();
                    if (!r.width) continue;
                    const dx = x - (r.left + r.width / 2), dy = y - (r.top + r.height / 2), d = Math.hypot(dx, dy) || 1, k = Math.min(1, d / 90) * r.width * 0.24;
                    e.style.setProperty('--dx', (dx / d * k).toFixed(1) + 'px');
                    e.style.setProperty('--dy', (dy / d * k).toFixed(1) + 'px');
                }
            },
            particles: [drifters('multiverse', () => document.querySelector('.mcf-chat:not([data-collapsed="true"])'), 16,
                (w, h, any) => ({ x: rnd(8, w - 8), y: any ? rnd(0, h) : -12, v: rnd(10, 22), ph: rnd(0, 6), k: Math.floor(rnd(0, 4)), s: rnd(4, 8),
                                  c: pickOf(Math.random, ['#ff2a6d', '#05d9e8', '#ffd319', '#c8102e', '#7b2cbf', '#3ddc84']) }),
                (p, dt, now, w, h) => { p.y += p.v * dt; p.x += Math.sin(now / 700 + p.ph) * 10 * dt; return p.y < h + 12; },
                (g, p, now) => {
                    g.globalAlpha = 0.6;
                    if (p.k === 0) {
                        g.fillStyle = '#ffffff'; g.strokeStyle = '#1b1b1b'; g.lineWidth = 1;
                        g.beginPath(); g.arc(p.x, p.y, p.s, 0, Math.PI * 2); g.fill(); g.stroke();
                        g.fillStyle = '#1b1b1b';
                        g.beginPath(); g.arc(p.x + Math.sin(now / 260 + p.ph) * p.s * 0.35, p.y + Math.abs(Math.cos(now / 330 + p.ph)) * p.s * 0.35, p.s * 0.5, 0, Math.PI * 2); g.fill();
                        return;
                    }
                    g.save(); g.translate(p.x, p.y); g.rotate(now / 500 + p.ph); g.fillStyle = p.c;
                    if (p.k === 1) g.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
                    else if (p.k === 2) { g.beginPath(); g.moveTo(0, -p.s / 2); g.lineTo(p.s / 2, p.s / 2); g.lineTo(-p.s / 2, p.s / 2); g.fill(); }
                    else { g.beginPath(); g.arc(0, 0, p.s / 2.5, 0, Math.PI * 2); g.fill(); }
                    g.restore();
                })],
            tile: A => `background: url("${A.bagel}") 60% 50% / 34px 34px no-repeat,
                        radial-gradient(circle at 28% 42%, #111111 0 3.5px, transparent 4px), radial-gradient(circle at 26% 40%, #ffffff 0 8px, #1b1b1b 8px 9.5px, transparent 10px),
                        url("${A.words}") center / 100% 60% no-repeat, #c8102e; box-shadow: inset 0 0 0 2px #1b1b1b;`,
        }),

        // ---- Star Wars: the crawl, lightsabers, a hologram for a chat ----
        // Above the chat the opening crawl runs, with our own story. The buttons are lightsabers —
        // blue, the rebellion and the unbid red, autobid green. Fighters chase through the header.
        farfaraway: deluxe({
            assets: () => ({ near: starField(77, 60, 0.9), far: starField(1977, 70, 0.4), ds: deathStarSvg(), crawlSky: starField(5, 36, 0.75) }),
            kit: A => {
                const panel = 'linear-gradient(90deg, rgba(0, 0, 0, 0.45) 0 1px, transparent 1px) 0 0 / 96px 100%, linear-gradient(180deg, rgba(255, 255, 255, 0.06), transparent 40%), linear-gradient(180deg, #2b2e33, #15171a)';
                return {
                    titleCss: `font-family: ${GEO_FONT}; font-weight: 700; text-transform: uppercase; letter-spacing: 0.22em;`,
                    ground: `url("${A.ds}") right 4% top 5% / 130px 130px no-repeat, ${A.near}, ${A.far},
                             radial-gradient(ellipse at 18% 82%, rgba(90, 60, 160, 0.24), transparent 55%), radial-gradient(ellipse at 85% 20%, rgba(40, 90, 170, 0.18), transparent 50%), #03040a`,
                    header: { bg: panel, border: '1px solid #4a4f56', extra: 'box-shadow: 0 1px 0 #000000, 0 6px 18px rgba(0, 0, 0, 0.6) !important;' },
                    cards: { bg: 'linear-gradient(180deg, #202328, #121417)', border: '1px solid #50565e', radius: '2px', shadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.08), inset 0 -2px 0 rgba(0, 0, 0, 0.4)' },
                    footer: { bg: panel, border: '1px solid #4a4f56', extra: 'isolation: isolate;' },
                    chat: {
                        bg: 'repeating-linear-gradient(180deg, rgba(120, 200, 255, 0.07) 0 1px, transparent 1px 3px), radial-gradient(ellipse at 50% 100%, rgba(79, 179, 255, 0.28), transparent 70%), rgba(4, 14, 26, 0.94)',
                        border: '1px solid rgba(79, 179, 255, 0.85)', radius: '4px', pad: '112px 0 0',
                        shadow: '0 0 12px rgba(79, 179, 255, 0.45), inset 0 0 18px rgba(79, 179, 255, 0.2)',
                        head: 'rgba(79, 179, 255, 0.12)', headBorder: '1px solid rgba(79, 179, 255, 0.5)', headText: '#a8dcff',
                        body: 'transparent', comp: 'rgba(79, 179, 255, 0.08)', compBorder: '1px solid rgba(79, 179, 255, 0.4)',
                        input: { bg: 'rgba(2, 10, 20, 0.85)', border: '1px solid rgba(79, 179, 255, 0.7)', color: '#d8f0ff', radius: '2px', hint: 'rgba(140, 200, 240, 0.7)' },
                    },
                    btn: { bg: saberBg('#bfe6ff'), color: '#062238', border: '0', radius: '3px 999px 999px 3px', shadow: saberGlow('#4fb3ff'),
                           hover: `box-shadow: ${saberGlow('#4fb3ff', 1.7)} !important;`, extra: `font-family: ${GEO_FONT}; font-weight: 700; letter-spacing: 0.04em;` },
                    filled: { radius: '3px 999px 999px 3px', border: '0', shadow: '0 0 6px rgba(255, 255, 255, 0.35)' },
                    popup: { bg: 'rgba(16, 18, 21, 0.97)', border: '1px solid #50565e', radius: '3px', hover: 'rgba(79, 179, 255, 0.18)', head: '#ffe81f',
                             shadow: '0 0 0 1px #000000, 0 12px 30px rgba(0, 0, 0, 0.7)' },
                    win: { border: '1px solid #50565e', radius: '3px', shadow: '0 0 0 1px #000000, 0 16px 40px rgba(0, 0, 0, 0.7)', head: panel, headBorder: '1px solid #4a4f56', title: '#ffe81f' },
                    panel: { radius: '2px', border: '#3a3f46', pressed: '#ffe81f' },
                };
            },
            extra: (S, A, fx) => `
                ${S} .mcf-chat__header .mcf-chat__title strong { color: #ffe81f !important; }
                ${S} [data-role="action-region"] > .mcfo-skin-canvas { z-index: -1; }
                ${S} .mcf-chat__message:not(.mcf-chat__message--cosmetic):not(.mcf-chat__message--royal) .mcf-chat__text:not([class*="mcf-chat__text--"]) { color: #d4eeff !important; text-shadow: 0 0 5px rgba(79, 179, 255, 0.55); }
                ${S} :is(.mcfo-rebellion, .mcfo-unbid) { background: ${saberBg('#ffb0b0')} !important; box-shadow: ${saberGlow('#ff2a2a')} !important; color: #3a0505 !important; }
                ${S} :is(.mcfo-rebellion, .mcfo-unbid):hover:not(:disabled) { box-shadow: ${saberGlow('#ff2a2a', 1.7)} !important; }
                ${S} .mcfo-autobid { background: ${saberBg('#c4ffbf')} !important; box-shadow: ${saberGlow('#3dff4e')} !important; color: #062a0a !important; }
                /* Text buttons make room for the hilt; buttons that only carry a symbol are blade alone. */
                ${S} :is(.mcf-chat__send, .mcfo-rebellion, .mcfo-unbid, .mcfo-autobid, .mcfo-rail-toggle, .mcfo-signpost, [data-role="diamonds-purchase-link"], [data-role="nav-region"] > :is(button, a)) { padding-left: 16px !important; }
                ${S} :is(.mcf-chat__collapse, .mcf-chat__cosmetics-toggle, .mcfo-chatpop-btn, .mcfo-gear, .mcfo-drink--icon, .mcfo-win__head button, [data-role="sound-utility-toggle"]) {
                    background: linear-gradient(180deg, #bfe6ff 0%, #ffffff 35% 65%, #bfe6ff 100%) !important; border-radius: 999px !important; }
                ${fx(['full'], '.mcf-chat:not([data-collapsed="true"])')} { animation: mcfoHolo 9s steps(1) infinite; }
                @keyframes mcfoHolo { 0%, 96% { opacity: 1; } 96.5% { opacity: 0.86; } 97% { opacity: 1; } 98% { opacity: 0.9; } 98.4% { opacity: 1; } }
                ${S} .mcfo-sw-crawl { position: absolute; top: 0; left: 0; right: 0; height: 112px; overflow: hidden; pointer-events: none; border-radius: 3px 3px 0 0;
                    background: ${A.crawlSky}, #01020a; border-bottom: 1px solid rgba(79, 179, 255, 0.5); }
                ${S} .mcfo-sw-crawl em { position: absolute; top: 6px; left: 0; right: 0; text-align: center; font: italic 10px/1 ${GEO_FONT}; color: #4bd5ee; letter-spacing: 0.04em; }
                ${S} .mcfo-sw-crawl span { position: absolute; top: 18px; left: 0; right: 0; bottom: 0; perspective: 140px; overflow: hidden;
                    -webkit-mask-image: linear-gradient(180deg, transparent 0, #000000 55%); mask-image: linear-gradient(180deg, transparent 0, #000000 55%); }
                ${S} .mcfo-sw-crawl i { position: absolute; top: 100%; left: 10%; right: 10%; font: 700 11px/1.35 ${GEO_FONT}; font-style: normal; color: #ffe81f; text-align: justify;
                    transform-origin: 50% 0; transform: rotateX(32deg) translateY(-55%); }
                ${fx(['full', 'subtle'], '.mcfo-sw-crawl i')} { animation: mcfoCrawl 46s linear infinite; }
                @keyframes mcfoCrawl { from { transform: rotateX(32deg) translateY(0); } to { transform: rotateX(32deg) translateY(calc(-100% - 140px)); } }
                ${S} .mcfo-sw-crawl b { display: block; text-align: center; font-weight: 700; text-transform: uppercase; letter-spacing: 0.2em; font-size: 10px; }
                ${S} .mcfo-sw-crawl strong { display: block; text-align: center; font-size: 15px; letter-spacing: 0.08em; margin: 2px 0 8px; }
                ${S} .mcfo-sw-crawl p { margin: 0 0 8px; }
                ${S} .mcfo-sw-panel { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); display: grid; grid-template-columns: repeat(8, 9px); gap: 4px 3px; pointer-events: none;
                    padding: 6px 8px; background: #0c0d0f; border: 1px solid #4a4f56; border-radius: 2px; box-shadow: inset 0 0 6px #000000, 0 0 0 3px #1c1e22; }
                ${S} .mcfo-sw-panel i { display: block; height: 5px; background: #33383f; }
                ${S} .mcfo-sw-panel i:nth-child(3n+1) { background: #ff3b3b; box-shadow: 0 0 4px #ff3b3b; }
                ${S} .mcfo-sw-panel i:nth-child(4n+2) { background: #4fb3ff; box-shadow: 0 0 4px #4fb3ff; }
                ${S} .mcfo-sw-panel i:nth-child(5n+3) { background: #5dff6a; box-shadow: 0 0 4px #5dff6a; }
                ${S} .mcfo-sw-panel i:nth-child(7n) { background: #ffe81f; box-shadow: 0 0 4px #ffe81f; }
                ${fx(['full', 'subtle'], '.mcfo-sw-panel i:nth-child(2n)')} { animation: mcfoSwBlink 1.7s steps(1) infinite; }
                ${fx(['full', 'subtle'], '.mcfo-sw-panel i:nth-child(3n)')} { animation: mcfoSwBlink 2.3s steps(1) 0.4s infinite; }
                @keyframes mcfoSwBlink { 50% { opacity: 0.2; } }`,
            decor: [
                { cls: 'mcfo-sw-crawl', host: () => document.querySelector('.mcf-chat'), html: CRAWL },
                { cls: 'mcfo-sw-panel', host: () => role('top-status-region'), html: '<i></i>'.repeat(16) },
            ],
            // A dogfight through the footer: an X-wing, a TIE fighter on its tail, green bolts. In the
            // header it flew behind the cards and was hardly seen (6.16.1).
            particles: [drifters('dogfight', () => role('action-region'), 2,
                (w, h, any) => { const dir = Math.random() < 0.5 ? 1 : -1; return { dir, x: any ? rnd(0, w) : (dir > 0 ? -80 : w + 80), y: rnd(14, h - 14), v: rnd(70, 120), ph: rnd(0, 6), gap: rnd(40, 70) }; },
                (p, dt, now, w) => { p.x += p.dir * p.v * dt; p.y += Math.sin(now / 400 + p.ph) * 8 * dt; return p.dir > 0 ? p.x < w + 120 : p.x > -120; },
                (g, p, now) => {
                    const tx = p.x - p.dir * p.gap, ty = p.y + Math.sin(now / 300 + p.ph) * 4;
                    g.globalAlpha = 0.9;
                    xWing(g, p.x, p.y, 9, p.dir);
                    tieFighter(g, tx, ty, 7.5);
                    const shot = (now / 1000 * 2.4 + p.ph) % 1;
                    if (shot < 0.35) {
                        g.strokeStyle = '#5dff6a'; g.lineWidth = 1.6; g.shadowColor = '#5dff6a'; g.shadowBlur = 6;
                        const sx = tx + p.dir * (10 + shot * 110);
                        g.beginPath(); g.moveTo(sx, ty); g.lineTo(sx + p.dir * 9, ty); g.stroke(); g.shadowBlur = 0;
                    }
                })],
            tile: A => `background: ${saberBg('#bfe6ff')} 20% 72% / 60% 5px no-repeat, url("${A.ds}") 84% 30% / 26px 26px no-repeat,
                        repeating-linear-gradient(180deg, transparent 0 5px, rgba(255, 232, 31, 0.55) 5px 6px) 50% 20% / 50% 18px no-repeat, ${A.crawlSky}, #03040a;`,
        }),

        // ---- Vertigo, as Saul Bass drew it: vermilion, black, cream, the spiral, the fall ----
        // Only flat shapes: a whirlpool over the ground, cut paper in the header, and inside the
        // cream chat the spiral turns while a man falls into it.
        saulbass: deluxe({
            assets: () => ({ spiral: spiralSvg('#1a0d08', 7, 2.6, 0.32), spiralInk: spiralSvg('#111111', 6, 3.2), spiralCream: spiralSvg('#f1e6cf', 5, 5),
                             man: fallingManSvg('#111111'), manRed: fallingManSvg('#d74219'), cutBlack: cutPaperSvg('#111111', 58, false), cutRed: cutPaperSvg('#d74219', 91, true) }),
            kit: A => ({
                titleCss: `font-family: ${GEO_FONT}; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3em;`,
                ground: `url("${A.spiral}") 50% 50% / 160vmax 160vmax no-repeat, radial-gradient(ellipse at 50% 50%, #e0501f, #c73a14 70%, #9e2c0e)`,
                header: { bg: `url("${A.cutBlack}") 0 100% / 640px 70% repeat-x, url("${A.cutRed}") 140px 0 / 640px 45% repeat-x, #f1e6cf`, border: '3px solid #111111' },
                cards: { bg: '#111111', border: '0', radius: '0', shadow: '4px 4px 0 #d74219' },
                footer: { bg: '#111111', border: '4px solid #d74219' },
                chat: {
                    bg: '#f1e6cf', border: '3px solid #111111', radius: '0',
                    head: '#111111', headBorder: '0', headText: '#f1e6cf',
                    body: 'transparent', comp: '#111111', compBorder: '0',
                    input: { bg: '#f1e6cf', border: '0', color: '#111111', radius: '0', hint: '#8a5a44' },
                },
                btn: { bg: '#111111', color: '#f1e6cf', border: '0', radius: '0', shadow: '3px 3px 0 #d74219',
                       hover: 'background: #d74219 !important; color: #111111 !important; box-shadow: 3px 3px 0 #f1e6cf !important;',
                       extra: `font-family: ${GEO_FONT}; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em;` },
                filled: { radius: '0', border: '0', shadow: '3px 3px 0 #111111' },
                popup: { bg: '#111111', border: '2px solid #f1e6cf', radius: '0', hover: 'rgba(215, 66, 25, 0.55)', head: '#d74219', shadow: '6px 6px 0 #d74219' },
                win: { border: '3px solid #111111', radius: '0', shadow: '8px 8px 0 #d74219', head: '#d74219', headBorder: '3px solid #111111', title: '#111111' },
                panel: { radius: '0', border: '#6b3a22', pressed: '#d74219' },
            }),
            extra: (S, A, fx) => lightChatCss(S, '#111111', '#8a4a2c') + `
                ${S} .mcf-chat__send { background: #d74219 !important; color: #111111 !important; box-shadow: none !important; }
                ${S} .mcf-chat__header .mcf-chat__status { color: #d7a48a !important; }
                ${S} .mcfo-bass-whirl { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
                ${S} .mcfo-bass-whirl i { position: absolute; left: 50%; top: 56%; width: 160%; aspect-ratio: 1; translate: -50% -50%; background: url("${A.spiralInk}") center / contain no-repeat; opacity: 0.12; }
                ${S} .mcfo-bass-whirl b { position: absolute; left: 50%; top: 56%; width: 22%; aspect-ratio: 0.75; background: url("${A.man}") center / contain no-repeat; opacity: 0.2;
                    transform: translate(-50%, -50%) scale(0.8) rotate(20deg); }
                ${fx(['full', 'subtle'], '.mcfo-bass-whirl i')} { animation: mcfoBassTurn 40s linear infinite; }
                ${fx(['full'], '.mcfo-bass-whirl b')} { animation: mcfoBassFall 10s ease-in infinite; }
                @keyframes mcfoBassTurn { to { rotate: 360deg; } }
                @keyframes mcfoBassFall { from { transform: translate(-50%, -50%) scale(2.4) rotate(-40deg); opacity: 0; } 14% { opacity: 0.24; } 80% { opacity: 0.2; }
                    to { transform: translate(-50%, -50%) scale(0.04) rotate(320deg); opacity: 0; } }
                ${S} .mcfo-bass-top { position: absolute; left: 50%; top: 50%; width: 46px; height: 46px; transform: translate(-50%, -50%); pointer-events: none;
                    border-radius: 50%; background: #111111; box-shadow: 4px 4px 0 #d74219; }
                ${S} .mcfo-bass-top i { position: absolute; inset: 3px; background: url("${A.spiralCream}") center / contain no-repeat; }
                ${S} .mcfo-bass-top b { position: absolute; left: 50%; top: 50%; width: 26px; height: 34px; transform: translate(-50%, -50%); background: url("${A.manRed}") center / contain no-repeat; }
                ${fx(['full', 'subtle'], '.mcfo-bass-top i')} { animation: mcfoBassTurn 12s linear infinite reverse; }`,
            decor: [
                { cls: 'mcfo-bass-whirl', host: () => document.querySelector('.mcf-chat'), html: '<i></i><b></b>' },
                { cls: 'mcfo-bass-top', host: () => role('top-status-region'), html: '<i></i><b></b>' },
            ],
            tile: A => `background: url("${A.man}") 50% 50% / 20px 26px no-repeat, url("${A.spiralInk}") 50% 50% / 58px 58px no-repeat,
                        url("${A.cutBlack}") 0 100% / 120px 30% repeat-x, #d74219; box-shadow: inset 0 0 0 2px #111111;`,
        }),

        // ---- Cinema: velvet curtain, marquee lights, a strip of film, popcorn ----
        // The chat is the screen between two curtains under a valance with gold fringe; the header
        // a marquee with chasing bulbs, the footer a film strip with seats behind the board.
        cinema: deluxe({
            assets: () => ({ seatsFront: seatsSvg('#1a0306', '#3e0a12'), seatsBack: seatsSvg('#120204', '#2a060c'), grain: grainSvg(0.18) }),
            kit: A => {
                const velvet = 'linear-gradient(180deg, rgba(0, 0, 0, 0.3), transparent 30%, rgba(0, 0, 0, 0.45)), repeating-linear-gradient(90deg, #4a0710 0, #8c1624 14px, #5a0a14 26px, #3a050c 30px)';
                const bulbs = 'radial-gradient(circle, #fff6d0 0 2.2px, rgba(255, 205, 110, 0.6) 2.8px, transparent 4.5px)';
                const ticket = c => `radial-gradient(circle at 0 50%, transparent 0 5px, ${c} 5.5px) 0 0 / 51% 100% no-repeat, radial-gradient(circle at 100% 50%, transparent 0 5px, ${c} 5.5px) 100% 0 / 51% 100% no-repeat`;
                return {
                    titleCss: `font-family: ${DECO_FONT}; text-transform: uppercase; letter-spacing: 0.14em;`,
                    // The seats stand above the footer, which covers the bottom of the ground.
                    ground: `url("${A.grain}") 0 0 / 180px 180px, url("${A.seatsFront}") 0 calc(100% - 60px) / 60px 44px repeat-x, url("${A.seatsBack}") 30px calc(100% - 88px) / 60px 44px repeat-x,
                             conic-gradient(from 168deg at 50% -8%, transparent 0deg, rgba(255, 240, 200, 0.07) 8deg, rgba(255, 240, 200, 0.12) 12deg, rgba(255, 240, 200, 0.07) 16deg, transparent 24deg),
                             radial-gradient(ellipse at 50% 20%, #2a0a0e, #120405 70%)`,
                    header: { bg: `${bulbs} 0 3px / 20px 9px repeat-x, ${bulbs} 10px calc(100% - 3px) / 20px 9px repeat-x, linear-gradient(180deg, #2a0d0d, #140606)`, border: '3px solid #d4a64a' },
                    cards: { bg: 'rgba(16, 6, 6, 0.9)', border: '1px solid #d4a64a', radius: '4px', shadow: 'inset 0 0 0 1px rgba(255, 220, 150, 0.12)' },
                    footer: { bg: 'linear-gradient(90deg, #e9dfc7 0 8px, transparent 8px) 0 4px / 18px 6px repeat-x, linear-gradient(90deg, #e9dfc7 0 8px, transparent 8px) 0 calc(100% - 4px) / 18px 6px repeat-x, linear-gradient(180deg, #121010, #070606)',
                              border: '2px solid #d4a64a', extra: 'isolation: isolate;' },
                    chat: {
                        bg: velvet, border: '3px solid #d4a64a', radius: '4px', pad: '28px 14px 0',
                        shadow: 'inset 0 0 0 1px #3a2208, 0 0 0 1px #000000',
                        head: 'linear-gradient(180deg, #1c0b0d, #0f0607)', headBorder: '1px solid #d4a64a', headText: '#f1cf7a',
                        body: 'radial-gradient(ellipse at 50% 0%, rgba(255, 240, 210, 0.12), transparent 70%), #0d0b0b', comp: '#140809', compBorder: '1px solid #6a4a1a',
                        input: { bg: '#070505', border: '1px solid #d4a64a', color: '#f7ead0', radius: '3px', hint: '#8f7a5a' },
                    },
                    btn: { bg: ticket('#c8202c'), color: '#fff3d6', border: '0', radius: '2px', shadow: 'none',
                           hover: 'filter: brightness(1.14) drop-shadow(0 0 6px rgba(212, 166, 74, 0.85));',
                           extra: `font-family: ${DECO_FONT}; text-transform: uppercase; letter-spacing: 0.08em; filter: drop-shadow(0 2px 0 rgba(0, 0, 0, 0.55));` },
                    filled: { radius: '2px', border: '1px solid rgba(255, 243, 214, 0.7)', shadow: '0 2px 0 rgba(0, 0, 0, 0.5)' },
                    popup: { bg: '#1a0709', border: '2px solid #d4a64a', radius: '5px', hover: 'rgba(212, 166, 74, 0.2)', head: '#f1cf7a', shadow: '0 0 0 1px #000000, 0 0 18px rgba(212, 166, 74, 0.25), 0 12px 30px rgba(0, 0, 0, 0.7)' },
                    win: { border: '3px solid #d4a64a', radius: '5px', shadow: '0 0 0 1px #000000, 0 16px 40px rgba(0, 0, 0, 0.7)', head: velvet, headBorder: '2px solid #d4a64a', title: '#f1cf7a' },
                    panel: { radius: '4px', border: '#6a4a1a', pressed: '#f1cf7a' },
                };
            },
            extra: (S, A, fx) => `
                ${S} [data-role="action-region"] > .mcfo-skin-canvas { z-index: -1; }
                ${S} .mcfo-win__title { text-shadow: 0 1px 0 #000000; }
                ${fx(['full', 'subtle'], '[data-role="top-status-region"]')} { animation: mcfoCineBulbs 0.9s steps(2) infinite; }
                @keyframes mcfoCineBulbs { to { background-position: 10px 3px, 20px calc(100% - 3px), 0 0; } }
                ${fx(['full', 'subtle'], '[data-role="action-region"]')} { animation: mcfoCineFilm 1.2s linear infinite; }
                @keyframes mcfoCineFilm { to { background-position: 18px 4px, 18px calc(100% - 4px), 0 0; } }
                ${S} .mcfo-cine-valance { position: absolute; top: 0; left: 0; right: 0; height: 30px; pointer-events: none; z-index: 2;
                    background: linear-gradient(180deg, #f1cf7a, #8a6a24) 0 0 / 100% 4px no-repeat,
                                repeating-linear-gradient(90deg, #d4a64a 0 1px, transparent 1px 3px) 0 20px / 100% 9px no-repeat,
                                radial-gradient(circle at 50% 0, #a51c2c 0 13px, #6a0e18 13.5px 15px, transparent 15.5px) 0 4px / 30px 17px repeat-x,
                                linear-gradient(180deg, #7a1220, #5a0a14) 0 0 / 100% 12px no-repeat; }
                ${S} .mcfo-cine-marquee { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); padding: 5px 9px; border-radius: 4px; pointer-events: none;
                    background: radial-gradient(circle, #fff6d0 0 1.8px, rgba(255, 205, 110, 0.6) 2.3px, transparent 3.6px) 0 0 / 8px 8px, #3a1010; box-shadow: 0 0 0 2px #d4a64a, 0 0 16px rgba(255, 205, 110, 0.35); }
                ${fx(['full', 'subtle'], '.mcfo-cine-marquee')} { animation: mcfoCineChase 0.8s steps(2) infinite; }
                @keyframes mcfoCineChase { to { background-position: 8px 0, 0 0; } }
                ${S} .mcfo-cine-marquee i { display: block; padding: 2px 14px 3px; text-align: center; font-style: normal; white-space: nowrap;
                    background: linear-gradient(180deg, #fffdf5, #efe5c8); box-shadow: inset 0 0 6px rgba(0, 0, 0, 0.25); }
                ${S} .mcfo-cine-marquee small { display: block; font: 700 7px/1.3 ${GEO_FONT}; letter-spacing: 0.42em; color: #b3141f; }
                ${S} .mcfo-cine-marquee b { display: block; font: 700 17px/1 ${CONDENSED_FONT}; letter-spacing: 0.16em; color: #111111; }
                ${S} .mcfo-cine-clap { position: absolute; left: 28%; top: 50%; width: 26px; height: 24px; transform: translate(-50%, -50%); pointer-events: none; filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.6)); }
                ${S} .mcfo-cine-clap svg { display: block; width: 100%; height: 100%; overflow: visible; }
                ${S} .mcfo-cine-clap .mcfo-clap-stick { transform-box: view-box; transform-origin: 2px 9px; }
                ${fx(['full', 'subtle'], '.mcfo-cine-clap .mcfo-clap-stick')} { animation: mcfoCineClap 5s ease-in infinite; }
                @keyframes mcfoCineClap { 0%, 70% { transform: rotate(-22deg); } 76% { transform: rotate(0deg); } 80% { transform: rotate(-6deg); } 84%, 100% { transform: rotate(-22deg); } }`,
            decor: [
                { cls: 'mcfo-cine-valance', host: () => document.querySelector('.mcf-chat'), html: '' },
                { cls: 'mcfo-cine-marquee', host: () => role('top-status-region'), html: '<i><small>Now showing</small><b>MARBLE CROWNFALL</b></i>' },
                { cls: 'mcfo-cine-clap', host: () => document.querySelector('.mcf-chat__header'), html: CLAPPER_SVG },
            ],
            particles: [
                // Dust in the light of the projector.
                drifters('dust', () => document.querySelector('.mcf-chat:not([data-collapsed="true"])'), 22,
                    (w, h, any) => ({ x: rnd(0, w), y: any ? rnd(0, h) : rnd(0, h), v: rnd(-4, 4), u: rnd(-3, 3), ph: rnd(0, 6), r: rnd(0.5, 1.3), t: 0, life: rnd(6, 14) }),
                    (p, dt) => { p.x += p.v * dt; p.y += p.u * dt; p.t += dt; return p.t < p.life; },
                    (g, p, now) => { const a = Math.sin(p.t / p.life * Math.PI) * (0.35 + 0.25 * Math.sin(now / 500 + p.ph)); glowDot(g, p.x, p.y, p.r * 3, '255, 240, 210', a); }),
                // Popcorn jumping out of the film strip.
                drifters('popcorn', () => role('action-region'), 5,
                    (w, h, any) => ({ x: rnd(10, w - 10), y: h + 8, vy: -rnd(70, 115), vx: rnd(-18, 18), s: rnd(3, 4.5), wait: any ? rnd(0, 4) : rnd(0.5, 5),
                                      puffs: Array.from({ length: 4 }, (_, i) => [rnd(-0.7, 0.7), rnd(-0.7, 0.7), i % 2]) }),
                    (p, dt, now, w, h) => { if ((p.wait -= dt) > 0) return true; p.vy += 190 * dt; p.y += p.vy * dt; p.x += p.vx * dt; return p.y < h + 12; },
                    (g, p) => { if (p.wait <= 0) popcornDraw(g, p); }),
            ],
            tile: () => `background: radial-gradient(circle, #fff6d0 0 1.6px, transparent 2.6px) 0 1px / 9px 6px repeat-x,
                        linear-gradient(90deg, #e9dfc7 0 4px, transparent 4px) 0 calc(100% - 2px) / 9px 3px repeat-x,
                        linear-gradient(180deg, #0d0b0b 0 10%, transparent 10% 88%, #0d0b0b 88%),
                        linear-gradient(90deg, transparent 0 28%, #1a1414 28% 72%, transparent 72%),
                        repeating-linear-gradient(90deg, #4a0710 0, #8c1624 5px, #3a050c 9px); box-shadow: inset 0 0 0 2px #d4a64a;`,
        }),
    });

    // =========================================================================================
    // 3f. BOOKS (6.17)
    // =========================================================================================
    // Two themes for readers. The Lost Bookshop (Evie Woods; "Der verschwundene Buchladen"): the
    // wall of dark blue spines with ivy growing over it and the little yellow house in a nook
    // between the books. And a reading nook: tea, a page of a book, a knitted blanket, fairy
    // lights. All drawn here; the lines on the plaques are our own, not the book's.
    const BOOK_SERIF = '"Cormorant Garamond", "EB Garamond", Garamond, "Palatino Linotype", "Book Antiqua", Georgia, serif';
    const BOOK_SCRIPT = '"Great Vibes", "Allura", "Brush Script MT", "Segoe Script", "URW Chancery L", cursive';

    // A shelf of books: spines of different widths and heights, gold bands on some, a board below.
    function spinesSvg(seed, w, h, pal, rare) {
        const r = seeded(seed), board = Math.round(h * 0.13);
        let x = 0, s = '';
        while (x < w) {
            const bw = 6 + Math.floor(r() * 11), bwc = Math.min(bw, w - x), bh = Math.round((h - board) * (0.72 + r() * 0.28));
            const y = h - board - bh, c = r() < 0.12 ? pickOf(r, rare) : pickOf(r, pal);
            s += `<rect x="${x}" y="${y}" width="${bwc}" height="${bh}" fill="${c}"/>`
               + `<rect x="${x}" y="${y}" width="1" height="${bh}" fill="rgba(255,255,255,.09)"/><rect x="${x + bwc - 1}" y="${y}" width="1" height="${bh}" fill="rgba(0,0,0,.4)"/>`;
            if (r() < 0.45 && bwc > 3) {
                s += `<rect x="${x + 1}" y="${(y + 4 + r() * 6).toFixed(1)}" width="${bwc - 2}" height="1.3" fill="#c9a24a" opacity=".8"/>`
                   + `<rect x="${x + 1}" y="${(y + bh - 8 - r() * 6).toFixed(1)}" width="${bwc - 2}" height="1.3" fill="#c9a24a" opacity=".7"/>`;
            }
            if (r() < 0.2 && bwc > 8) s += `<rect x="${x + 2}" y="${(y + bh * 0.35).toFixed(1)}" width="${bwc - 4}" height="${(bh * 0.18).toFixed(1)}" fill="rgba(0,0,0,.28)"/>`;
            x += bw;
        }
        s += `<rect y="${h - board}" width="${w}" height="${board}" fill="#2a1a10"/><rect y="${h - board}" width="${w}" height="1.5" fill="#6a4628"/>`;
        return svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">${s}</svg>`);
    }
    const LB_SPINES = ['#0f2233', '#15304a', '#1d3a52', '#24485e', '#2E4947', '#1a2a3a', '#33506a', '#0b1a28', '#264a4a'];
    const LB_RARE = ['#6b3a22', '#8a4a2a', '#5a2a1a', '#3a5a3a'];

    // A heart-shaped ivy leaf: stalk at the origin, tip at (0, 13).
    const LEAF_D = 'M0 13C-4 9-7 6-7 3C-7 .5-5-1-3-1C-1.6-1-.5-.2 0 .8C.5-.2 1.6-1 3-1C5-1 7 .5 7 3C7 6 4 9 0 13Z';
    const IVY_GREENS = ['#427358', '#78A66A', '#2f6b3a', '#5a9a5a', '#3a7f4a'];
    // A strand of ivy, top to bottom (or left to right with horiz): a wavy stem, leaves either side.
    function ivySvg(seed, len, horiz) {
        const r = seeded(seed), W = 36;
        let stem = `M${W / 2} 0`, leaves = '';
        for (let y = 0; y < len; y += 12) stem += `Q${W / 2 + ((y / 12) % 2 ? 6 : -6)} ${y + 6} ${W / 2} ${y + 12}`;
        for (let y = 5; y < len - 4; y += 13 + r() * 9) {
            const side = r() < 0.5 ? -1 : 1, sc = 0.7 + r() * 0.55;
            leaves += `<g transform="translate(${(W / 2 + side * 2.5).toFixed(1)} ${y.toFixed(1)}) rotate(${(-side * (35 + r() * 45)).toFixed(0)}) scale(${sc.toFixed(2)})">`
                    + `<path d="${LEAF_D}" fill="${pickOf(r, IVY_GREENS)}"/><path d="M0 1.5V11" stroke="rgba(255,255,255,.28)" stroke-width=".6"/></g>`;
        }
        const g = `<path d="${stem}" fill="none" stroke="#2a4a2a" stroke-width="1.6"/>${leaves}`;
        return horiz
            ? svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${len} ${W}"><g transform="matrix(0 1 1 0 0 0)">${g}</g></svg>`)
            : svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${len}">${g}</svg>`);
    }
    // The little yellow house: grey roof, two chimneys, white windows lit from inside, a red door.
    const houseSvg = () => svgUrl('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 54">'
        + '<defs><linearGradient id="h" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#d99a2b"/><stop offset=".5" stop-color="#f4c552"/><stop offset="1" stop-color="#c98a22"/></linearGradient></defs>'
        + '<rect x="13" y="2" width="5" height="10" fill="#6c7580"/><rect x="42" y="2" width="5" height="10" fill="#6c7580"/>'
        + '<path d="M3 21L10 8H50L57 21Z" fill="#7d8792"/><path d="M10 8H50L51.5 11H8.5Z" fill="#9aa3ad"/>'
        + '<rect x="6" y="21" width="48" height="30" fill="url(#h)"/><rect x="4" y="20" width="52" height="2" fill="#f1e9d6"/>'
        + '<g fill="#fff3c4" stroke="#f7f1e3" stroke-width="1">'
        + '<rect x="10" y="25" width="6" height="8"/><rect x="20.5" y="25" width="6" height="8"/><rect x="33.5" y="25" width="6" height="8"/><rect x="44" y="25" width="6" height="8"/>'
        + '<rect x="10" y="39" width="6" height="8"/><rect x="18" y="39" width="6" height="8"/><rect x="36" y="39" width="6" height="8"/><rect x="44" y="39" width="6" height="8"/></g>'
        + '<g stroke="#8a8f96" stroke-width=".5"><path d="M13 25v8M10 29h6M23.5 25v8M20.5 29h6M36.5 25v8M33.5 29h6M47 25v8M44 29h6M13 39v8M10 43h6M21 39v8M18 43h6M39 39v8M36 43h6M47 39v8M44 43h6"/></g>'
        + '<rect x="26.5" y="37" width="7" height="14" fill="#f7f1e3"/><rect x="27.5" y="38" width="5" height="13" fill="#b0302a"/>'
        + '<rect x="4" y="51" width="52" height="2.5" fill="#d8cfb8"/></svg>');
    function letterDraw(g, p, now, w, h) {
        const a = Math.max(0, Math.min(1, p.y / h)) * (0.55 + 0.35 * Math.sin(now / 400 + p.ph));
        g.save(); g.translate(p.x, p.y); g.rotate(p.rot + Math.sin(now / 900 + p.ph) * 0.2);
        g.globalAlpha = a; g.fillStyle = '#e8c46a'; g.shadowColor = 'rgba(232, 196, 106, 0.8)'; g.shadowBlur = 6;
        g.font = `italic ${p.s}px ${BOOK_SERIF}`; g.textAlign = 'center'; g.fillText(p.ch, 0, 0);
        g.restore();
    }
    let leafPath = null;
    function leafDraw(g, p, now) {
        if (!leafPath) { try { leafPath = new Path2D(LEAF_D); } catch (e) { return; } }
        g.save(); g.translate(p.x, p.y); g.rotate(p.a + Math.sin(now / 700 + p.ph) * 0.6); g.scale(p.s, p.s);
        g.globalAlpha = 0.8; g.fillStyle = p.c; g.fill(leafPath);
        g.restore();
    }

    // ---- Reading nook ----
    // Knitting: rows of V stitches, two leaning loops each.
    const knitSvg = (base, loop, hi) => svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="12" height="10" viewBox="0 0 12 10"><rect width="12" height="10" fill="${base}"/>`
        + `<g fill="${loop}" stroke="${hi}" stroke-width=".5"><ellipse cx="3.3" cy="5" rx="4.2" ry="2.1" transform="rotate(62 3.3 5)"/><ellipse cx="8.7" cy="5" rx="4.2" ry="2.1" transform="rotate(-62 8.7 5)"/></g></svg>`);
    const bookStackSvg = () => svgUrl('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 130 120">'
        + '<g stroke="rgba(0,0,0,.35)" stroke-width=".8">'
        + '<rect x="8" y="98" width="104" height="18" rx="2" fill="#7a2e22"/><rect x="104" y="100" width="6" height="14" fill="#efe3c6"/>'
        + '<rect x="16" y="81" width="90" height="17" rx="2" fill="#5a7a58"/><rect x="98" y="83" width="6" height="13" fill="#efe3c6"/>'
        + '<rect x="6" y="64" width="96" height="17" rx="2" fill="#c8962e"/><rect x="94" y="66" width="6" height="13" fill="#efe3c6"/>'
        + '<rect x="22" y="49" width="74" height="15" rx="2" fill="#2e4a6a"/><rect x="88" y="51" width="6" height="11" fill="#efe3c6"/></g>'
        + '<g fill="#e8c46a" opacity=".8"><rect x="14" y="102" width="2" height="10"/><rect x="20" y="102" width="2" height="10"/><rect x="22" y="85" width="2" height="9"/>'
        + '<rect x="12" y="68" width="2" height="9"/><rect x="18" y="68" width="2" height="9"/><rect x="28" y="52" width="2" height="9"/></g>'
        + '<path d="M44 26h26v17a4 4 0 0 1-4 4H48a4 4 0 0 1-4-4z" fill="#e8dcc4" stroke="#8a5a34" stroke-width="1.2"/>'
        + '<path d="M70 30h3a5 5 0 0 1 0 10h-3" fill="none" stroke="#8a5a34" stroke-width="1.6"/><ellipse cx="57" cy="26.5" rx="12.5" ry="2" fill="#a0602e"/>'
        + '<g fill="none" stroke="rgba(255,240,220,.35)" stroke-width="1.4" stroke-linecap="round"><path d="M52 21c-3-3 3-5 0-9"/><path d="M58 21c-3-3 3-5 0-9"/><path d="M64 21c-3-3 3-5 0-9"/></g></svg>');
    const plantSvg = () => svgUrl('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 90 120">'
        + '<g fill="#4f7a45"><ellipse cx="30" cy="48" rx="9" ry="22" transform="rotate(-35 30 48)"/><ellipse cx="60" cy="46" rx="9" ry="22" transform="rotate(35 60 46)"/>'
        + '<ellipse cx="45" cy="36" rx="8" ry="24"/><ellipse cx="20" cy="66" rx="7" ry="17" transform="rotate(-62 20 66)"/><ellipse cx="70" cy="66" rx="7" ry="17" transform="rotate(62 70 66)"/></g>'
        + '<g stroke="#2f5a2a" stroke-width="1"><path d="M45 78V16M45 78L27 36M45 78L63 34M45 80L15 62M45 80L75 62"/></g>'
        + '<path d="M24 78h42l-5 38H29z" fill="#b8643a"/><rect x="21" y="75" width="48" height="8" rx="2" fill="#c97448"/></svg>');
    const TEACUP_SVG = '<svg viewBox="0 0 32 32"><g class="mcfo-steam" fill="none" stroke="#e6d2b0" stroke-width="1.4" stroke-linecap="round"><path d="M12 12c-2-2 2-4 0-6"/><path d="M16 12c-2-2 2-4 0-6"/><path d="M20 12c-2-2 2-4 0-6"/></g>'
        + '<path d="M7 15h18v4a8 8 0 0 1-8 8h-2a8 8 0 0 1-8-8z" fill="#f3e6c8" stroke="#8a5a34" stroke-width="1.2"/><path d="M25 17h2a3 3 0 0 1 0 6h-2.4" fill="none" stroke="#f3e6c8" stroke-width="1.6"/>'
        + '<ellipse cx="16" cy="15" rx="9" ry="1.6" fill="#a0602e"/><path d="M5 28h22" stroke="#f3e6c8" stroke-width="1.4" stroke-linecap="round"/></svg>';
    // Fairy lights on the windowsill: a wire drooping between hooks, warm bulbs that breathe.
    const fairyLights = host => ({
        name: 'fairy', host,
        init: w => {
            const n = Math.max(4, Math.round(w / 23) * 2), pts = [];
            for (let i = 0; i <= n; i++) pts.push({ x: i * w / n, ph: Math.random() * 6.28, sp: 0.6 + Math.random() * 1.3, c: pickOf(Math.random, ['255, 214, 140', '255, 190, 110', '255, 236, 190', '255, 170, 120']) });
            return { pts };
        },
        step: (g, st, w, h, dt, now) => {
            g.clearRect(0, 0, w, h);
            const top = 2, sag = 8, hooks = st.pts.filter((_, i) => i % 2 === 0);
            g.strokeStyle = 'rgba(40, 28, 20, 0.9)'; g.lineWidth = 1.2; g.beginPath();
            hooks.forEach((p, i) => { if (!i) g.moveTo(p.x, top); else g.quadraticCurveTo((p.x + hooks[i - 1].x) / 2, top + sag * 2, p.x, top); });
            g.stroke();
            st.pts.forEach((p, i) => {
                const y = (i % 2 ? top + sag : top) + 4, a = 0.55 + 0.45 * Math.sin(now / 1000 * p.sp + p.ph);
                glowDot(g, p.x, y, 13, p.c, 0.4 * a);
                g.globalAlpha = 1; g.fillStyle = `rgba(${p.c}, ${0.55 + 0.45 * a})`;
                g.beginPath(); g.ellipse(p.x, y, 2.4, 3.3, 0, 0, Math.PI * 2); g.fill();
            });
        },
    });

    Object.assign(SKINS, {
        // ---- The Lost Bookshop / Der verschwundene Buchladen ----
        lostbookshop: deluxe({
            assets: () => ({
                wall: spinesSvg(1942, 420, 120, LB_SPINES, LB_RARE), strip: spinesSvg(7, 360, 60, LB_SPINES, LB_RARE), nook: spinesSvg(23, 300, 74, LB_SPINES, LB_RARE),
                ivyA: ivySvg(3, 150), ivyB: ivySvg(11, 120), ivyC: ivySvg(17, 170), ivyChat: ivySvg(29, 240), garland: ivySvg(41, 260, true), house: houseSvg(),
            }),
            kit: A => {
                const spine = 'linear-gradient(180deg, transparent 0 3px, #c9a24a 3px 4px, transparent 4px calc(100% - 4px), #c9a24a calc(100% - 4px) calc(100% - 3px), transparent calc(100% - 3px)), '
                    + 'linear-gradient(90deg, #1a3448, #2E4947 50%, #1a3448)';
                return {
                    titleCss: `font-family: ${BOOK_SCRIPT}; font-weight: 400; font-size: 1.4em; letter-spacing: 0.01em; text-transform: none; color: #e8c46a;`,
                    ground: `url("${A.ivyA}") 8% 56px / 36px 150px no-repeat, url("${A.ivyB}") 21% 56px / 36px 120px no-repeat, url("${A.ivyC}") 61% 56px / 36px 170px no-repeat, url("${A.ivyB}") 76% 56px / 36px 120px no-repeat,
                             radial-gradient(ellipse at 50% 40%, rgba(7, 15, 26, 0.15), rgba(7, 15, 26, 0.72) 78%), url("${A.wall}") 0 0 / 420px 120px, #070F1A`,
                    header: { bg: `linear-gradient(180deg, rgba(7, 15, 26, 0.25), rgba(7, 15, 26, 0.55)), url("${A.strip}") 0 0 / 360px 100% repeat-x, #070F1A`,
                              border: '3px solid #2a1a10', extra: 'box-shadow: 0 1px 0 #6a4628, 0 6px 18px rgba(0, 0, 0, 0.55) !important;' },
                    cards: { bg: 'rgba(7, 15, 26, 0.9)', border: '1px solid #b8963f', radius: '3px', shadow: 'inset 0 0 0 1px rgba(232, 196, 106, 0.12)' },
                    footer: { bg: `url("${A.garland}") 0 -4px / 260px 32px repeat-x, repeating-linear-gradient(90deg, rgba(0, 0, 0, 0.12) 0 2px, transparent 2px 60px), linear-gradient(180deg, #3a2414, #22140a)`,
                              border: '2px solid #6a4628', extra: 'isolation: isolate;' },
                    chat: {
                        bg: 'radial-gradient(ellipse at 50% 20%, rgba(46, 73, 71, 0.35), transparent 70%), linear-gradient(180deg, #0d1b29, #070F1A)', border: '2px solid #b8963f', radius: '4px', pad: '78px 12px 0',
                        shadow: 'inset 0 0 0 1px #2a1a10, 0 0 0 1px #000000',
                        head: 'linear-gradient(180deg, #132536, #0b1622)', headBorder: '1px solid #b8963f', headText: '#e8c46a',
                        body: 'transparent', comp: '#0a131d', compBorder: '1px solid rgba(184, 150, 63, 0.6)',
                        input: { bg: '#060d16', border: '1px solid #8a7440', color: '#efe6cf', radius: '3px', hint: '#8a7f66' },
                    },
                    btn: { bg: spine, color: '#f0d88a', border: '1px solid #0b1622', radius: '2px', shadow: 'inset 1px 0 0 rgba(255, 255, 255, 0.12), 0 2px 0 #050a10',
                           hover: 'filter: brightness(1.18); box-shadow: 0 0 0 1px #c9a24a, 0 0 12px rgba(232, 196, 106, 0.5) !important;',
                           extra: `font-family: ${BOOK_SERIF}; font-weight: 700; letter-spacing: 0.04em;` },
                    filled: { radius: '2px', border: '1px solid rgba(201, 162, 74, 0.8)', shadow: '0 2px 0 rgba(0, 0, 0, 0.5)' },
                    popup: { bg: '#0b1622', border: '1px solid #b8963f', radius: '4px', hover: 'rgba(120, 166, 106, 0.2)', head: '#e8c46a', shadow: '0 0 0 1px #000000, 0 12px 30px rgba(0, 0, 0, 0.7)' },
                    win: { border: '2px solid #b8963f', radius: '4px', shadow: '0 0 0 1px #000000, 0 16px 40px rgba(0, 0, 0, 0.7)',
                           head: `linear-gradient(180deg, rgba(7, 15, 26, 0.45), rgba(7, 15, 26, 0.75)), url("${A.strip}") 0 0 / 240px 100% repeat-x`, headBorder: '2px solid #2a1a10', title: '#e8c46a' },
                    panel: { radius: '3px', border: '#3a5060', pressed: '#e8c46a' },
                };
            },
            extra: (S, A, fx) => `
                ${S} .mcf-chat__header .mcf-chat__title strong { color: #e8c46a !important; }
                ${S} [data-role="action-region"] > .mcfo-skin-canvas { z-index: -1; }
                ${S} .mcfo-lb-nook { position: absolute; top: 0; left: 0; right: 0; height: 78px; pointer-events: none; border-radius: 2px 2px 0 0; overflow: hidden;
                    background: url("${A.nook}") 0 100% / 300px 74px repeat-x, #070F1A; box-shadow: inset 0 -2px 0 #6a4628; }
                ${S} .mcfo-lb-nook i { position: absolute; left: 50%; bottom: 10px; width: 78px; height: 58px; transform: translateX(-50%);
                    background: radial-gradient(ellipse at 50% 70%, rgba(255, 214, 120, 0.25), transparent 70%), #050b13; box-shadow: inset 0 0 10px #000000, 0 0 0 2px #0b1622; }
                ${S} .mcfo-lb-nook b { position: absolute; left: 50%; bottom: 10px; width: 62px; height: 56px; transform: translateX(-50%);
                    background: url("${A.house}") center bottom / contain no-repeat; filter: drop-shadow(0 0 6px rgba(255, 214, 120, 0.45)); }
                ${fx(['full', 'subtle'], '.mcfo-lb-nook b')} { animation: mcfoLbGlow 5s ease-in-out infinite alternate; }
                @keyframes mcfoLbGlow { from { filter: drop-shadow(0 0 3px rgba(255, 214, 120, 0.3)); } to { filter: drop-shadow(0 0 10px rgba(255, 214, 120, 0.75)); } }
                ${S} .mcfo-lb-ivy { position: absolute; inset: 60px 0 0; pointer-events: none; }
                ${S} .mcfo-lb-ivy i { position: absolute; top: 0; bottom: 0; width: 30px; background: url("${A.ivyChat}") 50% 0 / 30px 200px repeat-y; }
                ${S} .mcfo-lb-ivy i:first-child { left: -9px; }
                ${S} .mcfo-lb-ivy i:last-child { right: -9px; transform: scaleX(-1); background-position: 50% 90px; }
                ${S} .mcfo-lb-plaque { position: absolute; left: 50%; top: 100%; z-index: 40; transform: translate(-50%, -100%); pointer-events: none; white-space: nowrap;
                    padding: 3px 16px 3px; border-radius: 7px 7px 0 0; background: rgba(7, 15, 26, 0.94); border: 1px solid #b8963f; border-bottom: 0; box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.45);
                    font: 400 16px/1.1 ${BOOK_SCRIPT}; color: #e8c46a; text-shadow: 0 0 8px rgba(232, 196, 106, 0.35); }`,
            decor: [
                { cls: 'mcfo-lb-nook', host: () => document.querySelector('.mcf-chat'), html: '<i></i><b></b>' },
                { cls: 'mcfo-lb-ivy', host: () => document.querySelector('.mcf-chat'), html: '<i></i><i></i>' },
                // Sits ON TOP of the king tile like a crest that belongs to it (bottom edge = tile top edge), so it
                // never covers the king's name or crown. The header centre is usually covered by cards, so it is
                // lifted above them. Re-measured every tick because the tile moves with chat/tray.
                { cls: 'mcfo-lb-plaque', host: () => role('top-status-region'), html: 'In a place called Lost, strange things are found.',
                  place: (el, host) => {
                      const tile = role('king-tile-frame') || role('king-pane');
                      if (!tile) return;
                      const t = tile.getBoundingClientRect(), h = host.getBoundingClientRect();
                      if (!t.width || !h.width) return;
                      el.style.left = Math.round(t.left + t.width / 2 - h.left) + 'px';
                      el.style.top = Math.round(t.top - h.top) + 'px';
                  } },
            ],
            particles: [
                // Letters rising out of the shelf, as if the stories were getting out.
                drifters('letters', () => role('action-region'), 9,
                    (w, h, any) => ({ x: rnd(8, w - 8), y: any ? rnd(0, h) : h + 10, v: rnd(7, 14), ph: rnd(0, 6), rot: rnd(-0.4, 0.4), s: rnd(10, 16),
                                      ch: pickOf(Math.random, 'ABCDEFGHIKLMNOPRSTUWaeghiklmnorstuy&'.split('')) }),
                    (p, dt, now) => { p.y -= p.v * dt; p.x += Math.sin(now / 800 + p.ph) * 6 * dt; return p.y > -14; },
                    letterDraw),
                // Now and then a leaf lets go of the ivy.
                drifters('ivyleaves', () => document.querySelector('.mcf-chat:not([data-collapsed="true"])'), 5,
                    (w, h, any) => ({ x: rnd(10, w - 10), y: any ? rnd(0, h) : -14, v: rnd(9, 16), ph: rnd(0, 6), a: rnd(0, 6), s: rnd(0.6, 1.0), c: pickOf(Math.random, IVY_GREENS) }),
                    (p, dt, now, w, h) => { p.y += p.v * dt; p.x += Math.sin(now / 900 + p.ph) * 12 * dt; return p.y < h + 14; },
                    leafDraw),
            ],
            tile: A => `background: url("${A.house}") 50% 62% / 30px 27px no-repeat, radial-gradient(ellipse at 50% 60%, #050b13 0 18px, transparent 19px),
                        url("${A.ivyB}") 6% 0 / 16px 54px no-repeat, url("${A.ivyA}") 94% 0 / 16px 60px no-repeat, url("${A.wall}") 0 0 / 160px 46px, #070F1A;
                        box-shadow: inset 0 0 0 2px #b8963f;`,
        }),

        // ---- Reading nook: tea, a book, a knitted blanket, fairy lights ----
        // The chat is a page of the book, the chat header its leather cover, a ribbon marks the
        // place. The header is the blanket, the footer the windowsill with its string of lights.
        readingnook: deluxe({
            assets: () => ({ knit: knitSvg('#a88a62', '#e8d8b8', 'rgba(120, 90, 50, 0.45)'), stack: bookStackSvg(), plant: plantSvg(), grain: grainSvg(0.12) }),
            kit: A => {
                const leather = 'linear-gradient(180deg, rgba(255, 255, 255, 0.06), transparent 40%), linear-gradient(180deg, #6b3a22, #4a2616)';
                const wood = 'repeating-linear-gradient(90deg, rgba(0, 0, 0, 0.1) 0 1px, transparent 1px 7px, rgba(255, 220, 170, 0.04) 7px 9px, transparent 9px 23px), linear-gradient(180deg, #6b4428, #4a2c18)';
                return {
                    titleCss: `font-family: ${BOOK_SERIF}; font-style: italic; font-weight: 700; letter-spacing: 0.02em;`,
                    ground: `url("${A.stack}") 2.5% calc(100% - 64px) / auto 118px no-repeat, url("${A.plant}") 61% calc(100% - 64px) / auto 112px no-repeat,
                             radial-gradient(ellipse at 10% 6%, rgba(255, 196, 120, 0.32), transparent 42%), radial-gradient(ellipse at 90% 100%, rgba(255, 170, 100, 0.12), transparent 45%),
                             radial-gradient(circle, rgba(255, 220, 170, 0.07) 0 2.5px, transparent 3px) 0 0 / 28px 28px,
                             repeating-linear-gradient(90deg, rgba(0, 0, 0, 0.09) 0 14px, transparent 14px 28px), linear-gradient(180deg, #3a2419, #24160f)`,
                    header: { bg: `url("${A.knit}") 0 0 / 12px 10px`, border: '3px solid #8a6a44',
                              extra: 'box-shadow: inset 0 -4px 6px rgba(80, 50, 20, 0.35), 0 6px 18px rgba(0, 0, 0, 0.45) !important;' },
                    cards: { bg: 'rgba(58, 36, 25, 0.92)', border: '1px solid #c9a24a', radius: '8px', shadow: '0 2px 6px rgba(40, 20, 10, 0.4)' },
                    footer: { bg: wood, border: '2px solid #8a5a34', extra: 'isolation: isolate;' },
                    chat: {
                        bg: `url("${A.grain}") 0 0 / 180px 180px, radial-gradient(ellipse at 50% 40%, transparent 60%, rgba(120, 80, 40, 0.14)), #f6eedb`, border: '1px solid #b8a27a', radius: '4px 10px 10px 4px',
                        shadow: 'inset -5px 0 0 #efe4c8, inset -6px 0 0 #cdbd98, inset -9px 0 0 #f3e9d0, inset -10px 0 0 #cdbd98, 0 0 0 1px #6b3a22',
                        head: leather, headBorder: '3px solid #c9a24a', headText: '#f1d9a0',
                        body: 'transparent', comp: '#efe3c6', compBorder: '1px solid #cdb88f',
                        input: { bg: '#fffaf0', border: '1px solid #b8a27a', color: '#3b2a1e', radius: '999px', hint: '#a08a6a' },
                    },
                    btn: { bg: 'linear-gradient(180deg, #f5e9cd, #e6d2a8)', color: '#6b3a22', border: '1px dashed #a0784a', radius: '10px', shadow: '0 0 0 2px #e6d2a8, 0 3px 0 2px #8a6a4a',
                           hover: 'filter: brightness(1.05); box-shadow: 0 0 0 2px #f1d9a0, 0 0 12px rgba(255, 196, 120, 0.6) !important;', extra: `font-family: ${BOOK_SERIF}; font-weight: 700;` },
                    filled: { radius: '10px', border: '1px dashed rgba(255, 244, 220, 0.85)', shadow: '0 3px 0 rgba(60, 30, 10, 0.5)' },
                    popup: { bg: '#2b1d17', border: '1px solid #c9a24a', radius: '10px', hover: 'rgba(255, 196, 120, 0.18)', head: '#f1d9a0', shadow: '0 0 0 1px #000000, 0 12px 30px rgba(0, 0, 0, 0.6)' },
                    win: { border: '2px solid #8a5a34', radius: '10px', shadow: '0 0 0 1px #2b1d17, 0 16px 40px rgba(0, 0, 0, 0.6)', head: leather, headBorder: '2px solid #c9a24a', title: '#f1d9a0' },
                    panel: { radius: '8px', border: '#8a6a44', pressed: '#f1d9a0' },
                };
            },
            extra: (S, A, fx) => lightChatCss(S, '#3b2a1e', '#8a6a4a') + `
                ${S} .mcf-chat__header .mcf-chat__status { color: #e0c48a !important; }
                ${S} .mcf-chat__send { background: #7a2e22 !important; color: #fff1d8 !important; border: 1px dashed #f1d9a0 !important; box-shadow: 0 0 0 2px #7a2e22 !important; }
                ${S} [data-role="action-region"] > .mcfo-skin-canvas { z-index: -1; }
                ${S} .mcfo-nook-tag { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%) rotate(-1.5deg); pointer-events: none; white-space: nowrap;
                    padding: 4px 18px 6px; border-radius: 3px; background: #efe3c6; color: #6b3a22; font: 400 21px/1 ${BOOK_SCRIPT};
                    outline: 1px dashed #a0784a; outline-offset: -4px; box-shadow: 0 3px 8px rgba(60, 30, 10, 0.45); }
                ${S} .mcfo-nook-tag::before { content: ''; position: absolute; left: 7px; top: 50%; width: 6px; height: 6px; margin-top: -3px; border-radius: 50%; background: #a88a62; box-shadow: inset 0 1px 1px rgba(0, 0, 0, 0.4); }
                ${S} .mcfo-nook-cup { position: absolute; left: 34%; top: 50%; width: 28px; height: 28px; transform: translate(-50%, -55%); pointer-events: none; }
                ${S} .mcfo-nook-cup svg { display: block; width: 100%; height: 100%; overflow: visible; }
                ${S} .mcfo-nook-cup .mcfo-steam path { opacity: 0.6; }
                ${fx(['full', 'subtle'], '.mcfo-nook-cup .mcfo-steam path')} { animation: mcfoSteam 3.2s ease-in-out infinite; }
                ${fx(['full', 'subtle'], '.mcfo-nook-cup .mcfo-steam path:nth-child(2)')} { animation-delay: 1.1s; }
                ${fx(['full', 'subtle'], '.mcfo-nook-cup .mcfo-steam path:nth-child(3)')} { animation-delay: 2.1s; }
                @keyframes mcfoSteam { 0% { opacity: 0; transform: translateY(3px); } 40% { opacity: 0.9; } 100% { opacity: 0; transform: translateY(-5px); } }
                ${S} .mcfo-nook-ribbon { position: absolute; right: 26px; width: 12px; height: 84px; pointer-events: none;
                    background: linear-gradient(90deg, #8a1a22, #b3202a 50%, #8a1a22); clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 86%, 0 100%); opacity: 0.85; }`,
            decor: [
                { cls: 'mcfo-nook-tag', host: () => role('top-status-region'), html: 'Just one more chapter.' },
                { cls: 'mcfo-nook-cup', host: () => document.querySelector('.mcf-chat__header'), html: TEACUP_SVG },
                // The ribbon hangs from the lower edge of the cover (the chat header).
                { cls: 'mcfo-nook-ribbon', host: () => document.querySelector('.mcf-chat'), html: '',
                  place: (el, host) => { const h = host.querySelector('.mcf-chat__header'); if (h) el.style.top = (h.offsetTop + h.offsetHeight) + 'px'; } },
            ],
            particles: [fairyLights(() => role('action-region'))],
            tile: A => `background: radial-gradient(circle at 20% 22%, #ffd68c 0 2px, rgba(255, 214, 140, 0.35) 3px, transparent 6px), radial-gradient(circle at 42% 30%, #ffbe6e 0 2px, rgba(255, 190, 110, 0.35) 3px, transparent 6px),
                        radial-gradient(circle at 64% 22%, #ffecbe 0 2px, rgba(255, 236, 190, 0.35) 3px, transparent 6px), radial-gradient(circle at 86% 30%, #ffaa78 0 2px, rgba(255, 170, 120, 0.35) 3px, transparent 6px),
                        url("${A.stack}") 12% 100% / auto 70% no-repeat, linear-gradient(90deg, transparent 0 52%, #f6eedb 52% 92%, #cdbd98 92% 93%, transparent 93%) 0 100% / 100% 62% no-repeat,
                        linear-gradient(180deg, #3a2419, #24160f); box-shadow: inset 0 0 0 2px #8a6a44;`,
        }),
    });

    // =========================================================================================
    // 3g. MUSIC (6.18)
    // =========================================================================================
    // Six bands, each recognisable from its look rather than its logo: no logos, covers, photos or
    // fonts of the originals and no lyrics (Greasy Fork code rules: copyright). Colours, motifs and
    // lettering are drawn here; the lines on the plaques are our own.
    const HEAVY_FONT = '"Helvetica Neue", "Arial Black", "Archivo Black", "Helvetica", Arial, sans-serif';

    // Spray paint: blobs with satellite dots and the odd drip running down.
    function splatSvg(seed, w, h, cols, n, a = 1) {
        const r = seeded(seed);
        let s = '';
        for (let i = 0; i < n; i++) {
            const x = r() * w, y = r() * h, rad = 6 + r() * 16, c = pickOf(r, cols);
            s += `<g fill="${c}" opacity="${(a * (0.55 + r() * 0.45)).toFixed(2)}">`;
            for (let k = 0; k < 5; k++) s += `<circle cx="${(x + (r() - 0.5) * rad).toFixed(1)}" cy="${(y + (r() - 0.5) * rad * 0.8).toFixed(1)}" r="${(rad * (0.3 + r() * 0.35)).toFixed(1)}"/>`;
            for (let k = 0; k < 16; k++) {
                const ang = r() * 6.283, dist = rad * (0.7 + r() * 1.8);
                s += `<circle cx="${(x + Math.cos(ang) * dist).toFixed(1)}" cy="${(y + Math.sin(ang) * dist).toFixed(1)}" r="${(0.6 + r() * rad * 0.16).toFixed(1)}"/>`;
            }
            if (r() < 0.5) {
                const dx = x + (r() - 0.5) * rad, len = 12 + r() * 40, dw = 1.4 + r() * 2.4;
                s += `<rect x="${(dx - dw / 2).toFixed(1)}" y="${y.toFixed(1)}" width="${dw.toFixed(1)}" height="${len.toFixed(1)}" rx="${(dw / 2).toFixed(1)}"/><circle cx="${dx.toFixed(1)}" cy="${(y + len).toFixed(1)}" r="${(dw * 0.8).toFixed(1)}"/>`;
            }
            s += '</g>';
        }
        return svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">${s}</svg>`);
    }
    // A band of paint along the top edge with drips hanging from it.
    function dripSvg(seed, w, h, cols) {
        const r = seeded(seed);
        let s = '';
        for (let x = 0; x < w; x += 6 + r() * 14) {
            const c = pickOf(r, cols), dw = 2 + r() * 4, len = 4 + Math.pow(r(), 2) * (h - 8);
            s += `<g fill="${c}"><rect x="${x.toFixed(1)}" y="0" width="${dw.toFixed(1)}" height="${len.toFixed(1)}" rx="${(dw / 2).toFixed(1)}"/><circle cx="${(x + dw / 2).toFixed(1)}" cy="${len.toFixed(1)}" r="${(dw * 0.62).toFixed(1)}"/></g>`;
        }
        return svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><rect width="${w}" height="3" fill="${cols[0]}"/>${s}</svg>`);
    }
    // Brackets drawn as four background layers: [ on the left, ] on the right.
    const bracketBg = (c, t = 2, arm = 7) => [
        `linear-gradient(${c}, ${c}) left top / ${t}px 100% no-repeat`, `linear-gradient(${c}, ${c}) left top / ${arm}px ${t}px no-repeat`,
        `linear-gradient(${c}, ${c}) left bottom / ${arm}px ${t}px no-repeat`, `linear-gradient(${c}, ${c}) right top / ${t}px 100% no-repeat`,
        `linear-gradient(${c}, ${c}) right top / ${arm}px ${t}px no-repeat`, `linear-gradient(${c}, ${c}) right bottom / ${arm}px ${t}px no-repeat`].join(', ');
    // A word as an SVG, squeezed to an exact width (system fonts differ too much to trust).
    const wordSvg = (txt, w, h, c, font, weight = 900, extra = '') => svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">`
        + `<text x="0" y="${(h * 0.86).toFixed(1)}" textLength="${w}" lengthAdjust="spacingAndGlyphs" font-family='${font}' font-weight="${weight}" font-size="${h}" fill="${c}" ${extra}>${txt}</text></svg>`);
    // Pupils that look at the pointer: every `sel` element is an eye, its <b> the iris.
    const lookAt = (sel, kx = 0.2, ky = 0.14) => (x, y) => {
        for (const e of document.querySelectorAll(sel)) {
            const r = e.getBoundingClientRect();
            if (!r.width) continue;
            const dx = x - (r.left + r.width / 2), dy = y - (r.top + r.height / 2), d = Math.hypot(dx, dy) || 1, k = Math.min(1, d / 160);
            e.style.setProperty('--dx', (dx / d * k * r.width * kx).toFixed(1) + 'px');
            e.style.setProperty('--dy', (dy / d * k * r.height * ky * 2).toFixed(1) + 'px');
        }
    };

    // ---- Die Ärzte ----
    const AE_ORANGE = '#ff4e00', AE_MAGENTA = '#c3099b';
    // The white of the bloodshot eye: pinkish corners, red veins creeping in from both sides.
    function veinsSvg(seed) {
        const r = seeded(seed);
        let s = '';
        for (let i = 0; i < 16; i++) {
            const left = r() < 0.5;
            let x = left ? 4 + r() * 30 : 196 - r() * 30, y = 30 + r() * 40, d = `M${x.toFixed(1)} ${y.toFixed(1)}`;
            const steps = 3 + Math.floor(r() * 4), w = (0.5 + r() * 1.1).toFixed(2);
            for (let k = 0; k < steps; k++) {
                x += (left ? 1 : -1) * (5 + r() * 9); y += (r() - 0.5) * 10;
                d += `L${x.toFixed(1)} ${y.toFixed(1)}`;
                if (r() < 0.35) s += `<path d="M${x.toFixed(1)} ${y.toFixed(1)}l${((left ? 1 : -1) * (3 + r() * 6)).toFixed(1)} ${((r() - 0.5) * 12).toFixed(1)}" stroke="#c0141c" stroke-width="${(w * 0.6).toFixed(2)}" fill="none" opacity=".7"/>`;
            }
            s += `<path d="${d}" stroke="#b3131b" stroke-width="${w}" fill="none" stroke-linecap="round" opacity=".8"/>`;
        }
        return svgUrl('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100" preserveAspectRatio="none"><defs>'
            + '<radialGradient id="w" cx=".5" cy=".5" r=".6"><stop offset=".45" stop-color="#f6f1ea"/><stop offset=".8" stop-color="#e9c9bd"/><stop offset="1" stop-color="#c98a7a"/></radialGradient></defs>'
            + `<rect width="200" height="100" fill="url(#w)"/>${s}</svg>`);
    }
    const AE_EYE = '<i class="mcfo-ae-eye"><b></b></i>';
    // The iris of the tour poster: rust red streaks, a black pupil with a golden crescent of light.
    const aeEyeCss = (S, fx, A) => `
        ${S} .mcfo-ae-eye { position: relative; display: block; flex: none; overflow: hidden; clip-path: ellipse(50% 40% at 50% 50%);
            background: url("${A.veins}") center / 100% 100% no-repeat; box-shadow: inset 0 0 12px rgba(90, 20, 15, 0.6); }
        ${S} .mcfo-ae-eye b { position: absolute; left: 50%; top: 50%; width: 42%; aspect-ratio: 1; border-radius: 50%;
            translate: calc(-50% + var(--dx, 0px)) calc(-50% + var(--dy, 0px)); transition: translate 0.12s ease-out;
            background: radial-gradient(circle, #0a0a0a 0 31%, transparent 32%), radial-gradient(circle, transparent 58%, rgba(40, 12, 10, 0.9) 70%),
                        repeating-conic-gradient(#8a2a1a 0 4deg, #c0502e 4deg 7deg, #5a1a12 7deg 10deg), #7a2414; }
        ${S} .mcfo-ae-eye b::after { content: ''; position: absolute; inset: 33%; border-radius: 50%; box-shadow: inset -2px 1px 0 #e8b64a; }
        ${S} .mcfo-ae-eye::after { content: ''; position: absolute; inset: 0; background: linear-gradient(180deg, rgba(60, 20, 15, 0.45), transparent 30%, transparent 75%, rgba(60, 20, 15, 0.35)); }
        ${fx(['full', 'subtle'], '.mcfo-ae-eye')} { animation: mcfoAeBlink 7s ease-in-out infinite; }
        @keyframes mcfoAeBlink { 0%, 94%, 100% { scale: 1 1; } 96.5% { scale: 1 0.06; } }`;
    // Pills: the doctors' band gets capsules, orange and magenta, tumbling through the footer.
    function pillDraw(g, p, now) {
        g.save(); g.translate(p.x, p.y); g.rotate(p.a + now / 1000 * p.spin); g.globalAlpha = 0.85;
        const l = p.s, w = p.s * 0.42;
        g.fillStyle = p.c1; g.beginPath(); g.arc(-l / 2 + w / 2, 0, w / 2, Math.PI / 2, Math.PI * 1.5); g.lineTo(0, -w / 2); g.lineTo(0, w / 2); g.fill();
        g.fillStyle = p.c2; g.beginPath(); g.arc(l / 2 - w / 2, 0, w / 2, -Math.PI / 2, Math.PI / 2); g.lineTo(0, w / 2); g.lineTo(0, -w / 2); g.fill();
        g.fillStyle = 'rgba(255, 255, 255, 0.45)'; g.fillRect(-l / 2 + w / 2, -w / 2 + 1.5, l - w, 1.4);
        g.restore();
    }

    // ---- Linkin Park ----
    const LP_YELLOW = '#f6d80a', LP_PINK = '#ff4f9a', LP_GREEN = '#36e27b';
    // A stencil dragonfly, sprayed in the rusty red of the early records.
    const dragonflySvg = c => svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 90"><g fill="${c}">`
        + '<path d="M62 24C44 12 16 10 6 17C0 22 8 30 26 31C40 32 54 29 62 27Z"/><path d="M78 24C96 12 124 10 134 17C140 22 132 30 114 31C100 32 86 29 78 27Z"/>'
        + '<path d="M62 33C46 36 22 44 16 52C12 58 22 60 36 55C48 50 58 42 62 36Z"/><path d="M78 33C94 36 118 44 124 52C128 58 118 60 104 55C92 50 82 42 78 36Z"/>'
        + '<circle cx="70" cy="17" r="6"/><ellipse cx="70" cy="31" rx="4.6" ry="8.5"/><path d="M68 41h4l-.6 46h-2.8z"/></g>'
        + '<g fill="none" stroke="rgba(255,240,220,.5)" stroke-width="1.1"><path d="M58 25C44 20 26 19 12 20M58 34C44 40 30 47 22 53M82 25C96 20 114 19 128 20M82 34C96 40 110 47 118 53"/></g>'
        + '<g fill="rgba(255,240,220,.35)"><rect x="68.6" y="50" width="2.8" height="1.4"/><rect x="68.6" y="58" width="2.8" height="1.4"/><rect x="68.6" y="66" width="2.8" height="1.4"/><rect x="68.6" y="74" width="2.8" height="1.4"/></g></svg>');
    function mistDraw(g, p, now) {
        const a = Math.max(0, Math.min(1, p.life)) * 0.55;
        glowDot(g, p.x, p.y, p.s * 2.4, p.c, a * 0.5);
        g.globalAlpha = a; g.fillStyle = `rgb(${p.c})`; g.beginPath(); g.arc(p.x, p.y, p.s * 0.45, 0, Math.PI * 2); g.fill();
    }

    Object.assign(SKINS, {
        // ---- Die Ärzte: HELL and DUNKEL, and the eye of the next tour ----
        // Everything splits in two along one diagonal: white with fat orange letters, black with
        // magenta. The chat opens under a bloodshot eye that follows your pointer and blinks.
        aerzte: deluxe({
            assets: () => ({
                veins: veinsSvg(2027),
                hell: wordSvg('HELL', 84, 30, AE_ORANGE, HEAVY_FONT), dunkel: wordSvg('DUNKEL', 118, 30, AE_MAGENTA, HEAVY_FONT),
                bigHell: wordSvg('HELL', 440, 110, 'rgba(255, 78, 0, 0.22)', HEAVY_FONT), bigDunkel: wordSvg('DUNKEL', 640, 110, 'rgba(195, 9, 155, 0.3)', HEAVY_FONT),
            }),
            kit: A => ({
                titleCss: `font-family: ${HEAVY_FONT}; font-weight: 900; letter-spacing: -0.02em; text-transform: lowercase;`,
                ground: `url("${A.bigHell}") 2% 70px / 420px 104px no-repeat, url("${A.bigDunkel}") 72% calc(100% - 66px) / 610px 104px no-repeat, linear-gradient(115deg, #f4f1ec 0 50%, #0d0d0d 50.05%)`,
                header: { bg: 'linear-gradient(90deg, #ffffff 0 50%, #111111 50%)', border: `4px solid ${AE_ORANGE}`, extra: `box-shadow: 0 4px 0 ${AE_MAGENTA} !important;` },
                cards: { bg: '#111111', border: '2px solid #111111', radius: '0', shadow: `3px 3px 0 ${AE_ORANGE}` },
                footer: { bg: 'linear-gradient(180deg, rgba(0, 0, 0, 0.35), rgba(0, 0, 0, 0.2)), repeating-linear-gradient(115deg, #c8102e 0 16px, #ffffff 16px 24px, #1f8a7a 24px 40px, #ffffff 40px 48px)',
                          border: '4px solid #111111', extra: 'isolation: isolate;' },
                chat: {
                    bg: '#fbfaf7', border: '3px solid #111111', radius: '0', pad: '92px 0 0', shadow: `6px 6px 0 ${AE_MAGENTA}`,
                    head: '#111111', headBorder: `4px solid ${AE_ORANGE}`, headText: '#ffffff',
                    body: 'transparent', comp: '#efece5', compBorder: '3px solid #111111',
                    input: { bg: '#ffffff', border: '2px solid #111111', color: '#111111', radius: '0', hint: '#8a7f7a' },
                },
                btn: { bg: '#111111', color: '#ffffff', border: '0', radius: '0', shadow: `3px 3px 0 ${AE_ORANGE}`,
                       hover: `background: ${AE_MAGENTA} !important; box-shadow: 3px 3px 0 ${AE_ORANGE} !important;`,
                       extra: `font-family: ${HEAVY_FONT}; font-weight: 900; text-transform: uppercase; letter-spacing: 0;` },
                filled: { radius: '0', border: '2px solid #111111', shadow: '3px 3px 0 #111111' },
                popup: { bg: '#111111', border: `2px solid ${AE_ORANGE}`, radius: '0', hover: 'rgba(195, 9, 155, 0.5)', head: AE_ORANGE, shadow: `6px 6px 0 ${AE_MAGENTA}` },
                win: { border: '3px solid #111111', radius: '0', shadow: `8px 8px 0 ${AE_ORANGE}`, head: 'linear-gradient(90deg, #ffffff 0 50%, #111111 50%)', headBorder: `3px solid ${AE_MAGENTA}`, title: AE_ORANGE },
                panel: { radius: '0', border: '#444444', pressed: AE_ORANGE },
            }),
            extra: (S, A, fx) => lightChatCss(S, '#111111', '#7a6a66') + aeEyeCss(S, fx, A) + `
                ${S} .mcf-chat__header .mcf-chat__title strong { color: ${AE_ORANGE} !important; }
                ${S} .mcf-chat__header .mcf-chat__status { color: #bbbbbb !important; }
                ${S} .mcf-chat__send { background: ${AE_ORANGE} !important; color: #111111 !important; border-radius: 0 !important; font-weight: 900 !important; }
                ${S} [data-role="action-region"] > .mcfo-skin-canvas { z-index: -1; }
                ${S} .mcfo-ae-lid { position: absolute; top: 0; left: 0; right: 0; height: 92px; pointer-events: none; overflow: hidden;
                    background: radial-gradient(ellipse at 50% 50%, #7a3a2a, #3a1610 70%, #1a0a08); border-bottom: 3px solid #111111; }
                ${S} .mcfo-ae-lid .mcfo-ae-eye { position: absolute; left: 50%; top: 50%; width: 170px; height: 84px; transform: translate(-50%, -50%); }
                ${S} .mcfo-ae-top { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); display: flex; align-items: center; gap: 10px; pointer-events: none; }
                ${S} .mcfo-ae-top > span { display: block; height: 26px; background: center / 100% 100% no-repeat; }
                ${S} .mcfo-ae-top > span:first-child { width: 72px; background-image: url("${A.hell}"); }
                ${S} .mcfo-ae-top > span:last-child { width: 102px; background-image: url("${A.dunkel}"); }
                ${S} .mcfo-ae-top .mcfo-ae-eye { width: 64px; height: 34px; outline: 2px solid #111111; }`,
            decor: [
                { cls: 'mcfo-ae-lid', host: () => document.querySelector('.mcf-chat'), html: AE_EYE },
                { cls: 'mcfo-ae-top', host: () => role('top-status-region'), html: `<span></span>${AE_EYE}<span></span>` },
            ],
            pointer: lookAt('.mcfo-ae-eye'),
            particles: [
                drifters('pills', () => role('action-region'), 9,
                    (w, h, any) => ({ x: any ? rnd(0, w) : -20, y: rnd(10, h - 10), v: rnd(18, 40), a: rnd(0, 6), spin: rnd(-1.6, 1.6), s: rnd(12, 18),
                                      c1: pickOf(Math.random, [AE_ORANGE, AE_MAGENTA, '#ffffff']), c2: pickOf(Math.random, [AE_MAGENTA, '#111111', AE_ORANGE]) }),
                    (p, dt, now, w, h) => { p.x += p.v * dt; p.y += Math.sin(now / 600 + p.a) * 8 * dt; return p.x < w + 20; },
                    pillDraw),
            ],
            tile: A => `background: radial-gradient(circle at 50% 50%, #0a0a0a 0 4px, #8a2a1a 5px 9px, transparent 10px), radial-gradient(24px 12px at 50% 50%, #f6f1ea 96%, transparent 100%),
                        linear-gradient(115deg, ${AE_ORANGE} 0 50%, ${AE_MAGENTA} 50%); box-shadow: inset 0 0 0 2px #111111;`,
        }),

        // ---- Linkin Park: sepia concrete and spray paint, then black, white and yellow ----
        // Two eras in one: the ground is a weathered wall with a stencil sprayed on it, pink and
        // green paint everywhere; the chat and the frames are the stark black and yellow of now,
        // and every button sits in [brackets].
        lpark: deluxe({
            assets: () => ({
                splat: splatSvg(2000, 520, 380, [LP_PINK, LP_GREEN, LP_PINK], 12, 0.5), splatDark: splatSvg(2024, 360, 120, [LP_PINK, LP_GREEN], 7, 0.35),
                drips: dripSvg(8, 300, 40, [LP_PINK, LP_GREEN, LP_YELLOW]), fly: dragonflySvg('#6a1c16'), flyLight: dragonflySvg('rgba(20, 16, 12, 0.55)'), grain: grainSvg(0.16),
            }),
            kit: A => ({
                titleCss: `font-family: ${CONDENSED_FONT}; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em;`,
                ground: `url("${A.flyLight}") 50% 44% / 38vmin auto no-repeat, url("${A.splat}") 0 0 / 520px 380px, url("${A.grain}") 0 0 / 180px 180px,
                         radial-gradient(ellipse at 50% 40%, #857c68, #5a5344 70%, #3a352c)`,
                header: { bg: `url("${A.splatDark}") 0 0 / 360px 100% repeat-x, #0b0b0b`, border: `3px solid ${LP_YELLOW}` },
                cards: { bg: `${bracketBg(LP_YELLOW)}, #0b0b0b`, border: '0', radius: '0', shadow: 'none' },
                footer: { bg: `url("${A.drips}") 0 0 / 300px 40px repeat-x, #0b0b0b`, border: `3px solid ${LP_YELLOW}`, extra: 'isolation: isolate;' },
                chat: {
                    bg: `url("${A.splatDark}") 0 100% / 360px 120px repeat-x, #0e0e0e`, border: `2px solid ${LP_YELLOW}`, radius: '0', pad: '70px 0 0',
                    head: LP_YELLOW, headBorder: '0', headText: '#0b0b0b',
                    body: 'transparent', comp: '#0b0b0b', compBorder: `2px solid ${LP_YELLOW}`,
                    input: { bg: '#161616', border: '1px solid #444444', color: '#ffffff', radius: '0', hint: '#8a8a8a' },
                },
                btn: { bg: `${bracketBg('#ffffff')}, #0b0b0b`, color: '#ffffff', border: '0', radius: '0', shadow: 'none',
                       hover: `color: ${LP_YELLOW} !important; background: ${bracketBg(LP_YELLOW)}, #0b0b0b !important;`,
                       extra: `font-family: ${CONDENSED_FONT}; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em;` },
                filled: { radius: '0', border: '0', shadow: 'inset 0 -3px 0 rgba(0, 0, 0, 0.35)' },
                popup: { bg: '#0b0b0b', border: `2px solid ${LP_YELLOW}`, radius: '0', hover: 'rgba(255, 79, 154, 0.3)', head: LP_YELLOW, shadow: '0 12px 30px rgba(0, 0, 0, 0.7)' },
                win: { border: `2px solid ${LP_YELLOW}`, radius: '0', shadow: '0 16px 40px rgba(0, 0, 0, 0.7)', head: LP_YELLOW, headBorder: '0', title: '#0b0b0b' },
                panel: { radius: '0', border: '#555555', pressed: LP_YELLOW },
            }),
            extra: (S, A, fx) => `
                ${S} .mcf-chat__header :is(.mcf-chat__status, .mcf-chat__room) { color: #3a3200 !important; }
                ${S} .mcf-chat__header button { background: ${bracketBg('#0b0b0b')}, transparent !important; color: #0b0b0b !important; box-shadow: none !important; }
                ${S} .mcf-chat__send { background: ${bracketBg('#0b0b0b')}, ${LP_YELLOW} !important; color: #0b0b0b !important; border-radius: 0 !important; }
                ${S} [data-role="action-region"] > .mcfo-skin-canvas { z-index: -1; }
                ${S} .mcfo-lp-wall { position: absolute; top: 0; left: 0; right: 0; height: 70px; pointer-events: none; overflow: hidden;
                    background: url("${A.splat}") 30% 40% / 300px 220px, url("${A.grain}") 0 0 / 180px 180px, linear-gradient(180deg, #9a917b, #6f6857); border-bottom: 2px solid ${LP_YELLOW}; }
                ${S} .mcfo-lp-wall i { position: absolute; left: 50%; top: 50%; width: 112px; height: 66px; transform: translate(-50%, -50%) rotate(-4deg); background: url("${A.fly}") center / contain no-repeat; }
                ${fx(['full', 'subtle'], '.mcfo-lp-wall i')} { animation: mcfoLpHover 4s ease-in-out infinite alternate; }
                @keyframes mcfoLpHover { to { transform: translate(-50%, -58%) rotate(3deg); } }
                ${S} .mcfo-lp-tag { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); pointer-events: none; white-space: nowrap; padding: 3px 14px;
                    background: ${bracketBg(LP_YELLOW, 3, 9)}; font: 700 20px/1.1 ${CONDENSED_FONT}; letter-spacing: 0.12em; text-transform: uppercase; color: #ffffff; }`,
            decor: [
                { cls: 'mcfo-lp-wall', host: () => document.querySelector('.mcf-chat'), html: '<i></i>' },
                { cls: 'mcfo-lp-tag', host: () => role('top-status-region'), html: 'from the ground up' },
            ],
            particles: [
                // Spray mist from a can somewhere off to the left, drifting across the footer.
                drifters('mist', () => role('action-region'), 26,
                    (w, h, any) => ({ x: any ? rnd(0, w) : rnd(-30, 0), y: rnd(6, h - 6), v: rnd(20, 55), s: rnd(1.5, 4), life: any ? rnd(0.3, 1) : 1,
                                      c: pickOf(Math.random, ['255, 79, 154', '54, 226, 123', '246, 216, 10']) }),
                    (p, dt, now, w) => { p.x += p.v * dt; p.y += Math.sin(now / 500 + p.x / 40) * 4 * dt; p.life -= dt * 0.08; return p.x < w + 10 && p.life > 0; },
                    mistDraw),
            ],
            tile: A => `background: url("${A.fly}") 50% 50% / 44px 30px no-repeat, url("${A.splat}") 0 0 / 180px 130px, ${bracketBg(LP_YELLOW, 3, 8)}, #6f6857;
                        box-shadow: inset 0 0 0 1px #0b0b0b;`,
        }),
    });

    // ---- Kraftklub ----
    const KK_RED = '#e2231a', KK_YELLOW = '#ffd400', KK_BLUE = '#2a5caa';
    // The stripes of the cuffs and the jacket: black, red, white, grey, blue.
    const KK_STRIPES = `repeating-linear-gradient(180deg, #111111 0 6px, ${KK_RED} 6px 12px, #f4f4f0 12px 16px, #8a8a8a 16px 20px, ${KK_BLUE} 20px 26px)`;
    // A pen-drawn face around the eyes: a few black contour lines on red.
    const faceLinesSvg = () => svgUrl('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 96" preserveAspectRatio="none"><g fill="none" stroke="#111111" stroke-width="2.2" stroke-linecap="round">'
        + '<path d="M40 30C60 12 100 10 120 24"/><path d="M180 24C200 10 240 12 260 30"/><path d="M48 70C70 84 104 84 122 72"/><path d="M178 72C196 84 230 84 252 70"/>'
        + '<path d="M150 30C146 50 142 62 134 74M150 30C154 50 158 62 166 74" stroke-width="1.6"/><path d="M20 50C24 70 30 84 40 92M280 50C276 70 270 84 260 92" stroke-width="1.6"/>'
        + '<path d="M60 90C62 84 70 82 76 86M224 86C230 82 238 84 240 90" stroke-width="1.4"/></g></svg>');
    // A yellow ticket: notches on both short sides, a dashed tear line near the stub.
    const ticketBg = (c = KK_YELLOW) => `radial-gradient(circle at 0 50%, transparent 5px, ${c} 5.5px) left / 51% 100% no-repeat, radial-gradient(circle at 100% 50%, transparent 5px, ${c} 5.5px) right / 51% 100% no-repeat`;
    const KK_EYE = '<i class="mcfo-kk-eye"><b></b></i>';
    function ticketDraw(g, p, now) {
        g.save(); g.translate(p.x, p.y); g.rotate(p.a + Math.sin(now / 900 + p.ph) * 0.5); g.globalAlpha = 0.9;
        const w = p.s * 1.9, h = p.s;
        g.fillStyle = KK_YELLOW; g.fillRect(-w / 2, -h / 2, w, h);
        g.globalCompositeOperation = 'destination-out';
        g.beginPath(); g.arc(-w / 2, 0, h * 0.22, 0, Math.PI * 2); g.arc(w / 2, 0, h * 0.22, 0, Math.PI * 2); g.fill();
        g.globalCompositeOperation = 'source-over';
        g.fillStyle = '#111111'; g.fillRect(w * 0.18, -h / 2 + 2, 1, h - 4); g.fillRect(-w / 2 + 4, -h * 0.12, w * 0.5, 2); g.fillRect(-w / 2 + 4, h * 0.12, w * 0.34, 1.5);
        g.restore();
    }

    // ---- Goethes Erben ----
    const GE_CYAN = '140, 225, 255';
    // A white figure without a face: a head, shoulders, a torso, lit from one side.
    const figureSvg = (lit = '#eaf6ff', dark = '#6f9fc0') => svgUrl('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 70"><defs>'
        + `<linearGradient id="f" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${dark}"/><stop offset=".55" stop-color="${lit}"/><stop offset="1" stop-color="${dark}"/></linearGradient></defs>`
        + '<g fill="url(#f)"><ellipse cx="20" cy="10" rx="6.6" ry="8.2"/><path d="M17 17h6l1 4h-8z"/><path d="M8 24C12 20 28 20 32 24L36 36C37 48 33 60 31 70H9C7 60 3 48 4 36Z"/></g></svg>');
    // Lines of our own, cycling on the stage.
    const GE_LINES = ['Wer spricht, wenn alle schweigen?', 'Das Licht fällt, und keiner fängt es.', 'Wir tragen Masken aus Stille.'];
    function moteDraw(g, p, now) {
        const a = 0.25 + 0.35 * Math.sin(now / 900 + p.ph) ** 2;
        glowDot(g, p.x, p.y, p.s * 3, GE_CYAN, a * 0.5);
        g.globalAlpha = a; g.fillStyle = '#e6f8ff'; g.beginPath(); g.arc(p.x, p.y, p.s * 0.5, 0, Math.PI * 2); g.fill();
    }

    Object.assign(SKINS, {
        // ---- Kraftklub: black, white and red, stripes, yellow tickets, matchstick eyes ----
        // The chat opens under a pen-drawn face with two wide eyes, a matchstick for a pupil,
        // looking wherever your pointer goes. The buttons are tickets, the footer the stripes.
        kraftklub: deluxe({
            assets: () => ({ face: faceLinesSvg(), grain: grainSvg(0.1) }),
            kit: A => ({
                titleCss: `font-family: ${HEAVY_FONT}; font-weight: 900; text-transform: uppercase; letter-spacing: 0.06em;`,
                ground: `radial-gradient(circle, rgba(0, 0, 0, 0.13) 0 1.3px, transparent 1.8px) 0 0 / 9px 9px, radial-gradient(ellipse at 50% 45%, #ea2c20, #c81a12 70%, #9a120c)`,
                header: { bg: `${KK_STRIPES} 0 100% / 100% 8px no-repeat, #f4f4f0`, border: '3px solid #111111' },
                cards: { bg: '#111111', border: '2px solid #111111', radius: '0', shadow: `3px 3px 0 ${KK_RED}` },
                footer: { bg: `linear-gradient(180deg, rgba(0, 0, 0, 0.45), rgba(0, 0, 0, 0.25)), ${KK_STRIPES}`, border: '3px solid #111111', extra: 'isolation: isolate;' },
                chat: {
                    bg: `url("${A.grain}") 0 0 / 180px 180px, #fbfbf8`, border: '3px solid #111111', radius: '0', pad: '96px 0 0', shadow: '6px 6px 0 #111111',
                    head: '#111111', headBorder: `4px solid ${KK_RED}`, headText: '#ffffff',
                    body: 'transparent', comp: '#f0f0ea', compBorder: '3px solid #111111',
                    input: { bg: '#ffffff', border: '2px solid #111111', color: '#111111', radius: '0', hint: '#888888' },
                },
                btn: { bg: ticketBg(), color: '#111111', border: '0', radius: '2px', shadow: 'none',
                       hover: 'filter: brightness(1.08) drop-shadow(0 0 6px rgba(255, 212, 0, 0.7));',
                       extra: `font-family: ${HEAVY_FONT}; font-weight: 900; text-transform: uppercase; letter-spacing: 0.04em; padding-inline: 12px;` },
                filled: { radius: '2px', border: '2px solid #111111', shadow: '2px 2px 0 #111111' },
                popup: { bg: '#111111', border: `2px solid ${KK_YELLOW}`, radius: '0', hover: 'rgba(226, 35, 26, 0.55)', head: KK_YELLOW, shadow: `6px 6px 0 ${KK_RED}` },
                win: { border: '3px solid #111111', radius: '0', shadow: '8px 8px 0 #111111', head: KK_RED, headBorder: '3px solid #111111', title: '#ffffff' },
                panel: { radius: '0', border: '#555555', pressed: KK_YELLOW },
            }),
            extra: (S, A, fx) => lightChatCss(S, '#111111', '#777777') + `
                ${S} .mcf-chat__header .mcf-chat__status { color: #bbbbbb !important; }
                ${S} .mcf-chat__header button { background: #f4f4f0 !important; color: #111111 !important; border-radius: 0 !important; }
                ${S} .mcf-chat__send { background: ${ticketBg()} !important; color: #111111 !important; font-weight: 900 !important; }
                ${S} [data-role="action-region"] > .mcfo-skin-canvas { z-index: -1; }
                ${S} .mcfo-kk-face { position: absolute; top: 0; left: 0; right: 0; height: 96px; pointer-events: none; overflow: hidden;
                    background: url("${A.face}") center / 100% 100% no-repeat, ${KK_RED}; border-bottom: 3px solid #111111;
                    display: flex; align-items: center; justify-content: center; gap: 34px; }
                ${S} .mcfo-kk-eye { position: relative; display: block; flex: none; width: 74px; height: 40px; border-radius: 50%; background: #ffffff; border: 3px solid #111111; }
                ${S} .mcfo-kk-eye b { position: absolute; left: 50%; top: 50%; width: 38px; height: 38px; border-radius: 50%;
                    translate: calc(-50% + var(--dx, 0px)) calc(-50% + var(--dy, 0px)); transition: translate 0.12s ease-out;
                    background: radial-gradient(circle, transparent 0 58%, #111111 60% 66%, transparent 68%), radial-gradient(circle, #dbe7ee, #a9c2d0); clip-path: circle(50%); }
                                ${S} .mcfo-kk-eye::after { content: ''; position: absolute; left: 50%; top: 50%; width: 7px; height: 60px; border-radius: 4px 4px 1px 1px; filter: drop-shadow(0 0 0.6px #111111) drop-shadow(0 0 0.6px #111111);
                    translate: calc(-50% + var(--dx, 0px)) calc(-50% + var(--dy, 0px)); transition: translate 0.12s ease-out;
                    background: radial-gradient(ellipse 4.6px 6.4px at 50% 6.5px, #c0281e 0 70%, #5a0e0a 72% 88%, transparent 92%), linear-gradient(180deg, transparent 0 11px, #efe6d2 11px); box-shadow: none; }
                                ${S} .mcfo-kk-ticket { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%) rotate(-2deg); pointer-events: none; white-space: nowrap;
                    padding: 4px 20px 4px 26px; background: ${ticketBg()}; color: #111111; font: 900 15px/1.2 ${HEAVY_FONT}; letter-spacing: 0.08em; text-transform: uppercase; }
                ${S} .mcfo-kk-ticket::before { content: ''; position: absolute; left: 16px; top: 3px; bottom: 3px; border-left: 1.5px dashed #111111; }`,
            decor: [
                { cls: 'mcfo-kk-face', host: () => document.querySelector('.mcf-chat'), html: KK_EYE + KK_EYE },
                { cls: 'mcfo-kk-ticket', host: () => role('top-status-region'), html: 'Einlass 19:00 · Chemnitz' },
            ],
            pointer: lookAt('.mcfo-kk-eye', 0.16, 0.1),
            particles: [
                drifters('tickets', () => role('action-region'), 8,
                    (w, h, any) => ({ x: rnd(10, w - 10), y: any ? rnd(0, h) : h + 16, v: rnd(10, 22), a: rnd(-0.6, 0.6), ph: rnd(0, 6), s: rnd(10, 15) }),
                    (p, dt, now) => { p.y -= p.v * dt; p.x += Math.sin(now / 700 + p.ph) * 14 * dt; return p.y > -16; },
                    ticketDraw),
            ],
            tile: A => `background: radial-gradient(circle at 20% 55%, #a9c2d0 0 5px, #111111 5.5px 7px, transparent 7.5px), radial-gradient(circle at 44% 55%, #a9c2d0 0 5px, #111111 5.5px 7px, transparent 7.5px),
                        radial-gradient(15px 9px at 20% 55%, #ffffff 90%, #111111 92% 100%, transparent 102%), radial-gradient(15px 9px at 44% 55%, #ffffff 90%, #111111 92% 100%, transparent 102%),
                        ${KK_STRIPES} 0 100% / 100% 10px no-repeat, ${KK_RED}; box-shadow: inset 0 0 0 2px #111111;`,
        }),

        // ---- Goethes Erben: a dark theatre, cyan light, faceless white figures ----
        // Light falls in cones from the corners of the stage onto figures without faces; a line of
        // verse (our own) fades in and out above it all. Dust drifts in the light of the footlights.
        goethe: deluxe({
            assets: () => ({ fig: figureSvg(), figDim: figureSvg('#9cc6e4', '#2c4f6e') }),
            kit: A => {
                const rays = (at, from) => `repeating-conic-gradient(from ${from}deg at ${at}, rgba(${GE_CYAN}, 0.11) 0 1.6deg, transparent 1.6deg 5deg)`;
                return {
                    titleCss: `font-family: ${BOOK_SERIF}; font-weight: 700; letter-spacing: 0.04em;`,
                    ground: `radial-gradient(circle at 12% 104%, rgba(${GE_CYAN}, 0.35), transparent 14%), radial-gradient(circle at 88% -4%, rgba(${GE_CYAN}, 0.25), transparent 12%),
                             radial-gradient(circle at 12% 104%, transparent 0, rgba(3, 9, 22, 0.25) 45%, rgba(3, 9, 22, 0.9) 85%), ${rays('12% 104%', 0)},
                             radial-gradient(circle at 88% -4%, transparent 0, rgba(3, 9, 22, 0.4) 40%, rgba(3, 9, 22, 0.95) 80%), ${rays('88% -4%', 2)},
                             radial-gradient(ellipse at 50% 50%, #0b1e44, #050d1f 70%, #02060f)`,
                    header: { bg: 'linear-gradient(180deg, #02060f, #071430)', border: `1px solid rgba(${GE_CYAN}, 0.6)`, extra: `box-shadow: 0 0 18px rgba(${GE_CYAN}, 0.18) !important;` },
                    cards: { bg: 'rgba(3, 9, 22, 0.85)', border: `1px solid rgba(${GE_CYAN}, 0.45)`, radius: '0', shadow: `0 0 10px rgba(${GE_CYAN}, 0.15)` },
                    footer: { bg: `radial-gradient(ellipse at 50% 0, rgba(${GE_CYAN}, 0.22), transparent 60%), repeating-linear-gradient(90deg, rgba(0, 0, 0, 0.35) 0 1px, transparent 1px 90px), linear-gradient(180deg, #0c1c38, #040a18)`,
                              border: `1px solid rgba(${GE_CYAN}, 0.6)`, extra: 'isolation: isolate;' },
                    chat: {
                        bg: `radial-gradient(ellipse at 50% 0, rgba(${GE_CYAN}, 0.16), transparent 55%), linear-gradient(180deg, #071430, #040a18)`, border: `1px solid rgba(${GE_CYAN}, 0.55)`, radius: '0', pad: '96px 0 0',
                        shadow: `0 0 24px rgba(${GE_CYAN}, 0.12)`,
                        head: '#02060f', headBorder: `1px solid rgba(${GE_CYAN}, 0.5)`, headText: '#e8f4ff',
                        body: 'transparent', comp: '#02060f', compBorder: `1px solid rgba(${GE_CYAN}, 0.4)`,
                        input: { bg: '#050d1f', border: `1px solid rgba(${GE_CYAN}, 0.35)`, color: '#e8f4ff', radius: '0', hint: '#6f8aa8' },
                    },
                    btn: { bg: '#02060f', color: '#dff3ff', border: `1px solid rgba(${GE_CYAN}, 0.6)`, radius: '0', shadow: `0 0 10px rgba(${GE_CYAN}, 0.18)`,
                           hover: `box-shadow: 0 0 16px rgba(${GE_CYAN}, 0.6) !important; color: #ffffff !important;`,
                           extra: `font-family: ${BOOK_SERIF}; font-weight: 700; font-variant: small-caps; letter-spacing: 0.1em;` },
                    filled: { radius: '0', border: `1px solid rgba(${GE_CYAN}, 0.7)`, shadow: `0 0 8px rgba(${GE_CYAN}, 0.25)` },
                    popup: { bg: '#030a1a', border: `1px solid rgba(${GE_CYAN}, 0.6)`, radius: '0', hover: `rgba(${GE_CYAN}, 0.14)`, head: '#bfeaff', shadow: '0 12px 30px rgba(0, 0, 0, 0.7)' },
                    win: { border: `1px solid rgba(${GE_CYAN}, 0.6)`, radius: '0', shadow: `0 0 30px rgba(${GE_CYAN}, 0.15), 0 16px 40px rgba(0, 0, 0, 0.7)`, head: 'linear-gradient(180deg, #02060f, #071430)',
                           headBorder: `1px solid rgba(${GE_CYAN}, 0.5)`, title: '#e8f4ff' },
                    panel: { radius: '0', border: '#2c4f6e', pressed: '#8ce1ff' },
                };
            },
            extra: (S, A, fx) => `
                ${S} [data-role="action-region"] > .mcfo-skin-canvas { z-index: -1; }
                ${S} .mcfo-ge-stage { position: absolute; top: 0; left: 0; right: 0; height: 96px; pointer-events: none; overflow: hidden;
                    background: radial-gradient(ellipse at 50% 100%, rgba(${GE_CYAN}, 0.3), transparent 60%), #02060f; border-bottom: 1px solid rgba(${GE_CYAN}, 0.5); }
                ${S} .mcfo-ge-stage::before { content: ''; position: absolute; left: 50%; top: -10px; width: 180px; height: 120px; translate: -50% 0;
                    background: linear-gradient(180deg, rgba(${GE_CYAN}, 0.42), rgba(${GE_CYAN}, 0.05)); clip-path: polygon(44% 0, 56% 0, 100% 100%, 0 100%); }
                ${fx(['full', 'subtle'], '.mcfo-ge-stage::before')} { animation: mcfoGeSweep 9s ease-in-out infinite alternate; }
                @keyframes mcfoGeSweep { from { rotate: -14deg; } to { rotate: 14deg; } }
                ${S} .mcfo-ge-stage i { position: absolute; bottom: 0; width: 34px; height: 60px; background: url("${A.figDim}") center bottom / contain no-repeat; }
                ${S} .mcfo-ge-stage i:nth-child(1) { left: 18%; height: 52px; } ${S} .mcfo-ge-stage i:nth-child(3) { right: 18%; height: 54px; }
                ${S} .mcfo-ge-stage i:nth-child(2) { left: 50%; translate: -50% 0; width: 42px; height: 74px; background-image: url("${A.fig}"); filter: drop-shadow(0 0 8px rgba(${GE_CYAN}, 0.6)); }
                ${S} .mcfo-ge-verse { position: absolute; left: 50%; top: 50%; width: 360px; height: 30px; transform: translate(-50%, -50%); pointer-events: none; }
                ${S} .mcfo-ge-verse span { position: absolute; inset: 0; text-align: center; white-space: nowrap; opacity: 0;
                    font: italic 400 19px/30px ${BOOK_SERIF}; color: #e8f4ff; text-shadow: 0 0 10px rgba(${GE_CYAN}, 0.8); }
                ${S} .mcfo-ge-verse span:first-child { opacity: 1; }
                ${fx(['full', 'subtle'], '.mcfo-ge-verse span')} { opacity: 0; animation: mcfoGeVerse 18s ease-in-out infinite; }
                ${fx(['full', 'subtle'], '.mcfo-ge-verse span:nth-child(2)')} { animation-delay: 6s; }
                ${fx(['full', 'subtle'], '.mcfo-ge-verse span:nth-child(3)')} { animation-delay: 12s; }
                @keyframes mcfoGeVerse { 0% { opacity: 0; } 6%, 28% { opacity: 1; } 34%, 100% { opacity: 0; } }`,
            decor: [
                { cls: 'mcfo-ge-stage', host: () => document.querySelector('.mcf-chat'), html: '<i></i><i></i><i></i>' },
                { cls: 'mcfo-ge-verse', host: () => role('top-status-region'), html: GE_LINES.map(l => `<span>${l}</span>`).join('') },
            ],
            particles: [
                drifters('motes', () => role('action-region'), 22,
                    (w, h, any) => ({ x: rnd(0, w), y: any ? rnd(0, h) : h + 4, v: rnd(3, 9), ph: rnd(0, 6), s: rnd(1, 2.4) }),
                    (p, dt, now) => { p.y -= p.v * dt; p.x += Math.sin(now / 1500 + p.ph) * 5 * dt; return p.y > -6; },
                    moteDraw),
            ],
            tile: A => `background: url("${A.fig}") 50% 100% / 18px 32px no-repeat, linear-gradient(180deg, rgba(${GE_CYAN}, 0.35), transparent) 50% 0 / 30px 100% no-repeat,
                        radial-gradient(ellipse at 50% 100%, rgba(${GE_CYAN}, 0.3), transparent 60%), #050d1f; box-shadow: inset 0 0 0 1px rgba(${GE_CYAN}, 0.6);`,
        }),
    });

    // ---- Samsas Traum ----
    const ST_PAPER = '#e6dcc2', ST_INK = '#14110e', ST_BRASS = '#8a7a58';
    const ST_HATCH = 'repeating-linear-gradient(45deg, rgba(233, 225, 204, 0.045) 0 1px, transparent 1px 6px), repeating-linear-gradient(-45deg, rgba(233, 225, 204, 0.03) 0 1px, transparent 1px 7px)';
    // A beetle seen from above, drawn in ink, legs in two tripods so it can walk (Kafka's Gregor).
    const BEETLE_SVG = '<svg viewBox="-2 -4 66 48"><g stroke="#14110e" stroke-width="1.6" stroke-linecap="round" fill="none">'
        + '<g class="ga"><path d="M40 13L46 5L51 3"/><path d="M22 11L16 3L11 1"/><path d="M31 30L31 38L35 41"/></g>'
        + '<g class="gb"><path d="M31 10L31 2L35 -1"/><path d="M40 27L46 35L51 37"/><path d="M22 29L16 37L11 39"/></g>'
        + '<path d="M54 18Q60 10 59 3M54 22Q60 30 59 37" stroke-width="1.1"/></g>'
        + '<ellipse cx="26" cy="20" rx="16" ry="11" fill="#2a2016" stroke="#14110e" stroke-width="1.2"/>'
        + '<g stroke="rgba(233,225,204,.28)" stroke-width=".7" fill="none"><path d="M12 20H42"/><path d="M14 14Q26 11 40 14M14 26Q26 29 40 26M17 11Q26 9 36 11M17 29Q26 31 36 29"/></g>'
        + '<ellipse cx="44" cy="20" rx="6" ry="8" fill="#1e1710" stroke="#14110e"/><circle cx="52" cy="20" r="3.6" fill="#14110e"/></svg>';
    const CANDLE = '<i class="mcfo-st-candle"><b></b></i>';
    function bubbleDraw(g, p, now) {
        g.globalAlpha = 0.55; g.strokeStyle = '#b9d6e6'; g.lineWidth = 1;
        g.beginPath(); g.arc(p.x + Math.sin(now / 500 + p.ph) * 2, p.y, p.s, 0, Math.PI * 2); g.stroke();
        g.globalAlpha = 0.5; g.fillStyle = '#e6f4ff'; g.beginPath(); g.arc(p.x - p.s * 0.35, p.y - p.s * 0.35, p.s * 0.25, 0, Math.PI * 2); g.fill();
    }

    // ---- Prinz Pi ----
    const PP_LILA = '#674E85', PP_DEEP = '#22194F', PP_LIGHT = '#b7a6d6', PP_CREAM = '#efe9f7';
    // A compass with no north: E, S and W are there (O, S, W in German), the top stays empty and the
    // needle keeps swinging without ever settling.
    const COMPASS_SVG = '<svg viewBox="-24 -24 48 48"><circle r="21" fill="#22194F" stroke="#efe9f7" stroke-width="1.5"/><circle r="17" fill="none" stroke="rgba(239,233,247,.35)" stroke-width=".8"/>'
        + '<g stroke="#efe9f7" stroke-width="1"><path d="M17 0h3M-17 0h-3M0 17v3"/><path d="M12 12l2 2M-12 12l-2 2M12 -12l2 -2M-12 -12l-2 -2" stroke-width=".7"/></g>'
        + '<g fill="#efe9f7" font-family="Georgia, serif" font-size="8" font-weight="700" text-anchor="middle"><text x="11.5" y="2.8">O</text><text x="0" y="15">S</text><text x="-11.5" y="2.8">W</text></g>'
        + '<g class="mcfo-pp-needle"><path d="M0 -15L3.6 0L0 15L-3.6 0Z" fill="#efe9f7"/><path d="M0 -15L3.6 0H-3.6Z" fill="#c24b6e"/><circle r="1.6" fill="#22194F"/></g></svg>';
    // A record: grooves, a lilac label, the spindle hole.
    const vinylBg = (label = PP_LILA) => `radial-gradient(circle, #0c0a12 0 3%, ${label} 3.5% 30%, #1a1426 31% 33%, transparent 33.5%),
        repeating-radial-gradient(circle, #141018 0 1.2px, #221c2c 1.2px 2.6px), #141018`;
    function noteDraw(g, p, now) {
        g.save(); g.translate(p.x, p.y); g.rotate(Math.sin(now / 800 + p.ph) * 0.25); g.globalAlpha = 0.75;
        g.fillStyle = p.c; g.strokeStyle = p.c; g.lineWidth = 1.4;
        g.beginPath(); g.ellipse(0, 0, p.s * 0.55, p.s * 0.4, -0.4, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.moveTo(p.s * 0.5, -0.2); g.lineTo(p.s * 0.5, -p.s * 2.2); g.quadraticCurveTo(p.s * 1.3, -p.s * 1.7, p.s * 1.1, -p.s * 1.1); g.stroke();
        g.restore();
    }

    Object.assign(SKINS, {
        // ---- Samsas Traum: an etched plate, ink, a beetle, candles and deep water ----
        // The chat is an old engraving on yellowed paper in a double frame; across its top a beetle
        // crawls from one edge to the other. Candles burn beside the plaque, bubbles rise below.
        samsa: deluxe({
            assets: () => ({ grain: grainSvg(0.2) }),
            kit: A => ({
                titleCss: `font-family: ${BOOK_SCRIPT}; font-weight: 400; font-size: 1.45em; text-transform: none; letter-spacing: 0.01em;`,
                ground: `${ST_HATCH}, radial-gradient(ellipse at 50% 12%, rgba(255, 179, 71, 0.1), transparent 30%), radial-gradient(ellipse at 50% 40%, #1d3c52, #0b1620 62%, #05080c)`,
                header: { bg: `${ST_HATCH}, #0d0b09`, border: `3px double ${ST_BRASS}` },
                cards: { bg: '#0d0b09', border: `1px solid ${ST_BRASS}`, radius: '0', shadow: 'inset 0 0 0 3px #0d0b09, inset 0 0 0 4px #4a4030' },
                footer: { bg: `${ST_HATCH}, radial-gradient(ellipse at 50% 0, rgba(80, 140, 170, 0.25), transparent 60%), linear-gradient(180deg, #16303f, #08131b)`,
                          border: `3px double ${ST_BRASS}`, extra: 'isolation: isolate;' },
                chat: {
                    bg: `url("${A.grain}") 0 0 / 180px 180px, radial-gradient(ellipse at 50% 45%, transparent 55%, rgba(90, 60, 25, 0.28)), ${ST_PAPER}`,
                    border: `3px double ${ST_INK}`, radius: '0', pad: '84px 0 0', shadow: `0 0 0 4px #0d0b09, 0 0 0 5px ${ST_BRASS}`,
                    head: ST_INK, headBorder: `3px double ${ST_BRASS}`, headText: ST_PAPER,
                    body: 'transparent', comp: '#ddd1b3', compBorder: `1px solid ${ST_BRASS}`,
                    input: { bg: '#f1e9d4', border: `1px solid ${ST_BRASS}`, color: ST_INK, radius: '0', hint: '#8a7a60' },
                },
                btn: { bg: ST_INK, color: ST_PAPER, border: `1px solid ${ST_BRASS}`, radius: '0', shadow: 'inset 0 0 0 2px #14110e, inset 0 0 0 3px #4a4030',
                       hover: 'color: #ffcf7a !important; box-shadow: inset 0 0 0 2px #14110e, inset 0 0 0 3px #b8a87e, 0 0 12px rgba(255, 179, 71, 0.35) !important;',
                       extra: `font-family: ${BOOK_SERIF}; font-weight: 700; font-variant: small-caps; letter-spacing: 0.08em;` },
                filled: { radius: '0', border: `1px solid ${ST_BRASS}`, shadow: 'inset 0 0 0 2px rgba(0, 0, 0, 0.35)' },
                popup: { bg: '#0d0b09', border: `3px double ${ST_BRASS}`, radius: '0', hover: 'rgba(255, 179, 71, 0.14)', head: '#e6c98a', shadow: '0 12px 30px rgba(0, 0, 0, 0.7)' },
                win: { border: `3px double ${ST_BRASS}`, radius: '0', shadow: '0 0 0 3px #0d0b09, 0 16px 40px rgba(0, 0, 0, 0.7)', head: `${ST_HATCH}, #0d0b09`, headBorder: `3px double ${ST_BRASS}`, title: '#e6c98a' },
                panel: { radius: '0', border: '#4a4030', pressed: '#e6c98a' },
            }),
            extra: (S, A, fx) => lightChatCss(S, '#1a140e', '#6a5a44') + `
                ${S} .mcf-chat__header .mcf-chat__status { color: #b8a87e !important; }
                ${S} .mcf-chat__send { background: ${ST_INK} !important; color: ${ST_PAPER} !important; border: 1px solid ${ST_BRASS} !important; border-radius: 0 !important; }
                ${S} [data-role="action-region"] > .mcfo-skin-canvas { z-index: -1; }
                ${S} .mcfo-st-plate { position: absolute; top: 0; left: 0; right: 0; height: 84px; pointer-events: none; overflow: hidden; container-type: inline-size;
                    background: repeating-linear-gradient(0deg, rgba(20, 17, 14, 0.14) 0 1px, transparent 1px 4px) 0 100% / 100% 30px no-repeat, url("${A.grain}") 0 0 / 180px 180px, #ddd1b3;
                    border-bottom: 3px double ${ST_INK}; }
                ${S} .mcfo-st-plate svg { position: absolute; left: 0; top: 34px; width: 62px; height: 45px; translate: 45cqw 0; overflow: visible; }
                ${S} .mcfo-st-plate svg g :is(.ga, .gb) { transform-origin: 30px 20px; }
                ${fx(['full', 'subtle'], '.mcfo-st-plate svg')} { animation: mcfoStWalk 34s linear infinite; }
                ${fx(['full', 'subtle'], '.mcfo-st-plate .ga')} { animation: mcfoStLegs 0.36s ease-in-out infinite alternate; }
                ${fx(['full', 'subtle'], '.mcfo-st-plate .gb')} { animation: mcfoStLegs 0.36s ease-in-out infinite alternate-reverse; }
                @keyframes mcfoStWalk { from { translate: -70px 0; } to { translate: calc(100cqw + 10px) 0; } }
                @keyframes mcfoStLegs { from { rotate: -7deg; } to { rotate: 7deg; } }
                ${S} .mcfo-st-plate::after { content: ''; position: absolute; left: 12px; right: 12px; top: 10px; height: 18px;
                    border-top: 1px solid rgba(20, 17, 14, 0.5); border-bottom: 1px solid rgba(20, 17, 14, 0.5); }
                ${S} .mcfo-st-top { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); display: flex; align-items: flex-end; gap: 12px; pointer-events: none; }
                ${S} .mcfo-st-top > span { white-space: nowrap; padding: 2px 16px 4px; background: ${ST_PAPER}; border: 3px double ${ST_INK};
                    box-shadow: 0 0 0 2px #0d0b09, 0 0 0 3px ${ST_BRASS}; font: 400 22px/1 ${BOOK_SCRIPT}; color: ${ST_INK}; }
                ${S} .mcfo-st-candle { position: relative; display: block; width: 8px; height: 22px; margin-bottom: -2px; border-radius: 1px;
                    background: linear-gradient(90deg, #cfc2a0, #f3ead2 50%, #bfb08a); }
                ${S} .mcfo-st-candle b { position: absolute; left: 50%; bottom: 100%; width: 8px; height: 13px; translate: -50% 1px; border-radius: 50% 50% 45% 45% / 60% 60% 40% 40%;
                    background: radial-gradient(ellipse at 50% 75%, #fff6c0, #ffb347 45%, rgba(255, 110, 30, 0.8) 70%, transparent 72%); box-shadow: 0 -2px 14px 4px rgba(255, 179, 71, 0.35); transform-origin: 50% 100%; }
                ${fx(['full', 'subtle'], '.mcfo-st-candle b')} { animation: mcfoStFlicker 1.7s ease-in-out infinite; }
                ${fx(['full', 'subtle'], '.mcfo-st-top .mcfo-st-candle:last-child b')} { animation-delay: -0.8s; }
                @keyframes mcfoStFlicker { 0%, 100% { scale: 1 1; rotate: 0deg; } 30% { scale: 0.9 1.12; rotate: -3deg; } 55% { scale: 1.05 0.94; rotate: 2deg; } 80% { scale: 0.95 1.06; rotate: -1deg; } }`,
            decor: [
                { cls: 'mcfo-st-plate', host: () => document.querySelector('.mcf-chat'), html: BEETLE_SVG },
                // "aus unruhigen Träumen": from the first sentence of Kafka's Metamorphosis (1915, public domain).
                { cls: 'mcfo-st-top', host: () => role('top-status-region'), html: `${CANDLE}<span>aus unruhigen Träumen</span>${CANDLE}` },
            ],
            particles: [
                drifters('bubbles', () => role('action-region'), 14,
                    (w, h, any) => ({ x: rnd(6, w - 6), y: any ? rnd(0, h) : h + 6, v: rnd(8, 20), ph: rnd(0, 6), s: rnd(1.5, 4) }),
                    (p, dt) => { p.y -= p.v * dt; return p.y > -8; },
                    bubbleDraw),
            ],
            tile: A => `background: radial-gradient(9px 6px at 45% 55%, #2a2016 90%, transparent 100%), radial-gradient(circle at 60% 55%, #14110e 0 3px, transparent 3.5px),
                        linear-gradient(0deg, transparent 30%, rgba(20, 17, 14, 0.3) 30% 31%, transparent 31%), ${ST_PAPER};
                        box-shadow: inset 0 0 0 3px #0d0b09, inset 0 0 0 4px ${ST_BRASS};`,
        }),

        // ---- Prinz Pi: rebel lilac, a spinning record, a compass without north ----
        // The ground is one huge record, the chat a sleeve with the record sliding out of it, the
        // buttons are record labels. In the header the compass needle never comes to rest.
        prinzpi: deluxe({
            assets: () => ({}),
            kit: A => ({
                titleCss: `font-family: ${GEO_FONT}; font-weight: 700; text-transform: uppercase; letter-spacing: 0.14em;`,
                ground: `radial-gradient(circle at 50% 52%, ${PP_LILA} 0 8vmin, #1a1426 8vmin 8.6vmin, transparent 8.8vmin),
                         repeating-radial-gradient(circle at 50% 52%, rgba(255, 255, 255, 0.035) 0 1px, transparent 1px 5px),
                         radial-gradient(circle at 50% 52%, #0e0a1e 0 64vmin, transparent 64.3vmin), radial-gradient(ellipse at 50% 50%, #33277a, ${PP_DEEP} 60%, #140f30)`,
                header: { bg: `linear-gradient(90deg, ${PP_DEEP}, ${PP_LILA} 50%, ${PP_DEEP})`, border: `2px solid ${PP_LIGHT}` },
                cards: { bg: 'rgba(20, 15, 48, 0.9)', border: `1px solid ${PP_LIGHT}`, radius: '999px', shadow: `0 0 0 2px ${PP_DEEP}` },
                footer: { bg: `repeating-radial-gradient(ellipse at 50% 900%, #141018 0 1.2px, #251e30 1.2px 3px)`, border: `2px solid ${PP_LIGHT}`, extra: 'isolation: isolate;' },
                chat: {
                    bg: `linear-gradient(180deg, rgba(103, 78, 133, 0.12), transparent 30%), ${PP_CREAM}`, border: `2px solid ${PP_LILA}`, radius: '6px', pad: '92px 0 0',
                    shadow: `0 0 0 3px ${PP_DEEP}, 0 10px 30px rgba(0, 0, 0, 0.5)`,
                    head: `linear-gradient(90deg, ${PP_DEEP}, ${PP_LILA})`, headBorder: `2px solid ${PP_LIGHT}`, headText: PP_CREAM,
                    body: 'transparent', comp: '#e2d9f0', compBorder: `1px solid ${PP_LIGHT}`,
                    input: { bg: '#ffffff', border: `1px solid ${PP_LIGHT}`, color: PP_DEEP, radius: '999px', hint: '#8a7aa8' },
                },
                btn: { bg: `radial-gradient(circle at 11px 50%, #0c0a12 0 2px, ${PP_CREAM} 2.5px 3.5px, transparent 4px), linear-gradient(180deg, #7d62a3, ${PP_LILA})`,
                       color: '#ffffff', border: `1px solid ${PP_LIGHT}`, radius: '999px', shadow: `0 0 0 2px ${PP_DEEP}, 0 0 0 3px rgba(183, 166, 214, 0.5)`,
                       hover: `filter: brightness(1.15); box-shadow: 0 0 0 2px ${PP_DEEP}, 0 0 14px rgba(183, 166, 214, 0.7) !important;`,
                       extra: `font-family: ${GEO_FONT}; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; padding-left: 20px;` },
                filled: { radius: '999px', border: '1px solid rgba(239, 233, 247, 0.8)', shadow: `0 0 0 2px ${PP_DEEP}` },
                popup: { bg: PP_DEEP, border: `1px solid ${PP_LIGHT}`, radius: '12px', hover: 'rgba(183, 166, 214, 0.2)', head: '#d8ccef', shadow: '0 12px 30px rgba(0, 0, 0, 0.6)' },
                win: { border: `2px solid ${PP_LIGHT}`, radius: '12px', shadow: `0 0 0 3px ${PP_DEEP}, 0 16px 40px rgba(0, 0, 0, 0.6)`, head: `linear-gradient(90deg, ${PP_LILA}, ${PP_DEEP})`,
                       headBorder: `2px solid ${PP_LIGHT}`, title: PP_CREAM },
                panel: { radius: '10px', border: '#5a4a80', pressed: PP_LIGHT },
            }),
            extra: (S, A, fx) => lightChatCss(S, PP_DEEP, '#7a6a98') + `
                ${S} .mcf-chat__header .mcf-chat__status { color: #cfc2ea !important; }
                ${S} .mcf-chat__send { background: ${PP_LILA} !important; color: #ffffff !important; border-radius: 999px !important; padding-left: revert !important; }
                ${S} .mcf-chat__header button { background: linear-gradient(180deg, #7d62a3, ${PP_LILA}) !important; padding-left: revert !important; }
                ${S} [data-role="action-region"] > .mcfo-skin-canvas { z-index: -1; }
                ${S} .mcfo-pp-deck { position: absolute; top: 0; left: 0; right: 0; height: 92px; pointer-events: none; overflow: hidden; border-radius: 4px 4px 0 0;
                    background: linear-gradient(180deg, #2e2466, ${PP_DEEP}); border-bottom: 2px solid ${PP_LIGHT}; }
                ${S} .mcfo-pp-deck i { position: absolute; left: 50%; top: -24px; width: 150px; height: 150px; translate: -50% 0; border-radius: 50%;
                    background: ${vinylBg()}; box-shadow: 0 0 0 1px #000000, 0 -4px 14px rgba(0, 0, 0, 0.6); }
                ${S} .mcfo-pp-deck i::after { content: ''; position: absolute; left: 50%; top: 40%; width: 12%; height: 5%; translate: -50% 0; background: ${PP_CREAM}; opacity: 0.8; border-radius: 1px; }
                ${fx(['full', 'subtle'], '.mcfo-pp-deck i')} { animation: mcfoPpSpin 1.8s linear infinite; }
                @keyframes mcfoPpSpin { to { rotate: 360deg; } }
                ${S} .mcfo-pp-deck b { position: absolute; left: 50%; top: 66px; width: 230px; height: 30px; translate: -50% 0; background: linear-gradient(180deg, ${PP_LILA}, #4a3868); border-top: 2px solid ${PP_LIGHT};
                    box-shadow: 0 -3px 8px rgba(0, 0, 0, 0.5); }
                ${S} .mcfo-pp-top { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); display: flex; align-items: center; gap: 12px; pointer-events: none; }
                ${S} .mcfo-pp-top svg { display: block; width: 50px; height: 50px; }
                ${S} .mcfo-pp-top .mcfo-pp-needle { transform-box: fill-box; transform-origin: center; rotate: 38deg; }
                ${fx(['full', 'subtle'], '.mcfo-pp-top .mcfo-pp-needle')} { animation: mcfoPpNeedle 11s ease-in-out infinite; }
                @keyframes mcfoPpNeedle { 0% { rotate: 38deg; } 18% { rotate: -62deg; } 33% { rotate: 140deg; } 52% { rotate: 96deg; } 68% { rotate: 214deg; } 84% { rotate: 170deg; } 100% { rotate: 398deg; } }
                ${S} .mcfo-pp-stereo { display: grid; place-items: center; width: 46px; height: 46px; border-radius: 50%; background: ${PP_CREAM}; color: ${PP_DEEP};
                    box-shadow: inset 0 0 0 2px ${PP_CREAM}, inset 0 0 0 3.5px ${PP_DEEP}; font: 800 7.5px/1 ${GEO_FONT}; letter-spacing: 0.04em; text-transform: uppercase; }`,
            decor: [
                { cls: 'mcfo-pp-deck', host: () => document.querySelector('.mcf-chat'), html: '<i></i><b></b>' },
                { cls: 'mcfo-pp-top', host: () => role('top-status-region'), html: `<span class="mcfo-pp-stereo">Stereo</span>${COMPASS_SVG}` },
            ],
            particles: [
                drifters('notes', () => role('action-region'), 10,
                    (w, h, any) => ({ x: rnd(10, w - 10), y: any ? rnd(0, h) : h + 16, v: rnd(10, 20), ph: rnd(0, 6), s: rnd(5, 8), c: pickOf(Math.random, [PP_LIGHT, PP_CREAM, '#c24b6e']) }),
                    (p, dt, now) => { p.y -= p.v * dt; p.x += Math.sin(now / 900 + p.ph) * 10 * dt; return p.y > -20; },
                    noteDraw),
            ],
            tile: A => `background: radial-gradient(circle at 50% 50%, #0c0a12 0 1.5px, ${PP_LILA} 2px 9px, #1a1426 9.5px 10.5px, transparent 11px),
                        repeating-radial-gradient(circle at 50% 50%, #141018 0 1px, #2a2236 1px 2.4px) 50% 50% / 52px 52px no-repeat,
                        radial-gradient(circle at 50% 50%, #000000 0 26px, transparent 26.5px), linear-gradient(135deg, ${PP_LILA}, ${PP_DEEP}); box-shadow: inset 0 0 0 1px ${PP_LIGHT};`,
        }),
    });

    // =========================================================================================
    // 4. KING TILE: NAME, GOLD, TOLL
    // =========================================================================================
    // Two sources for name and toll, on purpose:
    //   1. /api/king/snapshot?view=summary -> king.displayName, king.baseToll, king.capturedAtMs
    //      The truth, and available immediately on load.
    //   2. the chat lines                                     Instant, without waiting for a poll.
    // The poll alone would lag; the chat alone would be incomplete, because someone who reloads
    // has seen no lines at all. Chat is read from the text node, which still works when another
    // script has hidden the line with display:none.
    let kingState = { name: null, toll: null, at: 0 };
    let kingReported = false;

    function kingAnchor() {
        for (const r of KING_ANCHORS) { const el = role(r); if (el) return el; }
        return null;
    }

    function kingField(anchor, kind) {
        let el = anchor.querySelector(`:scope > .mcfo-king-field--${kind}`);
        if (el) return el;
        el = document.createElement('div');
        el.className = `mcfo-king-field mcfo-king-field--${kind}`;
        el.innerHTML = kind === 'name'
            ? '<span class="mcfo-name"></span>'
            : '<span class="mcfo-label">Toll:</span><span class="mcfo-value"></span>';
        anchor.appendChild(el);
        return el;
    }

    function drawKingFields() {
        const anchor = kingAnchor();
        if (!anchor) return;
        const clear = () => anchor.querySelectorAll(':scope > .mcfo-king-field').forEach(e => e.remove());

        if (!settings.kingName && !settings.kingToll) { clear(); return; }
        if (kingState.name === null && kingState.toll === null) { clear(); return; }
        // Name and toll have their own switches since 3.8; whichever is off loses its field.
        if (!settings.kingName) anchor.querySelector(':scope > .mcfo-king-field--name')?.remove();
        if (!settings.kingToll) anchor.querySelector(':scope > .mcfo-king-field--toll')?.remove();

        // Absolutely positioned inside the frame; were the frame static, the fields would stick
        // to the edge of the page instead.
        if (getComputedStyle(anchor).position === 'static') anchor.style.position = 'relative';

        const stale = (Date.now() - kingState.at > KING_POLL_MS * 2) ? '1' : '0';

        if (settings.kingName && kingState.name !== null) {
            const field = kingField(anchor, 'name');
            field.querySelector('.mcfo-name').textContent = kingState.name;
            field.setAttribute('data-mcfo-stale', stale);
        }
        if (settings.kingToll && kingState.toll !== null) {
            const field = kingField(anchor, 'toll');
            field.querySelector('.mcfo-value').textContent = String(kingState.toll);
            field.setAttribute('data-mcfo-stale', stale);
        }
    };

    function setKing(name, toll) {
        if (name) kingState.name = name;
        if (toll !== undefined && toll !== null) {
            const n = Number(toll);
            if (Number.isInteger(n) && n >= 0) kingState.toll = n;
        }
        kingState.at = Date.now();
        drawKingFields();
    }

    async function pollKing() {
        if (!settings.kingName && !settings.kingToll) return;
        try {
            const res = await fetch('/api/king/snapshot?view=summary', { credentials: 'include' });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const data = await res.json();
            const king = data && data.king;
            if (!king) throw new Error('no king in the response');
            setKing(king.displayName, king.baseToll);
        } catch (e) {
            // Report once, not on every attempt, or the console fills up within the hour.
            if (!kingReported) { kingReported = true; console.warn('[MarbleLuceFall] king snapshot unavailable:', e.message); }
        }
    }

    function readChat() {
        const list = document.querySelector('[data-role="chat-messages"], .mcf-chat__messages');
        if (!list) return;
        for (const msg of list.querySelectorAll('article.mcf-chat__message:not([data-mcfo-read])')) {
            msg.setAttribute('data-mcfo-read', '1');
            const text = (msg.querySelector('.mcf-chat__text') || msg).textContent || '';

            const crown = CROWN_PATTERN.exec(text);
            if (crown) {
                // The toll belonged to the previous king; showing it on would be worse than a gap.
                kingState.toll = null;
                setKing(crown[1].trim(), null);
                pollKing();   // pull the truth straight away (toll, exact spelling)
                continue;
            }

            const toll = TOLL_PATTERN.exec(text);
            if (toll) setKing((text.match(/^(.+?)\s+changed the Crown toll/i) || [])[1], toll[1]);
        }
    }

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
            + '<div class="mcfo-win__grip" title="Resize"></div>';
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
            } finally {
                frame.setAttribute('data-mcfo-ready', '1');
            }
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

    function resizeWindow(path, w) {
        const grip = w.el.querySelector('.mcfo-win__grip');
        let zieht = false, x0 = 0, y0 = 0, b0 = 0, h0 = 0;
        grip.addEventListener('pointerdown', e => {
            if (e.button !== 0) return;
            const r = w.el.getBoundingClientRect();
            x0 = e.clientX; y0 = e.clientY; b0 = r.width; h0 = r.height;
            zieht = true; grip.setPointerCapture(e.pointerId); e.preventDefault(); e.stopPropagation();
        });
        grip.addEventListener('pointermove', e => {
            if (!zieht) return;
            clampWindow(w.el, parseInt(w.el.style.left, 10) || 0, parseInt(w.el.style.top, 10) || 0,
                        b0 + (e.clientX - x0), h0 + (e.clientY - y0));
        });
        const stop = e => {
            if (!zieht) return;
            zieht = false;
            try { grip.releasePointerCapture(e.pointerId); } catch (err) {}
            saveWinState(path, { width: parseInt(w.el.style.width, 10), height: parseInt(w.el.style.height, 10) });
        };
        grip.addEventListener('pointerup', stop);
        grip.addEventListener('pointercancel', stop);
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
        style.textContent = `.mcfPageHeader, .mcfPageFooter, nav.mcfPageNav { display: none !important; }
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

    // =========================================================================================
    // 6. MENUS
    // =========================================================================================
    let openMenu = null;

    // Set just before a click that this script forwards to the game from inside an open panel,
    // so that one click does not close the panel it came from.
    let keepMenuOnce = false;

    function closeMenus() {
        if (!openMenu) return;
        openMenu.menu.remove();
        openMenu.anchor.removeAttribute('data-mcfo-open');
        openMenu = null;
        stopRebellionPopup();
    }

    // A box under an anchor. What goes inside is up to the caller: a list of buttons for the
    // account menu, the schedule itself for events.
    // place.centre: centred on the anchor and preferably above it — for the panels that open
    // from buttons at the bottom of the board (beverages, Rebellion), so they rise straight out of
    // the button that opened them. Without it: right-aligned under the anchor (account, events).
    function showPanel(anchor, extraClass, fill, place) {
        const wasOpen = openMenu && openMenu.anchor === anchor;
        closeMenus();
        if (wasOpen) return null;   // a second click closes it again

        const menu = document.createElement('div');
        menu.className = 'mcfo-menu' + (extraClass ? ' ' + extraClass : '');
        fill(menu);
        menu._mcfoPlace = place || {};
        menu.addEventListener('click', ev => ev.stopPropagation());
        document.body.appendChild(menu);
        placePanel(anchor, menu);

        anchor.setAttribute('data-mcfo-open', '1');
        openMenu = { anchor, menu };
        return menu;
    }

    // Under the anchor, but never past the right edge of the window. Called again after the
    // events list has been filled in, because only then is its height known.
    function placePanel(anchor, menu) {
        const a = anchor.getBoundingClientRect();
        const m = menu.getBoundingClientRect();
        const centre = !!(menu._mcfoPlace && menu._mcfoPlace.centre);
        const wantLeft = centre ? a.left + a.width / 2 - m.width / 2 : a.right - m.width;
        menu.style.left = Math.round(Math.max(8, Math.min(wantLeft, innerWidth - m.width - 8))) + 'px';

        // Below by default, above when there is no room. The beverage buttons sit at the bottom
        // edge of the board, so a panel opening downwards was cut off — most of it ended up off
        // screen. Whichever side has more room wins when neither fits.
        const untenPlatz = innerHeight - a.bottom - 6;
        const obenPlatz  = a.top - 6;
        const nachOben   = centre
            ? (obenPlatz >= m.height || obenPlatz > untenPlatz)      // above unless it does not fit
            : (untenPlatz < m.height && obenPlatz > untenPlatz);   // below unless it does not fit
        menu.style.top = nachOben
            ? Math.round(Math.max(8, a.top - 6 - m.height)) + 'px'
            : Math.round(Math.min(a.bottom + 6, innerHeight - m.height - 8)) + 'px';
    }

    function showMenu(anchor, entries) {
        showPanel(anchor, null, menu => {
            for (const entry of entries) {
                if (entry.separator) { menu.appendChild(document.createElement('hr')); continue; }
                const b = document.createElement('button');
                b.type = 'button';
                b.textContent = entry.title;
                b.addEventListener('click', ev => { ev.stopPropagation(); closeMenus(); entry.run(); });
                menu.appendChild(b);
            }
        });
    }

    document.addEventListener('click', () => {
        if (keepMenuOnce) { keepMenuOnce = false; return; }
        closeMenus();
    });

    // Logged out, the account card is the game's only way in: its click signs you in with Twitch
    // (app.js launchTwitchSignIn → /auth/twitch/start). Our menu sits on that same card, so up to
    // 6.4.1 a logged-out player got Profile, Dailies and the rest — pages that need a login — and
    // no way to log in at all. Now the menu offers the game's sign-in instead.
    //
    // Which state it is the game writes on the card itself (renderShellIdentity): aria-disabled
    // "true" only while signed in with Twitch, "false" as a guest or when reading the session
    // failed. Before the game's first render the attribute is missing — then the normal menu, so
    // nobody who is signed in is offered a login.
    const SIGN_IN_PATH = '/auth/twitch/start';
    let passCardClick = false;

    function signedOut() {
        const card = role('profile-entry');
        return !!card && card.getAttribute('aria-disabled') === 'false';
    }

    // The game's own click on the card, the way it goes without this script. Why it was blocked
    // before: bindMenu listens in the capture phase on the card itself and stops propagation, and
    // under today's DOM rules that also skips the card's own bubbling listeners — the game's
    // sign-in among them. passCardClick lets this one click through. Should it lead nowhere within
    // a moment (a later build could handle the click elsewhere), straight to the address the game
    // would have opened.
    function signIn() {
        let leaving = false;
        const mark = () => { leaving = true; };
        addEventListener('beforeunload', mark, { once: true });
        addEventListener('pagehide', mark, { once: true });
        const card = role('profile-entry');
        if (card) {
            passCardClick = true;
            try { card.click(); } finally { passCardClick = false; }
        }
        setTimeout(() => { if (!leaving) location.assign(SIGN_IN_PATH); }, 500);
    }

    function accountEntries() {
        const entries = signedOut()
            ? [{ title: 'Log in with Twitch', run: signIn }]
            : ACCOUNT_MENU
                .filter(r => PAGES[r])
                .map(r => ({ title: PAGES[r].title, run: () => openPage(PAGES[r].path, PAGES[r].title) }));
        entries.push({ separator: true });
        entries.push({ title: 'Settings', run: showSettings });
        entries.push({ title: 'How to', run: showHowTo });
        entries.push({ title: 'Changelog', run: showChangelog });
        return entries;
    }

    // Events is not a page (/events is a 404) but a dialog of the game's. Instead of opening
    // that dialog we fetch the same schedule it feeds on and show it right under the tileset
    // card — one click less than going through a menu.
    //
    // The game asks with the default horizon of 180 minutes ("Next 3 hours"). Here it is a
    // choice: the same 3 hours, or the full 12 the endpoint allows, which typically turns one
    // entry into three.
    const tilesetName = id => String(id || '').replace(/([a-z0-9])([A-Z])/g, '$1 $2').trim() || '?';

    function durationText(ms) {
        const min = Math.max(0, Math.round(ms / 60000));
        if (min < 60) return `${min}m`;
        const h = Math.floor(min / 60), r = min % 60;
        return r ? `${h}h ${r}m` : `${h}h`;
    }

    function showEvents(anchor) {
        const hours = settings.eventsHours;
        const menu = showPanel(anchor, 'mcfo-menu--events', m => {
            m.innerHTML = `<div class="mcfo-events__head">Upcoming tilesets`
                + `<small>Next ${hours} hours</small></div>`
                + `<div class="mcfo-events__empty">Loading &hellip;</div>`;
        });
        if (!menu) return;   // was already open, and is now closed

        fetch(eventsUrl(hours), { credentials: 'include' })
            .then(r => r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)))
            .then(data => {
                // Only draw while this box is still open, or a late reply writes into a node
                // that was removed long ago.
                if (!menu.isConnected) return;
                const rows = (data && data.window && data.window.rows) || [];
                const now  = (data && data.window && data.window.nowUtcMs) || Date.now();
                menu.querySelector('.mcfo-events__empty')?.remove();

                if (!rows.length) {
                    const p = document.createElement('div');
                    p.className = 'mcfo-events__empty';
                    p.textContent = `Nothing scheduled in the next ${hours} hours.`;
                    menu.appendChild(p);
                } else {
                    const ul = document.createElement('ul');
                    ul.className = 'mcfo-events__list';
                    for (const row of rows) {
                        const li = document.createElement('li');
                        if (row.activeNow) li.setAttribute('data-mcfo-live', '1');
                        const until = row.startsAtUtcMs - now;
                        // When it starts, in the viewer's own time zone and date format — the
                        // browser knows both. How long until then is kept in the tooltip.
                        const start = new Date(row.startsAtUtcMs);
                        const end = new Date(row.startsAtUtcMs + (row.durationMs || 0));
                        const clock = d => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        const day = d => d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
                        const when = row.activeNow ? `live now, until ${clock(end)}`
                                   : until <= 0    ? 'any moment'
                                   :                 `${day(start)}, ${clock(start)}`;
                        const name = document.createElement('span');
                        name.className = 'mcfo-events__name';
                        name.textContent = tilesetName(row.tilesetId);
                        const time = document.createElement('span');
                        time.className = 'mcfo-events__when';
                        time.textContent = row.activeNow ? when : `${when}, lasts ${durationText(row.durationMs)}`;
                        if (until > 0) time.title = `starts in ${durationText(until)}`;
                        li.append(name, time);
                        ul.appendChild(li);
                    }
                    menu.appendChild(ul);
                }
                placePanel(anchor, menu);   // the height is only known now
            })
            .catch(e => {
                if (!menu.isConnected) return;
                const p = menu.querySelector('.mcfo-events__empty');
                if (p) p.textContent = 'Schedule unavailable: ' + e.message;
            });
    }

    function bindMenu(anchor, kind, open) {
        if (!anchor || anchor.getAttribute('data-mcfo-menu') === kind) return;
        anchor.setAttribute('data-mcfo-menu', kind);
        anchor.classList.add('mcfo-anchor');
        anchor.addEventListener('click', e => {
            if (passCardClick) return;   // a click this script hands on to the game (signIn)
            const on = kind === 'account' ? settings.accountMenu : settings.eventsPanel;
            if (!on) return;
            e.preventDefault();
            e.stopPropagation();
            open(anchor);
        }, true);
    }

    // =========================================================================================
    // 7. BEVERAGES BESIDE THE ATTACK BUTTON
    // =========================================================================================
    // Four buttons flanking the attack button — Water and Lava on the left, Milk and Acid on the
    // right — each opening the three sizes with BOTH prices, so the currency stays a choice the
    // way the game's own panel offers it. An earlier version bought gold-only straight from the
    // king tile; that took the decision away and put the controls somewhere they did not belong.
    //
    // NOTHING IS BOUGHT BY THIS SCRIPT. Every price forwards to the game's own button:
    //
    //   [data-action="king-beverage-activate"][data-beverage-type][data-size][data-currency]
    //
    // So every guard the game has keeps applying — the 15 s unlock at the start of a reign, the
    // balance, the once-per-currency-per-reign limit — and no request is assembled here. If the
    // panel is not mounted, it is opened, the button pressed, and closed again.
    //
    // Colours are the ones the bubbles actually have on the board
    // (KING_BEVERAGE_MARBLE_STYLES in renderLaneFrame.js), so a button looks like what it buys.
    const BEVERAGES = [
        { type: 'water', label: 'Water', side: 'left',  fill: '#2389da', stroke: '#9fd8ff', text: '#ffffff',
          gold: { small: 225, medium: 525, large: 1200 }, diamonds: { small: 40, medium: 70, large: 100 } },
        { type: 'lava',  label: 'Lava',  side: 'left',  fill: '#e34116', stroke: '#ffbd69', text: '#ffffff',
          gold: { small: 150, medium: 450, large: 1050 }, diamonds: { small: 35, medium: 65, large: 95 } },
        { type: 'milk',  label: 'Milk',  side: 'right', fill: '#f5f0dc', stroke: '#ffffff', text: '#182026',
          gold: { small: 180, medium: 600, large: 1350 }, diamonds: { small: 40, medium: 70, large: 100 } },
        { type: 'acid',  label: 'Acid',  side: 'right', fill: '#55c94d', stroke: '#c8ff80', text: '#ffffff',
          gold: { small: 180, medium: 600, large: 1350 }, diamonds: { small: 40, medium: 70, large: 100 } },
    ];
    const BEV_SIZES = [['small', 'Small'], ['medium', 'Medium'], ['large', 'Large']];
    const BEV_CURRENCIES = [['gold', 'Gold'], ['diamonds', 'Diamond']];

    // Which packages are still available. Read from the game, never guessed: /beverages/me lists
    // rights per type + size + currency, and state !== 'available' means spent. Read-only, costs
    // nothing. Both currencies are kept now, not just gold.
    const bevRights = new Map();
    let bevReported = false;

    // Pressed here, the answer not in yet: "type|size|currency" -> time of the click. The button
    // greys out at once instead of after the next poll and stays so until /beverages/me lists the
    // right as spent. Should the game refuse after all (the server said no), it comes back after
    // BEV_PENDING_MS. The game answers within a second as a rule, so it is asked a few times
    // right after a purchase instead of waiting for the 20 s poll.
    const bevPending = new Map();
    const BEV_PENDING_MS = 5000;
    const BEV_RECHECK_MS = [500, 1500, 3000];

    // true once the rights were read, false when the game did not answer.
    async function loadBevRights() {
        try {
            const res = await fetch('/api/king/beverages/me', { credentials: 'include', cache: 'no-store' });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const data = await res.json();
            for (const right of data?.rights || []) {
                bevRights.set(`${right.beverageType}|${right.size}|${right.currency}`, {
                    state: String(right.state || ''),
                    price: Number(right.price),
                });
            }
            return true;
        } catch (e) {
            if (!bevReported) { bevReported = true; console.warn('[MarbleLuceFall] beverage rights unavailable:', e.message); }
            return false;
        }
    }

    async function pollBeverages() {
        if (!settings.kingTray) return;
        await loadBevRights();
        // A click whose right is spent now (or in the game's own pending) needs no stand-in.
        for (const [key] of bevPending) {
            const right = bevRights.get(key);
            if (right && right.state !== 'available') bevPending.delete(key);
        }
        refreshBevPanel();
    }

    function nativeBeverageButton(type, size, currency) {
        return document.querySelector(
            `[data-action="king-beverage-activate"][data-beverage-type="${type}"]`
            + `[data-size="${size}"][data-currency="${currency}"]`);
    }

    // A click this script forwards to the game from inside one of its own panels. .click()
    // dispatches synchronously, so the flag is used up by our document listener on the way and
    // the panel stays open; reset afterwards in case the game stopped the click before that.
    function forwardClick(el) {
        keepMenuOnce = true;
        try { el.click(); } finally { keepMenuOnce = false; }
    }

    // Presses the game's button. done(true) once it was pressed; done(false) when the game's
    // button is greyed out (not unlocked yet, not enough gold) or not there at all.
    function buyBeverage(type, size, currency, done = () => {}) {
        const press = () => {
            const button = nativeBeverageButton(type, size, currency);
            if (!button) { console.warn('[MarbleLuceFall] no native beverage button for', type, size, currency); return null; }
            if (button.disabled) return false;   // the game says no, so we say no
            forwardClick(button);
            return true;
        };
        const settle = ok => {
            if (ok) for (const ms of BEV_RECHECK_MS) setTimeout(pollBeverages, ms);
            done(!!ok);
        };
        const first = press();
        if (first !== null) { settle(first); return; }

        // Panel not mounted: open it, press, close it again — the same route a person would take.
        const toggle = role('beverages-toggle');
        if (!toggle) { settle(false); return; }
        const wasOpen = toggle.getAttribute('aria-expanded') === 'true';
        if (!wasOpen) forwardClick(toggle);
        setTimeout(() => {
            settle(press());
            if (!wasOpen) setTimeout(() => forwardClick(toggle), 60);
        }, 350);
    }

    // One price button, drawn from what is known right now: when the panel opens, on a click,
    // and after every poll while the panel is open.
    function paintBevButton(buy) {
        const { bev, size, sizeLabel, currency, currencyLabel } = buy._mcfoBev;
        const key = `${bev.type}|${size}|${currency}`;
        const right = bevRights.get(key);
        const price = Number.isFinite(right?.price) ? right.price : bev[currency][size];
        const serverPending = right?.state === 'pending';
        const spent = !!right && right.state !== 'available' && !serverPending;
        const pending = !spent && (serverPending || bevPending.has(key));
        buy.textContent = `${currencyLabel} ${number(price)}${pending ? ' …' : ''}`;
        buy.disabled = spent || pending;
        buy.setAttribute('data-mcfo-state', spent ? 'spent' : pending ? 'pending' : 'ready');
        buy.title = spent ? `${bev.label} ${sizeLabel} — already bought with ${currencyLabel} this reign`
            : pending ? `${bev.label} ${sizeLabel} — activating …`
            : `Activate ${bev.label} ${sizeLabel} for ${number(price)} ${currencyLabel}`;
    }

    function refreshBevPanel() {
        if (!openMenu || !openMenu.menu.classList.contains('mcfo-menu--bev')) return;
        openMenu.menu.querySelectorAll('.mcfo-bev__buy').forEach(paintBevButton);
    }

    // The panel stays open after a purchase (6.4): Small, Medium and Large one after another are
    // three clicks, not three trips through the drink button. It closes like every panel of this
    // script — a click elsewhere, or on the drink button again.
    function showBeveragePanel(bev, anchor) {
        showPanel(anchor, 'mcfo-menu--bev', menu => {
            const head = document.createElement('div');
            head.className = 'mcfo-bev__head';
            head.textContent = bev.label;
            head.style.color = bev.stroke === '#ffffff' ? '#e8e2c8' : bev.stroke;
            menu.appendChild(head);

            for (const [size, sizeLabel] of BEV_SIZES) {
                const row = document.createElement('div');
                row.className = 'mcfo-bev__row';

                const name = document.createElement('span');
                name.className = 'mcfo-bev__size';
                name.textContent = sizeLabel;
                row.appendChild(name);

                for (const [currency, currencyLabel] of BEV_CURRENCIES) {
                    const buy = document.createElement('button');
                    buy.type = 'button';
                    buy.className = 'mcfo-bev__buy';
                    buy.setAttribute('data-mcfo-cur', currency);
                    buy._mcfoBev = { bev, size, sizeLabel, currency, currencyLabel };
                    paintBevButton(buy);
                    buy.addEventListener('click', e => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (buy.disabled) return;
                        const key = `${bev.type}|${size}|${currency}`;
                        const at = Date.now();
                        bevPending.set(key, at);
                        paintBevButton(buy);
                        buyBeverage(bev.type, size, currency, ok => {
                            if (!ok && bevPending.get(key) === at) bevPending.delete(key);
                            refreshBevPanel();
                        });
                        setTimeout(() => {
                            if (bevPending.get(key) !== at) return;
                            bevPending.delete(key);
                            refreshBevPanel();
                        }, BEV_PENDING_MS);
                    });
                    row.appendChild(buy);
                }
                menu.appendChild(row);
            }
        }, { centre: true });
    }

    // The tray content is replaced wholesale by the game on every king-state update
    //
    //     actionTray.innerHTML = hasContent ? html : '';      (kingPane.js)
    //
    // so anything put in here is deleted on the next one. Our buttons are ours, not moved
    // originals, and a watcher puts them back at once when the tray is rebuilt.
    // Symbols for the beverage buttons (6.12), in the colours the bubbles have on the board
    // (BEVERAGES). Each has a dark outline, so it reads on light and dark buttons alike, whatever
    // the theme makes of the button around it.
    const DRINK_ICONS = {
        water: '<svg class="mcfo-drink__icon" viewBox="0 0 24 24" aria-hidden="true">'
            + '<path d="M12 2.5C9.5 6.5 5.5 10.6 5.5 14.8a6.5 6.5 0 0 0 13 0C18.5 10.6 14.5 6.5 12 2.5Z" fill="#2389da" stroke="#0b2a44" stroke-width="1.3" stroke-linejoin="round"/>'
            + '<path d="M9 15.5a3 3 0 0 0 2.4 3" fill="none" stroke="#9fd8ff" stroke-width="1.6" stroke-linecap="round"/></svg>',
        lava: '<svg class="mcfo-drink__icon" viewBox="0 0 24 24" aria-hidden="true">'
            + '<path d="M12 3.5c.9 3.3 5.5 5.9 5.5 11a5.5 5.5 0 0 1-11 0c0-2.6 1.2-4.4 2.6-5.8.3 1.8 1.1 3 2.1 3.5-.1-3.6.3-6.3.8-8.7Z" fill="#e34116" stroke="#4a1204" stroke-width="1.3" stroke-linejoin="round"/>'
            + '<path d="M12 12.8c1 1.4 2.4 2.3 2.4 4.1a2.4 2.4 0 0 1-4.8 0c0-1.6 1.4-2.6 2.4-4.1Z" fill="#ffbd69"/></svg>',
        milk: '<svg class="mcfo-drink__icon" viewBox="0 0 24 24" aria-hidden="true">'
            + '<path d="M9.6 5h4.8l1.9 3.3c.4.7.7 1.5.7 2.3v9a1.6 1.6 0 0 1-1.6 1.6H8.6A1.6 1.6 0 0 1 7 20.6v-9c0-.8.3-1.6.7-2.3Z" fill="#f5f0dc" stroke="#39434a" stroke-width="1.3" stroke-linejoin="round"/>'
            + '<rect x="7.7" y="13.2" width="8.6" height="4" fill="#9fd8ff"/>'
            + '<rect x="9.1" y="2.2" width="5.8" height="2.8" rx="0.8" fill="#2389da" stroke="#39434a" stroke-width="1.1"/></svg>',
        acid: '<svg class="mcfo-drink__icon" viewBox="0 0 24 24" aria-hidden="true">'
            + '<path d="M7.8 13h8.4l2.4 4.9a2.3 2.3 0 0 1-2.1 3.4H7.4a2.3 2.3 0 0 1-2.1-3.4Z" fill="#55c94d"/>'
            + '<path d="M10.2 2.8v5.1L5.3 17.9a2.3 2.3 0 0 0 2.1 3.4h9.2a2.3 2.3 0 0 0 2.1-3.4L13.8 7.9V2.8" fill="none" stroke="#16330f" stroke-width="1.3" stroke-linejoin="round"/>'
            + '<path d="M9 2.8h6" stroke="#16330f" stroke-width="1.6" stroke-linecap="round"/>'
            + '<circle cx="10.5" cy="16.5" r="1.1" fill="#c8ff80"/><circle cx="13.6" cy="18.6" r="0.9" fill="#c8ff80"/><circle cx="12.6" cy="10.8" r="0.8" fill="#55c94d"/></svg>',
    };

    function buildKingTray() {
        document.documentElement.setAttribute('data-mcfo-tray', settings.kingTray ? '1' : '0');
        const content = document.querySelector('.mcf-king-action-content');

        if (!settings.kingTray) {
            document.querySelectorAll('.mcfo-stack').forEach(e => e.remove());
            return;
        }
        if (!content) return;
        // Already there in the look chosen: nothing to do. In the other look: built anew.
        const icons = settings.drinkIcons === 1;
        const have = content.querySelector('.mcfo-stack');
        if (have && have.getAttribute('data-mcfo-icons') === (icons ? '1' : '0')) return;
        content.querySelectorAll('.mcfo-stack').forEach(e => e.remove());

        for (const side of ['left', 'right']) {
            const stack = document.createElement('div');
            stack.className = 'mcfo-stack mcfo-stack--' + side;
            stack.setAttribute('data-mcfo-icons', icons ? '1' : '0');
            for (const bev of BEVERAGES.filter(b => b.side === side)) {
                const b = document.createElement('button');
                b.type = 'button';
                b.className = 'mcfo-drink';
                b.setAttribute('data-mcfo-drink', bev.type);
                if (icons) {
                    b.classList.add('mcfo-drink--icon');
                    b.innerHTML = DRINK_ICONS[bev.type];
                    b.title = bev.label;
                    b.setAttribute('aria-label', bev.label);
                } else {
                    b.textContent = bev.label;
                    b.style.background = bev.fill;
                    b.style.borderColor = bev.stroke;
                    b.style.color = bev.text;
                }
                b.addEventListener('click', e => {
                    e.preventDefault();
                    e.stopPropagation();
                    showBeveragePanel(bev, b);
                });
                stack.appendChild(b);
            }
            content.appendChild(stack);
        }
    }

    // The beverage buttons take the height of the attack button (6.20.3). Measured on the button
    // that is really shown — ours while "attack when free" is on, the game's otherwise, both carry
    // the game's class — and handed to the CSS as a variable. Besides the look, this keeps the
    // tray from growing: a beverage button taller than the attack button made the whole tray
    // taller than the one the game measured its column with, and the king tile ended up out of
    // line (see alignPanes).
    function syncDrinkHeight() {
        const content = document.querySelector('.mcf-king-action-content');
        if (!content) return;
        const attack = [...content.querySelectorAll('.mcf-king-attack-placeholder')]
            .find(b => b.getBoundingClientRect().height > 0);
        if (!attack) return;
        const h = Math.round(attack.getBoundingClientRect().height);
        if (h > 0 && content.style.getPropertyValue('--mcfo-drink-h') !== h + 'px') {
            content.style.setProperty('--mcfo-drink-h', h + 'px');
        }
    }

    function watchTray() {
        const tray = role('king-action-tray');
        if (!tray || tray.getAttribute('data-mcfo-watched') === '1') return;
        tray.setAttribute('data-mcfo-watched', '1');
        new MutationObserver(() => { buildKingTray(); buildAttackAssist(); syncDrinkHeight(); placeKingTray(); }).observe(tray, { childList: true, subtree: true });
    }

    // The king tile is fitted into its pane by scale and centred (kingPane.js syncKingTileFit:
    // min(width / 640, height / 1080)). In a pane taller than the tile needs, room is left above
    // and below it, while the tray stays at the bottom of the pane — the taller the screen, the
    // farther from the tile. It is lifted to sit TRAY_GAP under the tile, by translate (CSS above).
    // Measured again whenever the pane or the tray changes size, on every rebuild of the tray and
    // on the 1.5 s beat.
    const TRAY_GAP = 8;
    let trayResize = null;
    const trayObserved = new WeakSet();
    function placeKingTray() {
        document.documentElement.setAttribute('data-mcfo-traylift', settings.trayLift ? '1' : '0');
        const tray = role('king-action-tray');
        if (!tray) return;
        if (!settings.trayLift) { tray.style.removeProperty('--mcfo-tray-lift'); return; }
        if (!trayResize && typeof ResizeObserver === 'function') trayResize = new ResizeObserver(() => requestAnimationFrame(placeKingTray));
        for (const el of [role('king-viewport'), tray]) {
            if (el && trayResize && !trayObserved.has(el)) { trayObserved.add(el); trayResize.observe(el); }
        }
        const frame = role('king-tile-frame');
        const pane = role('king-pane');
        const now = parseFloat(tray.style.getPropertyValue('--mcfo-tray-lift')) || 0;
        let lift = 0;
        if (frame && pane && !tray.hidden) {
            const f = frame.getBoundingClientRect(), t = tray.getBoundingClientRect();
            // While the chat glides the pane is scaled (glideChat): screen pixels are then not the
            // pixels translate moves by, so both are brought back to the pane's own.
            const k = pane.offsetHeight ? pane.getBoundingClientRect().height / pane.offsetHeight : 1;
            if (f.height > 0 && t.height > 0 && k > 0) {
                const home = t.top + now * k;   // where the tray would be without the lift
                lift = Math.max(0, Math.round((home - f.bottom) / k - TRAY_GAP));
            }
        }
        if (Math.abs(lift - now) >= 1) tray.style.setProperty('--mcfo-tray-lift', lift + 'px');
    }

    // Chat height follows the board (6.13): half the room the lane tiles leave above them goes to
    // the chat as a margin at the top and at the bottom (CSS above). Measured on a lane: its svg is
    // sized to the tile's aspect inside the lane's viewport (layoutLaneViewport), so the room is
    // how far below the top of the chat's own column the svg begins. No fixed sizes anywhere:
    // whatever the window and the screen, the room is measured, and where the tiles fill the
    // height there is none. Skipped while the chat glides (the lanes are scaled for a moment).
    let chatResize = null;
    const chatObserved = new WeakSet();
    function placeChat() {
        document.documentElement.setAttribute('data-mcfo-chatfit', settings.chatFit ? '1' : '0');
        const pane = role('desktop-chat-pane');
        if (!pane) return;
        if (!settings.chatFit) { pane.style.removeProperty('--mcfo-chat-inset'); return; }
        if (document.querySelector('[data-mcfo-glide]')) return;
        const stage = [...document.querySelectorAll('[data-role="main-region"] [data-role="lane-stage"]')]
            .find(s => s.getBoundingClientRect().height > 0);
        if (!chatResize && typeof ResizeObserver === 'function') chatResize = new ResizeObserver(() => requestAnimationFrame(placeChat));
        for (const el of [stage, role('lane-play-region')]) {
            if (el && chatResize && !chatObserved.has(el)) { chatObserved.add(el); chatResize.observe(el); }
        }
        const now = parseFloat(pane.style.getPropertyValue('--mcfo-chat-inset')) || 0;
        const p = pane.getBoundingClientRect();
        let inset = 0;
        if (stage && p.height > 0) {
            const top = p.top - now;   // where the chat would start without the margin
            inset = Math.max(0, Math.round((stage.getBoundingClientRect().top - top) / 2));
        }
        if (Math.abs(inset - now) >= 1) pane.style.setProperty('--mcfo-chat-inset', inset + 'px');
    }

    // The game sizes its columns once on load and subtracts the height of the king's tray — which
    // is still empty then, 0px (app.js measureActionTrayHeight). Once it fills, the king column is
    // too wide, and its tile, centred above the tray, sticks out above the lanes until the next
    // refit (ninkasi, 15.09.: after every reload; a resize put it right). So a change of the
    // tray's height is a reason to refit, like a change of window size.
    //
    // An EMPTY tray is no reason (6.20.1). While a marble runs in the king tile the game empties
    // the tray (kingPane.js renderTray: innerHTML '', class lane-action-tray--empty), and a refit
    // then gave the king column the room of a pane without a tray: the tile jumped to the size of
    // the lanes and the bar was gone (Luce, 16.09.). Now the empty tray keeps the height it last
    // had when filled (--mcfo-tray-keep, CSS above), so nothing moves at all, and only a change
    // between two filled heights refits — the empty tray at load still counts as 0, so the fix of
    // 15.09. stays.
    let trayHeightSeen = null;   // the last FILLED height (0 while none was seen yet)
    let trayHeightWatch = null;
    function watchTrayHeight() {
        const tray = role('king-action-tray');
        if (!tray || trayHeightWatch || typeof ResizeObserver !== 'function') return;
        trayHeightWatch = new ResizeObserver(() => {
            const h = Math.round(tray.getBoundingClientRect().height);
            if (h === 0 || tray.classList.contains('lane-action-tray--empty')) {
                if (trayHeightSeen === null) trayHeightSeen = 0;
                return;
            }
            if (trayHeightSeen !== null && h !== trayHeightSeen) refitSoon();
            trayHeightSeen = h;
            tray.style.setProperty('--mcfo-tray-keep', h + 'px');
        });
        trayHeightWatch.observe(tray);
    }

    // The king column is viewport + tray (app.js computeActionAwareLaneGridColumns:
    // viewportHeight = availableHeight - measureActionTrayHeight). Measured in a moment when the
    // tray is empty — while a marble runs in the king tile — the viewport gets the full height:
    // the king tile ends up one tray taller than the lanes and its tray hangs below their bottom
    // edge (Luce, 16.09.). The game measures again only when the chat opens or closes, so a page
    // loaded in such a moment keeps it for the rest of the session. 6.20.1 keeps the empty tray
    // at its last filled height, which stops it from happening again; this puts right what is
    // already wrong, whenever it is found.
    //
    // A refit is two clicks on the game's chat toggle, so it is kept rare: at most one per
    // ALIGN_COOLDOWN_MS, and given up after ALIGN_MAX_TRIES. A mismatch the game itself cannot
    // resolve must not fold the chat every few seconds for ever.
    const ALIGN_TOLERANCE_PX = 3;
    const ALIGN_COOLDOWN_MS = 15000;
    const ALIGN_MAX_TRIES = 3;
    let alignAt = 0, alignTries = 0;
    function alignPanes() {
        if (!settings.boardRefit) return;
        const king = role('king-pane');
        const lane = document.querySelector('[data-role="main-region"] [data-role="lane-panel"]');
        if (!king || !lane) return;
        const mode = (role('shell') || { getAttribute: () => null }).getAttribute('data-layout-mode');
        if (mode && mode !== 'desktop') return;
        const k = king.getBoundingClientRect(), l = lane.getBoundingClientRect();
        if (!k.height || !l.height) return;
        const off = Math.round(k.bottom - l.bottom);
        if (Math.abs(off) <= ALIGN_TOLERANCE_PX) { alignTries = 0; return; }   // in line again
        const now = Date.now();
        if (alignTries >= ALIGN_MAX_TRIES || now - alignAt < ALIGN_COOLDOWN_MS) return;
        alignAt = now;
        alignTries++;
        console.log(`[MarbleLuceFall] king column ${Math.abs(off)}px ${off > 0 ? 'below' : 'above'} the lanes - having the game measure again`);
        refitSoon();
    }

    // =========================================================================================
    // 7b. ATTACK WHEN FREE (opt-in)
    // =========================================================================================
    // The game greys its attack button out while you are bidding (currently_bidding), while your
    // marble runs (currently_in_tile) or during a lava cooldown. This button does what the
    // MarbleMind bot's /attack does in that case, minus its points limit: sit out the lava
    // cooldown, send !unbid once, wait until the marble is free — and then press the GAME'S OWN
    // attack button. The attack itself is never rebuilt; it goes through the game's click handler
    // with every check the game makes there.
    //
    // It has to be a copy: a disabled button fires no click at all, so the game's own cannot be
    // intercepted while it is grey. The game also rewrites the whole tray (innerHTML) on every
    // state change, so the copy is re-inserted on each redraw, and the waiting state lives here,
    // not on the element.
    //
    // The source of truth is /api/king/me — the same call the game and the bot use. The game only
    // re-checks with growing pauses (up to 15 s) and gives up after a few tries; once we see
    // "free" we nudge it with the event its own chat sends after an unbid.
    const ASSIST_POLL_MS = 2500;
    const ASSIST_MAX_WAIT_MS = 5 * 60 * 1000;   // counted from the end of a lava cooldown, like the bot
    const ASSIST_LAVA_MAX_MS = 5 * 60 * 1000;
    const ASSIST_REBID_MS = 8000;              // a bid still/again there this long after the unbid
    const ASSIST_NATIVE_WAIT_MS = 10000;       // how long the game may take to release its button
    const ASSIST_DEAD_REASONS = ['current_king', 'not_logged_in', 'already_in_king_tile'];
    // Try again until King (6.20): after the press the attack is watched (phase 'watch'). The
    // server reports already_in_king_tile while the marble runs; once that is gone without the
    // crown, it was a miss, and the next try starts from the top: a lava cooldown after a pop is
    // sat out like any other, a fresh !unbid is allowed once per try.
    const ASSIST_SETTLE_MS = 10000;            // no run reported this long after the press: judged anyway
    const ASSIST_RUN_MAX_MS = 2 * 60 * 1000;   // an attack is over in seconds; this is only the lid
    const ASSIST_RETRY_GAP_MS = 8000;          // never two presses closer than this
    const assist = { active: false, phase: '', started: 0, clearStart: 0, unbidSent: false, unbidAt: 0,
                     lavaUntil: 0, timer: 0, note: '', noteUntil: 0,
                     tries: 0, pressedAt: 0, sawRun: false, lastPressAt: 0 };

    function nativeAttack() {
        const content = document.querySelector('.mcf-king-action-content');
        return content ? content.querySelector('[data-action="king-attack"]') : null;
    }
    const nativeEnabled = b => !!b && !b.disabled && b.getAttribute('aria-disabled') !== 'true';
    const nativeReasons = b => String((b && b.getAttribute('data-king-action-reasons')) || '').split(',').map(x => x.trim()).filter(Boolean);

    function buildAttackAssist() {
        document.documentElement.setAttribute('data-mcfo-attack', settings.attackAssist ? '1' : '0');
        const native = nativeAttack();
        let copy = document.querySelector('.mcfo-attack');
        if (!settings.attackAssist) {
            if (copy) copy.remove();
            if (assist.active) assistStop('');
            return;
        }
        if (!native) { if (copy) copy.remove(); return; }
        if (!copy || copy.previousElementSibling !== native) {
            if (copy) copy.remove();
            copy = document.createElement('button');
            copy.type = 'button';
            copy.className = 'mcf-king-attack-placeholder mcfo-attack';
            copy.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); assistClick(); });
            native.insertAdjacentElement('afterend', copy);
        }
        drawAttackAssist(copy, native);
    }

    function lavaLeft() {
        const s = Math.max(0, Math.ceil((assist.lavaUntil - Date.now()) / 1000));
        return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
    }

    // Only writes what changed — every write is a mutation, and the tray observer calls us back.
    function drawAttackAssist(copy, native) {
        let text, title, state = '', enabled = true;
        const noteOn = assist.note && Date.now() < assist.noteUntil;
        if (assist.active) {
            state = assist.phase === 'rebid' ? 'warn' : 'wait';
            text = { unbid: 'UNBIDDING\u2026', tile: 'WAITING: IN TILE', lava: 'WAITING: LAVA ' + lavaLeft(),
                     rebid: 'BID CAME BACK', attack: 'ATTACKING\u2026', watch: 'ATTACK RUNNING\u2026',
                     wait: 'WAITING\u2026' }[assist.phase] || 'WAITING\u2026';
            if (assist.tries > 1) text = 'TRY ' + assist.tries + ' \u00b7 ' + text;
            title = assist.phase === 'rebid'
                ? 'A bid came back after the unbid — is something bidding for you automatically? Click to cancel.'
                : settings.attackRetry
                    ? 'Attacking until you are King, try ' + assist.tries + '. Click to cancel.'
                    : 'Waiting until your marble is free, then attacking. Click to cancel.';
        } else if (noteOn) {
            state = 'warn'; text = assist.note; title = assist.note; enabled = false;
        } else if (nativeEnabled(native)) {
            text = (native.textContent || 'ATTACK').trim();
            title = settings.attackRetry ? 'Attack the throne, and again after every miss until you are King' : 'Attack the throne';
        } else if (nativeReasons(native).some(r => ASSIST_DEAD_REASONS.includes(r))) {
            text = (native.textContent || '').trim(); title = text; enabled = false;
        } else {
            text = settings.attackRetry ? 'ATTACK UNTIL KING' : 'ATTACK WHEN FREE';
            title = 'Unbids if needed, waits until your marble is free, then attacks'
                  + (settings.attackRetry ? ', and again after every miss until you are King' : '') + '. Click again to cancel.';
        }
        if (copy.textContent !== text) copy.textContent = text;
        if (copy.title !== title) copy.title = title;
        if (copy.disabled === enabled) copy.disabled = !enabled;
        if ((copy.getAttribute('data-mcfo-state') || '') !== state) {
            if (state) copy.setAttribute('data-mcfo-state', state); else copy.removeAttribute('data-mcfo-state');
        }
        copy.classList.toggle('mcf-king-attack-placeholder--enabled', enabled && !state);
    }

    function redrawAssist() {
        const copy = document.querySelector('.mcfo-attack');
        if (copy) drawAttackAssist(copy, nativeAttack());
    }

    function assistStop(note) {
        clearTimeout(assist.timer);
        Object.assign(assist, { active: false, phase: '', clearStart: 0, unbidSent: false, unbidAt: 0, lavaUntil: 0,
                                note: note || '', noteUntil: note ? Date.now() + 4000 : 0,
                                tries: 0, pressedAt: 0, sawRun: false });
        redrawAssist();
        if (note) setTimeout(redrawAssist, 4100);
    }

    function assistClick() {
        if (assist.active) { assistStop(''); return; }
        const native = nativeAttack();
        // Free already: the game's own click — and with "try again" the watching starts there.
        if (nativeEnabled(native) && !settings.attackRetry) { native.click(); return; }
        Object.assign(assist, { active: true, phase: 'wait', started: Date.now(), clearStart: 0,
                                unbidSent: false, unbidAt: 0, lavaUntil: 0, note: '', noteUntil: 0,
                                tries: 1, pressedAt: 0, sawRun: false });
        if (nativeEnabled(native)) { pressAttack(native); return; }
        redrawAssist();
        assistTick();
    }

    // The game's own attack click. Without "try again" that is the end of it; with it, the attack
    // is watched until it is over, and a miss starts the next try (assistTick).
    function pressAttack(native) {
        native.click();
        assist.lastPressAt = Date.now();
        if (!settings.attackRetry) { assistStop(''); return; }
        Object.assign(assist, { phase: 'watch', pressedAt: Date.now(), sawRun: false });
        redrawAssist();
        clearTimeout(assist.timer);
        assist.timer = setTimeout(assistTick, ASSIST_POLL_MS);
    }

    function nextTry(now) {
        Object.assign(assist, { phase: 'wait', tries: assist.tries + 1, started: now, clearStart: 0,
                                unbidSent: false, unbidAt: 0, lavaUntil: 0, pressedAt: 0, sawRun: false });
    }

    async function readKingMe() {
        try {
            const r = await fetch('/api/king/me', { credentials: 'include', cache: 'no-store' });
            return r.ok ? await r.json() : null;
        } catch (e) { return null; }
    }

    // The game re-reads eligibility on this event (kingPane.js onKingEligibilityInvalidated).
    // Sent from the page's own window and without detail, so Firefox's sandbox never gets between.
    function nudgeKingEligibility() {
        try { pageWindow.dispatchEvent(new pageWindow.CustomEvent('mcf:king-eligibility-invalidated')); }
        catch (e) { try { window.dispatchEvent(new CustomEvent('mcf:king-eligibility-invalidated')); } catch (e2) {} }
    }

    async function assistTick() {
        if (!assist.active) return;
        const me = await readKingMe();
        if (!assist.active) return;
        const now = Date.now();
        const reasons = me && Array.isArray(me.reasons) ? me.reasons : null;
        if (reasons) {
            if (reasons.includes('current_king')) { assistStop("YOU'RE THE KING"); return; }
            if (assist.phase === 'watch') {
                const running = reasons.includes('already_in_king_tile');
                if (running) assist.sawRun = true;
                const since = now - assist.pressedAt;
                const over = running ? since > ASSIST_RUN_MAX_MS : (assist.sawRun || since > ASSIST_SETTLE_MS);
                if (!over) { redrawAssist(); assist.timer = setTimeout(assistTick, ASSIST_POLL_MS); return; }
                if (running) { assistStop('ATTACK DID NOT END'); return; }
                nextTry(now);   // a miss: this very answer decides how the next try begins
            }
            const free = me.state !== 'blocked' && reasons.length === 0;
            if (free && now - assist.lastPressAt < ASSIST_RETRY_GAP_MS) {
                redrawAssist(); assist.timer = setTimeout(assistTick, ASSIST_POLL_MS); return;
            }
            if (free) { assist.phase = 'attack'; redrawAssist(); pressWhenReleased(now); return; }
            if (reasons.includes('lava_cooldown_active')) {
                // Sat out, nothing cleared: the cooldown only runs down with the clock, and an
                // unbid now would throw away a bid for nothing (the bot's lesson of 05.09.).
                assist.phase = 'lava';
                assist.lavaUntil = Number(me.lavaCooldownUntilMs) || assist.lavaUntil;
                if (now - assist.started > ASSIST_LAVA_MAX_MS) { assistStop('LAVA TOO LONG'); return; }
            } else {
                if (!assist.clearStart) assist.clearStart = now;
                const bidding = reasons.includes('currently_bidding');
                if (bidding && !assist.unbidSent) {
                    // Once only: !unbid pulls whatever bid is pending, so a second one later could
                    // take a good bid instead (the bot's AUTO-UNBID lesson).
                    const r = sendChatLine('!unbid');
                    assist.unbidSent = true;
                    assist.unbidAt = now;
                    assist.phase = r.ok ? 'unbid' : 'wait';
                } else if (bidding && assist.unbidSent && now - assist.unbidAt > ASSIST_REBID_MS) {
                    assist.phase = 'rebid';
                } else if (reasons.includes('currently_in_tile')) {
                    assist.phase = 'tile';
                } else if (!bidding) {
                    assist.phase = 'wait';
                }
                if (now - assist.clearStart > ASSIST_MAX_WAIT_MS) { assistStop('NOT FREE IN 5 MIN'); return; }
            }
        }
        redrawAssist();
        assist.timer = setTimeout(assistTick, ASSIST_POLL_MS);
    }

    // Free according to the server: make the game look again, then press its button the moment it
    // is released. If it is not released in time, back to waiting — the server may have changed
    // its mind (a new bid, a new run).
    function pressWhenReleased(since) {
        nudgeKingEligibility();
        const step = () => {
            if (!assist.active) return;
            const native = nativeAttack();
            if (nativeEnabled(native)) {
                pressAttack(native);
                return;
            }
            if (Date.now() - since > ASSIST_NATIVE_WAIT_MS) { assist.phase = 'wait'; redrawAssist(); assist.timer = setTimeout(assistTick, ASSIST_POLL_MS); return; }
            assist.timer = setTimeout(step, 300);
        };
        step();
    }

    // =========================================================================================
    // 7c. ON THE THRONE: TOLL AND BEVERAGES BY THEMSELVES (opt-in, 6.19)
    // =========================================================================================
    // The moment you take the crown, two things can happen without a click: the toll goes to a
    // chosen value, and the beverages picked in the settings are poured. Nothing is assembled
    // here. The toll goes through the game's Reduce / Increase buttons (stepTollTo, section 9c),
    // every beverage through the game's own button (nativeBeverageButton, section 7), so every
    // guard the game has keeps applying: only the King may set the toll, beverages unlock 15 s
    // into a reign, the balance, once per beverage, size and currency per reign.
    //
    // When: on the change to King (the bid area's toll mode, the script-wide King signal), and
    // once per reign. The reign is told apart by king.capturedAtMs from the snapshot, kept in
    // localStorage and written BEFORE anything is pressed: a reload in the middle of a reign must
    // never pour a second time. A reign older than THRONE_FRESH_MS was not "just taken" and is
    // left alone, and so is one the snapshot cannot name: without knowing the reign, nothing is
    // bought. Switching the feature on while already King does nothing until the next reign, so
    // a click in the settings never spends anything by itself.
    const THRONE_DONE_KEY = 'mcfo_throne_done';
    const THRONE_FRESH_MS = 3 * 60 * 1000;
    const THRONE_UNLOCK_MS = 15000;      // the game unlocks beverages this long into a reign
    const THRONE_TOLL_WAIT_MS = 20000;   // how long the toll controls may take to become editable
    const THRONE_POUR_MS = 25000;        // how long a greyed-out beverage is tried again
    const THRONE_NOTE_MS = 15000;
    const KING_SIGNAL = '[data-role="bid-area"][data-king-toll-mode="true"]';
    const BEV_ALL_KEYS = BEVERAGES.flatMap(b => BEV_CURRENCIES.flatMap(([c]) => BEV_SIZES.map(([z]) => `${b.type}|${z}|${c}`)));
    const throne = { king: false, running: false };
    const nap = ms => new Promise(r => setTimeout(r, ms));

    function bevPrice(key) {
        const [type, size, currency] = key.split('|');
        const right = bevRights.get(key);
        if (Number.isFinite(right?.price)) return right.price;
        const bev = BEVERAGES.find(b => b.type === type);
        return bev ? bev[currency][size] : 0;
    }
    function bevName(key) {
        const [type, size, currency] = key.split('|');
        const bev = BEVERAGES.find(b => b.type === type);
        const sizeLabel = (BEV_SIZES.find(x => x[0] === size) || [0, size])[1];
        return `${bev ? bev.label : type} ${sizeLabel} (${currency === 'gold' ? 'Gold' : 'Diamond'})`;
    }

    // On the 1.5 s beat. Only the change to King counts, including the first look after a load.
    function throneTick() {
        const king = !!document.querySelector(KING_SIGNAL);
        const became = king && !throne.king;
        throne.king = king;
        if (!became || throne.running) return;
        const pour = settings.throneDrinks && settings.throneDrinkSet.length > 0;
        if (!settings.throneToll && !pour) return;
        throne.running = true;
        throneRun(pour)
            .catch(e => console.warn('[MarbleLuceFall] throne actions failed:', e && e.message))
            .finally(() => { throne.running = false; });
    }

    // Right after the capture the snapshot may still name the previous reign for a moment, so
    // it is asked a few times until it shows a fresh one.
    async function readFreshReign() {
        for (let n = 0; n < 5; n++) {
            try {
                const res = await fetch('/api/king/snapshot?view=summary', { credentials: 'include', cache: 'no-store' });
                if (res.ok) {
                    const at = Number((await res.json())?.king?.capturedAtMs);
                    if (Number.isFinite(at) && at > 0 && Date.now() - at <= THRONE_FRESH_MS) return at;
                }
            } catch (e) {}
            await nap(2000);
        }
        return 0;
    }

    async function throneRun(pour) {
        const reign = await readFreshReign();
        if (!reign) return;
        let done = '';
        try { done = localStorage.getItem(THRONE_DONE_KEY) || ''; } catch (e) {}
        if (done === String(reign)) return;
        try { localStorage.setItem(THRONE_DONE_KEY, String(reign)); } catch (e) {}

        // Both at once: the toll is set within a second, the beverages wait for their unlock.
        const jobs = [];
        if (settings.throneToll) jobs.push(throneToll(settings.throneTollValue).then(line => throneNote([line])));
        if (pour) jobs.push(throneDrinks(reign, settings.throneDrinkSet.slice()).then(throneNote));
        await Promise.all(jobs);
    }

    async function throneToll(value) {
        const want = Math.max(0, Math.min(TOLL_MAX, Math.round(value)));
        const until = Date.now() + THRONE_TOLL_WAIT_MS;
        while (Date.now() < until) {
            const st = tollState();
            if (st.canEdit && st.value !== null) {
                if (st.value === want) return `Toll stays at ${want}`;
                stepTollTo(want);
                return `Toll set to ${want}`;
            }
            await nap(500);
        }
        return 'Toll not set: the game did not open its toll controls in time';
    }

    async function throneDrinks(reign, wanted) {
        const wait = reign + THRONE_UNLOCK_MS + 500 - Date.now();
        if (wait > 0) await nap(wait);
        if (!await loadBevRights()) return ['Beverages not poured: the game did not say which ones are still available'];
        const todo = wanted.filter(k => bevRights.get(k)?.state === 'available');
        const already = wanted.length - todo.length;
        const pressed = [];
        const native = key => nativeBeverageButton(...key.split('|'));

        // One at a time, each looked up again: the game may redraw or close its panel after a
        // purchase. A button that stays grey (not enough gold or diamonds) is given up on after
        // THRONE_POUR_MS.
        let opened = false;
        const until = Date.now() + THRONE_POUR_MS;
        while (todo.length && Date.now() < until) {
            let any = false;
            for (const key of todo.slice()) {
                const button = native(key);
                if (!nativeEnabled(button)) continue;
                forwardClick(button);
                pressed.push(key);
                todo.splice(todo.indexOf(key), 1);
                any = true;
                await nap(700);
            }
            if (!todo.length) break;
            const toggle = role('beverages-toggle');
            if (toggle && toggle.getAttribute('aria-expanded') !== 'true' && !todo.some(native)) {
                // The panel is not mounted: opened the way a person would, closed again below.
                forwardClick(toggle);
                opened = true;
                await nap(400);
            } else if (!any) await nap(800);
        }
        if (opened) {
            const toggle = role('beverages-toggle');
            if (toggle && toggle.getAttribute('aria-expanded') === 'true') forwardClick(toggle);
        }

        // Pressed is not bought: the game's answer counts, read back a moment later.
        await nap(2000);
        const read = await loadBevRights();
        refreshBevPanel();
        const bought = read ? pressed.filter(k => bevRights.get(k)?.state !== 'available') : pressed;
        const refused = pressed.filter(k => !bought.includes(k));
        const lines = [];
        if (bought.length) lines.push('Poured: ' + bought.map(bevName).join(', '));
        if (refused.length) lines.push('The game refused: ' + refused.map(bevName).join(', '));
        if (todo.length) lines.push('Not poured, the button stayed grey (not enough gold or diamonds?): ' + todo.map(bevName).join(', '));
        if (already) lines.push(already === 1 ? '1 was already bought this reign' : `${already} were already bought this reign`);
        return lines;
    }

    // What was done, on screen for a while (a click closes it). Toll and beverages finish at
    // different times, so the second adds to the note the first opened.
    let throneNoteTimer = 0;
    function throneNote(lines) {
        if (!lines.length) return;
        console.log('[MarbleLuceFall] on the throne:', lines.join(' | '));
        let note = document.querySelector('.mcfo-throne-note');
        if (!note) {
            note = document.createElement('div');
            note.className = 'mcfo-throne-note';
            const head = document.createElement('b');
            head.textContent = 'On the throne';
            note.appendChild(head);
            note.addEventListener('click', () => note.remove());
            document.body.appendChild(note);
        }
        for (const line of lines) {
            const row = document.createElement('div');
            row.textContent = line;
            note.appendChild(row);
        }
        clearTimeout(throneNoteTimer);
        throneNoteTimer = setTimeout(() => note.remove(), THRONE_NOTE_MS);
    }

    // The settings: what costs what, and a note that nothing of it comes back.
    function throneNotice() {
        const note = document.createElement('div');
        note.className = 'mcfo-set__notice';
        note.textContent = 'Beverages cost gold or diamonds the moment they are poured, and that cannot be undone: '
            + 'no refund, no confirm step. Whatever is picked here is bought by itself every time you take the throne, until you switch it off.';
        return note;
    }

    function throneDrinksCard() {
        const card = document.createElement('div');
        card.className = 'mcfo-set__card mcfo-throne';
        card.toggleAttribute('data-off', !settings.throneDrinks);

        const head = document.createElement('div');
        head.className = 'mcfo-throne__head';
        const title = document.createElement('span');
        title.className = 'mcfo-throne__title';
        title.textContent = 'Beverages to pour';
        const quick = document.createElement('div');
        quick.className = 'mcfo-throne__quick';
        head.append(title, quick);
        card.appendChild(head);

        const picks = [];
        const sum = document.createElement('div');
        sum.className = 'mcfo-throne__sum';
        const redraw = () => {
            const set = new Set(settings.throneDrinkSet);
            for (const b of picks) b.setAttribute('aria-pressed', set.has(b._mcfoKey) ? 'true' : 'false');
            const gold = settings.throneDrinkSet.filter(k => k.endsWith('|gold')).reduce((t, k) => t + bevPrice(k), 0);
            const dia = settings.throneDrinkSet.filter(k => k.endsWith('|diamonds')).reduce((t, k) => t + bevPrice(k), 0);
            const n = settings.throneDrinkSet.length;
            sum.innerHTML = n
                ? `<b>${n}</b> of ${BEV_ALL_KEYS.length} picked: <b>${number(gold)}</b> gold and <b>${number(dia)}</b> diamonds, every reign.`
                : 'Nothing picked yet.';
        };
        // Always a new array in catalogue order: the default ([]) is never changed in place, and
        // the beverages are poured in the order they stand here.
        const choose = keep => {
            settings.throneDrinkSet = BEV_ALL_KEYS.filter(keep);
            saveSettings();
            redraw();
        };

        for (const [text, keep] of [
            ['All gold', k => k.endsWith('|gold')],
            ['All diamonds', k => k.endsWith('|diamonds')],
            ['Everything', () => true],
            ['None', () => false],
        ]) {
            const b = document.createElement('button');
            b.type = 'button';
            b.textContent = text;
            b.addEventListener('click', () => choose(keep));
            quick.appendChild(b);
        }

        const grid = document.createElement('div');
        grid.className = 'mcfo-throne__grid';
        grid.appendChild(document.createElement('span'));
        for (const [, sizeLabel] of BEV_SIZES) {
            const col = document.createElement('span');
            col.className = 'mcfo-throne__col';
            col.textContent = sizeLabel;
            grid.appendChild(col);
        }
        for (const bev of BEVERAGES) {
            const name = document.createElement('span');
            name.className = 'mcfo-throne__name';
            name.textContent = bev.label;
            name.style.color = bev.stroke === '#ffffff' ? '#e8e2c8' : bev.stroke;
            grid.appendChild(name);
            for (const [size, sizeLabel] of BEV_SIZES) {
                const cell = document.createElement('div');
                cell.className = 'mcfo-throne__cell';
                for (const [currency, currencyLabel] of BEV_CURRENCIES) {
                    const key = `${bev.type}|${size}|${currency}`;
                    const b = document.createElement('button');
                    b.type = 'button';
                    b.className = 'mcfo-throne__pick';
                    b.setAttribute('data-cur', currency);
                    b._mcfoKey = key;
                    b.innerHTML = `<i class="mcfo-throne__${currency === 'gold' ? 'coin' : 'gem'}" aria-hidden="true"></i><span></span>`;
                    b.lastChild.textContent = number(bevPrice(key));
                    b.title = `${bev.label} ${sizeLabel} for ${number(bevPrice(key))} ${currencyLabel}`;
                    b.addEventListener('click', () => {
                        const set = new Set(settings.throneDrinkSet);
                        if (set.has(key)) set.delete(key); else set.add(key);
                        choose(k => set.has(k));
                    });
                    picks.push(b);
                    cell.appendChild(b);
                }
                grid.appendChild(cell);
            }
        }
        card.append(grid, sum);
        redraw();
        return card;
    }

    // =========================================================================================
    // 8. HEADER CARDS AS SIGNPOSTS
    // =========================================================================================
    // Six buttons have left the footer. Anyone who does not know where they went will not find
    // them, so every card that opens something says what it opens.
    //
    // The Diamonds card gets no label of its own: the game's "Purchase" button is already there.
    // That button is intercepted as well, so card and button do the same thing — it used to run
    // window.location.assign('/payment/packages'), which is exactly the page that now opens in
    // the overlay.
    const CARDS = [
        {
            id: 'gold',
            find: () => document.querySelector('[data-role="metric-cell"][data-metric-role="gold"]'),
            label: 'Shop',
            place: 'float',
            run: () => openPage('/shop', 'Shop'),
        },
        {
            id: 'diamonds',
            find: () => document.querySelector('[data-role="metric-cell"][data-metric-role="diamonds"]'),
            label: null,
            run: () => openPage('/payment/packages', 'Buy Diamonds'),
        },
        {
            id: 'account',
            find: () => role('profile-entry'),
            label: () => (signedOut() ? 'Log in' : 'Account'),
            place: 'float',
            // No run: the menu is already bound by bindMenu, this only adds the sign.
        },
        {
            id: 'events',
            find: () => firstRole('session-cell', 'tileset-indicator'),
            label: 'Events',
            place: 'float',
        },
    ];

    function setSignpost(card, text, place) {
        let el = card.querySelector(':scope > .mcfo-signpost');
        if (!text) { if (el) el.remove(); return; }
        if (!el) {
            el = document.createElement('span');
            el.className = 'mcfo-signpost' + (place === 'float' ? ' mcfo-signpost--float' : '');
            card.appendChild(el);
        }
        const want = text + ' ›';
        if (el.textContent !== want) el.textContent = want;
    }

    function buildCards() {
        document.documentElement.setAttribute('data-mcfo-cards', settings.cardSignposts ? '1' : '0');
        for (const card of CARDS) {
            const el = card.find();
            if (!el) continue;

            el.classList.toggle('mcfo-card', !!settings.cardSignposts);
            const label = typeof card.label === 'function' ? card.label() : card.label;
            setSignpost(el, settings.cardSignposts ? label : null, card.place);

            if (!card.run) continue;
            if (el.getAttribute('data-mcfo-card') === card.id) continue;
            el.setAttribute('data-mcfo-card', card.id);
            el.addEventListener('click', e => {
                if (!settings.cardSignposts) return;
                e.preventDefault();
                e.stopPropagation();
                card.run();
            }, true);
        }
    }

    // =========================================================================================
    // 9. THE TICKET RAIL: REBELLION, COLLAPSING, EXTRA CHIPS
    // =========================================================================================
    // Rebellion moves into the rail as a fixed part of it, and everything above 10 folds away
    // behind an arrow. bid-rail is never rebuilt by the game — it is written once and afterwards
    // only has attributes and styles set on it (checked in app.js) — so inserting into it is safe,
    // unlike the king tray.
    //
    // Rebellion is a copy that forwards its click; the original stays hidden in the footer where
    // nothing can destroy it.
    let railOpen = false;
    try { railOpen = localStorage.getItem('mcfo_rail_open') === '1'; } catch (e) {}

    function buildRailGroup() {
        const rail = role('bid-rail');
        if (!rail) return;

        if (!settings.railGroup) {
            // Only our own two buttons. The same attribute also sits on <html>, where it drives
            // the folding CSS — and up to 3.7 a bare [data-mcfo-rail] matched <html> itself, so
            // switching this off removed the whole document: the white page that needed a reload.
            document.querySelectorAll('.mcfo-rebellion[data-mcfo-rail], .mcfo-rail-toggle[data-mcfo-rail]').forEach(e => e.remove());
            document.documentElement.removeAttribute('data-mcfo-rail');
            const panel = role('rebellion-panel');
            if (panel) for (const k of ['position','left','top','right','bottom']) panel.style[k] = '';
            return;
        }

        // Into bid-area, not into bid-rail. Both are centred, so it looks the same — but the
        // game hides the whole rail while you are King and shows the toll controls in its place.
        // Inside the rail the button would vanish exactly then; beside it, it stays.
        const area = role('bid-area');
        let reb = area && area.querySelector('[data-mcfo-rail="rebellion"]');
        if (!reb) {
            reb = document.createElement('button');
            reb.type = 'button';
            reb.className = 'mcfo-rebellion';
            reb.setAttribute('data-mcfo-rail', 'rebellion');
            reb.textContent = 'Rebellion';
            reb.title = 'Open Rebellion purchases';
            reb.addEventListener('click', e => {
                e.preventDefault();
                e.stopPropagation();
                if (settings.rebellionPanel) { showRebellionPopup(reb); return; }
                const ziel = document.querySelector('[data-role="nav-region"] > [data-role="rebellion-toggle"]');
                if (ziel) ziel.click();
                // The panel is anchored to the ORIGINAL button and would otherwise open at the
                // far right of the screen. Repeated, because the game runs a layout pass of its
                // own after opening.
                for (const ms of [0, 60, 250]) setTimeout(() => placeRebellionPanel(reb), ms);
            });
            if (area) area.prepend(reb);
        }

        let arrow = rail.querySelector('[data-mcfo-rail="toggle"]');
        if (!arrow) {
            arrow = document.createElement('button');
            arrow.type = 'button';
            arrow.className = 'mcfo-rail-toggle';
            arrow.setAttribute('data-mcfo-rail', 'toggle');
            arrow.addEventListener('click', e => {
                e.preventDefault();
                e.stopPropagation();
                railOpen = !railOpen;
                try { localStorage.setItem('mcfo_rail_open', railOpen ? '1' : '0'); } catch (err) {}
                buildRailGroup();
                buildExtraChips();
                centreRail();
            });
        }
        rail.appendChild(arrow);          // always last, whatever else was added meanwhile
        arrow.textContent = railOpen ? '\u25C0' : '\u25B6';
        arrow.title = railOpen ? 'Collapse the rail' : 'Show the bigger amounts';

        // Folding is done in CSS, not by touching the chips. The game owns their visibility —
        // restoreBidButtonsForNonKing sets an inline display on every chip whenever the ticket
        // balance changes — and a tug of war over that property would either flicker or, worse,
        // reveal a chip the player has not unlocked. Marking them and letting a rule hide them
        // keeps both jobs apart: the game decides what is unlocked, we decide what is folded.
        document.documentElement.setAttribute('data-mcfo-rail', railOpen ? 'open' : 'closed');
        for (const chip of rail.querySelectorAll('[data-role^="bid-"]')) {
            const amount = Number(chip.getAttribute('data-bid-amount'));
            if (Number.isFinite(amount) && amount > RAIL_ALWAYS) chip.setAttribute('data-mcfo-big', '1');
        }
    }

    // Bring the rebellion panel to our button. It is position:absolute and anchored to the
    // original in the footer, so untouched it opens bottom right — far from where it was asked
    // for.
    //
    // The tiers themselves are left alone on purpose. All eight buttons carry the same
    // data-role="rebellion-tier-start" and the same label "Start" — nothing tells them apart but
    // their order. A home-made panel would have to pick a tier by position, and a wrong guess
    // there spends diamonds. Restyled, yes; rebuilt, no.
    function placeRebellionPanel(anchor) {
        const panel = role('rebellion-panel');
        if (!panel || !anchor) return;
        const p = panel.getBoundingClientRect();
        const a = anchor.getBoundingClientRect();
        if (!p.width || !a.width) return;      // closed, nothing to place

        let left = a.left + a.width / 2 - p.width / 2;
        left = Math.max(8, Math.min(left, innerWidth - p.width - 8));
        let top = a.top - p.height - 10;
        if (top < 8) top = Math.min(a.bottom + 10, innerHeight - p.height - 8);

        panel.style.position = 'fixed';
        panel.style.left   = Math.round(left) + 'px';
        panel.style.top    = Math.round(Math.max(8, top)) + 'px';
        panel.style.right  = 'auto';
        panel.style.bottom = 'auto';
    }

    // ---- UNBID ----
    // The game has no button for it, only the chat command: !unbid takes your bid back out of the
    // queue you are standing in (the reply reads "Your active bid has been set to 0. You are no
    // longer in the queue."). So the button sends exactly that, through the game's own chat form —
    // the same path as typing it, with every check the game makes there — and puts back whatever
    // you had started typing. From PRESTART_3S on an entry is final; the game then answers in the
    // chat, like it would to the typed command.
    //
    // One click, no confirm step: an unbid is wanted in a hurry (a bid that landed on the wrong
    // tile), and it costs nothing — the ticket comes back. Unlike Rebellion, which spends diamonds.
    // A successful unbid fires 'mcf:king-eligibility-invalidated' with reason 'unbid' on the page
    // (chatPane.js) — that is the confirmation the button waits for.
    const UNBID_WAIT_MS = 5000;
    const UNBID_TEXT = {
        idle:  ['Unbid', 'Take your bid back out of the queue'],
        sent:  ['Unbid\u2026', 'Sent, waiting for the game'],
        done:  ['Done', 'The game confirmed the unbid — its reply is in the chat'],
        none:  ['See chat', 'No confirmation from the game — its reply is in the chat'],
    };
    let unbidTimer = 0;
    let unbidPending = false;

    function buildUnbid() {
        let btn = document.querySelector('.mcfo-unbid');
        if (!settings.unbidButton) { if (btn) btn.remove(); return; }
        const area = role('bid-area');
        if (!area) return;
        if (!btn) {
            btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'mcfo-unbid';
            btn.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); unbidClick(btn); });
            unbidState(btn, 'idle');
        }
        // Right of the chips, whatever else was added: last in bid-area, or just before Autobid,
        // which sits right of it. Only moved when out of place — an append on every pass would
        // lay the rail out anew every 1.5 s.
        const tail = area.querySelector(':scope > .mcfo-autobid');
        if (tail) { if (btn.nextElementSibling !== tail) area.insertBefore(btn, tail); }
        else if (area.lastElementChild !== btn) area.appendChild(btn);
    }

    function unbidState(btn, state, title) {
        btn.setAttribute('data-mcfo-state', state);
        btn.textContent = UNBID_TEXT[state][0];
        btn.title = title || UNBID_TEXT[state][1];
    }

    function unbidLater(btn, ms) {
        clearTimeout(unbidTimer);
        unbidTimer = setTimeout(() => unbidState(btn, 'idle'), ms);
    }

    function unbidClick(btn) {
        if (btn.getAttribute('data-mcfo-state') === 'sent') return;   // one at a time
        clearTimeout(unbidTimer);
        const r = sendChatLine('!unbid');
        if (!r.ok) { unbidState(btn, 'none', r.why); unbidLater(btn, 3000); return; }
        unbidPending = true;
        unbidState(btn, 'sent');
        unbidTimer = setTimeout(() => {
            if (!unbidPending) return;
            unbidPending = false;
            unbidState(btn, 'none');
            unbidLater(btn, 3000);
        }, UNBID_WAIT_MS);
    }

    window.addEventListener('mcf:king-eligibility-invalidated', e => {
        if (!unbidPending) return;
        let reason = '';
        try { reason = e.detail && e.detail.reason; } catch (err) {}
        if (reason && reason !== 'unbid') return;
        unbidPending = false;
        const btn = document.querySelector('.mcfo-unbid');
        if (!btn) return;
        unbidState(btn, 'done');
        unbidLater(btn, 2500);
    });

    // One line through the game's own chat form, as if typed. The field is put back afterwards:
    // the game empties it only when it really sent, so an unchanged field means it refused.
    function sendChatLine(text) {
        const form = role('chat-form');
        const input = form && form.querySelector('[data-role="chat-input"]');
        if (!form || !input) return { ok: false, why: 'The chat is not there' };
        if (input.disabled) return { ok: false, why: 'The chat is read-only right now' };
        const draft = input.value;
        input.value = text;
        try {
            if (typeof form.requestSubmit === 'function') form.requestSubmit();
            else form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        } catch (e) {}
        const sent = input.value === '';
        input.value = draft;
        return sent ? { ok: true } : { ok: false, why: 'The chat did not take it (not connected?)' };
    }

    // =========================================================================================
    // 9g. AUTOBID
    // =========================================================================================
    // What the Discord bot does for its accounts, for anyone who only has the browser: one bid on
    // every tile whose bidding window opens, with the bot's safety net if wanted.
    //
    // How a bid works decides how careful this has to be. /bid/place takes only { bidDelta } —
    // no lane, no run (placeBidFromUi in app.js; a runId is ignored by the server). The server
    // puts the bid on whichever lane is taking bids at that moment, and now and then that is not
    // the one we saw (the bot: 28 of 10,484 bids, 15 of them onto a risk tile). Its reply says
    // where the bid really went (bidPreviewLaneState), and !unbid takes it back while that lane's
    // window is still open. From PRESTART_3S on the entry is final.
    //
    // The logic is the bot's scanAndBid/placeBid, with the bot's numbers:
    //   - bid when a lane is in TILE_REVEALED with biddingOpen, once per run;
    //   - "once" is a high-water mark per lane (prefix + counter of the runId). During a server
    //     hiccup the lanes flip between run N+1 and N again; a single remembered runId took every
    //     flip for a new run and bid again (the bot's 11.09.). Kept in localStorage, so a reload
    //     or a second tab does not bid a run twice either (the bot's restarts, same day);
    //   - one tab bids at a time (a lock in localStorage, taken over when that tab goes quiet);
    //   - paused while King (no bids from the throne) and while "Attack when free" runs, which
    //     needs the marble free and would otherwise see its !unbid undone.
    // With risk protection on, additionally:
    //   - no bid onto a risk tile — the all-or-nothing tiles that can set your points to zero;
    //   - no bid at all while a risk tile's window is open anywhere: the server could put it there;
    //   - no bid while a lane has shown the same run for over 4 minutes — its view is likely out
    //     of date (the bot's 06.08.: 41 bids lost while every frame looked fresh);
    //   - if a bid lands on a risk tile anyway: !unbid, once, and only while that lane is still
    //     open. Once it has closed, !unbid would pull some other, good bid instead.
    //
    // Risk tiles: the six known names, plus whatever the game's public tile catalogue marks —
    // a definition with SetToAbsolute (points set to a fixed value) or WarningIcon, and every
    // tile of the RiskyBusiness tileset. The same derivation as the bot's, redone once a day.
    const AB_LOCK_AFTER_BID_MS = 2000;     // bot: postClickLockMs
    const AB_RISK_LOCK_MS      = 8000;     // bot: zohLockMs — keep off a lane a bid leaked into
    const AB_UNBID_LOCK_MS     = 5000;     // bot: autoUnbidLockMs
    const AB_TRUST_MAX_RUN_MS  = 240000;   // bot: laneTrustMaxRunMs (runs: median 121 s, p95 187 s)
    const AB_LANE_GONE_MS      = 600000;   // no frame for this long: the lane is gone, not stale
    const AB_HIGH_TTL_MS       = 600000;   // bot: BID_RUN_HIGH_TTL_MS — a counter reset must not lock a lane for good
    const AB_TAB_STALE_MS      = 15000;    // a bidding tab that has not checked in for this long has gone
    const AB_NOTE_MS           = 30000;    // how long a notice (leak, refusal) stays in view
    const AB_RISK_SCAN_MS      = 24 * 3600 * 1000;
    const AB_HIGH_KEY = 'mcfo_autobid_runs';
    const AB_TAB_KEY  = 'mcfo_autobid_tab';
    const AB_RISK_KEY = 'mcfo_tile_risk';
    const AB_RISK_NAMES = ['zero or hero', 'zero-or-hero', 'zeroorhero', 'chance time', 'double or nothing',
                           'jackball deathpot', 'v-risko', 'v risko', 'vrisko', 'super questionable financial decision'];
    const AB_CATALOGS = ['real', 'BaseSet', 'RiskyBusiness', 'SpeedRound', 'GrindStone', 'RarityStorm',
                         'HighRoller', 'HighTide', 'LowTide', 'EvenTide', 'Legacy', 'Mystery'];
    const AB_RISK_COMPONENTS = ['SetToAbsolute', 'WarningIcon'];

    const ab = {
        tabId: Math.random().toString(36).slice(2),
        tone: 'off', text: '',
        busy: false, lockUntil: 0, kingUntil: 0, lastUnbidAt: 0, riskLock: {},
        bids: 0, lastBid: null, note: '', noteTone: '', noteAt: 0,
        scanning: false, tickQueued: false, priority: '',
    };
    let abRisk = null;
    let abMenu = null;
    let abRiskArmedUntil = 0;

    const normTile = s => String(s || '').trim().toLowerCase();
    const runPrefix = id => String(id || '').replace(/:\d+$/, '');
    const runSeq = id => { const m = /:(\d+)$/.exec(String(id || '')); return m ? parseInt(m[1], 10) : 0; };
    const laneName = k => String(k || '').split(':').pop() || String(k || '');
    const clock = t => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    function readStore(key) { try { return JSON.parse(localStorage.getItem(key)) || null; } catch (e) { return null; } }
    function writeStore(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) {} }

    // ---- once per run ----
    function markBidRun(laneKey, runId) {
        if (!laneKey || !runId) return;
        const now = Date.now();
        const high = readStore(AB_HIGH_KEY) || {};
        const pre = runPrefix(runId), seq = runSeq(runId), old = high[laneKey];
        if (!old || old.pre !== pre || seq > old.seq || now - old.at > AB_HIGH_TTL_MS) high[laneKey] = { pre, seq, at: now };
        for (const k of Object.keys(high)) if (now - (high[k].at || 0) > AB_HIGH_TTL_MS) delete high[k];
        writeStore(AB_HIGH_KEY, high);
    }
    function alreadyBid(laneKey, runId) {
        const old = (readStore(AB_HIGH_KEY) || {})[laneKey];
        if (!old || !runId || Date.now() - old.at > AB_HIGH_TTL_MS) return false;
        return old.pre === runPrefix(runId) && runSeq(runId) <= old.seq;
    }

    // ---- one bidding tab ----
    function holdsTabLock(now) {
        const lock = readStore(AB_TAB_KEY);
        if (lock && lock.id !== ab.tabId && now - lock.at < AB_TAB_STALE_MS) return false;
        // Checked in every 2 s at most: this runs on every lane frame.
        if (!lock || lock.id !== ab.tabId || now - lock.at > 2000) writeStore(AB_TAB_KEY, { id: ab.tabId, at: now });
        return true;
    }
    function releaseTabLock() {
        const lock = readStore(AB_TAB_KEY);
        if (lock && lock.id === ab.tabId) { try { localStorage.removeItem(AB_TAB_KEY); } catch (e) {} }
    }
    addEventListener('pagehide', releaseTabLock);

    // ---- risk tiles ----
    function riskState() {
        if (abRisk) return abRisk;
        const c = readStore(AB_RISK_KEY);
        abRisk = c && typeof c === 'object' ? { defs: c.defs || {}, tiles: c.tiles || {}, at: c.at || 0 } : { defs: {}, tiles: {}, at: 0 };
        return abRisk;
    }
    function isRiskTile(tile) {
        const n = normTile(tile);
        if (!n) return false;
        if (AB_RISK_NAMES.some(f => n === f || n.includes(f))) return true;
        return riskState().tiles[n] === true;
    }

    // The bot's refreshTileRisk, in the browser. Every catalogue lists its tiles with a specHash
    // and a definitionRef. Definitions are content-addressed — 35 of them behind 287 catalogue
    // rows — so each is fetched once, ever. Only ever adds: a tile that was a risk tile stays
    // one, since quietly unlocking is the dangerous direction. The server is flaky at times;
    // whatever fails is simply tried again on the next scan.
    async function scanRiskCatalogs() {
        if (ab.scanning) return;
        ab.scanning = true;
        const risk = riskState();
        let read = 0;
        try {
            for (const key of AB_CATALOGS) {
                let catalog;
                try {
                    const res = await fetch(`/tilesets/out/${encodeURIComponent(key)}/tileset.json`);
                    if (!res.ok) continue;
                    catalog = await res.json();
                } catch (e) { continue; }
                read += 1;
                for (const row of (catalog && catalog.tiles) || []) {
                    const tile = normTile(row && row.tileId);
                    const hash = String((row && row.specHash) || '').trim();
                    if (!tile || !hash || !row.definitionRef) continue;
                    if (risk.defs[hash] === undefined) {
                        try {
                            const res = await fetch('/' + String(row.definitionRef).replace(/^\//, ''));
                            if (!res.ok) continue;
                            const def = await res.json();
                            const types = new Set(((def && def.compiled && def.compiled.components) || []).map(c => String((c && c.type) || '')));
                            risk.defs[hash] = AB_RISK_COMPONENTS.some(t => types.has(t));
                        } catch (e) { continue; }
                    }
                    if (risk.defs[hash] || key === 'RiskyBusiness') risk.tiles[tile] = true;
                }
            }
            if (read) risk.at = Date.now();
            writeStore(AB_RISK_KEY, risk);
        } finally { ab.scanning = false; }
    }

    // ---- deciding ----
    const kingNow = () => !!document.querySelector('[data-role="bid-area"][data-king-toll-mode="true"]') || Date.now() < ab.kingUntil;

    function untrustedLane(now) {
        for (const [k, l] of lanes) {
            // A lane that sends nothing at all any more is gone, not stale — left in, it would
            // block bidding for good.
            if (now - l.at > AB_LANE_GONE_MS) { lanes.delete(k); continue; }
            if (!l.runChangedAt || now - l.runChangedAt > AB_TRUST_MAX_RUN_MS) return k;
        }
        return null;
    }

    function abSet(tone, text) { ab.tone = tone; ab.text = text; }
    function abNote(tone, text) { ab.note = text; ab.noteTone = tone; ab.noteAt = Date.now(); drawAutobid(); }

    function autobidTick() {
        ab.tickQueued = false;
        const priority = ab.priority;
        ab.priority = '';
        autobidStep(Date.now(), priority);
        drawAutobid();
    }

    function autobidStep(now, priority) {
        if (!settings.autobidButton || !settings.autobidOn) return abSet('off', 'Off.');
        if (kingNow()) return abSet('hold', 'Paused: you are King. Bidding picks up again after your reign.');
        // Not during a lava cooldown (6.20): it runs down with the clock alone, and its three
        // minutes are tiles worth playing, as the MarbleMind bot does it. The one !unbid comes
        // once the cooldown is over.
        if (assist.active && assist.phase !== 'lava') return abSet('hold', 'Paused while "Attack when free" is running.');
        if (!holdsTabLock(now)) return abSet('hold', 'Another tab is bidding for you, this one stands by.');
        if (!tapInstalled) return abSet('alert', 'The lanes cannot be read in this browser, so nothing is bid.');
        if (!lanes.size) {
            return now - tapStartedAt > 20000
                ? abSet('alert', 'No lane data. Reload the page: the script has to start before the game.')
                : abSet('hold', 'Waiting for the lanes …');
        }
        if (ab.busy || now < ab.lockUntil) return;          // a bid is on its way; keep its words

        const risk = settings.autobidRisk;
        if (risk && !ab.scanning && now - riskState().at > AB_RISK_SCAN_MS) scanRiskCatalogs();
        if (risk) {
            for (const [k, l] of lanes) {
                if (l.open && isRiskTile(l.tile)) return abSet('hold', `Holding: ${l.tile} is taking bids (${laneName(k)} lane), a bid now could land there.`);
            }
            const stale = untrustedLane(now);
            if (stale) return abSet('hold', `Holding: the ${laneName(stale)} lane has shown the same run for over 4 minutes, its view may be out of date.`);
        }

        let done = null, skipped = null;
        const candidates = [];
        for (const [k, l] of lanes) {
            if (l.phase !== 'TILE_REVEALED' || !l.open || !l.runId) continue;
            if (risk && (now < (ab.riskLock[k] || 0) || isRiskTile(l.tile))) { skipped = l; continue; }
            if (alreadyBid(k, l.runId)) { done = l; continue; }
            candidates.push([k, l]);
        }
        if (!candidates.length) {
            return abSet('on', done ? `Bid on ${done.tile}. Waiting for the next tile.`
                             : skipped ? `Skipping ${skipped.tile}: a risk tile.`
                             : 'On. Waiting for the next bidding window.');
        }

        const amount = settings.autobidAmount;
        const tickets = ticketBalance();
        if (tickets !== null && tickets < amount) return abSet('alert', `Not enough tickets for ${amount} (you have ${number(tickets)}).`);
        // The game's own lock, as for the extra chips: its chips are disabled while the runtime
        // holds bids or the bid target is unresolved (syncBidButtonsInteractivity, run on every
        // lane frame). Where the game allows no bid, neither do we — and the run is not marked,
        // so it is tried again the moment the game lets go.
        const chip = document.querySelector('[data-role="bid-1"]');
        if (chip && chip.disabled) return abSet('hold', 'The game is holding bids right now.');

        // A window that has just opened goes first, otherwise the newest run — as in the bot.
        candidates.sort((a, b) => (a[0] === priority ? -1 : b[0] === priority ? 1 : runSeq(b[1].runId) - runSeq(a[1].runId)));
        const [laneKey, lane] = candidates[0];
        markBidRun(laneKey, lane.runId);         // before the request, as in the bot: a timeout may still have landed
        ab.lockUntil = now + AB_LOCK_AFTER_BID_MS;
        placeAutoBid(laneKey, lane, amount);
    }

    function placeAutoBid(laneKey, lane, amount) {
        ab.busy = true;
        abSet('on', `Bidding ${amount} on ${lane.tile} …`);
        fetch('/bid/place', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ bidDelta: amount }),
        })
            .then(res => res.json().catch(() => ({})).then(body => ({ ok: res.ok, status: res.status, body })))
            .then(({ ok, status, body }) => {
                if (!ok) {
                    const why = String((body && body.error) || ('HTTP ' + status));
                    // The bot's rule: a refusal that mentions the throne means we are King.
                    if (/king|throne/i.test(why)) ab.kingUntil = Date.now() + 60000;
                    abNote('alert', `Bid on ${lane.tile} refused: ${why}.`);
                    return;
                }
                const preview = body && body.bidPreviewLaneState;
                const landedLane = String((body && body.resolvedBidTarget && body.resolvedBidTarget.laneKey)
                                          || (preview && preview.laneKey) || (body && body.laneKey) || '');
                const landedTile = String((preview && preview.payload && preview.payload.tileId) || '').trim();
                // The reply is the freshest word on that lane there is: take it, and count its run
                // as bid, wherever the bid went.
                if (preview && preview.laneKey && preview.payload && typeof preview.payload === 'object') {
                    noteLane(String(preview.laneKey), preview.payload, 'bid');
                    markBidRun(String(preview.laneKey), preview.payload.runId);
                }
                ab.bids += 1;
                ab.lastBid = { tile: landedTile || lane.tile, amount, at: Date.now() };
                if (landedTile && normTile(landedTile) !== normTile(lane.tile)) {
                    if (settings.autobidRisk && isRiskTile(landedTile)) takeBack(landedTile, landedLane, lane.tile);
                    else abNote('hold', `The server put this bid on ${landedTile}, not ${lane.tile}.`);
                }
            })
            .catch(e => abNote('alert', `Bid request failed: ${e.message}.`))
            .finally(() => { ab.busy = false; drawAutobid(); });
    }

    // A bid that landed on a risk tile. The bot's triggerAutoUnbid, rule for rule.
    function takeBack(landedTile, landedLane, wanted) {
        const now = Date.now();
        if (landedLane) ab.riskLock[landedLane] = now + AB_RISK_LOCK_MS;
        ab.lockUntil = Math.max(ab.lockUntil, now + AB_RISK_LOCK_MS);
        // !unbid pulls the bid from the lane whose window is open. Is the leaked lane closed
        // already, it would pull some other, good bid — then better nothing, and say so.
        const l = landedLane ? lanes.get(landedLane) : null;
        if (l && !l.open) return abNote('alert', `The server put the bid on ${landedTile} (wanted ${wanted}) and that lane has already closed. !unbid would pull a different bid instead, so nothing was sent.`);
        if (now - ab.lastUnbidAt < AB_UNBID_LOCK_MS) return abNote('alert', `The server put the bid on ${landedTile}, but an !unbid went out a moment ago. This one stays.`);
        const r = sendChatLine('!unbid');
        if (!r.ok) return abNote('alert', `The server put the bid on ${landedTile}. !unbid did not go out: ${r.why}.`);
        ab.lastUnbidAt = now;
        abNote('hold', `The server put the bid on ${landedTile} instead of ${wanted}. Taken back with !unbid.`);
    }

    // ---- the button and its menu ----
    function buildAutobid() {
        let btn = document.querySelector('.mcfo-autobid');
        if (!settings.autobidButton) {
            if (btn) btn.remove();
            if (abMenu && abMenu.isConnected) closeMenus();
            return;
        }
        const area = role('bid-area');
        if (!area) return;
        if (!btn) {
            btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'mcfo-autobid';
            btn.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); showAutobidMenu(btn); });
        }
        if (area.lastElementChild !== btn) area.appendChild(btn);    // right of Unbid, always last
        drawAutobid();
    }

    function drawAutobid() {
        const btn = document.querySelector('.mcfo-autobid');
        if (btn) {
            const on = settings.autobidOn;
            const noteFresh = !!ab.note && Date.now() - ab.noteAt < AB_NOTE_MS;
            const tone = !on ? 'off' : (noteFresh && ab.noteTone === 'alert') ? 'alert' : ab.tone;
            const label = on ? `Autobid ×${settings.autobidAmount}` : 'Autobid';
            const title = on ? (noteFresh ? ab.note + '\n' : '') + ab.text : 'Autobid is off. Click to set it up.';
            if (btn.textContent !== label) btn.textContent = label;
            if (btn.getAttribute('data-mcfo-tone') !== tone) btn.setAttribute('data-mcfo-tone', tone);
            if (btn.title !== title) btn.title = title;
        }
        if (abMenu && abMenu.isConnected) syncAutobidMenu(abMenu);
    }

    function showAutobidMenu(anchor) {
        const menu = showPanel(anchor, 'mcfo-menu--auto', m => {
            m.innerHTML =
                  '<div class="mcfo-auto__head"><span class="mcfo-auto__title">Autobid</span><span class="mcfo-auto__sub">one bid per tile</span></div>'
                + '<label class="mcfo-auto__row"><span class="mcfo-auto__label">Autobid</span>'
                +   '<input type="checkbox" class="mcfo-switch__input" data-mcfo-ab="on"><span class="mcfo-switch" aria-hidden="true"></span></label>'
                + '<label class="mcfo-auto__row"><span class="mcfo-auto__label">Tickets per tile</span>'
                +   '<input type="number" class="mcfo-auto__amount" data-mcfo-ab="amount" min="1" max="' + AUTOBID_MAX + '" step="1" inputmode="numeric"'
                +   ' title="1 to ' + AUTOBID_MAX + ', confirmed with Enter"></label>'
                + '<label class="mcfo-auto__row"><span class="mcfo-auto__label">Risk protection</span>'
                +   '<input type="checkbox" class="mcfo-switch__input" data-mcfo-ab="risk"><span class="mcfo-switch" aria-hidden="true"></span></label>'
                + '<div class="mcfo-auto__hint" data-mcfo-ab="riskhint"></div>'
                + '<div class="mcfo-auto__box" data-mcfo-ab="status"></div>'
                + '<div class="mcfo-auto__box" data-mcfo-ab="note" hidden></div>'
                + '<div class="mcfo-auto__last" data-mcfo-ab="last"></div>'
                + '<div class="mcfo-auto__foot"><b>Use at your own risk.</b> Risk protection makes a risk tile much less likely,'
                +   ' but it is no guarantee: the server decides where a bid goes, and a bid it puts on a risk tile cannot always'
                +   ' be taken back in time.</div>'
                + '<div class="mcfo-auto__foot">If something else already bids for this account (a bot, another browser), use only'
                +   ' one of them: both would bid.</div>';
            const q = n => m.querySelector(`[data-mcfo-ab="${n}"]`);

            q('on').addEventListener('change', e => {
                settings.autobidOn = e.target.checked;
                saveSettings();
                if (!settings.autobidOn) releaseTabLock();
                ab.note = '';
                autobidTick();
            });

            // Taken on Enter or on leaving the field, clamped to 1..100. Anything that is not a
            // number puts the old value back rather than guessing.
            const amount = q('amount');
            const commit = () => {
                const v = Math.round(Number(amount.value));
                if (amount.value.trim() !== '' && Number.isFinite(v)) { settings.autobidAmount = clampTickets(v); saveSettings(); }
                amount.value = String(settings.autobidAmount);
                autobidTick();
            };
            amount.addEventListener('change', commit);
            amount.addEventListener('keydown', e => {
                if (e.key === 'Enter')  { e.preventDefault(); commit(); amount.blur(); }
                if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); amount.value = String(settings.autobidAmount); amount.blur(); }
            });
            // A wheel over a focused number field changes it in some browsers — not on a value
            // that spends tickets.
            amount.addEventListener('wheel', e => { if (document.activeElement === amount) e.preventDefault(); }, { passive: false });

            // Switching risk protection on is immediate; switching it off takes a second click
            // within 4 s, with the warning in between — the one setting here that can cost points.
            const risk = q('risk');
            risk.addEventListener('click', e => {
                if (risk.checked || !settings.autobidRisk) return;
                if (Date.now() > abRiskArmedUntil) {
                    e.preventDefault();               // the checkbox stays on, no change event
                    abRiskArmedUntil = Date.now() + 4000;
                    setTimeout(drawAutobid, 4050);
                    // Redrawn after the click, not during it: the redraw sets .checked, and the
                    // browser undoes a cancelled click only after the listeners — touching the
                    // box in between left it switched off in jsdom.
                    setTimeout(drawAutobid, 0);
                }
            });
            risk.addEventListener('change', () => {
                settings.autobidRisk = risk.checked;
                abRiskArmedUntil = 0;
                saveSettings();
                autobidTick();
            });
        }, { centre: true });
        abMenu = menu || null;
        if (!menu) return;          // a second click on the button closed it
        syncAutobidMenu(menu);
        placePanel(anchor, menu);
    }

    function syncAutobidMenu(menu) {
        const q = n => menu.querySelector(`[data-mcfo-ab="${n}"]`);
        const put = (el, text) => { if (el.textContent !== text) el.textContent = text; };
        const tone = (el, t) => { if ((el.getAttribute('data-tone') || '') !== t) el.setAttribute('data-tone', t); };

        const on = q('on');
        if (on.checked !== settings.autobidOn) on.checked = settings.autobidOn;
        const amount = q('amount');
        if (document.activeElement !== amount && amount.value !== String(settings.autobidAmount)) amount.value = String(settings.autobidAmount);
        const risk = q('risk');
        if (risk.checked !== settings.autobidRisk) risk.checked = settings.autobidRisk;

        const armed = Date.now() < abRiskArmedUntil;
        const hint = q('riskhint');
        put(hint, armed ? 'Click again to turn it off. Autobid will then bid on every tile, including Zero or Hero and the other tiles that can set your points to zero.'
                 : settings.autobidRisk ? 'Skips the risk tiles (Zero or Hero and the others that can set your points to zero), holds back while one is taking bids, and takes a bid back with !unbid if the server puts it there anyway.'
                 : 'Off: bids on every tile, risk tiles included.');
        tone(hint, armed || !settings.autobidRisk ? 'warn' : '');

        const status = q('status');
        put(status, settings.autobidOn ? ab.text : 'Off. Switch it on above.');
        tone(status, settings.autobidOn ? ab.tone : '');

        const note = q('note');
        const noteFresh = !!ab.note && Date.now() - ab.noteAt < AB_NOTE_MS;
        note.hidden = !noteFresh;
        put(note, noteFresh ? ab.note : '');
        tone(note, noteFresh ? ab.noteTone : '');

        const parts = [];
        if (ab.lastBid) parts.push(`Last bid: ${ab.lastBid.amount} on ${ab.lastBid.tile}, ${clock(ab.lastBid.at)}`);
        if (ab.bids) parts.push(`${ab.bids} this session`);
        put(q('last'), parts.join(' · '));
    }

    function startAutobid() {
        laneListeners.push((laneKey, entry, prev, source) => {
            if (source !== 'socket' || !settings.autobidOn) return;
            if (entry.open && (!prev || !prev.open || prev.runId !== entry.runId)) ab.priority = laneKey;
            if (ab.tickQueued) return;
            ab.tickQueued = true;
            // Our listener sits on the socket before the game's (added in its constructor), so it
            // runs first. The tick waits until the game has taken the frame in — its chip lock is
            // read from the page.
            setTimeout(autobidTick, 60);
        });
        // The frames drive it; this beat keeps the status fresh and covers a quiet socket.
        setInterval(autobidTick, 1000);
        autobidTick();
    }

    // =========================================================================================
    // 9a. OWN REBELLION PANEL
    // =========================================================================================
    // Up to 3.9 this was left alone, because all eight buttons carry the same
    // data-role="rebellion-tier-start" and the same label "Start". But each sits in its own
    // block that names its tier:
    //
    //     <div data-role="rebellion-tier" data-tier-cost="2500">
    //         <strong data-role="rebellion-tier-multiplier">x25</strong> …
    //         <button data-role="rebellion-tier-start">Start</button>
    //
    // (renderRebellionTiers in app.js, which writes data-tier-cost from REBELLION_TIERS.) So the
    // button is found by its tier, not by its position.
    //
    // NOTHING IS BOUGHT BY THIS SCRIPT. A tier here presses the game's own Start button, which
    // calls purchaseRebellionTier(cost) — with every guard the game has: signed in, room ready,
    // no rebellion running, not already buying, and an idempotency key against double charges.
    //
    // Three safety rules, because a click here spends diamonds:
    //   1. The game re-renders the whole tier list on every state change (textContent = '' and
    //      rebuilt), so a button is never kept: it is looked up afresh at the moment of the click.
    //   2. Before pressing, the block found by cost must also show the expected multiplier and
    //      its button must be enabled. If anything does not match, nothing is pressed.
    //   3. The game's Start buys at once, without asking. Here the first click only arms the
    //      tier and names the amount; the second, within four seconds, buys.
    //
    // The tiers are the game's (REBELLION_TIERS, app.js). They are only the fallback for the
    // labels — what is actually offered, and whether it is enabled, is read from the game's
    // panel every quarter second while ours is open.
    const REB_TIERS = [
        { cost: 500,   mult: 5,   hue: '#5fb8e8' },
        { cost: 1000,  mult: 10,  hue: '#5fd0b0' },
        { cost: 1700,  mult: 17,  hue: '#8fd06a' },
        { cost: 2500,  mult: 25,  hue: '#e0d060' },
        { cost: 5000,  mult: 50,  hue: '#f0a040' },
        { cost: 7500,  mult: 75,  hue: '#f07050' },
        { cost: 10000, mult: 100, hue: '#f0506a' },
        { cost: 12500, mult: 125, hue: '#d060e0' },
    ];
    const REB_CONFIRM_MS = 4000;

    function nativeRebellionPanel() { return role('rebellion-panel'); }

    function nativeTier(cost) {
        const panel = nativeRebellionPanel();
        return panel && panel.querySelector(`[data-role="rebellion-tier"][data-tier-cost="${cost}"]`);
    }

    // The game's Start for exactly this tier — or null if anything about it does not add up.
    function verifiedStartButton(tier) {
        const block = nativeTier(tier.cost);
        if (!block) return null;
        const mult = (block.querySelector('[data-role="rebellion-tier-multiplier"]')?.textContent || '').trim();
        if (mult !== `x${tier.mult}`) return null;
        const button = block.querySelector('[data-role="rebellion-tier-start"]');
        if (!button || button.disabled || button.getAttribute('aria-disabled') === 'true') return null;
        return button;
    }

    // The game's panel is what fetches the status (fetchRebellionStatus runs on opening it), so
    // it is opened through its own toggle — invisibly — whenever ours opens.
    function wakeNativeRebellion() {
        const panel = nativeRebellionPanel();
        if (panel && panel.hidden !== true) return;
        const toggle = document.querySelector('[data-role="nav-region"] > [data-role="rebellion-toggle"]')
                    || role('rebellion-toggle');
        if (!toggle) return;
        // This click, too, would bubble up to our "close menus" listener and shut the panel
        // that has just opened.
        keepMenuOnce = true;
        setTimeout(() => { keepMenuOnce = false; }, 0);
        toggle.click();
    }

    let rebTimer = null;
    function stopRebellionPopup() {
        if (rebTimer) { clearInterval(rebTimer); rebTimer = null; }
        if (!document.documentElement.hasAttribute('data-mcfo-rebpop')) return;
        document.documentElement.removeAttribute('data-mcfo-rebpop');
        // Closed by Esc or by our own button, the game's panel would otherwise stay open — and
        // turn visible the moment the attribute above is gone.
        const panel = nativeRebellionPanel();
        if (panel && panel.hidden !== true) panel.querySelector('[data-role="rebellion-panel-close"]')?.click();
    }

    function showRebellionPopup(anchor) {
        const menu = showPanel(anchor, 'mcfo-menu--reb', m => {
            m.innerHTML = '<div class="mcfo-reb__head"><span class="mcfo-reb__title">Start a Rebellion</span>'
                        + '<span class="mcfo-reb__note">Rebellion bids can\u2019t be cancelled.</span></div>'
                        + '<div class="mcfo-reb__info">'
                        +   '<div class="mcfo-reb__active" hidden></div>'
                        +   '<div class="mcfo-reb__wallet"></div>'
                        +   '<div class="mcfo-reb__msg"></div>'
                        + '</div>'
                        + '<div class="mcfo-reb__grid"></div>';
            const grid = m.querySelector('.mcfo-reb__grid');
            for (const tier of REB_TIERS) {
                const b = document.createElement('button');
                b.type = 'button';
                b.className = 'mcfo-reb__tier';
                b.style.setProperty('--mcfo-tier', tier.hue);
                b.setAttribute('data-mcfo-cost', String(tier.cost));
                b.innerHTML = '<span class="mcfo-reb__mult"></span><span class="mcfo-reb__tiles"></span><span class="mcfo-reb__cost"></span>';
                b.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); rebellionTierClicked(tier, b, m); });
                grid.appendChild(b);
            }
        }, { centre: true });
        if (!menu) return;   // second click on the button: showPanel closed it (and us with it)
        // Only now: showPanel closes any open menu first, and that would take the attribute
        // straight off again. Set in the same task as the game's panel opens, so it never paints.
        document.documentElement.setAttribute('data-mcfo-rebpop', '1');
        wakeNativeRebellion();
        syncRebellionPopup(menu);
        placePanel(anchor, menu);
        rebTimer = setInterval(() => {
            if (!menu.isConnected) { stopRebellionPopup(); return; }
            syncRebellionPopup(menu);
        }, 250);
    }

    // Mirrors the game's panel into ours: what is enabled, the balance, the running rebellion
    // and the game's own message ("Starting Rebellion…", "Rebellion started.", errors).
    function syncRebellionPopup(menu) {
        const panel = nativeRebellionPanel();
        const text = r => (panel?.querySelector(`[data-role="${r}"]`)?.textContent || '').trim();

        const active = panel?.querySelector('[data-role="rebellion-status"]');
        const activeBox = menu.querySelector('.mcfo-reb__active');
        const activeText = active && active.style.display !== 'none' ? (active.textContent || '').trim() : '';
        activeBox.hidden = !activeText;
        if (activeBox.textContent !== activeText) activeBox.textContent = activeText;

        const wallet = text('rebellion-wallet');
        const walletEl = menu.querySelector('.mcfo-reb__wallet');
        if (walletEl.textContent !== wallet) walletEl.textContent = wallet;

        const msgEl = menu.querySelector('.mcfo-reb__msg');
        const msg = panel ? text('rebellion-message') : 'Rebellion panel not found.';
        if (msgEl.textContent !== msg) msgEl.textContent = msg;
        // The game colours its message by tone; read that back rather than guess from the words.
        const colour = panel?.querySelector('[data-role="rebellion-message"]')?.style.color || '';
        const tone = /243,\s*164|#f3a4a4/i.test(colour) ? 'error' : /159,\s*216|#9fd8b6/i.test(colour) ? 'success' : '';
        if ((msgEl.getAttribute('data-tone') || '') !== tone) msgEl.setAttribute('data-tone', tone);

        for (const b of menu.querySelectorAll('.mcfo-reb__tier')) {
            const tier = REB_TIERS.find(t => String(t.cost) === b.getAttribute('data-mcfo-cost'));
            const block = nativeTier(tier.cost);
            const nb = block && block.querySelector('[data-role="rebellion-tier-start"]');
            const usable = !!verifiedStartButton(tier);
            const armed = b.getAttribute('data-mcfo-armed') === '1';
            // An armed tier that has become unusable meanwhile is disarmed, not left waiting.
            if (armed && !usable) disarm(b);
            b.disabled = !usable;
            b.title = !block ? 'Loading tiers …' : (nb && nb.title) || '';
            const armedNow = b.getAttribute('data-mcfo-armed') === '1';
            const mult  = armedNow ? 'Confirm' : `x${tier.mult}`;
            const tiles = armedNow ? `${number(tier.cost)} diamonds?` : `${tier.mult} tiles`;
            const cost  = armedNow ? 'click again' : `${number(tier.cost)} diamonds`;
            const [m1, m2, m3] = b.children;
            if (m1.textContent !== mult)  m1.textContent = mult;
            if (m2.textContent !== tiles) m2.textContent = tiles;
            if (m3.textContent !== cost)  m3.textContent = cost;
        }
    }

    function disarm(b) {
        b.removeAttribute('data-mcfo-armed');
        clearTimeout(b._mcfoDisarm);
    }

    function rebellionTierClicked(tier, b, menu) {
        if (b.disabled) return;
        // First click: arm this tier, disarm any other.
        if (b.getAttribute('data-mcfo-armed') !== '1') {
            for (const other of menu.querySelectorAll('.mcfo-reb__tier[data-mcfo-armed="1"]')) disarm(other);
            b.setAttribute('data-mcfo-armed', '1');
            b._mcfoDisarm = setTimeout(() => { disarm(b); syncRebellionPopup(menu); }, REB_CONFIRM_MS);
            syncRebellionPopup(menu);
            return;
        }
        // Second click: look the game's button up NOW and check it once more.
        disarm(b);
        const button = verifiedStartButton(tier);
        if (!button) {
            const msgEl = menu.querySelector('.mcfo-reb__msg');
            msgEl.textContent = 'Not started: the game\u2019s panel did not confirm this tier. Nothing was spent.';
            msgEl.setAttribute('data-tone', 'error');
            return;
        }
        // The press bubbles up to our own "close menus on any click" listener; this one click
        // is let through, so the panel stays open and shows how the purchase went.
        keepMenuOnce = true;
        setTimeout(() => { keepMenuOnce = false; }, 0);   // should the click never reach document
        button.click();
        syncRebellionPopup(menu);
    }

    // =========================================================================================
    // 9c. TOLL FIELD
    // =========================================================================================
    // How the game changes the toll (app.js): each Reduce / Increase click calls
    // postKingTollDelta(±1), which only moves a target value, and flushKingTollUpdate sends that
    // target as an ABSOLUTE value — POST /api/king/toll { baseToll } — coalescing any clicks that
    // come in while a request is running. Five quick clicks are therefore one or two requests,
    // ending on the final value.
    //
    // So the field needs no request of its own. It presses the game's own button as often as the
    // difference says, and the game does the rest with all its guards: only the King may edit
    // (canEdit), the value is clamped to minBaseToll..maxBaseToll, and at either end the game
    // disables the button at once — a click on a disabled button does nothing, so the loop simply
    // stops there. The game's three controls are only hidden, never removed; renderKingTollControls
    // sets their properties but never rebuilds them.
    //
    // 17 is only what the field offers and clamps to. The real bounds are the game's
    // (/api/king/toll-capability): should they ever change, the game stops at its own limit.
    const TOLL_MAX = 17;
    const TOLL_OK_SHOW_MS = 2500;

    function tollState() {
        const controls = role('king-toll-controls');
        const raw = (role('king-toll-value')?.textContent || '').trim();
        return {
            controls,
            value: /^\d+$/.test(raw) ? Number(raw) : null,
            canEdit: controls ? controls.getAttribute('data-king-toll-can-edit') === 'true' : false,
            // The game writes its message into the container's title; without one it reads
            // "Current toll: N".
            message: controls ? String(controls.getAttribute('title') || '') : '',
        };
    }

    // Presses the game's Reduce or Increase button as often as the difference says; the game
    // clamps and greys its button at either end, which ends the loop. Also used by section 7c.
    function stepTollTo(want) {
        const st = tollState();
        if (st.value === null) return;
        const diff = want - st.value;
        const button = role(diff > 0 ? 'king-toll-increase' : 'king-toll-decrease');
        for (let n = Math.abs(diff); n > 0 && button && !button.disabled; n--) button.click();
    }

    function commitToll(box, target) {
        const st = tollState();
        const input = box.querySelector('.mcfo-toll__input');
        let want = Math.round(Number(target));
        if (st.value === null || !Number.isFinite(want) || String(target).trim() === '') { syncTollField(box, true); return; }
        want = Math.max(0, Math.min(TOLL_MAX, want));
        input.value = String(want);
        stepTollTo(want);
        input.removeAttribute('data-mcfo-dirty');
        syncTollField(box, true);
    }

    function syncTollField(box, force) {
        const st = tollState();
        const input = box.querySelector('.mcfo-toll__input');
        const range = box.querySelector('.mcfo-toll__range');
        const editing = document.activeElement === input && input.getAttribute('data-mcfo-dirty') === '1';

        if (!st.canEdit) box.setAttribute('data-mcfo-locked', '1'); else box.removeAttribute('data-mcfo-locked');
        input.disabled = !st.canEdit;
        range.disabled = !st.canEdit;
        range.hidden = !settings.tollSlider;

        // Never overwrite what someone is typing; everything else follows the game.
        if (st.value !== null && (force || !editing)) {
            if (input.value !== String(st.value)) input.value = String(st.value);
            if (!box._mcfoDragging && range.value !== String(st.value)) range.value = String(st.value);
        }

        const status = box.querySelector('.mcfo-toll__status');
        const msg = /^Current toll:/i.test(st.message) ? '' : st.message.trim();
        let text = '', tone = '';
        if (/sync/i.test(msg))            { text = 'Syncing…'; tone = 'busy'; }
        else if (/updated/i.test(msg))    { text = 'Updated'; tone = 'ok'; }
        else if (msg && st.canEdit)       { text = msg; tone = 'error'; }
        // "Updated" is a moment, not a state — the game leaves the message standing, so it is
        // shown for a short while after it first appears.
        if (tone === 'ok') {
            if (box._mcfoOkSince === undefined || box._mcfoOkMsg !== msg) { box._mcfoOkSince = Date.now(); box._mcfoOkMsg = msg; }
            if (Date.now() - box._mcfoOkSince > TOLL_OK_SHOW_MS) text = '';
        } else { box._mcfoOkSince = undefined; box._mcfoOkMsg = undefined; }
        if (status.textContent !== text) status.textContent = text;
        if ((status.getAttribute('data-tone') || '') !== tone) status.setAttribute('data-tone', tone);
    }

    function buildTollField() {
        document.documentElement.setAttribute('data-mcfo-toll', settings.tollInput ? '1' : '0');
        const controls = role('king-toll-controls');
        let box = controls && controls.querySelector(':scope > .mcfo-toll');
        if (!settings.tollInput || !controls) { if (box) box.remove(); return; }

        if (!box) {
            box = document.createElement('div');
            box.className = 'mcfo-toll';
            box.innerHTML = '<span class="mcfo-toll__label">Toll</span>'
                          + '<input class="mcfo-toll__input" type="number" inputmode="numeric" min="0" max="' + TOLL_MAX + '" step="1"'
                          + ' title="Type 0 to ' + TOLL_MAX + ' and press Enter · Esc cancels">'
                          + '<span class="mcfo-toll__max">/ ' + TOLL_MAX + '</span>'
                          + '<input class="mcfo-toll__range" type="range" min="0" max="' + TOLL_MAX + '" step="1" title="Drag and let go to set the toll">'
                          + '<span class="mcfo-toll__status"></span>';
            const input = box.querySelector('.mcfo-toll__input');
            const range = box.querySelector('.mcfo-toll__range');
            input.addEventListener('input', () => input.setAttribute('data-mcfo-dirty', '1'));
            input.addEventListener('keydown', e => {
                // Kept to the field: the game may have keys of its own on the page.
                if (e.key === 'Enter')  { e.preventDefault(); e.stopPropagation(); commitToll(box, input.value); input.blur(); }
                if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); input.removeAttribute('data-mcfo-dirty'); syncTollField(box, true); input.blur(); }
            });
            // Leaving the field without Enter discards the entry — it only counts when confirmed.
            input.addEventListener('blur', () => { input.removeAttribute('data-mcfo-dirty'); syncTollField(box, true); });
            // A wheel over a focused number field changes it in some browsers; here that would
            // be an accident waiting to happen on a value that costs other players tickets.
            input.addEventListener('wheel', e => { if (document.activeElement === input) e.preventDefault(); }, { passive: false });
            range.addEventListener('pointerdown', () => { box._mcfoDragging = true; });
            range.addEventListener('input', () => { input.value = range.value; });
            range.addEventListener('change', () => { box._mcfoDragging = false; commitToll(box, range.value); });
            controls.appendChild(box);

            // The value and the game's message change between our 1.5 s passes; follow them
            // directly so "Syncing…" and the new number show at once.
            new MutationObserver(() => syncTollField(box)).observe(controls,
                { subtree: true, childList: true, characterData: true, attributes: true,
                  attributeFilter: ['title', 'data-king-toll-can-edit', 'data-king-toll-base'] });
        }
        syncTollField(box);
    }

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
        const sig = [on, settings.chatGroup, ...CHAT_FILTERS.map(f => settings[f.key])].join();
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
    function chatSender(msg) {
        return (msg && msg.querySelector('.mcf-chat__sender') || {}).textContent
            ? msg.querySelector('.mcf-chat__sender').textContent.replace(/\[|\]/g, '').trim() : '';
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

    function tomatoPass(list) {
        const rows = list.querySelectorAll('article.mcf-chat__private');
        for (const msg of rows) {
            const own = msg.querySelector(':scope > .mcfo-tomato');
            if (!settings.chatTomato) {
                if (own) own.remove();
                msg.removeAttribute('data-mcfo-tomato');
                msg.removeAttribute('data-mcfo-tomato-gone');
                continue;
            }
            if (own) continue;
            const textEl = msg.querySelector(':scope > .mcf-chat__text');
            const m = textEl && (textEl.textContent || '').match(TOMATO_IN_RE);
            if (!m) continue;
            const time = [...msg.querySelectorAll(':scope > .mcf-chat__meta span')]
                .map(x => x.textContent.trim()).find(t => /^\d{1,2}:\d{2}/.test(t)) || '';
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
    }

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

    // =========================================================================================
    // 9b. EXTRA TICKET CHIPS
    // =========================================================================================
    // The game ships 1 · 5 · 10 · 25 · 100 · 500 · 1K. The rule that reveals the larger ones is
    // in app.js (restoreBidButtonsForNonKing):
    //
    //     if (!spec.defaultVisible && hasTicketTruth && numericTickets >= amount * 10)
    //         progressiveVisibleBids.add(amount);
    //
    // Two things about it matter and are reproduced here: the threshold is TEN TIMES the amount,
    // and it is a Set — once unlocked a chip stays visible even if the balance drops back below.
    // The short labels ("1K") are the game's convention, not an invention of ours.
    //
    // A bid is a plain POST /bid/place with { bidDelta } — no lane, no run id (placeBidFromUi in
    // app.js). These chips do no more than that.
    //
    // CAREFUL, this is the sharp end of the script: a click spends real tickets. So the chips
    // adopt the game's own locks instead of inventing their own — they mirror the disabled state
    // of a real chip and refuse on click if that one is disabled. Where the game allows no bid,
    // neither do they.
    const EXTRA_CHIPS = [
        { amount: 10000,      label: '10K',  fill: 'linear-gradient(160deg,#5fd0c8,#2a9d94 45%,#1a6b66)', shine: 'linear-gradient(180deg,rgba(206,255,250,0.6),rgba(206,255,250,0))', shade: 'linear-gradient(180deg,rgba(8,44,42,0.44),rgba(8,44,42,0))', textColor: '#f2fffd', textShadow: '0 1px 1px rgba(6,48,45,0.6)' },
        { amount: 100000,     label: '100K', fill: 'linear-gradient(160deg,#b58ae0,#7e4fb8 45%,#53307d)', shine: 'linear-gradient(180deg,rgba(238,220,255,0.6),rgba(238,220,255,0))', shade: 'linear-gradient(180deg,rgba(38,18,58,0.46),rgba(38,18,58,0))', textColor: '#faf4ff', textShadow: '0 1px 1px rgba(43,17,68,0.62)' },
        { amount: 1000000,    label: '1M',   fill: 'linear-gradient(160deg,#ffd97a,#e0a92e 45%,#a5741a)', shine: 'linear-gradient(180deg,rgba(255,246,214,0.66),rgba(255,246,214,0))', shade: 'linear-gradient(180deg,rgba(84,52,8,0.4),rgba(84,52,8,0))', textColor: '#3b2707', textShadow: '0 1px 0 rgba(255,242,206,0.5)' },
        { amount: 10000000,   label: '10M',  fill: 'linear-gradient(160deg,#ff8b6b,#d9452c 45%,#962417)', shine: 'linear-gradient(180deg,rgba(255,220,208,0.6),rgba(255,220,208,0))', shade: 'linear-gradient(180deg,rgba(70,14,8,0.46),rgba(70,14,8,0))', textColor: '#fff3ef', textShadow: '0 1px 1px rgba(84,15,8,0.62)' },
        { amount: 100000000,  label: '100M', fill: 'linear-gradient(160deg,#7ee6a0,#33a862 45%,#1d7042)', shine: 'linear-gradient(180deg,rgba(214,255,229,0.6),rgba(214,255,229,0))', shade: 'linear-gradient(180deg,rgba(9,48,27,0.44),rgba(9,48,27,0))', textColor: '#effff5', textShadow: '0 1px 1px rgba(8,52,29,0.6)' },
        { amount: 1000000000, label: '1B',   fill: 'linear-gradient(160deg,#8fa4b8,#41586e 45%,#1d2b38)', shine: 'linear-gradient(180deg,rgba(226,239,255,0.7),rgba(226,239,255,0))', shade: 'linear-gradient(180deg,rgba(6,12,20,0.5),rgba(6,12,20,0))', textColor: '#f4faff', textShadow: '0 1px 1px rgba(6,14,24,0.7)' },
    ];

    // Unlocked chips stay unlocked, as in the game. Nothing needs to survive a reload: with
    // enough tickets the rule unlocks them again immediately, and someone who has spent them
    // starts over anyway.
    const unlockedChips = new Set();

    // "933,309" / "933.309" / "933 309" -> 933309. The game formats to the browser's locale, so
    // this reduces to digits rather than trying to parse a number format.
    function ticketBalance() {
        const el = role('tickets') || role('tickets-compact-value');
        const raw = (el?.textContent || '').replace(/\D+/g, '');
        return raw ? Number(raw) : null;
    }

    function buildExtraChips() {
        const rail = role('bid-rail');
        if (!rail) return;

        if (!settings.extraChips) {
            rail.querySelectorAll('[data-mcfo-bid]').forEach(e => e.remove());
            return;
        }

        // The template is a real chip, so the chip artwork (SVG mask, sizing) is carried over
        // verbatim instead of being rebuilt and drifting on the next build.
        const template = document.querySelector('[data-role="bid-1000"]') || document.querySelector('[data-role^="bid-"]');
        if (!template) return;

        const tickets = ticketBalance();

        for (const spec of EXTRA_CHIPS) {
            if (tickets !== null && tickets >= spec.amount * 10) unlockedChips.add(spec.amount);
            const visible = unlockedChips.has(spec.amount);

            let chip = rail.querySelector(`[data-mcfo-bid="${spec.amount}"]`);
            if (!chip) {
                if (!visible) continue;          // do not even create it yet
                chip = template.cloneNode(true);
                // The original's markers have to go, or the game might count the chip as its own.
                chip.removeAttribute('data-role');
                chip.removeAttribute('data-bid-amount');
                chip.removeAttribute('hidden');
                chip.setAttribute('data-mcfo-bid', String(spec.amount));
                chip.setAttribute('aria-label', `Bid x${spec.amount}`);
                chip.setAttribute('title', `Bid x${spec.amount}`);

                // The three art layers carry their gradients inline; only those are replaced,
                // mask and metrics stay as in the original.
                const layers = chip.querySelectorAll('span[aria-hidden="true"]');
                const colours = [spec.fill, spec.shine, spec.shade];
                layers.forEach((layer, i) => { if (colours[i]) layer.style.background = colours[i]; });
                const label = chip.querySelector('span:not([aria-hidden])');
                if (label) {
                    label.textContent = spec.label;
                    label.style.textShadow = spec.textShadow;
                }
                chip.style.color = spec.textColor;

                chip.addEventListener('click', () => placeBid(spec.amount, chip));
                rail.appendChild(chip);
            }

            // Unlocking stays our job; folding is the rail's, through the same marker the
            // game's own big chips carry.
            chip.setAttribute('data-mcfo-big', '1');
            chip.hidden = !visible;
            chip.style.display = visible ? 'grid' : 'none';

            // Mirror the locks: whatever holds for the game's chips holds here too.
            if (template.disabled !== chip.disabled) chip.disabled = template.disabled;
            const opacity = template.style.opacity || '1';
            if (chip.style.opacity !== opacity) chip.style.opacity = opacity;
        }
    }

    function placeBid(amount, chip) {
        // Second lock, checked at click time: the mirrored state can be up to 1.5s old, which is
        // too long for a button that spends tickets.
        const template = document.querySelector('[data-role="bid-1000"]');
        if (chip.disabled || (template && template.disabled)) return;

        fetch('/bid/place', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ bidDelta: amount }),
        })
            .then(res => res.json().catch(() => ({})).then(body => ({ ok: res.ok, status: res.status, body })))
            .then(({ ok, status, body }) => {
                if (!ok) console.warn('[MarbleLuceFall] bid rejected:', body?.error || ('HTTP ' + status));
            })
            .catch(e => console.warn('[MarbleLuceFall] bid request failed:', e.message));
    }

    // =========================================================================================
    // 10. CENTRE THE TICKET AND TOLL RAIL ON THE BOARD
    // =========================================================================================
    // Measured at a window width of 2560px:
    //   main-region (board without chat)   11 .. 2199   centre 1105
    //   bid-area (ticket + toll rail)      10 .. 1796   centre  903
    // The rail is not aligned to the board but to the space left of the navigation, hence the
    // 200px offset. Ticket rail and toll buttons both live in bid-area, so one correction fixes
    // both.
    //
    // Moved with a transform: that changes only the painting, not the flow, and deleting the
    // property undoes it completely.
    function centreRail() {
        const rail = role('bid-area');
        if (!rail) return;

        if (!settings.centreRail) { rail.style.transform = ''; return; }

        const board = role('main-region') || role('lane-play-region');
        if (!board) return;

        // Reset first, or the measurement includes the offset we applied last time.
        rail.style.transform = '';
        const r = rail.getBoundingClientRect();
        const b = board.getBoundingClientRect();
        if (!r.width || !b.width) return;

        let offset = (b.left + b.width / 2) - (r.left + r.width / 2);

        // Do not push it into the navigation. On narrow windows the two close in on each other;
        // then whatever space actually exists applies, and in case of doubt the rail stays put.
        // Measured at the rightmost thing actually shown: Autobid, else Unbid, else the chips —
        // and while you are King, with all of them hidden, the toll controls.
        const chips = [settings.autobidButton && document.querySelector('.mcfo-autobid'),
                       settings.unbidButton && document.querySelector('.mcfo-unbid'), role('bid-rail'), role('king-toll-controls')]
            .find(e => e && e.getBoundingClientRect().width);
        const nav = role('nav-region');
        if (chips && nav) {
            const c = chips.getBoundingClientRect();
            const n = nav.getBoundingClientRect();
            if (c.width && n.width) {
                const room = n.left - 20 - c.right;
                if (offset > room) offset = Math.max(0, room);
            }
        }

        rail.style.transform = Math.abs(offset) < 1 ? '' : `translateX(${Math.round(offset)}px)`;
    }

    // =========================================================================================
    // 11. SETTINGS PANEL
    // =========================================================================================
    // The settings live in a window like everything else — same shell, own content instead of a
    // frame. Its key is not a path, so it can never collide with a page.
    const SETTINGS_KEY = '#settings';

    function showSettings() {
        const vorhanden = windows.get(SETTINGS_KEY);
        if (vorhanden && !vorhanden.lazy) {
            restoreWindow(SETTINGS_KEY);
            renderSettings(vorhanden.body);   // redrawn, so it never shows a stale state
            return;
        }
        if (vorhanden) windows.delete(SETTINGS_KEY);

        const w = makeWindow(SETTINGS_KEY, 'Settings',
                             { width: 560, height: Math.min(780, innerHeight - 60) });
        w.el.classList.add('mcfo-win--solid');
        renderSettings(w.body);
        drawTaskbar();
    }

    // =========================================================================================
    // 11b. HOW TO, CHANGELOG, WHAT'S NEW
    // =========================================================================================
    // Three windows of text, built like the settings window. The changelog is written for
    // players, not about the code: what changed for them. What's new opens by itself once there
    // is a new version — on every load until "Don't show this again" is ticked, then not before
    // the next version. Versions skipped in between are shown together.
    //
    // The version comes from the userscript manager (GM_info), so it cannot drift from @version;
    // the fallback is for managers without GM_info and has to be kept in step by hand.
    const SCRIPT_VERSION = (typeof GM_info !== 'undefined' && GM_info && GM_info.script && GM_info.script.version) || '6.25';
    const HOWTO_KEY = '#howto', CHANGELOG_KEY = '#changelog', WHATSNEW_KEY = '#whatsnew';
    const WHATSNEW_SEEN = 'mcfo_whatsnew_seen';   // the version whose What's new was dismissed for good

    // Newest first. The first entry is what What's new shows after a fresh install.
    const CHANGELOG = [
        { v: '6.25', date: '2026-09-24', items: ['A tomato thrown at you now shows as one small line in the chat - who threw it and when - instead of the picture, which the game showed only some of the time. An x on the line dismisses it, like on Discord. Switch it off under Chat.'] },
        { v: '6.24.1', date: '2026-09-24', items: ['The tileset name now comes in the colour of your theme.', 'Fixed: with a theme on, the dark curtain behind the tileset name stayed.'] },
        { v: '6.24', date: '2026-09-24', items: ['New tileset, no more blackout: instead of the full-screen picture over a dark curtain, the name of the new tileset fades in over the board, and the game stays visible behind it. Switch it off under Header if you miss the picture.'] },
        { v: '6.23.1', date: '2026-09-23', items: ['The game\'s new arena help is hidden: no more tooltips on the Tickets, Points, Gold and Diamonds cards, no "Arena help" button in the footer, no "?" beside the bid buttons and no currency guide in the sound controls.'] },
        { v: '6.23', date: '2026-09-22', items: [
            'New: a player bar you can put anywhere on the page. Skipping or pausing a track no longer means going through the settings - the bar sits where you drag it, remembers the spot, and is still there after a reload.',
            'It shows what is playing and from which album, has previous, play, next, shuffle and volume, and a line at the bottom for how far the track has got and how much of it is loaded. Clicking that line jumps to another place in the track.',
            'A music note next to the gear shows and hides the bar, and the button on the bar opens the whole soundtrack on the Sound page. Hiding the bar does not stop the music.',
            'The bar takes the look of your theme, Deluxe skins included.',
        ] },
        { v: '6.22.1', date: '2026-09-22', items: [
            'Fixed: a track could fall silent after a second or two, or stutter its way through the second half. The soundtrack is kept as raw WAV files of 12 to 69 MB, which need 192 kilobytes every single second to play - and the game\'s server sends these files at anything between 115 kilobytes and 1.2 megabytes a second. Whenever it sends less than a track eats, the music runs out of road.',
            'The player now waits until enough of the track has arrived before it plays on, and says so while it waits: one honest pause instead of a hiccup every two seconds. It stops waiting as soon as nothing more is arriving, so it never hangs about for nothing.',
            'A thin bar under the position shows how much of the track is loaded - the stutter has a reason, and now you can see it.',
            'Jumping with the bar stays quick: after a jump it only waits for a short run-up, not the full cushion.',
        ] },
        { v: '6.22', date: '2026-09-22', items: [
            'New: a music player on the Sound page. The game plays its soundtrack straight through one fixed list, and Next is the only way along it. This one lays the whole soundtrack out by album and lets you pick the track you want.',
            'Shuffle plays everything once before anything comes round a second time, and every track has a tick: take it off and it stays out of the rotation. Album headers tick their whole album on or off, and the search box finds a track by title or album.',
            'The music is streamed instead of downloaded. The game fetches each track whole before the first note, and those files are 12 to 69 MB - so a track now starts in a moment, the bar under it can be dragged anywhere in the track, and skipping costs next to nothing.',
            'Where you stopped is remembered. The same track comes back at the same place and waits there until you press Play - nothing ever starts by itself.',
            'The game\'s own music goes quiet whenever the player starts, so the two never play over each other. Switch the player off and the game\'s music controls are back where they were.',
        ] },
        { v: '6.21.2', date: '2026-09-21', items: [
            'The "View Achievements" link in the game\'s achievement pop-up now opens the Achievements window instead of loading the page over the whole tab. Any other link the game uses to one of the overlay pages is caught the same way.',
            'Clicking that link also closes the pop-up it came from, the same way its own button does, so the next one in line can show up.',
            'Middle-clicks, ctrl-clicks and links leading anywhere else are left alone — asking for a new tab still gives you one.',
        ] },
        { v: '6.21.1', date: '2026-09-20', items: [
            'Fixed: after closing the browser and opening it again, autobid could come back switched on and bid nothing, until the page was reloaded or the switch was turned off and on again. Two different things could keep it from starting, and both are gone.',
            'Autobid is now the first thing the script sets up, and every part of the start-up stands on its own. One part running into trouble used to take autobid down with it for the whole life of the page, without a word.',
            'The script reads which tile is up on which lane from the game\'s own connection. After a cold browser start it could come up a moment too late for that connection and never see a single lane, and autobid has nothing to bid on without them. It now picks the connection up afterwards as well.',
        ] },
        { v: '6.21', date: '2026-09-20', items: [
            'Credits is now in the account menu. The game added that page in its latest update and hung it behind the header button the gear takes the place of, so until now it had no way in.',
            'The game\'s own graphics levels are now on the Performance page, below your own levers: Auto, High, Balanced, Low, Minimal. They decide how sharply the board is drawn and whether marble trails and the king wall shadow are drawn at all. The game keeps the choice itself, so this is the same one its own menu sets, and the Performance tile says which level you are on.',
        ] },
        { v: '6.20.6', date: '2026-09-16', items: [
            'The Lost Bookshop: the sign now sits on top of the king tile like a little crest, so it no longer covers the king\'s name or crown.',
        ] },
        { v: '6.20.5', date: '2026-09-16', items: [
            'The Lost Bookshop: the sign now docks straight onto the top edge of the king tile, hanging from it like a little tab.',
        ] },
        { v: '6.20.4', date: '2026-09-16', items: [
            'The Lost Bookshop: the sign now reads "In a place called Lost, strange things are found." and hangs right above the king tile, where the header cards can no longer hide it. It follows the tile when the chat is folded away.',
        ] },
        { v: '6.20.3', date: '2026-09-16', items: [
            'The beverage buttons beside the attack button are now exactly as tall as it is, whatever the theme makes of them. The size slider still changes how wide they are and how big their symbol is.',
            'That also keeps the bar at the height the game measured it at, which is one way the king tile could end up standing out of line with the other two tiles.',
            'Fixed for good: the king tile could come back from a reload bigger than it should be, standing higher than the other two tiles with the bar pushed down. The game rebuilds the bar and measures the columns in the same breath, and for that one moment the bar was empty. It now always keeps the height of the attack button.',
        ] },
        { v: '6.20.2', date: '2026-09-16', items: [
            'Fixed: the king tile could stand a whole bar taller than the other two tiles, with the attack bar hanging below their bottom edge. The game had measured the column in a moment when the bar was empty, and only measures again when the chat is opened or closed. The script now notices the columns being out of line and has it measure again.',
        ] },
        { v: '6.20.1', date: '2026-09-16', items: [
            'Fixed: while a marble ran in the king tile, the attack bar disappeared and the king tile shrank to the size of the lanes. The bar now keeps its room while the game empties it, and the tile stays where it is.',
        ] },
        { v: '6.20', date: '2026-09-15', items: [
            'Attack when free can now try again until you are King (Settings, King tile, After a miss). After a lava bubble or a wall that holds, it starts over by itself: sits out the lava cooldown, unbids once, waits until your marble is free and attacks again. The button counts the tries; click it to stop. Every miss costs points.',
            'While Attack when free sits out a lava cooldown, your autobid keeps playing instead of pausing for three minutes.',
        ] },
        { v: '6.19', date: '2026-09-15', items: [
            'New settings page, On the throne: the moment you take the crown, your toll can go to a value of your choice by itself, and the beverages you pick are poured as soon as the game unlocks them. Pick one, a few or all 24 (four beverages, three sizes, gold or diamonds); the page adds up what that costs.',
            'Both are opt-in and happen once per reign, never again after a reload, always through the game\'s own buttons. A note on screen says what was done and what the game refused. Careful: beverages spend gold or diamonds for good.',
        ] },
        { v: '6.18', date: '2026-09-15', items: [
            'Six new Deluxe themes in a new group, Music: Die Ärzte (HELL and DUNKEL, and a bloodshot eye that follows your pointer), Linkin Park (sprayed concrete, black and yellow, every button in brackets), Kraftklub (stripes, yellow tickets, matchstick eyes), Goethes Erben (a dark stage, cyan light, faceless figures, a line of verse), Samsas Traum (an etched plate with a beetle crawling across it, candles, deep water) and Prinz Pi (a spinning record, a compass that never finds north).',
        ] },
        { v: '6.17', date: '2026-09-15', items: [
            'Two new Deluxe themes in a new group, Books: The Lost Bookshop (Der verschwundene Buchladen) — a wall of dark blue spines, ivy, the little yellow house in its nook — and Reading Nook: tea, a book page for a chat, a knitted blanket, fairy lights on the windowsill.',
        ] },
        { v: '6.16.2', date: '2026-09-15', items: [
            'Animations that ran in the header behind the cards now run in the footer, where you can see them: the dogfight in Star Wars, the time vortex of the TARDIS.',
            'Star Wars: the Purchase button on the Diamonds card is a lightsaber too.',
        ] },
        { v: '6.16.1', date: '2026-09-15', items: [
            'The cosmetics button in the chat header is a small symbol now instead of "Cosmetics on/off": sparkles, struck through while cosmetics are off. The words come as a tooltip.',
        ] },
        { v: '6.16', date: '2026-09-15', items: [
            'Seven new Deluxe themes in a new group, Film & TV: Supernatural, Breaking Bad, Back to the Future, Everything Everywhere, Star Wars, Vertigo and Cinema.',
            'Back to the Future puts the time circuits on top of the chat, the middle row showing your real date and time. In Everything Everywhere the googly eyes follow your pointer; in Star Wars the opening crawl runs above the chat and the buttons are lightsabers.',
        ] },
        { v: '6.15.1', date: '2026-09-15', items: [
            'The Marble Shop entry in the account menu is gone again — the Marble Shop is a tab in the Shop window, one click away.',
        ] },
        { v: '6.15', date: '2026-09-15', items: [
            'Marble Shop (game update v0.10.0): in the account menu, opening the shop straight at the Marble Trails.',
            'View Inventory in the Marble Shop now opens the inventory at your Marble Trails.',
        ] },
        { v: '6.14', date: '2026-09-15', items: [
            'A settings gear top right, in place of the game\'s sound button: one click to these settings. Switch in Settings › Header.',
            'Sound page in the settings: sound effects and music with their volumes, the track that is playing and Next. It works the game\'s own sound controls. Sound and music are switched off once when this version first loads; turn them on there whenever you like.',
        ] },
        { v: '6.13', date: '2026-09-15', items: [
            'Chat height follows the board: where the tiles leave room above and below, the chat gives up half of it, so chat and tiles come closer in height and everything stays centred. Measured from the window itself, whatever its size. Switch in Settings › Windows.',
            'Fixed: after a reload the king tile could stick out above the lanes until the window was resized. The board is now sized again as soon as the attack tray has loaded.',
        ] },
        { v: '6.12.1', date: '2026-09-15', items: [
            'New name: MCF Site Overhaul is now MarbleLuceFall. Your settings stay as they are. If your script manager now lists both names, remove the old one.',
        ] },
        { v: '6.12', date: '2026-09-15', items: [
            'The board follows the window: when the window changes size or moves to another screen, the lanes and the king tile are sized again to use all the room. The game itself only did that when the chat was opened or closed. Switch in Settings › Windows.',
            'Beverage buttons as symbols: a drop for Water, a flame for Lava, a bottle for Milk, a flask for Acid. The buttons now take the look of your theme; the name shows when you point at one. Settings › King tile › Show: Symbols or Names.',
        ] },
        { v: '6.11', date: '2026-09-15', items: [
            'King tray under the tile: the attack tray sits right under the king tile instead of at the bottom of the pane, and follows the size of the window. Switch in Settings › King tile.',
            'The king tray fits narrow screens: the attack button, the beverage buttons and their text shrink with the tray instead of being cut off.',
            'See-through board frames now also removes the outlines of the frames, so only the tiles are left.',
        ] },
        { v: '6.10', date: '2026-09-15', items: [
            'See-through board frames: the dark bars above and below the tiles and around the king tile are gone, so the page background shows through. The tiles themselves stay as they are. On by default; the switch is on the Theme page.',
        ] },
        { v: '6.9.1', date: '2026-09-15', items: [
            'Ninkasi theme: real cuneiform instead of made-up wedges. The header now carries line 3 of the Sumerian Hymn to Ninkasi, dnin-ka-si a zal-le u3-tud-da ("Ninkasi, given birth by the flowing water"), and the star in the chat header is the real sign DINGIR, written before every god\'s name.',
        ] },
        { v: '6.9', date: '2026-09-15', items: [
            'New Signature theme for ninkasi1001: Ninkasi, after the Sumerian goddess of beer. The chat is a glass of amber ale with a head of foam and bubbles rising through it, the header a clay tablet of cuneiform, the footer a barrel, and in the chat header a mug that raises a toast.',
        ] },
        { v: '6.8.1', date: '2026-09-15', items: [
            'Fixed: with a Deluxe theme the collapsed chat showed an empty strip — the open button and the count of new messages are back.',
        ] },
        { v: '6.8', date: '2026-09-15', items: [
            'Twelve new Deluxe themes, one for every game theme: Satisfactory (FICSIT steel, hazard stripes, a conveyor carrying ore over the footer), Super Mario (World 1-1, ? blocks that bump when you point at them), Zelda (the Triforce, fairies), Tetris (every button a block), Pac-Man (he eats his way along the footer, ghosts behind him), Portal (a portal on either side of the chat), Sonic (Green Hill, rings), Pokémon (the chat is a Pokédex), Game Boy (the chat is a Game Boy), Stardew Valley (wood and parchment, falling leaves), Hollow Knight (drifting soul) and World of Warcraft (gold frames, red buttons, an XP bar).',
            'Signature themes: Deluxe themes made for one account each, offered only while that account is signed in.',
            'The Deluxe page is sorted into Games, Film & TV and Signature.',
        ] },
        { v: '6.7', date: '2026-09-15', items: [
            'The ground between the boards takes the theme too: deepslate under Minecraft Deluxe, open space under TARDIS, and the gradient or pattern of every flag, mood and game theme. Before, it stayed black.',
            'Fix: the Purchase button on the Diamonds card looks like the other buttons under a Deluxe theme.',
        ] },
        { v: '6.6', date: '2026-09-15', items: [
            'Deluxe themes dress everything around the board: ticket chips, Rebellion, Unbid, Autobid, the beverage and attack buttons, the signs on the header cards, the pop-out button, every menu and popup and the game’s sound panel. Chips, beverages and prices keep their colours — only the shape changes.',
            'Minecraft Deluxe: menus and popups look like the windows now, stone with a black edge. The XP bar sits over the middle of the board, right above the ticket rail.',
            'TARDIS: windows arrive in one soft fade with a blue glow instead of blinking.',
            'Pages in windows no longer flash up in the game’s own colours before the theme takes over.',
            'Settings › Theme has two ways in, Basic and Deluxe, with Random and its timer on the first page — they hold for both.',
        ] },
        { v: '6.5', date: '2026-09-15', items: [
            'Deluxe themes: a new group in Settings › Theme that goes beyond colour — textures, scenery and moving effects over the whole frame of the page. The board itself stays as it is.',
            'Minecraft Deluxe: a grass-block header, stone and deepslate, dark oak behind the chat, hotbar buttons, an XP bar, windows like inventory screens, menus like item tooltips and XP orbs drifting through the chat. All pixel art of this script’s own.',
            'TARDIS: the chat becomes a police box — lamp on the roof, the POLICE PUBLIC CALL BOX sign, lit windows and panelled doors — under a starry sky with the time vortex; windows open with the title bar as the sign and materialise.',
            'Deluxe effects: Full, Subtle or Off. The performance levels and your system’s reduce-motion setting hold them down on their own.',
        ] },
        { v: '6.4.4', date: '2026-09-15', items: [
            'A theme’s background and pattern in the chat now also run behind its header — Chat, the room, Cosmetics and the collapse button — so the whole chat is one surface from top to bottom.',
        ] },
        { v: '6.4.3', date: '2026-09-15', items: [
            'Fix: a theme’s background and pattern in the chat reach all the way down, behind the message box and Send.',
            'The empty bar above the message box is gone — it is the game’s list of names for !tomato and the other targeted commands, and it stood there even with no list to show. The list itself now wears your theme. Settings › Chat › Tidy name suggestions.',
        ] },
        { v: '6.4.2', date: '2026-09-15', items: [
            'Fix: logged out, there was no way to log in — the account card opened this script’s menu instead of the game’s sign-in. While you are logged out the menu now offers “Log in with Twitch” (Settings, How to and Changelog stay), and the card says “Log in”.',
        ] },
        { v: '6.4.1', date: '2026-09-15', items: [
            'Fix: the chat stays at the newest message, also after a reload. It used to creep a bit upwards when names, fonts or pictures loaded late. Scrolled up to read, it stays where you are.',
            'What’s new comes ticked “Don’t show this again” — once read is enough. Untick it to see it on every load.',
        ] },
        { v: '6.4', date: '2026-09-15', items: [
            'Beverage panels stay open after you buy, so you can buy several in a row. A bought package greys out at once instead of a few seconds later.',
            'The chat’s message box grows with what you type, up to five lines, so a long message stays readable while you write it. Enter sends as before; Settings › Chat switches it off.',
            'New theme: World of Warcraft — a gold ring along header and footer, the gold and orange of the W as accents, and the blue of the globe behind it all.',
        ] },
        { v: '6.3.1', date: '2026-09-14', items: [
            'Fix: username styles in the chat (glow, outline, name colour and the rest) keep their look under every theme. The theme had painted over them.',
        ] },
        { v: '6.3', date: '2026-09-14', items: [
            'What’s new: this window. It opens once there is a new version; tick “Don’t show this again” and it waits for the next one.',
            'How to and Changelog in the account menu, right under Settings.',
            'Random theme: a different theme every time the page opens, and if you like every 5 to 60 minutes. Shuffle now picks one at once.',
            'Switches, pressed buttons and the chat’s Cosmetics switch take the theme’s accent instead of a fixed green.',
            'Upcoming tilesets say when each one starts — date and time in your own time zone — instead of “starts in”. The countdown is in the tooltip.',
        ] },
        { v: '6.2', date: '2026-09-14', items: [
            'Games: twelve new themes — Minecraft, Satisfactory, Super Mario, Zelda, Tetris, Pac-Man, Portal, Sonic, Pokémon, Game Boy, Stardew Valley and Hollow Knight.',
            'Custom gets a background: a gradient from hue to accent, and eleven patterns to pick from.',
            'The accent slider now colours buttons and lit borders, not just a few highlights.',
        ] },
        { v: '6.1', date: '2026-09-14', items: [
            '41 themes in groups: Classic, Pride, Moods and Editor themes.',
            'Flag and gradient themes: a band along header, footer, windows and menus, and a dark wash behind the big surfaces.',
            'Patterns: glitter, stripes, scanlines and a retro grid.',
            'Custom has its own accent slider.',
        ] },
        { v: '6.0', date: '2026-09-14', items: [
            'Colour themes for the whole page, in Settings under Theme. The board, the chips, chat cosmetics, rarities, gold and diamonds keep their colours.',
        ] },
        { v: '5.0.1', date: '2026-09-14', items: [
            'The frame rate counter sits in the Tickets card instead of half over the chat’s Send button.',
        ] },
        { v: '5.0', date: '2026-09-13', items: [
            'Autobid next to Unbid: one bid per tile, 1 to 100 tickets, and an optional risk protection that skips the all-or-nothing tiles and takes a stray bid back.',
        ] },
        { v: '4.2', date: '2026-09-13', items: [ 'Rebellion and Unbid step aside while you are King.' ] },
        { v: '4.1', date: '2026-09-13', items: [
            'Attack when free (opt-in): unbids, sits out lava, waits until your marble is free and then presses the game’s attack button.',
        ] },
        { v: '4.0.1', date: '2026-09-13', items: [ 'Buying diamonds from a window: Stripe opens in a window of its own instead of a white page.' ] },
        { v: '4.0', date: '2026-09-12', items: [
            'An Unbid button next to the chips.',
            'Settings in two levels: an overview, then one page per part of the page.',
            'Enhanced chat built in (opt-in): grouped messages, hidden system lines, text sizes.',
        ] },
        { v: '3.8 – 3.16', date: '2026-09-11', items: [
            'Performance levels and a frame rate counter.',
            'An own Rebellion panel with all tiers and a confirm step.',
            'Type the toll instead of clicking it up and down.',
            'The chat folds into a slim rail with a counter, or pops out into its own window.',
            'Parked windows survive a reload.',
        ] },
        { v: '3.0', date: '2026-09-09', items: [
            'Pages open as windows over the running game: move them, resize them, park them in a taskbar, several at once.',
        ] },
        { v: '1.0 – 2.x', date: '2026-09-09', items: [
            'King name and toll on the king tile, a gold beverage bar, a tidied footer, labelled header cards, extra ticket chips and a rail centred on the board.',
        ] },
    ];

    function howToSections() {
        return [
            { title: 'Getting around', items: [
                'Click your name for Profile, Dailies, Inventory, Achievements, Leaderboards, Settings, How to and Changelog. Logged out, the same menu offers Log in with Twitch.',
                'The header cards are signposts: Gold opens the Shop, Diamonds the packages, the tileset card the upcoming tilesets.',
                'Pages open as windows over the running game. Drag the title bar to move one, the corner to resize it, – parks it in the taskbar, Esc closes the top one.',
            ] },
            { title: 'Ticket rail', items: [
                'Rebellion sits left of the chips. The bigger chips fold away behind the arrow; 10K to 1B unlock at ten times their amount in tickets.',
                'Unbid takes your bid back out of the queue, the same as typing !unbid.',
                'Autobid bids on every tile for you: click it, switch it on, pick 1 to 100 tickets and choose risk protection. It pauses while you are King.',
            ] },
            { title: 'King tile', items: [
                'King name and toll stand on the tile; the beverage buttons sit left and right of the attack button. A beverage panel stays open after a purchase, so several can be bought in a row.',
                'On the throne you can type the toll instead of clicking it up and down.',
                'Attack when free (opt-in in Settings) waits until your marble is free and attacks for you. Set to try again, it starts over after every miss until you are King.',
                'On the throne (opt-in in Settings) sets your toll and pours the beverages you picked by itself when you take the crown, once per reign. Beverages spend gold or diamonds for good.',
            ] },
            { title: 'Chat', items: [
                'The chat folds into a slim rail with a counter for new messages, or pops out into a window of its own.',
                'The message box grows with long messages, up to five lines.',
                'While you are at the bottom, the chat stays at the newest message; scroll up to read and it stays put.',
                'Typing !tomato and a name opens a list of players to choose from; it only shows while there is something to choose.',
                'Enhanced chat (opt-in) groups messages by sender and hides the system lines you pick.',
            ] },
            { title: 'Music', items: [
                'Settings › Sound: the music player lays the game’s whole soundtrack out by album. Click a track to hear that one, take its tick off to keep it out of the rotation, or tick a whole album on or off at its heading.',
                'The note next to the gear puts a small player on the page: drag it where you like and it stays there. Previous, play, next, shuffle, volume, and a line that shows how far the track has got and how much of it has loaded - click the line to jump.',
                'Shuffle plays everything once before anything comes round again. The bar under the buttons goes anywhere in a track, and where you stopped is where it starts next time — nothing ever begins by itself.',
                'While the player is on, the game plays no music of its own. Switch it off and the game’s own music controls are back where they were.',
            ] },
            { title: 'Themes', items: [
                `Settings › Theme: ${THEMES.length} themes in ${new Set(THEMES.map(t => t.group)).size} groups. Random picks a new one on every load, and every few minutes if you like.`,
                'Custom: choose hue, accent and intensity, a gradient and a pattern.',
                'Deluxe themes go further than colour: textures, scenery and effects — a Deluxe version of every game theme, and the TARDIS. Under their tiles you choose how much moves: Full, Subtle or Off.',
            ] },
            { title: 'If something looks off', items: [
                'Every part can be switched off in Settings, and switching it off gives back the game’s own look.',
                'On a slower machine the Performance levels help; the frame rate counter shows the difference.',
            ] },
        ];
    }

    // "6.3" against "6.2.1", part by part; a range like "3.8 – 3.16" counts by its first number.
    function cmpVersion(a, b) {
        const parts = v => String(v).split(/[^\d.]/)[0].split('.').map(Number);
        const pa = parts(a), pb = parts(b);
        for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
            const d = (pa[i] || 0) - (pb[i] || 0);
            if (d) return d;
        }
        return 0;
    }
    const niceDate = iso => new Date(iso + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

    function docBox(body) {
        body.textContent = '';
        const box = document.createElement('div');
        box.className = 'mcfo-doc';
        body.appendChild(box);
        return box;
    }
    function docList(box, items) {
        const ul = document.createElement('ul');
        for (const text of items) { const li = document.createElement('li'); li.textContent = text; ul.appendChild(li); }
        box.appendChild(ul);
    }
    function docVersion(box, entry) {
        const head = document.createElement('div');
        head.className = 'mcfo-doc__ver';
        head.innerHTML = '<span class="mcfo-doc__vnum"></span><span class="mcfo-doc__date"></span>';
        head.firstChild.textContent = 'Version ' + entry.v;
        head.lastChild.textContent = niceDate(entry.date);
        box.appendChild(head);
        docList(box, entry.items);
    }
    function docButton(label, run, main) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'mcfo-doc__btn' + (main ? ' mcfo-doc__btn--main' : '');
        b.textContent = label;
        b.addEventListener('click', run);
        return b;
    }
    function docFoot(box, ...children) {
        const foot = document.createElement('div');
        foot.className = 'mcfo-doc__foot';
        foot.append(...children);
        box.appendChild(foot);
    }

    function showDocWindow(key, title, size, fill) {
        const have = windows.get(key);
        if (have && !have.lazy) { restoreWindow(key); fill(have.body); return have; }
        if (have) windows.delete(key);
        const w = makeWindow(key, title, size);
        w.el.classList.add('mcfo-win--solid');
        fill(w.body);
        drawTaskbar();
        return w;
    }

    function showHowTo() {
        showDocWindow(HOWTO_KEY, 'How to', { width: 540, height: Math.min(700, innerHeight - 80) }, body => {
            const box = docBox(body);
            const intro = document.createElement('p');
            intro.className = 'mcfo-doc__intro';
            intro.textContent = 'A short tour of what this script adds. Everything here can be switched off in Settings.';
            box.appendChild(intro);
            for (const s of howToSections()) {
                const h = document.createElement('h3');
                h.textContent = s.title;
                box.appendChild(h);
                docList(box, s.items);
            }
            docFoot(box, docButton('Changelog', showChangelog), docButton('Settings', showSettings, true));
        });
    }

    function showChangelog() {
        showDocWindow(CHANGELOG_KEY, 'Changelog', { width: 520, height: Math.min(700, innerHeight - 80) }, body => {
            const box = docBox(body);
            for (const entry of CHANGELOG) docVersion(box, entry);
            docFoot(box, docButton('How to', showHowTo));
        });
    }

    function readSeen() { try { return localStorage.getItem(WHATSNEW_SEEN); } catch (e) { return null; } }

    // At start-up: only if this version's news have not been dismissed for good.
    function maybeShowWhatsNew() {
        const seen = readSeen();
        if (seen && cmpVersion(seen, SCRIPT_VERSION) >= 0) return;
        showWhatsNew();
    }

    function showWhatsNew() {
        const height = Math.min(560, innerHeight - 80);
        const w = showDocWindow(WHATSNEW_KEY, 'What’s new', { width: 480, height }, renderWhatsNew);
        // In the middle, unless it was put somewhere else before.
        if (w && w.el && !Number.isFinite((loadWinState()[WHATSNEW_KEY] || {}).left)) {
            clampWindow(w.el, Math.round((innerWidth - 480) / 2), 90, 480, height);
        }
    }

    function renderWhatsNew(body) {
        const box = docBox(body);
        const seen = readSeen();
        // Everything newer than the version last dismissed; after a fresh install, this version.
        const news = seen ? CHANGELOG.filter(e => cmpVersion(e.v, seen) > 0 && cmpVersion(e.v, SCRIPT_VERSION) <= 0) : [];
        const list = news.length ? news : [CHANGELOG[0]];
        const intro = document.createElement('p');
        intro.className = 'mcfo-doc__intro';
        intro.textContent = list.length > 1 ? `New since version ${seen}:`
                          : seen ? 'New in this version:' : 'Welcome! New in this version — and How to has a short tour of everything else:';
        box.appendChild(intro);
        for (const entry of list) docVersion(box, entry);

        const check = document.createElement('label');
        check.className = 'mcfo-doc__check';
        check.innerHTML = '<input type="checkbox"><span>Don’t show this again</span>';
        const input = check.querySelector('input');
        // Ticked from the start (6.4): once read is enough for most people, so this version counts
        // as seen as soon as the window shows. Whoever wants it back on every load unticks it.
        // Unticked: back to what was stored before, so skipped versions are not lost.
        const before = seen === SCRIPT_VERSION ? null : seen;
        input.checked = true;
        try { localStorage.setItem(WHATSNEW_SEEN, SCRIPT_VERSION); } catch (e) {}
        input.addEventListener('change', () => {
            try {
                if (input.checked) localStorage.setItem(WHATSNEW_SEEN, SCRIPT_VERSION);
                else if (before) localStorage.setItem(WHATSNEW_SEEN, before);
                else localStorage.removeItem(WHATSNEW_SEEN);
            } catch (e) {}
        });
        docFoot(box, check, docButton('Changelog', showChangelog), docButton('How to', showHowTo),
                docButton('Got it', () => closeWindow(WHATSNEW_KEY), true));
    }

    // Two levels since 4.0: an overview with one tile per page, and the page itself. One long
    // scroll through every switch had grown to eight chapters — finding one meant reading all.
    // The page you are on is kept while the window lives; a fresh load starts at the overview.
    let settingsView = null;      // null = overview, otherwise a section title
    let settingsRedraw = null;    // redraws whatever is showing (for switches other switches need)

    function renderSettings(body) {
        const box = document.createElement('div');
        box.className = 'mcfo-set';
        const section = settingsView && SETTINGS_SECTIONS.find(x => x.title === settingsView);
        if (!section) settingsView = null;
        box.setAttribute('data-view', settingsView || '');
        settingsRedraw = () => renderSettings(body);
        if (section) settingsPage(box, body, section); else settingsOverview(box, body);

        // Keep the scroll position when redrawing the same page, or every switch that greys
        // others would jump back to the top. A different page starts at the top.
        const alt = body.querySelector('.mcfo-set');
        const same = alt && alt.getAttribute('data-view') === box.getAttribute('data-view');
        body.replaceChildren(box);
        if (same) box.scrollTop = alt.scrollTop;
    }

    function settingsOverview(box, body) {
        themeView = null;   // the Theme page opens on its landing page again
        const intro = document.createElement('div');
        intro.className = 'mcfo-set__intro';
        intro.textContent = 'Pick a part of the page. Every switch works at once, nothing needs saving.';
        box.appendChild(intro);

        const tiles = document.createElement('div');
        tiles.className = 'mcfo-set__tiles';
        for (const section of SETTINGS_SECTIONS) {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'mcfo-set__tile';
            b.innerHTML = '<span class="mcfo-set__tile-title"></span><span class="mcfo-set__tile-blurb"></span>'
                        + '<span class="mcfo-set__tile-state"></span><span class="mcfo-set__tile-arrow" aria-hidden="true">\u203A</span>';
            b.querySelector('.mcfo-set__tile-title').textContent = section.title;
            b.querySelector('.mcfo-set__tile-blurb').textContent = section.blurb || '';
            const st = sectionState(section);
            const stEl = b.querySelector('.mcfo-set__tile-state');
            stEl.textContent = st.text;
            stEl.toggleAttribute('data-none', st.none);
            b.addEventListener('click', () => { settingsView = section.title; renderSettings(body); });
            tiles.appendChild(b);
        }
        box.appendChild(tiles);
        box.appendChild(settingsFoot('Reset all', () => Object.assign(settings, settingDefaults), body));
    }

    // What a tile says about its page: how many of its switches are on, or the chosen level.
    function sectionState(section) {
        if (section.render === 'theme') {
            const t = THEMES.find(x => x.id === settings.themeId) || THEMES[0];
            return { text: 'Theme: ' + t.label, none: t.id === 'original' };
        }
        if (section.render === 'performance') {
            const level = PERF_LEVELS.find(l => l.id === settings.perfLevel) || PERF_LEVELS[0];
            const g = graphicsState();
            return { text: 'Level: ' + level.label + (g ? ' \u00b7 Graphics: ' + g.label(g.mode) : ''),
                     none: level.id === 'off' && (!g || g.mode === 'auto') };
        }
        if (section.render === 'sound') {
            const s = soundState();
            if (!s) return { text: 'Not loaded yet', none: true };
            const chosen = musicFind(music.id);
            const musicText = settings.musicPlayer
                ? (musicIsPlaying() && chosen ? 'Playing: ' + chosen.title : 'Player on')
                : `Music ${s.music ? 'on' : 'off'}`;
            return { text: `Effects ${s.sfx ? 'on' : 'off'} \u00b7 ${musicText}`,
                     none: !s.sfx && !s.music && !settings.musicPlayer };
        }
        const items = sectionItems(section);
        const on = items.filter(i => settings[i.key] && (!i.needs || settings[i.needs])).length;
        return { text: `${on} of ${items.length} on`, none: on === 0 };
    }

    function sectionKeys(section) {
        if (section.render === 'theme') return ['themeId', 'themeHue', 'themeTint', 'themeAccent', 'themeGradient', 'themePattern', 'themeRandom', 'themeRotate', 'themeFx', 'boardClear'];
        if (section.render === 'performance') return ['perfLevel', 'perfFpsMeter', ...PERF_LEVERS.map(l => l.key)];
        // The game keeps its own sound (11c); only the player's own settings are ours (11e).
        if (section.render === 'sound') return ['musicPlayer', 'musicBar', 'musicShuffle', 'musicVolume'];
        const keys = [];
        for (const item of sectionItems(section)) { keys.push(item.key); for (const sub of itemSubs(item)) keys.push(sub.key); }
        if (section.throne) keys.push('throneDrinkSet');
        return keys;
    }

    function settingsPage(box, body, section) {
        const crumb = document.createElement('div');
        crumb.className = 'mcfo-set__crumb';
        const back = document.createElement('button');
        back.type = 'button';
        back.className = 'mcfo-set__back';
        back.textContent = '\u2039 All settings';
        back.addEventListener('click', () => { settingsView = null; renderSettings(body); });
        const title = document.createElement('span');
        title.className = 'mcfo-set__crumb-title';
        title.textContent = section.title;
        crumb.append(back, title);
        box.appendChild(crumb);

        if (section.render === 'performance') {
            box.appendChild(performanceCard(() => renderSettings(body)));
            const gt = document.createElement('div');
            gt.className = 'mcfo-set__sub-title';
            gt.textContent = 'The game\'s own graphics';
            box.append(gt, graphicsCard(() => renderSettings(body)));
        } else if (section.render === 'theme') {
            box.appendChild(themeCard(() => renderSettings(body)));
        } else if (section.render === 'sound') {
            box.appendChild(soundCard(() => renderSettings(body)));
        } else {
            if (section.throne) box.appendChild(throneNotice());
            const card = document.createElement('div');
            card.className = 'mcfo-set__card';
            for (const item of section.items) card.appendChild(settingItem(item));
            box.appendChild(card);
            if (section.throne) box.appendChild(throneDrinksCard());

            if (section.grid) {
                const sub = document.createElement('div');
                sub.className = 'mcfo-set__sub-title';
                sub.textContent = section.grid.title;
                box.appendChild(sub);
                const grid = document.createElement('div');
                grid.className = 'mcfo-set__card mcfo-set__grid';
                for (const item of section.grid.items) grid.appendChild(settingItem(item));
                box.appendChild(grid);
            }
            if (section.extra) {
                const sub = document.createElement('div');
                sub.className = 'mcfo-set__section';
                sub.textContent = section.extra.title;
                box.appendChild(sub);
                if (section.title === 'Chat' && chatSlimPresent()) {
                    const note = document.createElement('div');
                    note.className = 'mcfo-set__notice';
                    note.textContent = 'The separate chat script (Chat Slim / Chat Pro Customizer) is still installed. '
                        + 'Everything it did is part of this script now — remove it in Tampermonkey and reload. '
                        + 'Until then the enhanced chat here stays idle, so the two do not work against each other.';
                    box.appendChild(note);
                }
                const card2 = document.createElement('div');
                card2.className = 'mcfo-set__card';
                for (const item of section.extra.items) card2.appendChild(settingItem(item));
                box.appendChild(card2);
            }
        }
        box.appendChild(settingsFoot('Reset this page', () => {
            if (section.render === 'sound') {
                soundOff();                      // the default there: both off
                musicPause();
                settings.musicExcluded = [];     // a new array, never the one behind the defaults
                music.queue = [];
            }
            for (const k of sectionKeys(section)) settings[k] = settingDefaults[k];
        }, body));
    }

    function settingsFoot(label, reset, body) {
        const foot = document.createElement('div');
        foot.className = 'mcfo-set__foot';
        foot.innerHTML = '<span>Changes apply at once and are saved in this browser.</span><button type="button"></button>';
        const b = foot.querySelector('button');
        b.textContent = label;
        b.addEventListener('click', () => { reset(); saveSettings(); apply(); renderSettings(body); });
        return foot;
    }

    // The level picker on top, the levers below. The levers always show what is in effect; on a
    // fixed level they show that level's mix, and touching one turns it into Custom, starting
    // from exactly what was on screen — so "Light, but with the crown turning" is one click.
    function performanceCard(redraw) {
        const card = document.createElement('div');
        card.className = 'mcfo-set__card';

        const top = document.createElement('div');
        top.className = 'mcfo-perf__top';
        const seg = document.createElement('div');
        seg.className = 'mcfo-seg mcfo-perf__levels';
        for (const level of PERF_LEVELS) {
            const b = document.createElement('button');
            b.type = 'button';
            b.textContent = level.label;
            b.setAttribute('aria-pressed', settings.perfLevel === level.id ? 'true' : 'false');
            b.addEventListener('click', () => {
                if (settings.perfLevel === level.id) return;
                if (level.id === 'custom') adoptLevelAsCustom();
                settings.perfLevel = level.id;
                saveSettings(); apply(); redraw();
            });
            seg.appendChild(b);
        }
        const text = document.createElement('div');
        text.className = 'mcfo-perf__text';
        text.textContent = (PERF_LEVELS.find(l => l.id === settings.perfLevel) || PERF_LEVELS[0]).text;
        top.append(seg, text);
        card.appendChild(top);

        const levers = document.createElement('div');
        levers.className = 'mcfo-perf__levers';
        for (const lever of PERF_LEVERS) {
            levers.appendChild(lever.type === 'choice'
                ? perfChoiceItem(lever, redraw)
                : perfSwitchItem(lever, redraw));
        }
        // Not part of any level: a measuring tool, not a saving.
        levers.appendChild(plainSwitchItem({ key: 'perfFpsMeter', label: 'Show frame rate',
            hint: 'A small counter bottom right, to compare the levels on your own machine.' }));
        card.appendChild(levers);
        return card;
    }

    // =========================================================================================
    // 11c. SOUND: THE GAME'S OWN CONTROLS, FROM THE SETTINGS (6.14)
    // =========================================================================================
    // The game's sound sits behind the speaker button top right (app.js soundControlDom): effects
    // on/off and volume, music on/off, volume and next track. The game keeps the state itself
    // (m39.sound.* in localStorage, soundRuntime.js) and redraws every copy of these controls from
    // it (syncSoundControls). The Sound page keeps no second copy: it reads the game's controls and
    // works them — a click on a button, a value and an input event on a slider, which is exactly
    // what the game listens for (one click and one input listener on its root). So the game's own
    // rules stay in force, like a volume above 0 switching the effects back on.
    const soundEl = r => document.querySelector(`[data-role="sound-utility-panel"] [data-role="${r}"]`)
        || document.querySelector(`[data-role="${r}"]`);
    function soundState() {
        const mute = soundEl('sound-mute-toggle'), music = soundEl('music-enabled-toggle');
        if (!mute || !music) return null;
        const next = soundEl('music-next-track');
        const hint = soundEl('sound-status-hint');
        return {
            sfx: mute.getAttribute('aria-pressed') !== 'true',   // pressed = muted
            sfxVol: Number((soundEl('sound-volume-range') || {}).value) || 0,
            music: music.getAttribute('aria-pressed') === 'true',
            musicVol: Number((soundEl('music-volume-range') || {}).value) || 0,
            track: ((soundEl('music-track-label') || {}).textContent || '').trim(),
            nextOk: !!next && !next.disabled,
            locked: !!hint && hint.style.display !== 'none',
        };
    }
    function soundClick(r) { const b = soundEl(r); if (b) b.click(); }
    function soundSlide(r, v) {
        const el = soundEl(r);
        if (!el) return;
        el.value = String(v);
        el.dispatchEvent(new Event('input', { bubbles: true }));
    }
    function soundOff() {
        const s = soundState();
        if (!s) return;
        if (s.sfx) soundClick('sound-mute-toggle');
        if (s.music) soundClick('music-enabled-toggle');
    }

    // Off unless turned on: once, the game's effects and music are switched off with its own
    // buttons — tried on every beat until its controls answer. From then on the game's own memory
    // holds whatever is chosen on the Sound page. The mark is a key of its own: the settings object
    // only keeps the keys it knows, and a lost mark would switch the sound off on every load.
    const SOUND_DEFAULTED_KEY = 'mcfo_sound_defaulted';
    function soundDefaultOnce() {
        try { if (localStorage.getItem(SOUND_DEFAULTED_KEY) === '1') return; } catch (e) { return; }
        if (!soundState()) return;
        soundOff();
        const after = soundState();
        if (after && !after.sfx && !after.music) {
            try { localStorage.setItem(SOUND_DEFAULTED_KEY, '1'); } catch (e) {}
        }
    }

    function soundCard(redraw) {
        const card = document.createElement('div');
        card.className = 'mcfo-set__card';
        const s = soundState();
        if (!s) {
            const note = document.createElement('div');
            note.className = 'mcfo-set__notice';
            note.textContent = 'The game has not drawn its sound controls yet. Open this page again in a moment.';
            card.appendChild(note);
            return card;
        }
        card.appendChild(soundItem('Sound effects', 'Marbles, bumpers, the crown: every sound of the board.', s.sfx,
            on => { if (on !== soundState().sfx) soundClick('sound-mute-toggle'); redraw(); },
            s.sfxVol, v => soundSlide('sound-volume-range', v), redraw));
        // Our own player (11e), and under it the game's music the way it always was - but only
        // while the player is off, so there are never two sets of music controls at once.
        card.appendChild(musicItem(redraw));
        if (!settings.musicPlayer) {
            const gameMusic = soundItem('The game\'s music', 'Its own soundtrack, played straight through its own list.', s.music,
                on => { if (on !== soundState().music) soundClick('music-enabled-toggle'); redraw(); },
                s.musicVol, v => soundSlide('music-volume-range', v), redraw);
            const track = document.createElement('div');
            track.className = 'mcfo-set__sub';
            track.toggleAttribute('data-off', !s.music);
            track.innerHTML = '<span class="mcfo-set__sublabel">Track</span><span class="mcfo-sound__track"></span>'
                            + '<button type="button" class="mcfo-set__reset">Next</button>';
            track.querySelector('.mcfo-sound__track').textContent = s.track || 'No track';
            const next = track.querySelector('button');
            next.disabled = !s.nextOk;
            // The game loads the next track before it names it: redrawn a moment later.
            next.addEventListener('click', () => { soundClick('music-next-track'); setTimeout(redraw, 600); });
            gameMusic.appendChild(track);
            card.appendChild(gameMusic);
        }
        if (s.locked) {
            const note = document.createElement('div');
            note.className = 'mcfo-set__notice';
            note.textContent = 'Your browser only lets the page play sound after your first click on it.';
            card.appendChild(note);
        }
        return card;
    }

    // A switch with a volume slider under it, drawn like settingItem, but reading and writing the
    // game's controls instead of a setting.
    function soundItem(label, hint, on, setOn, volume, setVolume, redraw) {
        const wrap = document.createElement('div');
        wrap.className = 'mcfo-set__item';
        const row = document.createElement('label');
        row.className = 'mcfo-set__row';
        row.innerHTML = '<span class="mcfo-set__text"><span class="mcfo-set__label"></span>'
                      + '<span class="mcfo-set__hint"></span></span>'
                      + '<input type="checkbox" class="mcfo-switch__input">'
                      + '<span class="mcfo-switch" aria-hidden="true"></span>';
        row.querySelector('.mcfo-set__label').textContent = label;
        row.querySelector('.mcfo-set__hint').textContent = hint;
        const input = row.querySelector('input');
        input.checked = on;
        input.addEventListener('change', () => setOn(input.checked));
        wrap.appendChild(row);

        const sub = document.createElement('div');
        sub.className = 'mcfo-set__sub';
        sub.toggleAttribute('data-off', !on);
        sub.innerHTML = '<span class="mcfo-set__sublabel">Volume</span>'
                      + '<input type="range" class="mcfo-set__range" min="0" max="100" step="1"><span class="mcfo-set__val"></span>';
        const range = sub.querySelector('input');
        const val = sub.querySelector('.mcfo-set__val');
        range.value = String(volume);
        val.textContent = volume + '%';
        range.addEventListener('input', () => { val.textContent = range.value + '%'; setVolume(Number(range.value)); });
        range.addEventListener('change', redraw);
        wrap.appendChild(sub);
        return wrap;
    }

    // The gear in place of the game's sound button (CSS in section 2).
    const GEAR_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true">'
        + '<circle cx="12" cy="12" r="3.3" fill="none" stroke="currentColor" stroke-width="1.8"/>'
        + '<path d="M19.4 13.5a7.6 7.6 0 0 0 0-3l2-1.6-2-3.4-2.4.9a7.5 7.5 0 0 0-2.6-1.5L14 2.4h-4l-.4 2.5A7.5 7.5 0 0 0 7 6.4l-2.4-.9-2 3.4 2 1.6a7.6 7.6 0 0 0 0 3l-2 1.6 2 3.4 2.4-.9a7.5 7.5 0 0 0 2.6 1.5l.4 2.5h4l.4-2.5a7.5 7.5 0 0 0 2.6-1.5l2.4.9 2-3.4Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    // The gear and the music note share one cell of the header grid: profile-sound-cell is a two
    // column grid (account card | button), so a third child would drop into a new row. They go
    // into a box of their own instead.
    function buildHeaderButtons() {
        document.documentElement.setAttribute('data-mcfo-gear', settings.settingsButton ? '1' : '0');
        const cell = role('profile-sound-cell');
        const wantNote = settings.musicPlayer;
        let box = document.querySelector('.mcfo-hdr');
        if ((!settings.settingsButton && !wantNote) || !cell) { if (box) box.remove(); return; }
        if (!box || box.parentElement !== cell) {
            if (box) box.remove();
            box = document.createElement('div');
            box.className = 'mcfo-hdr';
            const native = role('sound-utility-toggle');
            if (native) native.after(box); else cell.appendChild(box);
        }

        let note = box.querySelector('.mcfo-note');
        if (wantNote && !note) {
            note = document.createElement('button');
            note.type = 'button';
            note.className = 'mcfo-note';
            note.innerHTML = NOTE_SVG;
            note.addEventListener('click', e => {
                e.preventDefault(); e.stopPropagation();
                settings.musicBar = !settings.musicBar;
                saveSettings();
                buildMusicBar();
                buildHeaderButtons();
            });
            box.prepend(note);
        } else if (!wantNote && note) {
            note.remove();
            note = null;
        }
        if (note) {
            const on = settings.musicBar;
            note.title = on ? 'Hide the player bar' : 'Show the player bar';
            note.setAttribute('aria-label', note.title);
            note.setAttribute('aria-pressed', on ? 'true' : 'false');
        }

        let gear = box.querySelector('.mcfo-gear');
        if (settings.settingsButton && !gear) {
            gear = document.createElement('button');
            gear.type = 'button';
            gear.className = 'mcfo-gear';
            gear.title = 'MarbleLuceFall settings';
            gear.setAttribute('aria-label', 'MarbleLuceFall settings');
            gear.innerHTML = GEAR_SVG;
            gear.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); showSettings(); });
            box.appendChild(gear);
        } else if (!settings.settingsButton && gear) {
            gear.remove();
        }
    }

    // The theme page: one tile per theme with its colours, and for Custom a hue and an
    // intensity slider that repaint the page while they move.
    // Two levels since 6.6: first what holds for every theme (random, rotation) and two ways in —
    // Basic, the colour themes with Custom among them, and Deluxe, the themes with a skin — then
    // the tiles of the one picked. Kept in RAM like the settings page itself.
    let themeView = null;   // null = the landing page, else 'basic' or 'deluxe'
    const themeIsDeluxe = t => !!(t && t.skin);
    const THEME_FOOT = 'The board, the chips, chat cosmetics, rarities, gold and diamonds keep their colours: they mean something.';

    function themeCard(redraw) {
        const card = document.createElement('div');
        card.className = 'mcfo-set__card mcfo-theme';
        if (!themeView) {
            card.appendChild(themeRandomBlock(redraw));
            card.appendChild(themeCategories(redraw));
            card.appendChild(themeToggle('See-through board frames', 'boardClear',
                'Removes the dark bars above and below the tiles and around the king tile, so the page background shows through.', applyBoardClear));
            const foot = document.createElement('div');
            foot.className = 'mcfo-theme__foot';
            foot.textContent = THEME_FOOT;
            card.appendChild(foot);
            return card;
        }
        const head = document.createElement('div');
        head.className = 'mcfo-theme__cathead';
        const back = document.createElement('button');
        back.type = 'button';
        back.className = 'mcfo-set__back';
        back.textContent = '\u2039 Theme';
        back.addEventListener('click', () => { themeView = null; redraw(); });
        const title = document.createElement('span');
        title.className = 'mcfo-set__crumb-title';
        title.textContent = themeView === 'deluxe' ? 'Deluxe themes' : 'Basic themes';
        head.append(back, title);
        card.appendChild(head);
        // One heading and grid per group, in the order THEMES lists them — the groups of this level.
        const groups = [...new Set(THEMES.filter(t => (themeView === 'deluxe') === themeIsDeluxe(t) && themeVisible(t)).map(t => t.group))];
        for (const group of groups) {
            const head = document.createElement('div');
            head.className = 'mcfo-theme__group';
            head.textContent = group;
            card.appendChild(head);
            const grid = document.createElement('div');
            grid.className = 'mcfo-theme__grid';
            for (const t of THEMES.filter(x => x.group === group && themeVisible(x) && (themeView === 'deluxe') === themeIsDeluxe(x))) {
                const b = document.createElement('button');
                b.type = 'button';
                b.className = 'mcfo-theme__pick';
                b.setAttribute('data-mcfo-theme-id', t.id);
                b.setAttribute('aria-pressed', settings.themeId === t.id ? 'true' : 'false');
                b.innerHTML = '<span class="mcfo-theme__swatches"></span><span class="mcfo-theme__name"></span><span class="mcfo-theme__note"></span>';
                b.querySelector('.mcfo-theme__name').textContent = t.label;
                b.querySelector('.mcfo-theme__note').textContent = t.note;
                paintSwatches(b.querySelector('.mcfo-theme__swatches'), t);
                // Deluxe themes show a piece of their skin instead of the five swatches.
                if (t.skin && SKINS[t.skin]) {
                    b.classList.add('mcfo-theme__pick--deluxe');
                    const prev = document.createElement('span');
                    prev.className = 'mcfo-theme__preview';
                    prev.style.cssText = SKINS[t.skin].tile(skinAssets(t.skin));
                    const badge = document.createElement('span');
                    badge.className = 'mcfo-theme__badge';
                    badge.textContent = 'DELUXE';
                    prev.appendChild(badge);
                    b.querySelector('.mcfo-theme__swatches').replaceWith(prev);
                }
                // Themes with a flag or gradient show it under their swatches.
                if (t.stripe) {
                    const band = document.createElement('span');
                    band.className = 'mcfo-theme__stripe';
                    band.style.background = stripeGradient(t, '90deg');
                    b.querySelector('.mcfo-theme__swatches').after(band);
                }
                b.addEventListener('click', () => {
                    if (settings.themeId === t.id) return;
                    settings.themeId = t.id;
                    saveSettings();
                    themeTick();
                    redraw();
                });
                grid.appendChild(b);
            }
            card.appendChild(grid);
        }
        // Under all Deluxe groups (Games, Film & TV, Signature) — once, not per group.
        if (themeView === 'deluxe') card.appendChild(themeFxBlock());

        if (themeView === 'basic' && settings.themeId === 'custom') {
            const custom = document.createElement('div');
            custom.className = 'mcfo-theme__custom';
            custom.appendChild(themeSlider('Hue', 'themeHue', 0, 359, '°', true, card));
            custom.appendChild(themeSlider('Accent', 'themeAccent', 0, 359, '°', true, card));
            custom.appendChild(themeSlider('Intensity', 'themeTint', 0, 200, '%', false, card));
            const hint = document.createElement('div');
            hint.className = 'mcfo-theme__hint';
            hint.textContent = 'Hue colours the surfaces, borders and text. Accent colours buttons, lit borders and highlights, '
                             + 'and with a gradient or a pattern it is the gradient’s second colour and the colour of the pattern.';
            custom.appendChild(hint);
            custom.appendChild(themeToggle('Gradient', 'themeGradient',
                'A band along the edges and a dark wash from hue to accent, like the flag themes.'));
            custom.appendChild(themePatternPicker());
            card.appendChild(custom);
        }
        const foot = document.createElement('div');
        foot.className = 'mcfo-theme__foot';
        foot.textContent = THEME_FOOT;
        card.appendChild(foot);
        return card;
    }

    // The two ways in, as tiles like those of the settings overview, each with a glimpse of what
    // is inside: the theme in use if it is there, else a sample.
    function themeCategories(redraw) {
        const tiles = document.createElement('div');
        tiles.className = 'mcfo-set__tiles mcfo-theme__cats';
        const current = THEMES.find(t => t.id === settings.themeId) || THEMES[0];
        const cats = [
            { id: 'basic', title: 'Basic themes', blurb: 'Colour for the whole page: classics, pride flags, moods, games, editor themes — or your own.' },
            { id: 'deluxe', title: 'Deluxe themes', blurb: 'Textures, scenery and effects over the whole frame of the page.' },
        ];
        for (const cat of cats) {
            const list = THEMES.filter(t => (cat.id === 'deluxe') === themeIsDeluxe(t) && themeVisible(t));
            const inUse = (cat.id === 'deluxe') === themeIsDeluxe(current);
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'mcfo-set__tile';
            b.setAttribute('data-mcfo-theme-cat', cat.id);
            b.innerHTML = '<span class="mcfo-theme__catprev"></span><span class="mcfo-set__tile-title"></span><span class="mcfo-set__tile-blurb"></span>'
                        + '<span class="mcfo-set__tile-state"></span><span class="mcfo-set__tile-arrow" aria-hidden="true">\u203A</span>';
            b.querySelector('.mcfo-set__tile-title').textContent = cat.title;
            b.querySelector('.mcfo-set__tile-blurb').textContent = cat.blurb;
            const st = b.querySelector('.mcfo-set__tile-state');
            st.textContent = `${list.length} themes` + (inUse ? ` · in use: ${current.label}` : '');
            st.toggleAttribute('data-none', !inUse);
            const sample = inUse ? current : (cat.id === 'deluxe' ? list[0] : THEMES.find(t => t.id === 'midnight') || list[0]);
            const prev = b.querySelector('.mcfo-theme__catprev');
            if (sample && sample.skin && SKINS[sample.skin]) prev.style.cssText = SKINS[sample.skin].tile(skinAssets(sample.skin));
            else if (sample) { prev.classList.add('mcfo-theme__swatches'); paintSwatches(prev, sample); }
            b.addEventListener('click', () => { themeView = cat.id; redraw(); });
            tiles.appendChild(b);
        }
        return tiles;
    }

    // How much a Deluxe theme may move, right under its tiles. The note says so when a
    // performance level holds it lower than chosen.
    function themeFxBlock() {
        const box = document.createElement('div');
        box.className = 'mcfo-theme__fx';
        const row = document.createElement('div');
        row.className = 'mcfo-theme__rotate';
        const label = document.createElement('span');
        label.className = 'mcfo-theme__toggle-label';
        label.textContent = 'Deluxe effects';
        const seg = document.createElement('div');
        seg.className = 'mcfo-seg';
        const hint = document.createElement('div');
        hint.className = 'mcfo-theme__hint';
        const writeHint = () => {
            const eff = skinFxEffective();
            const name = v => (THEME_FX_OPTIONS.find(o => o[0] === v) || [v, v])[1];
            hint.textContent = 'Full: particles and moving backgrounds. Subtle: only a glow here and there. Off: a still picture.'
                + (eff !== settings.themeFx ? ` Held at ${name(eff)} right now by the performance level or your system’s reduce-motion setting.` : '');
        };
        for (const [value, text] of THEME_FX_OPTIONS) {
            const b = document.createElement('button');
            b.type = 'button';
            b.textContent = text;
            b.setAttribute('data-mcfo-fx-choice', value);
            b.setAttribute('aria-pressed', settings.themeFx === value ? 'true' : 'false');
            b.addEventListener('click', () => {
                settings.themeFx = value;
                saveSettings();
                skinTick();
                for (const o of seg.children) o.setAttribute('aria-pressed', o === b ? 'true' : 'false');
                writeHint();
            });
            seg.appendChild(b);
        }
        writeHint();
        row.append(label, seg);
        box.append(row, hint);
        return box;
    }

    // Random on load, the rotation timer and a button to shuffle at once — above the tiles.
    function themeRandomBlock(redraw) {
        const box = document.createElement('div');
        box.className = 'mcfo-theme__random';
        box.appendChild(themeToggle('Random theme', 'themeRandom',
            'A different theme every time the page opens or reloads. Crownfall and Custom are left out.',
            () => { scheduleThemeRotation(); redraw(); }));
        const row = document.createElement('div');
        row.className = 'mcfo-theme__rotate';
        row.toggleAttribute('data-off', !settings.themeRandom);
        const label = document.createElement('span');
        label.className = 'mcfo-theme__toggle-label';
        label.textContent = 'Change every';
        const seg = document.createElement('div');
        seg.className = 'mcfo-seg';
        for (const [value, text] of THEME_ROTATE_OPTIONS) {
            const b = document.createElement('button');
            b.type = 'button';
            b.textContent = text;
            b.disabled = !settings.themeRandom;
            b.setAttribute('aria-pressed', settings.themeRotate === value ? 'true' : 'false');
            b.addEventListener('click', () => {
                settings.themeRotate = value;
                saveSettings();
                scheduleThemeRotation();
                for (const o of seg.children) o.setAttribute('aria-pressed', o === b ? 'true' : 'false');
            });
            seg.appendChild(b);
        }
        row.append(label, seg);
        const shuffle = document.createElement('button');
        shuffle.type = 'button';
        shuffle.className = 'mcfo-theme__shuffle';
        shuffle.textContent = 'Shuffle now';
        shuffle.title = 'Pick a random theme right away';
        shuffle.addEventListener('click', () => randomTheme());
        box.append(row, shuffle);
        return box;
    }

    // A switch on the theme page (Custom's gradient, Random). after runs once the change is in.
    function themeToggle(label, key, hint, after) {
        const row = document.createElement('label');
        row.className = 'mcfo-theme__toggle';
        row.innerHTML = '<span><span class="mcfo-theme__toggle-label"></span><small></small></span>'
                      + '<input type="checkbox" class="mcfo-switch__input"><span class="mcfo-switch" aria-hidden="true"></span>';
        row.querySelector('.mcfo-theme__toggle-label').textContent = label;
        row.querySelector('small').textContent = hint;
        const input = row.querySelector('input');
        input.checked = !!settings[key];
        input.addEventListener('change', () => { settings[key] = input.checked; saveSettings(); themeTick(); if (after) after(); });
        return row;
    }

    function applyBoardClear() {
        document.documentElement.setAttribute('data-mcfo-boardclear', settings.boardClear ? '1' : '0');
    }

    // Custom's pattern: one small tile per pattern, drawn in Custom's own colours.
    function themePatternPicker() {
        const box = document.createElement('div');
        const head = document.createElement('div');
        head.className = 'mcfo-theme__toggle-label';
        head.textContent = 'Pattern';
        const grid = document.createElement('div');
        grid.className = 'mcfo-theme__patgrid';
        for (const id of THEME_PATTERN_IDS) {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'mcfo-theme__pat';
            b.setAttribute('data-mcfo-pattern', id);
            b.setAttribute('aria-pressed', settings.themePattern === id ? 'true' : 'false');
            const sw = document.createElement('span');
            sw.className = 'mcfo-theme__patsw';
            paintPattern(sw, id);
            const name = document.createElement('span');
            name.textContent = id === 'none' ? 'None' : THEME_PATTERNS[id].label;
            b.append(sw, name);
            b.addEventListener('click', () => {
                settings.themePattern = id;
                saveSettings();
                themeTick();
                for (const o of grid.children) o.setAttribute('aria-pressed', o === b ? 'true' : 'false');
            });
            grid.appendChild(b);
        }
        box.append(head, grid);
        return box;
    }

    function paintPattern(el, id) {
        const t = normTheme(THEMES.find(x => x.id === 'custom'));
        const p = THEME_PATTERNS[id];
        const layers = p ? p.layers(t.decorTint) : [];
        el.style.backgroundColor = mapColour('#111c27', t);
        el.style.backgroundImage = layers.length ? layers.map(l => l[0]).join(', ') : 'none';
        el.style.backgroundSize = layers.length ? layers.map(l => l[1]).join(', ') : 'auto';
    }

    function paintSwatches(box, t) {
        const colours = themeSwatches(t);
        while (box.children.length < colours.length) box.appendChild(document.createElement('span'));
        colours.forEach((c, i) => { box.children[i].style.background = c; });
    }

    function themeSlider(label, key, min, max, unit, isHue, grid) {
        const row = document.createElement('label');
        row.className = 'mcfo-theme__slider';
        row.innerHTML = '<span></span><input type="range"><output></output>';
        row.firstChild.textContent = label;
        const input = row.querySelector('input');
        const out = row.querySelector('output');
        input.className = 'mcfo-theme__range' + (isHue ? ' mcfo-theme__range--hue' : '');
        input.min = String(min);
        input.max = String(max);
        input.step = '1';
        input.value = String(settings[key]);
        // The hue track shows the hues themselves, at a medium lightness and chroma.
        if (isHue) {
            const stops = [];
            for (let h = 0; h <= 360; h += 30) stops.push(`rgb(${fromOklch(0.7, 0.13, h).join(', ')})`);
            input.style.background = `linear-gradient(to right, ${stops.join(', ')})`;
        }
        out.textContent = settings[key] + unit;
        let pending = false;
        input.addEventListener('input', () => {
            settings[key] = Number(input.value);
            out.textContent = input.value + unit;
            if (pending) return;
            pending = true;
            // Repainting the whole page on every pixel of a drag is wasted work: once per 30 ms.
            setTimeout(() => {
                pending = false;
                themeTick();
                const sw = grid.querySelector('[data-mcfo-theme-id="custom"] .mcfo-theme__swatches');
                if (sw) paintSwatches(sw, THEMES.find(t => t.id === 'custom'));
                // The pattern tiles are drawn in Custom's colours, so they follow the sliders.
                for (const pb of grid.querySelectorAll('.mcfo-theme__pat')) {
                    paintPattern(pb.querySelector('.mcfo-theme__patsw'), pb.getAttribute('data-mcfo-pattern'));
                }
            }, 30);
        });
        input.addEventListener('change', saveSettings);
        return row;
    }

    function adoptLevelAsCustom() {
        for (const lever of PERF_LEVERS) settings[lever.key] = perfValue(lever.key);
    }

    function perfLeverChanged(key, value, redraw) {
        if (settings.perfLevel !== 'custom') { adoptLevelAsCustom(); settings.perfLevel = 'custom'; }
        settings[key] = value;
        saveSettings(); apply(); redraw();
    }

    function perfSwitchItem(lever, redraw) {
        const wrap = switchRow(lever.label, lever.hint, !!perfValue(lever.key));
        wrap.querySelector('input').addEventListener('change', e => perfLeverChanged(lever.key, e.target.checked, redraw));
        return wrap;
    }

    function perfChoiceItem(lever, redraw) {
        const wrap = document.createElement('div');
        wrap.className = 'mcfo-set__item';
        const row = document.createElement('div');
        row.className = 'mcfo-set__row mcfo-set__row--choice';
        row.innerHTML = '<span class="mcfo-set__text"><span class="mcfo-set__label"></span>'
                      + '<span class="mcfo-set__hint"></span></span>';
        row.querySelector('.mcfo-set__label').textContent = lever.label;
        row.querySelector('.mcfo-set__hint').textContent = lever.hint;
        const seg = document.createElement('div');
        seg.className = 'mcfo-seg';
        const now = perfValue(lever.key);
        for (const [value, label] of lever.options) {
            const b = document.createElement('button');
            b.type = 'button';
            b.textContent = label;
            b.setAttribute('aria-pressed', now === value ? 'true' : 'false');
            b.addEventListener('click', () => { if (now !== value) perfLeverChanged(lever.key, value, redraw); });
            seg.appendChild(b);
        }
        row.appendChild(seg);
        wrap.appendChild(row);
        return wrap;
    }

    function plainSwitchItem(item) {
        const wrap = switchRow(item.label, item.hint, !!settings[item.key]);
        wrap.querySelector('input').addEventListener('change', e => {
            settings[item.key] = e.target.checked;
            saveSettings(); apply();
        });
        return wrap;
    }

    function switchRow(label, hint, checked) {
        const wrap = document.createElement('div');
        wrap.className = 'mcfo-set__item';
        const row = document.createElement('label');
        row.className = 'mcfo-set__row';
        row.innerHTML = '<span class="mcfo-set__text"><span class="mcfo-set__label"></span>'
                      + '<span class="mcfo-set__hint"></span></span>'
                      + '<input type="checkbox" class="mcfo-switch__input">'
                      + '<span class="mcfo-switch" aria-hidden="true"></span>';
        row.querySelector('.mcfo-set__label').textContent = label;
        const h = row.querySelector('.mcfo-set__hint');
        if (hint) h.textContent = hint; else h.remove();
        row.querySelector('input').checked = checked;
        wrap.appendChild(row);
        return wrap;
    }

    // One switch, with its sub-control if it has one.
    function settingItem(item) {
        const wrap = document.createElement('div');
        wrap.className = 'mcfo-set__item';

        const row = document.createElement('label');
        row.className = 'mcfo-set__row';
        row.innerHTML = '<span class="mcfo-set__text"><span class="mcfo-set__label"></span>'
                      + '<span class="mcfo-set__hint"></span></span>'
                      + '<input type="checkbox" class="mcfo-switch__input">'
                      + '<span class="mcfo-switch" aria-hidden="true"></span>';
        row.querySelector('.mcfo-set__label').textContent = item.label;
        const hint = row.querySelector('.mcfo-set__hint');
        if (item.hint) hint.textContent = item.hint; else hint.remove();
        const input = row.querySelector('input');
        input.checked = !!settings[item.key];
        wrap.appendChild(row);

        const subs = itemSubs(item).map(subControl);
        for (const sub of subs) {
            sub.toggleAttribute('data-off', !input.checked);
            wrap.appendChild(sub);
        }
        if (item.needs && !settings[item.needs]) wrap.setAttribute('data-off', '');

        input.addEventListener('change', () => {
            settings[item.key] = input.checked;
            for (const sub of subs) sub.toggleAttribute('data-off', !input.checked);
            saveSettings();
            apply();
            // Switches that need this one change from grey to live (or back): redraw the page.
            // So does a card of the page that hangs on it (redraw: true).
            if (settingsRedraw && (item.redraw || ALL_ITEMS.some(i => i.needs === item.key))) settingsRedraw();
        });
        return wrap;
    }

    function subControl(sub) {
        const row = document.createElement('div');
        row.className = 'mcfo-set__sub';
        const label = document.createElement('span');
        label.className = 'mcfo-set__sublabel';
        label.textContent = sub.label;
        row.appendChild(label);

        if (sub.type === 'range') {
            const range = document.createElement('input');
            range.type = 'range';
            range.className = 'mcfo-set__range';
            range.min = sub.min; range.max = sub.max; range.step = sub.step;
            range.value = settings[sub.key];
            const val = document.createElement('span');
            val.className = 'mcfo-set__val';
            const reset = document.createElement('button');
            reset.type = 'button';
            reset.className = 'mcfo-set__reset';
            reset.textContent = 'Reset';
            reset.title = `Back to ${sub.def}${sub.unit || ''}`;

            const show = () => {
                val.textContent = range.value + (sub.unit || '');
                reset.disabled = Number(range.value) === sub.def;
            };
            // Live while dragging, saved when let go — the variables make the preview free,
            // but writing localStorage on every pixel of a drag is not.
            range.addEventListener('input', () => {
                settings[sub.key] = Number(range.value);
                show();
                applyTunables();
                applyGlassToFrames();
                writeChatTypography();
            });
            range.addEventListener('change', saveSettings);
            reset.addEventListener('click', () => {
                range.value = sub.def;
                settings[sub.key] = sub.def;
                show();
                applyTunables();
                applyGlassToFrames();
                writeChatTypography();
                saveSettings();
            });
            show();
            row.append(range, val, reset);
        } else if (sub.type === 'choice') {
            const seg = document.createElement('div');
            seg.className = 'mcfo-seg';
            for (const [value, text] of sub.options) {
                const b = document.createElement('button');
                b.type = 'button';
                b.textContent = text;
                b.setAttribute('aria-pressed', settings[sub.key] === value ? 'true' : 'false');
                b.addEventListener('click', () => {
                    settings[sub.key] = value;
                    for (const x of seg.children) x.setAttribute('aria-pressed', x === b ? 'true' : 'false');
                    saveSettings();
                });
                seg.appendChild(b);
            }
            row.appendChild(seg);
        }
        return row;
    }

    // =========================================================================================
    // 11e. MUSIC PLAYER: THE GAME'S SOUNDTRACK, OURS TO PICK FROM (6.22)
    // =========================================================================================
    // The game reads its playlist from /.mcf-soundtrack/manifest.json and walks it strictly in
    // order: Next is index + 1, and that is the whole of it. Worse, its player downloads every
    // file whole and decodes it before the first note (prodViewer/sound/soundRuntime.js, one
    // decodeAudioData over the complete buffer) - and the files are raw WAV, 12 to 69 MB each. So
    // clicking your way to a track you want costs hundreds of megabytes.
    // This player reads the same manifest and hands the files to an <audio> element instead, which
    // streams them: metadata after about a second, seeking by range request, a few seconds held
    // ahead instead of the whole file. That makes picking a track, shuffling and leaving tracks
    // out cheap. Whenever it starts, the game's own music is switched off with the game's own
    // button - two players would be two songs at once, and section 11c reads that state back.
    const MUSIC_MANIFEST_URL = '/.mcf-soundtrack/manifest.json';
    const MUSIC_LAST_KEY = 'mcfo_music_last';   // track and position, to pick up where it stopped
    const MUSIC_SAVE_EVERY_MS = 10000;
    const MUSIC_MAX_FAILS = 3;                  // a run of unplayable tracks stops the hunt
    // Holding back. The soundtrack is raw WAV at 192 KB a second, and the game's server sends
    // these files at anything between 115 KB and 1.2 MB a second - often less than a track eats.
    // A browser starts as soon as it has a morsel and then runs dry every few seconds, which is
    // heard as a track stopping after a second or two, or stuttering once the read-ahead reserve
    // is used up (Firefox reads 60 s ahead, so that lands around the middle of a track). Instead
    // of playing into an empty buffer, the player waits until a cushion is there and says so.
    const MUSIC_AHEAD_START = 5;                // seconds ready before the first note
    const MUSIC_AHEAD_RESUME = 15;              // seconds ready before it carries on after a dry spell
    const MUSIC_HOLD_MAX_MS = 25000;            // waiting longer than this helps nobody: play on
    const MUSIC_HOLD_STILL_MS = 5000;           // nothing arriving for this long: waiting is pointless

    const music = {
        tracks: null,     // [{ id, album, title, src }] once the manifest has been read
        loading: null,    // the promise while it is on its way
        note: '',         // what went wrong, shown under the player
        fails: 0,         // tracks that would not play, in a row
        fault: '',        // the name of the last refusal, for when something needs looking at
        wantPlay: false,  // what was asked for - the element can be held back and still be "playing"
        holding: false,   // paused on purpose, filling the buffer
        holdNeed: 0,
        holdSince: 0,
        holdGrew: 0,      // when the buffer last grew: a buffer standing still ends the wait
        holdAhead: 0,
        seekAt: 0,        // when the bar was last dragged: after that a small cushion will do
        fresh: false,     // a track that has not played a note yet: it gets going on a small cushion
        el: null,         // the <audio>, built on the first play
        id: '',           // the chosen track, also before anything is loaded
        srcId: '',        // the track actually loaded into the element
        seekTo: 0,        // where to start once the metadata is in
        queue: [],        // the shuffled order, rebuilt when the rotation changes
        filter: '',       // the search box, kept while the window stays open
        open: new Set(),  // the albums folded open
        savedAt: 0,
        sync: null,       // light refresh of the Sound page (bar, buttons, marker)
        barSync: null,    // light refresh of the bar on the page (11f)
        redraw: null,     // full rebuild of the Sound page (list, counts)
    };

    // Two views can be open at once - the Sound page and the bar on the page. Both are refreshed
    // from here, so neither has to know about the other.
    function musicSync() {
        if (music.sync) { try { music.sync(); } catch (e) {} }
        if (music.barSync) { try { music.barSync(); } catch (e) {} }
    }
    const musicFind = id => (music.tracks || []).find(t => t.id === id) || null;
    // What was asked for, not what the element does this second: while it is held back to fill the
    // buffer it is still "playing" as far as the page and the buttons are concerned.
    const musicIsPlaying = () => music.wantPlay && music.srcId === music.id;
    // How many seconds are ready beyond the playhead, in the piece it is playing from.
    function musicAhead() {
        const el = music.el;
        if (!el || !el.buffered || !el.buffered.length) return 0;
        const at = el.currentTime;
        for (let i = 0; i < el.buffered.length; i++) {
            if (at >= el.buffered.start(i) - 0.5 && at <= el.buffered.end(i)) return el.buffered.end(i) - at;
        }
        return 0;
    }
    const musicWhole = () => {
        const el = music.el;
        return !!el && el.duration > 0 && el.buffered.length > 0
            && el.buffered.end(el.buffered.length - 1) >= el.duration - 0.5;
    };

    // Pausing on purpose until the cushion is back. A paused element keeps filling its buffer, so
    // this turns a stutter every two seconds into one honest wait.
    function musicHold(seconds) {
        if (!music.el || music.holding || !music.wantPlay) return;
        music.holding = true;
        music.holdNeed = seconds;
        music.holdSince = Date.now();
        music.holdGrew = Date.now();
        music.holdAhead = musicAhead();
        music.el.pause();
        musicHoldTick();
    }
    function musicHoldTick() {
        if (!music.holding) return;
        const ahead = musicAhead();
        // A browser fills the buffer of a paused track only so far and then stops. Standing still
        // is the sign that waiting brings nothing more, whatever the cushion has reached.
        if (ahead > music.holdAhead + 0.2) { music.holdAhead = ahead; music.holdGrew = Date.now(); }
        const stillMs = Date.now() - music.holdGrew;
        if (!music.el || !music.wantPlay || ahead >= music.holdNeed || musicWhole()
            || stillMs > MUSIC_HOLD_STILL_MS || Date.now() - music.holdSince > MUSIC_HOLD_MAX_MS) {
            const go = music.holding && music.wantPlay && music.el;
            music.holding = false;
            music.note = '';
            if (go) music.el.play().catch(() => {});
            musicSync();
            return;
        }
        music.note = 'Waiting for the track to load: ' + Math.floor(ahead) + ' of ' + music.holdNeed
                   + ' seconds ready. The game\'s server is not always quick with these files.';
        musicSync();
        setTimeout(musicHoldTick, 400);
    }
    const musicOut = id => settings.musicExcluded.indexOf(id) >= 0;
    function musicTime(sec) {
        const s = Math.max(0, Math.floor(Number(sec) || 0));
        return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
    }

    // The manifest gives a path and a name per track; the album is the folder it sits in. The
    // paths come with spaces and commas in them and are handed on as they are: the URL parser
    // encodes what needs encoding, while encodeURI would take the percent of a path that is
    // already encoded and make %2520 out of %20. Only the two characters that would cut a URL
    // short - the hash and the question mark - are spelled out.
    function musicParse(raw) {
        const path = String((raw && (raw.path || raw.src || raw.url)) || '').trim();
        if (!path) return null;
        const parts = path.split('/').filter(Boolean).map(p => { try { return decodeURIComponent(p); } catch (e) { return p; } });
        const file = parts[parts.length - 1] || '';
        return {
            id: path,
            album: parts.length > 1 ? parts[parts.length - 2] : 'Soundtrack',
            title: String((raw && (raw.name || raw.title)) || '').trim() || file.replace(/\.[^.]*$/, ''),
            src: path.replace(/#/g, '%23').replace(/\?/g, '%3F'),
        };
    }

    // Only ever fetched when the Sound page is opened, never on a normal page load.
    function musicLoad() {
        if (music.tracks) return Promise.resolve(music.tracks);
        if (!music.loading) music.loading = (async () => {
            let list = [];
            try {
                const res = await fetch(MUSIC_MANIFEST_URL, { cache: 'no-store' });
                if (!res.ok) throw new Error('HTTP ' + res.status);
                const data = await res.json();
                list = (Array.isArray(data && data.tracks) ? data.tracks : []).map(musicParse).filter(Boolean);
                music.note = list.length ? '' : 'The game\'s soundtrack list came back empty.';
            } catch (e) {
                music.note = 'The soundtrack list could not be read. Reload the page and try again.';
            }
            music.tracks = list;
            music.loading = null;
            musicRestore();
            if (music.redraw) music.redraw();
            musicSync();
            return list;
        })();
        return music.loading;
    }

    // Where it stopped last time, so the page comes back to the same track at the same place.
    // Nothing starts by itself: the position is only handed over on the next press of Play.
    function musicRestore() {
        if (music.id) return;
        let last = null;
        try { last = JSON.parse(localStorage.getItem(MUSIC_LAST_KEY) || 'null'); } catch (e) {}
        if (!last || !musicFind(last.id)) return;
        music.id = String(last.id);
        music.seekTo = Math.max(0, Number(last.pos) || 0);
    }
    function musicRemember() {
        if (!music.id) return;
        const pos = music.el && music.srcId === music.id ? music.el.currentTime : music.seekTo;
        try { localStorage.setItem(MUSIC_LAST_KEY, JSON.stringify({ id: music.id, pos: Math.max(0, Math.floor(pos || 0)) })); } catch (e) {}
        music.savedAt = Date.now();
    }

    // The rotation is everything still ticked on the list. In order that is the manifest's order;
    // shuffled it is one pass through a shuffled copy, so nothing comes round twice while other
    // tracks have not played at all.
    function musicRotation() {
        const out = new Set(settings.musicExcluded);
        return (music.tracks || []).filter(t => !out.has(t.id));
    }
    function musicOrder() {
        const ids = musicRotation().map(t => t.id);
        if (!settings.musicShuffle) return ids;
        const have = new Set(ids);
        const fits = music.queue.length === ids.length && music.queue.every(id => have.has(id));
        if (!fits) music.queue = musicShuffled(ids, music.id);
        return music.queue;
    }
    // Fisher-Yates. Whatever plays right now keeps the front, so a reshuffle never cuts it off.
    function musicShuffled(ids, keep) {
        const a = ids.slice();
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const t = a[i]; a[i] = a[j]; a[j] = t;
        }
        const at = a.indexOf(keep);
        if (at > 0) { a.splice(at, 1); a.unshift(keep); }
        return a;
    }

    // Taking a track out or putting it back never pushes into the list: settingDefaults holds an
    // array of its own, and a shared one would fill up through Reset all.
    function musicSetOut(ids, out) {
        const set = new Set(settings.musicExcluded);
        for (const id of ids) { if (out) set.add(id); else set.delete(id); }
        settings.musicExcluded = [...set];
        music.queue = [];
        saveSettings();
        // Taking off the track that is playing right now means it should stop being heard, not
        // play to its end: it moves on, or falls silent when nothing is left to play.
        if (out && musicIsPlaying() && musicOut(music.id)) {
            if (musicRotation().length) musicSkip(1); else musicPause();
        }
    }

    function musicElement() {
        // Back into the page if something took it out: a player removed from the document is
        // paused by the browser on the spot.
        if (music.el) {
            if (!music.el.isConnected) (document.body || document.documentElement).appendChild(music.el);
            return music.el;
        }
        const el = new Audio();
        el.preload = 'none';
        el.className = 'mcfo-audio';
        el.hidden = true;
        el.volume = Math.max(0, Math.min(1, settings.musicVolume / 100));
        // In the page rather than off to the side: that way the browser treats it as a proper
        // player - media keys and the browser's own sound indicator find it - and it can be
        // looked at when something goes wrong.
        (document.body || document.documentElement).appendChild(el);
        el.addEventListener('loadedmetadata', () => {
            if (music.seekTo > 0 && music.seekTo < el.duration - 1) el.currentTime = music.seekTo;
            music.seekTo = 0;
            musicSync();
        });
        el.addEventListener('timeupdate', () => {
            if (Date.now() - music.savedAt > MUSIC_SAVE_EVERY_MS) musicRemember();
            musicSync();
        });
        el.addEventListener('playing', () => { music.fails = 0; music.fresh = false; musicSync(); });
        // Ran dry: hold back until there is something to play from again. Right after the bar was
        // dragged the small cushion is enough - nobody wants to wait half a minute for a jump.
        el.addEventListener('seeking', () => { music.seekAt = Date.now(); });
        // A track that has not started yet, and a jump with the bar, get going on the small
        // cushion - nobody waits half a minute for the first note. The big one is for a track that
        // was running and ran out: there a longer wait buys a longer stretch of music.
        el.addEventListener('waiting', () => musicHold(
            music.fresh || Date.now() - music.seekAt < 4000 ? MUSIC_AHEAD_START : MUSIC_AHEAD_RESUME));
        // Even when the first notes are already there, a small cushion first: on a quick line
        // that is a fraction of a second.
        el.addEventListener('loadeddata', () => musicHold(MUSIC_AHEAD_START));
        el.addEventListener('pause', () => { musicRemember(); musicSync(); });
        el.addEventListener('progress', () => { musicSync(); });
        el.addEventListener('ended', () => { music.seekTo = 0; musicSkip(1); });
        // A file that will not play is skipped, but a run of them stops rather than racing through
        // the whole soundtrack.
        el.addEventListener('error', () => {
            const t = musicFind(music.id);
            music.fails++;
            if (music.fails >= MUSIC_MAX_FAILS || musicRotation().length < 2) {
                music.note = 'That track would not play' + (t ? ': ' + t.title : '') + '.';
                if (music.redraw) music.redraw();
                return;
            }
            music.note = 'Skipped a track the browser would not play.';
            musicSkip(1);
        });
        music.el = el;
        return el;
    }

    // Starting anything silences the game's own music first, with the game's own button.
    function musicPlay(id) {
        const track = musicFind(id);
        if (!track) return;
        const s = soundState();
        if (s && s.music) soundClick('music-enabled-toggle');
        const el = musicElement();
        music.wantPlay = true;
        if (music.srcId !== track.id) {
            music.id = track.id;
            music.srcId = track.id;
            music.note = '';
            el.src = track.src;
            music.fresh = true;
            el.preload = 'auto';   // keep filling the buffer even while it is held back
            el.load();
        }
        el.play().catch(e => {
            music.fault = (e && e.name) || 'unknown';
            // Holding back pauses the element the moment it asks for data, and that turns the
            // play() just started into an AbortError. Nothing is wrong there - the hold plays it.
            if (music.fault === 'AbortError') return;
            music.note = 'The browser would not start the sound. Click the page once, then press Play again.';
            if (music.redraw) music.redraw();
        });
        musicRemember();
        musicSync();
    }
    function musicPause() {
        music.wantPlay = false;
        music.holding = false;
        music.note = '';
        if (music.el) music.el.pause();
    }
    function musicToggle() {
        if (musicIsPlaying()) { musicPause(); return; }
        const id = musicFind(music.id) ? music.id : musicOrder()[0];
        if (id) musicPlay(id);
    }
    function musicSkip(dir) {
        const order = musicOrder();
        if (!order.length) { musicPause(); return; }
        // Back in the first seconds means the track before; later in it means this one again.
        if (dir < 0 && music.el && music.srcId === music.id && music.el.currentTime > 3) {
            music.el.currentTime = 0;
            return;
        }
        const at = order.indexOf(music.id);
        let next;
        if (at < 0) next = order[dir > 0 ? 0 : order.length - 1];
        else if (settings.musicShuffle && at + dir >= order.length) {
            music.queue = musicShuffled(order);
            next = music.queue[0];
        } else next = order[(at + dir + order.length) % order.length];
        music.seekTo = 0;
        musicPlay(next);
    }

    const MUSIC_ICONS = {
        play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>',
        pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h3.5v14H7zm6.5 0H17v14h-3.5z"/></svg>',
        prev: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 6h2.2v12H7zm11 0v12l-8-6z"/></svg>',
        next: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.8 6H17v12h-2.2zM6 6l8 6-8 6z"/></svg>',
        shuffle: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16.5 4 21 7.6l-4.5 3.6V8.9h-1.8l-2 2.7-1.4-1.9L13.8 6h2.7zm0 8.8L21 16.4 16.5 20v-2.3h-2.7l-2.5-3.3 1.4-1.9 2 2.7h1.8zM3 6h4.4l2.5 3.3-1.4 1.9-2-2.7H3zm0 9.7h3.5l4.9-6.6 1.4 1.9-5.4 7.3H3z"/></svg>',
    };

    // The player on the Sound page. It keeps no copy of anything: every control reads the state
    // above and writes it straight back. sync() is the cheap refresh that runs four times a second
    // while a track plays, so it touches the bar, the buttons and the one marked row - never the
    // whole list. Ticking tracks on and off rebuilds nothing either, or the list would jump back
    // to the top under the hand that ticked it.
    function musicPlayerUi(redrawPage) {
        const box = document.createElement('div');
        box.className = 'mcfo-mus';
        music.sync = null;                       // the nodes of the last drawing are gone
        music.redraw = () => redrawPage();

        if (!music.tracks) {
            void musicLoad();
            const wait = document.createElement('div');
            wait.className = 'mcfo-mus__note';
            wait.textContent = 'Reading the game\'s soundtrack list...';
            box.appendChild(wait);
            return box;
        }
        if (!music.tracks.length) {
            const bad = document.createElement('div');
            bad.className = 'mcfo-set__notice';
            bad.textContent = music.note || 'The game\'s soundtrack list is empty.';
            box.appendChild(bad);
            return box;
        }

        // Now playing.
        const now = document.createElement('div');
        now.className = 'mcfo-mus__now';
        now.innerHTML = '<span class="mcfo-mus__title"></span><span class="mcfo-mus__albumline"></span>';
        const nowTitle = now.querySelector('.mcfo-mus__title');
        const nowAlbum = now.querySelector('.mcfo-mus__albumline');

        // Transport.
        const bar = document.createElement('div');
        bar.className = 'mcfo-mus__row';
        const button = (label, icon, extra) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'mcfo-mus__btn' + (extra || '');
            b.innerHTML = icon;
            b.title = label;
            b.setAttribute('aria-label', label);
            return b;
        };
        const bPrev = button('Previous track', MUSIC_ICONS.prev);
        const bPlay = button('Play', MUSIC_ICONS.play, ' mcfo-mus__btn--play');
        const bNext = button('Next track', MUSIC_ICONS.next);
        const bShuffle = button('Shuffle', MUSIC_ICONS.shuffle);
        bShuffle.setAttribute('aria-pressed', settings.musicShuffle ? 'true' : 'false');
        bPrev.addEventListener('click', () => musicSkip(-1));
        bNext.addEventListener('click', () => musicSkip(1));
        bPlay.addEventListener('click', musicToggle);
        bShuffle.addEventListener('click', () => {
            settings.musicShuffle = !settings.musicShuffle;
            music.queue = [];
            saveSettings();
            bShuffle.setAttribute('aria-pressed', settings.musicShuffle ? 'true' : 'false');
        });
        const count = document.createElement('span');
        count.className = 'mcfo-mus__count';
        bar.append(bPrev, bPlay, bNext, bShuffle, count);

        // Position. The slider runs in seconds, so it is right whatever the track is long.
        const line = document.createElement('div');
        line.className = 'mcfo-mus__row';
        line.innerHTML = '<span class="mcfo-mus__time"></span>'
                       + '<input type="range" class="mcfo-mus__seek" min="0" max="1" step="1" value="0" aria-label="Position in the track">'
                       + '<span class="mcfo-mus__time"></span>';
        const buffered = document.createElement('div');
        buffered.className = 'mcfo-mus__buf';
        buffered.innerHTML = '<span></span>';
        const bufFill = buffered.firstChild;
        const seek = line.querySelector('.mcfo-mus__seek');
        const atText = line.children[0], ofText = line.children[2];
        let seeking = false;
        seek.addEventListener('pointerdown', () => { seeking = true; });
        seek.addEventListener('input', () => { seeking = true; atText.textContent = musicTime(seek.value); });
        seek.addEventListener('change', () => {
            seeking = false;
            if (music.el && music.srcId === music.id && music.el.duration) music.el.currentTime = Number(seek.value);
            else music.seekTo = Number(seek.value);
            musicRemember();
        });

        // Volume. Its own row rather than mcfo-set__sub, which brings the card's padding with it.
        const vol = document.createElement('div');
        vol.className = 'mcfo-mus__row';
        vol.innerHTML = '<span class="mcfo-set__sublabel">Volume</span>'
                      + '<input type="range" class="mcfo-set__range" min="0" max="100" step="1">'
                      + '<span class="mcfo-set__val"></span>';
        const volRange = vol.querySelector('input');
        const volVal = vol.querySelector('.mcfo-set__val');
        volRange.value = String(settings.musicVolume);
        volVal.textContent = settings.musicVolume + '%';
        volRange.addEventListener('input', () => {
            settings.musicVolume = Math.max(0, Math.min(100, Number(volRange.value) || 0));
            volVal.textContent = settings.musicVolume + '%';
            if (music.el) music.el.volume = settings.musicVolume / 100;
            saveSettings();
        });

        // Search and the two big switches over the whole soundtrack.
        const tools = document.createElement('div');
        tools.className = 'mcfo-mus__row';
        const search = document.createElement('input');
        search.type = 'search';
        search.className = 'mcfo-mus__search';
        search.placeholder = 'Search title or album';
        search.value = music.filter;
        search.addEventListener('input', () => { music.filter = search.value; buildList(); });
        const allOn = document.createElement('button');
        allOn.type = 'button';
        allOn.className = 'mcfo-set__reset';
        allOn.textContent = 'All on';
        allOn.addEventListener('click', () => { musicSetOut(music.tracks.map(t => t.id), false); buildList(); });
        const allOff = document.createElement('button');
        allOff.type = 'button';
        allOff.className = 'mcfo-set__reset';
        allOff.textContent = 'All off';
        allOff.addEventListener('click', () => { musicSetOut(music.tracks.map(t => t.id), true); buildList(); });
        tools.append(search, allOn, allOff);

        const list = document.createElement('div');
        list.className = 'mcfo-mus__list';
        const note = document.createElement('div');
        note.className = 'mcfo-mus__note';

        // The list, by album. Albums are folded shut; the one being played, and everything a
        // search matches, is open.
        let albums = [];
        let marked = null;
        function buildList() {
            list.textContent = '';
            marked = null;
            albums = [];
            const q = music.filter.trim().toLowerCase();
            const byAlbum = new Map();
            for (const t of music.tracks) {
                if (!byAlbum.has(t.album)) byAlbum.set(t.album, []);
                byAlbum.get(t.album).push(t);
            }
            for (const [name, tracks] of byAlbum) {
                const shown = q ? tracks.filter(t => (t.title + ' ' + name).toLowerCase().includes(q)) : tracks;
                if (!shown.length) continue;
                const album = { name, tracks, scope: q ? shown : tracks, rows: [], head: null, num: null, tick: null };
                const head = document.createElement('div');
                head.className = 'mcfo-mus__head';
                const fold = document.createElement('button');
                fold.type = 'button';
                fold.className = 'mcfo-mus__fold';
                fold.textContent = name;
                const num = document.createElement('span');
                num.className = 'mcfo-mus__num';
                const tick = document.createElement('input');
                tick.type = 'checkbox';
                tick.className = 'mcfo-mus__tick';
                tick.title = 'Play tracks from this album';
                head.append(fold, num, tick);
                const songs = document.createElement('div');
                songs.className = 'mcfo-mus__songs';
                const open = !!q || music.open.has(name) || shown.some(t => t.id === music.id);
                if (open) music.open.add(name);
                songs.hidden = !open;
                head.toggleAttribute('data-open', open);
                fold.addEventListener('click', () => {
                    const nowOpen = songs.hidden;
                    songs.hidden = !nowOpen;
                    head.toggleAttribute('data-open', nowOpen);
                    if (nowOpen) music.open.add(name); else music.open.delete(name);
                });
                tick.addEventListener('change', () => {
                    musicSetOut(album.scope.map(t => t.id), !tick.checked);
                    for (const row of album.rows) row.tick.checked = !musicOut(row.track.id);
                    counts();
                });
                for (const t of shown) {
                    const row = document.createElement('div');
                    row.className = 'mcfo-mus__song';
                    row.dataset.id = t.id;
                    const play = document.createElement('button');
                    play.type = 'button';
                    play.className = 'mcfo-mus__songname';
                    play.textContent = t.title;
                    play.title = 'Play ' + t.title;
                    const rowTick = document.createElement('input');
                    rowTick.type = 'checkbox';
                    rowTick.className = 'mcfo-mus__tick';
                    rowTick.checked = !musicOut(t.id);
                    rowTick.title = 'Play this track';
                    // Picking a track that was taken out puts it back: the ticks are the rotation,
                    // and a track playing while ticked off would be a lie about the next one.
                    play.addEventListener('click', () => {
                        if (musicOut(t.id)) { musicSetOut([t.id], false); rowTick.checked = true; counts(); }
                        musicPlay(t.id);
                    });
                    rowTick.addEventListener('change', () => { musicSetOut([t.id], !rowTick.checked); counts(); });
                    row.append(play, rowTick);
                    songs.appendChild(row);
                    album.rows.push({ track: t, tick: rowTick });
                }
                album.head = head; album.num = num; album.tick = tick;
                list.append(head, songs);
                albums.push(album);
            }
            if (!albums.length) {
                const none = document.createElement('div');
                none.className = 'mcfo-mus__note';
                none.textContent = 'Nothing matches "' + music.filter.trim() + '".';
                list.appendChild(none);
            }
            counts();
            sync();
        }

        // Every counter that can change without the list being rebuilt.
        function counts() {
            for (const album of albums) {
                const on = album.tracks.filter(t => !musicOut(t.id)).length;
                album.num.textContent = on + '/' + album.tracks.length;
                album.tick.checked = on > 0;
                album.tick.indeterminate = on > 0 && on < album.tracks.length;
            }
            const rotation = musicRotation().length;
            count.textContent = rotation + ' of ' + music.tracks.length + ' tracks';
            const empty = rotation === 0;
            bPrev.disabled = bNext.disabled = empty;
            bPlay.disabled = empty && !musicIsPlaying();
        }

        function sync() {
            const track = musicFind(music.id);
            nowTitle.textContent = track ? track.title : 'Nothing chosen yet';
            nowAlbum.textContent = track ? track.album : '';
            const playing = musicIsPlaying();
            bPlay.innerHTML = playing ? MUSIC_ICONS.pause : MUSIC_ICONS.play;
            bPlay.title = playing ? 'Pause' : 'Play';
            bPlay.setAttribute('aria-label', bPlay.title);
            const loaded = music.el && music.srcId === music.id;
            const duration = loaded && Number.isFinite(music.el.duration) ? music.el.duration : 0;
            const at = loaded ? music.el.currentTime : music.seekTo;
            seek.disabled = !duration;
            if (!seeking) {
                seek.max = String(Math.max(1, Math.floor(duration || 1)));
                seek.value = String(Math.min(Math.floor(at), Math.floor(duration || 0)));
            }
            atText.textContent = musicTime(at);
            ofText.textContent = duration ? musicTime(duration) : '--:--';
            const el2 = music.el;
            const end = loaded && el2 && el2.buffered.length ? el2.buffered.end(el2.buffered.length - 1) : 0;
            bufFill.style.width = duration ? Math.min(100, (end / duration) * 100) + '%' : '0';
            buffered.toggleAttribute('data-thin', music.holding);
            if (marked && marked.dataset.id !== music.id) { marked.removeAttribute('data-current'); marked = null; }
            if (!marked && music.id) {
                marked = list.querySelector('.mcfo-mus__song[data-id="' + CSS.escape(music.id) + '"]');
                if (marked) marked.setAttribute('data-current', '');
            }
            if (marked) marked.toggleAttribute('data-playing', playing);
            note.textContent = music.note;
            note.hidden = !music.note;
        }

        // The word about waiting belongs where the eye is - right under the bar, not below the
        // whole list.
        box.append(now, bar, line, buffered, note, vol, tools, list);
        buildList();
        music.sync = sync;
        return box;
    }

    // The switch for the player on the Sound page, drawn like any setting row, with the player
    // itself under it. Switching it on hushes the game's music; switching it off stops ours and
    // hands the game's own controls back (section 11c).
    function musicItem(redraw) {
        const wrap = document.createElement('div');
        wrap.className = 'mcfo-set__item';
        const row = document.createElement('label');
        row.className = 'mcfo-set__row';
        row.innerHTML = '<span class="mcfo-set__text"><span class="mcfo-set__label"></span>'
                      + '<span class="mcfo-set__hint"></span></span>'
                      + '<input type="checkbox" class="mcfo-switch__input">'
                      + '<span class="mcfo-switch" aria-hidden="true"></span>';
        row.querySelector('.mcfo-set__label').textContent = 'Music player';
        row.querySelector('.mcfo-set__hint').textContent = 'The whole soundtrack by album: pick a track, '
            + 'shuffle it, and take off the ones you would rather not hear. It streams, so a track starts at '
            + 'once instead of after the whole file. While it is on, the game plays no music of its own.';
        const input = row.querySelector('input');
        input.checked = settings.musicPlayer;
        input.addEventListener('change', () => {
            settings.musicPlayer = input.checked;
            saveSettings();
            if (!settings.musicPlayer) musicPause();
            else { const s = soundState(); if (s && s.music) soundClick('music-enabled-toggle'); }
            redraw();
        });
        wrap.appendChild(row);
        if (settings.musicPlayer) {
            const sub = document.createElement('label');
            sub.className = 'mcfo-set__sub';
            sub.innerHTML = '<span class="mcfo-set__sublabel">Player bar</span>'
                          + '<span class="mcfo-set__hint mcfo-set__hint--wide"></span>'
                          + '<input type="checkbox" class="mcfo-switch__input">'
                          + '<span class="mcfo-switch" aria-hidden="true"></span>';
            sub.querySelector('.mcfo-set__hint').textContent = 'A small player to drag anywhere on the page. '
                + 'The note next to the gear shows and hides it.';
            const barOn = sub.querySelector('input');
            barOn.checked = settings.musicBar;
            barOn.addEventListener('change', () => {
                settings.musicBar = barOn.checked;
                saveSettings();
                buildMusicBar();
                buildHeaderButtons();
            });
            wrap.appendChild(sub);
            wrap.appendChild(musicPlayerUi(redraw));
        }
        return wrap;
    }

    // =========================================================================================
    // 11f. THE PLAYER BAR: THE MUSIC PLAYER ON THE PAGE (6.23)
    // =========================================================================================
    // Skipping a track should not mean three clicks through the settings. This is the same player
    // as on the Sound page - it holds nothing of its own, it reads the state above and writes it
    // back - in a small box that can be dragged anywhere and stays where it was put. Its place is
    // kept with the windows, under a path of its own.
    const MUSIC_BAR_KEY = '#musicbar';
    const MUSIC_BAR_ICONS = {
        close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
        list: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h11M4 12h11M4 17h7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="18" cy="16.5" r="2.6" fill="currentColor"/><path d="M20.6 16.5V8l-3 .6" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
    };
    // A note for the header, drawn like the gear next to it.
    const NOTE_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true">'
        + '<path d="M10 17.4V6.6l8-1.6v10.2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>'
        + '<circle cx="7.6" cy="17.6" r="2.7" fill="currentColor"/>'
        + '<circle cx="15.6" cy="15.6" r="2.7" fill="currentColor"/></svg>';

    function buildMusicBar() {
        const want = settings.musicPlayer && settings.musicBar;
        let bar = document.querySelector('.mcfo-bar');
        if (!want) {
            if (bar) bar.remove();
            music.barSync = null;
            return;
        }
        if (bar && bar.isConnected) return;
        // The bar needs the names, so the list is fetched here as well - once, a small file.
        void musicLoad();

        bar = document.createElement('div');
        bar.className = 'mcfo-bar';
        bar.innerHTML =
              '<div class="mcfo-bar__top">'
            +   '<span class="mcfo-bar__title"></span>'
            +   '<button type="button" class="mcfo-bar__x mcfo-barbtn" title="Hide the bar" aria-label="Hide the bar">'
            +     MUSIC_BAR_ICONS.close + '</button>'
            + '</div>'
            + '<div class="mcfo-bar__sub"></div>'
            + '<div class="mcfo-bar__row"></div>'
            + '<div class="mcfo-bar__line" title="Jump to another place in the track">'
            +   '<span class="mcfo-bar__buf"></span><span class="mcfo-bar__at"></span></div>';
        document.body.appendChild(bar);

        const title = bar.querySelector('.mcfo-bar__title');
        const sub = bar.querySelector('.mcfo-bar__sub');
        const row = bar.querySelector('.mcfo-bar__row');
        const line = bar.querySelector('.mcfo-bar__line');
        const bufFill = bar.querySelector('.mcfo-bar__buf');
        const atFill = bar.querySelector('.mcfo-bar__at');

        const button = (label, icon) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'mcfo-barbtn';
            b.innerHTML = icon;
            b.title = label;
            b.setAttribute('aria-label', label);
            return b;
        };
        const bPrev = button('Previous track', MUSIC_ICONS.prev);
        const bPlay = button('Play', MUSIC_ICONS.play);
        const bNext = button('Next track', MUSIC_ICONS.next);
        const bShuffle = button('Shuffle', MUSIC_ICONS.shuffle);
        const bList = button('The whole soundtrack', MUSIC_BAR_ICONS.list);
        bPlay.classList.add('mcfo-barbtn--play');
        const vol = document.createElement('input');
        vol.type = 'range';
        vol.className = 'mcfo-bar__vol';
        vol.min = '0'; vol.max = '100'; vol.step = '1';
        vol.value = String(settings.musicVolume);
        vol.title = 'Volume';
        vol.setAttribute('aria-label', 'Volume');
        row.append(bPrev, bPlay, bNext, bShuffle, vol, bList);

        bPrev.addEventListener('click', () => musicSkip(-1));
        bNext.addEventListener('click', () => musicSkip(1));
        bPlay.addEventListener('click', musicToggle);
        bShuffle.addEventListener('click', () => {
            settings.musicShuffle = !settings.musicShuffle;
            music.queue = [];
            saveSettings();
            musicSync();
        });
        vol.addEventListener('input', () => {
            settings.musicVolume = Math.max(0, Math.min(100, Number(vol.value) || 0));
            if (music.el) music.el.volume = settings.musicVolume / 100;
            saveSettings();
        });
        // The way to the list: the Sound page, opened on the spot. Only from the button - the
        // title and the line under it are what the box gets dragged by, and a box made of nothing
        // but buttons cannot be moved anywhere.
        bList.addEventListener('click', () => { settingsView = 'Sound'; showSettings(); });
        bar.querySelector('.mcfo-bar__x').addEventListener('click', () => {
            settings.musicBar = false;
            saveSettings();
            buildMusicBar();
            buildHeaderButtons();
        });

        // Jumping: the line is the track from end to end.
        line.addEventListener('pointerdown', e => {
            const el = music.el;
            if (!el || !el.duration) return;
            const r = line.getBoundingClientRect();
            music.seekAt = Date.now();
            el.currentTime = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * el.duration;
            musicRemember();
            musicSync();
        });

        // Dragging: anywhere on the box that is not a control.
        let dragging = false, dx = 0, dy = 0;
        function place(left, top) {
            const w = bar.offsetWidth, h = bar.offsetHeight;
            bar.style.left = Math.round(Math.max(0, Math.min(left, innerWidth - w))) + 'px';
            bar.style.top = Math.round(Math.max(0, Math.min(top, innerHeight - h))) + 'px';
        }
        bar.addEventListener('pointerdown', e => {
            if (e.button !== 0 || e.target.closest('button, input, .mcfo-bar__line')) return;
            const r = bar.getBoundingClientRect();
            dx = e.clientX - r.left; dy = e.clientY - r.top;
            dragging = true;
            // A pointer id the browser no longer knows about throws here; the drag works without
            // the capture, it just stops at the edge of the box.
            try { bar.setPointerCapture(e.pointerId); } catch (err) {}
            bar.setAttribute('data-drag', '');
            e.preventDefault();
        });
        bar.addEventListener('pointermove', e => { if (dragging) place(e.clientX - dx, e.clientY - dy); });
        const stop = e => {
            if (!dragging) return;
            dragging = false;
            bar.removeAttribute('data-drag');
            try { bar.releasePointerCapture(e.pointerId); } catch (err) {}
            saveWinState(MUSIC_BAR_KEY, { left: parseInt(bar.style.left, 10), top: parseInt(bar.style.top, 10) });
        };
        bar.addEventListener('pointerup', stop);
        bar.addEventListener('pointercancel', stop);

        // Where it opens: where it was left, otherwise bottom left, clear of the game's footer.
        const saved = loadWinState()[MUSIC_BAR_KEY] || {};
        place(Number.isFinite(saved.left) ? saved.left : 16,
              Number.isFinite(saved.top) ? saved.top : innerHeight - 170);
        addEventListener('resize', () => {
            if (!bar.isConnected) return;
            place(parseInt(bar.style.left, 10) || 0, parseInt(bar.style.top, 10) || 0);
        });

        music.barSync = function () {
            const track = musicFind(music.id);
            title.textContent = track ? track.title : 'Nothing chosen yet';
            title.title = (track ? track.title + ' · ' + track.album + ' — ' : '') + 'drag to move the bar';
            // While it waits for the track to arrive, the line under the title says so: on the bar
            // there is no room for the whole sentence the Sound page shows.
            sub.textContent = music.holding
                ? 'Loading... ' + Math.floor(musicAhead()) + '/' + music.holdNeed + 's'
                : (track ? track.album : '');
            sub.toggleAttribute('data-wait', music.holding);
            const playing = musicIsPlaying();
            bPlay.innerHTML = playing ? MUSIC_ICONS.pause : MUSIC_ICONS.play;
            bPlay.title = playing ? 'Pause' : 'Play';
            bPlay.setAttribute('aria-label', bPlay.title);
            bShuffle.setAttribute('aria-pressed', settings.musicShuffle ? 'true' : 'false');
            if (document.activeElement !== vol) vol.value = String(settings.musicVolume);
            const el = music.el;
            const loaded = el && music.srcId === music.id;
            const duration = loaded && Number.isFinite(el.duration) ? el.duration : 0;
            const end = loaded && el.buffered.length ? el.buffered.end(el.buffered.length - 1) : 0;
            atFill.style.width = duration ? Math.min(100, (el.currentTime / duration) * 100) + '%' : '0';
            bufFill.style.width = duration ? Math.min(100, (end / duration) * 100) + '%' : '0';
        };
        music.barSync();
    }

    // =========================================================================================
    // 11d. GRAPHICS: THE GAME'S OWN QUALITY LEVELS, FROM THE SETTINGS (6.21)
    // =========================================================================================
    // Game build v0.10.0b added a quality picker of its own (graphicsQuality.js): auto, high,
    // balanced, low, minimal. It decides how sharply the board is drawn and whether marble trails
    // and the king wall shadow are drawn at all, and it changes nothing about the game itself.
    // It sits in the same panel as the sound controls, behind the header button the gear replaces
    // — with the gear on, that panel is hidden and the picker cannot be reached.
    //
    // Like the sound page (11c) this keeps no second copy. The game listens for a change event on
    // anything matching [data-role="graphics-mode"] anywhere on the page, and it redraws every
    // copy of the control from its own state afterwards. Setting the value on its own select and
    // letting the event bubble is therefore exactly the path its own picker takes, storage in
    // localStorage included. Hidden by display:none changes none of that: events do not care
    // whether an element is drawn.
    //
    // The level names and the sentence under them are read off the game's own control, so a build
    // that renames a level or explains it differently says so here without a change.
    const graphicsSelect = () => soundEl('graphics-mode');

    function graphicsState() {
        const sel = graphicsSelect();
        if (!sel || !sel.options || !sel.options.length) return null;
        const opts = [...sel.options];
        return {
            mode: sel.value,
            modes: opts.map(o => o.value),
            label: m => { const o = opts.find(x => x.value === m); return o ? o.textContent.trim() : m; },
            text: ((soundEl('graphics-mode-description') || {}).textContent || '').trim(),
        };
    }

    function chooseGraphicsMode(mode) {
        const sel = graphicsSelect();
        if (!sel || sel.value === mode) return;
        sel.value = mode;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function graphicsCard(redraw) {
        const card = document.createElement('div');
        card.className = 'mcfo-set__card';
        const g = graphicsState();
        if (!g) {
            const note = document.createElement('div');
            note.className = 'mcfo-set__notice';
            note.textContent = 'The game has not drawn its graphics control yet. Open this page again in a moment.';
            card.appendChild(note);
            return card;
        }
        const top = document.createElement('div');
        top.className = 'mcfo-perf__top';
        const seg = document.createElement('div');
        seg.className = 'mcfo-seg mcfo-perf__levels';
        for (const mode of g.modes) {
            const b = document.createElement('button');
            b.type = 'button';
            b.textContent = g.label(mode);
            b.setAttribute('aria-pressed', g.mode === mode ? 'true' : 'false');
            // The game writes the new description into its own control first; read it back after.
            b.addEventListener('click', () => { chooseGraphicsMode(mode); redraw(); });
            seg.appendChild(b);
        }
        const text = document.createElement('div');
        text.className = 'mcfo-perf__text';
        text.textContent = g.text;
        top.append(seg, text);
        card.appendChild(top);
        return card;
    }

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
                            + '<span class="mcfo-footermeta__build"></span>';
            region.prepend(strip);
        }

        const source = role('stat-window-indicator');
        const windowText = (source?.textContent || '').trim().replace(/\s+/g, ' ');
        const windowEl = strip.querySelector('.mcfo-footermeta__window');
        if (windowText && windowEl.textContent !== windowText) windowEl.textContent = windowText;

        const buildEl = strip.querySelector('.mcfo-footermeta__build');
        const want = buildId ? '· ' + buildId : '';
        if (buildEl.textContent !== want) buildEl.textContent = want;
    }

    // =========================================================================================
    // 14. PERFORMANCE: PACING THE PICTURE
    // =========================================================================================
    // The CSS levers are in section 3. Two levers need the page itself, and that is only
    // reachable through unsafeWindow: with any @grant the script runs in a sandbox whose `window`
    // is a wrapper, and replacing a function there changes it for the script alone (the same
    // lesson the socket tap of 1.5 taught).
    //
    // Both are installed only once a lever first asks for them, so with performance off this
    // script touches none of the page's functions. Once in, they pass straight through whenever
    // no lever needs them.
    // pageWindow is defined at the very top (section 0): the socket tap needs it first.
    const toPage = fn => (typeof exportFunction === 'function' ? exportFunction(fn, pageWindow) : fn);

    // --- Frame rate cap and the still crown: one requestAnimationFrame for the whole page ---
    // Every render loop of the game asks for its next frame through window.requestAnimationFrame
    // afresh each time (presentation loop in app.js, cadence loop in ingest.js, the crown), so a
    // replacement takes hold from the next frame on. Callbacks are collected and run together at
    // the capped rate. The chat binds the native function once at start-up and keeps it — it is
    // cheap and stays as it is.
    const RAF_ID_BASE = 1e9;   // our ids live above the browser's, so cancel knows whose it is
    let rafInstalled = false, nativeRaf = null, nativeCaf = null;
    let rafSeq = RAF_ID_BASE, pumpQueued = false, lastPumpAt = 0;
    const rafWaiting = new Map();
    const crownDraws = new WeakMap();      // callback -> is it a crown's draw loop?
    const crownLastRun = new WeakMap();    // callback -> when it last got a frame
    const crownFrozenAt = new WeakMap();   // callback -> the timestamp it keeps being handed
    let framesDelivered = 0;

    const CROWN_STILL_MS = 500;

    function rafPacingWanted() {
        return Number(perfValue('perfFpsCap')) > 0 || (!!perfValue('perfCrownStill') && !perfValue('perfCrownHide'));
    }

    // The crown's loop is recognised by its source: the draw function that turns the model
    // (crownOverlayProofRenderer.js — `spinRadians` and `renderer.render`). Checked once per
    // callback object; each crown re-queues the same function every frame. Should a later build
    // rename it, the check simply finds nothing and the crown is paced like everything else.
    function isCrownDraw(cb) {
        let v = crownDraws.get(cb);
        if (v === undefined) {
            let src = '';
            try { src = Function.prototype.toString.call(cb); } catch (e) {}
            v = src.includes('spinRadians') && src.includes('renderer.render');
            crownDraws.set(cb, v);
        }
        return v;
    }

    function queuePump() {
        if (pumpQueued) return;
        pumpQueued = true;
        nativeRaf(pump);
    }

    function runSafely(cb, t) {
        // One failing callback must not take the others of this frame down with it. The error
        // is rethrown on its own, so it still shows in the console as the game's.
        try { cb(t); } catch (e) { setTimeout(() => { throw e; }); }
    }

    function pump(t) {
        pumpQueued = false;
        const cap = Number(perfValue('perfFpsCap')) || 0;
        // 2 ms of slack, or a 60 Hz screen would miss every other frame of a 30 fps cap by a
        // fraction of a millisecond and land on 20.
        if (cap && t - lastPumpAt < 1000 / cap - 2) { queuePump(); return; }
        lastPumpAt = t;
        if (!rafWaiting.size) return;
        framesDelivered++;

        const still = !!perfValue('perfCrownStill');
        const batch = [...rafWaiting];
        rafWaiting.clear();
        for (const [id, cb] of batch) {
            if (still && isCrownDraw(cb)) {
                // Held back between redraws, and always handed the same timestamp: the crown
                // turns by the time elapsed since its last frame, so with none elapsing it stands.
                // It is still redrawn now and then, so a resized window never leaves it blank.
                if (t - (crownLastRun.get(cb) || 0) < CROWN_STILL_MS) { rafWaiting.set(id, cb); continue; }
                crownLastRun.set(cb, t);
                if (!crownFrozenAt.has(cb)) crownFrozenAt.set(cb, t);
                runSafely(cb, crownFrozenAt.get(cb));
                continue;
            }
            // A crown that was still is let go again: forget its frozen time, so it turns on
            // from where it stood instead of catching up on the whole pause in one jump.
            if (crownFrozenAt.has(cb)) crownFrozenAt.delete(cb);
            runSafely(cb, t);
        }
        if (rafWaiting.size) queuePump();
    }

    function installRafPacing() {
        if (rafInstalled) return;
        try {
            nativeRaf = pageWindow.requestAnimationFrame.bind(pageWindow);
            nativeCaf = pageWindow.cancelAnimationFrame.bind(pageWindow);
            pageWindow.requestAnimationFrame = toPage(function (cb) {
                if (!rafPacingWanted() && !rafWaiting.size) return nativeRaf(cb);
                const id = ++rafSeq;
                rafWaiting.set(id, cb);
                queuePump();
                return id;
            });
            pageWindow.cancelAnimationFrame = toPage(function (id) {
                if (id > RAF_ID_BASE) rafWaiting.delete(id); else nativeCaf(id);
            });
            rafInstalled = true;
        } catch (e) {
            console.warn('[MarbleLuceFall] frame pacing unavailable:', e.message);
        }
    }

    // --- Chat animations: tell the game the player prefers reduced motion ---
    // The chat picks a cosmetic's motion only when prefers-reduced-motion is not set
    // (chatPane.js: `reducedMotion ? 'none' : …`), so newly drawn lines come without animation
    // classes at all; the CSS rule in section 3 stops the ones already on screen. The answer
    // handed back is a real MediaQueryList that matches — '(min-width: 0px)' always does — so
    // the page gets a genuine object and not one of ours.
    let mediaInstalled = false;
    function installReducedMotion() {
        if (mediaInstalled || typeof pageWindow.matchMedia !== 'function') return;
        try {
            const nativeMatchMedia = pageWindow.matchMedia.bind(pageWindow);
            pageWindow.matchMedia = toPage(function (query) {
                if (perfValue('perfChatMotion') && /prefers-reduced-motion\s*:\s*reduce/i.test(String(query))) {
                    return nativeMatchMedia('(min-width: 0px)');
                }
                return nativeMatchMedia(query);
            });
            mediaInstalled = true;
        } catch (e) {
            console.warn('[MarbleLuceFall] reduced-motion hint unavailable:', e.message);
        }
    }

    // --- Frame rate counter ---
    // Counts the frames the game actually gets. With pacing active that is our pump; without
    // it a light native loop of its own, which exists only while the counter is on.
    let fpsBadge = null, fpsTimer = null, fpsLoopOn = false, fpsNativeFrames = 0, fpsLastDelivered = 0;
    function fpsLoop() {
        if (!fpsLoopOn) return;
        fpsNativeFrames++;
        (nativeRaf || pageWindow.requestAnimationFrame.bind(pageWindow))(fpsLoop);
    }
    function drawFpsMeter() {
        if (!settings.perfFpsMeter) {
            if (fpsBadge) fpsBadge.hidden = true;
            if (fpsTimer) { clearInterval(fpsTimer); fpsTimer = null; }
            fpsLoopOn = false;
            return;
        }
        if (!fpsBadge) {
            fpsBadge = document.createElement('div');
            fpsBadge.className = 'mcfo-fps';
            fpsBadge.textContent = '… fps';
        }
        fpsBadge.hidden = false;
        // In the Tickets card, right-aligned. The card is a three-column grid — icon, text, and an
        // action column the Tickets card leaves empty (metricCellDom in app.js) — so the badge
        // simply takes that last column. Floating above the footer it sat half over the chat's
        // Send button. Where the card is not shown (the narrow layouts use tickets-compact
        // instead) it floats as before. Checked on every apply() pass, so it follows the layout.
        const card = document.querySelector('[data-role="metric-cell"][data-metric-role="tickets"]');
        if (card && card.getBoundingClientRect().width > 0) {
            if (fpsBadge.parentElement !== card) card.appendChild(fpsBadge);
            fpsBadge.classList.add('mcfo-fps--card');
            fpsBadge.style.bottom = '';
        } else {
            if (fpsBadge.parentElement !== document.body) document.body.appendChild(fpsBadge);
            fpsBadge.classList.remove('mcfo-fps--card');
            const footer = role('action-region');
            const above = footer ? Math.round(innerHeight - footer.getBoundingClientRect().top) : 56;
            fpsBadge.style.bottom = (above + 8) + 'px';
        }
        if (!fpsLoopOn) { fpsLoopOn = true; fpsNativeFrames = 0; (nativeRaf || pageWindow.requestAnimationFrame.bind(pageWindow))(fpsLoop); }
        if (!fpsTimer) {
            fpsLastDelivered = framesDelivered;
            fpsTimer = setInterval(() => {
                const paced = rafInstalled && rafPacingWanted();
                const fps = paced ? framesDelivered - fpsLastDelivered : fpsNativeFrames;
                fpsLastDelivered = framesDelivered;
                fpsNativeFrames = 0;
                fpsBadge.textContent = fps + ' fps';
                fpsBadge.setAttribute('data-mcfo-tone', fps < 20 ? 'low' : fps < 40 ? 'mid' : 'ok');
            }, 1000);
        }
    }

    function applyPerformance() {
        const tokens = [];
        if (perfValue('perfShadows'))    tokens.push('shadows');
        if (perfValue('perfCrownStill')) tokens.push('crownstill');
        if (perfValue('perfCrownHide'))  tokens.push('crownhide');
        if (perfValue('perfChatMotion')) tokens.push('chatmotion');
        if (perfValue('perfNoBlur'))     tokens.push('noblur');
        if (perfValue('perfEdges'))      tokens.push('edges');
        const want = tokens.join(' ');
        if (document.documentElement.getAttribute('data-mcfo-perf') !== want) {
            document.documentElement.setAttribute('data-mcfo-perf', want);
        }
        if (rafPacingWanted()) installRafPacing();
        if (perfValue('perfChatMotion')) installReducedMotion();
        drawFpsMeter();
    }

    // =========================================================================================
    // 13. APPLY AND WATCH
    // =========================================================================================
    function apply() {
        document.documentElement.setAttribute('data-mcfo-hide',
            FOOTER_BUTTONS.filter(b => settings[b.key]).map(b => b.role).join(' '));
        document.documentElement.setAttribute('data-mcfo-glass', settings.glassOverlays ? '1' : '0');
        applyTunables();
        applyGlassToFrames();
        placeTaskbar();
        applyPerformance();
        themeTick();
        scheduleThemeRotation();
        // The card, not the line of text inside it: session-cell is 418x43 and a real click
        // target, while tileset-indicator is a 13px strip. The two cards are the same width and
        // sit next to each other, so the menu belongs to the whole card.
        // For the account it is deliberately profile-entry and not profile-sound-cell: the sound
        // button lives in the latter, and it should go on controlling the sound.
        bindMenu(role('profile-entry'), 'account', a => showMenu(a, accountEntries()));
        bindMenu(firstRole('session-cell', 'tileset-indicator'), 'events', showEvents);
        buildCards();
        buildFooterMeta();
        buildTilesetBanner();
        buildRailGroup();
        buildUnbid();
        buildAutobid();
        buildTollField();
        document.documentElement.setAttribute('data-mcfo-chatrail', settings.chatRail ? '1' : '0');
        document.documentElement.setAttribute('data-mcfo-sugg', settings.chatSuggest ? '1' : '0');
        applyBoardClear();
        buildHeaderButtons();
        buildMusicBar();
        soundDefaultOnce();
        drawChatRail();
        drawChatPop();
        applyChatPlus();
        applyChatGrow();
        applyChatStick();
        watchTray();
        buildKingTray();
        buildAttackAssist();
        syncDrinkHeight();
        throneTick();
        placeKingTray();
        watchTrayHeight();
        alignPanes();
        placeChat();
        drawKingFields();
        // Last: the chips above change the width of the rail, and only then is it worth aligning.
        buildExtraChips();
        centreRail();
        readChat();
    }

    // The game rebuilds parts of the interface when the view changes, and the fields on the king
    // tile and the menu bindings go with it. Rather than watch every mutation (the king frame
    // changes every physics frame) it is redone on a fixed beat — cheap, because with the
    // elements in place these functions only touch text nodes.
    setInterval(apply, 1500);
    addEventListener('resize', centreRail);

    // Start-up, step by step, each one on its own. Until 6.21.1 this was a single run of calls
    // with startAutobid() at the end of it, and that is one throw away from an autobid that never
    // starts: no beat, no lane listener, nothing, for the whole life of the page. The page of the
    // game is not always in the shape a step expects the first time, and apply() and
    // restoreParked() run synchronously right in front of it. apply() has a beat of its own and
    // heals itself, autobid had nothing — which is why it had to be reloaded or switched off and
    // on again, the switch ticking it by hand (reported 20.09.2026).
    //
    // Autobid goes first now. It is the part that acts on its own and must not wait on anything
    // above it having gone well; it touches no element that has to exist.
    const step = (what, fn) => {
        try { fn(); } catch (e) { console.warn('[MarbleLuceFall] start-up step "' + what + '" failed:', e && e.message); }
    };
    step('autobid', startAutobid);
    // Random theme: picked before the first pass, so the page never shows the old one first.
    step('random theme', () => { if (settings.themeRandom) randomTheme(); });
    step('first pass', apply);
    step('parked windows', restoreParked);
    step('king', () => { pollKing(); setInterval(pollKing, KING_POLL_MS); });
    // Read-only and cheap; also picks up a fresh set of rights after a throne change.
    step('beverages', () => { pollBeverages(); setInterval(pollBeverages, 20000); });
    step('build id', loadBuildId);
    // A moment after start-up, once the game has built its page.
    setTimeout(maybeShowWhatsNew, 1200);
    }   // end of main()

    // At document-start there is no DOM yet — the socket tap in section 0 is all that could run
    // that early. main() takes over as soon as the page is there.
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', main, { once: true });
    else main();
})();
