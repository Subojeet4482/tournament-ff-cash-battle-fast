/**
 * Roster: every joined player and the slot they chose — visible to everybody who opens it.
 * Source: GET /matches/{id}/players  [{appName, slots[], isMe}]  (the server never sends the Free Fire UID / game name of other people). Refreshes every 6 s while open.
 * Only the in-app username is shown (never the Free Fire UID / game name of other people).
 */
const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
import { api } from '../../js/core/api.js?v=41f223a8d8';
let openId = null;
const cache = {};          // matchId -> [{appName, slots, uid(for me)}]

const find = (id) => (window.db.matches || []).find(m => m.id === id) || (window.app.currentMatch && window.app.currentMatch.id === id ? window.app.currentMatch : null);
const slotsOf = (p) => Array.isArray(p.slots) && p.slots.length ? p.slots.map(Number) : (p.slot ? [Number(p.slot)] : []);

function paint() {
    const m = find(openId); if (!m) return;
    const total = Number(m.total) || 48, parts = cache[openId] || m.participants || [], me = window.db.user_uid;
    const joined = Number(m.joined) || parts.length;
    document.getElementById('ro-title').textContent = m.title || 'Players';
    document.getElementById('ro-sub').textContent = `${joined}/${total} joined · ${Math.max(0, total - joined)} slots left`;
    document.getElementById('ro-fill').style.width = Math.min(100, joined / total * 100) + '%';
    const map = {}, loose = [];
    parts.forEach(p => { const s = slotsOf(p); if (!s.length) loose.push(p); s.forEach(n => { map[n] = p; }); });
    const cell = (n) => {
        const p = map[n];
        if (!p) return `<div class="ro-slot empty"><span class="n">${n}</span><span>Empty</span></div>`;
        const name = p.appName || p.gameName || 'Player';
        return `<div class="ro-slot full ${p.uid === me ? 'me' : ''}" style="animation-delay:${Math.min(n * 18, 400)}ms"><span class="n">${n}</span><img src="${window.gameArt.avatar(name)}" alt="" data-seed="${esc(name)}"><div style="min-width:0"><b>${window.vfy ? window.vfy.name(name, p.uid) : esc(name)}</b>${p.uid === me ? '<small>You</small>' : ''}</div></div>`;
    };
    const size = Number(m.teamSize) || 1; let html = '';
    if ((m.mode === 'CS' || m.mode === 'LW') && size > 0) {
        const grid = (from, to) => `<div class="ro-grid">${Array.from({ length: to - from + 1 }, (_, i) => cell(from + i)).join('')}</div>`;
        html = `<div class="ro-team a">TEAM A</div>${grid(1, size)}<div class="ro-team b">TEAM B</div>${grid(size + 1, Math.min(total, size * 2))}`;
    } else if (size > 1) {
        const teams = Math.ceil(total / size);
        for (let t = 0; t < teams; t++) html += `<div class="ro-team">TEAM ${t + 1}</div><div class="ro-grid">${Array.from({ length: Math.min(size, total - t * size) }, (_, i) => cell(t * size + i + 1)).join('')}</div>`;
    } else html = `<div class="ro-grid">${Array.from({ length: total }, (_, i) => cell(i + 1)).join('')}</div>`;
    if (loose.length) html += `<div class="ro-team ro-loose">SLOT NOT CHOSEN YET</div><div class="ro-grid">${loose.map(p => { const name = p.appName || p.gameName || 'Player'; return `<div class="ro-slot full ${p.uid === me ? 'me' : ''}"><span class="n">–</span><img src="${window.gameArt.avatar(name)}" alt="" data-seed="${esc(name)}"><div style="min-width:0"><b>${window.vfy ? window.vfy.name(name, p.uid) : esc(name)}</b>${p.uid === me ? '<small>You</small>' : ''}</div></div>`; }).join('')}</div>`;
    document.getElementById('ro-body').innerHTML = html;
}

async function load() {
    const id = openId; if (!id) return;
    try {
        const r = await api.any('/matches/' + id + '/players');
        cache[id] = (r.players || []).map(p => ({ appName: p.appName, slots: p.slots, uid: p.isMe ? window.db.user_uid : null }));
        const m = find(id); if (m) { m.joined = r.joined; m.total = r.total; }
        if (openId === id) paint();
    } catch (e) {}
}

Object.assign(window.app, {
    openRoster: (id) => { openId = id; paint(); window.ui.openModal('modal-roster'); load(); },
    rosterBtn: (m) => `<button type="button" class="roster-btn" onclick="event.stopPropagation();app.openRoster('${esc(m.id)}')"><i class="fa-solid fa-users"></i> Players &amp; slots <em>${Number(m.joined) || (m.participants || []).length}/${m.total || 48}</em></button>`,
});
// keep the open roster live while the match changes
setInterval(() => { const el = document.getElementById('modal-roster'); if (openId && el && el.classList.contains('active') && document.visibilityState === 'visible') load(); }, 6000);
