/**
 * Chat system: World room, friend chats, groups, profile, game placeholder, search.
 * ALL data now comes from Server-3 through the load balancer (/chat/*): the app polls instead of listening to Firestore.
 *   /chat/boot            every 5 s while chat is open (40 s in the background): friends, blocks, requests, chats, groups, world settings
 *   /chat/messages        every 2 s for the open conversation (new messages), full refresh every ~16 s (edits / deletes)
 * The server owns every rule (limits, blocks, slow mode, 10-minute edit window, private profiles).
 */
import { authService } from '../../js/core/firebase.js?v=2d72097ddc';
import { api } from '../../js/core/api.js?v=2d72097ddc';
const CHAT_TTL_HOURS = 24;

export const MAX_FRIENDS = 20, EDIT_MS = 10 * 60 * 1000;
/** Hooks filled in by chat-keep.js (notifications, saved messages, red dots) — keeps this file free of circular imports. */
export const HK = {};
const hk = (n, ...a) => { try { return HK[n] && HK[n](...a); } catch (e) { console.warn('chat hook', n, e); } };
const $ = (id) => document.getElementById(id);
export const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const S = { uid: null, me: null, fr: { list: [], starred: [], nicks: {} }, bl: [], inc: [], out: [], chats: {}, groups: {}, world: { name: 'Booyah Lounge', emoji: '🔥', tagline: 'Meet players, flex wins, find your squad', slow: 0, locked: false },
                   prof: {}, th: null, thMsgs: [], tabName: 'chat', ready: false, unsubs: [], thUnsub: null, editing: null, lastWorldSend: 0, opened: false, ver: new Set() };
S.reply = null;
export const avatar = (name, photo, cls) => `<img class="${cls || 'av'}" src="${esc(photo || window.gameArt.avatar(name || '?'))}" alt="" loading="lazy" data-seed="${esc(name || '?')}" data-n="${esc((name || '?')[0] || '?').toUpperCase()}" onerror="gameArtFb(this)">`;
export const chatId = (a, b) => [a, b].sort().join('_');
export const fmtTime = (ms) => new Date(ms).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
export const fmtAgo = (ms) => { if (!ms) return ''; const d = Date.now() - ms; if (d < 60000) return 'now'; if (d < 3600000) return Math.floor(d / 60000) + 'm'; if (d < 86400000) return Math.floor(d / 3600000) + 'h'; return Math.floor(d / 86400000) + 'd'; };
/** Message life (ms). Default 24h; admin can change it in Chat Manager (cconfig/world.ttlHours, 1–168). */
export const DM_TTL_MS = 7 * 86400000;   // friend chats (DM): server keeps 7 days, your device keeps them until YOU delete
/** World / group life: 24h by default (admin can change). DM life: 7 days. */
export const ttlMs = (kind) => kind === 'dm' ? DM_TTL_MS : Math.max(1, Math.min(168, Number(S.world && S.world.ttlHours) || CHAT_TTL_HOURS || 24)) * 3600000;
export const alive = (m, kind) => !!m && (Date.now() - (m.at || 0)) < ttlMs(typeof kind === 'string' ? kind : undefined);
export const friendName = (uid) => (S.fr.nicks && S.fr.nicks[uid]) || (S.prof[uid] && S.prof[uid].name) || 'Player';
/* ---------- replies: stored natively (rid/rn/rt/ru); falls back to a hidden prefix if the rules were not updated yet ---------- */
const RPX = /^\u2060R(\{.*?\})\u2060/s;
const encReply = (r) => '\u2060R' + JSON.stringify({ i: r.id, n: r.n, t: r.t, u: r.u }) + '\u2060';
/** -> { text, rp: {id,n,t,u}|null } for any message (native fields or encoded prefix) */
export const parseMsg = (m) => {
    if (!m) return { text: '', rp: null };
    if (m.rid) return { text: m.text || '', rp: { id: m.rid, n: m.rn || 'Player', t: m.rt || '', u: m.ru || '' } };
    const t = m.text || '', x = RPX.exec(t);
    if (x) { try { const j = JSON.parse(x[1]); return { text: t.slice(x[0].length), rp: { id: j.i, n: j.n, t: j.t, u: j.u } }; } catch (e) {} }
    return { text: t, rp: null };
};
export const snippet = (m) => { const p = parseMsg(m); return (m.deleted ? 'Message deleted' : p.text).replace(/\s+/g, ' ').trim().slice(0, 100); };
export const isFriend = (uid) => S.fr.list.includes(uid);
/** My avatar exactly as Settings shows it (own photo, else the default art seeded by playerId) — so chat never shows a different picture. */
export const myPhoto = () => { const d = window.db.user_data || {}; return d.photoUrl || (window.gameArt ? window.gameArt.avatar(d.playerId || d.appName || 'User') : ''); };
/** Blue-tick (verified) users: flag is written only by the admin server (rules block users from setting it themselves). */
export const isVer = (uid) => !!uid && ((S.ver && S.ver.has(uid)) || !!(window.vfy && window.vfy.has(uid)) || !!((uid === S.uid ? S.me : S.prof[uid]) || {}).verified || (uid === S.uid && !!(window.db.user_data || {}).isVerified));
export const vName = (n, uid, p) => ((p && p.verified) || isVer(uid)) ? `<span class="vn">${esc(n)}</span><i class="fa-solid fa-circle-check vt" title="Verified"></i>` : esc(n);
/** a verified (blue tick) user may edit / delete ANY message in every room he can see (World, groups, DMs); own messages after the 10 min window too */
export const canMod = (m) => !!m && !m.deleted && isVer(S.uid) && !!S.th && (m.from !== S.uid || Date.now() - m.at >= EDIT_MS);
export const isBlocked = (uid) => S.bl.includes(uid);

export async function getProf(uid) {
    if (S.prof[uid]) return S.prof[uid];
    if (_pf[uid]) return _pf[uid];
    _pf[uid] = (async () => {
        let p;
        try { p = (await api.get('/chat/user/' + encodeURIComponent(uid))).user; } catch (e) { p = null; }
        p = p || { uid, name: 'Player', username: '' };
        S.prof[uid] = p; delete _pf[uid]; refresh(); return p;
    })();
    return _pf[uid];
}
const _pf = {};

/* ---------- sheet + confirm helpers (every risky action asks first) ---------- */
export function sheet(html, cls) { const s = $('cs'); s.className = 'cs ' + (cls || ''); s.innerHTML = '<i class="cs-h"></i>' + html; $('cs-ov').classList.add('on'); requestAnimationFrame(() => s.classList.add('on')); }
export function sheetClose() { $('cs').classList.remove('on'); $('cs-ov').classList.remove('on'); if (window._csResolve) { const r = window._csResolve; window._csResolve = null; r(null); } }
export function ask(o) {
    return new Promise((resolve) => {
        window._csResolve = resolve;
        sheet(`<div class="cs-ico ${o.danger ? 'red' : ''}"><i class="fa-solid ${o.icon || 'fa-circle-question'}"></i></div><div class="cs-t">${esc(o.title)}</div>
            ${o.text ? `<div class="cs-p">${esc(o.text)}</div>` : ''}
            ${o.input !== undefined ? `<input class="cs-in" id="cs-val" maxlength="${o.max || 30}" value="${esc(o.input)}" placeholder="${esc(o.placeholder || '')}" autocomplete="off">` : ''}
            ${o.chips ? `<div class="cs-chips">${o.chips.map((c, i) => `<button type="button" class="cs-chip ${i === 0 ? 'on' : ''}" onclick="this.parentNode.querySelectorAll('.cs-chip').forEach(x=>x.classList.remove('on'));this.classList.add('on')">${esc(c)}</button>`).join('')}</div>` : ''}
            ${o.area ? `<textarea class="cs-in" id="cs-area" rows="3" maxlength="300" placeholder="${esc(o.area)}"></textarea>` : ''}
            <div class="cs-btns"><button class="cs-b no" onclick="chat.sheetClose()">${esc(o.no || 'Cancel')}</button>
            <button class="cs-b yes ${o.danger ? 'red' : ''}" id="cs-yes">${esc(o.yes || 'Confirm')}</button></div>`, 'cs-sm');
        $('cs-yes').onclick = () => {
            const val = o.input !== undefined ? $('cs-val').value.trim() : o.chips ? ($('cs').querySelector('.cs-chip.on') || {}).textContent : true;
            const extra = o.area ? $('cs-area').value.trim() : '';
            window._csResolve = null; $('cs').classList.remove('on'); $('cs-ov').classList.remove('on'); resolve(o.area ? { val, extra } : val);
        };
        if (o.input !== undefined) setTimeout(() => { try { $('cs-val').focus(); $('cs-val').select(); } catch (e) {} }, 350);
    });
}
export const toast = (m) => window.ui && window.ui.toast ? window.ui.toast(m) : alert(m);
export const errMsg = (e) => (e && e.message) || 'Something went wrong';

/* ---------- boot / polling ---------- */
const stopFns = () => { S.unsubs.forEach(u => { try { u(); } catch (e) {} }); S.unsubs = []; };
let rt = null;
export const refresh = () => { clearTimeout(rt); rt = setTimeout(() => { try { window.chat.renderAll(); } catch (e) { console.error(e); } }, 60); };
let syncFn = null;
/** fetch the newest state right now (called after every action so the screen reacts at once) */
export const syncNow = () => (syncFn ? syncFn(true).catch(() => {}) : Promise.resolve());

function applyBoot(r) {
    S.world = { ...S.world, ...(r.world || {}) };
    S.ver = new Set(r.verified || []);
    S.ver.forEach(id => { if (S.prof[id]) S.prof[id].verified = true; });
    if (r.profiles) Object.entries(r.profiles).forEach(([id, p]) => { if (p) S.prof[id] = Object.assign(S.prof[id] || {}, p); });
    if (!r.friends) return refresh();                              // no chat profile yet
    S.fr = { list: [], starred: [], nicks: {}, ...r.friends };
    S.bl = r.blocked || [];
    S.inc = ((r.requests || {}).incoming || []).filter(x => x.status === 'pending');
    S.out = (r.requests || {}).outgoing || [];
    const pc = S.chats; S.chats = {}; (r.chats || []).forEach(c => { S.chats[c.id] = c; }); hk('onChats', pc, S.chats, 'dm');
    const pg = S.groups; S.groups = {}; (r.groups || []).forEach(c => { S.groups[c.id] = c; }); hk('onChats', pg, S.groups, 'group');
    S.fr.list.forEach(getProf); S.out.forEach(x => getProf(x.to)); S.inc.forEach(x => getProf(x.from));
    (r.chats || []).forEach(c => (c.members || []).forEach(m => { if (m !== S.uid) getProf(m); }));
    refresh();
}

async function startListeners() {
    const uid = S.uid;
    stopFns();
    let stopped = false, t = null, busy = false;
    const run = async (now) => {
        if (stopped || S.uid !== uid) return;
        if (busy) return; busy = true;
        try { const r = await api.get('/chat/boot', { light: 1 }); if (!stopped && S.uid === uid) applyBoot(r); } catch (e) {}
        busy = false;
        if (now === true) return;
        schedule();
    };
    const schedule = () => { clearTimeout(t); if (!stopped) t = setTimeout(() => { if (document.hidden && !S.th) return schedule(); run(); }, (S.opened || S.th) ? 5000 : 40000); };
    syncFn = (now) => run(now);
    schedule();
    S.unsubs.push(() => { stopped = true; clearTimeout(t); if (syncFn === run) syncFn = null; });
    clearInterval(presenceT); if (visH) document.removeEventListener('visibilitychange', visH);
    const ping = (online) => api.post('/chat/presence', { online }).catch(() => {});
    presenceT = setInterval(() => { if (S.me && S.uid === uid && !document.hidden) ping(true); }, 60000);
    visH = () => { if (S.me && S.uid === uid) ping(!document.hidden); };
    document.addEventListener('visibilitychange', visH);
    ping(true);
}
let presenceT = null, visH = null;

/** Wipe everything that belongs to the previous account (polling, timers, cached profiles, open thread) — called on logout and when another account logs in. */
export function resetChat() {
    stopFns(); syncFn = null;
    if (S.thUnsub) { try { S.thUnsub(); } catch (e) {} S.thUnsub = null; }
    clearInterval(presenceT); presenceT = null; if (visH) { document.removeEventListener('visibilitychange', visH); visH = null; }
    Object.assign(S, { uid: null, me: null, fr: { list: [], starred: [], nicks: {} }, bl: [], inc: [], out: [], chats: {}, groups: {}, prof: {}, th: null, thMsgs: [], tabName: 'chat',
                       ready: false, editing: null, lastWorldSend: 0, opened: false, ver: new Set(), reply: null });
    for (const k in _pf) delete _pf[k];
    bootP = null; bootUid = null;
    try { $('ct').classList.remove('on'); sheetClose(); } catch (e) {}
    try { window.chat.onReset && window.chat.onReset(); } catch (e) {}
    try { window.chat.renderAll && window.chat.renderAll(); } catch (e) {}
}
let bootP = null, bootUid = null;
export function boot() {
    const u = authService.currentUser;
    if (!u) { if (S.uid) resetChat(); return Promise.reject(new Error('Please login first')); }
    if (S.ready && S.uid === u.uid) return Promise.resolve(true);
    if (bootP && bootUid === u.uid) return bootP;
    if (S.uid && S.uid !== u.uid) resetChat();          // another account logged in on this device -> start clean
    bootUid = u.uid; const p = _boot(u); bootP = p; p.then(() => { if (bootP === p) bootP = null; }, () => { if (bootP === p) bootP = null; });
    return p;
}
async function _boot(u) {
    S.uid = u.uid;
    const same = () => { const c = authService.currentUser; return !!c && c.uid === u.uid && S.uid === u.uid; };
    const r = await api.get('/chat/boot'); if (!same()) return false;
    S.me = r.me || null;
    applyBoot(r);
    if (S.me) {
        const photo = myPhoto(), name = (window.db.user_data || {}).appName || S.me.name, up = {};
        const okPhoto = photo && (photo.startsWith('https://') || photo.startsWith('assets/'));
        if (okPhoto && photo !== S.me.photo) up.photo = photo;
        if (name && name !== S.me.name) up.name = name;
        if (Object.keys(up).length) { Object.assign(S.me, up); api.patch('/chat/profile', up).catch(() => {}); }
        await startListeners(); if (!same()) return false;
    }
    S.ready = true; return true;
}
export async function createProfile(uname) {
    uname = String(uname || '').toLowerCase().replace(/^@/, '');
    if (!/^[a-z0-9_]{3,20}$/.test(uname)) return toast('Username: 3–20 letters, numbers or _'), false;
    const u = authService.currentUser, d = window.db.user_data || {};
    try {
        const r = await api.post('/chat/profile', { username: uname, name: d.appName || u.displayName || 'Player' });
        S.me = r.me; await startListeners(); syncNow(); return true;
    } catch (e) { toast(e.status === 409 ? 'That username is taken — try another' : errMsg(e)); return false; }
}

/* ---------- friend requests ---------- */
export async function sendRequest(uid) {
    if (S.fr.list.length >= MAX_FRIENDS) return toast(`Your friend list is full (${MAX_FRIENDS}/${MAX_FRIENDS})`);
    try { await api.post('/chat/friends/request', { to: uid }); toast('Friend request sent ✓'); syncNow(); return true; }
    catch (e) { toast(errMsg(e)); return false; }
}
export async function acceptRequest(r) {
    if (S.fr.list.length >= MAX_FRIENDS) return toast(`Your friend list is full (${MAX_FRIENDS}/${MAX_FRIENDS})`);
    try { await api.post('/chat/friends/accept', { id: r.id }); toast('You are now friends 🎉'); syncNow(); return true; }
    catch (e) { toast(errMsg(e)); return false; }
}
export async function rejectRequest(r) { try { await api.post('/chat/friends/reject', { id: r.id }); toast('Request rejected'); syncNow(); } catch (e) { toast(errMsg(e)); } }
export async function cancelRequest(id) { try { await api.del('/chat/friends/request/' + encodeURIComponent(id)); toast('Request cancelled'); syncNow(); } catch (e) { toast(errMsg(e)); } }
export async function removeFriend(uid) {
    const ok = await ask({ icon: 'fa-user-minus', title: `Remove ${friendName(uid)}?`, text: 'You will both lose this friend. You can send a new request later.', yes: 'Remove', danger: true }); if (!ok) return;
    try { await api.del('/chat/friends/' + encodeURIComponent(uid)); toast('Friend removed'); syncNow(); } catch (e) { toast(errMsg(e)); }
}

/* ---------- conversation ---------- */
export const pathOf = (th) => th.kind === 'world' ? 'cworld' : th.kind === 'dm' ? `cchats/${th.id}/msgs` : `cgroups/${th.id}/msgs`;
export async function openThread(kind, id, uid) {
    closeMenu();
    const th = { kind, id, uid }; S.th = th; S.editing = null;
    if (kind === 'dm') { await getProf(uid); th.name = friendName(uid); th.photo = S.prof[uid].photo; }
    if (kind === 'group') { const g = S.groups[id] || {}; th.name = g.name || 'Group'; th.emoji = g.emoji || '👥'; }
    if (kind === 'world') { th.name = S.world.name; th.emoji = S.world.emoji; }
    $('ct-name').textContent = th.name;
    $('ct-av').innerHTML = kind === 'dm' ? avatar(th.name, th.photo) : `<div class="av av-e">${esc(th.emoji || '👥')}</div>`;
    $('ct-dots').style.display = '';
    $('ct-msgs').innerHTML = '<div class="ct-load"><i></i><i></i><i></i></div>';
    $('ct').classList.add('on'); $('ct-text').value = ''; window.chat.grow($('ct-text')); $('ct-edit').classList.add('hidden');
    window.chat.renderThreadHead();
    if (S.thUnsub) { S.thUnsub(); S.thUnsub = null; }
    hk('onOpen', th);
    S.thUnsub = watchThread(th, (items, full) => {
        if (full) S.thMsgs = items.filter(m => alive(m, th.kind));
        else { const have = new Set(S.thMsgs.map(m => m.id)); items.forEach(m => { if (!have.has(m.id) && alive(m, th.kind)) S.thMsgs.push(m); }); S.thMsgs.sort((a, b) => (a.at || 0) - (b.at || 0)); }
        hk('onMsgs', th, S.thMsgs); window.chat.renderMsgs(); markRead();
    }, (e) => { $('ct-msgs').innerHTML = `<div class="ct-empty"><i class="fa-solid fa-lock"></i><b>Can't open this chat</b><span>${esc(errMsg(e))}</span></div>`; });
}
/** Polls one conversation: new messages every 2 s (?after=), a full reload every 8th poll so edits / deletes show up too. Returns a stop function. */
export function watchThread(th, cb, onErr, limit = 80) {
    let stopped = false, t = null, n = 0, lastAt = 0, first = true;
    const q = () => ({ kind: th.kind, id: th.kind === 'world' ? 'world' : th.id, limit });
    const run = async () => {
        if (stopped) return;
        try {
            const full = first || (n % 8 === 0) || !lastAt;
            const r = await api.get('/chat/messages', full ? q() : Object.assign(q(), { after: lastAt }));
            if (stopped) return;
            (r.items || []).forEach(m => { if ((m.at || 0) > lastAt) lastAt = m.at; });
            if (full || (r.items || []).length) cb(r.items || [], full);
            first = false; n++;
        } catch (e) { if (first) { stopped = true; if (onErr) onErr(e); return; } }
        if (!stopped) t = setTimeout(run, document.hidden ? 8000 : 2000);
    };
    run();
    th.reload = () => { n = 0; clearTimeout(t); run(); };           // full reload now (after edit / delete)
    return () => { stopped = true; clearTimeout(t); };
}
export function closeThread() { const th = S.th; $('ct').classList.remove('on'); closeMenu(); if (S.thUnsub) { S.thUnsub(); S.thUnsub = null; } S.th = null; S.editing = null; hk('onClose', th); }
function markRead() {
    const th = S.th; if (!th || th.kind === 'world') return;
    const c = th.kind === 'dm' ? S.chats[th.id] : S.groups[th.id];
    if (c && c.unread && c.unread[S.uid]) { c.unread[S.uid] = 0; api.post('/chat/read', { kind: th.kind, id: th.id }).catch(() => {}); }
}
export function closeMenu() { const m = $('ct-menu'); if (m) m.classList.add('hidden'); }

export function replyTo(id) {
    const m = S.thMsgs.find(x => x.id === id); if (!m || m.deleted || !S.th) return;
    S.reply = { id: m.id, n: m.from === S.uid ? 'You' : (m.name || friendName(m.from)), t: snippet(m), u: m.from };
    sheetClose(); window.chat.paintReply && window.chat.paintReply();
    const ta = $('ct-text'); if (ta) setTimeout(() => ta.focus(), 60);
}
export function cancelReply() { S.reply = null; window.chat.paintReply && window.chat.paintReply(); }
/** Open (or start) a direct message with anyone — friends, or World users whose profile is public. */
export async function openDm(uid) {
    if (!uid || uid === S.uid) return;
    const p = await getProf(uid);
    if (isBlocked(uid)) return toast('You blocked this user — unblock to message');
    if (!isFriend(uid) && p && p.isPrivate) return toast('This profile is private — send a friend request first');
    sheetClose(); window.chat.openThread('dm', chatId(S.uid, uid), uid);
}
export async function send() {
    const th = S.th; if (!th) return;
    const ta = $('ct-text'), text = ta.value.trim(); if (!text) return;
    if (S.editing) return doEdit(text);
    const now = Date.now();
    if (th.kind === 'world') {
        if (S.world.locked) return toast('World chat is locked by admin right now');
        const slow = (S.world.slow || 0) * 1000; if (slow && now - S.lastWorldSend < slow) return toast(`Slow mode: wait ${Math.ceil((slow - (now - S.lastWorldSend)) / 1000)}s`);
    }
    if (th.kind === 'dm' && isBlocked(th.uid)) return toast('You blocked this user');
    const rp = S.reply; S.reply = null; window.chat.paintReply && window.chat.paintReply();
    ta.value = ''; window.chat.grow(ta); const btn = $('ct-send'); btn.classList.add('pop'); setTimeout(() => btn.classList.remove('pop'), 300);
    try {
        if (th.kind === 'world') S.lastWorldSend = now;
        const body = { kind: th.kind, text };
        if (th.kind === 'dm') { body.id = th.id; body.to = th.uid; } else if (th.kind === 'group') body.id = th.id;
        if (rp) body.reply = { id: rp.id, n: String(rp.n).slice(0, 40), t: String(rp.t).slice(0, 140), u: rp.u || '' };
        const r = await api.post('/chat/messages', body);
        if (th.kind === 'dm' && !S.chats[th.id]) S.chats[th.id] = { id: th.id, members: [S.uid, th.uid].sort() };
        if (S.th && S.th.kind === th.kind && S.th.id === th.id && r.message && !S.thMsgs.some(m => m.id === r.message.id)) {       // show it at once, the next poll confirms it
            S.thMsgs.push(r.message); hk('onMsgs', th, S.thMsgs); window.chat.renderMsgs();
        }
        syncNow();
    } catch (e) { ta.value = text; window.chat.grow(ta); toast(errMsg(e)); }
}
async function doEdit(text) {
    const th = S.th, id = S.editing; const m = S.thMsgs.find(x => x.id === id);
    const mod = canMod(m);
    if (!m || (!mod && Date.now() - m.at >= EDIT_MS)) { cancelEdit(); return toast('Edit time (10 min) is over'); }
    try { const pre = (m.rid || !RPX.test(m.text || '')) ? '' : RPX.exec(m.text)[0]; await api.patch('/chat/messages/' + encodeURIComponent(id), { kind: th.kind, id: th.kind === 'world' ? 'world' : th.id, text: pre + text }); cancelEdit(); if (th.reload) th.reload(); } catch (e) { toast(errMsg(e)); }
}
export function cancelEdit() { S.editing = null; $('ct-edit').classList.add('hidden'); $('ct-text').value = ''; window.chat.grow($('ct-text')); }
export async function msgTap(id) {
    const m = S.thMsgs.find(x => x.id === id); if (!m || m.from !== S.uid || m.deleted) return;
    const left = EDIT_MS - (Date.now() - m.at);
    if (left <= 0) return toast('You can edit or delete a message only within 10 minutes');
    const mins = Math.floor(left / 60000), secs = Math.floor((left % 60000) / 1000);
    sheet(`<div class="cs-t">Your message</div><div class="cs-quote">${esc(m.text)}</div><div class="cs-timer"><i class="fa-regular fa-clock"></i> ${mins}m ${secs}s left to edit or delete</div>
        <div class="cs-list"><button onclick="chat.editStart('${id}')"><i class="fa-solid fa-pen"></i> Edit message</button>
        <button class="red" onclick="chat.delMsg('${id}')"><i class="fa-solid fa-trash"></i> Delete message</button></div>`, 'cs-sm');
}
export function editStart(id) {
    const m = S.thMsgs.find(x => x.id === id); if (!m) return; sheetClose(); S.editing = id;
    $('ct-edit').classList.remove('hidden'); const ta = $('ct-text'); ta.value = parseMsg(m).text; window.chat.grow(ta); ta.focus();
}
export async function delMsg(id) {
    const ok = await ask({ icon: 'fa-trash', title: 'Delete this message?', text: 'It will be removed for everyone.', yes: 'Delete', danger: true }); if (!ok) return;
    const m = S.thMsgs.find(x => x.id === id), mod = canMod(m); if (!m || (!mod && Date.now() - m.at >= EDIT_MS)) return toast('Delete time (10 min) is over');
    try { const th = S.th; await api.del('/chat/messages/' + encodeURIComponent(id) + '?kind=' + encodeURIComponent(th.kind) + '&id=' + encodeURIComponent(th.kind === 'world' ? 'world' : th.id)); toast('Message deleted'); if (th.reload) th.reload(); } catch (e) { toast(errMsg(e)); }
}

/* ---------- 3-dots menu: block / star / rename / report ---------- */
export function threadMenu() {
    const th = S.th; if (!th) return; const m = $('ct-menu');
    if (!m.classList.contains('hidden')) return closeMenu();
    let items = '';
    if (th.kind === 'dm') {
        const st = S.fr.starred.includes(th.uid), bl = isBlocked(th.uid);
        items = `<button onclick="chat.mBlock()"><i class="fa-solid ${bl ? 'fa-lock-open' : 'fa-ban'}"></i>${bl ? 'Unblock user' : 'Block user'}</button>
                 <button onclick="chat.mStar()"><i class="fa-${st ? 'solid' : 'regular'} fa-star" style="color:#f59e0b"></i>${st ? 'Remove star' : 'Star friend'}</button>
                 <button onclick="chat.mRename()"><i class="fa-solid fa-pen"></i>Rename</button>
                 <button class="red" onclick="chat.mReport()"><i class="fa-solid fa-flag"></i>Report</button>`;
    } else if (th.kind === 'group') {
        items = `<button onclick="chat.mGroupInfo()"><i class="fa-solid fa-users"></i>Group info</button><button class="red" onclick="chat.mLeave()"><i class="fa-solid fa-right-from-bracket"></i>Leave group</button><button class="red" onclick="chat.mReport()"><i class="fa-solid fa-flag"></i>Report</button>`;
    }
    m.innerHTML = items; m.classList.remove('hidden');
}
export async function mBlock() {
    closeMenu(); const uid = S.th.uid, bl = isBlocked(uid), n = friendName(uid);
    const ok = await ask({ icon: bl ? 'fa-lock-open' : 'fa-ban', title: bl ? `Unblock ${n}?` : `Block ${n}?`, text: bl ? 'They will be able to message you again.' : 'They will not be able to send you messages.', yes: bl ? 'Unblock' : 'Block', danger: !bl }); if (!ok) return;
    try { await api.post('/chat/block', { uid, block: !bl }); toast(bl ? 'User unblocked' : 'User blocked'); await syncNow(); window.chat.renderThreadHead(); } catch (e) { toast(errMsg(e)); }
}
export async function mStar() {
    closeMenu(); const uid = S.th.uid, st = S.fr.starred.includes(uid), n = friendName(uid);
    const ok = await ask({ icon: 'fa-star', title: st ? `Remove star from ${n}?` : `Star ${n}?`, text: st ? 'They will no longer be pinned on top.' : 'Starred friends are pinned on top of your chat list.', yes: st ? 'Remove star' : 'Star friend' }); if (!ok) return;
    try { await api.post('/chat/friends/star', { uid, star: !st }); toast(st ? 'Star removed' : 'Friend starred ⭐'); syncNow(); } catch (e) { toast(errMsg(e)); }
}
export async function mRename() {
    closeMenu(); const uid = S.th.uid, real = (S.prof[uid] || {}).name || 'Player';
    const v = await ask({ icon: 'fa-pen', title: 'Rename (only for you)', text: `Their real name stays "${real}". Leave empty to reset.`, input: (S.fr.nicks || {})[uid] || '', placeholder: real, yes: 'Save name' }); if (v === null) return;
    try { await api.post('/chat/friends/nick', { uid, nick: v }); S.th.name = v || real; $('ct-name').textContent = S.th.name; toast('Name saved'); syncNow(); } catch (e) { toast(errMsg(e)); }
}
export async function mReport() {
    closeMenu(); const th = S.th, uid = th.uid || '', n = th.kind === 'dm' ? friendName(uid) : th.name;
    const r = await ask({ icon: 'fa-flag', title: `Report ${n}?`, text: 'This sends a message to our support team. They will review the chat.', chips: ['Spam', 'Abuse / harassment', 'Cheating / hacks', 'Scam / fraud', 'Other'], area: 'Tell support what happened (optional)', yes: 'Send to support', danger: true }); if (!r) return;
    try {
        await api.post('/chat/report', { against: uid, chatId: th.id || 'world', kind: th.kind, reason: r.val + (r.extra ? ' — ' + r.extra : '') });
        toast('Report sent to support ✓');
    } catch (e) { toast(errMsg(e)); }
}
export async function mGroupInfo() {
    closeMenu(); const g = S.groups[S.th.id]; if (!g) return; await Promise.all(g.members.map(getProf));
    sheet(`<div class="cs-t">${esc(g.emoji || '👥')} ${esc(g.name)}</div><div class="cs-p">${g.members.length} members</div><div class="cs-list">${g.members.map(m => `<div class="cs-mem">${avatar(S.prof[m].name, S.prof[m].photo)}<b>${m === S.uid ? vName('You', m) : vName(friendName(m), m)}</b>${m === g.owner ? '<em>owner</em>' : ''}</div>`).join('')}</div>`);
}
export async function mLeave() {
    closeMenu(); const g = S.groups[S.th.id]; if (!g) return;
    const ok = await ask({ icon: 'fa-right-from-bracket', title: `Leave "${g.name}"?`, text: 'You will stop receiving messages from this group.', yes: 'Leave', danger: true }); if (!ok) return;
    try { await api.post('/chat/groups/' + encodeURIComponent(g.id) + '/leave'); closeThread(); toast('You left the group'); syncNow(); } catch (e) { toast(errMsg(e)); }
}
export async function createGroup() {
    if (!S.fr.list.length) return toast('Add some friends first');
    await Promise.all(S.fr.list.map(getProf));
    window._grpSel = new Set();
    sheet(`<div class="cs-t">New group</div><input class="cs-in" id="grp-name" maxlength="30" placeholder="Group name" autocomplete="off">
        <div class="cs-p" style="text-align:left;margin:10px 0 6px">Add friends</div>
        <div class="cs-list cs-pick">${S.fr.list.map(f => `<div class="cs-mem pick" id="gp-${f}" onclick="chat.grpPick('${f}')">${avatar(S.prof[f].name, S.prof[f].photo)}<b>${vName(friendName(f), f)}</b><i class="fa-regular fa-circle"></i></div>`).join('')}</div>
        <div class="cs-btns"><button class="cs-b no" onclick="chat.sheetClose()">Cancel</button><button class="cs-b yes" onclick="chat.grpMake()">Create</button></div>`);
}
export function grpPick(f) { const s = window._grpSel, el = $('gp-' + f); if (s.has(f)) { s.delete(f); el.classList.remove('on'); el.querySelector('i').className = 'fa-regular fa-circle'; } else { if (s.size >= 29) return; s.add(f); el.classList.add('on'); el.querySelector('i').className = 'fa-solid fa-circle-check'; } }
export async function grpMake() {
    const name = $('grp-name').value.trim(); if (name.length < 2) return toast('Enter a group name'); if (!window._grpSel.size) return toast('Pick at least one friend');
    try { const ref = await api.post('/chat/groups', { name, members: [...window._grpSel] });
        sheetClose(); toast('Group created 🎉'); syncNow(); setTimeout(() => window.chat.openThread('group', ref.id), 450); } catch (e) { toast(errMsg(e)); }
}

/* ---------- profile settings ---------- */
export async function setPrivacy(p) {
    try { await api.patch('/chat/profile', { isPrivate: !!p }); S.me.isPrivate = !!p; refresh(); } catch (e) { toast(errMsg(e)); }
}
export async function editBio() {
    const v = await ask({ icon: 'fa-pen', title: 'Your bio', input: S.me.bio || '', max: 80, placeholder: 'Say something about you', yes: 'Save' }); if (v === null) return;
    try { await api.patch('/chat/profile', { bio: v }); S.me.bio = v; refresh(); } catch (e) { toast(errMsg(e)); }
}
export async function unblock(uid) { const ok = await ask({ icon: 'fa-lock-open', title: 'Unblock this user?', yes: 'Unblock' }); if (!ok) return; try { await api.post('/chat/block', { uid, block: false }); toast('Unblocked'); syncNow(); } catch (e) { toast(errMsg(e)); } }
export async function searchUsers(q) {
    q = String(q || '').toLowerCase().trim().replace(/^@/, ''); if (q.length < 2) return [];
    const r = await api.get('/chat/search', { q });
    return (r.users || []).filter(p => p.uid !== S.uid && (!p.isPrivate || p.username === q));
}
