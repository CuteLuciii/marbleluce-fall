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


