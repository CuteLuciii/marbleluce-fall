    // =========================================================================================
    // 3. STYLES
    // =========================================================================================
    // Kept as a string: a colour theme (section 3b) runs this very text through its colour
    // mapping and lays the result over it.
    const BASE_CSS = `
        /* === THE GAME'S ARENA HELP (arenaHelp.js, game v0.10.0f) ===
           The game now puts help texts on the header cards (hover or focus opens a tooltip),
           an "Arena help" button into the footer, a "?" beside the bid buttons for new players
           and a "Currency & arena guide" into the sound controls. Regular players do not need any
           of it, so all of it stays hidden. The cards themselves are untouched: the game wrapped
           label and value in a .arenaHelpMetric button, which keeps showing, just without the
           help cursor. */
        .arenaHelpTooltip,
        .arenaHelpGuide,
        .arenaHelpButton { display: none !important; }
        .arenaHelpMetric { cursor: inherit !important; }

        /* === KING TILE: NAME AND GOLD LEFT, TOLL RIGHT ===
           Deliberately without backdrop-filter. It forced the whole stack underneath onto its
           own texture, which is not rasterised at the resolution of the board — the king tile
           went visibly soft and blocky. The background there is nearly black anyway, so an
           opaque panel is enough. */
        /* No panel, no border: the read-outs sit directly on the tile. What a background used
           to do for legibility a shadow does now — the tile is dark at the top but not evenly
           so, and text without either becomes unreadable over the crown. */
        .mcfo-king-field {
            position: absolute;
            top: 10px;
            z-index: 40;
            pointer-events: none;
            display: flex;
            align-items: center;
            gap: 8px;
            font-family: inherit;
            font-size: 1.25em;
            line-height: 1.2;
            color: #eaf2f8;
            white-space: nowrap;
            text-shadow: 0 1px 3px rgba(0,0,0,0.95), 0 0 10px rgba(0,0,0,0.75);
        }
        /* Capped so the name can never run into the toll field on a narrow window. */
        .mcfo-king-field--name { left: 12px; max-width: calc(100% - 150px); }
        .mcfo-king-field--toll { right: 12px; }
        .mcfo-king-field .mcfo-value { font-weight: 700; color: #ffd479; }
        .mcfo-king-field .mcfo-label { opacity: 0.7; }
        .mcfo-king-field .mcfo-name  { opacity: 0.9; max-width: 220px; overflow: hidden; text-overflow: ellipsis; }
        /* Older than two polls: draw it faint rather than assert a number that may have moved on. */
        .mcfo-king-field[data-mcfo-stale="1"] { opacity: 0.45; }

        /* The game's own read-outs (v0.10.1, king-corner-labels): size and visibility from the
           settings, single lines hidden by name. Sizes are the game's 16 px / 19 px scaled, so
           100% is exactly the original. */
        html[data-mcfo-kc] .mcf-king-corner-labels {
            font-size: calc(16px * var(--mcfo-kc-scale, 1));
            opacity: var(--mcfo-kc-alpha, 1);
        }
        /* Both columns are grids stretched to the taller one: with lines hidden on one side the
           rest would spread out over the gap. Packed to the top instead. */
        html[data-mcfo-kc] .mcf-king-corner-labels > div { align-content: start; }
        html[data-mcfo-kc] .mcf-king-corner-labels .mcf-king-corner-labels__name {
            font-size: calc(19px * var(--mcfo-kc-scale, 1));
        }
        html[data-mcfo-kc~="name"]     [data-role="king-corner-name"],
        html[data-mcfo-kc~="reign"]    [data-role="king-corner-reign"],
        html[data-mcfo-kc~="duration"] [data-role="king-corner-duration"],
        html[data-mcfo-kc~="gold"]     [data-role="king-corner-gold"],
        html[data-mcfo-kc~="tolls"]    [data-role="king-corner-tolls"],
        html[data-mcfo-kc~="thwarted"] [data-role="king-corner-thwarted"] { display: none !important; }
        html[data-mcfo-kc~="off"] .mcf-king-corner-labels { display: none !important; }
        /* Our line inside the game's right column: same font, the value in the game's gold. */
        .mcfo-kc-toll b { font-weight: 700; color: #f4d28b; }
        .mcfo-kc-toll[data-mcfo-stale="1"] { opacity: 0.45; }
        /* The king's VIP tier under the title line; the colour comes inline from the tier. */
        .mcfo-kc-vip { font-weight: 700; }

        /* === TIDY FOOTER ===
           Driven by an attribute on <html> so that switching a button back on brings it straight
           back, with no inline style to clean up anywhere. The attribute is a space-separated
           list of the hidden roles, one rule per button, so each has its own switch. */
        ${FOOTER_BUTTONS.map(b => `html[data-mcfo-hide~="${b.role}"] [data-role="${b.role}"]`).join(',\n        ')} { display: none !important; }
        /* Rebellion and Beverages are only hidden in the footer, never removed: the copies in
           the king tray forward their clicks to exactly these originals. */
        html[data-mcfo-tray="1"] [data-role="nav-region"] > [data-role="rebellion-toggle"],
        html[data-mcfo-tray="1"] [data-role="nav-region"] > [data-role="beverages-toggle"] { display: none !important; }

        /* === KING TRAY: ATTACK CENTRED, REBELLION LEFT, BEVERAGES RIGHT ===
           The attack button was stretched across the whole tray (measured 615 of 635px) while
           its longest label needs 187px. Three columns with 1fr on the outside keep it exactly
           centred however wide the two side buttons are. */
        /* Sized by the tray's own width (6.11): the tray is a container, and gaps, the attack
           button, the beverage buttons and their text are given in cqi (1% of its width) between a
           readable floor and the old sizes. Before, the attack button's fixed 200px and the gaps
           added up to about 330px — on a smaller screen the king pane is narrower than that, and
           the outer buttons were cut off. */
        html[data-mcfo-tray="1"] [data-role="king-action-tray"] { container-type: inline-size; }
        html[data-mcfo-tray="1"] .mcf-king-action-content {
            display: grid !important;
            grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
            align-items: center;
            gap: clamp(4px, 1.6cqi, 10px);
            /* Vertical padding as in the original (7px): at 0 the tray shrank from 57 to 43px,
               and the king pane derives its height from that. */
            padding: 7px clamp(4px, 1.6cqi, 10px);
            /* The height of the beverage buttons, measured from the attack button (6.20.3,
               syncDrinkHeight). The value here only carries the first frames, before the
               measurement is in. */
            --mcfo-drink-h: 30px;
            /* A floor, and the whole point of it is timing (6.20.3). The game rebuilds the tray
               with innerHTML and measures the columns in the SAME task
               (renderTray -> syncKingTileFit -> scheduleActionAwareMainGrid), while our copy of
               the attack button is only put back by a MutationObserver, a beat later. In between,
               the game's own attack button is already hidden by our sheet and this content box is
               empty: 14px, the padding and nothing else. The game then hands the king column the
               width of a pane that has almost no tray — the tile grows, stands higher and pushes
               the bar down, and since the game only measures again when the chat is folded, it
               stays that way (Luce, 16.09.; measured on her page: 564px wide when it counts on a
               57px tray, 579px when it counts on 14px).
               56px is what this box measures when it holds the attack button: the button's 42px
               and 7px of padding above and below, which count in because the page puts every box
               on border-box. The tray around it is then the 57px the game knows. A floor only —
               if the game ever makes its button taller, the box and the tray follow. */
            min-height: 56px;
        }
        html[data-mcfo-tray="1"] .mcf-king-action-content .mcf-king-attack-placeholder {
            /* 200px. Measured widths of the labels the button uses (kingPane.js):
                 SIGN IN TO ATTACK THE THRONE  213px   (ignored: signed-out players have no use
                                                        for a layout script)
                 BID TO ATTACK THE THRONE      187px   <- the yardstick, and the normal state
                 SNAPSHOT UNAVAILABLE          168px      whenever no bid is running
                 CURRENTLY BIDDING             138px
               The ellipsis below is a backstop: should a longer label ever appear, it is clipped
               rather than wrapped. A two-line button makes the tray taller, and the king pane
               computes its height from the tray.
               Since 6.11 200px is the ceiling, not the floor: the button narrows with the tray,
               down to 96px, and its text with it. */
            min-width: 0;
            width: clamp(96px, 34cqi, 200px) !important;
            font-size: clamp(9px, 2.1cqi, 13px) !important;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            justify-self: center;
            grid-column: 2;
            grid-row: 1;
        }
        /* grid-row is required on all three. The side buttons come after the attack button in
           the DOM, and grid auto-placement does not go backwards: without it Rebellion drops to
           a second row, the tray grows from 57 to 90px and the attack button ends up 97px off
           centre (all measured). */
        html[data-mcfo-tray="1"] .mcf-king-action-content [data-mcfo-side="left"]  { grid-column: 1; grid-row: 1; justify-self: start; }
        html[data-mcfo-tray="1"] .mcf-king-action-content [data-mcfo-side="right"] { grid-column: 3; grid-row: 1; justify-self: end; }
        /* Side by side after all. The first attempt stacked them because two in a row seemed to
           need 190px against 95px available — but that was my own min-width:70px, not the text:
           measured at 11px/800 the widest label ("Water") is 30px, so a button is 42px and a pair
           90px. It fits, with 5px to spare.
           Order is deliberate and the same on both sides: the harmless one first, the harmful one
           second — Water then Lava, Milk then Acid. */
        /* The pair fills its column instead of hugging the outer edge. Sized to the text they
           left most of a 197px column empty while sitting at the far rim — the space was there
           all along, the buttons just did not ask for it. With flex they follow the window: about
           96px each on a wide screen, about 44px on a narrow one, and always the same distance
           from the attack button. */
        html[data-mcfo-tray="1"] .mcfo-stack { display: flex; gap: clamp(3px, 1cqi, 6px); grid-row: 1; justify-self: stretch; width: 100%; }
        html[data-mcfo-tray="1"] .mcfo-stack--left  { grid-column: 1; }
        html[data-mcfo-tray="1"] .mcfo-stack--right { grid-column: 3; justify-content: flex-end; }
        /* Scaled through one variable, set from the "Button size" slider — width and text, not
           height. Since 6.20.3 a beverage button is exactly as tall as the attack button beside
           it (Luce: the different heights had bothered her since the buttons took the look of the
           themes). That also settles an old worry written here: a button taller than the attack
           button made the whole tray taller, and the king pane derives its height from the tray,
           so the size slider used to have a ceiling for that reason alone.
           The height comes from syncDrinkHeight as --mcfo-drink-h; the text is centred in it
           instead of being pushed there by padding. */
        .mcfo-drink {
            flex: 1 1 0;
            min-width: 0; max-width: calc(130px * var(--mcfo-drink-scale, 1));
            height: var(--mcfo-drink-h, 30px);
            display: inline-flex; align-items: center; justify-content: center;
            padding: 0 calc(clamp(3px, 1.2cqi, 8px) * var(--mcfo-drink-scale, 1));
            border: 2px solid; border-radius: 6px;
            font-family: inherit; font-weight: 800; font-size: calc(clamp(9px, 2.1cqi, 13px) * var(--mcfo-drink-scale, 1)); line-height: 1; cursor: pointer;
            /* Clipped rather than wrapped when the window gets tight: a second line would make the
               tray taller, and the king pane derives its height from the tray. */
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
            box-shadow: 0 2px 6px rgba(0,0,0,0.5);
            transition: transform 90ms ease, filter 90ms ease;
        }
        .mcfo-drink:hover { transform: translateY(-1px); filter: brightness(1.12); }
        /* Symbols instead of names (6.12): the symbol carries the meaning, so the button itself can
           take the page's look — the stock button colours here, which a theme recolours like the rest
           of this sheet, and a Deluxe skin's own buttons (SKIN_BUTTONS). The name stays as a tooltip
           and for screen readers. The height is the attack button's since 6.20.3, so the symbol is
           simply centred in it; it is capped below so it always fits. */
        .mcfo-drink--icon {
            background: #111f2b; border-color: #355066; color: #cde6ff;
        }
        .mcfo-drink--icon:hover { border-color: #4d7ea6; }
        .mcfo-drink__icon {
            display: block; flex: none;
            /* Grows with the tray up to 22px, times the size slider — and never past 27px, so the
               button stays inside the tray at 140% too. */
            width: min(calc(clamp(15px, 4.4cqi, 22px) * var(--mcfo-drink-scale, 1)), 27px, calc(var(--mcfo-drink-h, 30px) - 8px));
            height: min(calc(clamp(15px, 4.4cqi, 22px) * var(--mcfo-drink-scale, 1)), 27px, calc(var(--mcfo-drink-h, 30px) - 8px));
            filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.45));
        }

        /* === BEVERAGE PANEL === */
        .mcfo-menu--bev { min-width: 268px; padding: 10px 12px 12px; }
        .mcfo-bev__head { font-family: inherit; font-weight: 800; font-size: 13px; line-height: 1; letter-spacing: 0.06em; text-transform: uppercase;
                          padding-bottom: 8px; border-bottom: 1px solid #243443; margin-bottom: 8px; }
        .mcfo-bev__row { display: grid; grid-template-columns: 58px 1fr 1fr; gap: 6px; align-items: center; margin-bottom: 6px; }
        .mcfo-bev__row:last-child { margin-bottom: 0; }
        .mcfo-bev__size { font-size: 11px; font-weight: 800; color: #d8e2e7; }
        /* Currency colours are the game's own, from kingBeverages.js.
           Scoped to .mcfo-menu--bev for the same reason as the Rebellion tiles: the generic
           ".mcfo-menu button" rule is more specific than a bare class and used to strip these
           buttons of border, background and centring — they showed as loose coloured words. */
        .mcfo-menu--bev .mcfo-bev__buy {
            width: auto; text-align: center;
            padding: 6px 4px; border: 1px solid #64757c; border-radius: 5px;
            background: #26343a; color: #fff; font-family: inherit; font-weight: 800; font-size: 11px; line-height: 1; cursor: pointer;
        }
        .mcfo-menu--bev .mcfo-bev__buy[data-mcfo-cur="gold"]     { border-color: #c89d28; color: #ffe692; }
        .mcfo-menu--bev .mcfo-bev__buy[data-mcfo-cur="diamonds"] { border-color: #4db8dc; color: #bcefff; }
        .mcfo-menu--bev .mcfo-bev__buy:hover:not(:disabled) { background: #32444c; }
        .mcfo-menu--bev .mcfo-bev__buy:disabled { opacity: 0.45; cursor: not-allowed; text-decoration: line-through; }
        /* Pressed, the game's answer not in yet: greyed out at once, so a second click cannot land
           while the first is on its way. Not struck through — that stays the sign of a spent one. */
        .mcfo-menu--bev .mcfo-bev__buy[data-mcfo-state="pending"]:disabled { opacity: 0.6; cursor: progress; text-decoration: none; }

        /* === NAME SUGGESTIONS ===
           The list the game opens above the message box for !tomato and the other targeted
           commands (chatPane.js renderSuggestions). The game hides it with the hidden attribute,
           but its own sheet gives it display: grid, border and padding, which beats hidden — so an
           empty, bordered bar stood above the box all the time. Hidden really means hidden here.
           Drawn in the game's stock colours, so every theme maps them like the rest of this sheet;
           !important because the mirrored game rules of a theme come later and are as specific. */
        html[data-mcfo-sugg="1"] .mcf-chat__suggestions[hidden],
        html[data-mcfo-sugg="1"] .mcf-chat__suggestions:empty { display: none !important; }
        html[data-mcfo-sugg="1"] .mcf-chat__suggestions {
            bottom: calc(100% + 2px) !important; gap: 2px !important; padding: 4px !important;
            border: 1px solid #2f3f4e !important; border-radius: 10px !important;
            background: #0e151c !important; box-shadow: 0 -10px 28px rgba(0, 0, 0, 0.5) !important;
        }
        html[data-mcfo-sugg="1"] .mcf-chat__suggestions::before {
            content: 'Choose a player'; padding: 3px 7px 5px; font-size: 10px; font-weight: 800;
            letter-spacing: 0.08em; text-transform: uppercase; color: #8da2b7;
        }
        html[data-mcfo-sugg="1"] .mcf-chat__suggestion {
            padding: 6px 9px !important; border: 1px solid transparent !important; border-radius: 7px !important;
            background: transparent !important; color: #dbeaf2 !important; font-family: inherit; font-weight: 700; cursor: pointer;
        }
        html[data-mcfo-sugg="1"] .mcf-chat__suggestion:hover,
        html[data-mcfo-sugg="1"] .mcf-chat__suggestion:focus-visible {
            background: #1b3550 !important; border-color: #4d7ea6 !important; outline: none;
        }

        /* === GROWING MESSAGE BOX (section 9h) ===
           The game's one-line input stays in the form, out of sight but focusable; the textarea
           after it takes its grid cell. Send stays one line high at the bottom, as in a messenger. */
        html[data-mcfo-chatgrow="1"] .mcf-chat__form > [data-role="chat-input"][data-mcfo-grow] {
            position: absolute !important; width: 1px !important; height: 1px !important; min-width: 0 !important;
            padding: 0 !important; border: 0 !important; opacity: 0 !important; pointer-events: none !important;
            overflow: hidden !important; clip-path: inset(50%) !important;
        }
        html[data-mcfo-chatgrow="1"] .mcf-chat__form .mcfo-chatgrow {
            display: block; box-sizing: border-box; width: 100%; margin: 0; resize: none; overflow-y: hidden;
            font-family: inherit; white-space: pre-wrap; overflow-wrap: anywhere;
        }
        html[data-mcfo-chatgrow="1"] .mcf-chat__form:has(.mcfo-chatgrow) > .mcf-chat__send {
            align-self: end; height: var(--mcfo-chatgrow-line, auto);
        }

        /* === TICKET RAIL: REBELLION IN IT, COLLAPSIBLE ===
           The rail sits in bid-area, whose contents are centred — so however many chips are
           shown, and with Rebellion as part of the group, the whole thing stays centred by
           itself. centreRail only moves bid-area onto the board; it never has to know the width. */
        .mcfo-rebellion, .mcfo-rail-toggle {
            align-self: center;
            padding: 8px 12px; min-height: 40px;
            border: 1px solid #6f4a4a; border-radius: 7px;
            background: #1d1416; color: #ffc9c9;
            font-family: inherit; font-weight: 800; font-size: 12px; line-height: 1; cursor: pointer; white-space: nowrap;
        }
        .mcfo-rebellion:hover { background: #2a1b1e; border-color: #a06a6a; }
        .mcfo-rail-toggle {
            border-color: #46596b; background: #131d26; color: #cfe2f2;
            padding: 8px 10px; font-size: 14px;
        }
        .mcfo-rail-toggle:hover { background: #1b2a38; border-color: #4d7ea6; }
        /* The rebellion panel trimmed down — same content and the same buttons, just less air.
           Measured 420x509 in the original. */
        html[data-mcfo-rail] [data-role="rebellion-panel"] { width: 330px !important; max-width: 92vw; }
        html[data-mcfo-rail] [data-role="rebellion-panel"] * { font-size: 11px !important; }
        html[data-mcfo-rail] [data-role="rebellion-tier-start"] { min-height: 24px !important; padding: 3px 6px !important; }
        /* !important is needed: the game writes an inline display on each chip. */
        html[data-mcfo-rail="closed"] [data-role="bid-rail"] > [data-mcfo-big="1"] { display: none !important; }
        /* While you are King the game hides the rail and shows the toll controls in its place —
           and those carry an inline width:100%. In the flex row they then swallow all remaining
           space and centre themselves inside it, which pushed Rebellion hard against the left
           edge, on top of our own footer line (measured: toll 2082px wide, Rebellion at x=25).
           Sized to their content instead, the two are centred together like Rebellion and the
           rail are. */
        html[data-mcfo-rail] [data-role="bid-area"] > [data-role="king-toll-controls"] {
            width: auto !important;
            flex: 0 0 auto !important;
        }
        /* bid-area has no gap of its own — the chips bring theirs from inside the rail. With
           Rebellion as a sibling it therefore sat flush against whatever came next, the "Reduce
           Toll" button in particular. */
        html[data-mcfo-rail] [data-role="bid-area"] { gap: 10px; }
        /* While you are King, Rebellion and Unbid step aside and leave the toll controls on their
           own: the game hides the ticket rail then, so there is no bid to take back, and a
           rebellion is aimed at the throne you are sitting on. The game marks that state on
           bid-area itself (data-king-toll-mode, written together with the toll controls in
           renderKingTollControls, app.js) — keyed on that, the buttons come and go with the reign
           without any polling of ours. Hidden, not removed: both come back as they were. */
        [data-role="bid-area"][data-king-toll-mode="true"] > .mcfo-unbid,
        [data-role="bid-area"][data-king-toll-mode="true"] > .mcfo-autobid { display: none !important; }

        /* Since 6.30 (game v0.10.1b) the Rebellion button stays while you are King and becomes
           Royal Celebration, beside the toll controls — the game does the same with its own
           footer button (royalCelebrationMode in app.js). Only the King ever sees it that way,
           because it is keyed on the same data-king-toll-mode as the toll controls. */
        .mcfo-rebellion[data-mcfo-royal="1"] { border-color: #8a6a2a; background: #1f1a0e; color: #ffe08a; }
        .mcfo-rebellion[data-mcfo-royal="1"]:hover { background: #2b2412; border-color: #c9a040; }
        .mcfo-menu--reb .mcfo-reb__title--royal { color: #ffe08a; }
        .mcfo-menu--reb .mcfo-reb__rule { font-size: 11px; color: #c9b88a; line-height: 1.35; }

        /* === OWN REBELLION PANEL ===
           The game's panel stays in the page and does the buying; while ours is open it is only
           made invisible, never removed — its buttons are what ours press. */
        html[data-mcfo-rebpop="1"] [data-role="rebellion-panel"] { visibility: hidden !important; pointer-events: none !important; }
        .mcfo-menu--reb { width: 470px; max-width: calc(100vw - 16px); padding: 12px 14px 14px; }
        .mcfo-reb__head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px;
                          padding-bottom: 8px; border-bottom: 1px solid #243443; margin-bottom: 9px; }
        .mcfo-reb__title { font-weight: 800; font-size: 14px; letter-spacing: 0.05em; text-transform: uppercase; color: #ffc9c9; }
        .mcfo-reb__note { font-size: 11px; color: #c9a3a3; }
        .mcfo-reb__info { display: grid; gap: 4px; margin-bottom: 10px; font-size: 12px; line-height: 1.35; }
        .mcfo-reb__wallet { color: #bcefff; }
        .mcfo-reb__active { padding: 7px 9px; border: 1px solid #6f4a4a; border-radius: 7px; background: #231417; color: #ffd6d6; }
        .mcfo-reb__active[hidden] { display: none; }
        .mcfo-reb__msg { min-height: 16px; color: #a9bac8; }
        .mcfo-reb__msg[data-tone="error"]   { color: #f3a4a4; }
        .mcfo-reb__msg[data-tone="success"] { color: #9fd8b6; }
        .mcfo-reb__grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 7px; }
        /* One colour per tier, from calm to hot, carried by a single variable so border, number
           and glow stay in step.
           Every rule here is scoped to .mcfo-menu--reb on purpose. The generic menu rule
           ".mcfo-menu button" (block, no border, no background, left-aligned) is more specific
           than a bare class, and in 3.10 it won: the tiles lost frame, background and grid, and
           their three lines ran into one ("x5 5 tiles500 diamonds"). */
        .mcfo-menu--reb .mcfo-reb__tier {
            width: auto; text-align: center; min-width: 0;
            display: grid; gap: 3px; justify-items: center;
            padding: 9px 6px 8px;
            border: 1px solid color-mix(in srgb, var(--mcfo-tier) 55%, #1c2b37);
            border-radius: 9px;
            background: linear-gradient(180deg, color-mix(in srgb, var(--mcfo-tier) 16%, #0f1a24), #0d161f);
            font-family: inherit; color: #dce8ef; cursor: pointer;
            transition: transform 90ms ease, border-color 120ms ease, box-shadow 120ms ease;
        }
        .mcfo-menu--reb .mcfo-reb__tier:hover:not(:disabled) { transform: translateY(-1px); border-color: var(--mcfo-tier);
                                               box-shadow: 0 0 0 1px var(--mcfo-tier), 0 4px 14px color-mix(in srgb, var(--mcfo-tier) 35%, transparent); }
        .mcfo-reb__mult { font-size: 20px; font-weight: 900; line-height: 1.05; color: var(--mcfo-tier); }
        .mcfo-reb__tiles { font-size: 11px; color: #9fb3c2; }
        .mcfo-reb__cost { font-size: 12px; font-weight: 800; color: #bcefff; white-space: nowrap; }
        .mcfo-menu--reb .mcfo-reb__tier:disabled { opacity: 0.4; cursor: not-allowed; transform: none; box-shadow: none; }
        /* Armed: the next click spends. Unmistakably different, and it says the amount. */
        .mcfo-menu--reb .mcfo-reb__tier[data-mcfo-armed="1"] { border-color: #ff6b5a; background: linear-gradient(180deg, #4a1a1a, #2a1012);
                                               box-shadow: 0 0 0 1px #ff6b5a, 0 0 16px rgba(255,107,90,0.45); }
        .mcfo-menu--reb .mcfo-reb__tier[data-mcfo-armed="1"] .mcfo-reb__mult { color: #fff; font-size: 16px; }
        .mcfo-menu--reb .mcfo-reb__tier[data-mcfo-armed="1"] .mcfo-reb__tiles { color: #ffd6d6; font-weight: 800; }

        /* === TOLL FIELD ===
           Replaces the game's Reduce / value / Increase with one field. The game's three stay in
           the page — hidden, never removed: they are what the field presses. Colours taken from
           the game's own toll buttons (buildKingTollControlMarkup in app.js): gold #6f5a28 frame,
           #f1dfad text, value box #10171a with a #5d6d72 frame. */
        html[data-mcfo-toll="1"] [data-role="king-toll-decrease"],
        html[data-mcfo-toll="1"] [data-role="king-toll-increase"],
        html[data-mcfo-toll="1"] [data-role="king-toll-current"] { display: none !important; }
        .mcfo-toll {
            display: inline-flex; align-items: center; gap: 9px;
            min-height: 34px; padding: 3px 10px 3px 12px; box-sizing: border-box;
            border: 1px solid #6f5a28; border-radius: 8px;
            background: linear-gradient(180deg, #1a2124, #131a1d);
            box-shadow: 0 2px 6px rgba(0,0,0,0.45);
        }
        .mcfo-toll[data-mcfo-locked="1"] { opacity: 0.58; }
        .mcfo-toll__label {
            color: #f1dfad; font-weight: 800; font-size: 12px; letter-spacing: 0.09em; text-transform: uppercase;
        }
        .mcfo-toll__input {
            width: 2.6em; height: 26px; box-sizing: border-box; padding: 0 2px;
            border: 1px solid #5d6d72; border-radius: 6px; background: #10171a; color: #edf4f8;
            font-family: inherit; font-size: 18px; font-weight: 900; line-height: 1; text-align: center;
            -moz-appearance: textfield; appearance: textfield;
            transition: border-color 120ms ease, box-shadow 120ms ease;
        }
        .mcfo-toll__input::-webkit-inner-spin-button, .mcfo-toll__input::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        .mcfo-toll__input:focus { outline: none; border-color: #e0b84a; box-shadow: 0 0 0 2px rgba(224, 184, 74, 0.28); }
        /* Typed but not yet confirmed: the frame says "press Enter". */
        .mcfo-toll__input[data-mcfo-dirty="1"] { border-color: #e0b84a; color: #ffe692; }
        .mcfo-toll__max { color: #8d9aa0; font-size: 12px; font-weight: 700; margin-left: -4px; }
        .mcfo-toll__range { width: 150px; accent-color: #c89d28; cursor: pointer; }
        .mcfo-toll__range[hidden] { display: none; }
        .mcfo-toll__status { font-size: 11px; font-weight: 700; white-space: nowrap; }
        .mcfo-toll__status:empty { display: none; }
        .mcfo-toll__status[data-tone="busy"]  { color: #ffd479; }
        .mcfo-toll__status[data-tone="ok"]    { color: #9fd8b6; }
        .mcfo-toll__status[data-tone="error"] { color: #f3a4a4; }

        /* === CHAT: SMOOTH COLLAPSE, SLIM RAIL ===
           The game collapses the chat by switching the column of lane-play-region in one step
           (app.js: 'minmax(0,1fr) clamp(300px,19vw,340px)' <-> 'minmax(0,1fr) 44px', set inline)
           and hiding the chat's body at once (chatPane.css).
           The column itself must NOT be animated. The game sizes its lanes in fixed pixels exactly
           once, in the moment of the click (onCollapseChange -> setLayoutMode -> the lane grid).
           With an animated column (3.13/3.14) it measured the column where it started: on opening
           that is 44px, so the lanes kept the full width and the chat slid over the right lane.
           So the layout jumps and the game measures the final width; the motion is only a picture
           laid over it afterwards (FLIP, see glideChat in section 9d). */
        @keyframes mcfoRailIn  { from { opacity: 0; } to { opacity: 1; } }
        @keyframes mcfoBadgeIn { from { transform: scale(0.4); opacity: 0; } to { transform: none; opacity: 1; } }
        html[data-mcfo-chatrail="1"] .mcf-chat { position: relative; }
        /* Restoring the collapsed state on load happens without any of the motion above —
           the page should simply come up the way it was left, not visibly fold on start. */
        html[data-mcfo-chat-instant] .mcf-chat > *,
        html[data-mcfo-chat-instant] .mcfo-chatrail { animation: none !important; }
        /* Collapsed: the game's own header (turned sideways, a lone arrow halfway down) makes
           way for the rail. Only hidden — its collapse button is what the rail presses. */
        html[data-mcfo-chatrail="1"] .mcf-chat[data-collapsed="true"] .mcf-chat__header { visibility: hidden; }

        .mcfo-chatrail {
            position: absolute; inset: 0; z-index: 5;
            display: none; flex-direction: column; align-items: center; gap: 12px;
            padding: 10px 0 12px;
            background: linear-gradient(180deg, #13222f 0%, #0d1822 45%, #0a121a 100%);
            cursor: pointer; user-select: none;
            transition: background 180ms ease;
        }
        html[data-mcfo-chatrail="1"] .mcf-chat[data-collapsed="true"] .mcfo-chatrail {
            display: flex; animation: mcfoRailIn 240ms 80ms ease both;
        }
        .mcfo-chatrail:hover { background: linear-gradient(180deg, #172a39 0%, #102030 45%, #0b151e 100%); }
        .mcfo-chatrail__btn {
            flex: none; width: 30px; height: 30px; border-radius: 50%;
            display: grid; place-items: center;
            border: 1px solid #355066; background: #111f2b; color: #cde6ff;
            transition: transform 180ms ease, border-color 180ms ease, background 180ms ease;
        }
        .mcfo-chatrail__btn svg { width: 14px; height: 14px; }
        .mcfo-chatrail:hover .mcfo-chatrail__btn { border-color: #4d7ea6; background: #16283a; transform: translateX(-2px); }
        .mcfo-chatrail__badge {
            flex: none; min-width: 22px; height: 22px; padding: 0 6px; box-sizing: border-box; border-radius: 11px;
            background: #e0b84a; color: #1a1405;
            font: 800 11px/22px system-ui, sans-serif; text-align: center;
            box-shadow: 0 0 0 3px rgba(224, 184, 74, 0.18);
            animation: mcfoBadgeIn 220ms cubic-bezier(0.3, 1.4, 0.5, 1) both;
        }
        .mcfo-chatrail__badge[hidden] { display: none; }
        .mcfo-chatrail__label {
            writing-mode: vertical-rl;
            font-size: 11px; font-weight: 800; letter-spacing: 0.34em; text-transform: uppercase;
            color: #8da2b7;
        }
        .mcfo-chatrail__room { writing-mode: vertical-rl; font-size: 10px; letter-spacing: 0.08em; color: #5f7688; }
        .mcfo-chatrail:hover .mcfo-chatrail__label { color: #cfe2f2; }

        /* === SEE-THROUGH BOARD FRAMES (6.10) ===
           A tile keeps its own shape: a lane's svg is sized to the tile's aspect and draws its ground
           inside (layoutLaneViewport, renderLaneFrame tileBg), the king tile is .mcf-king-fit-viewport.
           What is left around them is painted by the boxes they sit in — lane-panel #101516 and
           lane-viewport #090d0f (app.js laneDom), king-pane and king-viewport #0f1215 and the king's
           action tray #0b0f10 (kingPaneDom), and the dark brown of kingPane.js's .mcf-king-pane. Those
           go transparent, and since 6.11 so do the outlines of the frames and the line over the king's
           tray — only the tiles are left. Transparent rather than removed, so no box changes size
           under the game's measurements. !important and the longer selector because a theme recolours
           the same inline colours with [data-mcfo-t~=…] !important (0,2,1). */
        html[data-mcfo-boardclear="1"] [data-role="main-region"] :is([data-role="lane-panel"], [data-role="lane-viewport"], [data-role="king-pane"], [data-role="king-viewport"], [data-role="king-action-tray"], .mcf-king-pane) {
            background: transparent !important;
        }
        html[data-mcfo-boardclear="1"] [data-role="main-region"] :is([data-role="lane-panel"], [data-role="king-pane"], [data-role="king-action-tray"]) {
            border-color: transparent !important;
        }
        /* Royal Celebration (6.52.5): the game outlines every lane panel in pink (royalCelebrationEffects.js,
           [data-royal-celebration=active] [data-role=lane-panel] { box-shadow: var(--royal-lane-shadow) }).
           With the boxes see-through, that outline stood around the empty room above and below the
           tile. It moves to the tile itself, the lane-stage svg, in the game's own theme colours. */
        html[data-mcfo-boardclear="1"] [data-royal-celebration="active"] [data-role="main-region"] [data-role="lane-panel"] {
            box-shadow: none !important;
        }
        /* The game's line is an inset shadow - on the svg the tile's own ground covers it - so the line
           is an outline (painted over the content), in the colour of the only theme so far
           (royalCelebrationThemes.js, royal-classic: inset 0 0 0 1px #cb9bde); the glow stays a shadow. */
        html[data-mcfo-boardclear="1"] [data-royal-celebration="active"] [data-role="main-region"] [data-role="lane-stage"] {
            outline: 1px solid #cb9bde; outline-offset: -1px;
            box-shadow: 0 0 14px #b681f32b;
        }

        /* === KING TRAY UNDER THE TILE (6.11) ===
           Moved by translate only, from a length placeKingTray measures (section 7): the game's
           layout — and the king pane's height, which it derives from the tray — stays as it is. */
        html[data-mcfo-traylift="1"] [data-role="king-action-tray"] { translate: 0 calc(-1 * var(--mcfo-tray-lift, 0px)); }
        /* While a marble runs in the king tile the game empties the tray (6.20.1, watchTrayHeight):
           it keeps the height it had when filled, so the tile above it does not move. */
        [data-role="king-action-tray"].lane-action-tray--empty { box-sizing: border-box; min-height: var(--mcfo-tray-keep, 0px); }

        /* === CHAT HEIGHT FOLLOWS THE BOARD (6.13) ===
           The chat column filled the whole height, while the tiles, fitted by their aspect, often
           leave room above and below. The chat gives up half of that room at the top and at the
           bottom (placeChat measures it), so the two heights approach each other without meeting.
           A margin on the grid item, and the height taken down by the same amount twice: the game
           gives the pane a height of its own, and a margin alone only pushed it down, out at the
           bottom (measured). Not in the pop-out window, where the pane fills the window. */
        html[data-mcfo-chatfit="1"]:not([data-mcfo-chatpop="1"]) [data-role="lane-play-region"] > [data-role="desktop-chat-pane"] {
            margin-block: var(--mcfo-chat-inset, 0px);
            height: calc(100% - 2 * var(--mcfo-chat-inset, 0px)) !important;
            max-height: calc(100% - 2 * var(--mcfo-chat-inset, 0px)) !important;
        }

        /* === CHAT POP-OUT ===
           The whole desktop-chat-pane moves into a window, not just the chat inside it: the game
           re-attaches the chat to that pane on every layout pass (chatController.attach), so the
           chat stays wherever the pane is. The pane itself the game never moves. */
        html[data-mcfo-chatpop="1"] [data-role="lane-play-region"] {
            grid-template-columns: minmax(0, 1fr) 0px !important; column-gap: 0 !important;
        }
        .mcfo-win__body > [data-role="desktop-chat-pane"] {
            position: absolute; inset: 0; height: auto !important; max-height: none !important;
        }
        .mcfo-win__body > [data-role="desktop-chat-pane"] .mcf-chat { border: 0; border-radius: 0; }
        html[data-mcfo-chatpop="1"] [data-role="chat-collapse"],
        html[data-mcfo-chatpop="1"] .mcfo-chatpop-btn,
        html[data-mcfo-chatpop="1"] .mcfo-chatrail { display: none !important; }
        /* The header gets as many columns as it has buttons. The game plans three, the chat
           script four; with ours it can be five, and a fixed count makes the last one wrap. */
        html:is([data-mcfo-popbtn="1"], [data-mcfo-fpshead]) .mcf-chat:not([data-collapsed="true"]) .mcf-chat__header {
            grid-template-columns: minmax(0, 1fr) !important; grid-auto-flow: column; grid-auto-columns: auto;
        }
        .mcfo-chatpop-btn {
            width: 30px; height: 30px; padding: 0; box-sizing: border-box;
            display: grid; place-items: center;
            border: 1px solid #355066; border-radius: 7px; background: #111f2b; color: #cde6ff; cursor: pointer;
        }
        .mcfo-chatpop-btn:hover { border-color: #4d7ea6; background: #16283a; }
        .mcfo-chatpop-btn svg { width: 15px; height: 15px; }

        /* === SETTINGS GEAR IN PLACE OF THE SOUND BUTTON (6.14) ===
           The game's speaker button and its panel are hidden, not removed: the Sound page works the
           controls inside it. The gear takes the button's cell (profile-sound-cell, a two-column
           grid: account card | button) and its size. */
        html[data-mcfo-gear="1"] [data-role="sound-utility-toggle"],
        html[data-mcfo-gear="1"] [data-role="sound-utility-panel"] { display: none !important; }
        .mcfo-gear {
            width: 32px; height: 32px; padding: 0; box-sizing: border-box;
            display: grid; place-items: center;
            border: 1px solid #355066; border-radius: 8px; background: #111822; color: #d8e3ef; cursor: pointer;
        }
        .mcfo-gear:hover { border-color: #4d7ea6; background: #16283a; }
        .mcfo-gear svg { width: 17px; height: 17px; display: block; transition: transform 300ms ease; }
        .mcfo-gear:hover svg { transform: rotate(60deg); }
        .mcfo-taskbar__badge {
            display: inline-block; min-width: 18px; height: 18px; padding: 0 5px; box-sizing: border-box; border-radius: 9px;
            background: #e0b84a; color: #1a1405; font: 800 10px/18px system-ui, sans-serif; text-align: center;
        }

        /* === HEADER CARDS AS SIGNPOSTS === */
        .mcfo-card, .mcfo-card * { cursor: pointer !important; }
        .mcfo-card { position: relative; transition: border-color 120ms ease, box-shadow 160ms ease; }
        .mcfo-card:hover { border-color: #4d7ea6 !important; }
        /* 6.35.1: a card you can click glows as a whole when the pointer is on it — only the
           game's Purchase button used to light up. Doubled class and !important, so it also wins
           over a Deluxe skin's card shadow; the theme's accent colours it (themeAccentCss). */
        html .mcfo-card.mcfo-card:hover { box-shadow: 0 0 0 1px #4d7ea6, 0 0 14px 2px rgba(77, 126, 166, 0.55) !important; }
        /* Colours taken from the game, not invented. The stock Diamonds card already contains
           the site's own way of saying "this card does something" — the Purchase button, drawn
           as #dcefff on #14283a with a #3d5f78 border at 11px. The signposts borrow exactly
           that, so all four cards speak with one voice and the Diamonds card needs no label of
           its own.
           The first attempt used #7f97ac, which is all but the #8da2b7 of the card captions —
           that is why the words read as another read-out instead of as a way in. */
        .mcfo-signpost {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            white-space: nowrap;
            font-size: 11px;
            font-weight: 700;
            line-height: 1;
            padding: 4px 7px;
            border-radius: 7px;
            border: 1px solid #3d5f78;
            background: #14283a;
            color: #dcefff;
            pointer-events: none;
            transition: background 120ms ease, border-color 120ms ease;
        }
        /* The card already lifts its own border on hover; the chip follows along a step, without
           turning into a second focus point. */
        /* The game's own Purchase button is the fourth of these chips, so it is pulled into line
           rather than left as the odd one out: same weight, same arrow. Its colours already match
           — they are where the chip style came from. The arrow is added through ::after so the
           game's own label text stays untouched and survives a rebuild. */
        html[data-mcfo-cards="1"] [data-role="diamonds-purchase-link"] { font-weight: 700 !important; }
        html[data-mcfo-cards="1"] [data-role="diamonds-purchase-link"]::after { content: ' ›'; }
        .mcfo-signpost--float { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); }
        /* Was pinned to the lower line while season and episode still filled the upper one to
           within 9px of the edge. With those moved to the footer the card has room again, so the
           chip sits centred like the others — same rule everywhere. */

        /* === TILESET CARD: CURRENT AND NEXT, ACTIVE LINE IN THE TICKETS CARD (6.36, section 8b) ===
           The game's Active line is only hidden (it keeps writing into it; we copy what it says).
           !important because the game sets an inline display on it for the portrait layouts. */
        html[data-mcfo-sessnext="1"] [data-role="session-cell"] > [data-role="socket"] { display: none !important; }
        .mcfo-nextev { display: flex; align-items: baseline; gap: 4px; min-width: 0; font-size: 11px; line-height: 1.2; white-space: nowrap; }
        .mcfo-nextev__label { color: #8da2b7; }
        .mcfo-nextev__name { color: #d8e8f6; font-weight: 700; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
        .mcfo-nextev__time { color: #9fb2c2; flex: none; }
        /* Tickets card: the game's three-column grid (icon, text, an empty action column) gets a
           fourth column while the frame-rate badge sits in the third as well. */
        .mcfo-tstatus { justify-self: end; align-self: center; display: grid; justify-items: end; gap: 1px;
                        font-size: 10px; line-height: 1.2; white-space: nowrap; color: #9fb2c2; cursor: default; }
        .mcfo-tstatus b { font-weight: 800; color: #d8e8f6; }
        .mcfo-tstatus[data-mcfo-state="active"] b { color: #7ee2a0; }
        .mcfo-tstatus[data-mcfo-state="inactive"] b { color: #f3b27a; }

        /* === TICKET HISTORY (6.38, section 8c) === */
        .mcfo-menu--tix { width: 300px; padding: 10px 12px 12px; }
        /* Flying tickets (6.38): a point on the number, the pieces animated from there (downwards —
           the card sits at the top of the page). */
        .mcfo-tixfly { position: fixed; z-index: 10036; width: 0; height: 0; pointer-events: none; }
        .mcfo-tixfly__t { position: absolute; left: 0; top: 0; width: 22px; height: 15px; opacity: 0;
                          filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.5)); }
        .mcfo-tixfly__t svg { display: block; width: 100%; height: 100%; }
        .mcfo-tixfly__plus { position: absolute; left: 0; top: 0; opacity: 0; white-space: nowrap;
                             font: 800 14px/1 system-ui, sans-serif; color: #ffd479; text-shadow: 0 1px 0 #3a2a00, 0 0 8px rgba(0, 0, 0, 0.6); }
        .mcfo-tix__head { display: flex; align-items: baseline; justify-content: space-between; gap: 10px;
                          padding-bottom: 7px; border-bottom: 1px solid #243443; margin-bottom: 8px; }
        .mcfo-tix__title { font-weight: 800; font-size: 13px; letter-spacing: 0.05em; text-transform: uppercase; color: #9ab0c0; }
        .mcfo-tix__now { font-weight: 800; font-size: 16px; color: #d8e8f6; font-variant-numeric: tabular-nums; }
        .mcfo-tix__status { font-size: 12px; line-height: 1.35; margin-bottom: 9px; color: #a9bac8; }
        .mcfo-tix__status b { color: #d8e8f6; }
        .mcfo-tix__status[data-mcfo-state="active"] b { color: #7ee2a0; }
        .mcfo-tix__status[data-mcfo-state="inactive"] b { color: #f3b27a; }
        .mcfo-tix__grid { display: grid; grid-template-columns: auto 1fr 1fr; gap: 5px 12px; align-items: baseline;
                          font-size: 12px; font-variant-numeric: tabular-nums; }
        .mcfo-tix__grid > .mcfo-tix__h { font-size: 10px; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase; color: #6f8699; text-align: right; }
        .mcfo-tix__grid > .mcfo-tix__h:first-child { text-align: left; }
        .mcfo-tix__label { color: #9ab0c0; white-space: nowrap; }
        .mcfo-tix__label small { display: block; font-size: 10px; color: #6f8699; }
        .mcfo-tix__earn { text-align: right; color: #7ee2a0; font-weight: 700; }
        .mcfo-tix__spend { text-align: right; color: #f3a4a4; font-weight: 700; }
        .mcfo-tix__note { margin-top: 9px; font-size: 10.5px; line-height: 1.35; color: #6f8699; }
        .mcfo-menu button.mcfo-tix__go { margin-top: 8px; text-align: center; font-weight: 700; border: 1px solid #355066; }

        /* === FOOTER: SEASON, EPISODE, BUILD ===
           Season and episode used to sit inside the tileset card, where they filled the upper
           line right up to the edge — which is what the Events chip was colliding with. Down
           here they are out of the way, and the build number finally has a place at all: the
           game shows it nowhere. */
        html[data-mcfo-footermeta="1"] [data-role="stat-window-indicator"] { display: none !important; }
        .mcfo-footermeta {
            display: flex; align-items: center; gap: 9px;
            padding: 0 12px;
            font-size: 13px; line-height: 1;
            color: #8da2b7;
            white-space: nowrap;
            pointer-events: none;
            /* Never squeezed by a wide ticket rail: with nowrap the text would simply run out of
               its shrunken box and under the rail, and the box would no longer say where the
               text ends (centreRail measures it). */
            flex-shrink: 0;
        }
        .mcfo-footermeta__build, .mcfo-footermeta__mlf { opacity: 0.65; }
        .mcfo-footermeta .mcfo-footermeta__update {
            pointer-events: auto; cursor: pointer;
            padding: 0; border: 0; background: none; font: inherit;
            color: #ff5a5a; opacity: 1; font-weight: 700;
        }
        .mcfo-footermeta .mcfo-footermeta__update:hover { text-decoration: underline; }

        /* === UPDATE NOTICE (6.26, section 12c) === */
        html[data-mcfo-update] [data-role="profile-entry"] { position: relative; }
        .mcfo-updot {
            position: absolute; top: -4px; right: -4px; z-index: 5;
            width: 11px; height: 11px; border-radius: 50%;
            background: #ff3b3b; box-shadow: 0 0 0 2px #0b121a;
            pointer-events: none;
        }
        html:not([data-mcfo-update]) .mcfo-updot { display: none; }
        .mcfo-menu button.mcfo-menu__update { color: #ff6b6b; font-weight: 700; }
        .mcfo-menu button.mcfo-menu__update:hover { background: rgba(255, 59, 59, 0.14); }

        /* === DAILIES AND SHOP DOTS, NOTICES (6.27, section 12d) ===
           Gold, where the red update dot is red. Both up at once: gold moves left and sits beside
           the red one instead of under it. */
        .mcfo-dailydot, .mcfo-shopdot {
            position: absolute; top: -4px; right: -4px; z-index: 5;
            width: 11px; height: 11px; border-radius: 50%;
            background: #f2c14e; box-shadow: 0 0 0 2px #0b121a;
            pointer-events: none;
        }
        .mcfo-dailydot[hidden], .mcfo-shopdot[hidden] { display: none; }
        html[data-mcfo-update] .mcfo-dailydot { right: 11px; }
        /* The dot needs a positioned host. The floating signpost already is one (absolute, centred in
           its card) — giving it position: relative too, as 6.27 did, pulled it out of place. */
        [data-role="shop-nav"], [data-metric-role="gold"] > .mcfo-signpost:not(.mcfo-signpost--float) { position: relative; }
        .mcfo-menu button.mcfo-menu__daily { color: #f2c14e; font-weight: 700; }
        .mcfo-menu button.mcfo-menu__daily:hover { background: rgba(242, 193, 78, 0.14); }
        /* === QUEST DOTS ON REBELLION AND BEVERAGES (6.35, section 12d) ===
           Inside the button, not hanging over its corner like the other dots: the beverage buttons
           clip their overflow (a second text line would make the tray taller). The dots are ours
           and always there, shown by what the html element says is wanted — so a button the game
           or we rebuild wears the right state from its first frame. */
        .mcfo-drink, .mcfo-rebellion { position: relative; }
        .mcfo-questdot {
            position: absolute; top: 3px; right: 3px; z-index: 3;
            width: 8px; height: 8px; border-radius: 50%;
            background: #f2c14e; box-shadow: 0 0 0 1.5px #0b121a;
            pointer-events: none; display: none;
        }
        html[data-mcfo-qreb] .mcfo-rebellion:not([data-mcfo-royal="1"]) > .mcfo-questdot,
        html[data-mcfo-qcel] .mcfo-rebellion[data-mcfo-royal="1"] > .mcfo-questdot,
        html[data-mcfo-qbev~="water"] .mcfo-drink[data-mcfo-drink="water"] > .mcfo-questdot,
        html[data-mcfo-qbev~="lava"]  .mcfo-drink[data-mcfo-drink="lava"]  > .mcfo-questdot,
        html[data-mcfo-qbev~="milk"]  .mcfo-drink[data-mcfo-drink="milk"]  > .mcfo-questdot,
        html[data-mcfo-qbev~="acid"]  .mcfo-drink[data-mcfo-drink="acid"]  > .mcfo-questdot { display: block; }
        /* The tier a quest asks for, in the Rebellion / Royal Celebration popup. Gold, and a small
           tag on the top edge; the armed state (red) still wins, it is the more urgent one. */
        .mcfo-menu--reb .mcfo-reb__tier { position: relative; }
        .mcfo-menu--reb .mcfo-reb__tier[data-mcfo-quest]:not([data-mcfo-armed="1"]) {
            border-color: #f2c14e; box-shadow: 0 0 0 1px #f2c14e, 0 0 12px rgba(242, 193, 78, 0.35);
        }
        .mcfo-reb__quest {
            position: absolute; top: -7px; left: 50%; transform: translateX(-50%);
            padding: 1px 6px; border-radius: 999px; background: #f2c14e; color: #1b1405;
            font: 800 9px/1.4 system-ui, sans-serif; letter-spacing: 0.05em; text-transform: uppercase;
            pointer-events: none; display: none;
        }
        .mcfo-menu--reb .mcfo-reb__tier[data-mcfo-quest] > .mcfo-reb__quest { display: block; }
        .mcfo-bev__quest {
            display: flex; align-items: center; gap: 6px; margin: -2px 0 8px;
            font-size: 11px; line-height: 1.3; color: #f2c14e;
        }
        .mcfo-bev__quest::before { content: ''; flex: none; width: 7px; height: 7px; border-radius: 50%; background: #f2c14e; }

        /* === TOMATO BUTTON (6.35, section 9j) === */
        /* Between the message box and Send (6.35.1): the form is the game's two-column grid, so a
           third column joins it while the button is there. As tall as Send, which the growing
           message box keeps one line high at the bottom. */
        .mcf-chat__form:has(> .mcfo-tomato-btn) { grid-template-columns: minmax(0, 1fr) auto auto !important; }
        .mcfo-tomato-btn {
            align-self: stretch; width: 38px; min-height: 30px; padding: 0; box-sizing: border-box;
            display: grid; place-items: center;
            border: 1px solid #355066; border-radius: 7px; background: #111f2b; color: #cde6ff; cursor: pointer;
        }
        .mcfo-tomato-btn:hover { border-color: #b0453a; background: #2a1715; }
        html[data-mcfo-chatgrow="1"] .mcf-chat__form:has(.mcfo-chatgrow) > .mcfo-tomato-btn {
            align-self: end; height: var(--mcfo-chatgrow-line, auto);
        }
        .mcfo-tomato-btn svg { width: 18px; height: 18px; }

        /* === ANIMAL CALL BUTTON (6.39, section 9j) === */
        /* Left of the tomato, same size; a fourth column while both are there. */
        .mcf-chat__form:has(> .mcfo-animal-btn) { grid-template-columns: minmax(0, 1fr) auto auto !important; }
        .mcf-chat__form:has(> .mcfo-animal-btn):has(> .mcfo-tomato-btn) { grid-template-columns: minmax(0, 1fr) auto auto auto !important; }
        .mcfo-animal-btn {
            position: relative; align-self: stretch; width: 38px; min-height: 30px; padding: 0; box-sizing: border-box;
            display: grid; place-items: center;
            border: 1px solid #355066; border-radius: 7px; background: #111f2b; color: #e9c9a0; cursor: pointer;
        }
        .mcfo-animal-btn:hover { border-color: #b08a4a; background: #251d12; }
        html[data-mcfo-chatgrow="1"] .mcf-chat__form:has(.mcfo-chatgrow) > .mcfo-animal-btn {
            align-self: end; height: var(--mcfo-chatgrow-line, auto);
        }
        .mcfo-animal-btn svg { width: 18px; height: 18px; }
        .mcfo-animal-btn[data-mcfo-live]::after {
            content: ''; position: absolute; top: 3px; right: 3px; width: 7px; height: 7px; border-radius: 50%;
            background: #7ad36b; box-shadow: 0 0 0 2px #111f2b;
        }
        .mcfo-menu--animals { width: 270px; padding: 10px 12px 12px; }
        .mcfo-ani__head { font-weight: 800; font-size: 13px; letter-spacing: 0.05em; text-transform: uppercase; color: #f2c98a;
                          padding-bottom: 7px; border-bottom: 1px solid #243443; margin-bottom: 6px; }
        .mcfo-ani__list { max-height: min(360px, 55vh); overflow: auto; display: grid; gap: 1px; }
        .mcfo-menu button.mcfo-ani__row { display: grid; grid-template-columns: 22px minmax(0, 1fr) auto; align-items: center; gap: 8px;
                                          padding: 5px 6px; border-radius: 5px; text-align: left; }
        .mcfo-ani__emoji { font-size: 16px; line-height: 1; text-align: center; }
        .mcfo-ani__name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .mcfo-ani__call { font: 12px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; color: #8da2b7; }
        .mcfo-menu button.mcfo-ani__row--live { border: 1px solid #4f8a45; background: #16281a; margin-bottom: 5px; }
        .mcfo-menu button.mcfo-ani__row--live:hover { background: #1d3622; }
        .mcfo-ani__live { grid-column: 2 / -1; margin-top: -4px; font-size: 11px; color: #9fdc92; white-space: nowrap; }
        .mcfo-menu button.mcfo-ani__row--live .mcfo-ani__call { color: #cfeec8; font-weight: 800; }
        /* You are in already (6.39.1): red, like a switch that is taken. */
        .mcfo-animal-btn[data-mcfo-joined]::after { background: #e0483a; }
        .mcfo-menu button.mcfo-ani__row--joined { border-color: #a8433a; background: #2a1715; }
        .mcfo-menu button.mcfo-ani__row--joined:hover { background: #351c19; }
        .mcfo-menu button.mcfo-ani__row--joined .mcfo-ani__live { color: #f3a4a4; }
        .mcfo-menu button.mcfo-ani__row--joined .mcfo-ani__call { color: #ffc9c2; }
        .mcfo-ani__next { margin: -2px 0 6px; padding: 5px 7px; border-radius: 5px; font-size: 12px; font-weight: 700;
                          background: #2a2113; color: #f2c98a; }
        .mcfo-ani__next[data-ready] { background: #16281a; color: #9fdc92; }
        .mcfo-menu button.mcfo-ani__row--rest { opacity: 0.55; }
        .mcfo-menu button.mcfo-ani__row--rest:hover { opacity: 0.85; }
        .mcfo-ani__rest { grid-column: 2 / -1; margin-top: -4px; font-size: 11px; color: #e9b37a; white-space: nowrap; }
        .mcfo-ani__foot { margin-top: 8px; font-size: 11px; line-height: 1.35; color: #8da2b7; }
        .mcfo-menu--tomato { width: 250px; padding: 10px 12px 12px; }
        .mcfo-tom__head { font-weight: 800; font-size: 13px; letter-spacing: 0.05em; text-transform: uppercase; color: #ff9a8a;
                          padding-bottom: 7px; border-bottom: 1px solid #243443; margin-bottom: 6px; }
        .mcfo-tom__list { max-height: min(300px, 50vh); overflow: auto; display: grid; gap: 1px; }
        .mcfo-tom__row { display: flex; align-items: center; gap: 8px; padding: 5px 6px; border-radius: 5px; cursor: pointer;
                         font-size: 13px; line-height: 1.2; }
        .mcfo-tom__row:hover { background: #16283a; }
        .mcfo-tom__row input { margin: 0; accent-color: #e0483a; flex: none; }
        .mcfo-tom__row span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .mcfo-tom__row--all { font-weight: 800; border-bottom: 1px solid #16232f; border-radius: 5px 5px 0 0; margin-bottom: 2px; }
        .mcfo-tom__empty { padding: 8px 6px; font-size: 12px; color: #8da2b7; }
        .mcfo-menu button.mcfo-tom__go { margin-top: 9px; text-align: center; font-weight: 800;
                                         background: #5a1d18; border: 1px solid #b0453a; color: #ffe1dc; }
        .mcfo-menu button.mcfo-tom__go:hover:not(:disabled) { background: #74261f; }
        .mcfo-menu button.mcfo-tom__go:disabled { opacity: 0.45; cursor: not-allowed; }
        .mcfo-tom__msg { min-height: 15px; margin-top: 6px; font-size: 11px; color: #a9bac8; }
        .mcfo-tom__msg[data-tone="error"] { color: #f3a4a4; }

        /* === LOADOUTS ON THE CURRENT POINTS CARD (6.35, section 12e) === */
        [data-metric-role="current-points"].mcfo-card { cursor: pointer; }
        .mcfo-menu--lo { min-width: 230px; max-width: 320px; }
        .mcfo-lo__head { padding: 4px 12px 7px; font-weight: 800; font-size: 12px; letter-spacing: 0.05em; text-transform: uppercase; color: #9ab0c0; }
        .mcfo-menu button.mcfo-lo__item { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
        .mcfo-lo__item small { flex: none; font-size: 11px; opacity: 0.55; }
        .mcfo-menu button.mcfo-lo__item[data-mcfo-last] b::after { content: ' \\2713'; color: #9fd8b6; }
        .mcfo-menu button.mcfo-lo__item:disabled { opacity: 0.5; cursor: progress; }
        .mcfo-lo__empty { padding: 6px 12px 8px; font-size: 12px; color: #8da2b7; max-width: 260px; line-height: 1.35; }
        .mcfo-notices {
            position: fixed; left: 50%; bottom: 84px; transform: translateX(-50%); z-index: 10045;
            display: grid; gap: 6px; width: min(560px, calc(100vw - 32px)); pointer-events: none;
        }
        .mcfo-notice {
            pointer-events: auto; display: flex; align-items: center; gap: 10px;
            padding: 9px 8px 9px 13px; border: 1px solid #6b5a2a; border-left: 3px solid #f2c14e; border-radius: 8px;
            background: rgba(19, 24, 30, 0.96); color: #eef3f7; font-size: 13px; line-height: 1.4;
            box-shadow: 0 6px 22px rgba(0, 0, 0, 0.45);
        }
        .mcfo-notice--error { border-color: #6f3a3a; border-left-color: #e05a47; }
        .mcfo-notice__text { flex: 1; min-width: 0; overflow-wrap: anywhere; }
        .mcfo-notice .mcfo-notice__x {
            flex: none; width: 24px; height: 24px; padding: 0; border: 0; border-radius: 5px;
            background: transparent; color: inherit; font-size: 17px; line-height: 1; cursor: pointer; opacity: 0.7;
        }
        .mcfo-notice .mcfo-notice__x:hover { opacity: 1; background: rgba(255, 255, 255, 0.08); }

        /* === TILESET BANNER (6.24) ===
           The game announces a new tileset with a picture over a nearly black curtain across the
           whole board. With the option on, curtain and picture go, and a line of text takes their
           place. The overlay itself stays: its fade in, hold and fade out are the game's own, and
           the text simply rides along inside it. */
        /* The doubled attribute is for weight: a theme re-tints the curtain's inline colour with a
           rule of its own (html[data-mcfo-theme] [data-mcfo-t~=...]) that would otherwise win. */
        html[data-mcfo-tsbanner="1"] [data-role="tileset-transition-splash-overlay"][data-role] { background: transparent !important; }
        html[data-mcfo-tsbanner="1"] [data-role="tileset-transition-splash-image"] { display: none !important; }
        html:not([data-mcfo-tsbanner="1"]) .mcfo-tsbanner { display: none; }
        .mcfo-tsbanner {
            display: grid; justify-items: center; gap: calc(10px * var(--mcfo-tsb-scale, 1));
            padding: 18px 42px 20px;
            border-radius: 14px;
            background: radial-gradient(ellipse at center, rgba(6, 9, 13, 0.62) 0%, rgba(6, 9, 13, 0.38) 55%, rgba(6, 9, 13, 0) 78%);
            text-align: center;
            pointer-events: none;
            /* Wider than the game's 980px picture box, so a bigger size stays on one line. */
            width: max-content; max-width: 92vw;
            /* Placed on the overlay itself (absolute), not in the game's picture box: that box is
               980px wide at most, and a wider banner in it would sit off-centre. */
            position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
        }
        .mcfo-tsbanner__kicker {
            font: 700 calc(20px * var(--mcfo-tsb-scale, 1)) / 1 system-ui, sans-serif;
            letter-spacing: 0.3em; text-transform: uppercase;
            color: rgba(255, 255, 255, 0.72);
            text-shadow: 0 1px 6px rgba(0, 0, 0, 0.8);
        }
        .mcfo-tsbanner__name {
            font: 900 calc(84px * var(--mcfo-tsb-scale, 1)) / 1.05 "Helvetica Neue", "Arial Black", "Archivo Black", Helvetica, Arial, sans-serif;
            letter-spacing: 0.02em;
            color: #fff;
            text-shadow: 0 2px 0 rgba(0, 0, 0, 0.35), 0 4px 22px rgba(0, 0, 0, 0.75);
        }

        /* === TOMATO NOTICE (6.25, section 9j) === */
        .mcf-chat__message[data-mcfo-tomato] > :not(.mcfo-tomato) { display: none !important; }
        .mcf-chat__message[data-mcfo-tomato-gone] { display: none !important; }
        /* Messages that mention you (6.36): a gold frame and a gold bar on the left. Drawn as
           shadows and an outline, so a chat background cosmetic on the row stays as it is. */
        .mcf-chat__message[data-mcfo-mention] {
            outline: 1px solid rgba(242, 193, 78, 0.75) !important; outline-offset: -1px;
            box-shadow: inset 4px 0 0 #f2c14e, inset 0 0 0 999px rgba(242, 193, 78, 0.08) !important;
            border-radius: 6px; padding: 4px 8px 5px 11px !important;
        }
        /* Twitch emotes (6.45, section 9l): line height of the text, like in a Twitch chat. */
        .mcf-chat__text img.mcfo-emote {
            display: inline-block; height: 1.75em; width: auto; max-width: 5.5em;
            vertical-align: middle; margin: -0.3em 0.05em; object-fit: contain;
        }
        /* The game frames a command result in a box of its own; the notice is the box. */
        .mcf-chat__message[data-mcfo-tomato] { padding: 0 !important; border: 0 !important; background: none !important; box-shadow: none !important; }
        .mcfo-tomato {
            display: flex; align-items: center; gap: 8px;
            padding: 5px 6px 5px 9px;
            border-left: 3px solid #e05a47; border-radius: 6px;
            background: rgba(224, 90, 71, 0.10);
            font-size: 0.92em; line-height: 1.3;
        }
        .mcfo-tomato__icon { flex: none; width: 18px; height: 18px; }
        .mcfo-tomato__text { flex: 1; min-width: 0; overflow-wrap: anywhere; }
        .mcfo-tomato__text b { font-weight: 800; }
        .mcfo-tomato__time { flex: none; font-size: 0.85em; opacity: 0.6; }
        .mcfo-tomato .mcfo-tomato__x {
            flex: none; display: grid; place-items: center;
            width: 22px; height: 22px; padding: 0; margin: 0;
            border: 0; border-radius: 5px; background: transparent; color: inherit;
            font: 700 15px/1 system-ui, sans-serif; opacity: 0.55; cursor: pointer;
        }
        .mcfo-tomato .mcfo-tomato__x:hover { opacity: 1; background: rgba(255, 255, 255, 0.10); }

        /* === MENUS === */
        .mcfo-anchor, .mcfo-anchor * { cursor: pointer !important; }
        .mcfo-anchor[data-mcfo-open="1"] { outline: 1px solid rgba(77, 166, 255, 0.5); outline-offset: 2px; border-radius: 6px; }
        .mcfo-menu {
            position: fixed;
            z-index: 10050;
            min-width: 200px;
            background: #091018;
            border: 1px solid #345064;
            border-radius: 8px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.8);
            color: #d7e2ea;
            padding: 6px;
            font-size: 0.95em;
        }
        .mcfo-menu button {
            display: block; width: 100%; text-align: left;
            background: transparent; border: none; color: #d7e2ea;
            padding: 9px 12px; border-radius: 5px; cursor: pointer; font: inherit;
        }
        .mcfo-menu button:hover { background: #16283a; }
        .mcfo-menu hr { border: 0; border-top: 1px solid #243443; margin: 6px 4px; }

        /* === EVENTS PANEL === */
        .mcfo-menu--events { min-width: 320px; max-width: 380px; padding: 10px 12px 12px; }
        .mcfo-events__head { font-weight: bold; color: #d7e2ea; padding-bottom: 8px; border-bottom: 1px solid #243443; margin-bottom: 6px; }
        .mcfo-events__head small { display: block; font-weight: normal; opacity: 0.6; margin-top: 2px; }
        .mcfo-events__list { list-style: none; margin: 0; padding: 0; max-height: 60vh; overflow: auto; }
        .mcfo-events__list li { display: flex; justify-content: space-between; gap: 14px; padding: 7px 4px; border-bottom: 1px solid #16232f; }
        .mcfo-events__list li:last-child { border-bottom: 0; }
        .mcfo-events__name { font-weight: 600; }
        .mcfo-events__when { opacity: 0.7; white-space: nowrap; }
        .mcfo-events__list li[data-mcfo-live="1"] { color: #ffd479; }
        .mcfo-events__empty { opacity: 0.6; padding: 10px 4px; }

        /* === WINDOWS ===
           Not one modal overlay any more but several independent windows, because a modal one
           cannot do what is wanted here: keep several pages open, park one, and go on playing.
           The desk spans the viewport but lets clicks through — only the windows themselves
           catch them, so the board underneath stays fully playable. */
        .mcfo-desk {
            position: fixed; inset: 0; z-index: 10040;
            pointer-events: none;
        }
        .mcfo-win {
            position: absolute;
            pointer-events: auto;
            display: flex; flex-direction: column;
            min-width: 420px; min-height: 240px;
            background: #0b121a;
            border: 1px solid #345064; border-radius: 10px;
            box-shadow: 0 20px 70px rgba(0,0,0,0.85);
            overflow: hidden;
        }
        .mcfo-win[hidden] { display: none !important; }
        .mcfo-win__head {
            display: flex; align-items: center; gap: 10px;
            padding: 9px 8px 9px 14px;
            background: #0c1721; border-bottom: 1px solid #243443;
            color: #d7e2ea; font-weight: bold;
            cursor: grab; user-select: none; flex: none;
        }
        .mcfo-win__head:active { cursor: grabbing; }
        .mcfo-win__title { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .mcfo-win__btn {
            background: transparent; border: none; color: #9ab0c0;
            font-family: inherit; font-weight: 700; font-size: 15px; line-height: 1; cursor: pointer; padding: 4px 9px; border-radius: 5px;
        }
        .mcfo-win__btn:hover { background: #16283a; color: #fff; }
        .mcfo-win__body { flex: 1; position: relative; background: transparent; }
        .mcfo-win__body iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; background: transparent; transition: opacity 160ms ease; }
        .mcfo-win__body iframe:not([data-mcfo-ready]) { opacity: 0; }
        /* Resize grip, bottom right. Drawn as two hairlines rather than an icon so it reads as
           a corner and not as a button. */
        .mcfo-win__grip {
            position: absolute; right: 0; bottom: 0; width: 18px; height: 18px;
            cursor: nwse-resize;
            background:
                linear-gradient(135deg, transparent 46%, #4a6479 46%, #4a6479 54%, transparent 54%),
                linear-gradient(135deg, transparent 70%, #4a6479 70%, #4a6479 78%, transparent 78%);
        }
        /* The other edges and corners (6.59): invisible strips just inside the border, above the page. */
        .mcfo-win__edge { position: absolute; z-index: 4; }
        .mcfo-win__edge[data-edge=n]  { top: 0; left: 10px; right: 10px; height: 5px; cursor: ns-resize; }
        .mcfo-win__edge[data-edge=s]  { bottom: 0; left: 10px; right: 18px; height: 6px; cursor: ns-resize; }
        .mcfo-win__edge[data-edge=e]  { right: 0; top: 10px; bottom: 18px; width: 6px; cursor: ew-resize; }
        .mcfo-win__edge[data-edge=w]  { left: 0; top: 10px; bottom: 10px; width: 6px; cursor: ew-resize; }
        .mcfo-win__edge[data-edge=nw] { left: 0; top: 0; width: 10px; height: 10px; cursor: nwse-resize; }
        .mcfo-win__edge[data-edge=ne] { right: 0; top: 0; width: 8px; height: 8px; cursor: nesw-resize; }
        .mcfo-win__edge[data-edge=sw] { left: 0; bottom: 0; width: 10px; height: 10px; cursor: nesw-resize; }
        .mcfo-win__grip { z-index: 4; }
        .mcfo-loading {
            position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
            color: #6b8299; font-size: 1.1em; pointer-events: none;
        }

        /* === TASKBAR ===
           Only there while something is parked. Floats just above the game footer, which is full
           to the brim — measured at 1920x905 the footer holds our own line on the left, the bid
           area across the middle and the navigation on the right, with no free strip to dock to.
           Sits UNDER the desk (10040): a window dragged down into the corner covers the parked
           buttons instead of being covered by them (6.54.1). */
        .mcfo-taskbar {
            position: fixed; left: 12px; z-index: 10039;
            display: flex; gap: 8px; flex-wrap: wrap;
            pointer-events: auto;
        }
        .mcfo-taskbar[hidden] { display: none !important; }
        .mcfo-taskbar button {
            display: inline-flex; align-items: center; gap: 7px;
            padding: 6px 12px;
            border: 1px solid #3d5f78; border-radius: 7px;
            background: rgba(20, 40, 58, 0.92);
            color: #dcefff; font-family: inherit; font-weight: 700; font-size: 12px; line-height: 1; cursor: pointer;
        }
        .mcfo-taskbar button:hover { background: #1b3550; border-color: #4d7ea6; }

        /* === GLASS: LET THE GAME SHOW THROUGH ===
           Goes against the original design, hence the switch.

           The first attempt tinted the panel and dimmed the backdrop, and next to nothing came
           through — because both lie on top of each other: 0.42 backdrop under an 0.88 panel
           leaves 0.12 x 0.58, about 7% of the board, and the panel covers 92% x 88% of the
           window so there is barely any bare backdrop to see either. Stacking two translucent
           layers is not twice as see-through, it is half.

           So the tint now lives in ONE place, and in the embedded page rather than the panel
           (see framePanelMode). That also fixes the diamond packages turning white: that page
           declares color-scheme:normal instead of dark, so clearing its background dropped it
           onto the browser's light default canvas. A page that paints its own translucent tint
           never falls through to the canvas at all.

           The backdrop is left almost clear — the panel's border and shadow mark it out well
           enough without dimming the board behind it. */
        /* No dimming layer at all now: with several windows open and the game meant to stay
           playable, a backdrop would be exactly wrong. */
        html[data-mcfo-glass="1"] .mcfo-win {
            background: transparent;
            backdrop-filter: blur(6px);
        }
        /* THE ONE THAT ACTUALLY BLOCKED IT (kept as a warning).
           The body between window and frame used to carry an opaque #0b121a, and everything set
           on the window and inside the page was buried behind it — two rounds of tuning changed
           nothing visible. The title bar went translucent because it is a sibling of the body,
           the page did not because it is a child. It is transparent by default now. */
        html[data-mcfo-glass="1"] .mcfo-win__body { background: transparent; }
        /* The strength comes from the Transparency slider via two variables on <html>; the
           same pair is pushed into every frame (applyGlassToFrames). */
        html[data-mcfo-glass="1"] .mcfo-win__head { background: rgba(12, 23, 33, var(--mcfo-glass-head, 0.82)); }
        /* The small panels stay noticeably more solid — they are dense with text and sit over
           the board rather than over a dimmed backdrop. */
        html[data-mcfo-glass="1"] .mcfo-menu {
            background: rgba(9, 16, 24, 0.93);
            backdrop-filter: blur(3px);
        }

        /* === PERFORMANCE ===
           Each lever is one token in data-mcfo-perf on <html>, so switching it off takes effect
           at once and leaves nothing behind. */

        /* The crown's shadow sits on .crownOverlayProof, whose drawing area is blown up by
           inset:-170% -135% around the crown — a large surface, re-shadowed on every frame
           because the crown under it turns. The wall blocks carry one each (kingPane.js). */
        html[data-mcfo-perf~="shadows"] .mcf-king-crown-overlay-layer .crownOverlayProof,
        html[data-mcfo-perf~="shadows"] .mcf-king-shared-renderer-stage [data-role="king-layout-target-shape"],
        html[data-mcfo-perf~="shadows"] .mcf-king-shared-renderer-stage [data-role="king-wall-block-shape"] { filter: none !important; }

        /* The crown renders through three.js on every frame and sizes its canvas from its box
           each time (crownOverlayProofRenderer.js, draw -> resize). Hidden, that box is 0x0 and
           the canvas drops to 1x1 pixel, so the loop that keeps running costs next to nothing. */
        html[data-mcfo-perf~="crownhide"] [data-role="king-crown-overlay-layer"] { display: none !important; }
        html[data-mcfo-cos~="crown"] [data-role="king-crown-overlay-layer"] { display: none !important; }

        /* Crowns without a 3D model turn through a CSS animation instead (crownOverlayProofBandTurn,
           kingPane.js); the still crown stops that one too. The 3D ones are handled in section 14. */
        html[data-mcfo-perf~="crownstill"] .mcf-king-crown-overlay-layer .crownOverlayProofRotating { animation: none !important; }

        /* Chat cosmetics animate through keyframes (16 of them in chatPane.css). */
        html[data-mcfo-perf~="chatmotion"] .mcf-chat *,
        html[data-mcfo-perf~="chatmotion"] .mcf-chat *::before,
        html[data-mcfo-perf~="chatmotion"] .mcf-chat *::after { animation: none !important; }

        /* A blur behind a window has to be redone whenever anything beneath it moves — and the
           board beneath moves all the time. Includes the chat script's settings window. */
        html[data-mcfo-perf~="noblur"] .mcfo-win,
        html[data-mcfo-perf~="noblur"] .mcfo-menu,
        html[data-mcfo-perf~="noblur"] .mcfc-win { backdrop-filter: none !important; }

        /* Both the board and the king tile are SVG. */
        html[data-mcfo-perf~="edges"] [data-role="lane-stage"] svg,
        html[data-mcfo-perf~="edges"] .mcf-king-shared-renderer-stage svg { shape-rendering: optimizeSpeed; text-rendering: optimizeSpeed; }

        .mcfo-fps {
            position: fixed; right: 12px; z-index: 10041;
            padding: 5px 9px; border-radius: 7px;
            background: rgba(9, 16, 24, 0.85); border: 1px solid #2c4254;
            color: #cfe2f2; font: 700 12px/1 ui-monospace, monospace;
            cursor: pointer; font-variant-numeric: tabular-nums; user-select: none;
        }
        .mcfo-fps[hidden] { display: none !important; }
        .mcfo-fps[data-mcfo-pinned] { border-color: #5a7f9c; }
        /* Min / average / max under the badge (fpsPopup): on hover, pinned by a click. */
        .mcfo-fpspop {
            position: fixed; z-index: 10042; min-width: 128px;
            padding: 7px 10px; border-radius: 8px;
            background: rgba(9, 16, 24, 0.94); border: 1px solid #2c4254;
            color: #cfe2f2; font: 600 12px/1.5 ui-monospace, monospace; font-variant-numeric: tabular-nums;
            box-shadow: 0 6px 18px rgba(0, 0, 0, 0.45); pointer-events: none;
        }
        .mcfo-fpspop[hidden] { display: none !important; }
        .mcfo-fpspop__row { display: flex; justify-content: space-between; gap: 14px; }
        .mcfo-fpspop__row b { font-weight: 700; }
        .mcfo-fpspop__note { margin-top: 3px; color: #7f97ab; font-size: 10.5px; }
        /* In the chat header (drawFpsMeter, 6.37.1): one of its grid cells, no longer floating. */
        .mcfo-fps.mcfo-fps--card { position: static; z-index: auto; justify-self: end; align-self: center; }
        .mcfo-fps[data-mcfo-tone="low"] { color: #ffb4a8; border-color: #6f4a4a; }
        .mcfo-fps[data-mcfo-tone="mid"] { color: #ffd479; }

        /* The level picker: five wide segments in one row, the chosen one described below. */
        .mcfo-perf__levels { display: grid; grid-template-columns: repeat(5, 1fr); }
        .mcfo-perf__levels button { padding: 8px 4px; font-size: 12.5px; }
        .mcfo-perf__top { padding: 12px 14px; display: flex; flex-direction: column; gap: 9px; }
        .mcfo-perf__text { font-size: 12px; color: #9ab0c0; min-height: 2.7em; }
        .mcfo-perf__levers .mcfo-set__item { border-top: 1px solid #192a38; }
        .mcfo-set__row--choice { cursor: default; }

        /* === SETTINGS WINDOW ===
           Stays nearly opaque whatever the transparency is set to. It is dense text, and in
           3.7 it was hard to read over a busy board. It is also the window the transparency
           slider lives in, so the effect is watched on the other windows, not on this one.
           Deliberately no dimming of the screen: that would hide exactly that effect. */
        .mcfo-win--solid .mcfo-win__body,
        html[data-mcfo-glass="1"] .mcfo-win--solid .mcfo-win__body { background: rgba(9, 16, 24, 0.96); }
        html[data-mcfo-glass="1"] .mcfo-win--solid .mcfo-win__head { background: #0c1721; }

        .mcfo-set {
            position: absolute; inset: 0; overflow: auto;
            padding: 16px 18px 20px;
            color: #d7e2ea; font-size: 13px; line-height: 1.35;
        }
        .mcfo-set__section {
            display: flex; align-items: center; gap: 10px;
            margin: 20px 2px 8px;
            font-size: 11px; font-weight: 800; letter-spacing: 0.09em; text-transform: uppercase;
            color: #7f9ab0;
        }
        .mcfo-set__section:first-child { margin-top: 2px; }
        /* A hairline after the title, so the sections read as chapters without boxes around
           their headings. */
        .mcfo-set__section::after { content: ''; flex: 1; height: 1px; background: #1c2d3b; }
        .mcfo-set__sub-title { margin: 12px 2px 6px; font-size: 12px; font-weight: 700; color: #9ab0c0; }
        .mcfo-set__item--seg .mcfo-seg { flex-shrink: 0; }
        .mcfo-set__item--seg .mcfo-seg button:disabled { cursor: default; }
        .mcfo-set__subnote { margin: -2px 2px 6px; font-size: 11.5px; line-height: 1.35; color: #7f95a6; }
        /* Cosmetics page (6.49): the group switch heads its card. */
        .mcfo-set__item[data-group] + .mcfo-set__item { border-top: 2px solid #23394b; }

        .mcfo-set__card {
            border: 1px solid #1f3242; border-radius: 10px;
            background: linear-gradient(180deg, rgba(22, 38, 52, 0.55), rgba(14, 25, 35, 0.55));
            overflow: hidden;
        }
        .mcfo-set__item + .mcfo-set__item { border-top: 1px solid #192a38; }

        .mcfo-set__row {
            display: flex; align-items: center; gap: 14px;
            padding: 11px 14px;
            cursor: pointer; user-select: none;
            transition: background 120ms ease;
        }
        .mcfo-set__row:hover { background: rgba(77, 126, 166, 0.08); }
        .mcfo-set__text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
        .mcfo-set__label { font-weight: 700; color: #e6f0f7; font-size: 13.5px; }
        .mcfo-set__hint { font-size: 12px; color: #8da2b7; }
        .mcfo-set__hint--wide { flex: 1; min-width: 0; }

        /* The switch. A real checkbox, only visually hidden, so keyboard and screen readers keep
           working; the pill next to it is drawn from its :checked state. Same green as the
           cosmetics switch in the chat script, so both scripts speak one language. */
        .mcfo-switch__input { position: absolute; opacity: 0; width: 1px; height: 1px; pointer-events: none; }
        .mcfo-switch {
            flex: none; position: relative;
            width: 40px; height: 22px; border-radius: 11px;
            background: #26353f; box-shadow: inset 0 0 0 1px #3d5568;
            transition: background 160ms ease, box-shadow 160ms ease;
        }
        .mcfo-switch::after {
            content: ''; position: absolute; top: 3px; left: 3px;
            width: 16px; height: 16px; border-radius: 50%;
            background: #8ea6b8; box-shadow: 0 1px 3px rgba(0,0,0,0.5);
            transition: transform 160ms ease, background 160ms ease;
        }
        .mcfo-switch__input:checked + .mcfo-switch { background: #2f9e62; box-shadow: inset 0 0 0 1px #3fae72; }
        .mcfo-switch__input:checked + .mcfo-switch::after { transform: translateX(18px); background: #fff; }
        .mcfo-switch__input:focus-visible + .mcfo-switch { outline: 2px solid #4da6ff; outline-offset: 2px; }

        /* Sub-controls hang under their switch, indented to the text, and fade out with it. */
        .mcfo-set__sub {
            display: flex; align-items: center; gap: 12px;
            padding: 0 14px 12px;
            transition: opacity 160ms ease;
        }
        .mcfo-set__sub[data-off] { opacity: 0.35; pointer-events: none; }
        .mcfo-set__sublabel { font-size: 12px; font-weight: 700; color: #9ab0c0; white-space: nowrap; min-width: 82px; }
        .mcfo-set__range { flex: 1; min-width: 0; accent-color: #2f9e62; cursor: pointer; }
        .mcfo-set__field { flex: 1; min-width: 0; box-sizing: border-box; padding: 6px 9px; border: 1px solid #355066; border-radius: 6px;
                          background: #0b141c; color: #d7e2ea; font: inherit; font-size: 12px; }
        .mcfo-set__field:focus { outline: none; border-color: #4d7ea6; }
        .mcfo-set__val { min-width: 42px; text-align: right; font-weight: 800; color: #ffd479; font-variant-numeric: tabular-nums; }
        .mcfo-set__reset {
            flex: none; border: 1px solid #2c4254; border-radius: 6px; background: transparent;
            color: #8da2b7; font: inherit; font-size: 12px; line-height: 1; padding: 4px 7px; cursor: pointer;
        }
        .mcfo-set__reset:hover { color: #fff; border-color: #4d7ea6; background: #16283a; }
        .mcfo-set__reset[disabled] { visibility: hidden; }

        /* Gear and music note in one cell of the header grid (11f). */
        .mcfo-hdr { display: flex; align-items: center; gap: 6px; }
        .mcfo-note {
            width: 32px; height: 32px; padding: 0; box-sizing: border-box;
            display: grid; place-items: center;
            border: 1px solid #355066; border-radius: 8px; background: #111822; color: #d8e3ef; cursor: pointer;
        }
        .mcfo-note:hover { border-color: #4d7ea6; background: #16283a; }
        .mcfo-note[aria-pressed="true"] { border-color: #3fae72; color: #8ee0b0; }
        .mcfo-note svg { width: 17px; height: 17px; display: block; }

        /* The player bar on the page (11f). Under the windows, over the game. */
        .mcfo-bar {
            position: fixed; z-index: 10035; width: 268px; box-sizing: border-box;
            display: flex; flex-direction: column; gap: 5px;
            padding: 8px 10px 0; border: 1px solid #2c4254; border-radius: 10px;
            background: rgba(12, 22, 32, 0.94); box-shadow: 0 8px 22px rgba(0,0,0,0.45);
            font: 500 12px/1.3 system-ui, sans-serif; color: #e6f0f7;
            cursor: grab; user-select: none; overflow: hidden;
        }
        .mcfo-bar[data-drag] { cursor: grabbing; }
        .mcfo-bar__top { display: flex; align-items: center; gap: 6px; }
        .mcfo-bar__title {
            flex: 1; min-width: 0;
            color: #e6f0f7; font: 800 12.5px/1.25 system-ui, sans-serif;
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .mcfo-bar__sub {
            font-size: 11px; color: #8da2b7; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
            min-height: 14px;
        }
        .mcfo-bar__sub[data-wait] { color: #e0b84a; }
        .mcfo-bar__row { display: flex; align-items: center; gap: 5px; padding-bottom: 7px; }
        .mcfo-barbtn {
            flex: none; width: 26px; height: 26px; padding: 0; display: grid; place-items: center; cursor: pointer;
            border: 1px solid #2c4254; border-radius: 7px; background: #111f2b; color: #cfe2f0;
        }
        .mcfo-barbtn:hover { border-color: #4d7ea6; background: #16283a; color: #fff; }
        .mcfo-barbtn[disabled] { opacity: 0.35; cursor: default; }
        .mcfo-barbtn[aria-pressed="true"] { background: #2f9e62; border-color: #3fae72; color: #fff; }
        .mcfo-barbtn svg { width: 13px; height: 13px; fill: currentColor; }
        .mcfo-bar__x { width: 22px; height: 22px; border-color: transparent; background: transparent; color: #7f97a9; }
        .mcfo-bar__x svg { width: 11px; height: 11px; fill: none; }
        .mcfo-bar__vol { flex: 1; min-width: 0; accent-color: #2f9e62; cursor: pointer; }
        .mcfo-bar__line {
            position: relative; height: 4px; margin: 0 -10px; background: #16283a; cursor: pointer;
        }
        .mcfo-bar__line > span { position: absolute; left: 0; top: 0; height: 100%; }
        .mcfo-bar__buf { background: #33607f; }
        .mcfo-bar__at { background: #2f9e62; }

        /* The music player on the Sound page (11e). */
        .mcfo-mus { display: flex; flex-direction: column; gap: 9px; padding: 2px 14px 12px; }
        .mcfo-mus__now { display: flex; align-items: baseline; gap: 10px; min-width: 0; }
        .mcfo-mus__title { flex: 1; min-width: 0; font-weight: 800; font-size: 13.5px; color: #e6f0f7;
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .mcfo-mus__albumline { flex: none; max-width: 45%; font-size: 12px; color: #8da2b7;
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .mcfo-mus__row { display: flex; align-items: center; gap: 8px; }
        .mcfo-mus__btn {
            flex: none; width: 30px; height: 30px; padding: 0; display: grid; place-items: center; cursor: pointer;
            border: 1px solid #2c4254; border-radius: 8px; background: #111f2b; color: #cfe2f0;
        }
        .mcfo-mus__btn:hover { border-color: #4d7ea6; background: #16283a; color: #fff; }
        .mcfo-mus__btn[disabled] { opacity: 0.35; cursor: default; }
        .mcfo-mus__btn[aria-pressed="true"] { background: #2f9e62; border-color: #3fae72; color: #fff; }
        .mcfo-mus__btn--play { width: 36px; height: 36px; }
        .mcfo-mus__btn svg { width: 15px; height: 15px; fill: currentColor; }
        .mcfo-mus__btn--play svg { width: 18px; height: 18px; }
        .mcfo-mus__count { margin-left: auto; font-size: 12px; color: #8da2b7; white-space: nowrap; }
        .mcfo-mus__time { flex: none; min-width: 38px; font-size: 11.5px; color: #9ab0c0;
            font-variant-numeric: tabular-nums; text-align: center; }
        .mcfo-mus__seek { flex: 1; min-width: 0; accent-color: #2f9e62; cursor: pointer; }
        .mcfo-mus__seek[disabled] { opacity: 0.35; cursor: default; }
        /* How much of the track is loaded: the reason a WAV of 40 MB stutters is worth showing. */
        .mcfo-mus__buf { height: 3px; border-radius: 2px; background: #16283a; margin: -4px 40px 0; overflow: hidden; }
        .mcfo-mus__buf > span { display: block; height: 100%; background: #33607f; transition: width 300ms linear; }
        .mcfo-mus__buf[data-thin] > span { background: #c08a2e; }
        .mcfo-mus__search {
            flex: 1; min-width: 0; border: 1px solid #2c4254; border-radius: 6px;
            background: #0c1620; color: #e6f0f7; font: inherit; font-size: 12px; padding: 5px 8px;
        }
        .mcfo-mus__search:focus { outline: none; border-color: #4d7ea6; }
        .mcfo-mus__list {
            max-height: 250px; overflow-y: auto; overscroll-behavior: contain;
            border: 1px solid #192a38; border-radius: 8px; background: #0c1620;
        }
        .mcfo-mus__head { display: flex; align-items: center; gap: 8px; padding: 6px 10px; border-top: 1px solid #14212d; }
        .mcfo-mus__list > .mcfo-mus__head:first-child { border-top: 0; }
        .mcfo-mus__fold {
            flex: 1; min-width: 0; text-align: left; border: 0; background: transparent; cursor: pointer;
            color: #cfe2f0; font: inherit; font-size: 12.5px; font-weight: 700; padding: 0;
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .mcfo-mus__fold::before { content: '\\203a '; display: inline-block; width: 12px; color: #6d8699; transition: transform 140ms ease; }
        .mcfo-mus__head[data-open] .mcfo-mus__fold::before { transform: rotate(90deg); }
        .mcfo-mus__fold:hover { color: #fff; }
        .mcfo-mus__num { flex: none; font-size: 11px; color: #7f97a9; font-variant-numeric: tabular-nums; }
        .mcfo-mus__tick { flex: none; accent-color: #2f9e62; cursor: pointer; margin: 0; }
        .mcfo-mus__songs { padding: 0 0 4px; }
        .mcfo-mus__song { display: flex; align-items: center; gap: 8px; padding: 2px 10px 2px 22px; }
        .mcfo-mus__song:hover { background: rgba(77, 126, 166, 0.09); }
        .mcfo-mus__song[data-current] .mcfo-mus__songname { color: #ffd479; font-weight: 700; }
        .mcfo-mus__song[data-playing] .mcfo-mus__songname::before { content: '\\25b8\\00a0'; }
        .mcfo-mus__songname {
            flex: 1; min-width: 0; text-align: left; border: 0; background: transparent; cursor: pointer;
            color: #b9cddd; font: inherit; font-size: 12px; padding: 3px 0;
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .mcfo-mus__songname:hover { color: #fff; }
        .mcfo-mus__note { font-size: 12px; color: #9ab0c0; }

        .mcfo-seg { display: inline-flex; border: 1px solid #2c4254; border-radius: 8px; overflow: hidden; }
        .mcfo-seg button {
            border: 0; background: #111f2b; color: #a9bfce;
            font: inherit; font-size: 12px; font-weight: 700; line-height: 1; padding: 6px 13px; cursor: pointer;
        }
        .mcfo-seg button + button { border-left: 1px solid #2c4254; }
        .mcfo-seg button[aria-pressed="true"] { background: #1f5a3c; color: #fff; }
        .mcfo-seg button:hover:not([aria-pressed="true"]) { background: #16283a; color: #fff; }

        /* The footer buttons as a two-column grid of compact switches: six rows of full width
           would make the footer section longer than everything above it. */
        .mcfo-set__grid { display: grid; grid-template-columns: 1fr 1fr; }
        .mcfo-set__grid .mcfo-set__item { border-top: 1px solid #192a38; }
        .mcfo-set__grid .mcfo-set__item:nth-child(-n+2) { border-top: 0; }
        .mcfo-set__grid .mcfo-set__item:nth-child(odd) { border-right: 1px solid #192a38; }
        .mcfo-set__grid .mcfo-set__row { padding: 9px 12px; }
        .mcfo-set__grid .mcfo-set__hint { font-size: 11px; }

        .mcfo-set__foot {
            display: flex; align-items: center; justify-content: space-between; gap: 12px;
            margin-top: 18px; padding: 0 2px;
            font-size: 12px; color: #6b8299;
        }
        .mcfo-set__foot button {
            border: 1px solid #5a3a3a; border-radius: 7px; background: transparent; color: #e7b3b3;
            font: inherit; font-size: 12px; font-weight: 700; padding: 6px 11px; cursor: pointer;
        }
        .mcfo-set__foot button:hover { background: #2a1b1e; border-color: #a06a6a; color: #fff; }

        /* Settings overview: one tile per page, with what it holds and how much of it is on.
           The rules hang on .mcfo-set on purpose — a bare class would lose against any
           "container button" rule (the 3.11 lesson with .mcfo-menu button). */
        .mcfo-set__intro { margin: 2px 2px 14px; font-size: 12.5px; color: #8da2b7; }
        .mcfo-set__tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 10px; }
        .mcfo-set .mcfo-set__tile {
            position: relative; display: flex; flex-direction: column; gap: 4px;
            padding: 13px 34px 12px 14px; text-align: left;
            border: 1px solid #1f3242; border-radius: 10px;
            background: linear-gradient(180deg, rgba(22, 38, 52, 0.55), rgba(14, 25, 35, 0.55));
            color: #d7e2ea; font: inherit; cursor: pointer;
            transition: border-color 120ms ease, background 120ms ease;
        }
        .mcfo-set .mcfo-set__tile:hover { border-color: #4d7ea6; background: linear-gradient(180deg, rgba(28, 48, 66, 0.72), rgba(16, 29, 41, 0.72)); }
        .mcfo-set .mcfo-set__tile:focus-visible { outline: 2px solid #4da6ff; outline-offset: 2px; }
        .mcfo-set__tile-title { font-weight: 800; font-size: 14px; color: #e6f0f7; }
        .mcfo-set__tile-blurb { font-size: 12px; color: #8da2b7; }
        .mcfo-set__tile-state { margin-top: 5px; font-size: 11px; font-weight: 700; color: #7fc79f; }
        .mcfo-set__tile-state[data-none] { color: #6b8299; }
        .mcfo-set__tile-arrow {
            position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
            font-size: 22px; line-height: 1; color: #4d6a82; transition: transform 120ms ease, color 120ms ease;
        }
        .mcfo-set .mcfo-set__tile:hover .mcfo-set__tile-arrow { color: #cfe2f2; transform: translate(3px, -50%); }
        .mcfo-set__crumb { display: flex; align-items: center; gap: 12px; margin: 0 0 16px; }
        .mcfo-set .mcfo-set__back {
            border: 1px solid #2c4254; border-radius: 7px; background: #111f2b; color: #cfe2f2;
            font: inherit; font-size: 12px; font-weight: 700; line-height: 1; padding: 7px 11px; cursor: pointer;
        }
        .mcfo-set .mcfo-set__back:hover { background: #16283a; border-color: #4d7ea6; color: #fff; }
        .mcfo-set__crumb-title { font-size: 16px; font-weight: 800; color: #e6f0f7; }
        /* A switch that needs another one (needs:) is greyed while that one is off. */
        .mcfo-set__item[data-off] { opacity: 0.4; pointer-events: none; }
        .mcfo-set__notice {
            margin: 0 0 10px; padding: 10px 12px; border-radius: 9px;
            border: 1px solid #6f5a28; background: rgba(60, 45, 12, 0.35); color: #ffe3a3; font-size: 12px;
        }

        /* === ON THE THRONE (section 7c) === the beverage picker in the settings, and the note
           on screen after the crown was taken. Button rules hang on .mcfo-set (3.11 lesson). */
        .mcfo-throne { padding: 12px 14px 13px; margin-top: 10px; transition: opacity 160ms ease; }
        .mcfo-throne[data-off] { opacity: 0.4; pointer-events: none; }
        .mcfo-throne__head { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; margin-bottom: 11px; }
        .mcfo-throne__title { font-weight: 700; color: #e6f0f7; font-size: 13.5px; }
        .mcfo-throne__quick { display: flex; gap: 6px; flex-wrap: wrap; }
        .mcfo-set .mcfo-throne__quick button {
            border: 1px solid #2c4254; border-radius: 7px; background: #111f2b; color: #cfe2f2;
            font: inherit; font-size: 12px; font-weight: 700; line-height: 1; padding: 6px 10px; cursor: pointer;
        }
        .mcfo-set .mcfo-throne__quick button:hover { background: #16283a; border-color: #4d7ea6; color: #fff; }
        .mcfo-throne__grid { display: grid; grid-template-columns: 58px repeat(3, minmax(0, 1fr)); gap: 6px 8px; align-items: center; }
        .mcfo-throne__col { font-size: 11px; font-weight: 700; color: #9ab0c0; text-align: center; text-transform: uppercase; letter-spacing: 0.04em; }
        .mcfo-throne__name { font-weight: 800; font-size: 13px; }
        .mcfo-throne__cell { display: flex; gap: 5px; min-width: 0; }
        .mcfo-set .mcfo-throne__pick {
            flex: 1 1 0; min-width: 0; display: inline-flex; align-items: center; justify-content: center; gap: 5px;
            border: 1px solid #2c4254; border-radius: 7px; background: #0f1b26; color: #8da2b7;
            font: inherit; font-size: 12px; font-weight: 700; line-height: 1; padding: 7px 4px; cursor: pointer;
            font-variant-numeric: tabular-nums; white-space: nowrap;
        }
        .mcfo-set .mcfo-throne__pick:hover { border-color: #4d7ea6; color: #fff; }
        .mcfo-set .mcfo-throne__pick[data-cur="gold"][aria-pressed="true"] { background: #4a3a0e; border-color: #e0b84a; color: #ffe3a3; }
        .mcfo-set .mcfo-throne__pick[data-cur="diamonds"][aria-pressed="true"] { background: #0f3a4a; border-color: #5fd0f0; color: #c8f2ff; }
        .mcfo-throne__coin { flex: none; width: 9px; height: 9px; border-radius: 50%; background: #f2c14e; box-shadow: inset 0 0 0 1px #8a6512; }
        .mcfo-throne__gem { flex: none; width: 7px; height: 7px; transform: rotate(45deg); background: #6fdcff; box-shadow: inset 0 0 0 1px #1d6f8a; }
        .mcfo-throne__sum { margin-top: 12px; font-size: 12px; color: #8da2b7; }
        .mcfo-throne__sum b { color: #ffd479; }
        .mcfo-throne-note {
            position: fixed; left: 50%; bottom: 96px; transform: translateX(-50%); z-index: 2147483000;
            max-width: min(560px, 92vw); padding: 10px 14px; border-radius: 10px;
            border: 1px solid #e0b84a; background: rgba(20, 16, 6, 0.94); color: #ffe9b8;
            font: 13px/1.45 system-ui, sans-serif; box-shadow: 0 8px 28px rgba(0, 0, 0, 0.5); cursor: pointer;
        }
        .mcfo-throne-note b { display: block; color: #ffd479; margin-bottom: 3px; }

        /* === ATTACK WHEN FREE (section 7b) ===
           The game's button is hidden, not removed — ours forwards the click to it. Ours carries
           the game's own class, so it looks the same and takes the same place in the tray grid;
           it has no data-action, so the game's click handler never mistakes it for its own. */
        html[data-mcfo-attack="1"] .mcf-king-action-content [data-action="king-attack"] { display: none !important; }
        .mcfo-attack { cursor: pointer; }
        .mcfo-attack:disabled { cursor: not-allowed; }
        .mcfo-attack[data-mcfo-state="wait"] { background: #3a2a0e !important; border-color: #e0b84a !important; color: #ffe3a3 !important; }
        .mcfo-attack[data-mcfo-state="warn"] { background: #3a1616 !important; border-color: #c46a6a !important; color: #ffd0d0 !important; }

        /* === UNBID === right of the chips, the counterpart of Rebellion on the left.
           Calm by default, green when the game confirmed. */
        .mcfo-unbid {
            align-self: center; min-width: 76px;
            padding: 8px 12px; min-height: 40px;
            border: 1px solid #4a5a6f; border-radius: 7px;
            background: #141b24; color: #cfdcea;
            font-family: inherit; font-weight: 800; font-size: 12px; line-height: 1; cursor: pointer; white-space: nowrap;
            transition: background 120ms ease, border-color 120ms ease, color 120ms ease;
        }
        .mcfo-unbid:hover { background: #1b2633; border-color: #6d86a0; }
        .mcfo-unbid[data-mcfo-state="sent"]  { opacity: 0.75; cursor: progress; }
        .mcfo-unbid[data-mcfo-state="done"]  { background: #10291c; border-color: #3fae72; color: #d9ffe8; }
        .mcfo-unbid[data-mcfo-state="none"]  { border-color: #6f4a4a; color: #ffc9c9; }

        /* === AUTOBID === right of Unbid. The colour tells what it is doing at a glance: grey off,
           green bidding, amber holding back (King, risk tile open, another tab), red when
           something needs a look. The words are in its tooltip and in the menu. */
        .mcfo-autobid {
            align-self: center; min-width: 84px;
            padding: 8px 12px; min-height: 40px;
            border: 1px solid #4a5a6f; border-radius: 7px;
            background: #141b24; color: #cfdcea;
            font-family: inherit; font-weight: 800; font-size: 12px; line-height: 1; cursor: pointer; white-space: nowrap;
            transition: background 120ms ease, border-color 120ms ease, color 120ms ease;
        }
        .mcfo-autobid:hover { background: #1b2633; border-color: #6d86a0; }
        .mcfo-autobid[data-mcfo-tone="on"]    { background: #10291c; border-color: #3fae72; color: #d9ffe8; }
        .mcfo-autobid[data-mcfo-tone="hold"]  { background: #2c2310; border-color: #c9a13f; color: #ffe8b0; }
        .mcfo-autobid[data-mcfo-tone="alert"] { background: #2a1416; border-color: #c46a6a; color: #ffd0d0; }
        .mcfo-menu--auto { width: 310px; max-width: 92vw; padding: 10px 12px 12px; }
        .mcfo-auto__head { display: flex; align-items: baseline; justify-content: space-between; gap: 10px;
                           padding-bottom: 8px; border-bottom: 1px solid #243443; margin-bottom: 2px; }
        .mcfo-auto__title { font-weight: 800; font-size: 14px; letter-spacing: 0.05em; text-transform: uppercase; }
        .mcfo-auto__sub { font-size: 11px; color: #8da2b7; }
        .mcfo-auto__row { position: relative; display: flex; align-items: center; justify-content: space-between; gap: 12px;
                          padding: 9px 2px; cursor: pointer; }
        .mcfo-auto__row + .mcfo-auto__row { border-top: 1px solid #16232f; }
        .mcfo-auto__label { font-weight: 700; font-size: 13px; }
        .mcfo-auto__amount { width: 68px; padding: 5px 7px; border: 1px solid #3d5568; border-radius: 6px; background: #0e1821; color: #e6f0f7;
                             font: inherit; font-weight: 800; text-align: right; }
        .mcfo-auto__amount:focus { outline: 2px solid #4da6ff; outline-offset: 1px; }
        .mcfo-auto__hint { font-size: 11.5px; line-height: 1.35; color: #8da2b7; padding: 0 2px 4px; }
        .mcfo-auto__hint[data-tone="warn"] { color: #ffb4a8; }
        .mcfo-auto__box { margin-top: 6px; padding: 7px 9px; border-radius: 7px; border: 1px solid #243443; background: #0e1821;
                          font-size: 12px; line-height: 1.35; }
        .mcfo-auto__box[hidden] { display: none; }
        .mcfo-auto__box[data-tone="on"]    { border-color: #2f7a52; color: #c9f5dc; }
        .mcfo-auto__box[data-tone="hold"]  { border-color: #8a6d2a; color: #ffe8b0; }
        .mcfo-auto__box[data-tone="alert"] { border-color: #8a4a4a; color: #ffd0d0; }
        .mcfo-auto__last { margin-top: 6px; font-size: 11.5px; color: #a9bac8; min-height: 14px; }
        .mcfo-auto__foot { margin-top: 8px; font-size: 11px; line-height: 1.35; color: #7f93a6; }
        [data-mcfo-ab="tiles"] { border-top: 1px solid #16232f; }
        [data-mcfo-ab="tiles"][hidden] { display: none; }
        .mcfo-auto__new { border-color: #8a6d2a; }
        .mcfo-auto__newhead { color: #ffe8b0; margin-bottom: 4px; }
        .mcfo-auto__tile { display: flex; align-items: center; gap: 6px; padding: 2px 0; }
        .mcfo-auto__tile > span { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .mcfo-auto__tile i { font-style: normal; font-size: 10.5px; color: #8da2b7; }
        /* .mcfo-menu button makes every button a full-width row; these sit beside a name. */
        .mcfo-menu button.mcfo-auto__btn { display: inline-block; flex: none; width: auto; text-align: center;
                          padding: 3px 8px; border: 1px solid #3d5568; border-radius: 5px; background: #142230; color: #dbe7f1;
                          font: inherit; font-size: 11px; font-weight: 700; line-height: 1.3; cursor: pointer; }
        .mcfo-menu button.mcfo-auto__btn:hover { border-color: #6d86a0; background: #1b2c3c; }
        .mcfo-auto__lists { margin-top: 6px; font-size: 12px; }
        .mcfo-auto__lists > summary { cursor: pointer; font-weight: 700; padding: 4px 2px; color: #cfdcea; }
        .mcfo-auto__lists[open] [data-mcfo-ab="listbody"] { max-height: 200px; overflow-y: auto; padding-right: 4px; }
        .mcfo-auto__add { display: flex; gap: 6px; margin: 4px 0 6px; }
        .mcfo-auto__name { flex: 1; min-width: 0; padding: 4px 7px; border: 1px solid #3d5568; border-radius: 6px; background: #0e1821;
                           color: #e6f0f7; font: inherit; font-size: 12px; }
        .mcfo-auto__listhead { margin: 6px 0 2px; font-size: 10.5px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: #8da2b7; }
        .mcfo-auto__none { color: #6f8396; font-size: 11.5px; }

        /* === ENHANCED CHAT (opt-in, section 9f) ===
           Everything keyed on an attribute of <html> and limited to the real message list, so
           switching it off gives back the game's chat exactly. */
        html[data-mcfo-chatplus="1"] :is([data-role="chat-messages"], .mcf-chat__messages) article.mcf-chat__message[data-mcf-filter] { display: none !important; }
        html[data-mcfo-chatplus="1"] :is([data-role="chat-messages"], .mcf-chat__messages) article.mcf-chat__message[data-mcf-group] {
            padding: 6px 10px !important; margin-bottom: 8px !important; border-radius: 6px !important; line-height: 1.4 !important;
        }
        html[data-mcfo-chatplus="1"] :is([data-role="chat-messages"], .mcf-chat__messages) article.mcf-chat__message[data-mcf-group="mid"] .mcf-chat__meta,
        html[data-mcfo-chatplus="1"] :is([data-role="chat-messages"], .mcf-chat__messages) article.mcf-chat__message[data-mcf-group="end"] .mcf-chat__meta { display: none !important; }
        html[data-mcfo-chatplus="1"] :is([data-role="chat-messages"], .mcf-chat__messages) article.mcf-chat__message[data-mcf-group="start"] {
            border-bottom-left-radius: 0 !important; border-bottom-right-radius: 0 !important; margin-bottom: 0 !important; padding-bottom: 4px !important;
        }
        html[data-mcfo-chatplus="1"] :is([data-role="chat-messages"], .mcf-chat__messages) article.mcf-chat__message[data-mcf-group="mid"] {
            border-radius: 0 !important; margin-bottom: 0 !important; padding-top: 4px !important; padding-bottom: 4px !important;
        }
        html[data-mcfo-chatplus="1"] :is([data-role="chat-messages"], .mcf-chat__messages) article.mcf-chat__message[data-mcf-group="end"] {
            border-top-left-radius: 0 !important; border-top-right-radius: 0 !important; padding-top: 4px !important;
        }
        /* The game's cosmetics button said "Cosmetics on/off" in words — the widest thing in the
           chat header. Since 6.16.1 it is a symbol the size of its neighbours: sparkles, struck
           through while off. The state is in its aria-pressed; only the look hangs on that. The
           button stays the game's own: click and text are still the game's, the text just is not
           shown (screen readers still read it, and it comes back as the tooltip). */
        .mcf-chat__cosmetics-toggle {
            position: relative; display: grid !important; place-items: center; box-sizing: border-box;
            width: 30px !important; min-width: 30px !important; height: 30px !important; min-height: 30px !important;
            padding: 0 !important; font-size: 0 !important; letter-spacing: 0 !important; line-height: 0 !important;
            overflow: hidden; cursor: pointer; transition: background 0.2s, border-color 0.2s, color 0.2s;
        }
        .mcf-chat__cosmetics-toggle::after {
            content: ''; width: 17px; height: 17px; background: currentColor; opacity: 0.5;
            -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M10 2l1.8 5.2L17 9l-5.2 1.8L10 16l-1.8-5.2L3 9l5.2-1.8z'/%3E%3Cpath d='M18 13l.9 2.1L21 16l-2.1.9L18 19l-.9-2.1L15 16l2.1-.9z'/%3E%3Cpath d='M18 2.5l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6z'/%3E%3C/svg%3E") center / contain no-repeat;
                    mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M10 2l1.8 5.2L17 9l-5.2 1.8L10 16l-1.8-5.2L3 9l5.2-1.8z'/%3E%3Cpath d='M18 13l.9 2.1L21 16l-2.1.9L18 19l-.9-2.1L15 16l2.1-.9z'/%3E%3Cpath d='M18 2.5l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6z'/%3E%3C/svg%3E") center / contain no-repeat;
        }
        .mcf-chat__cosmetics-toggle[aria-pressed="true"]::after { opacity: 1; }
        .mcf-chat__cosmetics-toggle:not([aria-pressed="true"])::before {
            content: ''; position: absolute; left: 50%; top: 50%; width: 22px; height: 2px; border-radius: 1px;
            background: currentColor; opacity: 0.85; transform: translate(-50%, -50%) rotate(-45deg);
        }
        /* In colour (setting): green while on. */
        html[data-mcfo-chatcos="1"] .mcf-chat__cosmetics-toggle[aria-pressed="true"] {
            background: #10291c !important; border-color: #3fae72 !important; color: #7dffb4 !important;
        }
        .mcf-chat__cosmetics-toggle:disabled { opacity: 0.5; cursor: default; }

        /* === THEMES (settings page; the engine is section 3b) ===
           Scoped to .mcfo-theme: generic button rules of the settings window would otherwise
           win over a bare class, as they did for the rebellion tiles in 3.10. */
        .mcfo-theme__grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 8px; }
        .mcfo-theme .mcfo-theme__pick {
            display: grid; gap: 5px; padding: 9px 10px; text-align: left;
            border: 1px solid #2c4254; border-radius: 9px; background: #0e1821; color: #d7e2ea;
            font: inherit; cursor: pointer; transition: border-color 120ms ease, background 120ms ease;
        }
        .mcfo-theme .mcfo-theme__pick:hover { border-color: #4d7ea6; }
        .mcfo-theme .mcfo-theme__pick[aria-pressed="true"] { border-color: #4d7ea6; background: #122232; box-shadow: inset 0 0 0 1px #4d7ea6; }
        .mcfo-theme__swatches { display: flex; height: 20px; border-radius: 5px; overflow: hidden; box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08); }
        .mcfo-theme__swatches span { flex: 1; }
        .mcfo-theme__name { font-weight: 800; font-size: 13px; }
        .mcfo-theme__note { font-size: 11px; color: #8da2b7; }
        .mcfo-theme__custom { display: grid; gap: 10px; margin-top: 12px; padding-top: 10px; border-top: 1px solid #1c2c3a; }
        .mcfo-theme__slider { display: grid; grid-template-columns: 76px 1fr 46px; gap: 10px; align-items: center; font-size: 12.5px; }
        .mcfo-theme__slider output { text-align: right; font-variant-numeric: tabular-nums; color: #9ab0c0; }
        .mcfo-theme .mcfo-theme__range { width: 100%; margin: 0; accent-color: #4d7ea6; }
        .mcfo-theme .mcfo-theme__range--hue { -webkit-appearance: none; appearance: none; height: 10px; border-radius: 5px; }
        .mcfo-theme .mcfo-theme__range--hue::-webkit-slider-thumb { -webkit-appearance: none; width: 16px; height: 16px; border-radius: 50%; background: #ffffff; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.6); }
        .mcfo-theme .mcfo-theme__range--hue::-moz-range-thumb { width: 16px; height: 16px; border: 0; border-radius: 50%; background: #ffffff; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.6); }
        .mcfo-theme .mcfo-theme__range--hue::-moz-range-track { background: transparent; }
        .mcfo-theme__foot { margin-top: 12px; font-size: 11.5px; color: #8da2b7; line-height: 1.4; }
        .mcfo-theme__group { margin: 16px 0 7px; font-size: 11px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: #8da2b7; }
        .mcfo-theme__group:first-child { margin-top: 0; }
        .mcfo-theme__stripe { display: block; height: 5px; margin-top: -2px; border-radius: 3px; }
        .mcfo-theme__preview { position: relative; display: block; height: 34px; border-radius: 5px; overflow: hidden;
                               box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.1); }
        .mcfo-theme__badge { position: absolute; right: 4px; top: 4px; padding: 1px 5px; border-radius: 4px; font-size: 9px; font-weight: 800;
                             letter-spacing: 0.1em; line-height: 1.4; background: rgba(0, 0, 0, 0.72); color: #ffe692; }
        .mcfo-theme__fx { display: grid; gap: 6px; margin-top: 10px; padding: 10px 0 2px; border-top: 1px solid #1c2c3a; }
        .mcfo-theme__cats { margin-top: 2px; }
        .mcfo-theme__catprev { display: flex; height: 30px; margin-bottom: 6px; border-radius: 5px; overflow: hidden;
                               box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.1); }
        .mcfo-theme__cathead { display: flex; align-items: center; gap: 12px; margin: 0 0 12px; }
        .mcfo-theme__hint { font-size: 11.5px; line-height: 1.4; color: #8da2b7; }
        .mcfo-theme__toggle { position: relative; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 4px 0; cursor: pointer; }
        .mcfo-theme__toggle-label { display: block; font-size: 12.5px; font-weight: 700; }
        .mcfo-theme__toggle small { display: block; margin-top: 2px; font-size: 11px; line-height: 1.35; color: #8da2b7; }
        .mcfo-theme__patgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(78px, 1fr)); gap: 6px; margin-top: 6px; }
        .mcfo-theme .mcfo-theme__pat {
            display: grid; gap: 4px; padding: 5px; text-align: center;
            border: 1px solid #2c4254; border-radius: 8px; background: #0e1821; color: #d7e2ea;
            font: inherit; font-size: 11px; cursor: pointer;
        }
        .mcfo-theme .mcfo-theme__pat:hover { border-color: #4d7ea6; }
        .mcfo-theme .mcfo-theme__pat[aria-pressed="true"] { border-color: #4d7ea6; box-shadow: inset 0 0 0 1px #4d7ea6; }
        .mcfo-theme__patsw { display: block; height: 30px; border-radius: 5px; box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.06); }
        .mcfo-theme__random { display: grid; gap: 8px; margin-bottom: 14px; padding-bottom: 12px; border-bottom: 1px solid #1c2c3a; }
        .mcfo-theme__rotate { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
        .mcfo-theme__rotate[data-off] { opacity: 0.45; }
        .mcfo-theme__rotate .mcfo-seg button:disabled { cursor: default; }
        .mcfo-theme .mcfo-theme__shuffle {
            justify-self: start; padding: 6px 12px; border: 1px solid #2c4254; border-radius: 7px;
            background: #0e1821; color: #d7e2ea; font: inherit; font-size: 12px; cursor: pointer;
        }
        .mcfo-theme .mcfo-theme__shuffle:hover { border-color: #4d7ea6; }

        /* === HOW TO, CHANGELOG, WHAT'S NEW (section 11b) === */
        /* Two parts since 6.27: the text scrolls, the foot (tick, Got it, the other windows) stays put
           at the bottom — in a long What's new it used to scroll away with the text. */
        .mcfo-doc { position: absolute; inset: 0; display: flex; flex-direction: column; color: #d7e2ea; font-size: 13px; line-height: 1.45; }
        .mcfo-doc__scroll { flex: 1 1 auto; min-height: 0; overflow: auto; padding: 14px 18px 14px; }
        .mcfo-doc a.mcfo-doc__link { color: #8cc8ff; text-decoration: underline; text-underline-offset: 2px; cursor: pointer; }
        .mcfo-doc a.mcfo-doc__link:hover { color: #b9deff; }
        .mcfo-set__item--found { box-shadow: 0 0 0 2px #4d7ea6; border-radius: 9px; transition: box-shadow 1.2s ease 1.4s; }
        .mcfo-set__item--found.mcfo-set__item--fade { box-shadow: 0 0 0 2px transparent; }
        .mcfo-doc h3 { margin: 16px 0 6px; font-size: 11.5px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: #8da2b7; }
        .mcfo-doc h3:first-child { margin-top: 0; }
        .mcfo-doc ul { margin: 0; padding-left: 18px; display: grid; gap: 5px; }
        .mcfo-doc__intro { margin: 0 0 12px; color: #a9bac8; }
        .mcfo-doc__ver { display: flex; align-items: baseline; gap: 10px; margin: 16px 0 6px; }
        .mcfo-doc__ver:first-child, .mcfo-doc__intro + .mcfo-doc__ver { margin-top: 0; }
        .mcfo-doc__vnum { font-weight: 800; font-size: 14px; color: #e6f0f7; }
        .mcfo-doc__date { font-size: 11.5px; color: #8da2b7; }
        .mcfo-doc__foot { flex: none; display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 0; padding: 12px 18px 14px; border-top: 1px solid #1c2c3a; }
        .mcfo-doc__check { display: flex; align-items: center; gap: 8px; margin-right: auto; font-size: 12.5px; cursor: pointer; }
        .mcfo-doc__check input { accent-color: #4d7ea6; width: 15px; height: 15px; margin: 0; }
        .mcfo-doc .mcfo-doc__btn { padding: 6px 12px; border: 1px solid #2c4254; border-radius: 7px; background: #0e1821; color: #d7e2ea; font: inherit; font-size: 12.5px; cursor: pointer; }
        .mcfo-doc .mcfo-doc__btn:hover { border-color: #4d7ea6; }
        .mcfo-doc .mcfo-doc__btn--main { background: #1b3a55; border-color: #4d7ea6; color: #ffffff; }
        .mcfo-gift__top { position: sticky; top: -14px; z-index: 1; margin: -14px -18px 0; padding: 14px 18px 6px; background: inherit; display: grid; gap: 8px; }
        .mcfo-doc__scroll.mcfo-gift { background: #0a131b; }
        .mcfo-gift__bal { font-size: 12.5px; color: #a9bac8; }
        .mcfo-gift__search { width: 100%; box-sizing: border-box; padding: 7px 10px; border: 1px solid #2c4254; border-radius: 7px; background: #0e1821; color: #e6f0f7; font: inherit; font-size: 13px; }
        .mcfo-gift__search:focus { outline: none; border-color: #4d7ea6; }
        .mcfo-gift__head, .mcfo-gift__line { display: grid; grid-template-columns: 1fr 86px 86px; align-items: center; gap: 8px; }
        .mcfo-gift__head { padding: 0 8px; font-size: 11px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: #8da2b7; }
        .mcfo-gift__head span:not(:first-child) { text-align: center; }
        .mcfo-gift__row { border-bottom: 1px solid #16232f; }
        .mcfo-gift__line { width: 100%; padding: 6px 8px; border: 0; border-radius: 6px; background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; }
        .mcfo-gift__line:hover, .mcfo-gift__row--open .mcfo-gift__line { background: #12202c; }
        .mcfo-gift__name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 700; color: #e6f0f7; }
        .mcfo-gift__st { justify-self: center; padding: 1px 8px; border-radius: 999px; font-size: 11.5px; white-space: nowrap; }
        .mcfo-gift__st--open { background: #143a26; color: #86efac; }
        .mcfo-gift__st--sent { color: #6b7f90; }
        .mcfo-gift__st--full { color: #c9a35a; }
        .mcfo-gift__st--low { color: #e8a0a0; }
        .mcfo-gift__st--wait, .mcfo-gift__st--err { color: #6b7f90; }
        .mcfo-gift__amounts { display: grid; gap: 6px; padding: 6px 8px 10px; }
        .mcfo-gift__cur { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
        .mcfo-gift__curlab { width: 70px; font-size: 12px; font-weight: 700; color: #a9bac8; }
        .mcfo-doc .mcfo-gift__amt { padding: 4px 10px; }
        .mcfo-doc .mcfo-gift__amt:disabled { opacity: 0.4; cursor: default; }
        .mcfo-gift__note { font-size: 12px; color: #8da2b7; }
        .mcfo-gift__warn { font-size: 11.5px; color: #8da2b7; font-style: italic; }
        .mcfo-gift__empty { padding: 18px 8px; color: #8da2b7; text-align: center; }
        .mcfo-gift__prog { font-size: 12px; color: #8da2b7; }
    `;
    GM_addStyle(BASE_CSS);

