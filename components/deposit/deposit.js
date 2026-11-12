/**
 * Deposit: UPI only (crypto removed). UPI is verified by UTR *or* Fam/UPI Transaction ID, race-safe (one payment can be credited only once).
 */
import { api } from '../../js/core/api.js?v=41f223a8d8';

Object.assign(window.app, {
    _activeDepositPolls: {},
    deposit: async () => window.app.depositUPI(),
    // ---- reference helpers (UTR or Transaction ID) ----
    // Accepts "FMPIB6862334894", "Transaction ID : FMPIB6862334894", "UTR 412345678901" ...
    extractRef: (raw) => {
        let t = String(raw || '').toUpperCase()
            .replace(/TRANSACTION\s*(ID|NO|NUMBER)?|TXN\s*(ID|NO)?|UPI\s*(REF(ERENCE)?)?\s*(ID|NO)?|REFERENCE\s*(ID|NO|NUMBER)?|REF\s*(ID|NO)?|UTR\s*(NO|NUMBER)?|RRN/g, ' ');
        const m = t.match(/[A-Z0-9]{8,24}/);
        return m ? m[0] : '';
    },
    refKind: (ref) => /^\d{10,14}$/.test(ref) ? 'utr' : /^[A-Z]{2,}[A-Z0-9]*\d[A-Z0-9]*$/.test(ref) && ref.length >= 10 ? 'txn' : 'other',
    onRefInput: (el) => {
        const box = document.getElementById('dep-ref-detect'); if (!box) return;
        const ref = window.app.extractRef(el.value);
        el.classList.remove('valid', 'invalid'); box.className = 'ref-detect';
        if (!el.value.trim()) { box.innerHTML = '<i class="fa-regular fa-circle"></i><span>Paste your UTR or the Transaction ID from your payment app</span>'; return; }
        if (!ref) { el.classList.add('invalid'); box.classList.add('warn'); box.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i><span>Keep typing — UTR / Transaction ID is at least 8 characters</span>'; return; }
        const k = window.app.refKind(ref);
        el.classList.add('valid'); box.classList.add('ok');
        box.innerHTML = k === 'utr' ? '<i class="fa-solid fa-circle-check"></i><span>UTR detected — <b>' + ref + '</b></span>'
            : k === 'txn' ? '<i class="fa-solid fa-circle-check"></i><span>Transaction ID detected — <b>' + ref + '</b></span>'
            : '<i class="fa-solid fa-circle-check"></i><span>Reference detected — <b>' + ref + '</b></span>';
    },
    depositUPI: async () => {
        if (window.app.flagOff('dep')) return window.ui.toast(window.app.flagMsg('dep'));
        const amtRaw = document.getElementById('dep-amount').value;
        const ref = window.app.extractRef(document.getElementById('dep-utr').value);   // UTR or Transaction ID
        const amt = parseFloat(amtRaw);
        if (!amt || isNaN(amt)) return window.ui.toast(window.msg.deposit.enterAmount());
        if (amt < window.app.minDep()) return window.ui.toast(window.msg.deposit.minAmount());
        if (!ref) return window.ui.toast(window.msg.deposit.badUtr());
        if (!window.app.rateLimit('deposit_' + ref, 15000)) return;
        const uid = window.db.user_uid;
        if (!uid) return window.ui.toast(window.msg.deposit.needLogin());
        const btn = document.querySelector(`#modal-deposit .btn-main[onclick*="deposit('upi')"]`);
        if (btn) btn.disabled = true;
        try {
            // the server makes sure one reference is used only once, belongs to this user and that the amount matches
            await api.post('/wallet/deposit/request', { method: 'UPI', ref, amount: amt });
        } catch (e) {
            if (btn) btn.disabled = false;
            if (window.app.geoBlocked(e)) return;
            // the admin switched Add Money OFF after this screen was opened -> show the admin's note
            if (e && e.code === 'disabled') { try { await window.app.refreshFlags(true); } catch (_) {} return window.ui.toast(e.message || window.app.flagMsg('dep')); }
            return window.ui.toast(e.message || window.msg.deposit.submitFailed());
        }
        if (btn) btn.disabled = false;
        try { document.getElementById('dep-amount').value = ''; document.getElementById('dep-utr').value = ''; window.app.onRefInput(document.getElementById('dep-utr')); } catch (_) {}
        window.ui.closeModal();
        window.app.startDepositPoll(ref, amt, uid, { overlay: true });
    },
    // One atomic check. Returns {status}: success | used | done | notfound | failed | gone
    //  - success : this call credited the wallet
    //  - used    : the same payment was already credited (under its UTR *or* its Transaction ID)
    //  - done    : this request was already completed (e.g. another tab) — nothing to do
    _checkFampay: async (ref, amt, uid, giveUp) => api.post('/wallet/deposit/check', { ref, giveUp: !!giveUp }),
    _depositNotify: async () => {},          // the server writes the deposit notifications itself
    startDepositPoll: (ref, amt, uid, opts) => {
        opts = opts || {};
        const A = window.app, ov = { amount: amt, ref };
        if (A._activeDepositPolls[ref]) {
            if (opts.overlay) A._showVerifyOverlay(window.msg.deposit.alreadyChecking.title, window.msg.deposit.alreadyChecking.sub, 'loading', ov);
            return;
        }
        A._activeDepositPolls[ref] = true;
        let lastSeen = null, finished = false;
        const finish = () => { finished = true; delete A._activeDepositPolls[ref]; };

        const onSuccess = async (received, trxDocId) => {
            try { await A.fetchUserData(); } catch (_) {}
            try { await A.fetchTransactions(); } catch (_) {}
            A._hideVerifyOverlay();
            // 3-second golden-coin animation -> wallet, balance counts up
            window.walletfx.deposit(received, window.db.balance || 0);
        };
        const onFail = async (trxDocId, giveUp) => {
            const F = window.msg.deposit.fail(amt, ref, lastSeen);
            if (giveUp) { try { await A._checkFampay(ref, amt, uid, true); } catch (_) {} }          // server marks it failed + notifies (only after its minimum wait)
            try { await A.fetchTransactions(); } catch (_) {}
            if (opts.overlay && !document.hidden) A._showVerifyOverlay(F.title, F.sub, 'fail', ov); else window.ui.toast(F.toast);
        };
        // returns true when polling should stop
        const handle = async (res) => {
            lastSeen = res;
            if (res.status === 'success') { await onSuccess(res.amount, res.trxDocId); finish(); return true; }
            if (res.status === 'used') { await onFail(res.trxDocId); finish(); return true; }
            if (res.status === 'done' || res.status === 'gone') { A._hideVerifyOverlay(); try { await A.fetchUserData(); await A.fetchTransactions(); } catch (_) {} finish(); return true; }
            if (res.status === 'failed') { A._hideVerifyOverlay(); finish(); return true; }
            return false;
        };

        // FOREGROUND: ~10s with the verifying animation
        const runForeground = async () => {
            A._showVerifyOverlay(window.msg.deposit.verifying.title, window.msg.deposit.verifying.sub, 'loading', ov);
            const timer = document.getElementById('dvo-timer');
            let remaining = 10;
            const tick = setInterval(() => { remaining--; if (timer && remaining >= 0) timer.innerText = 'Checking... ' + remaining + 's'; }, 1000);
            for (const wait of [1000, 2000, 2000, 2000, 2000]) {
                await new Promise(r => setTimeout(r, wait));
                try { if (await handle(await A._checkFampay(ref, amt, uid))) { clearInterval(tick); return; } } catch (_) {}
            }
            clearInterval(tick);
            // Not matched yet -> PENDING (never a hard fail here). Keep checking in the background.
            const P = window.msg.deposit.pending(amt);
            A._showVerifyOverlay(P.title, P.sub, 'pending', ov);
            runBackground();
        };
        // BACKGROUND: every 10s for 5 minutes; a request is marked failed only after 30 minutes without a match
        const runBackground = async () => {
            let attempts = 0, trxDocId = null, createdAt = Date.now();
            try { const r = await api.get('/wallet/deposit/pending'); const q = (r.items || []).find(x => x.utr === ref); if (q && q.createdAt) createdAt = q.createdAt; } catch (_) {}
            const iv = setInterval(async () => {
                if (finished) { clearInterval(iv); return; }
                attempts++;
                try { if (await handle(await A._checkFampay(ref, amt, uid))) { clearInterval(iv); return; } } catch (_) {}
                if (Date.now() - createdAt > 30 * 60 * 1000) { clearInterval(iv); await onFail(trxDocId, true); finish(); return; }
                if (attempts >= 30) { clearInterval(iv); delete A._activeDepositPolls[ref]; }   // stays pending; resumes next time the app opens
            }, 10000);
        };
        if (opts.overlay) runForeground(); else runBackground();
    },
});
