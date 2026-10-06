# MarbleLuceFall

A layout overhaul for **[Marble Crownfall](https://marblecrownfall.com)**. It makes the page tidier and quicker to use, and gives it a look of your choice — without taking anything away: every change can be switched off in the settings and the page is back to the original.

## What it does

- **Themes** — 50+ colour themes (pride flags, games, gradients, patterns, random or rotating) and **Deluxe themes** with their own scenery, animations and buttons:
  - **Games:** Minecraft, TARDIS, Satisfactory, Super Mario, Zelda, Tetris, Pac-Man, Portal, Sonic, Pokédex, Game Boy, Stardew Valley, Hollow Knight, World of Warcraft, Casino
  - **Film & TV:** Supernatural, Breaking Bad, Back to the Future (with live time circuits), Everything Everywhere All at Once (googly eyes that follow your pointer), Star Wars (opening crawl, lightsaber buttons), Vertigo, Cinema
  - **Books:** The Lost Bookshop (Der verschwundene Buchladen), Reading Nook
  - **Music:** Die Ärzte, Linkin Park, Kraftklub, Goethes Erben, Samsas Traum, Prinz Pi
- **Pages as windows** — shop, inventory, profile, credits and more open as movable windows over the game, with a taskbar; after a game update they reload by themselves.
- **Bidding** — unbid in one click, extra ticket chips, autobid with risk protection and an allow- and blocklist for tiles (new tiles get no bid until you allow them). Optionally hide the decorated bidding indicators on the lanes and see every bid in the plain banner.
- **King tile** — the game's reign read-outs to your liking (pick the lines, text size, visibility), plus the toll the King has set and the King's VIP tier in its colour; attack when free (opt-in), also again and again until you are King.
- **Rebellion and Royal Celebration** — Rebellion beside the ticket chips with a panel of all tiers and a confirm click; while you are King it turns into Royal Celebration beside the toll, only for the King.
- **Ticket history** — click the Tickets card for tickets earned and spent in the last hour, today and this session; small flying tickets when tickets come in.
- **Next tileset** — the tileset card shows the current tileset and the next one with its start time; the Active line sits in the Tickets card.
- **Tileset name** — a new tileset is announced by its name over the board instead of a full-screen picture that blacks the game out.
- **Beverage bar** — the beverages as a compact bar, as symbols or with names.
- **On the throne** — opt-in: when you take the crown, the beverages you picked are poured by themselves, once per reign (spends gold or diamonds for good).
- **Tomato notice** — a tomato thrown at you shows as one small line with the thrower's name instead of a picture, and an x dismisses it.
- **Mentions** — chat messages with your name or one of your nicknames in them get a gold frame; @ + Tab completes a name, like on Twitch.
- **Twitch emotes** (opt-in) — words like Kappa, LUL or PogChamp show as the emote, as in a Twitch chat: Twitch's global emotes, exact spelling, whole words. Only you see them.
- **Tomato button** — beside Send: tick one, several or all of the players you can throw at, and throw. Each throw is the game's own !tomato line, and the answers come back as one line you can dismiss.
- **Animal call button** — a paw beside the tomato lists every animal call; one click sends it. A gathering running in the chat is marked, with how many joined and roughly how long it lasts. It also shows when the next gathering can start and which animals are still resting.
- **Enhanced chat** — hide system lines you don't need, text sizes, grouped messages, pop the chat out into a window, a compact cosmetics switch.
- **Board fit** — the board sizes itself to your screen; see-through board frames.
- **Loadouts** — a bar at the top of the inventory: build a loadout by clicking + Loadout on the items you want (nothing is equipped while you build), or save what you wear now; put it back on with one click, there or straight from the Current Points card. A loadout can cover every slot (crown with its random pool, chat colours, chat background, username style, King bubble, marble trail, border, bidding indicator and rebellion aura, wreath, royal titles and default tolls) or just a few; the rest stays as it is. Only what differs is changed, and an item you no longer have is skipped, never swapped for a namesake. Loadouts can be copied as a code and imported again, also to and from the MarbleMind Discord bot. Everything stays in your browser.
- **Music player** — the game's whole soundtrack by album: pick any track, shuffle it, take off the ones you would rather not hear, jump anywhere in a track. It streams instead of downloading the whole file, waits when the game's server sends the music slower than it plays, and remembers where you stopped. The game itself plays straight through one list, and Next is the only way along it.
- **Player bar** — a small player to drag anywhere on the page: what is playing, previous, play, next, shuffle, volume and the loading line. It stays where you put it.
- **Shop and dailies** — a gold Quest tag on shop offers that would complete an open shop quest (and a gold dot while one is in the rotation), gold dots on the Rebellion and beverage buttons while a quest asks for them (the tier it wants framed in gold), a refresh button on the Dailies window, euro prices beside every diamond price, and "Claim all dailies" in one click from the account menu — or, opt-in, claimed by themselves.
- **Player gifts** — a window in the account menu that lists everyone playing this episode with the Gold and Diamond Gifts you can still give them, with a search box, a filter for players you can still gift, and two-click sending. Faster than the search on the profile page, and players you are done with are remembered.
- **Update notice** — a red dot on the account card within minutes of a new release, with a one-click update; both versions (MCF and MLF) in the footer.
- **Settings gear** — one click to all settings, including the game's own sound and graphics levels.
- **Performance levels** and **Deluxe effects** (full, subtle, off) for slower machines, plus a frame rate counter with min, average and max.
- **How-to** and **What's new** inside the script.

## Good to know

- Purchases always go through the game's own buttons — the script never buys anything by itself.
- Everything it shows comes from the page or the game's own endpoints, with these exceptions: the update notice asks Greasy Fork for this script's current version (every two minutes while the tab is visible, falling back to the GitHub repo), and the euro prices fetch today's USD→EUR rate from frankfurter.dev (European Central Bank rates) once a day. Switch on Twitch emotes and the list of emote names comes from emotes.adamcy.pl once a day, the pictures from Twitch's image server (static-cdn.jtvnw.net). None of them sends anything but the request itself; switch off the euro prices and leave the emotes off, and only the update check remains.
- Every picture in the themes is drawn by the script itself — no logos, stills or fonts of the originals.

The source lives on [GitHub](https://github.com/CuteLuciii/marbleluce-fall); updates arrive here automatically.

License: MIT
