    // =========================================================================================
    // 13. APPLY AND WATCH
    // =========================================================================================
    function apply() {
        document.documentElement.setAttribute('data-mcfo-hide',
            FOOTER_BUTTONS.filter(b => settings[b.key]).map(b => b.role).join(' '));
        document.documentElement.setAttribute('data-mcfo-glass', settings.glassOverlays ? '1' : '0');
        applyTunables();
        applyGlassToFrames();
        placeTaskbar();
        applyPerformance();
        themeTick();
        scheduleThemeRotation();
        // The card, not the line of text inside it: session-cell is 418x43 and a real click
        // target, while tileset-indicator is a 13px strip. The two cards are the same width and
        // sit next to each other, so the menu belongs to the whole card.
        // For the account it is deliberately profile-entry and not profile-sound-cell: the sound
        // button lives in the latter, and it should go on controlling the sound.
        bindMenu(role('profile-entry'), 'account', a => showMenu(a, accountEntries()));
        bindMenu(firstRole('session-cell', 'tileset-indicator'), 'events', showEvents);
        buildCards();
        buildSessionLines();
        tixTick();
        watchTicketNumber();
        buildFooterMeta();
        showUpdate();
        showDailyDot();
        showShopDot();
        buildTilesetBanner();
        buildRailGroup();
        buildUnbid();
        buildAutobid();
        buildTollField();
        document.documentElement.setAttribute('data-mcfo-chatrail', settings.chatRail ? '1' : '0');
        document.documentElement.setAttribute('data-mcfo-sugg', settings.chatSuggest ? '1' : '0');
        applyBoardClear();
        buildHeaderButtons();
        buildMusicBar();
        soundDefaultOnce();
        drawChatRail();
        drawChatPop();
        drawTomatoButton();
        drawAnimalButton();
        applyChatPlus();
        applyChatGrow();
        applyChatStick();
        watchTray();
        buildKingTray();
        paintQuestMarks();
        buildAttackAssist();
        syncDrinkHeight();
        throneTick();
        placeKingTray();
        watchTrayHeight();
        alignPanes();
        placeChat();
        drawKingFields();
        // Last: the chips above change the width of the rail, and only then is it worth aligning.
        buildExtraChips();
        centreRail();
        readChat();
    }

    // The game rebuilds parts of the interface when the view changes, and the fields on the king
    // tile and the menu bindings go with it. Rather than watch every mutation (the king frame
    // changes every physics frame) it is redone on a fixed beat — cheap, because with the
    // elements in place these functions only touch text nodes.
    setInterval(apply, 1500);
    addEventListener('resize', centreRail);

    // Start-up, step by step, each one on its own. Until 6.21.1 this was a single run of calls
    // with startAutobid() at the end of it, and that is one throw away from an autobid that never
    // starts: no beat, no lane listener, nothing, for the whole life of the page. The page of the
    // game is not always in the shape a step expects the first time, and apply() and
    // restoreParked() run synchronously right in front of it. apply() has a beat of its own and
    // heals itself, autobid had nothing — which is why it had to be reloaded or switched off and
    // on again, the switch ticking it by hand (reported 20.09.2026).
    //
    // Autobid goes first now. It is the part that acts on its own and must not wait on anything
    // above it having gone well; it touches no element that has to exist.
    const step = (what, fn) => {
        try { fn(); } catch (e) { console.warn('[MarbleLuceFall] start-up step "' + what + '" failed:', e && e.message); }
    };
    step('autobid', startAutobid);
    // Random theme: picked before the first pass, so the page never shows the old one first.
    step('random theme', () => { if (settings.themeRandom) randomTheme(); });
    step('first pass', apply);
    step('parked windows', restoreParked);
    step('king', () => { pollKing(); setInterval(pollKing, KING_POLL_MS); });
    // Read-only and cheap; also picks up a fresh set of rights after a throne change.
    step('beverages', () => { pollBeverages(); setInterval(pollBeverages, 20000); });
    step('build id', loadBuildId);
    step('update check', startUpdateCheck);
    step('dailies and shop', startDailies);
    // A moment after start-up, once the game has built its page.
    setTimeout(maybeShowWhatsNew, 1200);
    }   // end of main()

    // At document-start there is no DOM yet — the socket tap in section 0 is all that could run
    // that early. main() takes over as soon as the page is there.
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', main, { once: true });
    else main();
})();
