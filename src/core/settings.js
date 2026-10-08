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
            { key: 'pointsLoadouts', label: 'Loadouts on the Current Points card',
              hint: 'Click the Current Points card for your saved loadouts and put one on straight away. They are made in Inventory › Loadouts.' },
            { key: 'ticketHistory', label: 'Ticket history on the Tickets card',
              hint: 'Click the Tickets card: tickets earned and spent in the last hour, today and since you opened the page, and why you are earning or not. Counted in this browser while the game is open in a tab.' },
            { key: 'ticketFly', label: 'Flying tickets',
              hint: 'When tickets come in, a few small tickets and the amount fly out of the Tickets card, once for every portion the game hands out. Left out at the Maximum performance level and when your system asks for less motion.' },
            { key: 'sessionNext', label: 'Next tileset on the tileset card',
              hint: 'The tileset card reads "Current: ..." and below it "Next: ..." with the start time. The game\'s Active / Inactive line moves over to the Tickets card.' },
            { key: 'eventsPanel', label: 'Upcoming tilesets',
              hint: 'Click the tileset card to see what comes next.',
              sub: { key: 'eventsHours', type: 'choice', label: 'Look ahead', def: 12, options: [[3, '3 hours'], [12, '12 hours']] } },
            { key: 'tilesetBanner', label: 'Tileset name instead of the splash picture',
              hint: 'When a new tileset begins, its name fades in over the board instead of the full-screen picture, and the board stays visible behind it.',
              subs: [
                { key: 'tilesetBannerSize', type: 'range', label: 'Size', min: 50, max: 250, step: 10, def: 100, unit: '%' },
                { type: 'action', label: 'Preview', text: 'Show now', run: () => previewTilesetBanner() },
              ] },
            { key: 'settingsButton', label: 'Settings button',
              hint: 'A gear top right in place of the game\'s sound button: one click to these settings. The sound controls are on the Sound page.' },
        ]},
        { title: 'Sound', blurb: 'Sound effects, and a music player over the game\'s whole soundtrack, with a bar for the page.', render: 'sound' },
        { title: 'King tile', blurb: 'The reign read-outs and the beverage buttons on the tile.', items: [
            // Since game v0.10.1 the tile carries its own read-outs in the top corners (name,
            // reign, duration left; gold, tolls, challengers right). Our own name and toll fields
            // sat on exactly those corners, so they now join the game's block instead: the name is
            // the game's, the set toll becomes one more line on the right.
            { key: 'kingCorner', label: 'Reign read-outs',
              hint: 'The lines in the top corners of the king tile, plus the toll the King has set. Pick the lines below.',
              subs: [
                  { key: 'kingCornerSize',  type: 'range', label: 'Text size',  min: 60, max: 160, step: 5, def: 100, unit: '%' },
                  { key: 'kingCornerAlpha', type: 'range', label: 'Visibility', min: 20, max: 100, step: 5, def: 100, unit: '%' },
              ] },
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
        ], grid: { title: 'Lines on the king tile', items: [
            { key: 'kcName',     label: 'King name',             hint: 'top left' },
            { key: 'kcReign',    label: 'Reign number',          hint: 'top left' },
            { key: 'kcDuration', label: 'Reign duration',        hint: 'top left' },
            { key: 'kcVip',      label: 'VIP tier',              hint: 'top left, under the title, in the colour of the tier, added by MarbleLuceFall' },
            { key: 'kcGold',     label: 'Gold this reign',       hint: 'top right' },
            { key: 'kcTolls',    label: 'Points from tolls',     hint: 'top right' },
            { key: 'kcThwarted', label: 'Challengers thwarted',  hint: 'top right' },
            { key: 'kingToll',   label: 'Toll setting',          hint: 'top right, added by MarbleLuceFall' },
        ] } },
        { title: 'On the throne', blurb: 'Typing the toll, and beverages poured by themselves the moment you take the crown. The toll on taking the throne is the game\'s Default Toll (Inventory).', throne: true, items: [
            { key: 'tollInput', label: 'Type the toll',
              hint: 'On the throne: a field for 0 up to your own toll limit, confirmed with Enter, instead of the Reduce and Increase buttons.' },
            { key: 'tollSlider', def: false, label: 'Toll slider',
              hint: 'Adds a slider next to the field. Needs the field above.' },
            { key: 'throneDrinks', def: false, redraw: true, label: 'Pour beverages',
              hint: 'Opt-in. The beverages picked below are poured as soon as the game unlocks them, 15 seconds into your reign, each through the game\'s own button. Its limits still apply: every beverage, size and currency once per reign, and only with enough gold or diamonds. Starts with your next reign, never in the middle of one.' },
        ]},
        { title: 'Ticket rail', blurb: 'Rebellion, Unbid, folding and extra chips.', items: [
            { key: 'railGroup', label: 'Rebellion button and folding',
              hint: 'Rebellion sits beside the chips, the bigger amounts fold away behind an arrow. While you are King it becomes Royal Celebration, beside the toll.' },
            { key: 'unbidButton', label: 'Unbid button',
              hint: 'Right of the chips: takes your bid back out of the queue with one click, the same as typing !unbid in the chat. Hidden while you are King.' },
            { key: 'autobidButton', label: 'Autobid button',
              hint: 'Right of Unbid: opens the autobid menu, where you switch it on, pick 1 to 100 tickets per tile and choose risk protection. One bid per tile. Hidden and paused while you are King.' },
            { key: 'rebellionPanel', label: 'Own Rebellion panel',
              hint: 'All eight tiers at a glance, with a confirm step before diamonds are spent. As King the same for the eight Royal Celebration tiers. Needs the Rebellion button above.' },
            { key: 'extraChips', label: 'Extra ticket chips',
              hint: '10K up to 1B, unlocked like the built-in ones: at ten times the amount in tickets.' },
            { key: 'centreRail', label: 'Centre the rail on the board' },
        ]},
        // 6.49: one switch for everything, one per group, one per cosmetic. A switch above covers the
        // ones below it (they show on and greyed); each keeps its own state for when it is uncovered.
        { title: 'Cosmetics', blurb: 'Hide cosmetics: all at once, a whole group, or one by one.', cosmetics: true, items: [
            { key: 'hideCosAll', def: false, redraw: true, label: 'Hide all cosmetics',
              hint: 'Opt-in. Every marble, chat and King cosmetic below is drawn the plain way, for every player including you. Only you see it this way; nothing changes for the others.' },
        ], groups: [
            { title: 'Marbles', note: 'Takes hold with the next run on each lane.', items: [
                { key: 'hideCosMarbles', def: false, redraw: true, group: true, label: 'Hide all marble cosmetics' },
                { key: 'hideTrails', def: false, label: 'Hide marble trails', hint: 'Marbles run without their trail.' },
                { key: 'hideBorders', def: false, label: 'Hide marble borders', hint: 'No rings around the marbles.' },
                { key: 'hideAuras', def: false, label: 'Hide rebellion auras', hint: 'A rebellion shows in the game\'s own default aura.' },
                { key: 'bidIndicatorMode', type: 'seg', def: 0, label: 'Bidding indicators',
                  options: [[0, 'Show'], [1, 'Standard size'], [2, 'Hide']],
                  hint: 'Standard size: every decorated indicator keeps its look and is drawn as small as the game\'s plain bid banner; the amount keeps its size. Hide: every bid in the plain grey banner.' },
            ]},
            { title: 'Chat', note: 'From the next message on. Hiding the whole group uses the game\'s own cosmetics button in the chat header and turns it back on when you switch this off.', items: [
                { key: 'hideCosChat', def: false, redraw: true, group: true, label: 'Hide all chat cosmetics' },
                { key: 'hideChatColours', def: false, label: 'Hide chat font colours', hint: 'Messages in plain white.' },
                { key: 'hideChatBackgrounds', def: false, label: 'Hide chat backgrounds', hint: 'No coloured or patterned panels behind messages.' },
                { key: 'hideUsernameStyles', def: false, label: 'Hide username styles', hint: 'Names in the plain name colour, without flourishes.' },
                { key: 'hideKingBubbles', def: false, label: 'Hide King chat bubbles', hint: 'The King\'s messages in the game\'s default royal bubble.' },
            ]},
            { title: 'King', items: [
                { key: 'hideCosKing', def: false, redraw: true, group: true, label: 'Hide all King cosmetics' },
                { key: 'hideCrown', def: false, label: 'Hide the crown', hint: 'No crown on the King tile.' },
                { key: 'hideWreath', def: false, label: 'Hide the wreath', hint: 'No wreath around the King\'s picture. Takes hold with the next King update.' },
            ]},
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
              hint: 'When someone throws a tomato at you, the chat shows one small line with their name instead of the picture, with an x to dismiss it. The answers to your own throws become small lines too; thrown with the tomato button, all answers of one throw are one line.' },
            { key: 'chatTomatoBtn', label: 'Tomato button',
              hint: 'A tomato between the message box and Send. It lists the players you can throw at (the same list the game offers for !tomato): tick one, several or All, and throw. Each throw goes out as an ordinary !tomato line in the chat.' },
            { key: 'chatAnimalBtn', label: 'Animal call button',
              hint: 'A paw next to the tomato. It lists every animal call (!howl, !honk, ...): one click sends it. While a gathering runs in the chat, its animal stands on top with how many have joined and roughly how long it goes on, and the paw gets a dot.' },
            { key: 'chatMentions', label: 'Highlight messages that mention you',
              hint: 'A message with your name in it (with or without @) gets a gold frame, so it stands out while the chat runs on. Your own messages are left out. Nicknames: other words that mean you, separated by commas.',
              sub: { key: 'chatMentionNames', type: 'text', label: 'Nicknames', def: '', placeholder: 'e.g. lucie, luce', run: () => mentionRefresh() } },
            { key: 'chatEmotes', def: false, label: 'Twitch emotes',
              hint: 'Opt-in. Words like Kappa, LUL or PogChamp show as the emote, as in a Twitch chat: Twitch\'s global emotes, exact spelling, whole words. Only you see them; everyone else reads the word. The pictures come from Twitch, the list of names from emotes.adamcy.pl, once a day.' },
            { key: 'chatTabComplete', label: 'Complete names with @ and Tab',
              hint: 'Type @ and the start of a name, then Tab: the name is filled in, Tab again for the next match (Shift+Tab goes back). The @ is left out of the message. Names come from the chat and from the players in the game.' },
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
        { title: 'Shop and dailies', blurb: 'Quest hints and euro prices in the shop, your daily rewards in one click.', items: [
            { key: 'shopQuestAlarm', label: 'Quest alarm',
              hint: 'An offer that would complete one of today\'s open shop quests gets a gold Quest tag in the shop, and the Shop button a gold dot while such an offer is in the rotation. Nothing is bought.' },
            { key: 'questMarks', label: 'Quest dots on Rebellion and beverages',
              hint: 'A gold dot on the Rebellion (or Royal Celebration) button and on a beverage button while one of today\'s open quests asks for it. In the Rebellion popup the tier the quest wants has a gold frame; the beverage panel names the quest and how far you are.' },
            { key: 'shopEuro', label: 'Diamond prices in euros',
              hint: 'Beside every diamond price in the shop, what those diamonds cost: from the cheapest to the dearest diamond pack, at today\'s exchange rate.' },
            { key: 'dailyClaimAll', label: 'Claim all dailies',
              hint: 'A gold dot on your account card while a quest reward or a daily item is waiting, and "Claim all dailies" at the top of its menu — one click claims everything that is ready.' },
            { key: 'dailyAutoClaim', def: false, label: 'Claim dailies by themselves',
              hint: 'Opt-in. Finished quests and the free daily items are claimed as soon as they are ready, also right after the daily reset, with a short notice of what came in. You miss the reveal on the Dailies page that way.' },
        ]},
        { title: 'Inventory', blurb: 'A new inventory over the game\'s, and how the classic one opens its categories.', items: [
            { key: 'invOverhaul', label: 'New inventory',
              hint: 'The inventory as a gallery: categories on the left, search, rarity, Equipped and In pool filters above the cards, a large preview with Equip and Pool on the right, and an Overview of everything you wear. Crowns show on your profile picture, as in the shop. It uses the game\'s own lists, actions and pictures. "Classic inventory" at the bottom of its sidebar opens the game\'s inventory for one visit. Takes effect the next time the inventory opens.' },
            { key: 'invRarityGroups', label: 'Rarities first (classic inventory)',
              hint: 'In the game\'s own inventory: a category opens on one tile per rarity, with how many items you have in it, and whether your equipped item and pool items are among them. Items without a rarity (No Treatment, No Crown, Basic) share the Default tile. Click a tile for its items, "Rarities" goes back. The tiles use the game\'s own rarity filter.' },
        ]},
        { title: 'Achievements', blurb: 'A new achievements page over the game\'s.', items: [
            { key: 'achOverhaul', label: 'New achievements page',
              hint: 'Built like the new inventory: categories on the left with how far you are in each, an Overview on top (AP, next reward, AP reward cycles, closest to done, recently unlocked, Public Chronicle), search, In progress / Unlocked, Badges / Career lines and sorting above the cards, everything about the picked achievement on the right - for career lines all milestones earned and the next one. "Classic achievements" at the bottom of its sidebar opens the game\'s page for one visit. Takes effect the next time the page opens.' },
        ]},
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
            if (item.type === 'seg') {
                const v = Number(stored[item.key]);
                settings[item.key] = item.options.some(o => o[0] === v) ? v : def;
            }
            for (const sub of itemSubs(item)) {
                if (sub.type === 'action') continue;   // a button, nothing to store
                settingDefaults[sub.key] = sub.def;
                if (sub.type === 'text') { settings[sub.key] = typeof stored[sub.key] === 'string' ? stored[sub.key].slice(0, 300) : sub.def; continue; }
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
        return [...(section.items || []), ...(section.grid ? section.grid.items : []), ...(section.extra ? section.extra.items : []),
                ...(section.groups || []).flatMap(g => g.items)];
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
    // 6.54: risk tiles during a Royal Celebration. Off unless switched on: the celebration makes
    // the zero zones safe, but it multiplies the minus zones (see celebrationFree in 9g).
    settingDefaults.autobidCelebration = false;
    settings.autobidCelebration = stored.autobidCelebration === true;
    // 6.29: tile lists, as in the MarbleMind bot. With "Only known tiles" on (the default) a bid
    // goes only onto a tile on the allowlist — a tile the game has just added is skipped until
    // someone allows it by hand. The blocklist comes on top of the risk tiles. The starting
    // allowlist is the bot's, every tile that has been played safely for weeks.
    const AB_DEFAULT_ALLOW = ['Baby Deathball Jackpot', 'Big Bumper Minus', 'Big Bumper Plus', 'Big Bumper Plus v2',
        'Bounce House', 'Deathball Jackpot', 'Deathball Rush', 'Deathball Rush v2', 'Deathball Rush v3',
        'Deathball Rush v4', 'Deathball Rush v5', 'Diamond Drop', 'Downward Slope', 'Forked Frenzy', 'Forked Frenzy v2',
        'Giant Bumper', 'Golden Rotation', 'Hexagonal', 'Hole in One', 'How Low Can You Go', 'Mini Bumper', 'No Gains',
        'Not Stonks', 'Nouble or Dothing', 'Ouroboros', 'Pegboard Mania', 'Rhombic', 'Rise and Grind',
        'Rise and Grind v2', 'Rise and Grind v3', 'Small Gains', 'Squarewise', 'Stonks', 'Upward Slope',
        'Upward Slope v2', 'Upward Slope v3'];
    const tileList = v => Array.isArray(v) ? v.filter(t => typeof t === 'string' && t.trim()).map(t => t.trim()) : null;
    settingDefaults.autobidKnownOnly = true;
    settings.autobidKnownOnly = stored.autobidKnownOnly !== false;
    settingDefaults.autobidAllow = AB_DEFAULT_ALLOW;
    settings.autobidAllow = tileList(stored.autobidAllow) || AB_DEFAULT_ALLOW.slice();   // a copy, never the defaults' array
    settingDefaults.autobidBlock = [];
    settings.autobidBlock = tileList(stored.autobidBlock) || [];

