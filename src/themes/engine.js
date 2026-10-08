    // =========================================================================================
    // 3b. THEMES
    // =========================================================================================
    // A theme gives the whole page another colour, Material 3 style: one seed hue, and every
    // surface, border and grey text takes on that hue at its old lightness and chroma. The look
    // of the stock page comes from 97 blue-greys (185 uses across app.js, chatPane, kingPane and
    // kingBeverages, measured in OKLCH: chroma under 0.075, hue 170-275) plus ten cyan accents.
    // Those two families are what a theme moves. Whatever MEANS something keeps its colour: gold,
    // diamonds, red and green, the rarity palette (canonicalRarityPalette.js), the chips' art,
    // chat cosmetics — and the board itself.
    //
    // How, without rewriting the game: its colours are mostly inline styles, which only an
    // !important rule can beat. Every element with a themeable inline colour gets a token
    // (data-mcfo-t) that stands for one property and its ORIGINAL value, and one stylesheet holds
    // a rule per token with the mapped colour, scoped to html[data-mcfo-theme]. The game's styles
    // are never touched, so switching back is exact: the attribute goes, the rules stop matching.
    // The chat keeps its colours in chatPane.css instead; its rules are mirrored with mapped
    // values, cosmetic selectors left out. This script's own stylesheet goes through the same
    // mapping as a whole, and the pages in windows get the same treatment from the inside.
    const THEME_PROTECTED = new Set([
        // The rarity palette, all 35 of its colours. "Rare" is a blue, and would otherwise move.
        '#111013', '#131b14', '#1a341c', '#1c1a22', '#1c2633', '#1e3e68', '#20569d', '#214d24', '#241a2c',
        '#272330', '#321e1d', '#38753c', '#3d3021', '#3e1e58', '#3e384a', '#4d8b51', '#514a61', '#534351',
        '#578cd3', '#592285', '#5da4e1', '#662320', '#7c5422', '#8b43c4', '#8c7289', '#992824', '#a862e2',
        '#bc7824', '#c6a0c1', '#cf5f5b', '#d66a66', '#dfb581', '#e0d2de', '#e1b16b', '#e1d0df',
        // Diamonds (kingBeverages.js), cyan by nature.
        '#4db8dc', '#bcefff',
    ]);

    let theme = null;                     // { hue, tint, accent } — null is the stock look
    const themeMemo = new Map();          // colour as written -> mapped, for the current theme

    // ---- colour maths: sRGB <-> OKLCH (Björn Ottosson's OKLab) ----
    const toLin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    const fromLin = c => Math.round(255 * Math.max(0, Math.min(1, c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055)));
    function toOklch(r, g, b) {
        const R = toLin(r), G = toLin(g), B = toLin(b);
        const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
        const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
        const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
        const L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s;
        const A = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s;
        const B2 = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;
        return [L, Math.hypot(A, B2), (Math.atan2(B2, A) * 180 / Math.PI + 360) % 360];
    }
    // Chroma is eased off until the colour fits into sRGB, so a strong hue never clips into a
    // different one.
    function fromOklch(L, C, H) {
        const h = H * Math.PI / 180;
        for (let i = 0; i < 30; i++) {
            const A = C * Math.cos(h), B2 = C * Math.sin(h);
            const l = Math.pow(L + 0.3963377774 * A + 0.2158037573 * B2, 3);
            const m = Math.pow(L - 0.1055613458 * A - 0.0638541728 * B2, 3);
            const s = Math.pow(L - 0.0894841775 * A - 1.2914855480 * B2, 3);
            const R = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
            const G = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
            const B = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;
            if (R > -0.001 && R < 1.001 && G > -0.001 && G < 1.001 && B > -0.001 && B < 1.001) return [fromLin(R), fromLin(G), fromLin(B)];
            C *= 0.9;
        }
        const grey = fromLin(Math.pow(L, 3));
        return [grey, grey, grey];
    }

    // A colour as CSS writes it: #rgb, #rrggbb (also with alpha), rgb(), rgba(). The alpha of an
    // rgba() may be a var() — the glass tints are written that way — and is carried over as is.
    const COLOR_RE = /#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})(?![0-9a-z_-])|rgba?\((?:[^()]|\([^()]*\))*\)/gi;
    function parseColour(text) {
        if (text[0] === '#') {
            let h = text.slice(1).toLowerCase();
            if (h.length <= 4) h = h.replace(/./g, c => c + c);
            const n = parseInt(h.slice(0, 6), 16);
            return { r: n >> 16 & 255, g: n >> 8 & 255, b: n & 255, hex: '#' + h.slice(0, 6),
                     alpha: h.length === 8 ? (parseInt(h.slice(6), 16) / 255).toFixed(3) : null };
        }
        const m = /^rgba?\(\s*(\d+(?:\.\d+)?)\s*[,\s]\s*(\d+(?:\.\d+)?)\s*[,\s]\s*(\d+(?:\.\d+)?)\s*(?:[,/]\s*([^]*?))?\s*\)$/i.exec(text);
        if (!m) return null;
        const r = Math.round(+m[1]), g = Math.round(+m[2]), b = Math.round(+m[3]);
        return { r, g, b, hex: '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join(''),
                 alpha: m[4] !== undefined && m[4] !== '' ? m[4] : null };
    }

    // Which family a colour belongs to. Depends only on the colour, never on the theme.
    //
    // The near-blacks count too. The footer (#0c1012), the page ground (#090d0f) and a dozen more
    // surfaces are blue by a breath only — chroma 0.006-0.011 — and a first cut at 0.012 left them
    // out: the footer kept its colour under every theme (Luce, 14.09.). Dark and faintly blue is
    // a surface of the same family; near-white stays white, that is text.
    const THEME_DARK_L = 0.35;
    function colourFamily(c) {
        if (THEME_PROTECTED.has(c.hex)) return null;
        const [L, C, H] = toOklch(c.r, c.g, c.b);
        if (H < 170 || H > 275) return null;                    // every other hue
        if (C < 0.012 && !(L < THEME_DARK_L && C >= 0.004)) return null;   // plain greys and whites
        if (C < 0.075) return { L, C, kind: 'neutral' };
        if (C < 0.14)  return { L, C, kind: 'accent' };
        return null;                                            // vivid blues: rarity-like, left alone
    }

    // Dark surfaces carry too little chroma to show a hue at all, so they get a floor — as
    // Material 3 tints its surfaces. The tint multiplies it like any other, so Graphite stays grey.
    const THEME_DARK_MIN_C = 0.016;

    function mapColour(text, t) {
        const c = parseColour(text);
        const f = c && colourFamily(c);
        if (!f) return text;
        const base = f.kind === 'neutral' && f.L < THEME_DARK_L ? Math.max(f.C, THEME_DARK_MIN_C) : f.C;
        let { h, k } = f.kind === 'accent' ? t.accent : neutralRole(t, f.L);
        // The more colourful greys — buttons, lit borders, links — lean towards the accent: from
        // chroma 0.035, fully at 0.06. The game's buttons sit at 0.045-0.06 and so end up more
        // than half-way to all the way; surfaces (about 0.02) and plain borders (0.033) keep the
        // hue. Without this the accent had next to nothing to colour: the game has only ten true
        // accents, and Luce (14.09.) saw nothing change but the colour of the slider itself.
        if (f.kind === 'neutral' && f.C > 0.035) {
            const w = Math.min(1, (f.C - 0.035) / 0.025);
            const dh = ((t.accent.h - h + 540) % 360) - 180;
            h = (h + dh * w + 360) % 360;
            k += (t.accent.k - k) * w;
        }
        const [r, g, b] = fromOklch(f.L, base * k, h);
        return c.alpha === null ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${c.alpha})`;
    }

    function themeText(text) {
        if (!theme) return text;
        return String(text).replace(COLOR_RE, m => {
            let v = themeMemo.get(m);
            if (v === undefined) { v = mapColour(m, theme); themeMemo.set(m, v); }
            return v;
        });
    }

    // Whether a value holds anything a theme moves — the same for every theme.
    const themeableMemo = new Map();
    function isThemeable(text) {
        let v = themeableMemo.get(text);
        if (v === undefined) {
            v = (String(text).match(COLOR_RE) || []).some(m => { const c = parseColour(m); return !!(c && colourFamily(c)); });
            if (themeableMemo.size > 5000) themeableMemo.clear();
            themeableMemo.set(text, v);
        }
        return v;
    }

    // Which hue and strength a grey gets, by its lightness: surfaces are dark (about 0.2), lines
    // mid (borders, dim text, about 0.4), ink light (text, 0.75 and up). In between the roles
    // blend — hue along the shorter way round the circle — so two neighbouring greys never jump
    // to different colours.
    const THEME_ANCHORS = [0.22, 0.42, 0.75];
    function neutralRole(t, L) {
        const roles = [t.surface, t.line, t.ink];
        if (L <= THEME_ANCHORS[0]) return roles[0];
        if (L >= THEME_ANCHORS[2]) return roles[2];
        const i = L < THEME_ANCHORS[1] ? 0 : 1;
        const f = (L - THEME_ANCHORS[i]) / (THEME_ANCHORS[i + 1] - THEME_ANCHORS[i]);
        const a = roles[i], b = roles[i + 1];
        const dh = ((b.h - a.h + 540) % 360) - 180;
        return { h: (a.h + dh * f + 360) % 360, k: a.k + (b.k - a.k) * f };
    }

    const hueOf = seed => {
        if (typeof seed === 'number') return seed;
        const c = parseColour(seed);
        return toOklch(c.r, c.g, c.b)[2];
    };
    // The colour a pattern is drawn in, as "r, g, b": a theme's own tint, else its accent made
    // bright enough to show on a dark surface.
    const brightTint = h => fromOklch(0.78, 0.13, h).join(', ');
    const seedTint = seed => { const c = parseColour(seed); return `${c.r}, ${c.g}, ${c.b}`; };

    // One entry of THEMES in the form the engine works with (null = the stock look).
    function normTheme(t) {
        if (!t || t.id === 'original') return null;
        if (t.id === 'custom') {
            const k = settings.themeTint / 100, h = settings.themeHue, ha = settings.themeAccent;
            // With the gradient on, the band runs from the hue to the accent at full strength;
            // the wash is the same pair made dark.
            const grad = settings.themeGradient;
            const bright = x => `rgb(${fromOklch(0.72, 0.14, x).join(', ')})`;
            return { id: 'custom', surface: { h, k }, line: { h, k }, ink: { h, k }, accent: { h: ha, k: 1 },
                     stripe: grad ? [bright(h), bright(ha)] : null, flag: false, wash: grad,
                     decor: settings.themePattern === 'none' ? null : settings.themePattern, decorTint: brightTint(ha) };
        }
        const role = (spec, fallback) => (spec ? { h: hueOf(spec[0]), k: spec[1] } : fallback);
        const surface = role(t.s, { h: 245, k: 1 });
        const line = role(t.l, surface);
        const ink = role(t.i, { h: line.h, k: Math.min(line.k, 1.1) });
        const accent = role(t.a, { h: surface.h, k: 1 });
        return { id: t.id, surface, line, ink, accent, stripe: t.stripe || null, flag: !!t.flag,
                 wash: !!t.stripe && t.wash !== false, decor: t.decor || null,
                 ring: !!t.ring, skin: t.skin || null, decorTint: t.tint ? seedTint(t.tint) : brightTint(accent.h) };
    }

    const currentTheme = () => {
        const t = THEMES.find(x => x.id === settings.themeId);
        // A signature theme belongs to one account: signed in as someone else, the stock look.
        if (t && t.owner && accountName() && !themeVisible(t)) return null;
        return normTheme(t);
    };

    // What a theme looks like, for its tile in the settings: ground, card, border, text, accent.
    const THEME_SAMPLE = ['#0e151c', '#111c27', '#2f3f4e', '#8da2b7', '#4d7ea6'];
    function themeSwatches(t) {
        const p = normTheme(t);
        return THEME_SAMPLE.map(c => (p ? mapColour(c, p) : c));
    }

    // ---- flags, gradients and patterns ----
    // The band: the stripe colours at full strength, hard-edged for a flag.
    function stripeGradient(t, angle) {
        const cs = t.stripe;
        if (!t.flag) return `linear-gradient(${angle}, ${cs.join(', ')})`;
        const step = 100 / cs.length;
        return `linear-gradient(${angle}, ${cs.map((c, i) => `${c} ${(i * step).toFixed(2)}% ${((i + 1) * step).toFixed(2)}%`).join(', ')})`;
    }

    // The wash: the same colours made dark and quiet — lightness 0.26, chroma at most 0.075 — so
    // text on top stays as readable as on the stock surfaces. White, black and grey stripes take
    // the theme's surface hue instead of none.
    function washGradient(t, angle, alpha) {
        const stops = t.stripe.map(seed => {
            const c = parseColour(seed);
            let [, C, H] = toOklch(c.r, c.g, c.b);
            if (C < 0.03) { H = t.surface.h; C = 0.03; }
            const [r, g, b] = fromOklch(0.26, Math.min(C * 0.55, 0.075), H);
            return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        });
        return `linear-gradient(${angle}, ${stops.join(', ')})`;
    }

    // Static on purpose: an animated pattern over these surfaces would repaint them on every
    // frame, and the performance levels exist because paint is what this page is short of.
    // Each pattern is drawn in the theme's pattern colour c ("r, g, b") — so a Custom pattern
    // follows the accent slider. The presets pick one each; Custom offers them all.
    const THEME_PATTERNS = {
        glitter: { label: 'Glitter', layers: () => [
            ['radial-gradient(circle at 20% 30%, rgba(255, 255, 255, 0.55) 0 0.7px, transparent 1.5px)', '110px 80px'],
            ['radial-gradient(circle at 65% 70%, rgba(255, 214, 240, 0.5) 0 0.9px, transparent 1.8px)', '85px 65px'],
            ['radial-gradient(circle at 40% 85%, rgba(214, 228, 255, 0.45) 0 0.6px, transparent 1.3px)', '57px 47px'],
            ['radial-gradient(circle at 85% 15%, rgba(255, 255, 255, 0.35) 0 1.1px, transparent 2px)', '150px 120px'],
        ] },
        stripes: { label: 'Stripes', layers: c => [
            [`repeating-linear-gradient(135deg, rgba(${c}, 0.06) 0 10px, transparent 10px 22px)`, 'auto']] },
        hazard: { label: 'Hazard', layers: c => [
            [`repeating-linear-gradient(135deg, rgba(${c}, 0.12) 0 12px, transparent 12px 24px)`, 'auto']] },
        scanlines: { label: 'Scanlines', layers: () => [
            ['repeating-linear-gradient(0deg, rgba(0, 0, 0, 0.22) 0 1px, transparent 1px 3px)', 'auto']] },
        grid: { label: 'Grid', layers: c => [
            [`linear-gradient(rgba(${c}, 0.09) 1px, transparent 1px)`, '24px 24px'],
            [`linear-gradient(90deg, rgba(${c}, 0.09) 1px, transparent 1px)`, '24px 24px']] },
        blocks: { label: 'Blocks', layers: c => [
            [`linear-gradient(rgba(${c}, 0.08) 2px, transparent 2px)`, '18px 18px'],
            [`linear-gradient(90deg, rgba(${c}, 0.08) 2px, transparent 2px)`, '18px 18px']] },
        bricks: { label: 'Bricks', layers: () => [
            ['linear-gradient(0deg, rgba(0, 0, 0, 0.3) 2px, transparent 2px)', '32px 16px'],
            ['linear-gradient(90deg, rgba(0, 0, 0, 0.3) 2px, transparent 2px)', '32px 32px']] },
        dots: { label: 'Dots', layers: c => [
            [`radial-gradient(circle, rgba(${c}, 0.22) 0 1.6px, transparent 2.2px)`, '18px 18px']] },
        checker: { label: 'Checker', layers: c => [
            [`conic-gradient(rgba(${c}, 0.07) 25%, transparent 0 50%, rgba(${c}, 0.07) 0 75%, transparent 0)`, '28px 28px']] },
        pixels: { label: 'Pixels', layers: c => [
            [`conic-gradient(rgba(${c}, 0.06) 25%, transparent 0 50%, rgba(${c}, 0.06) 0 75%, transparent 0)`, '8px 8px'],
            ['conic-gradient(rgba(0, 0, 0, 0.12) 25%, transparent 0 50%, rgba(0, 0, 0, 0.12) 0 75%, transparent 0)', '24px 24px']] },
        triangles: { label: 'Triangles', layers: c => [
            [`conic-gradient(from 150deg at 50% 30%, rgba(${c}, 0.09) 0 60deg, transparent 60deg)`, '36px 32px']] },
    };

    // One surface, layers from the top: pattern, the flag band (top or bottom edge), the wash.
    // Everything !important: the game's surfaces carry their backgrounds inline.
    function surfaceLayers(t, { band = null, washAngle = '100deg', alpha = 0.6 } = {}) {
        const layers = [];
        const pattern = THEME_PATTERNS[t.decor];
        if (pattern) for (const [img, size] of pattern.layers(t.decorTint)) layers.push([img, size, '0 0', 'repeat']);
        if (band && t.stripe) {
            const px = t.ring ? 6 : t.flag ? 3 : 2;
            // A ring is a rim of metal, not a line: light along its upper edge, shadow along its lower.
            if (t.ring) layers.push(['linear-gradient(180deg, rgba(255, 246, 204, 0.65), rgba(255, 246, 204, 0) 40%, '
                + 'rgba(70, 35, 0, 0) 60%, rgba(70, 35, 0, 0.6))', `100% ${px}px`, band, 'no-repeat']);
            layers.push([stripeGradient(t, '90deg'), `100% ${px}px`, band, 'no-repeat']);
        }
        if (t.wash && t.stripe) layers.push([washGradient(t, washAngle, alpha), '100% 100%', '0 0', 'no-repeat']);
        if (!layers.length) return '';
        const col = n => layers.map(l => l[n]).join(', ');
        return `background-image: ${col(0)} !important; background-size: ${col(1)} !important; `
             + `background-position: ${col(2)} !important; background-repeat: ${col(3)} !important;`;
    }

    // Only for themes with a stripe or a pattern; the classic ones are colour alone.
    function themeDecorCss(t) {
        if (!t || (!t.stripe && !t.decor)) return '';
        const S = 'html[data-mcfo-theme]';
        const glass = 'calc(var(--mcfo-glass-a, 0.78) * 0.7)';
        const rules = [
            `${S} [data-role="top-status-region"] { ${surfaceLayers(t, { band: 'bottom' })} }`,
            `${S} [data-role="action-region"] { ${surfaceLayers(t, { band: 'top' })} }`,
            `${S} .mcf-chat { ${surfaceLayers(t, { washAngle: '170deg', alpha: 0.5 })} }`,
            // The ground between the boards (the game's shell) shows between and around them.
            `${S} [data-role="shell"] { ${surfaceLayers(t, { washAngle: '160deg', alpha: 0.45 })} }`,
            // The header (Chat, the room, Cosmetics and collapse) and the composer (message box and
            // Send) have solid colours of their own in the game's sheet, which covered the wash and
            // the pattern of the chat along the top and the bottom. Their dividing lines stay.
            surfaceLayers(t, { washAngle: '170deg', alpha: 0.5 })
                ? `${S} .mcf-chat .mcf-chat__header, ${S} .mcf-chat .mcf-chat__composer { background-color: transparent !important; background-image: none !important; }` : '',
            `${S} .mcfo-win { ${surfaceLayers(t, { washAngle: '135deg', alpha: glass })} }`,
            `${S} .mcfo-menu { ${surfaceLayers(t, { band: 'top', washAngle: '135deg', alpha: 0.55 })} }`,
        ];
        if (t.stripe) {
            rules.push(`${S} .mcfo-win__head { background-image: ${stripeGradient(t, '90deg')} !important; background-size: 100% ${t.ring ? 3 : 2}px !important;`
                     + ` background-position: bottom !important; background-repeat: no-repeat !important; }`);
        }
        return rules.filter(r => !/\{\s*\}/.test(r)).join('\n');
    }

    // The same inside a page in one of our windows: wash and pattern on its body.
    function frameDecorCss(t) {
        if (!t || (!t.stripe && !t.decor)) return '';
        const layers = surfaceLayers(t, { washAngle: '135deg', alpha: 'calc(var(--mcfo-glass-a, 0.78) * 0.7)' });
        return layers ? `\nhtml[data-mcfo-theme] body { ${layers} background-attachment: fixed !important; }` : '';
    }

    // Style elements of our own in the main page, after the base sheet so they win on equal
    // terms. Through GM_addStyle, like the base sheet, so a page policy cannot block them.
    function ownStyle(id) {
        let el = document.getElementById(id);
        if (el) return el;
        try { el = GM_addStyle('/* ' + id + ' */'); } catch (e) { el = null; }
        if (!el || !el.tagName) { el = document.createElement('style'); (document.head || document.documentElement).appendChild(el); }
        el.id = id;
        return el;
    }
    const themeOwnStyle = ownStyle('mcfo-theme-own');     // this script's CSS, mapped
    const themeRuleStyle = ownStyle('mcfo-theme-rules');  // token rules + mirrored game rules
    const themeDecorStyle = ownStyle('mcfo-theme-decor'); // flag bands, washes, patterns
    const themeAccentStyle = ownStyle('mcfo-theme-accent'); // switches and pressed buttons in the accent

    // ---- the game's inline colours: tokens ----
    const THEME_PROPS = ['background-color', 'background-image', 'border-top-color', 'border-right-color', 'border-bottom-color',
                         'border-left-color', 'color', 'box-shadow', 'text-shadow', 'outline-color', 'fill', 'stroke'];
    const themeTokens = new Map();        // "property|original value" -> token ('' = nothing to move)
    let themeTokenSeq = 0;
    let themeRulesStale = true;
    function themeToken(prop, value) {
        const key = prop + '|' + value;
        let id = themeTokens.get(key);
        if (id === undefined) {
            id = isThemeable(value) ? 't' + (themeTokenSeq++).toString(36) : '';
            themeTokens.set(key, id);
            if (id) themeRulesStale = true;
        }
        return id;
    }

    // Left alone, subtree and all: the board and anything drawn (svg, canvas), pictures, frames
    // (themed from the inside, see themeFrame), the chat messages with their cosmetics, the
    // chips' artwork, anything cosmetic, preview or rarity, and the few buttons of ours whose
    // colours carry meaning (beverages, rebellion tiers, extra chips) or show a theme (settings).
    const THEME_SKIP = [
        'svg', 'canvas', 'img', 'video', 'iframe',
        '[data-role="lane-stage"]', '.mcf-king-shared-renderer-stage',
        '[data-role="chat-messages"]', '.mcf-chat__messages',
        'button[data-bid-amount]', '[data-mcfo-bid]',
        '[class*="cosmetic" i]', '[class*="preview" i]', '[class*="rarity" i]',
        '.mcfo-drink', '.mcfo-bev__buy', '.mcfo-reb__tier', '.mcfo-theme',
        '.mcfo-skin',   // a Deluxe skin's scenery brings its own colours
    ].join(', ');

    function themeElement(el) {
        const st = el.style;
        let want = '';
        if (st && st.length) {
            for (const prop of THEME_PROPS) {
                const v = st.getPropertyValue(prop);
                if (!v || (v.indexOf('#') < 0 && v.indexOf('rgb') < 0)) continue;
                const id = themeToken(prop, v);
                if (id) want = want ? want + ' ' + id : id;
            }
        }
        if ((el.getAttribute('data-mcfo-t') || '') !== want) {
            if (want) el.setAttribute('data-mcfo-t', want); else el.removeAttribute('data-mcfo-t');
        }
    }

    function themeWalk(docOrEl) {
        if (!theme || !docOrEl) return;
        const start = docOrEl.nodeType === 9 ? docOrEl.body : docOrEl;
        if (!start || start.matches(THEME_SKIP)) return;
        const doc = start.ownerDocument;
        themeElement(start);
        // FILTER_REJECT (2) drops a whole subtree, so the board is never even visited.
        const walker = doc.createTreeWalker(start, 1, { acceptNode: n => (n.matches(THEME_SKIP) ? 2 : 1) });
        for (let n = walker.nextNode(); n; n = walker.nextNode()) themeElement(n);
    }

    // ---- the game's stylesheets: mirrored rules ----
    // trackb.css: the Profile and Leaderboards pages (trackb-pages.js), missing until 6.38.3.
    const THEME_SHEETS = /\/(chatPane|siteNavigation|shop|dailies|inventory|trackb)\.css(\?|$)/;
    const THEME_SKIP_RULE = /cosmetic|royal|panel--|gradient--|derivative--|username|text--|treatment|vip|private-visual|flourish|frame--|preview|rarity|swatch|crown/i;

    // "a, :is(b, c)" -> each part behind html[data-mcfo-theme]. One attribute more than the
    // original selector, so the copy wins whichever sheet loads last.
    function scopeSelector(sel) {
        const parts = [];
        let depth = 0, from = 0;
        for (let i = 0; i < sel.length; i++) {
            const ch = sel[i];
            if (ch === '(' || ch === '[') depth++;
            else if (ch === ')' || ch === ']') depth--;
            else if (ch === ',' && !depth) { parts.push(sel.slice(from, i)); from = i + 1; }
        }
        parts.push(sel.slice(from));
        return parts.map(p => {
            p = p.trim();
            return /^(html|:root)(?![\w-])/i.test(p) ? p.replace(/^(html|:root)/i, 'html[data-mcfo-theme]') : 'html[data-mcfo-theme] ' + p;
        }).join(', ');
    }

    // The plain name rule (".mcf-chat__sender { color }") carries no cosmetic word, so it is
    // mirrored — and the copy, one attribute more specific, beat every username style: those set
    // their colour and glow with a single class (".mcf-chat__username--soft_glow"), and the
    // theme's grey won (Luce, 14.09.). A styled name carries at least one mcf-chat__username-*
    // class (chatPane.js), so the copy now stops at those and paints plain names only.
    const guardNames = sel => sel.replace(/\.mcf-chat__sender(?![\w-])/g, '.mcf-chat__sender:not([class*="mcf-chat__username-"])');

    function mirrorRules(rules) {
        let out = '';
        for (const rule of Array.from(rules)) {
            if (rule.selectorText !== undefined && rule.style) {
                if (THEME_SKIP_RULE.test(rule.selectorText)) continue;
                const st = rule.style;
                let decl = '';
                for (let i = 0; i < st.length; i++) {
                    const prop = st[i], v = st.getPropertyValue(prop);
                    if (!v || !isThemeable(v)) continue;
                    decl += `${prop}: ${themeText(v)}${st.getPropertyPriority(prop) ? ' !important' : ''}; `;
                }
                if (decl) out += `${guardNames(scopeSelector(rule.selectorText))} { ${decl}}\n`;
            } else if (rule.cssRules && rule.media) {
                const inner = mirrorRules(rule.cssRules);
                if (inner) out += `@media ${rule.media.mediaText} {\n${inner}}\n`;
            }
        }
        return out;
    }

    function mirrorSheets(doc) {
        if (!theme) return '';
        let out = '';
        for (const sheet of Array.from(doc.styleSheets)) {
            if (!THEME_SHEETS.test(sheet.href || '')) continue;
            let rules;
            try { rules = sheet.cssRules; } catch (e) { continue; }   // not readable: left as it is
            out += mirrorRules(rules);
        }
        return out;
    }
    const themeSheetsSig = doc => Array.from(doc.styleSheets).map(s => s.href || '').filter(h => THEME_SHEETS.test(h)).join('|');

    // ---- putting it on the page ----
    let themeSig = null;
    let themeMirror = { sig: null, text: '' };

    function tokenRulesText() {
        let out = '';
        for (const [key, id] of themeTokens) {
            if (!id) continue;
            const i = key.indexOf('|');
            out += `html[data-mcfo-theme] [data-mcfo-t~="${id}"] { ${key.slice(0, i)}: ${themeText(key.slice(i + 1))} !important; }\n`;
        }
        return out;
    }

    function writeThemeRules() {
        themeRulesStale = false;
        const tokens = theme ? tokenRulesText() : '';
        themeRuleStyle.textContent = theme ? tokens + themeMirror.text : '';
        for (const w of windows.values()) if (w.frame) themeFrame(w.frame, tokens);
    }

    // A page in one of our windows (same origin): its own stylesheets mirrored, its inline
    // colours tokenised, the glass tint of framePanelMode mapped through a variable.
    function themeFrame(frame, tokens) {
        let doc;
        try { doc = frame.contentDocument; } catch (e) { return; }
        if (!doc || !doc.documentElement) return;
        const root = doc.documentElement;
        const style = doc.getElementById('mcfo-theme-rules');
        if (!theme) {
            root.removeAttribute('data-mcfo-theme');
            root.style.removeProperty('--mcfo-glass-rgb');
            if (style) style.textContent = '';
            return;
        }
        root.setAttribute('data-mcfo-theme', settings.themeId);
        const glass = parseColour(themeText('rgb(11, 18, 26)'));
        if (glass) root.style.setProperty('--mcfo-glass-rgb', `${glass.r}, ${glass.g}, ${glass.b}`);
        if (!doc.head || !doc.body) return;
        themeWalk(doc);
        let el = style;
        if (!el) { el = doc.createElement('style'); el.id = 'mcfo-theme-rules'; doc.head.appendChild(el); }
        el.textContent = (tokens === undefined || themeRulesStale ? tokenRulesText() : tokens) + mirrorSheets(doc) + frameDecorCss(theme) + skinFrameCss(theme) + unlockInfoCss(theme);
        if (doc.body.hasAttribute('data-mcfo-theme-watch')) return;
        doc.body.setAttribute('data-mcfo-theme-watch', '1');
        let queued = false;
        new MutationObserver(() => {
            if (queued) return;
            queued = true;
            setTimeout(() => {
                queued = false;
                if (!theme) return;
                themeWalk(doc);
                if (themeRulesStale) writeThemeRules();
            }, 120);
        }).observe(doc.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['style'] });
    }

    // The parts of the main page that change on their own: reacted to within 60 ms, so a panel
    // that opens does not show in blue first. Everything else is caught by the 1.5 s pass.
    let themeObserved = false, themeWalkQueued = false;
    function watchThemeRoots() {
        if (themeObserved) return;
        themeObserved = true;
        const mo = new MutationObserver(() => {
            if (themeWalkQueued || !theme) return;
            themeWalkQueued = true;
            setTimeout(() => {
                themeWalkQueued = false;
                if (!theme) return;
                themeWalk(document);
                if (themeRulesStale) writeThemeRules();
            }, 60);
        });
        mo.observe(document.body, { childList: true });          // popups appended to <body>
        for (const r of ['top-status-region', 'action-region', 'desktop-chat-pane', 'landscape-side-pane', 'king-action-tray']) {
            const el = role(r);
            if (el) mo.observe(el, { subtree: true, childList: true, attributes: true, attributeFilter: ['style'] });
        }
    }

    // Switches, pressed buttons and the chat's Cosmetics switch show "on" in the theme's accent
    // instead of the fixed green — as Material 3 draws its switches in the primary colour. Knob
    // position and brightness still say on or off; only the hue follows the theme. The
    // strength follows the accent's, within bounds, so Graphite's switches are grey.
    // The tileset banner (12b) takes the accent too: the name bright, the line above it paler,
    // and a glow of the same hue behind the letters.
    function themeAccentCss(t) {
        if (!t) return '';
        const k = Math.min(1.4, Math.max(0.25, t.accent.k));
        const c = (L, C) => `rgb(${fromOklch(L, C * k, t.accent.h).join(', ')})`;
        const S = 'html[data-mcfo-theme]';
        const track = c(0.6, 0.13), edge = c(0.68, 0.12), deep = c(0.3, 0.07), text = c(0.93, 0.04), pressed = c(0.42, 0.09);
        return [
            `${S} .mcfo-switch__input:checked + .mcfo-switch { background: ${track}; box-shadow: inset 0 0 0 1px ${edge}; }`,
            `${S} .mcfo-seg button[aria-pressed="true"] { background: ${pressed}; }`,
            `${S}[data-mcfo-chatcos="1"] .mcf-chat__cosmetics-toggle[aria-pressed="true"] { background: ${deep} !important; border-color: ${edge} !important; color: ${text} !important; }`,
            `${S}[data-mcfo-chatcos="1"] .mcf-chat__cosmetics-toggle[aria-pressed="true"]::before { background-color: ${track}; }`,
            `${S} .mcfo-tsbanner__name { color: ${c(0.84, 0.15)}; text-shadow: 0 2px 0 rgba(0, 0, 0, 0.4), 0 0 26px ${c(0.55, 0.16)}, 0 4px 22px rgba(0, 0, 0, 0.75); }`,
            `${S} .mcfo-tsbanner__kicker { color: ${c(0.9, 0.06)}; }`,
            // Mentions of you (6.36) in the theme's accent instead of the fixed gold (6.51).
            `${S} .mcf-chat__message[data-mcfo-mention] { outline-color: ${c(0.74, 0.14).replace('rgb(', 'rgba(').replace(')', ', 0.75)')} !important; box-shadow: inset 4px 0 0 ${c(0.78, 0.15)}, inset 0 0 0 999px ${c(0.7, 0.14).replace('rgb(', 'rgba(').replace(')', ', 0.1)')} !important; }`,
            `${S} [data-role].mcfo-card.mcfo-card:hover { border-color: ${edge} !important; box-shadow: 0 0 0 1px ${edge}, 0 0 14px 2px ${c(0.6, 0.15).replace('rgb(', 'rgba(').replace(')', ', 0.55)')} !important; }`,
        ].join('\n');
    }

    // The inventory's unlock info (game v0.10.1g, 6.41): a round "i" next to every title and toll,
    // and a popover that says how it was unlocked. The game draws both in fixed blues, which the
    // colour mirror only shifts - on most themes it stayed a foreign blue ring. Drawn here from the
    // page's own colour variables (--line, --ink, --panel-2, themed by the mirror like every
    // card edge on the page), with the theme's accent only on hover. Doubled classes: these must
    // beat the mirrored copy of the game's rule, which sits in the same style element.
    function unlockInfoCss(t) {
        if (!t || !t.accent) return '';
        const k = Math.min(1.4, Math.max(0.25, t.accent.k));
        const c = (L, C, a) => `rgba(${fromOklch(L, C * k, t.accent.h).join(', ')}, ${a === undefined ? 1 : a})`;
        const S = 'html[data-mcfo-theme]';
        const B = `${S} .inventoryUnlockInfoButton.inventoryUnlockInfoButton`;
        const P = `${S} .inventoryUnlockPopover.inventoryUnlockPopover`;
        return `
${B} { width: 20px; height: 20px; margin-top: 1px; border: 1px solid var(--line, #2f3f4e); background: transparent;
  color: var(--ink, #e3edf7); opacity: 0.75; font: italic 700 12px/1 Georgia, 'Times New Roman', serif; box-shadow: none;
  transition: background-color 0.15s, border-color 0.15s, color 0.15s, opacity 0.15s; }
${B}:hover, ${B}[aria-expanded="true"] { opacity: 1; background: ${c(0.6, 0.13, 0.16)}; border-color: ${c(0.72, 0.13)}; color: ${c(0.9, 0.08)}; }
${B}:focus-visible { outline: 2px solid ${c(0.72, 0.13)}; outline-offset: 2px; }
${P} { border: 1px solid var(--line, #2f3f4e); border-radius: 10px; padding: 10px 14px;
  background: var(--panel-2, #151d27); color: var(--ink, #e3edf7); font-size: 13px; line-height: 1.45;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.5), inset 0 1px 0 ${c(0.8, 0.1, 0.12)}; backdrop-filter: blur(6px); }
${P} .inventoryUnlockClose { color: inherit; opacity: 0.6; background: transparent; }
${P} .inventoryUnlockClose:hover { opacity: 1; color: ${c(0.8, 0.12)}; }`;
    }

    // ---- random theme ----
    // From every preset but Crownfall and Custom, never the one showing now. The pick becomes the
    // chosen theme, so switching Random off keeps whatever is on screen.
    function randomTheme() {
        const pool = THEMES.filter(t => t.id !== 'original' && t.id !== 'custom' && t.id !== settings.themeId && themeVisible(t));
        const pick = pool[Math.floor(Math.random() * pool.length)];
        if (!pick) return;
        settings.themeId = pick.id;
        saveSettings();
        themeTick();
        // The theme page, if open, shows the new pick as the pressed tile.
        if (settingsRedraw && settingsView === 'Theme' && windows.has(SETTINGS_KEY)) settingsRedraw();
    }

    // The timer runs only while Random is on; changing either restarts it.
    let themeRotateTimer = null, themeRotateEvery = 0;
    function scheduleThemeRotation() {
        const every = settings.themeRandom ? settings.themeRotate : 0;
        if (every === themeRotateEvery) return;
        themeRotateEvery = every;
        clearInterval(themeRotateTimer);
        themeRotateTimer = every ? setInterval(randomTheme, every * 60000) : null;
    }

    // Called on every apply() pass and whenever the choice changes. Cheap when nothing did.
    function themeTick() {
        const t = currentTheme();
        // A preset is fully named by its id; Custom also by its three sliders.
        const sig = !t ? '' : t.id === 'custom'
            ? `custom|${settings.themeHue}|${settings.themeTint}|${settings.themeAccent}|${settings.themeGradient}|${settings.themePattern}` : t.id;
        if (sig !== themeSig) {
            themeSig = sig;
            theme = t;
            themeMemo.clear();
            const root = document.documentElement;
            if (t) root.setAttribute('data-mcfo-theme', settings.themeId); else root.removeAttribute('data-mcfo-theme');
            themeOwnStyle.textContent = t ? themeText(BASE_CSS) : '';
            themeDecorStyle.textContent = themeDecorCss(t);
            themeAccentStyle.textContent = themeAccentCss(t);
            themeMirror = { sig: null, text: '' };
            // Back to the stock look: the tokens go too, nothing of ours is left on the game's nodes.
            if (!t) for (const el of document.querySelectorAll('[data-mcfo-t]')) el.removeAttribute('data-mcfo-t');
            themeRulesStale = true;
        }
        if (!theme) { if (themeRulesStale) writeThemeRules(); skinTick(); return; }
        const sheets = themeSheetsSig(document);
        if (sheets !== themeMirror.sig) { themeMirror = { sig: sheets, text: mirrorSheets(document) }; themeRulesStale = true; }
        themeWalk(document);
        watchThemeRoots();
        if (themeRulesStale) writeThemeRules();
        skinTick();
    }

