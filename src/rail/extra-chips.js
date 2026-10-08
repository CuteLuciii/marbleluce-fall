    // =========================================================================================
    // 9b. EXTRA TICKET CHIPS
    // =========================================================================================
    // The game ships 1 · 5 · 10 · 25 · 100 · 500 · 1K. The rule that reveals the larger ones is
    // in app.js (restoreBidButtonsForNonKing):
    //
    //     if (!spec.defaultVisible && hasTicketTruth && numericTickets >= amount * 10)
    //         progressiveVisibleBids.add(amount);
    //
    // Two things about it matter and are reproduced here: the threshold is TEN TIMES the amount,
    // and it is a Set — once unlocked a chip stays visible even if the balance drops back below.
    // The short labels ("1K") are the game's convention, not an invention of ours.
    //
    // A bid is a plain POST /bid/place with { bidDelta } — no lane, no run id (placeBidFromUi in
    // app.js). These chips do no more than that.
    //
    // CAREFUL, this is the sharp end of the script: a click spends real tickets. So the chips
    // adopt the game's own locks instead of inventing their own — they mirror the disabled state
    // of a real chip and refuse on click if that one is disabled. Where the game allows no bid,
    // neither do they.
    const EXTRA_CHIPS = [
        { amount: 10000,      label: '10K',  fill: 'linear-gradient(160deg,#5fd0c8,#2a9d94 45%,#1a6b66)', shine: 'linear-gradient(180deg,rgba(206,255,250,0.6),rgba(206,255,250,0))', shade: 'linear-gradient(180deg,rgba(8,44,42,0.44),rgba(8,44,42,0))', textColor: '#f2fffd', textShadow: '0 1px 1px rgba(6,48,45,0.6)' },
        { amount: 100000,     label: '100K', fill: 'linear-gradient(160deg,#b58ae0,#7e4fb8 45%,#53307d)', shine: 'linear-gradient(180deg,rgba(238,220,255,0.6),rgba(238,220,255,0))', shade: 'linear-gradient(180deg,rgba(38,18,58,0.46),rgba(38,18,58,0))', textColor: '#faf4ff', textShadow: '0 1px 1px rgba(43,17,68,0.62)' },
        { amount: 1000000,    label: '1M',   fill: 'linear-gradient(160deg,#ffd97a,#e0a92e 45%,#a5741a)', shine: 'linear-gradient(180deg,rgba(255,246,214,0.66),rgba(255,246,214,0))', shade: 'linear-gradient(180deg,rgba(84,52,8,0.4),rgba(84,52,8,0))', textColor: '#3b2707', textShadow: '0 1px 0 rgba(255,242,206,0.5)' },
        { amount: 10000000,   label: '10M',  fill: 'linear-gradient(160deg,#ff8b6b,#d9452c 45%,#962417)', shine: 'linear-gradient(180deg,rgba(255,220,208,0.6),rgba(255,220,208,0))', shade: 'linear-gradient(180deg,rgba(70,14,8,0.46),rgba(70,14,8,0))', textColor: '#fff3ef', textShadow: '0 1px 1px rgba(84,15,8,0.62)' },
        { amount: 100000000,  label: '100M', fill: 'linear-gradient(160deg,#7ee6a0,#33a862 45%,#1d7042)', shine: 'linear-gradient(180deg,rgba(214,255,229,0.6),rgba(214,255,229,0))', shade: 'linear-gradient(180deg,rgba(9,48,27,0.44),rgba(9,48,27,0))', textColor: '#effff5', textShadow: '0 1px 1px rgba(8,52,29,0.6)' },
        { amount: 1000000000, label: '1B',   fill: 'linear-gradient(160deg,#8fa4b8,#41586e 45%,#1d2b38)', shine: 'linear-gradient(180deg,rgba(226,239,255,0.7),rgba(226,239,255,0))', shade: 'linear-gradient(180deg,rgba(6,12,20,0.5),rgba(6,12,20,0))', textColor: '#f4faff', textShadow: '0 1px 1px rgba(6,14,24,0.7)' },
    ];

    // Unlocked chips stay unlocked, as in the game. Nothing needs to survive a reload: with
    // enough tickets the rule unlocks them again immediately, and someone who has spent them
    // starts over anyway.
    const unlockedChips = new Set();

    // "933,309" / "933.309" / "933 309" -> 933309. The game formats to the browser's locale, so
    // this reduces to digits rather than trying to parse a number format.
    function ticketBalance() {
        const el = role('tickets') || role('tickets-compact-value');
        const raw = (el?.textContent || '').replace(/\D+/g, '');
        return raw ? Number(raw) : null;
    }

    function buildExtraChips() {
        const rail = role('bid-rail');
        if (!rail) return;

        if (!settings.extraChips) {
            rail.querySelectorAll('[data-mcfo-bid]').forEach(e => e.remove());
            return;
        }

        // The template is a real chip, so the chip artwork (SVG mask, sizing) is carried over
        // verbatim instead of being rebuilt and drifting on the next build.
        const template = document.querySelector('[data-role="bid-1000"]') || document.querySelector('[data-role^="bid-"]');
        if (!template) return;

        const tickets = ticketBalance();

        for (const spec of EXTRA_CHIPS) {
            if (tickets !== null && tickets >= spec.amount * 10) unlockedChips.add(spec.amount);
            const visible = unlockedChips.has(spec.amount);

            let chip = rail.querySelector(`[data-mcfo-bid="${spec.amount}"]`);
            if (!chip) {
                if (!visible) continue;          // do not even create it yet
                chip = template.cloneNode(true);
                // The original's markers have to go, or the game might count the chip as its own.
                chip.removeAttribute('data-role');
                chip.removeAttribute('data-bid-amount');
                chip.removeAttribute('hidden');
                chip.setAttribute('data-mcfo-bid', String(spec.amount));
                chip.setAttribute('aria-label', `Bid x${spec.amount}`);
                chip.setAttribute('title', `Bid x${spec.amount}`);

                // The three art layers carry their gradients inline; only those are replaced,
                // mask and metrics stay as in the original.
                const layers = chip.querySelectorAll('span[aria-hidden="true"]');
                const colours = [spec.fill, spec.shine, spec.shade];
                layers.forEach((layer, i) => { if (colours[i]) layer.style.background = colours[i]; });
                const label = chip.querySelector('span:not([aria-hidden])');
                if (label) {
                    label.textContent = spec.label;
                    label.style.textShadow = spec.textShadow;
                }
                chip.style.color = spec.textColor;

                chip.addEventListener('click', () => placeBid(spec.amount, chip));
                rail.appendChild(chip);
            }

            // Unlocking stays our job; folding is the rail's, through the same marker the
            // game's own big chips carry.
            chip.setAttribute('data-mcfo-big', '1');
            chip.hidden = !visible;
            chip.style.display = visible ? 'grid' : 'none';

            // Mirror the locks: whatever holds for the game's chips holds here too.
            if (template.disabled !== chip.disabled) chip.disabled = template.disabled;
            const opacity = template.style.opacity || '1';
            if (chip.style.opacity !== opacity) chip.style.opacity = opacity;
        }
    }

    function placeBid(amount, chip) {
        // Second lock, checked at click time: the mirrored state can be up to 1.5s old, which is
        // too long for a button that spends tickets.
        const template = document.querySelector('[data-role="bid-1000"]');
        if (chip.disabled || (template && template.disabled)) return;

        fetch('/bid/place', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ bidDelta: amount }),
        })
            .then(res => res.json().catch(() => ({})).then(body => ({ ok: res.ok, status: res.status, body })))
            .then(({ ok, status, body }) => {
                if (!ok) console.warn('[MarbleLuceFall] bid rejected:', body?.error || ('HTTP ' + status));
            })
            .catch(e => console.warn('[MarbleLuceFall] bid request failed:', e.message));
    }

