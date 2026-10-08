    // =========================================================================================
    // 10. CENTRE THE TICKET AND TOLL RAIL ON THE BOARD
    // =========================================================================================
    // Measured at a window width of 2560px:
    //   main-region (board without chat)   11 .. 2199   centre 1105
    //   bid-area (ticket + toll rail)      10 .. 1796   centre  903
    // The rail is not aligned to the board but to the space left of the navigation, hence the
    // 200px offset. Ticket rail and toll buttons both live in bid-area, so one correction fixes
    // both.
    //
    // Moved with a transform: that changes only the painting, not the flow, and deleting the
    // property undoes it completely.
    function centreRail() {
        const rail = role('bid-area');
        if (!rail) return;

        if (!settings.centreRail) { rail.style.transform = ''; return; }

        const board = role('main-region') || role('lane-play-region');
        if (!board) return;

        // Reset first, or the measurement includes the offset we applied last time.
        rail.style.transform = '';
        const r = rail.getBoundingClientRect();
        const b = board.getBoundingClientRect();
        if (!r.width || !b.width) return;

        // Centred as the FOLDED rail. Unfolding then only grows it to the right, from the left
        // edge it already had: centred at full width, the unfolded rail (over 900px with the extra
        // chips) ran with its left end across the footer line — season, episode and both
        // versions (reported at 1920x1080). What folding hides is exactly the big chips, so
        // their share is taken off the width: each chip plus the gap in front of it.
        let hidden = 0;
        if (document.documentElement.getAttribute('data-mcfo-rail') === 'open') {
            const bidRail = role('bid-rail');
            const gap = bidRail ? parseFloat(getComputedStyle(bidRail).columnGap) || 0 : 0;
            (bidRail ? bidRail.querySelectorAll(':scope > [data-mcfo-big="1"]') : []).forEach(chip => {
                const w = chip.getBoundingClientRect().width;
                if (w) hidden += w + gap;
            });
        }
        let offset = (b.left + b.width / 2) - (r.left + (r.width - hidden) / 2);

        // Do not push it into the navigation. On narrow windows the two close in on each other;
        // then whatever space actually exists applies, and in case of doubt the rail stays put.
        // Measured at the rightmost thing actually shown: Autobid, else Unbid, else the chips —
        // and while you are King, with all of them hidden, the toll controls.
        const chips = [settings.autobidButton && document.querySelector('.mcfo-autobid'),
                       settings.unbidButton && document.querySelector('.mcfo-unbid'), role('bid-rail'), role('king-toll-controls')]
            .find(e => e && e.getBoundingClientRect().width);
        const nav = role('nav-region');
        if (chips && nav) {
            const c = chips.getBoundingClientRect();
            const n = nav.getBoundingClientRect();
            if (c.width && n.width) {
                const room = n.left - 20 - c.right;
                if (offset > room) offset = Math.max(0, room);
            }
        }

        rail.style.transform = Math.abs(offset) < 1 ? '' : `translateX(${Math.round(offset)}px)`;
    }

