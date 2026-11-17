/**
 * Entry point.
 * 1) Inject all HTML fragments (pages / components / modals)
 * 2) Load every JS module (js/modules.js)
 */
import { loadIncludes } from './core/include.js?v=684982f88b';

(async () => {
    // Load once; if a file fails (flaky network, crawler), retry once before giving up.
    const boot = async () => { await loadIncludes(document.body); await import('./modules.js?v=684982f88b'); };
    try {
        try { await boot(); } catch (e1) { await new Promise(r => setTimeout(r, 1200)); await boot(); }
    } catch (err) {
        console.error(err);
        // IMPORTANT: never wipe the page. The static content (home text, links) stays visible;
        // we only add a small reload bar so the page never turns into an "error page" (Google soft 404).
        const isFile = location.protocol === 'file:';
        const bar = document.createElement('div');
        bar.setAttribute('role', 'status');
        bar.style.cssText = 'position:fixed;left:12px;right:12px;bottom:12px;z-index:99999;background:#1b2030;color:#fff;font:600 13px/1.4 sans-serif;padding:12px 14px;border-radius:12px;display:flex;gap:10px;align-items:center;justify-content:space-between';
        bar.innerHTML = '<span>' + (isFile ? 'Open this project with a local server (see README).' : 'Connection problem. Some features did not load.') + '</span>' +
            '<button type="button" style="border:0;border-radius:8px;padding:8px 12px;font-weight:800;background:#ffc426;color:#1b2030" onclick="location.reload()">Reload</button>';
        document.body.appendChild(bar);
    }
})();
