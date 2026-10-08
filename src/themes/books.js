    // =========================================================================================
    // 3f. BOOKS (6.17)
    // =========================================================================================
    // Two themes for readers. The Lost Bookshop (Evie Woods; "Der verschwundene Buchladen"): the
    // wall of dark blue spines with ivy growing over it and the little yellow house in a nook
    // between the books. And a reading nook: tea, a page of a book, a knitted blanket, fairy
    // lights. All drawn here; the lines on the plaques are our own, not the book's.
    const BOOK_SERIF = '"Cormorant Garamond", "EB Garamond", Garamond, "Palatino Linotype", "Book Antiqua", Georgia, serif';
    const BOOK_SCRIPT = '"Great Vibes", "Allura", "Brush Script MT", "Segoe Script", "URW Chancery L", cursive';

    // A shelf of books: spines of different widths and heights, gold bands on some, a board below.
    function spinesSvg(seed, w, h, pal, rare) {
        const r = seeded(seed), board = Math.round(h * 0.13);
        let x = 0, s = '';
        while (x < w) {
            const bw = 6 + Math.floor(r() * 11), bwc = Math.min(bw, w - x), bh = Math.round((h - board) * (0.72 + r() * 0.28));
            const y = h - board - bh, c = r() < 0.12 ? pickOf(r, rare) : pickOf(r, pal);
            s += `<rect x="${x}" y="${y}" width="${bwc}" height="${bh}" fill="${c}"/>`
               + `<rect x="${x}" y="${y}" width="1" height="${bh}" fill="rgba(255,255,255,.09)"/><rect x="${x + bwc - 1}" y="${y}" width="1" height="${bh}" fill="rgba(0,0,0,.4)"/>`;
            if (r() < 0.45 && bwc > 3) {
                s += `<rect x="${x + 1}" y="${(y + 4 + r() * 6).toFixed(1)}" width="${bwc - 2}" height="1.3" fill="#c9a24a" opacity=".8"/>`
                   + `<rect x="${x + 1}" y="${(y + bh - 8 - r() * 6).toFixed(1)}" width="${bwc - 2}" height="1.3" fill="#c9a24a" opacity=".7"/>`;
            }
            if (r() < 0.2 && bwc > 8) s += `<rect x="${x + 2}" y="${(y + bh * 0.35).toFixed(1)}" width="${bwc - 4}" height="${(bh * 0.18).toFixed(1)}" fill="rgba(0,0,0,.28)"/>`;
            x += bw;
        }
        s += `<rect y="${h - board}" width="${w}" height="${board}" fill="#2a1a10"/><rect y="${h - board}" width="${w}" height="1.5" fill="#6a4628"/>`;
        return svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">${s}</svg>`);
    }
    const LB_SPINES = ['#0f2233', '#15304a', '#1d3a52', '#24485e', '#2E4947', '#1a2a3a', '#33506a', '#0b1a28', '#264a4a'];
    const LB_RARE = ['#6b3a22', '#8a4a2a', '#5a2a1a', '#3a5a3a'];

    // A heart-shaped ivy leaf: stalk at the origin, tip at (0, 13).
    const LEAF_D = 'M0 13C-4 9-7 6-7 3C-7 .5-5-1-3-1C-1.6-1-.5-.2 0 .8C.5-.2 1.6-1 3-1C5-1 7 .5 7 3C7 6 4 9 0 13Z';
    const IVY_GREENS = ['#427358', '#78A66A', '#2f6b3a', '#5a9a5a', '#3a7f4a'];
    // A strand of ivy, top to bottom (or left to right with horiz): a wavy stem, leaves either side.
    function ivySvg(seed, len, horiz) {
        const r = seeded(seed), W = 36;
        let stem = `M${W / 2} 0`, leaves = '';
        for (let y = 0; y < len; y += 12) stem += `Q${W / 2 + ((y / 12) % 2 ? 6 : -6)} ${y + 6} ${W / 2} ${y + 12}`;
        for (let y = 5; y < len - 4; y += 13 + r() * 9) {
            const side = r() < 0.5 ? -1 : 1, sc = 0.7 + r() * 0.55;
            leaves += `<g transform="translate(${(W / 2 + side * 2.5).toFixed(1)} ${y.toFixed(1)}) rotate(${(-side * (35 + r() * 45)).toFixed(0)}) scale(${sc.toFixed(2)})">`
                    + `<path d="${LEAF_D}" fill="${pickOf(r, IVY_GREENS)}"/><path d="M0 1.5V11" stroke="rgba(255,255,255,.28)" stroke-width=".6"/></g>`;
        }
        const g = `<path d="${stem}" fill="none" stroke="#2a4a2a" stroke-width="1.6"/>${leaves}`;
        return horiz
            ? svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${len} ${W}"><g transform="matrix(0 1 1 0 0 0)">${g}</g></svg>`)
            : svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${len}">${g}</svg>`);
    }
    // The little yellow house: grey roof, two chimneys, white windows lit from inside, a red door.
    const houseSvg = () => svgUrl('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 54">'
        + '<defs><linearGradient id="h" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#d99a2b"/><stop offset=".5" stop-color="#f4c552"/><stop offset="1" stop-color="#c98a22"/></linearGradient></defs>'
        + '<rect x="13" y="2" width="5" height="10" fill="#6c7580"/><rect x="42" y="2" width="5" height="10" fill="#6c7580"/>'
        + '<path d="M3 21L10 8H50L57 21Z" fill="#7d8792"/><path d="M10 8H50L51.5 11H8.5Z" fill="#9aa3ad"/>'
        + '<rect x="6" y="21" width="48" height="30" fill="url(#h)"/><rect x="4" y="20" width="52" height="2" fill="#f1e9d6"/>'
        + '<g fill="#fff3c4" stroke="#f7f1e3" stroke-width="1">'
        + '<rect x="10" y="25" width="6" height="8"/><rect x="20.5" y="25" width="6" height="8"/><rect x="33.5" y="25" width="6" height="8"/><rect x="44" y="25" width="6" height="8"/>'
        + '<rect x="10" y="39" width="6" height="8"/><rect x="18" y="39" width="6" height="8"/><rect x="36" y="39" width="6" height="8"/><rect x="44" y="39" width="6" height="8"/></g>'
        + '<g stroke="#8a8f96" stroke-width=".5"><path d="M13 25v8M10 29h6M23.5 25v8M20.5 29h6M36.5 25v8M33.5 29h6M47 25v8M44 29h6M13 39v8M10 43h6M21 39v8M18 43h6M39 39v8M36 43h6M47 39v8M44 43h6"/></g>'
        + '<rect x="26.5" y="37" width="7" height="14" fill="#f7f1e3"/><rect x="27.5" y="38" width="5" height="13" fill="#b0302a"/>'
        + '<rect x="4" y="51" width="52" height="2.5" fill="#d8cfb8"/></svg>');
    function letterDraw(g, p, now, w, h) {
        const a = Math.max(0, Math.min(1, p.y / h)) * (0.55 + 0.35 * Math.sin(now / 400 + p.ph));
        g.save(); g.translate(p.x, p.y); g.rotate(p.rot + Math.sin(now / 900 + p.ph) * 0.2);
        g.globalAlpha = a; g.fillStyle = '#e8c46a'; g.shadowColor = 'rgba(232, 196, 106, 0.8)'; g.shadowBlur = 6;
        g.font = `italic ${p.s}px ${BOOK_SERIF}`; g.textAlign = 'center'; g.fillText(p.ch, 0, 0);
        g.restore();
    }
    let leafPath = null;
    function leafDraw(g, p, now) {
        if (!leafPath) { try { leafPath = new Path2D(LEAF_D); } catch (e) { return; } }
        g.save(); g.translate(p.x, p.y); g.rotate(p.a + Math.sin(now / 700 + p.ph) * 0.6); g.scale(p.s, p.s);
        g.globalAlpha = 0.8; g.fillStyle = p.c; g.fill(leafPath);
        g.restore();
    }

    // ---- Reading nook ----
    // Knitting: rows of V stitches, two leaning loops each.
    const knitSvg = (base, loop, hi) => svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="12" height="10" viewBox="0 0 12 10"><rect width="12" height="10" fill="${base}"/>`
        + `<g fill="${loop}" stroke="${hi}" stroke-width=".5"><ellipse cx="3.3" cy="5" rx="4.2" ry="2.1" transform="rotate(62 3.3 5)"/><ellipse cx="8.7" cy="5" rx="4.2" ry="2.1" transform="rotate(-62 8.7 5)"/></g></svg>`);
    const bookStackSvg = () => svgUrl('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 130 120">'
        + '<g stroke="rgba(0,0,0,.35)" stroke-width=".8">'
        + '<rect x="8" y="98" width="104" height="18" rx="2" fill="#7a2e22"/><rect x="104" y="100" width="6" height="14" fill="#efe3c6"/>'
        + '<rect x="16" y="81" width="90" height="17" rx="2" fill="#5a7a58"/><rect x="98" y="83" width="6" height="13" fill="#efe3c6"/>'
        + '<rect x="6" y="64" width="96" height="17" rx="2" fill="#c8962e"/><rect x="94" y="66" width="6" height="13" fill="#efe3c6"/>'
        + '<rect x="22" y="49" width="74" height="15" rx="2" fill="#2e4a6a"/><rect x="88" y="51" width="6" height="11" fill="#efe3c6"/></g>'
        + '<g fill="#e8c46a" opacity=".8"><rect x="14" y="102" width="2" height="10"/><rect x="20" y="102" width="2" height="10"/><rect x="22" y="85" width="2" height="9"/>'
        + '<rect x="12" y="68" width="2" height="9"/><rect x="18" y="68" width="2" height="9"/><rect x="28" y="52" width="2" height="9"/></g>'
        + '<path d="M44 26h26v17a4 4 0 0 1-4 4H48a4 4 0 0 1-4-4z" fill="#e8dcc4" stroke="#8a5a34" stroke-width="1.2"/>'
        + '<path d="M70 30h3a5 5 0 0 1 0 10h-3" fill="none" stroke="#8a5a34" stroke-width="1.6"/><ellipse cx="57" cy="26.5" rx="12.5" ry="2" fill="#a0602e"/>'
        + '<g fill="none" stroke="rgba(255,240,220,.35)" stroke-width="1.4" stroke-linecap="round"><path d="M52 21c-3-3 3-5 0-9"/><path d="M58 21c-3-3 3-5 0-9"/><path d="M64 21c-3-3 3-5 0-9"/></g></svg>');
    const plantSvg = () => svgUrl('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 90 120">'
        + '<g fill="#4f7a45"><ellipse cx="30" cy="48" rx="9" ry="22" transform="rotate(-35 30 48)"/><ellipse cx="60" cy="46" rx="9" ry="22" transform="rotate(35 60 46)"/>'
        + '<ellipse cx="45" cy="36" rx="8" ry="24"/><ellipse cx="20" cy="66" rx="7" ry="17" transform="rotate(-62 20 66)"/><ellipse cx="70" cy="66" rx="7" ry="17" transform="rotate(62 70 66)"/></g>'
        + '<g stroke="#2f5a2a" stroke-width="1"><path d="M45 78V16M45 78L27 36M45 78L63 34M45 80L15 62M45 80L75 62"/></g>'
        + '<path d="M24 78h42l-5 38H29z" fill="#b8643a"/><rect x="21" y="75" width="48" height="8" rx="2" fill="#c97448"/></svg>');
    const TEACUP_SVG = '<svg viewBox="0 0 32 32"><g class="mcfo-steam" fill="none" stroke="#e6d2b0" stroke-width="1.4" stroke-linecap="round"><path d="M12 12c-2-2 2-4 0-6"/><path d="M16 12c-2-2 2-4 0-6"/><path d="M20 12c-2-2 2-4 0-6"/></g>'
        + '<path d="M7 15h18v4a8 8 0 0 1-8 8h-2a8 8 0 0 1-8-8z" fill="#f3e6c8" stroke="#8a5a34" stroke-width="1.2"/><path d="M25 17h2a3 3 0 0 1 0 6h-2.4" fill="none" stroke="#f3e6c8" stroke-width="1.6"/>'
        + '<ellipse cx="16" cy="15" rx="9" ry="1.6" fill="#a0602e"/><path d="M5 28h22" stroke="#f3e6c8" stroke-width="1.4" stroke-linecap="round"/></svg>';
    // Fairy lights on the windowsill: a wire drooping between hooks, warm bulbs that breathe.
    const fairyLights = host => ({
        name: 'fairy', host,
        init: w => {
            const n = Math.max(4, Math.round(w / 23) * 2), pts = [];
            for (let i = 0; i <= n; i++) pts.push({ x: i * w / n, ph: Math.random() * 6.28, sp: 0.6 + Math.random() * 1.3, c: pickOf(Math.random, ['255, 214, 140', '255, 190, 110', '255, 236, 190', '255, 170, 120']) });
            return { pts };
        },
        step: (g, st, w, h, dt, now) => {
            g.clearRect(0, 0, w, h);
            const top = 2, sag = 8, hooks = st.pts.filter((_, i) => i % 2 === 0);
            g.strokeStyle = 'rgba(40, 28, 20, 0.9)'; g.lineWidth = 1.2; g.beginPath();
            hooks.forEach((p, i) => { if (!i) g.moveTo(p.x, top); else g.quadraticCurveTo((p.x + hooks[i - 1].x) / 2, top + sag * 2, p.x, top); });
            g.stroke();
            st.pts.forEach((p, i) => {
                const y = (i % 2 ? top + sag : top) + 4, a = 0.55 + 0.45 * Math.sin(now / 1000 * p.sp + p.ph);
                glowDot(g, p.x, y, 13, p.c, 0.4 * a);
                g.globalAlpha = 1; g.fillStyle = `rgba(${p.c}, ${0.55 + 0.45 * a})`;
                g.beginPath(); g.ellipse(p.x, y, 2.4, 3.3, 0, 0, Math.PI * 2); g.fill();
            });
        },
    });

    Object.assign(SKINS, {
        // ---- The Lost Bookshop / Der verschwundene Buchladen ----
        lostbookshop: deluxe({
            assets: () => ({
                wall: spinesSvg(1942, 420, 120, LB_SPINES, LB_RARE), strip: spinesSvg(7, 360, 60, LB_SPINES, LB_RARE), nook: spinesSvg(23, 300, 74, LB_SPINES, LB_RARE),
                ivyA: ivySvg(3, 150), ivyB: ivySvg(11, 120), ivyC: ivySvg(17, 170), ivyChat: ivySvg(29, 240), garland: ivySvg(41, 260, true), house: houseSvg(),
            }),
            kit: A => {
                const spine = 'linear-gradient(180deg, transparent 0 3px, #c9a24a 3px 4px, transparent 4px calc(100% - 4px), #c9a24a calc(100% - 4px) calc(100% - 3px), transparent calc(100% - 3px)), '
                    + 'linear-gradient(90deg, #1a3448, #2E4947 50%, #1a3448)';
                return {
                    titleCss: `font-family: ${BOOK_SCRIPT}; font-weight: 400; font-size: 1.4em; letter-spacing: 0.01em; text-transform: none; color: #e8c46a;`,
                    ground: `url("${A.ivyA}") 8% 56px / 36px 150px no-repeat, url("${A.ivyB}") 21% 56px / 36px 120px no-repeat, url("${A.ivyC}") 61% 56px / 36px 170px no-repeat, url("${A.ivyB}") 76% 56px / 36px 120px no-repeat,
                             radial-gradient(ellipse at 50% 40%, rgba(7, 15, 26, 0.15), rgba(7, 15, 26, 0.72) 78%), url("${A.wall}") 0 0 / 420px 120px, #070F1A`,
                    header: { bg: `linear-gradient(180deg, rgba(7, 15, 26, 0.25), rgba(7, 15, 26, 0.55)), url("${A.strip}") 0 0 / 360px 100% repeat-x, #070F1A`,
                              border: '3px solid #2a1a10', extra: 'box-shadow: 0 1px 0 #6a4628, 0 6px 18px rgba(0, 0, 0, 0.55) !important;' },
                    cards: { bg: 'rgba(7, 15, 26, 0.9)', border: '1px solid #b8963f', radius: '3px', shadow: 'inset 0 0 0 1px rgba(232, 196, 106, 0.12)' },
                    footer: { bg: `url("${A.garland}") 0 -4px / 260px 32px repeat-x, repeating-linear-gradient(90deg, rgba(0, 0, 0, 0.12) 0 2px, transparent 2px 60px), linear-gradient(180deg, #3a2414, #22140a)`,
                              border: '2px solid #6a4628', extra: 'isolation: isolate;' },
                    chat: {
                        bg: 'radial-gradient(ellipse at 50% 20%, rgba(46, 73, 71, 0.35), transparent 70%), linear-gradient(180deg, #0d1b29, #070F1A)', border: '2px solid #b8963f', radius: '4px', pad: '78px 12px 0',
                        shadow: 'inset 0 0 0 1px #2a1a10, 0 0 0 1px #000000',
                        head: 'linear-gradient(180deg, #132536, #0b1622)', headBorder: '1px solid #b8963f', headText: '#e8c46a',
                        body: 'transparent', comp: '#0a131d', compBorder: '1px solid rgba(184, 150, 63, 0.6)',
                        input: { bg: '#060d16', border: '1px solid #8a7440', color: '#efe6cf', radius: '3px', hint: '#8a7f66' },
                    },
                    btn: { bg: spine, color: '#f0d88a', border: '1px solid #0b1622', radius: '2px', shadow: 'inset 1px 0 0 rgba(255, 255, 255, 0.12), 0 2px 0 #050a10',
                           hover: 'filter: brightness(1.18); box-shadow: 0 0 0 1px #c9a24a, 0 0 12px rgba(232, 196, 106, 0.5) !important;',
                           extra: `font-family: ${BOOK_SERIF}; font-weight: 700; letter-spacing: 0.04em;` },
                    filled: { radius: '2px', border: '1px solid rgba(201, 162, 74, 0.8)', shadow: '0 2px 0 rgba(0, 0, 0, 0.5)' },
                    popup: { bg: '#0b1622', border: '1px solid #b8963f', radius: '4px', hover: 'rgba(120, 166, 106, 0.2)', head: '#e8c46a', shadow: '0 0 0 1px #000000, 0 12px 30px rgba(0, 0, 0, 0.7)' },
                    win: { border: '2px solid #b8963f', radius: '4px', shadow: '0 0 0 1px #000000, 0 16px 40px rgba(0, 0, 0, 0.7)',
                           head: `linear-gradient(180deg, rgba(7, 15, 26, 0.45), rgba(7, 15, 26, 0.75)), url("${A.strip}") 0 0 / 240px 100% repeat-x`, headBorder: '2px solid #2a1a10', title: '#e8c46a' },
                    panel: { radius: '3px', border: '#3a5060', pressed: '#e8c46a' },
                };
            },
            extra: (S, A, fx) => `
                ${S} .mcf-chat__header .mcf-chat__title strong { color: #e8c46a !important; }
                ${S} [data-role="action-region"] > .mcfo-skin-canvas { z-index: -1; }
                ${S} .mcfo-lb-nook { position: absolute; top: 0; left: 0; right: 0; height: 78px; pointer-events: none; border-radius: 2px 2px 0 0; overflow: hidden;
                    background: url("${A.nook}") 0 100% / 300px 74px repeat-x, #070F1A; box-shadow: inset 0 -2px 0 #6a4628; }
                ${S} .mcfo-lb-nook i { position: absolute; left: 50%; bottom: 10px; width: 78px; height: 58px; transform: translateX(-50%);
                    background: radial-gradient(ellipse at 50% 70%, rgba(255, 214, 120, 0.25), transparent 70%), #050b13; box-shadow: inset 0 0 10px #000000, 0 0 0 2px #0b1622; }
                ${S} .mcfo-lb-nook b { position: absolute; left: 50%; bottom: 10px; width: 62px; height: 56px; transform: translateX(-50%);
                    background: url("${A.house}") center bottom / contain no-repeat; filter: drop-shadow(0 0 6px rgba(255, 214, 120, 0.45)); }
                ${fx(['full', 'subtle'], '.mcfo-lb-nook b')} { animation: mcfoLbGlow 5s ease-in-out infinite alternate; }
                @keyframes mcfoLbGlow { from { filter: drop-shadow(0 0 3px rgba(255, 214, 120, 0.3)); } to { filter: drop-shadow(0 0 10px rgba(255, 214, 120, 0.75)); } }
                ${S} .mcfo-lb-ivy { position: absolute; inset: 60px 0 0; pointer-events: none; }
                ${S} .mcfo-lb-ivy i { position: absolute; top: 0; bottom: 0; width: 30px; background: url("${A.ivyChat}") 50% 0 / 30px 200px repeat-y; }
                ${S} .mcfo-lb-ivy i:first-child { left: -9px; }
                ${S} .mcfo-lb-ivy i:last-child { right: -9px; transform: scaleX(-1); background-position: 50% 90px; }
                ${S} .mcfo-lb-plaque { position: absolute; left: 50%; top: 100%; z-index: 40; transform: translate(-50%, -100%); pointer-events: none; white-space: nowrap;
                    padding: 3px 16px 3px; border-radius: 7px 7px 0 0; background: rgba(7, 15, 26, 0.94); border: 1px solid #b8963f; border-bottom: 0; box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.45);
                    font: 400 16px/1.1 ${BOOK_SCRIPT}; color: #e8c46a; text-shadow: 0 0 8px rgba(232, 196, 106, 0.35); }`,
            decor: [
                { cls: 'mcfo-lb-nook', host: () => document.querySelector('.mcf-chat'), html: '<i></i><b></b>' },
                { cls: 'mcfo-lb-ivy', host: () => document.querySelector('.mcf-chat'), html: '<i></i><i></i>' },
                // Sits ON TOP of the king tile like a crest that belongs to it (bottom edge = tile top edge), so it
                // never covers the king's name or crown. The header centre is usually covered by cards, so it is
                // lifted above them. Re-measured every tick because the tile moves with chat/tray.
                { cls: 'mcfo-lb-plaque', host: () => role('top-status-region'), html: 'In a place called Lost, strange things are found.',
                  place: (el, host) => {
                      const tile = role('king-tile-frame') || role('king-pane');
                      if (!tile) return;
                      const t = tile.getBoundingClientRect(), h = host.getBoundingClientRect();
                      if (!t.width || !h.width) return;
                      el.style.left = Math.round(t.left + t.width / 2 - h.left) + 'px';
                      el.style.top = Math.round(t.top - h.top) + 'px';
                  } },
            ],
            particles: [
                // Letters rising out of the shelf, as if the stories were getting out.
                drifters('letters', () => role('action-region'), 9,
                    (w, h, any) => ({ x: rnd(8, w - 8), y: any ? rnd(0, h) : h + 10, v: rnd(7, 14), ph: rnd(0, 6), rot: rnd(-0.4, 0.4), s: rnd(10, 16),
                                      ch: pickOf(Math.random, 'ABCDEFGHIKLMNOPRSTUWaeghiklmnorstuy&'.split('')) }),
                    (p, dt, now) => { p.y -= p.v * dt; p.x += Math.sin(now / 800 + p.ph) * 6 * dt; return p.y > -14; },
                    letterDraw),
                // Now and then a leaf lets go of the ivy.
                drifters('ivyleaves', () => document.querySelector('.mcf-chat:not([data-collapsed="true"])'), 5,
                    (w, h, any) => ({ x: rnd(10, w - 10), y: any ? rnd(0, h) : -14, v: rnd(9, 16), ph: rnd(0, 6), a: rnd(0, 6), s: rnd(0.6, 1.0), c: pickOf(Math.random, IVY_GREENS) }),
                    (p, dt, now, w, h) => { p.y += p.v * dt; p.x += Math.sin(now / 900 + p.ph) * 12 * dt; return p.y < h + 14; },
                    leafDraw),
            ],
            tile: A => `background: url("${A.house}") 50% 62% / 30px 27px no-repeat, radial-gradient(ellipse at 50% 60%, #050b13 0 18px, transparent 19px),
                        url("${A.ivyB}") 6% 0 / 16px 54px no-repeat, url("${A.ivyA}") 94% 0 / 16px 60px no-repeat, url("${A.wall}") 0 0 / 160px 46px, #070F1A;
                        box-shadow: inset 0 0 0 2px #b8963f;`,
        }),

        // ---- Reading nook: tea, a book, a knitted blanket, fairy lights ----
        // The chat is a page of the book, the chat header its leather cover, a ribbon marks the
        // place. The header is the blanket, the footer the windowsill with its string of lights.
        readingnook: deluxe({
            assets: () => ({ knit: knitSvg('#a88a62', '#e8d8b8', 'rgba(120, 90, 50, 0.45)'), stack: bookStackSvg(), plant: plantSvg(), grain: grainSvg(0.12) }),
            kit: A => {
                const leather = 'linear-gradient(180deg, rgba(255, 255, 255, 0.06), transparent 40%), linear-gradient(180deg, #6b3a22, #4a2616)';
                const wood = 'repeating-linear-gradient(90deg, rgba(0, 0, 0, 0.1) 0 1px, transparent 1px 7px, rgba(255, 220, 170, 0.04) 7px 9px, transparent 9px 23px), linear-gradient(180deg, #6b4428, #4a2c18)';
                return {
                    titleCss: `font-family: ${BOOK_SERIF}; font-style: italic; font-weight: 700; letter-spacing: 0.02em;`,
                    ground: `url("${A.stack}") 2.5% calc(100% - 64px) / auto 118px no-repeat, url("${A.plant}") 61% calc(100% - 64px) / auto 112px no-repeat,
                             radial-gradient(ellipse at 10% 6%, rgba(255, 196, 120, 0.32), transparent 42%), radial-gradient(ellipse at 90% 100%, rgba(255, 170, 100, 0.12), transparent 45%),
                             radial-gradient(circle, rgba(255, 220, 170, 0.07) 0 2.5px, transparent 3px) 0 0 / 28px 28px,
                             repeating-linear-gradient(90deg, rgba(0, 0, 0, 0.09) 0 14px, transparent 14px 28px), linear-gradient(180deg, #3a2419, #24160f)`,
                    header: { bg: `url("${A.knit}") 0 0 / 12px 10px`, border: '3px solid #8a6a44',
                              extra: 'box-shadow: inset 0 -4px 6px rgba(80, 50, 20, 0.35), 0 6px 18px rgba(0, 0, 0, 0.45) !important;' },
                    cards: { bg: 'rgba(58, 36, 25, 0.92)', border: '1px solid #c9a24a', radius: '8px', shadow: '0 2px 6px rgba(40, 20, 10, 0.4)' },
                    footer: { bg: wood, border: '2px solid #8a5a34', extra: 'isolation: isolate;' },
                    chat: {
                        bg: `url("${A.grain}") 0 0 / 180px 180px, radial-gradient(ellipse at 50% 40%, transparent 60%, rgba(120, 80, 40, 0.14)), #f6eedb`, border: '1px solid #b8a27a', radius: '4px 10px 10px 4px',
                        shadow: 'inset -5px 0 0 #efe4c8, inset -6px 0 0 #cdbd98, inset -9px 0 0 #f3e9d0, inset -10px 0 0 #cdbd98, 0 0 0 1px #6b3a22',
                        head: leather, headBorder: '3px solid #c9a24a', headText: '#f1d9a0',
                        body: 'transparent', comp: '#efe3c6', compBorder: '1px solid #cdb88f',
                        input: { bg: '#fffaf0', border: '1px solid #b8a27a', color: '#3b2a1e', radius: '999px', hint: '#a08a6a' },
                    },
                    btn: { bg: 'linear-gradient(180deg, #f5e9cd, #e6d2a8)', color: '#6b3a22', border: '1px dashed #a0784a', radius: '10px', shadow: '0 0 0 2px #e6d2a8, 0 3px 0 2px #8a6a4a',
                           hover: 'filter: brightness(1.05); box-shadow: 0 0 0 2px #f1d9a0, 0 0 12px rgba(255, 196, 120, 0.6) !important;', extra: `font-family: ${BOOK_SERIF}; font-weight: 700;` },
                    filled: { radius: '10px', border: '1px dashed rgba(255, 244, 220, 0.85)', shadow: '0 3px 0 rgba(60, 30, 10, 0.5)' },
                    popup: { bg: '#2b1d17', border: '1px solid #c9a24a', radius: '10px', hover: 'rgba(255, 196, 120, 0.18)', head: '#f1d9a0', shadow: '0 0 0 1px #000000, 0 12px 30px rgba(0, 0, 0, 0.6)' },
                    win: { border: '2px solid #8a5a34', radius: '10px', shadow: '0 0 0 1px #2b1d17, 0 16px 40px rgba(0, 0, 0, 0.6)', head: leather, headBorder: '2px solid #c9a24a', title: '#f1d9a0' },
                    panel: { radius: '8px', border: '#8a6a44', pressed: '#f1d9a0' },
                };
            },
            extra: (S, A, fx) => lightChatCss(S, '#3b2a1e', '#8a6a4a') + `
                ${S} .mcf-chat__header .mcf-chat__status { color: #e0c48a !important; }
                ${S} .mcf-chat__send { background: #7a2e22 !important; color: #fff1d8 !important; border: 1px dashed #f1d9a0 !important; box-shadow: 0 0 0 2px #7a2e22 !important; }
                ${S} [data-role="action-region"] > .mcfo-skin-canvas { z-index: -1; }
                ${S} .mcfo-nook-tag { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%) rotate(-1.5deg); pointer-events: none; white-space: nowrap;
                    padding: 4px 18px 6px; border-radius: 3px; background: #efe3c6; color: #6b3a22; font: 400 21px/1 ${BOOK_SCRIPT};
                    outline: 1px dashed #a0784a; outline-offset: -4px; box-shadow: 0 3px 8px rgba(60, 30, 10, 0.45); }
                ${S} .mcfo-nook-tag::before { content: ''; position: absolute; left: 7px; top: 50%; width: 6px; height: 6px; margin-top: -3px; border-radius: 50%; background: #a88a62; box-shadow: inset 0 1px 1px rgba(0, 0, 0, 0.4); }
                ${S} .mcfo-nook-cup { position: absolute; left: 34%; top: 50%; width: 28px; height: 28px; transform: translate(-50%, -55%); pointer-events: none; }
                ${S} .mcfo-nook-cup svg { display: block; width: 100%; height: 100%; overflow: visible; }
                ${S} .mcfo-nook-cup .mcfo-steam path { opacity: 0.6; }
                ${fx(['full', 'subtle'], '.mcfo-nook-cup .mcfo-steam path')} { animation: mcfoSteam 3.2s ease-in-out infinite; }
                ${fx(['full', 'subtle'], '.mcfo-nook-cup .mcfo-steam path:nth-child(2)')} { animation-delay: 1.1s; }
                ${fx(['full', 'subtle'], '.mcfo-nook-cup .mcfo-steam path:nth-child(3)')} { animation-delay: 2.1s; }
                @keyframes mcfoSteam { 0% { opacity: 0; transform: translateY(3px); } 40% { opacity: 0.9; } 100% { opacity: 0; transform: translateY(-5px); } }
                ${S} .mcfo-nook-ribbon { position: absolute; right: 26px; width: 12px; height: 84px; pointer-events: none;
                    background: linear-gradient(90deg, #8a1a22, #b3202a 50%, #8a1a22); clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 86%, 0 100%); opacity: 0.85; }`,
            decor: [
                { cls: 'mcfo-nook-tag', host: () => role('top-status-region'), html: 'Just one more chapter.' },
                { cls: 'mcfo-nook-cup', host: () => document.querySelector('.mcf-chat__header'), html: TEACUP_SVG },
                // The ribbon hangs from the lower edge of the cover (the chat header).
                { cls: 'mcfo-nook-ribbon', host: () => document.querySelector('.mcf-chat'), html: '',
                  place: (el, host) => { const h = host.querySelector('.mcf-chat__header'); if (h) el.style.top = (h.offsetTop + h.offsetHeight) + 'px'; } },
            ],
            particles: [fairyLights(() => role('action-region'))],
            tile: A => `background: radial-gradient(circle at 20% 22%, #ffd68c 0 2px, rgba(255, 214, 140, 0.35) 3px, transparent 6px), radial-gradient(circle at 42% 30%, #ffbe6e 0 2px, rgba(255, 190, 110, 0.35) 3px, transparent 6px),
                        radial-gradient(circle at 64% 22%, #ffecbe 0 2px, rgba(255, 236, 190, 0.35) 3px, transparent 6px), radial-gradient(circle at 86% 30%, #ffaa78 0 2px, rgba(255, 170, 120, 0.35) 3px, transparent 6px),
                        url("${A.stack}") 12% 100% / auto 70% no-repeat, linear-gradient(90deg, transparent 0 52%, #f6eedb 52% 92%, #cdbd98 92% 93%, transparent 93%) 0 100% / 100% 62% no-repeat,
                        linear-gradient(180deg, #3a2419, #24160f); box-shadow: inset 0 0 0 2px #8a6a44;`,
        }),
    });

