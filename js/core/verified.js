/**
 * Blue tick everywhere.
 * The admin server keeps the list of blue-tick users in config/verified {uids:[...]}; the app reads it through the load balancer (GET /public/verified, polled every 60 s).
 * window.vfy.name(name, uid) -> the name in the pink/purple gradient + glowing blue tick (same look as in chat), or the plain escaped name.
 * Works in the leaderboard, match roster, games and chat. Last known list is cached so it shows instantly on the next visit.
 */
import { api } from './api.js?v=41f223a8d8';

const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let SET = new Set(), unsub = null, timer = null;
try { SET = new Set(JSON.parse(localStorage.getItem('ffcb_ver') || '[]')); } catch (e) {}

const repaint = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
        try { if (window.app && window.app.renderLB && window.db && window.db.leaderboard) window.app.renderLB(); } catch (e) {}
        try { document.dispatchEvent(new CustomEvent('verified-changed')); } catch (e) {}
    }, 60);
};

window.vfy = {
    has: (uid) => !!uid && (SET.has(uid) || (uid === (window.db || {}).user_uid && !!((window.db || {}).user_data || {}).isVerified)),
    name(n, uid) { return this.has(uid) ? `<span class="vn">${esc(n)}</span><i class="fa-solid fa-circle-check vt" title="Verified"></i>` : esc(n); },
    start() {
        if (unsub) return;
        const pull = async () => {
            try {
                const r = await api.pub('/public/verified');
                SET = new Set(Array.isArray(r.uids) ? r.uids : []);
                try { localStorage.setItem('ffcb_ver', JSON.stringify([...SET].slice(0, 500))); } catch (e) {}
                repaint();
            } catch (e) {}
        };
        pull(); const id = setInterval(() => { if (!document.hidden) pull(); }, 60000);
        unsub = () => clearInterval(id);
    },
    stop() { if (unsub) { try { unsub(); } catch (e) {} unsub = null; } }
};
