    // =========================================================================================
    // 3g. MUSIC (6.18)
    // =========================================================================================
    // Six bands, each recognisable from its look rather than its logo: no logos, covers, photos or
    // fonts of the originals and no lyrics (Greasy Fork code rules: copyright). Colours, motifs and
    // lettering are drawn here; the lines on the plaques are our own.
    const HEAVY_FONT = '"Helvetica Neue", "Arial Black", "Archivo Black", "Helvetica", Arial, sans-serif';

    // Spray paint: blobs with satellite dots and the odd drip running down.
    function splatSvg(seed, w, h, cols, n, a = 1) {
        const r = seeded(seed);
        let s = '';
        for (let i = 0; i < n; i++) {
            const x = r() * w, y = r() * h, rad = 6 + r() * 16, c = pickOf(r, cols);
            s += `<g fill="${c}" opacity="${(a * (0.55 + r() * 0.45)).toFixed(2)}">`;
            for (let k = 0; k < 5; k++) s += `<circle cx="${(x + (r() - 0.5) * rad).toFixed(1)}" cy="${(y + (r() - 0.5) * rad * 0.8).toFixed(1)}" r="${(rad * (0.3 + r() * 0.35)).toFixed(1)}"/>`;
            for (let k = 0; k < 16; k++) {
                const ang = r() * 6.283, dist = rad * (0.7 + r() * 1.8);
                s += `<circle cx="${(x + Math.cos(ang) * dist).toFixed(1)}" cy="${(y + Math.sin(ang) * dist).toFixed(1)}" r="${(0.6 + r() * rad * 0.16).toFixed(1)}"/>`;
            }
            if (r() < 0.5) {
                const dx = x + (r() - 0.5) * rad, len = 12 + r() * 40, dw = 1.4 + r() * 2.4;
                s += `<rect x="${(dx - dw / 2).toFixed(1)}" y="${y.toFixed(1)}" width="${dw.toFixed(1)}" height="${len.toFixed(1)}" rx="${(dw / 2).toFixed(1)}"/><circle cx="${dx.toFixed(1)}" cy="${(y + len).toFixed(1)}" r="${(dw * 0.8).toFixed(1)}"/>`;
            }
            s += '</g>';
        }
        return svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">${s}</svg>`);
    }
    // A band of paint along the top edge with drips hanging from it.
    function dripSvg(seed, w, h, cols) {
        const r = seeded(seed);
        let s = '';
        for (let x = 0; x < w; x += 6 + r() * 14) {
            const c = pickOf(r, cols), dw = 2 + r() * 4, len = 4 + Math.pow(r(), 2) * (h - 8);
            s += `<g fill="${c}"><rect x="${x.toFixed(1)}" y="0" width="${dw.toFixed(1)}" height="${len.toFixed(1)}" rx="${(dw / 2).toFixed(1)}"/><circle cx="${(x + dw / 2).toFixed(1)}" cy="${len.toFixed(1)}" r="${(dw * 0.62).toFixed(1)}"/></g>`;
        }
        return svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><rect width="${w}" height="3" fill="${cols[0]}"/>${s}</svg>`);
    }
    // Brackets drawn as four background layers: [ on the left, ] on the right.
    const bracketBg = (c, t = 2, arm = 7) => [
        `linear-gradient(${c}, ${c}) left top / ${t}px 100% no-repeat`, `linear-gradient(${c}, ${c}) left top / ${arm}px ${t}px no-repeat`,
        `linear-gradient(${c}, ${c}) left bottom / ${arm}px ${t}px no-repeat`, `linear-gradient(${c}, ${c}) right top / ${t}px 100% no-repeat`,
        `linear-gradient(${c}, ${c}) right top / ${arm}px ${t}px no-repeat`, `linear-gradient(${c}, ${c}) right bottom / ${arm}px ${t}px no-repeat`].join(', ');
    // A word as an SVG, squeezed to an exact width (system fonts differ too much to trust).
    const wordSvg = (txt, w, h, c, font, weight = 900, extra = '') => svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">`
        + `<text x="0" y="${(h * 0.86).toFixed(1)}" textLength="${w}" lengthAdjust="spacingAndGlyphs" font-family='${font}' font-weight="${weight}" font-size="${h}" fill="${c}" ${extra}>${txt}</text></svg>`);
    // Pupils that look at the pointer: every `sel` element is an eye, its <b> the iris.
    const lookAt = (sel, kx = 0.2, ky = 0.14) => (x, y) => {
        for (const e of document.querySelectorAll(sel)) {
            const r = e.getBoundingClientRect();
            if (!r.width) continue;
            const dx = x - (r.left + r.width / 2), dy = y - (r.top + r.height / 2), d = Math.hypot(dx, dy) || 1, k = Math.min(1, d / 160);
            e.style.setProperty('--dx', (dx / d * k * r.width * kx).toFixed(1) + 'px');
            e.style.setProperty('--dy', (dy / d * k * r.height * ky * 2).toFixed(1) + 'px');
        }
    };

    // ---- Die Ärzte ----
    const AE_ORANGE = '#ff4e00', AE_MAGENTA = '#c3099b';
    // The white of the bloodshot eye: pinkish corners, red veins creeping in from both sides.
    function veinsSvg(seed) {
        const r = seeded(seed);
        let s = '';
        for (let i = 0; i < 16; i++) {
            const left = r() < 0.5;
            let x = left ? 4 + r() * 30 : 196 - r() * 30, y = 30 + r() * 40, d = `M${x.toFixed(1)} ${y.toFixed(1)}`;
            const steps = 3 + Math.floor(r() * 4), w = (0.5 + r() * 1.1).toFixed(2);
            for (let k = 0; k < steps; k++) {
                x += (left ? 1 : -1) * (5 + r() * 9); y += (r() - 0.5) * 10;
                d += `L${x.toFixed(1)} ${y.toFixed(1)}`;
                if (r() < 0.35) s += `<path d="M${x.toFixed(1)} ${y.toFixed(1)}l${((left ? 1 : -1) * (3 + r() * 6)).toFixed(1)} ${((r() - 0.5) * 12).toFixed(1)}" stroke="#c0141c" stroke-width="${(w * 0.6).toFixed(2)}" fill="none" opacity=".7"/>`;
            }
            s += `<path d="${d}" stroke="#b3131b" stroke-width="${w}" fill="none" stroke-linecap="round" opacity=".8"/>`;
        }
        return svgUrl('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100" preserveAspectRatio="none"><defs>'
            + '<radialGradient id="w" cx=".5" cy=".5" r=".6"><stop offset=".45" stop-color="#f6f1ea"/><stop offset=".8" stop-color="#e9c9bd"/><stop offset="1" stop-color="#c98a7a"/></radialGradient></defs>'
            + `<rect width="200" height="100" fill="url(#w)"/>${s}</svg>`);
    }
    const AE_EYE = '<i class="mcfo-ae-eye"><b></b></i>';
    // The iris of the tour poster: rust red streaks, a black pupil with a golden crescent of light.
    const aeEyeCss = (S, fx, A) => `
        ${S} .mcfo-ae-eye { position: relative; display: block; flex: none; overflow: hidden; clip-path: ellipse(50% 40% at 50% 50%);
            background: url("${A.veins}") center / 100% 100% no-repeat; box-shadow: inset 0 0 12px rgba(90, 20, 15, 0.6); }
        ${S} .mcfo-ae-eye b { position: absolute; left: 50%; top: 50%; width: 42%; aspect-ratio: 1; border-radius: 50%;
            translate: calc(-50% + var(--dx, 0px)) calc(-50% + var(--dy, 0px)); transition: translate 0.12s ease-out;
            background: radial-gradient(circle, #0a0a0a 0 31%, transparent 32%), radial-gradient(circle, transparent 58%, rgba(40, 12, 10, 0.9) 70%),
                        repeating-conic-gradient(#8a2a1a 0 4deg, #c0502e 4deg 7deg, #5a1a12 7deg 10deg), #7a2414; }
        ${S} .mcfo-ae-eye b::after { content: ''; position: absolute; inset: 33%; border-radius: 50%; box-shadow: inset -2px 1px 0 #e8b64a; }
        ${S} .mcfo-ae-eye::after { content: ''; position: absolute; inset: 0; background: linear-gradient(180deg, rgba(60, 20, 15, 0.45), transparent 30%, transparent 75%, rgba(60, 20, 15, 0.35)); }
        ${fx(['full', 'subtle'], '.mcfo-ae-eye')} { animation: mcfoAeBlink 7s ease-in-out infinite; }
        @keyframes mcfoAeBlink { 0%, 94%, 100% { scale: 1 1; } 96.5% { scale: 1 0.06; } }`;
    // Pills: the doctors' band gets capsules, orange and magenta, tumbling through the footer.
    function pillDraw(g, p, now) {
        g.save(); g.translate(p.x, p.y); g.rotate(p.a + now / 1000 * p.spin); g.globalAlpha = 0.85;
        const l = p.s, w = p.s * 0.42;
        g.fillStyle = p.c1; g.beginPath(); g.arc(-l / 2 + w / 2, 0, w / 2, Math.PI / 2, Math.PI * 1.5); g.lineTo(0, -w / 2); g.lineTo(0, w / 2); g.fill();
        g.fillStyle = p.c2; g.beginPath(); g.arc(l / 2 - w / 2, 0, w / 2, -Math.PI / 2, Math.PI / 2); g.lineTo(0, w / 2); g.lineTo(0, -w / 2); g.fill();
        g.fillStyle = 'rgba(255, 255, 255, 0.45)'; g.fillRect(-l / 2 + w / 2, -w / 2 + 1.5, l - w, 1.4);
        g.restore();
    }

    // ---- Linkin Park ----
    const LP_YELLOW = '#f6d80a', LP_PINK = '#ff4f9a', LP_GREEN = '#36e27b';
    // A stencil dragonfly, sprayed in the rusty red of the early records.
    const dragonflySvg = c => svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 90"><g fill="${c}">`
        + '<path d="M62 24C44 12 16 10 6 17C0 22 8 30 26 31C40 32 54 29 62 27Z"/><path d="M78 24C96 12 124 10 134 17C140 22 132 30 114 31C100 32 86 29 78 27Z"/>'
        + '<path d="M62 33C46 36 22 44 16 52C12 58 22 60 36 55C48 50 58 42 62 36Z"/><path d="M78 33C94 36 118 44 124 52C128 58 118 60 104 55C92 50 82 42 78 36Z"/>'
        + '<circle cx="70" cy="17" r="6"/><ellipse cx="70" cy="31" rx="4.6" ry="8.5"/><path d="M68 41h4l-.6 46h-2.8z"/></g>'
        + '<g fill="none" stroke="rgba(255,240,220,.5)" stroke-width="1.1"><path d="M58 25C44 20 26 19 12 20M58 34C44 40 30 47 22 53M82 25C96 20 114 19 128 20M82 34C96 40 110 47 118 53"/></g>'
        + '<g fill="rgba(255,240,220,.35)"><rect x="68.6" y="50" width="2.8" height="1.4"/><rect x="68.6" y="58" width="2.8" height="1.4"/><rect x="68.6" y="66" width="2.8" height="1.4"/><rect x="68.6" y="74" width="2.8" height="1.4"/></g></svg>');
    function mistDraw(g, p, now) {
        const a = Math.max(0, Math.min(1, p.life)) * 0.55;
        glowDot(g, p.x, p.y, p.s * 2.4, p.c, a * 0.5);
        g.globalAlpha = a; g.fillStyle = `rgb(${p.c})`; g.beginPath(); g.arc(p.x, p.y, p.s * 0.45, 0, Math.PI * 2); g.fill();
    }

    Object.assign(SKINS, {
        // ---- Die Ärzte: HELL and DUNKEL, and the eye of the next tour ----
        // Everything splits in two along one diagonal: white with fat orange letters, black with
        // magenta. The chat opens under a bloodshot eye that follows your pointer and blinks.
        aerzte: deluxe({
            assets: () => ({
                veins: veinsSvg(2027),
                hell: wordSvg('HELL', 84, 30, AE_ORANGE, HEAVY_FONT), dunkel: wordSvg('DUNKEL', 118, 30, AE_MAGENTA, HEAVY_FONT),
                bigHell: wordSvg('HELL', 440, 110, 'rgba(255, 78, 0, 0.22)', HEAVY_FONT), bigDunkel: wordSvg('DUNKEL', 640, 110, 'rgba(195, 9, 155, 0.3)', HEAVY_FONT),
            }),
            kit: A => ({
                titleCss: `font-family: ${HEAVY_FONT}; font-weight: 900; letter-spacing: -0.02em; text-transform: lowercase;`,
                ground: `url("${A.bigHell}") 2% 70px / 420px 104px no-repeat, url("${A.bigDunkel}") 72% calc(100% - 66px) / 610px 104px no-repeat, linear-gradient(115deg, #f4f1ec 0 50%, #0d0d0d 50.05%)`,
                header: { bg: 'linear-gradient(90deg, #ffffff 0 50%, #111111 50%)', border: `4px solid ${AE_ORANGE}`, extra: `box-shadow: 0 4px 0 ${AE_MAGENTA} !important;` },
                cards: { bg: '#111111', border: '2px solid #111111', radius: '0', shadow: `3px 3px 0 ${AE_ORANGE}` },
                footer: { bg: 'linear-gradient(180deg, rgba(0, 0, 0, 0.35), rgba(0, 0, 0, 0.2)), repeating-linear-gradient(115deg, #c8102e 0 16px, #ffffff 16px 24px, #1f8a7a 24px 40px, #ffffff 40px 48px)',
                          border: '4px solid #111111', extra: 'isolation: isolate;' },
                chat: {
                    bg: '#fbfaf7', border: '3px solid #111111', radius: '0', pad: '92px 0 0', shadow: `6px 6px 0 ${AE_MAGENTA}`,
                    head: '#111111', headBorder: `4px solid ${AE_ORANGE}`, headText: '#ffffff',
                    body: 'transparent', comp: '#efece5', compBorder: '3px solid #111111',
                    input: { bg: '#ffffff', border: '2px solid #111111', color: '#111111', radius: '0', hint: '#8a7f7a' },
                },
                btn: { bg: '#111111', color: '#ffffff', border: '0', radius: '0', shadow: `3px 3px 0 ${AE_ORANGE}`,
                       hover: `background: ${AE_MAGENTA} !important; box-shadow: 3px 3px 0 ${AE_ORANGE} !important;`,
                       extra: `font-family: ${HEAVY_FONT}; font-weight: 900; text-transform: uppercase; letter-spacing: 0;` },
                filled: { radius: '0', border: '2px solid #111111', shadow: '3px 3px 0 #111111' },
                popup: { bg: '#111111', border: `2px solid ${AE_ORANGE}`, radius: '0', hover: 'rgba(195, 9, 155, 0.5)', head: AE_ORANGE, shadow: `6px 6px 0 ${AE_MAGENTA}` },
                win: { border: '3px solid #111111', radius: '0', shadow: `8px 8px 0 ${AE_ORANGE}`, head: 'linear-gradient(90deg, #ffffff 0 50%, #111111 50%)', headBorder: `3px solid ${AE_MAGENTA}`, title: AE_ORANGE },
                panel: { radius: '0', border: '#444444', pressed: AE_ORANGE },
            }),
            extra: (S, A, fx) => lightChatCss(S, '#111111', '#7a6a66') + aeEyeCss(S, fx, A) + `
                ${S} .mcf-chat__header .mcf-chat__title strong { color: ${AE_ORANGE} !important; }
                ${S} .mcf-chat__header .mcf-chat__status { color: #bbbbbb !important; }
                ${S} .mcf-chat__send { background: ${AE_ORANGE} !important; color: #111111 !important; border-radius: 0 !important; font-weight: 900 !important; }
                ${S} [data-role="action-region"] > .mcfo-skin-canvas { z-index: -1; }
                ${S} .mcfo-ae-lid { position: absolute; top: 0; left: 0; right: 0; height: 92px; pointer-events: none; overflow: hidden;
                    background: radial-gradient(ellipse at 50% 50%, #7a3a2a, #3a1610 70%, #1a0a08); border-bottom: 3px solid #111111; }
                ${S} .mcfo-ae-lid .mcfo-ae-eye { position: absolute; left: 50%; top: 50%; width: 170px; height: 84px; transform: translate(-50%, -50%); }
                ${S} .mcfo-ae-top { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); display: flex; align-items: center; gap: 10px; pointer-events: none; }
                ${S} .mcfo-ae-top > span { display: block; height: 26px; background: center / 100% 100% no-repeat; }
                ${S} .mcfo-ae-top > span:first-child { width: 72px; background-image: url("${A.hell}"); }
                ${S} .mcfo-ae-top > span:last-child { width: 102px; background-image: url("${A.dunkel}"); }
                ${S} .mcfo-ae-top .mcfo-ae-eye { width: 64px; height: 34px; outline: 2px solid #111111; }`,
            decor: [
                { cls: 'mcfo-ae-lid', host: () => document.querySelector('.mcf-chat'), html: AE_EYE },
                { cls: 'mcfo-ae-top', host: () => role('top-status-region'), html: `<span></span>${AE_EYE}<span></span>` },
            ],
            pointer: lookAt('.mcfo-ae-eye'),
            particles: [
                drifters('pills', () => role('action-region'), 9,
                    (w, h, any) => ({ x: any ? rnd(0, w) : -20, y: rnd(10, h - 10), v: rnd(18, 40), a: rnd(0, 6), spin: rnd(-1.6, 1.6), s: rnd(12, 18),
                                      c1: pickOf(Math.random, [AE_ORANGE, AE_MAGENTA, '#ffffff']), c2: pickOf(Math.random, [AE_MAGENTA, '#111111', AE_ORANGE]) }),
                    (p, dt, now, w, h) => { p.x += p.v * dt; p.y += Math.sin(now / 600 + p.a) * 8 * dt; return p.x < w + 20; },
                    pillDraw),
            ],
            tile: A => `background: radial-gradient(circle at 50% 50%, #0a0a0a 0 4px, #8a2a1a 5px 9px, transparent 10px), radial-gradient(24px 12px at 50% 50%, #f6f1ea 96%, transparent 100%),
                        linear-gradient(115deg, ${AE_ORANGE} 0 50%, ${AE_MAGENTA} 50%); box-shadow: inset 0 0 0 2px #111111;`,
        }),

        // ---- Linkin Park: sepia concrete and spray paint, then black, white and yellow ----
        // Two eras in one: the ground is a weathered wall with a stencil sprayed on it, pink and
        // green paint everywhere; the chat and the frames are the stark black and yellow of now,
        // and every button sits in [brackets].
        lpark: deluxe({
            assets: () => ({
                splat: splatSvg(2000, 520, 380, [LP_PINK, LP_GREEN, LP_PINK], 12, 0.5), splatDark: splatSvg(2024, 360, 120, [LP_PINK, LP_GREEN], 7, 0.35),
                drips: dripSvg(8, 300, 40, [LP_PINK, LP_GREEN, LP_YELLOW]), fly: dragonflySvg('#6a1c16'), flyLight: dragonflySvg('rgba(20, 16, 12, 0.55)'), grain: grainSvg(0.16),
            }),
            kit: A => ({
                titleCss: `font-family: ${CONDENSED_FONT}; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em;`,
                ground: `url("${A.flyLight}") 50% 44% / 38vmin auto no-repeat, url("${A.splat}") 0 0 / 520px 380px, url("${A.grain}") 0 0 / 180px 180px,
                         radial-gradient(ellipse at 50% 40%, #857c68, #5a5344 70%, #3a352c)`,
                header: { bg: `url("${A.splatDark}") 0 0 / 360px 100% repeat-x, #0b0b0b`, border: `3px solid ${LP_YELLOW}` },
                cards: { bg: `${bracketBg(LP_YELLOW)}, #0b0b0b`, border: '0', radius: '0', shadow: 'none' },
                footer: { bg: `url("${A.drips}") 0 0 / 300px 40px repeat-x, #0b0b0b`, border: `3px solid ${LP_YELLOW}`, extra: 'isolation: isolate;' },
                chat: {
                    bg: `url("${A.splatDark}") 0 100% / 360px 120px repeat-x, #0e0e0e`, border: `2px solid ${LP_YELLOW}`, radius: '0', pad: '70px 0 0',
                    head: LP_YELLOW, headBorder: '0', headText: '#0b0b0b',
                    body: 'transparent', comp: '#0b0b0b', compBorder: `2px solid ${LP_YELLOW}`,
                    input: { bg: '#161616', border: '1px solid #444444', color: '#ffffff', radius: '0', hint: '#8a8a8a' },
                },
                btn: { bg: `${bracketBg('#ffffff')}, #0b0b0b`, color: '#ffffff', border: '0', radius: '0', shadow: 'none',
                       hover: `color: ${LP_YELLOW} !important; background: ${bracketBg(LP_YELLOW)}, #0b0b0b !important;`,
                       extra: `font-family: ${CONDENSED_FONT}; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em;` },
                filled: { radius: '0', border: '0', shadow: 'inset 0 -3px 0 rgba(0, 0, 0, 0.35)' },
                popup: { bg: '#0b0b0b', border: `2px solid ${LP_YELLOW}`, radius: '0', hover: 'rgba(255, 79, 154, 0.3)', head: LP_YELLOW, shadow: '0 12px 30px rgba(0, 0, 0, 0.7)' },
                win: { border: `2px solid ${LP_YELLOW}`, radius: '0', shadow: '0 16px 40px rgba(0, 0, 0, 0.7)', head: LP_YELLOW, headBorder: '0', title: '#0b0b0b' },
                panel: { radius: '0', border: '#555555', pressed: LP_YELLOW },
            }),
            extra: (S, A, fx) => `
                ${S} .mcf-chat__header :is(.mcf-chat__status, .mcf-chat__room) { color: #3a3200 !important; }
                ${S} .mcf-chat__header button { background: ${bracketBg('#0b0b0b')}, transparent !important; color: #0b0b0b !important; box-shadow: none !important; }
                ${S} .mcf-chat__send { background: ${bracketBg('#0b0b0b')}, ${LP_YELLOW} !important; color: #0b0b0b !important; border-radius: 0 !important; }
                ${S} [data-role="action-region"] > .mcfo-skin-canvas { z-index: -1; }
                ${S} .mcfo-lp-wall { position: absolute; top: 0; left: 0; right: 0; height: 70px; pointer-events: none; overflow: hidden;
                    background: url("${A.splat}") 30% 40% / 300px 220px, url("${A.grain}") 0 0 / 180px 180px, linear-gradient(180deg, #9a917b, #6f6857); border-bottom: 2px solid ${LP_YELLOW}; }
                ${S} .mcfo-lp-wall i { position: absolute; left: 50%; top: 50%; width: 112px; height: 66px; transform: translate(-50%, -50%) rotate(-4deg); background: url("${A.fly}") center / contain no-repeat; }
                ${fx(['full', 'subtle'], '.mcfo-lp-wall i')} { animation: mcfoLpHover 4s ease-in-out infinite alternate; }
                @keyframes mcfoLpHover { to { transform: translate(-50%, -58%) rotate(3deg); } }
                ${S} .mcfo-lp-tag { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); pointer-events: none; white-space: nowrap; padding: 3px 14px;
                    background: ${bracketBg(LP_YELLOW, 3, 9)}; font: 700 20px/1.1 ${CONDENSED_FONT}; letter-spacing: 0.12em; text-transform: uppercase; color: #ffffff; }`,
            decor: [
                { cls: 'mcfo-lp-wall', host: () => document.querySelector('.mcf-chat'), html: '<i></i>' },
                { cls: 'mcfo-lp-tag', host: () => role('top-status-region'), html: 'from the ground up' },
            ],
            particles: [
                // Spray mist from a can somewhere off to the left, drifting across the footer.
                drifters('mist', () => role('action-region'), 26,
                    (w, h, any) => ({ x: any ? rnd(0, w) : rnd(-30, 0), y: rnd(6, h - 6), v: rnd(20, 55), s: rnd(1.5, 4), life: any ? rnd(0.3, 1) : 1,
                                      c: pickOf(Math.random, ['255, 79, 154', '54, 226, 123', '246, 216, 10']) }),
                    (p, dt, now, w) => { p.x += p.v * dt; p.y += Math.sin(now / 500 + p.x / 40) * 4 * dt; p.life -= dt * 0.08; return p.x < w + 10 && p.life > 0; },
                    mistDraw),
            ],
            tile: A => `background: url("${A.fly}") 50% 50% / 44px 30px no-repeat, url("${A.splat}") 0 0 / 180px 130px, ${bracketBg(LP_YELLOW, 3, 8)}, #6f6857;
                        box-shadow: inset 0 0 0 1px #0b0b0b;`,
        }),
    });

    // ---- Kraftklub ----
    const KK_RED = '#e2231a', KK_YELLOW = '#ffd400', KK_BLUE = '#2a5caa';
    // The stripes of the cuffs and the jacket: black, red, white, grey, blue.
    const KK_STRIPES = `repeating-linear-gradient(180deg, #111111 0 6px, ${KK_RED} 6px 12px, #f4f4f0 12px 16px, #8a8a8a 16px 20px, ${KK_BLUE} 20px 26px)`;
    // A pen-drawn face around the eyes: a few black contour lines on red.
    const faceLinesSvg = () => svgUrl('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 96" preserveAspectRatio="none"><g fill="none" stroke="#111111" stroke-width="2.2" stroke-linecap="round">'
        + '<path d="M40 30C60 12 100 10 120 24"/><path d="M180 24C200 10 240 12 260 30"/><path d="M48 70C70 84 104 84 122 72"/><path d="M178 72C196 84 230 84 252 70"/>'
        + '<path d="M150 30C146 50 142 62 134 74M150 30C154 50 158 62 166 74" stroke-width="1.6"/><path d="M20 50C24 70 30 84 40 92M280 50C276 70 270 84 260 92" stroke-width="1.6"/>'
        + '<path d="M60 90C62 84 70 82 76 86M224 86C230 82 238 84 240 90" stroke-width="1.4"/></g></svg>');
    // A yellow ticket: notches on both short sides, a dashed tear line near the stub.
    const ticketBg = (c = KK_YELLOW) => `radial-gradient(circle at 0 50%, transparent 5px, ${c} 5.5px) left / 51% 100% no-repeat, radial-gradient(circle at 100% 50%, transparent 5px, ${c} 5.5px) right / 51% 100% no-repeat`;
    const KK_EYE = '<i class="mcfo-kk-eye"><b></b></i>';
    function ticketDraw(g, p, now) {
        g.save(); g.translate(p.x, p.y); g.rotate(p.a + Math.sin(now / 900 + p.ph) * 0.5); g.globalAlpha = 0.9;
        const w = p.s * 1.9, h = p.s;
        g.fillStyle = KK_YELLOW; g.fillRect(-w / 2, -h / 2, w, h);
        g.globalCompositeOperation = 'destination-out';
        g.beginPath(); g.arc(-w / 2, 0, h * 0.22, 0, Math.PI * 2); g.arc(w / 2, 0, h * 0.22, 0, Math.PI * 2); g.fill();
        g.globalCompositeOperation = 'source-over';
        g.fillStyle = '#111111'; g.fillRect(w * 0.18, -h / 2 + 2, 1, h - 4); g.fillRect(-w / 2 + 4, -h * 0.12, w * 0.5, 2); g.fillRect(-w / 2 + 4, h * 0.12, w * 0.34, 1.5);
        g.restore();
    }

    // ---- Goethes Erben ----
    const GE_CYAN = '140, 225, 255';
    // A white figure without a face: a head, shoulders, a torso, lit from one side.
    const figureSvg = (lit = '#eaf6ff', dark = '#6f9fc0') => svgUrl('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 70"><defs>'
        + `<linearGradient id="f" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${dark}"/><stop offset=".55" stop-color="${lit}"/><stop offset="1" stop-color="${dark}"/></linearGradient></defs>`
        + '<g fill="url(#f)"><ellipse cx="20" cy="10" rx="6.6" ry="8.2"/><path d="M17 17h6l1 4h-8z"/><path d="M8 24C12 20 28 20 32 24L36 36C37 48 33 60 31 70H9C7 60 3 48 4 36Z"/></g></svg>');
    // Lines of our own, cycling on the stage.
    const GE_LINES = ['Wer spricht, wenn alle schweigen?', 'Das Licht fällt, und keiner fängt es.', 'Wir tragen Masken aus Stille.'];
    function moteDraw(g, p, now) {
        const a = 0.25 + 0.35 * Math.sin(now / 900 + p.ph) ** 2;
        glowDot(g, p.x, p.y, p.s * 3, GE_CYAN, a * 0.5);
        g.globalAlpha = a; g.fillStyle = '#e6f8ff'; g.beginPath(); g.arc(p.x, p.y, p.s * 0.5, 0, Math.PI * 2); g.fill();
    }

    Object.assign(SKINS, {
        // ---- Kraftklub: black, white and red, stripes, yellow tickets, matchstick eyes ----
        // The chat opens under a pen-drawn face with two wide eyes, a matchstick for a pupil,
        // looking wherever your pointer goes. The buttons are tickets, the footer the stripes.
        kraftklub: deluxe({
            assets: () => ({ face: faceLinesSvg(), grain: grainSvg(0.1) }),
            kit: A => ({
                titleCss: `font-family: ${HEAVY_FONT}; font-weight: 900; text-transform: uppercase; letter-spacing: 0.06em;`,
                ground: `radial-gradient(circle, rgba(0, 0, 0, 0.13) 0 1.3px, transparent 1.8px) 0 0 / 9px 9px, radial-gradient(ellipse at 50% 45%, #ea2c20, #c81a12 70%, #9a120c)`,
                header: { bg: `${KK_STRIPES} 0 100% / 100% 8px no-repeat, #f4f4f0`, border: '3px solid #111111' },
                cards: { bg: '#111111', border: '2px solid #111111', radius: '0', shadow: `3px 3px 0 ${KK_RED}` },
                footer: { bg: `linear-gradient(180deg, rgba(0, 0, 0, 0.45), rgba(0, 0, 0, 0.25)), ${KK_STRIPES}`, border: '3px solid #111111', extra: 'isolation: isolate;' },
                chat: {
                    bg: `url("${A.grain}") 0 0 / 180px 180px, #fbfbf8`, border: '3px solid #111111', radius: '0', pad: '96px 0 0', shadow: '6px 6px 0 #111111',
                    head: '#111111', headBorder: `4px solid ${KK_RED}`, headText: '#ffffff',
                    body: 'transparent', comp: '#f0f0ea', compBorder: '3px solid #111111',
                    input: { bg: '#ffffff', border: '2px solid #111111', color: '#111111', radius: '0', hint: '#888888' },
                },
                btn: { bg: ticketBg(), color: '#111111', border: '0', radius: '2px', shadow: 'none',
                       hover: 'filter: brightness(1.08) drop-shadow(0 0 6px rgba(255, 212, 0, 0.7));',
                       extra: `font-family: ${HEAVY_FONT}; font-weight: 900; text-transform: uppercase; letter-spacing: 0.04em; padding-inline: 12px;` },
                filled: { radius: '2px', border: '2px solid #111111', shadow: '2px 2px 0 #111111' },
                popup: { bg: '#111111', border: `2px solid ${KK_YELLOW}`, radius: '0', hover: 'rgba(226, 35, 26, 0.55)', head: KK_YELLOW, shadow: `6px 6px 0 ${KK_RED}` },
                win: { border: '3px solid #111111', radius: '0', shadow: '8px 8px 0 #111111', head: KK_RED, headBorder: '3px solid #111111', title: '#ffffff' },
                panel: { radius: '0', border: '#555555', pressed: KK_YELLOW },
            }),
            extra: (S, A, fx) => lightChatCss(S, '#111111', '#777777') + `
                ${S} .mcf-chat__header .mcf-chat__status { color: #bbbbbb !important; }
                ${S} .mcf-chat__header button { background: #f4f4f0 !important; color: #111111 !important; border-radius: 0 !important; }
                ${S} .mcf-chat__send { background: ${ticketBg()} !important; color: #111111 !important; font-weight: 900 !important; }
                ${S} [data-role="action-region"] > .mcfo-skin-canvas { z-index: -1; }
                ${S} .mcfo-kk-face { position: absolute; top: 0; left: 0; right: 0; height: 96px; pointer-events: none; overflow: hidden;
                    background: url("${A.face}") center / 100% 100% no-repeat, ${KK_RED}; border-bottom: 3px solid #111111;
                    display: flex; align-items: center; justify-content: center; gap: 34px; }
                ${S} .mcfo-kk-eye { position: relative; display: block; flex: none; width: 74px; height: 40px; border-radius: 50%; background: #ffffff; border: 3px solid #111111; }
                ${S} .mcfo-kk-eye b { position: absolute; left: 50%; top: 50%; width: 38px; height: 38px; border-radius: 50%;
                    translate: calc(-50% + var(--dx, 0px)) calc(-50% + var(--dy, 0px)); transition: translate 0.12s ease-out;
                    background: radial-gradient(circle, transparent 0 58%, #111111 60% 66%, transparent 68%), radial-gradient(circle, #dbe7ee, #a9c2d0); clip-path: circle(50%); }
                                ${S} .mcfo-kk-eye::after { content: ''; position: absolute; left: 50%; top: 50%; width: 7px; height: 60px; border-radius: 4px 4px 1px 1px; filter: drop-shadow(0 0 0.6px #111111) drop-shadow(0 0 0.6px #111111);
                    translate: calc(-50% + var(--dx, 0px)) calc(-50% + var(--dy, 0px)); transition: translate 0.12s ease-out;
                    background: radial-gradient(ellipse 4.6px 6.4px at 50% 6.5px, #c0281e 0 70%, #5a0e0a 72% 88%, transparent 92%), linear-gradient(180deg, transparent 0 11px, #efe6d2 11px); box-shadow: none; }
                                ${S} .mcfo-kk-ticket { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%) rotate(-2deg); pointer-events: none; white-space: nowrap;
                    padding: 4px 20px 4px 26px; background: ${ticketBg()}; color: #111111; font: 900 15px/1.2 ${HEAVY_FONT}; letter-spacing: 0.08em; text-transform: uppercase; }
                ${S} .mcfo-kk-ticket::before { content: ''; position: absolute; left: 16px; top: 3px; bottom: 3px; border-left: 1.5px dashed #111111; }`,
            decor: [
                { cls: 'mcfo-kk-face', host: () => document.querySelector('.mcf-chat'), html: KK_EYE + KK_EYE },
                { cls: 'mcfo-kk-ticket', host: () => role('top-status-region'), html: 'Einlass 19:00 · Chemnitz' },
            ],
            pointer: lookAt('.mcfo-kk-eye', 0.16, 0.1),
            particles: [
                drifters('tickets', () => role('action-region'), 8,
                    (w, h, any) => ({ x: rnd(10, w - 10), y: any ? rnd(0, h) : h + 16, v: rnd(10, 22), a: rnd(-0.6, 0.6), ph: rnd(0, 6), s: rnd(10, 15) }),
                    (p, dt, now) => { p.y -= p.v * dt; p.x += Math.sin(now / 700 + p.ph) * 14 * dt; return p.y > -16; },
                    ticketDraw),
            ],
            tile: A => `background: radial-gradient(circle at 20% 55%, #a9c2d0 0 5px, #111111 5.5px 7px, transparent 7.5px), radial-gradient(circle at 44% 55%, #a9c2d0 0 5px, #111111 5.5px 7px, transparent 7.5px),
                        radial-gradient(15px 9px at 20% 55%, #ffffff 90%, #111111 92% 100%, transparent 102%), radial-gradient(15px 9px at 44% 55%, #ffffff 90%, #111111 92% 100%, transparent 102%),
                        ${KK_STRIPES} 0 100% / 100% 10px no-repeat, ${KK_RED}; box-shadow: inset 0 0 0 2px #111111;`,
        }),

        // ---- Goethes Erben: a dark theatre, cyan light, faceless white figures ----
        // Light falls in cones from the corners of the stage onto figures without faces; a line of
        // verse (our own) fades in and out above it all. Dust drifts in the light of the footlights.
        goethe: deluxe({
            assets: () => ({ fig: figureSvg(), figDim: figureSvg('#9cc6e4', '#2c4f6e') }),
            kit: A => {
                const rays = (at, from) => `repeating-conic-gradient(from ${from}deg at ${at}, rgba(${GE_CYAN}, 0.11) 0 1.6deg, transparent 1.6deg 5deg)`;
                return {
                    titleCss: `font-family: ${BOOK_SERIF}; font-weight: 700; letter-spacing: 0.04em;`,
                    ground: `radial-gradient(circle at 12% 104%, rgba(${GE_CYAN}, 0.35), transparent 14%), radial-gradient(circle at 88% -4%, rgba(${GE_CYAN}, 0.25), transparent 12%),
                             radial-gradient(circle at 12% 104%, transparent 0, rgba(3, 9, 22, 0.25) 45%, rgba(3, 9, 22, 0.9) 85%), ${rays('12% 104%', 0)},
                             radial-gradient(circle at 88% -4%, transparent 0, rgba(3, 9, 22, 0.4) 40%, rgba(3, 9, 22, 0.95) 80%), ${rays('88% -4%', 2)},
                             radial-gradient(ellipse at 50% 50%, #0b1e44, #050d1f 70%, #02060f)`,
                    header: { bg: 'linear-gradient(180deg, #02060f, #071430)', border: `1px solid rgba(${GE_CYAN}, 0.6)`, extra: `box-shadow: 0 0 18px rgba(${GE_CYAN}, 0.18) !important;` },
                    cards: { bg: 'rgba(3, 9, 22, 0.85)', border: `1px solid rgba(${GE_CYAN}, 0.45)`, radius: '0', shadow: `0 0 10px rgba(${GE_CYAN}, 0.15)` },
                    footer: { bg: `radial-gradient(ellipse at 50% 0, rgba(${GE_CYAN}, 0.22), transparent 60%), repeating-linear-gradient(90deg, rgba(0, 0, 0, 0.35) 0 1px, transparent 1px 90px), linear-gradient(180deg, #0c1c38, #040a18)`,
                              border: `1px solid rgba(${GE_CYAN}, 0.6)`, extra: 'isolation: isolate;' },
                    chat: {
                        bg: `radial-gradient(ellipse at 50% 0, rgba(${GE_CYAN}, 0.16), transparent 55%), linear-gradient(180deg, #071430, #040a18)`, border: `1px solid rgba(${GE_CYAN}, 0.55)`, radius: '0', pad: '96px 0 0',
                        shadow: `0 0 24px rgba(${GE_CYAN}, 0.12)`,
                        head: '#02060f', headBorder: `1px solid rgba(${GE_CYAN}, 0.5)`, headText: '#e8f4ff',
                        body: 'transparent', comp: '#02060f', compBorder: `1px solid rgba(${GE_CYAN}, 0.4)`,
                        input: { bg: '#050d1f', border: `1px solid rgba(${GE_CYAN}, 0.35)`, color: '#e8f4ff', radius: '0', hint: '#6f8aa8' },
                    },
                    btn: { bg: '#02060f', color: '#dff3ff', border: `1px solid rgba(${GE_CYAN}, 0.6)`, radius: '0', shadow: `0 0 10px rgba(${GE_CYAN}, 0.18)`,
                           hover: `box-shadow: 0 0 16px rgba(${GE_CYAN}, 0.6) !important; color: #ffffff !important;`,
                           extra: `font-family: ${BOOK_SERIF}; font-weight: 700; font-variant: small-caps; letter-spacing: 0.1em;` },
                    filled: { radius: '0', border: `1px solid rgba(${GE_CYAN}, 0.7)`, shadow: `0 0 8px rgba(${GE_CYAN}, 0.25)` },
                    popup: { bg: '#030a1a', border: `1px solid rgba(${GE_CYAN}, 0.6)`, radius: '0', hover: `rgba(${GE_CYAN}, 0.14)`, head: '#bfeaff', shadow: '0 12px 30px rgba(0, 0, 0, 0.7)' },
                    win: { border: `1px solid rgba(${GE_CYAN}, 0.6)`, radius: '0', shadow: `0 0 30px rgba(${GE_CYAN}, 0.15), 0 16px 40px rgba(0, 0, 0, 0.7)`, head: 'linear-gradient(180deg, #02060f, #071430)',
                           headBorder: `1px solid rgba(${GE_CYAN}, 0.5)`, title: '#e8f4ff' },
                    panel: { radius: '0', border: '#2c4f6e', pressed: '#8ce1ff' },
                };
            },
            extra: (S, A, fx) => `
                ${S} [data-role="action-region"] > .mcfo-skin-canvas { z-index: -1; }
                ${S} .mcfo-ge-stage { position: absolute; top: 0; left: 0; right: 0; height: 96px; pointer-events: none; overflow: hidden;
                    background: radial-gradient(ellipse at 50% 100%, rgba(${GE_CYAN}, 0.3), transparent 60%), #02060f; border-bottom: 1px solid rgba(${GE_CYAN}, 0.5); }
                ${S} .mcfo-ge-stage::before { content: ''; position: absolute; left: 50%; top: -10px; width: 180px; height: 120px; translate: -50% 0;
                    background: linear-gradient(180deg, rgba(${GE_CYAN}, 0.42), rgba(${GE_CYAN}, 0.05)); clip-path: polygon(44% 0, 56% 0, 100% 100%, 0 100%); }
                ${fx(['full', 'subtle'], '.mcfo-ge-stage::before')} { animation: mcfoGeSweep 9s ease-in-out infinite alternate; }
                @keyframes mcfoGeSweep { from { rotate: -14deg; } to { rotate: 14deg; } }
                ${S} .mcfo-ge-stage i { position: absolute; bottom: 0; width: 34px; height: 60px; background: url("${A.figDim}") center bottom / contain no-repeat; }
                ${S} .mcfo-ge-stage i:nth-child(1) { left: 18%; height: 52px; } ${S} .mcfo-ge-stage i:nth-child(3) { right: 18%; height: 54px; }
                ${S} .mcfo-ge-stage i:nth-child(2) { left: 50%; translate: -50% 0; width: 42px; height: 74px; background-image: url("${A.fig}"); filter: drop-shadow(0 0 8px rgba(${GE_CYAN}, 0.6)); }
                ${S} .mcfo-ge-verse { position: absolute; left: 50%; top: 50%; width: 360px; height: 30px; transform: translate(-50%, -50%); pointer-events: none; }
                ${S} .mcfo-ge-verse span { position: absolute; inset: 0; text-align: center; white-space: nowrap; opacity: 0;
                    font: italic 400 19px/30px ${BOOK_SERIF}; color: #e8f4ff; text-shadow: 0 0 10px rgba(${GE_CYAN}, 0.8); }
                ${S} .mcfo-ge-verse span:first-child { opacity: 1; }
                ${fx(['full', 'subtle'], '.mcfo-ge-verse span')} { opacity: 0; animation: mcfoGeVerse 18s ease-in-out infinite; }
                ${fx(['full', 'subtle'], '.mcfo-ge-verse span:nth-child(2)')} { animation-delay: 6s; }
                ${fx(['full', 'subtle'], '.mcfo-ge-verse span:nth-child(3)')} { animation-delay: 12s; }
                @keyframes mcfoGeVerse { 0% { opacity: 0; } 6%, 28% { opacity: 1; } 34%, 100% { opacity: 0; } }`,
            decor: [
                { cls: 'mcfo-ge-stage', host: () => document.querySelector('.mcf-chat'), html: '<i></i><i></i><i></i>' },
                { cls: 'mcfo-ge-verse', host: () => role('top-status-region'), html: GE_LINES.map(l => `<span>${l}</span>`).join('') },
            ],
            particles: [
                drifters('motes', () => role('action-region'), 22,
                    (w, h, any) => ({ x: rnd(0, w), y: any ? rnd(0, h) : h + 4, v: rnd(3, 9), ph: rnd(0, 6), s: rnd(1, 2.4) }),
                    (p, dt, now) => { p.y -= p.v * dt; p.x += Math.sin(now / 1500 + p.ph) * 5 * dt; return p.y > -6; },
                    moteDraw),
            ],
            tile: A => `background: url("${A.fig}") 50% 100% / 18px 32px no-repeat, linear-gradient(180deg, rgba(${GE_CYAN}, 0.35), transparent) 50% 0 / 30px 100% no-repeat,
                        radial-gradient(ellipse at 50% 100%, rgba(${GE_CYAN}, 0.3), transparent 60%), #050d1f; box-shadow: inset 0 0 0 1px rgba(${GE_CYAN}, 0.6);`,
        }),
    });

    // ---- Samsas Traum ----
    const ST_PAPER = '#e6dcc2', ST_INK = '#14110e', ST_BRASS = '#8a7a58';
    const ST_HATCH = 'repeating-linear-gradient(45deg, rgba(233, 225, 204, 0.045) 0 1px, transparent 1px 6px), repeating-linear-gradient(-45deg, rgba(233, 225, 204, 0.03) 0 1px, transparent 1px 7px)';
    // A beetle seen from above, drawn in ink, legs in two tripods so it can walk (Kafka's Gregor).
    const BEETLE_SVG = '<svg viewBox="-2 -4 66 48"><g stroke="#14110e" stroke-width="1.6" stroke-linecap="round" fill="none">'
        + '<g class="ga"><path d="M40 13L46 5L51 3"/><path d="M22 11L16 3L11 1"/><path d="M31 30L31 38L35 41"/></g>'
        + '<g class="gb"><path d="M31 10L31 2L35 -1"/><path d="M40 27L46 35L51 37"/><path d="M22 29L16 37L11 39"/></g>'
        + '<path d="M54 18Q60 10 59 3M54 22Q60 30 59 37" stroke-width="1.1"/></g>'
        + '<ellipse cx="26" cy="20" rx="16" ry="11" fill="#2a2016" stroke="#14110e" stroke-width="1.2"/>'
        + '<g stroke="rgba(233,225,204,.28)" stroke-width=".7" fill="none"><path d="M12 20H42"/><path d="M14 14Q26 11 40 14M14 26Q26 29 40 26M17 11Q26 9 36 11M17 29Q26 31 36 29"/></g>'
        + '<ellipse cx="44" cy="20" rx="6" ry="8" fill="#1e1710" stroke="#14110e"/><circle cx="52" cy="20" r="3.6" fill="#14110e"/></svg>';
    const CANDLE = '<i class="mcfo-st-candle"><b></b></i>';
    function bubbleDraw(g, p, now) {
        g.globalAlpha = 0.55; g.strokeStyle = '#b9d6e6'; g.lineWidth = 1;
        g.beginPath(); g.arc(p.x + Math.sin(now / 500 + p.ph) * 2, p.y, p.s, 0, Math.PI * 2); g.stroke();
        g.globalAlpha = 0.5; g.fillStyle = '#e6f4ff'; g.beginPath(); g.arc(p.x - p.s * 0.35, p.y - p.s * 0.35, p.s * 0.25, 0, Math.PI * 2); g.fill();
    }

    // ---- Prinz Pi ----
    const PP_LILA = '#674E85', PP_DEEP = '#22194F', PP_LIGHT = '#b7a6d6', PP_CREAM = '#efe9f7';
    // A compass with no north: E, S and W are there (O, S, W in German), the top stays empty and the
    // needle keeps swinging without ever settling.
    const COMPASS_SVG = '<svg viewBox="-24 -24 48 48"><circle r="21" fill="#22194F" stroke="#efe9f7" stroke-width="1.5"/><circle r="17" fill="none" stroke="rgba(239,233,247,.35)" stroke-width=".8"/>'
        + '<g stroke="#efe9f7" stroke-width="1"><path d="M17 0h3M-17 0h-3M0 17v3"/><path d="M12 12l2 2M-12 12l-2 2M12 -12l2 -2M-12 -12l-2 -2" stroke-width=".7"/></g>'
        + '<g fill="#efe9f7" font-family="Georgia, serif" font-size="8" font-weight="700" text-anchor="middle"><text x="11.5" y="2.8">O</text><text x="0" y="15">S</text><text x="-11.5" y="2.8">W</text></g>'
        + '<g class="mcfo-pp-needle"><path d="M0 -15L3.6 0L0 15L-3.6 0Z" fill="#efe9f7"/><path d="M0 -15L3.6 0H-3.6Z" fill="#c24b6e"/><circle r="1.6" fill="#22194F"/></g></svg>';
    // A record: grooves, a lilac label, the spindle hole.
    const vinylBg = (label = PP_LILA) => `radial-gradient(circle, #0c0a12 0 3%, ${label} 3.5% 30%, #1a1426 31% 33%, transparent 33.5%),
        repeating-radial-gradient(circle, #141018 0 1.2px, #221c2c 1.2px 2.6px), #141018`;
    function noteDraw(g, p, now) {
        g.save(); g.translate(p.x, p.y); g.rotate(Math.sin(now / 800 + p.ph) * 0.25); g.globalAlpha = 0.75;
        g.fillStyle = p.c; g.strokeStyle = p.c; g.lineWidth = 1.4;
        g.beginPath(); g.ellipse(0, 0, p.s * 0.55, p.s * 0.4, -0.4, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.moveTo(p.s * 0.5, -0.2); g.lineTo(p.s * 0.5, -p.s * 2.2); g.quadraticCurveTo(p.s * 1.3, -p.s * 1.7, p.s * 1.1, -p.s * 1.1); g.stroke();
        g.restore();
    }

    Object.assign(SKINS, {
        // ---- Samsas Traum: an etched plate, ink, a beetle, candles and deep water ----
        // The chat is an old engraving on yellowed paper in a double frame; across its top a beetle
        // crawls from one edge to the other. Candles burn beside the plaque, bubbles rise below.
        samsa: deluxe({
            assets: () => ({ grain: grainSvg(0.2) }),
            kit: A => ({
                titleCss: `font-family: ${BOOK_SCRIPT}; font-weight: 400; font-size: 1.45em; text-transform: none; letter-spacing: 0.01em;`,
                ground: `${ST_HATCH}, radial-gradient(ellipse at 50% 12%, rgba(255, 179, 71, 0.1), transparent 30%), radial-gradient(ellipse at 50% 40%, #1d3c52, #0b1620 62%, #05080c)`,
                header: { bg: `${ST_HATCH}, #0d0b09`, border: `3px double ${ST_BRASS}` },
                cards: { bg: '#0d0b09', border: `1px solid ${ST_BRASS}`, radius: '0', shadow: 'inset 0 0 0 3px #0d0b09, inset 0 0 0 4px #4a4030' },
                footer: { bg: `${ST_HATCH}, radial-gradient(ellipse at 50% 0, rgba(80, 140, 170, 0.25), transparent 60%), linear-gradient(180deg, #16303f, #08131b)`,
                          border: `3px double ${ST_BRASS}`, extra: 'isolation: isolate;' },
                chat: {
                    bg: `url("${A.grain}") 0 0 / 180px 180px, radial-gradient(ellipse at 50% 45%, transparent 55%, rgba(90, 60, 25, 0.28)), ${ST_PAPER}`,
                    border: `3px double ${ST_INK}`, radius: '0', pad: '84px 0 0', shadow: `0 0 0 4px #0d0b09, 0 0 0 5px ${ST_BRASS}`,
                    head: ST_INK, headBorder: `3px double ${ST_BRASS}`, headText: ST_PAPER,
                    body: 'transparent', comp: '#ddd1b3', compBorder: `1px solid ${ST_BRASS}`,
                    input: { bg: '#f1e9d4', border: `1px solid ${ST_BRASS}`, color: ST_INK, radius: '0', hint: '#8a7a60' },
                },
                btn: { bg: ST_INK, color: ST_PAPER, border: `1px solid ${ST_BRASS}`, radius: '0', shadow: 'inset 0 0 0 2px #14110e, inset 0 0 0 3px #4a4030',
                       hover: 'color: #ffcf7a !important; box-shadow: inset 0 0 0 2px #14110e, inset 0 0 0 3px #b8a87e, 0 0 12px rgba(255, 179, 71, 0.35) !important;',
                       extra: `font-family: ${BOOK_SERIF}; font-weight: 700; font-variant: small-caps; letter-spacing: 0.08em;` },
                filled: { radius: '0', border: `1px solid ${ST_BRASS}`, shadow: 'inset 0 0 0 2px rgba(0, 0, 0, 0.35)' },
                popup: { bg: '#0d0b09', border: `3px double ${ST_BRASS}`, radius: '0', hover: 'rgba(255, 179, 71, 0.14)', head: '#e6c98a', shadow: '0 12px 30px rgba(0, 0, 0, 0.7)' },
                win: { border: `3px double ${ST_BRASS}`, radius: '0', shadow: '0 0 0 3px #0d0b09, 0 16px 40px rgba(0, 0, 0, 0.7)', head: `${ST_HATCH}, #0d0b09`, headBorder: `3px double ${ST_BRASS}`, title: '#e6c98a' },
                panel: { radius: '0', border: '#4a4030', pressed: '#e6c98a' },
            }),
            extra: (S, A, fx) => lightChatCss(S, '#1a140e', '#6a5a44') + `
                ${S} .mcf-chat__header .mcf-chat__status { color: #b8a87e !important; }
                ${S} .mcf-chat__send { background: ${ST_INK} !important; color: ${ST_PAPER} !important; border: 1px solid ${ST_BRASS} !important; border-radius: 0 !important; }
                ${S} [data-role="action-region"] > .mcfo-skin-canvas { z-index: -1; }
                ${S} .mcfo-st-plate { position: absolute; top: 0; left: 0; right: 0; height: 84px; pointer-events: none; overflow: hidden; container-type: inline-size;
                    background: repeating-linear-gradient(0deg, rgba(20, 17, 14, 0.14) 0 1px, transparent 1px 4px) 0 100% / 100% 30px no-repeat, url("${A.grain}") 0 0 / 180px 180px, #ddd1b3;
                    border-bottom: 3px double ${ST_INK}; }
                ${S} .mcfo-st-plate svg { position: absolute; left: 0; top: 34px; width: 62px; height: 45px; translate: 45cqw 0; overflow: visible; }
                ${S} .mcfo-st-plate svg g :is(.ga, .gb) { transform-origin: 30px 20px; }
                ${fx(['full', 'subtle'], '.mcfo-st-plate svg')} { animation: mcfoStWalk 34s linear infinite; }
                ${fx(['full', 'subtle'], '.mcfo-st-plate .ga')} { animation: mcfoStLegs 0.36s ease-in-out infinite alternate; }
                ${fx(['full', 'subtle'], '.mcfo-st-plate .gb')} { animation: mcfoStLegs 0.36s ease-in-out infinite alternate-reverse; }
                @keyframes mcfoStWalk { from { translate: -70px 0; } to { translate: calc(100cqw + 10px) 0; } }
                @keyframes mcfoStLegs { from { rotate: -7deg; } to { rotate: 7deg; } }
                ${S} .mcfo-st-plate::after { content: ''; position: absolute; left: 12px; right: 12px; top: 10px; height: 18px;
                    border-top: 1px solid rgba(20, 17, 14, 0.5); border-bottom: 1px solid rgba(20, 17, 14, 0.5); }
                ${S} .mcfo-st-top { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); display: flex; align-items: flex-end; gap: 12px; pointer-events: none; }
                ${S} .mcfo-st-top > span { white-space: nowrap; padding: 2px 16px 4px; background: ${ST_PAPER}; border: 3px double ${ST_INK};
                    box-shadow: 0 0 0 2px #0d0b09, 0 0 0 3px ${ST_BRASS}; font: 400 22px/1 ${BOOK_SCRIPT}; color: ${ST_INK}; }
                ${S} .mcfo-st-candle { position: relative; display: block; width: 8px; height: 22px; margin-bottom: -2px; border-radius: 1px;
                    background: linear-gradient(90deg, #cfc2a0, #f3ead2 50%, #bfb08a); }
                ${S} .mcfo-st-candle b { position: absolute; left: 50%; bottom: 100%; width: 8px; height: 13px; translate: -50% 1px; border-radius: 50% 50% 45% 45% / 60% 60% 40% 40%;
                    background: radial-gradient(ellipse at 50% 75%, #fff6c0, #ffb347 45%, rgba(255, 110, 30, 0.8) 70%, transparent 72%); box-shadow: 0 -2px 14px 4px rgba(255, 179, 71, 0.35); transform-origin: 50% 100%; }
                ${fx(['full', 'subtle'], '.mcfo-st-candle b')} { animation: mcfoStFlicker 1.7s ease-in-out infinite; }
                ${fx(['full', 'subtle'], '.mcfo-st-top .mcfo-st-candle:last-child b')} { animation-delay: -0.8s; }
                @keyframes mcfoStFlicker { 0%, 100% { scale: 1 1; rotate: 0deg; } 30% { scale: 0.9 1.12; rotate: -3deg; } 55% { scale: 1.05 0.94; rotate: 2deg; } 80% { scale: 0.95 1.06; rotate: -1deg; } }`,
            decor: [
                { cls: 'mcfo-st-plate', host: () => document.querySelector('.mcf-chat'), html: BEETLE_SVG },
                // "aus unruhigen Träumen": from the first sentence of Kafka's Metamorphosis (1915, public domain).
                { cls: 'mcfo-st-top', host: () => role('top-status-region'), html: `${CANDLE}<span>aus unruhigen Träumen</span>${CANDLE}` },
            ],
            particles: [
                drifters('bubbles', () => role('action-region'), 14,
                    (w, h, any) => ({ x: rnd(6, w - 6), y: any ? rnd(0, h) : h + 6, v: rnd(8, 20), ph: rnd(0, 6), s: rnd(1.5, 4) }),
                    (p, dt) => { p.y -= p.v * dt; return p.y > -8; },
                    bubbleDraw),
            ],
            tile: A => `background: radial-gradient(9px 6px at 45% 55%, #2a2016 90%, transparent 100%), radial-gradient(circle at 60% 55%, #14110e 0 3px, transparent 3.5px),
                        linear-gradient(0deg, transparent 30%, rgba(20, 17, 14, 0.3) 30% 31%, transparent 31%), ${ST_PAPER};
                        box-shadow: inset 0 0 0 3px #0d0b09, inset 0 0 0 4px ${ST_BRASS};`,
        }),

        // ---- Prinz Pi: rebel lilac, a spinning record, a compass without north ----
        // The ground is one huge record, the chat a sleeve with the record sliding out of it, the
        // buttons are record labels. In the header the compass needle never comes to rest.
        prinzpi: deluxe({
            assets: () => ({}),
            kit: A => ({
                titleCss: `font-family: ${GEO_FONT}; font-weight: 700; text-transform: uppercase; letter-spacing: 0.14em;`,
                ground: `radial-gradient(circle at 50% 52%, ${PP_LILA} 0 8vmin, #1a1426 8vmin 8.6vmin, transparent 8.8vmin),
                         repeating-radial-gradient(circle at 50% 52%, rgba(255, 255, 255, 0.035) 0 1px, transparent 1px 5px),
                         radial-gradient(circle at 50% 52%, #0e0a1e 0 64vmin, transparent 64.3vmin), radial-gradient(ellipse at 50% 50%, #33277a, ${PP_DEEP} 60%, #140f30)`,
                header: { bg: `linear-gradient(90deg, ${PP_DEEP}, ${PP_LILA} 50%, ${PP_DEEP})`, border: `2px solid ${PP_LIGHT}` },
                cards: { bg: 'rgba(20, 15, 48, 0.9)', border: `1px solid ${PP_LIGHT}`, radius: '999px', shadow: `0 0 0 2px ${PP_DEEP}` },
                footer: { bg: `repeating-radial-gradient(ellipse at 50% 900%, #141018 0 1.2px, #251e30 1.2px 3px)`, border: `2px solid ${PP_LIGHT}`, extra: 'isolation: isolate;' },
                chat: {
                    bg: `linear-gradient(180deg, rgba(103, 78, 133, 0.12), transparent 30%), ${PP_CREAM}`, border: `2px solid ${PP_LILA}`, radius: '6px', pad: '92px 0 0',
                    shadow: `0 0 0 3px ${PP_DEEP}, 0 10px 30px rgba(0, 0, 0, 0.5)`,
                    head: `linear-gradient(90deg, ${PP_DEEP}, ${PP_LILA})`, headBorder: `2px solid ${PP_LIGHT}`, headText: PP_CREAM,
                    body: 'transparent', comp: '#e2d9f0', compBorder: `1px solid ${PP_LIGHT}`,
                    input: { bg: '#ffffff', border: `1px solid ${PP_LIGHT}`, color: PP_DEEP, radius: '999px', hint: '#8a7aa8' },
                },
                btn: { bg: `radial-gradient(circle at 11px 50%, #0c0a12 0 2px, ${PP_CREAM} 2.5px 3.5px, transparent 4px), linear-gradient(180deg, #7d62a3, ${PP_LILA})`,
                       color: '#ffffff', border: `1px solid ${PP_LIGHT}`, radius: '999px', shadow: `0 0 0 2px ${PP_DEEP}, 0 0 0 3px rgba(183, 166, 214, 0.5)`,
                       hover: `filter: brightness(1.15); box-shadow: 0 0 0 2px ${PP_DEEP}, 0 0 14px rgba(183, 166, 214, 0.7) !important;`,
                       extra: `font-family: ${GEO_FONT}; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; padding-left: 20px;` },
                filled: { radius: '999px', border: '1px solid rgba(239, 233, 247, 0.8)', shadow: `0 0 0 2px ${PP_DEEP}` },
                popup: { bg: PP_DEEP, border: `1px solid ${PP_LIGHT}`, radius: '12px', hover: 'rgba(183, 166, 214, 0.2)', head: '#d8ccef', shadow: '0 12px 30px rgba(0, 0, 0, 0.6)' },
                win: { border: `2px solid ${PP_LIGHT}`, radius: '12px', shadow: `0 0 0 3px ${PP_DEEP}, 0 16px 40px rgba(0, 0, 0, 0.6)`, head: `linear-gradient(90deg, ${PP_LILA}, ${PP_DEEP})`,
                       headBorder: `2px solid ${PP_LIGHT}`, title: PP_CREAM },
                panel: { radius: '10px', border: '#5a4a80', pressed: PP_LIGHT },
            }),
            extra: (S, A, fx) => lightChatCss(S, PP_DEEP, '#7a6a98') + `
                ${S} .mcf-chat__header .mcf-chat__status { color: #cfc2ea !important; }
                ${S} .mcf-chat__send { background: ${PP_LILA} !important; color: #ffffff !important; border-radius: 999px !important; padding-left: revert !important; }
                ${S} .mcf-chat__header button { background: linear-gradient(180deg, #7d62a3, ${PP_LILA}) !important; padding-left: revert !important; }
                ${S} [data-role="action-region"] > .mcfo-skin-canvas { z-index: -1; }
                ${S} .mcfo-pp-deck { position: absolute; top: 0; left: 0; right: 0; height: 92px; pointer-events: none; overflow: hidden; border-radius: 4px 4px 0 0;
                    background: linear-gradient(180deg, #2e2466, ${PP_DEEP}); border-bottom: 2px solid ${PP_LIGHT}; }
                ${S} .mcfo-pp-deck i { position: absolute; left: 50%; top: -24px; width: 150px; height: 150px; translate: -50% 0; border-radius: 50%;
                    background: ${vinylBg()}; box-shadow: 0 0 0 1px #000000, 0 -4px 14px rgba(0, 0, 0, 0.6); }
                ${S} .mcfo-pp-deck i::after { content: ''; position: absolute; left: 50%; top: 40%; width: 12%; height: 5%; translate: -50% 0; background: ${PP_CREAM}; opacity: 0.8; border-radius: 1px; }
                ${fx(['full', 'subtle'], '.mcfo-pp-deck i')} { animation: mcfoPpSpin 1.8s linear infinite; }
                @keyframes mcfoPpSpin { to { rotate: 360deg; } }
                ${S} .mcfo-pp-deck b { position: absolute; left: 50%; top: 66px; width: 230px; height: 30px; translate: -50% 0; background: linear-gradient(180deg, ${PP_LILA}, #4a3868); border-top: 2px solid ${PP_LIGHT};
                    box-shadow: 0 -3px 8px rgba(0, 0, 0, 0.5); }
                ${S} .mcfo-pp-top { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); display: flex; align-items: center; gap: 12px; pointer-events: none; }
                ${S} .mcfo-pp-top svg { display: block; width: 50px; height: 50px; }
                ${S} .mcfo-pp-top .mcfo-pp-needle { transform-box: fill-box; transform-origin: center; rotate: 38deg; }
                ${fx(['full', 'subtle'], '.mcfo-pp-top .mcfo-pp-needle')} { animation: mcfoPpNeedle 11s ease-in-out infinite; }
                @keyframes mcfoPpNeedle { 0% { rotate: 38deg; } 18% { rotate: -62deg; } 33% { rotate: 140deg; } 52% { rotate: 96deg; } 68% { rotate: 214deg; } 84% { rotate: 170deg; } 100% { rotate: 398deg; } }
                ${S} .mcfo-pp-stereo { display: grid; place-items: center; width: 46px; height: 46px; border-radius: 50%; background: ${PP_CREAM}; color: ${PP_DEEP};
                    box-shadow: inset 0 0 0 2px ${PP_CREAM}, inset 0 0 0 3.5px ${PP_DEEP}; font: 800 7.5px/1 ${GEO_FONT}; letter-spacing: 0.04em; text-transform: uppercase; }`,
            decor: [
                { cls: 'mcfo-pp-deck', host: () => document.querySelector('.mcf-chat'), html: '<i></i><b></b>' },
                { cls: 'mcfo-pp-top', host: () => role('top-status-region'), html: `<span class="mcfo-pp-stereo">Stereo</span>${COMPASS_SVG}` },
            ],
            particles: [
                drifters('notes', () => role('action-region'), 10,
                    (w, h, any) => ({ x: rnd(10, w - 10), y: any ? rnd(0, h) : h + 16, v: rnd(10, 20), ph: rnd(0, 6), s: rnd(5, 8), c: pickOf(Math.random, [PP_LIGHT, PP_CREAM, '#c24b6e']) }),
                    (p, dt, now) => { p.y -= p.v * dt; p.x += Math.sin(now / 900 + p.ph) * 10 * dt; return p.y > -20; },
                    noteDraw),
            ],
            tile: A => `background: radial-gradient(circle at 50% 50%, #0c0a12 0 1.5px, ${PP_LILA} 2px 9px, #1a1426 9.5px 10.5px, transparent 11px),
                        repeating-radial-gradient(circle at 50% 50%, #141018 0 1px, #2a2236 1px 2.4px) 50% 50% / 52px 52px no-repeat,
                        radial-gradient(circle at 50% 50%, #000000 0 26px, transparent 26.5px), linear-gradient(135deg, ${PP_LILA}, ${PP_DEEP}); box-shadow: inset 0 0 0 1px ${PP_LIGHT};`,
        }),
    });

