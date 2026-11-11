/**
 * Refer & Earn + Scratch cards — app side. All money / rules run on the server (Server-1, /ref/*, file modules/ref_mod.py, through the load balancer).
 * This file shows the page, the scratch card (canvas) and the FAQ; the amount a card holds is decided by the SERVER when you start scratching.
 */
import { api as LB } from '../../js/core/api.js?v=fe39312af5';

const $ = (id) => document.getElementById(id);
const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (v) => '₹' + (Number(v) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const toast = (m) => { try { window.ui.toast(m); } catch (e) {} };
const S = { d: null, shown: false, claiming: false };
const countTo = (el, to, ms, isMoney) => { if (!to) return; const t0 = performance.now(), fmt = (v) => isMoney ? money(v) : String(Math.round(v)); const step = (t) => { const p = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - p, 3); el.textContent = fmt(to * e); if (p < 1) requestAnimationFrame(step); else el.textContent = fmt(to); }; requestAnimationFrame(step); };

async function api(path, body, ms = 30000) {
    // Load balancer API (POST /ref/<path>) - session token + site key are added by js/core/api.js. Errors come back as {ok:false,error}.
    try { return await LB.post('/ref/' + path, body || {}, { timeout: Math.max(ms, 70000) }); }
    catch (e) { if (e && e.status && e.data && e.data.error) return e.data; if (e && e.status === 0) throw new Error(e.message); return { ok: false, error: (e && e.message) || 'Server error — try again' }; }
}

/* ---------- sounds (WebAudio, no files) — volume = Settings → touch volume ---------- */
const SND = (() => {
    let c = null, nb = null;
    const vol = () => { try { const v = parseInt(localStorage.getItem('vol_touch') || '50'); return isNaN(v) ? .5 : Math.max(0, Math.min(1, v / 100)); } catch (e) { return .5; } };
    const ctx = () => { if (!c) { const C = window.AudioContext || window.webkitAudioContext; if (C) try { c = new C(); } catch (e) {} } if (c && c.state === 'suspended') c.resume().catch(() => {}); return c; };
    const tone = (f, t, d, type, g, f2) => { const v = vol(), a = ctx(); if (!a || v <= 0) return; const o = a.createOscillator(), x = a.createGain(), T = a.currentTime + t;
        o.type = type || 'sine'; o.frequency.setValueAtTime(f, T); if (f2) o.frequency.exponentialRampToValueAtTime(f2, T + d);
        x.gain.setValueAtTime(.0001, T); x.gain.exponentialRampToValueAtTime(Math.max(.0002, g * v), T + .01); x.gain.exponentialRampToValueAtTime(.0001, T + d);
        o.connect(x); x.connect(a.destination); o.start(T); o.stop(T + d + .05); };
    const noise = (t, d, g, f1, f2, type) => { const v = vol(), a = ctx(); if (!a || v <= 0) return;
        if (!nb) { nb = a.createBuffer(1, a.sampleRate, a.sampleRate); const D = nb.getChannelData(0); for (let i = 0; i < D.length; i++) D[i] = Math.random() * 2 - 1; }
        const s = a.createBufferSource(), fl = a.createBiquadFilter(), x = a.createGain(), T = a.currentTime + t; s.buffer = nb; s.loop = true;
        fl.type = type || 'lowpass'; fl.frequency.setValueAtTime(f1, T); fl.frequency.exponentialRampToValueAtTime(f2, T + d);
        x.gain.setValueAtTime(.0001, T); x.gain.exponentialRampToValueAtTime(Math.max(.0002, g * v), T + .01); x.gain.exponentialRampToValueAtTime(.0001, T + d);
        s.connect(fl); fl.connect(x); x.connect(a.destination); s.start(T); s.stop(T + d + .05); };
    return {
        tap() { tone(520, 0, .08, 'triangle', .35, 340); },
        open() { tone(392, 0, .12, 'triangle', .3); tone(587, .09, .2, 'triangle', .3); },
        rub() { noise(0, .09, .16, 5200, 2600, 'highpass'); },
        win(big) { [523, 659, 784, 1047, 1319, 1568].slice(0, big ? 6 : 5).forEach((f, i) => { tone(f, i * .09, .45, 'triangle', .38); tone(f * 2, i * .09, .28, 'sine', .1); }); noise(0, .5, .12, 7000, 1500, 'highpass'); }
    };
})();

/* ---------- text helpers (all numbers come from the server config) ---------- */
const walletTxt = (c) => c.creditTo === 'withdraw' ? 'Withdrawable balance' : 'Deposit balance';
const condTxt = (c) => c.depositRequired > 0 ? `joins with your code and adds ${money(c.depositRequired)} or more` : 'joins with your code';
const perTxt = (c) => c.referralsPerCard > 1 ? `every ${c.referralsPerCard} friends who ${condTxt(c)}` : `every friend who ${condTxt(c)}`;

const faqList = (c) => {
    const q = [
        ['What is Refer & Earn?', `Invite your friends to FF Cash Battle with your personal code. ${'When'} ${perTxt(c)} <b>you win a Scratch Card</b> with real money inside.`],
        ['How do I invite a friend?', 'Tap <b>WhatsApp</b> or <b>Share</b> on this page to send your invite link, or just tell them your <b>Referral Code</b> (it is your Player ID). Your friend signs up through the link, or types your code in the Referral Code box while creating the account.'],
        ['When do I get a Scratch Card?', c.depositRequired > 0
            ? `A friend counts as <b>qualified</b> when they join with your code <b>and</b> their total deposit reaches ${money(c.depositRequired)}. ${c.referralsPerCard > 1 ? `You get 1 Scratch Card for every ${c.referralsPerCard} qualified friends.` : 'You get 1 Scratch Card for every qualified friend.'} The card appears here automatically, usually within a couple of minutes after your friend's deposit is credited.`
            : `A friend counts as qualified the moment they join with your code. ${c.referralsPerCard > 1 ? `You get 1 Scratch Card for every ${c.referralsPerCard} friends.` : 'You get 1 Scratch Card for every friend.'}`],
        ['How much can I win?', 'Every Scratch Card holds real wallet money. It is a surprise — nobody knows the amount in advance, not even us. It is picked at the moment you start scratching.'],
        ['Where does the money go?', `The reward is added instantly to your <b>${walletTxt(c)}</b>. ${c.creditTo === 'withdraw' ? 'You can use it to play or withdraw it, just like match winnings.' : 'Use it to join matches. Money you win in matches from it can be withdrawn as usual.'} You will also see it in your wallet history as “Referral Scratch Card”.`],
        ['Why does my friend show “Waiting for deposit”?', c.depositRequired > 0 ? `Your friend has joined, but their total deposit is still below ${money(c.depositRequired)}. As soon as it reaches the amount, the referral turns <b>Qualified</b> and your card is issued.` : 'This only appears when deposits are needed. Right now friends qualify as soon as they join.'],
        ['My friend forgot to enter my code. Can they add it later?', `Yes — in <b>Refer & Earn → “Have a referral code?”</b> within <b>${c.claimWindowHrs} hours</b> of creating the account. A code can be used <b>only once</b> per account and cannot be changed afterwards.`],
        ['I closed the app while scratching. Did I lose my reward?', 'No. The reward is added to your wallet the moment you start scratching. Open <b>Refer & Earn</b> again — the card now shows the amount you won.'],
        ['Is there a limit on referrals or cards?', 'The program can have limits (for example a maximum number of friends per user). If you reach one, you will see a message when your friend tries to use your code.'],
        ['Do Scratch Cards expire?', 'Cards do not expire on their own. FF Cash Battle may change or stop the Refer & Earn program at any time; unscratched cards follow the rules that are active when you scratch them.'],
        ['Which friends count?', 'Only <b>genuine new users</b> who join using your code. Using your own code, creating extra or fake accounts, or any kind of abuse is not allowed — such referrals are cancelled, unscratched cards are removed and the account may be restricted.'],
        ['I can\u2019t see my reward / card. What should I do?', 'Pull down the list by reopening this page. If your friend has deposited but the status is still “Waiting”, wait a few minutes. Still stuck? Contact support from the menu and share your <b>Player ID</b> and your friend\u2019s name.'],
        ['Is Refer & Earn available in every state?', 'Rewards follow our Terms of Service. Users from restricted states can only take part in free-to-play activities.'],
        ['Is it really free to refer?', 'Yes. Sharing your code costs nothing and your friend does not pay anything extra to join with it.'],
    ];
    return q;
};
try { window.faq && window.faq.register('refer', () => (S.d ? faqList(S.d.cfg) : [])); } catch (e) {}

/* ---------- page ---------- */
const render = () => {
    const d = S.d, c = d.cfg, st = d.stats, pr = d.progress, body = $('ref-body'); if (!body) return;
    const seg = Array.from({ length: pr.per }, (_, i) => `<i class="${i < pr.have ? 'on' : ''}"></i>`).join('');
    const cards = d.cards.length ? d.cards.map(x => x.status === 'new'
        ? `<div class="rc-tile new" onclick="refer.openCard('${esc(x.id)}')"><i class="fa-solid fa-gift"></i><b>SCRATCH</b><small>${x.src === 'gift' ? 'Gift code · tap to open' : x.src === 'admin' ? 'From admin · tap to open' : 'Tap to open'}</small></div>`
        : x.status === 'cancelled' ? `<div class="rc-tile done cancel"><div class="rc-amt">Cancelled</div><small>${x.src === 'gift' ? 'Gift card' : 'Card'} · cancelled by admin</small></div>`
        : `<div class="rc-tile done"><div class="rc-amt">${money(x.amount)}</div><small>${x.at ? new Date(x.at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'Won'} · added</small></div>`).join('')
        : `<div class="ref-empty" style="grid-column:1/-1"><i class="fa-solid fa-ticket"></i>No scratch cards yet.<br>Invite a friend to win your first one!</div>`;
    const friends = d.friends.length ? d.friends.map((f, i) => `<div class="ref-friend" style="animation-delay:${i * 60}ms"><div class="av">${esc((f.name || 'P').slice(0, 1).toUpperCase())}</div><b>${esc(f.name)}</b>
        <span class="ref-chip ${f.status === 'qualified' ? 'q' : f.status === 'void' ? 'v' : 'p'}">${f.status === 'qualified' ? 'Qualified ✓' : f.status === 'void' ? 'Cancelled' : (c.depositRequired > 0 ? 'Joined · deposit pending' : 'Joined')}</span></div>`).join('')
        : `<div class="ref-empty"><i class="fa-solid fa-user-plus"></i>Your invited friends will show here.</div>`;
    const claim = d.referredBy ? `<div class="ref-note" style="margin:0"><i class="fa-solid fa-circle-check" style="color:var(--success)"></i> You joined with code <b>${esc(d.referredBy.code)}</b> (${esc(d.referredBy.name)}).</div>`
        : d.canClaim ? `<div class="ref-claim"><input id="ref-in" class="input-box" inputmode="numeric" maxlength="12" placeholder="Referral code" oninput="this.value=this.value.replace(/\\D/g,'')"><button onclick="refer.claimCode()">Apply</button></div><div class="ref-note">You can add a friend's code within ${c.claimWindowHrs} hours of joining. It can be used only once.</div>`
        : `<div class="ref-note" style="margin:0">Referral codes can only be added within ${c.claimWindowHrs} hours of creating an account.</div>`;
    body.innerHTML = `
    <div class="ref-hero"><div class="ref-gift">🎁</div><h2>Refer &amp; Earn</h2>
        <p>${c.enabled ? `Invite friends — ${perTxt(c)} gives you a <b>Scratch Card</b>.` : 'Refer &amp; Earn is paused right now. Your cards and codes are safe.'}</p>
        <div class="ref-hero-foot">${c.enabled ? `<div class="ref-prize"><i class="fa-solid fa-sack-dollar"></i> Win real cash in every card</div>` : '<span></span>'}<button type="button" class="ref-faq-btn" onclick="faq.open('refer')"><i class="fa-solid fa-circle-question"></i> FAQ</button></div></div>
    <div class="ref-card"><h3><i class="fa-solid fa-ticket" style="color:var(--primary)"></i> Your referral code</h3>
        <div class="ref-codebox"><div class="ref-code" id="ref-code">${esc(d.code || '—')}</div><button class="ref-copy" onclick="refer.copy()"><i class="fa-regular fa-copy"></i> Copy</button></div>
        <div class="ref-share"><button class="ref-wa" onclick="refer.wa()"><i class="fa-brands fa-whatsapp"></i> WhatsApp</button><button class="ref-sh" onclick="refer.share()"><i class="fa-solid fa-share-nodes"></i> Share link</button></div></div>
    ${c.enabled ? `<div class="ref-card ref-prog"><h3><i class="fa-solid fa-bolt" style="color:#f59e0b"></i> Next scratch card</h3>
        <b>${pr.toNext === pr.per ? `Invite ${pr.per} friend${pr.per > 1 ? 's' : ''} to unlock the next card` : `${pr.toNext} more friend${pr.toNext > 1 ? 's' : ''} to unlock the next card`}</b>
        <div class="ref-seg">${seg}</div>
        <small>${c.depositRequired > 0 ? `A friend counts when they join with your code and deposit ${money(c.depositRequired)} or more.` : 'A friend counts as soon as they join with your code.'}</small></div>` : ''}
    <div class="ref-stats"><div class="ref-stat"><b data-n="${st.joined}">${st.joined}</b><span>Friends</span></div><div class="ref-stat"><b data-n="${st.qualified}">${st.qualified}</b><span>Qualified</span></div><div class="ref-stat"><b data-n="${st.cards}">${st.cards}</b><span>Cards</span></div><div class="ref-stat"><b data-n="${st.earned}" data-m="1">${money(st.earned)}</b><span>Earned</span></div></div>
    <div class="ref-card"><h3><i class="fa-solid fa-users" style="color:var(--primary)"></i> Invited friends ${d.friends.length ? `<span class="ref-pill" style="background:var(--primary)">${d.friends.length}</span>` : ''}</h3>${friends}</div>
    <div class="ref-card"><h3><i class="fa-solid fa-gift" style="color:#ec4899"></i> Your scratch cards ${st.fresh ? `<span class="ref-pill">${st.fresh} NEW</span>` : ''}</h3><div class="ref-cards">${cards}</div></div>
    <div class="ref-card"><h3><i class="fa-solid fa-user-group" style="color:var(--primary)"></i> Have a referral code?</h3>${claim}</div>
    <div class="ref-card"><h3><i class="fa-solid fa-route" style="color:var(--primary)"></i> How it works</h3><div class="ref-steps">
        <div class="ref-step"><div class="n">1</div><div><b>Share your code</b><span>Send your link on WhatsApp or tell friends your referral code.</span></div></div>
        <div class="ref-step"><div class="n">2</div><div><b>${c.depositRequired > 0 ? `Friend joins &amp; deposits ${money(c.depositRequired)}` : 'Your friend joins'}</b><span>They sign up with your code${c.depositRequired > 0 ? ' and add money to their wallet' : ''}.</span></div></div>
        <div class="ref-step"><div class="n">3</div><div><b>Scratch &amp; win real cash</b><span>${c.referralsPerCard > 1 ? `Every ${c.referralsPerCard} friends give you 1 scratch card.` : 'Every friend gives you 1 scratch card.'} The prize goes straight to your ${walletTxt(c)}.</span></div></div></div></div>
    <div class="ref-card ref-terms"><h3><i class="fa-solid fa-file-contract" style="color:var(--primary)"></i> Referral terms</h3><ul>
        <li>Your referral code is your Player ID. Every account can use <b>one</b> referral code, once.</li>
        <li>Rewards are only for genuine new users. Self-referrals, duplicate or fake accounts and any misuse are cancelled and may lead to account restriction.</li>
        <li>The value of a scratch card is chosen by the system when you scratch it and is not guaranteed.</li>
        <li>FF Cash Battle may change, pause or stop Refer &amp; Earn at any time. Unscratched cards follow the rules active at that time.</li>
        <li>Read the full <a href="/terms#s16" target="_blank" rel="noopener">Terms of Service</a>.</li></ul></div>`;
    body.classList.toggle('ref-in', !S.shown);
    if (!S.shown) { S.shown = true; body.querySelectorAll('.ref-stat b[data-n]').forEach(el => countTo(el, Number(el.dataset.n) || 0, 900, !!el.dataset.m)); }
};

const load = async (spin) => {
    if (spin && $('ref-body')) $('ref-body').innerHTML = '<div class="ref-loading"><i class="fa-solid fa-gift fa-bounce"></i><span>Loading your rewards…</span></div>';
    try { const r = await api('info', {}); if (!r.ok) throw new Error(r.error || 'Could not load'); S.d = r; render(); }
    catch (e) { if ($('ref-body') && !S.d) $('ref-body').innerHTML = `<div class="ref-empty"><i class="fa-solid fa-cloud-exclamation"></i>${esc(e.message)}<br><br><button class="btn-main btn-sm" onclick="refer.open()">Try again</button></div>`; else toast(e.message); }
};

/* ---------- share ---------- */
const shareText = () => `Join me on FF Cash Battle! Sign up with my referral code ${S.d.code} and play Free Fire tournaments & mini games.`;
const copyText = async (t) => { try { await navigator.clipboard.writeText(t); return true; } catch (e) { const a = document.createElement('textarea'); a.value = t; a.style.position = 'fixed'; a.style.opacity = '0'; document.body.appendChild(a); a.select(); let ok = false; try { ok = document.execCommand('copy'); } catch (_) {} a.remove(); return ok; } };

/* ---------- scratch card ---------- */
const SC = { id: null, dpr: 1, claimed: false, p: null, amt: null, last: null, drawing: false, revealing: false, done: false, timer: 0, rubT: 0, parts: [], raf: 0 };
const cvs = () => $('sc-cv');
const rr = (c, x, y, w, h, r) => { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };

const paintFoil = () => {
    const cv = cvs(), c = cv.getContext('2d'), w = cv.width, h = cv.height, d = SC.dpr;
    c.globalCompositeOperation = 'source-over'; c.clearRect(0, 0, w, h);
    const g = c.createLinearGradient(0, 0, w, h);
    [[0, '#fff2ae'], [.2, '#f9c94d'], [.42, '#d99a1b'], [.6, '#ffe48c'], [.8, '#e3a724'], [1, '#b87a0e']].forEach(([o, col]) => g.addColorStop(o, col));
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    for (let i = 0, n = Math.round(w * h / 240); i < n; i++) { c.fillStyle = Math.random() < .5 ? `rgba(255,255,255,${Math.random() * .38})` : `rgba(110,60,0,${Math.random() * .24})`; c.fillRect(Math.random() * w, Math.random() * h, 1.6 * d, 1.6 * d); }
    c.strokeStyle = 'rgba(255,255,255,.12)'; c.lineWidth = d; for (let x = -h; x < w; x += 8 * d) { c.beginPath(); c.moveTo(x, h); c.lineTo(x + h, 0); c.stroke(); }
    c.save(); c.fillStyle = 'rgba(122,70,0,.14)'; c.font = `900 ${19 * d}px system-ui,sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    for (let r = 0; r < 5; r++) for (let k = 0; k < 7; k++) c.fillText(r % 2 ? '★' : '₹', (k + (r % 2 ? .5 : 0)) * (w / 6.2) + w / 14, r * (h / 4.2) + h / 9); c.restore();
    c.strokeStyle = 'rgba(255,248,205,.95)'; c.lineWidth = 3 * d; rr(c, 7 * d, 7 * d, w - 14 * d, h - 14 * d, 18 * d); c.stroke();
    c.strokeStyle = 'rgba(140,85,0,.4)'; c.lineWidth = 1.2 * d; rr(c, 12 * d, 12 * d, w - 24 * d, h - 24 * d, 14 * d); c.stroke();
    // emblem
    const cx = w / 2, cy = h * .4, R = 32 * d, eg = c.createRadialGradient(cx - R * .3, cy - R * .35, R * .1, cx, cy, R);
    eg.addColorStop(0, '#fffbe0'); eg.addColorStop(.55, '#f6c23e'); eg.addColorStop(1, '#b97b10');
    c.save(); c.shadowColor = 'rgba(110,60,0,.55)'; c.shadowBlur = 12 * d; c.shadowOffsetY = 4 * d; c.fillStyle = eg; c.beginPath(); c.arc(cx, cy, R, 0, 7); c.fill(); c.restore();
    c.strokeStyle = 'rgba(255,250,215,.95)'; c.lineWidth = 2.4 * d; c.beginPath(); c.arc(cx, cy, R - 4 * d, 0, 7); c.stroke();
    c.font = `${34 * d}px system-ui,"Apple Color Emoji","Segoe UI Emoji",sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('🎁', cx, cy + 2 * d);
    // embossed title
    c.font = `900 ${22 * d}px system-ui,sans-serif`; c.fillStyle = 'rgba(110,60,0,.65)'; c.fillText('SCRATCH & WIN', cx + 1.5 * d, h * .73 + 1.8 * d);
    c.fillStyle = '#fff7cf'; c.fillText('SCRATCH & WIN', cx, h * .73); c.strokeStyle = 'rgba(150,90,0,.5)'; c.lineWidth = .8 * d; c.strokeText('SCRATCH & WIN', cx, h * .73);
};
const sizeCanvas = () => { const cv = cvs(), r = cv.getBoundingClientRect(); SC.dpr = Math.min(2.5, window.devicePixelRatio || 1); cv.width = Math.max(10, Math.round(r.width * SC.dpr)); cv.height = Math.max(10, Math.round(r.height * SC.dpr)); paintFoil(); };

const coverage = () => {
    try { const cv = cvs(), t = document.createElement('canvas'); t.width = 40; t.height = 25; const x = t.getContext('2d'); x.drawImage(cv, 0, 0, 40, 25);
        const px = x.getImageData(0, 0, 40, 25).data; let clear = 0; for (let i = 3; i < px.length; i += 4) if (px[i] < 110) clear++; return clear / 1000; } catch (e) { return 0; }
};

/* particles: gold shavings while scratching + confetti on reveal */
const fxCv = () => $('sc-fx');
const fxLoop = () => {
    const cv = fxCv(), c = cv.getContext('2d'); c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, cv.width, cv.height); const dpr = cv.width / (cv.clientWidth || 1); c.scale(dpr, dpr);
    SC.parts = SC.parts.filter(p => p.life > 0 && p.y < cv.clientHeight + 30);
    SC.parts.forEach(p => { p.vy += p.g; p.x += p.vx; p.y += p.vy; p.vx *= .99; p.rot += p.vr; p.life--; c.save(); c.globalAlpha = Math.max(0, Math.min(1, p.life / 24)); c.translate(p.x, p.y); c.rotate(p.rot); c.fillStyle = p.col; c.fillRect(-p.s / 2, -p.s / 3, p.s, p.s * .66); c.restore(); });
    SC.raf = SC.parts.length ? requestAnimationFrame(fxLoop) : 0;
};
const emit = (n, x, y, kind) => {
    const cols = kind === 'shave' ? ['#ffe9a0', '#f4c24a', '#fff6cf', '#d9961b'] : ['#ffd66b', '#ec4899', '#a855f7', '#22d3ee', '#34d399', '#ffffff', '#f97316'];
    for (let i = 0; i < n; i++) { const a = kind === 'shave' ? -Math.PI / 2 + (Math.random() - .5) * 2.2 : Math.random() * Math.PI * 2, sp = kind === 'shave' ? 1.2 + Math.random() * 2.6 : 3 + Math.random() * 8;
        SC.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (kind === 'shave' ? 0 : 3), g: kind === 'shave' ? .16 : .22, rot: Math.random() * 6, vr: (Math.random() - .5) * .4, s: kind === 'shave' ? 2.5 + Math.random() * 3 : 6 + Math.random() * 7, col: cols[(Math.random() * cols.length) | 0], life: kind === 'shave' ? 34 : 90 + (Math.random() * 40 | 0) }); }
    if (!SC.raf) SC.raf = requestAnimationFrame(fxLoop);
};

// the amount is shown under the foil as soon as the server has chosen it (so scratching reveals the real number)
const curCard = () => (S.d && S.d.cards || []).find(c => c.id === SC.id);
const jackMax = () => { const x = curCard(); if (x && x.src !== 'ref') return x.src === 'admin' && x.max > x.min ? x.max : 0; return (S.d && S.d.cfg && S.d.cfg.amountMode === 'random') ? S.d.cfg.maxAmount : 0; };
const cardWallet = () => { const x = curCard(); return x && x.src !== 'ref' ? (x.to === 'withdraw' ? 'Withdrawable balance' : 'Deposit balance') : walletTxt(S.d.cfg); };
const showAmt = (amt) => { const max = jackMax(); $('sc-amt').textContent = String(Number(amt) || 0); $('sc-won').textContent = max && amt >= max * .8 ? 'JACKPOT!' : 'YOU WON'; };

const resetCard = () => { SC.claimed = false; SC.p = null; SC.amt = null; SC.revealing = false; SC.done = false; SC.last = null; $('sc-card').classList.remove('busy', 'open', 'pop'); cvs().classList.remove('gone'); $('sc-wrap').classList.remove('won'); $('sc-amt').textContent = '?'; $('sc-won').textContent = 'YOU WON'; $('sc-title').textContent = 'Scratch & Win!'; $('sc-sub').textContent = 'Rub the golden card with your finger'; paintFoil(); };

const claimNow = () => {
    if (SC.claimed) return SC.p; SC.claimed = true; $('sc-card').classList.add('busy'); SND.tap(); try { navigator.vibrate && navigator.vibrate(12); } catch (e) {}
    SC.p = api('scratch', { card: SC.id }).then(r => { if (!r.ok) throw new Error(r.error || 'Could not open this card'); SC.amt = Number(r.amount) || 0; showAmt(SC.amt); return r; })
        .catch(e => { toast(e.message || 'Could not open this card'); if (!SC.done) resetCard(); SC.p = null; return null; });
    return SC.p;
};

const finish = async () => {
    if (SC.revealing || SC.done) return; SC.revealing = true;
    const r = await claimNow(); if (!r) { SC.revealing = false; return; }
    SC.done = true; clearInterval(SC.timer);
    const card = $('sc-card'); cvs().classList.add('gone'); card.classList.add('open', 'pop'); $('sc-wrap').classList.add('won');
    showAmt(SC.amt); countTo($('sc-amt'), SC.amt, 900, false); const jm = jackMax(), big = !!jm && SC.amt >= jm * .8;
    $('sc-title').textContent = big ? 'JACKPOT! 🎉' : 'Congratulations! 🎉'; $('sc-sub').textContent = `${money(SC.amt)} added to your ${cardWallet()}`;
    const b = card.getBoundingClientRect(), w = $('sc-wrap').getBoundingClientRect(); emit(110, b.left - w.left + b.width / 2, b.top - w.top + b.height / 2, 'conf'); SND.win(big);
    try { navigator.vibrate && navigator.vibrate([30, 40, 70]); } catch (e) {}
    setTimeout(() => load(false), 500);
};

const bindScratch = () => {
    const cv = cvs(); if (cv._b) return; cv._b = true;
    const pos = (e) => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * cv.width / r.width, y: (e.clientY - r.top) * cv.height / r.height, cx: e.clientX, cy: e.clientY }; };
    const draw = (p) => { const c = cv.getContext('2d'); c.globalCompositeOperation = 'destination-out'; c.lineCap = 'round'; c.lineJoin = 'round'; c.lineWidth = 30 * SC.dpr; c.fillStyle = '#000';
        if (SC.last) { c.beginPath(); c.moveTo(SC.last.x, SC.last.y); c.lineTo(p.x, p.y); c.stroke(); } else { c.beginPath(); c.arc(p.x, p.y, 15 * SC.dpr, 0, 7); c.fill(); }
        const moved = SC.last ? Math.hypot(p.x - SC.last.x, p.y - SC.last.y) : 0; SC.last = p;
        const w = $('sc-wrap').getBoundingClientRect(); if (Math.random() < .55) emit(2, p.cx - w.left, p.cy - w.top, 'shave');
        const now = performance.now(); if (moved > 8 * SC.dpr && now - SC.rubT > 75) { SC.rubT = now; SND.rub(); } };
    cv.addEventListener('pointerdown', (e) => { if (SC.done) return; e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch (_) {} SC.drawing = true; SC.last = null; claimNow(); draw(pos(e));
        clearInterval(SC.timer); SC.timer = setInterval(() => { if (!SC.done && coverage() > .42) finish(); }, 150); });
    cv.addEventListener('pointermove', (e) => { if (!SC.drawing || SC.done) return; e.preventDefault(); draw(pos(e)); });
    const up = () => { SC.drawing = false; SC.last = null; if (!SC.done && SC.claimed && coverage() > .42) finish(); };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
};

window.refer = {
    open() { S.shown = false; try { window.ui.openModal('modal-refer'); } catch (e) {} load(!S.d); },
    openCard(id) {
        const wrap = $('sc-wrap'); SC.id = id; SC.parts = []; wrap.classList.add('on'); wrap.setAttribute('aria-hidden', 'false'); SND.open();
        try { history.pushState({ sc: 1 }, null, location.pathname + location.search); SC.pushed = true; } catch (e) { SC.pushed = false; }
        const fx = fxCv(); fx.width = Math.round(innerWidth * Math.min(2, devicePixelRatio || 1)); fx.height = Math.round(innerHeight * Math.min(2, devicePixelRatio || 1));
        requestAnimationFrame(() => { resetCard(); sizeCanvas(); bindScratch(); });
    },
    // open the Refer page and straight into one card (used by the gift-code popup and the Notifications "Scratch now" button)
    async openFromNotif(id) {
        S.shown = false; try { window.ui.openModal('modal-refer'); } catch (e) {}
        await load(!S.d);
        const x = (S.d && S.d.cards || []).find(c => c.id === id);
        if (x && x.status === 'new') this.openCard(id);
        else if (x && x.status === 'cancelled') toast('This card was cancelled');
        else if (x) toast('You already scratched this card');
    },
    revealNow() { if (SC.id) { claimNow(); finish(); } },
    closeCard(fromBack) {
        const wrap = $('sc-wrap'); if (!wrap.classList.contains('on')) return;
        if (!fromBack && SC.pushed) { SC.pushed = false; window.__scBack = true; try { history.back(); } catch (e) { window.__scBack = false; } } else SC.pushed = false; const was = SC.claimed && !SC.done; wrap.classList.remove('on', 'won'); wrap.setAttribute('aria-hidden', 'true'); clearInterval(SC.timer); SC.drawing = false;
        if (was && SC.p) SC.p.then(r => { if (r) { toast(`You won ${money(r.amount)}! Added to your wallet`); load(false); } }); else if (SC.done) load(false);
        SC.id = null;
    },
    async copy() { if (!S.d) return; toast(await copyText(S.d.code) ? 'Referral code copied ✓' : 'Could not copy'); },
    async share() {
        if (!S.d) return; const url = S.d.link, text = shareText();
        if (navigator.share) { try { await navigator.share({ title: 'FF Cash Battle', text, url }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
        toast(await copyText(text + ' ' + url) ? 'Invite link copied ✓' : 'Could not copy');
    },
    wa() { if (!S.d) return; window.open('https://wa.me/?text=' + encodeURIComponent(shareText() + ' ' + S.d.link), '_blank', 'noopener'); },
    async claimCode() {
        const v = ($('ref-in') || {}).value || ''; if (v.length < 4) return toast('Enter a valid referral code');
        try { const r = await api('claim', { code: v }); if (!r.ok) return toast(r.error || 'Could not apply the code'); toast(r.qualified ? 'Code applied ✓' : 'Code applied ✓ — your friend gets credit after your first deposit'); load(false); } catch (e) { toast(e.message); }
    }
};
// for the sign-up screen: add the friend's code right after the profile is created
window.referApi = {
    async claim(code) { try { const r = await api('claim', { code }, 45000); return r; } catch (e) { return { ok: false, error: e.message }; } }
};

const FINAL = /already used|own code|Invalid referral|cannot be used|hours of joining|reached its limit/i;
window.referApi.final = (r) => !!(r && !r.ok && FINAL.test(r.error || ''));
const autoClaim = async () => {
    let rc = ''; try { rc = localStorage.getItem('ffcb_ref') || ''; } catch (e) {}
    if (!rc || !authService.currentUser || S.claiming) return; S.claiming = true;
    try { const r = await window.referApi.claim(rc); if (r && (r.ok || window.referApi.final(r))) localStorage.removeItem('ffcb_ref'); } catch (e) {} finally { S.claiming = false; }
};
try { authService.onAuthStateChanged((u) => { if (u) setTimeout(autoClaim, 6000); }); } catch (e) {}

// invite link (?ref=…) -> pre-fill the optional Referral code box on the sign-up form
try { const _e = document.getElementById('reg-ref'), _r = localStorage.getItem('ffcb_ref'); if (_e && _r && !_e.value) _e.value = _r; } catch (e) {}
