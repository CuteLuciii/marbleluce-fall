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
    // The chips inside a clickable header card (our signposts, the game's Purchase) take no hover
    // look of their own (6.35.2): the whole card glows instead, and a chip lighting up on top of
    // it was one signal too many. Left out of every skin's :hover rule.
    const SKIN_HOVERLESS = ['.mcfo-signpost', '[data-role="diamonds-purchase-link"]'];
    const SKIN_BUTTONS = [
        '.mcf-chat__send', '.mcf-chat__cosmetics-toggle', '.mcf-chat__collapse', '.mcfo-chatpop-btn', '.mcfo-tomato-btn', '.mcfo-animal-btn',
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
                const hovers = skinSel(S, SKIN_BUTTONS.filter(b => !SKIN_HOVERLESS.includes(b)), ':hover:not(:disabled)');
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

