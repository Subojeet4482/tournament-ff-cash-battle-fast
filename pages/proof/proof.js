/**
 * PROOFS FEED — standalone page (/proof), no app header / bottom bar.
 *  - Proofs live in a SEPARATE Firebase project (database1-ccd73) -> js/core/proofs-firebase.js, rules: proofs-project.rules
 *      proofs_feed/{uid_trxId}  ·  likes/{uid}  ·  comments/{id}
 *  - The game database is reached ONLY through the load balancer API (js/core/api.js); the logged-in player comes from Firebase Auth.
 *  - Original transaction gets { isShared:true, proofId } (main db) so one transaction can be shared only once.
 *  - Open from the app with  /proof?share=<transactionId>  (share or edit that transaction's proof).
 *  - Public view without login. Login is needed only for Like / Comment / Share.
 */
import { authService, onAuthStateChanged } from '../../js/core/firebase.js?v=684982f88b';
import { api } from '../../js/core/api.js?v=684982f88b';
import { pdb, ensureAnon, collection, doc, getDoc, getDocs, query, orderBy, limit, where, writeBatch, increment } from '../../js/core/proofs-firebase.js?v=684982f88b';
import '../../js/core/messages.js?v=684982f88b';
import '../../js/core/verified.js?v=684982f88b';
import '../../js/core/badwords.js?v=684982f88b';

const PAGE = 30;
const S = { f: 'today', n: PAGE, items: [], liked: new Set(), trx: null, editing: null, busy: false, cur: null, user: null, name: 'Player' };
const $ = (i) => document.getElementById(i);
const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const green = (t) => esc(t).replace(/\((.*?)\)/g, '<span class="prf-g">$1</span>');
const me = () => (S.user ? S.user.uid : '');
const vname = (n, uid) => (window.vfy ? window.vfy.name(n, uid) : esc(n));
let tt = null;
const toast = (m) => { const t = $('prf-toast'); t.textContent = m; t.classList.add('show'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('show'), 2800); };
window.ui = { toast };                                   // badwords.js shows its "word block hai" message through this
const ago = (ms) => { const s = Math.max(1, Math.floor((Date.now() - ms) / 1000)); if (s < 60) return 'just now'; const m = Math.floor(s / 60); if (m < 60) return m + ' min ago'; const h = Math.floor(m / 60); if (h < 24) return h + ' hr ago'; const d = Math.floor(h / 24); return d < 30 ? d + ' day' + (d > 1 ? 's' : '') + ' ago' : new Date(ms).toLocaleDateString(); };
const col = () => collection(pdb, 'proofs_feed');
const openM = (id) => $(id).classList.add('active');
const closeAll = () => document.querySelectorAll('.modal-wrap.active').forEach(m => m.classList.remove('active'));
function requireLogin() { if (S.user) return true; toast('Pehle app me login karo'); setTimeout(() => { location.href = '/'; }, 1100); return false; }

// ---------- why did it fail (shown to the admin/owner so setup problems are obvious) ----------
function why(e) {
    const c = String((e && e.code) || ''), m = String((e && e.message) || e || '');
    if (c === 'permission-denied') return 'Rules: naye Firebase project (database1-ccd73) me proofs-project.rules Publish nahi hui [permission-denied]';
    if (c === 'auth/admin-restricted-operation' || c === 'auth/operation-not-allowed') return 'Authentication → Sign-in method → Anonymous ko Enable karo [' + c + ']';
    if (c === 'auth/unauthorized-domain') return 'Authentication → Settings → Authorized domains me apni site add karo [' + c + ']';
    if (c === 'failed-precondition' || c === 'not-found') return 'Firestore Database create nahi hui (database1-ccd73 → Firestore Database → Create database) [' + c + ']';
    if (c === 'unavailable' || /network|offline/i.test(m)) return 'Internet / Firebase connect nahi ho raha [' + (c || 'network') + ']';
    return (c || m).slice(0, 90);
}

// ---------- transaction helpers (same rules as the app) ----------
const orderOf = (t) => {
    if (t.orderNo) return t.orderNo;
    const title = String(t.title || ''), type = String(t.type || ''), k = t.kind;
    let p = type === 'withdraw' ? 'WD' : 'DP';
    if (k === 'admin_add' || /^(System .* add|Admin credit|🎁)/i.test(title)) p = 'AD';
    else if (k === 'admin_cut' || /^(System .* cut|Admin deduct)/i.test(title)) p = 'AC';
    else if (k === 'prize' || /^Match win/i.test(title)) p = 'PZ';
    else if (k === 'refund' || type === 'refund') p = 'RF';
    else if (k === 'gift') p = 'GF';
    else if (type === 'game') p = 'GM';
    const ms = t.createdAt || t._ms || Date.now(), d = new Date(ms);
    const ymd = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
    return `${p}-${ymd}-${String(t._id || 'XXXXXX').slice(-(p === 'DP' || p === 'WD' ? 4 : 6)).toUpperCase()}`;
};
function describeTrx(t) {
    const D = window.msg.describe(t), type = String(t.type || '').toLowerCase(), kind = String(t.kind || ''), title = String(t.title || '');
    let label = D.label, tone = 'success';
    if (D.status === 'failed' || D.status === 'rejected' || D.status === 'cancelled') { tone = 'fail'; label = 'Failed'; }
    else if (D.status === 'refunded' || kind === 'refund' || type === 'refund') { tone = 'refund'; label = 'Refund'; }
    else if (type === 'withdraw') label = 'Withdrawal Paid';
    else if (type === 'deposit') label = 'Deposit Success';
    else if (kind === 'prize' || /^Match win/i.test(title)) label = 'Match Win';
    return { label, tone, status: D.status };
}
function eligible(t) {
    const D = window.msg.describe(t), type = String(t.type || '').toLowerCase(), kind = String(t.kind || '');
    if (D.status === 'pending' || D.status === 'processing') return false;
    if (type === 'game' && kind !== 'game_win' && kind !== 'prize' && !/^Match win/i.test(String(t.title || ''))) return false;
    return true;
}
const amountOf = (t) => { const r = String(t.amount == null ? '' : t.amount).trim().replace(/^[-+−]\s*/, ''); return r.includes('₹') ? r.replace(/^[-+]/, '') : '₹' + r; };
/** show only the first half of an id, hide the rest:  412345678901 -> 412345••••••   ABCD-EFGH-IJKL -> ABCD-EF••-••••  */
function half(v) {
    v = String(v || '').trim(); const n = v.replace(/[^A-Za-z0-9]/g, '').length; if (!n) return '';
    const show = Math.ceil(n / 2); let k = 0;
    return v.split('').map(ch => /[A-Za-z0-9]/.test(ch) ? (k++ < show ? ch : '•') : ch).join('');
}
const METHODS = { GIFTCARD: 'Google Play Gift Card', UPI: 'UPI', BANK: 'Bank transfer', CRYPTO: 'Crypto' };
/** which payment + which id (half only): gift card -> half of the gift code, UPI/bank -> half of the UTR */
function payInfo(t) {
    const m = String(t.method || '').toUpperCase(), type = String(t.type || '').toLowerCase();
    let refLabel = '', refMask = '';
    if (m === 'GIFTCARD' && t.giftCode) { refLabel = 'Gift card code'; refMask = half(t.giftCode); }
    else if (t.trxId) { refLabel = m === 'CRYPTO' ? 'Txn hash' : 'UTR'; refMask = half(t.trxId); }
    const via = METHODS[m] || (type === 'withdraw' || type === 'deposit' ? '' : '');
    return { via, refLabel, refMask };
}

// ---------- cards ----------
const SEAL = { success: 'SUCCESS', refund: 'REFUNDED', fail: 'FAILED' };
const viaIcon = (via) => via === 'Google Play Gift Card' ? '<img src="assets/img/wallet/google-play.svg" alt="">' : via === 'UPI' ? '<img src="assets/img/wallet/upi.svg" alt="">' : via === 'Bank transfer' ? '<i class="fa-solid fa-building-columns"></i>' : via === 'Crypto' ? '<i class="fa-brands fa-bitcoin"></i>' : '<i class="fa-solid fa-receipt"></i>';
/** the receipt "ticket" — used in the feed and in the screenshot window */
function ticketHtml(p, brand) {
    const seal = /Paid/i.test(p.kind) ? 'PAID' : (SEAL[p.tone] || 'SUCCESS');
    const rows = [];
    if (brand) rows.push(['Player', vname(p.name, p.uid)]);   // in the feed the name is already above the ticket
    if (p.via) rows.push(['Method', esc(p.via)]);
    if (p.refMask) rows.push([esc(p.refLabel || 'ID'), `<code>${esc(p.refMask)}</code>`]);
    if (p.orderNo) rows.push(['Order', esc(p.orderNo)]);
    if (p.trxDate) rows.push(['Date', esc(p.trxDate)]);
    return `<div class="prf-t tone-${esc(p.tone)}">
        ${brand ? `<div class="prf-t-brand"><img src="assets/img/ff-coin.png" alt="" crossorigin="anonymous"><b>FF Cash Battle</b><span>ffcashbattle.in</span></div>` : ''}
        <div class="prf-t-main">
            <div class="prf-t-ic">${viaIcon(p.via)}</div>
            <div class="prf-t-amtbox"><small>${esc(p.kind)}</small><div class="prf-t-amt">${esc(p.amount)}</div></div>
            <div class="prf-t-seal"><i class="fa-solid ${p.tone === 'fail' ? 'fa-xmark' : 'fa-check'}"></i>${seal}</div>
        </div>
        ${p.text ? `<div class="prf-t-quote">${green(p.text)}</div>` : '<div class="prf-t-quote prf-t-ph">Your message shows here…</div>'}
        <div class="prf-t-cut"><i></i><span></span><i></i></div>
        <div class="prf-t-rows">${rows.map(r => `<div><span>${r[0]}</span><b>${r[1]}</b></div>`).join('')}</div>
        <div class="prf-t-foot"><i class="fa-solid fa-shield-check"></i> Real payment proof · FF Cash Battle</div></div>`;
}
const shotHtml = (p) => ticketHtml(p, true);
function cardHtml(p) {
    const mine = !!me() && p.uid === me(), liked = S.liked.has(p.id), id = esc(p.id);
    return `<article class="prf-card tone-${esc(p.tone)}" id="prf-${id}">
        <div class="prf-h"><div class="prf-av">${esc((p.name || 'P').trim().charAt(0).toUpperCase())}</div>
            <div class="prf-who"><b>${vname(p.name, p.uid)}</b><small>${ago(p.createdAt)}${p.editedAt ? ' · edited' : ''}</small></div></div>
        ${ticketHtml(p, false)}
        <div class="prf-f">
            <button type="button" class="prf-like${liked ? ' on' : ''}" onclick="proof.like('${id}',this)"><img src="assets/img/proof/${liked ? 'like-on' : 'like-off'}.png" alt="" draggable="false"><em>Thanks!</em></button>
            <button type="button" class="prf-cnt" onclick="proof.likers('${id}')"><b id="prfl-${id}">${p.likeCount || 0}</b> Likes</button>
            <button type="button" class="prf-cm" onclick="proof.comments('${id}')"><img src="assets/img/proof/comment.png" alt="" draggable="false"> <b id="prfc-${id}">${p.commentCount || 0}</b></button>
            ${mine ? `<button type="button" class="prf-own" onclick="proof.edit('${id}')" title="Edit"><i class="fa-solid fa-pen"></i></button><button type="button" class="prf-own" onclick="proof.remove('${id}')" title="Delete"><i class="fa-solid fa-trash"></i></button>` : ''}
        </div></article>`;
}
const paintList = () => { const box = $('prf-list'); box.innerHTML = S.items.length ? S.items.map(cardHtml).join('') : '<div class="prf-empty">Abhi koi proof nahi. App me kisi transaction par "Share as Proof" dabao!</div>'; };

// ---------- feed ----------
const rangeStart = (f) => { const d = new Date(); if (f === 'today') { d.setHours(0, 0, 0, 0); return d.getTime(); } return Date.now() - (f === 'week' ? 7 : 30) * 864e5; };
async function fetchList() {
    const run = async (q) => (await getDocs(q)).docs.map(d => ({ id: d.id, ...d.data() }));
    if (S.f === 'top') return { list: await run(query(col(), orderBy('likeCount', 'desc'), limit(S.n))), fallback: false };
    const list = await run(query(col(), where('createdAt', '>=', rangeStart(S.f)), orderBy('createdAt', 'desc'), limit(S.n)));
    if (list.length) return { list, fallback: false };
    return { list: await run(query(col(), orderBy('createdAt', 'desc'), limit(S.n))), fallback: true };   // empty period -> older proofs (never an empty screen)
}
async function load() {
    const box = $('prf-list');
    if (!S.items.length) box.innerHTML = '<div class="prf-empty"><i class="fa-solid fa-spinner fa-spin"></i></div>';
    try {
        const { list, fallback } = await fetchList();
        S.items = list;
        if (me()) {
            const res = await Promise.all(list.map(p => getDoc(doc(pdb, 'proofs_feed', p.id, 'likes', me())).then(s => s.exists() ? p.id : null).catch(() => null)));
            S.liked = new Set(res.filter(Boolean));
        } else S.liked = new Set();
        const note = $('prf-note'), names = { today: 'Aaj', week: 'Is hafte', month: 'Is mahine' };
        note.style.display = fallback ? 'block' : 'none';
        note.textContent = fallback ? `${names[S.f]} ka koi proof nahi — purane proofs dikha rahe hain` : '';
        paintList();
        $('prf-more').style.display = list.length >= S.n ? 'block' : 'none';
    } catch (e) { box.innerHTML = '<div class="prf-empty">Proofs load nahi hue<br><small class="prf-why">' + esc(why(e)) + '</small></div>'; console.error(e); }
}

// ---------- studio (share + edit) ----------
function studioPaint() {
    const t = S.trx, e = S.editing, text = $('prf-text').value;
    const base = e ? e : { uid: me(), name: S.name, kind: describeTrx(t).label, tone: describeTrx(t).tone, amount: amountOf(t), orderNo: orderOf(t), trxDate: t.date || '', ...payInfo(t) };
    $('prf-shot').innerHTML = shotHtml({ ...base, text });
    $('prf-count').textContent = text.length + '/200';
}
function openStudio(t, existing) {
    S.trx = t; S.editing = existing || null;
    $('prf-text').value = existing ? existing.text || '' : '';
    $('prf-post').innerHTML = existing ? '<i class="fa-solid fa-floppy-disk"></i> Save changes' : '<i class="fa-solid fa-paper-plane"></i> Post proof';
    studioPaint(); openM('modal-proof-studio');
}
async function handleShare(trxId) {
    if (!requireLogin()) return;
    try {
        let t;
        try { t = (await api.post('/wallet/proof/trx', { id: trxId })).trx; } catch (e) { if (e && e.status === 404) return toast('Transaction nahi mili'); throw e; }
        if (!eligible(t)) return toast('Pending transaction ka proof nahi ban sakta');
        let ex = null;
        try { const p = await getDoc(doc(pdb, 'proofs_feed', me() + '_' + t._id)); if (p.exists()) ex = { id: p.id, ...p.data() }; } catch (e) {}
        openStudio(t, ex);
    } catch (e) { console.error(e); toast('Transaction load nahi hui'); }
}

window.proof = {
    back() { try { if (history.length > 1 && document.referrer && new URL(document.referrer).origin === location.origin) return history.back(); } catch (e) {} location.href = '/'; },
    closeM() { closeAll(); if (/[?&]share=/.test(location.search)) history.replaceState(null, '', '/proof'); },
    setFilter(f) {
        S.f = f; S.n = PAGE; S.items = [];
        const tabs = $('prf-tabs'); tabs.dataset.active = f;
        tabs.querySelectorAll('.prf-tab').forEach(b => b.classList.toggle('on', b.dataset.f === f));
        load();
    },
    more() { S.n += PAGE; load(); },
    preview: studioPaint,

    async submit() {
        if (S.busy) return; const text = $('prf-text').value.trim();
        try { await window.badwords.ready(); } catch (e) {}
        if (window.badwords.blocked(text)) return;
        S.busy = true; const btn = $('prf-post'); btn.disabled = true;
        try {
            const uid = me(), owner = await ensureAnon();
            if (S.editing) {
                const b = writeBatch(pdb); b.update(doc(pdb, 'proofs_feed', S.editing.id), { text, editedAt: Date.now() }); await b.commit();
                toast('Proof updated ✓');
            } else {
                const t = S.trx, id = uid + '_' + t._id, d = describeTrx(t), b = writeBatch(pdb);
                b.set(doc(pdb, 'proofs_feed', id), { trxId: t._id, uid, name: S.name, kind: d.label, tone: d.tone, status: d.status, amount: amountOf(t), orderNo: orderOf(t), trxDate: String(t.date || ''), ...payInfo(t), text, createdAt: Date.now(), likeCount: 0, commentCount: 0, owner });
                await b.commit();
                try { await api.post('/wallet/proof/flag', { id: t._id, shared: true }); } catch (e) { console.warn('flag', e); }
                toast('Proof posted ✓');
            }
            closeAll(); history.replaceState(null, '', '/proof'); S.f = 'today'; S.n = PAGE; S.items = []; window.proof.setFilter('today');
        } catch (e) { console.error(e); toast(e.code === 'permission-denied' && !S.editing ? 'Ye proof pehle se share ho chuka hai, ya Firebase rules publish nahi hui' : 'Post nahi hua: ' + why(e)); }
        S.busy = false; btn.disabled = false;
    },
    edit(id) { const p = S.items.find(x => x.id === id); if (p) openStudio(null, p); },
    async remove(id) {
        const p = S.items.find(x => x.id === id); if (!p || !confirm('Ye proof delete kare?')) return;
        try {
            await ensureAnon(); const b = writeBatch(pdb); b.delete(doc(pdb, 'proofs_feed', id)); await b.commit();
            try { if (p.trxId) await api.post('/wallet/proof/flag', { id: p.trxId, shared: false }); } catch (e) {}
            S.items = S.items.filter(x => x.id !== id); const el = $('prf-' + id); if (el) el.remove(); toast('Deleted');
        } catch (e) { toast('Delete nahi hua (jis device se post kiya wahi se delete hota hai)'); }
    },
    async saveImage() {
        try {
            if (!window.html2canvas) await new Promise((ok, no) => { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'; s.onload = ok; s.onerror = no; document.head.appendChild(s); });
            const c = await window.html2canvas($('prf-shot'), { scale: 3, backgroundColor: null, useCORS: true });
            const a = document.createElement('a'); a.download = 'ffcashbattle-proof.png'; a.href = c.toDataURL('image/png'); a.click();
        } catch (e) { toast('Image save nahi hui — screenshot le lo'); }
    },

    async like(id, btn) {
        if (!requireLogin() || btn.dataset.busy) return; btn.dataset.busy = '1';
        const uid = me(), on = !S.liked.has(id), cnt = $('prfl-' + id), n0 = parseInt(cnt.textContent) || 0, p = S.items.find(x => x.id === id);
        try {
            const by = await ensureAnon(), b = writeBatch(pdb), lref = doc(pdb, 'proofs_feed', id, 'likes', uid);
            if (on) b.set(lref, { name: S.name, at: Date.now(), by, uid }); else b.delete(lref);
            b.update(doc(pdb, 'proofs_feed', id), { likeCount: increment(on ? 1 : -1) });
            await b.commit();
            on ? S.liked.add(id) : S.liked.delete(id); const n1 = Math.max(0, n0 + (on ? 1 : -1)); if (p) p.likeCount = n1; cnt.textContent = n1;
            const img = btn.querySelector('img');
            if (on) { btn.classList.add('thx'); setTimeout(() => { btn.classList.remove('thx'); btn.classList.add('on'); img.src = 'assets/img/proof/like-on.png'; }, 1000); }   // flip -> "Thanks!" 1s -> active like
            else { btn.classList.remove('on', 'thx'); img.src = 'assets/img/proof/like-off.png'; }
        } catch (e) { console.error(e); toast('Like nahi hua: ' + why(e)); }
        delete btn.dataset.busy;
    },
    async likers(id) {
        openM('modal-proof-likes'); const box = $('prf-likers'); box.innerHTML = '<div class="prf-empty"><i class="fa-solid fa-spinner fa-spin"></i></div>';
        try {
            const s = await getDocs(query(collection(pdb, 'proofs_feed', id, 'likes'), orderBy('at', 'desc'), limit(100)));
            box.innerHTML = s.empty ? '<div class="prf-empty">Abhi kisi ne like nahi kiya</div>' : s.docs.map(d => `<div class="prf-liker"><div class="prf-av sm">${esc((d.data().name || 'P').charAt(0).toUpperCase())}</div><span>${vname(d.data().name || 'Player', d.id)}</span></div>`).join('');
        } catch (e) { box.innerHTML = '<div class="prf-empty">Load nahi hua</div>'; }
    },

    async comments(id) { S.cur = id; openM('modal-proof-comments'); $('prf-cinput').value = ''; await paintComments(); },
    async sendComment() {
        if (!requireLogin()) return;
        const inp = $('prf-cinput'), text = inp.value.trim(), id = S.cur; if (!text || !id || S.busy) return;
        try { await window.badwords.ready(); } catch (e) {}
        if (window.badwords.blocked(text)) return;
        S.busy = true;
        try {
            const owner = await ensureAnon(), b = writeBatch(pdb), cref = doc(collection(pdb, 'proofs_feed', id, 'comments'));
            b.set(cref, { uid: me(), name: S.name, text, at: Date.now(), owner });
            b.update(doc(pdb, 'proofs_feed', id), { commentCount: increment(1) });
            await b.commit(); inp.value = '';
            const c = $('prfc-' + id); if (c) c.textContent = (parseInt(c.textContent) || 0) + 1;
            await paintComments();
        } catch (e) { console.error(e); toast('Comment nahi hua: ' + why(e)); }
        S.busy = false;
    },
    async delComment(cid) {
        const id = S.cur; if (!confirm('Comment delete kare?')) return;
        try {
            await ensureAnon(); const b = writeBatch(pdb); b.delete(doc(pdb, 'proofs_feed', id, 'comments', cid)); b.update(doc(pdb, 'proofs_feed', id), { commentCount: increment(-1) }); await b.commit();
            const c = $('prfc-' + id); if (c) c.textContent = Math.max(0, (parseInt(c.textContent) || 0) - 1); await paintComments();
        } catch (e) { toast('Delete nahi hua'); }
    }
};
async function paintComments() {
    const box = $('prf-comments'), id = S.cur; box.innerHTML = '<div class="prf-empty"><i class="fa-solid fa-spinner fa-spin"></i></div>';
    try {
        const s = await getDocs(query(collection(pdb, 'proofs_feed', id, 'comments'), orderBy('at', 'desc'), limit(60)));
        box.innerHTML = s.empty ? '<div class="prf-empty">Pehla comment tum karo 👇</div>' : s.docs.map(d => { const c = d.data(); return `<div class="prf-c"><div class="prf-av sm">${esc((c.name || 'P').charAt(0).toUpperCase())}</div><div class="prf-cb"><b>${vname(c.name || 'Player', c.uid)}</b> <small>${ago(c.at)}</small><p>${esc(c.text)}</p></div>${me() && c.uid === me() ? `<button type="button" class="prf-cdel" onclick="proof.delComment('${d.id}')"><i class="fa-solid fa-trash"></i></button>` : ''}</div>`; }).join('');
    } catch (e) { box.innerHTML = '<div class="prf-empty">Load nahi hua</div>'; }
}

// ---------- start ----------
document.addEventListener('verified-changed', () => { if (S.items.length) paintList(); });
(async function init() {
    if (document.body && localStorage.getItem('darkMode') === 'true') document.body.classList.add('dark');
    const user = await new Promise(r => { const un = onAuthStateChanged(authService, u => { un(); r(u); }); });
    S.user = user;
    if (user) {
        S.name = user.displayName || 'Player';
        try { const d = (await api.get('/user/me')).user || {}; S.name = (d.appName || d.gameName || d.name || user.displayName || 'Player').slice(0, 40); } catch (e) {}
        try { window.vfy.start(); window.badwords.start(); } catch (e) {}
    } else $('prf-login').classList.remove('hidden');
    load();
    const sh = new URLSearchParams(location.search).get('share');
    if (sh) handleShare(sh);
})();
