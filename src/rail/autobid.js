    // =========================================================================================
    // 9g. AUTOBID
    // =========================================================================================
    // What the Discord bot does for its accounts, for anyone who only has the browser: one bid on
    // every tile whose bidding window opens, with the bot's safety net if wanted.
    //
    // How a bid works decides how careful this has to be. /bid/place takes only { bidDelta } —
    // no lane, no run (placeBidFromUi in app.js; a runId is ignored by the server). The server
    // puts the bid on whichever lane is taking bids at that moment, and now and then that is not
    // the one we saw (the bot: 28 of 10,484 bids, 15 of them onto a risk tile). Its reply says
    // where the bid really went (bidPreviewLaneState), and !unbid takes it back while that lane's
    // window is still open. From PRESTART_3S on the entry is final.
    //
    // The logic is the bot's scanAndBid/placeBid, with the bot's numbers:
    //   - bid when a lane is in TILE_REVEALED with biddingOpen, once per run;
    //   - "once" is a high-water mark per lane (prefix + counter of the runId). During a server
    //     hiccup the lanes flip between run N+1 and N again; a single remembered runId took every
    //     flip for a new run and bid again (the bot's 11.09.). Kept in localStorage, so a reload
    //     or a second tab does not bid a run twice either (the bot's restarts, same day);
    //   - one tab bids at a time (a lock in localStorage, taken over when that tab goes quiet);
    //   - paused while King (no bids from the throne) and while "Attack when free" runs, which
    //     needs the marble free and would otherwise see its !unbid undone.
    // With risk protection on, additionally:
    //   - no bid onto a risk tile — the all-or-nothing tiles that can set your points to zero;
    //   - no bid at all while a risk tile's window is open anywhere: the server could put it there;
    //   - no bid while a lane has shown the same run for over 4 minutes — its view is likely out
    //     of date (the bot's 06.08.: 41 bids lost while every frame looked fresh);
    //   - if a bid lands on a risk tile anyway: !unbid, once, and only while that lane is still
    //     open. Once it has closed, !unbid would pull some other, good bid instead.
    //
    // Risk tiles: the six known names, plus whatever the game's public tile catalogue marks —
    // a definition with SetToAbsolute (points set to a fixed value) or WarningIcon, and every
    // tile of the RiskyBusiness tileset. The same derivation as the bot's, redone once a day.
    const AB_LOCK_AFTER_BID_MS = 2000;     // bot: postClickLockMs
    const AB_RISK_LOCK_MS      = 8000;     // bot: zohLockMs — keep off a lane a bid leaked into
    const AB_UNBID_LOCK_MS     = 5000;     // bot: autoUnbidLockMs
    const AB_TRUST_MAX_RUN_MS  = 240000;   // bot: laneTrustMaxRunMs (runs: median 121 s, p95 187 s)
    const AB_LANE_GONE_MS      = 600000;   // no frame for this long: the lane is gone, not stale
    const AB_HIGH_TTL_MS       = 600000;   // bot: BID_RUN_HIGH_TTL_MS — a counter reset must not lock a lane for good
    const AB_TAB_STALE_MS      = 15000;    // a bidding tab that has not checked in for this long has gone
    const AB_NOTE_MS           = 30000;    // how long a notice (leak, refusal) stays in view
    const AB_RISK_SCAN_MS      = 24 * 3600 * 1000;
    const AB_RESCAN_MS         = 10 * 60 * 1000;   // a tile the catalogues did not list: look again, at most this often
    const AB_HIGH_KEY = 'mcfo_autobid_runs';
    const AB_TAB_KEY  = 'mcfo_autobid_tab';
    const AB_RISK_KEY = 'mcfo_tile_risk';
    const AB_UNKNOWN_KEY = 'mcfo_autobid_unknown';
    const AB_RISK_NAMES = ['zero or hero', 'zero-or-hero', 'zeroorhero', 'chance time', 'double or nothing',
                           'jackball deathpot', 'v-risko', 'v risko', 'vrisko', 'super questionable financial decision'];
    const AB_CATALOGS = ['real', 'BaseSet', 'RiskyBusiness', 'SpeedRound', 'GrindStone', 'RarityStorm',
                         'HighRoller', 'HighTide', 'LowTide', 'EvenTide', 'Legacy', 'Mystery'];
    const AB_RISK_COMPONENTS = ['SetToAbsolute', 'WarningIcon'];

    const ab = {
        tabId: Math.random().toString(36).slice(2),
        tone: 'off', text: '',
        busy: false, lockUntil: 0, kingUntil: 0, lastUnbidAt: 0, riskLock: {},
        bids: 0, lastBid: null, note: '', noteTone: '', noteAt: 0,
        scanning: false, tickQueued: false, priority: '',
    };
    let abRisk = null;
    let abMenu = null;
    let abRiskArmedUntil = 0;
    let abRescanAt = 0;

    const normTile = s => String(s || '').trim().toLowerCase();
    const runPrefix = id => String(id || '').replace(/:\d+$/, '');
    const runSeq = id => { const m = /:(\d+)$/.exec(String(id || '')); return m ? parseInt(m[1], 10) : 0; };
    const laneName = k => String(k || '').split(':').pop() || String(k || '');
    const clock = t => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    function readStore(key) { try { return JSON.parse(localStorage.getItem(key)) || null; } catch (e) { return null; } }
    function writeStore(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) {} }

    // ---- once per run ----
    function markBidRun(laneKey, runId) {
        if (!laneKey || !runId) return;
        const now = Date.now();
        const high = readStore(AB_HIGH_KEY) || {};
        const pre = runPrefix(runId), seq = runSeq(runId), old = high[laneKey];
        if (!old || old.pre !== pre || seq > old.seq || now - old.at > AB_HIGH_TTL_MS) high[laneKey] = { pre, seq, at: now };
        for (const k of Object.keys(high)) if (now - (high[k].at || 0) > AB_HIGH_TTL_MS) delete high[k];
        writeStore(AB_HIGH_KEY, high);
    }
    function alreadyBid(laneKey, runId) {
        const old = (readStore(AB_HIGH_KEY) || {})[laneKey];
        if (!old || !runId || Date.now() - old.at > AB_HIGH_TTL_MS) return false;
        return old.pre === runPrefix(runId) && runSeq(runId) <= old.seq;
    }

    // ---- one bidding tab ----
    function holdsTabLock(now) {
        const lock = readStore(AB_TAB_KEY);
        if (lock && lock.id !== ab.tabId && now - lock.at < AB_TAB_STALE_MS) return false;
        // Checked in every 2 s at most: this runs on every lane frame.
        if (!lock || lock.id !== ab.tabId || now - lock.at > 2000) writeStore(AB_TAB_KEY, { id: ab.tabId, at: now });
        return true;
    }
    function releaseTabLock() {
        const lock = readStore(AB_TAB_KEY);
        if (lock && lock.id === ab.tabId) { try { localStorage.removeItem(AB_TAB_KEY); } catch (e) {} }
    }
    addEventListener('pagehide', releaseTabLock);

    // ---- risk tiles ----
    function riskState() {
        if (abRisk) return abRisk;
        const c = readStore(AB_RISK_KEY);
        abRisk = c && typeof c === 'object' ? { defs: c.defs || {}, tiles: c.tiles || {}, names: c.names || {}, at: c.at || 0 } : { defs: {}, tiles: {}, names: {}, at: 0 };
        return abRisk;
    }
    function isRiskTile(tile) {
        const n = normTile(tile);
        if (!n) return false;
        if (AB_RISK_NAMES.some(f => n === f || n.includes(f))) return true;
        return riskState().tiles[n] === true;
    }

    // ---- allowlist and blocklist (6.29) ----
    const inList = (list, tile) => { const n = normTile(tile); return !!n && list.some(t => normTile(t) === n); };
    const isBlockedTile = tile => isRiskTile(tile) || inList(settings.autobidBlock, tile);
    const isAllowedTile = tile => inList(settings.autobidAllow, tile);
    // A risk tile that is part of a Royal Celebration (6.54, the bot's rcFrei since 2.10.8). All
    // risk tiles are risky through SetToAbsolute 0 (points set to zero), and a celebration turns
    // exactly those zones, and the division zones, into safe_no_loss (royalCelebrationAffectedComponents
    // in the game's viewer). Minus zones are NOT made safe, they are multiplied by the celebration
    // and the rarity: Double or Nothing, V-Risko and Zero or Hero can still cost points (the bot's
    // worst case, Double or Nothing on a Cosmic tile in a x10 celebration: 50 million).
    // Only for the run and the tile the mark came with, and only with a multiplier above 1 — as
    // in the game's own code (celebrating = royalMultiplier > 1). Otherwise a risk tile right after
    // the celebration would inherit the mark of the tile before it on the same lane.
    function celebrationFree(laneKey, tile) {
        if (!settings.autobidCelebration || !laneKey) return false;
        const c = laneCelebration.get(laneKey), l = lanes.get(laneKey);
        const n = normTile(tile);
        return !!c && !!l && !!n && c.multiplier > 1 && c.runId === l.runId
            && normTile(c.tile) === n && normTile(l.tile) === n;
    }
    // Why a tile gets no bid, or '' when it may have one. Only asked with risk protection on.
    // With a lane, a risk tile of a Royal Celebration passes (6.54) — your blocklist still counts,
    // the allowlist does not (risk tiles are never on it).
    function tileVeto(tile, laneKey) {
        if (isRiskTile(tile)) return celebrationFree(laneKey, tile) ? (inList(settings.autobidBlock, tile) ? 'blocked' : '') : 'risk';
        if (inList(settings.autobidBlock, tile)) return 'blocked';
        if (settings.autobidKnownOnly && !isAllowedTile(tile)) return 'unknown';
        return '';
    }
    const vetoWords = { risk: 'a risk tile', blocked: 'on your blocklist', unknown: 'not on your allowlist yet' };

    // Tiles on neither list, as they turn up in a lane or in the catalogues: the menu offers
    // them for a decision. Kept across a reload, dropped once decided.
    function unknownTiles() {
        const u = readStore(AB_UNKNOWN_KEY);
        return u && typeof u === 'object' ? u : {};
    }
    function noteUnknown(tile, where) {
        const n = normTile(tile);
        if (!n || isBlockedTile(tile) || isAllowedTile(tile)) return;
        const u = unknownTiles();
        if (u[n] && (u[n].where === 'lane' || where !== 'lane')) return;
        u[n] = { name: String(tile).trim(), where, at: Date.now() };
        writeStore(AB_UNKNOWN_KEY, u);
        if (abMenu && abMenu.isConnected) syncAutobidMenu(abMenu);
    }
    function forgetUnknown(tile) {
        const u = unknownTiles(), n = normTile(tile);
        if (u[n]) { delete u[n]; writeStore(AB_UNKNOWN_KEY, u); }
    }
    function setTileList(tile, which) {
        const name = String(tile || '').trim();
        if (!name) return;
        const n = normTile(name);
        settings.autobidAllow = settings.autobidAllow.filter(t => normTile(t) !== n);
        settings.autobidBlock = settings.autobidBlock.filter(t => normTile(t) !== n);
        if (which === 'allow') settings.autobidAllow.push(name);
        if (which === 'block') settings.autobidBlock.push(name);
        if (which) forgetUnknown(name);
        else noteUnknown(name, 'list');           // taken off a list: undecided again
        saveSettings();
        autobidTick();
    }

    // The bot's refreshTileRisk, in the browser. Every catalogue lists its tiles with a specHash
    // and a definitionRef. Definitions are content-addressed — 35 of them behind 287 catalogue
    // rows — so each is fetched once, ever. Only ever adds: a tile that was a risk tile stays
    // one, since quietly unlocking is the dangerous direction. The server is flaky at times;
    // whatever fails is simply tried again on the next scan.
    async function scanRiskCatalogs() {
        if (ab.scanning) return;
        ab.scanning = true;
        const risk = riskState();
        let read = 0;
        try {
            for (const key of AB_CATALOGS) {
                let catalog;
                try {
                    const res = await fetch(`/tilesets/out/${encodeURIComponent(key)}/tileset.json`);
                    if (!res.ok) continue;
                    catalog = await res.json();
                } catch (e) { continue; }
                read += 1;
                for (const row of (catalog && catalog.tiles) || []) {
                    const tile = normTile(row && row.tileId);
                    const hash = String((row && row.specHash) || '').trim();
                    if (!tile || !hash || !row.definitionRef) continue;
                    risk.names[tile] = String(row.tileId).trim();
                    if (risk.defs[hash] === undefined) {
                        try {
                            const res = await fetch('/' + String(row.definitionRef).replace(/^\//, ''));
                            if (!res.ok) continue;
                            const def = await res.json();
                            const types = new Set(((def && def.compiled && def.compiled.components) || []).map(c => String((c && c.type) || '')));
                            risk.defs[hash] = AB_RISK_COMPONENTS.some(t => types.has(t));
                        } catch (e) { continue; }
                    }
                    if (risk.defs[hash] || key === 'RiskyBusiness') risk.tiles[tile] = true;
                }
            }
            if (read) risk.at = Date.now();
            writeStore(AB_RISK_KEY, risk);
            for (const name of Object.values(risk.names)) noteUnknown(name, 'catalogue');
        } finally { ab.scanning = false; }
    }

    // ---- deciding ----
    const kingNow = () => !!document.querySelector('[data-role="bid-area"][data-king-toll-mode="true"]') || Date.now() < ab.kingUntil;

    function untrustedLane(now) {
        for (const [k, l] of lanes) {
            // A lane that sends nothing at all any more is gone, not stale — left in, it would
            // block bidding for good.
            if (now - l.at > AB_LANE_GONE_MS) { lanes.delete(k); continue; }
            if (!l.runChangedAt || now - l.runChangedAt > AB_TRUST_MAX_RUN_MS) return k;
        }
        return null;
    }

    function abSet(tone, text) { ab.tone = tone; ab.text = text; }
    function abNote(tone, text) { ab.note = text; ab.noteTone = tone; ab.noteAt = Date.now(); drawAutobid(); }

    function autobidTick() {
        ab.tickQueued = false;
        const priority = ab.priority;
        ab.priority = '';
        autobidStep(Date.now(), priority);
        drawAutobid();
    }

    function autobidStep(now, priority) {
        if (!settings.autobidButton || !settings.autobidOn) return abSet('off', 'Off.');
        if (kingNow()) return abSet('hold', 'Paused: you are King. Bidding picks up again after your reign.');
        // Not during a lava cooldown (6.20): it runs down with the clock alone, and its three
        // minutes are tiles worth playing, as the MarbleMind bot does it. The one !unbid comes
        // once the cooldown is over.
        if (assist.active && assist.phase !== 'lava' && assist.phase !== 'lockout') return abSet('hold', 'Paused while "Attack when free" is running.');
        if (!holdsTabLock(now)) return abSet('hold', 'Another tab is bidding for you, this one stands by.');
        if (!tapInstalled) return abSet('alert', 'The lanes cannot be read in this browser, so nothing is bid.');
        if (!lanes.size) {
            return now - tapStartedAt > 20000
                ? abSet('alert', 'No lane data. Reload the page: the script has to start before the game.')
                : abSet('hold', 'Waiting for the lanes …');
        }
        if (ab.busy || now < ab.lockUntil) return;          // a bid is on its way; keep its words

        const risk = settings.autobidRisk;
        if (risk && !ab.scanning && now - riskState().at > AB_RISK_SCAN_MS) scanRiskCatalogs();
        if (risk) {
            for (const [, l] of lanes) {
                if (!l.tile) continue;
                noteUnknown(l.tile, 'lane');
                // A name the catalogues have never listed is new in the game — perhaps a new
                // risk tile. Look it up now rather than at the next daily scan (6.29: until then a
                // new risk tile went through unnoticed for up to a day).
                if (!riskState().names[normTile(l.tile)] && !ab.scanning && now > abRescanAt) { abRescanAt = now + AB_RESCAN_MS; scanRiskCatalogs(); }
            }
            // Holding back also for a tile we do not know: the server may put the bid there.
            for (const [k, l] of lanes) {
                const veto = l.open ? tileVeto(l.tile, k) : '';
                if (veto) return abSet('hold', `Holding: ${l.tile} (${vetoWords[veto]}) is taking bids in the ${laneName(k)} lane, a bid now could land there.`);
            }
            const stale = untrustedLane(now);
            if (stale) return abSet('hold', `Holding: the ${laneName(stale)} lane has shown the same run for over 4 minutes, its view may be out of date.`);
        }

        let done = null, skipped = null, skippedKey = '';
        const candidates = [];
        for (const [k, l] of lanes) {
            if (l.phase !== 'TILE_REVEALED' || !l.open || !l.runId) continue;
            if (risk && (now < (ab.riskLock[k] || 0) || tileVeto(l.tile, k))) { skipped = l; skippedKey = k; continue; }
            if (alreadyBid(k, l.runId)) { done = l; continue; }
            candidates.push([k, l]);
        }
        if (!candidates.length) {
            return abSet('on', done ? `Bid on ${done.tile}. Waiting for the next tile.`
                             : skipped ? `Skipping ${skipped.tile}: ${vetoWords[tileVeto(skipped.tile, skippedKey)] || 'a risk tile'}.`
                             : 'On. Waiting for the next bidding window.');
        }

        const amount = settings.autobidAmount;
        const tickets = ticketBalance();
        if (tickets !== null && tickets < amount) return abSet('alert', `Not enough tickets for ${amount} (you have ${number(tickets)}).`);
        // The game's own lock, as for the extra chips: its chips are disabled while the runtime
        // holds bids or the bid target is unresolved (syncBidButtonsInteractivity, run on every
        // lane frame). Where the game allows no bid, neither do we — and the run is not marked,
        // so it is tried again the moment the game lets go.
        const chip = document.querySelector('[data-role="bid-1"]');
        if (chip && chip.disabled) return abSet('hold', 'The game is holding bids right now.');

        // A window that has just opened goes first, otherwise the newest run — as in the bot.
        candidates.sort((a, b) => (a[0] === priority ? -1 : b[0] === priority ? 1 : runSeq(b[1].runId) - runSeq(a[1].runId)));
        const [laneKey, lane] = candidates[0];
        markBidRun(laneKey, lane.runId);         // before the request, as in the bot: a timeout may still have landed
        ab.lockUntil = now + AB_LOCK_AFTER_BID_MS;
        placeAutoBid(laneKey, lane, amount);
    }

    function placeAutoBid(laneKey, lane, amount) {
        ab.busy = true;
        abSet('on', `Bidding ${amount} on ${lane.tile}${isRiskTile(lane.tile) ? ' (risk tile, Royal Celebration)' : ''} …`);
        fetch('/bid/place', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ bidDelta: amount }),
        })
            .then(res => res.json().catch(() => ({})).then(body => ({ ok: res.ok, status: res.status, body })))
            .then(({ ok, status, body }) => {
                if (!ok) {
                    const why = String((body && body.error) || ('HTTP ' + status));
                    // The bot's rule: a refusal that mentions the throne means we are King.
                    if (/king|throne/i.test(why)) ab.kingUntil = Date.now() + 60000;
                    abNote('alert', `Bid on ${lane.tile} refused: ${why}.`);
                    return;
                }
                const preview = body && body.bidPreviewLaneState;
                const landedLane = String((body && body.resolvedBidTarget && body.resolvedBidTarget.laneKey)
                                          || (preview && preview.laneKey) || (body && body.laneKey) || '');
                const landedTile = String((preview && preview.payload && preview.payload.tileId) || '').trim();
                // The reply is the freshest word on that lane there is: take it, and count its run
                // as bid, wherever the bid went.
                if (preview && preview.laneKey && preview.payload && typeof preview.payload === 'object') {
                    noteLane(String(preview.laneKey), preview.payload, 'bid');
                    markBidRun(String(preview.laneKey), preview.payload.runId);
                }
                ab.bids += 1;
                ab.lastBid = { tile: landedTile || lane.tile, amount, at: Date.now() };
                if (landedTile && normTile(landedTile) !== normTile(lane.tile)) {
                    if (settings.autobidRisk && tileVeto(landedTile, landedLane)) takeBack(landedTile, landedLane, lane.tile);
                    else abNote('hold', `The server put this bid on ${landedTile}, not ${lane.tile}.`);
                }
            })
            .catch(e => abNote('alert', `Bid request failed: ${e.message}.`))
            .finally(() => { ab.busy = false; drawAutobid(); });
    }

    // A bid that landed on a risk tile. The bot's triggerAutoUnbid, rule for rule.
    function takeBack(landedTile, landedLane, wanted) {
        const now = Date.now();
        if (landedLane) ab.riskLock[landedLane] = now + AB_RISK_LOCK_MS;
        ab.lockUntil = Math.max(ab.lockUntil, now + AB_RISK_LOCK_MS);
        // !unbid pulls the bid from the lane whose window is open. Is the leaked lane closed
        // already, it would pull some other, good bid — then better nothing, and say so.
        const l = landedLane ? lanes.get(landedLane) : null;
        if (l && !l.open) return abNote('alert', `The server put the bid on ${landedTile} (wanted ${wanted}) and that lane has already closed. !unbid would pull a different bid instead, so nothing was sent.`);
        if (now - ab.lastUnbidAt < AB_UNBID_LOCK_MS) return abNote('alert', `The server put the bid on ${landedTile}, but an !unbid went out a moment ago. This one stays.`);
        const r = sendChatLine('!unbid');
        if (!r.ok) return abNote('alert', `The server put the bid on ${landedTile}. !unbid did not go out: ${r.why}.`);
        ab.lastUnbidAt = now;
        abNote('hold', `The server put the bid on ${landedTile} instead of ${wanted}. Taken back with !unbid.`);
    }

    // ---- the button and its menu ----
    function buildAutobid() {
        let btn = document.querySelector('.mcfo-autobid');
        if (!settings.autobidButton) {
            if (btn) btn.remove();
            if (abMenu && abMenu.isConnected) closeMenus();
            return;
        }
        const area = role('bid-area');
        if (!area) return;
        if (!btn) {
            btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'mcfo-autobid';
            btn.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); showAutobidMenu(btn); });
        }
        if (area.lastElementChild !== btn) area.appendChild(btn);    // right of Unbid, always last
        drawAutobid();
    }

    function drawAutobid() {
        const btn = document.querySelector('.mcfo-autobid');
        if (btn) {
            const on = settings.autobidOn;
            const noteFresh = !!ab.note && Date.now() - ab.noteAt < AB_NOTE_MS;
            const tone = !on ? 'off' : (noteFresh && ab.noteTone === 'alert') ? 'alert' : ab.tone;
            const label = on ? `Autobid ×${settings.autobidAmount}` : 'Autobid';
            const title = on ? (noteFresh ? ab.note + '\n' : '') + ab.text : 'Autobid is off. Click to set it up.';
            if (btn.textContent !== label) btn.textContent = label;
            if (btn.getAttribute('data-mcfo-tone') !== tone) btn.setAttribute('data-mcfo-tone', tone);
            if (btn.title !== title) btn.title = title;
        }
        if (abMenu && abMenu.isConnected) syncAutobidMenu(abMenu);
    }

    function showAutobidMenu(anchor) {
        const menu = showPanel(anchor, 'mcfo-menu--auto', m => {
            m.innerHTML =
                  '<div class="mcfo-auto__head"><span class="mcfo-auto__title">Autobid</span><span class="mcfo-auto__sub">one bid per tile</span></div>'
                + '<label class="mcfo-auto__row"><span class="mcfo-auto__label">Autobid</span>'
                +   '<input type="checkbox" class="mcfo-switch__input" data-mcfo-ab="on"><span class="mcfo-switch" aria-hidden="true"></span></label>'
                + '<label class="mcfo-auto__row"><span class="mcfo-auto__label">Tickets per tile</span>'
                +   '<input type="number" class="mcfo-auto__amount" data-mcfo-ab="amount" min="1" max="' + AUTOBID_MAX + '" step="1" inputmode="numeric"'
                +   ' title="1 to ' + AUTOBID_MAX + ', confirmed with Enter"></label>'
                + '<label class="mcfo-auto__row"><span class="mcfo-auto__label">Risk protection</span>'
                +   '<input type="checkbox" class="mcfo-switch__input" data-mcfo-ab="risk"><span class="mcfo-switch" aria-hidden="true"></span></label>'
                + '<div class="mcfo-auto__hint" data-mcfo-ab="riskhint"></div>'
                + '<div data-mcfo-ab="tiles">'
                +   '<label class="mcfo-auto__row"><span class="mcfo-auto__label">Risk tiles in a Royal Celebration</span>'
                +     '<input type="checkbox" class="mcfo-switch__input" data-mcfo-ab="celeb"><span class="mcfo-switch" aria-hidden="true"></span></label>'
                +   '<div class="mcfo-auto__hint" data-mcfo-ab="celebhint"></div>'
                +   '<label class="mcfo-auto__row"><span class="mcfo-auto__label">Only known tiles</span>'
                +     '<input type="checkbox" class="mcfo-switch__input" data-mcfo-ab="known"><span class="mcfo-switch" aria-hidden="true"></span></label>'
                +   '<div class="mcfo-auto__hint" data-mcfo-ab="knownhint"></div>'
                +   '<div class="mcfo-auto__box mcfo-auto__new" data-mcfo-ab="unknown" hidden></div>'
                +   '<details class="mcfo-auto__lists" data-mcfo-ab="lists"><summary data-mcfo-ab="listsum"></summary>'
                +     '<div class="mcfo-auto__add"><input type="text" class="mcfo-auto__name" data-mcfo-ab="name" placeholder="Tile name" spellcheck="false">'
                +       '<button type="button" class="mcfo-auto__btn" data-mcfo-add="allow">Allow</button>'
                +       '<button type="button" class="mcfo-auto__btn" data-mcfo-add="block">Block</button></div>'
                +     '<div data-mcfo-ab="listbody"></div>'
                +   '</details>'
                + '</div>'
                + '<div class="mcfo-auto__box" data-mcfo-ab="status"></div>'
                + '<div class="mcfo-auto__box" data-mcfo-ab="note" hidden></div>'
                + '<div class="mcfo-auto__last" data-mcfo-ab="last"></div>'
                + '<div class="mcfo-auto__foot"><b>Use at your own risk.</b> Risk protection makes a risk tile much less likely,'
                +   ' but it is no guarantee: the server decides where a bid goes, and a bid it puts on a risk tile cannot always'
                +   ' be taken back in time.</div>'
                + '<div class="mcfo-auto__foot">If something else already bids for this account (a bot, another browser), use only'
                +   ' one of them: both would bid.</div>';
            const q = n => m.querySelector(`[data-mcfo-ab="${n}"]`);

            q('on').addEventListener('change', e => {
                settings.autobidOn = e.target.checked;
                saveSettings();
                if (!settings.autobidOn) releaseTabLock();
                ab.note = '';
                autobidTick();
            });

            // Taken on Enter or on leaving the field, clamped to 1..100. Anything that is not a
            // number puts the old value back rather than guessing.
            const amount = q('amount');
            const commit = () => {
                const v = Math.round(Number(amount.value));
                if (amount.value.trim() !== '' && Number.isFinite(v)) { settings.autobidAmount = clampTickets(v); saveSettings(); }
                amount.value = String(settings.autobidAmount);
                autobidTick();
            };
            amount.addEventListener('change', commit);
            amount.addEventListener('keydown', e => {
                if (e.key === 'Enter')  { e.preventDefault(); commit(); amount.blur(); }
                if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); amount.value = String(settings.autobidAmount); amount.blur(); }
            });
            // A wheel over a focused number field changes it in some browsers — not on a value
            // that spends tickets.
            amount.addEventListener('wheel', e => { if (document.activeElement === amount) e.preventDefault(); }, { passive: false });

            // Switching risk protection on is immediate; switching it off takes a second click
            // within 4 s, with the warning in between — the one setting here that can cost points.
            const risk = q('risk');
            risk.addEventListener('click', e => {
                if (risk.checked || !settings.autobidRisk) return;
                if (Date.now() > abRiskArmedUntil) {
                    e.preventDefault();               // the checkbox stays on, no change event
                    abRiskArmedUntil = Date.now() + 4000;
                    setTimeout(drawAutobid, 4050);
                    // Redrawn after the click, not during it: the redraw sets .checked, and the
                    // browser undoes a cancelled click only after the listeners — touching the
                    // box in between left it switched off in jsdom.
                    setTimeout(drawAutobid, 0);
                }
            });
            risk.addEventListener('change', () => {
                settings.autobidRisk = risk.checked;
                abRiskArmedUntil = 0;
                saveSettings();
                autobidTick();
            });

            q('celeb').addEventListener('change', e => {
                settings.autobidCelebration = e.target.checked;
                saveSettings();
                autobidTick();
            });
            q('known').addEventListener('change', e => {
                settings.autobidKnownOnly = e.target.checked;
                saveSettings();
                autobidTick();
            });
            // One listener for every Allow / Block / Remove button, the lists are redrawn often.
            m.addEventListener('click', e => {
                const b = e.target.closest('[data-mcfo-tile-act]');
                if (b) { setTileList(b.getAttribute('data-mcfo-tile'), b.getAttribute('data-mcfo-tile-act')); return; }
                const add = e.target.closest('[data-mcfo-add]');
                if (add) { const f = q('name'); setTileList(f.value, add.getAttribute('data-mcfo-add')); f.value = ''; }
            });
            q('name').addEventListener('keydown', e => {
                if (e.key === 'Enter') { e.preventDefault(); setTileList(e.target.value, 'allow'); e.target.value = ''; }
            });
            // The menu grows when the lists open — place it again so it stays on screen.
            q('lists').addEventListener('toggle', () => placePanel(anchor, m));
        }, { centre: true });
        abMenu = menu || null;
        if (!menu) return;          // a second click on the button closed it
        syncAutobidMenu(menu);
        placePanel(anchor, menu);
    }

    function syncAutobidMenu(menu) {
        const q = n => menu.querySelector(`[data-mcfo-ab="${n}"]`);
        const put = (el, text) => { if (el.textContent !== text) el.textContent = text; };
        const tone = (el, t) => { if ((el.getAttribute('data-tone') || '') !== t) el.setAttribute('data-tone', t); };

        const on = q('on');
        if (on.checked !== settings.autobidOn) on.checked = settings.autobidOn;
        const amount = q('amount');
        if (document.activeElement !== amount && amount.value !== String(settings.autobidAmount)) amount.value = String(settings.autobidAmount);
        const risk = q('risk');
        if (risk.checked !== settings.autobidRisk) risk.checked = settings.autobidRisk;

        const armed = Date.now() < abRiskArmedUntil;
        const hint = q('riskhint');
        put(hint, armed ? 'Click again to turn it off. Autobid will then bid on every tile, including Zero or Hero and the other tiles that can set your points to zero.'
                 : settings.autobidRisk ? 'Skips the risk tiles (Zero or Hero and the others that can set your points to zero), holds back while one is taking bids, and takes a bid back with !unbid if the server puts it there anyway.'
                 : 'Off: bids on every tile, risk tiles included.');
        tone(hint, armed || !settings.autobidRisk ? 'warn' : '');

        // Tile lists, only with risk protection: without it every tile gets a bid anyway.
        q('tiles').hidden = !settings.autobidRisk;
        const celeb = q('celeb');
        if (celeb.checked !== settings.autobidCelebration) celeb.checked = settings.autobidCelebration;
        put(q('celebhint'), settings.autobidCelebration
            ? 'Bids on a risk tile while it is part of a Royal Celebration: the celebration makes its zero zones safe. Minus zones (Double or Nothing, V-Risko, Zero or Hero) are multiplied by it, so points can still be lost there. Your blocklist still counts.'
            : 'Off: risk tiles are skipped during a Royal Celebration too.');
        tone(q('celebhint'), settings.autobidCelebration ? 'warn' : '');
        const known = q('known');
        if (known.checked !== settings.autobidKnownOnly) known.checked = settings.autobidKnownOnly;
        put(q('knownhint'), settings.autobidKnownOnly
            ? 'Bids only on tiles on your allowlist. A tile the game has just added gets no bid until you allow it.'
            : 'Off: bids on every tile that is not a risk tile or on your blocklist, new tiles included.');
        const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
        const btn = (tile, act, text) => `<button type="button" class="mcfo-auto__btn" data-mcfo-tile-act="${act}" data-mcfo-tile="${esc(tile)}">${text}</button>`;
        const redraw = (el, html) => { if (el._mcfoHtml !== html) { el._mcfoHtml = html; el.innerHTML = html; } };

        const unknown = Object.values(unknownTiles()).sort((a, b) => (a.where === 'lane' ? 0 : 1) - (b.where === 'lane' ? 0 : 1) || b.at - a.at);
        const ubox = q('unknown');
        ubox.hidden = !unknown.length;
        redraw(ubox, unknown.length
            ? '<div class="mcfo-auto__newhead">New tiles, not bid on until you decide:</div>'
              + unknown.map(u => `<div class="mcfo-auto__tile"><span title="${u.where === 'lane' ? 'seen in a lane' : u.where === 'catalogue' ? 'listed in the game\'s tile catalogue' : 'taken off a list'}">${esc(u.name)}${u.where === 'catalogue' ? ' <i>catalogue</i>' : ''}</span>`
                  + btn(u.name, 'allow', 'Allow') + btn(u.name, 'block', 'Block') + '</div>').join('')
            : '');

        const risky = Object.keys(riskState().tiles).filter(t => riskState().tiles[t]).map(t => riskState().names[t] || t);
        put(q('listsum'), `Tile lists: ${settings.autobidAllow.length} allowed, ${settings.autobidBlock.length + risky.length} blocked`);
        const sorted = list => list.slice().sort((a, b) => a.localeCompare(b));
        redraw(q('listbody'),
            '<div class="mcfo-auto__listhead">Allowed</div>'
            + (sorted(settings.autobidAllow).map(t => `<div class="mcfo-auto__tile"><span>${esc(t)}</span>${btn(t, '', 'Remove')}</div>`).join('') || '<div class="mcfo-auto__none">none</div>')
            + '<div class="mcfo-auto__listhead">Blocked</div>'
            + sorted(settings.autobidBlock).map(t => `<div class="mcfo-auto__tile"><span>${esc(t)}</span>${btn(t, '', 'Remove')}</div>`).join('')
            + sorted(risky).map(t => `<div class="mcfo-auto__tile"><span>${esc(t)} <i>risk tile</i></span></div>`).join('')
            + (settings.autobidBlock.length || risky.length ? '' : '<div class="mcfo-auto__none">none</div>'));

        const status = q('status');
        put(status, settings.autobidOn ? ab.text : 'Off. Switch it on above.');
        tone(status, settings.autobidOn ? ab.tone : '');

        const note = q('note');
        const noteFresh = !!ab.note && Date.now() - ab.noteAt < AB_NOTE_MS;
        note.hidden = !noteFresh;
        put(note, noteFresh ? ab.note : '');
        tone(note, noteFresh ? ab.noteTone : '');

        const parts = [];
        if (ab.lastBid) parts.push(`Last bid: ${ab.lastBid.amount} on ${ab.lastBid.tile}, ${clock(ab.lastBid.at)}`);
        if (ab.bids) parts.push(`${ab.bids} this session`);
        put(q('last'), parts.join(' · '));
    }

    function startAutobid() {
        laneListeners.push((laneKey, entry, prev, source) => {
            if (source !== 'socket' || !settings.autobidOn) return;
            if (entry.open && (!prev || !prev.open || prev.runId !== entry.runId)) ab.priority = laneKey;
            if (ab.tickQueued) return;
            ab.tickQueued = true;
            // Our listener sits on the socket before the game's (added in its constructor), so it
            // runs first. The tick waits until the game has taken the frame in — its chip lock is
            // read from the page.
            setTimeout(autobidTick, 60);
        });
        // The frames drive it; this beat keeps the status fresh and covers a quiet socket.
        setInterval(autobidTick, 1000);
        autobidTick();
    }

