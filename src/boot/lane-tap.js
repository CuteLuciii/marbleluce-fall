    // =========================================================================================
    // 0. LANE STATE, READ ALONG FROM THE GAME'S SOCKET  (the only part that runs this early)
    // =========================================================================================
    // Autobid (9g) needs to know, lane by lane, which tile is up, which run it belongs to and
    // whether its bidding window is open. The game keeps that inside its modules
    // (laneStateByLane, app.js) and has no endpoint for it: it only arrives as lane_state.v1
    // frames on the gameplay socket, which prodViewer/ingest.js opens with a plain
    // new WebSocket('/ws'). So that socket is read along, passively, the way 1.5 read it for its
    // gold counter. Nothing is ever sent on it.
    //
    // This is why the script runs at document-start since 5.0: the tap has to be in place before
    // the game opens its socket. Everything else waits for the DOM as before — see main() and the
    // end of the file.
    //
    // The tap goes into the page through unsafeWindow. With any @grant the script lives in a
    // sandbox, and a WebSocket replaced there is replaced for the script alone (1.5 found that
    // out: window.WebSocket in the page still read "[native code]").
    const pageWindow = (typeof unsafeWindow !== 'undefined' && unsafeWindow) || window;
    const lanes = new Map();          // laneKey -> { phase, open, runId, tile, at, runChangedAt }
    const laneListeners = [];
    const tapStartedAt = Date.now();
    // Royal Celebration per tile (6.54): laneKey -> { runId, tile, multiplier, at }. The game marks
    // every tile that belongs to a celebration on the tile itself (royalCelebration, like kingToll),
    // from the moment it is revealed. That mark only comes in simsync_state.v1, not in lane_state.v1.
    // It counts for exactly that run and that tile (see celebrationFree in 9g), so a mark never has
    // to be cleared: the next run on the lane simply does not match it any more.
    const laneCelebration = new Map();
    function noteCelebration(msg) {
        const laneKey = String(msg.laneKey || '');
        const run = msg.run && typeof msg.run === 'object' ? msg.run : {};
        const runId = String(run.runId || '');
        if (!laneKey || !runId) return;
        // The same places the bot looks (rcTileMerken), in the same order.
        const sources = [run.tile, msg.revealed && msg.revealed.tile, msg.revealedTileTruth, msg.staticWorld];
        const src = sources.find(t => t && typeof t === 'object' && t.royalCelebration && typeof t.royalCelebration === 'object');
        if (!src) return;
        const lane = lanes.get(laneKey);
        const tile = String(src.tileId || (run.tile && run.tile.tileId) || (msg.revealedTileTruth && msg.revealedTileTruth.tileId)
                            || (lane && lane.runId === runId ? lane.tile : '') || '').trim();
        if (!tile) return;
        laneCelebration.set(laneKey, { runId, tile, multiplier: Number(src.royalCelebration.multiplier) || 0, at: Date.now() });
    }
    let tapInstalled = false;

    // One lane_state payload — from the socket, or from the reply to a bid (bidPreviewLaneState).
    function noteLane(laneKey, p, source) {
        const now = Date.now();
        const prev = lanes.get(laneKey);
        const runId = String(p.runId || '');
        const entry = {
            phase: String(p.nativePhase || p.phase || ''),
            open: p.biddingOpen === true,
            runId,
            tile: String(p.tileId || '').trim(),
            at: now,
            // For lane trust (9g) only a CHANGE of run counts, never the mere arrival of a frame:
            // a lane that keeps sending frames of an old run looks fresh and is not (the bot's
            // lesson of 06.08.). The first sighting counts as a change, as in the bot.
            runChangedAt: runId && runId !== (prev ? prev.runId : '') ? now : (prev ? prev.runChangedAt : 0),
        };
        lanes.set(laneKey, entry);
        for (const fn of laneListeners) {
            try { fn(laneKey, entry, prev, source); } catch (e) { /* a listener never breaks the tap */ }
        }
    }

    // Frames come one by one or bundled in kernel_outputs.v1; the bot unpacks them the same way.
    function takeFrame(msg) {
        if (!msg || typeof msg !== 'object') return;
        if (msg.kind === 'kernel_outputs.v1' && Array.isArray(msg.kernelOutputs)) { msg.kernelOutputs.forEach(takeFrame); return; }
        if (msg.kind === 'lane_state.v1' && msg.laneKey && msg.payload && typeof msg.payload === 'object') {
            noteLane(String(msg.laneKey), msg.payload, 'socket');
        }
        if (msg.kind === 'simsync_state.v1' && msg.laneKey) noteCelebration(msg);
    }

    function readFrame(data) {
        // Binary frames are physics, most text frames are event digests. Only a frame that
        // mentions lane_state is worth a JSON.parse.
        // A simsync frame is parsed only when it carries a celebration mark (6.54): those frames
        // are large, and outside a celebration none of them is needed.
        if (typeof data !== 'string') return;
        const laneFrame = data.indexOf('lane_state.v1') !== -1;
        const celebFrame = !laneFrame && data.indexOf('simsync_state.v1') !== -1 && data.indexOf('"royalCelebration"') !== -1
                           && /"royalCelebration"\s*:\s*\{/.test(data);
        if (!laneFrame && !celebFrame) return;
        try { takeFrame(JSON.parse(data)); } catch (e) { /* a broken frame is skipped */ }
    }

    // One socket, tapped at most once, whoever hands it over. The gameplay socket only, never
    // the chat (/chat/ws). Reading a socket that is already open costs nothing: lane_state frames
    // arrive again and again, so there is nothing to catch up on.
    const tappedSockets = new WeakSet();
    const ownListeners = new WeakSet();
    function tapSocket(ws) {
        try {
            if (!ws || tappedSockets.has(ws)) return;
            if (new URL(String(ws.url || ''), location.href).pathname !== '/ws') return;
            tappedSockets.add(ws);        // set first: our own addEventListener comes back through here
            const listener = e => readFrame(e.data);
            ownListeners.add(listener);
            ws.addEventListener('message', listener);
        } catch (e) { /* never let the tap break the socket */ }
    }

    // --- Hide cosmetics (Settings › Cosmetics, 6.49; bidding indicators alone since 6.47) ---
    // Every cosmetic is taken out of the data before the game reads it, never painted over: the
    // game then draws exactly what it draws for a player who owns none. Three sources:
    //   marbles  the per-player receipts in the lane frames of the gameplay socket
    //            (payload.marbleTrailAssignments / marbleBorderAssignments / rebellionAuraAssignments /
    //            biddingIndicatorAssignments, read by the runtimeScene.js of each). Receipts also come
    //            back in the reply to one's own bid (bidPreviewLaneState of /bid/place).
    //   chat     the snapshot on every chat line (presentation.cosmetics, schema
    //            mcf.chat-cosmetic-snapshot/v1, chat socket /chat/ws): text = font colour, panel =
    //            background or King bubble (panel.sourceSlot), username = username style. Its
    //            plainFallback carries the same colours and is neutralised with it. Checked against
    //            the game's own resolveChatCosmeticRenderModel: each part comes out as the plain model.
    //            Hiding ALL chat cosmetics uses the game's own button in the chat header instead (below).
    //   king     snapshot.kingCosmetics.wreath (king socket /king/ws and /api/king/snapshot); the crown
    //            is the 3D overlay layer and is hidden by CSS, as the Maximum performance level does.
    // Read straight from storage here: the settings (section 1) only exist once the page is there.
    // The bidding-indicator store (biddingIndicators/assignmentStore.js) keeps what it accepted for
    // the rest of a run, so marbles change with the next run on each lane; chat lines from the next
    // message on.
    const COS_GROUPS = { marbles: ['trail', 'border', 'aura', 'indicator'], chat: ['chatColour', 'chatBg', 'chatName', 'kingBubble'], king: ['crown', 'wreath'] };
    const COS_GROUP_KEYS = { marbles: 'hideCosMarbles', chat: 'hideCosChat', king: 'hideCosKing' };
    const COS_KEYS = { trail: 'hideTrails', border: 'hideBorders', aura: 'hideAuras', indicator: 'bidIndicatorMode',
                       chatColour: 'hideChatColours', chatBg: 'hideChatBackgrounds', chatName: 'hideUsernameStyles', kingBubble: 'hideKingBubbles',
                       crown: 'hideCrown', wreath: 'hideWreath' };
    const COS_MARBLE_FIELDS = { biddingIndicatorAssignments: 'indicator', marbleTrailAssignments: 'trail',
                                marbleBorderAssignments: 'border', rebellionAuraAssignments: 'aura' };
    const CHAT_COS_SCHEMA = 'mcf.chat-cosmetic-snapshot/v1';
    // Bidding indicators have three states since 6.50 (bidIndicatorMode 0 show, 1 standard size,
    // 2 hide); the 6.47-6.49 switch hideBidIndicators counts as Hide.
    const bidMode = st => {
        if (st.bidIndicatorMode === undefined) return st.hideBidIndicators ? 2 : 0;
        const m = Number(st.bidIndicatorMode); return m === 1 || m === 2 ? m : 0;
    };
    function cosCompute(st) {
        const out = {};
        for (const [g, parts] of Object.entries(COS_GROUPS))
            for (const p of parts) out[p] = !!(st.hideCosAll || st[COS_GROUP_KEYS[g]] || (p === 'indicator' ? bidMode(st) === 2 : st[COS_KEYS[p]]));
        out.indicatorSmall = !out.indicator && bidMode(st) === 1;
        return out;
    }
    let cosHide = {};
    try { cosHide = cosCompute(JSON.parse(localStorage.getItem('mcf_overhaul_settings')) || {}); } catch (e) {}
    const cosChatParts = () => cosHide.chatColour || cosHide.chatBg || cosHide.chatName || cosHide.kingBubble;
    // A cheap look at the raw text first: frames without anything to hide are never parsed.
    function cosConcerns(txt) {
        if (typeof txt !== 'string') return false;
        for (const [field, part] of Object.entries(COS_MARBLE_FIELDS)) if (cosHide[part] && txt.indexOf('"' + field + '"') !== -1) return true;
        if (cosChatParts() && txt.indexOf(CHAT_COS_SCHEMA) !== -1) return true;
        return !!cosHide.wreath && txt.indexOf('"kingCosmetics"') !== -1;
    }
    function chatCosStrip(v) {
        const slot = v.panel && v.panel.sourceSlot;
        const dropPanel = (cosHide.chatBg && slot === 'chat_background_style') || (cosHide.kingBubble && slot === 'king_chat_bubble_style');
        if (!cosHide.chatColour && !cosHide.chatName && !dropPanel) return v;
        const o = Object.assign({}, v, { plainFallback: Object.assign({}, v.plainFallback) });
        if (cosHide.chatColour) { delete o.text; o.assist = { preset: 'none' }; delete o.plainFallback.textHex; }
        if (cosHide.chatName) {
            delete o.username; delete o.plainFallback.usernameHex;
            if (o.items && o.items.username_style) o.items = Object.assign({}, o.items, { username_style: { itemId: null } });
        }
        if (dropPanel) {
            delete o.panel; delete o.plainFallback.panelHex;
            if (slot === 'king_chat_bubble_style') o.king = Object.assign({}, o.king, { applied: false });
        }
        return o;
    }
    // Standard size (6.51): the indicator keeps its own look and is only drawn smaller, to the
    // height of the game's plain bid banner (INGRESS_BID_BANNER_HEIGHT_PX 30). 6.50 turned it into a
    // plain panel instead - same size, but the look was gone. The game draws a decorated indicator
    // as one SVG group (biddingIndicators/renderer.js renderStudy) and sets its place every frame as
    // transform="translate(anchor y) scale(±1 1)", anchored at the marble's edge; the amount is a
    // separate text right after it, centred in the frame's well at anchor ± (wellX + well/2). So
    // the scale goes into that transform and the amount moves along, at its own size: the well is
    // at least 106 wide, scaled it still holds a 12 px amount. Body heights from BODIES
    // (components.js): compact 58, expanded 70. Works from the next frame, no new run needed.
    //
    // 6.51.1: on the lanes the game moves every amount to the end of the group each frame
    // (renderRailsStatic.js, foregroundAmounts: the text stays above crossing decoration), so the
    // amount is NOT the element after the indicator - in 6.51 the scale latched on to the player's
    // name there and the amount stayed where it was. Now the indicator and its amount are tied once,
    // when the game builds the indicator (it inserts the group right before the amount), with a
    // fallback by height for indicators that were already there. Only bid amounts are ever moved.
    // 6.51.2: exactly the banner's size, 72 x 30 (INGRESS_BID_BANNER_WIDTH/HEIGHT_PX). Width and
    // height are scaled each on their own, from the drawing's real extent (getBBox, once per
    // drawing): one factor for both (6.51.1) fit the width and left the indicator lower than the
    // banners. The drawing is centred on the lane line (y = 0 in its own units), so the height is
    // taken symmetrically. The ornament is squeezed by a few per cent at most.
    const IND_BODY_HEIGHT = { compact_body_v1: 58, expanded_body_v1: 70 };
    const IND_TARGET_HEIGHT = 30, IND_TARGET_WIDTH = 72;
    const indExtent = new WeakMap();   // first child of a drawing -> { right, half } (local units)
    let indScaleInstalled = false;
    const isBidText = el => el && el.tagName === 'text' && (el.getAttribute('data-ingress-marble-label') === 'bid'
        || (!el.hasAttribute('data-ingress-marble-label') && !!el.__mcfoIndG));
    function indScaleOf(g) {
        const body = IND_BODY_HEIGHT[g.getAttribute('data-construction')] || 58;
        let kx = IND_TARGET_HEIGHT / body, ky = kx;
        const first = g.firstChild;
        if (first) {
            let e = indExtent.get(first);
            if (!e) {
                try { const b = g.getBBox(); e = { right: b.x + b.width, half: Math.max(Math.abs(b.y), Math.abs(b.y + b.height)) }; }
                catch (err) { e = { right: 0, half: 0 }; }
                indExtent.set(first, e);
            }
            if (e.right > 0) kx = IND_TARGET_WIDTH / e.right;
            if (e.half > 0) ky = IND_TARGET_HEIGHT / (2 * e.half);
        }
        return { kx, ky };
    }
    function indGroupFor(label) {
        if (label.__mcfoIndG && label.__mcfoIndG.parentNode === label.parentNode) return label.__mcfoIndG;
        const y = Number(label.getAttribute('y')) - 2;
        for (const g of label.parentNode ? label.parentNode.children : []) {
            if (g.tagName === 'g' && g.__mcfoInd && Math.abs(g.__mcfoInd.y - y) < 1) { label.__mcfoIndG = g; return g; }
        }
        return null;
    }
    function installIndicatorScale() {
        if (indScaleInstalled) return;
        indScaleInstalled = true;
        try {
            const proto = pageWindow.Element.prototype, nativeSet = proto.setAttribute;
            proto.setAttribute = function (name, value) {
                if (name === 'transform' && cosHide.indicatorSmall && this.tagName === 'g' && this.getAttribute('aria-hidden') === 'true') {
                    const m = /^translate\(([-\d.e]+) ([-\d.e]+)\) scale\((-?1) 1\)$/.exec(String(value));
                    if (m) {
                        const next = this.nextSibling;
                        if (next && next.tagName === 'text' && next.getAttribute('data-ingress-marble-label') !== 'name') next.__mcfoIndG = this;
                        const { kx, ky } = indScaleOf(this);
                        this.__mcfoInd = { anchor: Number(m[1]), y: Number(m[2]), k: kx };
                        return nativeSet.call(this, name, 'translate(' + m[1] + ' ' + m[2] + ') scale(' + (Number(m[3]) * kx) + ' ' + ky + ')');
                    }
                } else if (name === 'x' && cosHide.indicatorSmall && isBidText(this)) {
                    const g = indGroupFor(this);
                    if (g && g.__mcfoInd && g.getAttribute('data-renderer-branch') === 'component_construction' && g.getAttribute('display') !== 'none')
                        value = g.__mcfoInd.anchor + (Number(value) - g.__mcfoInd.anchor) * g.__mcfoInd.k;
                }
                return nativeSet.call(this, name, value);
            };
        } catch (e) { console.warn('[MarbleLuceFall] could not size bidding indicators:', e.message); }
    }
    if (cosHide.indicatorSmall) installIndicatorScale();
    function cosReviver(k, v) {
        const part = COS_MARBLE_FIELDS[k];
        if (part) return cosHide[part] ? undefined : v;
        if (k === 'kingCosmetics' && cosHide.wreath && v && typeof v === 'object' && v.wreath) {
            const o = Object.assign({}, v); delete o.wreath; return o;
        }
        if (v && typeof v === 'object' && v.schema === CHAT_COS_SCHEMA) return chatCosStrip(v);
        return v;
    }

    // Wraps a page message listener (gameplay, chat and king sockets). Frames that carry nothing
    // to hide - binary physics, digests, everything while all switches are off - go through as they came.
    const cosWrapped = new WeakMap();
    function cosmeticFilter(fn) {
        if (cosWrapped.has(fn)) return cosWrapped.get(fn);
        const w = function (e) {
            if (cosConcerns(e.data)) {
                let ev = null;
                try {
                    ev = new pageWindow.MessageEvent('message', { data: JSON.stringify(JSON.parse(e.data, cosReviver)), origin: e.origin, lastEventId: e.lastEventId });
                } catch (err) { /* a frame we cannot read goes through as it came */ }
                if (ev) return fn.call(this, ev);
            }
            return fn.call(this, e);
        };
        cosWrapped.set(fn, w);
        return w;
    }

    // Installed only once a switch is first turned on: until then this script leaves the page's
    // fetch alone. Only the reply of /bid/place and the King snapshot are ever looked at.
    let cosFetchWrapped = false;
    function wrapCosFetch() {
        if (cosFetchWrapped) return;
        cosFetchWrapped = true;
        try {
            const nativeFetch = pageWindow.fetch;
            pageWindow.fetch = function (input, init) {
                const pending = nativeFetch.apply(this, arguments);
                let url = '';
                try { url = typeof input === 'string' ? input : String((input && input.url) || ''); } catch (e) {}
                if (url.indexOf('/bid/place') === -1 && url.indexOf('/api/king/snapshot') === -1) return pending;
                return pending.then(res => res.clone().text().then(txt => {
                    if (!cosConcerns(txt)) return res;
                    return new pageWindow.Response(JSON.stringify(JSON.parse(txt, cosReviver)),
                        { status: res.status, statusText: res.statusText, headers: res.headers });
                }).catch(() => res));
            };
        } catch (e) { console.warn('[MarbleLuceFall] could not filter cosmetics from replies:', e.message); }
    }
    if (Object.values(cosHide).some(Boolean)) wrapCosFetch();

    try {
        const NativeWebSocket = pageWindow.WebSocket;
        // A subclass keeps instanceof, the readyState constants and every method intact.
        class TappedWebSocket extends NativeWebSocket {
            constructor(...args) {
                super(...args);
                tapSocket(this);
            }
        }
        pageWindow.WebSocket = TappedWebSocket;

        // The constructor is the clean way, but it only catches a socket this script was in time
        // for. When the userscript manager injects late — seen in the wild after a cold browser
        // start — the game's socket already exists, not one frame is ever read, and autobid sits
        // there switched on bidding nothing until the page is reloaded (20.09.2026).
        //
        // So the instance is taken from the two methods the game uses on it afterwards as well.
        // It adds its own message listener after the constructor has returned, it sends a
        // subscribe from its own open handler on every connect, and it sends a resync whenever a
        // lane needs a fresh basis (prodViewer/ingest.js) — whichever of those comes first hands
        // the socket over. Both wrappers pass everything through untouched.
        const proto = NativeWebSocket.prototype;
        const nativeAdd = proto.addEventListener;
        proto.addEventListener = function (...args) {
            tapSocket(this);
            // Every page message listener - gameplay, chat and king socket - gets the cosmetics
            // filter (6.49). A socket found late (see above) already has its listener - its
            // cosmetics then stay until the next reload.
            if (args[0] === 'message' && typeof args[1] === 'function' && !ownListeners.has(args[1]))
                args[1] = cosmeticFilter(args[1]);
            return nativeAdd.apply(this, args);
        };
        // A listener taken off again has to be the wrapped one, or it would stay on.
        const nativeRemove = proto.removeEventListener;
        proto.removeEventListener = function (...args) {
            if (args[0] === 'message' && typeof args[1] === 'function' && cosWrapped.has(args[1])) args[1] = cosWrapped.get(args[1]);
            return nativeRemove.apply(this, args);
        };
        const nativeSend = proto.send;
        proto.send = function (...args) { tapSocket(this); return nativeSend.apply(this, args); };

        tapInstalled = true;
    } catch (e) {
        // Without the tap everything else still works; autobid then says it cannot see the lanes.
        console.warn('[MarbleLuceFall] could not read the lanes, autobid stays idle:', e.message);
    }

