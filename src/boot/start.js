    if (/^\/achievements\/?$/.test(location.pathname)) {
        try { achOverhaulBoot(); } catch (e) { console.warn('[MarbleLuceFall] new achievements page unavailable:', e.message); }
    }
    if (/^\/inventory\/?$/.test(location.pathname)) {
        try { invListCache(); } catch (e) { console.warn('[MarbleLuceFall] crown list cache unavailable:', e.message); }
        try { invRarityTap(); } catch (e) { console.warn('[MarbleLuceFall] rarity tiles unavailable:', e.message); }
        try { invOverhaulBoot(); } catch (e) { console.warn('[MarbleLuceFall] new inventory unavailable:', e.message); }
    }

    // The script also runs inside the overlay iframes — they serve the same origin. It must not
    // do its work there: every embedded page would build its own overlay, its own footer and a
    // second account menu. The frames are styled from the outside instead (see framePanelMode).
    if (window.top !== window.self) return;

