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
        // owner may be a list: the game shows the live Twitch display name, so a renamed account
        // keeps its old name here as well (CuteLegoGirl became DreamingLegoGirl on 2026-09-25).
        const me = (accountName() || '').toLowerCase();
        return [].concat(t.owner).some(o => String(o).toLowerCase() === me);
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
        ${skinSel(S, buttons.filter(b => !SKIN_HOVERLESS.includes(b)), ':hover:not(:disabled)')} { ${B.hover || ''} }
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

