    // =========================================================================================
    // 11. SETTINGS PANEL
    // =========================================================================================
    // The settings live in a window like everything else — same shell, own content instead of a
    // frame. Its key is not a path, so it can never collide with a page.
    const SETTINGS_KEY = '#settings';

    function showSettings() {
        const vorhanden = windows.get(SETTINGS_KEY);
        if (vorhanden && !vorhanden.lazy) {
            restoreWindow(SETTINGS_KEY);
            renderSettings(vorhanden.body);   // redrawn, so it never shows a stale state
            return;
        }
        if (vorhanden) windows.delete(SETTINGS_KEY);

        const w = makeWindow(SETTINGS_KEY, 'Settings',
                             { width: 560, height: Math.min(780, innerHeight - 60) });
        w.el.classList.add('mcfo-win--solid');
        renderSettings(w.body);
        drawTaskbar();
    }

