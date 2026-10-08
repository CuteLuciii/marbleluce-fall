# MarbleLuceFall

Layout overhaul userscript for [Marble Crownfall](https://marblecrownfall.com): colour and Deluxe themes,
pages as windows over the game, autobid with risk protection, unbid and extra ticket chips, king name and
toll on the tile, beverage bar, enhanced chat, performance levels.

**Install:** [from Greasy Fork](https://greasyfork.org/scripts/595115-marblelucefall) — recommended, you get
updates automatically.

This repository holds the current release; every commit is one version, and Greasy Fork syncs from it.
The changelog is inside the script (Settings › What's new).

## Source

The script is kept in pieces under [`src/`](src/), one file per part of the game it touches
(`themes/`, `king/`, `chat/`, `rail/` with autobid, `pages/` with loadouts and the shop, `panel/` with the
settings, help and music player, `boot/` for what runs at document-start, including the new inventory and
achievements pages). `node build.js` joins them, in the order of [`src/order.txt`](src/order.txt), into
`MarbleLuceFall.user.js` — nothing is added or changed, the pieces share the script's one scope. No
dependencies, any current Node.js.

License: MIT
