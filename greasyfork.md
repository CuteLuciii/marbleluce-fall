# MarbleLuceFall

A layout overhaul for **[Marble Crownfall](https://marblecrownfall.com)**. It makes the page tidier and quicker to use, and gives it a look of your choice — without taking anything away: every change can be switched off in the settings and the page is back to the original.

## What it does

- **Themes** — 50+ colour themes (pride flags, games, gradients, patterns, random or rotating) and **Deluxe themes** with their own scenery, animations and buttons:
  - **Games:** Minecraft, TARDIS, Satisfactory, Super Mario, Zelda, Tetris, Pac-Man, Portal, Sonic, Pokédex, Game Boy, Stardew Valley, Hollow Knight, World of Warcraft, Casino
  - **Film & TV:** Supernatural, Breaking Bad, Back to the Future (with live time circuits), Everything Everywhere All at Once (googly eyes that follow your pointer), Star Wars (opening crawl, lightsaber buttons), Vertigo, Cinema
  - **Books:** The Lost Bookshop (Der verschwundene Buchladen), Reading Nook
  - **Music:** Die Ärzte, Linkin Park, Kraftklub, Goethes Erben, Samsas Traum, Prinz Pi
- **Pages as windows** — shop, inventory, profile, credits and more open as movable windows over the game, with a taskbar.
- **Bidding** — unbid in one click, extra ticket chips, autobid with risk protection.
- **King tile** — the king's name and toll right on the tile; attack when free (opt-in), also again and again until you are King.
- **Tileset name** — a new tileset is announced by its name over the board instead of a full-screen picture that blacks the game out.
- **Beverage bar** — the beverages as a compact bar, as symbols or with names.
- **On the throne** — opt-in: when you take the crown, the toll goes to your value and the beverages you picked are poured by themselves, once per reign (spends gold or diamonds for good).
- **Tomato notice** — a tomato thrown at you shows as one small line with the thrower's name instead of a picture, and an x dismisses it.
- **Enhanced chat** — hide system lines you don't need, text sizes, grouped messages, pop the chat out into a window, a compact cosmetics switch.
- **Board fit** — the board sizes itself to your screen; see-through board frames.
- **Music player** — the game's whole soundtrack by album: pick any track, shuffle it, take off the ones you would rather not hear, jump anywhere in a track. It streams instead of downloading the whole file, waits when the game's server sends the music slower than it plays, and remembers where you stopped. The game itself plays straight through one list, and Next is the only way along it.
- **Player bar** — a small player to drag anywhere on the page: what is playing, previous, play, next, shuffle, volume and the loading line. It stays where you put it.
- **Shop and dailies** — a gold Quest tag on shop offers that would complete an open shop quest (and a gold dot while one is in the rotation), euro prices beside every diamond price, and "Claim all dailies" in one click from the account menu — or, opt-in, claimed by themselves.
- **Update notice** — a red dot on the account card within minutes of a new release, with a one-click update; both versions (MCF and MLF) in the footer.
- **Settings gear** — one click to all settings, including the game's own sound and graphics levels.
- **Performance levels** and **Deluxe effects** (full, subtle, off) for slower machines.
- **How-to** and **What's new** inside the script.

## Good to know

- Purchases always go through the game's own buttons — the script never buys anything by itself.
- Everything it shows comes from the page or the game's own endpoints, with one exception: for the euro prices it fetches today's USD→EUR rate from frankfurter.dev (European Central Bank rates, no key, no data sent but the request itself) once a day. Switch the euro prices off and it asks no outside service at all.
- Every picture in the themes is drawn by the script itself — no logos, stills or fonts of the originals.

The source lives on [GitHub](https://github.com/CuteLuciii/marbleluce-fall); updates arrive here automatically.

License: MIT
