    // Newest first. The first entry is what What's new shows after a fresh install.
    const CHANGELOG = [
        { v: '6.59.1', date: '2026-10-08', items: [
            'Attack when free waits out a Royal Celebration and your own Rebellion, the way it waits out a lava cooldown: your autobid keeps playing, no unbid is sent, and the attack goes in right after. Before, it sent an unbid for nothing and gave up after five minutes ("NOT FREE IN 5 MIN").',
        ] },
        { v: '6.59', date: '2026-10-08', items: [
            'Windows can be resized at every edge and corner now, not only at the grip bottom right.',
            'Achievements and the new inventory have a Reload button in their header: the data is loaded again, and you stay on the page and the category you are on.',
        ] },
        { v: '6.58.1', date: '2026-10-08', items: [
            'Achievements: a Completed filter beside In progress and Unlocked - only what is fully done (unlocked achievements and career lines with no milestone left). Unlocked still shows career lines from their first milestone on.',
        ] },
        { v: '6.58', date: '2026-10-08', items: [
            'A new achievements page, built like the new inventory: categories down the left, each with how many you have done and a small bar, and an Overview on top - Achievement Points, the next reward with its progress, the current and next AP reward cycle, the achievements closest to done, recently unlocked, and your Public Chronicle (copy link, public / private).',
            'Each category is a grid of cards: unlocked ones in the colour of their category, open ones dark with a progress bar. Search, All / In progress / Unlocked, Badges / Career lines, and sorting by closest to done, recently unlocked, most AP or name.',
            'The right column shows everything about the picked achievement: description, progress, what is still to do, AP - and for career lines every milestone earned (with date) and the next one.',
            'The game\'s page is one click away: "Classic achievements" at the bottom of the sidebar, or switch the new one off in Settings \u203a Achievements.',
        ] },
        { v: '6.57.2', date: '2026-10-08', items: [
            'New inventory: one look for every category - the whole card in the colour of its rarity (Exclusive white, with dark text), the picture on one neutral ground, the large preview framed in the same colour. The same for the Overview slots.',
            'Royal Titles and Default Tolls show their rarity again: coloured cards, rarity chips and the rarity under the name.',
        ] },
        { v: '6.57.1', date: '2026-10-08', items: [
            'New inventory: every picture sits on the colour of its rarity, so the rarities stand apart at a glance - Exclusive on white, as the game shows its crowns.',
            'Default Tolls and Royal Titles: smaller cards, and the occasions a toll or title is used for in a short row of their own instead of the large circles.',
            'Overview: wreath, trail and aura are centred in their slots.',
            'Rarity chips also for categories with a single rarity (Rebellion Auras).',
        ] },
        { v: '6.57', date: '2026-10-08', items: [
            'A new inventory: categories down the left, with an Overview on top that shows everything you wear (crown, wreath, titles, tolls, border, trail, indicator, aura and all four chat slots) - click a slot to change it.',
            'Each category is a gallery: search, rarity chips with counts, Equipped and In pool filters and sorting above the cards; the right column shows the item large, with Equip, Add to pool, its colours and where it came from. Double-click (or Enter on) a card to equip it.',
            'Crowns show on your profile picture, as in the shop, or switch to the whole King tile. Random, pool size and Empty pool sit in the header of the page.',
            'Loadouts work as before: the bar on top, + Loadout and + Pool on the cards.',
            'The game\'s own inventory is one click away: "Classic inventory" at the bottom of the sidebar, or switch the new one off in Settings \u203a Inventory.',
        ] },
        { v: '6.56.1', date: '2026-10-08', items: [
            'Inventory: rarity tiles also for categories with a single rarity (Rebellion Auras and the like).',
            'Items without a rarity (No Treatment, No Crown, Basic) share a tile of their own, Default, last.',
            'The rarity tiles now work through the game\'s new rarity filter (the select above the cards) - the same list, paging and Equipped as the game, and the Equipped checkbox stays beside the cards.',
            'Fixed: the game\'s own rarity and Equipped filters had no effect on crowns and chat cards with MarbleLuceFall (its card layout kept the hidden cards on screen).',
        ] },
        { v: '6.56', date: '2026-10-08', items: [
            'Inventory: every category with more than one rarity now opens on one tile per rarity (Exclusive, Mythic, Legendary, Epic, ...) with how many items you have in it, and whether your equipped item and pool items are among them. Click a tile to see only that rarity\'s items, \u2039 Rarities goes back. Borders, trails, auras, indicators and wreaths page through that rarity alone. Switch it off in Settings \u203a Inventory \u203a Rarities first.',
        ] },
        { v: '6.55.1', date: '2026-10-08', items: [
            'Clearer wording in the notes of 6.55.',
        ] },
        { v: '6.55', date: '2026-10-08', items: [
            'Toll field on the throne: field, slider and the number beside them now take their upper end from the game, the same limit the game\'s own Reduce and Increase buttons use.',
        ] },
        { v: '6.54.2', date: '2026-10-07', items: [
            'Inventory, Rebellion Auras: the aura pictures stay inside their card again. If the window was minimised or hidden while the game drew them, an aura could run over its name and hide the Equip and Pool buttons.',
            'Inventory in a narrow window (about 820 to 1000 px wide): details, preview and your items now scroll as one column next to the sidebar, instead of squeezing the item list down to a single cut-off card.',
        ] },
        { v: '6.54.1', date: '2026-10-07', items: [
            'Windows: the buttons of minimised windows now stay in the background. A window moved down into the corner covers them instead of sitting behind them.',
        ] },
        { v: '6.54.0', date: '2026-10-07', items: [
            'Autobid: new switch "Risk tiles in a Royal Celebration" (off by default). While a tile belongs to a Royal Celebration its zero zones are safe, so Autobid may bid on risk tiles like Chance Time or Jackball Deathpot then. Minus zones still count, multiplied by the celebration; your blocklist still applies.',
        ] },
        { v: '6.53', date: '2026-10-06', items: [
            'Inventory: Crowns open at once. The game sends the whole crown list (over a megabyte) on every click, which took 2-3 seconds; the last list is now shown straight away and checked against the server in the background. If something changed - a new crown, or the bot or a loadout equipped one - the page loads again by itself with the fresh list.',
        ] },
        { v: '6.52.5', date: '2026-10-06', items: [
            'Royal Celebration: the pink outline now sits right on the lane tiles. With see-through board frames it used to stand around the empty room above and below them.',
        ] },
        { v: '6.52.4', date: '2026-10-06', items: [
            'Inventory: marble borders fill their picture now (6.52.2 still left a wide empty margin around them).',
        ] },
        { v: '6.52.3', date: '2026-10-06', items: [
            'Inventory: trail previews are shown as the game draws them again (6.52.2 made them a little smaller).',
        ] },
        { v: '6.52.2', date: '2026-10-06', items: [
            'Inventory cards: crowns sit in the middle of their picture again instead of being cut off at the bottom.',
            'Inventory cards show picture, name and buttons only. The description (colours, materials, construction ...) is on the big panel when you click an item.',
            'Inventory previews fit the item: borders, auras and bidding indicators fill their picture instead of sitting small in a big empty box; chat previews get the room to show the whole message.',
            'Inventory: the list now keeps exactly the item you were looking at in place, also on the chat pages, where the previews are drawn a moment later.',
        ] },
        { v: '6.52.1', date: '2026-10-06', items: [
            'Inventory: the page really uses the whole window now, left-aligned (in 6.52 the game still kept it narrow and centred in the live game), so more items fit in a row.',
        ] },
        { v: '6.52', date: '2026-10-06', items: [
            'Inventory: the item list keeps its place. Looking at an item or equipping it no longer throws you back to the top of the list.',
            'Inventory: the page uses the whole window and the items sit in a grid of small cards, five to seven per row instead of one or two big ones. Badges sit on the picture, the buttons are short (+ Pool, \u2212 Pool); the full text is in the tooltip.',
        ] },
        { v: '6.51.2', date: '2026-10-06', items: [
            'Bidding indicators in Standard size are now exactly as big as the plain bid banners, in width and in height (6.51.1 matched the width and left them lower).',
        ] },
        { v: '6.51.1', date: '2026-10-06', items: [
            'Bidding indicators in Standard size: the amount sits in the middle of the frame again (in 6.51 it stayed at the right edge on the lanes), and the indicator is now no wider than the plain bid banner either.',
        ] },
        { v: '6.51', date: '2026-10-06', items: [
            'Bidding indicators in Standard size now keep their own look: they are only drawn smaller, to the height of the plain bid banner, with the amount at its normal size. In 6.50 they turned into a plain panel in their colours instead. Takes hold at once, no new run needed.',
            'Messages that mention you are highlighted in your theme\'s accent colour instead of the same gold for everyone. The game\'s own Crownfall theme keeps the gold.',
        ] },
        { v: '6.50', date: '2026-10-06', items: [
            'Bidding indicators can now be shrunk instead of hidden: Settings › Cosmetics › Marbles › Bidding indicators has three states, Show, Standard size and Hide. Standard size turns every decorated indicator into the game\'s normal bid banner in that player\'s colours, so the big ones no longer cover half the tile. Hide works as before; whoever had it on keeps it.',
        ] },
        { v: '6.49', date: '2026-10-06', items: [
            'New settings page Cosmetics: hide every cosmetic with one switch, a whole group (Marbles, Chat, King) or one by one: marble trails, borders, rebellion auras, bidding indicators; chat font colours, backgrounds, username styles, King chat bubbles; the crown and the wreath on the King tile. Everything is then drawn the plain way, for every player including you, and only you see it so. Hiding all chat cosmetics uses the game\'s own cosmetics button in the chat header.',
            'Hide bidding indicators has moved from Settings › Ticket rail to Settings › Cosmetics. A switch you had on stays on.',
        ] },
        { v: '6.48', date: '2026-10-06', items: [
            'Loadouts now include Wreaths and Rebellion Auras: on those inventory pages the cards get + Loadout and + Pool like trails and borders, and putting on a loadout equips them too. Loadout codes stay compatible with the MarbleMind bot.',
        ] },
        { v: '6.47', date: '2026-10-03', items: [
            'Hide bidding indicators (opt-in, Settings › Ticket rail › Hide bidding indicators): the decorated bid banners on the lanes are no longer drawn, every bid shows in the game\'s plain grey banner with the amount. Only you see it this way; it takes hold with the next run on each lane.',
        ] },
        { v: '6.46', date: '2026-10-03', items: [
            'Loadouts know Bidding Indicators (new in the game with v0.10.2): a loadout now saves your indicator with its random pool and puts it back on. In the inventory the Bidding Indicator Style page has the Loadout and Pool buttons like trails and borders. Older loadouts without an indicator leave yours as it is.',
        ] },
        { v: '6.45', date: '2026-10-02', items: [
            'Twitch emotes in the chat (opt-in, Settings › Chat › Twitch emotes): words like Kappa, LUL or PogChamp show as the emote, as in a Twitch chat - all of Twitch\'s global emotes, exact spelling, whole words. Only you see them; the message itself stays plain text, so everyone else reads the word.',
        ] },
        { v: '6.44', date: '2026-10-01', items: [
            'Player gifts: a new window in the account menu that lists everyone playing this episode (and whoever wrote in the chat lately) with what you can still give them - one Gold Gift and one Diamond Gift per player, ever. A search box filters the list and also finds players who are not on it; "Only players I can still gift" hides everyone you are done with. Click a player for the amounts the game allows, click an amount twice to send. Players you already gifted, or whose lifetime cap is full, are remembered and not asked for again.',
        ] },
        { v: '6.43', date: '2026-10-01', items: [
            'Attack when free: the 3 minutes in which a freshly crowned King cannot be attacked are now sat out like a lava cooldown - your autobid keeps playing, nothing is unbid, and the button counts down "NEW KING SAFE 2:14". Before, bidding stopped for those 3 minutes.',
        ] },
        { v: '6.42', date: '2026-10-01', items: [
            'King tile: the King\'s VIP tier (for example "Ruby Initiate") now sits under the title line, in the colour the game gives that tier. Switch it in Settings \u203a King tile \u203a VIP tier.',
        ] },
        { v: '6.41', date: '2026-09-29', items: [
            'Inventory: the new unlock info (the round i next to royal titles and default tolls) and its popup now wear your theme - ring in the colour of the card edges, popup in the theme\'s panel colour, accent on hover.',
            'Windows reload their page by themselves when the game was updated in the meantime. Until now a window could keep showing the page from before the update (the unlock info only appeared after Ctrl+Shift+R).',
            'Your Royal Titles (N): the count tooltip names the titles every player has again (the game moved that text into the unlock info).',
        ] },
        { v: '6.40', date: '2026-09-29', items: [
            'Animal call button: the popup now says when the next gathering can start (after one ends there is a pause of at least 10 minutes), and animals still resting from their own gathering (an hour) are greyed out with the minutes left. The times come from the gatherings your tab has seen in the chat and are kept across reloads.',
        ] },
        { v: '6.39.2', date: '2026-09-29', items: [
            'Animal call button: "Joined" now also turns red for players with a name flourish (the diamond or wing after the name), and when the game answers "You\'re already part of ...".',
            'Chat: with a name flourish, @ + Tab no longer puts the flourish into the completed name, and your own messages are no longer highlighted as mentions.',
        ] },
        { v: '6.39.1', date: '2026-09-29', items: [
            'Animal call button: once you have joined the running gathering, its entry turns red and says "Joined", and the dot on the paw turns red as well.',
        ] },
        { v: '6.39', date: '2026-09-29', items: [
            'Animal call button: a paw next to the tomato lists all 17 animal calls (!howl, !honk, !croak, ...); one click sends the call. While a gathering runs in the chat, its animal stands on top with how many have joined and about how long it goes on, and the paw gets a green dot. Switch: Settings \u203a Chat \u203a Animal call button.',
        ] },
        { v: '6.38.4', date: '2026-09-29', items: [
            'Inventory \u203a Royal Title: "Your Royal Titles" shows how many you have; the tooltip says how many of them every player has.',
            'The Profile and Leaderboards windows lose their own dark page ground: see-through like the other windows, with your theme\'s pattern or Deluxe background, and without their own header bar.',
        ] },
        { v: '6.38.3', date: '2026-09-29', items: ['The Profile and Leaderboards windows wear your theme too, like the Shop, Dailies and Inventory already did.'] },
        { v: '6.38.2', date: '2026-09-29', items: ['Tomato button: while All is ticked, players who turn up later are ticked as well, also right before you throw. Unticking anyone ends it; All stays ticked across reloads.'] },
        { v: '6.38.1', date: '2026-09-29', items: ['Flying tickets: every portion of tickets the game hands out gets its own flight, instead of being gathered for 30 seconds.'] },
        { v: '6.38.0', date: '2026-09-29', items: [
            'Click the Tickets card for your ticket history: earned and spent in the last hour, today and since you opened the page, why you are earning or not, and a way to the Leaderboards. Settings \u203a Header \u203a Ticket history on the Tickets card',
            'Flying tickets: when tickets come in, a few small tickets and the amount fly out of the Tickets card, gathered to at most once every 30 seconds. Settings \u203a Header \u203a Flying tickets',
        ] },
        { v: '6.37.1', date: '2026-09-29', items: [
            'The loadouts menu on the Current Points card opens on the first click. It used to wait for the inventory first, so the first click seemed to do nothing, and a second click in that time closed it again.',
            'The frame rate counter moved into the chat header; the Tickets card keeps only the Active line, right-aligned.',
        ] },
        { v: '6.37.0', date: '2026-09-29', items: [
            'Mentions with nicknames: add the other words people call you (e.g. short forms of your name), separated by commas, and messages with them get the gold frame too. Settings \u203a Chat \u203a Highlight messages that mention you',
            'Type @ and the start of a name, then Tab: the name is filled in without the @, Tab again for the next match, Shift+Tab goes back. Names come from the chat and from the players in the game. Settings \u203a Chat \u203a Complete names with @ and Tab',
        ] },
        { v: '6.36.0', date: '2026-09-29', items: [
            'The tileset card reads "Current: Base Set" and below it "Next:" with the next tileset and when it starts, in your own time. The game\'s Active / Inactive line moved over to the Tickets card. Settings \u203a Header \u203a Next tileset on the tileset card',
            'Chat messages with your name in them (with or without @) get a gold frame. Settings \u203a Chat \u203a Highlight messages that mention you',
        ] },
        { v: '6.35.2', date: '2026-09-29', items: [
            'On the header cards only the card itself lights up when the pointer is on it; the Purchase button and the signs inside no longer light up on their own.',
            'The tomato popup closes as soon as you click Throw. The throws carry on, and their answers come as one line in the chat.',
        ] },
        { v: '6.35.1', date: '2026-09-29', items: [
            'The tomato button moved from the chat header to the message box, between the text field and Send.',
            'All answers to one throw of the tomato button now come as ONE line in the chat, e.g. "Tomatoes: 12 landed \u00b7 2 on cooldown (names)", with an x to dismiss it. Answers to tomatoes you type yourself become one small line each, also with an x.',
            'Header cards you can click (Current Points, Gold, Diamonds, the tileset card, your account) glow in your theme\'s colour while the pointer is on them.',
        ] },
        { v: '6.35.0', date: '2026-09-29', items: [
            'Quest dots: while one of today\'s open quests asks for a Rebellion, a Royal Celebration or a beverage, its button carries a gold dot. In the Rebellion popup the tier the quest wants has a gold frame and a Quest tag, and the beverage panel names the quest and how far you are. Settings \u203a Shop and dailies \u203a Quest dots on Rebellion and beverages',
            'Tomato button in the chat header: tick one, several or All of the players you can throw at, and throw. Each throw is an ordinary !tomato line, so the chat shows what landed. Settings \u203a Chat \u203a Tomato button',
            'The Dailies window has a refresh button in its title bar: it loads just the Dailies page again, so new progress shows without closing the window.',
            'Click the Current Points card for your saved loadouts and put one on in one click. Settings \u203a Header \u203a Loadouts on the Current Points card',
        ] },
        { v: '6.34.1', date: '2026-09-28', items: [
            'Settings \u203a On the throne: Set the toll is gone. The game now has its own Default Toll in the inventory (for taking the throne and for Royal Celebrations), and two setters would only fight each other. Pouring beverages stays.',
        ] },
        { v: '6.34.0', date: '2026-09-28', items: [
            'Loadouts now also hold your royal titles (chat, throne, Royal Celebrations) and your default tolls (throne capture, celebration start, celebration end). Save what I wear takes them along; when building, the Royal Title and Default Toll pages give every card + Chat / + Throne / + Celebration or + Throne / + Celeb. start / + Celeb. end.',
            'Older loadouts without these slots leave your titles and tolls as they are.',
        ] },
        { v: '6.33.0', date: '2026-09-28', items: [
            'Frame rate counter: hover it (or click to keep it open) for the lowest, average and highest frame rate since it was switched on. Seconds with the tab in the background are left out.',
        ] },
        { v: '6.32.0', date: '2026-09-27', items: [
            'Loadouts moved into the inventory: a bar at the top of Inventory \u203a Loadouts with your saved loadouts (Put on, Copy code, Delete), Save what I wear and Import. The page in the settings is gone.',
            'New loadout: click it and every item card gets + Loadout (crowns, trails and borders also + Pool, chat colours + Chat and + As King). Nothing is equipped while you build; your picks show as chips at the top, across all inventory pages, and a click on a chip takes it out.',
            'Save names the loadout. Slots you left out are listed first: they stay as they are when you put the loadout on, so a loadout can be just a trail and a border. After saving the picks are cleared for the next one.',
        ] },
        { v: '6.31.0', date: '2026-09-27', items: [
            'Loadouts: a new page in the settings saves what you wear under a name (crown with its random pool, chat colour normal and as King, chat background, username style, King bubble, marble trail and border) and puts it back on with one click.',
            'Only what differs is changed. An item you no longer have is skipped and named, never swapped for one of the same name. An open Inventory window reloads to show the new picks.',
            'Copy code turns a loadout into a code, and Import takes one: swap loadouts with the MarbleMind Discord bot or keep a copy. A code only works on the account it came from.',
        ] },
        { v: '6.30.0', date: '2026-09-26', items: [
            'Royal Celebrations: while you are King, the Rebellion button turns into Royal Celebration and sits right beside the toll, like Rebellion beside the ticket chips. Only the King sees it.',
            'It opens a panel with all eight tiers (x2 to x10, 5 to 50 tiles, 500 to 12,500 diamonds), the celebration that is running and your balance. Like Rebellion, a tier needs a second click to confirm, and it is the game\'s own Start that buys.',
            'When your reign ends the button goes back to Rebellion and an open celebration panel closes.',
        ] },
        { v: '6.29.0', date: '2026-09-26', items: [
            'Autobid has tile lists, like the MarbleMind bot: with Only known tiles on (the default) it bids only on tiles on your allowlist. A tile the game has just added gets no bid, and autobid holds back while one is taking bids.',
            'New tiles show up in the autobid menu with Allow and Block. Under Tile lists you can add or remove any tile yourself.',
            'A tile that is not in the game\'s catalogue yet is looked up again within minutes instead of the next day, so a new risk tile is caught much sooner.',
        ] },
        { v: '6.28.3', date: '2026-09-25', items: ['The Brick Builder signature theme follows CuteLegoGirl to her new name, DreamingLegoGirl.'] },
        { v: '6.28.2', date: '2026-09-25', items: ['Settings › On the throne: the warning about beverage costs now stands right above Pour beverages instead of above the toll switches.'] },
        { v: '6.28.1', date: '2026-09-25', items: ['Type the toll and Toll slider moved to Settings › On the throne, where the other toll settings are.'] },
        { v: '6.28', date: '2026-09-25', items: [
            'The king tile now shows the game\'s own reign read-outs (name, reign, duration, gold, tolls, challengers) - our separate name and toll fields sat right on top of them. The toll the King has set is now one more line in the game\'s block, in the same style.',
            'Settings, King tile: pick which of those lines you want, and set their text size and visibility.',
        ] },
        { v: '6.27.2', date: '2026-09-24', items: ['The Shop sign on the Gold card is back in its place — 6.27 had moved it down a little.'] },
        { v: '6.27.1', date: '2026-09-24', items: ['The update notice comes within about two minutes of a release instead of up to seven: the script now asks Greasy Fork itself, where the update is installed from, instead of a copy on GitHub that is cached for five minutes.'] },
        { v: '6.27', date: '2026-09-24', items: [
            'Quest alarm: an offer in the shop that would complete one of today\'s open shop quests gets a gold Quest tag, and the Shop button (or the Shop sign on the Gold card) a gold dot while such an offer is in the rotation. Settings › Shop and dailies › Quest alarm',
            'Every diamond price in the shop shows what those diamonds cost in euros, from the cheapest to the dearest diamond pack. Settings › Shop and dailies › Diamond prices in euros',
            'Claim all dailies: a gold dot on your account card while a quest reward or a daily item is waiting, and "Claim all dailies" at the top of its menu. Next to the red update dot when both are up. Settings › Shop and dailies › Claim all dailies',
            'Opt-in: dailies can also claim themselves, right after the daily reset too, with a short notice of what came in. Settings › Shop and dailies › Claim dailies by themselves',
            'What\'s new, Changelog and How to keep their buttons at the bottom while the text scrolls, and "Settings › …" in them is now a link that opens that very page and points at the switch.',
        ] },
        { v: '6.26.4', date: '2026-09-24', items: ['The folded ticket rail is centred on the board again. Unfolding it now only grows it to the right, so the footer line on the left stays readable.'] },
        { v: '6.26.3', date: '2026-09-24', items: ['With the ticket rail unfolded, the footer line (season, episode, MCF and MLF version) stays readable: on narrower screens like 1920x1080 the rail moves a little to the right instead of covering it.'] },
        { v: '6.26.2', date: '2026-09-24', items: ['The update notice shows up sooner: no extra waiting time after a new version is found, and a fresh check whenever you come back to the tab.'] },
        { v: '6.26.1', date: '2026-09-24', items: ['No changes: a release to try out the new update notice.'] },
        { v: '6.26', date: '2026-09-24', items: ['The footer shows both versions, labelled: MCF for the game\'s build, MLF for this script.', 'When a new MarbleLuceFall is out, a red dot appears on your account card within a few minutes. Its menu then starts with a red "Update available" - one click opens the install page. The footer says so too.'] },
        { v: '6.25.1', date: '2026-09-24', items: ['The tileset name is bigger, and its size is yours to pick: a slider under Header, next to the option.', 'A Show now button plays the tileset name right away, so you can judge it without waiting for the next tileset.'] },
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
