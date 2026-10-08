    // =========================================================================================
    // 3e. FILM & TV (6.16)
    // =========================================================================================
    // Seven themes you should know at first sight. Each carries the picture its film or series is
    // remembered by — the devil's trap, the element boxes, the time circuits, the googly eyes, the
    // crawl, the spiral, the marquee — drawn here from scratch: no stills, no logos, no fonts of
    // theirs. Texts are our own.
    const SPN_FONT = '"Trajan Pro", "Cinzel", Optima, "Palatino Linotype", "Book Antiqua", Georgia, serif';
    const DECO_FONT = '"Limelight", "Broadway", "Poiret One", Didot, "Bodoni MT", Georgia, serif';
    const CONDENSED_FONT = '"Bebas Neue", "Oswald", "League Gothic", "Arial Narrow", Impact, sans-serif';
    const GEO_FONT = 'Futura, "Century Gothic", "Avenir Next", "Josefin Sans", "Trebuchet MS", sans-serif';

    // Film grain: black specks of noise, a = how dense.
    const grainSvg = (a, freq = 0.85) => svgUrl('<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180">'
        + `<filter id="g"><feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 ${a} 0"/></filter>`
        + '<rect width="180" height="180" filter="url(#g)"/></svg>');
    const polar = (r, deg) => [+(r * Math.cos(deg * Math.PI / 180)).toFixed(2), +(r * Math.sin(deg * Math.PI / 180)).toFixed(2)];
    const starPath = r => [0, 2, 4, 1, 3].map((k, i) => (i ? 'L' : 'M') + polar(r, -90 + k * 72).join(' ')).join('') + 'Z';

    // ---- Supernatural ----
    // A devil's trap: two rings, the pentagram, signs between the rings and in the points. The signs
    // are made-up strokes, not the ones from the show.
    const SIGILS = ['M-1.4-2V2M-1.4 0H1.6', 'M-2 2L0-2 2 2', 'M-1.8-1.8L1.8 1.8M1.8-1.8L-1.8 1.8', 'M0-2V2M-2-.8H2M-2 .8H2',
                    'M-2-2H2L-2 2H2', 'M-2 0A2 2 0 1 1 2 0M0 0V2.2', 'M-2 2V-2L2 2V-2', 'M-1.6-2L1.6 0-1.6 2'];
    function devilsTrapSvg(c, w = 1) {
        const r = seeded(666);
        let marks = '';
        for (let i = 0; i < 24; i++) {
            const deg = i * 15 + 7.5, [x, y] = polar(43.2, deg);
            marks += `<path transform="translate(${x} ${y}) rotate(${deg + 90})" d="${pickOf(r, SIGILS)}"/>`;
        }
        for (let i = 0; i < 5; i++) {
            const [x, y] = polar(26, -90 + i * 72);
            marks += `<path transform="translate(${x} ${y}) scale(1.3)" d="${pickOf(r, SIGILS)}"/>`;
        }
        return svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="-50 -50 100 100"><g fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">`
            + `<circle r="48"/><circle r="38.5"/><path d="${starPath(38.5)}"/><circle r="10"/><path transform="scale(1.6)" d="M-2-2V2M2-2V2M-2 0H2"/>${marks}</g></svg>`);
    }
    // The anti-possession sign: pentagram in a ring, a sun of flames around it.
    function antiPossessionSvg(c) {
        let flames = '';
        for (let i = 0; i < 16; i++) {
            const a = i * 22.5, [x0, y0] = polar(33, a - 7), [x1, y1] = polar(33, a + 7), [tx, ty] = polar(48, a + 6), [cx, cy] = polar(40, a - 7), [dx, dy] = polar(39, a + 10);
            flames += `M${x0} ${y0}Q${cx} ${cy} ${tx} ${ty}Q${dx} ${dy} ${x1} ${y1}Z`;
        }
        return svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="-50 -50 100 100"><path fill="${c}" d="${flames}"/>`
            + `<g fill="none" stroke="${c}" stroke-width="3.4" stroke-linejoin="round"><circle r="31"/><path d="${starPath(29)}"/></g></svg>`);
    }
    // A line of salt across the door.
    function saltSvg() {
        const r = seeded(13);
        let d = '';
        for (let i = 0; i < 190; i++) {
            d += `<circle cx="${(r() * 240).toFixed(1)}" cy="${(4 + r() * 3.5 + (r() < 0.12 ? (r() - 0.5) * 6 : 0)).toFixed(1)}" r="${(0.35 + r() * 0.75).toFixed(2)}" opacity="${(0.45 + r() * 0.55).toFixed(2)}"/>`;
        }
        return svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 12"><g fill="#f4efe6">${d}</g></svg>`);
    }
    const emberMake = (w, h, any) => ({ x: rnd(4, w - 4), y: any ? rnd(0, h) : h + 4, v: rnd(14, 36), ph: rnd(0, 6), r: rnd(0.7, 1.7) });
    const emberMove = (p, dt, now) => { p.y -= p.v * dt; p.x += Math.sin(now / 380 + p.ph) * 12 * dt; return p.y > -6; };
    function emberDraw(g, p, now, w, h) {
        const a = Math.max(0, Math.min(1, p.y / (h * 0.6))) * (0.55 + 0.45 * Math.sin(now / 90 + p.ph * 7));
        glowDot(g, p.x, p.y, p.r * 5, '255, 110, 20', a * 0.45);
        glowDot(g, p.x, p.y, p.r * 1.4, '255, 214, 150', a);
    }

    // ---- Breaking Bad ----
    const heisenbergSvg = c => svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" fill="${c}">`
        + '<path d="M11 17C11 8.5 14 6 20 6s9 2.5 9 11z"/><ellipse cx="20" cy="17.4" rx="16" ry="2.6"/>'
        + '<path d="M9.5 22h8.5l-.6 4.2c-.2 1-1 1.6-2 1.6h-3.6c-1 0-1.8-.7-2-1.6zM22 22h8.5l-.7 4.2c-.2 1-1 1.6-2 1.6h-3.6c-1 0-1.8-.7-2-1.6zM17.5 22.6h5v1.2h-5z"/>'
        + '<path d="M14.5 31.2c2-1.4 3.8-1.6 5.5-.8 1.7-.8 3.5-.6 5.5.8-2 .2-3.7.3-5.5.2-1.8.1-3.5 0-5.5-.2zM17.2 33h5.6c-.4 2.6-1.4 4.2-2.8 4.2s-2.4-1.6-2.8-4.2z"/></svg>');
    // One box of the periodic table: atomic number, symbol, mass.
    function elementTile(n, sym, mass, id, hot) {
        return `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${hot ? '#62b574' : '#3b7f4b'}"/><stop offset="1" stop-color="${hot ? '#1e5a2e' : '#153f22'}"/></linearGradient></defs>`
            + `<rect x="1" y="1" width="38" height="42" fill="url(#${id})" stroke="#d7f0dc" stroke-width="1.4"/>`
            + `<text x="4" y="9.5" font-family="Arial, sans-serif" font-size="7" fill="#e9f7ec">${n}</text>`
            + `<text x="20" y="31" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-weight="700" font-size="21" fill="#ffffff">${sym}</text>`
            + `<text x="20" y="40" text-anchor="middle" font-family="Arial, sans-serif" font-size="5" fill="#cfead5">${mass}</text>`;
    }
    const elementTileSvg = (n, sym, mass, id, hot) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 44">${elementTile(n, sym, mass, id, hot)}</svg>`;
    const ELEMENTS = [[1, 'H', '1.008'], [6, 'C', '12.011'], [7, 'N', '14.007'], [8, 'O', '15.999'], [11, 'Na', '22.990'], [3, 'Li', '6.94'],
                      [15, 'P', '30.974'], [16, 'S', '32.06'], [17, 'Cl', '35.45'], [80, 'Hg', '200.59'], [19, 'K', '39.098'], [53, 'I', '126.90']];
    const elementStripSvg = a => svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ELEMENTS.length * 48} 44"><g opacity="${a}">`
        + ELEMENTS.map(([n, s, m], i) => `<g transform="translate(${i * 48 + 4} 0)">${elementTile(n, s, m, 'e' + i, false)}</g>`).join('') + '</g></svg>');
    const mesaSvg = (far, near) => svgUrl('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 90" preserveAspectRatio="none">'
        + `<path fill="${far}" d="M0 90V52l22-3 10-18h44l9 16 40 4 18-26h52l8 20 60 2 12-14h34l10 18 38-2 12-22h22l9 24V90z"/>`
        + `<path fill="${near}" d="M0 90V70l40-4 16-14h30l12 12 70 4 20-10h44l14 12 80 2 20-16h28l26 18V90z"/></svg>`);
    function crystalDraw(g, p, now) {
        g.save(); g.translate(p.x, p.y); g.rotate(p.a + now / 1000 * p.spin);
        g.globalAlpha = 0.75;
        g.fillStyle = '#6fd3ff';
        g.beginPath(); p.pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill();
        g.fillStyle = 'rgba(255, 255, 255, 0.85)';
        g.beginPath(); g.moveTo(p.pts[0][0], p.pts[0][1]); g.lineTo(p.pts[1][0], p.pts[1][1]); g.lineTo(0, 0); g.closePath(); g.fill();
        g.strokeStyle = '#1f7fb8'; g.lineWidth = 0.8;
        g.beginPath(); p.pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.stroke();
        g.restore();
    }

    // ---- Back to the Future ----
    // The time circuits: digits on seven segments, the month on fourteen, the unlit segments as a
    // faint ghost — the way the displays in the car look when they are on.
    const SEG = { t: [2, 1, 8, 1], b: [2, 17, 8, 17], ml: [2, 9, 5, 9], mr: [5, 9, 8, 9], ul: [1, 2, 1, 8], ll: [1, 10, 1, 16], ur: [9, 2, 9, 8], lr: [9, 10, 9, 16],
                  vu: [5, 2, 5, 8], vl: [5, 10, 5, 16], dul: [2, 2, 4.3, 7.8], dur: [8, 2, 5.7, 7.8], dll: [4.3, 10.2, 2, 16], dlr: [5.7, 10.2, 8, 16] };
    const SEG_DIGIT = ['t ur lr b ll ul', 'ur lr', 't ur ml mr ll b', 't ur ml mr lr b', 'ul ml mr ur lr', 't ul ml mr lr b', 't ul ml mr ll lr b', 't ur lr', 't ur lr b ll ul ml mr', 't ur lr b ul ml mr'];
    const SEG_ALPHA = { A: 't ur lr ll ul ml mr', B: 't ur lr b vu vl mr', C: 't ul ll b', D: 't ur lr b vu vl', E: 't ul ll b ml mr', F: 't ul ll ml', G: 't ul ll b lr mr',
                        J: 'ur lr b ll', L: 'ul ll b', M: 'ul ll ur lr dul dur', N: 'ul ll ur lr dul dlr', O: 't ur lr b ll ul', P: 't ur ul ll ml mr', R: 't ur ul ll ml mr dlr',
                        S: 't ul ml mr lr b', T: 't vu vl', U: 'ul ll b lr ur', V: 'ul ll dll dur', Y: 'dul dur vl' };
    const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    function segCell(x, ch, alpha) {
        const all = alpha ? Object.keys(SEG) : ['t', 'b', 'ml', 'mr', 'ul', 'll', 'ur', 'lr'];
        const lit = new Set(((alpha ? SEG_ALPHA[ch] : SEG_DIGIT[ch]) || '').split(' '));
        const line = k => { const [x1, y1, x2, y2] = SEG[k]; return `<line x1="${x + x1}" y1="${y1}" x2="${x + x2}" y2="${y2}"/>`; };
        return { off: all.filter(k => !lit.has(k)).map(line).join(''), on: all.filter(k => lit.has(k)).map(line).join('') };
    }
    // One row: MONTH DAY YEAR, AM/PM, HOUR:MIN, its name on a plate in its colour below.
    function tcRow(id, name, col, mon, day, year, pm, hour, min) {
        let x = 2, off = '', on = '', boxes = '', labels = '', lamps = '';
        const group = (label, text, alpha) => {
            const w = text.length * 11 + 3;
            boxes += `<rect x="${x}" y="5" width="${w}" height="20" rx="1.2"/>`;
            labels += `<text x="${x + w / 2}" y="3.9">${label}</text>`;
            [...text].forEach((ch, i) => { const c = segCell(x + 2 + i * 11, ch, alpha); off += c.off; on += c.on; });
            x += w + 4;
        };
        group('MONTH', mon, true);
        group('DAY', day);
        group('YEAR', year);
        labels += `<text x="${x + 4}" y="10">AM</text><text x="${x + 4}" y="19">PM</text>`;
        lamps += `<circle cx="${x + 4}" cy="13" r="1.7" fill="${pm ? '#2a2a2a' : col}"/><circle cx="${x + 4}" cy="22" r="1.7" fill="${pm ? col : '#2a2a2a'}"/>`;
        x += 12;
        group('HOUR', hour);
        lamps += `<g class="mcfo-tc-colon" fill="${col}"><circle cx="${x - 0.5}" cy="12" r="1.3"/><circle cx="${x - 0.5}" cy="18" r="1.3"/></g>`;
        x += 3;
        group('MIN', min);
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${x - 2} 32">`
            + `<defs><filter id="mcfoTc${id}" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="0.7" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>`
            + `<g fill="#060606" stroke="#44484d" stroke-width=".6">${boxes}</g>`
            + `<g font-family="Arial Narrow, Arial, sans-serif" font-size="3.6" fill="#d8d8d8" text-anchor="middle">${labels}</g>`
            + `<g transform="translate(0 6)" stroke-linecap="round" stroke-width="1.45" stroke="${col}"><g opacity=".12">${off}</g><g filter="url(#mcfoTc${id})">${on}</g></g>`
            + `${lamps}<rect x="2" y="26.6" width="${x - 6}" height="5" rx=".6" fill="${col}"/>`
            + `<text x="${(x - 2) / 2}" y="30.3" font-family="Arial Narrow, Arial, sans-serif" font-size="3.6" font-weight="700" letter-spacing="1.2" fill="#0b0b0b" text-anchor="middle">${name}</text></svg>`;
    }
    const TC_COL = { dest: '#ff3b2f', now: '#3dff6e', last: '#ffb000' };
    function tcNowRow() {
        const n = new Date(), pad = v => String(v).padStart(2, '0');
        return tcRow('n', 'PRESENT TIME', TC_COL.now, MONTHS[n.getMonth()], pad(n.getDate()), String(n.getFullYear()), n.getHours() >= 12, pad(n.getHours() % 12 || 12), pad(n.getMinutes()));
    }
    const FLUX_SVG = '<svg viewBox="0 0 30 34"><rect x="1" y="1" width="28" height="32" rx="2" fill="#3b3f45" stroke="#9aa0a6"/><rect x="4" y="4" width="22" height="26" rx="1" fill="#101214"/>'
        + '<path d="M7 8L15 17M23 8L15 17M15 17V28" stroke="#6b7078" stroke-width="3" stroke-linecap="round"/>'
        + '<path class="mcfo-flux-pulse" d="M7 8L15 17M23 8L15 17M15 28V17" stroke="#fff4b0" stroke-width="1.6" stroke-linecap="round" stroke-dasharray="1.2 3.2"/>'
        + '<circle cx="15" cy="17" r="2.4" fill="#fffbe0"/></svg>';
    const fireTrailsSvg = () => svgUrl('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 100" preserveAspectRatio="none">'
        + '<defs><linearGradient id="f" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#fff2a8"/><stop offset=".3" stop-color="#ffb000"/><stop offset=".7" stop-color="#ff4d00" stop-opacity=".75"/><stop offset="1" stop-color="#ff2a00" stop-opacity="0"/></linearGradient>'
        + '<filter id="b"><feGaussianBlur stdDeviation="2"/></filter></defs>'
        + '<g fill="url(#f)"><path filter="url(#b)" d="M40 100L196 6h2L110 100z"/><path filter="url(#b)" d="M360 100L204 6h-2L290 100z"/>'
        + '<path d="M60 100L196.5 8h1L86 100z"/><path d="M340 100L203.5 8h-1L314 100z"/></g></svg>');
    // The clock tower, stopped at 10:04, the bolt coming down on it.
    const clockTowerSvg = () => svgUrl('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 160">'
        + '<path fill="#f7f3c8" d="M62 0L50 14h5l-8 10h4l-1 6 8-12h-5l8-11h-5l6-7z"/>'
        + '<g fill="#05060c"><path d="M0 160V112h14V98h72v14h14v48z"/><path d="M30 98V62l20-14 20 14v36z"/><rect x="48" y="30" width="4" height="20"/></g>'
        + '<circle cx="50" cy="76" r="11" fill="#f4e7b2"/><circle cx="50" cy="76" r="11" fill="none" stroke="#05060c" stroke-width="1.4"/>'
        + '<path d="M50 76l-5.1-3.2M50 76l4.1-9.1" stroke="#05060c" stroke-width="1.4" stroke-linecap="round"/>'
        + '<g fill="#f0c060" opacity=".55"><rect x="6" y="122" width="7" height="11"/><rect x="21" y="122" width="7" height="11"/><rect x="72" y="122" width="7" height="11"/><rect x="87" y="122" width="7" height="11"/></g></svg>');

    // ---- Everything Everywhere All at Once ----
    function shardsSvg() {
        const r = seeded(2022), cols = ['#ff2a6d', '#05d9e8', '#ffd319', '#c8102e', '#7b2cbf', '#ffffff', '#3ddc84'];
        let s = '';
        for (let i = 0; i < 26; i++) {
            const x = r() * 420, y = r() * 420, k = 30 + r() * 90;
            s += `<path fill="${pickOf(r, cols)}" opacity="${(0.05 + r() * 0.1).toFixed(2)}" d="M${x.toFixed(0)} ${y.toFixed(0)}l${(k * (r() - 0.2)).toFixed(0)} ${(-k * r()).toFixed(0)}l${(k * r()).toFixed(0)} ${(k * (r() + 0.3)).toFixed(0)}z"/>`;
        }
        return svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 420">${s}</svg>`);
    }
    // The everything bagel: black, a hole in the middle, seeds of everything on it.
    function bagelSvg() {
        const r = seeded(8);
        let seeds = '';
        for (let i = 0; i < 70; i++) {
            const a = r() * 360, d = 11 + r() * 11.5, [x, y] = polar(d, a);
            seeds += `<ellipse cx="${x}" cy="${(y * 0.92).toFixed(2)}" rx="${(0.5 + r() * 0.5).toFixed(2)}" ry="${(0.9 + r() * 0.6).toFixed(2)}" transform="rotate(${(r() * 180).toFixed(0)} ${x} ${(y * 0.92).toFixed(2)})" fill="${pickOf(r, ['#f4ead0', '#e8d9a8', '#ffffff', '#9a8a70'])}"/>`;
        }
        return svgUrl('<svg xmlns="http://www.w3.org/2000/svg" viewBox="-30 -30 60 60"><defs><radialGradient id="g" cx=".42" cy=".36" r=".72"><stop offset="0" stop-color="#444444"/><stop offset=".55" stop-color="#141414"/><stop offset="1" stop-color="#000000"/></radialGradient></defs>'
            + `<path fill="url(#g)" fill-rule="evenodd" d="M-26 0a26 24 0 1 0 52 0a26 24 0 1 0-52 0zM-8 0a8 7 0 1 0 16 0a8 7 0 1 0-16 0z"/>${seeds}</svg>`);
    }
    // The title, spread over the header, each part in another typeface — another universe each.
    const bigWordsSvg = c => svgUrl('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 60" preserveAspectRatio="none">'
        + `<g fill="${c}"><text x="0" y="50" textLength="330" lengthAdjust="spacingAndGlyphs" font-family="Georgia, serif" font-style="italic" font-weight="700" font-size="52">Everything</text>`
        + '<text x="350" y="52" textLength="420" lengthAdjust="spacingAndGlyphs" font-family="Impact, Haettenschweiler, sans-serif" font-size="58">EVERYWHERE</text>'
        + '<text x="790" y="48" textLength="410" lengthAdjust="spacingAndGlyphs" font-family="Courier New, monospace" font-weight="700" font-size="46">all at once</text></g></svg>');
    const EYE = '<i class="mcfo-eye"><b></b></i>';

    // ---- Star Wars ----
    const deathStarSvg = () => svgUrl('<svg xmlns="http://www.w3.org/2000/svg" viewBox="-50 -50 100 100"><defs>'
        + '<radialGradient id="d" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#b9bfc6"/><stop offset=".6" stop-color="#6d747c"/><stop offset="1" stop-color="#2a2e33"/></radialGradient>'
        + '<radialGradient id="c" cx=".62" cy=".62" r=".7"><stop offset="0" stop-color="#8b9299"/><stop offset="1" stop-color="#3d4247"/></radialGradient></defs><g opacity=".6">'
        + '<circle r="46" fill="url(#d)"/><path d="M-46 1.5H46" stroke="#23272b" stroke-width="2.2"/><path d="M-45-.9H45" stroke="rgba(255,255,255,.2)" stroke-width=".6"/>'
        + '<circle cx="-16" cy="-17" r="11" fill="url(#c)" stroke="#2a2e33"/><circle cx="-16" cy="-17" r="2.4" fill="#2a2e33"/>'
        + '<g stroke="rgba(0,0,0,.2)" stroke-width=".5" fill="none"><ellipse rx="46" ry="16"/><ellipse rx="46" ry="32"/></g></g></svg>');
    const saberBg = c => `linear-gradient(90deg, #1c1e21 0 2px, #9aa0a6 2px 4px, #3a3e43 4px 6px, #c9ced3 6px 8px, #2a2d31 8px 9px, transparent 9px), linear-gradient(180deg, ${c} 0%, #ffffff 35% 65%, ${c} 100%)`;
    const saberGlow = (c, k = 1) => `0 0 ${4 * k}px 1px ${c}, 0 0 ${12 * k}px ${2 * k}px ${c}99`;
    function tieFighter(g, x, y, s) {
        g.fillStyle = '#8f98a2';
        g.fillRect(x - s * 0.9, y - s * 0.1, s * 1.8, s * 0.2);
        g.beginPath(); g.arc(x, y, s * 0.36, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#1d232a'; g.beginPath(); g.arc(x, y, s * 0.18, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#3a414a';
        g.fillRect(x - s * 1.02, y - s, s * 0.2, s * 2); g.fillRect(x + s * 0.82, y - s, s * 0.2, s * 2);
    }
    function xWing(g, x, y, s, dir) {   // from above, nose along dir
        g.save(); g.translate(x, y); g.scale(dir, 1);
        g.fillStyle = '#e6e8ea';
        g.beginPath(); g.moveTo(s * 1.5, 0); g.lineTo(-s * 0.8, -s * 0.16); g.lineTo(-s * 0.8, s * 0.16); g.closePath(); g.fill();
        g.fillRect(-s * 0.7, -s * 0.95, s * 0.36, s * 1.9);
        g.fillStyle = '#c8202c'; g.fillRect(-s * 0.7, -s * 0.95, s * 0.36, s * 0.2); g.fillRect(-s * 0.7, s * 0.75, s * 0.36, s * 0.2);
        g.fillStyle = '#9aa3ad'; g.fillRect(-s * 0.4, -s * 1.0, s * 1.2, s * 0.09); g.fillRect(-s * 0.4, s * 0.91, s * 1.2, s * 0.09);
        glowDot(g, -s * 0.95, 0, s * 0.55, '255, 130, 100', 0.85);
        g.restore();
    }
    const CRAWL = '<em>A long run ago, in a lane far, far away....</em><span><i><b>Episode M</b><strong>THE BID STRIKES BACK</strong>'
        + '<p>The throne of Crownfall is held by a greedy King. Across the lanes, a small band of marbles has gathered in secret, hoarding their tickets one bid at a time.</p>'
        + '<p>Tonight they strike. Only a perfect run can topple the crown and bring the gold home to the chat, where every rebel waits for the signal....</p></i></span>';

    // ---- Vertigo ----
    // Saul Bass: a whirlpool of two spirals, a man falling into it, shapes cut from paper.
    function spiralSvg(c, turns, w, a = 1) {
        let d = '', d2 = '';
        const max = turns * Math.PI * 2;
        for (let t = 0; t <= max; t += 0.12) {
            const r = 2 + (t / max) * 96;
            d += (t ? 'L' : 'M') + (r * Math.cos(t)).toFixed(1) + ' ' + (r * Math.sin(t)).toFixed(1);
            d2 += (t ? 'L' : 'M') + (r * Math.cos(t + Math.PI)).toFixed(1) + ' ' + (r * Math.sin(t + Math.PI)).toFixed(1);
        }
        return svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="-100 -100 200 200"><g fill="none" stroke="${c}" stroke-opacity="${a}" stroke-linecap="round"><path d="${d}" stroke-width="${w}"/><path d="${d2}" stroke-width="${w * 0.45}"/></g></svg>`);
    }
    const fallingManSvg = c => svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 80"><g fill="${c}" transform="rotate(-24 30 40)">`
        + '<circle cx="30" cy="11" r="5.2"/><path d="M23.5 18h13l2.5 24h-18z"/>'
        + '<path d="M24 19L9 4l-3.2 3L21.5 23zM36 19L52 7.5l2.6 3.4L38 24.5z"/>'
        + '<path d="M22 41h6.2l-7 22-5.6-2zM15.6 61l5.6 2-9.6 9.6-3-3zM32 41h6l6.5 17-5.2 2.2zM44.5 58l-5.2 2.2 5.8 15.6 4.4-1.4z"/></g></svg>');
    function cutPaperSvg(c, seed, top) {
        const r = seeded(seed);
        let d = '', x = 0;
        while (x < 640) {
            const w = 30 + r() * 90, h = 8 + r() * 30, a = x + w * (0.15 + r() * 0.35), b = x + w * (0.55 + r() * 0.35), h2 = h * (0.35 + r() * 0.6);
            d += top ? `M${x.toFixed(0)} 0L${a.toFixed(0)} ${h.toFixed(0)}L${b.toFixed(0)} ${h2.toFixed(0)}L${(x + w).toFixed(0)} 0Z`
                     : `M${x.toFixed(0)} 60L${a.toFixed(0)} ${(60 - h).toFixed(0)}L${b.toFixed(0)} ${(60 - h2).toFixed(0)}L${(x + w).toFixed(0)} 60Z`;
            x += w + r() * 50;
        }
        return svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 60" preserveAspectRatio="none"><path fill="${c}" d="${d}"/></svg>`);
    }

    // ---- Cinema ----
    const seatsSvg = (back, face) => svgUrl('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 44">'
        + `<path fill="${back}" d="M8 44V14c0-6 4-10 10-10h24c6 0 10 4 10 10v30z"/><path fill="${face}" d="M12 40V15c0-4 3-7 7-7h22c4 0 7 3 7 7v25z"/>`
        + '<path fill="rgba(255,200,150,.1)" d="M14 12c1-2 3-3 5-3h22c2 0 4 1 5 3z"/></svg>');
    const CLAPPER_SVG = '<svg viewBox="0 0 30 28"><rect x="2" y="10" width="26" height="17" rx="1.5" fill="#15151a"/>'
        + '<path d="M5 15h20M5 19.5h20M5 24h20M15 15v9" stroke="#e9e4d8" stroke-width=".9"/>'
        + '<rect x="2" y="9" width="26" height="2.4" fill="#15151a"/><path fill="#f4f1ea" d="M4 9h4l-2 2.4H2zM12 9h4l-2 2.4h-4zM20 9h4l-2 2.4h-4z"/>'
        + '<g class="mcfo-clap-stick"><rect x="2" y="4.5" width="26" height="4.5" fill="#15151a"/><path fill="#f4f1ea" d="M5 4.5h4L6 9H2zM13 4.5h4l-3 4.5h-4zM21 4.5h4l-3 4.5h-4z"/></g></svg>';
    function popcornDraw(g, p) {
        g.globalAlpha = 0.9;
        for (const [dx, dy, k] of p.puffs) {
            g.fillStyle = k ? '#fff6dc' : '#f4d57a';
            g.beginPath(); g.arc(p.x + dx * p.s, p.y + dy * p.s, p.s * (k ? 0.55 : 0.4), 0, Math.PI * 2); g.fill();
        }
    }

    Object.assign(SKINS, {
        // ---- Supernatural: a devil's trap on the floor, a salt line at the door, the family business ----
        // The chat is the leather of a hunter's journal with its stitching; lightning now and then.
        hunters: deluxe({
            assets: () => ({ trap: devilsTrapSvg('#9a3a1e', 1), trapGold: devilsTrapSvg('#e2b25a', 1.6), sigil: antiPossessionSvg('#e2b25a'), grain: grainSvg(0.35), salt: saltSvg() }),
            kit: A => {
                const grain = `url("${A.grain}") 0 0 / 180px 180px`;
                const leather = `${grain}, radial-gradient(ellipse at 30% 15%, rgba(140, 86, 48, 0.35), transparent 60%), linear-gradient(180deg, #3a2417, #22150c)`;
                return {
                    titleCss: `font-family: ${SPN_FONT}; text-transform: uppercase; letter-spacing: 0.2em; text-shadow: 0 0 8px rgba(255, 140, 40, 0.45);`,
                    ground: `${grain}, url("${A.trap}") 50% 52% / min(94vh, 90vw) min(94vh, 90vw) no-repeat, radial-gradient(ellipse at 50% 40%, rgba(90, 60, 30, 0.28), transparent 65%),
                             radial-gradient(ellipse at 50% 115%, rgba(200, 90, 20, 0.22), transparent 55%), #0d0b09`,
                    header: { bg: `${grain}, linear-gradient(180deg, #231c16, #100d0a)`, border: '1px solid #6b4a22',
                              extra: 'box-shadow: 0 1px 0 rgba(226, 178, 90, 0.25), 0 6px 18px rgba(0, 0, 0, 0.6) !important;' },
                    cards: { bg: 'linear-gradient(180deg, rgba(42, 33, 25, 0.94), rgba(20, 16, 12, 0.94))', border: '1px solid #7a5a2e', radius: '3px', shadow: 'inset 0 1px 0 rgba(255, 220, 160, 0.12)' },
                    footer: { bg: `url("${A.salt}") 0 1px / 240px 12px repeat-x, ${grain}, linear-gradient(180deg, #17120e, #0b0908)`, border: '1px solid #6b4a22',
                              extra: 'isolation: isolate;' },
                    chat: {
                        bg: leather, border: '2px solid #a7adb3', radius: '10px',
                        shadow: 'inset 0 0 0 1px #1a0f08, inset 0 0 30px rgba(0, 0, 0, 0.55), 0 0 0 1px #000000',
                        head: 'linear-gradient(180deg, rgba(18, 11, 6, 0.9), rgba(18, 11, 6, 0.6))', headBorder: '1px solid rgba(226, 178, 90, 0.45)', headText: '#e2b25a',
                        body: 'transparent', comp: 'rgba(14, 9, 5, 0.78)', compBorder: '1px solid rgba(226, 178, 90, 0.35)',
                        input: { bg: '#120c08', border: '1px solid #7a5a2e', color: '#f0e4cc', radius: '4px', hint: '#8f7654' },
                    },
                    btn: { bg: 'linear-gradient(180deg, #3b3129, #1d1814)', color: '#e2b25a', border: '1px solid #8a6a3a', radius: '3px',
                           shadow: 'inset 0 1px 0 rgba(255, 220, 160, 0.15), 0 2px 0 #000000',
                           hover: 'color: #fff1d0 !important; box-shadow: inset 0 1px 0 rgba(255, 220, 160, 0.2), 0 0 12px rgba(255, 140, 40, 0.55) !important;',
                           extra: `font-family: ${SPN_FONT}; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700;` },
                    filled: { radius: '3px', border: '1px solid rgba(226, 178, 90, 0.7)', shadow: '0 2px 0 rgba(0, 0, 0, 0.6)' },
                    popup: { bg: '#15100c', border: '1px solid #8a6a3a', radius: '4px', hover: 'rgba(226, 178, 90, 0.16)', head: '#e2b25a',
                             shadow: '0 0 0 1px #000000, 0 14px 32px rgba(0, 0, 0, 0.7)' },
                    win: { border: '1px solid #8a6a3a', radius: '6px', shadow: '0 0 0 1px #000000, 0 16px 40px rgba(0, 0, 0, 0.7)',
                           head: 'linear-gradient(180deg, #2a2019, #15100c)', headBorder: '1px solid #6b4a22', title: '#e2b25a' },
                    panel: { radius: '4px', border: '#6b4a22', pressed: '#e2b25a' },
                };
            },
            extra: (S, A, fx) => `
                ${S} .mcf-chat:not([data-collapsed="true"])::after { content: ''; position: absolute; inset: 5px; border: 1px dashed rgba(226, 190, 130, 0.42); border-radius: 7px; pointer-events: none; z-index: 2; }
                ${S} [data-role="action-region"] > .mcfo-skin-canvas { z-index: -1; }
                ${S} [data-role="top-status-region"]::after { content: ''; position: absolute; inset: 0; pointer-events: none; z-index: 3; opacity: 0;
                    background: linear-gradient(180deg, rgba(210, 225, 255, 0.55), rgba(180, 200, 255, 0.08)); }
                ${fx(['full'], '[data-role="top-status-region"]::after')} { animation: mcfoSpnFlash 11s linear infinite; }
                @keyframes mcfoSpnFlash { 0%, 90% { opacity: 0; } 90.6% { opacity: 0.8; } 91.2% { opacity: 0.1; } 92% { opacity: 0.6; } 93.5%, 100% { opacity: 0; } }
                ${S} .mcfo-spn-motto { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); display: flex; align-items: center; gap: 14px; pointer-events: none; white-space: nowrap;
                    font: 600 11px/1 ${SPN_FONT}; letter-spacing: 0.32em; text-transform: uppercase; color: rgba(226, 178, 90, 0.78); text-shadow: 0 0 6px rgba(255, 140, 40, 0.35); }
                ${S} .mcfo-spn-motto i { display: block; width: 40px; height: 40px; background: url("${A.trapGold}") center / contain no-repeat; opacity: 0.9; }
                ${fx(['full', 'subtle'], '.mcfo-spn-motto i')} { animation: mcfoSpnTurn 90s linear infinite; }
                @media (max-width: 1250px) { ${S} .mcfo-spn-motto b { display: none; } }
                ${S} .mcfo-spn-sigil { position: absolute; left: 34%; top: 50%; width: 26px; height: 26px; transform: translate(-50%, -50%); pointer-events: none;
                    background: url("${A.sigil}") center / contain no-repeat; filter: drop-shadow(0 0 3px rgba(255, 140, 40, 0.6)); }
                ${fx(['full', 'subtle'], '.mcfo-spn-sigil')} { animation: mcfoSpnGlow 3.2s ease-in-out infinite alternate; }
                @keyframes mcfoSpnTurn { to { rotate: 360deg; } }
                @keyframes mcfoSpnGlow { from { opacity: 0.6; } to { opacity: 1; filter: drop-shadow(0 0 7px rgba(255, 140, 40, 0.95)); } }`,
            decor: [
                { cls: 'mcfo-spn-motto', host: () => role('top-status-region'), html: '<b>Saving people</b><i></i><b>Hunting things</b>' },
                { cls: 'mcfo-spn-sigil', host: () => document.querySelector('.mcf-chat__header'), html: '' },
            ],
            particles: [
                drifters('embers', () => document.querySelector('.mcf-chat:not([data-collapsed="true"])'), 14, emberMake, emberMove, emberDraw),
                drifters('embers-salt', () => role('action-region'), 9, emberMake, emberMove, emberDraw),
            ],
            tile: A => `background: url("${A.trapGold}") center / 46px 46px no-repeat, url("${A.salt}") 0 100% / 120px 6px repeat-x,
                        radial-gradient(ellipse at 50% 120%, rgba(200, 90, 20, 0.5), transparent 60%), #120e0b; box-shadow: inset 0 0 0 2px #6b4a22;`,
        }),

        // ---- Breaking Bad: element boxes, the desert's yellow cast, blue crystal ----
        // The chat is a page of the lab notebook, its header a hazmat suit; on it the hat, the
        // glasses and the goatee — the sketch that stands for the man.
        heisenberg: deluxe({
            assets: () => ({ mesa: mesaSvg('#8a6230', '#4e3417'), strip: elementStripSvg(0.24), hat: heisenbergSvg('#111111'), grain: grainSvg(0.22),
                             br: svgUrl(elementTileSvg(35, 'Br', '79.904', 'b', true)), ba: svgUrl(elementTileSvg(56, 'Ba', '137.33', 'b', true)) }),
            kit: A => {
                const graph = 'linear-gradient(rgba(60, 120, 90, 0.2) 1px, transparent 1px) 0 0 / 14px 14px, linear-gradient(90deg, rgba(60, 120, 90, 0.2) 1px, transparent 1px) 0 0 / 14px 14px, '
                    + 'linear-gradient(rgba(60, 120, 90, 0.32) 1px, transparent 1px) 0 0 / 70px 70px, linear-gradient(90deg, rgba(60, 120, 90, 0.32) 1px, transparent 1px) 0 0 / 70px 70px';
                const lab = 'linear-gradient(180deg, #1c4a29, #0f2c18)';
                return {
                    titleCss: 'font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; font-weight: 700;',
                    ground: `url("${A.grain}") 0 0 / 180px 180px, url("${A.mesa}") 0 100% / 1100px 150px repeat-x,
                             radial-gradient(ellipse at 70% 0%, rgba(255, 236, 170, 0.5), transparent 55%), linear-gradient(180deg, #c49a4a 0%, #a37634 45%, #76511f 100%)`,
                    header: { bg: `url("${A.strip}") 0 50% / auto 44px repeat-x, ${lab}`, border: '2px solid #0a1f10',
                              extra: 'box-shadow: 0 3px 0 #f2d21b, 0 8px 20px rgba(0, 0, 0, 0.45) !important;' },
                    cards: { bg: 'linear-gradient(135deg, rgba(47, 107, 60, 0.96), rgba(21, 63, 34, 0.96))', border: '1px solid #cfeed6', radius: '2px', shadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.2), 0 2px 6px rgba(0, 0, 0, 0.35)' },
                    footer: { bg: 'repeating-linear-gradient(-45deg, #f2d21b 0 12px, #111111 12px 24px) 0 0 / 100% 6px no-repeat, linear-gradient(180deg, #1c211b, #0e110d)', border: '0' },
                    chat: {
                        bg: `${graph}, #f6f3e7`, border: '1px solid #b9b39a', radius: '3px', shadow: '0 0 0 4px #1f5a2e',
                        head: '#f2d21b', headBorder: '2px solid #111111', headText: '#111111',
                        body: 'transparent', comp: '#ece6cf', compBorder: '1px solid #b9b39a',
                        input: { bg: '#ffffff', border: '1px solid #1f5a2e', color: '#1b2a1f', radius: '2px', hint: '#7d8a7f' },
                    },
                    btn: { bg: 'linear-gradient(135deg, #4e9a5e, #1f5a2e)', color: '#ffffff', border: '1px solid #d7f0dc', radius: '2px',
                           shadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.25), 0 2px 0 #0d2a16',
                           hover: 'filter: brightness(1.12); box-shadow: 0 0 0 1px #f2d21b, 0 0 12px rgba(111, 211, 255, 0.6) !important;', extra: 'font-weight: 700;' },
                    filled: { radius: '2px', border: '1px solid rgba(215, 240, 220, 0.85)', shadow: '0 2px 0 rgba(0, 0, 0, 0.4)' },
                    popup: { bg: '#123620', border: '1px solid #cfeed6', radius: '3px', hover: 'rgba(242, 210, 27, 0.2)', head: '#f2d21b', shadow: '0 0 0 3px #0a1f10, 0 14px 30px rgba(0, 0, 0, 0.55)' },
                    win: { border: '1px solid #cfeed6', radius: '3px', shadow: '0 0 0 3px #0a1f10, 0 16px 40px rgba(0, 0, 0, 0.55)', head: lab, headBorder: '2px solid #f2d21b', title: '#ffffff' },
                    panel: { radius: '2px', border: '#2f6b3c', pressed: '#f2d21b' },
                };
            },
            extra: (S, A, fx) => lightChatCss(S, '#1b2a1f', '#6b7a6e') + `
                ${S} .mcf-chat__header .mcf-chat__status { color: #3a3a1a !important; }
                ${S} .mcf-chat__send { background: #111111 !important; color: #f2d21b !important; border-color: #111111 !important; }
                ${S} .mcfo-bb-elements { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); display: flex; gap: 5px; pointer-events: none; }
                ${S} .mcfo-bb-elements svg { display: block; width: 38px; height: 42px; filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.5)); }
                ${fx(['full', 'subtle'], '.mcfo-bb-elements svg')} { animation: mcfoBbGlow 3.4s ease-in-out infinite alternate; }
                ${fx(['full', 'subtle'], '.mcfo-bb-elements svg + svg')} { animation-delay: 1.7s; }
                @keyframes mcfoBbGlow { from { filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.5)); } to { filter: drop-shadow(0 0 9px rgba(140, 255, 170, 0.75)); } }
                ${S} .mcfo-bb-hat { position: absolute; left: 34%; top: 50%; width: 30px; height: 30px; transform: translate(-50%, -50%); pointer-events: none;
                    background: url("${A.hat}") center / contain no-repeat; }`,
            decor: [
                { cls: 'mcfo-bb-elements', host: () => role('top-status-region'), html: elementTileSvg(35, 'Br', '79.904', 'mcfoBbBr', true) + elementTileSvg(56, 'Ba', '137.33', 'mcfoBbBa', true) },
                { cls: 'mcfo-bb-hat', host: () => document.querySelector('.mcf-chat__header'), html: '' },
            ],
            particles: [drifters('crystal', () => document.querySelector('.mcf-chat:not([data-collapsed="true"])'), 11,
                (w, h, any) => {
                    const s = rnd(3, 6.5), n = 5, pts = [];
                    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + rnd(-0.3, 0.3), d = s * rnd(0.6, 1.3); pts.push([Math.cos(a) * d, Math.sin(a) * d * 0.7]); }
                    return { x: rnd(8, w - 8), y: any ? rnd(0, h) : -10, v: rnd(8, 18), a: rnd(0, 6), spin: rnd(-1, 1), ph: rnd(0, 6), pts };
                },
                (p, dt, now, w, h) => { p.y += p.v * dt; p.x += Math.sin(now / 900 + p.ph) * 5 * dt; return p.y < h + 10; },
                crystalDraw)],
            tile: A => `background: url("${A.br}") 30% 50% / 24px 27px no-repeat, url("${A.ba}") 66% 50% / 24px 27px no-repeat,
                        repeating-linear-gradient(-45deg, #f2d21b 0 5px, #111111 5px 10px) 0 100% / 100% 4px no-repeat, linear-gradient(180deg, #c49a4a, #76511f);`,
        }),

        // ---- Back to the Future: the time circuits, the flux capacitor, trails of fire ----
        // On top of the chat sit the three rows of the time circuits — where you are going, where you
        // are (the real date and time, live), where you last left. Brushed steel, a plate that reads
        // OUTATIME, and the clock tower stopped at 10:04.
        outatime: deluxe({
            assets: () => ({ fire: fireTrailsSvg(), tower: clockTowerSvg(), stars: starField(1955, 60, 0.75) }),
            kit: A => {
                const steel = 'repeating-linear-gradient(180deg, rgba(255, 255, 255, 0.07) 0 1px, rgba(0, 0, 0, 0.06) 1px 3px), linear-gradient(180deg, #b4bac1, #7d838a 48%, #5c6167 52%, #9aa0a6)';
                return {
                    titleCss: 'font-family: "Arial Black", "Helvetica Neue", Arial, sans-serif; font-style: italic; font-weight: 900; background: linear-gradient(180deg, #fff06a 0%, #ffb000 45%, #ff5a1f 55%, #c21e00 100%); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; filter: drop-shadow(0 1px 0 #3a0a00);',
                    ground: `url("${A.fire}") 50% 100% / 100% 34% no-repeat, url("${A.tower}") 3% 7% / auto 150px no-repeat, ${A.stars},
                             linear-gradient(180deg, #070b1d 0%, #151a3a 50%, #3a1f3a 82%, #5a2a2a 100%)`,
                    header: { bg: steel, border: '2px solid #2b2e33', extra: 'box-shadow: 0 2px 0 #ff8a00, 0 8px 20px rgba(0, 0, 0, 0.5) !important;' },
                    cards: { bg: 'linear-gradient(180deg, #16181c, #0b0c0e)', border: '1px solid #ff8a00', radius: '3px', shadow: 'inset 0 0 0 1px #000000, 0 0 8px rgba(255, 138, 0, 0.3)' },
                    footer: { bg: 'repeating-linear-gradient(90deg, rgba(255, 255, 255, 0.02) 0 1px, transparent 1px 3px), linear-gradient(180deg, #202328, #0f1114)', border: '2px solid #ff8a00' },
                    chat: {
                        bg: 'repeating-linear-gradient(90deg, rgba(255, 255, 255, 0.025) 0 1px, transparent 1px 3px), linear-gradient(180deg, #2c3036 0, #1a1c20 124px, #121417 100%)',
                        border: '2px solid #8d939a', radius: '6px', pad: '124px 0 0',
                        shadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.2), 0 0 0 1px #000000',
                        head: 'linear-gradient(180deg, #33373d, #1d2024)', headBorder: '2px solid #ff8a00', headText: '#ffd08a',
                        body: 'rgba(0, 0, 0, 0.25)', comp: '#16181b', compBorder: '1px solid #3a3e44',
                        input: { bg: '#0b0c0e', border: '1px solid #ff8a00', color: '#ffe7c2', radius: '3px', hint: '#8a7a64' },
                    },
                    btn: { bg: 'linear-gradient(180deg, #f5f6f7 0%, #c3c8cd 45%, #8e949a 52%, #d9dde0 100%)', color: '#16181b', border: '1px solid #4d5258', radius: '4px',
                           shadow: 'inset 0 1px 0 #ffffff, 0 2px 0 #1a1c1f',
                           hover: 'box-shadow: inset 0 1px 0 #ffffff, 0 0 0 1px #ff8a00, 0 0 12px rgba(255, 138, 0, 0.65) !important;', extra: 'font-weight: 800;' },
                    filled: { radius: '4px', border: '1px solid rgba(230, 233, 236, 0.85)', shadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.3), 0 2px 0 rgba(0, 0, 0, 0.5)' },
                    popup: { bg: '#15171b', border: '1px solid #ff8a00', radius: '5px', hover: 'rgba(255, 138, 0, 0.18)', head: '#ffb000', shadow: '0 0 0 1px #000000, 0 0 16px rgba(255, 138, 0, 0.25), 0 12px 30px rgba(0, 0, 0, 0.65)' },
                    win: { border: '2px solid #8d939a', radius: '6px', shadow: '0 0 0 1px #000000, 0 16px 40px rgba(0, 0, 0, 0.65)', head: steel, headBorder: '2px solid #ff8a00', title: '#16181b' },
                    panel: { radius: '4px', border: '#4d5258', pressed: '#ff8a00' },
                };
            },
            extra: (S, A, fx) => `
                ${S} .mcfo-win__title { -webkit-text-fill-color: #16181b; background: none; filter: none; }
                ${S} .mcfo-bttf-tc { position: absolute; top: 8px; left: 50%; width: min(236px, calc(100% - 16px)); transform: translateX(-50%); display: grid; gap: 3px; pointer-events: none; }
                ${S} .mcfo-bttf-tc i { display: block; }
                ${S} .mcfo-bttf-tc svg { display: block; width: 100%; height: auto; }
                ${fx(['full', 'subtle'], '.mcfo-tc-colon')} { animation: mcfoTcBlink 1s steps(1) infinite; }
                @keyframes mcfoTcBlink { 50% { opacity: 0.12; } }
                ${S} .mcfo-bttf-flux { position: absolute; left: 34%; top: 50%; width: 21px; height: 25px; transform: translate(-50%, -50%); pointer-events: none; filter: drop-shadow(0 0 3px rgba(255, 244, 176, 0.5)); }
                ${S} .mcfo-bttf-flux svg { display: block; width: 100%; height: 100%; }
                ${fx(['full', 'subtle'], '.mcfo-flux-pulse')} { animation: mcfoFlux 0.45s linear infinite; }
                @keyframes mcfoFlux { to { stroke-dashoffset: -4.4; } }
                ${S} .mcfo-bttf-plate { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: 106px; height: 42px; box-sizing: border-box; pointer-events: none;
                    border-radius: 5px; border: 2px solid #c9ced3; box-shadow: 0 0 0 1px #2b2e33, 0 3px 8px rgba(0, 0, 0, 0.5);
                    background: radial-gradient(circle at 16% 17%, #8d939a 0 1.8px, transparent 2.3px), radial-gradient(circle at 84% 17%, #8d939a 0 1.8px, transparent 2.3px), linear-gradient(180deg, #fbfbf6, #e2e2d9); }
                ${S} .mcfo-bttf-plate b { position: absolute; top: 3px; left: 0; right: 0; text-align: center; font: italic 700 10px/1 "Brush Script MT", "Segoe Script", "URW Chancery L", cursive; color: #c21e2a; }
                ${S} .mcfo-bttf-plate svg { position: absolute; bottom: 4px; left: 6px; width: calc(100% - 12px); height: 22px; }`,
            decor: [
                { cls: 'mcfo-bttf-tc', host: () => document.querySelector('.mcf-chat'),
                  html: `<i>${tcRow('d', 'DESTINATION TIME', TC_COL.dest, 'OCT', '21', '2015', true, '04', '29')}</i><i></i><i>${tcRow('l', 'LAST TIME DEPARTED', TC_COL.last, 'OCT', '26', '1985', false, '01', '21')}</i>`,
                  place: el => {
                      const n = new Date(), k = n.toDateString() + n.getHours() + ':' + n.getMinutes();
                      if (el.dataset.k !== k && el.children[1]) { el.dataset.k = k; el.children[1].innerHTML = tcNowRow(); }
                  } },
                { cls: 'mcfo-bttf-flux', host: () => document.querySelector('.mcf-chat__header'), html: FLUX_SVG },
                // The letters as a drawing, squeezed to the plate — whatever narrow font the system has.
                { cls: 'mcfo-bttf-plate', host: () => role('top-status-region'),
                  html: '<b>California</b><svg viewBox="0 0 100 22" preserveAspectRatio="none"><text x="50" y="20" text-anchor="middle" textLength="96" lengthAdjust="spacingAndGlyphs" '
                      + 'font-family="Arial Narrow, Roboto Condensed, DejaVu Sans Condensed, Arial, sans-serif" font-weight="700" font-size="23" fill="#1b3f8f">OUTATIME</text></svg>' },
            ],
            // Blue sparks around the circuits, as when the car is about to go.
            particles: [drifters('sparks', () => document.querySelector('.mcf-chat:not([data-collapsed="true"])'), 3,
                (w, h) => ({ x: rnd(10, w - 10), y: rnd(4, 120), t: -rnd(0.4, 3.5), life: rnd(0.12, 0.35), len: rnd(10, 22), a: rnd(0, Math.PI * 2) }),
                p => (p.t += 1 / 30) < p.life,
                (g, p) => {
                    if (p.t < 0) return;
                    g.globalAlpha = 0.9; g.strokeStyle = '#bfe3ff'; g.lineWidth = 1.2; g.shadowColor = '#6fb8ff'; g.shadowBlur = 8;
                    g.beginPath(); g.moveTo(p.x, p.y);
                    let x = p.x, y = p.y;
                    for (let i = 0; i < 5; i++) { x += Math.cos(p.a) * p.len / 5 + rnd(-3, 3); y += Math.sin(p.a) * p.len / 5 + rnd(-3, 3); g.lineTo(x, y); }
                    g.stroke(); g.shadowBlur = 0;
                })],
            tile: A => `background: url("${A.fire}") 50% 100% / 100% 60% no-repeat, radial-gradient(circle at 22% 38%, #ff3b2f 0 2px, transparent 2.5px),
                        radial-gradient(circle at 30% 38%, #3dff6e 0 2px, transparent 2.5px), radial-gradient(circle at 38% 38%, #ffb000 0 2px, transparent 2.5px),
                        linear-gradient(180deg, #070b1d, #3a1f3a 70%, #5a2a2a); box-shadow: inset 0 0 0 2px #8d939a;`,
        }),

        // ---- Everything Everywhere All at Once: googly eyes that watch you, the bagel ----
        // The eyes follow the pointer. The ground is the multiverse coming apart in shards.
        multiverse: deluxe({
            assets: () => ({ shards: shardsSvg(), bagel: bagelSvg(), words: bigWordsSvg('rgba(255, 255, 255, 0.17)') }),
            kit: A => {
                const ink = '#1b1b1b', red = '#c8102e';
                return {
                    titleCss: `font-family: ${CONDENSED_FONT}; text-transform: uppercase; letter-spacing: 0.06em; font-weight: 700;`,
                    ground: `url("${A.shards}") 0 0 / 420px 420px, radial-gradient(ellipse at 50% 30%, rgba(200, 16, 46, 0.25), transparent 60%), linear-gradient(180deg, #25101a, #12060b)`,
                    header: { bg: `url("${A.words}") center / calc(100% - 24px) 82% no-repeat, ${red}`, border: `3px solid ${ink}` },
                    cards: { bg: '#1b0a10', border: '2px solid #fefcfa', radius: '10px', shadow: `3px 3px 0 ${ink}` },
                    footer: { bg: 'linear-gradient(180deg, #1e0b12, #12060b)', border: '4px solid', extra: 'border-image: linear-gradient(90deg, #ff2a6d, #ffd319, #3ddc84, #05d9e8, #7b2cbf, #ff2a6d) 1;' },
                    chat: {
                        bg: 'radial-gradient(circle, rgba(200, 16, 46, 0.07) 0 1.2px, transparent 1.6px) 0 0 / 9px 9px, #fefcfa', border: `3px solid ${ink}`, radius: '16px',
                        shadow: `inset 0 0 0 2px #fefcfa, inset 0 0 0 4px ${red}`,
                        head: red, headBorder: `3px solid ${ink}`, headText: '#fefcfa',
                        body: 'transparent', comp: '#f3ece6', compBorder: `3px solid ${ink}`,
                        input: { bg: '#ffffff', border: `2px solid ${ink}`, color: ink, radius: '999px', hint: '#9a8a8a' },
                    },
                    btn: { bg: '#fefcfa', color: ink, border: `2px solid ${ink}`, radius: '999px', shadow: `3px 3px 0 ${red}`,
                           hover: `transform: translate(-1px, -1px); box-shadow: 4px 4px 0 ${red} !important;`, extra: `font-family: ${CONDENSED_FONT}; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em;` },
                    filled: { radius: '999px', border: `2px solid ${ink}`, shadow: `2px 2px 0 ${ink}` },
                    popup: { bg: '#fefcfa', border: `3px solid ${ink}`, radius: '14px', hover: 'rgba(200, 16, 46, 0.14)', head: red, shadow: `5px 5px 0 ${red}` },
                    win: { border: `3px solid ${ink}`, radius: '16px', shadow: `6px 6px 0 ${red}`, head: red, headBorder: `3px solid ${ink}`, title: '#fefcfa' },
                    panel: { radius: '12px', border: '#6a3040', pressed: red },
                };
            },
            extra: (S, A, fx) => lightChatCss(S, '#1b1b1b', '#8a6a6a') + `
                ${S} :is(.mcfo-menu, .mcf-chat__suggestions, [data-role="sound-utility-panel"]) { color: #1b1b1b !important; }
                ${S} .mcf-chat__header .mcf-chat__status { color: #ffd9de !important; }
                ${S} .mcf-chat__send { background: #c8102e !important; color: #fefcfa !important; box-shadow: 3px 3px 0 #1b1b1b !important; }
                ${S} .mcfo-eye { position: relative; display: block; flex: none; width: 26px; height: 26px; border-radius: 50%;
                    background: radial-gradient(circle at 36% 30%, #ffffff, #efefef 55%, #cfcfcf); box-shadow: 0 0 0 1.5px #1b1b1b, 0 2px 3px rgba(0, 0, 0, 0.45), inset 0 -2px 3px rgba(0, 0, 0, 0.15); }
                ${S} .mcfo-eye b { position: absolute; left: 50%; top: 50%; width: 52%; height: 52%; border-radius: 50%; background: #111111;
                    transform: translate(calc(-50% + var(--dx, 0px)), calc(-50% + var(--dy, 4px))); transition: transform 0.18s cubic-bezier(0.3, 1.7, 0.5, 1); }
                ${S} .mcfo-eye::after { content: ''; position: absolute; left: 20%; top: 13%; width: 28%; height: 17%; border-radius: 50%; background: rgba(255, 255, 255, 0.85); transform: rotate(-30deg); }
                ${S} .mcfo-mv-top { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); display: flex; align-items: center; gap: 10px; pointer-events: none; }
                ${S} .mcfo-mv-top .mcfo-eye:first-child { width: 34px; height: 34px; rotate: -8deg; }
                ${S} .mcfo-mv-top .mcfo-eye:last-child { width: 22px; height: 22px; margin-top: -14px; }
                ${S} .mcfo-mv-bagel { display: block; width: 46px; height: 46px; background: url("${A.bagel}") center / contain no-repeat; filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.5)); }
                ${fx(['full', 'subtle'], '.mcfo-mv-bagel')} { animation: mcfoMvBagel 16s linear infinite; }
                @keyframes mcfoMvBagel { to { rotate: 360deg; } }
                ${S} .mcfo-mv-third { position: absolute; left: 34%; top: 50%; transform: translate(-50%, -50%); pointer-events: none; }
                ${S} .mcfo-mv-third .mcfo-eye { width: 22px; height: 22px; }`,
            decor: [
                { cls: 'mcfo-mv-top', host: () => role('top-status-region'), html: `${EYE}<span class="mcfo-mv-bagel"></span>${EYE}` },
                { cls: 'mcfo-mv-third', host: () => document.querySelector('.mcf-chat__header'), html: EYE },
            ],
            pointer: (x, y) => {
                for (const e of document.querySelectorAll('.mcfo-eye')) {
                    const r = e.getBoundingClientRect();
                    if (!r.width) continue;
                    const dx = x - (r.left + r.width / 2), dy = y - (r.top + r.height / 2), d = Math.hypot(dx, dy) || 1, k = Math.min(1, d / 90) * r.width * 0.24;
                    e.style.setProperty('--dx', (dx / d * k).toFixed(1) + 'px');
                    e.style.setProperty('--dy', (dy / d * k).toFixed(1) + 'px');
                }
            },
            particles: [drifters('multiverse', () => document.querySelector('.mcf-chat:not([data-collapsed="true"])'), 16,
                (w, h, any) => ({ x: rnd(8, w - 8), y: any ? rnd(0, h) : -12, v: rnd(10, 22), ph: rnd(0, 6), k: Math.floor(rnd(0, 4)), s: rnd(4, 8),
                                  c: pickOf(Math.random, ['#ff2a6d', '#05d9e8', '#ffd319', '#c8102e', '#7b2cbf', '#3ddc84']) }),
                (p, dt, now, w, h) => { p.y += p.v * dt; p.x += Math.sin(now / 700 + p.ph) * 10 * dt; return p.y < h + 12; },
                (g, p, now) => {
                    g.globalAlpha = 0.6;
                    if (p.k === 0) {
                        g.fillStyle = '#ffffff'; g.strokeStyle = '#1b1b1b'; g.lineWidth = 1;
                        g.beginPath(); g.arc(p.x, p.y, p.s, 0, Math.PI * 2); g.fill(); g.stroke();
                        g.fillStyle = '#1b1b1b';
                        g.beginPath(); g.arc(p.x + Math.sin(now / 260 + p.ph) * p.s * 0.35, p.y + Math.abs(Math.cos(now / 330 + p.ph)) * p.s * 0.35, p.s * 0.5, 0, Math.PI * 2); g.fill();
                        return;
                    }
                    g.save(); g.translate(p.x, p.y); g.rotate(now / 500 + p.ph); g.fillStyle = p.c;
                    if (p.k === 1) g.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
                    else if (p.k === 2) { g.beginPath(); g.moveTo(0, -p.s / 2); g.lineTo(p.s / 2, p.s / 2); g.lineTo(-p.s / 2, p.s / 2); g.fill(); }
                    else { g.beginPath(); g.arc(0, 0, p.s / 2.5, 0, Math.PI * 2); g.fill(); }
                    g.restore();
                })],
            tile: A => `background: url("${A.bagel}") 60% 50% / 34px 34px no-repeat,
                        radial-gradient(circle at 28% 42%, #111111 0 3.5px, transparent 4px), radial-gradient(circle at 26% 40%, #ffffff 0 8px, #1b1b1b 8px 9.5px, transparent 10px),
                        url("${A.words}") center / 100% 60% no-repeat, #c8102e; box-shadow: inset 0 0 0 2px #1b1b1b;`,
        }),

        // ---- Star Wars: the crawl, lightsabers, a hologram for a chat ----
        // Above the chat the opening crawl runs, with our own story. The buttons are lightsabers —
        // blue, the rebellion and the unbid red, autobid green. Fighters chase through the header.
        farfaraway: deluxe({
            assets: () => ({ near: starField(77, 60, 0.9), far: starField(1977, 70, 0.4), ds: deathStarSvg(), crawlSky: starField(5, 36, 0.75) }),
            kit: A => {
                const panel = 'linear-gradient(90deg, rgba(0, 0, 0, 0.45) 0 1px, transparent 1px) 0 0 / 96px 100%, linear-gradient(180deg, rgba(255, 255, 255, 0.06), transparent 40%), linear-gradient(180deg, #2b2e33, #15171a)';
                return {
                    titleCss: `font-family: ${GEO_FONT}; font-weight: 700; text-transform: uppercase; letter-spacing: 0.22em;`,
                    ground: `url("${A.ds}") right 4% top 5% / 130px 130px no-repeat, ${A.near}, ${A.far},
                             radial-gradient(ellipse at 18% 82%, rgba(90, 60, 160, 0.24), transparent 55%), radial-gradient(ellipse at 85% 20%, rgba(40, 90, 170, 0.18), transparent 50%), #03040a`,
                    header: { bg: panel, border: '1px solid #4a4f56', extra: 'box-shadow: 0 1px 0 #000000, 0 6px 18px rgba(0, 0, 0, 0.6) !important;' },
                    cards: { bg: 'linear-gradient(180deg, #202328, #121417)', border: '1px solid #50565e', radius: '2px', shadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.08), inset 0 -2px 0 rgba(0, 0, 0, 0.4)' },
                    footer: { bg: panel, border: '1px solid #4a4f56', extra: 'isolation: isolate;' },
                    chat: {
                        bg: 'repeating-linear-gradient(180deg, rgba(120, 200, 255, 0.07) 0 1px, transparent 1px 3px), radial-gradient(ellipse at 50% 100%, rgba(79, 179, 255, 0.28), transparent 70%), rgba(4, 14, 26, 0.94)',
                        border: '1px solid rgba(79, 179, 255, 0.85)', radius: '4px', pad: '112px 0 0',
                        shadow: '0 0 12px rgba(79, 179, 255, 0.45), inset 0 0 18px rgba(79, 179, 255, 0.2)',
                        head: 'rgba(79, 179, 255, 0.12)', headBorder: '1px solid rgba(79, 179, 255, 0.5)', headText: '#a8dcff',
                        body: 'transparent', comp: 'rgba(79, 179, 255, 0.08)', compBorder: '1px solid rgba(79, 179, 255, 0.4)',
                        input: { bg: 'rgba(2, 10, 20, 0.85)', border: '1px solid rgba(79, 179, 255, 0.7)', color: '#d8f0ff', radius: '2px', hint: 'rgba(140, 200, 240, 0.7)' },
                    },
                    btn: { bg: saberBg('#bfe6ff'), color: '#062238', border: '0', radius: '3px 999px 999px 3px', shadow: saberGlow('#4fb3ff'),
                           hover: `box-shadow: ${saberGlow('#4fb3ff', 1.7)} !important;`, extra: `font-family: ${GEO_FONT}; font-weight: 700; letter-spacing: 0.04em;` },
                    filled: { radius: '3px 999px 999px 3px', border: '0', shadow: '0 0 6px rgba(255, 255, 255, 0.35)' },
                    popup: { bg: 'rgba(16, 18, 21, 0.97)', border: '1px solid #50565e', radius: '3px', hover: 'rgba(79, 179, 255, 0.18)', head: '#ffe81f',
                             shadow: '0 0 0 1px #000000, 0 12px 30px rgba(0, 0, 0, 0.7)' },
                    win: { border: '1px solid #50565e', radius: '3px', shadow: '0 0 0 1px #000000, 0 16px 40px rgba(0, 0, 0, 0.7)', head: panel, headBorder: '1px solid #4a4f56', title: '#ffe81f' },
                    panel: { radius: '2px', border: '#3a3f46', pressed: '#ffe81f' },
                };
            },
            extra: (S, A, fx) => `
                ${S} .mcf-chat__header .mcf-chat__title strong { color: #ffe81f !important; }
                ${S} [data-role="action-region"] > .mcfo-skin-canvas { z-index: -1; }
                ${S} .mcf-chat__message:not(.mcf-chat__message--cosmetic):not(.mcf-chat__message--royal) .mcf-chat__text:not([class*="mcf-chat__text--"]) { color: #d4eeff !important; text-shadow: 0 0 5px rgba(79, 179, 255, 0.55); }
                ${S} :is(.mcfo-rebellion, .mcfo-unbid) { background: ${saberBg('#ffb0b0')} !important; box-shadow: ${saberGlow('#ff2a2a')} !important; color: #3a0505 !important; }
                ${S} :is(.mcfo-rebellion, .mcfo-unbid):hover:not(:disabled) { box-shadow: ${saberGlow('#ff2a2a', 1.7)} !important; }
                ${S} .mcfo-autobid { background: ${saberBg('#c4ffbf')} !important; box-shadow: ${saberGlow('#3dff4e')} !important; color: #062a0a !important; }
                /* Text buttons make room for the hilt; buttons that only carry a symbol are blade alone. */
                ${S} :is(.mcf-chat__send, .mcfo-rebellion, .mcfo-unbid, .mcfo-autobid, .mcfo-rail-toggle, .mcfo-signpost, [data-role="diamonds-purchase-link"], [data-role="nav-region"] > :is(button, a)) { padding-left: 16px !important; }
                ${S} :is(.mcf-chat__collapse, .mcf-chat__cosmetics-toggle, .mcfo-chatpop-btn, .mcfo-gear, .mcfo-drink--icon, .mcfo-win__head button, [data-role="sound-utility-toggle"]) {
                    background: linear-gradient(180deg, #bfe6ff 0%, #ffffff 35% 65%, #bfe6ff 100%) !important; border-radius: 999px !important; }
                ${fx(['full'], '.mcf-chat:not([data-collapsed="true"])')} { animation: mcfoHolo 9s steps(1) infinite; }
                @keyframes mcfoHolo { 0%, 96% { opacity: 1; } 96.5% { opacity: 0.86; } 97% { opacity: 1; } 98% { opacity: 0.9; } 98.4% { opacity: 1; } }
                ${S} .mcfo-sw-crawl { position: absolute; top: 0; left: 0; right: 0; height: 112px; overflow: hidden; pointer-events: none; border-radius: 3px 3px 0 0;
                    background: ${A.crawlSky}, #01020a; border-bottom: 1px solid rgba(79, 179, 255, 0.5); }
                ${S} .mcfo-sw-crawl em { position: absolute; top: 6px; left: 0; right: 0; text-align: center; font: italic 10px/1 ${GEO_FONT}; color: #4bd5ee; letter-spacing: 0.04em; }
                ${S} .mcfo-sw-crawl span { position: absolute; top: 18px; left: 0; right: 0; bottom: 0; perspective: 140px; overflow: hidden;
                    -webkit-mask-image: linear-gradient(180deg, transparent 0, #000000 55%); mask-image: linear-gradient(180deg, transparent 0, #000000 55%); }
                ${S} .mcfo-sw-crawl i { position: absolute; top: 100%; left: 10%; right: 10%; font: 700 11px/1.35 ${GEO_FONT}; font-style: normal; color: #ffe81f; text-align: justify;
                    transform-origin: 50% 0; transform: rotateX(32deg) translateY(-55%); }
                ${fx(['full', 'subtle'], '.mcfo-sw-crawl i')} { animation: mcfoCrawl 46s linear infinite; }
                @keyframes mcfoCrawl { from { transform: rotateX(32deg) translateY(0); } to { transform: rotateX(32deg) translateY(calc(-100% - 140px)); } }
                ${S} .mcfo-sw-crawl b { display: block; text-align: center; font-weight: 700; text-transform: uppercase; letter-spacing: 0.2em; font-size: 10px; }
                ${S} .mcfo-sw-crawl strong { display: block; text-align: center; font-size: 15px; letter-spacing: 0.08em; margin: 2px 0 8px; }
                ${S} .mcfo-sw-crawl p { margin: 0 0 8px; }
                ${S} .mcfo-sw-panel { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); display: grid; grid-template-columns: repeat(8, 9px); gap: 4px 3px; pointer-events: none;
                    padding: 6px 8px; background: #0c0d0f; border: 1px solid #4a4f56; border-radius: 2px; box-shadow: inset 0 0 6px #000000, 0 0 0 3px #1c1e22; }
                ${S} .mcfo-sw-panel i { display: block; height: 5px; background: #33383f; }
                ${S} .mcfo-sw-panel i:nth-child(3n+1) { background: #ff3b3b; box-shadow: 0 0 4px #ff3b3b; }
                ${S} .mcfo-sw-panel i:nth-child(4n+2) { background: #4fb3ff; box-shadow: 0 0 4px #4fb3ff; }
                ${S} .mcfo-sw-panel i:nth-child(5n+3) { background: #5dff6a; box-shadow: 0 0 4px #5dff6a; }
                ${S} .mcfo-sw-panel i:nth-child(7n) { background: #ffe81f; box-shadow: 0 0 4px #ffe81f; }
                ${fx(['full', 'subtle'], '.mcfo-sw-panel i:nth-child(2n)')} { animation: mcfoSwBlink 1.7s steps(1) infinite; }
                ${fx(['full', 'subtle'], '.mcfo-sw-panel i:nth-child(3n)')} { animation: mcfoSwBlink 2.3s steps(1) 0.4s infinite; }
                @keyframes mcfoSwBlink { 50% { opacity: 0.2; } }`,
            decor: [
                { cls: 'mcfo-sw-crawl', host: () => document.querySelector('.mcf-chat'), html: CRAWL },
                { cls: 'mcfo-sw-panel', host: () => role('top-status-region'), html: '<i></i>'.repeat(16) },
            ],
            // A dogfight through the footer: an X-wing, a TIE fighter on its tail, green bolts. In the
            // header it flew behind the cards and was hardly seen (6.16.1).
            particles: [drifters('dogfight', () => role('action-region'), 2,
                (w, h, any) => { const dir = Math.random() < 0.5 ? 1 : -1; return { dir, x: any ? rnd(0, w) : (dir > 0 ? -80 : w + 80), y: rnd(14, h - 14), v: rnd(70, 120), ph: rnd(0, 6), gap: rnd(40, 70) }; },
                (p, dt, now, w) => { p.x += p.dir * p.v * dt; p.y += Math.sin(now / 400 + p.ph) * 8 * dt; return p.dir > 0 ? p.x < w + 120 : p.x > -120; },
                (g, p, now) => {
                    const tx = p.x - p.dir * p.gap, ty = p.y + Math.sin(now / 300 + p.ph) * 4;
                    g.globalAlpha = 0.9;
                    xWing(g, p.x, p.y, 9, p.dir);
                    tieFighter(g, tx, ty, 7.5);
                    const shot = (now / 1000 * 2.4 + p.ph) % 1;
                    if (shot < 0.35) {
                        g.strokeStyle = '#5dff6a'; g.lineWidth = 1.6; g.shadowColor = '#5dff6a'; g.shadowBlur = 6;
                        const sx = tx + p.dir * (10 + shot * 110);
                        g.beginPath(); g.moveTo(sx, ty); g.lineTo(sx + p.dir * 9, ty); g.stroke(); g.shadowBlur = 0;
                    }
                })],
            tile: A => `background: ${saberBg('#bfe6ff')} 20% 72% / 60% 5px no-repeat, url("${A.ds}") 84% 30% / 26px 26px no-repeat,
                        repeating-linear-gradient(180deg, transparent 0 5px, rgba(255, 232, 31, 0.55) 5px 6px) 50% 20% / 50% 18px no-repeat, ${A.crawlSky}, #03040a;`,
        }),

        // ---- Vertigo, as Saul Bass drew it: vermilion, black, cream, the spiral, the fall ----
        // Only flat shapes: a whirlpool over the ground, cut paper in the header, and inside the
        // cream chat the spiral turns while a man falls into it.
        saulbass: deluxe({
            assets: () => ({ spiral: spiralSvg('#1a0d08', 7, 2.6, 0.32), spiralInk: spiralSvg('#111111', 6, 3.2), spiralCream: spiralSvg('#f1e6cf', 5, 5),
                             man: fallingManSvg('#111111'), manRed: fallingManSvg('#d74219'), cutBlack: cutPaperSvg('#111111', 58, false), cutRed: cutPaperSvg('#d74219', 91, true) }),
            kit: A => ({
                titleCss: `font-family: ${GEO_FONT}; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3em;`,
                ground: `url("${A.spiral}") 50% 50% / 160vmax 160vmax no-repeat, radial-gradient(ellipse at 50% 50%, #e0501f, #c73a14 70%, #9e2c0e)`,
                header: { bg: `url("${A.cutBlack}") 0 100% / 640px 70% repeat-x, url("${A.cutRed}") 140px 0 / 640px 45% repeat-x, #f1e6cf`, border: '3px solid #111111' },
                cards: { bg: '#111111', border: '0', radius: '0', shadow: '4px 4px 0 #d74219' },
                footer: { bg: '#111111', border: '4px solid #d74219' },
                chat: {
                    bg: '#f1e6cf', border: '3px solid #111111', radius: '0',
                    head: '#111111', headBorder: '0', headText: '#f1e6cf',
                    body: 'transparent', comp: '#111111', compBorder: '0',
                    input: { bg: '#f1e6cf', border: '0', color: '#111111', radius: '0', hint: '#8a5a44' },
                },
                btn: { bg: '#111111', color: '#f1e6cf', border: '0', radius: '0', shadow: '3px 3px 0 #d74219',
                       hover: 'background: #d74219 !important; color: #111111 !important; box-shadow: 3px 3px 0 #f1e6cf !important;',
                       extra: `font-family: ${GEO_FONT}; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em;` },
                filled: { radius: '0', border: '0', shadow: '3px 3px 0 #111111' },
                popup: { bg: '#111111', border: '2px solid #f1e6cf', radius: '0', hover: 'rgba(215, 66, 25, 0.55)', head: '#d74219', shadow: '6px 6px 0 #d74219' },
                win: { border: '3px solid #111111', radius: '0', shadow: '8px 8px 0 #d74219', head: '#d74219', headBorder: '3px solid #111111', title: '#111111' },
                panel: { radius: '0', border: '#6b3a22', pressed: '#d74219' },
            }),
            extra: (S, A, fx) => lightChatCss(S, '#111111', '#8a4a2c') + `
                ${S} .mcf-chat__send { background: #d74219 !important; color: #111111 !important; box-shadow: none !important; }
                ${S} .mcf-chat__header .mcf-chat__status { color: #d7a48a !important; }
                ${S} .mcfo-bass-whirl { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
                ${S} .mcfo-bass-whirl i { position: absolute; left: 50%; top: 56%; width: 160%; aspect-ratio: 1; translate: -50% -50%; background: url("${A.spiralInk}") center / contain no-repeat; opacity: 0.12; }
                ${S} .mcfo-bass-whirl b { position: absolute; left: 50%; top: 56%; width: 22%; aspect-ratio: 0.75; background: url("${A.man}") center / contain no-repeat; opacity: 0.2;
                    transform: translate(-50%, -50%) scale(0.8) rotate(20deg); }
                ${fx(['full', 'subtle'], '.mcfo-bass-whirl i')} { animation: mcfoBassTurn 40s linear infinite; }
                ${fx(['full'], '.mcfo-bass-whirl b')} { animation: mcfoBassFall 10s ease-in infinite; }
                @keyframes mcfoBassTurn { to { rotate: 360deg; } }
                @keyframes mcfoBassFall { from { transform: translate(-50%, -50%) scale(2.4) rotate(-40deg); opacity: 0; } 14% { opacity: 0.24; } 80% { opacity: 0.2; }
                    to { transform: translate(-50%, -50%) scale(0.04) rotate(320deg); opacity: 0; } }
                ${S} .mcfo-bass-top { position: absolute; left: 50%; top: 50%; width: 46px; height: 46px; transform: translate(-50%, -50%); pointer-events: none;
                    border-radius: 50%; background: #111111; box-shadow: 4px 4px 0 #d74219; }
                ${S} .mcfo-bass-top i { position: absolute; inset: 3px; background: url("${A.spiralCream}") center / contain no-repeat; }
                ${S} .mcfo-bass-top b { position: absolute; left: 50%; top: 50%; width: 26px; height: 34px; transform: translate(-50%, -50%); background: url("${A.manRed}") center / contain no-repeat; }
                ${fx(['full', 'subtle'], '.mcfo-bass-top i')} { animation: mcfoBassTurn 12s linear infinite reverse; }`,
            decor: [
                { cls: 'mcfo-bass-whirl', host: () => document.querySelector('.mcf-chat'), html: '<i></i><b></b>' },
                { cls: 'mcfo-bass-top', host: () => role('top-status-region'), html: '<i></i><b></b>' },
            ],
            tile: A => `background: url("${A.man}") 50% 50% / 20px 26px no-repeat, url("${A.spiralInk}") 50% 50% / 58px 58px no-repeat,
                        url("${A.cutBlack}") 0 100% / 120px 30% repeat-x, #d74219; box-shadow: inset 0 0 0 2px #111111;`,
        }),

        // ---- Cinema: velvet curtain, marquee lights, a strip of film, popcorn ----
        // The chat is the screen between two curtains under a valance with gold fringe; the header
        // a marquee with chasing bulbs, the footer a film strip with seats behind the board.
        cinema: deluxe({
            assets: () => ({ seatsFront: seatsSvg('#1a0306', '#3e0a12'), seatsBack: seatsSvg('#120204', '#2a060c'), grain: grainSvg(0.18) }),
            kit: A => {
                const velvet = 'linear-gradient(180deg, rgba(0, 0, 0, 0.3), transparent 30%, rgba(0, 0, 0, 0.45)), repeating-linear-gradient(90deg, #4a0710 0, #8c1624 14px, #5a0a14 26px, #3a050c 30px)';
                const bulbs = 'radial-gradient(circle, #fff6d0 0 2.2px, rgba(255, 205, 110, 0.6) 2.8px, transparent 4.5px)';
                const ticket = c => `radial-gradient(circle at 0 50%, transparent 0 5px, ${c} 5.5px) 0 0 / 51% 100% no-repeat, radial-gradient(circle at 100% 50%, transparent 0 5px, ${c} 5.5px) 100% 0 / 51% 100% no-repeat`;
                return {
                    titleCss: `font-family: ${DECO_FONT}; text-transform: uppercase; letter-spacing: 0.14em;`,
                    // The seats stand above the footer, which covers the bottom of the ground.
                    ground: `url("${A.grain}") 0 0 / 180px 180px, url("${A.seatsFront}") 0 calc(100% - 60px) / 60px 44px repeat-x, url("${A.seatsBack}") 30px calc(100% - 88px) / 60px 44px repeat-x,
                             conic-gradient(from 168deg at 50% -8%, transparent 0deg, rgba(255, 240, 200, 0.07) 8deg, rgba(255, 240, 200, 0.12) 12deg, rgba(255, 240, 200, 0.07) 16deg, transparent 24deg),
                             radial-gradient(ellipse at 50% 20%, #2a0a0e, #120405 70%)`,
                    header: { bg: `${bulbs} 0 3px / 20px 9px repeat-x, ${bulbs} 10px calc(100% - 3px) / 20px 9px repeat-x, linear-gradient(180deg, #2a0d0d, #140606)`, border: '3px solid #d4a64a' },
                    cards: { bg: 'rgba(16, 6, 6, 0.9)', border: '1px solid #d4a64a', radius: '4px', shadow: 'inset 0 0 0 1px rgba(255, 220, 150, 0.12)' },
                    footer: { bg: 'linear-gradient(90deg, #e9dfc7 0 8px, transparent 8px) 0 4px / 18px 6px repeat-x, linear-gradient(90deg, #e9dfc7 0 8px, transparent 8px) 0 calc(100% - 4px) / 18px 6px repeat-x, linear-gradient(180deg, #121010, #070606)',
                              border: '2px solid #d4a64a', extra: 'isolation: isolate;' },
                    chat: {
                        bg: velvet, border: '3px solid #d4a64a', radius: '4px', pad: '28px 14px 0',
                        shadow: 'inset 0 0 0 1px #3a2208, 0 0 0 1px #000000',
                        head: 'linear-gradient(180deg, #1c0b0d, #0f0607)', headBorder: '1px solid #d4a64a', headText: '#f1cf7a',
                        body: 'radial-gradient(ellipse at 50% 0%, rgba(255, 240, 210, 0.12), transparent 70%), #0d0b0b', comp: '#140809', compBorder: '1px solid #6a4a1a',
                        input: { bg: '#070505', border: '1px solid #d4a64a', color: '#f7ead0', radius: '3px', hint: '#8f7a5a' },
                    },
                    btn: { bg: ticket('#c8202c'), color: '#fff3d6', border: '0', radius: '2px', shadow: 'none',
                           hover: 'filter: brightness(1.14) drop-shadow(0 0 6px rgba(212, 166, 74, 0.85));',
                           extra: `font-family: ${DECO_FONT}; text-transform: uppercase; letter-spacing: 0.08em; filter: drop-shadow(0 2px 0 rgba(0, 0, 0, 0.55));` },
                    filled: { radius: '2px', border: '1px solid rgba(255, 243, 214, 0.7)', shadow: '0 2px 0 rgba(0, 0, 0, 0.5)' },
                    popup: { bg: '#1a0709', border: '2px solid #d4a64a', radius: '5px', hover: 'rgba(212, 166, 74, 0.2)', head: '#f1cf7a', shadow: '0 0 0 1px #000000, 0 0 18px rgba(212, 166, 74, 0.25), 0 12px 30px rgba(0, 0, 0, 0.7)' },
                    win: { border: '3px solid #d4a64a', radius: '5px', shadow: '0 0 0 1px #000000, 0 16px 40px rgba(0, 0, 0, 0.7)', head: velvet, headBorder: '2px solid #d4a64a', title: '#f1cf7a' },
                    panel: { radius: '4px', border: '#6a4a1a', pressed: '#f1cf7a' },
                };
            },
            extra: (S, A, fx) => `
                ${S} [data-role="action-region"] > .mcfo-skin-canvas { z-index: -1; }
                ${S} .mcfo-win__title { text-shadow: 0 1px 0 #000000; }
                ${fx(['full', 'subtle'], '[data-role="top-status-region"]')} { animation: mcfoCineBulbs 0.9s steps(2) infinite; }
                @keyframes mcfoCineBulbs { to { background-position: 10px 3px, 20px calc(100% - 3px), 0 0; } }
                ${fx(['full', 'subtle'], '[data-role="action-region"]')} { animation: mcfoCineFilm 1.2s linear infinite; }
                @keyframes mcfoCineFilm { to { background-position: 18px 4px, 18px calc(100% - 4px), 0 0; } }
                ${S} .mcfo-cine-valance { position: absolute; top: 0; left: 0; right: 0; height: 30px; pointer-events: none; z-index: 2;
                    background: linear-gradient(180deg, #f1cf7a, #8a6a24) 0 0 / 100% 4px no-repeat,
                                repeating-linear-gradient(90deg, #d4a64a 0 1px, transparent 1px 3px) 0 20px / 100% 9px no-repeat,
                                radial-gradient(circle at 50% 0, #a51c2c 0 13px, #6a0e18 13.5px 15px, transparent 15.5px) 0 4px / 30px 17px repeat-x,
                                linear-gradient(180deg, #7a1220, #5a0a14) 0 0 / 100% 12px no-repeat; }
                ${S} .mcfo-cine-marquee { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); padding: 5px 9px; border-radius: 4px; pointer-events: none;
                    background: radial-gradient(circle, #fff6d0 0 1.8px, rgba(255, 205, 110, 0.6) 2.3px, transparent 3.6px) 0 0 / 8px 8px, #3a1010; box-shadow: 0 0 0 2px #d4a64a, 0 0 16px rgba(255, 205, 110, 0.35); }
                ${fx(['full', 'subtle'], '.mcfo-cine-marquee')} { animation: mcfoCineChase 0.8s steps(2) infinite; }
                @keyframes mcfoCineChase { to { background-position: 8px 0, 0 0; } }
                ${S} .mcfo-cine-marquee i { display: block; padding: 2px 14px 3px; text-align: center; font-style: normal; white-space: nowrap;
                    background: linear-gradient(180deg, #fffdf5, #efe5c8); box-shadow: inset 0 0 6px rgba(0, 0, 0, 0.25); }
                ${S} .mcfo-cine-marquee small { display: block; font: 700 7px/1.3 ${GEO_FONT}; letter-spacing: 0.42em; color: #b3141f; }
                ${S} .mcfo-cine-marquee b { display: block; font: 700 17px/1 ${CONDENSED_FONT}; letter-spacing: 0.16em; color: #111111; }
                ${S} .mcfo-cine-clap { position: absolute; left: 28%; top: 50%; width: 26px; height: 24px; transform: translate(-50%, -50%); pointer-events: none; filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.6)); }
                ${S} .mcfo-cine-clap svg { display: block; width: 100%; height: 100%; overflow: visible; }
                ${S} .mcfo-cine-clap .mcfo-clap-stick { transform-box: view-box; transform-origin: 2px 9px; }
                ${fx(['full', 'subtle'], '.mcfo-cine-clap .mcfo-clap-stick')} { animation: mcfoCineClap 5s ease-in infinite; }
                @keyframes mcfoCineClap { 0%, 70% { transform: rotate(-22deg); } 76% { transform: rotate(0deg); } 80% { transform: rotate(-6deg); } 84%, 100% { transform: rotate(-22deg); } }`,
            decor: [
                { cls: 'mcfo-cine-valance', host: () => document.querySelector('.mcf-chat'), html: '' },
                { cls: 'mcfo-cine-marquee', host: () => role('top-status-region'), html: '<i><small>Now showing</small><b>MARBLE CROWNFALL</b></i>' },
                { cls: 'mcfo-cine-clap', host: () => document.querySelector('.mcf-chat__header'), html: CLAPPER_SVG },
            ],
            particles: [
                // Dust in the light of the projector.
                drifters('dust', () => document.querySelector('.mcf-chat:not([data-collapsed="true"])'), 22,
                    (w, h, any) => ({ x: rnd(0, w), y: any ? rnd(0, h) : rnd(0, h), v: rnd(-4, 4), u: rnd(-3, 3), ph: rnd(0, 6), r: rnd(0.5, 1.3), t: 0, life: rnd(6, 14) }),
                    (p, dt) => { p.x += p.v * dt; p.y += p.u * dt; p.t += dt; return p.t < p.life; },
                    (g, p, now) => { const a = Math.sin(p.t / p.life * Math.PI) * (0.35 + 0.25 * Math.sin(now / 500 + p.ph)); glowDot(g, p.x, p.y, p.r * 3, '255, 240, 210', a); }),
                // Popcorn jumping out of the film strip.
                drifters('popcorn', () => role('action-region'), 5,
                    (w, h, any) => ({ x: rnd(10, w - 10), y: h + 8, vy: -rnd(70, 115), vx: rnd(-18, 18), s: rnd(3, 4.5), wait: any ? rnd(0, 4) : rnd(0.5, 5),
                                      puffs: Array.from({ length: 4 }, (_, i) => [rnd(-0.7, 0.7), rnd(-0.7, 0.7), i % 2]) }),
                    (p, dt, now, w, h) => { if ((p.wait -= dt) > 0) return true; p.vy += 190 * dt; p.y += p.vy * dt; p.x += p.vx * dt; return p.y < h + 12; },
                    (g, p) => { if (p.wait <= 0) popcornDraw(g, p); }),
            ],
            tile: () => `background: radial-gradient(circle, #fff6d0 0 1.6px, transparent 2.6px) 0 1px / 9px 6px repeat-x,
                        linear-gradient(90deg, #e9dfc7 0 4px, transparent 4px) 0 calc(100% - 2px) / 9px 3px repeat-x,
                        linear-gradient(180deg, #0d0b0b 0 10%, transparent 10% 88%, #0d0b0b 88%),
                        linear-gradient(90deg, transparent 0 28%, #1a1414 28% 72%, transparent 72%),
                        repeating-linear-gradient(90deg, #4a0710 0, #8c1624 5px, #3a050c 9px); box-shadow: inset 0 0 0 2px #d4a64a;`,
        }),
    });

