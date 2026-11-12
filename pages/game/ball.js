/**
 * Coin Battle + Bomb & Gems — app side. The game UIs are pages/game/coin.html and bomb.html (full-screen iframes); the SERVER
 * (Server-3 through the load balancer: /game/ball/* and /game/bomb/*) runs all rules & money. This file only gives those pages what they need
 * (session, wallet balance, live game updates by polling, deposit / close buttons) through window.ballBridge / window.bombBridge.
 */
import { authService } from '../../js/core/firebase.js?v=41f223a8d8';
import { api as lb } from '../../js/core/api.js?v=41f223a8d8';

const $ = (id) => document.getElementById(id);
let skew = 0;
const uid = () => authService.currentUser && authService.currentUser.uid;
const balance = () => Number((window.db && window.db.balance) || 0);
const toast = (m) => { try { window.ui.toast(m); } catch (e) {} };

// game = 'ball' (Coin Battle) | 'bomb' (Bomb & Gems).  path = find / poll / move / open / tick / leave / game / config / cancel
const mkApi = (game) => async (path, body, ms = 75000) => {
    if (!authService.currentUser) throw new Error('Please log in first');
    const j = await lb.post('/game/' + game + '/' + path, body || {}, { timeout: ms });
    if (j.now) skew = j.now - Date.now();
    return j;
};
// live updates by polling (replaces the old Firestore listener): calls cb(game) about once a second, returns "stop"
const mkWatch = (game) => (gid, cb, err) => {
    let stop = false, t = null, bad = 0;
    const run = async () => {
        if (stop) return;
        try { const r = await lb.post('/game/' + game + '/game', { gid }, { timeout: 15000 }); if (r.now) skew = r.now - Date.now(); if (r.game) cb({ id: gid, ...r.game }); bad = 0; }
        catch (e) { if (++bad >= 4 && err) { err(e); stop = true; return; } }
        t = setTimeout(run, 1100);
    };
    t = setTimeout(run, 400);
    return () => { stop = true; clearTimeout(t); };
};
const api = mkApi('ball');
const myInfo = () => { const d = window.db || {}; const name = d.appName || d.userName || (authService.currentUser && authService.currentUser.displayName) || 'Player'; return { name, photo: d.photoUrl || (authService.currentUser && authService.currentUser.photoURL) || '' }; };

function close() {
    const f = $('ball-frame'); if (f) f.src = 'about:blank';
    $('ball').classList.remove('on'); $('ball').setAttribute('aria-hidden', 'true'); document.body.classList.remove('ball-open');
}

// everything the game page may call
window.ballBridge = {
    api, now: () => Date.now() + skew, balance, me: myInfo, uid,
    avatar: (n) => window.gameArt.avatar(n),
    vname: (n, uid) => (window.vfy ? window.vfy.name(n, uid) : String(n)),
    watch: mkWatch('ball'),
    sfx: (n) => { try { window.sfx && window.sfx.play(n); } catch (e) {} },
    confirm: (o) => (window.ui && window.ui.confirm ? window.ui.confirm(o) : Promise.resolve(confirm(o.title + '\n' + (o.text || '')))),
    deposit: () => { close(); try { window.ui.openModal('modal-deposit'); } catch (e) {} },
    close,
};

// Admin can switch each game ON/OFF (Admin panel -> Coin Battle / Bomb & Gems). The switch is kept by Server-3 (server /game/flags, cached 60s).
const FL = { t: 0, v: { ball: true, bomb: true } };
async function loadFlags(force) {
    if (!force && Date.now() - FL.t < 60000) return FL.v; FL.t = Date.now();
    try { if (authService.currentUser) { const r = await lb.post('/game/flags', {}, { timeout: 8000 }); FL.v = { ball: r.ball !== false, bomb: r.bomb !== false }; } } catch (e) {}
    return FL.v;
}
const CARD_BALL = `<button type="button" class="gc" onclick="ballGame.open()"><img src="assets/img/game/cf/coin-gold.png" alt="Coin Battle" draggable="false"><div><b>Coin Battle</b><span>Connect 4 coins in a row and win cash</span><em>Entry from ₹2 · Win up to 1.8×</em></div><i class="fa-solid fa-play"></i></button>`;
const CARD_BOMB = `<button type="button" class="gc gc-bomb" onclick="bombGame.open()"><img src="assets/img/game/bomb/icon.png" alt="Bomb &amp; Gems" draggable="false" width="84" height="84"><div><b>Bomb &amp; Gems</b><span>Find gems, dodge hidden bombs, win cash</span><em>Entry from ₹2 · Win up to 1.8×</em></div><i class="fa-solid fa-play"></i></button>`;
const mkCard = () => {
    const f = FL.v, parts = (f.ball ? CARD_BALL : '') + (f.bomb ? CARD_BOMB : '');
    return parts ? `<div class="gc-list">${parts}</div>` : `<div class="gm-off"><i class="fa-solid fa-gamepad"></i><b>Games are taking a break</b><span>They will be back here soon.</span></div>`;
};

window.ballGame = {
    card: mkCard,
    flags: loadFlags,
    open() {
        if (!FL.v.ball) { toast('Coin Battle is switched off right now'); return; }
        if (!authService.currentUser) { try { window.app.checkLogin(() => window.ballGame.open()); } catch (e) { toast('Please log in'); } return; }
        $('ball-frame').src = 'pages/game/coin.html?v=' + Date.now();
        $('ball').classList.add('on'); $('ball').setAttribute('aria-hidden', 'false'); document.body.classList.add('ball-open');
    },
    close,
};

// ---------------- Bomb & Gems (pages/game/bomb.html, server: /game/bomb/*) ----------------
function closeBomb() {
    const f = $('bomb-frame'); if (f) f.src = 'about:blank';
    $('bomb').classList.remove('on'); $('bomb').setAttribute('aria-hidden', 'true'); document.body.classList.remove('ball-open');
}
window.bombBridge = Object.assign({}, window.ballBridge, {
    api: mkApi('bomb'),
    vname: (n, uid) => (window.vfy ? window.vfy.name(n, uid) : String(n)),
    watch: mkWatch('bomb'),
    deposit: () => { closeBomb(); try { window.ui.openModal('modal-deposit'); } catch (e) {} },
    close: closeBomb,
});
window.bombGame = {
    open() {
        if (!FL.v.bomb) { toast('Bomb & Gems is switched off right now'); return; }
        if (!authService.currentUser) { try { window.app.checkLogin(() => window.bombGame.open()); } catch (e) { toast('Please log in'); } return; }
        $('bomb-frame').src = 'pages/game/bomb.html?v=' + Date.now();
        $('bomb').classList.add('on'); $('bomb').setAttribute('aria-hidden', 'false'); document.body.classList.add('ball-open');
    },
    close: closeBomb,
};
