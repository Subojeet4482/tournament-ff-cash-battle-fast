/**
 * Session UX: smooth animated logout (confirm sheet -> step-by-step goodbye screen) and a friendly welcome card after login.
 */
import { signOut, authService } from '../../js/core/firebase.js?v=684982f88b';
import { api } from '../../js/core/api.js?v=684982f88b';

const $ = (id) => document.getElementById(id);
const wait = (ms) => new Promise(r => setTimeout(r, ms));
const reduce = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const firstName = (n) => String(n || 'Player').trim().split(/\s+/)[0].slice(0, 16) || 'Player';
const initial = (n) => (firstName(n).charAt(0) || 'P').toUpperCase();
const money = () => { const b = window.db && window.db.balance; return (window.db && window.db.user_uid && b != null) ? '₹' + Math.floor(b) : ''; };
const meName = () => (authService.currentUser && authService.currentUser.displayName) || (window.db && window.db.user_data && (window.db.user_data.name || window.db.user_data.username)) || 'Player';

const LINES = [
    'Ready to win some matches? 🎯',
    'New matches are live. Grab your slot! 🎮',
    'Your wallet is safe and ready 💰',
    'Good luck, champion! 🏆',
    'Let\'s get that Booyah! 🔥',
];
const greet = () => { const h = new Date().getHours(); return h >= 5 && h < 12 ? 'Good morning' : h >= 12 && h < 17 ? 'Good afternoon' : h >= 17 && h < 21 ? 'Good evening' : 'Good night'; };

function setSteps(n) {            // 0 = none, 1..3 = active step, 4 = all done
    [1, 2, 3].forEach(i => { const el = $('so-s' + i); if (!el) return; el.classList.toggle('on', i === n); el.classList.toggle('ok', i < n); });
}

let busy = false;
Object.assign(window.auth, {
    // Step 1: ask (animated sheet instead of the browser confirm box)
    logout: () => {
        const n = meName();
        $('lo-name').textContent = n; $('lo-av').textContent = initial(n);
        const m = money(); $('lo-bal').textContent = m ? m + ' balance stays safe' : 'Your balance is safe';
        window.ui.openModal('modal-logout');
    },

    // Step 2: smooth goodbye screen, then the real sign-out
    confirmLogout: async () => {
        if (busy) return; busy = true;
        const ov = $('session-overlay'), name = firstName(meName()), fast = reduce();
        window.ui.closeModal();
        ov.className = '';
        $('so-title').textContent = 'Logging out…'; $('so-sub').textContent = 'Securing your session';
        setSteps(1); void ov.offsetWidth;
        ov.classList.add('show');
        let failed = null;
        try {
            await wait(fast ? 150 : 750);
            setSteps(2); $('so-sub').textContent = 'Signing you out';
            try { await api.logout(); } catch(e){}        // ends the 1-hour server session on every device
            await Promise.all([signOut(authService), wait(fast ? 100 : 650)]);
            window.nav.goto('home', document.querySelectorAll('.nav-item')[0]);
            setSteps(4); ov.classList.add('done');
            $('so-title').textContent = 'You are logged out';
            $('so-sub').textContent = 'See you soon, ' + name + ' 👋';
            await wait(fast ? 500 : 1500);
        } catch (e) { failed = e; }
        ov.classList.add('leave'); ov.classList.remove('show');
        await wait(fast ? 50 : 800);
        ov.className = ''; busy = false;
        if (failed) window.ui.toast('Logout failed: ' + (failed.message || failed));
    },

    // Welcome card after an explicit login (name, small status text)
    _welcome: (name, tag) => {
        const c = $('welcome-card'); if (!c) return;
        const n = firstName(name);
        $('wl-ini').textContent = initial(n);
        $('wl-title').textContent = greet() + ', ' + n + '!';
        $('wl-sub').textContent = LINES[Math.floor(Math.random() * LINES.length)];
        $('wl-tag').textContent = tag || 'Login successful';
        // confetti burst
        const box = $('wl-conf'); box.textContent = '';
        if (!reduce()) {
            const cols = ['#fde047', '#f472b6', '#34d399', '#60a5fa', '#fb923c', '#ffffff'];
            for (let i = 0; i < 18; i++) {
                const s = document.createElement('i'), a = (Math.PI * 2 * i) / 18 + Math.random() * .4, d = 70 + Math.random() * 90;
                s.style.cssText = '--dx:' + Math.round(Math.cos(a) * d) + 'px;--dy:' + Math.round(Math.sin(a) * d * .7 - 20) + 'px;--r:' + Math.round(Math.random() * 540 - 270) + 'deg;--c:' + cols[i % cols.length] + ';--s:' + (5 + Math.round(Math.random() * 5)) + 'px;animation-delay:' + (0.45 + Math.random() * .12).toFixed(2) + 's';
                box.appendChild(s);
            }
        }
        clearTimeout(c._t); clearTimeout(c._s);
        c.classList.remove('show', 'out'); c.style.transform = ''; void c.offsetWidth;
        c._s = setTimeout(() => { c.classList.add('show'); window.__emojiPng && window.__emojiPng.scan(c); }, 300);
        c._t = setTimeout(() => window.auth._welcomeHide(), 5200);
    },
    _welcomeHide: () => {
        const c = $('welcome-card'); if (!c) return;
        clearTimeout(c._t); c.style.transform = '';
        c.classList.remove('show'); c.classList.add('out');
        setTimeout(() => c.classList.remove('out'), 700);
    },
});

// tap / swipe up to dismiss the welcome card
(() => {
    const c = $('welcome-card'); if (!c) return;
    let y0 = null, dy = 0;
    c.addEventListener('pointerdown', (e) => { y0 = e.clientY; dy = 0; c.classList.add('drag'); try { c.setPointerCapture(e.pointerId); } catch (_) {} });
    c.addEventListener('pointermove', (e) => { if (y0 == null) return; dy = Math.min(0, e.clientY - y0); c.style.transform = 'translate(-50%,' + dy + 'px)'; });
    const end = () => { if (y0 == null) return; const moved = dy; y0 = null; c.classList.remove('drag'); if (moved < -28 || Math.abs(moved) < 4) window.auth._welcomeHide(); else c.style.transform = ''; };
    c.addEventListener('pointerup', end); c.addEventListener('pointercancel', end);
})();
