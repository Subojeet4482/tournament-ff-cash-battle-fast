/**
 * Gift code redeem.
 *  - code = exactly 24 characters (any letters / digits / symbols)
 *  - one account can use a code only once (redeems/{uid} is create-only), 5 wrong tries => locked 24h
 *  - the amount comes from the code's pre-shuffled pool (fixed or random) — it is enforced by the SERVER (POST /wallet/gift/redeem)
 */
import { api } from '../../js/core/api.js?v=fe39312af5';

const $ = (id) => document.getElementById(id);
const MAXTRY = 5, LOCK_MS = 24 * 3600 * 1000;
let busy = false;

const leftStr = (ms) => { const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000); return (h ? h + 'h ' : '') + m + 'm'; };

const paintTries = (fails, locked) => {
    const el = $('gift-tries'); if (!el) return;
    el.innerHTML = Array.from({ length: MAXTRY }, (_, i) => `<i class="${i < fails ? 'x' : ''}"></i>`).join('') + `<span style="margin-left:4px">${locked ? 'locked' : (MAXTRY - fails) + ' tries left'}</span>`;
};
const say = (t, cls) => { const m = $('gift-msg'); m.className = 'gift-msg ' + (cls || ''); m.textContent = t || ''; };
const loadTries = async () => {
    try { const d = await api.get('/wallet/gift/tries'); return { fails: d.fails || 0, resetAt: d.resetAt || 0 }; }
    catch (e) { return { fails: 0, resetAt: 0 }; }
};

Object.assign(window.app, {
    openGift: async () => {
        window.ui.openModal('modal-gift');
        $('gift-input').value = ''; window.app.giftInput($('gift-input')); say('');
        $('gift-hero').classList.remove('win');
        const t = await loadTries();
        const locked = t.fails >= MAXTRY && t.resetAt > Date.now();
        paintTries(t.fails, locked);
        if (locked) { say('Too many wrong tries. Try again in ' + leftStr(t.resetAt - Date.now()), 'err'); }
        setTimeout(() => { try { $('gift-input').focus(); } catch (e) {} }, 350);
    },
    giftInput: (el) => {
        const n = el.value.length;
        $('gift-count').textContent = n + ' / 24';
        $('gift-bar').style.width = (n / 24 * 100) + '%';
        $('gift-btn').disabled = n !== 24;
        $('gift-field').classList.toggle('ok', n === 24); $('gift-field').classList.remove('bad');
        if (n !== 24) say('');
    },
    giftPaste: async () => {
        try { const t = (await navigator.clipboard.readText()).trim().slice(0, 24); $('gift-input').value = t; window.app.giftInput($('gift-input')); } catch (e) { window.ui.toast('Long-press the box to paste'); }
    },
    redeemGift: async () => {
        if (busy) return;
        const code = $('gift-input').value;
        if (code.length !== 24) return;
        if (!window.db.user_uid) return window.ui.toast('Please login first');
        busy = true; const btn = $('gift-btn'); btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Checking…'; say('');
        const uid = window.db.user_uid;
        try {
            const t = await loadTries();
            if (t.fails >= MAXTRY && t.resetAt > Date.now()) { paintTries(t.fails, true); say('Too many wrong tries. Try again in ' + leftStr(t.resetAt - Date.now()), 'err'); return; }
            let res;
            try {
                res = await api.post('/wallet/gift/redeem', { code });          // the server checks the code, the 5-tries lock and adds the money atomically
            } catch (e) {
                if (window.app.geoBlocked(e)) return;
                const kinds = ['invalid', 'expired', 'full', 'already'];
                if (e.code === 'locked') {
                    paintTries(MAXTRY, true);
                    say('Too many wrong tries. Try again in ' + leftStr((e.data.resetAt || Date.now()) - Date.now()), 'err');
                    return;
                }
                if (kinds.includes(e.code)) {
                    const fails = MAXTRY - (e.data.triesLeft != null ? e.data.triesLeft : MAXTRY - 1);
                    $('gift-field').classList.add('bad'); setTimeout(() => $('gift-field').classList.remove('bad'), 600);
                    paintTries(fails, fails >= MAXTRY);
                    say(fails >= MAXTRY ? 'Too many wrong tries. Locked for 24 hours.' : e.message + ' ' + (MAXTRY - fails) + ' tries left.', 'err');
                    return;
                }
                throw e;
            }
            if (res.scratch) {       // scratch-type code: the server already issued the card (res.card)
                $('gift-hero').classList.add('win'); say('🎉 You won a Scratch Card!', 'ok');
                setTimeout(() => { window.ui.closeModal(); if (res.card && window.refer) setTimeout(() => window.refer.openFromNotif(res.card), 350); else window.ui.toast('Your scratch card will appear in Refer & Earn'); }, 700);
                return;
            }
            // success
            $('gift-hero').classList.add('win'); say('🎉 ₹' + res.amount + ' added!', 'ok');
            try { await window.app.fetchUserData(); await window.app.fetchTransactions(); } catch (_) {}
            const total = (window.db.balance || 0);
            setTimeout(() => { window.ui.closeModal(); window.walletfx.deposit(res.amount, total, { title: 'Gift Code Redeemed 🎁', sub: 'Adding your gift to the wallet…' }); }, 700);
        } catch (e) {
            say('Could not redeem: ' + (e && e.message ? e.message : 'try again'), 'err');
        } finally { busy = false; btn.innerHTML = '<i class="fa-solid fa-gift"></i> Redeem'; btn.disabled = $('gift-input').value.length !== 24; }
    }
});
