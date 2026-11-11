/**
 * FAQ everywhere — nothing is shown until the user taps a small "FAQ" chip.
 *   window.faq.open('wallet')            open the FAQ sheet for a page / popup
 *   window.faq.register('refer', fn)     add / replace a topic (fn returns [[question, answerHtml], ...])
 * Chips are added automatically: one small floating chip above the bottom bar (per page) and one in the
 * header row of the Add Money / Withdraw / Transfer / Join popups. No extra Firestore reads.
 */
const T = {
    home: ['Matches & joining', [
        ['How do I join a match?', 'Open a match card and tap <b>JOIN NOW</b>, pick your slot and confirm. The entry fee is taken from your wallet.'],
        ['Where do I get the Room ID & Password?', 'After you join, the Room ID & Password appear in <b>My Matches</b> shortly before the match starts. You also get a notification.'],
        ['Why does a match say FULL or MATCH STARTED?', 'FULL means all slots are taken. When a match has started or is locked, new players cannot join — pick the next match.'],
        ['Where can I see finished matches?', 'On Home switch the toggle to <b>Completed</b> to see the latest results. Your own results are in <b>My Matches → History</b>.'],
    ]],
    matches: ['My Matches', [
        ['Where is my Room ID?', 'Your joined matches are listed here. Room ID & Password show on the card once the admin adds them — tap to copy.'],
        ['When do I get my prize?', 'When the match is completed the prize is added to your wallet automatically and shows in <b>History</b> and Wallet history.'],
        ['Can I leave a match after joining?', 'Please check the match rules on the card. If you cannot play, contact support from the menu before the match starts.'],
    ]],
    leaderboard: ['Leaderboard', [
        ['How is the rank decided?', 'Players are ranked by their match winnings for the selected period — <b>Daily</b>, <b>Weekly</b> or <b>Monthly</b>.'],
        ['Are there rewards?', 'When the admin turns on leaderboard rewards, the top players of the month get a bonus in their withdrawable balance.'],
    ]],
    wallet: ['Wallet', [
        ['What is Deposit balance vs Withdraw balance?', '<b>Deposit balance</b> is money you add — use it to join matches and games. <b>Withdraw balance</b> holds your winnings and can be withdrawn.'],
        ['How do I add money?', 'Tap <b>Add Money</b>, pay using the shown UPI / QR and submit the payment reference (UTR). The balance is added after it is verified.'],
        ['My deposit is not showing', 'Open <b>History</b> to see its status. If it is still pending, wait a little; if it stays pending contact support with your UTR.'],
        ['How do I withdraw?', 'Tap <b>Withdraw</b>, choose a method and enter the amount. Only the Withdraw balance can be withdrawn.'],
    ]],
    deposit: ['Add Money', [
        ['How does a deposit work?', 'Pay to the shown UPI ID / QR from any app, then enter the UTR / reference number and submit.'],
        ['When is it credited?', 'After the payment is verified. You will see a notification and the entry in Wallet history.'],
        ['I paid but nothing came', 'Check Wallet history for the status first. Keep your payment screenshot and UTR ready and contact support from the menu.'],
    ]],
    withdraw: ['Withdraw', [
        ['Which balance can I withdraw?', 'Only your <b>Withdraw balance</b> (match winnings and similar rewards). Deposit balance is for playing.'],
        ['How long does it take?', 'Requests are processed by the team and the status updates in Wallet history. You get a notification when it is paid.'],
        ['Why was my request rejected?', 'Usually wrong payment details or a rule issue. The reason is shown in the notification / history — fix it and try again.'],
    ]],
    transfer: ['Transfer', [
        ['What does Transfer do?', 'It moves balance using your available <b>Deposit balance</b>. Check the amount shown as Available before you confirm.'],
        ['Can I undo a transfer?', 'No — please double-check the details before you confirm.'],
    ]],
    join: ['Joining a match', [
        ['What happens when I tap Pay & Join?', 'The entry fee is deducted from your wallet and your slot is reserved. You can see the match in <b>My Matches</b>.'],
        ['Why can I not join?', 'The match may be full, already started, or you may not have enough balance. Add money and try again.'],
        ['Do I need my Free Fire UID?', 'Yes — make sure your game name & UID in your profile are correct so the prize reaches the right player.'],
    ]],
    games: ['Games', [
        ['How do Coin Battle and Bomb & Gems work?', 'Pick an entry amount, get matched with another player and play. The winner gets the prize after the platform cut. Draws are refunded where the game says so.'],
        ['Is there a free practice mode?', 'Yes — free practice matches are available every day (the number is shown inside the game).'],
        ['What are BOT players?', 'If no real player is found for a free practice game, a BOT may join. Bots are always labelled <b>BOT</b>.'],
        ['A game is missing', 'The admin can switch a game off for a while. It comes back here automatically when it is switched on.'],
    ]],
};
const dyn = {};
const $ = (id) => document.getElementById(id);
let cur = null;

const css = `
.faq-fab{position:fixed;left:12px;bottom:calc(var(--nav-height,65px) + 12px + env(safe-area-inset-bottom,0px));z-index:40;display:inline-flex;align-items:center;gap:5px;height:30px;padding:0 11px;border-radius:99px;border:1px solid var(--border,#e3e8f2);background:var(--bg-card,#fff);color:var(--primary,#4f46e5);font-weight:800;font-size:.72rem;letter-spacing:.3px;box-shadow:0 4px 14px rgba(15,23,42,.14);cursor:pointer;opacity:.92;transition:transform .15s,opacity .2s}
.faq-fab:active,.faq-chip:active{transform:scale(.92)}
.faq-fab i,.faq-chip i{font-size:.8rem}
body.chat-mode .faq-fab,body.ball-open .faq-fab,.faq-fab.off{display:none}
.faq-chip{display:inline-flex;align-items:center;gap:5px;height:28px;padding:0 10px;border-radius:99px;border:1px solid var(--border,#e3e8f2);background:var(--primary-light,#eef2ff);color:var(--primary,#4f46e5);font-weight:800;font-size:.7rem;cursor:pointer;flex:none;transition:transform .15s}
.faq-grp{display:flex;align-items:center;gap:10px}
#faq-wrap{position:fixed;inset:0;z-index:5300;visibility:hidden;pointer-events:none}
#faq-wrap.on{visibility:visible;pointer-events:auto}
#faq-wrap .fq-bg{position:absolute;inset:0;background:rgba(15,23,42,.55);opacity:0;transition:opacity .25s}
#faq-wrap.on .fq-bg{opacity:1}
#faq-wrap .fq-sheet{position:absolute;left:0;right:0;bottom:0;max-height:82vh;overflow-y:auto;background:var(--bg-card,#fff);color:var(--text-main,#0f172a);border-radius:24px 24px 0 0;padding:14px 18px calc(22px + env(safe-area-inset-bottom,0px));transform:translateY(100%);transition:transform .35s cubic-bezier(.2,.9,.3,1);max-width:640px;margin:0 auto}
#faq-wrap.on .fq-sheet{transform:none}
.fq-h{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:6px 0 8px}
.fq-h h3{margin:0;font-size:1.05rem;font-weight:900;display:flex;align-items:center;gap:8px}
.fq-h h3 i{color:var(--primary,#4f46e5)}
.fq-x{width:32px;height:32px;border-radius:50%;border:none;background:var(--bg-input,#f1f5f9);color:var(--text-muted,#64748b);font-size:1rem;cursor:pointer}
.fq-sheet details{border-bottom:1px solid var(--border,#e3e8f2)}
.fq-sheet details:last-child{border:none}
.fq-sheet summary{list-style:none;cursor:pointer;padding:13px 28px 13px 0;font-weight:700;font-size:.9rem;line-height:1.4;position:relative}
.fq-sheet summary::-webkit-details-marker{display:none}
.fq-sheet summary::after{content:"+";position:absolute;right:2px;top:9px;font-size:1.4rem;font-weight:500;color:var(--primary,#4f46e5);transition:transform .2s}
.fq-sheet details[open] summary::after{transform:rotate(45deg)}
.fq-sheet details p{margin:0 0 13px;font-size:.84rem;line-height:1.6;color:var(--text-muted,#64748b);animation:fqIn .3s both}
.fq-sheet details p b{color:var(--text-main,#0f172a)}
#faq-wrap.on .fq-sheet details{animation:fqIn .4s both}
#faq-wrap.on .fq-sheet details:nth-of-type(2){animation-delay:.05s}#faq-wrap.on .fq-sheet details:nth-of-type(3){animation-delay:.1s}#faq-wrap.on .fq-sheet details:nth-of-type(4){animation-delay:.15s}#faq-wrap.on .fq-sheet details:nth-of-type(n+5){animation-delay:.2s}
@keyframes fqIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){#faq-wrap *{animation:none!important;transition:none!important}}`;

const items = (k) => { const d = dyn[k]; if (d) { try { return typeof d === 'function' ? d() : d; } catch (e) {} } return (T[k] || [])[1] || []; };
const title = (k) => (T[k] || [])[0] || 'FAQ';

const ensure = () => {
    if ($('faq-wrap')) return;
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    const w = document.createElement('div'); w.id = 'faq-wrap'; w.setAttribute('aria-hidden', 'true');
    w.innerHTML = '<div class="fq-bg"></div><div class="fq-sheet" role="dialog" aria-modal="true"></div>';
    w.querySelector('.fq-bg').addEventListener('click', () => window.faq.close());
    document.body.appendChild(w);
};

const pageKey = () => {
    const p = document.querySelector('.page-section:not(.hidden)'); const id = p ? p.id.replace('page-', '') : '';
    return { home: 'home', matches: 'matches', leaderboard: 'leaderboard', wallet: 'wallet' }[id] || '';
};

window.faq = {
    register(k, v) { dyn[k] = v; },
    open(k) {
        ensure(); k = k || pageKey() || 'home'; cur = k;
        const w = $('faq-wrap'), s = w.querySelector('.fq-sheet');
        s.innerHTML = `<div class="fq-h"><h3><i class="fa-solid fa-circle-question"></i> FAQ · ${title(k)}</h3><button class="fq-x" type="button" aria-label="Close" onclick="faq.close()"><i class="fa-solid fa-xmark"></i></button></div>` +
            (items(k).map(([q, a]) => `<details><summary>${q}</summary><p>${a}</p></details>`).join('') || '<p style="color:var(--text-muted)">Nothing here yet.</p>');
        s.scrollTop = 0; w.classList.add('on'); w.setAttribute('aria-hidden', 'false');
    },
    close() { const w = $('faq-wrap'); if (!w) return; w.classList.remove('on'); w.setAttribute('aria-hidden', 'true'); cur = null; },
    chip(k, extra) { return `<button type="button" class="faq-chip" onclick="faq.open('${k}')" ${extra || ''}><i class="fa-solid fa-circle-question"></i> FAQ</button>`; },
};

// chip in the header row of the money / join popups (next to the ✕)
const MODALS = { 'modal-deposit': 'deposit', 'modal-withdraw': 'withdraw', 'modal-transfer': 'transfer', 'modal-join': 'join' };
const addChips = () => {
    Object.keys(MODALS).forEach((id) => {
        const m = $(id); if (!m || m.dataset.faq) return;
        const x = m.querySelector('.modal-sheet [onclick*="closeModal"]'); if (!x || !x.parentNode) return;
        m.dataset.faq = '1';
        const g = document.createElement('div'); g.className = 'faq-grp'; x.parentNode.insertBefore(g, x);
        g.insertAdjacentHTML('beforeend', window.faq.chip(MODALS[id])); g.appendChild(x);
    });
};

const boot = () => {
    ensure(); addChips();
    if (!$('faq-fab')) {
        const b = document.createElement('button'); b.id = 'faq-fab'; b.type = 'button'; b.className = 'faq-fab'; b.setAttribute('aria-label', 'FAQ');
        b.innerHTML = '<i class="fa-solid fa-circle-question"></i> FAQ'; b.onclick = () => window.faq.open(pageKey());
        document.body.appendChild(b);
    }
};
window.addEventListener('popstate', () => window.faq && window.faq.close());
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(boot, 800)); else setTimeout(boot, 800);
