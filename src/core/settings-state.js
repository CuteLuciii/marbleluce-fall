    const clampNum = (v, lo, hi, def) => {
        const n = v === null || v === undefined || v === '' ? NaN : Math.round(Number(v));
        return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : def;
    };
    settingDefaults.themeId = 'original';
    settings.themeId = THEMES.some(t => t.id === stored.themeId) ? stored.themeId : 'original';
    settingDefaults.themeHue = 305;
    settings.themeHue = clampNum(stored.themeHue, 0, 359, 305);
    settingDefaults.themeTint = 100;
    settings.themeTint = clampNum(stored.themeTint, 0, 200, 100);
    // Custom's accent had no slider of its own in 6.0 and followed the hue: whoever set a hue
    // then keeps that look until they move the new slider.
    settingDefaults.themeAccent = 305;
    settings.themeAccent = clampNum(stored.themeAccent, 0, 359, settings.themeHue);
    // Custom's background (6.2): a gradient from hue to accent, and one pattern. Both off by
    // default, so a Custom of 6.1 looks as it did. The ids match THEME_PATTERNS (section 3b).
    const THEME_PATTERN_IDS = ['none', 'glitter', 'stripes', 'hazard', 'scanlines', 'grid', 'blocks', 'bricks', 'dots', 'checker', 'pixels', 'triangles'];
    settingDefaults.themeGradient = false;
    settings.themeGradient = stored.themeGradient === true;
    settingDefaults.themePattern = 'none';
    settings.themePattern = THEME_PATTERN_IDS.includes(stored.themePattern) ? stored.themePattern : 'none';
    // Random theme (6.3): a new one on every page load, and if wanted every few minutes.
    const THEME_ROTATE_OPTIONS = [[0, 'Off'], [5, '5 min'], [10, '10 min'], [15, '15 min'], [30, '30 min'], [60, '60 min']];
    settingDefaults.themeRandom = false;
    settings.themeRandom = stored.themeRandom === true;
    settingDefaults.themeRotate = 0;
    settings.themeRotate = THEME_ROTATE_OPTIONS.some(o => o[0] === Number(stored.themeRotate)) ? Number(stored.themeRotate) : 0;
    // Deluxe effects (6.5): full, subtle or off. Full unless chosen otherwise; the performance
    // levels hold it down on their own (section 3c, skinFxEffective).
    const THEME_FX_OPTIONS = [['full', 'Full'], ['subtle', 'Subtle'], ['off', 'Off']];
    settingDefaults.themeFx = 'full';
    settings.themeFx = THEME_FX_OPTIONS.some(o => o[0] === stored.themeFx) ? stored.themeFx : 'full';
    // See-through board frames (6.10): the bars the game paints above and below each tile and
    // around the king tile go, so the page background shows through. On unless switched off.
    settingDefaults.boardClear = true;
    settings.boardClear = stored.boardClear !== false;
    // On the throne (6.19): the beverage packages to pour, as "type|size|currency" — a list, not
    // a switch. Anything else found in storage is dropped rather than guessed at.
    settingDefaults.throneDrinkSet = [];
    settings.throneDrinkSet = Array.isArray(stored.throneDrinkSet)
        ? stored.throneDrinkSet.filter(k => /^(water|lava|milk|acid)\|(small|medium|large)\|(gold|diamonds)$/.test(k)) : [];
    // The music player (6.22, section 11e): off unless switched on, and until then the game plays
    // its music its own way. The tracks taken out of the rotation are kept as the paths the game's
    // own manifest gives them; anything else found in storage is dropped rather than guessed at.
    settingDefaults.musicPlayer = false;
    settings.musicPlayer = stored.musicPlayer === true;
    settingDefaults.musicShuffle = false;
    settings.musicShuffle = stored.musicShuffle === true;
    settingDefaults.musicVolume = 50;
    settings.musicVolume = Number.isFinite(Number(stored.musicVolume))
        ? Math.max(0, Math.min(100, Math.round(Number(stored.musicVolume)))) : 50;
    // The bar on the page (6.23): there whenever the player is, hidden with its own button or
    // here. Where it sits is kept with the windows, not here.
    settingDefaults.musicBar = true;
    settings.musicBar = stored.musicBar !== false;
    settingDefaults.musicExcluded = [];
    settings.musicExcluded = Array.isArray(stored.musicExcluded)
        ? stored.musicExcluded.filter(p => typeof p === 'string' && p.charAt(0) === '/') : [];

    // What a lever is set to right now: from the chosen level, or the Custom mix.
    function perfValue(key) {
        if (settings.perfLevel === 'custom') return settings[key];
        const level = PERF_LEVELS.find(l => l.id === settings.perfLevel);
        const lever = PERF_LEVERS.find(l => l.key === key);
        const v = level && level.set ? level.set[key] : undefined;
        return v !== undefined ? v : (lever && lever.type === 'choice' ? lever.def : false);
    }

    // Carried over from 3.7: whoever had the combined switch off gets both halves off.
    if (stored.kingName === undefined && stored.kingOverlay === false) settings.kingToll = false;
    // 6.28: our own name field gave way to the game's. Whoever had hidden it keeps the name hidden.
    if (stored.kcName === undefined && (stored.kingName === false || (stored.kingName === undefined && stored.kingOverlay === false)))
        settings.kcName = false;
    // 6.50: the switch Hide bidding indicators (6.47-6.49) became the choice Show / Standard size / Hide.
    if (stored.bidIndicatorMode === undefined && stored.hideBidIndicators === true) settings.bidIndicatorMode = 2;
    if (stored.hideDailies === undefined && stored.tidyFooter === false) {
        for (const b of FOOTER_BUTTONS) settings[b.key] = false;
    }

    function saveSettings() {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch (e) {}
        setCosmeticsHidden();
    }
    // Which switch covers an item on the Cosmetics page: the main switch, or its group switch.
    const COS_COVER = {};
    for (const [g, parts] of Object.entries(COS_GROUPS)) {
        COS_COVER[COS_GROUP_KEYS[g]] = ['hideCosAll'];
        for (const p of parts) COS_COVER[COS_KEYS[p]] = ['hideCosAll', COS_GROUP_KEYS[g]];
    }
    const cosCovered = key => (COS_COVER[key] || []).some(k => settings[k]);
    // The game's own chat cosmetics button (chat header, aria-pressed = cosmetics on, remembered by
    // the game in mcf.chat.cosmetics.enabled.v1) does "all chat cosmetics" better than any filter:
    // already drawn lines turn plain too. Pressed only when our wish changes, so a click of the
    // player's own on that button is respected until the switch here is touched again; turned back
    // on only if this script was the one that turned it off.
    let cosChatWish = null;
    function cosChatNative() {
        const want = !!(settings.hideCosAll || settings.hideCosChat);
        if (want === cosChatWish) return;
        const btn = document.querySelector('.mcf-chat__cosmetics-toggle, [data-role="chat-cosmetics-toggle"]');
        if (!btn) return;   // the chat is not there yet: try again on the next round
        const on = btn.getAttribute('aria-pressed') === 'true';
        let ours = false;
        try { ours = localStorage.getItem('mcfo_cos_chatnative') === '1'; } catch (e) {}
        if (want && on) { btn.click(); try { localStorage.setItem('mcfo_cos_chatnative', '1'); } catch (e) {} }
        else if (!want && !on && ours) btn.click();
        if (!want) try { localStorage.removeItem('mcfo_cos_chatnative'); } catch (e) {}
        cosChatWish = want;
    }
    function setCosmeticsHidden() {
        cosHide = cosCompute(settings);
        if (Object.values(cosHide).some(Boolean)) wrapCosFetch();
        if (cosHide.indicatorSmall) installIndicatorScale();
        document.documentElement.setAttribute('data-mcfo-cos', Object.keys(cosHide).filter(p => cosHide[p]).join(' '));
        cosChatNative();
    }
    setCosmeticsHidden();
    setInterval(cosChatNative, 2000);

