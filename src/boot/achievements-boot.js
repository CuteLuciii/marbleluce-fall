    // Started like the new inventory, in the achievements page itself (also inside the window frame).
    // The game's page reads its data once and then tells the server the new unlocks were seen. It
    // has a review hook of its own (globalThis.__MCF_ACHIEVEMENT_REVIEW_FIXTURE__): given one, it
    // neither fetches nor acknowledges. It gets an empty one, fails quietly into its own (hidden)
    // root, and the new page does the fetching and the acknowledging - once. Off with Settings >
    // Achievements > New achievements page, or for one visit with ?mlf=classic.
    function achOverhaulBoot() {
        try {
            const s = JSON.parse(localStorage.getItem('mcf_overhaul_settings') || '{}');
            if (s.achOverhaul === false) return;
        } catch (e) { /* no settings yet: on */ }
        if (new URLSearchParams(location.search).get('mlf') === 'classic') return;
        const pw = (typeof unsafeWindow !== 'undefined' && unsafeWindow) || window;
        try { pw.__MCF_ACHIEVEMENT_REVIEW_FIXTURE__ = pw.JSON.parse('{"mcfoNewPage":true}'); } catch (e) { return; }
        const html = document.documentElement;
        html.setAttribute('data-mcfo-newach', '1');
        document.addEventListener('DOMContentLoaded', () => {
            const old = document.getElementById('achievement-root');
            if (!old) return;
            const main = document.createElement('main');
            main.id = 'mcfo-ach-root';
            main.className = 'mcfPageContent mi-root';
            old.after(main);
            const st = document.createElement('style');
            st.id = 'mcfo-newach-css';
            st.textContent = INV_NEW_CSS + ACH_NEW_CSS;
            (document.head || html).appendChild(st);
            const sc = document.createElement('script');
            sc.textContent = '(' + achOverhaulApp.toString() + ')();';
            (document.head || html).appendChild(sc);
        }, { once: true });
    }
    const ACH_NEW_CSS = `
        html[data-mcfo-newach] body { height: 100vh; margin: 0; display: flex; flex-direction: column; overflow: hidden; }
        html[data-mcfo-newach] body > * { flex: none; }
        html[data-mcfo-newach] #achievement-root { display: none !important; }
        html[data-mcfo-newach] #mcfo-ach-root.mi-root { flex: 1 1 auto; min-height: 0; padding: 12px 14px; width: 100%; max-width: none; margin: 0; box-sizing: border-box; display: block; }
        .ma { --panel-3: #0b111b; }
        .mi-side .ma-nav.inventorySubcategoryButton { display: grid; grid-template-columns: 17px minmax(0, 1fr) auto; column-gap: 9px; row-gap: 4px; }
        .ma .ma-nav .ma-navbar { grid-column: 2 / -1; height: 3px; border-radius: 2px; background: rgba(255, 255, 255, .08); overflow: hidden; }
        .ma .ma-nav .ma-navbar b { display: block; height: 100%; background: var(--mi-line); }
        .ma-grid { grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); }
        .ma .ma-card { all: unset; box-sizing: border-box; display: grid; grid-template-columns: 56px 1fr; grid-template-rows: auto auto auto; gap: 6px 10px; padding: 10px; cursor: pointer;
            border-radius: 10px; color: var(--mi-ink, #f4f6f9); border: 1px solid color-mix(in srgb, var(--mi-line) 35%, transparent);
            background: linear-gradient(165deg, color-mix(in srgb, var(--mi-fill) 22%, #121a26), #0e1520); transition: border-color .12s, transform .12s; }
        .ma .ma-card[data-state=done] { border-color: color-mix(in srgb, var(--mi-line) 75%, transparent);
            background: linear-gradient(170deg, color-mix(in srgb, var(--mi-fill) 92%, #fff 8%), color-mix(in srgb, var(--mi-fill) 70%, #000 30%)); }
        .ma .ma-card[data-state=part] { border-color: color-mix(in srgb, var(--mi-line) 55%, transparent);
            background: linear-gradient(165deg, color-mix(in srgb, var(--mi-fill) 48%, #121a26), #0e1520); }
        .ma .ma-card:hover { border-color: var(--mi-line); transform: translateY(-1px); }
        .ma .ma-card[aria-selected=true] { outline: 2px solid var(--gold-soft, #ffe4a4); outline-offset: 2px; }
        .ma .ma-card:focus-visible { outline: 2px solid var(--blue, #60a5fa); outline-offset: 2px; }
        .ma-badge { position: relative; grid-row: 1 / span 2; width: 56px; height: 56px; }
        .ma-badge img { width: 100%; height: 100%; object-fit: contain; display: block; }
        .ma-card[data-state=open] .ma-badge img { filter: grayscale(.85) brightness(.7); opacity: .85; }
        .ma-tier { position: absolute; right: -4px; bottom: -4px; min-width: 18px; padding: 1px 5px; border-radius: 999px; font: 800 10.5px/1.4 system-ui, sans-serif; text-align: center;
            background: #0b111b; border: 1px solid var(--mi-line); color: #fff; }
        .ma-card__body { min-width: 0; }
        .ma-card h3 { margin: 0 0 3px; font-size: 13px; font-weight: 800; line-height: 1.25; }
        .ma-card p { margin: 0; font-size: 11.5px; line-height: 1.35; color: color-mix(in srgb, var(--mi-ink) 72%, transparent); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .ma-card .ma-bar { grid-column: 1 / -1; }
        .ma-card__foot { grid-column: 1 / -1; display: flex; justify-content: space-between; gap: 8px; font-size: 11px; color: color-mix(in srgb, var(--mi-ink) 75%, transparent); }
        .ma-card__foot b { color: var(--mi-ink); white-space: nowrap; }
        .ma-card[data-state=open] .ma-card__foot b { color: var(--mi-line); }
        .ma-bar { height: 6px; border-radius: 999px; background: rgba(0, 0, 0, .45); overflow: hidden; box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .06); }
        .ma-bar b { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, var(--mi-line, #fbbf24), color-mix(in srgb, var(--mi-line, #fbbf24) 70%, #fff)); }
        /* detail */
        .ma-detail h4 { margin: 6px 0 0; font-size: 11px; letter-spacing: .07em; text-transform: uppercase; color: var(--muted, #9fadc0); }
        .ma-bigbadge { justify-self: center; width: 150px; height: 150px; display: grid; place-items: center; border-radius: 50%;
            background: radial-gradient(circle, color-mix(in srgb, var(--mi-fill) 55%, transparent), transparent 70%); }
        .ma-bigbadge img { width: 128px; height: 128px; object-fit: contain; }
        .ma-bigbadge[data-state=open] img { filter: grayscale(.8) brightness(.75); }
        .ma-detail h2 { text-align: center; }
        .ma-catpill { all: unset; justify-self: center; cursor: pointer; padding: 3px 11px; border-radius: 999px; font-size: 11.5px; font-weight: 800;
            background: color-mix(in srgb, var(--mi-fill) 70%, transparent); border: 1px solid var(--mi-line); color: #fff; }
        .ma-desc { margin: 0; font-size: 13px; line-height: 1.45; text-align: center; color: var(--ink, #eef4fb); }
        .ma-status { padding: 8px 10px; border-radius: 8px; background: rgba(0, 0, 0, .3); border: 1px solid rgba(255, 255, 255, .08); font-size: 12.5px; text-align: center; }
        .ma-status b { color: var(--mi-line); }
        .ma-status--done { border-color: color-mix(in srgb, var(--green, #4ade80) 55%, transparent); color: var(--green, #4ade80); }
        .ma-sub { font-size: 11.5px; color: var(--muted, #9fadc0); text-align: center; }
        .ma-ap { justify-self: center; font: 800 15px/1 system-ui, sans-serif; color: var(--gold, #fbbf24); padding: 6px 12px; border-radius: 8px; background: rgba(251, 191, 36, .1); border: 1px solid rgba(251, 191, 36, .35); }
        .ma-reqs, .ma-ladder, .ma-opp { margin: 0; padding: 0; list-style: none; display: grid; gap: 5px; }
        .ma-reqs li { display: flex; justify-content: space-between; gap: 10px; padding: 6px 9px; border-radius: 7px; background: rgba(0, 0, 0, .25); font-size: 12px; }
        .ma-reqs b { color: var(--mi-line); white-space: nowrap; }
        .ma-ladder li { display: grid; grid-template-columns: 26px 1fr auto; align-items: center; gap: 9px; padding: 6px 9px; border-radius: 8px; background: rgba(0, 0, 0, .22); border: 1px solid transparent; }
        .ma-ladder li img { width: 26px; height: 26px; object-fit: contain; }
        .ma-ladder li span { display: grid; }
        .ma-ladder li b { font-size: 12.5px; }
        .ma-ladder li small { font-size: 11px; color: var(--muted, #9fadc0); }
        .ma-ladder li i { font-style: normal; font-weight: 800; font-size: 12px; color: var(--green, #4ade80); }
        .ma-ladder li.is-next { border-color: color-mix(in srgb, var(--mi-line) 70%, transparent); background: color-mix(in srgb, var(--mi-fill) 25%, transparent); }
        .ma-ladder li.is-next i { color: var(--mi-line); }
        .ma-dot { width: 14px; height: 14px; margin: 0 6px; border-radius: 50%; border: 2px solid var(--mi-line); box-sizing: border-box; }
        .ma-opp { grid-template-columns: 1fr 1fr; font-size: 12px; list-style: decimal inside; }
        .ma-renai { display: grid; grid-template-columns: 1fr 1fr; gap: 5px; }
        .ma-renai button { all: unset; cursor: pointer; display: flex; justify-content: space-between; gap: 6px; padding: 6px 8px; border-radius: 7px; font-size: 11.5px;
            background: rgba(0, 0, 0, .28); border: 1px solid color-mix(in srgb, var(--mi-line) 40%, transparent); }
        .ma-renai button.is-done { background: color-mix(in srgb, var(--mi-fill) 55%, transparent); }
        .ma-renai b { color: var(--mi-line); }
        .ma-renai button.is-done b { color: #fff; }
        /* overview */
        .ma-over { display: grid; gap: 20px; }
        .ma-over h2 { margin: 0 0 8px; font-size: 11px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: var(--muted, #9fadc0); }
        .ma-stats { display: grid; grid-template-columns: minmax(150px, .7fr) minmax(130px, .6fr) minmax(260px, 1.6fr); gap: 10px; }
        .ma-stat { padding: 14px; border-radius: 12px; border: 1px solid var(--line, #ffffff20); background: rgba(0, 0, 0, .22); display: grid; gap: 6px; align-content: start; }
        .ma-stat > span { font-size: 11.5px; color: var(--muted, #9fadc0); text-transform: uppercase; letter-spacing: .05em; font-weight: 700; }
        .ma-stat > b { font: 800 30px/1 system-ui, sans-serif; color: var(--gold, #fbbf24); }
        .ma-stat > b small { font-size: 14px; }
        .ma-stat--reward { --mi-line: #fbbf24; }
        .ma-stat small { font-size: 11.5px; color: var(--muted, #9fadc0); }
        .ma-rewline { display: flex; gap: 10px; flex-wrap: wrap; }
        .ma-rew { display: inline-flex; align-items: center; gap: 5px; font-weight: 800; font-size: 13px; }
        .ma-rew img { width: 18px; height: 18px; }
        .ma-cycles { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 10px; }
        .ma-cycle { padding: 10px 12px; border-radius: 12px; border: 1px solid var(--line, #ffffff20); background: rgba(0, 0, 0, .18); }
        .ma-cycle h3 { margin: 0 0 8px; font-size: 12.5px; }
        .ma-cycle h3 span { color: var(--muted, #9fadc0); font-weight: 600; }
        .ma-cycle ol { margin: 0; padding: 0; list-style: none; display: grid; gap: 4px; }
        .ma-cycle li { display: grid; grid-template-columns: 64px 1fr; align-items: center; gap: 8px; padding: 4px 8px; border-radius: 7px; font-size: 12px; }
        .ma-cycle li b { color: var(--muted, #9fadc0); }
        .ma-cycle li span { display: flex; gap: 8px; flex-wrap: wrap; }
        .ma-cycle li .ma-rew { font-size: 12px; font-weight: 700; }
        .ma-cycle li.is-done { opacity: .5; }
        .ma-cycle li.is-done b::after { content: ' \\2713'; color: var(--green, #4ade80); }
        .ma-cycle li.is-next { background: rgba(251, 191, 36, .12); border: 1px solid rgba(251, 191, 36, .4); }
        .ma-cycle li.is-next b { color: var(--gold, #fbbf24); }
        .ma-recent { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 8px; }
        .ma-recentrow { display: grid; grid-template-columns: 34px 1fr auto; gap: 10px; align-items: center; padding: 8px 10px; border-radius: 10px;
            background: linear-gradient(165deg, color-mix(in srgb, var(--mi-fill) 55%, #121a26), #0e1520); border: 1px solid color-mix(in srgb, var(--mi-line) 45%, transparent); }
        .ma-recentrow img { width: 34px; height: 34px; object-fit: contain; }
        .ma-recentrow span { display: grid; min-width: 0; }
        .ma-recentrow b { font-size: 12.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .ma-recentrow small { font-size: 11px; color: var(--muted, #9fadc0); }
        .ma-recentrow i { font-style: normal; font-weight: 800; font-size: 12px; color: var(--gold, #fbbf24); }
        .ma-cats { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 8px; }
        .ma-cat { all: unset; cursor: pointer; display: grid; grid-template-columns: 20px 1fr auto; align-items: center; gap: 6px 9px; padding: 10px 12px; border-radius: 10px;
            background: linear-gradient(165deg, color-mix(in srgb, var(--mi-fill) 40%, #121a26), #0e1520); border: 1px solid color-mix(in srgb, var(--mi-line) 40%, transparent); }
        .ma-cat:hover { border-color: var(--mi-line); }
        .ma-cat svg { width: 18px; height: 18px; fill: none; stroke: var(--mi-line); stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
        .ma-cat span { font-size: 12.5px; font-weight: 700; }
        .ma-cat b { font-size: 12px; color: var(--mi-line); }
        .ma-cat .ma-bar { grid-column: 1 / -1; }
        .ma-share { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 10px 12px; border-radius: 12px; border: 1px solid var(--line, #ffffff20); background: rgba(0, 0, 0, .18); font-size: 12.5px; }
        .ma-share a { color: var(--cyan, #67e8f9); word-break: break-all; }
        .ma .mi-grid [data-goto] { cursor: pointer; }
        @media (max-width: 1180px) { .ma-stats { grid-template-columns: 1fr 1fr; } .ma-stat--reward { grid-column: 1 / -1; } }
    `;

