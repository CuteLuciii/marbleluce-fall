    // The new inventory (6.57): started here, in the inventory page itself (also inside the window
    // frame - this part runs before the iframe stop below). The game's inventory module looks
    // its root up ONCE, when it runs (document.querySelector('#inventory-root')). So the root is
    // renamed the moment the parser creates it: the module finds nothing, draws nothing and
    // stays out of the way. Once the page is parsed (module scripts have run by then) a new
    // root takes the old id - the loadout bar and the rest of 12e find it as before - and the
    // app goes into the page. Off with Settings > Inventory > New inventory, or for one visit
    // with ?mlf=classic (the "Classic inventory" link).
    function invOverhaulBoot() {
        try {
            const s = JSON.parse(localStorage.getItem('mcf_overhaul_settings') || '{}');
            if (s.invOverhaul === false) return;
        } catch (e) { /* no settings yet: on */ }
        if (new URLSearchParams(location.search).get('mlf') === 'classic') return;
        const html = document.documentElement;
        const grab = () => {
            const r = document.getElementById('inventory-root');
            if (!r || r.hasAttribute('data-mcfo-newinv')) return false;
            r.id = 'mcfo-native-inventory';
            r.hidden = true;
            return true;
        };
        if (!grab()) {
            const mo = new MutationObserver(() => { if (grab()) mo.disconnect(); });
            mo.observe(document, { childList: true, subtree: true });
            document.addEventListener('DOMContentLoaded', () => mo.disconnect(), { once: true });
        }
        document.addEventListener('DOMContentLoaded', () => {
            const old = document.getElementById('mcfo-native-inventory');
            const tag = document.querySelector('script[src*="/immutable-assets/"][src$="/inventory.js"]');
            const m = tag && tag.getAttribute('src').match(/\/immutable-assets\/([^/]+)\//);
            if (!old || !m) { if (old) { old.id = 'inventory-root'; old.hidden = false; } return; }
            html.setAttribute('data-mcfo-newinv', '1');
            const main = document.createElement('main');
            main.id = 'inventory-root';
            main.className = 'inventoryMain mcfPageContent mi-root';
            main.setAttribute('data-mcfo-newinv', '1');
            old.after(main);
            const st = document.createElement('style');
            st.id = 'mcfo-newinv-css';
            st.textContent = INV_NEW_CSS;
            (document.head || html).appendChild(st);
            const sc = document.createElement('script');
            sc.textContent = '(' + invOverhaulApp.toString() + ')(' + JSON.stringify({ build: m[1] }) + ');';
            (document.head || html).appendChild(sc);
        }, { once: true });
    }
    const INV_NEW_CSS = `
        #mcfo-native-inventory { display: none !important; }   /* the game's .inventoryMain display:grid beats [hidden] */
        html[data-mcfo-newinv] body { overflow: hidden; }
        html[data-mcfo-newinv] .inventoryShell { display: flex; flex-direction: column; height: 100vh; min-height: 0; }
        html[data-mcfo-newinv] .inventoryShell > * { flex: none; }
        html[data-mcfo-newinv] #inventory-root.mi-root { flex: 1 1 auto; min-height: 0; display: block; padding: 12px 14px; width: 100%; max-width: none; margin: 0; box-sizing: border-box; }
        .mi { --mi-r: 12px; height: 100%; display: grid; grid-template-columns: 210px minmax(0, 1fr) minmax(300px, 370px); gap: 12px;
            color: var(--ink, #e3edf7); font: 13px/1.35 system-ui, -apple-system, "Segoe UI", sans-serif; }
        .mi[data-overview] { grid-template-columns: 210px minmax(0, 1fr); }
        .mi[data-overview] .mi-detail { display: none; }
        .mi-side, .mi-main, .mi-detail { min-height: 0; border: 1px solid var(--line, #2f3f4e); border-radius: var(--mi-r);
            background: linear-gradient(180deg, color-mix(in srgb, var(--panel-2, #151d27) 92%, transparent), color-mix(in srgb, var(--panel, #111822) 92%, transparent)); }
        .mi svg { flex: none; }
        .mi button { font: inherit; color: inherit; }
        /* sidebar */
        .mi-side { overflow: auto; padding: 10px 8px; display: flex; flex-direction: column; gap: 10px; }
        .mi-group h2 { margin: 4px 8px 4px; font-size: 11px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: var(--muted, #95a9ba); }
        .mi-side .mi-nav.inventorySubcategoryButton { all: unset; box-sizing: border-box; width: 100%; display: flex; align-items: center; gap: 9px; padding: 7px 9px;
            border-radius: 8px; cursor: pointer; color: var(--ink, #e3edf7); font-size: 13px; border: 1px solid transparent; }
        .mi-side .mi-nav svg { width: 17px; height: 17px; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; opacity: .8; }
        .mi-side .mi-nav span { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .mi-side .mi-nav i { font-style: normal; font-size: 11px; color: var(--muted, #95a9ba); }
        .mi-side .mi-nav:hover { background: color-mix(in srgb, var(--ink, #fff) 6%, transparent); }
        .mi-side .mi-nav[aria-current=page] { background: color-mix(in srgb, var(--gold, #d6aa48) 16%, transparent); border-color: color-mix(in srgb, var(--gold, #d6aa48) 55%, transparent); color: var(--gold-soft, #ffe4a4); }
        .mi-side .mi-nav[aria-current=page] svg { opacity: 1; }
        .mi-side__foot { margin-top: auto; padding: 6px 8px 2px; }
        .mi-link { all: unset; cursor: pointer; font-size: 12px; color: var(--muted, #95a9ba); text-decoration: underline; text-underline-offset: 3px; }
        .mi-link:hover { color: var(--ink, #fff); }
        /* main column */
        .mi-main { display: grid; grid-template-rows: auto minmax(0, 1fr); overflow: hidden; }
        .mi-head { padding: 12px 14px 10px; border-bottom: 1px solid var(--line, #2f3f4e); display: grid; gap: 10px; }
        .mi-title { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .mi-title__icon svg { width: 22px; height: 22px; fill: none; stroke: var(--gold, #d6aa48); stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; display: block; }
        .mi-title h1 { margin: 0; font-size: 19px; font-weight: 800; letter-spacing: .01em; }
        .mi-count { color: var(--muted, #95a9ba); font-size: 12.5px; }
        .mi-ctl { margin-left: auto; display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
        .mi-filters { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
        .mi-search { box-sizing: border-box; width: 200px; padding: 6px 10px; border-radius: 8px; border: 1px solid var(--line, #2f3f4e);
            background: color-mix(in srgb, var(--panel-3, #0b0f13) 85%, transparent); color: var(--ink, #fff); font: inherit; }
        .mi-search:focus { outline: none; border-color: var(--line-strong, #456079); }
        .mi-rars { display: flex; gap: 4px; flex-wrap: wrap; }
        .mi-rar, .mi-btn, .mi-tabs button { display: inline-flex; align-items: center; gap: 6px; padding: 5px 10px; border-radius: 999px; cursor: pointer; white-space: nowrap;
            border: 1px solid var(--line, #2f3f4e); background: color-mix(in srgb, var(--panel-3, #0b0f13) 70%, transparent); font-size: 12px; font-weight: 700; }
        .mi-rar b { width: 9px; height: 9px; border-radius: 3px; transform: rotate(45deg); background: var(--mi-fill); border: 1.5px solid var(--mi-line); box-sizing: border-box; }
        .mi-rar i { font-style: normal; font-weight: 600; color: var(--muted, #95a9ba); }
        .mi-rar:hover, .mi-btn:hover:not(:disabled), .mi-tabs button:hover { border-color: var(--line-strong, #456079); }
        .mi-rar[aria-pressed=true] { border-color: var(--mi-line, var(--gold, #d6aa48)); background: color-mix(in srgb, var(--mi-fill, var(--gold, #d6aa48)) 28%, transparent); color: #fff; }
        .mi-rar[aria-pressed=true] i { color: inherit; }
        .mi-sel { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--muted, #95a9ba); }
        .mi-sel select { padding: 4px 8px; border-radius: 8px; border: 1px solid var(--line, #2f3f4e); background: var(--panel-3, #0b0f13); color: var(--ink, #fff); font: inherit; }
        .mi-filters .mi-sel { margin-left: auto; }
        .mi-btn { border-radius: 8px; padding: 6px 11px; }
        .mi-btn[aria-pressed=true] { border-color: color-mix(in srgb, var(--gold, #d6aa48) 70%, transparent); background: color-mix(in srgb, var(--gold, #d6aa48) 18%, transparent); color: var(--gold-soft, #ffe4a4); }
        .mi-btn--quiet { background: transparent; }
        .mi-title > .mi-reload { margin-left: auto; }
        .mi-reload.is-busy { opacity: .6; }
        .mi-btn:disabled { opacity: .55; cursor: default; }
        .mi-btn--main { background: color-mix(in srgb, var(--gold, #d6aa48) 22%, transparent); border-color: color-mix(in srgb, var(--gold, #d6aa48) 65%, transparent); color: var(--gold-soft, #ffe4a4); }
        .mi-btn--on { opacity: 1 !important; border-color: color-mix(in srgb, var(--green, #7ec98f) 65%, transparent); color: var(--green, #7ec98f); }
        .mi-chip { display: inline-flex; gap: 4px; padding: 5px 10px; border-radius: 8px; font-size: 12px; border: 1px dashed var(--line, #2f3f4e); color: var(--muted, #95a9ba); }
        .mi-chip b { color: var(--ink, #fff); font-weight: 700; }
        .mi-msg { padding: 7px 10px; border-radius: 8px; border: 1px solid #7a3a2c; background: rgba(70, 20, 12, .45); color: #ffc2b2; font-size: 12.5px; }
        .mi[data-busy] .mi-main, .mi[data-busy] .mi-detail { cursor: progress; }
        .mi-body { overflow: auto; padding: 12px 14px 16px; overflow-anchor: none; }
        .mi-status { display: grid; justify-items: center; gap: 8px; padding: 40px 10px; color: var(--muted, #95a9ba); text-align: center; }
        .mi-status b { color: var(--ink, #fff); font-size: 15px; }
        /* cards */
        .mi-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(148px, 1fr)); gap: 10px; align-items: start; }
        .mi-grid--wide { grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); }
        .mi-grid--chat { grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); }
        .mi-grid--text { grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); }
        .mi .mi-card.inventoryCard { all: unset; box-sizing: border-box; position: relative; display: flex; flex-direction: column; gap: 6px; padding: 7px; cursor: pointer;
            border-radius: 10px; border: 1px solid color-mix(in srgb, var(--mi-line) 40%, transparent);
            background: linear-gradient(165deg, color-mix(in srgb, var(--mi-bg) 85%, transparent), color-mix(in srgb, var(--panel-3, #0b0f13) 75%, transparent)); transition: border-color .12s, transform .12s; }
        .mi .mi-card.inventoryCard:hover { border-color: color-mix(in srgb, var(--mi-line) 85%, transparent); transform: translateY(-1px); }
        .mi .mi-card.inventoryCard[aria-selected=true] { border-color: var(--gold-soft, #ffe4a4); box-shadow: 0 0 0 1px var(--gold-soft, #ffe4a4), 0 6px 18px -8px rgba(0, 0, 0, .7); }
        .mi .mi-card.inventoryCard:focus-visible { outline: 2px solid var(--blue, #5ca7d8); outline-offset: 2px; }
        /* the picture's ground in the rarity's colour, as the game's crown cards (Exclusive white); !important on display:
           some renderers set their host to display:block, which put wreath and trail in the corner */
        .mi-thumb, .mi-big, .mi-slot__pic { background: radial-gradient(115% 95% at 50% 32%, color-mix(in srgb, var(--mi-fill) 58%, var(--mi-pic)), var(--mi-pic) 72%) !important;
            display: grid !important; place-items: center; justify-self: stretch; }
        .mi-thumb { position: relative; aspect-ratio: 1 / 1; border-radius: 7px; overflow: hidden; }
        .mi-grid--wide .mi-thumb { aspect-ratio: 2.6 / 1; }
        .mi-grid--chat .mi-thumb { aspect-ratio: auto; min-height: 64px; padding: 6px; place-items: stretch; }
        .mi-thumb--text, .mi-big--text { background: color-mix(in srgb, var(--panel-3, #0b0f13) 70%, transparent) !important; }
        .mi-thumb--text { aspect-ratio: auto; min-height: 44px; padding: 8px; font-size: 16px; font-weight: 800; text-align: center; color: var(--gold-soft, #ffe4a4); }
        .mi .mi-card.mi-card--text { --mi-line: var(--line-strong, #456079); --mi-bg: var(--panel-2, #151d27); gap: 5px; }
        .mi-ctx { display: flex; flex-wrap: wrap; gap: 3px; min-height: 0; }
        .mi-ctx:empty { display: none; }
        .mi-ctx .mi-badge { font-size: 10px; padding: 2px 6px; white-space: nowrap; }
        .mi-thumb > * { max-width: 100%; max-height: 100%; }
        .mi-thumb > p.inventoryMuted, .mi-big > p.inventoryMuted, .mi-slot__pic > p.inventoryMuted { display: none; }   /* "Border available" under the picture */
        /* !important: the aura renderer sets width/height 320px inline */
        .mi-thumb > svg, .mi-thumb > canvas { width: 100% !important; height: 100% !important; max-width: 100%; }
        .mi-thumb .crownItemPreviewStage { min-height: 0 !important; height: 100%; }
        .mi-grid--text .mi-card h3 { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }   /* the name is the picture; h3 stays for the loadout bar */
        .mi-card h3 { margin: 0; font-size: 12.5px; font-weight: 700; line-height: 1.25; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .mi-card__foot { display: flex; align-items: center; gap: 5px; min-height: 18px; font-size: 11px; color: var(--muted, #95a9ba); }
        .mi-dot { width: 7px; height: 7px; border-radius: 2px; transform: rotate(45deg); background: var(--mi-fill); border: 1px solid var(--mi-line); flex: none; }
        .mi-card[data-rarity=default] .mi-dot { display: none; }
        .mi-badges { margin-left: auto; display: flex; gap: 3px; }
        .mi-badge { padding: 2px 6px; border-radius: 999px; font-size: 10.5px; font-weight: 800; background: rgba(0, 0, 0, .4); border: 1px solid var(--line, #2f3f4e); color: var(--ink, #fff); }
        .mi-badge[data-tone=eq] { border-color: color-mix(in srgb, var(--green, #7ec98f) 70%, transparent); color: var(--green, #7ec98f); }
        .mi-badge[data-tone=pool] { border-color: color-mix(in srgb, var(--blue, #5ca7d8) 70%, transparent); color: var(--blue, #5ca7d8); }
        .mi-none { font-size: 12px; color: var(--muted, #95a9ba); padding: 10px; text-align: center; }
        .mi .mcfo-lob { margin-top: 0; }
        /* detail column */
        .mi-detail { overflow: auto; }
        .mi-detail__inner { padding: 14px; display: grid; gap: 10px; align-content: start;
            background: radial-gradient(120% 60% at 50% 0%, color-mix(in srgb, var(--mi-fill) 22%, transparent), transparent 70%); border-radius: var(--mi-r); min-height: 100%; box-sizing: border-box; }
        .mi-tabs { display: flex; gap: 4px; justify-self: center; }
        .mi-tabs button[aria-pressed=true] { border-color: var(--gold, #d6aa48); color: var(--gold-soft, #ffe4a4); background: color-mix(in srgb, var(--gold, #d6aa48) 15%, transparent); }
        .mi-big { position: relative; width: 100%; aspect-ratio: 1 / 1; border-radius: 10px; overflow: hidden; border: 1px solid color-mix(in srgb, var(--mi-line) 45%, transparent); }
        .mi-big > svg, .mi-big > canvas { width: 100% !important; height: 100% !important; max-width: 100%; }
        .mi-big--crown .kingPfpCrownPreview { width: 82%; }
        .mi-big--tile { aspect-ratio: 640 / 1080; max-height: 62vh; width: auto; justify-self: center; }
        .mi-big--wide { aspect-ratio: 2.6 / 1; }
        .mi-big--chat, .mi-big--font { aspect-ratio: auto; min-height: 120px; padding: 10px; place-items: stretch; box-sizing: border-box; }
        .mi-big--text { aspect-ratio: auto; min-height: 120px; font-size: 24px; font-weight: 800; color: var(--gold-soft, #ffe4a4); text-align: center; padding: 14px; }
        .mi-pair { display: grid; gap: 10px; }
        .mi-pair span { font-size: 11px; color: var(--muted, #95a9ba); text-transform: uppercase; letter-spacing: .06em; }
        .mi-detail h2 { margin: 2px 0 0; font-size: 18px; font-weight: 800; line-height: 1.2; }
        .mi-pill { justify-self: start; padding: 3px 10px; border-radius: 999px; font-size: 11.5px; font-weight: 800; background: color-mix(in srgb, var(--mi-fill) 45%, transparent); border: 1px solid var(--mi-line); color: #fff; }
        .mi-actions { display: flex; gap: 6px; flex-wrap: wrap; }
        .mi-actions .mi-btn { flex: 1 1 auto; justify-content: center; padding: 9px 12px; font-size: 13px; }
        .mi-note { margin: 0; font-size: 12px; color: var(--muted, #95a9ba); }
        .mi-meta { display: grid; gap: 8px; font-size: 12px; color: var(--muted, #95a9ba); }
        .mi-meta dl { margin: 0; }
        /* overview */
        .mi-over { display: grid; gap: 18px; }
        .mi-over h2 { margin: 0 0 8px; font-size: 11px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: var(--muted, #95a9ba); }
        .mi-over__grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; }
        .mi .mi-slot { all: unset; box-sizing: border-box; cursor: pointer; display: grid; gap: 6px; align-content: start; padding: 10px; border-radius: 12px; --mi-bg: #1b2128; --mi-fill: #3a4654; --mi-line: #8796a6; --mi-pic: #1b2128;
            border: 1px solid color-mix(in srgb, var(--mi-line) 40%, transparent);
            background: linear-gradient(165deg, color-mix(in srgb, var(--mi-bg) 85%, transparent), color-mix(in srgb, var(--panel-3, #0b0f13) 75%, transparent)); }
        .mi .mi-slot:hover { border-color: color-mix(in srgb, var(--mi-line) 90%, transparent); }
        .mi-slot__label { display: flex; align-items: center; gap: 7px; font-size: 11.5px; font-weight: 800; letter-spacing: .04em; text-transform: uppercase; color: var(--muted, #95a9ba); }
        .mi-slot__label svg { width: 15px; height: 15px; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
        .mi-slot__pic { height: 150px; width: 100%; box-sizing: border-box; border-radius: 8px; overflow: hidden; }
        .mi-slot__pic > svg { height: 100% !important; width: auto !important; max-width: 100%; }
        .mi-slot__pic > .kingPfpCrownPreview { height: 92%; width: auto; aspect-ratio: 1; margin: auto; }
        .mi-slot[data-slot=royal_title] .mi-slot__pic, .mi-slot[data-slot=default_toll] .mi-slot__pic { background: color-mix(in srgb, var(--panel-3, #0b0f13) 70%, transparent) !important; }
        .mi-slot__pic > svg, .mi-slot__pic > canvas { width: 100%; height: 100%; }
        .mi-slot__pic .kingPfpCrownPreview { height: 92%; width: auto; aspect-ratio: 1; }
        .mi-slot__pic .crownItemPreviewStage { min-height: 0 !important; height: 100%; }
        .mi-slot[data-slot=chat_font_colors] .mi-slot__pic, .mi-slot[data-slot=chat_background_style] .mi-slot__pic,
        .mi-slot[data-slot=username_style] .mi-slot__pic, .mi-slot[data-slot=king_chat_bubble_style] .mi-slot__pic { place-items: stretch; padding: 8px; height: auto; min-height: 90px; }
        .mi-slot__text { display: grid; gap: 6px; width: 100%; padding: 10px; box-sizing: border-box; align-self: center; }
        .mi-slot__text div { display: flex; justify-content: space-between; gap: 8px; font-size: 12px; }
        .mi-slot__text span { color: var(--muted, #95a9ba); }
        .mi-slot__text b { color: var(--gold-soft, #ffe4a4); text-align: right; }
        .mi-slot__name { font-size: 13.5px; }
        .mi-slot__sub { font-size: 11.5px; color: var(--muted, #95a9ba); min-height: 15px; }
        /* 6.57.2 - one look for every category: the whole card in the rarity's colour, the picture on one
           neutral ground (the ground the trails bring along anyway), so the colour reads as a thick frame. */
        .mi .mi-card.inventoryCard, .mi .mi-slot { color: var(--mi-ink, #f4f6f9);
            border: 1px solid color-mix(in srgb, var(--mi-line) 75%, transparent);
            background: linear-gradient(170deg, color-mix(in srgb, var(--mi-fill) 88%, #fff 12%), color-mix(in srgb, var(--mi-fill) 78%, #000 22%)); }
        .mi .mi-card.inventoryCard { padding: 6px; }
        .mi .mi-card.inventoryCard:hover, .mi .mi-slot:hover { border-color: var(--mi-line); box-shadow: 0 6px 16px -8px rgba(0, 0, 0, .7); }
        .mi .mi-card.inventoryCard[aria-selected=true] { border-color: var(--mi-line); box-shadow: none; outline: 2px solid var(--gold-soft, #ffe4a4); outline-offset: 2px; }
        .mi-thumb, .mi-big, .mi-slot__pic, .mi-thumb--text, .mi-big--text { background: #182032 !important; box-shadow: inset 0 0 0 1px rgba(0, 0, 0, .35); }
        .mi-big { border: 4px solid var(--mi-fill); box-sizing: border-box; }
        .mi-card__foot, .mi-slot__sub, .mi-slot__label { color: color-mix(in srgb, var(--mi-ink, #f4f6f9) 78%, transparent); }
        .mi-card__foot .mi-dot { display: none; }
        .mi-card__rar { font-weight: 700; }
        .mi .mi-card .mi-badge { background: rgba(0, 0, 0, .55); color: #fff; }
        .mi .mi-card .mi-badge[data-tone=eq] { border-color: #7ec98f; color: #9be3ac; }
        .mi .mi-card .mi-badge[data-tone=pool] { border-color: #5ca7d8; color: #a6d3f2; }
        .mi-thumb--text { color: var(--gold-soft, #ffe4a4); }
        .mi .mcfo-lob button.mcfo-lob__pick { color: #cfe2f2; }   /* .mi button inherits the card's ink - dark on pale cards */
        /* narrower windows */
        @media (max-width: 1180px) {
            .mi { grid-template-columns: 58px minmax(0, 1fr) minmax(260px, 310px); }
            .mi[data-overview] { grid-template-columns: 58px minmax(0, 1fr); }
            .mi-group h2, .mi-side .mi-nav span, .mi-side .mi-nav i, .mi-side__foot { display: none; }
            .mi-side .mi-nav.inventorySubcategoryButton { justify-content: center; padding: 9px 0; }
        }
        @media (max-width: 820px) {
            html[data-mcfo-newinv] body { overflow: auto; }
            html[data-mcfo-newinv] .inventoryShell { height: auto; }
            .mi, .mi[data-overview] { grid-template-columns: 1fr; height: auto; }
            .mi-side { flex-direction: row; overflow-x: auto; }
            .mi-group { display: flex; gap: 2px; }
            .mi-main { overflow: visible; }
            .mi-body { overflow: visible; }
        }
    `;

